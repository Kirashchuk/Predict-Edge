import { parseEther } from 'viem';
import { LogOut, Coins, Fingerprint, Wallet } from 'lucide-react';
import { Button } from '@/shared/ui/primitives/button';
import { toast } from '@/shared/ui/primitives/sonner';
import { shortAddr } from '@/shared/lib/format';
import { ARCT_ADDRESS } from '@/shared/lib/contracts/addresses';
import { TESTNET_ERC20_ABI } from '@/shared/lib/contracts/abis';
import { useWallet } from './WalletContext';
import { ConnectDialog } from './ConnectDialog';
import { useContractWrite } from './useContractWrite';

export function WalletConnect() {
  const { address, isConnected, walletType, disconnect } = useWallet();
  const { write } = useContractWrite();

  async function mintArct() {
    if (!address) return;
    toast.message('Minting 1,000 ARCT…');
    await write({
      address: ARCT_ADDRESS,
      abi: TESTNET_ERC20_ABI,
      functionName: 'allocateTo',
      args: [address, parseEther('1000')],
    });
    toast.success('Faucet: requested 1,000 ARCT');
  }

  if (!isConnected) return <ConnectDialog />;

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={mintArct}>
        <Coins className="h-4 w-4" /> Faucet
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
