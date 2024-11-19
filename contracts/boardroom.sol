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


contract Boardroom is Context, Ownable {

    using SafeERC20 for ERC20;

    address public cash;
    address public share;

    uint256 public decimals = 18;
    uint256 public one = 1 * 10**decimals;

    uint256 public priceCeiling = 105 * 10**(decimals - 2); // price required for bond redemptions ($1.05)

    uint256 accumulatedSeigniorage; // for bond repayment
    uint256 shareHolderSeigniorage; // for payment to shareholders


    constructor (address _cash, address _share) Ownable(msg.sender) {
        cash = _cash;
        share = _share;
    }

}