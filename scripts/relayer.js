const hre = require("hardhat");
const { ethers } = require("hardhat");

/**
 * Meta-Transaction Relayer Script
 * This script demonstrates how to:
 * 1. Create and sign a meta-transaction off-chain
 * 2. Submit it through the MetaTxRelayer contract
 * 3. Execute the target function gaslessly for the user
 */

// EIP-712 Domain and Type definitions
const EIP712_DOMAIN = {
    name: "MetaTxRelayer",
    version: "1",
    chainId: null, // Will be set dynamically
    verifyingContract: null, // Will be set dynamically
};

const FORWARD_REQUEST_TYPE = {
    ForwardRequest: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "gas", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "data", type: "bytes" },
    ],
};

/**
 * Creates and signs a meta-transaction
 */
async function createMetaTransaction(userWallet, targetContract, functionData, relayerContract) {
    const chainId = await userWallet.getChainId();
    const nonce = await relayerContract.getNonce(userWallet.address);
    
    // Build the forward request
    const forwardRequest = {
        from: userWallet.address,
        to: targetContract.address,
        value: 0,
        gas: 200000, // Estimate gas limit
        nonce: nonce.toNumber(),
        data: functionData,
    };

    // Set up domain for signing
    const domain = {
        ...EIP712_DOMAIN,
        chainId: chainId,
        verifyingContract: relayerContract.address,
    };

    // Sign the typed data
    const signature = await userWallet._signTypedData(domain, FORWARD_REQUEST_TYPE, forwardRequest);
    
    return { forwardRequest, signature };
}

/**
 * Main relayer function
 */
async function main() {
    console.log("🚀 Starting Meta-Transaction Relayer Demo");
    
    // Get signers
    const [relayer, user] = await ethers.getSigners();
    console.log(`Relayer address: ${relayer.address}`);
    console.log(`User address: ${user.address}`);

    // Get deployed contracts (assuming they're already deployed)
    // In a real scenario, you'd get these addresses from deployment
    let metaTxRelayer, greetingContract;
    
    try {
        // Try to get contracts from a previous deployment
        // This is a simplified approach - in production, you'd store addresses
        const MetaTxRelayer = await ethers.getContractFactory("MetaTxRelayer");
        const GreetingContract = await ethers.getContractFactory("GreetingContract");
        
        // For demo purposes, we'll deploy fresh contracts
        console.log("📝 Deploying contracts...");
        metaTxRelayer = await MetaTxRelayer.deploy();
        await metaTxRelayer.deployed();
        console.log(`MetaTxRelayer deployed at: ${metaTxRelayer.address}`);
        
        greetingContract = await GreetingContract.deploy(metaTxRelayer.address);
        await greetingContract.deployed();
        console.log(`GreetingContract deployed at: ${greetingContract.address}`);
        
    } catch (error) {
        console.error("❌ Error deploying contracts:", error);
        return;
    }

    // Check initial greeting
    const initialGreeting = await greetingContract.getGreeting();
    console.log(`📢 Initial greeting: "${initialGreeting}"`);

    // Prepare the meta-transaction
    const newGreeting = "Hello from Meta-Transaction! 🎉";
    const functionData = greetingContract.interface.encodeFunctionData("setGreeting", [newGreeting]);
    
    console.log("\n🔐 Creating meta-transaction...");
    console.log(`Target function: setGreeting("${newGreeting}")`);
    console.log(`Function data: ${functionData}`);

    try {
        // Create and sign the meta-transaction (user signs off-chain)
        const { forwardRequest, signature } = await createMetaTransaction(
            user,
            greetingContract,
            functionData,
            metaTxRelayer
        );

        console.log("\n✍️ Meta-transaction signed by user:");
        console.log("Forward Request:", {
            from: forwardRequest.from,
            to: forwardRequest.to,
            value: forwardRequest.value.toString(),
            gas: forwardRequest.gas.toString(),
            nonce: forwardRequest.nonce.toString(),
            data: forwardRequest.data,
        });
        console.log(`Signature: ${signature}`);

        // Submit the meta-transaction through the relayer
        console.log("\n📡 Submitting meta-transaction via relayer...");
        const tx = await metaTxRelayer.connect(relayer).execute(forwardRequest, signature);
        const receipt = await tx.wait();
        
        console.log(`✅ Meta-transaction executed!`);
        console.log(`Transaction hash: ${receipt.transactionHash}`);
        console.log(`Gas used: ${receipt.gasUsed}`);

        // Check the updated greeting
        const updatedGreeting = await greetingContract.getGreeting();
        console.log(`📢 Updated greeting: "${updatedGreeting}"`);

        // Verify the sender was correctly identified
        const messageInfo = await greetingContract.getMessageInfo();
        console.log(`\n🔍 Message info:`);
        console.log(`- Recognized sender: ${messageInfo.sender}`);
        console.log(`- Original user: ${user.address}`);
        console.log(`- Sender matches user: ${messageInfo.sender.toLowerCase() === user.address.toLowerCase()}`);

        // Check events
        const events = receipt.events.filter(e => e.event === "MetaTransactionExecuted");
        if (events.length > 0) {
            console.log(`\n📋 Meta-transaction event emitted:`);
            console.log(`- From: ${events[0].args.from}`);
            console.log(`- To: ${events[0].args.to}`);
            console.log(`- Success: ${events[0].args.success}`);
        }

        console.log("\n🎉 Meta-transaction demo completed successfully!");
        
    } catch (error) {
        console.error("❌ Error executing meta-transaction:", error);
    }
}

// Utility function to format addresses
function formatAddress(address) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Run the script
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = {
    createMetaTransaction,
    EIP712_DOMAIN,
    FORWARD_REQUEST_TYPE,
}; 