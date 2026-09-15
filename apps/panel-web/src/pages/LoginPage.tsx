import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { PublicLayout } from "../components/PublicLayout";

const VISUAL =
  "https://images.pexels.com/photos/2582937/pexels-photo-2582937.jpeg?auto=compress&cs=tinysrgb&w=1400";

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicLayout>
      <div className="auth-layout">
        <div className="auth-visual">
          <img
            src={VISUAL}
            alt="Baies de serveurs illuminées"
            width={1400}
            height={1600}
          />
          <p className="auth-visual__caption">
            Reprends le contrôle de tes déploiements.
          </p>
        </div>
        <div className="auth-panel">
          <div className="auth-panel__inner">
            <h1>Connexion</h1>
            <p className="lead">Accède à tes apps hébergées sur HexaPanel.</p>
            {error && <div className="error-box">{error}</div>}
            <form onSubmit={onSubmit}>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="password">Mot de passe</label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? "Connexion…" : "Se connecter"}
              </button>
            </form>
            <p className="muted" style={{ marginTop: "1.25rem" }}>
              Pas encore de compte ? <Link to="/register">S’inscrire</Link>
            </p>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
