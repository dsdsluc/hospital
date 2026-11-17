import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '../generated/prisma/client.js';
import { JWT_SECRET } from '../config/auth.js';

interface AccessTokenPayload extends jwt.JwtPayload {
  sub: string;
  role: UserRole;
}

export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Bạn chưa cung cấp access token.' });
    return;
  }

  const token = authorization.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AccessTokenPayload;

    if (!payload.sub || !Object.values(UserRole).includes(payload.role)) {
      res.status(401).json({ message: 'Access token không hợp lệ.' });
      return;
    }

    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    res.status(401).json({ message: 'Access token không hợp lệ hoặc đã hết hạn.' });
  }
}

export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Bạn chưa đăng nhập.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ message: 'Bạn không có quyền truy cập tài nguyên này.' });
      return;
    }

    next();
  };
}
