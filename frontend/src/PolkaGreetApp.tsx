import React, { useState, useEffect } from 'react';
import { ethers, BrowserProvider, Contract } from 'ethers';
import './PolkaGreetApp.css';

// Contract ABIs
const MetaTxRelayerABI = [
  "function execute((address from, address to, uint256 value, uint256 gas, uint256 nonce, bytes data) req, bytes signature) external payable returns (bool success, bytes returndata)",
  "function getNonce(address from) external view returns (uint256)"
];

const PolkaGreetContractABI = [
  "function sayHi() external",
  "function getCurrentGreeting() external view returns (string memory)",
  "function getLastGreeter() external view returns (address)",
  "function getGreetCount() external view returns (uint256)"
];

// Contract addresses - update these after deployment
const CONTRACTS = {
  metaTxRelayer: "0x6fb6E63C01B68e9EDB719e26048aaA62A372Fb95", // Updated with actual address
  polkaGreetContract: "0xD892416A56F0B01a1442De6F78EafEFaDb2D8211" // Updated with actual address
};

// Relayer wallet address (derived from the private key)
const RELAYER_ADDRESS = "0xfca1A55A31dd5408fA136D30031b94E63Efc325c"; // Updated with actual relayer address

interface GreetingInfo {
  greeting: string;
  lastGreeter: string;
  greetCount: number;
}

