# Git Workflow

## Who owns what

| Agent | Worktree | Branch | Remote access |
|---|---|---|---|
| Claude | `/DevOps/FORKFLOW` | `main` | Push to `origin/main` |
| Codex | `/DevOps/FORKFLOW-codex` | `codex-work` | Push to `origin/codex-work` only |

## Rules

- `main` is Claude's branch. Codex never commits or pushes to it.
- Codex never runs commands inside `/DevOps/FORKFLOW`. All Codex work stays inside `/DevOps/FORKFLOW-codex`.
- If Codex opens a PR from `codex-work` into `main`, it goes through human review — never auto-merged.

## Codex sync command (run before starting any work)

```bash
git fetch origin
git status --short --branch
git rebase origin/main
```

Use `origin/main` not `main` — after a fetch, `origin/main` reflects what Claude pushed to GitHub. The local `main` branch may be stale because it is checked out in the other worktree.

## Codex push command

```bash
git push origin codex-work
```

After a rebase:

```bash
git push --force-with-lease origin codex-work
```

Never `git push origin main`.
