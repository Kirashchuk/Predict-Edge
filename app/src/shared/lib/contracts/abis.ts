// Contract ABIs used by the AMM, market, UMA oracle, and on-chain CLOB.

export const AMM_ABI = [
  { anonymous: false, inputs: [{ indexed: true, name: 'buyer', type: 'address' }, { indexed: false, name: 'usdcIn', type: 'uint256' }, { indexed: false, name: 'yesOut', type: 'uint256' }], name: 'BuyYes', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, name: 'buyer', type: 'address' }, { indexed: false, name: 'usdcIn', type: 'uint256' }, { indexed: false, name: 'noOut', type: 'uint256' }], name: 'BuyNo', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, name: 'seller', type: 'address' }, { indexed: false, name: 'yesIn', type: 'uint256' }, { indexed: false, name: 'usdcOut', type: 'uint256' }], name: 'SellYes', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, name: 'seller', type: 'address' }, { indexed: false, name: 'noIn', type: 'uint256' }, { indexed: false, name: 'usdcOut', type: 'uint256' }], name: 'SellNo', type: 'event' },
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

export const CLOB_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'orderId', type: 'uint256' },
      { indexed: true, name: 'maker', type: 'address' },
      { indexed: true, name: 'outcome', type: 'uint8' },
      { indexed: false, name: 'side', type: 'uint8' },
      { indexed: false, name: 'price', type: 'uint256' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'escrow', type: 'uint256' },
    ],
    name: 'OrderPlaced',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'orderId', type: 'uint256' },
      { indexed: true, name: 'maker', type: 'address' },
      { indexed: false, name: 'returnedEscrow', type: 'uint256' },
    ],
    name: 'OrderCancelled',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'orderId', type: 'uint256' },
      { indexed: true, name: 'maker', type: 'address' },
      { indexed: true, name: 'taker', type: 'address' },
      { indexed: false, name: 'side', type: 'uint8' },
      { indexed: false, name: 'outcome', type: 'uint8' },
      { indexed: false, name: 'price', type: 'uint256' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'quote', type: 'uint256' },
      { indexed: false, name: 'remaining', type: 'uint256' },
    ],
    name: 'OrderFilled',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'buyOrderId', type: 'uint256' },
      { indexed: true, name: 'sellOrderId', type: 'uint256' },
      { indexed: false, name: 'outcome', type: 'uint8' },
      { indexed: false, name: 'price', type: 'uint256' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'quote', type: 'uint256' },
      { indexed: false, name: 'matcher', type: 'address' },
    ],
    name: 'OrdersMatched',
    type: 'event',
  },
  { inputs: [], name: 'PRICE_SCALE', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'orderId', type: 'uint256' }], name: 'cancelOrder', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'collateralToken', outputs: [{ name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'orderId', type: 'uint256' }, { name: 'amountToFill', type: 'uint256' }], name: 'fillOrder', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'outcome', type: 'uint8' }, { name: 'side', type: 'uint8' }], name: 'getOpenOrders', outputs: [{ name: '', type: 'uint256[]' }], stateMutability: 'view', type: 'function' },
  {
    inputs: [{ name: 'ids', type: 'uint256[]' }],
    name: 'getOrders',
    outputs: [{
      name: 'out',
      type: 'tuple[]',
      components: [
        { name: 'id', type: 'uint256' },
        { name: 'maker', type: 'address' },
        { name: 'side', type: 'uint8' },
        { name: 'outcome', type: 'uint8' },
        { name: 'price', type: 'uint256' },
        { name: 'amountInitial', type: 'uint256' },
        { name: 'amountRemaining', type: 'uint256' },
        { name: 'escrowRemaining', type: 'uint256' },
        { name: 'status', type: 'uint8' },
        { name: 'createdAt', type: 'uint256' },
        { name: 'filledAt', type: 'uint256' },
      ],
    }],
    stateMutability: 'view',
    type: 'function',
  },
  { inputs: [], name: 'longToken', outputs: [{ name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'buyOrderId', type: 'uint256' }, { name: 'sellOrderId', type: 'uint256' }, { name: 'amountToFill', type: 'uint256' }], name: 'matchOrders', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'market', outputs: [{ name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'nextOrderId', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  {
    inputs: [{ name: '', type: 'uint256' }],
    name: 'orders',
    outputs: [
      { name: 'id', type: 'uint256' },
      { name: 'maker', type: 'address' },
      { name: 'side', type: 'uint8' },
      { name: 'outcome', type: 'uint8' },
      { name: 'price', type: 'uint256' },
      { name: 'amountInitial', type: 'uint256' },
      { name: 'amountRemaining', type: 'uint256' },
      { name: 'escrowRemaining', type: 'uint256' },
      { name: 'status', type: 'uint8' },
      { name: 'createdAt', type: 'uint256' },
      { name: 'filledAt', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  { inputs: [{ name: 'side', type: 'uint8' }, { name: 'outcome', type: 'uint8' }, { name: 'price', type: 'uint256' }, { name: 'amount', type: 'uint256' }], name: 'placeLimitOrder', outputs: [{ name: 'orderId', type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'shortToken', outputs: [{ name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
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
  { inputs: [], name: 'customAncillaryData', outputs: [{ name: '', type: 'bytes' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'priceIdentifier', outputs: [{ name: '', type: 'bytes32' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'requestTimestamp', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'proposerReward', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'optimisticOracleProposerBond', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'optimisticOracleLivenessTime', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
] as const;

export const OO_V2_ABI = [
  { inputs: [{ name: 'requester', type: 'address' }, { name: 'identifier', type: 'bytes32' }, { name: 'timestamp', type: 'uint256' }, { name: 'ancillaryData', type: 'bytes' }], name: 'getState', outputs: [{ name: '', type: 'uint8' }], stateMutability: 'view', type: 'function' },
  {
    inputs: [{ name: 'requester', type: 'address' }, { name: 'identifier', type: 'bytes32' }, { name: 'timestamp', type: 'uint256' }, { name: 'ancillaryData', type: 'bytes' }],
    name: 'getRequest',
    outputs: [{
      name: '', type: 'tuple', components: [
        { name: 'proposer', type: 'address' }, { name: 'disputer', type: 'address' }, { name: 'currency', type: 'address' }, { name: 'settled', type: 'bool' },
        { name: 'requestSettings', type: 'tuple', components: [
          { name: 'eventBased', type: 'bool' }, { name: 'refundOnDispute', type: 'bool' }, { name: 'callbackOnPriceProposed', type: 'bool' }, { name: 'callbackOnPriceDisputed', type: 'bool' }, { name: 'callbackOnPriceSettled', type: 'bool' }, { name: 'bond', type: 'uint256' }, { name: 'customLiveness', type: 'uint256' },
        ] },
        { name: 'proposedPrice', type: 'int256' }, { name: 'resolvedPrice', type: 'int256' }, { name: 'expirationTime', type: 'uint256' }, { name: 'reward', type: 'uint256' }, { name: 'finalFee', type: 'uint256' },
      ],
    }],
    stateMutability: 'view', type: 'function',
  },
  { inputs: [{ name: 'requester', type: 'address' }, { name: 'identifier', type: 'bytes32' }, { name: 'timestamp', type: 'uint256' }, { name: 'ancillaryData', type: 'bytes' }, { name: 'proposedPrice', type: 'int256' }], name: 'proposePrice', outputs: [{ name: 'totalBond', type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'requester', type: 'address' }, { name: 'identifier', type: 'bytes32' }, { name: 'timestamp', type: 'uint256' }, { name: 'ancillaryData', type: 'bytes' }], name: 'disputePrice', outputs: [{ name: 'totalBond', type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'requester', type: 'address' }, { name: 'identifier', type: 'bytes32' }, { name: 'timestamp', type: 'uint256' }, { name: 'ancillaryData', type: 'bytes' }], name: 'settle', outputs: [{ name: 'payout', type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
] as const;

export const TIMER_ABI = [
  { inputs: [], name: 'getCurrentTime', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'time', type: 'uint256' }], name: 'setCurrentTime', outputs: [], stateMutability: 'nonpayable', type: 'function' },
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
