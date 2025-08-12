use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Group {
    pub seed: u64,
    pub admin: Pubkey,
    pub bump: u8,
}