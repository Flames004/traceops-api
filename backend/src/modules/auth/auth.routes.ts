import { Router } from "express";
import { handleRegister, handleLogin, handleGetProfile } from "./auth.controller.js";
import { requireAuth } from "../../middleware/auth.js";

const router = Router();

router.post("/register", handleRegister);
router.post("/login", handleLogin);
router.get("/me", requireAuth, handleGetProfile);

export const authRoutes = router;
