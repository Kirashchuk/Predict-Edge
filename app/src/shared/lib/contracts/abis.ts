// Contract ABIs (ported from the legacy lib/contracts/abis). The on-chain
// contracts are unchanged by the stack migration, so the ABIs are identical.

export const AMM_ABI = [
  { inputs: [{ name: 'collateralAmount', type: 'uint256' }], name: 'buyYes', outputs: [{ name: 'yesOut', type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'collateralAmount', type: 'uint256' }], name: 'buyNo', outputs: [{ name: 'noOut', type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'yesAmount', type: 'uint256' }], name: 'sellYes', outputs: [{ name: 'collateralOut', type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'noAmount', type: 'uint256' }], name: 'sellNo', outputs: [{ name: 'collateralOut', type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'getYesPrice', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'getNoPrice', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'getReserves', outputs: [{ name: '', type: 'uint256' }, { name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'collateralAmount', type: 'uint256' }], name: 'calcBuyYes', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'collateralAmount', type: 'uint256' }], name: 'calcBuyNo', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'yesAmount', type: 'uint256' }], name: 'calcSellYes', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'noAmount', type: 'uint256' }], name: 'calcSellNo', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'feeBps', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'initialized', outputs: [{ name: '', type: 'bool' }], stateMutability: 'view', type: 'function' },
] as const;

export const MARKET_ABI = [
  { inputs: [], name: 'collateralToken', outputs: [{ name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'tokensToCreate', type: 'uint256' }], name: 'create', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'longToken', outputs: [{ name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'shortToken', outputs: [{ name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'pairName', outputs: [{ name: '', type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'priceRequested', outputs: [{ name: '', type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'receivedSettlementPrice', outputs: [{ name: '', type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'tokensToRedeem', type: 'uint256' }], name: 'redeem', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'longTokensToRedeem', type: 'uint256' }, { name: 'shortTokensToRedeem', type: 'uint256' }], name: 'settle', outputs: [{ name: 'collateralReturned', type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'settlementPrice', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
] as const;

export const ERC20_ABI = [
  { inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'approve', outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], name: 'allowance', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'decimals', outputs: [{ name: '', type: 'uint8' }], stateMutability: 'view', type: 'function' },
] as const;

export const TESTNET_ERC20_ABI = [
  ...ERC20_ABI,
  { inputs: [{ name: 'ownerAddress', type: 'address' }, { name: 'value', type: 'uint256' }], name: 'allocateTo', outputs: [], stateMutability: 'nonpayable', type: 'function' },
] as const;
