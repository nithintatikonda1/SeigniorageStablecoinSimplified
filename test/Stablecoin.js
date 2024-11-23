const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

describe("Stablecoin", function () {
  async function deployContracts() {
      const signers = await ethers.getSigners();
      const userAddresses = await Promise.all(signers.slice(1).map(async signer => await signer.getAddress()));
    
      // Deploy Cash
      const Cash = await ethers.getContractFactory("Cash");
      const cash = await Cash.deploy();
      await cash.waitForDeployment();
      const cashAddress = await cash.getAddress();
    
      // Deploy Bond
      const Bond = await ethers.getContractFactory("Bond");
      const bond = await Bond.deploy();
      await bond.waitForDeployment();
      const bondAddress = await bond.getAddress();
    
      // Deploy Share
      const Share = await ethers.getContractFactory("Share");
      const share = await Share.deploy();
      await share.waitForDeployment();
      const shareAddress = await share.getAddress();
    
      // Deploy Oracle
      const Oracle = await ethers.getContractFactory("Oracle");
      const oracle = await Oracle.deploy();
      await oracle.waitForDeployment();
      const oracleAddress = await oracle.getAddress();
    
      // Deploy Boardroom
      const Boardroom = await ethers.getContractFactory("Boardroom");
      const boardroom = await Boardroom.deploy(cashAddress, shareAddress);
      await boardroom.waitForDeployment();
      const boardroomAddress = await boardroom.getAddress();
    
      // **Deploy LowRiskBond**
      const LowRiskBond = await ethers.getContractFactory("Bond");
      const lowRiskBond = await LowRiskBond.deploy();
      await lowRiskBond.waitForDeployment();
      const lowRiskBondAddress = await lowRiskBond.getAddress();

      // **Deploy HighRiskBond**
      const HighRiskBond = await ethers.getContractFactory("Bond");
      const highRiskBond = await HighRiskBond.deploy();
      await highRiskBond.waitForDeployment();
      const highRiskBondAddress = await highRiskBond.getAddress();
    
      // Deploy Treasury with the new constructor arguments
      const Treasury = await ethers.getContractFactory("Treasury");
      const treasury = await Treasury.deploy(
        cashAddress,
        bondAddress,
        shareAddress,
        oracleAddress,
        boardroomAddress,
        lowRiskBondAddress,   // New parameter
        highRiskBondAddress   // New parameter
      );
      await treasury.waitForDeployment();
      const treasuryAddress = await treasury.getAddress();

      // Grant minting roles to the treasury
      await cash.grantMinterRole(treasuryAddress);
      await bond.grantMinterRole(treasuryAddress);
      await share.grantMinterRole(treasuryAddress);
      // **Grant minting roles for the new bonds**
      await lowRiskBond.grantMinterRole(treasuryAddress);
      await highRiskBond.grantMinterRole(treasuryAddress);

      // Mint 100 tokens to each user
      const mintAmount = ethers.parseUnits("200", 18);
      for (const userAddress of userAddresses) {
          const tx = await cash.mint(userAddress, mintAmount);
          await tx.wait();
      }

      return { cash, bond, share, oracle, boardroom, treasury, userAddresses, lowRiskBond, highRiskBond };
  }

  describe("Deployment", function () {
    it("Users should have correct cash balance", async function () {
      const { cash, userAddresses } = await loadFixture(deployContracts);

      // Check that each user has 100 tokens
      for (const userAddress of userAddresses) {
          const balance = await cash.balanceOf(userAddress);
          expect(balance).to.equal(ethers.parseUnits("200", 18));
      }
    });
  });

  describe("Low Tier Bond Purchase", function () {
      it("Low tier bonds should not be purchasable when price is $1", async function () {
        const { treasury } = await loadFixture(deployContracts);
        const [owner, otherAccount] = await ethers.getSigners();

        const bondAmount = ethers.parseUnits("100", 18);
        const targetPrice = ethers.parseUnits("1", 18);

        await expect(
          treasury.connect(otherAccount).lowTierBuyBonds(bondAmount, targetPrice)
        ).to.be.revertedWith("Treasury: cash price is not below $1");
      });

      it("Low tier bonds received should be greater than the amount of cash sent", async function () {
          const { cash, bond, oracle, treasury, userAddresses, lowRiskBond, highRiskBond} = await loadFixture(deployContracts);
          const [owner, otherAccount] = await ethers.getSigners();

          const cashPrice = ethers.parseUnits("0.95", 18);
          await oracle.setPrice(cashPrice);

          const bondAmount = ethers.parseUnits("1", 18);
          const targetPrice = cashPrice;

          // Approve treasury to burn cash from otherAccount
          await cash.connect(otherAccount).approve(await treasury.getAddress(), bondAmount);

          await treasury.connect(otherAccount).lowTierBuyBonds(bondAmount, targetPrice);

          const bondBalance = await lowRiskBond.balanceOf(await otherAccount.getAddress());
          expect(bondBalance).to.be.gt(bondAmount);
        });
    });
    describe("High Tier Bond Purchase", function () {
      it("High tier bonds should not be purchasable when price is $1", async function () {
        const { treasury } = await loadFixture(deployContracts);
        const [owner, otherAccount] = await ethers.getSigners();

        const bondAmount = ethers.parseUnits("100", 18);
        const targetPrice = ethers.parseUnits("1", 18);

        await expect(
          treasury.connect(otherAccount).highTierBuyBonds(bondAmount, targetPrice)
        ).to.be.revertedWith("Treasury: cash price is not below $1");
      });

      it("High tier bonds received should be greater than the amount of cash sent", async function () {
          const { cash, bond, oracle, treasury, userAddresses, lowRiskBond, highRiskBond} = await loadFixture(deployContracts);
          const [owner, otherAccount] = await ethers.getSigners();

          const cashPrice = ethers.parseUnits("0.95", 18);
          await oracle.setPrice(cashPrice);

          const bondAmount = ethers.parseUnits("1", 18);
          const targetPrice = cashPrice;

          // Approve treasury to burn cash from otherAccount
          await cash.connect(otherAccount).approve(await treasury.getAddress(), bondAmount);

          await treasury.connect(otherAccount).highTierBuyBonds(bondAmount, targetPrice);

          const bondBalance = await highRiskBond.balanceOf(await otherAccount.getAddress());
          expect(bondBalance).to.be.gt(bondAmount);
        });
    });
    describe("Bond Purchase", function () {
      it("Bonds should not be purchasable when price is $1", async function () {
        const { treasury } = await loadFixture(deployContracts);
        const [owner, otherAccount] = await ethers.getSigners();

        const bondAmount = ethers.parseUnits("100", 18);
        const targetPrice = ethers.parseUnits("1", 18);

        await expect(
          treasury.connect(otherAccount).buyBonds(bondAmount, targetPrice)
        ).to.be.revertedWith("Treasury: cash price is not below $1");
      });

      it("Bonds received should be greater than the amount of cash sent", async function () {
          const { cash, bond, oracle, treasury } = await loadFixture(deployContracts);
          const [owner, otherAccount] = await ethers.getSigners();

          const cashPrice = ethers.parseUnits("0.95", 18);
          await oracle.setPrice(cashPrice);

          const bondAmount = ethers.parseUnits("1", 18);
          const targetPrice = cashPrice;

          // Approve treasury to burn cash from otherAccount
          await cash.connect(otherAccount).approve(await treasury.getAddress(), bondAmount);

          await treasury.connect(otherAccount).buyBonds(bondAmount, targetPrice);

          const bondBalance = await bond.balanceOf(await otherAccount.getAddress());
          expect(bondBalance).to.be.gt(bondAmount);
        });
    });
    describe("Prolonged Price Depression", function () {
        it("Simulates prolonged price depression and late bond purchase", async function () {
            const { treasury, bond, oracle, cash } = await loadFixture(deployContracts);
            const [_, otherAccount] = await ethers.getSigners();

            const cashPrice = ethers.parseUnits("80", 16); // Set price to $0.80
            await oracle.setPrice(cashPrice);

            const bondAmount = ethers.parseUnits("100", 18);
            const targetPrice = cashPrice;

            // Simulate 30 days passing
            await time.increase(30 * 24 * 60 * 60);

            // User buys bonds after delay
            await treasury.connect(otherAccount).buyBonds(bondAmount, targetPrice);

            // Check bond balance
            const bondBalance = await bond.balanceOf(await otherAccount.getAddress());
            expect(bondBalance).to.be.greaterThan(bondAmount);
        });
    });
    describe("Rapid Price Recovery Simulation", function () {
        it("Simulates rapid price recovery and bond redemption", async function () {
            const { treasury, bond, cash, oracle } = await loadFixture(deployContracts);
            const [_, otherAccount] = await ethers.getSigners();

            const initialPrice = ethers.parseUnits("75", 16); // $0.75
            await oracle.setPrice(initialPrice);

            const bondAmount = ethers.parseUnits("200", 18);

            // Allocate seigniorage to the Treasury
            await treasury.allocateSeigniorage();

            // Check Treasury balance
            const treasuryBalance = await cash.balanceOf(await treasury.getAddress());

            await treasury.connect(otherAccount).buyBonds(bondAmount, initialPrice);

            // Check bond balance
            const bondBalance = await bond.balanceOf(await otherAccount.getAddress());
            expect(bondBalance).to.be.greaterThan(bondAmount);

            // Increase price to $1.10
            await oracle.setPrice(ethers.parseUnits("1.10", 18));
            treasury.allocateSeigniorage();

            // Redeem bonds
            await bond.connect(otherAccount).approve(await treasury.getAddress(), bondBalance);
            await treasury.connect(otherAccount).redeemBonds(bondBalance);

            const cashBalance = await cash.balanceOf(await otherAccount.getAddress());
            expect(cashBalance).to.be.greaterThan(bondAmount);
        });

    }); 

  });
  
