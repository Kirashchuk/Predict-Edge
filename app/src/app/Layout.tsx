import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import { WalletConnect } from '@/features/wallet/WalletConnect';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <TrendingUp className="h-5 w-5" />
            </span>
            <span className="font-sans text-lg font-bold tracking-tight">
              Predict<span className="text-primary">Edge</span>
            </span>
          </Link>
          <WalletConnect />
        </div>
      </header>
      <main className="container py-6">{children}</main>
      <footer className="border-t border-border py-6">
        <div className="container text-center text-data-xs text-muted-foreground">
          Arc Testnet · UMA Optimistic Oracle V2 · Templars stack (Vite + Bun/Hono)
        </div>
      </footer>
    </div>
  );
}
