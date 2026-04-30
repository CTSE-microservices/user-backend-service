import { Router } from 'express';
import { userController } from '../controllers';
import { authenticate, requireRoles } from '../middlewares';

const router = Router();

// Public — anyone can register
router.post('/register', userController.register);

// Protected — must be logged in to read/update your own profile
router.get('/:id', authenticate, userController.getById);
router.patch('/:id', authenticate, userController.update);

export default router;