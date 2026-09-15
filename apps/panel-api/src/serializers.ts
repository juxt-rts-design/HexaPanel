import type { App, User } from "@prisma/client";
import type { AppSummary, PublicUser } from "@hexapanel/shared";
import { buildAppUrl } from "@hexapanel/shared";
import { config } from "./config.js";

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role as PublicUser["role"],
    createdAt: user.createdAt.toISOString(),
  };
}

export function toAppSummary(
  app: App,
  ownerEmail?: string,
): AppSummary {
  return {
    id: app.id,
    userId: app.userId,
    name: app.name,
    slug: app.slug,
    sourceType: app.sourceType as AppSummary["sourceType"],
    sourceUrl: app.sourceUrl,
    runtime: app.runtime as AppSummary["runtime"],
    port: app.port,
    status: app.status as AppSummary["status"],
    domain: app.domain,
    url: buildAppUrl(app.slug, config.vpsIp),
    startCommand: app.startCommand,
    buildCommand: app.buildCommand,
    lastError: app.lastError,
    createdAt: app.createdAt.toISOString(),
    updatedAt: app.updatedAt.toISOString(),
    ownerEmail,
  };
}
