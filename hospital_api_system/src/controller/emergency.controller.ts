import type { Request, Response } from 'express';
import { addEmergencyIntervention, closeIntensiveCare, completeEmergencySurgery, completePreparationOrder, createEmergencyCase, decidePreparationDisposition, decideWardDisposition, dispenseEmergencyPrescription, findEmergencyCase, findEmergencyCaseHistory, findEmergencyCases, findOpenEmergencyCases, findEmergencyPharmacyTransfers, findEmergencyPreparations, findPostoperativeTransfers, findSurgicalTransfers, findWardTransfers, requestEmergencyPreparation, saveEmergencyAssessment, saveEmergencyPrescription, saveIntensiveCareProgress, saveWardPrescription, saveWardProgress, startEmergencyPreparation, startEmergencySurgery } from '../service/emergency.service.js';
import type { CloseIntensiveCareInput, CompleteEmergencySurgeryInput, CompletePreparationOrderInput, CreateEmergencyCaseInput, CreateEmergencyInterventionInput, DecidePreparationDispositionInput, DecideWardDispositionInput, RequestEmergencyPreparationInput, SaveEmergencyPrescriptionInput, SaveIntensiveCareProgressInput, SaveWardProgressInput, UpdateEmergencyAssessmentInput } from '../validation/emergency.validation.js';

export async function getEmergencyCases(req: Request, res: Response): Promise<void> {
  // ?from=YYYY-MM-DD&to=YYYY-MM-DD: tra cứu ca cũ (mọi trạng thái). Không truyền: các ca đang hoạt động như cũ.
  const { from, to } = req.query;
  if (typeof from === 'string' || typeof to === 'string') {
    const isValidDate = (value: unknown): value is string =>
      typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
    if (!isValidDate(from) || !isValidDate(to) || to < from) {
      res.status(400).json({ message: 'Khoảng ngày tra cứu ca cấp cứu không hợp lệ.' });
      return;
    }
    res.json({ emergency_cases: await findEmergencyCaseHistory(from, to) });
    return;
  }
  // ?scope=open: mọi ca chưa kết thúc (kể cả đã chuyển sang chuẩn bị phẫu thuật) cho trang Hàng đợi.
  if (req.query.scope === 'open') {
    res.json({ emergency_cases: await findOpenEmergencyCases() });
    return;
  }
  res.json({ emergency_cases: await findEmergencyCases() });
}

export async function getEmergencyCase(req: Request, res: Response): Promise<void> {
  res.json({ emergency_case: await findEmergencyCase(String(req.params.emergencyCaseId)) });
}

export async function postEmergencyCase(req: Request, res: Response): Promise<void> {
  const emergencyCase = await createEmergencyCase(req.body as CreateEmergencyCaseInput);
  res.status(201).json({ message: 'Tiếp nhận ca cấp cứu thành công.', emergency_case: emergencyCase });
}

export async function putEmergencyAssessment(req: Request, res: Response): Promise<void> {
  const emergencyCase = await saveEmergencyAssessment(String(req.params.emergencyCaseId), req.body as UpdateEmergencyAssessmentInput);
  res.json({ message: 'Đã lưu đánh giá ban đầu.', emergency_case: emergencyCase });
}

export async function postEmergencyIntervention(req: Request, res: Response): Promise<void> {
  const intervention = await addEmergencyIntervention(String(req.params.emergencyCaseId), req.user!.id, req.body as CreateEmergencyInterventionInput);
  res.status(201).json({ message: 'Đã ghi nhận xử trí cấp cứu.', intervention });
}

