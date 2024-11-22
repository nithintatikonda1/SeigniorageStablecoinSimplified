// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "remix_tests.sol";
import "../contracts/oracle.sol";

contract OracleTest {
    Oracle private oracle;

    function beforeAll() public {
        oracle = new Oracle();
    }

    function testDeployment() public {
        Assert.notEqual(address(oracle), address(0), "Oracle should be deployed.");
    }

    function testSetAndGetPrice() public {
        oracle.setPrice(100);
        Assert.equal(oracle.getPrice(), 100, "Price should be updated to 100.");
    }
}
