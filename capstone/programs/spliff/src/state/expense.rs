use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Expense {
  pub user: Pubkey,
  pub amount: u64,
  pub bump: u8
}