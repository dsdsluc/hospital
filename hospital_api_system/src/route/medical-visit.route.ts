import { Router } from 'express';
import { completeStep, startStep, createOrders, dispensePrescription, escalateToObservation, getAvailableMedicines, getMedicalVisitList, getMedicalVisitSummary, getMyClinicalResult, getMyCurrentNavigation, getMyCurrentVisit, getMyMedicalVisit, getMyMedicalVisits, getRoomVisitQueue, saveConclusion, saveInitialExam, savePrescription, startVisit, startWalkIn } from '../controller/medical-visit.controller.js';
import { UserRole } from '../generated/prisma/client.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { validateCompleteVisitStep, validateCreateVisitOrders, validateEscalateToObservation, validateSaveConclusion, validateSaveInitialExamination, validateSavePrescription, validateStartMedicalVisit, validateStartWalkInVisit } from '../validation/medical-visit.validation.js';

const medicalVisitRouter = Router();

medicalVisitRouter.use(authenticate);
medicalVisitRouter.get('/me/current', authorize(UserRole.PATIENT), getMyCurrentVisit);
medicalVisitRouter.get('/me/current/navigation', authorize(UserRole.PATIENT), getMyCurrentNavigation);
medicalVisitRouter.get('/me/visits', authorize(UserRole.PATIENT), getMyMedicalVisits);
medicalVisitRouter.get('/me/visits/:medicalVisitId', authorize(UserRole.PATIENT), getMyMedicalVisit);
medicalVisitRouter.get('/me/visits/:medicalVisitId/results/:visitStepId', authorize(UserRole.PATIENT), getMyClinicalResult);
medicalVisitRouter.use(authorize(UserRole.DOCTOR));
medicalVisitRouter.get('/', getMedicalVisitList);
medicalVisitRouter.get('/room-queue', getRoomVisitQueue);
medicalVisitRouter.get('/available-medicines', getAvailableMedicines);
medicalVisitRouter.get('/:medicalVisitId/summary', getMedicalVisitSummary);
medicalVisitRouter.post('/start', validateStartMedicalVisit, startVisit);
medicalVisitRouter.post('/walk-in', validateStartWalkInVisit, startWalkIn);
medicalVisitRouter.patch('/steps/:visitStepId/start', startStep);
medicalVisitRouter.put('/steps/:visitStepId/result', validateCompleteVisitStep, completeStep);
medicalVisitRouter.put('/steps/:visitStepId/dispense', dispensePrescription);
medicalVisitRouter.post('/:medicalVisitId/orders', validateCreateVisitOrders, createOrders);
medicalVisitRouter.put('/:medicalVisitId/initial-examination', validateSaveInitialExamination, saveInitialExam);
medicalVisitRouter.put('/:medicalVisitId/conclusion', validateSaveConclusion, saveConclusion);
medicalVisitRouter.put('/:medicalVisitId/prescription', validateSavePrescription, savePrescription);
medicalVisitRouter.post('/:medicalVisitId/escalate-observation', validateEscalateToObservation, escalateToObservation);

export default medicalVisitRouter;
