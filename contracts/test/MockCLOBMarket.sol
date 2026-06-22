// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockCLOBMarket {
    IERC20 public collateralToken;
    IERC20 public longToken;
    IERC20 public shortToken;
    bool public receivedSettlementPrice;

    constructor(IERC20 collateralToken_, IERC20 longToken_, IERC20 shortToken_) {
        collateralToken = collateralToken_;
        longToken = longToken_;
        shortToken = shortToken_;
    }

    function setResolved(bool resolved) external {
        receivedSettlementPrice = resolved;
    }
}
