#!/bin/bash

echo "🔍 Testing Notification Service on my-docs.ai"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Backend health
echo "1️⃣  Testing Backend Health..."
BACKEND_HEALTH=$(curl -s -w "\n%{http_code}" https://realestate-ai-agent.onrender.com/healthz)
BACKEND_CODE=$(echo "$BACKEND_HEALTH" | tail -n1)
BACKEND_BODY=$(echo "$BACKEND_HEALTH" | head -n1)

if [ "$BACKEND_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Backend is running${NC}"
    echo "   Response: $BACKEND_BODY"
else
    echo -e "${RED}❌ Backend is down or sleeping (Code: $BACKEND_CODE)${NC}"
    echo -e "${YELLOW}   Waking up backend... (wait 30 seconds)${NC}"
    sleep 30
    BACKEND_HEALTH=$(curl -s -w "\n%{http_code}" https://realestate-ai-agent.onrender.com/healthz)
    BACKEND_CODE=$(echo "$BACKEND_HEALTH" | tail -n1)
    if [ "$BACKEND_CODE" = "200" ]; then
        echo -e "${GREEN}✅ Backend is now awake${NC}"
    else
        echo -e "${RED}❌ Backend failed to wake up${NC}"
        exit 1
    fi
fi
echo ""

# Test 2: Frontend proxy health
echo "2️⃣  Testing Frontend Proxy..."
PROXY_HEALTH=$(curl -s -w "\n%{http_code}" https://my-docs.ai/healthz)
PROXY_CODE=$(echo "$PROXY_HEALTH" | tail -n1)
PROXY_BODY=$(echo "$PROXY_HEALTH" | head -n1)

if [ "$PROXY_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Frontend proxy is working${NC}"
    echo "   Response: $PROXY_BODY"
else
    echo -e "${RED}❌ Frontend proxy failed (Code: $PROXY_CODE)${NC}"
    echo "   Response: $PROXY_BODY"
fi
echo ""

# Test 3: SSE endpoint (direct backend)
echo "3️⃣  Testing SSE Endpoint (Direct Backend)..."
SSE_DIRECT=$(timeout 3 curl -s -N https://realestate-ai-agent.onrender.com/ui/events | head -n 3)
if [ -n "$SSE_DIRECT" ]; then
    echo -e "${GREEN}✅ Backend SSE endpoint is working${NC}"
    echo "$SSE_DIRECT"
else
    echo -e "${RED}❌ Backend SSE endpoint not responding${NC}"
fi
echo ""

# Test 4: SSE endpoint (via proxy)
echo "4️⃣  Testing SSE Endpoint (Via Proxy)..."
SSE_PROXY=$(timeout 3 curl -s -N https://my-docs.ai/ui/events | head -n 3)
if [ -n "$SSE_PROXY" ]; then
    echo -e "${GREEN}✅ Proxy SSE endpoint is working${NC}"
    echo "$SSE_PROXY"
else
    echo -e "${RED}❌ Proxy SSE endpoint not responding${NC}"
    echo -e "${YELLOW}   This is likely the issue!${NC}"
fi
echo ""

# Test 5: Test alert (direct backend)
echo "5️⃣  Sending Test Alert (Direct Backend)..."
ALERT_DIRECT=$(curl -s -X POST https://realestate-ai-agent.onrender.com/ui/test-alert)
echo "   Response: $ALERT_DIRECT"
SUBSCRIBERS=$(echo "$ALERT_DIRECT" | grep -o '"subscribers":[0-9]*' | grep -o '[0-9]*')
if [ "$SUBSCRIBERS" = "0" ]; then
    echo -e "${YELLOW}⚠️  No subscribers connected${NC}"
else
    echo -e "${GREEN}✅ $SUBSCRIBERS subscriber(s) connected${NC}"
fi
echo ""

# Test 6: Test alert (via proxy)
echo "6️⃣  Sending Test Alert (Via Proxy)..."
ALERT_PROXY=$(curl -s -X POST https://my-docs.ai/ui/test-alert)
echo "   Response: $ALERT_PROXY"
echo ""

# Test 7: Check CORS headers
echo "7️⃣  Checking CORS Headers..."
CORS_HEADERS=$(curl -s -I -X OPTIONS https://my-docs.ai/ui/events)
if echo "$CORS_HEADERS" | grep -q "access-control-allow-origin"; then
    echo -e "${GREEN}✅ CORS headers present${NC}"
    echo "$CORS_HEADERS" | grep -i "access-control"
else
    echo -e "${YELLOW}⚠️  CORS headers not found${NC}"
fi
echo ""

# Summary
echo "=============================================="
echo "📋 Summary"
echo "=============================================="
echo ""
echo "Backend URL: https://realestate-ai-agent.onrender.com"
echo "Frontend URL: https://my-docs.ai"
echo ""
echo "Next Steps:"
echo "1. If backend was sleeping, try again after it's awake"
echo "2. If SSE proxy fails, check Render logs for 'deal-agent-ui-proxy'"
echo "3. If no subscribers, open https://my-docs.ai in browser first"
echo "4. Check browser console for connection errors"
echo ""
echo "To test in browser:"
echo "  1. Open https://my-docs.ai"
echo "  2. Open DevTools (F12) → Console"
echo "  3. Look for: [notifications-panel] SSE connection established"
echo "  4. Run: curl -X POST https://my-docs.ai/ui/test-alert"
echo "  5. Check bell icon (🔔) for notification"
