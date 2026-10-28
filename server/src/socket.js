import { Server } from 'socket.io';
import cookie from 'cookie';
import { verifyAccessToken } from './utils/jwt.js';
import { query } from './db/index.js';
import { getBoardRole } from './middleware/permission.js';
import { setSocketIO } from './utils/socketEmitter.js';
import { config } from './config.js';

// In-memory active presence per board: boardId -> Map(socketId, { userId, name, avatarColor })
const boardPresence = new Map();

export function setupSocketIO(httpServer) {
  const allowedOrigins = [
    config.CLIENT_ORIGIN,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'http://localhost:3000',
  ].filter(Boolean);

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error('CORS not allowed for Socket.IO'));
      },
      credentials: true,
    },
  });

  setSocketIO(io);

  // Authentication Middleware
  io.use(async (socket, next) => {
    try {
      let token = socket.handshake.auth?.token;

      // Also check cookies if token not in auth payload
      if (!token && socket.handshake.headers?.cookie) {
        const parsedCookies = cookie.parse(socket.handshake.headers.cookie);
        token = parsedCookies.access_token;
      }

      if (!token) {
        return next(new Error('Authentication error: Missing token'));
      }

      const payload = verifyAccessToken(token);
      if (!payload || !payload.userId) {
        return next(new Error('Authentication error: Invalid or expired token'));
      }

      // Verify user in DB
      const userRes = await query('SELECT id, email, name, avatar_color FROM users WHERE id = $1', [payload.userId]);
      if (userRes.rows.length === 0) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.user = userRes.rows[0];
      next();
    } catch (err) {
      next(new Error('Authentication error: ' + err.message));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    const joinedBoards = new Set();

    // Event: join:board
    socket.on('join:board', async ({ boardId }, callback) => {
      try {
        if (!boardId) {
          if (callback) callback({ error: { code: 'BAD_REQUEST', message: 'boardId is required' } });
          return;
        }

        // Re-check DB membership and role
        const role = await getBoardRole(boardId, user.id);
        if (!role) {
          if (callback) callback({ error: { code: 'FORBIDDEN', message: 'Not a member of this board' } });
          socket.emit('error', { code: 'FORBIDDEN', message: 'Not a member of this board' });
          return;
        }

        const roomName = `board:${boardId}`;
        socket.join(roomName);
        joinedBoards.add(boardId);

        // Update presence
        if (!boardPresence.has(boardId)) {
          boardPresence.set(boardId, new Map());
        }
        boardPresence.get(boardId).set(socket.id, {
          userId: user.id,
          name: user.name,
          avatarColor: user.avatar_color,
          role,
        });

        // Broadcast presence update
        const activeUsers = Array.from(boardPresence.get(boardId).values());
        io.to(roomName).emit('presence:update', {
          boardId,
          users: activeUsers,
        });

        if (callback) callback({ success: true, role, activeUsers });
      } catch (err) {
        if (callback) callback({ error: { code: 'SERVER_ERROR', message: err.message } });
      }
    });

    // Event: leave:board
    socket.on('leave:board', ({ boardId }) => {
      if (boardId) {
        const roomName = `board:${boardId}`;
        socket.leave(roomName);
        joinedBoards.delete(boardId);

        if (boardPresence.has(boardId)) {
          boardPresence.get(boardId).delete(socket.id);
          const activeUsers = Array.from(boardPresence.get(boardId).values());
          io.to(roomName).emit('presence:update', {
            boardId,
            users: activeUsers,
          });
        }
      }
    });

    // On disconnect
    socket.on('disconnect', () => {
      for (const boardId of joinedBoards) {
        if (boardPresence.has(boardId)) {
          boardPresence.get(boardId).delete(socket.id);
          const activeUsers = Array.from(boardPresence.get(boardId).values());
          io.to(`board:${boardId}`).emit('presence:update', {
            boardId,
            users: activeUsers,
          });
        }
      }
    });
  });

  return io;
}
