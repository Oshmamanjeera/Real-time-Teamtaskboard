import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, exec } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  console.log('Running database migrations...');
  
  // Create migrations tracker table
  await exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const migrationsDir = path.resolve(__dirname, '../../migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const existing = await query('SELECT id FROM _migrations WHERE name = $1', [file]);
    if (existing.rows.length === 0) {
      console.log(`Executing migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      try {
        await exec(sql);
        await query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
        console.log(`Migration ${file} applied successfully.`);
      } catch (err) {
        console.error(`Failed to apply migration ${file}:`, err);
        throw err;
      }
    } else {
      console.log(`Migration ${file} already applied.`);
    }
  }

  console.log('All migrations applied successfully.');
}

// If run directly from CLI
if (process.argv[1] && process.argv[1].endsWith('migrate.js')) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
