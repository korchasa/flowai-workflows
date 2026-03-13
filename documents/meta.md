# Meta-Agent Memory

## Agent Baselines
- pm (specification): ~2 turns, ~$0.87, 134s
- architect (design): ~14 turns, ~$0.47, 64s
- tech-lead (decision): 30t/131s (was 43t/275s) ← improved but still 2x target
- executor (build): iter1 30t/264s (was 9t/84s) ← REGRESSION
- qa (verify): iter1 15t/64s, loop passed in 1 iteration ← GOOD
- Total run: 1 loop iteration (QA passed first try)

## Active Patterns
- executor-read-overhead: RESOLVED, first seen 20260313T023047,
  last seen 20260313T161422. Build-iter-1 used only 9 turns (down from 50).
  Efficiency guidance working.
- first-pass-qa-success: FAILED, first seen 20260313T023047,
  last seen 20260313T161422. QA failed iter-1 due to external lint error
  (not impl quality). Loop ran 2 iterations.
- tech-lead-git-thrashing: WATCHING, first seen 20260313T161422,
  last seen 20260313T174006. Down from 43→30 turns but still used
  `git reset --hard` and read design.md 7x. Fix v2 applied: explicit
  prohibition on reset --hard, stronger read-once guidance.
- executor-iter2-reinvestigation: RESOLVED, first seen 20260313T161422,
  last seen 20260313T161422. No iter-2 in this run (QA passed first try).
- executor-todowrite-bloat: NEW, first seen 20260313T174006.
  Executor used 7 TodoWrite calls (wasting 7 turns of 30). Also read
  requirements.md and design.md despite "do not read" rule.
  Fix applied: banned TodoWrite, removed docs from Input section,
  tightened turn target to ≤15.
- tech-lead-code-grep: NEW, first seen 20260313T174006.
  Tech-lead grepped source code (4 Grep calls) to understand implementation
  details — outside its scope. Fix applied: explicit "do not grep source code".

## Applied Fixes Log
- 20260313T021326: pm — added CRITICAL HARD CONSTRAINT prohibiting PM from
  editing design.md → RESOLVED (confirmed in 20260313T023047: PM only wrote spec)
- 20260313T023047: executor — added efficiency guidance to reduce unnecessary
  file reads. Target: <40 turns. → RESOLVED (build-iter-1: 9 turns)
- 20260313T161422: tech-lead — simplified git workflow to avoid stash-pop
  conflicts; added error recovery guidance. Target: ≤15 turns. → PARTIAL
  (30 turns, down from 43, but still 2x target)
- 20260313T161422: executor — added explicit QA report path for iteration > 1;
  added "trust QA diagnosis" guidance. Target: ≤10 turns for fix iters.
  → NOT TESTED (no iter-2 this run)
- 20260313T174006: tech-lead — banned `git reset --hard`, banned source code
  grep, added read-once enforcement with typical-flow example. → WATCHING
- 20260313T174006: executor — banned TodoWrite, removed requirements.md/
  design.md from Input section, added minimize-check-runs rule, tightened
  target from ≤35 to ≤15 turns with typical-flow example. → WATCHING

## Lessons Learned
- PM/SDS-update scope overlap resolved by explicit constraints in PM prompt.
- Engine loop bug (buildContext node lookup) fixed in commit f9c9983.
- Total pipeline cost baseline for M-effort issue: ~$4.83.
- Pipeline config gap: build node in impl-loop has no input from verify,
  so executor on iter > 1 can't resolve QA report path via template vars.
  Workaround: hardcoded relative path in executor prompt. Consider adding
  verify as conditional input to build in pipeline.yaml.
- Git stash-pop across pipeline nodes is fragile — earlier nodes modify
  working tree files that cause merge conflicts on pop. Prefer clean
  branch creation without stash-pop.
- TodoWrite wastes ~1 turn per call. For agents with <10 tasks, the decision
  artifact IS the task list — no need for separate tracking.
- Providing a "typical flow" with concrete turn counts in the prompt helps
  agents self-calibrate. Applied to both tech-lead and executor.
