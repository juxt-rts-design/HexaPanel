import fs from "node:fs";
import path from "node:path";
import type { AppRuntime } from "@hexapanel/shared";

export interface DetectResult {
  runtime: AppRuntime;
  buildCommand: string | null;
  startCommand: string | null;
  staticRoot: string | null;
}

function exists(p: string): boolean {
  return fs.existsSync(p);
}

function readJson<T>(p: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as T;
  } catch {
    return null;
  }
}

export function detectRuntime(root: string): DetectResult {
  const pkgPath = path.join(root, "package.json");
  if (exists(pkgPath)) {
    const pkg = readJson<{
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    }>(pkgPath);

    const scripts = pkg?.scripts ?? {};
    const deps = {
      ...(pkg?.dependencies ?? {}),
      ...(pkg?.devDependencies ?? {}),
    };

    const hasBuild = Boolean(scripts.build);
    const hasStart = Boolean(scripts.start);
    const looksFrontend =
      "vite" in deps ||
      "react" in deps ||
      "next" in deps ||
      "vue" in deps ||
      "nuxt" in deps;

    if (hasStart) {
      return {
        runtime: "node",
        buildCommand: hasBuild ? "npm run build" : null,
        startCommand: "npm start",
        staticRoot: null,
      };
    }

    if (hasBuild && looksFrontend) {
      const distCandidates = ["dist", "build", "out", "public"];
      return {
        runtime: "static",
        buildCommand: "npm run build",
        startCommand: null,
        staticRoot: distCandidates[0],
      };
    }

    if (hasBuild) {
      return {
        runtime: "node",
        buildCommand: "npm run build",
        startCommand: scripts.start ? "npm start" : "node .",
        staticRoot: null,
      };
    }

    return {
      runtime: "node",
      buildCommand: null,
      startCommand: "npm start",
      staticRoot: null,
    };
  }

  const hasPython =
    exists(path.join(root, "requirements.txt")) ||
    exists(path.join(root, "pyproject.toml")) ||
    exists(path.join(root, "main.py")) ||
    exists(path.join(root, "app.py"));

  if (hasPython) {
    let startCommand = "python3 app.py";
    if (exists(path.join(root, "main.py"))) {
      startCommand =
        "python3 -m uvicorn main:app --host 127.0.0.1 --port $PORT";
    } else if (exists(path.join(root, "app.py"))) {
      const content = fs.readFileSync(path.join(root, "app.py"), "utf8");
      if (content.includes("FastAPI") || content.includes("uvicorn")) {
        startCommand =
          "python3 -m uvicorn app:app --host 127.0.0.1 --port $PORT";
      } else if (content.includes("Flask") || content.includes("flask")) {
        startCommand = "python3 -m flask --app app run --host 127.0.0.1 --port $PORT";
      }
    }
    return {
      runtime: "python",
      buildCommand: exists(path.join(root, "requirements.txt"))
        ? "python3 -m pip install -r requirements.txt"
        : null,
      startCommand,
      staticRoot: null,
    };
  }

  if (
    exists(path.join(root, "index.php")) ||
    exists(path.join(root, "composer.json")) ||
    exists(path.join(root, "public", "index.php"))
  ) {
    const docroot = exists(path.join(root, "public", "index.php"))
      ? "public"
      : ".";
    return {
      runtime: "php",
      buildCommand: exists(path.join(root, "composer.json"))
        ? "composer install --no-dev --optimize-autoloader"
        : null,
      startCommand: `php -S 127.0.0.1:$PORT -t ${docroot}`,
      staticRoot: null,
    };
  }

  if (exists(path.join(root, "index.html"))) {
    return {
      runtime: "static",
      buildCommand: null,
      startCommand: null,
      staticRoot: ".",
    };
  }

  return {
    runtime: "static",
    buildCommand: null,
    startCommand: null,
    staticRoot: ".",
  };
}

export function resolveStaticRoot(
  root: string,
  preferred: string | null,
): string {
  const candidates = preferred
    ? [preferred, "dist", "build", "out", "public", "."]
    : ["dist", "build", "out", "public", "."];

  for (const c of candidates) {
    const full = path.join(root, c);
    if (exists(path.join(full, "index.html")) || (c === "." && exists(path.join(root, "index.html")))) {
      return path.resolve(full);
    }
  }
  return path.resolve(root);
}
