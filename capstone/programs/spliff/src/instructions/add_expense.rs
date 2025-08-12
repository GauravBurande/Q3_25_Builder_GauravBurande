use anchor_lang::prelude::*;

use crate::{ Expense, Group};

#[derive(Accounts)]
#[instruction(amount: i64)]
pub struct AddExpense<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: just a simple pubkey of a user
    pub user: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"group", group.seed.to_le_bytes().as_ref()],
        bump = group.bump
    )]
    pub group: Account<'info, Group>,

    #[account(
        init,
        payer = admin,
        space = 8 + Expense::INIT_SPACE,
        // including group in PDA seeds is fine. To fetch “all expenses for a user without knowing the group,” use program account filters (memcmp) on the user field, not seeds.
        seeds = [b"expense", group.key().as_ref(), user.key().as_ref()],
        bump,
    )]
    pub expense: Account<'info, Expense>,

    pub system_program: Program<'info, System>,
}

impl AddExpense<'_> {
    pub fn add_expense(&mut self, amount: u64, bumps: &AddExpenseBumps) -> Result<()> {

        self.expense.set_inner(Expense { user: self.user.key(), amount, bump: bumps.expense });
        Ok(())
    }
}
