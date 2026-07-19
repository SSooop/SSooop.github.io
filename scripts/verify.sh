#!/bin/bash

# IntelliPharma Hub - Verification Script
# This script verifies that all checks pass before deployment

set -e

echo "=========================================="
echo "IntelliPharma Hub - Verification Script"
echo "=========================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter for results
PASSED=0
FAILED=0

# Function to run check
run_check() {
    local name="$1"
    local command="$2"

    echo -n "Checking $name... "
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASSED${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        ((FAILED++))
        return 1
    fi
}

# Run all checks
echo "Running verification checks..."
echo ""

run_check "Content audit" "pnpm content:audit"
run_check "Prettier formatting" "pnpm format:check"
run_check "ESLint" "pnpm lint"
run_check "TypeScript types" "pnpm type-check"
run_check "Build" "pnpm build"
run_check "Internal links" "pnpm links:check"

echo ""
echo "=========================================="
echo "Results:"
echo -e "  ${GREEN}Passed: $PASSED${NC}"
echo -e "  ${RED}Failed: $FAILED${NC}"
echo "=========================================="
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All checks passed! Ready for deployment.${NC}"
    exit 0
else
    echo -e "${RED}Some checks failed. Please fix the issues above.${NC}"
    exit 1
fi
