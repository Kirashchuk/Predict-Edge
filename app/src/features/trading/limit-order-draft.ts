export type LimitOrderSide = "buy" | "sell";
export type LimitOrderOutcome = "yes" | "no";
export type LimitOrderSource = "amm" | "clob";

export interface LimitOrderDraft {
  outcome: LimitOrderOutcome;
  price: string;
  revision: number;
  side: LimitOrderSide;
  source: LimitOrderSource;
}

export type LimitOrderSelection = Omit<LimitOrderDraft, "revision">;
