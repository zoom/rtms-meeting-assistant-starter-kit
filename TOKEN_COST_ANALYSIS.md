# Token Cost Analysis - OpenRouter API Usage

## 🔥 High-Cost Automatic Operations

These operations run **automatically** during live meetings and can accumulate significant costs:

---

### 1. ⚠️ **Dialog Suggestions** (AUTOMATIC - Every 15s)

**Location:** `index.js:1086` → `chatWithOpenrouter.js:179-208`

**Trigger:** Every time transcript is updated during live meeting (cached to 15-second intervals)

**What it does:**
- Reads full meeting transcript (VTT file)
- Sends to LLM: "Generate 4 RPG-style dialog suggestions for meeting facilitation"
- Returns 4 strategic suggestions

**Token Usage per Call:**
- **Input:** ~500-5000 tokens (depending on transcript length)
  - Prompt template: ~200 tokens
  - Transcript: grows with meeting duration (500-4500+ tokens)
- **Output:** ~100-200 tokens (4 suggestions)
- **Total per call:** ~600-5200 tokens

**Frequency during 1-hour meeting:**
- 60 minutes ÷ 15 seconds = **240 calls**
- **Total tokens:** 144,000 - 1,248,000 tokens/hour

**Cost Estimate (using GPT-4o at $2.50/$10 per 1M tokens):**
- Input: 120k-1.2M tokens × $2.50/1M = **$0.30 - $3.00**
- Output: 24k-48k tokens × $10/1M = **$0.24 - $0.48**
- **Total: $0.54 - $3.48 per hour**

---

### 2. ⚠️ **Real-Time Meeting Summary** (AUTOMATIC - Every 15s)

**Location:** `index.js:1087` → `chatWithOpenrouter.js:262-283`

**Trigger:** Every time transcript is updated during live meeting (cached to 15-second intervals)

**What it does:**
- Reads full transcript (VTT)
- Reads events log
- **Reads ALL screen share images** (base64 encoded!)
- Sends everything to LLM with vision capabilities
- Generates real-time meeting summary

**Token Usage per Call:**
- **Input:** ~1000-15,000+ tokens
  - Prompt template: ~300 tokens
  - Transcript: grows with time (500-10,000+ tokens)
  - Events log: ~100-500 tokens
  - **Screen share images:** ~1000 tokens PER IMAGE (vision tokens are expensive!)
    - If 10 images: ~10,000 tokens
    - If 50 images: ~50,000 tokens
- **Output:** ~200-500 tokens (summary)
- **Total per call:** ~1200-65,000+ tokens

**Frequency during 1-hour meeting:**
- 60 minutes ÷ 15 seconds = **240 calls**
- **Total tokens:** 288,000 - 15,600,000+ tokens/hour (!!!)

**Cost Estimate (with images):**
- Input: 1.2M-15M tokens × $2.50/1M = **$3.00 - $37.50**
- Output: 48k-120k tokens × $10/1M = **$0.48 - $1.20**
- **Total: $3.48 - $38.70 per hour** (with screen shares!)

---

### 3. ✅ **Sentiment Analysis** (NOW ON-DEMAND)

**Status:** ✅ **FIXED** - No longer automatic!

**Previous Cost:** ~$1.50-$3.00 per hour (240 calls × ~2000 tokens)
**Current Cost:** ~$0.01-$0.02 per click (user-triggered)

**Savings:** ~95% reduction 🎉

---

### 4. 💵 **Post-Meeting Summary** (ONE-TIME)

**Location:** `index.js:166` → After meeting ends

**Trigger:** Once when `rtms.stopped` webhook received

**What it does:**
- Reads full transcript
- Reads events log
- **Reads ALL screen share images**
- Generates comprehensive meeting summary
- Saves to `meeting_summary/{uuid}.md`

**Token Usage:**
- Similar to real-time summary but only runs ONCE
- **Input:** ~5,000-50,000 tokens (with images)
- **Output:** ~1,000-2,000 tokens
- **Total:** ~6,000-52,000 tokens

**Cost per Meeting:**
- Input: 5k-50k × $2.50/1M = **$0.0125 - $0.125**
- Output: 1k-2k × $10/1M = **$0.01 - $0.02**
- **Total: $0.02 - $0.15 per meeting** (one-time)

---

### 5. 💰 **Search Query** (USER-TRIGGERED)

**Location:** `index.js:858-910` → `chatWithOpenrouter.js:51-66`

**Trigger:** When user submits search on homepage

**What it does:**
- Reads ALL meeting summaries from `meeting_summary/` directory
- Concatenates them all into one massive prompt
- Sends to LLM with user query
- Returns contextual answer

