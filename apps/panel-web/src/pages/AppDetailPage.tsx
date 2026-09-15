import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { AppSummary } from "@hexapanel/shared";
import { api } from "../api";
import { AppLayout } from "../components/AppLayout";

export function AppDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [app, setApp] = useState<AppSummary | null>(null);
  const [envText, setEnvText] = useState("");
  const [logs, setLogs] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    if (!id) return;
    try {
      const [a, l] = await Promise.all([api.getApp(id), api.logs(id)]);
      setApp(a.app);
      setEnvText(
        Object.entries(a.env)
          .map(([k, v]) => `${k}=${v}`)
          .join("\n"),
      );
      setLogs(l.logs.map((x) => x.lines).join("\n"));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 3000);
    return () => clearInterval(t);
  }, [id]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function saveEnv(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    const env: Record<string, string> = {};
    for (const line of envText.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const i = trimmed.indexOf("=");
      if (i <= 0) continue;
      env[trimmed.slice(0, i)] = trimmed.slice(i + 1);
    }
    await run(() => api.updateEnv(id, env));
  }

  return (
    <AppLayout>
      <div className="page-head">
        <div>
          <h1>{app?.name ?? "App"}</h1>
          <p className="muted" style={{ margin: "0.4rem 0 0" }}>
            {app?.domain ?? "Chargement…"}
          </p>
        </div>
        <Link className="btn" to="/dashboard">
          Retour
        </Link>
      </div>

      {error && <div className="error-box">{error}</div>}

      {!app ? (
        <p className="muted">Chargement…</p>
      ) : (
        <>
          <div className="btn-row" style={{ marginBottom: "1.5rem" }}>
            <span className={`status ${app.status}`}>{app.status}</span>
            <span className="muted">{app.runtime}</span>
            {app.port ? <span className="muted">port {app.port}</span> : null}
            {app.status === "running" && (
              <a
                className="btn btn-primary"
                href={app.url}
                target="_blank"
                rel="noreferrer"
              >
                Ouvrir HTTPS
              </a>
            )}
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => void run(() => api.deploy(app.id))}
            >
              Redéployer
            </button>
            {app.status === "running" ? (
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => void run(() => api.stop(app.id))}
              >
                Stop
              </button>
            ) : (
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => void run(() => api.start(app.id))}
              >
                Start
              </button>
            )}
            <button
              type="button"
              className="btn btn-danger"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  if (!confirm("Supprimer cette app ?")) return;
                  await api.remove(app.id);
                  navigate("/dashboard");
                })
              }
            >
              Supprimer
            </button>
          </div>

          {app.lastError && (
            <div className="error-box" style={{ marginBottom: "1.5rem" }}>
              {app.lastError}
            </div>
          )}

          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 400,
              fontSize: "1.8rem",
              margin: "0 0 0.75rem",
            }}
          >
            Logs
          </h2>
          <div className="logs">{logs || "Aucun log pour le moment."}</div>

          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 400,
              fontSize: "1.8rem",
              margin: "2rem 0 0.75rem",
            }}
          >
            Variables d’environnement
          </h2>
          <form onSubmit={saveEnv} className="form-panel">
            <div className="field">
              <label htmlFor="env">Une par ligne : KEY=value</label>
              <textarea
                id="env"
                rows={8}
                value={envText}
                onChange={(e) => setEnvText(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              Enregistrer env
            </button>
            <p className="muted" style={{ fontSize: "0.85rem" }}>
              Redéploie ensuite pour appliquer.
            </p>
          </form>
        </>
      )}
    </AppLayout>
  );
}
