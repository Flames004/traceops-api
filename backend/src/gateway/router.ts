import { Router } from "express";
import { gatewayMatcher } from "./matcher.js";
import { gatewayAuth } from "./auth.js";
import { gatewayRateLimiter } from "./rateLimiter.js";
import { gatewayForwarder } from "./forwarder.js";

const router = Router();

/**
 * Gateway Request Pipeline:
 * [ Client ] -> Matcher -> Authenticator -> Rate Limiter -> Forwarder -> [ Upstream ]
 *
 * Route captures:
 * /gateway/:serviceSlug
 * /gateway/:serviceSlug/*
 */
router.all("/:serviceSlug*", gatewayMatcher, gatewayAuth, gatewayRateLimiter, gatewayForwarder);

export const gatewayRouter = router;
