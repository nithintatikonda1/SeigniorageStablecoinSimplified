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


contract Boardroom is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public shareToken;
    IERC20 public stableToken;
    uint256 public totalRewardsDistributed;

    mapping(address => uint256) public userShares;
    mapping(address => uint256) public userRewardDebt;
    uint256 public accRewardPerShare;
    uint256 public lastRewardTime;
    uint256 public rewardRate;

    event RewardDistributed(address indexed user, uint256 amount);
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);

    constructor(IERC20 _shareToken, IERC20 _stableToken, uint256 _rewardRate) {
        shareToken = _shareToken;
        stableToken = _stableToken;
        rewardRate = _rewardRate;
        lastRewardTime = block.timestamp;
    }

    modifier updateRewards() {
        if (block.timestamp > lastRewardTime) {
            uint256 timeElapsed = block.timestamp - lastRewardTime;
            uint256 rewards = timeElapsed * rewardRate;
            accRewardPerShare += rewards / shareToken.totalSupply();
            lastRewardTime = block.timestamp;
        }
        _;
    }

    function deposit(uint256 amount) external updateRewards {
        require(amount > 0, "Amount must be greater than zero");
        shareToken.safeTransferFrom(msg.sender, address(this), amount);
        userShares[msg.sender] += amount;
        userRewardDebt[msg.sender] = (userShares[msg.sender] * accRewardPerShare) / 1e18;
        emit Deposit(msg.sender, amount);
    }

    function withdraw(uint256 amount) external updateRewards {
        require(amount > 0 && userShares[msg.sender] >= amount, "Invalid withdraw amount");
        shareToken.safeTransfer(msg.sender, amount);
        userShares[msg.sender] -= amount;
        userRewardDebt[msg.sender] = (userShares[msg.sender] * accRewardPerShare) / 1e18;
        emit Withdraw(msg.sender, amount);
    }

    function claimRewards() external updateRewards {
        uint256 pendingReward = ((userShares[msg.sender] * accRewardPerShare) / 1e18) - userRewardDebt[msg.sender];
        require(pendingReward > 0, "No rewards to claim");
        stableToken.safeTransfer(msg.sender, pendingReward);
        userRewardDebt[msg.sender] = (userShares[msg.sender] * accRewardPerShare) / 1e18;
        totalRewardsDistributed += pendingReward;
        emit RewardDistributed(msg.sender, pendingReward);
    }
}