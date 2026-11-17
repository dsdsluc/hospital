import { Router } from 'express';
import { getMyNotifications, readAllNotifications, readNotification } from '../controller/notification.controller.js';
import { UserRole } from '../generated/prisma/client.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const notificationRouter = Router();

notificationRouter.use(authenticate, authorize(UserRole.PATIENT));
notificationRouter.get('/me', getMyNotifications);
notificationRouter.patch('/me/read-all', readAllNotifications);
notificationRouter.patch('/:notificationId/read', readNotification);

export default notificationRouter;
