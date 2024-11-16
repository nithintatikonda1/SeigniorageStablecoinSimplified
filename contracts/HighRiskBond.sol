// SPDX-License-Identifier: MIT LICENSE

pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";


contract HighRiskBond is ERC20, ERC20Burnable, Ownable, AccessControl {

    using SafeMath for uint256;
    using SafeERC20 for ERC20;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    
    mapping (address => uint256) private balances;

    uint256 private supplyAmount;

    constructor () ERC20("HighRiskBond", "HRB") Ownable(msg.sender) {
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function grantMinterRole(address minter) public onlyOwner {
        _grantRole(MINTER_ROLE, minter);
    }

    function mint(address receiver, uint256 amount) external {
        require(hasRole(MINTER_ROLE, msg.sender), "Not allowed to mint bonds.");
        supplyAmount = supplyAmount.add(amount);
        balances[receiver] = balances[receiver].add(amount);
        _mint(receiver, amount);
    }

    function burnFrom(address account, uint256 amount) public override
    {
        require(hasRole(MINTER_ROLE, msg.sender), "Not allowed burn bonds");
        super.burnFrom(account, amount);
    }
}