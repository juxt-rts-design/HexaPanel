import type { AppSummary, PublicUser, SystemStats } from "@hexapanel/shared";

const TOKEN_KEY = "hexapanel_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (!token) localStorage.removeItem(TOKEN_KEY);
  else localStorage.setItem(TOKEN_KEY, token);
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(path, { ...options, headers });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Erreur ${res.status}`);
  }
  return data;
}

const SKIP_RE =
  /(^|\/)(node_modules|\.git|\.svn|\.hg|dist|build|\.next|coverage|\.turbo|__pycache__|\.venv|venv)(\/|$)/i;

export function filterProjectFiles(files: FileList | File[]): File[] {
  return Array.from(files).filter((f) => {
    const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
    return !SKIP_RE.test(rel.replace(/\\/g, "/"));
  });
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: PublicUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string) =>
    request<{ token: string; user: PublicUser }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<{ user: PublicUser }>("/api/auth/me"),
  systemStats: () => request<{ stats: SystemStats }>("/api/system/stats"),
  listApps: () => request<{ apps: AppSummary[] }>("/api/apps"),
  getApp: (id: string) =>
    request<{ app: AppSummary; env: Record<string, string> }>(`/api/apps/${id}`),
  createApp: (body: Record<string, unknown>) =>
    request<{ app: AppSummary }>("/api/apps", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  uploadZip: (id: string, file: File) => {
    const fd = new FormData();
    fd.append("archive", file);
    return request<{ ok: boolean }>(`/api/apps/${id}/upload`, {
      method: "POST",
      body: fd,
    });
  },
  uploadFolder: (id: string, files: File[]) => {
    const fd = new FormData();
    for (const file of files) {
      const rel =
        (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
        file.name;
      fd.append("files", file, rel);
    }
    return request<{ ok: boolean; files: number }>(`/api/apps/${id}/upload-folder`, {
      method: "POST",
      body: fd,
    });
  },
  deploy: (id: string) =>
    request<{ ok: boolean }>(`/api/apps/${id}/deploy`, { method: "POST" }),
  stop: (id: string) =>
    request<{ app: AppSummary }>(`/api/apps/${id}/stop`, { method: "POST" }),
  start: (id: string) =>
    request<{ app: AppSummary }>(`/api/apps/${id}/start`, { method: "POST" }),
  remove: (id: string) =>
    request<{ ok: boolean }>(`/api/apps/${id}`, { method: "DELETE" }),
  logs: (id: string) =>
    request<{ logs: { id: string; lines: string; createdAt: string }[] }>(
      `/api/apps/${id}/logs`,
    ),
  updateEnv: (id: string, env: Record<string, string>) =>
    request<{ app: AppSummary; env: Record<string, string> }>(
      `/api/apps/${id}/env`,
      {
        method: "PATCH",
        body: JSON.stringify({ env }),
      },
    ),
};
