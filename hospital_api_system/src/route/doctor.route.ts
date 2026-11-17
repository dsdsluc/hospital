import { Router } from 'express';
import {
  createDoctor,
  getDoctor,
  updateDoctor,
} from '../controller/doctor.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { UserRole } from '../generated/prisma/client.js';
import {
  validateCreateDoctor,
  validateUpdateDoctor,
} from '../validation/profile.validation.js';

const doctorRouter = Router();

doctorRouter.use(authenticate, authorize(UserRole.DOCTOR));
doctorRouter.post('/me', validateCreateDoctor, createDoctor);
doctorRouter.get('/me', getDoctor);
doctorRouter.patch('/me', validateUpdateDoctor, updateDoctor);

export default doctorRouter;
