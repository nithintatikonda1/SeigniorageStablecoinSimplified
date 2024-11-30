const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("HighRiskBond Contract (Enhanced Tests)", function () {
    let HighRiskBond, highRiskBond, owner, addr1, addr2;

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();
        HighRiskBond = await ethers.getContractFactory("contracts/HighRiskBond.sol:HighRiskBond");
        highRiskBond = await HighRiskBond.deploy();
    });

    it("Should deploy successfully with correct details", async function () {
        expect(highRiskBond.address).to.not.be.null;

        // Verify token details
        const name = await highRiskBond.name();
        const symbol = await highRiskBond.symbol();
        expect(name).to.equal("HighRiskBond");
        expect(symbol).to.equal("HRB");
    });

    it("Should have a default bond supply of 0", async function () {
        const bondSupply = await highRiskBond.totalSupply();
        expect(bondSupply).to.equal(0);
    });

    it("Should allow owner to grant MINTER_ROLE", async function () {
        await highRiskBond.grantMinterRole(addr1.address);
        const hasRole = await highRiskBond.hasRole(await highRiskBond.MINTER_ROLE(), addr1.address);
        expect(hasRole).to.be.true;
    });

    it("Should allow minter to mint bonds", async function () {
        await highRiskBond.grantMinterRole(addr1.address);

        // Mint 1000 tokens to addr2
        await highRiskBond.connect(addr1).mint(addr2.address, 1000);

        const balance = await highRiskBond.balanceOf(addr2.address);
        expect(balance).to.equal(1000);

        const totalSupply = await highRiskBond.totalSupply();
        expect(totalSupply).to.equal(1000);
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
        expect(totalSupply).to.equal(500);
    });

    it("Should correctly update total supply and balances after multiple transactions", async function () {
        await highRiskBond.grantMinterRole(addr1.address);

        // Mint tokens to multiple addresses
        await highRiskBond.connect(addr1).mint(addr2.address, 1000);
        await highRiskBond.connect(addr1).mint(owner.address, 500);

        // Burn some tokens
        await highRiskBond.connect(addr1).burnFromAddress(addr2.address, 300);

        const addr2Balance = await highRiskBond.balanceOf(addr2.address);
        const ownerBalance = await highRiskBond.balanceOf(owner.address);
        const totalSupply = await highRiskBond.totalSupply();

        expect(addr2Balance).to.equal(700); // 1000 - 300
        expect(ownerBalance).to.equal(500);
        expect(totalSupply).to.equal(1200); // 1000 + 500 - 300
    });
});
