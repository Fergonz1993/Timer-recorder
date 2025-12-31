#!/bin/bash

# ============================================
# Timer Record - Development Environment Setup
# ============================================
# This script sets up the development environment for the Timer Record CLI.
# Run this at the start of each development session.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Timer Record - Development Setup${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Step 1: Check Node.js
echo -e "${YELLOW}[1/5]${NC} Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "  ${GREEN}✓${NC} Node.js ${NODE_VERSION} found"
else
    echo -e "  ${RED}✗${NC} Node.js not found. Please install Node.js 18+"
    exit 1
fi

# Step 2: Install dependencies
echo -e "${YELLOW}[2/5]${NC} Checking dependencies..."
if [ -d "node_modules" ]; then
    echo -e "  ${GREEN}✓${NC} node_modules exists"
else
    echo -e "  Installing dependencies..."
    npm install
    echo -e "  ${GREEN}✓${NC} Dependencies installed"
fi

# Step 3: Build TypeScript
echo -e "${YELLOW}[3/5]${NC} Building TypeScript..."
npm run build 2>&1 | tail -1
if [ -d "dist" ] && [ -f "dist/bin/tt.js" ]; then
    echo -e "  ${GREEN}✓${NC} Build successful"
else
    echo -e "  ${RED}✗${NC} Build failed. Check TypeScript errors."
    exit 1
fi

# Step 4: Verify CLI works
echo -e "${YELLOW}[4/5]${NC} Verifying CLI..."
VERSION=$(node dist/bin/tt.js --version 2>&1)
if [ "$VERSION" = "1.0.0" ]; then
    echo -e "  ${GREEN}✓${NC} CLI version ${VERSION}"
else
    echo -e "  ${RED}✗${NC} CLI verification failed"
    exit 1
fi

# Step 5: Check database
echo -e "${YELLOW}[5/5]${NC} Checking database..."
node dist/bin/tt.js status > /dev/null 2>&1
echo -e "  ${GREEN}✓${NC} Database initialized"

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Environment Ready!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "  ${BLUE}Quick Commands:${NC}"
echo -e "    npm run tt status     - Check current timer status"
echo -e "    npm run tt start X    - Start timer for category X"
echo -e "    npm run tt stop       - Stop current timer"
echo -e "    npm run tt today      - Show today's summary"
echo -e "    npm run tt --help     - Show all commands"
echo ""
echo -e "  ${BLUE}Development Commands:${NC}"
echo -e "    npm run build         - Compile TypeScript"
echo -e "    npm run dev           - Watch mode"
echo ""
echo -e "  ${BLUE}Project Info:${NC}"
echo -e "    Project Dir:  ${PROJECT_DIR}"
echo -e "    Entry Point:  dist/bin/tt.js"
echo ""

# Print feature list status
if [ -f "feature-list.json" ]; then
    TOTAL=$(grep -c '"passes"' feature-list.json 2>/dev/null) || TOTAL=0
    PASSING=$(grep '"passes": true' feature-list.json 2>/dev/null | wc -l | tr -d ' ') || PASSING=0
    echo -e "  ${BLUE}Test Status:${NC}"
    echo -e "    ${PASSING}/${TOTAL} features passing"
    echo ""
fi
