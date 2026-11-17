import type { Request, Response } from 'express';
import { findLatestVisitDate, findMedicalVisitList, completeVisitStep, startVisitStep, createVisitOrders, dispenseVisitPrescription, escalateVisitToObservation, findAvailableMedicines, findCurrentPatientNavigation, findCurrentPatientVisit, findMedicalVisitSummary, findPatientClinicalResult, findPatientMedicalVisit, findPatientMedicalVisits, findRoomVisitQueue, saveInitialExamination, saveVisitConclusion, saveVisitPrescription, startMedicalVisit, startWalkInVisit } from '../service/medical-visit.service.js';
import type { CompleteVisitStepInput, CreateVisitOrdersInput, EscalateToObservationInput, SaveConclusionInput, SaveInitialExaminationInput, SavePrescriptionInput, StartMedicalVisitInput, StartWalkInVisitInput } from '../validation/medical-visit.validation.js';

/** POST /medical-visits/walk-in — lượt khám không có lịch hẹn. */
export async function startWalkIn(req: Request, res: Response): Promise<void> {
  const medicalVisit = await startWalkInVisit(req.body as StartWalkInVisitInput);
  res.status(201).json({ message: `Đã bắt đầu lượt khám ${medicalVisit.visit_code} cho ${medicalVisit.patient.full_name}${medicalVisit.patient.patient_code ? ` (${medicalVisit.patient.patient_code})` : ' (vãng lai)'}.`, medical_visit: medicalVisit });
}

export async function startVisit(req: Request, res: Response): Promise<void> {
  const medicalVisit = await startMedicalVisit(req.body as StartMedicalVisitInput);
  res.status(201).json({ message: 'Bắt đầu lượt khám thành công.', medical_visit: medicalVisit });
}

export async function getMyCurrentVisit(req: Request, res: Response): Promise<void> {
  const medicalVisit = await findCurrentPatientVisit(req.user!.id);
  res.json({ medical_visit: medicalVisit });
}

export async function getMyCurrentNavigation(req: Request, res: Response): Promise<void> {
  const navigation = await findCurrentPatientNavigation(req.user!.id);
  res.json({ navigation });
}

export async function getMyMedicalVisits(req: Request, res: Response): Promise<void> {
  const medicalVisits = await findPatientMedicalVisits(req.user!.id);
  res.json({ medical_visits: medicalVisits });
}

export async function getMyMedicalVisit(req: Request, res: Response): Promise<void> {
  const medicalVisit = await findPatientMedicalVisit(req.user!.id, String(req.params.medicalVisitId));
  res.json({ medical_visit: medicalVisit });
}

export async function getMyClinicalResult(req: Request, res: Response): Promise<void> {
  const clinicalResult = await findPatientClinicalResult(
    req.user!.id,
    String(req.params.medicalVisitId),
    String(req.params.visitStepId),
  );
  res.json({ clinical_result: clinicalResult });
}

/** GET /medical-visits?date=YYYY-MM-DD — danh sách lượt khám trong ngày kèm hành trình (mặc định hôm nay). */
export async function getMedicalVisitList(req: Request, res: Response): Promise<void> {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const date = typeof req.query.date === 'string' && req.query.date !== '' ? req.query.date : today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    res.status(400).json({ message: 'Ngày xem lượt khám không hợp lệ.' });
    return;
  }
  const [medicalVisits, latest] = await Promise.all([findMedicalVisitList(date, today), findLatestVisitDate(date)]);
  res.json({ date, today, latest_date: latest, medical_visits: medicalVisits });
}

export async function getRoomVisitQueue(req: Request, res: Response): Promise<void> {
  const roomCode = typeof req.query.room_code === 'string' ? req.query.room_code.trim() : '';
  if (!roomCode) {
    res.status(400).json({ message: 'Cần cung cấp room_code.' });
    return;
  }
  const assignments = await findRoomVisitQueue(roomCode);
  res.json({ room_code: roomCode, assignments });
}

export async function getMedicalVisitSummary(req: Request, res: Response): Promise<void> {
  const medicalVisit = await findMedicalVisitSummary(String(req.params.medicalVisitId));
  res.json({ medical_visit: medicalVisit });
}

export async function createOrders(req: Request, res: Response): Promise<void> {
  const steps = await createVisitOrders(String(req.params.medicalVisitId), req.body as CreateVisitOrdersInput);
  res.status(201).json({ message: 'Gửi chỉ định thành công.', steps });
}

export async function startStep(req: Request, res: Response): Promise<void> {
  const visitStep = await startVisitStep(String(req.params.visitStepId));
  res.json({ message: 'Đã bắt đầu thực hiện chỉ định.', visit_step: visitStep });
}

export async function completeStep(req: Request, res: Response): Promise<void> {
  const result = await completeVisitStep(String(req.params.visitStepId), req.body as CompleteVisitStepInput);
  res.json({ message: 'Hoàn thành và gửi kết quả thành công.', ...result });
}

export async function dispensePrescription(req: Request, res: Response): Promise<void> {
  const visitStep = await dispenseVisitPrescription(String(req.params.visitStepId));
  res.json({ message: 'Cấp thuốc và hoàn thành lượt khám thành công.', visit_step: visitStep });
}

export async function saveConclusion(req: Request, res: Response): Promise<void> {
  const examinationRecord = await saveVisitConclusion(String(req.params.medicalVisitId), req.body as SaveConclusionInput);
  res.json({ message: 'Lưu kết luận thành công.', examination_record: examinationRecord });
}

export async function saveInitialExam(req: Request, res: Response): Promise<void> {
  const examinationRecord = await saveInitialExamination(String(req.params.medicalVisitId), req.body as SaveInitialExaminationInput);
  res.json({ message: 'Lưu thông tin khám ban đầu thành công.', examination_record: examinationRecord });
}

export async function savePrescription(req: Request, res: Response): Promise<void> {
  const prescription = await saveVisitPrescription(String(req.params.medicalVisitId), req.body as SavePrescriptionInput);
  res.json({ message: 'Xác nhận đơn thuốc thành công.', prescription });
}

export async function getAvailableMedicines(_req: Request, res: Response): Promise<void> {
  const medicines = await findAvailableMedicines();
  res.json({ medicines });
}
export async function escalateToObservation(req: Request, res: Response): Promise<void> { res.json({ message: 'Đã chuyển bệnh nhân đến OBS-403 và kết thúc lượt khám ngoại trú.', emergency_case: await escalateVisitToObservation(String(req.params.medicalVisitId), req.body as EscalateToObservationInput) }); }
