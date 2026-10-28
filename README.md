# 🌸 Real-Time Team Task Board

A production-quality **Kanban board** with real-time collaboration, strict concurrency safety, and a Pastel Dreamy Kawaii aesthetic.

Built with: **React 18 + Vite · Node.js + Express · Socket.IO · PostgreSQL (PGlite embedded fallback)**

---

## ✨ Features

| Area | Details |
|---|---|
| **Auth** | JWT access tokens + httpOnly refresh token cookie, bcrypt passwords, rate-limited auth endpoints |
| **Boards** | Create boards, join via invite code, per-board roles (admin / member / viewer) |
| **Kanban** | To Do / In Progress / Done columns, drag-and-drop (mouse + touch + keyboard) with fractional indexing |
| **Tasks** | Title, description, assignee, priority, due date, optimistic UI updates, soft delete |
| **Concurrency** | Versioned atomic SQL — first write wins, 409 Conflict with rollback, 50-run race test |
| **Real-time** | Socket.IO broadcasts on every mutation; clients version-filter stale events |
| **Comments** | Per-task comments with author and timestamp |
| **Activity log** | Full audit trail of every board action |
| **Security** | Helmet, CORS (env-restricted), parameterized queries, Zod validation, no stack traces to clients |
| **Accessible** | WCAG AA contrast, keyboard D&D, aria-live announcements, reduced-motion, focus rings |
| **Responsive** | 320 px → ultra-wide; mobile column-tab switcher, tablet 2-col, desktop 3-col |

---

## 🏗 Architecture

```
realtime-taskboard/
├── server/                 # Node.js + Express + Socket.IO
│   ├── migrations/         # SQL migration files (001_initial_schema.sql)
│   ├── src/
│   │   ├── db/             # PGlite / pg dual adapter, migrate, seed
│   │   ├── middleware/     # auth, permissions, rate-limiter, error handler
│   │   ├── routes/         # auth, boards, tasks, comments, activity
│   │   ├── utils/          # JWT helpers, fractional indexing, socket emitter
│   │   ├── app.js          # Express app (Helmet, CORS, routes)
│   │   ├── socket.js       # Socket.IO auth + room management + presence
│   │   └── server.js       # HTTP server entry point
│   └── tests/              # Vitest + Supertest test suites
└── client/                 # React 18 + Vite
    └── src/
        ├── context/        # AuthContext, SocketContext, ToastContext
        ├── components/     # TaskCard, KanbanColumn, Modals, Navbar, Mascot …
        ├── pages/          # Login, Register, BoardList, BoardDetail
        └── test/           # Vitest + React Testing Library
```

### Request flow

```
Browser ──HTTPS──► Express API ──SQL──► PostgreSQL / PGlite
   │                    │
   │             Socket.IO rooms
   │                    │
   └────WS events────────┘
        (board:update, task:updated, task:deleted, presence:update …)
```

---

## ⚡ Concurrency Design

This is the most critical part of the implementation. Read carefully.

### The problem
Two users (A and B) act on the **same task** at nearly the same time. Without care, the later write silently overwrites the first — **last-write-wins data corruption**.

### The solution: versioned atomic SQL

Every task row carries an integer `version`. Every mutation must send `expectedVersion`. The server executes **one atomic SQL statement**:

```sql
UPDATE tasks
SET status = $1, position = $2, version = version + 1, updated_at = now()
WHERE id = $3
  AND version = $4          -- ← optimistic lock check
  AND deleted_at IS NULL    -- ← not soft-deleted
RETURNING *;
```

There is **no separate `SELECT` before the `UPDATE`**. The check lives inside the single statement, making it race-condition-free at the database level. PostgreSQL row-level locking guarantees that only one of two simultaneous `UPDATE`s will see `version = expectedVersion`; the other gets 0 rows.

Soft delete is also versioned:

```sql
UPDATE tasks
SET deleted_at = now(), version = version + 1
WHERE id = $1 AND version = $2 AND deleted_at IS NULL
RETURNING *;
```

### Conflict response

| Rows updated | Response |
|---|---|
| 1 | `200 OK` — broadcast `task:updated` event with new state to board room |
| 0 and task exists | `409 Conflict` — body includes task's **current** state |
| 0 and task deleted | `410 Gone` |

