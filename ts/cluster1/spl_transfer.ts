import { Commitment, Connection, Keypair, PublicKey } from "@solana/web3.js";
import wallet from "./wallet/turbin3-wallet.json";
import { getOrCreateAssociatedTokenAccount, transfer } from "@solana/spl-token";

// We're going to import our keypair from the wallet file
const keypair = Keypair.fromSecretKey(new Uint8Array(wallet));

//Create a Solana devnet connection
const commitment: Commitment = "confirmed";
const connection = new Connection("https://api.devnet.solana.com", commitment);

// Mint address
const mint = new PublicKey("A1CsSRYowwfRayeaPa9DeHUmVNorboxnpP2s1NajVBos");
const token_decimals = 1000000;

// Recipient address
const to = new PublicKey("matt5XJ1oeuMSJeLM5aXi2kJUkGqfzFPWDBjCwTcvoN");

(async () => {
  try {
    // Get the token account of the fromWallet address, and if it does not exist, create it
    const fromATA = await getOrCreateAssociatedTokenAccount(
      connection,
      keypair,
      mint,
      keypair.publicKey
    );
    // Get the token account of the toWallet address, and if it does not exist, create it
    const toATA = await getOrCreateAssociatedTokenAccount(
      connection,
      keypair,
      mint,
      to
    );
    // Transfer the new token to the "toTokenAccount" we just created
    const txnSig = await transfer(
      connection,
      keypair,
      fromATA.address,
      toATA.address,
      keypair,
      5000 * token_decimals
    );

    console.info("check out the transfer txn at: ", txnSig);
  } catch (e) {
    console.error(`Oops, something went wrong: ${e}`);
  }
})();
