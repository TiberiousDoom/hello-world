---
name: steward
description: How Foundry Front's PRs are looked after once open - CI, merging and issues. Read when watching or driving a PR in this repository.
---

# Looking after a PR

The full release loop is in `.claude/skills/ship/SKILL.md`. Once a PR is open:

- **The owner wants green PRs merged without asking.** When `build` and `relay` pass on the current head
  and there's no conflict, merge through the API with the exact head SHA, then delete the pending
  check-in and unsubscribe from the PR.
- **Red CI is this PR's to fix** unless `master` is red too. Reproduce it locally with
  `scripts/check.sh` (or one suite: `npx playwright test e2e/<file>.spec.ts`), fix it, check again,
  then push. Browser tests can be flaky under load: rerun a failing one alone before changing it, but
  never skip, disable or loosen a test to get green.
- **A merge conflict** is usually CHANGELOG, the version or DECISIONS, because another session released
  first. Merge `origin/master` in, renumber this PR's version and decision row to follow master's,
  and run the checks again.
- **Review comments:** fix small, clear asks in the next push. Put design questions to the owner.
- **After merging:** close the issues it fixed that didn't close themselves, each with a one-line
  comment naming the version.
