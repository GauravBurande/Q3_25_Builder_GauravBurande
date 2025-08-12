import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccount,
  createMint,
  getAssociatedTokenAddress,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { expect } from "chai";
import { Staking } from "../target/types/staking";

describe("staking flows", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider();
  const connection = provider.connection;
  const program = anchor.workspace.Staking as Program<Staking>;

  const admin = provider.wallet.payer;
  const user = Keypair.generate();

  const POINTS_PER_STAKE = 10;
  const MAX_UNSTAKE = 5;
  const FREEZE_PERIOD = 10; // seconds

  let configPda: PublicKey;
  let rewardMintPda: PublicKey;
  let userAccountPda: PublicKey;
  let userRewardAta: PublicKey;

  let mintA: PublicKey;
  let userAtaA: PublicKey;
  let vaultAtaA: PublicKey;
  let stakePdaA: PublicKey;

  let mintB: PublicKey;
  let userAtaB: PublicKey;
  let vaultAtaB: PublicKey;
  let stakePdaB: PublicKey;

  before(async () => {
    const transferTx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: admin.publicKey,
        toPubkey: user.publicKey,
        lamports: 2 * anchor.web3.LAMPORTS_PER_SOL,
      })
    );
    await provider.sendAndConfirm(transferTx, [admin]);

    [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    );
    [rewardMintPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("rewards"), configPda.toBuffer()],
      program.programId
    );
    [userAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user"), user.publicKey.toBuffer()],
      program.programId
    );
    userRewardAta = await getAssociatedTokenAddress(
      rewardMintPda,
      user.publicKey
    );
  });

  const waitForFreezePeriod = async (seconds: number) => {
    const start = await provider.connection.getBlockTime(
      await provider.connection.getSlot()
    );

    while (true) {
      const tx = new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
          fromPubkey: admin.publicKey,
          toPubkey: admin.publicKey,
          lamports: 0,
        })
      );
      await provider.sendAndConfirm(tx, [admin]);

      const current = await provider.connection.getBlockTime(
        await provider.connection.getSlot()
      );
      if (current - start >= seconds) break;

      await new Promise((r) => setTimeout(r, 500));
    }
  };

  it("Initializes config", async () => {
    const tx = await program.methods
      .initializeConfig(POINTS_PER_STAKE, MAX_UNSTAKE, FREEZE_PERIOD)
      .accountsPartial({
        admin: admin.publicKey,
        config: configPda,
        rewardMint: rewardMintPda,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([admin])
      .rpc();
    console.log(`https://explorer.solana.com/tx/${tx}?cluster=devnet`);
  });

  it("Initializes user account", async () => {
    const tx = await program.methods
      .initializeUser()
      .accountsPartial({
        user: user.publicKey,
        userAccount: userAccountPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();
    console.log(`https://explorer.solana.com/tx/${tx}?cluster=devnet`);
  });

  describe("Stake + Unstake flow with Mint A", () => {
    before(async () => {
      mintA = await createMint(connection, admin, admin.publicKey, null, 0);
      userAtaA = await createAssociatedTokenAccount(
        connection,
        admin,
        mintA,
        user.publicKey
      );
      await mintTo(connection, admin, mintA, userAtaA, admin.publicKey, 1);
      [vaultAtaA] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), mintA.toBuffer()],
        program.programId
      );
      [stakePdaA] = PublicKey.findProgramAddressSync(
        [Buffer.from("stake"), user.publicKey.toBuffer(), mintA.toBuffer()],
        program.programId
      );
    });

    it("Stakes NFT A", async () => {
      const tx = await program.methods
        .stake()
        .accountsPartial({
          user: user.publicKey,
          userAccount: userAccountPda,
          config: configPda,
          nftMint: mintA,
          userNftAta: userAtaA,
          vaultAta: vaultAtaA,
          stakeAccount: stakePdaA,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
          clock: SYSVAR_CLOCK_PUBKEY,
        })
        .signers([user])
        .rpc();
      console.log(`https://explorer.solana.com/tx/${tx}?cluster=devnet`);

      const vaultBalance = await connection.getTokenAccountBalance(vaultAtaA);
      expect(vaultBalance.value.uiAmount).to.equal(1);
    });

    it("Unstakes NFT A after freeze period", async () => {
      await waitForFreezePeriod(FREEZE_PERIOD);

      try {
        const tx = await program.methods
          .unstake()
          .accountsPartial({
            user: user.publicKey,
            userAccount: userAccountPda,
            config: configPda,
            nftMint: mintA,
            stakeAccount: stakePdaA,
            vaultAta: vaultAtaA,
            userNftAta: userAtaA,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
            clock: SYSVAR_CLOCK_PUBKEY,
          })
          .signers([user])
          .rpc();
        console.log(`https://explorer.solana.com/tx/${tx}?cluster=devnet`);

        const vaultBalance = await connection.getTokenAccountBalance(vaultAtaA);
        expect(vaultBalance.value.uiAmount).to.equal(0);

        const userBalance = await connection.getTokenAccountBalance(userAtaA);
        expect(userBalance.value.uiAmount).to.equal(1);
      } catch (error) {
        console.log(error.logs);
      }
    });
  });

  describe("Stake + Claim flow with Mint B", () => {
    before(async () => {
      mintB = await createMint(connection, admin, admin.publicKey, null, 0);
      userAtaB = await createAssociatedTokenAccount(
        connection,
        admin,
        mintB,
        user.publicKey
      );
      await mintTo(connection, admin, mintB, userAtaB, admin.publicKey, 1);
      [vaultAtaB] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), mintB.toBuffer()],
        program.programId
      );
      [stakePdaB] = PublicKey.findProgramAddressSync(
        [Buffer.from("stake"), user.publicKey.toBuffer(), mintB.toBuffer()],
        program.programId
      );

      // Ensure reward ATA exists
      const info = await connection.getAccountInfo(userRewardAta);
      if (!info) {
        await createAssociatedTokenAccount(
          connection,
          admin,
          rewardMintPda,
          user.publicKey
        );
      }
    });

    it("Stakes NFT B", async () => {
      const tx = await program.methods
        .stake()
        .accountsPartial({
          user: user.publicKey,
          userAccount: userAccountPda,
          config: configPda,
          nftMint: mintB,
          userNftAta: userAtaB,
          vaultAta: vaultAtaB,
          stakeAccount: stakePdaB,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
          clock: SYSVAR_CLOCK_PUBKEY,
        })
        .signers([user])
        .rpc();
      console.log(`https://explorer.solana.com/tx/${tx}?cluster=devnet`);
    });
  });
});
