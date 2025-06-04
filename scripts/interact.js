const hre = require('hardhat');
const { ethers } = require('hardhat');

async function main() {
    console.log("🔗 Interacting with Meta-Transaction Relayer Contracts");
    
    // Replace with your deployed contract addresses
    // These addresses are from our previous deployment
    const metaTxRelayerAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
    const greetingContractAddress = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
    
    // Get signers
    const [deployer, relayer, user] = await ethers.getSigners();
    console.log(`Interacting as user: ${user.address}`);
    console.log(`Using relayer: ${relayer.address}\n`);

    // Get contract instances
    const MetaTxRelayer = await hre.ethers.getContractFactory('MetaTxRelayer');
    const metaTxRelayer = await MetaTxRelayer.attach(metaTxRelayerAddress);
    
    const GreetingContract = await hre.ethers.getContractFactory('GreetingContract');
    const greetingContract = await GreetingContract.attach(greetingContractAddress);

    // Get current state
    console.log("📋 Current Contract State:");
    const currentGreeting = await greetingContract.getGreeting();
    console.log(`Current greeting: "${currentGreeting}"`);
    
    const currentNonce = await metaTxRelayer.getNonce(user.address);
    console.log(`User's current nonce: ${currentNonce}\n`);

    // Prepare new greeting via meta-transaction
    const newGreeting = `Meta-TX at ${new Date().toLocaleTimeString()} 🚀`;
    console.log(`Setting new greeting: "${newGreeting}"`);
    
    // Encode function data
    const functionData = greetingContract.interface.encodeFunctionData('setGreeting', [newGreeting]);
    
    // Build forward request
    const chainId = await user.provider.getNetwork().then(n => n.chainId);
    const forwardRequest = {
        from: user.address,
        to: greetingContractAddress,
        value: 0,
        gas: 200000,
        nonce: Number(currentNonce),
        data: functionData,
    };

    // Create EIP-712 domain
    const domain = {
        name: "MetaTxRelayer",
        version: "1",
        chainId: chainId,
        verifyingContract: metaTxRelayerAddress,
    };

    const types = {
        ForwardRequest: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "value", type: "uint256" },
            { name: "gas", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "data", type: "bytes" },
        ],
    };

    // User signs the meta-transaction
    console.log("✍️ User signing meta-transaction...");
    const signature = await user.signTypedData(domain, types, forwardRequest);
    
    // Relayer executes the meta-transaction
    console.log("📡 Relayer executing meta-transaction...");
    const tx = await metaTxRelayer.connect(relayer).execute(forwardRequest, signature);
    
    // Wait for transaction confirmation
    const receipt = await tx.wait();
    console.log(`✅ Meta-transaction confirmed!`);
    console.log(`Transaction hash: ${receipt.hash}`);
    console.log(`Gas used: ${receipt.gasUsed}`);
    
    // Check updated state
    console.log("\n📋 Updated Contract State:");
    const updatedGreeting = await greetingContract.getGreeting();
    console.log(`Updated greeting: "${updatedGreeting}"`);
    
    const updatedNonce = await metaTxRelayer.getNonce(user.address);
    console.log(`User's updated nonce: ${updatedNonce}`);
    
    // Verify the transaction was successful
    if (updatedGreeting === newGreeting) {
        console.log("\n🎉 Meta-transaction executed successfully!");
        console.log("✅ Greeting was updated correctly");
        console.log("✅ User didn't pay gas fees");
        console.log("✅ Relayer paid gas on user's behalf");
    } else {
        console.log("\n❌ Something went wrong");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Error:', error);
        process.exit(1);
    }); 