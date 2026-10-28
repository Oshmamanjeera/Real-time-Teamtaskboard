import dotenv from 'dotenv';
dotenv.config();

export const config = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || '',
  FORCE_PGLITE: process.env.FORCE_PGLITE === 'true',
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'kawaii_super_secret_access_key_2026_!@#',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'kawaii_super_secret_refresh_key_2026_$%^',
  JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || '15m',
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || '7d',
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  COOKIE_SECRET: process.env.COOKIE_SECRET || 'kawaii_cookie_secret_2026',
};

