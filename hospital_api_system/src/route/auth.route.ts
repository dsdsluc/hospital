import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  getCurrentUser,
  login,
  register,
  updateMe,
} from '../controller/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validateLogin, validateRegister, validateUpdateAccount } from '../validation/auth.validation.js';

const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Quá nhiều yêu cầu, vui lòng thử lại sau.' },
});

authRouter.post('/register', authLimiter, validateRegister, register);
authRouter.post('/login', authLimiter, validateLogin, login);
authRouter.get('/me', authenticate, getCurrentUser);
authRouter.patch('/me', authenticate, validateUpdateAccount, updateMe);

export default authRouter;
