import type { Request, Response } from 'express';
import {
  createPatientProfile,
  findPatientDirectory,
  findPatientProfile,
  searchPatientsForReception,
  updatePatientProfile,
  updatePatientProfileByDoctor,
} from '../service/patient.service.js';
import type {
  CreatePatientInput,
  UpdatePatientInput,
  UpdatePatientByDoctorInput,
} from '../validation/profile.validation.js';

export async function createPatient(req: Request, res: Response): Promise<void> {
  const patient = await createPatientProfile(
    req.user!.id,
    req.body as CreatePatientInput,
  );

  if (!patient) {
    res.status(409).json({ message: 'Hồ sơ bệnh nhân đã tồn tại.' });
    return;
  }

  res.status(201).json({ message: 'Tạo hồ sơ bệnh nhân thành công.', patient });
}

export async function getPatient(req: Request, res: Response): Promise<void> {
  const patient = await findPatientProfile(req.user!.id);

  if (!patient) {
    res.status(404).json({ message: 'Không tìm thấy hồ sơ bệnh nhân.' });
    return;
  }

  res.json({ patient });
}

export async function updatePatient(req: Request, res: Response): Promise<void> {
  const patient = await updatePatientProfile(
    req.user!.id,
    req.body as UpdatePatientInput,
  );

  if (!patient) {
    res.status(404).json({ message: 'Không tìm thấy hồ sơ bệnh nhân.' });
    return;
  }

  res.json({ message: 'Cập nhật hồ sơ bệnh nhân thành công.', patient });
}

export async function updatePatientByDoctor(req: Request, res: Response): Promise<void> {
  const patient = await updatePatientProfileByDoctor(
    String(req.params.patientId),
    req.body as UpdatePatientByDoctorInput,
  );

  if (!patient) {
    res.status(404).json({ message: 'Không tìm thấy hồ sơ bệnh nhân.' });
    return;
  }

  res.json({ message: 'Cập nhật hồ sơ bệnh nhân thành công.', patient });
}

/** GET /patients?q= — danh bạ bệnh nhân cho bác sĩ (tối đa 200 hồ sơ, mới nhất trước). */
export async function listPatients(req: Request, res: Response): Promise<void> {
  const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 100) : undefined;
  res.json(await findPatientDirectory(q));
}

export async function searchPatients(req: Request, res: Response): Promise<void> {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  if (query.length < 3) {
    res.status(400).json({ message: 'Nhập ít nhất 3 ký tự để tra cứu.' });
    return;
  }

  const patients = await searchPatientsForReception(query);
  res.json({ patients });
}
