import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import WhiteMonoLogo from "../../../logo/WhiteMono.svg";

export function AuthSplitLayout({
  visual,
  children,
}: {
  visual: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="aksa-auth-container">
      {visual}
      <header className="aksa-auth-header">
        <Link className="aksa-auth-header__brand" href="/">
          <Image
            alt="Aksa Home"
            height={28}
            priority
            src={WhiteMonoLogo}
            style={{ height: "28px", width: "auto" }}
            width={92}
          />
        </Link>
      </header>
      <main className="aksa-auth-main" id="main-content">
        {children}
      </main>
    </div>
  );
}

export function AuthFormLayout({
  heading,
  intro,
  notice,
  children
}: {
  heading: ReactNode;
  intro: ReactNode;
  notice?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="aksa-auth-card">
      <h1 className="aksa-auth-card__heading">{heading}</h1>
      <p className="aksa-auth-card__intro">{intro}</p>
      {children}
      {notice && <p className="aksa-auth-tos aksa-auth-tos--inline">{notice}</p>}
    </section>
  );
}
