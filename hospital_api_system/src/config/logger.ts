import pino from 'pino';
import pretty from 'pino-pretty';

const isDevelopment = process.env.NODE_ENV !== 'production';
const developmentStream = isDevelopment
  ? pretty({
      colorize: true,
      translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
      ignore: 'pid,hostname',
      singleLine: true,
    })
  : undefined;

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDevelopment ? 'debug' : 'info'),
  redact: {
    paths: [
      'req.headers.authorization',
      'password',
      'password_hash',
      '*.password',
      '*.password_hash',
    ],
    censor: '[REDACTED]',
  },
}, developmentStream);
