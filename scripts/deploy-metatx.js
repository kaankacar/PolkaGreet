const hre = require("hardhat");

async function main() {
  console.log("Deploying MetaTxRelayer...");

  const MetaTxRelayer = await hre.ethers.getContractFactory("MetaTxRelayer");
  const metaTxRelayer = await MetaTxRelayer.deploy();

  await metaTxRelayer.waitForDeployment();

  console.log("MetaTxRelayer deployed to:", await metaTxRelayer.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 