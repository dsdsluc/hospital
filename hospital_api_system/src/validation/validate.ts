import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

export function validateBody(schema: z.ZodType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: 'Dữ liệu gửi lên không hợp lệ.',
        errors: z.flattenError(parsed.error).fieldErrors,
      });
      return;
    }

    req.body = parsed.data;
    next();
  };
}
