import fs from "node:fs";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import { config } from "./config.js";
import { prisma } from "./db.js";
import { authRouter } from "./routes/auth.js";
import { appsRouter } from "./routes/apps.js";
import { systemRouter } from "./routes/system.js";

async function ensureDirs(): Promise<void> {
  fs.mkdirSync(config.appsRoot, { recursive: true });
  fs.mkdirSync(config.uploadsRoot, { recursive: true });
  const dataDir = config.databaseUrl.replace(/^file:/, "");
  const dir = dataDir.includes("/")
    ? dataDir.slice(0, dataDir.lastIndexOf("/"))
    : ".";
  if (dir && dir !== ".") fs.mkdirSync(dir, { recursive: true });
}

async function ensureAdmin(): Promise<void> {
  const email = config.adminEmail.toLowerCase();
  const passwordHash = await bcrypt.hash(config.adminPassword, 12);
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "admin" },
    create: { email, passwordHash, role: "admin" },
  });
  console.log(`Admin prêt: ${email}`);
}

async function main(): Promise<void> {
  await ensureDirs();
  await ensureAdmin();

  const app = express();
  app.use(
    cors({
      origin: [config.panelWebOrigin, `https://panel.${config.vpsIp.replace(/\./g, "-")}.sslip.io`],
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      name: "HexaPanel",
      dryRun: config.deployDryRun,
      vpsIp: config.vpsIp,
    });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/apps", appsRouter);
  app.use("/api/system", systemRouter);

  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error(err);
      res.status(500).json({ error: err.message || "Erreur serveur" });
    },
  );

  app.listen(config.port, config.host, () => {
    console.log(`HexaPanel API sur http://${config.host}:${config.port}`);
    console.log(`DEPLOY_DRY_RUN=${config.deployDryRun}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
