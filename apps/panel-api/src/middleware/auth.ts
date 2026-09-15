import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { prisma } from "../db.js";
import type { UserRole } from "@hexapanel/shared";

export interface AuthPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface AuthedRequest extends Request {
  user?: AuthPayload;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

export function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  try {
    const token = header.slice(7);
    const decoded = jwt.verify(token, config.jwtSecret) as AuthPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Token invalide" });
  }
}

export function requireAdmin(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ error: "Accès admin requis" });
    return;
  }
  next();
}

export async function assertAppAccess(
  user: AuthPayload,
  appId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const app = await prisma.app.findUnique({ where: { id: appId } });
  if (!app) return { ok: false, status: 404, error: "App introuvable" };
  if (user.role !== "admin" && app.userId !== user.sub) {
    return { ok: false, status: 403, error: "Accès refusé" };
  }
  return { ok: true };
}
