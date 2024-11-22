const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Share Contract", function () {
    let Share, share;

    before(async function () {
        Share = await ethers.getContractFactory("Share");
        share = await Share.deploy();
        await share.deployed();
    });

    it("Should deploy successfully", async function () {
        expect(share.address).to.not.be.null;
    });

    it("Should mint tokens correctly", async function () {
        const [owner] = await ethers.getSigners();
        await share.mint(owner.address, 1000);
        const balance = await share.balanceOf(owner.address);
        expect(balance).to.equal(1000);
    });
});
