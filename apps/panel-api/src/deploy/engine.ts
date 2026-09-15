import fs from "node:fs/promises";
import path from "node:path";
import AdmZip from "adm-zip";
import { buildAppDomain } from "@hexapanel/shared";
import { prisma } from "../db.js";
import { config } from "../config.js";
import { detectRuntime, resolveStaticRoot } from "./detect.js";
import { allocatePort, releasePort } from "./ports.js";
import { runCommand } from "./shell.js";
import {
  disableNginxSite,
  enableNginxSite,
  ensureHttps,
  publishStaticSite,
  removeNginxConfig,
  writeNginxConfig,
} from "./nginx.js";
import {
  deletePm2Process,
  startPm2Process,
  stopPm2Process,
} from "./pm2.js";

type LogFn = (line: string) => Promise<void>;

async function appendLog(appId: string, line: string): Promise<void> {
  const stamp = new Date().toISOString();
  await prisma.deployLog.create({
    data: { appId, lines: `[${stamp}] ${line}` },
  });
}

function makeLogger(appId: string): LogFn {
  return async (line: string) => {
    await appendLog(appId, line);
  };
}

async function prepareSource(
  appId: string,
  userId: string,
  sourceType: string,
  sourceUrl: string | null,
  zipPath: string | null,
  log: LogFn,
): Promise<string> {
  const root = path.join(config.appsRoot, userId, appId);

  if (sourceType === "folder") {
    try {
      const entries = await fs.readdir(root);
      if (!entries.length) throw new Error("Dossier vide");
    } catch {
      throw new Error("Dossier source introuvable — réessaie l’upload");
    }
    await log(`Source dossier local prête`);
    return root;
  }

  await fs.rm(root, { recursive: true, force: true });
  await fs.mkdir(root, { recursive: true });

  if (sourceType === "github") {
    if (!sourceUrl) throw new Error("URL GitHub manquante");
    await log(`git clone ${sourceUrl}`);
    const safeUrl = sourceUrl.replace(/'/g, "'\\''");
    await runCommand(
      `git clone --depth 1 '${safeUrl}' .`,
      root,
      {},
      (l) => {
        void log(l);
      },
    );
  } else if (sourceType === "upload") {
    if (!zipPath) throw new Error("Archive ZIP manquante");
    await log(`Extraction ZIP ${path.basename(zipPath)}`);
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(root, true);
    const entries = await fs.readdir(root, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory() && e.name !== "__MACOSX");
    const files = entries.filter((e) => e.isFile());
    if (dirs.length === 1 && files.length === 0) {
      const nested = path.join(root, dirs[0].name);
      const tmp = `${root}.__unwrap`;
      await fs.rename(nested, tmp);
      await fs.rm(root, { recursive: true, force: true });
      await fs.rename(tmp, root);
    }
  } else {
    throw new Error(`sourceType inconnu: ${sourceType}`);
  }

  return root;
}

function parseEnvJson(raw: string): Record<string, string> {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "string") out[k] = v;
      else if (v != null) out[k] = String(v);
    }
    return out;
  } catch {
    return {};
  }
}

async function writeDotEnv(
  root: string,
  env: Record<string, string>,
  port: number | null,
): Promise<void> {
  const lines = Object.entries({
    ...env,
    ...(port ? { PORT: String(port) } : {}),
  }).map(([k, v]) => `${k}=${v}`);
  await fs.writeFile(path.join(root, ".env"), `${lines.join("\n")}\n`, "utf8");
}