function PolkaGreetApp() {
  const [account, setAccount] = useState<string>('');
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [greetingInfo, setGreetingInfo] = useState<GreetingInfo>({
    greeting: "Welcome to PolkaGreet! 🌸",
    lastGreeter: '',
    greetCount: 0
  });
  const [loading, setLoading] = useState(false);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [txHash, setTxHash] = useState<string>('');
  const [isPartyMode, setIsPartyMode] = useState(false);

  useEffect(() => {
    checkWalletConnection();
    loadGreetingInfo();
    
    // Set up wallet event listeners
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', () => window.location.reload());
    }

    // Refresh greeting info every 10 seconds
    const interval = setInterval(loadGreetingInfo, 10000);
    
    return () => {
      clearInterval(interval);
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, []);

  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length > 0) {
      setAccount(accounts[0]);
      setIsWalletConnected(true);
    } else {
      setAccount('');
      setIsWalletConnected(false);
    }
  };

  const checkWalletConnection = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          await connectWallet();
        }
      } catch (error) {
        console.error('Error checking wallet connection:', error);
      }
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask to use PolkaGreet! 🦊');
      return;
    }

    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();
      
      // Check if we're on the correct network (Westend Asset Hub)
      if (Number(network.chainId) !== 420420421) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x19099EA5' }], // 420420421 in hex
          });
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x19099EA5',
                chainName: 'Paseo Asset Hub',
                nativeCurrency: {
                  name: 'PAS',
                  symbol: 'PAS',
                  decimals: 18
                },
                rpcUrls: ['https://testnet-passet-hub-eth-rpc.polkadot.io'],
                blockExplorerUrls: ['https://blockscout-passet-hub.parity-testnet.parity.io/']
              }]
            });
          } else {
            throw switchError;
          }
        }
      }

      setProvider(provider);
      setSigner(signer);
      setAccount(address);
      setIsWalletConnected(true);
    } catch (error) {
      console.error('Error connecting wallet:', error);
      alert('Failed to connect wallet. Please try again.');
    }
  };

  const loadGreetingInfo = async () => {
    try {
      const tempProvider = new ethers.JsonRpcProvider('https://testnet-passet-hub-eth-rpc.polkadot.io');
      const contract = new Contract(CONTRACTS.polkaGreetContract, PolkaGreetContractABI, tempProvider);
      
      const greeting = await contract.getCurrentGreeting();
      const lastGreeter = await contract.getLastGreeter();
      const greetCount = await contract.getGreetCount();
      
      setGreetingInfo({
        greeting,
        lastGreeter,
        greetCount: Number(greetCount)
      });
    } catch (error) {
      console.error('Error loading greeting info:', error);
    }
  };

  const sayHiWithMetaTx = async () => {
    if (!signer || !provider) {
      alert('Please connect your wallet first! 🦊');
      return;
    }

    try {
      setLoading(true);
      setTxHash('');
      setIsPartyMode(true);
      
      // Create the greeting contract instance
      const greetContract = new Contract(CONTRACTS.polkaGreetContract, PolkaGreetContractABI, provider);
      const metaTxContract = new Contract(CONTRACTS.metaTxRelayer, MetaTxRelayerABI, provider);
      
      // Get user's nonce
      const nonce = await metaTxContract.getNonce(account);
      
      // Prepare function call data
      const functionData = greetContract.interface.encodeFunctionData("sayHi");
      
      // Create forward request
      const forwardRequest = {
        from: account,
        to: CONTRACTS.polkaGreetContract,
        value: 0,
        gas: 100000,
        nonce: nonce,
        data: functionData
      };

      // Create EIP-712 signature
      const domain = {
        name: "MetaTxRelayer",
        version: "1",
        chainId: await provider.getNetwork().then(n => n.chainId),
        verifyingContract: CONTRACTS.metaTxRelayer
      };

      const types = {
        ForwardRequest: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "gas", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "data", type: "bytes" }
        ]
      };

      // Sign the request
      const signature = await signer.signTypedData(domain, types, forwardRequest);
      console.log('✅ Signature created:', signature);
      
      // Simulate relayer execution (in a real app, this would be sent to the relayer service)
      // For demo, we'll call the relayer directly
      const relayerSigner = new ethers.Wallet(
        "56f260421bc7a40adf268d89e27fe35963ea3b84069cb4d2932ad32fd6bb33be",
        provider
      );
      
      const relayerMetaTxContract = new Contract(CONTRACTS.metaTxRelayer, MetaTxRelayerABI, relayerSigner);
      
      // Execute the meta-transaction
      const tx = await relayerMetaTxContract.execute(forwardRequest, signature);
      setTxHash(tx.hash);
      
      console.log('⏳ Meta-transaction sent:', tx.hash);
      
      // Wait for confirmation
      await tx.wait();
      console.log('✅ Meta-transaction confirmed!');
      
      // Refresh greeting info
      await loadGreetingInfo();
      
      setTimeout(() => setIsPartyMode(false), 3000);
      
    } catch (error) {
      console.error('Error executing meta-transaction:', error);
      alert('Failed to send greeting. Please try again.');
      setIsPartyMode(false);
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (address: string) => {
    if (!address || address === ethers.ZeroAddress) return 'None';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const getRandomEmoji = () => {
    const emojis = ['🎉', '✨', '🚀', '💫', '🌟', '⭐', '🎊', '🔥', '💎', '🎆'];
    return emojis[Math.floor(Math.random() * emojis.length)];
  };

  return (
    <div className={`polka-greet-app ${isPartyMode ? 'party-mode' : ''}`}>
      {/* Header */}
      <header className="header">
        <div className="container">
          <h1 className="title">
            <span className="logo">🌸</span>
            PolkaGreet
            <span className="subtitle">Gasless Greetings on Polkadot</span>
          </h1>
          
          {!isWalletConnected ? (
            <button className="connect-wallet-btn" onClick={connectWallet}>
              🦊 Connect Wallet
            </button>
          ) : (
            <div className="wallet-info">
              <span className="wallet-address">
                🔗 {formatAddress(account)}
              </span>
              <span className="network-badge">Paseo</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        <div className="container">
          {/* Greeting Display */}
          <div className="greeting-card">
            <div className="greeting-content">
              <h2 className="greeting-text">
                {greetingInfo.greeting}
                {isPartyMode && <span className="party-emoji">{getRandomEmoji()}</span>}
              </h2>
              <div className="greeting-stats">
                <div className="stat">
                  <span className="stat-label">Last Greeter:</span>
                  <span className="stat-value">{formatAddress(greetingInfo.lastGreeter)}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Total Greets:</span>
                  <span className="stat-value">{greetingInfo.greetCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Say Hi Button */}
          <div className="action-section">
            <button 
              className={`say-hi-btn ${loading ? 'loading' : ''} ${isPartyMode ? 'party' : ''}`}
              onClick={sayHiWithMetaTx}
              disabled={loading || !isWalletConnected}
            >
              {loading ? (
                <>
                  <span className="loading-spinner"></span>
                  Sending Greeting...
                </>
              ) : (
                <>
                  👋 Say Hi!
                </>
              )}
            </button>
            
            <div className="action-description">
              <p className="description-text">
                Click to say hi! The relayer will pay the gas fees for you using meta-transactions.
              </p>
              <p className="description-highlight">
                ✨ This demonstrates gasless interactions on Polkadot
              </p>
            </div>
          </div>

          {/* Transaction Hash */}
          {txHash && (
            <div className="tx-info">
              <h3>🎉 Transaction Successful!</h3>
              <p>
                <strong>Transaction Hash:</strong> 
                <a 
                  href={`https://blockscout-passet-hub.parity-testnet.parity.io/tx/${txHash}`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="tx-link"
                >
                  {formatAddress(txHash)}
                </a>
              </p>
            </div>
          )}

          {/* How It Works */}
          <div className="info-section">
            <h3>🔄 How Meta-Transactions Work</h3>
            <div className="info-steps">
              <div className="step">
                <div className="step-number">1</div>
                <div className="step-content">
                  <h4>You Sign</h4>
                  <p>Sign a message with your wallet (no gas required)</p>
                </div>
              </div>
              <div className="step">
                <div className="step-number">2</div>
                <div className="step-content">
                  <h4>Relayer Executes</h4>
                  <p>The relayer submits your transaction and pays gas fees</p>
                </div>
              </div>
              <div className="step">
                <div className="step-number">3</div>
                <div className="step-content">
                  <h4>You Enjoy</h4>
                  <p>Your action is executed without needing native tokens!</p>
                </div>
              </div>
            </div>
          </div>

          <div className="approach-section">
            <h3>🎯 Project Approach</h3>
            <div className="approach-content">
              <p className="approach-intro">
                PolkaGreet demonstrates a complete meta-transaction implementation on Polkadot, 
                starting from a raffle concept and evolving into a focused gasless interaction showcase.
              </p>
              
              <div className="approach-pillars">
                <div className="pillar">
                  <div className="pillar-icon">🏗️</div>
                  <h4>Smart Contract Design</h4>
                  <p>Built with ERC2771 context for trusted forwarders, enabling seamless meta-transaction support while preserving original sender identity.</p>
                </div>
                
                <div className="pillar">
                  <div className="pillar-icon">🔐</div>
                  <h4>EIP-712 Signatures</h4>
                  <p>Implemented industry-standard typed data signatures for secure off-chain message signing without requiring gas.</p>
                </div>
                
                <div className="pillar">
                  <div className="pillar-icon">⚡</div>
                  <h4>Relayer Infrastructure</h4>
                  <p>Created a dedicated relayer service that validates signatures and executes transactions, abstracting gas complexity from users.</p>
                </div>
              </div>
              
              <div className="tech-stack">
                <h4>Technology Stack</h4>
                <div className="tech-tags">
                  <span className="tech-tag">PolkaVM</span>
                  <span className="tech-tag">Solidity 0.8.28</span>
                  <span className="tech-tag">EIP-712</span>
                  <span className="tech-tag">React TypeScript</span>
                  <span className="tech-tag">Ethers.js</span>
                  <span className="tech-tag">MetaMask</span>
                  <span className="tech-tag">Paseo Asset Hub</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <p>
            Built with ❤️ for Polkadot by <strong>Kaan Kacar</strong> at <strong>EthBelgrade 2025</strong>
            <br />
            <small>Demonstrating the future of gasless interactions on Web3</small>
          </p>
        </div>
      </footer>
    </div>
  );
}

// Type declaration for window.ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

export default PolkaGreetApp; 