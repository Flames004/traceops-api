import { Router } from "express";
import {
  handleCreateApiKey,
  handleListApiKeys,
  handleRevokeApiKey,
  handleDeleteApiKey,
} from "./key.controller.js";
import { requireAuth } from "../../middleware/auth.js";

const router = Router({ mergeParams: true });

// Dashboard authentication required
router.use(requireAuth);

router.post("/", handleCreateApiKey);
router.get("/", handleListApiKeys);
router.patch("/:keyId/revoke", handleRevokeApiKey);
router.delete("/:keyId", handleDeleteApiKey);

export const keyRoutes = router;