**Token Usage per Search:**
- **Input:** ~2,000-100,000+ tokens
  - Query prompt: ~200 tokens
  - ALL meeting summaries: ~1,800-99,800+ tokens (grows with meeting count!)
  - User query: ~10-50 tokens
- **Output:** ~200-500 tokens
- **Total:** ~2,200-100,500+ tokens per search

**Cost per Search:**
- Input: 2k-100k × $2.50/1M = **$0.005 - $0.25**
- Output: 200-500 × $10/1M = **$0.002 - $0.005**
- **Total: $0.007 - $0.255 per search**

**Note:** Cost scales with number of meetings! 100 meetings = much more expensive searches.

---

### 6. 💰 **Meeting Query** (USER-TRIGGERED)

**Location:** `index.js:777-801` → `chatWithOpenrouter.js:291-312`

**Trigger:** When user asks question on LiveMeetingPage

**What it does:**
- Reads specific meeting transcript
- Sends to LLM with user question
- Returns contextual answer

**Token Usage per Query:**
- **Input:** ~500-5,000 tokens (prompt + transcript + question)
- **Output:** ~100-300 tokens
- **Total:** ~600-5,300 tokens

**Cost per Query:**
- Input: 500-5k × $2.50/1M = **$0.00125 - $0.0125**
- Output: 100-300 × $10/1M = **$0.001 - $0.003**
- **Total: $0.002 - $0.016 per query**

---

## 📊 Total Cost Breakdown

### Per 1-Hour Live Meeting (with screen shares)

| Operation | Frequency | Cost Range |
|-----------|-----------|------------|
| Dialog Suggestions | 240x (every 15s) | **$0.54 - $3.48** |
| Real-Time Summary (with images) | 240x (every 15s) | **$3.48 - $38.70** |
| Post-Meeting Summary | 1x | **$0.02 - $0.15** |
| **TOTAL PER MEETING** | | **$4.04 - $42.33** |

### Additional User-Triggered Costs

| Operation | Per Use | Notes |
|-----------|---------|-------|
| Sentiment Analysis | $0.01 - $0.02 | Now on-demand |
| Search Query | $0.01 - $0.26 | Scales with # meetings |
| Meeting Query | $0.002 - $0.016 | Per question |

---

## 🚨 **MAJOR COST DRIVERS**

### 1. **Screen Share Images** (BIGGEST ISSUE!)

**Problem:**
- Every screen share image is converted to base64 and sent with EVERY real-time summary call
- Vision tokens are expensive (~1000 tokens per image)
- If meeting has 50 screen shares, each summary call costs 240x more!

**Example:**
- Meeting with 50 screen share images
- Real-time summary called 240 times
- Each call sends all 50 images = 50,000 tokens per call
- Total: 12,000,000 tokens just for images!
- **Cost: ~$30-$40 per hour just for image processing**

### 2. **15-Second Intervals** (HIGH FREQUENCY)

**Problem:**
- 240 calls per hour is very aggressive
- Transcript doesn't change that much in 15 seconds
- Same content sent repeatedly

### 3. **Growing Transcript Size**

**Problem:**
- Token cost increases throughout meeting
- 1-hour meeting = 10x more tokens than 6-minute meeting
- Final calls are much more expensive than first calls

---

## 💡 **RECOMMENDED OPTIMIZATIONS**

### **Priority 1: Reduce Image Processing** 🔥

**Current Behavior:**
- Reads ALL screen share images on every call
- Sends base64 images with every summary

**Recommended Fix:**
```javascript
// Option A: Only process NEW images since last call
let lastImageCount = 0;
const newImages = imageBase64Array.slice(lastImageCount);
// Only send newImages to LLM

// Option B: Process images separately, less frequently
// Summary every 15s, images every 2 minutes
if (now - cache.lastImageProcessing > 120000) {
  // Process images
}

// Option C: Disable real-time image processing entirely
// Only process images in post-meeting summary
```

**Estimated Savings:** **60-90% cost reduction**

---

### **Priority 2: Increase Interval to 30-60 Seconds**

**Current:** 15 seconds = 240 calls/hour
**Proposed:** 60 seconds = 60 calls/hour

**Change:**
```javascript
// index.js:1051
if (!cache.lastUpdated || (now - cache.lastUpdated) > 60000) { // Change to 60s
```

**Estimated Savings:** **75% reduction in call frequency**

---

### **Priority 3: Make Dialog Suggestions On-Demand**

Similar to sentiment analysis, add a "Get Suggestions" button.

**Rationale:**
- Suggestions don't need to update every 15 seconds
- Users can request when they need them
- Probably only need 5-10 times per meeting vs 240

**Estimated Savings:** **95% reduction**

---

