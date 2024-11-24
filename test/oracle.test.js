const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Oracle Contract", function () {
    let Oracle, oracle;

    before(async function () {
        Oracle = await ethers.getContractFactory("Oracle");
        oracle = await Oracle.deploy();
        await oracle.deployed();
    });

    it("Should deploy successfully", async function () {
        expect(oracle.address).to.not.be.null;
    });

    it("Should set and get price correctly", async function () {
        await oracle.setPrice(100);
        const price = await oracle.getPrice();
        expect(price).to.equal(100);
    });
});
