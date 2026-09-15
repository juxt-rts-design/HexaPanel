import fs from "node:fs";
import fsPromises from "node:fs/promises";
import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { z } from "zod";
import { SLUG_REGEX, buildAppDomain } from "@hexapanel/shared";
import { prisma } from "../db.js";
import { config } from "../config.js";
import { toAppSummary } from "../serializers.js";
import {
  assertAppAccess,
  requireAuth,
  type AuthedRequest,
} from "../middleware/auth.js";
import {
  destroyApp,
  enqueueDeploy,
  startApp,
  stopApp,
} from "../deploy/engine.js";

fs.mkdirSync(config.uploadsRoot, { recursive: true });

const upload = multer({
  dest: config.uploadsRoot,
  limits: { fileSize: config.maxZipMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === "application/zip" ||
      file.mimetype === "application/x-zip-compressed" ||
      file.originalname.toLowerCase().endsWith(".zip")
    ) {
      cb(null, true);
      return;
    }
    cb(new Error("Seuls les fichiers ZIP sont acceptés"));
  },
});

const uploadFolder = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxZipMb * 1024 * 1024,
    files: 4000,
  },
});

const SKIP_PATH_RE =
  /(^|\/)(node_modules|\.git|\.svn|\.hg|dist|build|\.next|coverage|\.turbo|__pycache__|\.venv|venv)(\/|$)/i;

function safeRelPath(rel: string): string | null {
  const normalized = rel.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || path.isAbsolute(normalized)) {
    return null;
  }
  if (SKIP_PATH_RE.test(normalized)) return null;
  return normalized;
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().regex(SLUG_REGEX),
  sourceType: z.enum(["github", "upload", "folder"]),
  sourceUrl: z.string().url().optional().nullable(),
  runtime: z.enum(["auto", "static", "node", "python", "php"]).optional(),
  buildCommand: z.string().max(500).optional().nullable(),
  startCommand: z.string().max(500).optional().nullable(),
  env: z.record(z.string(), z.string()).optional(),
});

export const appsRouter = Router();
appsRouter.use(requireAuth);

function appId(req: AuthedRequest): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

appsRouter.get("/", async (req: AuthedRequest, res) => {
  const isAdmin = req.user!.role === "admin";
  const apps = await prisma.app.findMany({
    where: isAdmin ? undefined : { userId: req.user!.sub },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { email: true } } },
  });
  res.json({
    apps: apps.map((a) => toAppSummary(a, a.user.email)),
  });
});

appsRouter.get("/:id", async (req: AuthedRequest, res) => {
  const access = await assertAppAccess(req.user!, appId(req));
  if (!access.ok) {
    res.status(access.status).json({ error: access.error });
    return;
  }
  const app = await prisma.app.findUnique({
    where: { id: appId(req) },
    include: { user: { select: { email: true } } },
  });
  if (!app) {
    res.status(404).json({ error: "App introuvable" });
    return;
  }
  res.json({
    app: toAppSummary(app, app.user.email),
    env: JSON.parse(app.envJson || "{}"),
  });
});

appsRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides", details: parsed.error.flatten() });
    return;
  }

  const data = parsed.data;
  if (data.sourceType === "github" && !data.sourceUrl) {
    res.status(400).json({ error: "URL GitHub requise" });
    return;
  }

  const existing = await prisma.app.findUnique({ where: { slug: data.slug } });
  if (existing) {
    res.status(409).json({ error: "Slug déjà pris" });
    return;
  }

  const domain = buildAppDomain(data.slug, config.vpsIp);
  const rootPath = path.join(config.appsRoot, req.user!.sub, "pending");

  const app = await prisma.app.create({
    data: {
      userId: req.user!.sub,
      name: data.name,
      slug: data.slug,
      sourceType: data.sourceType,
      sourceUrl: data.sourceUrl ?? null,
      runtime: data.runtime ?? "auto",
      domain,
      rootPath,
      buildCommand: data.buildCommand ?? null,
      startCommand: data.startCommand ?? null,
      envJson: JSON.stringify(data.env ?? {}),
      status: "pending",
    },
  });

  if (data.sourceType === "github") {
    void enqueueDeploy(app.id);
  }

  res.status(201).json({ app: toAppSummary(app) });
});

appsRouter.post("/:id/upload", (req: AuthedRequest, res) => {
  upload.single("archive")(req, res, async (err) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    const access = await assertAppAccess(req.user!, appId(req));
    if (!access.ok) {
      res.status(access.status).json({ error: access.error });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "Fichier ZIP requis" });
      return;
    }

    await prisma.app.update({
      where: { id: appId(req) },
      data: { sourceType: "upload", status: "pending" },
    });

    void enqueueDeploy(appId(req), req.file.path);
    res.json({ ok: true, message: "Upload reçu, déploiement en cours" });
  });
});

