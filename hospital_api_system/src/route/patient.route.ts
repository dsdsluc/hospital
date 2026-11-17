import { Router } from 'express';
import {
  createPatient,
  getPatient,
  listPatients,
  searchPatients,
  updatePatient,
  updatePatientByDoctor,
} from '../controller/patient.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { UserRole } from '../generated/prisma/client.js';
import {
  validateCreatePatient,
  validateUpdatePatient,
  validateUpdatePatientByDoctor,
} from '../validation/profile.validation.js';

const patientRouter = Router();

patientRouter.use(authenticate);
patientRouter.get('/', authorize(UserRole.DOCTOR), listPatients);
patientRouter.get('/search', authorize(UserRole.DOCTOR), searchPatients);
patientRouter.patch('/:patientId', authorize(UserRole.DOCTOR), validateUpdatePatientByDoctor, updatePatientByDoctor);
patientRouter.use(authorize(UserRole.PATIENT));
patientRouter.post('/me', validateCreatePatient, createPatient);
patientRouter.get('/me', getPatient);
patientRouter.patch('/me', validateUpdatePatient, updatePatient);

export default patientRouter;
