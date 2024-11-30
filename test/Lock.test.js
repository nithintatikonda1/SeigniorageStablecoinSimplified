const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Lock Contract (Enhanced Tests)", function () {
    let Lock, lock, unlockTime, owner, addr1;
    const ONE_DAY_IN_SECONDS = 86400;

    // Manually convert Ether to Wei
    const parseEther = (value) => `${value}000000000000000000`; // Convert Ether to Wei as a string

    beforeEach(async function () {
        [owner, addr1] = await ethers.getSigners();
        unlockTime = (await ethers.provider.getBlock("latest")).timestamp + ONE_DAY_IN_SECONDS;
        Lock = await ethers.getContractFactory("Lock");
        lock = await Lock.deploy(unlockTime, { value: parseEther(1) });
    });

    it("Should deploy successfully", async function () {
        expect(await lock.unlockTime()).to.equal(unlockTime);
        expect(await lock.owner()).to.equal((await ethers.getSigners())[0].address);
    });

    it("Should not allow withdrawal before unlock time", async function () {
        await expect(lock.withdraw()).to.be.revertedWith("You can't withdraw yet");
    });

    it("Should not allow non-owner to withdraw", async function () {
        // Simulate time passing to unlock the contract
        await ethers.provider.send("evm_increaseTime", [ONE_DAY_IN_SECONDS + 1]);
        await ethers.provider.send("evm_mine");

        await expect(lock.connect(addr1).withdraw()).to.be.revertedWith("You aren't the owner");
    });
});
