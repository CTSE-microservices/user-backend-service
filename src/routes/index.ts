import { Router } from 'express';
import { userRoutes } from './user.routes';
import { authRoutes } from './auth.routes';
import { config } from '../config';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);

// Health check for deployment
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'user-service' });
});

export const routes = router;
