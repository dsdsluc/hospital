import { Router } from 'express';
import { getMedicinePrices, getServicePrices } from '../controller/price.controller.js';
import { UserRole } from '../generated/prisma/client.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const priceRouter = Router();

priceRouter.use(authenticate, authorize(UserRole.DOCTOR));
priceRouter.get('/services', getServicePrices);
priceRouter.get('/medicines', getMedicinePrices);

export default priceRouter;
