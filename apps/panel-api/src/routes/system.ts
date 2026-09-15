import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Router } from "express";
import type { SystemStats } from "@hexapanel/shared";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { prisma } from "../db.js";
import { config } from "../config.js";

const execFileAsync = promisify(execFile);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function cpuTimes() {
  return os.cpus().map((c) => {
    const t = c.times;
    return {
      idle: t.idle,
      total: t.user + t.nice + t.sys + t.idle + t.irq,
    };
  });
}

async function cpuUsagePercent(): Promise<number> {
  const a = cpuTimes();
  await sleep(250);
  const b = cpuTimes();
  let idle = 0;
  let total = 0;
  for (let i = 0; i < a.length; i++) {
    idle += b[i].idle - a[i].idle;
    total += b[i].total - a[i].total;
  }
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (1 - idle / total) * 100));
}

async function diskStats(mount = "/"): Promise<SystemStats["disk"]> {
  try {
    const { stdout } = await execFileAsync("df", ["-B1", "--output=size,used,avail,target", mount]);
    const line = stdout.trim().split("\n").pop() ?? "";
    const parts = line.trim().split(/\s+/);
    const totalBytes = Number(parts[0]) || 0;
    const usedBytes = Number(parts[1]) || 0;
    const freeBytes = Number(parts[2]) || 0;
    return {
      totalBytes,
      usedBytes,
      freeBytes,
      usagePercent: totalBytes ? (usedBytes / totalBytes) * 100 : 0,
      mount: parts[3] || mount,
    };
  } catch {
    return {
      totalBytes: 0,
      usedBytes: 0,
      freeBytes: 0,
      usagePercent: 0,
      mount,
    };
  }
}

export const systemRouter = Router();
systemRouter.use(requireAuth);

systemRouter.get("/stats", async (_req: AuthedRequest, res) => {
  const [usagePercent, disk, apps] = await Promise.all([
    cpuUsagePercent(),
    diskStats("/"),
    prisma.app.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const counts = {
    total: 0,
    running: 0,
    building: 0,
    stopped: 0,
    error: 0,
  };
  for (const row of apps) {
    const n = row._count._all;
    counts.total += n;
    if (row.status === "running") counts.running += n;
    else if (row.status === "building" || row.status === "pending")
      counts.building += n;
    else if (row.status === "stopped") counts.stopped += n;
    else if (row.status === "error") counts.error += n;
  }

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const cpus = os.cpus();
  const load = os.loadavg() as [number, number, number];

  const stats: SystemStats = {
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()}`,
    arch: os.arch(),
    uptimeSec: Math.floor(os.uptime()),
    cpu: {
      model: cpus[0]?.model?.trim() || "CPU",
      cores: cpus.length,
      usagePercent: Number(usagePercent.toFixed(1)),
      loadAvg: [
        Number(load[0].toFixed(2)),
        Number(load[1].toFixed(2)),
        Number(load[2].toFixed(2)),
      ],
    },
    memory: {
      totalBytes: totalMem,
      usedBytes: usedMem,
      freeBytes: freeMem,
      usagePercent: Number(((usedMem / totalMem) * 100).toFixed(1)),
    },
    disk,
    apps: counts,
    network: { vpsIp: config.vpsIp },
    sampledAt: new Date().toISOString(),
  };

  stats.disk.usagePercent = Number(stats.disk.usagePercent.toFixed(1));
  res.json({ stats });
});
