# Claude Agent Instructions - Timer Record

## Overview

This document contains the protocol for long-running autonomous development on the Timer Record project. Each coding session is a FRESH context window - you have no memory of previous sessions.

---

## SESSION WORKFLOW

**IMPORTANT: Work continuously! Complete one feature, immediately start the next. Keep working until context fills up, then /compact or /clear and continue.**

### STEP 1: GET YOUR BEARINGS (MANDATORY)

Start every session by orienting yourself:

```bash
# 1. See your working directory
pwd

# 2. List files to understand project structure
ls -la

# 3. Read the project specification
cat app_spec.txt

# 4. Read the feature list to see all work
cat feature-list.json | head -100

# 5. Read progress notes from previous sessions
cat claude-progress.md

# 6. Check recent git history (if git is initialized)
git log --oneline -20 2>/dev/null || echo "No git history"

# 7. Count remaining tests
echo "Passing: $(grep -c '"passes": true' feature-list.json 2>/dev/null || echo 0)"
echo "Failing: $(grep -c '"passes": false' feature-list.json 2>/dev/null || echo 0)"
```

Understanding `app_spec.txt` is critical - it contains the full requirements.

---

### STEP 2: RUN INIT SCRIPT

```bash
chmod +x init.sh
./init.sh
```

This will:
- Verify Node.js is installed
- Install dependencies if needed
- Build TypeScript
- Verify CLI works
- Show current test status

---

### STEP 3: VERIFICATION TEST (CRITICAL!)

**Before implementing anything new**, verify that previously passing features still work:

1. Look at `feature-list.json` for features with `"passes": true`
2. Run 2-3 verification tests on core functionality
3. Example verification for Timer Record:

```bash
# Test basic timer workflow
npm run tt status
npm run tt start programming
sleep 2
npm run tt stop
npm run tt today
```

**If ANY issues found:**
- Mark that feature as `"passes": false` immediately
- Add to fix list
- Fix ALL issues BEFORE moving to new features

---

### STEP 4: CHOOSE ONE FEATURE TO IMPLEMENT/TEST

Look at `feature-list.json` and find the highest-priority feature with `"passes": false`.

**Priority order:**
1. Build/compilation issues (tests 1-6)
2. Core commands: start, stop, status (tests 7-20)
3. Reporting: today, week (tests 28-38)
4. Categories and rules (tests 46-65)
5. Export functionality (tests 39-45)
6. Daemon/detection (tests 66-79)
7. Edge cases and style (tests 86+)

**Focus on ONE feature at a time.** Complete it fully before moving on.

---

### STEP 5: IMPLEMENT/FIX THE FEATURE

For each feature:

1. Read the test steps in `feature-list.json`
2. Run the commands specified
3. If it fails, investigate and fix
4. If it passes, move to verification

Example for test #8 "tt start programming starts a timer":
```bash
# Step 1: Run tt stop to ensure no active timer
npm run tt stop

# Step 2: Run tt start programming
npm run tt start programming

# Step 3: Verify success message is displayed
# (check output for success)

# Step 4: Run tt status to confirm timer is running
npm run tt status
```

---

### STEP 6: VERIFY WITH ACTUAL CLI OUTPUT

**You MUST verify through actual command execution:**

1. Run the exact commands from test steps
2. Check output matches expected behavior
3. Verify any side effects (database, files)

**DO:**
- Test with actual CLI commands
- Check exit codes when relevant
- Verify output format and colors

**DON'T:**
- Mark passing without running tests
- Assume code changes work
- Skip verification steps

---

### STEP 7: UPDATE feature-list.json

**ONLY modify the "passes" field:**

After thorough verification, change:
```json
"passes": false
```
to:
```json
"passes": true
```

**NEVER:**
- Remove tests
- Edit test descriptions
- Modify test steps
- Reorder tests
- Add new tests without explicit request

---

### STEP 8: COMMIT YOUR PROGRESS

If git is initialized:

