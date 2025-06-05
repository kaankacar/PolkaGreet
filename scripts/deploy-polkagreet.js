const { ethers } = require("hardhat");

async function main() {
    console.log("🌸 Deploying PolkaGreet Contracts to Westend...");
    
    const [deployer] = await ethers.getSigners();
    console.log("📍 Deploying with account:", deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "WND");

    // Deploy MetaTxRelayer first
    console.log("\n📦 Deploying MetaTxRelayer...");
    const MetaTxRelayer = await ethers.getContractFactory("MetaTxRelayer");
    const metaTxRelayer = await MetaTxRelayer.deploy();
    await metaTxRelayer.waitForDeployment();
    
    const metaTxAddress = await metaTxRelayer.getAddress();
    console.log("✅ MetaTxRelayer deployed to:", metaTxAddress);

    // Deploy PolkaGreetContract with MetaTxRelayer as trusted forwarder
    console.log("\n📦 Deploying PolkaGreetContract...");
    const PolkaGreetContract = await ethers.getContractFactory("PolkaGreetContract");
    const polkaGreetContract = await PolkaGreetContract.deploy(metaTxAddress);
    await polkaGreetContract.waitForDeployment();
    
    const greetAddress = await polkaGreetContract.getAddress();
    console.log("✅ PolkaGreetContract deployed to:", greetAddress);

    // Verify deployment by calling some functions
    console.log("\n🔍 Verifying deployment...");
    
    // Test direct greeting call
    console.log("📝 Testing direct greeting call...");
    const tx = await polkaGreetContract.sayHi();
    await tx.wait();
    
    const greeting = await polkaGreetContract.getCurrentGreeting();
    const greetCount = await polkaGreetContract.getGreetCount();
    
    console.log("🎉 Initial greeting:", greeting);
    console.log("📊 Greet count:", greetCount.toString());

    // Display summary
    console.log("\n" + "=".repeat(60));
    console.log("🎯 DEPLOYMENT SUMMARY");
    console.log("=".repeat(60));
    console.log("📍 MetaTxRelayer Address:", metaTxAddress);
    console.log("📍 PolkaGreetContract Address:", greetAddress);
    console.log("🔗 Network: Westend Asset Hub");
    console.log("💰 Total deployment cost: ~0.01 WND");
    
    console.log("\n🚀 Next Steps:");
    console.log("1. Update frontend with new contract addresses");
    console.log("2. Start the relayer script:");
    console.log(`   node scripts/polkagreet-relayer.js ${metaTxAddress} ${greetAddress}`);
    console.log("3. Test the PolkaGreet dapp!");
    
    // Save addresses to a file for easy access
    const fs = require('fs');
    const contractAddresses = {
        network: "westend",
        metaTxRelayer: metaTxAddress,
        polkaGreetContract: greetAddress,
        deployedAt: new Date().toISOString()
    };
    
    fs.writeFileSync('contract-addresses.json', JSON.stringify(contractAddresses, null, 2));
    console.log("\n📄 Contract addresses saved to contract-addresses.json");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    }); 