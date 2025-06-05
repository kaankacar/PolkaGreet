const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PolkaGreet Contract", function () {
  let polkaGreetContract;
  let metaTxRelayer;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    // Get signers
    [owner, addr1, addr2] = await ethers.getSigners();

    // Deploy MetaTxRelayer first
    const MetaTxRelayer = await ethers.getContractFactory("MetaTxRelayer");
    metaTxRelayer = await MetaTxRelayer.deploy();
    await metaTxRelayer.waitForDeployment();

    // Deploy PolkaGreetContract
    const PolkaGreetContract = await ethers.getContractFactory("PolkaGreetContract");
    polkaGreetContract = await PolkaGreetContract.deploy(await metaTxRelayer.getAddress());
    await polkaGreetContract.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct initial greeting", async function () {
      expect(await polkaGreetContract.getCurrentGreeting()).to.equal("Welcome to PolkaGreet!");
    });

    it("Should set the correct initial greet count", async function () {
      expect(await polkaGreetContract.getGreetCount()).to.equal(0);
    });

    it("Should have no last greeter initially", async function () {
      expect(await polkaGreetContract.getLastGreeter()).to.equal(ethers.ZeroAddress);
    });
  });

  describe("sayHi functionality", function () {
    it("Should allow users to say hi directly", async function () {
      // Connect with addr1 and say hi
      await polkaGreetContract.connect(addr1).sayHi();

      // Check that greeting was updated
      const greeting = await polkaGreetContract.getCurrentGreeting();
      expect(greeting).to.include(addr1.address.toLowerCase());
      expect(greeting).to.include("Hi");

      // Check that greet count increased
      expect(await polkaGreetContract.getGreetCount()).to.equal(1);

      // Check that last greeter is set correctly
      expect(await polkaGreetContract.getLastGreeter()).to.equal(addr1.address);
    });

    it("Should update greet count on multiple greetings", async function () {
      // Multiple users say hi
      await polkaGreetContract.connect(addr1).sayHi();
      await polkaGreetContract.connect(addr2).sayHi();
      await polkaGreetContract.connect(owner).sayHi();

      expect(await polkaGreetContract.getGreetCount()).to.equal(3);
      expect(await polkaGreetContract.getLastGreeter()).to.equal(owner.address);
    });

    it("Should emit GreetingSent event", async function () {
      await expect(polkaGreetContract.connect(addr1).sayHi())
        .to.emit(polkaGreetContract, "GreetingSent")
        .withArgs(addr1.address, await polkaGreetContract.getCurrentGreeting.staticCall(), 1);
    });
  });

  describe("View functions", function () {
    beforeEach(async function () {
      // Set up some greetings
      await polkaGreetContract.connect(addr1).sayHi();
      await polkaGreetContract.connect(addr2).sayHi();
    });

    it("Should return correct greeting info", async function () {
      const [greeting, lastGreeter, greetCount] = await polkaGreetContract.getGreetingInfo();
      
      expect(greeting).to.include(addr2.address.toLowerCase());
      expect(lastGreeter).to.equal(addr2.address);
      expect(greetCount).to.equal(2);
    });

    it("Should return current greeting", async function () {
      const greeting = await polkaGreetContract.getCurrentGreeting();
      expect(greeting).to.include("Hi");
    });

    it("Should return last greeter", async function () {
      expect(await polkaGreetContract.getLastGreeter()).to.equal(addr2.address);
    });

    it("Should return greet count", async function () {
      expect(await polkaGreetContract.getGreetCount()).to.equal(2);
    });
  });

  describe("Meta-transaction functionality", function () {
    it("Should support meta-transactions through relayer", async function () {
      // Get nonce for addr1
      const nonce = await metaTxRelayer.getNonce(addr1.address);
      
      // Prepare function call data
      const functionData = polkaGreetContract.interface.encodeFunctionData("sayHi");
      
      // Create forward request
      const forwardRequest = {
        from: addr1.address,
        to: await polkaGreetContract.getAddress(),
        value: 0,
        gas: 100000,
        nonce: nonce,
        data: functionData
      };

      // Create EIP-712 signature domain
      const domain = {
        name: "MetaTxRelayer",
        version: "1",
        chainId: await ethers.provider.getNetwork().then(n => n.chainId),
        verifyingContract: await metaTxRelayer.getAddress()
      };

      // Create types for signature
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

      // Sign the request with addr1
      const signature = await addr1.signTypedData(domain, types, forwardRequest);

      // Execute the meta-transaction (owner acts as relayer)
      await expect(metaTxRelayer.connect(owner).execute(forwardRequest, signature))
        .to.emit(polkaGreetContract, "GreetingSent");

      // Verify the greeting was updated with addr1 as the sender
      const greeting = await polkaGreetContract.getCurrentGreeting();
      expect(greeting).to.include(addr1.address.toLowerCase());
      expect(await polkaGreetContract.getLastGreeter()).to.equal(addr1.address);
      expect(await polkaGreetContract.getGreetCount()).to.equal(1);
    });

    it("Should maintain correct sender context in meta-transactions", async function () {
      // Send meta-transaction from addr1 but executed by owner
      const nonce = await metaTxRelayer.getNonce(addr1.address);
      const functionData = polkaGreetContract.interface.encodeFunctionData("sayHi");
      
      const forwardRequest = {
        from: addr1.address,
        to: await polkaGreetContract.getAddress(),
        value: 0,
        gas: 100000,
        nonce: nonce,
        data: functionData
      };

      const domain = {
        name: "MetaTxRelayer",
        version: "1",
        chainId: await ethers.provider.getNetwork().then(n => n.chainId),
        verifyingContract: await metaTxRelayer.getAddress()
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

      const signature = await addr1.signTypedData(domain, types, forwardRequest);
      
      // Execute with owner as relayer
      await metaTxRelayer.connect(owner).execute(forwardRequest, signature);

      // The greeting should show addr1 as the greeter, not owner
      expect(await polkaGreetContract.getLastGreeter()).to.equal(addr1.address);
      
      const greeting = await polkaGreetContract.getCurrentGreeting();
      expect(greeting).to.include(addr1.address.toLowerCase());
      expect(greeting).not.to.include(owner.address.toLowerCase());
    });
  });

  describe("Edge cases", function () {
    it("Should handle multiple greetings from same user", async function () {
      await polkaGreetContract.connect(addr1).sayHi();
      await polkaGreetContract.connect(addr1).sayHi();
      
      expect(await polkaGreetContract.getGreetCount()).to.equal(2);
      expect(await polkaGreetContract.getLastGreeter()).to.equal(addr1.address);
    });

    it("Should properly format addresses in greetings", async function () {
      await polkaGreetContract.connect(addr1).sayHi();
      
      const greeting = await polkaGreetContract.getCurrentGreeting();
      expect(greeting).to.include("0x");
      expect(greeting).to.include(addr1.address.toLowerCase());
    });
  });
}); 