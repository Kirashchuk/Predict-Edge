import { useAccount, useSwitchChain } from 'wagmi';
import { LogOut, Coins, Fingerprint, Wallet, AlertTriangle } from 'lucide-react';
import { Button } from '@/shared/ui/primitives/button';
import { shortAddr } from '@/shared/lib/format';
import { useWallet } from './WalletContext';
import { ConnectDialog } from './ConnectDialog';
import { arcTestnet } from './wagmi';

export function WalletConnect() {
  const { address, isConnected, walletType, disconnect } = useWallet();
  const { chainId } = useAccount();
  const { switchChain, isPending: switching } = useSwitchChain();

  // MetaMask on the wrong chain — show a switch button so no tx hits mainnet.
  const wrongNetwork = walletType === 'metamask' && chainId !== undefined && chainId !== arcTestnet.id;

  if (!isConnected) return <ConnectDialog />;

  if (wrongNetwork) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="destructive"
          size="sm"
          disabled={switching}
          onClick={() => switchChain({ chainId: arcTestnet.id })}
        >
          <AlertTriangle className="h-4 w-4" /> {switching ? 'Switching…' : 'Switch to Arc Testnet'}
        </Button>
        <Button variant="ghost" size="icon" onClick={disconnect} aria-label="Disconnect">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" asChild>
        <a href="https://faucet.circle.com/" target="_blank" rel="noopener noreferrer">
          <Coins className="h-4 w-4" /> USDC Faucet
        </a>
      </Button>
      <span className="hidden items-center gap-1.5 border border-border bg-surface px-2.5 py-1.5 font-mono text-xs text-foreground sm:flex">
        {walletType === 'circle' ? (
          <Fingerprint className="h-3.5 w-3.5 text-gold" />
        ) : (
          <Wallet className="h-3.5 w-3.5 text-gold" />
        )}
        {shortAddr(address)}
      </span>
      <Button variant="ghost" size="icon" onClick={disconnect} aria-label="Disconnect">
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}
