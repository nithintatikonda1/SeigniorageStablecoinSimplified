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
      
        // Deploy Treasury
        const Treasury = await ethers.getContractFactory("Treasury");
        const treasury = await Treasury.deploy(
          cashAddress,
          bondAddress,
          shareAddress,
          oracleAddress,
          boardroomAddress
        );
        await treasury.waitForDeployment();
        const treasuryAddress = await treasury.getAddress();

        // Grant minting roles to the treasury
        await cash.grantMinterRole(treasuryAddress);
        await bond.grantMinterRole(treasuryAddress);
        await share.grantMinterRole(treasuryAddress);

        // Mint 100000000000000000000 to each user
        const mintAmount = ethers.parseUnits("100", 18);
        for (const userAddress of userAddresses) {
            const tx = await cash.mint(userAddress, mintAmount);
            await tx.wait();
        }

        return { cash, bond, share, oracle, boardroom, treasury, userAddresses};
    }
  
    describe("Deployment", function () {
      it("Users should have correct cash balance", async function () {
        const { cash, bond, share, oracle, boardroom, treasury, userAddresses } = await loadFixture(deployContracts);
  
        // Check that each user has 100000000000000000000 tokens
        for (const userAddress of userAddresses) {
            const balance = await cash.balanceOf(userAddress);
            expect(balance).to.equal(ethers.parseUnits("100", 18));
        }
      });
    });

    describe("Bond Purchase", function () {
        it("Bonds should not be purchaseable when price is $1", async function () {
          const { cash, bond, share, oracle, boardroom, treasury, userAddresses } = await loadFixture(deployContracts);
          const [owner, otherAccount] = await ethers.getSigners();

          const bondAmount = ethers.parseUnits("100", 18);
          const targetPrice = ethers.parseUnits("1", 18);

          await expect(
            treasury.connect(otherAccount).buyBonds(bondAmount, targetPrice)
          ).to.be.revertedWith("Treasury: cash price is not below $1");
        });

        it("Bonds received should be greater than the amount of cash sent", async function () {
            const { cash, bond, share, oracle, boardroom, treasury, userAddresses } = await loadFixture(deployContracts);
            const [owner, otherAccount] = await ethers.getSigners();

            const cashPrice = ethers.parseUnits("95", 16);
            await oracle.setPrice(cashPrice);
  
            const bondAmount = ethers.parseUnits("1", 18);
            const targetPrice = cashPrice;
            await treasury.connect(otherAccount).buyBonds(bondAmount, targetPrice);

            const bondBalance = await bond.balanceOf(await otherAccount.getAddress());
            expect(bondBalance).to.greaterThan(bondAmount);
            
          });
      });
  });
  