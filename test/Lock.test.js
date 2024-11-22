const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Lock Contract", function () {
    let Lock, lock, unlockTime;
    const ONE_DAY_IN_SECONDS = 86400;

    before(async function () {
        unlockTime = (await ethers.provider.getBlock("latest")).timestamp + ONE_DAY_IN_SECONDS;
        Lock = await ethers.getContractFactory("Lock");
        lock = await Lock.deploy(unlockTime, { value: ethers.utils.parseEther("1") });
        await lock.deployed();
    });

    it("Should deploy successfully", async function () {
        expect(await lock.unlockTime()).to.equal(unlockTime);
        expect(await lock.owner()).to.equal((await ethers.getSigners())[0].address);
    });

    it("Should not allow withdrawal before unlock time", async function () {
        await expect(lock.withdraw()).to.be.revertedWith("You can't withdraw yet");
    });

    it("Should allow withdrawal after unlock time", async function () {
        await ethers.provider.send("evm_increaseTime", [ONE_DAY_IN_SECONDS]);
        await ethers.provider.send("evm_mine", []);

        const initialBalance = await ethers.provider.getBalance((await ethers.getSigners())[0].address);
        const tx = await lock.withdraw();
        const receipt = await tx.wait();
        const gasUsed = receipt.gasUsed.mul(tx.gasPrice);

        const finalBalance = await ethers.provider.getBalance((await ethers.getSigners())[0].address);
        expect(finalBalance).to.equal(initialBalance.add(ethers.utils.parseEther("1")).sub(gasUsed));
    });
});
