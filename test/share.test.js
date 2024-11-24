const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Share Contract", function () {
    let Share, share, owner, addr1;

    before(async function () {
        [owner, addr1] = await ethers.getSigners();
        Share = await ethers.getContractFactory("Share");
        share = await Share.deploy();
        await share.deployed();
    });

    it("Should deploy successfully", async function () {
        expect(await share.address).to.not.be.null;
    });

    it("Should mint tokens with proper role", async function () {
        await share.mint(owner.address, 1000);
        const balance = await share.balanceOf(owner.address);
        expect(balance).to.equal(1000);
    });

    it("Should prevent unauthorized minting", async function () {
        await expect(share.connect(addr1).mint(addr1.address, 500)).to.be.revertedWith(
            "AccessControl: account"
        );
    });

    it("Should allow role management", async function () {
        const MINTER_ROLE = await share.MINTER_ROLE();
        await share.grantRole(MINTER_ROLE, addr1.address);
        expect(await share.hasRole(MINTER_ROLE, addr1.address)).to.equal(true);
    });
});
