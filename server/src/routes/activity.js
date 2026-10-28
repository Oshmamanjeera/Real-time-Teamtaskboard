import express from 'express';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { getBoardRole } from '../middleware/permission.js';

const router = express.Router();

router.use(requireAuth);

// GET /api/activity?boardId=...
router.get('/', async (req, res, next) => {
  try {
    const { boardId } = req.query;
    if (!boardId) {
      throw new AppError('BAD_REQUEST', 'boardId query parameter is required', 400);
    }

    const role = await getBoardRole(boardId, req.user.id);
    if (!role) {
      throw new AppError('FORBIDDEN', 'You are not a member of this board', 403);
    }

    const logsRes = await query(`
      SELECT a.id, a.board_id, a.task_id, a.user_id, a.action, a.details, a.created_at,
             u.name AS user_name, u.avatar_color AS user_avatar
      FROM activity_log a
      JOIN users u ON u.id = a.user_id
      WHERE a.board_id = $1
      ORDER BY a.created_at DESC
      LIMIT 100
    `, [boardId]);

    return res.json({ activities: logsRes.rows });
  } catch (err) {
    next(err);
  }
});

export default router;

