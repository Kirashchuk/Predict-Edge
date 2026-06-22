import { useState } from 'react';
import { type Address, parseEther, parseUnits, maxUint256 } from 'viem';
import { Gavel, Loader2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/ui/primitives/tabs';
import { Button } from '@/shared/ui/primitives/button';
import { Input } from '@/shared/ui/primitives/input';
import { toast } from '@/shared/ui/primitives/sonner';
import { USDC_ADDRESS, OO_V2_ADDRESS, COLLATERAL_DECIMALS } from '@/shared/lib/contracts/addresses';
import { ERC20_ABI } from '@/shared/lib/contracts/abis';
import { OracleState, oracleStateLabel, formatCollateral } from '@/shared/lib/contracts/types';
import { useWallet } from '@/features/wallet/WalletContext';
import { useContractWrite } from '@/features/wallet/useContractWrite';
import { useAmmTrade, useTradePreview, useTradeAllowances } from './hooks/useTrade';
import { useOracleState, useOracleActions, type OracleArgs } from './hooks/useOracle';
import { usePlaceOrder } from './hooks/useOrders';

interface TradingPanelProps extends OracleArgs {
  amm?: Address;
  longToken?: Address;
  shortToken?: Address;
  resolved?: boolean;
  arctAllowanceToOo?: bigint;
  yesPrice?: number; // 0..1, for the limit form default
}

export function TradingPanel(props: TradingPanelProps) {
  const { amm, market, longToken, shortToken, resolved } = props;
  return (
    <div className="corner-markers border border-border bg-card p-4">
      <div className="data-label mb-3 text-gold">// TRADE</div>
      <Tabs defaultValue="buy">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="buy">Buy</TabsTrigger>
          <TabsTrigger value="sell">Sell</TabsTrigger>
          <TabsTrigger value="limit">Limit</TabsTrigger>
          <TabsTrigger value="resolve">Resolve</TabsTrigger>
        </TabsList>

        <TabsContent value="buy">
          <BuySell side="buy" amm={amm} longToken={longToken} shortToken={shortToken} resolved={resolved} />
        </TabsContent>
        <TabsContent value="sell">
          <BuySell side="sell" amm={amm} longToken={longToken} shortToken={shortToken} resolved={resolved} />
        </TabsContent>
        <TabsContent value="limit">
          <LimitForm market={market} resolved={resolved} yesPrice={props.yesPrice ?? 0.5} />
        </TabsContent>
        <TabsContent value="resolve">
          <ResolveTab
            market={market}
            priceIdentifier={props.priceIdentifier}
            requestTimestamp={props.requestTimestamp}
            ancillaryDataHex={props.ancillaryDataHex}
            arctAllowanceToOo={props.arctAllowanceToOo}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// --- Buy / Sell --------------------------------------------------------------
function BuySell({
  side,
  amm,
  longToken,
  shortToken,
  resolved,
}: {
  side: 'buy' | 'sell';
  amm?: Address;
  longToken?: Address;
  shortToken?: Address;
  resolved?: boolean;
}) {
  const { isConnected } = useWallet();
  const [outcome, setOutcome] = useState<'yes' | 'no'>('yes');
  const [amount, setAmount] = useState('');
  const { approve, buy, sell, isPending, isConfirming } = useAmmTrade(amm);
  const { out } = useTradePreview(amm, side, outcome, amount);
  const { arctAllowance, longAllowance, shortAllowance } = useTradeAllowances(amm, longToken, shortToken);

  const busy = isPending || isConfirming;
  const disabled = !isConnected || resolved || busy || !amount || Number(amount) <= 0;

  const sellToken = outcome === 'yes' ? longToken : shortToken;
  const sellAllowance = outcome === 'yes' ? longAllowance : shortAllowance;

  async function submit() {
    try {
      const amountUnits = parseUnits(amount, COLLATERAL_DECIMALS);
      if (side === 'buy') {
        if ((arctAllowance ?? 0n) < amountUnits) {
          toast.message('Approving USDC…');
          await approve(USDC_ADDRESS, maxUint256);
        }
        toast.message(`Buying ${outcome.toUpperCase()}…`);
        await buy(outcome, amount);
      } else {
        if (sellToken && (sellAllowance ?? 0n) < amountUnits) {
          toast.message('Approving tokens…');
          await approve(sellToken, maxUint256);
        }
        toast.message(`Selling ${outcome.toUpperCase()}…`);
        await sell(outcome, amount);
      }
      toast.success('Transaction submitted');
      setAmount('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Transaction failed');
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Button variant={outcome === 'yes' ? 'success' : 'outline'} onClick={() => setOutcome('yes')}>
          YES
        </Button>
        <Button variant={outcome === 'no' ? 'destructive' : 'outline'} onClick={() => setOutcome('no')}>
          NO
        </Button>
      </div>
      <Input
        type="number"
        placeholder={side === 'buy' ? 'USDC amount' : `${outcome.toUpperCase()} tokens`}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      {out !== undefined && Number(amount) > 0 && (
        <div className="flex justify-between border border-border bg-surface px-3 py-2">
          <span className="data-label">{side === 'buy' ? 'EST. TOKENS OUT' : 'EST. USDC OUT'}</span>
          <span className="data-value text-gold">{formatCollateral(out)}</span>
        </div>
      )}
      <Button className="w-full" disabled={disabled} onClick={submit}>
        {busy ? 'Processing…' : resolved ? 'Market resolved' : `${side === 'buy' ? 'Buy' : 'Sell'} ${outcome.toUpperCase()}`}
      </Button>
      {!isConnected && <p className="text-center text-data-xs text-muted-foreground">Connect a wallet to trade.</p>}
    </div>
  );
}

// --- Limit order (off-chain, executes against the AMM when crossed) ---------
function LimitForm({ market, resolved, yesPrice }: { market?: Address; resolved?: boolean; yesPrice: number }) {
  const { address, isConnected } = useWallet();
  const [outcome, setOutcome] = useState<'yes' | 'no'>('yes');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [price, setPrice] = useState('');
  const [size, setSize] = useState('');
  const place = usePlaceOrder(market);

  const outcomePrice = outcome === 'yes' ? yesPrice : 1 - yesPrice;
  const disabled = !isConnected || resolved || place.isPending || !price || !size || Number(size) <= 0;

  async function submit() {
    if (!address || !market) return;
    const limit = Number(price) / 100;
    if (limit <= 0 || limit >= 1) {
      toast.error('Limit price must be between 1% and 99%');
      return;
    }
    try {
      await place.mutateAsync({ market, owner: address, side, outcome, limitPrice: limit, size: Number(size) });
      toast.success(`Limit ${side} ${outcome.toUpperCase()} @ ${price}% placed`);
      setPrice('');
      setSize('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to place order');
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Button variant={side === 'buy' ? 'success' : 'outline'} onClick={() => setSide('buy')}>
          Buy
        </Button>
        <Button variant={side === 'sell' ? 'destructive' : 'outline'} onClick={() => setSide('sell')}>
          Sell
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant={outcome === 'yes' ? 'success' : 'outline'} size="sm" onClick={() => setOutcome('yes')}>
          YES
        </Button>
        <Button variant={outcome === 'no' ? 'destructive' : 'outline'} size="sm" onClick={() => setOutcome('no')}>
          NO
        </Button>
      </div>
      <div>
        <div className="data-label mb-1">LIMIT PRICE % (now {(outcomePrice * 100).toFixed(1)}%)</div>
        <Input type="number" placeholder="e.g. 40" value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      <div>
        <div className="data-label mb-1">SIZE ({side === 'buy' ? 'USDC' : `${outcome.toUpperCase()} tokens`})</div>
        <Input type="number" placeholder="0.0" value={size} onChange={(e) => setSize(e.target.value)} />
      </div>
      <Button className="w-full" disabled={disabled} onClick={submit}>
        {place.isPending ? 'Placing…' : 'Place limit order'}
      </Button>
      <p className="text-center text-[0.6rem] text-muted-foreground/70">
        Off-chain order · auto-flagged fillable when AMM price crosses · you sign the fill vs the AMM
      </p>
      {!isConnected && <p className="text-center text-data-xs text-muted-foreground">Connect a wallet to place orders.</p>}
    </div>
  );
}

// --- Resolve (UMA Optimistic Oracle) ----------------------------------------
function ResolveTab({
  market,
  priceIdentifier,
  requestTimestamp,
  ancillaryDataHex,
  arctAllowanceToOo,
}: OracleArgs & { arctAllowanceToOo?: bigint }) {
  const { isConnected } = useWallet();
  const args: OracleArgs = { market, priceIdentifier, requestTimestamp, ancillaryDataHex };
  const { oracleState, proposer, proposedPrice, bond, expirationTime } = useOracleState(args);
  const { propose, dispute, settleOracle, action, isPending, isConfirming } = useOracleActions(args);
  const approveBond = useContractWrite();

  const busy = isPending || isConfirming || approveBond.isPending || approveBond.isConfirming;
  const needsBondApproval = bond !== undefined && (arctAllowanceToOo ?? 0n) < bond;

  const canPropose = oracleState === OracleState.Requested || oracleState === OracleState.Invalid;
  const canDispute = oracleState === OracleState.Proposed;
  const canSettle = oracleState === OracleState.Expired || oracleState === OracleState.Resolved;

  const priceLabel =
    proposedPrice === undefined
      ? '—'
      : proposedPrice >= parseEther('1')
        ? 'YES'
        : proposedPrice === parseEther('0.5')
          ? 'UNDET'
          : 'NO';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border border-border bg-surface px-3 py-2">
        <span className="data-label">ORACLE STATE</span>
        <span className="data-value text-gold">{oracleStateLabel(oracleState, { priceRequested: true })}</span>
      </div>
      {oracleState === OracleState.Proposed && (
        <div className="flex items-center justify-between border border-border bg-surface px-3 py-2">
          <span className="data-label">PROPOSED</span>
          <span className="data-value">{priceLabel}</span>
        </div>
      )}

      {canPropose && (
        <>
          <div className="data-label">
            PROPOSE OUTCOME {bond !== undefined && `· BOND ${formatCollateral(bond)} USDC`}
          </div>
          {needsBondApproval && (
            <Button
              variant="outline"
              className="w-full"
              disabled={!isConnected || busy}
              onClick={() =>
                approveBond.write({ address: USDC_ADDRESS, abi: ERC20_ABI, functionName: 'approve', args: [OO_V2_ADDRESS, maxUint256] })
              }
            >
              {approveBond.isPending || approveBond.isConfirming ? 'Approving…' : 'Approve bond'}
            </Button>
          )}
          <div className="grid grid-cols-3 gap-2">
            <Button variant="success" disabled={!isConnected || busy || needsBondApproval} onClick={() => propose(parseEther('1'))}>
              YES
            </Button>
            <Button variant="destructive" disabled={!isConnected || busy || needsBondApproval} onClick={() => propose(0n)}>
              NO
            </Button>
            <Button variant="outline" disabled={!isConnected || busy || needsBondApproval} onClick={() => propose(parseEther('0.5'))}>
              UNDET
            </Button>
          </div>
        </>
      )}

      {canDispute && (
        <div className="space-y-2">
          <p className="text-data-xs text-muted-foreground">
            Proposed by <span className="font-mono">{proposer?.slice(0, 8)}…</span>. Dispute escalates to the DVM, or settle
            once liveness (60s) expires.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="destructive" disabled={!isConnected || busy} onClick={dispute}>
              {busy && action === 'dispute' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4" />} Dispute
            </Button>
            <Button disabled={!isConnected || busy} onClick={() => settleOracle(expirationTime)}>
              {busy && action === 'settle' ? 'Settling…' : 'Settle'}
            </Button>
          </div>
        </div>
      )}

      {canSettle && (
        <Button className="w-full" disabled={!isConnected || busy} onClick={() => settleOracle(expirationTime)}>
          {busy ? 'Settling…' : 'Settle oracle'}
        </Button>
      )}

      {oracleState === OracleState.Settled && (
        <p className="text-center text-data-sm text-success">Market resolved — redeem your positions below.</p>
      )}
      {!isConnected && <p className="text-center text-data-xs text-muted-foreground">Connect a wallet to resolve.</p>}
    </div>
  );
}
