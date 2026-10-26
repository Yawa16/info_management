import Link from "next/link";
import { ReactNode } from "react";

function Brand() {
  return (
    <Link className="brand brand-light" href="/" aria-label="Hope, Inc. home">
      <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
      <span>hope<span className="brand-period">.</span></span>
    </Link>
  );
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-layout">
      <section className="auth-aside">
        <Brand />
        <div className="auth-aside-content">
          <span className="auth-aside-tag"><i /> YOUR BUSINESS, IN GOOD COMPANY</span>
          <h2>Good things<br />happen when<br /><em>we work</em><br />together.</h2>
          <p>All your people, products, sales, and customers—finally in sync.</p>
          <div className="aside-orbit aside-orbit-one" />
          <div className="aside-orbit aside-orbit-two" />
          <div className="aside-decoration" aria-hidden="true"><span>h.</span><i>✳</i></div>
        </div>
        <span className="auth-aside-footer">A little more hope in your workday.</span>
      </section>
      <section className="auth-main">
        <div className="auth-mobile-brand"><Brand /></div>
        {children}
        <div className="auth-help"><span>Need a hand?</span> <a href="mailto:hello@hope.example">We’re here to help</a></div>
      </section>
    </main>
  );
}
