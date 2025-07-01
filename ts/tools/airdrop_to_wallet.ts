import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

//Create a Solana devnet connection to claim 2 devnet SOL tokens
const connection = new Connection("https://api.devnet.solana.com");

(async () => {
  const wallet = new PublicKey("address");
  try {
    const txhash = await connection.requestAirdrop(
      wallet,
      LAMPORTS_PER_SOL * 2
    );
    console.log(
      `Success! Check out your TX here:\nhttps://explorer.solana.com/tx/${txhash}?cluster=devnet`
    );
  } catch (e) {
    console.error(`Oops, something went wrong: ${e}`);
  }
})();
