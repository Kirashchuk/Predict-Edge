import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { parseEther } from 'viem';
import { Wallet, LogOut, Coins } from 'lucide-react';
import { Button } from '@/shared/ui/primitives/button';
import { toast } from '@/shared/ui/primitives/sonner';
import { shortAddr } from '@/shared/lib/format';
import { ARCT_ADDRESS } from '@/shared/lib/contracts/addresses';
import { TESTNET_ERC20_ABI } from '@/shared/lib/contracts/abis';
import { useContractWrite } from './useContractWrite';

export function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
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

  if (!isConnected) {
    return (
      <Button onClick={() => connect({ connector: injected() })} disabled={isPending}>
        <Wallet className="h-4 w-4" />
        {isPending ? 'Connecting…' : 'Connect Wallet'}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={mintArct}>
        <Coins className="h-4 w-4" /> Faucet
      </Button>
      <Button variant="secondary" size="sm" className="font-mono">
        {shortAddr(address)}
      </Button>
      <Button variant="ghost" size="icon" onClick={() => disconnect()} aria-label="Disconnect">
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}
