# DealSense Chat - Testing Guide

## 🧪 Pre-Launch Testing Checklist

### Environment Setup
- [ ] `OPENAI_API_KEY` set in `orchestrator/.env`
- [ ] `SERPER_API_KEY` set (for web search)
- [ ] `FRED_API_KEY` set (optional, for risk analysis)
- [ ] `BLS_API_KEY` set (optional, for risk analysis)
- [ ] Dependencies installed: `cd orchestrator && npm install`
- [ ] Frontend dependencies installed: `cd deal-agent-ui && npm install`

### Backend Tests

#### 1. Server Startup
```bash
cd orchestrator
npm run dev
```
**Expected**: Server starts on port 3001 without errors

#### 2. Health Check
```bash
curl http://localhost:3001/healthz
```
**Expected**: `{"ok":true}`

#### 3. Chat Endpoint Test (No API Key)
```bash
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'
```
**Expected**: Error message about missing API key OR successful response if key is set

#### 4. Chat Endpoint Test (With Context)
```bash
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role":"user","content":"What is the average PE score?"}],
    "context": {
      "scored": [
        {"title":"Property 1","peScore":75},
        {"title":"Property 2","peScore":82}
      ],
      "portfolioData": {"avgPE":78}
    }
  }'
```
**Expected**: Response analyzing the context

### Frontend Tests

#### 1. App Startup
```bash
cd deal-agent-ui
npx ng serve --hmr
```
**Expected**: App compiles and starts on port 4200

#### 2. Visual Tests
- [ ] Navigate to `http://localhost:4200`
- [ ] Chat button visible in bottom-right corner
- [ ] Chat button shows "💬 Ask AI"
- [ ] Clicking button opens chat window
- [ ] Chat window is 420px × 600px
- [ ] Welcome message displays
- [ ] Quick action buttons visible
- [ ] Input field and send button present

#### 3. Interaction Tests
- [ ] Type message in input field
- [ ] Press Enter sends message
- [ ] Click send button sends message
- [ ] User message appears in chat
- [ ] Loading indicator shows during processing
- [ ] Assistant response appears
- [ ] Scroll automatically goes to bottom
- [ ] Click quick action button triggers query

### Integration Tests

#### Test 1: Simple Question
**Input**: "Hello"
**Expected**: Greeting response without tool calls
**Verify**: 
- Response time < 3 seconds
- No tool badge shown
- Message formatted correctly

#### Test 2: Search Query
**Input**: "Find medical office buildings in Texas"
**Expected**: 
- Tool badge shows "Web Search"
- Response includes property details
- Response time 3-5 seconds
**Verify**:
- Search executed
- PE scoring applied
- Risk analysis included
- Results formatted with citations

#### Test 3: Context Question (After Search)
**Input**: "Which property has the highest PE score?"
**Expected**:
- Uses context from previous search
- Identifies specific property
- Cites PE score
**Verify**:
- No new search triggered
- Context analysis tool used
- Accurate information

#### Test 4: Score Explanation
**Input**: "Why did the first property score 78?"
**Expected**:
- Detailed factor breakdown
- PE components explained
- Professional tone
**Verify**:
- Factors listed
- Scores explained
- No hallucinated data

#### Test 5: IC Memo Generation
**Input**: "Create an IC memo for the top deal"
**Expected**:
- Professional memo format
- All sections included
- Markdown formatting
**Verify**:
- Executive summary present
- Property details accurate
- Recommendations included
- Professional language

#### Test 6: Portfolio Analytics
**Input**: "How many premium deals do we have?"
**Expected**:
- Count of premium tier deals
- List of properties
- Tier criteria explained
**Verify**:
- Accurate count
- Correct tier classification
- Context used properly

### Error Handling Tests

#### Test 1: Missing API Key
**Setup**: Remove `OPENAI_API_KEY` from `.env`
**Expected**: Clear error message to user
**Verify**: "OPENAI_API_KEY not configured" message

#### Test 2: Invalid API Key
**Setup**: Set invalid API key
**Expected**: Error caught and displayed
**Verify**: User-friendly error message

#### Test 3: Network Timeout
**Setup**: Disconnect internet
**Expected**: Timeout error handled gracefully
**Verify**: Error message displayed, app doesn't crash

#### Test 4: Empty Message
**Input**: "" (empty string)
**Expected**: Send button disabled
**Verify**: Cannot send empty messages

#### Test 5: Very Long Message
**Input**: 5000 character message
**Expected**: Message sent or length validation
**Verify**: No crash, reasonable handling

### Performance Tests

#### Test 1: Response Time
**Queries**: 10 different simple questions
**Expected**: Average < 3 seconds
**Measure**: Time from send to response

#### Test 2: Tool Call Performance
**Queries**: 5 search queries
**Expected**: Average < 5 seconds
**Measure**: Time including tool execution

#### Test 3: Concurrent Requests
**Setup**: Open 3 browser tabs
**Action**: Send messages simultaneously
**Expected**: All respond correctly
**Verify**: No race conditions

#### Test 4: Memory Usage
**Action**: Send 50 messages
**Expected**: No memory leaks
**Verify**: Browser memory stable

### UI/UX Tests

#### Test 1: Mobile Responsiveness
**Device**: iPhone/Android simulator
**Expected**: Chat button and window display correctly
**Verify**: Touch interactions work

#### Test 2: Long Conversation
**Action**: Send 20 messages
**Expected**: Scroll works, messages display
**Verify**: Performance remains good

#### Test 3: Markdown Rendering
**Input**: Message with **bold**, *italic*, [1] citations
**Expected**: Proper HTML rendering
**Verify**: Formatting displays correctly