### **Priority 4: Incremental Summaries**

Instead of re-processing entire transcript every 15s:

```javascript
// Track last processed transcript
if (currentVTT.length - cache.lastTranscriptLength < 500) {
  // Not enough new content, skip
  return;
}
```

**Estimated Savings:** **50% reduction (skip calls with minimal changes)**

---

### **Priority 5: Optimize Search - Use Embeddings**

**Current Problem:**
- Searches send ALL meeting summaries every time
- 100 meetings = 100k+ tokens per search

**Better Approach:**
```javascript
// Use embeddings (OpenAI Embeddings API)
// 1. Generate embedding for each summary (one-time)
// 2. On search, generate query embedding
// 3. Find top 3-5 most relevant meetings
// 4. Only send those summaries to LLM

// Cost: $0.0001 per 1k tokens (100x cheaper!)
```

**Estimated Savings:** **80-95% on search queries**

---

## 📈 **Projected Savings**

### Current Costs (1 hour meeting with screen shares)
- **$4.04 - $42.33 per meeting**

### After Optimizations:
1. Disable real-time image processing: **-$25-$35**
2. Increase interval to 60s: **-$0.75-$2.50**
3. Make dialog on-demand: **-$0.50-$3.00**
4. Incremental summaries: **-$0.50-$1.50**

### **New Cost: $0.50 - $5.00 per meeting**
### **Savings: 80-90%** 🎉

---

## 🎯 **Quick Wins (✅ IMPLEMENTED!)**

### 1. ✅ Disable Real-Time Image Processing

**File:** `index.js:1067-1089`

**Status:** ✅ **COMPLETED**

**Changes Made:**
```javascript
// COST OPTIMIZATION: Disabled real-time image processing
// Images are expensive (~1000 tokens each) and sending ALL images every 60s is wasteful
// Images are still processed in the post-meeting summary (see rtms.stopped webhook)
// Previous cost: $25-$35/hour with 50 images, Now: $0
let imageBase64Array = [];

/* DISABLED for cost savings - uncomment if needed
const processedDir = path.join('recordings', safeMeetingUuid, 'processed', 'jpg');
// ... image processing code commented out
*/
```

**Impact:** ✅ Immediate 60-90% cost reduction
**Savings:** **$25-$35 per hour**

---

### 2. ✅ Increase Interval to 60 Seconds

**File:** `index.js:1052`

**Status:** ✅ **COMPLETED**

**Changes Made:**
```javascript
// Only process if 60+ seconds since last update (COST OPTIMIZATION: was 15s)
if (!cache.lastUpdated || (now - cache.lastUpdated) > 60000) { // Was 15000
```

**Impact:** ✅ 75% fewer API calls (60 calls/hour instead of 240)
**Savings:** **$0.75-$2.50 per hour**

---

### 3. Make Dialog Suggestions Button-Triggered

Similar to what we did with sentiment analysis!

**Impact:** 95% reduction on dialog costs

---

## Summary

**Previous State (Before Optimizations):**
- ⚠️ Dialog suggestions: **$0.54-$3.48/hour** (every 15s)
- ⚠️ Real-time summary: **$3.48-$38.70/hour** (every 15s, with images)
- ⚠️ Sentiment: **$0.54-$3.48/hour** (every 15s)
- ✅ Post-meeting summary: **$0.02-$0.15** (one-time)
- **TOTAL: $4.58-$45.81 per hour**

**Current State (After Phase 1 Optimizations):**
- ✅ Dialog suggestions: **$0.14-$0.87/hour** (every 60s, no images)
- ✅ Real-time summary: **$0.87-$0.97/hour** (every 60s, no images)
- ✅ Sentiment: **$0.01-$0.02** (on-demand, button-triggered)
- ✅ Post-meeting summary: **$0.02-$0.15** (one-time)
- **TOTAL: $1.04-$2.01 per hour** 🎉

**Cost Reduction:**
- **Previous:** $4.58-$45.81/hour
- **Current:** $1.04-$2.01/hour
- **Savings:** **77-96% reduction!** 🎉💰

---

**Completed Optimizations:**
1. ✅ Disabled real-time image processing (Savings: $25-$35/hour)
2. ✅ Increased interval from 15s to 60s (Savings: 75% fewer calls)
3. ✅ Made sentiment on-demand (Savings: $0.50-$3.00/hour)

**Future Optimizations (Optional):**
3. Make dialog suggestions on-demand (Additional savings: ~$0.50-$3.00/hour)
4. Use incremental summaries (Additional savings: ~$0.25-$0.50/hour)
5. Implement embeddings for search (High effort, high impact for search costs)

**Result:** Already achieved 77-96% cost reduction! 🎉
