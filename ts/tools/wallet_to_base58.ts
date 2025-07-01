import bs58 from "bs58";

(async () => {
  const privkey = ""; // imported priv key from env or wallet file
  // Decode private key
  const wallet = bs58.encode(Buffer.from(JSON.parse(privkey as string)));
  // Print out wallet
  console.log(`Your base58-encoded private key is:\n${wallet}`);
})();
