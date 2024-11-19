const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const signers = await ethers.getSigners();
  const userAddresses = await Promise.all(signers.slice(1).map(async signer => await signer.getAddress()));
  
  console.log("User addresses:", userAddresses);

  console.log("Deploying contracts with the account:", await deployer.getAddress());

  // Deploy Cash
  const Cash = await ethers.getContractFactory("Cash");
  const cash = await Cash.deploy();
  await cash.waitForDeployment();
  
  console.log("Cash address:", await cash.getAddress());

  // Deploy Bond
  const Bond = await ethers.getContractFactory("Bond");
  const bond = await Bond.deploy();
  await bond.waitForDeployment();
  
  console.log("Bond address:", await bond.getAddress());

  // Deploy Share
  const Share = await ethers.getContractFactory("Share");
  const share = await Share.deploy();
  await share.waitForDeployment();
  
  console.log("Share address:", await share.getAddress());

  // Deploy Oracle
  const Oracle = await ethers.getContractFactory("Oracle");
  const oracle = await Oracle.deploy();
  await oracle.waitForDeployment();
  
  console.log("Oracle address:", await oracle.getAddress());

  // Deploy Boardroom
  const Boardroom = await ethers.getContractFactory("Boardroom");
  const boardroom = await Boardroom.deploy(cash.getAddress(), share.getAddress());
  await boardroom.waitForDeployment();
  
  console.log("Boardroom address:", await boardroom.getAddress());

  // Deploy Treasury
  const Treasury = await ethers.getContractFactory("Treasury");
  const treasury = await Treasury.deploy(
    cash.getAddress(),
    bond.getAddress(),
    share.getAddress(),
    oracle.getAddress(),
    boardroom.getAddress()
  );
  await treasury.waitForDeployment();
  
  console.log("Treasury address:", await treasury.getAddress());

  console.log("All contracts deployed");

  // Mint 100000000000000000000 to each user
  const mintAmount = ethers.parseUnits("100", 18);
  for (const userAddress of userAddresses) {
    console.log(`Minting ${mintAmount} to ${userAddress}`);
    const tx = await cash.mint(userAddress, mintAmount);
    await tx.wait();
    console.log(`Minted ${mintAmount} to ${userAddress}`);
  }

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });