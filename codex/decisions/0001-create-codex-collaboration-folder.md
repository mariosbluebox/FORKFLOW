# 0001 - Create Codex Collaboration Folder

## Status

Accepted

## Date

2026-05-06

## Context

Marios  wants to use both Claude Code and Codex on this project. The project has mostly been built with Claude Code so far, but Mario wants a dedicated place for Codex conversations, reasoning, and decisions.

## Decision

Create a `codex/` folder at the project root.

The folder will contain concise Codex session summaries, decision records, an index, a working agreement, and open questions.

## Consequences

- Codex collaboration has a clear home inside the repository.
- Future Codex sessions can recover context without reading old raw chat transcripts.
- The folder should stay lightweight and should not duplicate the main specs or app documentation.