```bash
git add .
git commit -m "Verify [feature name] - test #X passing

- Tested with actual CLI commands
- Updated feature-list.json
- Current status: X/210 tests passing"
```

---

### STEP 9: UPDATE PROGRESS NOTES

Update `claude-progress.md` with:

```markdown
### Session N - [Date/Description]
**Date:** YYYY-MM-DD
**Agent:** Coding Agent

**Accomplished:**
- [What you did]
- [Features tested/fixed]

**Test Status:** X/210 features passing

**Issues Found:**
- [Any bugs discovered]

**Next Session Should:**
- [What to work on next]
```

---

### STEP 10: END SESSION CLEANLY

Before context fills up:

1. Commit all working code (if using git)
2. Update `claude-progress.md`
3. Update `feature-list.json` if tests verified
4. Leave app in working state
5. Document what's next

---

## TEST EXECUTION EXAMPLES

### Testing Timer Commands

```bash
# Test 7: tt start without category
npm run tt start
# Expected: Shows available categories

# Test 8: tt start programming
npm run tt stop 2>/dev/null  # Clear any active timer
npm run tt start programming
# Expected: "Timer started for programming"

npm run tt status
# Expected: Shows running timer with programming category
```

### Testing Reports

```bash
# Test 28: tt today shows breakdown
npm run tt log -c programming -d 1h  # Create test data
npm run tt today
# Expected: Table with categories, time, percentage
```

### Testing Categories

```bash
# Test 48: tt categories add
npm run tt categories add test-cat-123
# Expected: Success message

npm run tt categories list
# Expected: test-cat-123 in list

# Cleanup
npm run tt categories remove test-cat-123
```

---

## IMPORTANT RULES

### Quality Over Speed
- One feature done right > multiple features half-done
- Verify everything before marking passing
- Fix broken things before adding new things

### Clean State
- Always leave the codebase working
- Don't commit broken code
- Update progress files before ending

### Feature List is Sacred
- ONLY change "passes" field
- NEVER remove or edit tests
- Tests are the source of truth

### Context Management
- You have fresh context each session
- Previous work is in `claude-progress.md`
- Read it carefully at start

---

## QUICK REFERENCE

### File Locations
```
app_spec.txt           - Project specification
feature-list.json      - All 210 test cases
claude-progress.md     - Session progress log
init.sh                - Setup script
```

### Common Commands
```bash
npm run build          - Compile TypeScript
npm run tt             - Run CLI (shows status)
npm run tt --help      - Show all commands
npm run tt start X     - Start timer for category X
npm run tt stop        - Stop current timer
```

### Test Count
```bash
# Passing
grep -c '"passes": true' feature-list.json

# Failing
grep -c '"passes": false' feature-list.json
```

---

## SESSION LIFECYCLE SUMMARY

```
┌─────────────────────────────────────────────────────────┐
│  SESSION START (only once per fresh context)            │
│  1. Read claude-progress.md                             │
│  2. Run ./init.sh                                       │
│  3. Quick verify passing features still work            │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  CONTINUOUS WORK LOOP (keep going!)                     │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  4. Pick next failing feature                    │   │
│  │  5. Test/implement the feature                   │   │
│  │  6. Verify with CLI execution                    │   │
│  │  7. Update feature-list.json ("passes": true)    │   │
│  │  8. IMMEDIATELY go to next feature               │   │
│  └──────────────────────────────────────────────────┘   │
│                         ↺                               │
│         (repeat until context fills up)                 │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  CONTEXT FULL → /compact or /clear                      │
│  9. Update claude-progress.md                           │
│  10. Commit changes                                     │
│  11. User runs /compact or /clear                       │
│  12. Agent restarts from STEP 1 with fresh context      │
└─────────────────────────────────────────────────────────┘
```

**DO NOT STOP between features. Keep working continuously.**

---

## Goal

**Production-quality CLI with all 210 tests passing.**

Each session: Complete at least one feature perfectly.

You have unlimited sessions. Focus on quality and clean state.
