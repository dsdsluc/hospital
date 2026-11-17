import type { Request, Response } from 'express';
import {
  createDoctorProfile,
  findDoctorProfile,
  updateDoctorProfile,
} from '../service/doctor.service.js';
import type {
  CreateDoctorInput,
  UpdateDoctorInput,
} from '../validation/profile.validation.js';

export async function createDoctor(req: Request, res: Response): Promise<void> {
  const doctor = await createDoctorProfile(
    req.user!.id,
    req.body as CreateDoctorInput,
  );

  if (!doctor) {
    res.status(409).json({ message: 'Hồ sơ bác sĩ đã tồn tại.' });
    return;
  }

  res.status(201).json({ message: 'Tạo hồ sơ bác sĩ thành công.', doctor });
}

export async function getDoctor(req: Request, res: Response): Promise<void> {
  const doctor = await findDoctorProfile(req.user!.id);

  if (!doctor) {
    res.status(404).json({ message: 'Không tìm thấy hồ sơ bác sĩ.' });
    return;
  }

  res.json({ doctor });
}

export async function updateDoctor(req: Request, res: Response): Promise<void> {
  const doctor = await updateDoctorProfile(
    req.user!.id,
    req.body as UpdateDoctorInput,
  );

  if (!doctor) {
    res.status(404).json({ message: 'Không tìm thấy hồ sơ bác sĩ.' });
    return;
  }

  res.json({ message: 'Cập nhật hồ sơ bác sĩ thành công.', doctor });
}
