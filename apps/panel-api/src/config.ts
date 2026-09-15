import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

function resolveFromApi(p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(__dirname, "..", p);
}

export const config = {
  port: Number(process.env.PORT ?? 4040),
  host: process.env.HOST ?? "0.0.0.0",
  databaseUrl: required("DATABASE_URL", "file:../../../data/hexapanel.db"),
  jwtSecret: required("JWT_SECRET", "dev-secret"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  vpsIp: required("VPS_IP", "127.0.0.1"),
  appsRoot: resolveFromApi(process.env.APPS_ROOT ?? "../../../apps-data"),
  uploadsRoot: resolveFromApi(process.env.UPLOADS_ROOT ?? "../../../data/uploads"),
  portRangeStart: Number(process.env.PORT_RANGE_START ?? 5100),
  portRangeEnd: Number(process.env.PORT_RANGE_END ?? 5999),
  maxZipMb: Number(process.env.MAX_ZIP_MB ?? 100),
  buildTimeoutMs: Number(process.env.BUILD_TIMEOUT_MS ?? 600_000),
  deployDryRun: (process.env.DEPLOY_DRY_RUN ?? "true") === "true",
  panelWebOrigin: process.env.PANEL_WEB_ORIGIN ?? "http://localhost:5173",
  adminEmail: process.env.ADMIN_EMAIL ?? "admin@hexapanel.local",
  adminPassword: process.env.ADMIN_PASSWORD ?? "admin123456",
};