export async function deployApp(
  appId: string,
  zipPath: string | null = null,
): Promise<void> {
  const app = await prisma.app.findUnique({ where: { id: appId } });
  if (!app) throw new Error("App introuvable");

  const log = makeLogger(appId);
  await prisma.app.update({
    where: { id: appId },
    data: { status: "building", lastError: null },
  });

  try {
    await log("Début du déploiement");
    const root = await prepareSource(
      app.id,
      app.userId,
      app.sourceType,
      app.sourceUrl,
      zipPath,
      log,
    );

    const detected = detectRuntime(root);
    const explicitRuntime =
      app.runtime && app.runtime !== "auto"
        ? (app.runtime as typeof detected.runtime)
        : detected.runtime;
    const finalRuntime = {
      runtime: explicitRuntime,
      buildCommand: app.buildCommand ?? detected.buildCommand,
      startCommand: app.startCommand ?? detected.startCommand,
      staticRoot: detected.staticRoot,
    };

    await log(`Runtime détecté: ${finalRuntime.runtime}`);

    let port = app.port;
    if (finalRuntime.runtime !== "static") {
      if (!port) {
        port = await allocatePort(app.id);
        await log(`Port alloué: ${port}`);
      }
    } else if (port) {
      await releasePort(app.id);
      port = null;
    }

    const domain = buildAppDomain(app.slug, config.vpsIp);
    const env = parseEnvJson(app.envJson);
    await writeDotEnv(root, env, port);

    if (finalRuntime.runtime === "node") {
      await log("npm install");
      await runCommand(
        "npm install --omit=dev || npm install",
        root,
        env,
        (l) => {
          void log(l);
        },
      );
    }

    if (finalRuntime.buildCommand) {
      await log(`Build: ${finalRuntime.buildCommand}`);
      await runCommand(
        finalRuntime.buildCommand.replace(/\$PORT/g, String(port ?? "")),
        root,
        { ...env, PORT: String(port ?? "") },
        (l) => {
          void log(l);
        },
      );
    }

    let staticRoot: string | null = null;
    if (finalRuntime.runtime === "static") {
      const detectedRoot = resolveStaticRoot(root, finalRuntime.staticRoot);
      await log(`Static source: ${detectedRoot}`);
      staticRoot = await publishStaticSite(app.slug, detectedRoot);
      await log(`Static publié pour nginx: ${staticRoot}`);
      await deletePm2Process(app.id);
    } else {
      if (!port || !finalRuntime.startCommand) {
        throw new Error("Port ou commande de démarrage manquant pour runtime dynamique");
      }
      await log(`PM2 start: ${finalRuntime.startCommand}`);
      await startPm2Process({
        appId: app.id,
        cwd: root,
        startCommand: finalRuntime.startCommand,
        port,
        env,
      });
    }

    await log(`Configuration nginx pour ${domain}`);
    await writeNginxConfig({
      slug: app.slug,
      domain,
      runtime: finalRuntime.runtime,
      port,
      staticRoot,
    });

    await log("Certificat HTTPS (certbot)");
    await ensureHttps(domain);

    await prisma.app.update({
      where: { id: app.id },
      data: {
        status: "running",
        runtime: finalRuntime.runtime,
        buildCommand: finalRuntime.buildCommand,
        startCommand: finalRuntime.startCommand,
        port,
        domain,
        rootPath: root,
        lastError: null,
      },
    });

    await log(
      config.deployDryRun
        ? "Déploiement terminé (mode dry-run — nginx/PM2/certbot simulés)"
        : "Déploiement terminé",
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await log(`ERREUR: ${message}`);
    await prisma.app.update({
      where: { id: appId },
      data: { status: "error", lastError: message.slice(0, 4000) },
    });
    throw err;
  }
}

export async function stopApp(appId: string): Promise<void> {
  const app = await prisma.app.findUnique({ where: { id: appId } });
  if (!app) throw new Error("App introuvable");
  await stopPm2Process(appId);
  await disableNginxSite(app.slug);
  await prisma.app.update({
    where: { id: appId },
    data: { status: "stopped" },
  });
}

export async function startApp(appId: string): Promise<void> {
  const app = await prisma.app.findUnique({ where: { id: appId } });
  if (!app) throw new Error("App introuvable");
  if (app.runtime === "static") {
    await enableNginxSite(app.slug);
    await prisma.app.update({
      where: { id: appId },
      data: { status: "running" },
    });
    return;
  }
  if (!app.port || !app.startCommand || !app.rootPath) {
    await deployApp(appId);
    return;
  }
  const env = parseEnvJson(app.envJson);
  await startPm2Process({
    appId: app.id,
    cwd: app.rootPath,
    startCommand: app.startCommand,
    port: app.port,
    env,
  });
  await enableNginxSite(app.slug);
  await prisma.app.update({
    where: { id: appId },
    data: { status: "running" },
  });
}

export async function destroyApp(appId: string): Promise<void> {
  const app = await prisma.app.findUnique({ where: { id: appId } });
  if (!app) return;
  await deletePm2Process(appId);
  await removeNginxConfig(app.slug, app.domain);
  await releasePort(appId);
  if (app.rootPath) {
    await fs.rm(app.rootPath, { recursive: true, force: true });
  }
  // Au cas où apps-data a bougé
  const fallback = path.join(config.appsRoot, app.userId, app.id);
  await fs.rm(fallback, { recursive: true, force: true });
  await prisma.app.delete({ where: { id: appId } });
}

let queue: Promise<void> = Promise.resolve();

export function enqueueDeploy(
  appId: string,
  zipPath: string | null = null,
): Promise<void> {
  const job = queue.then(() => deployApp(appId, zipPath)).catch(() => {
    /* erreur déjà persistée */
  });
  queue = job.then(
    () => undefined,
    () => undefined,
  );
  return job;
}
