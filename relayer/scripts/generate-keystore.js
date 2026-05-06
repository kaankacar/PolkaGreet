#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { Wallet } = require("ethers");

const privateKey = process.env.RELAYER_PRIVATE_KEY;
const passphrase = process.env.KEYSTORE_PASSPHRASE;

if (!privateKey || !passphrase) {
  console.error(
    "RELAYER_PRIVATE_KEY and KEYSTORE_PASSPHRASE must both be set in the environment.",
  );
  process.exit(1);
}

const complexity =
  passphrase.length >= 12 &&
  /[a-z]/.test(passphrase) &&
  /[A-Z]/.test(passphrase) &&
  /[0-9]/.test(passphrase) &&
  /[^A-Za-z0-9]/.test(passphrase);

if (!complexity) {
  console.error(
    "KEYSTORE_PASSPHRASE must be at least 12 characters and contain upper, lower, number, and special chars.",
  );
  process.exit(1);
}

const outPath = path.resolve(__dirname, "..", "config", "keys", "local-signer.json");

(async () => {
  const wallet = new Wallet(privateKey);
  const json = await wallet.encrypt(passphrase);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, json);
  console.log(`Wrote v3 keystore for ${wallet.address}`);
  console.log(`  -> ${outPath}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
