import express from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { getBoardRole } from '../middleware/permission.js';

const router = express.Router();

router.use(requireAuth);

const createBoardSchema = z.object({
  title: z.string().min(1, 'Board title is required').max(150),
  description: z.string().max(1000).optional().default(''),
});

const joinBoardSchema = z.object({
  inviteCode: z.string().min(4).max(32),
});

const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'member', 'viewer']),
});

function generateInviteCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 chars e.g. "A1B2C3D4"
}

// GET /api/boards - List all boards where current user is a member
router.get('/', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT b.id, b.title, b.description, b.invite_code, b.created_at, b.updated_at,
             bm.role, bm.joined_at,
             u.name AS owner_name,
             (SELECT COUNT(*) FROM tasks t WHERE t.board_id = b.id AND t.deleted_at IS NULL)::int AS task_count,
             (SELECT COUNT(*) FROM board_members bm_cnt WHERE bm_cnt.board_id = b.id)::int AS member_count
      FROM boards b
      JOIN board_members bm ON bm.board_id = b.id AND bm.user_id = $1
      JOIN users u ON u.id = b.created_by
      ORDER BY bm.joined_at DESC
    `, [req.user.id]);

    return res.json({ boards: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/boards - Create a new board
router.post('/', async (req, res, next) => {
  try {
    const validated = createBoardSchema.parse(req.body);
    let inviteCode = generateInviteCode();

    // Ensure unique invite code
    let codeExists = true;
    while (codeExists) {
      const check = await query('SELECT id FROM boards WHERE invite_code = $1', [inviteCode]);
      if (check.rows.length === 0) {
        codeExists = false;
      } else {
        inviteCode = generateInviteCode();
      }
    }

    const boardRes = await query(`
      INSERT INTO boards (title, description, invite_code, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [validated.title.trim(), validated.description?.trim() || '', inviteCode, req.user.id]);

    const board = boardRes.rows[0];

    // Add creator as admin
    await query(`
      INSERT INTO board_members (board_id, user_id, role)
      VALUES ($1, $2, 'admin')
    `, [board.id, req.user.id]);

    // Log activity
    await query(`
      INSERT INTO activity_log (board_id, user_id, action, details)
      VALUES ($1, $2, 'create_board', $3)
    `, [board.id, req.user.id, JSON.stringify({ title: board.title })]);

    return res.status(201).json({
      board: {
        ...board,
        role: 'admin',
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/boards/join - Join board via invite code
router.post('/join', async (req, res, next) => {
  try {
    const validated = joinBoardSchema.parse(req.body);
    const code = validated.inviteCode.trim().toUpperCase();

    const boardRes = await query('SELECT * FROM boards WHERE invite_code = $1', [code]);
    if (boardRes.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'No board found with this invite code', 404);
    }

    const board = boardRes.rows[0];

    // Check if already a member
    const existingMember = await query(
      'SELECT role FROM board_members WHERE board_id = $1 AND user_id = $2',
      [board.id, req.user.id]
    );

    if (existingMember.rows.length > 0) {
      return res.json({
        board: {
          ...board,
          role: existingMember.rows[0].role,
        },
        message: 'You are already a member of this board',
      });
    }

    // Default join role: member
    await query(`
      INSERT INTO board_members (board_id, user_id, role)
      VALUES ($1, $2, 'member')
    `, [board.id, req.user.id]);

    // Log activity
    await query(`
      INSERT INTO activity_log (board_id, user_id, action, details)
      VALUES ($1, $2, 'join_board', $3)
    `, [board.id, req.user.id, JSON.stringify({ userName: req.user.name })]);

    return res.status(201).json({
      board: {
        ...board,
        role: 'member',
      },
      message: 'Successfully joined board!',
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/boards/:boardId - Get board details and members
router.get('/:boardId', async (req, res, next) => {
  try {
    const { boardId } = req.params;

    // Check membership and role from DB
    const role = await getBoardRole(boardId, req.user.id);
    if (!role) {
      throw new AppError('FORBIDDEN', 'You are not a member of this board', 403);
    }

    const boardRes = await query('SELECT * FROM boards WHERE id = $1', [boardId]);
    if (boardRes.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Board not found', 404);
    }

    const board = boardRes.rows[0];

    // Get members
    const membersRes = await query(`
      SELECT bm.id, bm.user_id, bm.role, bm.joined_at,
             u.name, u.email, u.avatar_color
      FROM board_members bm
      JOIN users u ON u.id = bm.user_id
      WHERE bm.board_id = $1
      ORDER BY 
        CASE bm.role 
          WHEN 'admin' THEN 1 
          WHEN 'member' THEN 2 
          ELSE 3 
        END,
        bm.joined_at ASC
    `, [boardId]);

    return res.json({
      board: {
        ...board,
        role,
      },
      members: membersRes.rows,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/boards/:boardId/members/:userId - Change member role (Admin only)
router.put('/:boardId/members/:userId', async (req, res, next) => {
  try {
    const { boardId, userId } = req.params;
    const validated = updateMemberRoleSchema.parse(req.body);

    // Require admin role
    const callerRole = await getBoardRole(boardId, req.user.id);
    if (callerRole !== 'admin') {
      throw new AppError('FORBIDDEN', 'Only admins can change member roles', 403);
    }

    // Target member exists?
    const targetMember = await query(
      'SELECT role FROM board_members WHERE board_id = $1 AND user_id = $2',
      [boardId, userId]
    );
    if (targetMember.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Member not found on this board', 404);
    }

    // If demoting an admin, ensure at least one other admin remains
    if (targetMember.rows[0].role === 'admin' && validated.role !== 'admin') {
      const adminCountRes = await query(
        "SELECT COUNT(*)::int AS count FROM board_members WHERE board_id = $1 AND role = 'admin'",
        [boardId]
      );
      if (adminCountRes.rows[0].count <= 1) {
        throw new AppError('BAD_REQUEST', 'Cannot demote the only admin of the board', 400);
      }
    }

    await query(`
      UPDATE board_members 
      SET role = $1 
      WHERE board_id = $2 AND user_id = $3
    `, [validated.role, boardId, userId]);

    // Log activity
    await query(`
      INSERT INTO activity_log (board_id, user_id, action, details)
      VALUES ($1, $2, 'update_role', $3)
    `, [boardId, req.user.id, JSON.stringify({ targetUserId: userId, newRole: validated.role })]);

    return res.json({
      success: true,
      message: `Member role updated to ${validated.role}`,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/boards/:boardId/members/:userId - Remove member from board (Admin only)
router.delete('/:boardId/members/:userId', async (req, res, next) => {
  try {
    const { boardId, userId } = req.params;

    const callerRole = await getBoardRole(boardId, req.user.id);
    if (callerRole !== 'admin') {
      throw new AppError('FORBIDDEN', 'Only admins can remove members', 403);
    }

    // Cannot remove the only admin
    const targetMember = await query(
      'SELECT role FROM board_members WHERE board_id = $1 AND user_id = $2',
      [boardId, userId]
    );
    if (targetMember.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Member not found on this board', 404);
    }

    if (targetMember.rows[0].role === 'admin') {
      const adminCountRes = await query(
        "SELECT COUNT(*)::int AS count FROM board_members WHERE board_id = $1 AND role = 'admin'",
        [boardId]
      );
      if (adminCountRes.rows[0].count <= 1) {
        throw new AppError('BAD_REQUEST', 'Cannot remove the only admin of the board', 400);
      }
    }

    await query('DELETE FROM board_members WHERE board_id = $1 AND user_id = $2', [boardId, userId]);

    // Log activity
    await query(`
      INSERT INTO activity_log (board_id, user_id, action, details)
      VALUES ($1, $2, 'remove_member', $3)
    `, [boardId, req.user.id, JSON.stringify({ removedUserId: userId })]);

    return res.json({ success: true, message: 'Member removed from board' });
  } catch (err) {
    next(err);
  }
});

export default router;

