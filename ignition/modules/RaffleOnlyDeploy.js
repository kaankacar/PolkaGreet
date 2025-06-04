const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("RaffleOnlyDeploy", (m) => {
  // Use the already deployed MetaTxRelayer address
  const metaTxRelayerAddress = "0x6d5e641E6782D89435419Bb3AbB47A007C8cef99";

  // Deploy only the RaffleContract
  const raffleContract = m.contract("RaffleContract", [metaTxRelayerAddress]);

  return {
    raffleContract
  };
}); 