import type { ErrorRequestHandler, RequestHandler } from 'express';
import { logger } from '../config/logger.js';
import { AppError } from './app.error.js';

interface ErrorWithCode extends Error {
  code?: string;
  status?: number;
  body?: unknown;
}

function normalizeError(error: ErrorWithCode): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof SyntaxError && error.status === 400 && error.body) {
    return new AppError(400, 'JSON không hợp lệ.');
  }

  if (error.code === 'P2002') {
    return new AppError(409, 'Dữ liệu đã tồn tại trong hệ thống.');
  }

  if (error.code === 'P2025') {
    return new AppError(404, 'Không tìm thấy dữ liệu cần xử lý.');
  }

  return new AppError(500, 'Đã xảy ra lỗi bên trong máy chủ.');
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, `Không tìm thấy endpoint ${req.method} ${req.originalUrl}.`));
};

export const errorHandler: ErrorRequestHandler = (error: ErrorWithCode, req, res, _next) => {
  const normalizedError = normalizeError(error);

  const logContext = {
    request: {
      method: req.method,
      url: req.originalUrl,
      user_id: req.user?.id,
    },
    status_code: normalizedError.statusCode,
  };

  if (normalizedError.statusCode >= 500) {
    logger.error({ ...logContext, err: error }, normalizedError.message);
  } else {
    logger.warn(logContext, normalizedError.message);
  }

  res.status(normalizedError.statusCode).json({
    message: normalizedError.message,
    ...(normalizedError.details !== undefined && {
      errors: normalizedError.details,
    }),
    ...(process.env.NODE_ENV !== 'production' && {
      error: error.message,
    }),
  });
};
