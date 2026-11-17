import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { connectDatabase } from './config/database.js';
import { logger } from './config/logger.js';
import { errorHandler, notFoundHandler } from './errors/error.middleware.js';
import routes from './route/index.js';

const app: Express = express();
const port = Number(process.env.PORT) || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(pinoHttp({
  logger,
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ status_code: res.statusCode }),
  },
  customSuccessMessage: (req, res) =>
    `${req.method} ${req.url} ${res.statusCode}`,
  customErrorMessage: (req, res) =>
    `${req.method} ${req.url} ${res.statusCode}`,
}));

app.get('/', (req: Request, res: Response) => {
  res.send('Hello World!');
});

app.use('/api', routes);
app.use(notFoundHandler);
app.use(errorHandler);

async function startServer(): Promise<void> {
  const isDatabaseConnected = await connectDatabase();

  if (!isDatabaseConnected) {
    process.exitCode = 1;
    return;
  }

  app.listen(port, () => {
    logger.info({ port }, `Server đang chạy tại http://localhost:${port}`);
  });
}

void startServer().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Không thể khởi động server.');
  process.exitCode = 1;
});

process.on('unhandledRejection', (error: unknown) => {
  logger.fatal({ err: error }, 'Unhandled promise rejection.');
});
