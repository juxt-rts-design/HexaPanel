import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, filterProjectFiles } from "../api";
import { AppLayout } from "../components/AppLayout";

type SourceTab = "github" | "upload" | "folder";

export function NewAppPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<SourceTab>("github");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [folderFiles, setFolderFiles] = useState<File[]>([]);
  const [folderLabel, setFolderLabel] = useState("");
  const [runtime, setRuntime] = useState("auto");
  const [buildCommand, setBuildCommand] = useState("");
  const [startCommand, setStartCommand] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function onName(v: string) {
    setName(v);
    if (!slug || slug === slugify(name)) setSlug(slugify(v));
  }

  function onFolderPick(list: FileList | null) {
    if (!list?.length) {
      setFolderFiles([]);
      setFolderLabel("");
      return;
    }
    const filtered = filterProjectFiles(list);
    setFolderFiles(filtered);
    const first = filtered[0] as File & { webkitRelativePath?: string };
    const top = first?.webkitRelativePath?.split("/")[0] || "dossier";
    setFolderLabel(`${top} · ${filtered.length} fichiers`);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name,
        slug,
        sourceType: tab === "folder" ? "folder" : tab,
        sourceUrl: tab === "github" ? sourceUrl : null,
        buildCommand: buildCommand || null,
        startCommand: startCommand || null,
      };
      if (runtime !== "auto") body.runtime = runtime;

      const { app } = await api.createApp(body);
      if (tab === "upload") {
        if (!file) throw new Error("Choisis un fichier ZIP");
        await api.uploadZip(app.id, file);
      } else if (tab === "folder") {
        if (!folderFiles.length) throw new Error("Choisis un dossier projet");
        await api.uploadFolder(app.id, folderFiles);
      }
      navigate(`/apps/${app.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppLayout>
      <div className="page-head">
        <div>
          <h1>Nouvelle app</h1>
          <p className="muted" style={{ margin: "0.4rem 0 0" }}>
            GitHub, ZIP, ou dossier local pour tester un projet de ta machine.
          </p>
        </div>
        <Link className="btn" to="/dashboard">
          Retour
        </Link>
      </div>

      <div className="form-panel">
        <div className="tabs">
          <button
            type="button"
            className={`tab ${tab === "github" ? "active" : ""}`}
            onClick={() => setTab("github")}
          >
            GitHub
          </button>
          <button
            type="button"
            className={`tab ${tab === "upload" ? "active" : ""}`}
            onClick={() => setTab("upload")}
          >
            ZIP
          </button>
          <button
            type="button"
            className={`tab ${tab === "folder" ? "active" : ""}`}
            onClick={() => setTab("folder")}
          >
            Dossier local
          </button>
        </div>

        {error && <div className="error-box">{error}</div>}

        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="name">Nom</label>
            <input
              id="name"
              value={name}
              onChange={(e) => onName(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="slug">Slug (sous-domaine)</label>
            <input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              pattern="^[a-z0-9]([a-z0-9-]{0,46}[a-z0-9])?$"
              required
            />
          </div>

          {tab === "github" && (
            <div className="field">
              <label htmlFor="url">Lien HTTPS GitHub</label>
              <input
                id="url"
                type="url"
                placeholder="https://github.com/org/repo.git"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                required
              />
            </div>
          )}

          {tab === "upload" && (
            <div className="field">
              <label htmlFor="zip">Archive ZIP</label>
              <input
                id="zip"
                type="file"
                accept=".zip,application/zip"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
              />
            </div>
          )}

          {tab === "folder" && (
            <div className="field">
              <label htmlFor="folder">Dossier du projet (dev local)</label>
              <input
                id="folder"
                type="file"
                // @ts-expect-error webkitdirectory non standard mais supporté
                webkitdirectory=""
                directory=""
                multiple
                onChange={(e) => onFolderPick(e.target.files)}
                required
              />
              {folderLabel && (
                <span className="muted" style={{ fontSize: "0.85rem" }}>
                  {folderLabel} (node_modules / .git exclus)
                </span>
              )}
            </div>
          )}

          <div className="field">
            <label htmlFor="runtime">Runtime</label>
            <select
              id="runtime"
              value={runtime}
              onChange={(e) => setRuntime(e.target.value)}
            >
              <option value="auto">Auto-détecter</option>
              <option value="static">Static</option>
              <option value="node">Node</option>
              <option value="python">Python</option>
              <option value="php">PHP</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="build">Build command (optionnel)</label>
            <input
              id="build"
              value={buildCommand}
              onChange={(e) => setBuildCommand(e.target.value)}
              placeholder="npm run build"
            />
          </div>
          <div className="field">
            <label htmlFor="start">Start command (optionnel, $PORT)</label>
            <input
              id="start"
              value={startCommand}
              onChange={(e) => setStartCommand(e.target.value)}
              placeholder="npm start"
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Déploiement…" : "Déployer"}
          </button>
        </form>
      </div>
    </AppLayout>
  );
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
