import { Router } from 'express';
import { getInvoice, getInvoices, putPayInvoice } from '../controller/invoice.controller.js';
import { UserRole } from '../generated/prisma/client.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { validatePayInvoice } from '../validation/invoice.validation.js';

const invoiceRouter = Router();
invoiceRouter.use(authenticate, authorize(UserRole.DOCTOR));
invoiceRouter.get('/', getInvoices);
invoiceRouter.get('/:invoiceId', getInvoice);
invoiceRouter.put('/:invoiceId/pay', validatePayInvoice, putPayInvoice);
export default invoiceRouter;
