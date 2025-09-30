# Bright Data Integration Guide

## Why Use Bright Data?

Crexi.com and other real estate sites use **Cloudflare** to block automated browsers and datacenter IPs. Bright Data provides:

- ✅ **Residential IPs** - Real user IP addresses
- ✅ **Cloudflare Bypass** - Automatic CAPTCHA solving
- ✅ **Geographic Targeting** - US-based IPs for domestic sites
- ✅ **High Success Rate** - Works where regular proxies fail

---

## Step 1: Sign Up for Bright Data

1. Go to https://brightdata.com
2. Create an account (they offer a **free trial**)
3. Choose **Residential Proxies** or **Web Scraper** zone

---

## Step 2: Get Your Credentials

1. Navigate to **Proxies & Scraping Infrastructure** → **Residential Proxies**
2. Create a new zone or use existing one
3. Copy your credentials:
   ```
   Username: brd-customer-{customer_id}-zone-{zone_name}
   Password: {your_password}
   Host: brd.superproxy.io:22225
   ```

**Example:**
```
Username: brd-customer-hl_abc123-zone-residential
Password: my_secure_password
Host: brd.superproxy.io:22225
```

---

## Step 3: Configure Environment Variables

Add to your **orchestrator/.env** file:

```bash
# Bright Data Proxy Configuration
BRIGHTDATA_USERNAME=brd-customer-hl_abc123-zone-residential
BRIGHTDATA_PASSWORD=your_password_here
BRIGHTDATA_HOST=brd.superproxy.io:22225
```

**Note:** Keep your credentials secure! Never commit `.env` to git.

---

## Step 4: Test the Integration

### Local Testing

```bash
cd orchestrator
npm start
```

Try a search query - you should see:
```
[browser] Using Bright Data residential proxy
[browse] opening https://www.crexi.com/...
[browse] page loaded in 5234ms
```

### Cloud Deployment (Render)

1. Go to Render Dashboard → Your service
2. Navigate to **Environment** tab
3. Add the three Bright Data variables:
   - `BRIGHTDATA_USERNAME`
   - `BRIGHTDATA_PASSWORD`
   - `BRIGHTDATA_HOST`
4. Click **Save Changes** → Service auto-redeploys

---

## How It Works

The integration automatically uses Bright Data proxy when credentials are configured:

```typescript
// In browser.ts
const useBrightData = !!(process.env.BRIGHTDATA_USERNAME && process.env.BRIGHTDATA_PASSWORD);

if (useBrightData) {
  contextOptions.proxy = {
    server: `http://${brightDataHost}`,
    username: brightDataUser,
    password: brightDataPass,
  };
}
```

**Without Bright Data:**
- Uses direct connection
- Cloudflare blocks you ❌

**With Bright Data:**
- Routes through residential IPs
- Bypasses Cloudflare ✅

---

## Pricing

| Plan | Price | Requests/Month | Notes |
|------|-------|----------------|-------|
| **Free Trial** | $0 | Limited | Test integration |
| **Pay-As-You-Go** | ~$0.003/req | Unlimited | $3 per 1,000 requests |
| **Subscription** | $500+/mo | High volume | Better rates |

**Estimate:** ~1,000 property searches/month = $3

---

## Advanced Configuration

### Session Persistence

To reuse the same IP for multiple requests (faster):

```bash
BRIGHTDATA_USERNAME=brd-customer-hl_abc123-zone-residential-session-{random_id}
```

The `{random_id}` can be any string - requests with same session ID use same IP.

### Country Targeting

Force US residential IPs only:

```bash
BRIGHTDATA_USERNAME=brd-customer-hl_abc123-zone-residential-country-us
```

### City Targeting

Target specific cities (e.g., Dallas for Texas properties):

```bash
BRIGHTDATA_USERNAME=brd-customer-hl_abc123-zone-residential-country-us-city-dallas
```

---

## Troubleshooting

### "Authentication failed"
- Double-check username/password
- Ensure no extra spaces in `.env`
- Verify zone is active in Bright Data dashboard

### Still getting blocked
- Try adding session parameter: `-session-my_session_123`
- Enable "Waterfall" in Bright Data dashboard (auto-retries)
- Contact Bright Data support for IP whitelisting

### High costs
- Cache property data to reduce requests
- Use session persistence to reuse IPs
- Consider alternative sources (LoopNet, CoStar API)

---

## Alternatives to Bright Data

If Bright Data is too expensive:

1. **ScrapingBee** - https://www.scrapingbee.com (~$49/mo)
2. **ScraperAPI** - https://www.scraperapi.com (~$49/mo)
3. **Oxylabs** - https://oxylabs.io (Enterprise)
4. **Apify** - https://apify.com (Serverless scraping)

All work similarly - just change the proxy configuration in `browser.ts`.

---

## Support

- **Bright Data Docs:** https://docs.brightdata.com
- **GitHub Issues:** Create an issue in this repo
- **Discord:** Join our community for help

---

**Happy scraping! 🚀**
