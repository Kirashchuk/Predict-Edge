// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

interface ICLOBPredictionMarket {
    function collateralToken() external view returns (IERC20);
    function longToken() external view returns (IERC20);
    function shortToken() external view returns (IERC20);
    function receivedSettlementPrice() external view returns (bool);
}

/// @notice Escrowed central limit order book for one YES/NO prediction market.
/// Buy limits escrow collateral. Sell limits escrow YES or NO position tokens.
contract OnChainLimitOrderBook is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Side {
        Buy,
        Sell
    }

    enum Outcome {
        Yes,
        No
    }

    enum Status {
        Open,
        Filled,
        Cancelled
    }

    struct Order {
        uint256 id;
        address maker;
        Side side;
        Outcome outcome;
        uint256 price; // collateral per outcome token, 1e18 fixed point.
        uint256 amountInitial;
        uint256 amountRemaining;
        uint256 escrowRemaining; // Buy: collateral. Sell: outcome tokens.
        Status status;
        uint256 createdAt;
        uint256 filledAt;
    }

    uint256 public constant PRICE_SCALE = 1e18;

    ICLOBPredictionMarket public immutable market;
    IERC20 public immutable collateralToken;
    IERC20 public immutable longToken;
    IERC20 public immutable shortToken;

    uint256 public nextOrderId = 1;
    mapping(uint256 => Order) public orders;

    mapping(bytes32 => uint256[]) private openOrderIds;
    mapping(uint256 => uint256) private openOrderIndexPlusOne;

    event OrderPlaced(
        uint256 indexed orderId,
        address indexed maker,
        uint8 indexed outcome,
        uint8 side,
        uint256 price,
        uint256 amount,
        uint256 escrow
    );
    event OrderCancelled(uint256 indexed orderId, address indexed maker, uint256 returnedEscrow);
    event OrderFilled(
        uint256 indexed orderId,
        address indexed maker,
        address indexed taker,
        uint8 side,
        uint8 outcome,
        uint256 price,
        uint256 amount,
        uint256 quote,
        uint256 remaining
    );
    event OrdersMatched(
        uint256 indexed buyOrderId,
        uint256 indexed sellOrderId,
        uint8 outcome,
        uint256 price,
        uint256 amount,
        uint256 quote,
        address matcher
    );

    constructor(address _market) {
        require(_market != address(0), "Market required");
        market = ICLOBPredictionMarket(_market);
        collateralToken = market.collateralToken();
        longToken = market.longToken();
        shortToken = market.shortToken();
    }

    modifier whenActive() {
        require(!market.receivedSettlementPrice(), "Market resolved");
        _;
    }

    function placeLimitOrder(
        Side side,
        Outcome outcome,
        uint256 price,
        uint256 amount
    ) external nonReentrant whenActive returns (uint256 orderId) {
        require(price > 0 && price <= PRICE_SCALE, "Invalid price");
        require(amount > 0, "Zero amount");

        orderId = nextOrderId++;
        uint256 escrow;

        if (side == Side.Buy) {
            escrow = _quoteUp(amount, price);
            collateralToken.safeTransferFrom(msg.sender, address(this), escrow);
        } else {
            escrow = amount;
            _outcomeToken(outcome).safeTransferFrom(msg.sender, address(this), escrow);
        }

        orders[orderId] = Order({
            id: orderId,
            maker: msg.sender,
            side: side,
            outcome: outcome,
            price: price,
            amountInitial: amount,
            amountRemaining: amount,
            escrowRemaining: escrow,
            status: Status.Open,
            createdAt: block.timestamp,
            filledAt: 0
        });
        _addOpenOrder(orderId, outcome, side);

        emit OrderPlaced(orderId, msg.sender, uint8(outcome), uint8(side), price, amount, escrow);
    }

    function cancelOrder(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        _requireOpen(order);
        require(order.maker == msg.sender, "Not maker");

        order.status = Status.Cancelled;
        _removeOpenOrder(orderId, order.outcome, order.side);

        uint256 returnedEscrow = order.escrowRemaining;
        order.escrowRemaining = 0;
        _transferEscrow(order.side, order.outcome, msg.sender, returnedEscrow);

        emit OrderCancelled(orderId, msg.sender, returnedEscrow);
    }

    /// @notice Fill a resting order directly. Use amountToFill=0 to fill the whole remaining order.
    function fillOrder(uint256 orderId, uint256 amountToFill) external nonReentrant whenActive {
        Order storage order = orders[orderId];
        _requireOpen(order);

        uint256 fillAmount = _fillAmount(amountToFill, order.amountRemaining);
        uint256 quote = _quoteForDirectFill(order, fillAmount);
        require(quote > 0, "Quote rounds to zero");

        order.amountRemaining -= fillAmount;
        if (order.side == Side.Buy) {
            order.escrowRemaining -= quote;
            _outcomeToken(order.outcome).safeTransferFrom(msg.sender, order.maker, fillAmount);
            collateralToken.safeTransfer(msg.sender, quote);
        } else {
            order.escrowRemaining -= fillAmount;
            collateralToken.safeTransferFrom(msg.sender, address(this), quote);
            collateralToken.safeTransfer(order.maker, quote);
            _outcomeToken(order.outcome).safeTransfer(msg.sender, fillAmount);
        }

        emit OrderFilled(
            orderId,
            order.maker,
            msg.sender,
            uint8(order.side),
            uint8(order.outcome),
            order.price,
            fillAmount,
            quote,
            order.amountRemaining
        );

        _finalizeIfFilled(order);
    }

    /// @notice Match crossed buy/sell limits already escrowed in this CLOB.
    /// Matching uses the seller's ask price. Use amountToFill=0 for max match.
    function matchOrders(
        uint256 buyOrderId,
        uint256 sellOrderId,
        uint256 amountToFill
    ) external nonReentrant whenActive {
        Order storage buyOrder = orders[buyOrderId];
        Order storage sellOrder = orders[sellOrderId];
        _requireOpen(buyOrder);
        _requireOpen(sellOrder);
        require(buyOrder.side == Side.Buy && sellOrder.side == Side.Sell, "Wrong sides");
        require(buyOrder.outcome == sellOrder.outcome, "Outcome mismatch");
        require(buyOrder.price >= sellOrder.price, "Not crossed");

        uint256 maxAmount = buyOrder.amountRemaining < sellOrder.amountRemaining
            ? buyOrder.amountRemaining
            : sellOrder.amountRemaining;
        uint256 fillAmount = _fillAmount(amountToFill, maxAmount);
        uint256 quote = _quoteUp(fillAmount, sellOrder.price);
        require(quote > 0, "Quote rounds to zero");
        require(quote <= buyOrder.escrowRemaining, "Insufficient bid escrow");

        buyOrder.amountRemaining -= fillAmount;
        buyOrder.escrowRemaining -= quote;
        sellOrder.amountRemaining -= fillAmount;
        sellOrder.escrowRemaining -= fillAmount;

        _outcomeToken(buyOrder.outcome).safeTransfer(buyOrder.maker, fillAmount);
        collateralToken.safeTransfer(sellOrder.maker, quote);

        emit OrdersMatched(
            buyOrderId,
            sellOrderId,
            uint8(buyOrder.outcome),
            sellOrder.price,
            fillAmount,
            quote,
            msg.sender
        );

        _finalizeIfFilled(buyOrder);
        _finalizeIfFilled(sellOrder);
    }

    function getOpenOrders(Outcome outcome, Side side) external view returns (uint256[] memory) {
        return openOrderIds[_bookKey(outcome, side)];
    }

    function getOrders(uint256[] calldata ids) external view returns (Order[] memory out) {
        out = new Order[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            out[i] = orders[ids[i]];
        }
    }

    function _finalizeIfFilled(Order storage order) private {
        if (order.amountRemaining != 0) return;

        order.status = Status.Filled;
        order.filledAt = block.timestamp;
        _removeOpenOrder(order.id, order.outcome, order.side);

        uint256 residual = order.escrowRemaining;
        if (residual == 0) return;

        order.escrowRemaining = 0;
        _transferEscrow(order.side, order.outcome, order.maker, residual);
    }

    function _quoteForDirectFill(Order storage order, uint256 fillAmount) private view returns (uint256) {
        uint256 quote = _quoteUp(fillAmount, order.price);
        if (order.side == Side.Buy && fillAmount == order.amountRemaining && quote > order.escrowRemaining) {
            return order.escrowRemaining;
        }
        return quote;
    }

    function _quoteUp(uint256 amount, uint256 price) private pure returns (uint256) {
        return Math.mulDiv(amount, price, PRICE_SCALE, Math.Rounding.Up);
    }

    function _fillAmount(uint256 requested, uint256 maxAmount) private pure returns (uint256) {
        require(maxAmount > 0, "No remaining amount");
        if (requested == 0) return maxAmount;
        require(requested <= maxAmount, "Fill too large");
        return requested;
    }

    function _requireOpen(Order storage order) private view {
        require(order.id != 0, "Order not found");
        require(order.status == Status.Open, "Order not open");
    }

    function _outcomeToken(Outcome outcome) private view returns (IERC20) {
        return outcome == Outcome.Yes ? longToken : shortToken;
    }

    function _transferEscrow(Side side, Outcome outcome, address to, uint256 amount) private {
        if (amount == 0) return;
        if (side == Side.Buy) {
            collateralToken.safeTransfer(to, amount);
        } else {
            _outcomeToken(outcome).safeTransfer(to, amount);
        }
    }

    function _addOpenOrder(uint256 orderId, Outcome outcome, Side side) private {
        bytes32 key = _bookKey(outcome, side);
        openOrderIndexPlusOne[orderId] = openOrderIds[key].length + 1;
        openOrderIds[key].push(orderId);
    }

    function _removeOpenOrder(uint256 orderId, Outcome outcome, Side side) private {
        uint256 indexPlusOne = openOrderIndexPlusOne[orderId];
        if (indexPlusOne == 0) return;

        bytes32 key = _bookKey(outcome, side);
        uint256 index = indexPlusOne - 1;
        uint256 lastIndex = openOrderIds[key].length - 1;

        if (index != lastIndex) {
            uint256 movedOrderId = openOrderIds[key][lastIndex];
            openOrderIds[key][index] = movedOrderId;
            openOrderIndexPlusOne[movedOrderId] = indexPlusOne;
        }

        openOrderIds[key].pop();
        delete openOrderIndexPlusOne[orderId];
    }

    function _bookKey(Outcome outcome, Side side) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(outcome, side));
    }
}
