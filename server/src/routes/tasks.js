import express from 'express';
import { z } from 'zod';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { getBoardRole, checkTaskPermission } from '../middleware/permission.js';
import { calculateMidpointPosition, checkAndRebalanceColumn } from '../utils/fractionalIndex.js';
import { broadcastToBoard } from '../utils/socketEmitter.js';

const router = express.Router();

router.use(requireAuth);

const createTaskSchema = z.object({
  boardId: z.string().uuid(),
  title: z.string().min(1, 'Task title is required').max(255),
  description: z.string().max(5000).optional().default(''),
  status: z.enum(['to_do', 'in_progress', 'done']).optional().default('to_do'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  position: z.number().optional(),
  prevPosition: z.number().nullable().optional(),
  nextPosition: z.number().nullable().optional(),
  clientMutationId: z.string().max(64).optional(),
});

const updateTaskSchema = z.object({
  expectedVersion: z.number().int().min(1, 'expectedVersion is required and must be an integer >= 1'),
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional(),
  status: z.enum(['to_do', 'in_progress', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assigneeId: z.union([z.string().uuid(), z.null(), z.literal('UNASSIGN')]).optional(),
  dueDate: z.union([z.string().datetime(), z.null(), z.literal('CLEAR')]).optional(),
  position: z.number().optional(),
  prevPosition: z.number().nullable().optional(),
  nextPosition: z.number().nullable().optional(),
});

const deleteTaskSchema = z.object({
  expectedVersion: z.number().int().min(1, 'expectedVersion is required and must be an integer >= 1'),
});

// GET /api/tasks?boardId=... - List all active tasks for a board
router.get('/', async (req, res, next) => {
  try {
    const { boardId } = req.query;
    if (!boardId) {
      throw new AppError('BAD_REQUEST', 'boardId query parameter is required', 400);
    }

    // Check membership
    const role = await getBoardRole(boardId, req.user.id);
    if (!role) {
      throw new AppError('FORBIDDEN', 'You are not a member of this board', 403);
    }

    const tasksRes = await query(`
      SELECT t.id, t.board_id, t.title, t.description, t.status, t.position, t.priority,
             t.due_date, t.assignee_id, t.created_by, t.version, t.client_mutation_id,
             t.created_at, t.updated_at,
             u_assignee.name AS assignee_name, u_assignee.avatar_color AS assignee_avatar,
             u_creator.name AS creator_name, u_creator.avatar_color AS creator_avatar,
             (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id)::int AS comment_count
      FROM tasks t
      LEFT JOIN users u_assignee ON u_assignee.id = t.assignee_id
      JOIN users u_creator ON u_creator.id = t.created_by
      WHERE t.board_id = $1 AND t.deleted_at IS NULL
      ORDER BY t.status, t.position ASC
    `, [boardId]);

    return res.json({ tasks: tasksRes.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/tasks/:taskId - Get task details with comments
router.get('/:taskId', async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { task, role } = await checkTaskPermission(taskId, req.user.id, 'read');

    const detailedRes = await query(`
      SELECT t.id, t.board_id, t.title, t.description, t.status, t.position, t.priority,
             t.due_date, t.assignee_id, t.created_by, t.version, t.client_mutation_id,
             t.created_at, t.updated_at,
             u_assignee.name AS assignee_name, u_assignee.avatar_color AS assignee_avatar,
             u_creator.name AS creator_name, u_creator.avatar_color AS creator_avatar
      FROM tasks t
      LEFT JOIN users u_assignee ON u_assignee.id = t.assignee_id
      JOIN users u_creator ON u_creator.id = t.created_by
      WHERE t.id = $1 AND t.deleted_at IS NULL
    `, [taskId]);

    if (detailedRes.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Task not found or has been deleted', 404);
    }

    return res.json({ task: detailedRes.rows[0], userRole: role });
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks - Create task (idempotent via clientMutationId)
router.post('/', async (req, res, next) => {
  try {
    const validated = createTaskSchema.parse(req.body);

    // 1. Check board membership and role BEFORE creating
    const role = await getBoardRole(validated.boardId, req.user.id);
    if (!role) {
      throw new AppError('FORBIDDEN', 'You are not a member of this board', 403);
    }
    if (role === 'viewer') {
      throw new AppError('FORBIDDEN', 'Viewers cannot create tasks', 403);
    }

    // 2. Idempotency check via clientMutationId
    if (validated.clientMutationId) {
      const existingTask = await query(`
        SELECT t.id, t.board_id, t.title, t.description, t.status, t.position, t.priority,
               t.due_date, t.assignee_id, t.created_by, t.version, t.client_mutation_id,
               t.created_at, t.updated_at,
               u_assignee.name AS assignee_name, u_assignee.avatar_color AS assignee_avatar,
               u_creator.name AS creator_name, u_creator.avatar_color AS creator_avatar
        FROM tasks t
        LEFT JOIN users u_assignee ON u_assignee.id = t.assignee_id
        JOIN users u_creator ON u_creator.id = t.created_by
        WHERE t.client_mutation_id = $1 AND t.deleted_at IS NULL
      `, [validated.clientMutationId]);

      if (existingTask.rows.length > 0) {
        return res.status(200).json({
          task: existingTask.rows[0],
          idempotentReplay: true,
        });
      }
    }

    // 3. Compute position
    let finalPosition = validated.position;
    if (finalPosition === undefined) {
      if (validated.prevPosition != null || validated.nextPosition != null) {
        finalPosition = calculateMidpointPosition(validated.prevPosition, validated.nextPosition);
      } else {
        // Place at bottom of column
        const maxPosRes = await query(
          'SELECT MAX(position) AS max_pos FROM tasks WHERE board_id = $1 AND status = $2 AND deleted_at IS NULL',
          [validated.boardId, validated.status]
        );
        const maxPos = maxPosRes.rows[0]?.max_pos;
        finalPosition = maxPos != null ? Number(maxPos) + 1000.0 : 1000.0;
      }
    }

    const assigneeId = validated.assigneeId || null;
    const dueDate = validated.dueDate || null;

    const insertRes = await query(`
      INSERT INTO tasks (
        board_id, title, description, status, position, priority,
        due_date, assignee_id, created_by, version, client_mutation_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, $10)
      RETURNING *
    `, [
      validated.boardId,
      validated.title.trim(),
      validated.description.trim(),
      validated.status,
      finalPosition,
      validated.priority,
      dueDate,
      assigneeId,
      req.user.id,
      validated.clientMutationId || null,
    ]);

    const createdTask = insertRes.rows[0];

    // Fetch full enriched task
    const fullTaskRes = await query(`
      SELECT t.id, t.board_id, t.title, t.description, t.status, t.position, t.priority,
             t.due_date, t.assignee_id, t.created_by, t.version, t.client_mutation_id,
             t.created_at, t.updated_at,
             u_assignee.name AS assignee_name, u_assignee.avatar_color AS assignee_avatar,
             u_creator.name AS creator_name, u_creator.avatar_color AS creator_avatar,
             0 AS comment_count
      FROM tasks t
      LEFT JOIN users u_assignee ON u_assignee.id = t.assignee_id
      JOIN users u_creator ON u_creator.id = t.created_by
      WHERE t.id = $1
    `, [createdTask.id]);

    const enrichedTask = fullTaskRes.rows[0];

    // Log activity
    await query(`
      INSERT INTO activity_log (board_id, task_id, user_id, action, details)
      VALUES ($1, $2, $3, 'create_task', $4)
    `, [validated.boardId, createdTask.id, req.user.id, JSON.stringify({
      title: createdTask.title,
      status: createdTask.status,
    })]);

    // Broadcast WebSocket event
    broadcastToBoard(validated.boardId, 'task:created', { task: enrichedTask });

    return res.status(201).json({ task: enrichedTask });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/tasks/:taskId - Atomic edit / move task with expectedVersion
router.patch('/:taskId', async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const validated = updateTaskSchema.parse(req.body);

    // Rule 11: Validate and check permissions BEFORE touching the version logic
    const { task: existingTask } = await checkTaskPermission(taskId, req.user.id, 'edit');

    // Compute position if moving
    let targetPosition = validated.position;
    if (targetPosition === undefined && (validated.prevPosition != null || validated.nextPosition != null)) {
      targetPosition = calculateMidpointPosition(validated.prevPosition, validated.nextPosition);
    }

    // Determine assignee update
    let assigneeParam = undefined;
    if (validated.assigneeId === 'UNASSIGN') {
      assigneeParam = 'UNASSIGN';
    } else if (validated.assigneeId !== undefined) {
      assigneeParam = validated.assigneeId; // null or UUID
    }

    // Determine due date update
    let dueDateParam = undefined;
    if (validated.dueDate === 'CLEAR') {
      dueDateParam = 'CLEAR';
    } else if (validated.dueDate !== undefined) {
      dueDateParam = validated.dueDate; // null or ISO string
    }

    // Atomic update statement
    const updateRes = await query(`
      UPDATE tasks
      SET title = COALESCE($1, title),
          description = COALESCE($2, description),
          status = COALESCE($3, status),
          position = COALESCE($4, position),
          priority = COALESCE($5, priority),
          assignee_id = CASE 
            WHEN $6 = 'UNASSIGN' THEN NULL 
            WHEN $6 IS NOT NULL THEN $6::uuid 
            ELSE assignee_id 
          END,
          due_date = CASE 
            WHEN $7 = 'CLEAR' THEN NULL 
            WHEN $7 IS NOT NULL THEN $7::timestamptz 
            ELSE due_date 
          END,
          version = version + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $8 AND version = $9 AND deleted_at IS NULL
      RETURNING *
    `, [
      validated.title ?? null,
      validated.description ?? null,
      validated.status ?? null,
      targetPosition ?? null,
      validated.priority ?? null,
      assigneeParam ?? null,
      dueDateParam ?? null,
      taskId,
      validated.expectedVersion,
    ]);

    // Handle 0 rows updated
    if (updateRes.rowCount === 0) {
      // Check current DB state
      const checkRes = await query('SELECT * FROM tasks WHERE id = $1', [taskId]);
      if (checkRes.rows.length === 0) {
        throw new AppError('NOT_FOUND', 'Task not found', 404);
      }
      const current = checkRes.rows[0];
      if (current.deleted_at !== null) {
        return res.status(410).json({
          error: {
            code: 'TASK_DELETED',
            message: 'Task has already been deleted',
          },
          currentTask: current,
        });
      }
      // Concurrency conflict!
      return res.status(409).json({
        error: {
          code: 'VERSION_CONFLICT',
          message: 'Someone updated this task first, so your change was not applied.',
        },
        currentTask: current,
      });
    }

    const updatedTask = updateRes.rows[0];

    // Check if column needs rebalancing
    if (validated.status || targetPosition !== undefined) {
      await checkAndRebalanceColumn(existingTask.board_id, updatedTask.status);
    }

    // Fetch enriched updated task
    const fullTaskRes = await query(`
      SELECT t.id, t.board_id, t.title, t.description, t.status, t.position, t.priority,
             t.due_date, t.assignee_id, t.created_by, t.version, t.client_mutation_id,
             t.created_at, t.updated_at,
             u_assignee.name AS assignee_name, u_assignee.avatar_color AS assignee_avatar,
             u_creator.name AS creator_name, u_creator.avatar_color AS creator_avatar,
             (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id)::int AS comment_count
      FROM tasks t
      LEFT JOIN users u_assignee ON u_assignee.id = t.assignee_id
      JOIN users u_creator ON u_creator.id = t.created_by
      WHERE t.id = $1
    `, [taskId]);

    const enriched = fullTaskRes.rows[0];

    // Activity log: moved or edited
    const isMove = validated.status && validated.status !== existingTask.status;
    const actionName = isMove ? 'move_task' : 'update_task';

    await query(`
      INSERT INTO activity_log (board_id, task_id, user_id, action, details)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      existingTask.board_id,
      taskId,
      req.user.id,
      actionName,
      JSON.stringify({
        title: updatedTask.title,
        oldStatus: existingTask.status,
        newStatus: updatedTask.status,
        version: updatedTask.version,
      }),
    ]);

    // Broadcast Socket.IO event
    broadcastToBoard(existingTask.board_id, 'task:updated', { task: enriched });

    return res.json({ task: enriched });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tasks/:taskId - Atomic soft delete with expectedVersion
router.delete('/:taskId', async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const validated = deleteTaskSchema.parse(req.body);

    // Rule 11: Validate and check permissions BEFORE touching the version logic
    const { task: existingTask } = await checkTaskPermission(taskId, req.user.id, 'delete');

    // Atomic versioned soft delete
    const deleteRes = await query(`
      UPDATE tasks
      SET deleted_at = CURRENT_TIMESTAMP,
          version = version + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND version = $2 AND deleted_at IS NULL
      RETURNING *
    `, [taskId, validated.expectedVersion]);

    if (deleteRes.rowCount === 0) {
      const checkRes = await query('SELECT * FROM tasks WHERE id = $1', [taskId]);
      if (checkRes.rows.length === 0) {
        throw new AppError('NOT_FOUND', 'Task not found', 404);
      }
      const current = checkRes.rows[0];
      if (current.deleted_at !== null) {
        return res.status(410).json({
          error: {
            code: 'TASK_DELETED',
            message: 'Task has already been deleted',
          },
          currentTask: current,
        });
      }
      return res.status(409).json({
        error: {
          code: 'VERSION_CONFLICT',
          message: 'Someone updated this task first, so your change was not applied.',
        },
        currentTask: current,
      });
    }

    const deleted = deleteRes.rows[0];

    // Activity log
    await query(`
      INSERT INTO activity_log (board_id, task_id, user_id, action, details)
      VALUES ($1, $2, $3, 'delete_task', $4)
    `, [
      existingTask.board_id,
      taskId,
      req.user.id,
      JSON.stringify({
        title: deleted.title,
        version: deleted.version,
      }),
    ]);

    // Broadcast Socket.IO event
    broadcastToBoard(existingTask.board_id, 'task:deleted', {
      taskId,
      version: deleted.version,
      boardId: existingTask.board_id,
    });

    return res.json({
      success: true,
      message: 'Task successfully deleted',
      task: deleted,
    });
  } catch (err) {
    next(err);
  }
});

export default router;

