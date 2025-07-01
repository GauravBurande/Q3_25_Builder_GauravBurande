import bs58 from "bs58";
(async () => {
  const privkey = ""; // imported priv key from env or wallet file
  // Decode private key
  const wallet = bs58.decode(privkey);
  // Print out wallet
  console.log(`Your wallet file is:\n[${wallet}]`);
})();
