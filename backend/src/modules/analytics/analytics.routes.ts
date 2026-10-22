import { Router } from "express";
import { handleGetOverview, handleGetLogs } from "./analytics.controller.js";
import { requireAuth } from "../../middleware/auth.js";

const router = Router();

// Protect all analytics endpoints
router.use(requireAuth);

router.get("/overview", handleGetOverview);
router.get("/logs", handleGetLogs);

export const analyticsRoutes = router;
