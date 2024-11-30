const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Oracle Contract", function () {
    let Oracle, oracle;

    before(async function () {
        Oracle = await ethers.getContractFactory("Oracle");
        oracle = await Oracle.deploy(); // Get the deployed contract directly
    });

    it("Should deploy successfully", async function () {
        expect(oracle.address).to.not.be.null; // Validate contract address
    });

    it("Should set and get price correctly", async function () {
        const price = ethers.parseUnits("1500", 18);
        await oracle.setPrice(price);
        const retrievedPrice = await oracle.getPrice();
        expect(retrievedPrice).to.equal(price);
    });
});