### Client-side optimistic updates and rollback

1. User drags a card → **optimistic update** applied immediately (card moves in UI, version incremented locally).
2. `PATCH /api/tasks/:id` sent with `expectedVersion`.
3. **If `200`**: server broadcasts the canonical new state; UI keeps it.
4. **If `409 / 410 / 403 / network error`**: UI **rolls back** to the server's returned state and shows a toast:
   > ⚠️ (｡•́︿•̀｡) Someone updated this task first — your change was not applied.

### Out-of-order Socket.IO events

Every `task:updated` broadcast carries the task's new `version`. Each client tracks the highest version it has seen per task. Events with `version ≤ storedVersion` are **silently ignored** — out-of-order delivery cannot corrupt state.

### Socket reconnect

On reconnect, the client calls `refetchBoard()` to fetch the full board snapshot. Missed events are thus reconciled without requiring a replay log.

### 50-iteration race test

`tests/concurrency.test.js` runs `Promise.all` 50 times:

```
Task @ version 5
  User A: PATCH /tasks/:id { status: "done",    expectedVersion: 5 }
  User B: PATCH /tasks/:id { deleted_at: now(), expectedVersion: 5 }
  ↓ both fire simultaneously
```

Invariants asserted every iteration:
- **Exactly one** request returns `2xx`.
- **Exactly one** request returns `409` or `410`.
- The DB final state equals the **winner's** action.
- No task ends up both "done" and deleted by separate writes.

---

## 🔐 Permission Matrix

Enforced on the server for **every** REST call and socket event. Role is re-checked from the DB on every request — never trusted from the JWT payload alone.

| Action | Viewer | Member | Admin |
|---|:---:|:---:|:---:|
| Read board / tasks / comments / activity | ✅ | ✅ | ✅ |
| Create task | ❌ | ✅ | ✅ |
| Edit / move own task | ❌ | ✅ | ✅ |
| Edit / move assigned task | ❌ | ✅ | ✅ |
| Edit / move any task | ❌ | ❌ | ✅ |
| Delete own task | ❌ | ✅ | ✅ |
| Delete any task | ❌ | ❌ | ✅ |
| Post comment | ❌ | ✅ | ✅ |
| Change member roles | ❌ | ❌ | ✅ |
| Remove members | ❌ | ❌ | ✅ |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js ≥ 18** (uses ESM, `node --watch`)
- **npm ≥ 9**
- **PostgreSQL** (optional — the app automatically falls back to an embedded PGlite in-process database if `DATABASE_URL` is not set)

### 1. Clone and install

```bash
git clone <repo-url>
cd realtime-taskboard

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Configure environment

```bash
# From the project root
cp .env.example server/.env
```

Edit `server/.env` — at minimum review the JWT secrets and optionally set `DATABASE_URL`.

### 3. Run migrations

```bash
cd server
npm run migrate
```

### 4. Seed demo data

```bash
cd server
npm run seed
```

This creates:

| Email | Password | Board role |
|---|---|---|
| `admin@kawaii.local` | `Password123!` | Admin |
| `member@kawaii.local` | `Password123!` | Member |
| `viewer@kawaii.local` | `Password123!` | Viewer |

Board: **"Pastel Dreamy Board"** · Invite code: **`KAWAII2026`**

### 5. Start development servers

**Terminal 1 — backend:**
```bash
cd server
npm run dev
# Listening on http://localhost:5000
```

**Terminal 2 — frontend:**
```bash
cd client
npm run dev
# Vite dev server on http://localhost:5173
# (proxies /api and /socket.io to localhost:5000)
```

Open **http://localhost:5173** in your browser.

### 6. Production build

```bash
cd client
npm run build
# Outputs to client/dist/
# The Express server serves client/dist as static files on port 5000
```

Start the combined server:
```bash
cd server
npm start
# Open http://localhost:5000
```

---

## ⚙️ Environment Variables

All variables live in `server/.env` (copy from `.env.example`).

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | HTTP server port |
| `DATABASE_URL` | _(empty)_ | PostgreSQL connection string. If unset, PGlite embedded DB is used |
| `PGLITE_DATA_DIR` | `./data/pglite_db` | Persistent storage path for the PGlite embedded DB |
| `JWT_ACCESS_SECRET` | _(required)_ | Secret for signing access tokens (min 32 chars) |
| `JWT_REFRESH_SECRET` | _(required)_ | Secret for signing refresh tokens (min 32 chars) |
| `JWT_ACCESS_EXPIRY` | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRY` | `7d` | Refresh token lifetime (httpOnly cookie) |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed CORS origin (set to your frontend URL in production) |
| `NODE_ENV` | `development` | `production` disables stack traces; `test` relaxes rate limiting |
| `BCRYPT_ROUNDS` | `10` | bcrypt cost factor |

