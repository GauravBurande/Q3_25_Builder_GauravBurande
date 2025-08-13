import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Spliff } from "../target/types/spliff";
import { Keypair, PublicKey } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddress } from "@solana/spl-token";

describe("spliff", async () => {
  // Configure the client to use the whatever cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.spliff as Program<Spliff>;
  const provider = anchor.getProvider();
  const connection = provider.connection;

  const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  const SEED = new BN(6996);

  let admin = provider.wallet.payer;
  let [user1, user2, user3] = Array.from({ length: 3 }, () =>
    Keypair.generate()
  );

  const [groupPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("group"), SEED.toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  let [expensePda1, expensePda2, expensePda3] = [user1, user2, user3].map(
    (u) =>
      anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("expense"), groupPda.toBuffer(), u.publicKey.toBuffer()],
        program.programId
      )[0]
  );

  const surfnetRPC = "http://127.0.0.1:8899";

  const findUSDCAta = async (ownerAddress: PublicKey): Promise<PublicKey> => {
    try {
      const ata = await getAssociatedTokenAddress(
        new PublicKey(USDC_MINT),
        ownerAddress
      );

      return ata;
    } catch (error) {
      console.error("Error finding USDC ATA:", error);
      throw new Error(
        `Failed to find USDC ATA for owner ${ownerAddress.toBase58()}: ${error}`
      );
    }
  };

  const airdropUSDC = async (ownerAddress: PublicKey): Promise<void> => {
    try {
      let result = await fetch(surfnetRPC, {
        method: "POST",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "surfnet_setTokenAccount",
          params: [
            ownerAddress.toBase58(),
            USDC_MINT,
            {
              amount: 100,
            },
          ],
        }),
      });

      if (!result.ok) {
        throw new Error(`HTTP error! status: ${result.status}`);
      }

      let response = await result.json();
      console.log("airdropped usdc, response: ", JSON.stringify(response));
    } catch (error) {
      console.error("Error airdropping USDC:", error);
      throw new Error(`Failed to airdrop USDC to ${ownerAddress}: ${error}`);
    }
  };

  const checkUSDCBalance = async (ownerAddress: PublicKey): Promise<number> => {
    const ata = await findUSDCAta(ownerAddress);
    const account = await getAccount(connection, ata);
    const balance = account.amount;

    console.log(`usdc amount of ${ownerAddress.toBase58}: `, balance);
    return Number(balance);
  };

  before(async () => {
    try {
      // Airdrop USDC to admin
      await airdropUSDC(admin.publicKey);

      // Airdrop USDC to test users
      await airdropUSDC(user1.publicKey);
      await airdropUSDC(user2.publicKey);
      await airdropUSDC(user3.publicKey);

      // todo: Airdrop 0.1 sol to every user account

      console.log("USDC Airdrop to group peeps done!");
    } catch (error) {
      console.error("Failed to setup test environment:", error);
      throw error;
    }
  });

  it("initializes group", async () => {
    try {
      const tx = await program.methods
        .initializeGroup(SEED)
        .accountsPartial({
          admin: admin.publicKey,
          group: groupPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      console.log("initializeGroup tx", tx);
    } catch (error) {
      console.error("Test failed:", error);
      throw error;
    }
  });

  it("add_expenses for all the users", async () => {
    const expenseAmount = new anchor.BN(200);
    try {
      const [user1USDCBalance, user2USDCBalance, user3USDCBalance] = [
        user1,
        user2,
        user3,
      ].map(async (u) => checkUSDCBalance(u.publicKey));

      const addExpenseUser1 = await program.methods
        .addExpense(expenseAmount)
        .accountsPartial({
          admin: admin.publicKey,
          user: user1.publicKey,
          expense: expensePda1,
          group: groupPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .instruction();

      const addExpenseUser2 = await program.methods
        .addExpense(expenseAmount)
        .accountsPartial({
          admin: admin.publicKey,
          user: user2.publicKey,
          expense: expensePda2,
          group: groupPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .instruction();

      const addExpenseUser3 = await program.methods
        .addExpense(expenseAmount)
        .accountsPartial({
          admin: admin.publicKey,
          user: user3.publicKey,
          expense: expensePda3,
          group: groupPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .instruction();

      const transaction = new anchor.web3.Transaction();
      transaction.add(addExpenseUser1, addExpenseUser2, addExpenseUser3);

      const tx = await provider.sendAndConfirm(transaction);
      console.log("addExpense for all users tx", tx);
    } catch (error) {
      console.error("Test failed:", error);
      throw error;
    }
  });
});
