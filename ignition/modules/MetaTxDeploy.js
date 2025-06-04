const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("MetaTxDeploy", (m) => {
  // Deploy the MetaTxRelayer first
  const metaTxRelayer = m.contract("MetaTxRelayer");

  // Deploy the GreetingContract with the MetaTxRelayer as the trusted forwarder
  const greetingContract = m.contract("GreetingContract", [metaTxRelayer]);

  return {
    metaTxRelayer,
    greetingContract,
  };
}); 