# Codex Working Agreement

This file describes how Mario wants to use Codex alongside Claude Code on this project.

## Purpose

- Claude Code may continue implementation work.
- Codex is used for careful reasoning, architecture review, implementation support, and decision tracking.
- The `codex/` folder stores conversation summaries and decisions made between Mario and Codex.

## Collaboration Rules

- Do not change app files unless Mario asks Codex to implement something.
- Before editing existing code, inspect the current state and work with any changes already present.
- Record meaningful decisions in `codex/decisions/`.
- Record useful session summaries in `codex/sessions/`.
- Keep notes concise and connected to the project source of truth.
- Treat `SPEC.md`, `SPEC2.md`, and `PHASE4.md` as product planning sources unless superseded by a later explicit decision.

## What Belongs Here

- Why a decision was made.
- What tradeoffs were considered.
- Current project understanding after a Codex session.
- Questions Mario and Codex need to revisit.

## What Does Not Belong Here

- Long raw chat transcripts.
- Generated build artifacts.
- Duplicate copies of specs.
- Temporary scratch notes that are no longer useful.
