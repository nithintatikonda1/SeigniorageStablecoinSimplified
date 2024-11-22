// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "remix_tests.sol";
import "../contracts/share.sol";

contract ShareTest {
    Share private share;

    function beforeAll() public {
        share = new Share();
    }

    function testDeployment() public {
        Assert.notEqual(address(share), address(0), "Share should be deployed.");
    }

    function testMinting() public {
        share.mint(address(this), 1000);
        Assert.equal(share.balanceOf(address(this)), 1000, "Minting should increase balance.");
    }
}
