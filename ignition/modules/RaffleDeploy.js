const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("RaffleDeploy", (m) => {
  // Deploy the MetaTxRelayer first
  const metaTxRelayer = m.contract("MetaTxRelayer");

  // Deploy the GreetingContract with the MetaTxRelayer as the trusted forwarder
  const greetingContract = m.contract("GreetingContract", [metaTxRelayer]);

  // Deploy the RaffleContract with the MetaTxRelayer as the trusted forwarder
  const raffleContract = m.contract("RaffleContract", [metaTxRelayer]);

  return {
    metaTxRelayer,
    greetingContract,
    raffleContract,
  };
}); 