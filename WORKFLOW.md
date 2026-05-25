# Git Workflow

## Who owns what

| Agent | Worktree | Branch | Remote access |
|---|---|---|---|
| Claude | `/DevOps/FORKFLOW` | feature branches off `main` | PR into `main` (no direct push) |
| Codex | `/DevOps/FORKFLOW-codex` | `codex-work` | Push to `origin/codex-work` only |

## Rules

- **Nobody pushes directly to `main`.** Both agents land work via PR, reviewed and merged by the human.
- Claude works on short-lived feature branches in `/DevOps/FORKFLOW`. One branch + one PR per task.
- Codex never runs commands inside `/DevOps/FORKFLOW`. All Codex work stays inside `/DevOps/FORKFLOW-codex`.
- Codex opens PRs from `codex-work` into `main`. Same review bar as Claude's PRs — never auto-merged.

## Claude workflow

For each task:

```bash
git switch -c <descriptive-branch-name>     # branch from current main
# ... make changes, commit ...
git push -u origin <branch>
gh pr create --base main --title "..." --body "..."
```

After the human merges the PR, sync local `main`:

```bash
git fetch origin
git switch main
git pull --ff-only
# or, if the merge changed the SHA (squash/rebase),
# reset after confirming with the human:
#   git reset --hard origin/main
```

Never `git push origin main`.

## Codex sync command (run before starting any work)

```bash
git fetch origin
git status --short --branch
git rebase origin/main
```

Use `origin/main` not `main` — after a fetch, `origin/main` reflects what has been merged via PR. The local `main` branch may be stale because it is checked out in the other worktree.

## Codex push command

```bash
git push origin codex-work
```

After a rebase:

```bash
git push --force-with-lease origin codex-work
```

Never `git push origin main`.
