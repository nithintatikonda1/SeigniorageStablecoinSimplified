// SPDX-License-Identifier: MIT LICENSE

pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";


contract Cash is ERC20, ERC20Burnable, Ownable, AccessControl {

    using SafeERC20 for ERC20;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    
    mapping (address => uint256) private balances;

    uint256 private supplyAmount;

    constructor () ERC20("Cash", "C") Ownable(msg.sender) {
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function grantMinterRole(address minter) public onlyOwner {
        _grantRole(MINTER_ROLE, minter);
    }

    function mint(address receiver, uint256 amount) external {
        require(hasRole(MINTER_ROLE, msg.sender), "Not allowed to mint cash.");
        supplyAmount = supplyAmount + amount;
        balances[receiver] = balances[receiver] + amount;
        _mint(receiver, amount);
    }

    function burnFromAddress(address account, uint256 amount) public
    {
        require(hasRole(MINTER_ROLE, msg.sender), "Not allowed burn cash");
        _burn(account, amount);
    }
}