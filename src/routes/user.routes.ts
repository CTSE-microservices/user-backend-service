import { Router } from 'express';
import { userController } from '../controllers';
import { authenticate, requireRoles } from '../middlewares';

const router = Router();

// Public
router.post('/register', userController.register);

// Protected (use authenticate for JWT)
router.get('/:id', userController.getById);
router.patch('/:id', userController.update);

// Example: admin-only route (uncomment when using auth)
// router.get('/:id', authenticate, userController.getById);
// router.patch('/:id', authenticate, requireRoles(1), userController.update);

export const userRoutes = router;
