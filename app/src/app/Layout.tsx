import { type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { WalletConnect } from '@/features/wallet/WalletConnect';

const navCls = ({ isActive }: { isActive: boolean }) =>
  `data-label transition-colors ${isActive ? 'text-gold' : 'text-muted-foreground hover:text-foreground'}`;

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background">
      {/* Templar ambience: faint grid + scanline sweep */}
      <div className="pointer-events-none fixed inset-0 grid-pattern opacity-[0.4]" aria-hidden />
      <div className="scanline" aria-hidden />

      <header className="safe-top sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="container safe-x flex h-16 items-center justify-between gap-2">
          <Link to="/" className="group flex items-center gap-2 sm:gap-3">
            {/* Gold templar sigil mark */}
            <span className="corner-markers flex h-9 w-9 shrink-0 items-center justify-center border border-gold/60 bg-gold/10">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-gold" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6l-8-4Z" />
                <path d="M12 7v9M8.5 11h7" />
              </svg>
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-sans text-base font-bold tracking-tight">
                PREDICT<span className="text-gold">·</span>EDGE
              </span>
              <span className="data-label text-[0.6rem] tracking-[0.25em] text-muted-foreground">
                FORGED ON ARC
              </span>
            </span>
          </Link>

          <nav className="flex items-center gap-3 sm:gap-5">
            <NavLink to="/" end className={navCls}>
              MARKETS
            </NavLink>
            <NavLink to="/portfolio" className={navCls}>
              PORTFOLIO
            </NavLink>
          </nav>

          <WalletConnect />
        </div>
      </header>

      <main className="container safe-x relative py-5 sm:py-8">{children}</main>

      <footer className="safe-bottom relative border-t border-border py-6">
        <div className="container safe-x flex flex-col items-center gap-1 text-center">
          <span className="data-label">ARC TESTNET · UMA OPTIMISTIC ORACLE V2</span>
          <span className="text-[0.65rem] text-muted-foreground/70">
            Templars stack — Vite · Bun/Hono · constant-product AMM
          </span>
        </div>
      </footer>
    </div>
  );
}
