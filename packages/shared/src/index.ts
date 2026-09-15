export type UserRole = "admin" | "user";

export type SourceType = "github" | "upload" | "folder";

export type AppRuntime = "static" | "node" | "python" | "php";
export type Runtime = "auto" | AppRuntime;

export type AppStatus =
  | "pending"
  | "building"
  | "running"
  | "error"
  | "stopped";

export interface PublicUser {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface AppSummary {
  id: string;
  userId: string;
  name: string;
  slug: string;
  sourceType: SourceType;
  sourceUrl: string | null;
  runtime: Runtime;
  port: number | null;
  status: AppStatus;
  domain: string;
  url: string;
  startCommand: string | null;
  buildCommand: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  ownerEmail?: string;
}

export interface DeployLogEntry {
  id: string;
  appId: string;
  lines: string;
  createdAt: string;
}

export interface SystemStats {
  hostname: string;
  platform: string;
  arch: string;
  uptimeSec: number;
  cpu: {
    model: string;
    cores: number;
    usagePercent: number;
    loadAvg: [number, number, number];
  };
  memory: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usagePercent: number;
  };
  disk: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usagePercent: number;
    mount: string;
  };
  apps: {
    total: number;
    running: number;
    building: number;
    stopped: number;
    error: number;
  };
  network: {
    vpsIp: string;
  };
  sampledAt: string;
}

export const SLUG_REGEX = /^[a-z0-9]([a-z0-9-]{0,46}[a-z0-9])?$/;

export function buildAppUrl(slug: string, vpsIp: string): string {
  return `https://${slug}.${vpsIp.replace(/\./g, "-")}.sslip.io`;
}

export function buildAppDomain(slug: string, vpsIp: string): string {
  return `${slug}.${vpsIp.replace(/\./g, "-")}.sslip.io`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let n = bytes / 1024;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n >= 10 ? 0 : 1)} ${units[i]}`;
}
