import { useState } from 'react';
import { type Address, parseEther } from 'viem';
import { useAccount } from 'wagmi';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/ui/primitives/tabs';
import { Button } from '@/shared/ui/primitives/button';
import { Input } from '@/shared/ui/primitives/input';
import { toast } from '@/shared/ui/primitives/sonner';
import { AMM_ABI, ERC20_ABI } from '@/shared/lib/contracts/abis';
import { ARCT_ADDRESS } from '@/shared/lib/contracts/addresses';
import { useContractWrite } from '@/features/wallet/useContractWrite';

type Outcome = 'yes' | 'no';

export function TradingPanel({ amm, resolved }: { amm: Address; resolved?: boolean }) {
  const { isConnected } = useAccount();
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [outcome, setOutcome] = useState<Outcome>('yes');
  const [amount, setAmount] = useState('');
  const { write, isPending, isConfirming } = useContractWrite();

  const busy = isPending || isConfirming;
  const disabled = !isConnected || resolved || busy || !amount || Number(amount) <= 0;

  async function submit() {
    const value = parseEther(amount);
    try {
      if (side === 'buy') {
        toast.message('Approving ARCT…');
        await write({ address: ARCT_ADDRESS, abi: ERC20_ABI, functionName: 'approve', args: [amm, value] });
        toast.message(`Buying ${outcome.toUpperCase()}…`);
        await write({
          address: amm,
          abi: AMM_ABI,
          functionName: outcome === 'yes' ? 'buyYes' : 'buyNo',
          args: [value],
        });
      } else {
        toast.message(`Selling ${outcome.toUpperCase()}…`);
        await write({
          address: amm,
          abi: AMM_ABI,
          functionName: outcome === 'yes' ? 'sellYes' : 'sellNo',
          args: [value],
        });
      }
      toast.success('Transaction submitted');
      setAmount('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Transaction failed');
    }
  }

  return (
    <div className="corner-markers border border-border bg-card p-4">
      <div className="data-label mb-3 text-gold">// TRADE</div>
      <Tabs value={side} onValueChange={(v) => setSide(v as 'buy' | 'sell')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="buy">Buy</TabsTrigger>
          <TabsTrigger value="sell">Sell</TabsTrigger>
        </TabsList>

        <TabsContent value={side} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={outcome === 'yes' ? 'success' : 'outline'}
              onClick={() => setOutcome('yes')}
            >
              YES
            </Button>
            <Button
              variant={outcome === 'no' ? 'destructive' : 'outline'}
              onClick={() => setOutcome('no')}
            >
              NO
            </Button>
          </div>

          <Input
            type="number"
            placeholder={side === 'buy' ? 'ARCT amount' : `${outcome.toUpperCase()} tokens`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <Button className="w-full" disabled={disabled} onClick={submit}>
            {busy
              ? 'Processing…'
              : resolved
                ? 'Market resolved'
                : `${side === 'buy' ? 'Buy' : 'Sell'} ${outcome.toUpperCase()}`}
          </Button>
          {!isConnected && (
            <p className="text-center text-data-xs text-muted-foreground">Connect a wallet to trade.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
