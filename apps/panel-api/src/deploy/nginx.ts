import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { config } from "../config.js";
import { runCommand } from "./shell.js";

export async function writeNginxConfig(opts: {
  slug: string;
  domain: string;
  runtime: string;
  port: number | null;
  staticRoot: string | null;
}): Promise<string> {
  const confName = `hexapanel-${opts.slug}`;
  const available = `/etc/nginx/sites-available/${confName}`;
  const enabled = `/etc/nginx/sites-enabled/${confName}`;

  let locationBlock: string;
  if (opts.runtime === "static" && opts.staticRoot) {
    locationBlock = `
    root ${opts.staticRoot};
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }`;
  } else {
    locationBlock = `
    location / {
        proxy_pass http://127.0.0.1:${opts.port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }`;
  }

  const content = `server {
    listen 80;
    listen [::]:80;
    server_name ${opts.domain};
    client_max_body_size 50m;
${locationBlock}
}
`;

  if (config.deployDryRun) {
    const dryDir = path.join(config.appsRoot, ".nginx-dry");
    await fs.mkdir(dryDir, { recursive: true });
    const dryPath = path.join(dryDir, `${confName}.conf`);
    await fs.writeFile(dryPath, content, "utf8");
    return dryPath;
  }

  const tmp = path.join(os.tmpdir(), `${confName}.conf`);
  await fs.writeFile(tmp, content, "utf8");
  await runCommand(`sudo cp ${tmp} ${available}`, process.cwd(), {});
  await runCommand(`sudo ln -sfn ${available} ${enabled}`, process.cwd(), {});
  await runCommand("sudo nginx -t && sudo systemctl reload nginx", process.cwd(), {});
  await fs.rm(tmp, { force: true });
  return available;
}

export async function ensureHttps(domain: string): Promise<void> {
  if (config.deployDryRun) return;
  await runCommand(
    `sudo certbot --nginx --agree-tos --register-unsafely-without-email -d ${domain} --non-interactive --redirect`,
    process.cwd(),
    {},
  );
  await runCommand("sudo nginx -t && sudo systemctl reload nginx", process.cwd(), {});
}

export async function removeNginxConfig(slug: string): Promise<void> {
  const confName = `hexapanel-${slug}`;
  if (config.deployDryRun) {
    const dryPath = path.join(config.appsRoot, ".nginx-dry", `${confName}.conf`);
    await fs.rm(dryPath, { force: true });
    return;
  }
  await runCommand(
    `sudo rm -f /etc/nginx/sites-enabled/${confName} /etc/nginx/sites-available/${confName} && sudo nginx -t && sudo systemctl reload nginx || true`,
    process.cwd(),
    {},
  );
}
