import express from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db/index.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { AppError } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { config } from '../config.js';

const router = express.Router();

const PASTEL_AVATARS = [
  '#F7CADA', // Blush pink
  '#8FA8E8', // Periwinkle
  '#FFF3C4', // Butter cream
  '#BFD7F3', // Sky blue
  '#FFD966', // Star yellow
  '#C8E6C9', // Soft mint
];

const registerSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
  name: z.string().min(1, 'Name is required').max(100),
  avatarColor: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const isProduction = config.NODE_ENV === 'production';

const cookieOptions = {
  httpOnly: true,
  secure: isProduction,          // HTTPS only in production
  // Cross-site cookies require sameSite:'none' + secure:true when the client
  // (Vercel) and server (Render) are on different domains.
  sameSite: isProduction ? 'none' : 'lax',
  path: '/',
};

router.post('/register', authRateLimiter, async (req, res, next) => {
  try {
    const validated = registerSchema.parse(req.body);
    const email = validated.email.toLowerCase().trim();

    // Check if user already exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      throw new AppError('CONFLICT', 'Email is already registered', 409);
    }

    const passwordHash = await bcrypt.hash(validated.password, 10);
    const avatarColor = validated.avatarColor || PASTEL_AVATARS[Math.floor(Math.random() * PASTEL_AVATARS.length)];

    const insertRes = await query(`
      INSERT INTO users (email, password_hash, name, avatar_color)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, name, avatar_color, created_at
    `, [email, passwordHash, validated.name.trim(), avatarColor]);

    const user = insertRes.rows[0];
    const accessToken = signAccessToken({ userId: user.id });
    const refreshToken = signRefreshToken({ userId: user.id });

    res.cookie('refreshToken', refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.cookie('access_token', accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000, // 15 mins
    });

    return res.status(201).json({
      user,
      accessToken,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', authRateLimiter, async (req, res, next) => {
  try {
    const validated = loginSchema.parse(req.body);
    const email = validated.email.toLowerCase().trim();

    const userRes = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
      throw new AppError('UNAUTHORIZED', 'Invalid email or password', 401);
    }

    const userRecord = userRes.rows[0];
    const passwordMatch = await bcrypt.compare(validated.password, userRecord.password_hash);
    if (!passwordMatch) {
      throw new AppError('UNAUTHORIZED', 'Invalid email or password', 401);
    }

    const user = {
      id: userRecord.id,
      email: userRecord.email,
      name: userRecord.name,
      avatar_color: userRecord.avatar_color,
      created_at: userRecord.created_at,
    };

    const accessToken = signAccessToken({ userId: user.id });
    const refreshToken = signRefreshToken({ userId: user.id });

    res.cookie('refreshToken', refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie('access_token', accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000,
    });

    return res.json({
      user,
      accessToken,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!refreshToken) {
      throw new AppError('UNAUTHORIZED', 'Refresh token is missing', 401);
    }

    const payload = verifyRefreshToken(refreshToken);
    if (!payload || !payload.userId) {
      throw new AppError('UNAUTHORIZED', 'Invalid or expired refresh token', 401);
    }

    const userRes = await query('SELECT id, email, name, avatar_color FROM users WHERE id = $1', [payload.userId]);
    if (userRes.rows.length === 0) {
      throw new AppError('UNAUTHORIZED', 'User account not found', 401);
    }

    const user = userRes.rows[0];
    const newAccessToken = signAccessToken({ userId: user.id });
    const newRefreshToken = signRefreshToken({ userId: user.id });

    res.cookie('refreshToken', newRefreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie('access_token', newAccessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000,
    });

    return res.json({
      user,
      accessToken: newAccessToken,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('refreshToken', cookieOptions);
  res.clearCookie('access_token', cookieOptions);
  return res.json({ success: true, message: 'Successfully logged out' });
});

router.get('/me', requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

export default router;

