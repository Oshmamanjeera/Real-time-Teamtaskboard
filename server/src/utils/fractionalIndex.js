import { query } from '../db/index.js';

export function calculateMidpointPosition(prevPos, nextPos) {
  if (prevPos == null && nextPos == null) {
    return 1000.0;
  }
  if (prevPos == null) {
    return Number(nextPos) - 1000.0;
  }
  if (nextPos == null) {
    return Number(prevPos) + 1000.0;
  }
  return (Number(prevPos) + Number(nextPos)) / 2.0;
}

export async function checkAndRebalanceColumn(boardId, status) {
  // Check if any adjacent tasks have gap < 0.0001
  const res = await query(`
    SELECT id, position 
    FROM tasks 
    WHERE board_id = $1 AND status = $2 AND deleted_at IS NULL 
    ORDER BY position ASC
  `, [boardId, status]);

  const tasks = res.rows;
  if (tasks.length <= 1) return;

  let needsRebalance = false;
  for (let i = 0; i < tasks.length - 1; i++) {
    if (Math.abs(tasks[i + 1].position - tasks[i].position) < 0.0001) {
      needsRebalance = true;
      break;
    }
  }

  if (needsRebalance) {
    console.log(`Rebalancing positions for board ${boardId}, column ${status}...`);
    // Rebalance: spacing 1000.0 apart
    for (let i = 0; i < tasks.length; i++) {
      const newPos = (i + 1) * 1000.0;
      await query(
        'UPDATE tasks SET position = $1 WHERE id = $2',
        [newPos, tasks[i].id]
      );
    }
  }
}

