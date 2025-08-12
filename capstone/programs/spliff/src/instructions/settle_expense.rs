use anchor_lang::prelude::*;
use anchor_spl::{mint, token::{transfer_checked, TokenAccount, TransferChecked, Mint, Token}};

use crate::{Expense, Group};

// const USDC: &str = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

#[derive(Accounts)]
pub struct SettleExpense<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"group", group.seed.to_le_bytes().as_ref()],
        bump = group.bump
    )]
    pub group: Account<'info, Group>,
    
    #[account(address = mint::USDC)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = user,
        associated_token::token_program = token_program
    )]
    pub debtor_usdc_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = group.admin,
        associated_token::token_program = token_program
    )]
    pub admin_usdc_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"expense", group.key().as_ref(), user.key().as_ref()],
        bump = expense.bump,
    )]
    pub expense: Account<'info, Expense>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>
}

impl SettleExpense<'_> {
    pub fn settle_expense(&mut self) -> Result<()> {
        let cpi_program = self.token_program.to_account_info();

        let cpi_accounts = TransferChecked {
            from: self.debtor_usdc_ata.to_account_info(),
            to: self.admin_usdc_ata.to_account_info(),
            mint: self.mint.to_account_info(),
            authority: self.debtor_usdc_ata.to_account_info()
        };

        let cpi_context = CpiContext::new(cpi_program, cpi_accounts);

        transfer_checked(cpi_context, self.expense.amount, self.mint.decimals)
    }
}