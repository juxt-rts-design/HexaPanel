import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { runCommand } from "./shell.js";

function pm2Name(appId: string): string {
  return `hexapanel-app-${appId}`;
}

export async function startPm2Process(opts: {
  appId: string;
  cwd: string;
  startCommand: string;
  port: number;
  env: Record<string, string>;
}): Promise<void> {
  const name = pm2Name(opts.appId);
  const env = {
    ...opts.env,
    PORT: String(opts.port),
    HOST: "127.0.0.1",
  };

  const ecosystem = {
    apps: [
      {
        name,
        cwd: opts.cwd,
        script: "bash",
        args: ["-lc", opts.startCommand.replace(/\$PORT/g, String(opts.port))],
        env,
        autorestart: true,
        max_restarts: 10,
      },
    ],
  };

  const ecoPath = path.join(opts.cwd, "hexapanel.ecosystem.cjs");
  await fs.writeFile(
    ecoPath,
    `module.exports = ${JSON.stringify(ecosystem, null, 2)};\n`,
    "utf8",
  );

  if (config.deployDryRun) {
    await fs.writeFile(
      path.join(opts.cwd, "hexapanel.pm2.dry.json"),
      JSON.stringify(ecosystem, null, 2),
      "utf8",
    );
    return;
  }

  await runCommand(`pm2 delete ${name} || true`, opts.cwd, env);
  await runCommand(`pm2 start ${ecoPath}`, opts.cwd, env);
  await runCommand("pm2 save || true", opts.cwd, env);
}

export async function stopPm2Process(appId: string): Promise<void> {
  const name = pm2Name(appId);
  if (config.deployDryRun) return;
  await runCommand(`pm2 stop ${name} || true`, process.cwd(), {});
}

export async function deletePm2Process(appId: string): Promise<void> {
  const name = pm2Name(appId);
  if (config.deployDryRun) return;
  await runCommand(`pm2 delete ${name} || true`, process.cwd(), {});
  await runCommand("pm2 save || true", process.cwd(), {});
}

export async function restartPm2Process(appId: string): Promise<void> {
  const name = pm2Name(appId);
  if (config.deployDryRun) return;
  await runCommand(`pm2 restart ${name}`, process.cwd(), {});
}

export { pm2Name };
