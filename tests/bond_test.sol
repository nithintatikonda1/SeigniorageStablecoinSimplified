// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "remix_tests.sol";
import "../contracts/bond.sol";

contract BondTest {
    Bond private bond;

    function beforeAll() public {
        bond = new Bond();
    }

    function testDeployment() public {
        Assert.notEqual(address(bond), address(0), "Bond should be deployed.");
    }

    function testBondIssuance() public {
        bond.issue(address(this), 100);
        Assert.equal(bond.balanceOf(address(this)), 100, "Bond issuance should work.");
    }
}
