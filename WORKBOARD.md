# Team Workboard

Shared coordination file for **Aditya, Swaroop, and Gururaj**. Use it to divide work, record who is waiting on whom, reserve shared files, and plan merges. Code, tests, and pull requests remain the source of truth for implementation; this file is the secondary source for coordination.

Keep the copy on `main` current. Update it when claiming work, changing a dependency, handing work off, or merging. These are coordination locks, not locks enforced by Git.

## Current Ownership

Initial state: feature scope has not been defined; no tasks or locks are claimed.

| Developer | Active task IDs | Next action |
| --- | --- | --- |
| Aditya | — | Choose a feature and add its task below |
| Swaroop | — | Choose a separate feature and add its task below |
| Gururaj | — | Choose a separate feature and add its task below |

## Tasks & Dependencies

Give each task one owner and a permanent ID (`T-001`, `T-002`, …). Split shared features into independently reviewable tasks. Replace the empty row when adding the first task.

| ID | Feature / deliverable | Owner | Status | Depends on | Waiting on / needed handoff | Branch / PR | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | — | — | — | — |

Statuses: `ready`, `active`, `blocked`, `review`, `merged`.

- **Depends on:** list task IDs and the exact condition needed, such as `T-001: API contract agreed` or `T-002: merged`.
- **Waiting on:** name the person, missing output, and next action. Example: `Swaroop — confirm response fields; Aditya will then connect the UI`.
- **Done when:** describe observable acceptance criteria and required checks. Mark `merged` only after the implementation reaches `main`.
- A task can stay `active` while independent work continues. Use `blocked` when its next useful step cannot proceed. Avoid circular dependencies; agree on the interface first if two features need each other.

## Shared File Locks

Reserve only files or interfaces that could collide. Separate feature files usually need no lock. Include shared schemas, dependency manifests and their lockfiles, routing files, and configuration when relevant.

| File / directory / interface | Task | Lock owner | Reason | Claimed at | Review by | Waiting developer / task | Release condition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | — | — | — | — |

1. Read the latest board on `main` before claiming a task or lock. Publish the claim through a small coordination PR and merge it before editing the reserved scope.
2. Before merging a claim, recheck `main` for overlapping reservations. If two claims conflict, agree on one owner and update the other task's waiting entry.
3. While a lock is held, ask its owner for changes or work outside its scope. Do not silently edit reserved files.
4. Use timestamps with a timezone, for example `2026-10-02 15:00 IST`. “Review by” is a check-in deadline, not automatic permission to take over.
5. Release a lock when its changes merge, the work is abandoned, or an explicit handoff is recorded. For a handoff, link the branch or commit and name the new owner.
6. Remove released locks and clear affected waiting entries. Do not reserve this entire workboard; reconcile its edits against the latest `main`.

## Interfaces & Handoffs

Agree on shared inputs and outputs before implementing dependent features. Keep detailed contracts beside the code; link them here.

| Producer task / owner | Consumer task / owner | Contract or artifact | Agreed behavior / open question | Handoff link |
| --- | --- | --- | --- | --- |
| — | — | — | — | — |

Consumers may develop against an agreed contract using sample data. Record separately when integration still requires the producer's code to merge.

## Merge Queue

Merge prerequisites before dependent features. Independent features may merge in either order. The queue position is a plan; the “Ready after” condition controls readiness.

| Order | Task / PR | Ready after | Reviewer | Verification / result |
| --- | --- | --- | --- | --- |
| — | — | — | — | — |

- Use one branch per task: `aditya/T-001-short-name`, `swaroop/T-002-short-name`, or `gururaj/T-003-short-name`.
- Before review, integrate current `main` into the feature branch and resolve conflicts with the owners of affected code.
- Ask another team member to review. Include what changed, acceptance checks, and any remaining blockers in the PR.
- Run the project's relevant checks and verify the integrated feature. If tooling does not exist yet, record the manual check performed and its result.
- After merging, update task status, remove its locks, and notify waiting teammates. Preserve unrelated board updates when merging an older feature branch.

## Update Checklist

- [ ] Task owner, status, branch, and acceptance criteria are current.
- [ ] Each blocker identifies the prerequisite, responsible person, and next action.
- [ ] Shared files have one agreed lock owner; stale locks have been reviewed.
- [ ] Merge conditions and verification results match the actual PR state.
