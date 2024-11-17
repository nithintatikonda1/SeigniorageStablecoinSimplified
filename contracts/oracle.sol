// SPDX-License-Identifier: MIT LICENSE

pragma solidity ^0.8.26;

contract Oracle {

    uint256 public price = 1e18;


    constructor() {
    }

    function setPrice(uint256 _price) public {
        price = _price;
    }

    function getPrice() public view returns (uint256) {
        return price;
    }
}
