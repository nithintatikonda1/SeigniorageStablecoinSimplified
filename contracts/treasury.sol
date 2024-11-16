// SPDX-License-Identifier: MIT LICENSE

pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

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

    uint256 accumulatedSeigniorage; // for bond repayment


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

    function _getCashPrice() internal view returns (uint256) {
        return Oracle(oracle).getPrice();
    }

    function buyBonds(uint256 amount, uint256 targetPrice) external {
        require(amount > 0, "Treasury: cannot purchase bonds with zero amount");

        uint256 cashPrice = _getCashPrice();
        require(cashPrice <= targetPrice, "Treasury: cash price moved");
        require(
            cashPrice < one, // price must be less that $1 for bonds to be purchased
            "Treasury: cash price is not below $1"
        );

        Cash(cash).burnFrom(_msgSender(), amount);
        Bond(bond).mint(_msgSender(), amount * one / cashPrice);
    }

    function redeemBonds(uint256 amount) external {
        require(amount > 0, "Treasury: cannot redeem bonds with zero amount");

        uint256 cashPrice = _getCashPrice();
        require(
            cashPrice > priceCeiling, // price > $1.05
            "Treasury: cashPrice not eligible for bond purchase"
        );
        require(
            IERC20(cash).balanceOf(address(this)) >= amount,
            "Treasury: treasury has no more budget"
        );

        accumulatedSeigniorage = accumulatedSeigniorage = Math.min(accumulatedSeigniorage, amount);

        Bond(bond).burnFrom(_msgSender(), amount);
        Cash(cash).approve(_msgSender(), amount);
        Cash(cash).transfer(_msgSender(), amount);

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

}