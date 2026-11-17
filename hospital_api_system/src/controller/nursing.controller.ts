import type { Request, Response } from "express";
import { createAlert, createHandover, createTask, findNursingDashboard, recordVital, saveCarePlan, updateAlert, updateTask } from "../service/nursing.service.js";
import type { CreateAlertInput, CreateHandoverInput, CreateTaskInput, RecordVitalInput, SaveCarePlanInput, UpdateAlertInput, UpdateTaskInput } from "../validation/nursing.validation.js";

export async function getNursingDashboard(_req: Request, res: Response) { res.json({ patients: await findNursingDashboard() }); }
export async function putCarePlan(req: Request, res: Response) { res.json({ message: "Đã lưu kế hoạch chăm sóc.", care_plan: await saveCarePlan(String(req.params.preparationId), req.body as SaveCarePlanInput) }); }
export async function postTask(req: Request, res: Response) { res.status(201).json({ message: "Đã tạo nhiệm vụ điều dưỡng.", task: await createTask(String(req.params.preparationId), req.body as CreateTaskInput) }); }
export async function patchTask(req: Request, res: Response) { res.json({ message: "Đã cập nhật nhiệm vụ.", task: await updateTask(String(req.params.taskId), req.body as UpdateTaskInput) }); }
export async function postVital(req: Request, res: Response) { res.status(201).json({ message: "Đã ghi nhận sinh hiệu.", vital: await recordVital(String(req.params.preparationId), req.body as RecordVitalInput) }); }
export async function postAlert(req: Request, res: Response) { res.status(201).json({ message: "Đã gửi cảnh báo bác sĩ.", alert: await createAlert(String(req.params.preparationId), req.body as CreateAlertInput) }); }
export async function patchAlert(req: Request, res: Response) { res.json({ message: "Đã cập nhật cảnh báo.", alert: await updateAlert(String(req.params.alertId), req.body as UpdateAlertInput) }); }
export async function postHandover(req: Request, res: Response) { res.status(201).json({ message: "Đã lưu bàn giao ca trực.", handover: await createHandover(String(req.params.preparationId), req.body as CreateHandoverInput) }); }
