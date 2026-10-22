import { Request, Response, NextFunction } from "express";
import {
  analyticsOverviewQuerySchema,
  analyticsLogsQuerySchema,
} from "./analytics.schemas.js";
import * as analyticsService from "./analytics.service.js";

export async function handleGetOverview(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const query = analyticsOverviewQuerySchema.parse(req.query);
    const data = await analyticsService.getOverviewStats(req.user!.id, query);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

export async function handleGetLogs(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const query = analyticsLogsQuerySchema.parse(req.query);
    const data = await analyticsService.getRequestLogs(req.user!.id, query);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}
