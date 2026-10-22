import { db } from "../../lib/db.js";
import { AppError } from "../../middleware/errorHandler.js";
import { validateUpstreamUrl } from "../../lib/ssrf.js";
import { CreateServiceInput, UpdateServiceInput } from "./service.schemas.js";

const allowLocalUpstreams = process.env.ALLOW_LOCAL_UPSTREAMS === "true";

export async function createService(userId: string, input: CreateServiceInput) {
  // 1. SSRF destination check
  const ssrfCheck = await validateUpstreamUrl(input.upstreamUrl, allowLocalUpstreams);
  if (!ssrfCheck.isValid) {
    throw new AppError(`SSRF Security Error: ${ssrfCheck.error}`, 400);
  }

  // 2. Slug collision check
  const existing = await db.service.findUnique({
    where: { slug: input.slug },
  });

  if (existing) {
    throw new AppError(`A service with slug '${input.slug}' already exists.`, 409);
  }

  // 3. Persist service
  const service = await db.service.create({
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description,
      upstreamUrl: input.upstreamUrl,
      routePrefix: input.routePrefix,
      timeoutMs: input.timeoutMs,
      allowedMethods: input.allowedMethods,
      rateLimitMax: input.rateLimitMax,
      rateLimitWindowMs: input.rateLimitWindowMs,
      userId,
    },
  });

  return service;
}

export async function listServices(userId: string) {
  const services = await db.service.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          apiKeys: true,
          requestLogs: true,
        },
      },
    },
  });

  return services;
}

export async function getServiceById(userId: string, serviceId: string) {
  const service = await db.service.findFirst({
    where: { id: serviceId, userId },
    include: {
      _count: {
        select: {
          apiKeys: true,
          requestLogs: true,
        },
      },
    },
  });

  if (!service) {
    throw new AppError("Service not found.", 404);
  }

  return service;
}

export async function updateService(
  userId: string,
  serviceId: string,
  input: UpdateServiceInput
) {
  const service = await db.service.findFirst({
    where: { id: serviceId, userId },
  });

  if (!service) {
    throw new AppError("Service not found.", 404);
  }

  // If upstreamUrl changed, re-validate SSRF
  if (input.upstreamUrl && input.upstreamUrl !== service.upstreamUrl) {
    const ssrfCheck = await validateUpstreamUrl(input.upstreamUrl, allowLocalUpstreams);
    if (!ssrfCheck.isValid) {
      throw new AppError(`SSRF Security Error: ${ssrfCheck.error}`, 400);
    }
  }

  // If slug changed, ensure new slug is available
  if (input.slug && input.slug !== service.slug) {
    const slugTaken = await db.service.findUnique({
      where: { slug: input.slug },
    });
    if (slugTaken) {
      throw new AppError(`A service with slug '${input.slug}' already exists.`, 409);
    }
  }

  const updated = await db.service.update({
    where: { id: serviceId },
    data: input,
  });

  return updated;
}

export async function toggleServiceActive(
  userId: string,
  serviceId: string,
  isActive: boolean
) {
  const service = await db.service.findFirst({
    where: { id: serviceId, userId },
  });

  if (!service) {
    throw new AppError("Service not found.", 404);
  }

  return await db.service.update({
    where: { id: serviceId },
    data: { isActive },
  });
}

export async function deleteService(userId: string, serviceId: string) {
  const service = await db.service.findFirst({
    where: { id: serviceId, userId },
  });

  if (!service) {
    throw new AppError("Service not found.", 404);
  }

  await db.service.delete({
    where: { id: serviceId },
  });

  return { message: "Service deleted successfully" };
}
