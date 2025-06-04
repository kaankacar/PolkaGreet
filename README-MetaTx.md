# Meta-Transaction Relayer Contract 🚀

A PolkaVM smart contract implementation that validates EIP-712-style signed payloads and executes transactions on behalf of users, enabling gasless transactions for improved UX.

## 📝 Overview

Meta-transactions allow users to sign messages off-chain that a relayer submits on their behalf, making transactions gasless from the user's perspective. This greatly improves onboarding by eliminating the need for users to hold native tokens initially.

## 🏗️ Architecture

### Core Components

1. **MetaTxRelayer.sol** - The main forwarder contract that validates signatures and executes meta-transactions
2. **GreetingContract.sol** - A demo target contract that supports meta-transactions via ERC2771Context
3. **IERC2771Context.sol** - Interface and abstract contract for ERC2771 meta-transaction support
4. **relayer.js** - JavaScript script for creating and submitting meta-transactions

## 🔧 Technical Implementation

### EIP-712 Signature Structure

The system uses EIP-712 typed data signing with the following structure:

```javascript
const FORWARD_REQUEST_TYPE = {
    ForwardRequest: [
        { name: "from", type: "address" },      // Original sender
        { name: "to", type: "address" },        // Target contract
        { name: "value", type: "uint256" },     // ETH value to send
        { name: "gas", type: "uint256" },       // Gas limit
        { name: "nonce", type: "uint256" },     // Replay protection
        { name: "data", type: "bytes" },        // Function call data
    ],
};
```

### Domain Separator

```javascript
const EIP712_DOMAIN = {
    name: "MetaTxRelayer",
    version: "1",
    chainId: [network_chain_id],
    verifyingContract: [relayer_contract_address],
};
```

## 🔐 Signature Walkthrough

### Step 1: User Creates Transaction Intent

```javascript
// User wants to call setGreeting("Hello Meta-TX!")
const functionData = greetingContract.interface.encodeFunctionData(
    "setGreeting", 
    ["Hello Meta-TX!"]
);
```

### Step 2: Build Forward Request

```javascript
const forwardRequest = {
    from: userWallet.address,           // User's address
    to: greetingContract.address,       // Target contract
    value: 0,                           // No ETH transfer
    gas: 200000,                        // Gas limit
    nonce: await relayer.getNonce(user), // Current nonce
    data: functionData                  // Encoded function call
};
```

### Step 3: User Signs Typed Data (Off-chain)

```javascript
const signature = await userWallet._signTypedData(
    domain,                 // EIP-712 domain
    FORWARD_REQUEST_TYPE,   // Type definitions
    forwardRequest          // Data to sign
);
```

### Step 4: Relayer Submits Transaction

```javascript
const tx = await metaTxRelayer.connect(relayer).execute(
    forwardRequest, 
    signature
);
```

### Step 5: Contract Validates and Executes

1. **Nonce Check**: Prevents replay attacks
2. **Signature Verification**: Ensures user authorized the transaction
3. **Execution**: Calls target contract with original sender context
4. **Event Emission**: Records the meta-transaction execution

## 🚀 Getting Started

### Prerequisites

- Node.js v16+
- Hardhat
- Polkadot development environment

### Installation

```bash
npm install
```

### Compilation

```bash
npx hardhat compile
```

### Testing

```bash
npx hardhat test
```

## 🎬 Demo Transaction

### Option 1: Run Full Demo Script

```bash
npx hardhat run scripts/relayer.js --network hardhat
```

### Option 2: Step-by-Step Demo

1. **Deploy Contracts**:
```bash
npx hardhat ignition deploy ignition/modules/MetaTxDeploy.js --network hardhat
```

2. **Create Meta-Transaction** (in your dApp):
```javascript
const { createMetaTransaction } = require('./scripts/relayer');

// User signs off-chain
const { forwardRequest, signature } = await createMetaTransaction(
    userWallet,
    greetingContract,
    functionData,
    metaTxRelayer
);
```

3. **Submit via Relayer**:
```javascript
const tx = await metaTxRelayer.connect(relayer).execute(
    forwardRequest, 
    signature
);
```

### Expected Output

