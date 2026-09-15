import { Link } from "react-router-dom";
import { PublicLayout } from "../components/PublicLayout";

const HERO =
  "https://images.pexels.com/photos/1148820/pexels-photo-1148820.jpeg?auto=compress&cs=tinysrgb&w=1800";
const IMG_DEPLOY =
  "https://images.unsplash.com/photo-1597852074816-d933c7d2b988?w=1400&q=80";
const IMG_CODE =
  "https://images.pexels.com/photos/1181675/pexels-photo-1181675.jpeg?auto=compress&cs=tinysrgb&w=1400";

export function LandingPage() {
  return (
    <PublicLayout>
      <section className="hero" aria-label="HexaPanel">
        <div className="hero__media">
          <img
            src={HERO}
            alt="Infrastructure serveur moderne"
            width={2000}
            height={1200}
          />
        </div>
        <div className="hero__veil" />
        <div className="hero__content">
          <h1 className="hero__brand">HexaPanel</h1>
          <p className="hero__lead">
            Déploie n’importe quel site ou backend sur ton VPS, HTTPS inclus.
          </p>
          <div className="btn-row hero__cta">
            <Link className="btn btn-primary" to="/register">
              Commencer
            </Link>
            <Link className="btn" to="/login">
              Se connecter
            </Link>
          </div>
        </div>
      </section>

      <section className="section" id="fonctionnalites">
        <div className="section-inner split">
          <div className="split-copy">
            <p className="section-kicker">Fonctionnalités</p>
            <h2 className="section-title">Un panneau clair pour ton VPS</h2>
            <p className="section-text">
              Colle un lien GitHub ou envoie un ZIP. HexaPanel clone, build,
              démarre PM2, configure nginx et délivre un certificat Let’s Encrypt
              sur un sous-domaine .sslip.io.
            </p>
          </div>
          <div className="split-media">
            <img
              src={IMG_DEPLOY}
              alt="Circuit et déploiement logiciel"
              width={1400}
              height={900}
              loading="lazy"
            />
          </div>
        </div>
      </section>

      <section className="section section--alt" id="comment-ca-marche">
        <div className="section-inner">
          <p className="section-kicker">Comment ça marche</p>
          <h2 className="section-title">Trois étapes, zéro friction</h2>
          <p className="section-text">
            Du dépôt à l’URL HTTPS, le flux reste simple et contrôlé.
          </p>
          <div className="steps">
            <div className="step">
              <div className="step-num">01</div>
              <div>
                <h3>Importe ton projet</h3>
                <p>HTTPS GitHub ou archive ZIP depuis ta machine.</p>
              </div>
            </div>
            <div className="step">
              <div className="step-num">02</div>
              <div>
                <h3>Build & runtime</h3>
                <p>Static, Node, Python ou PHP — détectés ou choisis à la main.</p>
              </div>
            </div>
            <div className="step">
              <div className="step-num">03</div>
              <div>
                <h3>Lien HTTPS</h3>
                <p>
                  `slug.IP.sslip.io` avec nginx + certbot, prêt à partager.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="langages">
        <div className="section-inner split split--reverse">
          <div className="split-copy">
            <p className="section-kicker">Langages</p>
            <h2 className="section-title">Sites, apps et APIs</h2>
            <p className="section-text">
              Front static, API Express/FastAPI, PHP simple — chaque compte gère
              ses propres apps, avec logs et variables d’environnement.
            </p>
          </div>
          <div className="split-media">
            <img
              src={IMG_CODE}
              alt="Écran de code en développement"
              width={1400}
              height={900}
              loading="lazy"
            />
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div className="section-inner">
          <h2 className="section-title">Prêt à héberger sur ton VPS ?</h2>
          <p className="section-text">
            Crée un compte, déploie ta première app, récupère ton lien HTTPS.
          </p>
          <div className="btn-row">
            <Link className="btn btn-primary" to="/register">
              Créer un compte
            </Link>
            <Link className="btn" to="/login" style={{ color: "#f4f7f8", borderColor: "rgba(244,247,248,0.35)" }}>
              J’ai déjà un compte
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