---

## 📜 NPM Scripts

### Server (`server/`)

| Script | Command | Description |
|---|---|---|
| `start` | `node src/server.js` | Production start |
| `dev` | `node --watch src/server.js` | Development with auto-restart |
| `migrate` | `node src/db/migrate.js` | Run pending SQL migrations |
| `seed` | `node src/db/seed.js` | Seed demo users, board, and tasks |
| `test` | `vitest run --reporter=verbose` | Run all backend tests |

### Client (`client/`)

| Script | Command | Description |
|---|---|---|
| `dev` | `vite` | Vite dev server (port 5173, proxied to 5000) |
| `build` | `vite build` | Production build → `dist/` |
| `preview` | `vite preview` | Preview production build |
| `test` | `vitest run` | Run all frontend tests |

---

## 🧪 Test Report

**Total: 40 tests — all passing ✅**

### Backend — 36 tests (`server/tests/`)

#### `auth.test.js` — 8 tests

| Test | Status |
|---|---|
| registers a new user and returns tokens | ✅ |
| rejects registration with duplicate email | ✅ |
| logs in an existing user with correct credentials | ✅ |
| rejects login with incorrect password | ✅ |
| refreshes the access token via refresh token cookie | ✅ |
| authenticates /me endpoint with Bearer token | ✅ |
| rejects /me without token with 401 | ✅ |
| clears cookies on logout | ✅ |

#### `permissions.test.js` — 18 tests

| Test | Status |
|---|---|
| forbids outsider from reading or modifying board | ✅ |
| viewer can read board, tasks, and activity | ✅ |
| viewer CANNOT create a task (403) | ✅ |
| viewer CANNOT edit or move a task (403) | ✅ |
| viewer CANNOT delete a task (403) | ✅ |
| viewer CANNOT post a comment (403) | ✅ |
| viewer CANNOT change member roles (403) | ✅ |
| member CAN create a task | ✅ |
| member CAN edit/move task they created | ✅ |
| member CAN edit/move task assigned to them | ✅ |
| member CANNOT edit/move task created by admin and NOT assigned to them (403) | ✅ |
| member CAN delete task they created | ✅ |
| member CANNOT delete task they did NOT create, even if assigned to them (403) | ✅ |
| member CAN post a comment | ✅ |
| member CANNOT change roles or remove members (403) | ✅ |
| admin CAN edit ANY task | ✅ |
| admin CAN delete ANY task | ✅ |
| admin CAN change member role and remove members | ✅ |

#### `concurrency.test.js` — 6 tests

| Test | Status |
|---|---|
| **50-iteration race**: User A moves to Done vs User B deletes at version 5 (Promise.all × 50, random ordering) | ✅ |
| rejects second simultaneous move of the same task | ✅ |
| handles simultaneous edit vs delete cleanly | ✅ |
| returns 409 Conflict when expectedVersion is stale | ✅ |
| creation is idempotent via clientMutationId | ✅ |
| viewer attempting write actions receives 403 Forbidden | ✅ |

#### `socket.test.js` — 4 tests

| Test | Status |
|---|---|
| rejects socket connection without JWT token | ✅ |
| authenticates socket connection with valid JWT token | ✅ |
| rejects joining a board room if the user is not a member | ✅ |
| successfully joins board and receives presence update | ✅ |

### Frontend — 4 tests (`client/src/test/`)

#### `optimisticRollback.test.jsx` — 2 tests

| Test | Status |
|---|---|
| applies optimistic update instantly and rolls back cleanly when server returns 409 Conflict | ✅ |
| keeps the updated state when server returns 200 OK | ✅ |

#### `permissionsUI.test.jsx` — 2 tests

