import bcrypt from 'bcryptjs';
import { query } from './index.js';
import { runMigrations } from './migrate.js';

export async function runSeed() {
  console.log('Seeding database...');
  await runMigrations();

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 1. Clean existing test data if needed or use ON CONFLICT
  // For idempotent seed, check if users exist
  const existingAdmin = await query('SELECT id FROM users WHERE email = $1', ['admin@kawaii.local']);
  let adminId, memberId, viewerId;

  if (existingAdmin.rows.length === 0) {
    const adminRes = await query(`
      INSERT INTO users (email, password_hash, name, avatar_color)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, ['admin@kawaii.local', passwordHash, 'Sakura Admin', '#F7CADA']);
    adminId = adminRes.rows[0].id;

    const memberRes = await query(`
      INSERT INTO users (email, password_hash, name, avatar_color)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, ['member@kawaii.local', passwordHash, 'Mochi Member', '#8FA8E8']);
    memberId = memberRes.rows[0].id;

    const viewerRes = await query(`
      INSERT INTO users (email, password_hash, name, avatar_color)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, ['viewer@kawaii.local', passwordHash, 'Hana Viewer', '#FFF3C4']);
    viewerId = viewerRes.rows[0].id;

    console.log('Created users: Sakura Admin, Mochi Member, Hana Viewer (Password: Password123!)');
  } else {
    adminId = existingAdmin.rows[0].id;
    const mRes = await query('SELECT id FROM users WHERE email = $1', ['member@kawaii.local']);
    memberId = mRes.rows[0].id;
    const vRes = await query('SELECT id FROM users WHERE email = $1', ['viewer@kawaii.local']);
    viewerId = vRes.rows[0].id;
    console.log('Users already exist, continuing seed...');
  }

  // 2. Check board
  const boardRes = await query('SELECT id FROM boards WHERE invite_code = $1', ['KAWAII2026']);
  let boardId;
  if (boardRes.rows.length === 0) {
    const newBoard = await query(`
      INSERT INTO boards (title, description, invite_code, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, ['Pastel Dreamy Board', 'A calm and cheerful space for real-time team collaboration ✨', 'KAWAII2026', adminId]);
    boardId = newBoard.rows[0].id;

    // Add board members
    await query(`
      INSERT INTO board_members (board_id, user_id, role)
      VALUES 
        ($1, $2, 'admin'),
        ($1, $3, 'member'),
        ($1, $4, 'viewer')
    `, [boardId, adminId, memberId, viewerId]);

    // Sample Tasks
    const t1 = await query(`
      INSERT INTO tasks (board_id, title, description, status, position, priority, assignee_id, created_by, version)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
      RETURNING id
    `, [
      boardId,
      'Design cloud mascot SVG (Kumo-chan)',
      'Create an original hand-crafted soft cloud mascot with tiny angel wings and a blush ribbon bow.',
      'to_do',
      1000.0,
      'high',
      memberId,
      adminId
    ]);

    const t2 = await query(`
      INSERT INTO tasks (board_id, title, description, status, position, priority, assignee_id, created_by, version)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
      RETURNING id
    `, [
      boardId,
      'Audit WCAG AA color contrast',
      'Verify that all text labels and badges meet at least 4.5:1 contrast against pastel milk-white backgrounds.',
      'to_do',
      2000.0,
      'urgent',
      adminId,
      adminId
    ]);

    const t3 = await query(`
      INSERT INTO tasks (board_id, title, description, status, position, priority, assignee_id, created_by, version)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
      RETURNING id
    `, [
      boardId,
      'Implement atomic optimistic locking',
      'Single SQL statement WHERE id=$1 AND version=$2 RETURNING * with 409 conflict detection.',
      'in_progress',
      1000.0,
      'urgent',
      memberId,
      memberId
    ]);

    const t4 = await query(`
      INSERT INTO tasks (board_id, title, description, status, position, priority, assignee_id, created_by, version)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
      RETURNING id
    `, [
      boardId,
      'Initialize pastel kawaii design tokens',
      'Configured soft sky blue, butter cream, blush pink, star yellow, and soft cocoa brown.',
      'done',
      1000.0,
      'low',
      adminId,
      adminId
    ]);

    // Comments on Task 3
    await query(`
      INSERT INTO comments (task_id, user_id, content)
      VALUES 
        ($1, $2, 'Make sure to test the 50-iteration simultaneous race condition with Promise.all! 🚀'),
        ($1, $3, 'Added the test suite. The single SQL update statement is fully atomic and 0-row check handles 409 cleanly. ✨')
    `, [t3.rows[0].id, adminId, memberId]);

    // Activity Log
    await query(`
      INSERT INTO activity_log (board_id, task_id, user_id, action, details)
      VALUES
        ($1, NULL, $2, 'create_board', '{"board_title": "Pastel Dreamy Board"}'::jsonb),
        ($1, $3, $2, 'create_task', '{"title": "Implement atomic optimistic locking", "status": "in_progress"}'::jsonb),
        ($1, $3, $4, 'comment_task', '{"text": "Make sure to test the 50-iteration simultaneous race condition!"}'::jsonb)
    `, [boardId, adminId, t3.rows[0].id, memberId]);

    console.log('Seeded board "Pastel Dreamy Board" (Code: KAWAII2026) with 4 tasks, comments, and activity log.');
  } else {
    boardId = boardRes.rows[0].id;
    console.log('Board already exists, seed completed.');
  }

  return { adminId, memberId, viewerId, boardId };
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

