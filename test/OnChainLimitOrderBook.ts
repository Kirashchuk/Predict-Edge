import { expect } from "chai";
import { ethers } from "hardhat";

const Side = { Buy: 0, Sell: 1 } as const;
const Outcome = { Yes: 0, No: 1 } as const;

const usdc = (value: string) => ethers.parseUnits(value, 6);
const price = (value: string) => ethers.parseUnits(value, 18);

describe("OnChainLimitOrderBook", () => {
  async function fixture() {
    const [buyer, seller, taker, keeper] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockERC20");
    const collateral = await Token.deploy("USD Coin", "USDC", 6);
    const yes = await Token.deploy("YES", "YES", 6);
    const no = await Token.deploy("NO", "NO", 6);

    const Market = await ethers.getContractFactory("MockCLOBMarket");
    const market = await Market.deploy(await collateral.getAddress(), await yes.getAddress(), await no.getAddress());

    const CLOB = await ethers.getContractFactory("OnChainLimitOrderBook");
    const clob = await CLOB.deploy(await market.getAddress());

    await collateral.mint(buyer.address, usdc("100"));
    await collateral.mint(taker.address, usdc("100"));
    await yes.mint(seller.address, usdc("100"));

    return { buyer, seller, taker, keeper, collateral, yes, no, market, clob };
  }

  it("matches crossed buy and sell orders from escrow", async () => {
    const { buyer, seller, keeper, collateral, yes, clob } = await fixture();
    const amount = usdc("10");

    await collateral.connect(buyer).approve(await clob.getAddress(), usdc("4"));
    await clob.connect(buyer).placeLimitOrder(Side.Buy, Outcome.Yes, price("0.4"), amount);

    await yes.connect(seller).approve(await clob.getAddress(), amount);
    await clob.connect(seller).placeLimitOrder(Side.Sell, Outcome.Yes, price("0.35"), amount);

    await clob.connect(keeper).matchOrders(1, 2, 0);

    expect(await yes.balanceOf(buyer.address)).to.equal(amount);
    expect(await collateral.balanceOf(seller.address)).to.equal(usdc("3.5"));
    expect(await collateral.balanceOf(buyer.address)).to.equal(usdc("96.5"));

    const buyOrder = await clob.orders(1);
    const sellOrder = await clob.orders(2);
    expect(buyOrder.status).to.equal(1);
    expect(sellOrder.status).to.equal(1);
  });

  it("allows direct partial fills and maker cancellation", async () => {
    const { seller, taker, collateral, yes, clob } = await fixture();
    const amount = usdc("10");
    const partial = usdc("4");

    await yes.connect(seller).approve(await clob.getAddress(), amount);
    await clob.connect(seller).placeLimitOrder(Side.Sell, Outcome.Yes, price("0.5"), amount);

    await collateral.connect(taker).approve(await clob.getAddress(), usdc("2"));
    await clob.connect(taker).fillOrder(1, partial);

    expect(await yes.balanceOf(taker.address)).to.equal(partial);
    expect(await collateral.balanceOf(seller.address)).to.equal(usdc("2"));

    const afterFill = await clob.orders(1);
    expect(afterFill.amountRemaining).to.equal(usdc("6"));
    expect(afterFill.status).to.equal(0);

    await clob.connect(seller).cancelOrder(1);
    expect(await yes.balanceOf(seller.address)).to.equal(usdc("96"));

    const cancelled = await clob.orders(1);
    expect(cancelled.status).to.equal(2);
  });

  it("refunds buy-order price improvement instead of overpaying the final taker", async () => {
    const { buyer, seller, taker, keeper, collateral, yes, clob } = await fixture();

    await yes.mint(taker.address, usdc("5"));

    await collateral.connect(buyer).approve(await clob.getAddress(), usdc("5"));
    await clob.connect(buyer).placeLimitOrder(Side.Buy, Outcome.Yes, price("0.5"), usdc("10"));

    await yes.connect(seller).approve(await clob.getAddress(), usdc("5"));
    await clob.connect(seller).placeLimitOrder(Side.Sell, Outcome.Yes, price("0.4"), usdc("5"));
    await clob.connect(keeper).matchOrders(1, 2, 0);

    await yes.connect(taker).approve(await clob.getAddress(), usdc("5"));
    await clob.connect(taker).fillOrder(1, 0);

    expect(await collateral.balanceOf(seller.address)).to.equal(usdc("2"));
    expect(await collateral.balanceOf(taker.address)).to.equal(usdc("102.5"));
    expect(await collateral.balanceOf(buyer.address)).to.equal(usdc("95.5"));
    expect(await yes.balanceOf(buyer.address)).to.equal(usdc("10"));

    const buyOrder = await clob.orders(1);
    expect(buyOrder.status).to.equal(1);
    expect(buyOrder.escrowRemaining).to.equal(0);
  });

  it("blocks new orders after market resolution", async () => {
    const { buyer, collateral, market, clob } = await fixture();

    await market.setResolved(true);
    await collateral.connect(buyer).approve(await clob.getAddress(), usdc("1"));

    await expect(
      clob.connect(buyer).placeLimitOrder(Side.Buy, Outcome.Yes, price("0.5"), usdc("2")),
    ).to.be.revertedWith("Market resolved");
  });
});
