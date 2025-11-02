use anchor_lang::prelude::*;

// Placeholder program ID; replace before deploy
declare_id!("CompWrap111111111111111111111111111111111");

// Constants
const MAX_MEMBERS: usize = 12; // cap members for fixed account sizing

#[program]
pub mod compliance_wrapper {
    use super::*;

    // Governance (multisig + timelock) — controls registry/policy updates
    pub fn initialize_governance(
        ctx: Context<InitializeGovernance>,
        members: Vec<Pubkey>,
        threshold: u8,
        delay_seconds: i64,
    ) -> Result<()> {
        require!(!members.is_empty(), ComplianceError::EmptyMembers);
        require!(members.len() <= MAX_MEMBERS, ComplianceError::TooManyMembers);
        require!(threshold as usize <= members.len(), ComplianceError::InvalidThreshold);
        require!(threshold > 0, ComplianceError::InvalidThreshold);
        // Ensure no duplicates
        {
            let mut sorted = members.clone();
            sorted.sort();
            sorted.dedup();
            require!(sorted.len() == members.len(), ComplianceError::DuplicateMember);
        }

        let gov = &mut ctx.accounts.governance;
        gov.members = members;
        gov.threshold = threshold;
        gov.delay_seconds = delay_seconds;
        gov.bump = ctx.bumps.governance;
        Ok(())
    }

    // Registry scaffolding: we'll protect these via proposals in subsequent commits
    pub fn initialize_registry(_ctx: Context<InitializeRegistry>) -> Result<()> {
        // TODO: create policy PDA, initialize defaults (blocklist-only)
        Ok(())
    }

    pub fn add_blocked(_ctx: Context<UpdateRegistry>, _subject: Pubkey, _reason_code: u16) -> Result<()> {
        // TODO: write block entry (guarded by governance via proposal/execute)
        Ok(())
    }

    pub fn remove_blocked(_ctx: Context<UpdateRegistry>, _subject: Pubkey) -> Result<()> {
        // TODO: remove/clear block entry (guarded by governance via proposal/execute)
        Ok(())
    }
}

// Accounts

#[account]
pub struct Governance {
    pub members: Vec<Pubkey>,   // up to MAX_MEMBERS
    pub threshold: u8,          // approvals required
    pub delay_seconds: i64,     // execution delay after approval
    pub bump: u8,
}

impl Governance {
    pub fn space_for(members_len: usize) -> usize {
        // Discriminator + Vec len + members + threshold + delay + bump
        8 + 4 + (members_len * 32) + 1 + 8 + 1
    }
}

#[derive(Accounts)]
#[instruction(members: Vec<Pubkey>)]
pub struct InitializeGovernance<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = Governance::space_for(members.len().min(MAX_MEMBERS)),
        seeds = [b"governance"],
        bump
    )]
    pub governance: Account<'info, Governance>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeRegistry<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateRegistry<'info> {
    // In final version, authority will be the governance PDA (validated via CPI/context)
    pub authority: Signer<'info>,
}

// Errors
#[error_code]
pub enum ComplianceError {
    #[msg("Members list cannot be empty")] 
    EmptyMembers,
    #[msg("Too many members")] 
    TooManyMembers,
    #[msg("Invalid threshold")] 
    InvalidThreshold,
    #[msg("Duplicate member in members set")] 
    DuplicateMember,
}
