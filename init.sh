#!/bin/bash

# ============================================
# Timer Record - Long Harness Protocol Setup
# ============================================
# This script implements the "Get Your Bearings" step from Anthropic's
# Long Harness Protocol for autonomous development agents.
#
# Run this at the START of each development session.
#
# Protocol: https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Project root directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo ""
echo -e "${BOLD}${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${BLUE}║     TIMER RECORD CLI - LONG HARNESS PROTOCOL                   ║${NC}"
echo -e "${BOLD}${BLUE}║     Session Initialization                                      ║${NC}"
echo -e "${BOLD}${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================
# STEP 1: GET YOUR BEARINGS
# ============================================
echo -e "${BOLD}${CYAN}STEP 1: GET YOUR BEARINGS${NC}"
echo -e "${CYAN}─────────────────────────────────────────────${NC}"

# 1.1 Working directory
echo -e "\n${YELLOW}[1.1]${NC} Working Directory:"
echo -e "  ${GREEN}→${NC} $PROJECT_DIR"

# 1.2 Project structure
echo -e "\n${YELLOW}[1.2]${NC} Project Structure:"
ls -la | head -20 | sed 's/^/  /'

# 1.3 Recent git history
echo -e "\n${YELLOW}[1.3]${NC} Recent Git History:"
git log --oneline -10 2>/dev/null | sed 's/^/  /' || echo "  (no git history)"

# 1.4 Feature list status
echo -e "\n${YELLOW}[1.4]${NC} Feature Status:"
if [ -f "feature-list.json" ]; then
    TOTAL=$(grep -c '"passes"' feature-list.json 2>/dev/null) || TOTAL=0
    PASSING=$(grep '"passes": true' feature-list.json 2>/dev/null | wc -l | tr -d ' ') || PASSING=0
    FAILING=$((TOTAL - PASSING))
    PERCENT=$((PASSING * 100 / TOTAL))
    echo -e "  ${GREEN}✓ Passing:${NC} $PASSING"
    echo -e "  ${RED}✗ Failing:${NC} $FAILING"
    echo -e "  ${BLUE}Total:${NC}    $TOTAL ($PERCENT%)"
else
    echo -e "  ${RED}✗${NC} feature-list.json not found"
fi

# 1.5 Progress notes
echo -e "\n${YELLOW}[1.5]${NC} Previous Session Notes:"
if [ -f "claude-progress.txt" ]; then
    tail -30 claude-progress.txt | sed 's/^/  /'
else
    echo -e "  ${YELLOW}!${NC} No previous progress notes found"
fi

# ============================================
# STEP 2: ENVIRONMENT SETUP
# ============================================
echo ""
echo -e "${BOLD}${CYAN}STEP 2: ENVIRONMENT SETUP${NC}"
echo -e "${CYAN}─────────────────────────────────────────────${NC}"

# 2.1 Check Node.js
echo -e "\n${YELLOW}[2.1]${NC} Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "  ${GREEN}✓${NC} Node.js ${NODE_VERSION} found"
else
    echo -e "  ${RED}✗${NC} Node.js not found. Please install Node.js 18+"
    exit 1
fi

# 2.2 Install dependencies
echo -e "\n${YELLOW}[2.2]${NC} Checking dependencies..."
if [ -d "node_modules" ]; then
    echo -e "  ${GREEN}✓${NC} node_modules exists"
else
    echo -e "  Installing dependencies..."
    npm install
    echo -e "  ${GREEN}✓${NC} Dependencies installed"
fi

# 2.3 Build TypeScript
echo -e "\n${YELLOW}[2.3]${NC} Building TypeScript..."
npm run build 2>&1 | tail -1
if [ -d "dist" ] && [ -f "dist/bin/tt.js" ]; then
    echo -e "  ${GREEN}✓${NC} Build successful"
else
    echo -e "  ${RED}✗${NC} Build failed. Check TypeScript errors."
    exit 1
fi

# 2.4 Run unit tests
echo -e "\n${YELLOW}[2.4]${NC} Running unit tests..."
npm test 2>&1 | tail -5 | sed 's/^/  /'

# 2.5 Verify CLI works
echo -e "\n${YELLOW}[2.5]${NC} Verifying CLI..."
VERSION=$(node dist/bin/tt.js --version 2>&1)
echo -e "  ${GREEN}✓${NC} CLI version ${VERSION}"

# ============================================
# STEP 3: NEXT ACTIONS
# ============================================
echo ""
echo -e "${BOLD}${CYAN}STEP 3: NEXT ACTIONS${NC}"
echo -e "${CYAN}─────────────────────────────────────────────${NC}"

# Find next failing feature
echo -e "\n${YELLOW}Next feature to implement:${NC}"
if [ -f "feature-list.json" ]; then
    # Get first failing feature
    python3 -c "
import json
with open('feature-list.json') as f:
    data = json.load(f)
for item in data:
    if not item.get('passes', False):
        print(f\"  ID: {item.get('id', 'N/A')}\")
        print(f\"  Area: {item.get('area', 'N/A')}\")
        print(f\"  Description: {item.get('description', 'N/A')}\")
        if 'steps' in item:
            print(f\"  Steps: {len(item['steps'])} steps\")
        break
" 2>/dev/null || echo "  (Could not parse feature list)"
fi

echo ""
echo -e "${BOLD}${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║     ENVIRONMENT READY - BEGIN DEVELOPMENT                      ║${NC}"
echo -e "${BOLD}${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}Development Workflow:${NC}"
echo -e "  1. ${CYAN}Read${NC} claude-progress.txt for context"
echo -e "  2. ${CYAN}Verify${NC} 1-2 passing features still work"
echo -e "  3. ${CYAN}Implement${NC} one feature from feature-list.json"
echo -e "  4. ${CYAN}Test${NC} thoroughly with CLI commands"
echo -e "  5. ${CYAN}Update${NC} feature-list.json (only change 'passes' field)"
echo -e "  6. ${CYAN}Commit${NC} changes with descriptive message"
echo -e "  7. ${CYAN}Update${NC} claude-progress.txt"
echo ""
echo -e "${BOLD}CLI Testing Commands:${NC}"
echo -e "  node dist/bin/tt.js start programming   - Start timer"
echo -e "  node dist/bin/tt.js stop                - Stop timer"
echo -e "  node dist/bin/tt.js status              - Check status"
echo -e "  node dist/bin/tt.js today               - Today's summary"
echo -e "  node dist/bin/tt.js --help              - All commands"
echo ""
