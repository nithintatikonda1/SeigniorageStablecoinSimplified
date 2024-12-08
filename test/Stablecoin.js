const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const fs = require('fs');
const csv = require('csv-parser');
const { start } = require("repl");



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

      // Set oracle and treasury in cash contract
      await cash.setOracle(oracleAddress);
      await cash.setTreasury(treasuryAddress)

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
    describe("Bond Redemption", function () {
      it("Bond redeption working", async function () {
        const { cash, bond, oracle, treasury } = await loadFixture(deployContracts);
        const [owner, otherAccount] = await ethers.getSigners();

        const startingCashBalance = await cash.balanceOf(await otherAccount.getAddress());

        const cashPrice = ethers.parseUnits("0.95", 18);
        await oracle.setPrice(cashPrice);

        const bondAmount = ethers.parseUnits("100", 18);
        const targetPrice = cashPrice;

        // Approve treasury to burn cash from otherAccount
        await cash.connect(otherAccount).approve(await treasury.getAddress(), bondAmount);
        await treasury.connect(otherAccount).buyBonds(bondAmount, targetPrice);

        await oracle.setPrice(ethers.parseUnits("1.05", 18));
        await treasury.allocateSeigniorage();

        await treasury.connect(otherAccount).redeemBonds(await bond.balanceOf(await otherAccount.getAddress()));

        const finalCashBalance = await cash.balanceOf(await otherAccount.getAddress());

        console.log(finalCashBalance);
        expect(finalCashBalance).to.be.gt(startingCashBalance);
      });
      it("Time based bonds working", async function () {
          const { cash, bond, oracle, treasury } = await loadFixture(deployContracts);
          const [owner, otherAccount] = await ethers.getSigners();

          const startingCashBalance = await cash.balanceOf(await otherAccount.getAddress());

          const cashPrice = ethers.parseUnits("0.95", 18);
          await oracle.setPrice(cashPrice);

          const bondAmount = ethers.parseUnits("100", 18);
          const targetPrice = cashPrice;

          // Approve treasury to burn cash from otherAccount
          await cash.connect(otherAccount).approve(await treasury.getAddress(), bondAmount);
          await treasury.connect(otherAccount).buyBonds(bondAmount, targetPrice);

          // Wait 30 days
          await time.increase(2592000);
          await oracle.setPrice(ethers.parseUnits("1.05", 18));
          await treasury.allocateSeigniorage();

          await treasury.connect(otherAccount).redeemBonds(await bond.balanceOf(await otherAccount.getAddress()));

          const finalCashBalance = await cash.balanceOf(await otherAccount.getAddress());

          console.log(finalCashBalance);
          expect(finalCashBalance).to.be.gt(startingCashBalance);
        });
    });
    describe("Transferring Cash", function () {
      it("Cash transfer should occur normally when price is 1 or more", async function () {
        const { cash, bond, oracle, treasury } = await loadFixture(deployContracts);
        const [owner, account1, account2] = await ethers.getSigners();

        // Transfer cash from account1 to account2
        const cashAmount = ethers.parseUnits("100", 18);
        await cash.connect(account1).approve(await account2.getAddress(), cashAmount);
        await cash.connect(account1).transfer(account2.address, cashAmount);

        account1Balance = await cash.balanceOf(await account1.getAddress());
        account2Balance = await cash.balanceOf(await account2.getAddress());

        account1Bonds = await bond.balanceOf(await account1.getAddress());

        expect(account1Balance).to.equal(ethers.parseUnits("100", 18));
        expect(account2Balance).to.equal(ethers.parseUnits("300", 18));
        expect(account1Bonds).to.equal(ethers.parseUnits("0", 18));
      });

      it("Cash transfer force bonds purchase when price is below 0.95", async function () {
        const { cash, bond, oracle, treasury } = await loadFixture(deployContracts);
        const [owner, account1, account2] = await ethers.getSigners();

        oracle.setPrice(ethers.parseUnits("0.90", 18));

        // Transfer cash from account1 to account2
        const cashAmount = ethers.parseUnits("100", 18);
        await cash.connect(account1).approve(await account2.getAddress(), cashAmount);
        await cash.connect(account1).transfer(account2.address, cashAmount);

        account1Balance = await cash.balanceOf(await account1.getAddress());
        account2Balance = await cash.balanceOf(await account2.getAddress());

        account1Bonds = await bond.balanceOf(await account1.getAddress());

        expect(account1Balance).to.be.lt(ethers.parseUnits("100", 18));
        expect(account2Balance).to.equal(ethers.parseUnits("300", 18));
        expect(account1Bonds).to.be.gt(ethers.parseUnits("10", 18));
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

    describe("Basis Cash Depegging Simulation", function () {
      it("Simulates transactions that occurred during Basis Cash depeg", async function () {
          const { treasury, bond, cash, oracle } = await loadFixture(deployContracts);
          const [_, account1, account2] = await ethers.getSigners();

          const startingSupply1 = ethers.parseUnits("45120197.197678980428723026", 18);
          const startingSupply2 = ethers.parseUnits("40000000", 18);
          const tx = await cash.mint(await account1.getAddress(), startingSupply1);
          await tx.wait();
          const tx2 = await cash.mint(await account2.getAddress(), startingSupply2);
          await tx2.wait();
          const startingSupply = (await cash.totalSupply()).toString();

          const rows = [];

          const processCSV = async function processCSV(filePath) {
            return new Promise((resolve, reject) => {
              const rows = [];
              fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => {
                  rows.push(row);
                })
                .on('end', async () => {
                  //console.log(`Start Supply: ${await cash.totalSupply()}`);
                  let prevDay = 0;
                  let flip = false;
                  for (const row of rows) {
                    const amount = row['Amount'];
                    const price = row['price'];
                    const day = row['day'];


                    if (amount == 0 || amount.includes('e')) {
                      continue;
                    }

                    //console.log(amount.toString(), price.toString());

                    const stablecoinAmount = ethers.parseUnits(amount.toString(), 18);
                    const stablecoinPrice = ethers.parseUnits(price.toString(), 18);


                    // Set the stablecoin price
                    await oracle.setPrice(stablecoinPrice);

                    // Simulate the transaction
                    if (flip) {
                      await cash.connect(account1).transfer(await account2.getAddress(), stablecoinAmount);
                      flip = false;
                    } else {
                      await cash.connect(account2).transfer(await account1.getAddress(), stablecoinAmount);
                      flip = true;
                    }


                    if (day != prevDay) {
                      prevDay = day;
                      console.log('Bond',(await cash.totalSupply()).toString());
                      console.log('Cash',(await bond.totalSupply()).toString());
                    }
                  }

                  //console.log(`End Supply: ${await cash.totalSupply()}`);
                  resolve();
                })
                .on('error', (err) => {
                  console.error('Error reading the CSV:', err);
                  reject(err);
                });
            });
          }
          
          await processCSV('data/transactions.csv');
          expect(startingSupply1).to.be.gt(await cash.totalSupply());

      });

    });

    describe("Terra USD Depegging Simulation", function () {
      it("Simulates transactions that occurred during Basis Cash depeg", async function () {
          const { treasury, bond, cash, oracle } = await loadFixture(deployContracts);
          const [_, account1, account2] = await ethers.getSigners();

          const startingSupply1 = ethers.parseUnits("160629796", 18);
          const startingSupply2 = ethers.parseUnits("160629796", 18);
          const tx = await cash.mint(await account1.getAddress(), startingSupply1);
          await tx.wait();
          const tx2 = await cash.mint(await account2.getAddress(), startingSupply2);
          await tx2.wait();
          const startingSupply = (await cash.totalSupply()).toString();

          const rows = [];

          const diffs = [71664813.98602748,
            -38239122.778380275,
            348478622.50162053,
            39614930.19063258,
            -225449387.3836704,
            -68077275.18410712,
            25964370.105922163,
            28485822.67765498];

          const processCSV = async function processCSV(filePath) {
            return new Promise((resolve, reject) => {
              const rows = [];
              fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => {
                  rows.push(row);
                })
                .on('end', async () => {
                  console.log(`Start Supply: ${await cash.totalSupply()}`);
                  let prevDay = 0;
                  let flip = false;
                  let index = -1;
                  for (const row of rows) {
                    const amount = row['Amount'];
                    const price = row['price'];
                    const day = row['day'];


                    if (amount == 0 || amount.includes('e')) {
                      continue;
                    }

                    //console.log(day, amount.toString(), price.toString());

                    const stablecoinAmount = ethers.parseUnits(amount.toString(), 18);
                    const stablecoinPrice = ethers.parseUnits(price.toString(), 18);


                    // Set the stablecoin price
                    await oracle.setPrice(stablecoinPrice);

                    //console.log(await cash.balanceOf(await account1.getAddress()), await cash.balanceOf(await account2.getAddress()));

                    // Simulate the transaction
                    const a = Number(amount);
                    const x = await cash.balanceOf(await account1.getAddress());
                    const formattedBalance = ethers.formatUnits(x, 18);
                    const b = Number(formattedBalance);
                    const y = await cash.balanceOf(await account2.getAddress());
                    const formattedBalance2 = ethers.formatUnits(y, 18);
                    const c = Number(formattedBalance2);
                    

                    //console.log(a,b,c);
                    if (c >= a && c >= b) {
                      try {
                        const tx = await cash.connect(account2).transfer(await account1.getAddress(), stablecoinAmount);
                      } catch (error) {
                          break;
                      }

                    }
                    else if (b >= a && b >= c) {
                      try {
                        const tx = await cash.connect(account1).transfer(await account2.getAddress(), stablecoinAmount);
                      } catch (error) {
                          break;
                      }
                    }


                    if (day != prevDay) {
                      index = index + 1;
                      prevDay = day;
                      const s = ethers.formatUnits(await cash.totalSupply(), 18);
                      console.log(day, s.toString());
                      //console.log((await bond.totalSupply()).toString());

                      let change = diffs[index];
                      if (change > 0) {
                        const stablecoinAmount3 = ethers.parseUnits(change.toString(), 18);
                        await cash.mint(await account1.getAddress(), stablecoinAmount3);
                      }
                      else if (change < 0) {
                        change = Number(change * -1);
                        const converted1 = ethers.formatUnits(await cash.balanceOf(await account1.getAddress()), 18);
                        const converted2 = ethers.formatUnits(await cash.balanceOf(await account2.getAddress()), 18);
                        const amount1 = Math.min(change, converted1);
                        const amount2 = Math.min(change - amount1, converted2);

                        const stablecoinAmount1 = ethers.parseUnits(amount1.toString(), 18);
                        const stablecoinAmount2 = ethers.parseUnits(amount2.toString(), 18);

                        if (amount1 > 0) {
                          try {
                            const tx = await cash.burnOwner(await account1.getAddress(), stablecoinAmount1);
                          } catch (error) {
                              console.error('Transaction failed:', error.message);
                              break;
                          }
                        }
                        if (amount2 > 0) {
                          try {
                            const tx = await cash.burnOwner(await account2.getAddress(), stablecoinAmount2);
                          } catch (error) {
                              break;
                          }
                        }


                      }
                    }
                  }

                  console.log(`End Supply: ${ ethers.formatUnits(await cash.totalSupply(), 18)} `);
                  console.log(prevDay);
                  expect(Number(prevDay)).to.be.lt(Number(12));
                  resolve();
                })
                .on('error', (err) => {
                  console.error('Error reading the CSV:', err);
                  reject(err);
                });
            });
          }
          
          await processCSV('data/ust_transactions.csv');
          expect(startingSupply1).to.be.gt(await cash.totalSupply());

      });

    });

    describe("Time Based Bond Payouts", function () {
      it("Get Bond Payout for different amount of days (Every 5 days).", async function () {
        for (let i = 0; i < 150; i+=5) {
          const { cash, bond, oracle, treasury } = await loadFixture(deployContracts);
          const [owner, otherAccount] = await ethers.getSigners();

          const startingCashBalance = await cash.balanceOf(await otherAccount.getAddress());

          const cashPrice = ethers.parseUnits("0.95", 18);
          await oracle.setPrice(cashPrice);

          const bondAmount = ethers.parseUnits("200", 18);
          const targetPrice = cashPrice;

          // Approve treasury to burn cash from otherAccount
          await cash.connect(otherAccount).approve(await treasury.getAddress(), bondAmount);
          await treasury.connect(otherAccount).buyBonds(bondAmount, targetPrice);

          // Wait 30 days
          if (i != 0) {
            await time.increase(60 * 60 * 24 * i);
          }
          await oracle.setPrice(ethers.parseUnits("1.05", 18));
          await treasury.allocateSeigniorage();

          await treasury.connect(otherAccount).redeemBonds(await bond.balanceOf(await otherAccount.getAddress()));

          const finalCashBalance = await cash.balanceOf(await otherAccount.getAddress());

          console.log(ethers.formatUnits(finalCashBalance, 18));
        }

      });

    });

    
    describe("High Tier Bond Payouts", function () {
      it("Get Bond Payout for different amount of days (Every 5 days).", async function () {
        for (let i = 0; i < 150; i+=5) {
          const { cash, bond, oracle, treasury, userAddresses, lowRiskBond, highRiskBond} = await loadFixture(deployContracts);
          const [owner, otherAccount] = await ethers.getSigners();

          const tx = await cash.mint(await treasury.getAddress(), ethers.parseUnits("10000", 18));
          await tx.wait();

          const startingCashBalance = await cash.balanceOf(await otherAccount.getAddress());

          const cashPrice = ethers.parseUnits("0.95", 18);
          await oracle.setPrice(cashPrice);

          const bondAmount = ethers.parseUnits("200", 18);
          const targetPrice = cashPrice;

          // Approve treasury to burn cash from otherAccount
          await cash.connect(otherAccount).approve(await treasury.getAddress(), bondAmount);
          await treasury.connect(otherAccount).highTierBuyBonds(bondAmount, targetPrice);

          // Wait 30 days
          if (i != 0) {
            await time.increase(60 * 60 * 24 * i);
          }
          await oracle.setPrice(ethers.parseUnits("1.05", 18));
          await treasury.allocateSeigniorage();

          try {
            await treasury.connect(otherAccount).highTierRedeemBonds(await highRiskBond.balanceOf(await otherAccount.getAddress()));
            const finalCashBalance = await cash.balanceOf(await otherAccount.getAddress());

            console.log(ethers.formatUnits(finalCashBalance, 18));
          } catch (error) {
            console.error(0);
          }

          
        }

      });

    });

    describe("Low Tier Bond Payouts", function () {
      it("Get Bond Payout for different amount of days (Every 5 days).", async function () {
        for (let i = 0; i < 150; i+=5) {
          const { cash, bond, oracle, treasury, userAddresses, lowRiskBond, highRiskBond} = await loadFixture(deployContracts);
          const [owner, otherAccount] = await ethers.getSigners();

          const tx = await cash.mint(await treasury.getAddress(), ethers.parseUnits("10000", 18));
          await tx.wait();

          const startingCashBalance = await cash.balanceOf(await otherAccount.getAddress());

          const cashPrice = ethers.parseUnits("0.95", 18);
          await oracle.setPrice(cashPrice);

          const bondAmount = ethers.parseUnits("200", 18);
          const targetPrice = cashPrice;

          // Approve treasury to burn cash from otherAccount
          await cash.connect(otherAccount).approve(await treasury.getAddress(), bondAmount);
          await treasury.connect(otherAccount).lowTierBuyBonds(bondAmount, targetPrice);

          // Wait 30 days
          if (i != 0) {
            await time.increase(60 * 60 * 24 * i);
          }
          await oracle.setPrice(ethers.parseUnits("1.05", 18));
          await treasury.allocateSeigniorage();

          try {
            await treasury.connect(otherAccount).lowTierRedeemBonds(await lowRiskBond.balanceOf(await otherAccount.getAddress()));
            const finalCashBalance = await cash.balanceOf(await otherAccount.getAddress());

            console.log(ethers.formatUnits(finalCashBalance, 18));
          } catch (error) {
            console.error(0);
          }

          
        }

      });

    });

  });
  
