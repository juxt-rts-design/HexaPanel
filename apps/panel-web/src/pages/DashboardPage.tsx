import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { AppSummary, SystemStats } from "@hexapanel/shared";
import { formatBytes } from "@hexapanel/shared";
import { api } from "../api";
import { AppLayout } from "../components/AppLayout";
import { useAuth } from "../auth";

const GALLERY = [
  {
    src: "https://images.pexels.com/photos/325229/pexels-photo-325229.jpeg?auto=compress&cs=tinysrgb&w=1200",
    caption: "Infrastructure serveur",
  },
  {
    src: "https://images.unsplash.com/photo-1597852074816-d933c7d2b988?w=900&q=80",
    caption: "Baies & réseau",
  },
  {
    src: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=900&q=80",
    caption: "Cloud & orbite data",
  },
];

function meterClass(pct: number): string {
  if (pct >= 90) return "meter danger";
  if (pct >= 75) return "meter warn";
  return "meter";
}

function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}j ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function DashboardPage() {
  const { user } = useAuth();
  const [apps, setApps] = useState<AppSummary[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const [a, s] = await Promise.all([api.listApps(), api.systemStats()]);
      setApps(a.apps);
      setStats(s.stats);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <AppLayout>
      <div className="page-head">
        <div>
          <h1>Tableau de bord</h1>
          <p className="muted" style={{ margin: "0.4rem 0 0" }}>
            Bienvenue{user ? `, ${user.email.split("@")[0]}` : ""} — ressources
            machine et apps en temps réel.
          </p>
        </div>
        <Link className="btn btn-primary" to="/apps/new">
          Nouvelle app
        </Link>
      </div>

      <div className="dash-gallery">
        {GALLERY.map((g) => (
          <figure key={g.src}>
            <img src={g.src} alt={g.caption} loading="lazy" />
            <figcaption>{g.caption}</figcaption>
          </figure>
        ))}
      </div>

      {error && <div className="error-box">{error}</div>}

      {stats && (
        <>
          <div className="metrics-grid">
            <div className="metric-card">
              <h3>CPU</h3>
              <div className="metric-value">{stats.cpu.usagePercent}%</div>
              <div className="metric-sub">
                {stats.cpu.cores} cœurs · load {stats.cpu.loadAvg.join(" / ")}
              </div>
              <div className={meterClass(stats.cpu.usagePercent)}>
                <span style={{ width: `${Math.min(100, stats.cpu.usagePercent)}%` }} />
              </div>
            </div>
            <div className="metric-card">
              <h3>RAM</h3>
              <div className="metric-value">{stats.memory.usagePercent}%</div>
              <div className="metric-sub">
                {formatBytes(stats.memory.usedBytes)} /{" "}
                {formatBytes(stats.memory.totalBytes)} · libre{" "}
                {formatBytes(stats.memory.freeBytes)}
              </div>
              <div className={meterClass(stats.memory.usagePercent)}>
                <span
                  style={{ width: `${Math.min(100, stats.memory.usagePercent)}%` }}
                />
              </div>
            </div>
            <div className="metric-card">
              <h3>Disque</h3>
              <div className="metric-value">{stats.disk.usagePercent}%</div>
              <div className="metric-sub">
                {formatBytes(stats.disk.usedBytes)} /{" "}
                {formatBytes(stats.disk.totalBytes)} · libre{" "}
                {formatBytes(stats.disk.freeBytes)}
              </div>
              <div className={meterClass(stats.disk.usagePercent)}>
                <span
                  style={{ width: `${Math.min(100, stats.disk.usagePercent)}%` }}
                />
              </div>
            </div>
            <div className="metric-card">
              <h3>Apps</h3>
              <div className="metric-value">{stats.apps.running}</div>
              <div className="metric-sub">
                {stats.apps.total} total · {stats.apps.building} build ·{" "}
                {stats.apps.error} erreur
              </div>
              <div className="meter">
                <span
                  style={{
                    width: `${
                      stats.apps.total
                        ? Math.min(
                            100,
                            (stats.apps.running / stats.apps.total) * 100,
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="sys-panel">
            <div className="sys-box">
              <h2>Composition machine</h2>
              <div className="sys-kv">
                <div>
                  <span>Hôte</span>
                  <span>{stats.hostname}</span>
                </div>
                <div>
                  <span>OS</span>
                  <span>{stats.platform}</span>
                </div>
                <div>
                  <span>Arch</span>
                  <span>{stats.arch}</span>
                </div>
                <div>
                  <span>Processeur</span>
                  <span style={{ textAlign: "right", maxWidth: "55%" }}>
                    {stats.cpu.model}
                  </span>
                </div>
                <div>
                  <span>Uptime</span>
                  <span>{formatUptime(stats.uptimeSec)}</span>
                </div>
                <div>
                  <span>IP panel</span>
                  <span>{stats.network.vpsIp}</span>
                </div>
              </div>
            </div>
            <div className="sys-box">
              <h2>Capacité restante</h2>
              <div className="sys-kv">
                <div>
                  <span>RAM libre</span>
                  <span>{formatBytes(stats.memory.freeBytes)}</span>
                </div>
                <div>
                  <span>Disque libre</span>
                  <span>{formatBytes(stats.disk.freeBytes)}</span>
                </div>
                <div>
                  <span>Load 1 / 5 / 15</span>
                  <span>{stats.cpu.loadAvg.join(" · ")}</span>
                </div>
                <div>
                  <span>Apps stoppées</span>
                  <span>{stats.apps.stopped}</span>
                </div>
                <div>
                  <span>Échantillon</span>
                  <span>
                    {new Date(stats.sampledAt).toLocaleTimeString("fr-FR")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="page-head" style={{ marginBottom: "1rem" }}>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.35rem",
            fontWeight: 600,
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          Applications
        </h2>
      </div>

      {apps.length === 0 ? (
        <div className="empty-state">
          <h3>Aucune app pour l’instant</h3>
          <p className="muted">
            Déploie depuis GitHub, un ZIP, ou un dossier local de ta machine.
          </p>
          <Link className="btn btn-primary" to="/apps/new">
            Déployer maintenant
          </Link>
        </div>
      ) : (
        <div className="list">
          {apps.map((app) => (
            <div className="list-row" key={app.id}>
              <div>
                <Link to={`/apps/${app.id}`}>{app.name}</Link>
                <div className="muted" style={{ fontSize: "0.85rem" }}>
                  {app.slug}
                  {app.ownerEmail ? ` · ${app.ownerEmail}` : ""}
                </div>
              </div>
              <div>
                <span className={`status ${app.status}`}>{app.status}</span>
                <div className="muted" style={{ fontSize: "0.85rem" }}>
                  {app.runtime}
                </div>
              </div>
              <div className="btn-row">
                {app.status === "running" && (
                  <a
                    className="btn"
                    href={app.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ouvrir
                  </a>
                )}
                <Link className="btn" to={`/apps/${app.id}`}>
                  Détail
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
