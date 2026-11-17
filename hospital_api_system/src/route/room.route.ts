import { Router } from 'express';
import { getRoomHistory, getRooms } from '../controller/room.controller.js';
import { UserRole } from '../generated/prisma/client.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const roomRouter = Router();

roomRouter.use(authenticate, authorize(UserRole.DOCTOR));
roomRouter.get('/', getRooms);
roomRouter.get('/:roomCode/history', getRoomHistory);

export default roomRouter;
