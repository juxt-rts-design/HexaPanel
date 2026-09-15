import { Link } from "react-router-dom";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__grid">
          <div>
            <Link to="/" className="brand">
              Hexa<span>Panel</span>
            </Link>
            <p style={{ margin: 0, maxWidth: "34ch" }}>
              Héberge sites, apps et backends sur ton VPS avec HTTPS automatique
              en .sslip.io.
            </p>
          </div>
          <div>
            <h4>Produit</h4>
            <ul>
              <li>
                <a href="/#fonctionnalites">Fonctionnalités</a>
              </li>
              <li>
                <a href="/#comment-ca-marche">Déploiement</a>
              </li>
              <li>
                <Link to="/register">Créer un compte</Link>
              </li>
            </ul>
          </div>
          <div>
            <h4>Compte</h4>
            <ul>
              <li>
                <Link to="/login">Connexion</Link>
              </li>
              <li>
                <Link to="/dashboard">Dashboard</Link>
              </li>
              <li>
                <a href="https://sslip.io" target="_blank" rel="noreferrer">
                  sslip.io
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="site-footer__bottom">
          <span>© {new Date().getFullYear()} HexaPanel</span>
          <span>PM2 · nginx · Let’s Encrypt</span>
        </div>
      </div>
    </footer>
  );
}
