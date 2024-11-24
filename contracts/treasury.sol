// SPDX-License-Identifier: MIT LICENSE

pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "hardhat/console.sol";

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Context} from "@openzeppelin/contracts/access/Ownable.sol";
import {Bond} from "./bond.sol";
import {Cash} from "./cash.sol";
import {Share} from "./share.sol";
import {Oracle} from "./oracle.sol";

contract Treasury is Context, Ownable {
    using SafeERC20 for ERC20;

    address public cash;
    address public bond;
    address public share;
    address public oracle;
    address public boardroom;

    // New variables
    address public lowRiskBond;
    address public highRiskBond;
    uint256 public highRiskBondLockupPeriod = 30 days;
    mapping(address => uint256) public highRiskBondPurchaseTimestamp;
    uint256 public highRiskRedemptionMultiplier = 100; // 100% (1x)
    uint256 public highRiskPenaltyRate = 20; // 20%
    // End of new variables

    uint256 public decimals = 18;
    uint256 public one = 1 * 10**decimals;

    uint256 public priceCeiling = 105 * 10**(decimals - 2); // Price required for bond redemptions ($1.05)

    uint256 public earlyBonusPercentage = 30; // Bonus for early bond buyers (30%)
    uint256 public holdingRewardPercentage = 10; // Long-term holding reward (10%)
    uint256 public accumulatedSeigniorage; // Reserved for bond repayment

    mapping(address => uint256) public bondPurchaseTimestamp; // Tracks bond purchase times

    modifier onlyCash() {
        require(msg.sender == cash, "Only the Cash contract can call this function.");
        _;
    }

    constructor(
        address _cash,
        address _bond,
        address _share,
        address _oracle,
        address _boardroom,
        address _lowRiskBond,
        address _highRiskBond
    ) Ownable(msg.sender) {
        cash = _cash;
        bond = _bond;
        share = _share;
        oracle = _oracle;
        boardroom = _boardroom;
        lowRiskBond = _lowRiskBond;
        highRiskBond = _highRiskBond;
        accumulatedSeigniorage = Cash(cash).balanceOf(address(this));
    }

    function getReserve() public view returns (uint256) {
        return accumulatedSeigniorage;
    }

    function circulatingSupply() public view returns (uint256) {
        return IERC20(cash).totalSupply() - accumulatedSeigniorage;
    }

    // Internal function to fetch the current stablecoin price from the oracle
    function _getCashPrice() internal view returns (uint256) {
        return Oracle(oracle).price();
    }

    function buyBonds(uint256 amount, uint256 targetPrice) external {
        buyBondsForAddress(amount, targetPrice, msg.sender);
    }

    function buyBondsFromCashContract(uint256 amount, uint256 targetPrice, address buyer) external onlyCash {
        buyBondsForAddress(amount, targetPrice, buyer);
    }

    function buyBondsForAddress(uint256 amount, uint256 targetPrice, address buyer) internal {
        require(amount > 0, "Treasury: cannot purchase bonds with zero amount");

        uint256 cashPrice = _getCashPrice();
        require(cashPrice <= targetPrice, "Treasury: cash price moved");
        require(
            cashPrice < one, // Price must be less than $1 for bonds to be purchased
            "Treasury: cash price is not below $1"
        );

        // Calculate dynamic exchange rate and bonus
        /*
        uint256 dynamicRate = (one * one) / cashPrice; // Inverse proportion to price
        uint256 bonus = (dynamicRate * earlyBonusPercentage) / 100;
        uint256 totalBonds = (amount * (dynamicRate + bonus)) / one;
        */
       uint256 totalBonds = amount * one / cashPrice;

        // Update weighted average timestamp
        uint256 oldBalance = Bond(bond).balanceOf(buyer);
        uint256 newBalance = oldBalance + totalBonds;

        // Weighted average: ((oldBalance * oldTimestamp) + (newBonds * currentTime)) / newBalance
        bondPurchaseTimestamp[buyer] = (
            (bondPurchaseTimestamp[buyer] * oldBalance) + (block.timestamp * totalBonds)
        ) / newBalance;

        Cash(cash).burnFromAddress(buyer, amount); // Burn stablecoins
        Bond(bond).mint(buyer, totalBonds); // Mint bonds
    }

    function redeemBonds(uint256 amount) external {
        require(amount > 0, "Treasury: cannot redeem bonds with zero amount");

        uint256 cashPrice = _getCashPrice();
        require(
            cashPrice > priceCeiling, // Price > $1.05
            "Treasury: cash price not eligible for bond redemption"
        );

        // Calculate holding rewards based on duration
        uint256 holdingDuration = block.timestamp - bondPurchaseTimestamp[msg.sender];
        uint256 holdingBonus = (holdingDuration * holdingRewardPercentage) / (30 days);
        //holdingBonus should not exceed 30%
        holdingBonus = Math.min(holdingBonus, 30);
        // Reward grows over time
        uint256 totalCash = amount + (amount * holdingBonus) / 100;

        require(
            Cash(cash).balanceOf(address(this)) >= totalCash,
            "Treasury: insufficient cash reserves"
        );

        accumulatedSeigniorage -= totalCash; // Reduce reserve
        Bond(bond).burnFromAddress(msg.sender, amount); // Burn bonds
        Cash(cash).transfer(msg.sender, totalCash); // Transfer stablecoins
    }

    // New functions

    function lowTierBuyBonds(uint256 amount, uint256 targetPrice) external {
        require(amount > 0, "Treasury: cannot purchase bonds with zero amount");

        uint256 cashPrice = _getCashPrice();
        require(cashPrice <= targetPrice, "Treasury: cash price moved");
        require(cashPrice < one, "Treasury: cash price is not below $1");

        uint256 maxPurchaseAmount = 1000 * 1e18; // Example limit
        require(amount <= maxPurchaseAmount, "Treasury: purchase amount exceeds low-tier limit");

        // Stable exchange rate
        uint256 bondAmount = (amount * one) / cashPrice;

        Cash(cash).burnFrom(msg.sender, amount);
        Bond(lowRiskBond).mint(msg.sender, bondAmount);
    }

    function highTierBuyBonds(uint256 amount, uint256 targetPrice) external {
        require(amount > 0, "Treasury: cannot purchase bonds with zero amount");

        uint256 cashPrice = _getCashPrice();
        require(cashPrice <= targetPrice, "Treasury: cash price moved");
        require(cashPrice < one, "Treasury: cash price is not below $1");

        uint256 maxPurchaseAmount = 5000 * 1e18; // Limit
        require(amount <= maxPurchaseAmount, "Treasury: purchase amount exceeds high-tier limit");

        uint256 bondAmount = (amount * one * 110) / (100 * cashPrice); // 10% bonus

        highRiskBondPurchaseTimestamp[msg.sender] = block.timestamp;

        Cash(cash).burnFrom(msg.sender, amount);
        Bond(highRiskBond).mint(msg.sender, bondAmount);
    }

    function lowTierRedeemBonds(uint256 amount) external {
        require(amount > 0, "Treasury: cannot redeem bonds with zero amount");

        uint256 cashPrice = _getCashPrice();
        require(cashPrice > priceCeiling, "Treasury: cash price not eligible for bond redemption");

        uint256 maxRedemptionAmount = 1000 * 1e18; // Conservative limit
        require(amount <= maxRedemptionAmount, "Treasury: redemption amount exceeds low-tier limit");

        uint256 treasuryBalance = IERC20(cash).balanceOf(address(this));
        require(treasuryBalance >= amount, "Treasury: insufficient treasury balance");

        Bond(lowRiskBond).burnFrom(msg.sender, amount);
        Cash(cash).transfer(msg.sender, amount);
    }

    function highTierRedeemBonds(uint256 amount) external {
        require(amount > 0, "Treasury: cannot redeem bonds with zero amount");

        uint256 purchaseTime = highRiskBondPurchaseTimestamp[msg.sender];
        require(purchaseTime > 0, "Treasury: no high-risk bonds purchased");
        require(
            block.timestamp >= purchaseTime + highRiskBondLockupPeriod,
            "Treasury: lock-up period not over"
        );

        uint256 cashPrice = _getCashPrice();
        uint256 redeemAmount;

        if (cashPrice > priceCeiling) {
            redeemAmount = (amount * highRiskRedemptionMultiplier) / 100; // Multiplier >= 100%
        } else if (cashPrice >= one && cashPrice <= priceCeiling) {
            redeemAmount = amount;
        } else {
            uint256 penaltyAmount = (amount * highRiskPenaltyRate) / 100;
            redeemAmount = amount - penaltyAmount;
        }

        highRiskBondPurchaseTimestamp[msg.sender] = 0;

        Bond(highRiskBond).burnFrom(msg.sender, amount);
        Cash(cash).transfer(msg.sender, redeemAmount);
    }

    // Updated allocateSeigniorage function

    function allocateSeigniorage() external {
        uint256 cashPrice = _getCashPrice();
        if (cashPrice <= priceCeiling) {
            return;
        }

        uint256 percentage = cashPrice - one;
        uint256 seigniorage = (circulatingSupply() * percentage) / one;
        Cash(cash).mint(address(this), seigniorage);

        uint256 totalLowRiskBonds = IERC20(lowRiskBond).totalSupply();
        uint256 totalHighRiskBonds = IERC20(highRiskBond).totalSupply();
        uint256 totalBonds = IERC20(bond).totalSupply();

        uint256 maxHighRiskRedemptionMultiplier = 120; // 120%
        uint256 maxHighRiskBondsRedemption = (totalHighRiskBonds * maxHighRiskRedemptionMultiplier) / 100;

        uint256 totalBondsToRepay = totalLowRiskBonds + maxHighRiskBondsRedemption + totalBonds;

        uint256 treasuryReserve = Math.min(
            seigniorage,
            totalBondsToRepay - accumulatedSeigniorage
        );

        if (treasuryReserve > 0) {
            uint256 maxTreasuryAllocation = (seigniorage * 98) / 100;
            if (treasuryReserve > maxTreasuryAllocation) {
                treasuryReserve = maxTreasuryAllocation;
            }
            accumulatedSeigniorage += treasuryReserve;
        }

        uint256 boardroomAllocation = seigniorage - treasuryReserve;
        if (boardroomAllocation > 0) {
            Cash(cash).approve(boardroom, boardroomAllocation);
            Cash(cash).transfer(boardroom, boardroomAllocation);
        }
    }

    // Governance: Adjust key parameters
    function setParameters(
        uint256 _priceCeiling,
        uint256 _earlyBonusPercentage,
        uint256 _holdingRewardPercentage
    ) external onlyOwner {
        priceCeiling = _priceCeiling;
        earlyBonusPercentage = _earlyBonusPercentage;
        holdingRewardPercentage = _holdingRewardPercentage;
    }
}
