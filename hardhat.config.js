require("@nomicfoundation/hardhat-toolbox");
require("@parity/hardhat-polkadot");
require("dotenv").config();

// Use the private key from environment variable
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: '0.8.28',
    resolc: {
        version: '1.5.2',
        compilerSource: 'npm',
    },
    networks: {
        hardhat: {
            polkavm: true,
            nodeConfig: {
                nodeBinaryPath: '/Users/kaan/storage-hardhat1/polkadot-sdk/target/release/substrate-node',
                rpcPort: 8000,
                dev: true,
            },
            adapterConfig: {
                adapterBinaryPath: '/Users/kaan/storage-hardhat1/polkadot-sdk/target/release/eth-rpc',
                dev: true,
            },
        },
        localNode: {
            polkavm: true,
            url: `http://127.0.0.1:8545`,
            accounts: [PRIVATE_KEY],
        },
        westend: {
            polkavm: true,
            url: 'https://westend-asset-hub-eth-rpc.polkadot.io',
            accounts: [PRIVATE_KEY],
        },
        passetHub: {
            polkavm: true,
            url: 'https://testnet-passet-hub-eth-rpc.polkadot.io',
            accounts: [PRIVATE_KEY],
        },
    }
};