#### Test 4: Tool Badge Display
**Action**: Trigger each tool type
**Expected**: Correct badge for each tool
**Verify**: 
- Web Search badge
- PE Scoring badge
- Risk Analysis badge
- IC Memo badge
- Context Analysis badge

#### Test 5: Unread Counter
**Action**: Receive message while chat closed
**Expected**: Unread badge shows
**Verify**: Counter increments, clears on open

### Security Tests

#### Test 1: XSS Prevention
**Input**: `<script>alert('xss')</script>`
**Expected**: Script not executed
**Verify**: Displayed as text, not code

#### Test 2: SQL Injection (N/A)
**Note**: No direct database queries
**Verify**: No SQL injection vectors

#### Test 3: API Key Exposure
**Action**: Inspect frontend code
**Expected**: No API keys in frontend
**Verify**: Keys only in backend .env

#### Test 4: CORS
**Action**: Request from different origin
**Expected**: CORS policy enforced
**Verify**: Unauthorized origins blocked

### Load Tests

#### Test 1: Rapid Fire
**Action**: Send 10 messages in 10 seconds
**Expected**: All processed correctly
**Verify**: No errors, responses in order

#### Test 2: Large Context
**Setup**: Context with 100 deals
**Expected**: Handles large context
**Verify**: No performance degradation

#### Test 3: Long Session
**Duration**: 1 hour continuous use
**Expected**: No degradation
**Verify**: Memory stable, responses consistent

## 🐛 Common Issues & Solutions

### Issue: Chat button not appearing
**Cause**: Component not imported
**Solution**: Verify `ChatPanelComponent` in `app.ts` imports
**Test**: Check browser console for errors

### Issue: "API key not configured"
**Cause**: Missing `OPENAI_API_KEY`
**Solution**: Add to `orchestrator/.env`
**Test**: Restart backend server

### Issue: Slow responses
**Cause**: Network latency or API issues
**Solution**: Check OpenAI API status
**Test**: Try simple query, measure time

### Issue: Tool calls failing
**Cause**: Missing dependencies or API keys
**Solution**: Verify all API keys set
**Test**: Check server logs for errors

### Issue: Context not passing
**Cause**: `getChatContext()` not returning data
**Solution**: Verify deals signal has data
**Test**: Console.log context in component

### Issue: Markdown not rendering
**Cause**: `formatMessage()` not called
**Solution**: Check template uses `[innerHTML]`
**Test**: Inspect rendered HTML

## 📊 Test Results Template

```
Test Date: _______________
Tester: _______________
Environment: Development / Staging / Production

Backend Tests:
[ ] Server startup: PASS / FAIL
[ ] Health check: PASS / FAIL
[ ] Chat endpoint: PASS / FAIL
[ ] Context handling: PASS / FAIL

Frontend Tests:
[ ] App startup: PASS / FAIL
[ ] Visual elements: PASS / FAIL
[ ] Interactions: PASS / FAIL
[ ] Responsiveness: PASS / FAIL

Integration Tests:
[ ] Simple question: PASS / FAIL
[ ] Search query: PASS / FAIL
[ ] Context question: PASS / FAIL
[ ] Score explanation: PASS / FAIL
[ ] IC memo generation: PASS / FAIL
[ ] Portfolio analytics: PASS / FAIL

Error Handling:
[ ] Missing API key: PASS / FAIL
[ ] Invalid API key: PASS / FAIL
[ ] Network timeout: PASS / FAIL
[ ] Empty message: PASS / FAIL
[ ] Long message: PASS / FAIL

Performance:
[ ] Response time: _____ seconds (avg)
[ ] Tool call time: _____ seconds (avg)
[ ] Concurrent requests: PASS / FAIL
[ ] Memory usage: PASS / FAIL

Security:
[ ] XSS prevention: PASS / FAIL
[ ] API key exposure: PASS / FAIL
[ ] CORS: PASS / FAIL

Overall Status: PASS / FAIL
Notes: _______________________________
```

## 🚀 Pre-Production Checklist

Before deploying to production:

- [ ] All tests passing
- [ ] Performance benchmarks met
- [ ] Security audit completed
- [ ] Error handling verified
- [ ] Documentation reviewed
- [ ] API keys secured
- [ ] Rate limiting configured
- [ ] Monitoring set up
- [ ] Backup plan in place
- [ ] Rollback procedure documented

## 📝 Test Scenarios

### Scenario 1: New User First Time
1. User opens app
2. Sees chat button
3. Clicks to open
4. Reads welcome message
5. Clicks "New Search" quick action
6. Sees search execute
7. Asks follow-up question
8. Gets relevant answer

### Scenario 2: Power User Workflow
1. User runs search via main interface
2. Reviews results
3. Opens chat
4. Asks "Which has best PE?"
5. Gets answer with context
6. Asks "Why?"
7. Gets detailed explanation
8. Requests "Create IC memo"
9. Receives formatted memo

### Scenario 3: Error Recovery
1. User sends message
2. Network error occurs
3. Error message displayed
4. User retries
5. Successful response
6. Conversation continues

## 🎯 Success Criteria

### Functional
- ✅ All 5 tools callable
- ✅ Context properly passed
- ✅ Responses accurate
- ✅ Errors handled gracefully

### Performance
- ✅ Simple queries < 3s
- ✅ Tool calls < 5s
- ✅ No memory leaks
- ✅ Concurrent requests work

### UX
- ✅ Intuitive interface
- ✅ Clear feedback
- ✅ Professional appearance
- ✅ Mobile friendly

### Security
- ✅ No XSS vulnerabilities
- ✅ API keys secured
- ✅ CORS configured
- ✅ Input validated

---

**Testing Status**: Ready for testing
**Last Updated**: October 5, 2025
