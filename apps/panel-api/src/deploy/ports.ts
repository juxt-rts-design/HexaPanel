import { prisma } from "../db.js";
import { config } from "../config.js";

export async function allocatePort(appId: string): Promise<number> {
  for (let port = config.portRangeStart; port <= config.portRangeEnd; port++) {
    const taken = await prisma.portLease.findUnique({ where: { port } });
    if (taken) continue;
    try {
      await prisma.portLease.create({ data: { port, appId } });
      return port;
    } catch {
      continue;
    }
  }
  throw new Error("Aucun port libre dans la plage configurée");
}

export async function releasePort(appId: string): Promise<void> {
  await prisma.portLease.deleteMany({ where: { appId } });
}
