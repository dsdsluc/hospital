import type { Request, Response } from 'express';
import {
  cancelPatientAppointment,
  checkInAppointment,
  createAppointment,
  findAppointmentByCode,
  findDailySchedule,
  findPatientAppointment,
  findPatientAppointments,
  findReceptionQueue,
  findScheduleRange,
} from '../service/appointment.service.js';
import type { CreateAppointmentInput } from '../validation/appointment.validation.js';

interface AppointmentParams {
  appointmentId: string;
}

export async function bookAppointment(req: Request, res: Response): Promise<void> {
  const appointment = await createAppointment(
    req.user!.id,
    req.body as CreateAppointmentInput,
  );

  if (!appointment) {
    res.status(404).json({ message: 'Không tìm thấy hồ sơ bệnh nhân.' });
    return;
  }

  res.status(201).json({ message: 'Đặt lịch khám thành công.', appointment });
}

export async function getMyAppointments(req: Request, res: Response): Promise<void> {
  const appointments = await findPatientAppointments(req.user!.id);

  if (!appointments) {
    res.status(404).json({ message: 'Không tìm thấy hồ sơ bệnh nhân.' });
    return;
  }

  res.json({ appointments });
}

export async function getMyAppointment(
  req: Request<AppointmentParams>,
  res: Response,
): Promise<void> {
  const appointment = await findPatientAppointment(
    req.user!.id,
    req.params.appointmentId,
  );

  if (!appointment) {
    res.status(404).json({ message: 'Không tìm thấy lịch khám.' });
    return;
  }

  res.json({ appointment });
}

export async function cancelMyAppointment(
  req: Request<AppointmentParams>,
  res: Response,
): Promise<void> {
  const appointment = await cancelPatientAppointment(
    req.user!.id,
    req.params.appointmentId,
  );

  if (!appointment) {
    res.status(404).json({ message: 'Không tìm thấy lịch khám.' });
    return;
  }

  res.json({ message: 'Hủy lịch khám thành công.', appointment });
}

function todayInVietnam() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function checkIn(req: Request, res: Response): Promise<void> {
  const appointmentId = String(req.params.appointmentId);
  if (!UUID_PATTERN.test(appointmentId)) {
    res.status(404).json({ message: 'Không tìm thấy lịch hẹn.' });
    return;
  }

  const moveToToday = (req.body as { move_to_today?: unknown } | undefined)?.move_to_today === true;
  const appointment = await checkInAppointment(appointmentId, moveToToday);
  res.json({
    message: moveToToday ? 'Đã chuyển lịch sang hôm nay và xác nhận bệnh nhân đã đến.' : 'Đã xác nhận bệnh nhân đã đến.',
    appointment,
  });
}

export async function lookupAppointment(req: Request, res: Response): Promise<void> {
  const code = typeof req.query.code === 'string' ? req.query.code.trim().toUpperCase() : '';

  if (!/^[A-Z2-9]{6}$/.test(code)) {
    res.status(400).json({ message: 'Mã lịch hẹn gồm 6 ký tự chữ và số.' });
    return;
  }

  const appointment = await findAppointmentByCode(code);

  if (!appointment) {
    res.status(404).json({ message: `Không tìm thấy lịch hẹn ${code}.` });
    return;
  }

  res.json({ today: todayInVietnam(), appointment });
}

export async function getDailySchedule(req: Request, res: Response): Promise<void> {
  const isValidDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

  // Xem theo khoảng ngày: ?from=YYYY-MM-DD[&to=YYYY-MM-DD]. Bỏ `to` = mọi lịch từ `from` trở đi.
  if (typeof req.query.from === 'string') {
    const from = req.query.from;
    const to = typeof req.query.to === 'string' && req.query.to !== '' ? req.query.to : undefined;
    if (!isValidDate(from) || (to !== undefined && !isValidDate(to)) || (to !== undefined && to < from)) {
      res.status(400).json({ message: 'Khoảng ngày xem lịch không hợp lệ.' });
      return;
    }
    const appointments = await findScheduleRange(from, to);
    res.json({ from, to: to ?? null, today: todayInVietnam(), appointments });
    return;
  }

  const appointmentDate = typeof req.query.date === 'string' ? req.query.date : todayInVietnam();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate) || Number.isNaN(Date.parse(appointmentDate))) {
    res.status(400).json({ message: 'Ngày xem lịch không hợp lệ.' });
    return;
  }

  const appointments = await findDailySchedule(appointmentDate);
  res.json({ appointment_date: appointmentDate, appointments });
}

export async function getReceptionQueue(req: Request, res: Response): Promise<void> {
  const requestedDate = typeof req.query.date === 'string' ? req.query.date : undefined;
  const vietnamDateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const datePart = (type: Intl.DateTimeFormatPartTypes) =>
    vietnamDateParts.find((part) => part.type === type)?.value ?? '';
  const today = `${datePart('year')}-${datePart('month')}-${datePart('day')}`;
  const appointmentDate = requestedDate ?? today;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
    res.status(400).json({ message: 'Ngày xem hàng đợi không hợp lệ.' });
    return;
  }

  const appointments = await findReceptionQueue(appointmentDate);
  res.json({ appointment_date: appointmentDate, appointments });
}
