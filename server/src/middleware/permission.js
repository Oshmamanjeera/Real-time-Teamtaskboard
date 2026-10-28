import { query } from '../db/index.js';
import { AppError } from './error.js';

export async function getBoardRole(boardId, userId) {
  const res = await query(
    'SELECT role FROM board_members WHERE board_id = $1 AND user_id = $2',
    [boardId, userId]
  );
  if (res.rows.length === 0) return null;
  return res.rows[0].role;
}

export function requireBoardAccess(allowedRoles = ['admin', 'member', 'viewer']) {
  return async (req, res, next) => {
    try {
      const boardId = req.params.boardId || req.body.boardId || req.query.boardId;
      if (!boardId) {
        throw new AppError('BAD_REQUEST', 'boardId is required', 400);
      }

      const role = await getBoardRole(boardId, req.user.id);
      if (!role) {
        throw new AppError('FORBIDDEN', 'You are not a member of this board', 403);
      }

      if (!allowedRoles.includes(role)) {
        throw new AppError('FORBIDDEN', `Action requires one of: ${allowedRoles.join(', ')}`, 403);
      }

      req.boardRole = role;
      req.boardId = boardId;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export async function checkTaskPermission(taskId, userId, action) {
  // Action can be: 'read', 'edit', 'delete'
  const taskRes = await query(
    'SELECT id, board_id, created_by, assignee_id, deleted_at, version FROM tasks WHERE id = $1',
    [taskId]
  );

  if (taskRes.rows.length === 0) {
    throw new AppError('NOT_FOUND', 'Task not found', 404);
  }

  const task = taskRes.rows[0];

  // Re-check membership and role from DB
  const role = await getBoardRole(task.board_id, userId);
  if (!role) {
    throw new AppError('FORBIDDEN', 'You are not a member of this board', 403);
  }

  if (action === 'read') {
    return { task, role };
  }

  // Any write by viewer is 403
  if (role === 'viewer') {
    throw new AppError('FORBIDDEN', 'Viewers cannot modify tasks', 403);
  }

  if (role === 'admin') {
    return { task, role };
  }

  if (role === 'member') {
    if (action === 'edit') {
      const isCreator = task.created_by === userId;
      const isAssignee = task.assignee_id === userId;
      if (!isCreator && !isAssignee) {
        throw new AppError('FORBIDDEN', 'Members can only edit/move tasks they created or are assigned to', 403);
      }
      return { task, role };
    }

    if (action === 'delete') {
      const isCreator = task.created_by === userId;
      if (!isCreator) {
        throw new AppError('FORBIDDEN', 'Members can only delete tasks they created', 403);
      }
      return { task, role };
    }
  }

  throw new AppError('FORBIDDEN', 'Unauthorized task action', 403);
}

