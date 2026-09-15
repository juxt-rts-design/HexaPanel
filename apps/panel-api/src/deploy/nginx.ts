import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { config } from "../config.js";
import { runCommand } from "./shell.js";

function shQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

function confName(slug: string): string {
  return `hexapanel-${slug}`;
}

/** Publie un site static sous /var/www pour que nginx (www-data) puisse le lire. */
export async function publishStaticSite(
  slug: string,
  sourceRoot: string,
): Promise<string> {
  const dest = path.posix.join("/var/www/hexapanel", slug);
  if (config.deployDryRun) {
    return sourceRoot;
  }
  await runCommand(`sudo mkdir -p ${shQuote(dest)}`, process.cwd(), {});
  await runCommand(
    `sudo rsync -a --delete ${shQuote(sourceRoot + "/")} ${shQuote(dest + "/")}`,
    process.cwd(),
    {},
  );
  await runCommand(
    `sudo chown -R www-data:www-data ${shQuote(dest)}`,
    process.cwd(),
    {},
  );
  await runCommand(
    `sudo find ${shQuote(dest)} -type d -exec chmod 755 {} +; sudo find ${shQuote(dest)} -type f -exec chmod 644 {} +`,
    process.cwd(),
    {},
  );
  return dest;
}

export async function writeNginxConfig(opts: {
  slug: string;
  domain: string;
  runtime: string;
  port: number | null;
  staticRoot: string | null;
}): Promise<string> {
  const name = confName(opts.slug);
  const available = `/etc/nginx/sites-available/${name}`;
  const enabled = `/etc/nginx/sites-enabled/${name}`;

  let locationBlock: string;
  if (opts.runtime === "static" && opts.staticRoot) {
    locationBlock = `
    root ${opts.staticRoot};
    index index.html index.htm;
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
    const dryPath = path.join(dryDir, `${name}.conf`);
    await fs.writeFile(dryPath, content, "utf8");
    return dryPath;
  }

  const tmp = path.join(os.tmpdir(), `${name}.conf`);
  await fs.writeFile(tmp, content, "utf8");
  await runCommand(`sudo cp ${shQuote(tmp)} ${shQuote(available)}`, process.cwd(), {});
  await runCommand(`sudo ln -sfn ${shQuote(available)} ${shQuote(enabled)}`, process.cwd(), {});
  await runCommand("sudo nginx -t && sudo systemctl reload nginx", process.cwd(), {});
  await fs.rm(tmp, { force: true });
  return available;
}

export async function ensureHttps(domain: string): Promise<void> {
  if (config.deployDryRun) return;
  await runCommand(
    `sudo certbot --nginx --agree-tos --register-unsafely-without-email -d ${shQuote(domain)} --non-interactive --redirect`,
    process.cwd(),
    {},
  );
  await runCommand("sudo nginx -t && sudo systemctl reload nginx", process.cwd(), {});
}

/** Désactive le vhost (Stop) — le site ne répond plus. */
export async function disableNginxSite(slug: string): Promise<void> {
  if (config.deployDryRun) return;
  const name = confName(slug);
  await runCommand(
    `sudo rm -f /etc/nginx/sites-enabled/${name} && sudo nginx -t && sudo systemctl reload nginx || true`,
    process.cwd(),
    {},
  );
}

/** Réactive le vhost (Start). */
export async function enableNginxSite(slug: string): Promise<void> {
  if (config.deployDryRun) return;
  const name = confName(slug);
  await runCommand(
    `sudo ln -sfn /etc/nginx/sites-available/${name} /etc/nginx/sites-enabled/${name} && sudo nginx -t && sudo systemctl reload nginx || true`,
    process.cwd(),
    {},
  );
}

/** Supprime nginx + fichiers publiés + certificat Let's Encrypt. */
export async function removeNginxConfig(
  slug: string,
  domain?: string | null,
): Promise<void> {
  const name = confName(slug);
  if (config.deployDryRun) {
    const dryPath = path.join(config.appsRoot, ".nginx-dry", `${name}.conf`);
    await fs.rm(dryPath, { force: true });
    return;
  }

  await runCommand(
    `sudo rm -f /etc/nginx/sites-enabled/${name} /etc/nginx/sites-available/${name}`,
    process.cwd(),
    {},
  );
  await runCommand(
    `sudo rm -rf /var/www/hexapanel/${slug}`,
    process.cwd(),
    {},
  );

  if (domain) {
    await runCommand(
      `sudo certbot delete --cert-name ${shQuote(domain)} --non-interactive || true`,
      process.cwd(),
      {},
    );
  }

  await runCommand(
    "sudo nginx -t && sudo systemctl reload nginx || true",
    process.cwd(),
    {},
  );
}
