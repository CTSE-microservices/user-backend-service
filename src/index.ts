import app from './app';
import { config } from './config';

const server = app.listen(config.port, () => {
  console.log(`User service running on port ${config.port} (${config.nodeEnv})`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
