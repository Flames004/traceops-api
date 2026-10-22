import { Request, Response, NextFunction } from "express";
import {
  createServiceSchema,
  updateServiceSchema,
  serviceIdSchema,
} from "./service.schemas.js";
import * as serviceService from "./service.service.js";

export async function handleCreateService(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const input = createServiceSchema.parse(req.body);
    const service = await serviceService.createService(req.user!.id, input);
    res.status(201).json({
      message: "Service registered successfully",
      service,
    });
  } catch (err) {
    next(err);
  }
}

export async function handleListServices(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const services = await serviceService.listServices(req.user!.id);
    res.status(200).json({
      services,
      count: services.length,
    });
  } catch (err) {
    next(err);
  }
}

export async function handleGetService(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = serviceIdSchema.parse(req.params);
    const service = await serviceService.getServiceById(req.user!.id, id);
    res.status(200).json({ service });
  } catch (err) {
    next(err);
  }
}

export async function handleUpdateService(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = serviceIdSchema.parse(req.params);
    const input = updateServiceSchema.parse(req.body);
    const service = await serviceService.updateService(req.user!.id, id, input);
    res.status(200).json({
      message: "Service updated successfully",
      service,
    });
  } catch (err) {
    next(err);
  }
}

export async function handleToggleActive(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = serviceIdSchema.parse(req.params);
    const { isActive } = req.body;
    if (typeof isActive !== "boolean") {
      res.status(400).json({ error: "isActive boolean field is required" });
      return;
    }
    const service = await serviceService.toggleServiceActive(req.user!.id, id, isActive);
    res.status(200).json({
      message: `Service ${isActive ? "enabled" : "disabled"} successfully`,
      service,
    });
  } catch (err) {
    next(err);
  }
}

export async function handleDeleteService(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = serviceIdSchema.parse(req.params);
    const result = await serviceService.deleteService(req.user!.id, id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
