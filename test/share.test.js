const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Share Contract", function () {
    let Share, share, owner, addr1;

    before(async function () {
        [owner, addr1] = await ethers.getSigners();
        Share = await ethers.getContractFactory("Share");
        share = await Share.deploy();
    });

    it("Should deploy successfully", async function () {
        expect(await share.address).to.not.be.null;
    });

    it("Should mint tokens with proper role", async function () {
        await share.mint(owner.address, 1000);
        const balance = await share.balanceOf(owner.address);
        expect(balance).to.equal(1000);
    });
});