appsRouter.post("/:id/upload-folder", (req: AuthedRequest, res) => {
  uploadFolder.array("files", 4000)(req, res, async (err) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    const access = await assertAppAccess(req.user!, appId(req));
    if (!access.ok) {
      res.status(access.status).json({ error: access.error });
      return;
    }

    const files = req.files as Express.Multer.File[] | undefined;
    if (!files?.length) {
      res.status(400).json({ error: "Dossier vide ou aucun fichier" });
      return;
    }

    const id = appId(req);
    const app = await prisma.app.findUnique({ where: { id } });
    if (!app) {
      res.status(404).json({ error: "App introuvable" });
      return;
    }

    const root = path.join(config.appsRoot, app.userId, app.id);
    await fsPromises.rm(root, { recursive: true, force: true });
    await fsPromises.mkdir(root, { recursive: true });

    let written = 0;
    for (const file of files) {
      const rel = safeRelPath(file.originalname);
      if (!rel) continue;

      const dest = path.join(root, rel);
      await fsPromises.mkdir(path.dirname(dest), { recursive: true });
      await fsPromises.writeFile(dest, file.buffer);
      written += 1;
    }

    if (written === 0) {
      res.status(400).json({
        error: "Aucun fichier utile (node_modules / .git exclus)",
      });
      return;
    }

    const entries = await fsPromises.readdir(root, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory());
    const onlyFiles = entries.filter((e) => e.isFile());
    if (dirs.length === 1 && onlyFiles.length === 0) {
      const nested = path.join(root, dirs[0].name);
      const tmp = `${root}.__unwrap`;
      await fsPromises.rename(nested, tmp);
      await fsPromises.rm(root, { recursive: true, force: true });
      await fsPromises.rename(tmp, root);
    }

    await prisma.app.update({
      where: { id },
      data: {
        sourceType: "folder",
        status: "pending",
        rootPath: root,
      },
    });

    void enqueueDeploy(id);
    res.json({
      ok: true,
      message: `Dossier reçu (${written} fichiers), déploiement en cours`,
      files: written,
    });
  });
});

appsRouter.post("/:id/deploy", async (req: AuthedRequest, res) => {
  const access = await assertAppAccess(req.user!, appId(req));
  if (!access.ok) {
    res.status(access.status).json({ error: access.error });
    return;
  }
  void enqueueDeploy(appId(req));
  res.json({ ok: true, message: "Redéploiement lancé" });
});

appsRouter.post("/:id/stop", async (req: AuthedRequest, res) => {
  const access = await assertAppAccess(req.user!, appId(req));
  if (!access.ok) {
    res.status(access.status).json({ error: access.error });
    return;
  }
  await stopApp(appId(req));
  const app = await prisma.app.findUnique({ where: { id: appId(req) } });
  res.json({ app: app ? toAppSummary(app) : null });
});

appsRouter.post("/:id/start", async (req: AuthedRequest, res) => {
  const access = await assertAppAccess(req.user!, appId(req));
  if (!access.ok) {
    res.status(access.status).json({ error: access.error });
    return;
  }
  await startApp(appId(req));
  const app = await prisma.app.findUnique({ where: { id: appId(req) } });
  res.json({ app: app ? toAppSummary(app) : null });
});

appsRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const access = await assertAppAccess(req.user!, appId(req));
  if (!access.ok) {
    res.status(access.status).json({ error: access.error });
    return;
  }
  await destroyApp(appId(req));
  res.json({ ok: true });
});

appsRouter.get("/:id/logs", async (req: AuthedRequest, res) => {
  const access = await assertAppAccess(req.user!, appId(req));
  if (!access.ok) {
    res.status(access.status).json({ error: access.error });
    return;
  }
  const logs = await prisma.deployLog.findMany({
    where: { appId: appId(req) },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json({
    logs: logs.reverse().map((l) => ({
      id: l.id,
      appId: l.appId,
      lines: l.lines,
      createdAt: l.createdAt.toISOString(),
    })),
  });
});

appsRouter.patch("/:id/env", async (req: AuthedRequest, res) => {
  const access = await assertAppAccess(req.user!, appId(req));
  if (!access.ok) {
    res.status(access.status).json({ error: access.error });
    return;
  }
  const envSchema = z.record(z.string(), z.string());
  const parsed = envSchema.safeParse(req.body?.env ?? req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "env invalide" });
    return;
  }
  const app = await prisma.app.update({
    where: { id: appId(req) },
    data: { envJson: JSON.stringify(parsed.data) },
  });
  res.json({ app: toAppSummary(app), env: parsed.data });
});
