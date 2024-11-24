// SPDX-License-Identifier: MIT LICENSE

pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

import {Oracle} from "./oracle.sol";
import {Treasury} from "./treasury.sol";


contract Cash is ERC20, ERC20Burnable, Ownable, AccessControl {

    using SafeERC20 for ERC20;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    address public oracle;
    address public treasury;


    uint256 private one = 1e18;


    constructor () ERC20("Cash", "C") Ownable(msg.sender) {
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function grantMinterRole(address minter) public onlyOwner {
        _grantRole(MINTER_ROLE, minter);
    }

    function setOracle(address _oracle) public onlyOwner {
        oracle = _oracle;
    }

    function setTreasury(address _treasury) public onlyOwner {
        treasury = _treasury;
    }

    function mint(address receiver, uint256 amount) external {
        require(hasRole(MINTER_ROLE, msg.sender), "Not allowed to mint cash.");
        _mint(receiver, amount);
    }

    function burnFromAddress(address account, uint256 amount) public
    {
        require(hasRole(MINTER_ROLE, msg.sender), "Not allowed burn cash");
        _burn(account, amount);
    }

    function transfer(address recipient, uint256 amount) public override returns (bool) {
        uint256 cashPrice = Oracle(oracle).getPrice();
        if (cashPrice >= one * 95 / 100) {
            return super.transfer(recipient, amount);
        }

        // If cash price is under 0.95, Force the user to spend (1 - cashPrice) * amount.
        uint256 bondAmount = amount * (one - cashPrice) / one;

        require(amount + bondAmount <= this.balanceOf(msg.sender), "Insufficient supply");
        Treasury(treasury).buyBondsFromCashContract(bondAmount, cashPrice, msg.sender);

        // Perform the standard transfer
        return super.transfer(recipient, amount);
    }
}