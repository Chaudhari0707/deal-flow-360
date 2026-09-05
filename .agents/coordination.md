# Linear, Worktree, and Device Coordination

Load for Linear-scoped work, parallel contributors, multiple machines, worktrees, or handoff.

## Start and claim

1. Read the exact Linear issue, acceptance criteria, dependencies, and latest maintainer comments.
2. Check existing worktrees, branches, open PRs, and the issue discussion for active ownership.
3. If parallel work is possible, post one claim before editing:

```text
## Work claim
- Branch: agent/<issue-id>-<slug>
- Device/OS: <short non-sensitive label>
- Scope: <acceptance criteria owned>
- Files/surfaces: <expected areas>
- Depends on: <issue/branch/none>
- Started: <UTC timestamp>
```

4. Treat the earliest still-active non-conflicting claim as owner. Do not edit the same files from
   two devices without recording an explicit split.

## Branch and worktree rules

- Start from current `origin/main` unless the issue names a dependency branch.
- One issue normally has one branch and one worktree. A second device joins the existing branch only
  after the first device has pushed and posted a clean handoff.
- Before switching devices, ensure the branch is pushed, the tree is clean, and generated/local
  artifacts are not part of the handoff.
- Never remove a worktree with uncommitted changes, unique commits, an open PR, or an active claim.
- Reconcile shared files early. If two tasks need the same migration, manifest, lockfile, route, or
  global config, name a single writer in Linear.

## Progress and handoff

Post progress only when it changes what another contributor needs to know. Use this block before
ending work on a branch that somebody else may continue:

```text
## Branch handoff
- Branch: <name>
- Tip SHA: <sha or uncommitted>
- PR: <url or none>
- Completed: <scope>
- Remaining: <scope>
- Checks: <commands and results>
- Platforms: <exercised; unverified>
- Dirty files: <paths or none>
- Next action: <one concrete step>
```

## Linear status

- Do not move an issue to Done while acceptance criteria remain unverified.
- A platform-specific criterion passes only on that platform or device. A run on another OS is not
  the same evidence.
- If a required device is unavailable, keep the task active and leave the exact command/observable
  and next operator action. Hackathon urgency may narrow validation only when the issue/user accepts
  that risk explicitly.
