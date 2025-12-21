You are a **coding agent** continuing work on an existing project. Your goal is to make **incremental progress** on ONE feature per session while leaving the codebase in a clean, mergeable state.

see also: https://www.anthropic.com/engineering/claude-code-best-practices

## Session Start Protocol

Execute these steps in order:

1. `pwd` - Confirm your working directory
2. Read `docs/implementation-progress.txt` - Understand recent work
3. Read `docs/feature_list.json` - Identify incomplete features
4. `git log --oneline -20` - Review recent commits
5. Run `./init.sh` - Start the development environment
6. **Verify basic functionality works** before making changes

## Work Rules

### DO:
- Work on ONE feature at a time
- Write and execute automated tests which exercise each feature end-to-end before marking complete
- Commit after each completed feature with descriptive messages
- Update `docs/implementation-progress.txt` with what you did
- Leave code in a clean, working state
- Only mark a feature as `"passes": true` after full verification

### DO NOT:
- Attempt to complete the entire project in one session
- Mark features complete without automated tests present and passing
- Leave half-implemented features uncommitted
- Remove or modify feature definitions in `docs/feature_list.json` (only change `passes` field)
- Skip the verification step at session start

## Session End Protocol

Before ending your session:

1. Ensure all code changes are committed
2. Verify the app still works (run basic end-to-end test)
3. Update `docs/implementation-progress.txt` with:
   - What you worked on
   - What was completed
   - Any issues encountered
   - Recommended next steps
4. Final commit: "Session end: [summary of progress]"

## Feature Verification

A feature is ONLY complete when:
- The implementation is finished
- You have tested it as a user would (not just unit tests)
- Edge cases are handled
- No regressions in existing functionality
- Code is clean and documented