import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { runMigrations } from '../src/db/migrate.js';
import { closeDb, query } from '../src/db/index.js';
import { signAccessToken } from '../src/utils/jwt.js';

describe('Server-Side Permission Matrix (Admin, Member, Viewer)', () => {
  let app;
  let adminUser, memberUser, viewerUser, outsiderUser;
  let adminToken, memberToken, viewerToken, outsiderToken;
  let boardId;
  let taskCreatedByMember;
  let taskCreatedByAdmin;
  let taskAssignedToMember;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = createApp();
    await runMigrations();

    const pwd = await bcrypt.hash('Password123!', 10);
    const ts = Date.now();

    // Create 4 users: admin, member, viewer, outsider
    const adminRes = await query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING *',
      [`admin_${ts}@perm.local`, pwd, 'Admin Perm']
    );
    adminUser = adminRes.rows[0];
    adminToken = signAccessToken({ userId: adminUser.id });

    const memberRes = await query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING *',
      [`member_${ts}@perm.local`, pwd, 'Member Perm']
    );
    memberUser = memberRes.rows[0];
    memberToken = signAccessToken({ userId: memberUser.id });

    const viewerRes = await query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING *',
      [`viewer_${ts}@perm.local`, pwd, 'Viewer Perm']
    );
    viewerUser = viewerRes.rows[0];
    viewerToken = signAccessToken({ userId: viewerUser.id });

    const outsiderRes = await query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING *',
      [`outsider_${ts}@perm.local`, pwd, 'Outsider Perm']
    );
    outsiderUser = outsiderRes.rows[0];
    outsiderToken = signAccessToken({ userId: outsiderUser.id });

    // Create board with admin
    const boardRes = await query(
      'INSERT INTO boards (title, invite_code, created_by) VALUES ($1, $2, $3) RETURNING *',
      ['Permission Test Board', `CODE_${ts}`, adminUser.id]
    );
    boardId = boardRes.rows[0].id;

    // Add memberships
    await query(
      'INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, $3), ($1, $4, $5), ($1, $6, $7)',
      [boardId, adminUser.id, 'admin', memberUser.id, 'member', viewerUser.id, 'viewer']
    );

    // Create task by member
    const tMemberRes = await query(
      'INSERT INTO tasks (board_id, title, status, position, created_by, version) VALUES ($1, $2, $3, $4, $5, 1) RETURNING *',
      [boardId, 'Task by Member', 'to_do', 1000, memberUser.id]
    );
    taskCreatedByMember = tMemberRes.rows[0];

    // Create task by admin (not assigned to member)
    const tAdminRes = await query(
      'INSERT INTO tasks (board_id, title, status, position, created_by, version) VALUES ($1, $2, $3, $4, $5, 1) RETURNING *',
      [boardId, 'Task by Admin Alone', 'to_do', 2000, adminUser.id]
    );
    taskCreatedByAdmin = tAdminRes.rows[0];

    // Create task by admin assigned to member
    const tAssignedRes = await query(
      'INSERT INTO tasks (board_id, title, status, position, created_by, assignee_id, version) VALUES ($1, $2, $3, $4, $5, $6, 1) RETURNING *',
      [boardId, 'Task by Admin Assigned to Member', 'to_do', 3000, adminUser.id, memberUser.id]
    );
    taskAssignedToMember = tAssignedRes.rows[0];
  });

  afterAll(async () => {
    await closeDb();
  });

  // --- 1. Outsider (Non-member) ---
  it('forbids outsider from reading or modifying board', async () => {
    const res = await request(app)
      .get(`/api/boards/${boardId}`)
      .set('Authorization', `Bearer ${outsiderToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  // --- 2. Viewer Role ---
  it('viewer can read board, tasks, and activity', async () => {
    const boardRes = await request(app)
      .get(`/api/boards/${boardId}`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(boardRes.status).toBe(200);

    const tasksRes = await request(app)
      .get(`/api/tasks?boardId=${boardId}`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(tasksRes.status).toBe(200);
    expect(tasksRes.body.tasks.length).toBeGreaterThanOrEqual(3);

    const actRes = await request(app)
      .get(`/api/activity?boardId=${boardId}`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(actRes.status).toBe(200);
  });

  it('viewer CANNOT create a task (403)', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        boardId,
        title: 'Viewer Trying To Create',
        status: 'to_do',
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('viewer CANNOT edit or move a task (403)', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${taskCreatedByMember.id}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        expectedVersion: 1,
        title: 'Viewer Tampering Title',
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('viewer CANNOT delete a task (403)', async () => {
    const res = await request(app)
      .delete(`/api/tasks/${taskCreatedByMember.id}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ expectedVersion: 1 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('viewer CANNOT post a comment (403)', async () => {
    const res = await request(app)
      .post(`/api/tasks/${taskCreatedByMember.id}/comments`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ content: 'Viewer comment' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('viewer CANNOT change member roles (403)', async () => {
    const res = await request(app)
      .put(`/api/boards/${boardId}/members/${viewerUser.id}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ role: 'admin' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  // --- 3. Member Role ---
  it('member CAN create a task', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        boardId,
        title: 'New Member Task',
        status: 'to_do',
      });

    expect(res.status).toBe(201);
    expect(res.body.task.title).toBe('New Member Task');
  });

  it('member CAN edit/move task they created', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${taskCreatedByMember.id}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        expectedVersion: 1,
        status: 'in_progress',
      });

    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('in_progress');
    expect(res.body.task.version).toBe(2);
    taskCreatedByMember = res.body.task;
  });

  it('member CAN edit/move task assigned to them', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${taskAssignedToMember.id}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        expectedVersion: 1,
        status: 'done',
      });

    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('done');
    expect(res.body.task.version).toBe(2);
    taskAssignedToMember = res.body.task;
  });

  it('member CANNOT edit/move task created by admin and NOT assigned to member (403)', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${taskCreatedByAdmin.id}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        expectedVersion: 1,
        title: 'Unauthorized Member Edit',
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('member CAN delete task they created', async () => {
    const res = await request(app)
      .delete(`/api/tasks/${taskCreatedByMember.id}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ expectedVersion: taskCreatedByMember.version });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('member CANNOT delete task they did NOT create, even if assigned to them (403)', async () => {
    const res = await request(app)
      .delete(`/api/tasks/${taskAssignedToMember.id}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ expectedVersion: taskAssignedToMember.version });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('member CAN post a comment', async () => {
    const res = await request(app)
      .post(`/api/tasks/${taskAssignedToMember.id}/comments`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ content: 'Member comment here' });

    expect(res.status).toBe(201);
    expect(res.body.comment.content).toBe('Member comment here');
  });

  it('member CANNOT change roles or remove members (403)', async () => {
    const res = await request(app)
      .put(`/api/boards/${boardId}/members/${viewerUser.id}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ role: 'admin' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  // --- 4. Admin Role ---
  it('admin CAN edit ANY task', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${taskAssignedToMember.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        expectedVersion: taskAssignedToMember.version,
        title: 'Admin Edited This Task',
      });

    expect(res.status).toBe(200);
    expect(res.body.task.title).toBe('Admin Edited This Task');
    taskAssignedToMember = res.body.task;
  });

  it('admin CAN delete ANY task', async () => {
    const res = await request(app)
      .delete(`/api/tasks/${taskAssignedToMember.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ expectedVersion: taskAssignedToMember.version });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('admin CAN change member role and remove members', async () => {
    // Change viewer to member
    const updateRes = await request(app)
      .put(`/api/boards/${boardId}/members/${viewerUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'member' });

    expect(updateRes.status).toBe(200);

    // Remove viewer
    const removeRes = await request(app)
      .delete(`/api/boards/${boardId}/members/${viewerUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(removeRes.status).toBe(200);
    expect(removeRes.body.success).toBe(true);
  });
});

