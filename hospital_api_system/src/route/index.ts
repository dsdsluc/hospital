import { Router } from 'express';
import appointmentRouter from './appointment.route.js';
import authRouter from './auth.route.js';
import doctorRouter from './doctor.route.js';
import patientRouter from './patient.route.js';
import medicalVisitRouter from './medical-visit.route.js';
import emergencyRouter from './emergency.route.js';
import nursingRouter from './nursing.route.js';
import isolationRouter from './isolation.route.js';
import roomRouter from './room.route.js';
import priceRouter from './price.route.js';
import recordRouter from './record.route.js';
import invoiceRouter from './invoice.route.js';
import notificationRouter from './notification.route.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/appointments', appointmentRouter);
router.use('/patients', patientRouter);
router.use('/doctors', doctorRouter);
router.use('/medical-visits', medicalVisitRouter);
router.use('/emergency', emergencyRouter);
router.use('/nursing', nursingRouter);
router.use('/isolation', isolationRouter);
router.use('/rooms', roomRouter);
router.use('/prices', priceRouter);
router.use('/records', recordRouter);
router.use('/invoices', invoiceRouter);
router.use('/notifications', notificationRouter);

export default router;
