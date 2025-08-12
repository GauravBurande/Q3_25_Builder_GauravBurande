pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("HFdT7mY2w8TpFJK23B26wQrCkHD7BdVdG3mrCzu9uAzA");

#[program]
pub mod spliff {
    use super::*;

    pub fn initialize_group(ctx: Context<InitializeGroup>, seed: u64) -> Result<()> {
        ctx.accounts.initialize_group(seed, &ctx.bumps)
    }

    pub fn add_expense(ctx: Context<AddExpense>, amount: u64) -> Result<()> {
        ctx.accounts.add_expense(amount, &ctx.bumps)
    }

    pub fn settle_expense(ctx: Context<SettleExpense>) -> Result<()> {
        ctx.accounts.settle_expense()
    }
}
