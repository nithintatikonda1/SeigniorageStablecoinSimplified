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
import {Context, Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
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

    uint256 public decimals = 18;
    uint256 public one = 1 * 10**decimals;

    uint256 public priceCeiling = 105 * 10**(decimals - 2); // price required for bond redemptions ($1.05)

    uint256 public earlyBonusPercentage = 30; // Bonus for early bond buyers (30%)
    uint256 public holdingRewardPercentage = 10; // Long-term holding reward (10%)
    uint256 public accumulatedSeigniorage; // Reserved for bond repayment

    mapping(address => uint256) public bondPurchaseTimestamp; // Tracks bond purchase times
    mapping(address => uint256) public bondBalance; // Tracks the total bonds held by the user



    constructor (address _cash, address _bond, address _share, address _oracle, address _boardroom) Ownable(msg.sender) {
        cash = _cash;
        bond = _bond;
        share = _share;
        oracle = _oracle;
        boardroom = _boardroom;
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
        require(amount > 0, "Treasury: cannot purchase bonds with zero amount");

        uint256 cashPrice = _getCashPrice();
        require(cashPrice <= targetPrice, "Treasury: cash price moved");
        require(
            cashPrice < one, // price must be less that $1 for bonds to be purchased
            "Treasury: cash price is not below $1"
        );

         // Calculate dynamic exchange rate and bonus
        uint256 dynamicRate = one * (one) / (cashPrice); // Inverse proportion to
        uint256 bonus = dynamicRate * (earlyBonusPercentage) / (100);
        uint256 totalBonds = amount * (dynamicRate + (bonus)) / (one);
        
        // Update weighted average timestamp
        uint256 oldBalance = bondBalance[msg.sender];
        uint256 newBalance = oldBalance + (totalBonds);
        
        // Weighted average: ((oldBalance * oldTimestamp) + (newBonds * currentTime))
        bondPurchaseTimestamp[msg.sender] =
        (bondPurchaseTimestamp[msg.sender] * (oldBalance) + (block.timestamp * (totalBonds))) / (newBalance);

        bondBalance[msg.sender] = newBalance; // Update bond balance
    
        console.log("Amount to burn:", amount);
        console.log("Amount cash:", Cash(cash).balanceOf(msg.sender));
        Cash(cash).burnFromAddress(msg.sender, amount); // Burn stablecoins
        Bond(bond).mint(msg.sender, totalBonds); // Mint bonds

    }

    function redeemBonds(uint256 amount) external {
        require(amount > 0, "Treasury: cannot redeem bonds with zero amount");

        uint256 cashPrice = _getCashPrice();
        require(
            cashPrice > priceCeiling, // price > $1.05
            "Treasury: cashPrice not eligible for bond purchase"
        );
        // Calculate holding rewards based on duration
        uint256 holdingDuration = block.timestamp - (bondPurchaseTimestamp[msg.sender]);
        uint256 holdingBonus = holdingDuration * (holdingRewardPercentage)/ (30 days);  
        // Reward grows over time
        uint256 totalCash = amount + (amount * (holdingBonus) / (100));
            
        require(
            Cash(cash).balanceOf(address(this)) >= totalCash,
            "Treasury: Insufficient cash reserves"
        );

        accumulatedSeigniorage = accumulatedSeigniorage - amount; // Reduce reserve
        Bond(bond).burnFromAddress(msg.sender, amount); // Burn bonds
        Cash(cash).transfer(msg.sender, totalCash); // Transfer stablecoins
    }

    function allocateSeigniorage() external {
        //_updateCashPrice();
        uint256 cashPrice = _getCashPrice();
        if (cashPrice <= priceCeiling) {
            return; // just advance epoch instead revert
        }

        // circulating supply
        uint256 percentage = cashPrice - one;
        uint256 seigniorage = circulatingSupply() * percentage / one;
        Cash(cash).mint(address(this), seigniorage);

        // Give treasury contract enough cash to repay bonds.
        uint256 treasuryReserve =
            Math.min(
                seigniorage,
                IERC20(bond).totalSupply() - accumulatedSeigniorage
            );
        if (treasuryReserve > 0) {
            // This contract should not take more than 80% of the Seigniorage
            // Some cash should be saved to give to share holders.
            if (treasuryReserve >= seigniorage * 80 / 100) {
                treasuryReserve = treasuryReserve * 80 / 100;
            }
            accumulatedSeigniorage = accumulatedSeigniorage + treasuryReserve;
        }

        // seigniorage to be allocated for the share holders.
        // TODO: transfer the shareHolderSeigniorage to share holders
        seigniorage -= treasuryReserve;
        if (seigniorage > 0) {
            Cash(cash).approve(boardroom, seigniorage);
            Cash(cash).transfer(boardroom, seigniorage);
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