import { Router } from 'express';
import {
  bookAppointment,
  cancelMyAppointment,
  checkIn,
  getMyAppointment,
  getDailySchedule,
  getMyAppointments,
  getReceptionQueue,
  lookupAppointment,
} from '../controller/appointment.controller.js';
import { UserRole } from '../generated/prisma/client.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { validateCreateAppointment } from '../validation/appointment.validation.js';

const appointmentRouter = Router();

appointmentRouter.use(authenticate);
appointmentRouter.get('/reception-queue', authorize(UserRole.DOCTOR), getReceptionQueue);
appointmentRouter.get('/schedule', authorize(UserRole.DOCTOR), getDailySchedule);
appointmentRouter.get('/lookup', authorize(UserRole.DOCTOR), lookupAppointment);
appointmentRouter.patch('/:appointmentId/check-in', authorize(UserRole.DOCTOR), checkIn);
appointmentRouter.use(authorize(UserRole.PATIENT));
appointmentRouter.post('/', validateCreateAppointment, bookAppointment);
appointmentRouter.get('/me', getMyAppointments);
appointmentRouter.get('/:appointmentId', getMyAppointment);
appointmentRouter.patch('/:appointmentId/cancel', cancelMyAppointment);

export default appointmentRouter;
