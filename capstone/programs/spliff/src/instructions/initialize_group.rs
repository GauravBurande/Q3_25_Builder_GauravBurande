use anchor_lang::prelude::*;

use crate::{Group};

#[derive(Accounts)]
#[instruction(seed: u64)]
pub struct InitializeGroup<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + Group::INIT_SPACE,
        seeds = [b"group", seed.to_le_bytes().as_ref()],
        bump
    )]
    pub group: Account<'info, Group>,

    pub system_program: Program<'info, System>,
}

impl InitializeGroup<'_> {
    pub fn initialize_group(&mut self, seed: u64, bumps: &InitializeGroupBumps) -> Result<()> {
        self.group
            .set_inner(Group { seed, admin: self.admin.key(), bump: bumps.group });
        Ok(())
    }
}