| Test | Status |
|---|---|
| renders drag handle when canEdit is true | ✅ |
| hides drag handle and renders view-only badge when canEdit is false (Viewer) | ✅ |

---

## 🖼 Screenshots

| Viewport | Preview |
|---|---|
| 1440px Desktop | Full 3-column Kanban with floating decorations |
| 1024px Desktop | 3-column, compact sidebar |
| 768px Tablet | 3-column with reduced padding |
| 375px Mobile | Single column + tab switcher + FAB |
| 320px Mobile | Compact single column view |
| Conflict Toast | 409 rollback "Someone updated this task first" |

Screenshots are in the `screenshots/` directory.

---

## 🗄 Database Schema

```sql
users            (id, email, name, password_hash, avatar_color, created_at)
boards           (id, name, description, invite_code UNIQUE, created_by, created_at)
board_members    (board_id, user_id, role CHECK IN ('admin','member','viewer'))
tasks            (id, board_id, title, description, status, priority, position,
                  assignee_id, created_by, due_date,
                  version INT DEFAULT 1,        ← optimistic lock
                  deleted_at TIMESTAMPTZ NULL,  ← soft delete
                  client_mutation_id UNIQUE,    ← idempotent create
                  created_at, updated_at)
comments         (id, task_id, board_id, user_id, content, created_at)
activity_log     (id, board_id, task_id, user_id, action, metadata JSONB, created_at)
```

Indexes: `(board_id, status, position)`, `(board_id, created_at DESC)`, `client_mutation_id UNIQUE`

---

## 🔒 Security Notes

- **SQL injection**: 100% parameterized queries via `pg` / PGlite — no string interpolation.
- **XSS**: React's JSX escaping used throughout — no `dangerouslySetInnerHTML`.
- **CSRF**: Refresh token is `httpOnly; SameSite=Strict` — inaccessible to JavaScript.
- **Rate limiting**: Auth endpoints (register / login / refresh) are rate-limited via `express-rate-limit`.
- **Helmet**: Sets `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, etc.
- **CORS**: Restricted to `CLIENT_ORIGIN` env var (defaults to `localhost:5173`).
- **Role escalation**: Role is re-fetched from the DB on **every** request. Changing a user's role takes effect immediately — the old JWT cannot be used to bypass the new role.
- **Error leakage**: Central error handler strips stack traces in production. All errors use `{ error: { code, message } }` format.

---

## 📱 Responsive Breakpoints

| Width | Layout |
|---|---|
| ≤ 640px (mobile) | Single column shown, pastel tab/segment switcher to change columns, floating "+" FAB, drag handle requires long-press (200ms delay) to avoid hijacking scroll |
| 641–1023px (tablet) | Two or three column grid |
| ≥ 1024px (desktop) | Three columns side-by-side, sidebar presence panel |

All touch targets are ≥ 44 × 44px. `dvh` units handle mobile browser chrome. `env(safe-area-inset-*)` handles notched phones.

---

## 🎨 Design System

Pastel Dreamy Kawaii — soft phone-wallpaper aesthetic with no harsh dark colors.

| Token | Hex | Usage |
|---|---|---|
| Sky Blue gradient | `#DCEBFA → #BFD7F3` | Page background |
| Butter Cream | `#FFF3C4` | In-Progress column header |
| Milk White | `#F8F8FB` | Card surfaces |
| Blush Pink | `#F7CADA` | Done column header, accents |
| Periwinkle | `#8FA8E8` | Buttons, focus rings, icons |
| Star Yellow | `#FFD966` | Priority badges, star decorations |
| Soft Cocoa | `#7A5A50` | Headings, emphasis |
| Warm Slate | `#5B6475` | Body text (WCAG AA on milk white) |

**Kumo-chan**: an original cloud-blob mascot SVG with small wings and a bow — appears on empty states, login page, and header. Not derived from any existing character or brand.

---

## 🤝 Contributing

1. `npm run migrate` before starting work on the DB layer.
2. All mutations **must** use the versioned atomic SQL pattern.
3. All new routes **must** call `requireBoardAccess` + `checkTaskPermission` where applicable.
4. Run `npm test` in both `server/` and `client/` before opening a PR.
5. No `dangerouslySetInnerHTML`. No `console.log` in production paths. No TODOs.

