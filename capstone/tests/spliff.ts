import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Spliff } from "../target/types/spliff";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Secp256k1Program,
} from "@solana/web3.js";
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
  const airdropUSDC = async (ownerAddress: PublicKey): Promise<void> => {
    try {
      let result = await fetch(surfnetRPC, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "surfnet_setTokenAccount",
          params: [
            ownerAddress.toBase58(),
            USDC_MINT,
            {
              amount: 1000,
            },
          ],
        }),
      });

      if (!result.ok) {
        throw new Error(`HTTP error! status: ${result.status}`);
      }

      let response: any = await result.json();
      if (response.error) {
        console.error(
          "USDC airdrop failed: ",
          response.message,
          ", data: ",
          response.data
        );
      }
    } catch (error) {
      console.error("Error airdropping USDC:", error);
      throw new Error(`Failed to airdrop USDC to ${ownerAddress}: ${error}`);
    }
  };

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

  const checkUSDCBalance = async (ownerAddress: PublicKey): Promise<number> => {
    const ata = await findUSDCAta(ownerAddress);
    const account = await getAccount(connection, ata);
    const balance = account.amount;

    console.log(`usdc amount of ${ownerAddress.toBase58()}: `, balance);
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

      await Promise.all(
        [user1, user2, user3].map((u) =>
          connection.requestAirdrop(u.publicKey, 0.1 * LAMPORTS_PER_SOL)
        )
      );

      console.log("Airdrops to group peeps done!");
    } catch (error) {
      console.error("Error:", error);
      throw error;
    }
  });

  // the group is already initialized
  it.skip("initializes group", async () => {
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
      // const [user1USDCBalance, user2USDCBalance, user3USDCBalance] =
      //   await Promise.all(
      //     [user1, user2, user3].map((u) => checkUSDCBalance(u.publicKey))
      //   );

      // console.log(
      //   "user accounts USDC balances: ",
      //   user1USDCBalance,
      //   user2USDCBalance,
      //   user3USDCBalance
      // );

      const userExpenseData = [
        { user: user1, expense: expensePda1 },
        { user: user2, expense: expensePda2 },
        { user: user3, expense: expensePda3 },
      ];

      const addExpenseInstructions = await Promise.all(
        userExpenseData.map(async ({ user, expense }) =>
          program.methods
            .addExpense(expenseAmount)
            .accountsPartial({
              admin: admin.publicKey,
              user: user.publicKey,
              expense,
              group: groupPda,
              systemProgram: anchor.web3.SystemProgram.programId,
            })
            .instruction()
        )
      );

      const transaction = new anchor.web3.Transaction();
      transaction.add(...addExpenseInstructions);
      transaction.feePayer = admin.publicKey;
      transaction.recentBlockhash = (
        await connection.getLatestBlockhash()
      ).blockhash;

      const tx = await provider.sendAndConfirm(transaction);
      console.log("addExpense for all users tx", tx);
    } catch (error) {
      console.error("addExpense for all users test failed:", error);
      throw error;
    }
  });

  it("settle expenses for users", async () => {
    try {
      const [adminUsdcAta, ...debtorUsdcAtas] = await Promise.all(
        [admin, user1, user2, user3].map((u) => findUSDCAta(u.publicKey))
      );

      const userSettleData = [
        { user: user1, expense: expensePda1, debtorUsdcAta: debtorUsdcAtas[0] },
        { user: user2, expense: expensePda2, debtorUsdcAta: debtorUsdcAtas[1] },
        { user: user3, expense: expensePda3, debtorUsdcAta: debtorUsdcAtas[2] },
      ];

      const settleExpenseInstructions = await Promise.all(
        userSettleData.map(async ({ user, expense, debtorUsdcAta }) =>
          program.methods
            .settleExpense()
            .accountsPartial({
              user: user.publicKey,
              group: groupPda,
              expense,
              adminUsdcAta,
              debtorUsdcAta,
              mint: USDC_MINT,
              tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
              systemProgram: anchor.web3.SystemProgram.programId,
            })
            .instruction()
        )
      );

      const transaction = new anchor.web3.Transaction();

      transaction.add(...settleExpenseInstructions);
      transaction.recentBlockhash = (
        await connection.getLatestBlockhash()
      ).blockhash;
      transaction.feePayer = admin.publicKey;
      transaction.partialSign(user1, user2, user3);

      const tx = await provider.sendAndConfirm(transaction);
      console.log("settle expense tx: ", tx);
    } catch (error) {
      console.error("settle expense test failed:", error);
      throw error;
    }
  });
});
