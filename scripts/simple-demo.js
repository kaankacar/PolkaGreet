const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Meta-Transaction Relayer Demo for PolkaVM");
    console.log("Following Polkadot documentation patterns\n");

    // Get signers (following the documentation pattern)
    const [deployer, relayer, user] = await ethers.getSigners();
    
    console.log("👥 Account Setup:");
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Relayer: ${relayer.address}`);
    console.log(`User: ${user.address}\n`);

    // Deploy contracts step by step (following docs pattern)
    console.log("📝 Deploying MetaTxRelayer...");
    const MetaTxRelayer = await ethers.getContractFactory("MetaTxRelayer");
    const metaTxRelayer = await MetaTxRelayer.deploy();
    await metaTxRelayer.waitForDeployment();
    console.log(`✅ MetaTxRelayer deployed at: ${await metaTxRelayer.getAddress()}`);

    console.log("\n📝 Deploying GreetingContract...");
    const GreetingContract = await ethers.getContractFactory("GreetingContract");
    const greetingContract = await GreetingContract.deploy(await metaTxRelayer.getAddress());
    await greetingContract.waitForDeployment();
    console.log(`✅ GreetingContract deployed at: ${await greetingContract.getAddress()}`);

    // Test initial state
    console.log("\n📋 Initial Contract State:");
    const initialGreeting = await greetingContract.getGreeting();
    console.log(`Initial greeting: "${initialGreeting}"`);

    const initialNonce = await metaTxRelayer.getNonce(user.address);
    console.log(`User's initial nonce: ${initialNonce}`);

    // Test direct call first (for comparison)
    console.log("\n🔄 Testing Direct Call:");
    const directGreeting = "Direct call test";
    const directTx = await greetingContract.connect(user).setGreeting(directGreeting);
    const directReceipt = await directTx.wait();
    console.log(`✅ Direct call completed. New greeting: "${await greetingContract.getGreeting()}"`);
    
    // Check the event from direct call
    const directEvent = directReceipt.logs.find(log => {
        try {
            const parsed = greetingContract.interface.parseLog(log);
            return parsed.name === "GreetingChanged";
        } catch {
            return false;
        }
    });
    if (directEvent) {
        const parsedEvent = greetingContract.interface.parseLog(directEvent);
        console.log(`📝 Direct call sender from event: ${parsedEvent.args.sender}`);
    }

    // Now test meta-transaction
    console.log("\n🔐 Testing Meta-Transaction:");
    
    // Prepare meta-transaction data
    const metaGreeting = "Hello from Meta-Transaction! 🎉";
    const functionData = greetingContract.interface.encodeFunctionData("setGreeting", [metaGreeting]);
    
    // Build the forward request (simplified EIP-712 approach)
    const chainId = await user.provider.getNetwork().then(n => n.chainId);
    const nonce = await metaTxRelayer.getNonce(user.address);
    
    const forwardRequest = {
        from: user.address,
        to: await greetingContract.getAddress(),
        value: 0,
        gas: 200000,
        nonce: Number(nonce),
        data: functionData,
    };

    console.log("📝 Forward Request:", {
        from: forwardRequest.from,
        to: forwardRequest.to,
        value: forwardRequest.value,
        gas: forwardRequest.gas,
        nonce: forwardRequest.nonce,
        dataLength: forwardRequest.data.length
    });

    // Create domain for EIP-712 signing
    const domain = {
        name: "MetaTxRelayer",
        version: "1",
        chainId: chainId,
        verifyingContract: await metaTxRelayer.getAddress(),
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

    // User signs the meta-transaction (off-chain)
    console.log("✍️ User signing meta-transaction...");
    const signature = await user.signTypedData(domain, types, forwardRequest);
    console.log(`Signature length: ${signature.length} characters`);

    // Relayer submits the meta-transaction
    console.log("📡 Relayer submitting meta-transaction...");
    const metaTx = await metaTxRelayer.connect(relayer).execute(forwardRequest, signature);
    const receipt = await metaTx.wait();

    console.log(`✅ Meta-transaction executed!`);
    console.log(`Transaction hash: ${receipt.hash}`);
    console.log(`Gas used: ${receipt.gasUsed}`);

    // Verify the result
    const finalGreeting = await greetingContract.getGreeting();
    console.log(`📢 Final greeting: "${finalGreeting}"`);

    // Check events to verify sender identification
    console.log("\n🔍 Sender Verification from Events:");
    
    // Find the GreetingChanged event
    const greetingEvent = receipt.logs.find(log => {
        try {
            const parsed = greetingContract.interface.parseLog(log);
            return parsed.name === "GreetingChanged";
        } catch {
            return false;
        }
    });

    if (greetingEvent) {
        const parsedEvent = greetingContract.interface.parseLog(greetingEvent);
        console.log(`Recognized sender from event: ${parsedEvent.args.sender}`);
        console.log(`Expected sender (user): ${user.address}`);
        console.log(`✅ Sender correctly identified: ${parsedEvent.args.sender.toLowerCase() === user.address.toLowerCase()}`);
    }

    // Find the MetaTransactionExecuted event
    const metaTxEvent = receipt.logs.find(log => {
        try {
            const parsed = metaTxRelayer.interface.parseLog(log);
            return parsed.name === "MetaTransactionExecuted";
        } catch {
            return false;
        }
    });

    if (metaTxEvent) {
        const parsedEvent = metaTxRelayer.interface.parseLog(metaTxEvent);
        console.log(`\n📋 Meta-transaction event details:`);
        console.log(`- From: ${parsedEvent.args.from}`);
        console.log(`- To: ${parsedEvent.args.to}`);
        console.log(`- Success: ${parsedEvent.args.success}`);
    }

    // Check nonce increment
    const finalNonce = await metaTxRelayer.getNonce(user.address);
    console.log(`\n📊 Nonce Management:`);
    console.log(`Final nonce: ${finalNonce}`);
    console.log(`✅ Nonce correctly incremented: ${Number(finalNonce) === Number(nonce) + 1}`);

    console.log("\n🎉 Meta-Transaction Demo Completed Successfully!");
    console.log("\n💡 Key Benefits Demonstrated:");
    console.log("   • User signed transaction without paying gas");
    console.log("   • Relayer paid gas fees on user's behalf");
    console.log("   • Original sender identity preserved in contract events");
    console.log("   • Replay protection via nonces");
    console.log("   • EIP-712 structured data signing");
}

// Run the demo
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error:", error);
        process.exit(1);
    }); 