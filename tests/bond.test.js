const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Bond Contract", function () {
    let Bond, bond;

    before(async function () {
        Bond = await ethers.getContractFactory("Bond");
        bond = await Bond.deploy();
        await bond.deployed();
    });

    it("Should deploy successfully", async function () {
        expect(bond.address).to.not.be.null;
    });

    it("Should issue bonds correctly", async function () {
        const [owner] = await ethers.getSigners();
        await bond.issue(owner.address, 100);
        const balance = await bond.balanceOf(owner.address);
        expect(balance).to.equal(100);
    });
});