export async function postEmergencyPreparation(req: Request, res: Response): Promise<void> {
  const preparation = await requestEmergencyPreparation(String(req.params.emergencyCaseId), req.body as RequestEmergencyPreparationInput);
  res.status(201).json({ message: 'Đã chuyển yêu cầu đến PRE-503.', preparation });
}
export async function getEmergencyPreparations(_req: Request, res: Response): Promise<void> { res.json({ preparations: await findEmergencyPreparations() }); }
export async function getSurgicalTransfers(req: Request, res: Response): Promise<void> {
  const roomCode = typeof req.query.room_code === 'string' ? req.query.room_code.trim() : '';
  if (!roomCode) { res.status(400).json({ message: 'Cần cung cấp room_code.' }); return; }
  res.json({ transfers: await findSurgicalTransfers(roomCode) });
}
export async function getPostoperativeTransfers(req: Request, res: Response): Promise<void> {
  const roomCode = typeof req.query.room_code === 'string' ? req.query.room_code.trim() : '';
  if (!roomCode) { res.status(400).json({ message: 'Cần cung cấp room_code.' }); return; }
  res.json({ transfers: await findPostoperativeTransfers(roomCode) });
}
export async function putStartEmergencySurgery(req: Request, res: Response): Promise<void> {
  const roomCode = typeof req.query.room_code === 'string' ? req.query.room_code.trim() : '';
  res.json({ message: 'Đã bắt đầu ca phẫu thuật.', preparation: await startEmergencySurgery(String(req.params.preparationId), roomCode) });
}
export async function putCompleteEmergencySurgery(req: Request, res: Response): Promise<void> {
  const roomCode = typeof req.query.room_code === 'string' ? req.query.room_code.trim() : '';
  res.json({ message: 'Đã hoàn tất ca phẫu thuật và bàn giao hậu phẫu.', preparation: await completeEmergencySurgery(String(req.params.preparationId), roomCode, req.body as CompleteEmergencySurgeryInput) });
}
export async function putCloseIntensiveCare(req: Request, res: Response): Promise<void> {
  res.json({ message: 'Đã xác nhận hướng xử lý và bàn giao khỏi ICU.', preparation: await closeIntensiveCare(String(req.params.preparationId), req.body as CloseIntensiveCareInput) });
}
export async function postIntensiveCareProgress(req: Request, res: Response): Promise<void> { res.status(201).json({ message: 'Đã lưu diễn biến điều trị ICU.', progress: await saveIntensiveCareProgress(String(req.params.preparationId), req.body as SaveIntensiveCareProgressInput) }); }
export async function putEmergencyPrescription(req: Request, res: Response): Promise<void> { res.json({ message: 'Đã lưu đơn thuốc, bệnh nhân vẫn tiếp tục điều trị tại ICU.', prescription: await saveEmergencyPrescription(String(req.params.preparationId), req.body as SaveEmergencyPrescriptionInput) }); }
export async function getEmergencyPharmacyTransfers(_req: Request, res: Response): Promise<void> { res.json({ transfers: await findEmergencyPharmacyTransfers() }); }
export async function putDispenseEmergencyPrescription(req: Request, res: Response): Promise<void> { res.json({ message: 'Đã cấp thuốc và đóng ca cấp cứu.', prescription: await dispenseEmergencyPrescription(String(req.params.preparationId)) }); }
export async function getWardTransfers(req: Request, res: Response): Promise<void> { res.json({ transfers: await findWardTransfers(String(req.query.room_code ?? '')) }); }
export async function postWardProgress(req: Request, res: Response): Promise<void> { res.status(201).json({ message: 'Đã lưu diễn biến theo dõi.', progress: await saveWardProgress(String(req.params.preparationId), String(req.query.room_code ?? ''), req.body as SaveWardProgressInput) }); }
export async function putWardPrescription(req: Request, res: Response): Promise<void> { res.json({ message: 'Đã lưu đơn thuốc, bệnh nhân vẫn tiếp tục được theo dõi.', prescription: await saveWardPrescription(String(req.params.preparationId), String(req.query.room_code ?? ''), req.body as SaveEmergencyPrescriptionInput) }); }
export async function putWardDisposition(req: Request, res: Response): Promise<void> { res.json({ message: 'Đã xác nhận hướng xử lý tại phòng theo dõi.', preparation: await decideWardDisposition(String(req.params.preparationId), String(req.query.room_code ?? ''), req.body as DecideWardDispositionInput) }); }
export async function putStartEmergencyPreparation(req: Request, res: Response): Promise<void> { res.json({ message: 'Đã bắt đầu chuẩn bị phẫu thuật.', preparation: await startEmergencyPreparation(String(req.params.preparationId)) }); }
export async function putCompletePreparationOrder(req: Request, res: Response): Promise<void> { res.json({ message: 'Đã lưu kết quả chỉ định.', order: await completePreparationOrder(String(req.params.orderId), req.body as CompletePreparationOrderInput) }); }
export async function putPreparationDisposition(req: Request, res: Response): Promise<void> { res.json({ message: 'Đã xác nhận phòng chuyển tiếp.', preparation: await decidePreparationDisposition(String(req.params.preparationId), req.body as DecidePreparationDispositionInput) }); }
