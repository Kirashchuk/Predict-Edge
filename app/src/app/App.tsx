import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/shared/ui/primitives/tooltip';
import { Toaster } from '@/shared/ui/primitives/sonner';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { Layout } from '@/app/Layout';
import { wagmiConfig } from '@/features/wallet/wagmi';
import { WalletProvider } from '@/features/wallet/WalletContext';
import { createQueryClient } from '@/shared/lib/query-client';

import MarketsPage from '@/features/markets/MarketsPage';
import NotFound from '@/app/routes/NotFound';

const MarketDetail = lazy(() => import('@/features/markets/MarketDetail'));

const queryClient = createQueryClient();

function Page({ children }: { children: ReactNode }) {
  return <Layout>{children}</Layout>;
}

function RouteFallback() {
  return <div className="min-h-[60vh] bg-background" aria-hidden />;
}

const App = () => (
  <ThemeProvider>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <WalletProvider>
        <TooltipProvider>
          <Toaster />
          <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route
                  path="/"
                  element={
                    <Page>
                      <MarketsPage />
                    </Page>
                  }
                />
                <Route
                  path="/market/:address"
                  element={
                    <Page>
                      <MarketDetail />
                    </Page>
                  }
                />
                <Route
                  path="*"
                  element={
                    <Page>
                      <NotFound />
                    </Page>
                  }
                />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
        </WalletProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </ThemeProvider>
);

export default App;
