import 'dotenv/config';
import pg from 'pg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let poolInstance = null;
let pgliteInstance = null;
let isPgLite = false;

export async function getDb() {
  if (poolInstance) return poolInstance;
  if (pgliteInstance) return pgliteInstance;

  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl && process.env.FORCE_PGLITE !== 'true') {
    try {
      const { Pool } = pg;
      const pool = new Pool({ connectionString: databaseUrl });
      // Test connectivity
      const testRes = await pool.query('SELECT 1 AS ok');
      if (testRes.rows[0]?.ok === 1) {
        console.log('Connected to PostgreSQL via pg.Pool');
        poolInstance = {
          isPgLite: false,
          query: async (text, params = []) => {
            const res = await pool.query(text, params);
            return {
              rows: res.rows,
              rowCount: res.rowCount,
              fields: res.fields
            };
          },
          exec: async (text) => {
            return pool.query(text);
          },
          getClient: async () => {
            const client = await pool.connect();
            return {
              query: async (text, params = []) => {
                const res = await client.query(text, params);
                return {
                  rows: res.rows,
                  rowCount: res.rowCount,
                  fields: res.fields
                };
              },
              release: () => client.release()
            };
          },
          end: () => pool.end()
        };
        return poolInstance;
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('PostgreSQL connection failed: ' + err.message);
      }
      console.warn('PostgreSQL connection failed, falling back to embedded PGlite:', err.message);
    }
  }

  // Fallback / default: Embedded PGlite
  isPgLite = true;
  const { PGlite } = await import('@electric-sql/pglite');

  let dbPath;
  if (process.env.NODE_ENV === 'test' && !process.env.PERSIST_TEST_DB) {
    dbPath = undefined; // in-memory
  } else {
    dbPath = path.resolve(__dirname, '../../data/pglite_db');
    if (!fs.existsSync(path.dirname(dbPath))) {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
  }

  const pglite = new PGlite(dbPath);

  // Wrap pglite to match standard pg client / pool interface
  pgliteInstance = {
    isPgLite: true,
    query: async (text, params = []) => {
      const res = await pglite.query(text, params);
      const rowCount = res.rowCount !== undefined ? res.rowCount : (res.affectedRows !== undefined ? res.affectedRows : res.rows.length);
      return {
        rows: res.rows,
        rowCount,
        fields: res.fields
      };
    },
    exec: async (text) => {
      return pglite.exec(text);
    },
    getClient: async () => {
      return {
        query: async (text, params = []) => {
          const res = await pglite.query(text, params);
          const rowCount = res.rowCount !== undefined ? res.rowCount : (res.affectedRows !== undefined ? res.affectedRows : res.rows.length);
          return {
            rows: res.rows,
            rowCount,
            fields: res.fields
          };
        },
        release: () => { }
      };
    },
    end: async () => {
      await pglite.close();
      pgliteInstance = null;
    }
  };

  return pgliteInstance;
}

export async function query(text, params = []) {
  const db = await getDb();
  return db.query(text, params);
}

export async function exec(text) {
  const db = await getDb();
  return db.exec(text);
}

export async function getClient() {
  const db = await getDb();
  return db.getClient();
}

export async function closeDb() {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
  if (pgliteInstance) {
    await pgliteInstance.end();
    pgliteInstance = null;
  }
}
