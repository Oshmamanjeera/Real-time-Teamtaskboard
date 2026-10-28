import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { io as Client } from 'socket.io-client';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { setupSocketIO } from '../src/socket.js';
import { runMigrations } from '../src/db/migrate.js';
import { closeDb, query } from '../src/db/index.js';
import { signAccessToken } from '../src/utils/jwt.js';

describe('Socket.IO Real-Time Sync & Authentication', () => {
  let server;
  let serverPort;
  let adminUser, outsiderUser;
  let adminToken, outsiderToken;
  let board1Id, board2Id;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await runMigrations();

    const app = createApp();
    server = http.createServer(app);
    setupSocketIO(server);

    await new Promise((resolve) => {
      server.listen(0, () => {
        serverPort = server.address().port;
        resolve();
      });
    });

    const pwd = await bcrypt.hash('Password123!', 10);
    const ts = Date.now();

    const adminRes = await query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING *',
      [`sock_admin_${ts}@test.local`, pwd, 'Socket Admin']
    );
    adminUser = adminRes.rows[0];
    adminToken = signAccessToken({ userId: adminUser.id });

    const outsiderRes = await query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING *',
      [`sock_outsider_${ts}@test.local`, pwd, 'Socket Outsider']
    );
    outsiderUser = outsiderRes.rows[0];
    outsiderToken = signAccessToken({ userId: outsiderUser.id });

    // Board 1 has adminUser
    const b1 = await query(
      'INSERT INTO boards (title, invite_code, created_by) VALUES ($1, $2, $3) RETURNING *',
      ['Socket Board 1', `SOCK1_${ts}`, adminUser.id]
    );
    board1Id = b1.rows[0].id;
    await query('INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, $3)', [board1Id, adminUser.id, 'admin']);

    // Board 2 has outsiderUser
    const b2 = await query(
      'INSERT INTO boards (title, invite_code, created_by) VALUES ($1, $2, $3) RETURNING *',
      ['Socket Board 2', `SOCK2_${ts}`, outsiderUser.id]
    );
    board2Id = b2.rows[0].id;
    await query('INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, $3)', [board2Id, outsiderUser.id, 'admin']);
  });

  afterAll(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    await closeDb();
  });

  it('rejects socket connection without JWT token', async () => {
    await new Promise((resolve) => {
      const socket = Client(`http://localhost:${serverPort}`, {
        transports: ['websocket'],
        autoConnect: true,
      });

      socket.on('connect_error', (err) => {
        expect(err.message).toContain('Authentication error');
        socket.disconnect();
        resolve();
      });
    });
  });

  it('authenticates socket connection with valid JWT token', async () => {
    await new Promise((resolve) => {
      const socket = Client(`http://localhost:${serverPort}`, {
        transports: ['websocket'],
        auth: { token: adminToken },
      });

      socket.on('connect', () => {
        expect(socket.connected).toBe(true);
        socket.disconnect();
        resolve();
      });
    });
  });

  it('rejects joining a board room if the user is not a member', async () => {
    await new Promise((resolve) => {
      // outsider connects and tries to join board 1 (where only admin is member)
      const socket = Client(`http://localhost:${serverPort}`, {
        transports: ['websocket'],
        auth: { token: outsiderToken },
      });

      socket.on('connect', () => {
        socket.emit('join:board', { boardId: board1Id }, (res) => {
          expect(res.error).toBeDefined();
          expect(res.error.code).toBe('FORBIDDEN');
          socket.disconnect();
          resolve();
        });
      });
    });
  });

  it('successfully joins board and receives presence update', async () => {
    await new Promise((resolve) => {
      const socket = Client(`http://localhost:${serverPort}`, {
        transports: ['websocket'],
        auth: { token: adminToken },
      });

      socket.on('connect', () => {
        socket.emit('join:board', { boardId: board1Id }, (res) => {
          expect(res.success).toBe(true);
          expect(res.role).toBe('admin');
        });
      });

      socket.on('presence:update', (data) => {
        if (data.boardId === board1Id) {
          expect(data.users.length).toBeGreaterThanOrEqual(1);
          expect(data.users.some(u => u.userId === adminUser.id)).toBe(true);
          socket.disconnect();
          resolve();
        }
      });
    });
  });
});

