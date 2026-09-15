import { spawn } from "node:child_process";
import { config } from "../config.js";

export async function runCommand(
  command: string,
  cwd: string,
  env: Record<string, string>,
  onLine?: (line: string) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      env: { ...process.env, ...env },
      shell: true,
    });

    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Timeout après ${config.buildTimeoutMs}ms : ${command}`));
    }, config.buildTimeoutMs);

    child.stdout.on("data", (buf: Buffer) => {
      const text = buf.toString();
      text.split(/\r?\n/).filter(Boolean).forEach((l) => onLine?.(l));
    });
    child.stderr.on("data", (buf: Buffer) => {
      const text = buf.toString();
      stderr += text;
      text.split(/\r?\n/).filter(Boolean).forEach((l) => onLine?.(l));
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new Error(`Commande échouée (${code}): ${command}\n${stderr.slice(-2000)}`));
    });
  });
}
