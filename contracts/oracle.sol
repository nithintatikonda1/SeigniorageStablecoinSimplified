// SPDX-License-Identifier: MIT LICENSE

pragma solidity ^0.8.26;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract Oracle {
    using SafeMath for uint256;

    uint256 public price;


    constructor() {
    }

    function setPrice(uint256 _price) public {
        price = _price;
    }

    function consult(address, uint256 amountIn)
        external
        view
        returns (uint256)
    {
        return price.mul(amountIn).div(1e18);
    }

    event Updated(uint256 price0CumulativeLast, uint256 price1CumulativeLast);
}