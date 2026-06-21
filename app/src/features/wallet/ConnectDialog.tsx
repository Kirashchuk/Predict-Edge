import { useState } from 'react';
import { Wallet, Fingerprint, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/shared/ui/primitives/dialog';
import { Button } from '@/shared/ui/primitives/button';
import { useWallet } from './WalletContext';

export function ConnectDialog() {
  const [open, setOpen] = useState(false);
  const { connectMetaMask, connectCircle, isConnecting, circleConfigured, circleError } = useWallet();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="btn-brutal border-gold bg-gold/15 text-gold">
          <Wallet className="h-4 w-4" /> Connect
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-sans">Connect a wallet</DialogTitle>
          <DialogDescription>Choose how you want to sign transactions on Arc Testnet.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <button
            onClick={() => {
              connectMetaMask();
              setOpen(false);
            }}
            disabled={isConnecting}
            className="hover-surface corner-markers flex w-full items-center gap-3 border border-border bg-surface p-4 text-left"
          >
            <Wallet className="h-6 w-6 text-gold" />
            <div>
              <div className="font-sans text-sm font-semibold">MetaMask</div>
              <div className="data-label">INJECTED EVM WALLET</div>
            </div>
          </button>

          <button
            onClick={async () => {
              await connectCircle();
              setOpen(false);
            }}
            disabled={isConnecting || !circleConfigured}
            className="hover-surface corner-markers flex w-full items-center gap-3 border border-border bg-surface p-4 text-left disabled:opacity-50"
          >
            {isConnecting ? (
              <Loader2 className="h-6 w-6 animate-spin text-gold" />
            ) : (
              <Fingerprint className="h-6 w-6 text-gold" />
            )}
            <div>
              <div className="font-sans text-sm font-semibold">Circle Passkey</div>
              <div className="data-label">
                {circleConfigured ? 'WEBAUTHN · SMART ACCOUNT · GASLESS' : 'NOT CONFIGURED — SET VITE_CIRCLE_*'}
              </div>
            </div>
          </button>

          {circleError && <p className="text-xs text-destructive">{circleError}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
