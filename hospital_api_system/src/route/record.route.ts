import { Router } from 'express';
import { getMedicalRecords } from '../controller/record.controller.js';
import { UserRole } from '../generated/prisma/client.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const recordRouter = Router();

recordRouter.use(authenticate, authorize(UserRole.DOCTOR));
recordRouter.get('/', getMedicalRecords);

export default recordRouter;
