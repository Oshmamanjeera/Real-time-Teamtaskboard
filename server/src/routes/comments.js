import express from 'express';
import { z } from 'zod';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { getBoardRole } from '../middleware/permission.js';
import { broadcastToBoard } from '../utils/socketEmitter.js';

const router = express.Router();

router.use(requireAuth);

const addCommentSchema = z.object({
  content: z.string().min(1, 'Comment content cannot be empty').max(2000),
});

// GET /api/tasks/:taskId/comments
router.get('/:taskId/comments', async (req, res, next) => {
  try {
    const { taskId } = req.params;

    const taskRes = await query('SELECT board_id, deleted_at FROM tasks WHERE id = $1', [taskId]);
    if (taskRes.rows.length === 0 || taskRes.rows[0].deleted_at !== null) {
      throw new AppError('NOT_FOUND', 'Task not found', 404);
    }

    const boardId = taskRes.rows[0].board_id;
    const role = await getBoardRole(boardId, req.user.id);
    if (!role) {
      throw new AppError('FORBIDDEN', 'You are not a member of this board', 403);
    }

    const commentsRes = await query(`
      SELECT c.id, c.task_id, c.user_id, c.content, c.created_at,
             u.name AS user_name, u.avatar_color AS user_avatar
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.task_id = $1
      ORDER BY c.created_at ASC
    `, [taskId]);

    return res.json({ comments: commentsRes.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/:taskId/comments
router.post('/:taskId/comments', async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const validated = addCommentSchema.parse(req.body);

    const taskRes = await query('SELECT board_id, title, deleted_at FROM tasks WHERE id = $1', [taskId]);
    if (taskRes.rows.length === 0 || taskRes.rows[0].deleted_at !== null) {
      throw new AppError('NOT_FOUND', 'Task not found', 404);
    }

    const { board_id: boardId, title: taskTitle } = taskRes.rows[0];
    const role = await getBoardRole(boardId, req.user.id);
    if (!role) {
      throw new AppError('FORBIDDEN', 'You are not a member of this board', 403);
    }
    if (role === 'viewer') {
      throw new AppError('FORBIDDEN', 'Viewers cannot add comments', 403);
    }

    const insertRes = await query(`
      INSERT INTO comments (task_id, user_id, content)
      VALUES ($1, $2, $3)
      RETURNING id, task_id, user_id, content, created_at
    `, [taskId, req.user.id, validated.content.trim()]);

    const comment = {
      ...insertRes.rows[0],
      user_name: req.user.name,
      user_avatar: req.user.avatar_color,
    };

    // Log activity
    await query(`
      INSERT INTO activity_log (board_id, task_id, user_id, action, details)
      VALUES ($1, $2, $3, 'comment_task', $4)
    `, [boardId, taskId, req.user.id, JSON.stringify({
      taskTitle,
      commentSnippet: comment.content.slice(0, 60),
    })]);

    // Broadcast Socket.IO event
    broadcastToBoard(boardId, 'comment:created', {
      taskId,
      comment,
    });

    return res.status(201).json({ comment });
  } catch (err) {
    next(err);
  }
});

export default router;

