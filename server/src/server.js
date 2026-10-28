import http from 'http';
import { createApp } from './app.js';
import { setupSocketIO } from './socket.js';
import { config } from './config.js';
import { runMigrations } from './db/migrate.js';

async function startServer() {
  try {
    // Run DB migrations
    await runMigrations();

    const app = createApp();
    const server = http.createServer(app);

    // Initialize WebSockets
    setupSocketIO(server);

    server.listen(config.PORT, () => {
      console.log(`🌸 Kawaii Task Board Server running on port ${config.PORT} (http://localhost:${config.PORT})`);
      console.log(`✨ Environment: ${config.NODE_ENV}`);
    });

    // Graceful shutdown handling
    const shutdown = () => {
      console.log('Shutting down server gracefully...');
      server.close(() => {
        console.log('HTTP and WebSocket server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    // Unhandled rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Promise Rejection:', reason);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  startServer();
}

export { startServer };

