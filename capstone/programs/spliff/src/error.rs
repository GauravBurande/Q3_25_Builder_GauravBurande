use anchor_lang::prelude::*;

#[error_code]
pub enum SpliffError {
    #[msg("There are no expenses to initialize")]
    NoExpenses,
    #[msg("There are too many expenses to initialize")]
    TooManyExpenses,
}
