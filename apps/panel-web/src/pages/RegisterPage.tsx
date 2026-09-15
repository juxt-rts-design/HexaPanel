import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { PublicLayout } from "../components/PublicLayout";

const VISUAL =
  "https://images.pexels.com/photos/1181675/pexels-photo-1181675.jpeg?auto=compress&cs=tinysrgb&w=1400";

export function RegisterPage() {
  const { user, loading, register } = useAuth();
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
      await register(email, password);
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
            alt="Poste de travail développeur"
            width={1400}
            height={1600}
          />
          <p className="auth-visual__caption">
            Ton VPS, tes apps, un lien HTTPS en quelques minutes.
          </p>
        </div>
        <div className="auth-panel">
          <div className="auth-panel__inner">
            <h1>Inscription</h1>
            <p className="lead">
              Crée ton compte pour déployer sites et backends.
            </p>
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
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? "Création…" : "Créer mon compte"}
              </button>
            </form>
            <p className="muted" style={{ marginTop: "1.25rem" }}>
              Déjà inscrit ? <Link to="/login">Se connecter</Link>
            </p>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
