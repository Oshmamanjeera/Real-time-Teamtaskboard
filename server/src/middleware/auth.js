import { verifyAccessToken } from '../utils/jwt.js';
import { query } from '../db/index.js';
import { AppError } from './error.js';

export async function requireAuth(req, res, next) {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.access_token) {
      token = req.cookies.access_token;
    }

    if (!token) {
      throw new AppError('UNAUTHORIZED', 'Authentication token is missing', 401);
    }

    const payload = verifyAccessToken(token);
    if (!payload || !payload.userId) {
      throw new AppError('UNAUTHORIZED', 'Invalid or expired access token', 401);
    }

    // Verify user exists in DB
    const userRes = await query('SELECT id, email, name, avatar_color FROM users WHERE id = $1', [payload.userId]);
    if (userRes.rows.length === 0) {
      throw new AppError('UNAUTHORIZED', 'User account no longer exists', 401);
    }

    req.user = userRes.rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

