import { Router } from "express";
import {
  handleCreateService,
  handleListServices,
  handleGetService,
  handleUpdateService,
  handleToggleActive,
  handleDeleteService,
} from "./service.controller.js";
import { keyRoutes } from "../keys/key.routes.js";
import { requireAuth } from "../../middleware/auth.js";

const router = Router();

// Protect all service management endpoints
router.use(requireAuth);

// Nested API Key Management
router.use("/:serviceId/keys", keyRoutes);

router.post("/", handleCreateService);
router.get("/", handleListServices);
router.get("/:id", handleGetService);
router.patch("/:id", handleUpdateService);
router.patch("/:id/toggle", handleToggleActive);
router.delete("/:id", handleDeleteService);

export const serviceRoutes = router;
