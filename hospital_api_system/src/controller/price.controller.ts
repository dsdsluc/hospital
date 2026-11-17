import type { Request, Response } from 'express';
import { findCurrentMedicinePrices, findCurrentServicePrices } from '../service/price.service.js';

export async function getServicePrices(_req: Request, res: Response): Promise<void> {
  res.json({ services: await findCurrentServicePrices() });
}

export async function getMedicinePrices(_req: Request, res: Response): Promise<void> {
  res.json({ medicines: await findCurrentMedicinePrices() });
}
