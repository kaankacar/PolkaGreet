const { ethers } = require("hardhat");

// Relayer configuration
const RELAYER_PRIVATE_KEY = "56f260421bc7a40adf268d89e27fe35963ea3b84069cb4d2932ad32fd6bb33be";
const WESTEND_RPC_URL = "https://testnet-passet-hub-eth-rpc.polkadot.io";

// Contract addresses (will be updated after deployment)
const CONTRACTS = {
    metaTxRelayer: "", // To be filled after deployment
    polkaGreetContract: "" // To be filled after deployment
};

class PolkaGreetRelayer {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(WESTEND_RPC_URL);
        this.relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, this.provider);
        this.metaTxContract = null;
        this.greetContract = null;
    }

    async initialize(metaTxAddress, greetContractAddress) {
        console.log("🚀 Initializing PolkaGreet Relayer...");
        console.log("📍 Relayer Address:", this.relayerWallet.address);
        
        // Initialize contracts
        const metaTxABI = [
            "function execute((address from, address to, uint256 value, uint256 gas, uint256 nonce, bytes data) req, bytes signature) external payable returns (bool success, bytes returndata)",
            "function getNonce(address from) external view returns (uint256)"
        ];
        
        const greetABI = [
            "function sayHi() external",
            "function getCurrentGreeting() external view returns (string memory)",
            "function getLastGreeter() external view returns (address)",
            "function getGreetCount() external view returns (uint256)"
        ];

        this.metaTxContract = new ethers.Contract(metaTxAddress, metaTxABI, this.relayerWallet);
        this.greetContract = new ethers.Contract(greetContractAddress, greetABI, this.provider);
        
        console.log("✅ Relayer initialized successfully!");
    }

    async executeGreeting(userAddress, signature) {
        try {
            console.log(`👋 Processing greeting request from ${userAddress}`);
            
            // Get user's current nonce
            const nonce = await this.metaTxContract.getNonce(userAddress);
            console.log(`📊 User nonce: ${nonce}`);
            
            // Prepare the function call data for sayHi()
            const functionData = this.greetContract.interface.encodeFunctionData("sayHi");
            
            // Create the forward request
            const forwardRequest = {
                from: userAddress,
                to: await this.greetContract.getAddress(),
                value: 0,
                gas: 100000, // Sufficient gas for sayHi function
                nonce: nonce,
                data: functionData
            };

            console.log("📝 Forward Request:", forwardRequest);
            
            // Execute the meta-transaction
            const tx = await this.metaTxContract.execute(forwardRequest, signature);
            console.log("⏳ Transaction sent:", tx.hash);
            
            const receipt = await tx.wait();
            console.log("✅ Transaction confirmed! Block:", receipt.blockNumber);
            
            // Get the updated greeting
            const newGreeting = await this.greetContract.getCurrentGreeting();
            const greetCount = await this.greetContract.getGreetCount();
            
            console.log("🎉 New Greeting:", newGreeting);
            console.log("📈 Total Greets:", greetCount.toString());
            
            return {
                success: true,
                txHash: tx.hash,
                greeting: newGreeting,
                greetCount: greetCount.toString()
            };
            
        } catch (error) {
            console.error("❌ Error executing greeting:", error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getGreetingStatus() {
        try {
            const greeting = await this.greetContract.getCurrentGreeting();
            const lastGreeter = await this.greetContract.getLastGreeter();
            const greetCount = await this.greetContract.getGreetCount();
            
            return {
                greeting,
                lastGreeter,
                greetCount: greetCount.toString()
            };
        } catch (error) {
            console.error("Error getting greeting status:", error);
            return null;
        }
    }

    async startListening() {
        console.log("👂 Relayer is now listening for greeting requests...");
        console.log("💰 Relayer Balance:", ethers.formatEther(await this.provider.getBalance(this.relayerWallet.address)), "WND");
        
        // In a real implementation, this would listen to events or API calls
        // For demo purposes, we'll just log that we're ready
        console.log("🌸 PolkaGreet Relayer is ready to process meta-transactions!");
    }
}

// Export for use in other scripts
module.exports = { PolkaGreetRelayer };

// If run directly
if (require.main === module) {
    async function main() {
        const relayer = new PolkaGreetRelayer();
        
        // Check if contract addresses are provided
        if (process.argv.length < 4) {
            console.log("Usage: node polkagreet-relayer.js <metaTxAddress> <greetContractAddress>");
            return;
        }
        
        const metaTxAddress = process.argv[2];
        const greetContractAddress = process.argv[3];
        
        await relayer.initialize(metaTxAddress, greetContractAddress);
        await relayer.startListening();
    }
    
    main().catch(console.error);
} 