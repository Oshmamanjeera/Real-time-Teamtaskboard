import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { runMigrations } from '../src/db/migrate.js';
import { closeDb, query } from '../src/db/index.js';
import { signAccessToken } from '../src/utils/jwt.js';

describe('Concurrency & Optimistic Locking Engine', () => {
  let app;
  let adminUser, memberUser, viewerUser;
  let adminToken, memberToken, viewerToken;
  let boardId;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = createApp();
    await runMigrations();

    const pwd = await bcrypt.hash('Password123!', 10);
    const ts = Date.now();

    const adminRes = await query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING *',
      [`concurrency_admin_${ts}@test.local`, pwd, 'Admin Concurrency']
    );
    adminUser = adminRes.rows[0];
    adminToken = signAccessToken({ userId: adminUser.id });

    const memberRes = await query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING *',
      [`concurrency_member_${ts}@test.local`, pwd, 'Member Concurrency']
    );
    memberUser = memberRes.rows[0];
    memberToken = signAccessToken({ userId: memberUser.id });

    const viewerRes = await query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING *',
      [`concurrency_viewer_${ts}@test.local`, pwd, 'Viewer Concurrency']
    );
    viewerUser = viewerRes.rows[0];
    viewerToken = signAccessToken({ userId: viewerUser.id });

    const boardRes = await query(
      'INSERT INTO boards (title, invite_code, created_by) VALUES ($1, $2, $3) RETURNING *',
      ['Concurrency Test Board', `CONCURRENCY_${ts}`, adminUser.id]
    );
    boardId = boardRes.rows[0].id;

    await query(
      'INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, $3), ($1, $4, $5), ($1, $6, $7)',
      [boardId, adminUser.id, 'admin', memberUser.id, 'member', viewerUser.id, 'viewer']
    );
  }, 20000);

  afterAll(async () => {
    await closeDb();
  });

  // --- Requirement 7: 50-iteration simultaneous race test ---
  it('50-iteration race: User A moves to Done vs User B deletes at version 5', async () => {
    for (let i = 0; i < 50; i++) {
      // 1. Create a fresh task created by member (so member has permission to edit/move/delete)
      const taskRes = await query(`
        INSERT INTO tasks (board_id, title, status, position, created_by, version)
        VALUES ($1, $2, 'in_progress', 1000, $3, 5)
        RETURNING *
      `, [boardId, `Race Task ${i}`, memberUser.id]);
      const task = taskRes.rows[0];

      expect(task.version).toBe(5);
      expect(task.status).toBe('in_progress');

      // Prepare Request A (member moves to Done) and Request B (admin deletes)
      const moveReq = () =>
        request(app)
          .patch(`/api/tasks/${task.id}`)
          .set('Authorization', `Bearer ${memberToken}`)
          .send({
            expectedVersion: 5,
            status: 'done',
          });

      const deleteReq = () =>
        request(app)
          .delete(`/api/tasks/${task.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            expectedVersion: 5,
          });

      // Randomize call order in Promise.all
      const promises = Math.random() < 0.5 ? [moveReq(), deleteReq()] : [deleteReq(), moveReq()];
      const [resA, resB] = await Promise.all(promises);

      const moveResult = resA.req.path === `/api/tasks/${task.id}` && resA.req.method === 'PATCH' ? resA : resB;
      const deleteResult = moveResult === resA ? resB : resA;

      // Exactly ONE request must succeed (200), and the other must be rejected (409 or 410)
      const moveWon = moveResult.status === 200 && (deleteResult.status === 409 || deleteResult.status === 410);
      const deleteWon = deleteResult.status === 200 && (moveResult.status === 409 || moveResult.status === 410);

      expect(moveWon || deleteWon).toBe(true);

      // Verify the final database state equals the winner's action
      const finalRes = await query('SELECT * FROM tasks WHERE id = $1', [task.id]);
      const finalTask = finalRes.rows[0];

      if (moveWon) {
        expect(finalTask.status).toBe('done');
        expect(finalTask.deleted_at).toBeNull();
        expect(finalTask.version).toBe(6);
      } else {
        expect(finalTask.deleted_at).not.toBeNull();
        expect(finalTask.version).toBe(6);
      }
    }
  }, 60000);

  // --- Two simultaneous moves of the same task ---
  it('rejects second simultaneous move of the same task', async () => {
    const taskRes = await query(`
      INSERT INTO tasks (board_id, title, status, position, created_by, version)
      VALUES ($1, 'Move Race', 'to_do', 1000, $2, 1)
      RETURNING *
    `, [boardId, memberUser.id]);
    const taskId = taskRes.rows[0].id;

    const move1 = request(app)
      .patch(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ expectedVersion: 1, status: 'in_progress', position: 2000 });

    const move2 = request(app)
      .patch(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ expectedVersion: 1, status: 'done', position: 3000 });

    const [res1, res2] = await Promise.all([move1, move2]);
    const statuses = [res1.status, res2.status];

    expect(statuses).toContain(200);
    expect(statuses).toContain(409);

    const finalRes = await query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    expect(finalRes.rows[0].version).toBe(2);
  });

  // --- Simultaneous edit vs delete ---
  it('handles simultaneous edit vs delete cleanly', async () => {
    const taskRes = await query(`
      INSERT INTO tasks (board_id, title, status, position, created_by, version)
      VALUES ($1, 'Edit vs Delete', 'to_do', 1000, $2, 1)
      RETURNING *
    `, [boardId, memberUser.id]);
    const taskId = taskRes.rows[0].id;

    const editReq = request(app)
      .patch(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ expectedVersion: 1, title: 'Updated Title' });

    const delReq = request(app)
      .delete(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ expectedVersion: 1 });

    const [res1, res2] = await Promise.all([editReq, delReq]);
    const statuses = [res1.status, res2.status];

    expect(statuses).toContain(200);
    expect(statuses.some(s => s === 409 || s === 410)).toBe(true);
  });

  // --- Stale version request ---
  it('returns 409 Conflict when expectedVersion is stale', async () => {
    const taskRes = await query(`
      INSERT INTO tasks (board_id, title, status, position, created_by, version)
      VALUES ($1, 'Stale Version Task', 'to_do', 1000, $2, 3)
      RETURNING *
    `, [boardId, memberUser.id]);
    const taskId = taskRes.rows[0].id;

    // Send expectedVersion: 2 (stale, task is at v3)
    const res = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ expectedVersion: 2, title: 'Should fail' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('VERSION_CONFLICT');
    expect(res.body.currentTask.version).toBe(3);
  });

  // --- Idempotent task creation ---
  it('creation is idempotent via clientMutationId', async () => {
    const clientMutationId = `mutation_${Date.now()}_abc`;

    // First POST
    const res1 = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        boardId,
        title: 'Idempotent Task',
        clientMutationId,
        status: 'to_do',
      });

    expect(res1.status).toBe(201);
    expect(res1.body.task.title).toBe('Idempotent Task');
    const createdId = res1.body.task.id;

    // Retry same POST with same clientMutationId
    const res2 = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        boardId,
        title: 'Idempotent Task',
        clientMutationId,
        status: 'to_do',
      });

    expect(res2.status).toBe(200);
    expect(res2.body.idempotentReplay).toBe(true);
    expect(res2.body.task.id).toBe(createdId);

    // Verify only ONE task exists in DB
    const countRes = await query(
      'SELECT COUNT(*)::int AS count FROM tasks WHERE client_mutation_id = $1',
      [clientMutationId]
    );
    expect(countRes.rows[0].count).toBe(1);
  });

  // --- Viewer attempting every write is blocked (403) ---
  it('viewer attempting write actions receives 403 Forbidden', async () => {
    const taskRes = await query(`
      INSERT INTO tasks (board_id, title, status, position, created_by, version)
      VALUES ($1, 'Viewer Write Test', 'to_do', 1000, $2, 1)
      RETURNING *
    `, [boardId, memberUser.id]);
    const taskId = taskRes.rows[0].id;

    // Create
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ boardId, title: 'Viewer Task' });
    expect(createRes.status).toBe(403);

    // Edit
    const editRes = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ expectedVersion: 1, title: 'Viewer Edit' });
    expect(editRes.status).toBe(403);

    // Delete
    const delRes = await request(app)
      .delete(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ expectedVersion: 1 });
    expect(delRes.status).toBe(403);

    // Comment
    const comRes = await request(app)
      .post(`/api/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ content: 'Viewer comment' });
    expect(comRes.status).toBe(403);
  });
});

