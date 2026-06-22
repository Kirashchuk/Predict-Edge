import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import { formatUnits, parseAbiItem, type Address } from 'viem';
import { formatCollateral } from '@/shared/lib/contracts/types';
import { shortAddr } from '@/shared/lib/format';

interface TradeHistoryProps {
  amm?: Address;
  clob?: Address;
}

interface TradeRow {
  key: string;
  blockNumber: bigint;
  txHash: string;
  venue: 'AMM' | 'CLOB';
  label: string;
  amount: bigint;
  quote: bigint;
  price?: bigint;
  actor?: string;
}

const AMM_EVENTS = [
  parseAbiItem('event BuyYes(address indexed buyer,uint256 usdcIn,uint256 yesOut)'),
  parseAbiItem('event BuyNo(address indexed buyer,uint256 usdcIn,uint256 noOut)'),
  parseAbiItem('event SellYes(address indexed seller,uint256 yesIn,uint256 usdcOut)'),
  parseAbiItem('event SellNo(address indexed seller,uint256 noIn,uint256 usdcOut)'),
] as const;

const CLOB_FILL_EVENT = parseAbiItem(
  'event OrderFilled(uint256 indexed orderId,address indexed maker,address indexed taker,uint8 side,uint8 outcome,uint256 price,uint256 amount,uint256 quote,uint256 remaining)',
);
const CLOB_MATCH_EVENT = parseAbiItem(
  'event OrdersMatched(uint256 indexed buyOrderId,uint256 indexed sellOrderId,uint8 outcome,uint256 price,uint256 amount,uint256 quote,address matcher)',
);

function sideText(side: number): string {
  return side === 0 ? 'BUY' : 'SELL';
}

function outcomeText(outcome: number): string {
  return outcome === 0 ? 'YES' : 'NO';
}

export function TradeHistory({ amm, clob }: TradeHistoryProps) {
  const publicClient = usePublicClient();
  const { data: trades = [], isLoading } = useQuery({
    queryKey: ['trade-history', amm, clob],
    enabled: Boolean(publicClient && (amm || clob)),
    refetchInterval: 10_000,
    queryFn: async () => {
      if (!publicClient) return [] as TradeRow[];
      const latest = await publicClient.getBlockNumber();
      const fromBlock = latest > 100_000n ? latest - 100_000n : 0n;
      const rows: TradeRow[] = [];

      if (amm) {
        const ammResults = await Promise.allSettled(
          AMM_EVENTS.map((event) => publicClient.getLogs({ address: amm, event, fromBlock, toBlock: 'latest' })),
        );
        for (const result of ammResults) {
          if (result.status !== 'fulfilled') continue;
          for (const log of result.value as any[]) {
            const args = log.args ?? {};
            if (log.eventName === 'BuyYes') {
              rows.push({ key: `${log.transactionHash}-${log.logIndex}`, blockNumber: log.blockNumber, txHash: log.transactionHash, venue: 'AMM', label: 'BUY YES', amount: args.yesOut, quote: args.usdcIn, actor: args.buyer });
            } else if (log.eventName === 'BuyNo') {
              rows.push({ key: `${log.transactionHash}-${log.logIndex}`, blockNumber: log.blockNumber, txHash: log.transactionHash, venue: 'AMM', label: 'BUY NO', amount: args.noOut, quote: args.usdcIn, actor: args.buyer });
            } else if (log.eventName === 'SellYes') {
              rows.push({ key: `${log.transactionHash}-${log.logIndex}`, blockNumber: log.blockNumber, txHash: log.transactionHash, venue: 'AMM', label: 'SELL YES', amount: args.yesIn, quote: args.usdcOut, actor: args.seller });
            } else if (log.eventName === 'SellNo') {
              rows.push({ key: `${log.transactionHash}-${log.logIndex}`, blockNumber: log.blockNumber, txHash: log.transactionHash, venue: 'AMM', label: 'SELL NO', amount: args.noIn, quote: args.usdcOut, actor: args.seller });
            }
          }
        }
      }

      if (clob) {
        const clobResults = await Promise.allSettled([
          publicClient.getLogs({ address: clob, event: CLOB_FILL_EVENT, fromBlock, toBlock: 'latest' }),
          publicClient.getLogs({ address: clob, event: CLOB_MATCH_EVENT, fromBlock, toBlock: 'latest' }),
        ]);
        for (const result of clobResults) {
          if (result.status !== 'fulfilled') continue;
          for (const log of result.value as any[]) {
            const args = log.args ?? {};
            if (log.eventName === 'OrderFilled') {
              rows.push({
                key: `${log.transactionHash}-${log.logIndex}`,
                blockNumber: log.blockNumber,
                txHash: log.transactionHash,
                venue: 'CLOB',
                label: `${sideText(Number(args.side))} ${outcomeText(Number(args.outcome))}`,
                amount: args.amount,
                quote: args.quote,
                price: args.price,
                actor: args.taker,
              });
            } else if (log.eventName === 'OrdersMatched') {
              rows.push({
                key: `${log.transactionHash}-${log.logIndex}`,
                blockNumber: log.blockNumber,
                txHash: log.transactionHash,
                venue: 'CLOB',
                label: `MATCH ${outcomeText(Number(args.outcome))}`,
                amount: args.amount,
                quote: args.quote,
                price: args.price,
                actor: args.matcher,
              });
            }
          }
        }
      }

      return rows.sort((a, b) => Number(b.blockNumber - a.blockNumber)).slice(0, 10);
    },
  });

  return (
    <div className="corner-markers border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="data-label text-gold">// TRADE HISTORY</span>
        <span className="data-label">ON-CHAIN LOGS</span>
      </div>
      {isLoading ? (
        <div className="py-4 text-data-sm text-muted-foreground">Loading trades...</div>
      ) : trades.length === 0 ? (
        <div className="py-4 text-data-sm text-muted-foreground">No recent trades found.</div>
      ) : (
        <div className="space-y-1">
          {trades.map((trade) => (
            <a
              key={trade.key}
              href={`https://testnet.arcscan.app/tx/${trade.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-2 py-1 text-data-xs hover:bg-surface"
            >
              <span className={trade.venue === 'CLOB' ? 'font-mono text-gold' : 'font-mono text-muted-foreground'}>
                {trade.venue}
              </span>
              <span className="min-w-0">
                <span className="font-mono">{trade.label}</span>
                <span className="ml-2 text-muted-foreground">
                  {formatCollateral(trade.amount)} / {formatCollateral(trade.quote)} USDC
                  {trade.price ? ` @ ${(Number(formatUnits(trade.price, 18)) * 100).toFixed(1)}%` : ''}
                </span>
              </span>
              <span className="font-mono text-muted-foreground">{shortAddr(trade.actor)}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