```
🚀 Starting Meta-Transaction Relayer Demo
Relayer address: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
User address: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC

📝 Deploying contracts...
MetaTxRelayer deployed at: 0x5FbDB2315678afecb367f032d93F642f64180aa3
GreetingContract deployed at: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512

📢 Initial greeting: "Hello, World!"

🔐 Creating meta-transaction...
Target function: setGreeting("Hello from Meta-Transaction! 🎉")

✍️ Meta-transaction signed by user:
Forward Request: { from: "0x3C44...", to: "0xe7f1...", ... }

📡 Submitting meta-transaction via relayer...
✅ Meta-transaction executed!
Transaction hash: 0x1234567890abcdef...
Gas used: 95847

📢 Updated greeting: "Hello from Meta-Transaction! 🎉"

🔍 Message info:
- Recognized sender: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
- Original user: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
- Sender matches user: true

🎉 Meta-transaction demo completed successfully!
```

## 🔧 Smart Contract API

### MetaTxRelayer

#### Functions

- `execute(ForwardRequest calldata req, bytes calldata signature)` - Execute a meta-transaction
- `getNonce(address from)` - Get current nonce for an address

#### Events

- `MetaTransactionExecuted(address indexed from, address indexed to, bytes indexed data, bool success, bytes returndata)`

### GreetingContract

#### Functions

- `setGreeting(string calldata newGreeting)` - Set a new greeting (supports meta-tx)
- `getGreeting()` - Get current greeting
- `getCurrentSender()` - Get the recognized sender address
- `isTrustedForwarder(address forwarder)` - Check if forwarder is trusted

## 🛡️ Security Features

1. **Replay Protection**: Nonce-based to prevent transaction replay
2. **Signature Verification**: EIP-712 typed data signing
3. **Sender Context**: Original sender is preserved in target contracts
4. **Gas Management**: Prevents out-of-gas attacks

## 🔮 Future Extensions

### 1. Fee Market Implementation

```solidity
struct RelayerFee {
    address token;        // Fee token (address(0) for ETH)
    uint256 amount;       // Fee amount
    address recipient;    // Fee recipient
}
```

### 2. Whitelisting & Access Control

```solidity
mapping(address => bool) public trustedRelayers;
mapping(address => bool) public allowedTargets;

modifier onlyTrustedRelayer() {
    require(trustedRelayers[msg.sender], "Unauthorized relayer");
    _;
}
```

### 3. Batch Meta-Transactions

```solidity
struct BatchRequest {
    ForwardRequest[] requests;
    bytes[] signatures;
}

function executeBatch(BatchRequest calldata batch) external;
```

### 4. Conditional Execution

```solidity
struct ConditionalRequest {
    ForwardRequest request;
    bytes condition;      // Encoded condition check
    uint256 expiration;   // Expiration timestamp
}
```

### 5. Gas Estimation & Optimization

```solidity
function estimateGas(ForwardRequest calldata req) 
    external 
    view 
    returns (uint256 gasEstimate);
```

### 6. Multi-Chain Support

- Cross-chain meta-transaction routing
- Chain-specific signature validation
- Unified nonce management across chains

## 📊 Gas Analysis

| Operation | Direct Call | Meta-Transaction | Overhead |
|-----------|-------------|------------------|----------|
| setGreeting() | ~45,000 gas | ~95,000 gas | ~50,000 gas |

The overhead includes:
- Signature verification (~3,000 gas)
- EIP-712 validation (~5,000 gas)
- Additional contract calls (~42,000 gas)

## 🤝 Integration Guide

### For dApp Developers

1. **Install the relayer client**:
```javascript
const { createMetaTransaction } = require('./meta-tx-relayer');
```

2. **Integrate with your UI**:
```javascript
// User clicks "Sign Transaction" (no gas required)
const signature = await createMetaTransaction(user, contract, data);

// Submit to your relayer service
await relayerService.submit(signature);
```

3. **Update your contracts**:
```solidity
import "./ERC2771Context.sol";

contract MyContract is ERC2771Context {
    constructor(address trustedForwarder) ERC2771Context(trustedForwarder) {}
    
    function myFunction() external {
        address sender = _msgSender(); // Works with both direct and meta-tx
        // ... your logic
    }
}
```

## 🌐 Deployment Addresses

### Westend Testnet
- MetaTxRelayer: `[To be deployed]`
- GreetingContract: `[To be deployed]`

## 📚 Resources

- [EIP-712: Typed structured data hashing and signing](https://eips.ethereum.org/EIPS/eip-712)
- [EIP-2771: Secure Protocol for Native Meta Transactions](https://eips.ethereum.org/EIPS/eip-2771)
- [OpenZeppelin Meta-Transactions](https://docs.openzeppelin.com/contracts/4.x/api/metatx)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

---

**Built for the Polkadot ecosystem with ❤️** 