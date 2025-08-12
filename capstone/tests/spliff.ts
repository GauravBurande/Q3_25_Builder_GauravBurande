import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Spliff } from "../target/types/spliff";

describe("spliff", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.spliff as Program<Spliff>;

  it("initializes group", async () => {
    const seed = new BN(1);
    const [groupPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("group"), seed.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    const tx = await program.methods
      .initializeGroup(seed)
      .accounts({
        payer: (program.provider as anchor.AnchorProvider).wallet.publicKey,
        group: groupPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    console.log("initializeGroup tx", tx);
  });
});
