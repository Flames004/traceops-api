import { Request, Response, NextFunction } from "express";
import { createApiKeySchema, serviceKeyParamsSchema } from "./key.schemas.js";
import * as keyService from "./key.service.js";

export async function handleCreateApiKey(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { serviceId } = serviceKeyParamsSchema.parse(req.params);
    const input = createApiKeySchema.parse(req.body);

    const result = await keyService.createApiKey(req.user!.id, serviceId, input);

    res.status(201).json({
      message: "API key created successfully. Save your secret key now; it will not be shown again.",
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

export async function handleListApiKeys(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { serviceId } = serviceKeyParamsSchema.parse(req.params);
    const keys = await keyService.listApiKeys(req.user!.id, serviceId);

    res.status(200).json({
      keys,
      count: keys.length,
    });
  } catch (err) {
    next(err);
  }
}

export async function handleRevokeApiKey(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { serviceId, keyId } = serviceKeyParamsSchema.parse(req.params);
    const result = await keyService.revokeApiKey(req.user!.id, serviceId, keyId!);

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function handleDeleteApiKey(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { serviceId, keyId } = serviceKeyParamsSchema.parse(req.params);
    const result = await keyService.deleteApiKey(req.user!.id, serviceId, keyId!);

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
