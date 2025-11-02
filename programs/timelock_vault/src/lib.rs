use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("Timelock1111111111111111111111111111111111");

#[program]
pub mod timelock_vault {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        release_at: i64,
        _vault_bump: u8,
    ) -> Result<()> {
        let clock = Clock::get()?;
        require!(release_at > clock.unix_timestamp, TimelockError::ReleaseInPast);

        let state = &mut ctx.accounts.state;
        state.mint = ctx.accounts.mint.key();
        state.destination = ctx.accounts.destination.key();
        state.release_at = release_at;
        state.released = false;
        state.bump = *ctx.bumps.get("state").unwrap();
        state.vault_bump = *ctx.bumps.get("vault_authority").unwrap();
        Ok(())
    }

    pub fn release(ctx: Context<Release>) -> Result<()> {
        let clock = Clock::get()?;
        let state = &mut ctx.accounts.state;
        require!(clock.unix_timestamp >= state.release_at, TimelockError::TooEarly);
        require!(!state.released, TimelockError::AlreadyReleased);

        // transfer full vault balance to destination ATA
        let amount = ctx.accounts.vault_ata.amount;
        require!(amount > 0, TimelockError::NothingToRelease);

        let state_key = ctx.accounts.state.key();
        let seeds: &[&[u8]] = &[b"vault_auth", state_key.as_ref(), &[state.vault_bump]];
        let signer = &[seeds];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault_ata.to_account_info(),
            to: ctx.accounts.destination_ata.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer,
        );
        token::transfer(cpi_ctx, amount)?;

        state.released = true;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(release_at: i64, _vault_bump: u8)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    pub mint: Account<'info, Mint>,
    /// CHECK: destination wallet (owner of destination ATA)
    pub destination: UncheckedAccount<'info>,

    #[account(
        init,
        payer = payer,
        space = 8 + VaultState::SIZE,
        seeds = [b"vault_state", mint.key().as_ref(), destination.key().as_ref()],
        bump
    )]
    pub state: Account<'info, VaultState>,

    /// CHECK: PDA that will own the vault token account
    #[account(seeds = [b"vault_auth", state.key().as_ref()], bump)]
    pub vault_authority: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Release<'info> {
    /// Anyone can trigger release after the timestamp
    pub caller: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"vault_state", mint.key().as_ref(), state.destination.as_ref()],
        bump = state.bump,
        has_one = mint,
    )]
    pub state: Account<'info, VaultState>,

    /// CHECK: PDA authority over the vault_ata
    #[account(seeds = [b"vault_auth", state.key().as_ref()], bump = state.vault_bump)]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = vault_ata.mint == mint.key(),
        constraint = vault_ata.owner == vault_authority.key(),
    )]
    pub vault_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = destination_ata.mint == mint.key(),
        constraint = destination_ata.owner == state.destination,
    )]
    pub destination_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct VaultState {
    pub mint: Pubkey,
    pub destination: Pubkey,
    pub release_at: i64,
    pub released: bool,
    pub bump: u8,
    pub vault_bump: u8,
}

impl VaultState {
    pub const SIZE: usize = 32 + 32 + 8 + 1 + 1 + 1; // mint + dest + release_at + released + bump + vault_bump
}

#[error_code]
pub enum TimelockError {
    #[msg("Release timestamp must be in the future")] 
    ReleaseInPast,
    #[msg("Too early to release")] 
    TooEarly,
    #[msg("Already released")] 
    AlreadyReleased,
    #[msg("Nothing to release")] 
    NothingToRelease,
}
