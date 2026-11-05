import Link from "next/link";

const modules = [
  {
    number: "01",
    name: "Products",
    description: "Keep inventory and product information in one place.",
    className: "product",
  },
  {
    number: "02",
    name: "People",
    description: "Bring your team and people operations together.",
    className: "people",
  },
  {
    number: "03",
    name: "Sales",
    description: "See your sales activity and business performance.",
    className: "sales",
  },
  {
    number: "04",
    name: "Customers",
    description: "Keep customer relationships organized and accessible.",
    className: "customers",
  },
];

export default function HomePage() {
  return (
    <>
      <header className="site-header">
        <div className="container header-inner">
          <Link className="brand" href="/" aria-label="Hope, Inc. home">
            <span className="brand-mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span>
              hope<span className="brand-period">.</span>
            </span>
          </Link>
          <nav className="main-nav" aria-label="Main navigation">
            <a href="#modules">Modules</a>
            <a href="#about">About</a>
          </nav>
          <div className="header-actions">
            <Link className="login-link" href="/login">
              Log in
            </Link>
            <Link className="button button-dark button-small" href="/register">
              Get started <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="container hero" id="about">
          <div className="hero-copy">
            <span className="announcement">
              <i className="announcement-dot" />
              A clearer way to run your business
            </span>
            <h1>
              Good work,
              <br />
              <span>in sync.</span>
            </h1>
            <p className="hero-description">
              Bring your customers, products, people, and sales together in one
              calm, connected workspace.
            </p>
            <div className="hero-actions">
              <Link className="button button-dark" href="/register">
                Get started <span aria-hidden="true">↗</span>
              </Link>
              <Link className="text-link" href="/login">
                I already have an account <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="preview">
              <div className="preview-topbar">
                <span className="brand">
                  <span className="brand-mark">
                    <span />
                    <span />
                    <span />
                  </span>
                  <span>
                    hope<span className="brand-period">.</span>
                  </span>
                </span>
                <span className="preview-date">Your business overview</span>
              </div>
              <div className="preview-body">
                <div className="preview-sidebar">
                  <span className="sidebar-active" />
                  <span />
                  <span />
                  <span />
                </div>
                <div className="preview-content">
                  <div className="preview-heading">
                    <div>
                      <p className="eyebrow">YOUR WORKSPACE</p>
                      <h2>Everything, together.</h2>
                      <p>A little more clarity for your workday.</p>
                    </div>
                  </div>
                  <div className="preview-modules">
                    <span>
                      <i className="dot dot-product" /> Products
                    </span>
                    <span>
                      <i className="dot dot-people" /> People
                    </span>
                    <span>
                      <i className="dot dot-sales" /> Sales
                    </span>
                    <span>
                      <i className="dot dot-customer" /> Customers
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="floating-note note-top">
              <span className="note-check" aria-hidden="true">
                ✓
              </span>
              <span>
                <strong>One connected workspace</strong>
                <small>Your work, all in one place</small>
              </span>
            </div>
          </div>
        </section>

        <section className="trust-strip">
          <div className="container trust-inner">
            <span>MADE FOR TEAMS THAT DO GOOD WORK</span>
            <div>
              <i className="trust-star" aria-hidden="true">
                ✳
              </i>
              Less scattered. More in sync.
            </div>
          </div>
        </section>

        <section className="container modules-section" id="modules">
          <div className="section-heading">
            <h2>
              The pieces of work,
              <br />
              <em>working together.</em>
            </h2>
            <p>
              A shared home for the everyday parts of your business, designed
              to help your team move forward together.
            </p>
          </div>
          <div className="module-grid">
            {modules.map((module) => (
              <article
                className={`module-card ${module.className}`}
                key={module.number}
              >
                <div className="module-card-top">
                  <span>{module.number} / 04</span>
                  <span className="module-icon" aria-hidden="true">
                    ✳
                  </span>
                </div>
                <h3>{module.name}</h3>
                <p>{module.description}</p>
                <Link href="/register">
                  Explore workspace <span aria-hidden="true">→</span>
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="closing-cta">
          <div className="container closing-inner">
            <div>
              <p className="eyebrow">A GOOD PLACE TO BEGIN</p>
              <h2>Make room for good work.</h2>
            </div>
            <div>
              <p>
                Bring your business into one connected workspace and take the
                next step with confidence.
              </p>
              <Link className="button button-light" href="/register">
                Create your account <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <Link className="brand brand-light" href="/">
            <span className="brand-mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span>
              hope<span className="brand-period">.</span>
            </span>
          </Link>
          <span>A little more hope in your workday.</span>
          <div>
            <Link href="/login">Log in</Link>
            <Link href="/register">Create account</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
