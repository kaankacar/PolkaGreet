const { expect } = require("chai");
const { ethers } = require("hardhat");
const { createMetaTransaction, EIP712_DOMAIN, FORWARD_REQUEST_TYPE } = require("../scripts/relayer");

describe("MetaTxRelayer", function () {
    let metaTxRelayer;
    let greetingContract;
    let owner;
    let relayer;
    let user;
    let addrs;

    beforeEach(async function () {
        // Get signers
        [owner, relayer, user, ...addrs] = await ethers.getSigners();

        // Deploy MetaTxRelayer
        const MetaTxRelayer = await ethers.getContractFactory("MetaTxRelayer");
        metaTxRelayer = await MetaTxRelayer.deploy();
        await metaTxRelayer.deployed();

        // Deploy GreetingContract with MetaTxRelayer as trusted forwarder
        const GreetingContract = await ethers.getContractFactory("GreetingContract");
        greetingContract = await GreetingContract.deploy(metaTxRelayer.address);
        await greetingContract.deployed();
    });

    describe("Deployment", function () {
        it("Should deploy MetaTxRelayer correctly", async function () {
            expect(metaTxRelayer.address).to.be.properAddress;
        });

        it("Should deploy GreetingContract with correct trusted forwarder", async function () {
            expect(await greetingContract.isTrustedForwarder(metaTxRelayer.address)).to.be.true;
            expect(await greetingContract.isTrustedForwarder(user.address)).to.be.false;
        });

        it("Should have initial greeting set", async function () {
            expect(await greetingContract.getGreeting()).to.equal("Hello, World!");
        });
    });

    describe("Nonce Management", function () {
        it("Should start with nonce 0 for new addresses", async function () {
            expect(await metaTxRelayer.getNonce(user.address)).to.equal(0);
        });

        it("Should increment nonce after successful meta-transaction", async function () {
            const newGreeting = "Test greeting";
            const functionData = greetingContract.interface.encodeFunctionData("setGreeting", [newGreeting]);
            
            const { forwardRequest, signature } = await createMetaTransaction(
                user,
                greetingContract,
                functionData,
                metaTxRelayer
            );

            await metaTxRelayer.connect(relayer).execute(forwardRequest, signature);
            
            expect(await metaTxRelayer.getNonce(user.address)).to.equal(1);
        });
    });

    describe("Meta-Transaction Execution", function () {
        it("Should execute meta-transaction successfully", async function () {
            const newGreeting = "Hello from meta-tx!";
            const functionData = greetingContract.interface.encodeFunctionData("setGreeting", [newGreeting]);
            
            const { forwardRequest, signature } = await createMetaTransaction(
                user,
                greetingContract,
                functionData,
                metaTxRelayer
            );

            const tx = await metaTxRelayer.connect(relayer).execute(forwardRequest, signature);
            const receipt = await tx.wait();

            // Check that greeting was updated
            expect(await greetingContract.getGreeting()).to.equal(newGreeting);

            // Check event was emitted
            const event = receipt.events.find(e => e.event === "MetaTransactionExecuted");
            expect(event).to.not.be.undefined;
            expect(event.args.from).to.equal(user.address);
            expect(event.args.to).to.equal(greetingContract.address);
            expect(event.args.success).to.be.true;
        });

        it("Should correctly identify original sender in target contract", async function () {
            const newGreeting = "Test sender identification";
            const functionData = greetingContract.interface.encodeFunctionData("setGreeting", [newGreeting]);
            
            const { forwardRequest, signature } = await createMetaTransaction(
                user,
                greetingContract,
                functionData,
                metaTxRelayer
            );

            await metaTxRelayer.connect(relayer).execute(forwardRequest, signature);
            
            // The greeting contract should recognize the original user as the sender
            const messageInfo = await greetingContract.getMessageInfo();
            expect(messageInfo.sender).to.equal(user.address);
        });

        it("Should fail with invalid signature", async function () {
            const newGreeting = "This should fail";
            const functionData = greetingContract.interface.encodeFunctionData("setGreeting", [newGreeting]);
            
            const { forwardRequest } = await createMetaTransaction(
                user,
                greetingContract,
                functionData,
                metaTxRelayer
            );

            // Create invalid signature
            const invalidSignature = "0x" + "0".repeat(130);

            await expect(
                metaTxRelayer.connect(relayer).execute(forwardRequest, invalidSignature)
            ).to.be.revertedWith("MetaTxRelayer: signature verification failed");
        });

        it("Should fail with wrong nonce", async function () {
            const newGreeting = "This should fail";
            const functionData = greetingContract.interface.encodeFunctionData("setGreeting", [newGreeting]);
            
            const { forwardRequest, signature } = await createMetaTransaction(
                user,
                greetingContract,
                functionData,
                metaTxRelayer
            );

            // Modify the nonce
            forwardRequest.nonce = 999;

            await expect(
                metaTxRelayer.connect(relayer).execute(forwardRequest, signature)
            ).to.be.revertedWith("MetaTxRelayer: invalid nonce");
        });

        it("Should prevent replay attacks", async function () {
            const newGreeting = "Test replay protection";
            const functionData = greetingContract.interface.encodeFunctionData("setGreeting", [newGreeting]);
            
            const { forwardRequest, signature } = await createMetaTransaction(
                user,
                greetingContract,
                functionData,
                metaTxRelayer
            );

            // Execute the first time (should succeed)
            await metaTxRelayer.connect(relayer).execute(forwardRequest, signature);

            // Try to execute again with the same signature (should fail)
            await expect(
                metaTxRelayer.connect(relayer).execute(forwardRequest, signature)
            ).to.be.revertedWith("MetaTxRelayer: invalid nonce");
        });
    });

    describe("Direct vs Meta-Transaction Comparison", function () {
        it("Should have same result for direct call vs meta-transaction", async function () {
            const greeting1 = "Direct call greeting";
            const greeting2 = "Meta-tx greeting";

            // Direct call
            await greetingContract.connect(user).setGreeting(greeting1);
            expect(await greetingContract.getGreeting()).to.equal(greeting1);

            // Meta-transaction
            const functionData = greetingContract.interface.encodeFunctionData("setGreeting", [greeting2]);
            const { forwardRequest, signature } = await createMetaTransaction(
                user,
                greetingContract,
                functionData,
                metaTxRelayer
            );

            await metaTxRelayer.connect(relayer).execute(forwardRequest, signature);
            expect(await greetingContract.getGreeting()).to.equal(greeting2);
        });

        it("Should correctly identify sender in both cases", async function () {
            // Direct call
            await greetingContract.connect(user).setGreeting("Direct");
            let messageInfo = await greetingContract.connect(user).getMessageInfo();
            const directSender = messageInfo.sender;

            // Meta-transaction
            const functionData = greetingContract.interface.encodeFunctionData("setGreeting", ["Meta"]);
            const { forwardRequest, signature } = await createMetaTransaction(
                user,
                greetingContract,
                functionData,
                metaTxRelayer
            );

            await metaTxRelayer.connect(relayer).execute(forwardRequest, signature);
            messageInfo = await greetingContract.getMessageInfo();
            const metaTxSender = messageInfo.sender;

            // Both should identify the same user as the sender
            expect(directSender).to.equal(user.address);
            expect(metaTxSender).to.equal(user.address);
            expect(directSender).to.equal(metaTxSender);
        });
    });

    describe("Gas Usage Analysis", function () {
        it("Should track gas usage for meta-transactions", async function () {
            const newGreeting = "Gas tracking test";
            const functionData = greetingContract.interface.encodeFunctionData("setGreeting", [newGreeting]);
            
            const { forwardRequest, signature } = await createMetaTransaction(
                user,
                greetingContract,
                functionData,
                metaTxRelayer
            );

            const tx = await metaTxRelayer.connect(relayer).execute(forwardRequest, signature);
            const receipt = await tx.wait();

            console.log(`Meta-transaction gas used: ${receipt.gasUsed}`);
            expect(receipt.gasUsed).to.be.greaterThan(0);
        });
    });
}); 