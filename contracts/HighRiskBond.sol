// SPDX-License-Identifier: MIT LICENSE

pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract HighRiskBond is ERC20, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public stableToken;
    uint256 public bondConversionRate;
    uint256 public startTime;
    uint256 public endTime;
    uint256 public penaltyRate;
    uint256 public totalBondsIssued;

    event BondsMinted(address indexed user, uint256 amount);
    event BondsRedeemed(address indexed user, uint256 amount, uint256 penalty);

    constructor(IERC20 _stableToken, uint256 _startTime, uint256 _endTime, uint256 _initialRate, uint256 _penaltyRate)
        ERC20("HighRiskBond", "HRB")
    {
        require(_endTime > _startTime, "Invalid time range");
        require(_penaltyRate <= 1e18, "Penalty rate must be less than or equal to 100%");
        stableToken = _stableToken;
        startTime = _startTime;
        endTime = _endTime;
        bondConversionRate = _initialRate;
        penaltyRate = _penaltyRate;
    }

    function mintBonds(uint256 stableAmount) external {
        require(block.timestamp >= startTime && block.timestamp <= endTime, "Bond issuance not active");
        uint256 adjustedRate = getCurrentRate();
        uint256 bondAmount = stableAmount * adjustedRate / 1e18;
        stableToken.safeTransferFrom(msg.sender, address(this), stableAmount);
        _mint(msg.sender, bondAmount);
        totalBondsIssued += bondAmount;
        emit BondsMinted(msg.sender, bondAmount);
    }

    function redeemBonds(uint256 bondAmount) external {
        require(bondAmount > 0, "Invalid bond amount");
        _burn(msg.sender, bondAmount);
        uint256 stableAmount = bondAmount * 1e18 / bondConversionRate;
        uint256 penalty = calculatePenalty(bondAmount);
        stableToken.safeTransfer(msg.sender, stableAmount - penalty);
        emit BondsRedeemed(msg.sender, bondAmount, penalty);
    }

    function getCurrentRate() public view returns (uint256) {
        if (block.timestamp < startTime) {
            return bondConversionRate;
        }
        uint256 elapsed = block.timestamp - startTime;
        uint256 duration = endTime - startTime;
        return bondConversionRate + (elapsed * 2e18 / duration); // Higher risk, faster reward growth
    }

    function calculatePenalty(uint256 bondAmount) public view returns (uint256) {
        if (block.timestamp < endTime) {
            return 0; // No penalty for on-time redemption
        }
        uint256 lateDuration = block.timestamp - endTime;
        return (bondAmount * penaltyRate * lateDuration) / (1e18 * (block.timestamp - startTime));
    }
}