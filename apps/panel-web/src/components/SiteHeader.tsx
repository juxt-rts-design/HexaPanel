import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export function SiteHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function onLogout() {
    logout();
    navigate("/");
  }

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link to={user ? "/dashboard" : "/"} className="brand">
          Hexa<span>Panel</span>
        </Link>

        {!user && (
          <nav className="nav-links" aria-label="Navigation principale">
            <a href="/#fonctionnalites">Fonctionnalités</a>
            <a href="/#comment-ca-marche">Comment ça marche</a>
            <a href="/#langages">Langages</a>
          </nav>
        )}

        {user && (
          <nav className="nav-links" aria-label="Navigation app">
            <NavLink to="/dashboard">Tableau de bord</NavLink>
            <NavLink to="/apps/new">Déployer</NavLink>
          </nav>
        )}

        <div className="header-actions">
          {user ? (
            <>
              <span className="muted" style={{ fontSize: "0.9rem" }}>
                {user.email}
              </span>
              <button type="button" className="btn" onClick={onLogout}>
                Déconnexion
              </button>
            </>
          ) : (
            <>
              <Link className="btn btn-ghost" to="/login">
                Connexion
              </Link>
              <Link className="btn btn-primary" to="/register">
                Inscription
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
