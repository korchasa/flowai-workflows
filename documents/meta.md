# Meta-Agent Memory

## Agent Baselines
- pm (specification): 14t/$0.89/289s — cost up (was $0.65)
- architect (design): 17t/$0.52/94s — turns up (was 11t), cost stable
- tech-lead (decision): 18t/$0.84/301s — regressed (was 13t/$0.50)
- developer (build): 29t/$1.39/253s — major regression (was 16t/$0.51)
- qa (verify): 16t/$0.83/241s — slightly up (was 19t/$0.73)
- Total run cost: $4.46 (up from $2.88)
- 1 iteration (QA passed first try)

## Active Patterns
- skill-self-invoke-cross-agent: RESOLVED (clean in 172829). No Skill calls.
- agent-skill-read-waste: RESOLVED (clean in 172829). No .claude/skills/ reads.
- merge-conflict-corruption: RESOLVED (clean in 172829).
- cross-run-path-confusion: RESOLVED (3rd clean run: 172829).
- tech-lead-design-reread: RESOLVED (2nd clean run: 172829).
- developer-bash-whitelist-violation: RESOLVED (2nd clean run: 172829).
- scope-unaware-doc-reads: NEW, first seen 20260314T172829. All agents read ALL
  4 SRS/SDS docs regardless of issue scope. For engine-scope task, developer
  read SRS-sdlc + SDS-sdlc (2 wasted), tech-lead read SRS-sdlc + SDS-sdlc +
  AGENTS.md (3 wasted), architect read SRS-sdlc + SDS-sdlc (2 wasted).
  Fix: added scope-aware read algorithm to architect, tech-lead, developer.
- developer-grep-after-read-v2: NEW, first seen 20260314T172829. Developer
  Grepped requirements-engine.md 4× and design-engine.md 2× AFTER Reading them.
  Rule exists but was ignored. Updated evidence to reference this run.

## Resolved Patterns
- pm-tool-results-reread: RESOLVED (3+ clean runs)
- developer-grep-after-read: RESOLVED (3+ clean runs)
- qa-double-check: RESOLVED (3+ clean runs)
- tech-lead-write-rewrite: RESOLVED (3+ clean runs)
- developer-scope-creep: RESOLVED (2+ clean runs)
- pm-branch-shortcut-violation: RESOLVED (2 clean runs: 085155, 092842)
- pm-grep-after-read-v2: RESOLVED (pruned)
- qa-grep-after-read-v4: RESOLVED (pruned)
- qa-tool-results-path-typos: RESOLVED (pruned)
- developer-double-edit: RESOLVED (pruned)
- qa-bash-grep-v3: RESOLVED (3+ clean runs, 083240 branch)
- qa-double-deno-check: RESOLVED (083240 branch)
- qa-toolsearch: RESOLVED (3+ clean runs, 083240 branch)
- dev-toolsearch: RESOLVED (083240 branch)
- tl-toolsearch: RESOLVED (083240 branch)
- architect-git-archaeology: RESOLVED (3+ clean runs)

## Applied Fixes Log
- 20260313T021326–20260314T085155: (compressed — see git history for details)
- 20260314T092842: ALL 7 agents — resolved merge conflict markers in SKILL.md
  (root cause of persistent Skill self-invocation). developer + qa — added
  HARD STOP prohibition on reading `.claude/skills/` files (9+6 wasted Reads).
  PM prompt consolidated (removed duplicate execution algorithm, kept STEP 1-6).
  meta.md — resolved merge conflict between HEAD and origin/main branches.
- 20260314T172829: architect + tech-lead + developer — added scope-aware doc
  reading (read ONLY scope-relevant SRS/SDS based on spec frontmatter `scope:`
  field). developer — updated Grep-after-Read evidence with this run's data.

## Lessons Learned
- Total pipeline cost baseline for S-effort issue: ~$2.50.
- Run artifacts under .sdlc/runs/ are gitignored — agents must use `git add -f`.
- QA self-approval fails (same user can't approve own PR). Need fallback path.
- **Blacklist approach fails for Bash commands.** WHITELIST is correct.
- **Rule placement matters.** HARD STOP before Responsibilities = strongest.
- **Cross-agent patterns:** Fix in one agent, apply to ALL.
- **Positive algorithms > prohibition.** Algorithm approach works better.
- **Cost trajectory:** $5.09→$2.31→$2.24→$2.76→$4.11→$2.50→$2.88→$4.46.
- **Scope-aware reads save ~25k tokens/agent.** Out-of-scope SRS/SDS docs add
  context that inflates cost per turn. Biggest impact on developer (most turns).
- **Scope enforcement needs explicit file path deny-lists.**
- **Merge conflicts in agent prompts are catastrophic.** They corrupt prompt
  structure — rules between conflict markers become unparseable. This was likely
  the root cause of Skill self-invocation persisting for 10+ runs despite
  escalating prohibition language. Always verify no conflict markers after merge.
- **requirements.md approaching 25k token limit.** PM hit 26k token Read error
  in 092842, causing fallback to 6 Grep calls. May need to split SRS.
- **Pre-flight checks > prohibition.** Self-check steps work better than bans.
- **Positive alternatives with exact syntax.** Providing exact Grep call syntax
  eliminates gap between "don't use bash grep" and knowing the alternative.
- **ToolSearch for built-in tools is a cross-agent anti-pattern.**
- **Background Bash is an anti-pattern for short commands.**
