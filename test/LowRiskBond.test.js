const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("HighRiskBond Contract (Corrected Tests)", function () {
    let HighRiskBond, highRiskBond, owner, addr1, addr2;

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();
        HighRiskBond = await ethers.getContractFactory("contracts/LowRiskBond.sol:HighRiskBond");
        highRiskBond = await HighRiskBond.deploy();
    });

    it("Should deploy successfully with correct initial setup", async function () {
        expect(highRiskBond.address).to.not.be.null;
        const totalSupply = await highRiskBond.totalSupply();
        expect(totalSupply).to.equal(0); // No tokens minted initially
    });

    it("Should allow owner to grant MINTER_ROLE", async function () {
        await highRiskBond.grantMinterRole(addr1.address);
        const hasRole = await highRiskBond.hasRole(
            await highRiskBond.MINTER_ROLE(),
            addr1.address
        );
        expect(hasRole).to.be.true;
    });

    it("Should allow minter to mint bonds", async function () {
        await highRiskBond.grantMinterRole(addr1.address);

        // Mint 1000 tokens to addr2
        await highRiskBond.connect(addr1).mint(addr2.address, 1000);

        const balance = await highRiskBond.balanceOf(addr2.address);
        expect(balance).to.equal(1000);

        const totalSupply = await highRiskBond.totalSupply();
        expect(totalSupply).to.equal(1000); // Total supply updated
    });

    it("Should not allow non-minter to mint bonds", async function () {
        await expect(highRiskBond.connect(addr1).mint(addr2.address, 1000)).to.be.revertedWith(
            "Not allowed to mint bonds."
        );
    });

    it("Should allow minter to burn bonds", async function () {
        await highRiskBond.grantMinterRole(addr1.address);

        // Mint 1000 tokens to addr2 and burn 500
        await highRiskBond.connect(addr1).mint(addr2.address, 1000);
        await highRiskBond.connect(addr1).burnFromAddress(addr2.address, 500);

        const balance = await highRiskBond.balanceOf(addr2.address);
        expect(balance).to.equal(500);

        const totalSupply = await highRiskBond.totalSupply();
        expect(totalSupply).to.equal(500); // Total supply updated
    });

    it("Should not allow non-minter to burn bonds", async function () {
        await highRiskBond.grantMinterRole(addr1.address);

        // Mint 1000 tokens to addr2
        await highRiskBond.connect(addr1).mint(addr2.address, 1000);

        await expect(highRiskBond.connect(addr2).burnFromAddress(addr2.address, 500)).to.be.revertedWith(
            "Not allowed burn bonds."
        );
    });
});
