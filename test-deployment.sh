#!/bin/bash

# Deployment Diagnostic Script for my-docs.ai
# This script tests all critical endpoints and reports issues

echo "🔍 Testing RealEstate Deal Agent Deployment"
echo "==========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Function to test endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local expected=$3
    
    echo -n "Testing $name... "
    
    response=$(curl -s -w "\n%{http_code}" --max-time 10 "$url" 2>&1)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        if [ -n "$expected" ] && [[ "$body" != *"$expected"* ]]; then
            echo -e "${RED}✗ FAILED${NC} (Status 200 but unexpected response)"
            echo "  Expected: $expected"
            echo "  Got: $body"
            FAILED=$((FAILED + 1))
        else
            echo -e "${GREEN}✓ PASSED${NC}"
            PASSED=$((PASSED + 1))
        fi
    else
        echo -e "${RED}✗ FAILED${NC} (HTTP $http_code)"
        if [ -n "$body" ]; then
            echo "  Response: $body"
        fi
        FAILED=$((FAILED + 1))
    fi
}

# Function to test SSE endpoint
test_sse() {
    local name=$1
    local url=$2
    
    echo -n "Testing $name... "
    
    response=$(curl -s -N --max-time 5 "$url" 2>&1 | head -n 2)
    
    if [[ "$response" == *"event: connected"* ]]; then
        echo -e "${GREEN}✓ PASSED${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗ FAILED${NC}"
        echo "  Expected: event: connected"
        echo "  Got: $response"
        FAILED=$((FAILED + 1))
    fi
}

# Function to test DNS
test_dns() {
    local domain=$1
    
    echo -n "Testing DNS for $domain... "
    
    if command -v dig &> /dev/null; then
        result=$(dig +short "$domain" 2>&1)
        if [ -n "$result" ]; then
            echo -e "${GREEN}✓ PASSED${NC}"
            echo "  Resolved to: $result"
            PASSED=$((PASSED + 1))
        else
            echo -e "${RED}✗ FAILED${NC}"
            echo "  DNS not configured or not propagated yet"
            FAILED=$((FAILED + 1))
        fi
    else
        echo -e "${YELLOW}⊘ SKIPPED${NC} (dig not available)"
    fi
}

echo "1. DNS Configuration"
echo "--------------------"
test_dns "my-docs.ai"
echo ""

echo "2. Backend API Tests"
echo "--------------------"
test_endpoint "Backend Health" "https://realestate-api.onrender.com/healthz" '"ok":true'
echo ""

echo "3. Frontend Tests"
echo "-----------------"
test_endpoint "Frontend Home" "https://my-docs.ai" ""
test_endpoint "Frontend Proxy Health" "https://my-docs.ai/healthz" '"ok":true'
echo ""

echo "4. SSE Connection Tests"
echo "-----------------------"
test_sse "SSE Events Endpoint" "https://my-docs.ai/ui/events"
echo ""

echo "5. API Endpoint Tests"
echo "---------------------"
# Test if /run endpoint is accessible (will fail without POST data, but should not 404)
echo -n "Testing /run endpoint accessibility... "
response=$(curl -s -w "\n%{http_code}" -X POST "https://my-docs.ai/run" -H "Content-Type: application/json" -d '{}' 2>&1)
http_code=$(echo "$response" | tail -n1)

if [ "$http_code" = "400" ] || [ "$http_code" = "200" ] || [ "$http_code" = "500" ]; then
    echo -e "${GREEN}✓ PASSED${NC} (Endpoint reachable, HTTP $http_code)"
    PASSED=$((PASSED + 1))
elif [ "$http_code" = "404" ]; then
    echo -e "${RED}✗ FAILED${NC} (404 - Proxy not configured)"
    FAILED=$((FAILED + 1))
else
    echo -e "${YELLOW}⚠ WARNING${NC} (HTTP $http_code)"
fi
echo ""

# Summary
echo "=========================================="
echo "Summary"
echo "=========================================="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed! Deployment is healthy.${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Check the output above.${NC}"
    echo ""
    echo "Common Issues:"
    echo "1. Backend sleeping (free tier) - Wait 60 seconds and retry"
    echo "2. CORS not configured - Check CORS_ORIGINS in backend env vars"
    echo "3. DNS not propagated - Wait up to 60 minutes"
    echo "4. Proxy not working - Check API_URL in frontend env vars"
    echo ""
    echo "See TROUBLESHOOT_DEPLOYMENT.md for detailed solutions"
    exit 1
fi
