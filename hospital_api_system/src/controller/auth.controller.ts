import type { Request, Response } from 'express';
import {
  authenticateUser,
  findUserById,
  registerUser,
  updateCurrentUser,
} from '../service/auth.service.js';
import type { LoginInput, RegisterInput, UpdateAccountInput } from '../validation/auth.validation.js';

export async function register(req: Request, res: Response): Promise<void> {
  const result = await registerUser(req.body as RegisterInput);

  if (!result) {
    res.status(409).json({ message: 'Email đã được sử dụng.' });
    return;
  }

  res.status(201).json({
    message: 'Đăng ký thành công.',
    ...result,
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const result = await authenticateUser(req.body as LoginInput);

  if (!result) {
    res.status(401).json({ message: 'Email hoặc mật khẩu không chính xác.' });
    return;
  }

  res.json({
    message: 'Đăng nhập thành công.',
    ...result,
  });
}

export async function getCurrentUser(req: Request, res: Response): Promise<void> {
  const user = await findUserById(req.user!.id);

  if (!user) {
    res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    return;
  }

  res.json({ user });
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  const user = await updateCurrentUser(req.user!.id, req.body as UpdateAccountInput);
  res.json({ message: 'Cập nhật thông tin liên hệ thành công.', user });
}
