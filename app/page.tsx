import Link from "next/link";

const modules = [
  {
    number: "01",
    icon: "↗",
    name: "Product management",
    description:
      "Keep your catalog, stock, and product performance in one reliable place.",
    className: "product",
  },
  {
    number: "02",
    icon: "✳",
    name: "Human resources",
    description:
      "Give your people team a simpler way to support the people behind it all.",
    className: "people",
  },
  {
    number: "03",
    icon: "⌁",
    name: "Sales management",
    description:
      "See every opportunity clearly and help your sales team move forward.",
    className: "sales",
  },
  {
    number: "04",
    icon: "◌",
    name: "Customer management",
    description:
      "Bring customer conversations and context together for better relationships.",
    className: "customers",
  },
];

function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link className={`brand${light ? " brand-light" : ""}`} href="/" aria-label="Hope, Inc. home">
      <span className="brand-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span>hope<span className="brand-period">.</span></span>
    </Link>
  );
}

function DashboardPreview() {
  return (
    <div className="preview" aria-label="Illustration of the Hope business dashboard">
      <div className="preview-topbar">
        <Brand />
        <span className="preview-date"><span /> Workspace overview</span>
        <span className="avatar">JD</span>
      </div>
      <div className="preview-body">
        <aside className="preview-sidebar" aria-hidden="true">
          <span className="sidebar-active" />
          <span />
          <span />
          <span />
          <span />
        </aside>
        <div className="preview-content">
          <div className="preview-heading">
            <div>
              <p className="eyebrow">MONDAY, OCTOBER 20</p>
              <h2>Good morning, Jamie <span>✳</span></h2>
              <p>Here&apos;s what&apos;s happening across your business.</p>
            </div>
            <button type="button" className="period-button">This week⌄</button>
          </div>
          <div className="stat-grid">
            <article className="stat-card">
              <span>Total revenue</span>
              <strong>$48,290</strong>
              <small className="positive">↗ 12.8% <span>vs last month</span></small>
              <div className="sparkline spark-one" aria-hidden="true" />
            </article>
            <article className="stat-card">
              <span>Active customers</span>
              <strong>1,284</strong>
              <small className="positive">↗ 8.2% <span>vs last month</span></small>
              <div className="sparkline spark-two" aria-hidden="true" />
            </article>
          </div>
          <div className="chart-card">
            <div className="chart-heading">
              <div><strong>Business overview</strong><span>Revenue across your teams</span></div>
              <span className="chart-legend"><i /> Revenue</span>
            </div>
            <div className="chart" aria-hidden="true">
              <div className="chart-y-labels"><span>$50k</span><span>$35k</span><span>$20k</span><span>$5k</span></div>
              <div className="chart-plot">
                <div className="chart-gridlines"><i /><i /><i /><i /></div>
                <svg viewBox="0 0 500 130" preserveAspectRatio="none" role="presentation">
                  <defs>
                    <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#a6d9c9" stopOpacity=".42" />
                      <stop offset="100%" stopColor="#a6d9c9" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0 103 C30 91 37 98 67 77 S104 93 134 68 S176 85 204 57 S247 76 278 48 S321 70 348 43 S390 58 415 26 S460 42 500 8 V130 H0Z" fill="url(#chart-fill)" />
                  <path d="M0 103 C30 91 37 98 67 77 S104 93 134 68 S176 85 204 57 S247 76 278 48 S321 70 348 43 S390 58 415 26 S460 42 500 8" fill="none" stroke="#377e68" strokeWidth="3" vectorEffect="non-scaling-stroke" />
                </svg>
                <div className="chart-x-labels"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
              </div>
            </div>
          </div>
          <div className="preview-modules">
            <span><i className="dot dot-product" /> Products</span>
            <span><i className="dot dot-people" /> People</span>
            <span><i className="dot dot-sales" /> Sales</span>
            <span><i className="dot dot-customer" /> Customers</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <div className="container header-inner">
          <Brand />
          <nav className="main-nav" aria-label="Main navigation">
            <a href="#platform">Platform</a>
            <a href="#modules">Our modules</a>
            <a href="#about">About us</a>
          </nav>
          <div className="header-actions">
            <Link className="login-link" href="/login">Log in</Link>
            <Link className="button button-dark button-small" href="/register">Get started <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
      </header>

      <section className="hero container" id="platform">
        <div className="hero-copy">
          <div className="announcement"><span className="announcement-dot" /> A better way to work, together <span aria-hidden="true">↗</span></div>
          <h1>Business,<br /><span>in sync.</span></h1>
          <p className="hero-description">All the moving parts of your business, finally moving in the same direction. Meet your new home for getting good work done.</p>
          <div className="hero-actions">
            <Link className="button button-dark" href="/register">Get started for free <span aria-hidden="true">↗</span></Link>
            <a className="text-link" href="#modules">Explore the platform <span aria-hidden="true">↓</span></a>
          </div>
          <div className="hero-proof">
            <div className="avatar-stack" aria-hidden="true"><span>AM</span><span>JT</span><span>KL</span><span>+</span></div>
            <p><strong>Made for the way you work</strong><br />One workspace. Your whole business.</p>
          </div>
        </div>
        <div className="hero-art">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="floating-note note-top"><span className="note-check">✓</span><span><strong>Teamwork, simplified</strong><small>Everyone on the same page</small></span></div>
          <DashboardPreview />
          <div className="floating-note note-bottom"><span className="note-spark">✳</span><span><strong>Looking good!</strong><small>Your week is on track</small></span></div>
        </div>
      </section>

      <section className="trust-strip" aria-label="Platform highlights">
        <div className="container trust-inner">
          <span>ONE HOME FOR YOUR BUSINESS</span>
          <div><i className="trust-star">✳</i> Products</div>
          <div><i className="trust-star">✳</i> People</div>
          <div><i className="trust-star">✳</i> Sales</div>
          <div><i className="trust-star">✳</i> Customers</div>
        </div>
      </section>

      <section className="modules-section container" id="modules">
        <div className="section-heading">
          <div>
            <p className="eyebrow">MEET YOUR NEW WORKSPACE</p>
            <h2>Everything works<br />better <em>together.</em></h2>
          </div>
          <p>Less jumping between tools. More time for the work that moves you forward. Four thoughtful modules, one lovely place to work.</p>
        </div>
        <div className="module-grid">
          {modules.map((module) => (
            <article className={`module-card ${module.className}`} key={module.name}>
              <div className="module-card-top"><span>{module.number} / 04</span><span className="module-icon" aria-hidden="true">{module.icon}</span></div>
              <h3>{module.name}</h3>
              <p>{module.description}</p>
              <a href="/register" aria-label={`Explore ${module.name}`}>Explore module <span aria-hidden="true">↗</span></a>
            </article>
          ))}
        </div>
      </section>

      <section className="closing-cta" id="about">
        <div className="container closing-inner">
          <div><p className="eyebrow">A LITTLE MORE HOPE IN YOUR WORKDAY</p><h2>Ready for things<br />to click?</h2></div>
          <div><p>Bring your people, plans, and customers into one bright new workspace.</p><Link className="button button-light" href="/register">Let&apos;s get started <span aria-hidden="true">↗</span></Link></div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="container footer-inner"><Brand /><span>© 2026 Hope, Inc. Made for good work.</span><div><Link href="/login">Log in</Link><Link href="/register">Create an account</Link></div></div>
      </footer>
    </main>
  );
}
