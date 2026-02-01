---
name: playwright
description: Scrape web pages using Playwright, a browser automation framework that can bypass anti-bot protections and handle JavaScript-rendered content. The scraped content is converted to clean Markdown format for easy reading and processing. Use when encountering 404 or 403 errors with simple HTTP requests. Use when web pages require JavaScript rendering to display content. Use when websites have anti-bot/anti-scraping protections. Use when you need to preserve formatting of tables, code blocks, and lists. Use when scraping documentation sites, blogs, or technical articles. Use when the user explicitly asks to "scrape", "extract from webpage", or "get content from URL".
allowed-tools: playwright, turndown, turndown-plugin-gfm, fs
---

# Web Scraping with Playwright

## Prerequisites

### Required Packages
```bash
# Install Playwright
npm install playwright

# Install browser binaries (only needed once)
npx playwright install chromium

# Install HTML to Markdown converter
npm install turndown turndown-plugin-gfm
```

## Basic Usage Pattern

### Single Page Scraping

Replace `https://example.com` to destination url

```javascript
const { chromium } = require('playwright');
const TurndownService = require('turndown');
const { gfm } = require('turndown-plugin-gfm');
const fs = require('fs');

// Configure Markdown converter
const turndownService = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '_'
});
turndownService.use(gfm);  // GitHub Flavored Markdown (tables support)

(async () => {
  // Launch browser
  const browser = await chromium.launch({
    headless: true  // Set to false for debugging
  });
  
  const page = await browser.newPage();
  
  // Navigate to URL
  await page.goto('https://example.com', {
    waitUntil: 'networkidle',  // Wait until network is idle
    timeout: 30000
  });
  
  // Extract main content HTML
  const html = await page.evaluate(() => {
    // Try common content selectors
    const selectors = ['article', 'main', '.content', '.documentation', '#content'];
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element.innerHTML;
    }
    // Fallback to body
    return document.body.innerHTML;
  });
  
  // Get page metadata
  const metadata = await page.evaluate(() => ({
    title: document.title,
    url: window.location.href
  }));
  
  // Convert to Markdown
  const markdown = turndownService.turndown(html);
  
  // Format output with metadata
  const output = `# ${metadata.title}

> Source: ${metadata.url}
> Scraped: ${new Date().toISOString()}

${markdown}`;
  
  // Save to file
  const filename = 'scraped-content.md';
  fs.writeFileSync(filename, output);
  console.log(`✓ Saved to ${filename}`);
  
  await browser.close();
})();
```

### Multiple Pages Scraping

Replace `https://example.com/*` to destination url

```javascript
const { chromium } = require('playwright');
const TurndownService = require('turndown');
const { gfm } = require('turndown-plugin-gfm');
const fs = require('fs');

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
});
turndownService.use(gfm);

(async () => {
  const urls = [
    'https://example.com/page1',
    'https://example.com/page2',
    'https://example.com/page3'
  ];
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  for (const url of urls) {
    console.log(`Scraping: ${url}`);
    
    try {
      await page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });
      
      // Extract content
      const html = await page.evaluate(() => {
        const main = document.querySelector('article, main, .content');
        return main ? main.innerHTML : document.body.innerHTML;
      });
      
      const title = await page.title();
      const markdown = turndownService.turndown(html);
      
      // Generate filename from URL
      const filename = url.split('/').filter(Boolean).slice(-2).join('-') + '.md';
      
      const output = `# ${title}\n\n> Source: ${url}\n\n${markdown}`;
      fs.writeFileSync(filename, output);
      
      console.log(`✓ Saved: ${filename}`);
      
      // Polite delay between requests
      await page.waitForTimeout(1000 + Math.random() * 2000);
      
    } catch (error) {
      console.error(`✗ Failed to scrape ${url}:`, error.message);
    }
  }
  
  await browser.close();
  console.log('All done!');
})();
```

## Advanced Techniques

### Bypassing Anti-Bot Detection

```javascript
const browser = await chromium.launch({
  headless: true,
  args: [
    '--disable-blink-features=AutomationControlled',
    '--disable-dev-shm-usage',
    '--no-sandbox'
  ]
});

const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  viewport: { width: 1920, height: 1080 },
  locale: 'en-US',
  timezoneId: 'America/New_York',
  extraHTTPHeaders: {
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
  }
});

const page = await context.newPage();

// Hide automation indicators
await page.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => false });
  Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
});
```

### Handling Dynamic Content

```javascript
// Wait for specific selectors
await page.waitForSelector('.article-content', { timeout: 10000 });

// Wait for network to be idle
await page.waitForLoadState('networkidle');

// Wait for custom condition
await page.waitForFunction(() => {
  return document.querySelectorAll('.loaded-item').length > 5;
}, { timeout: 10000 });

// Scroll to load lazy content
await page.evaluate(() => {
  window.scrollTo(0, document.body.scrollHeight);
});
await page.waitForTimeout(2000);
```

### Handling Authentication

```javascript
// For basic auth
const page = await context.newPage();
await page.goto('https://username:password@example.com');

// For form-based login
await page.goto('https://example.com/login');
await page.fill('#username', 'your-username');
await page.fill('#password', 'your-password');
await page.click('button[type="submit"]');
await page.waitForNavigation();

// For cookie-based auth
await context.addCookies([
  {
    name: 'session',
    value: 'your-session-token',
    domain: 'example.com',
    path: '/'
  }
]);
```

### Custom Content Selectors

```javascript
// Define custom selectors for specific sites
const siteConfigs = {
  'docs.coveo.com': {
    contentSelector: '.documentation-content',
    excludeSelectors: ['.sidebar', '.navigation', '.footer']
  },
  'developer.mozilla.org': {
    contentSelector: 'article',
    excludeSelectors: ['.document-toc', '.language-menu']
  }
};

const domain = new URL(url).hostname;
const config = siteConfigs[domain] || { contentSelector: 'article, main' };

// Remove unwanted elements
if (config.excludeSelectors) {
  await page.evaluate((selectors) => {
    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => el.remove());
    });
  }, config.excludeSelectors);
}

// Extract content
const html = await page.evaluate((selector) => {
  const element = document.querySelector(selector);
  return element ? element.innerHTML : document.body.innerHTML;
}, config.contentSelector);
```

### Extracting Structured Data

```javascript
// Extract tables separately
const tables = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('table')).map((table, index) => {
    const headers = Array.from(table.querySelectorAll('th')).map(th => th.innerText.trim());
    const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr => {
      return Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
    });
    return { index, headers, rows };
  });
});

// Save tables as JSON
fs.writeFileSync('tables.json', JSON.stringify(tables, null, 2));

// Extract code blocks
const codeBlocks = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('pre code, .code-block')).map(block => ({
    language: block.className.match(/language-(\w+)/)?.[1] || 'text',
    code: block.innerText
  }));
});
```

## Error Handling

### Robust Scraping with Retries

```javascript
async function scrapeWithRetry(url, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries}: ${url}`);
      
      await page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });
      
      const html = await page.evaluate(() => {
        const main = document.querySelector('article, main');
        return main ? main.innerHTML : document.body.innerHTML;
      });
      
      return html;
      
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`);
      }
      
      // Exponential backoff
      await page.waitForTimeout(1000 * Math.pow(2, attempt));
    }
  }
}
```

### Comprehensive Error Handling

```javascript
(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    // Set timeout handler
    page.setDefaultTimeout(30000);
    
    // Handle navigation errors
    page.on('response', response => {
      if (response.status() >= 400) {
        console.warn(`HTTP ${response.status()}: ${response.url()}`);
      }
    });
    
    await page.goto(url);
    
    // Check if content exists
    const hasContent = await page.evaluate(() => {
      return document.body.innerText.trim().length > 100;
    });
    
    if (!hasContent) {
      throw new Error('Page appears to be empty or blocked');
    }
    
    // Continue with scraping...
    
  } catch (error) {
    console.error('Scraping failed:', error.message);
    
    if (error.message.includes('timeout')) {
      console.log('Suggestion: Try increasing timeout or check network');
    } else if (error.message.includes('404')) {
      console.log('Suggestion: Verify URL is correct');
    } else if (error.message.includes('blocked')) {
      console.log('Suggestion: Try with headless: false or adjust anti-bot settings');
    }
    
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
```

## Performance Optimization

### Batch Processing with Concurrency

```javascript
const pLimit = require('p-limit');  // npm install p-limit
const limit = pLimit(3);  // Max 3 concurrent requests

const urls = [...];  // Your URL list

const promises = urls.map(url => {
  return limit(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      // Scraping logic...
      return result;
    } finally {
      await browser.close();
    }
  });
});

const results = await Promise.all(promises);
```

### Reusing Browser Context

```javascript
// More efficient for multiple pages
const browser = await chromium.launch({ headless: true });

try {
  const scrapeUrl = async (url) => {
    const page = await browser.newPage();
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      // Extract content...
      return content;
    } finally {
      await page.close();  // Close page, not browser
    }
  };
  
  for (const url of urls) {
    await scrapeUrl(url);
  }
  
} finally {
  await browser.close();  // Close browser once at the end
}
```

## Debugging

### Visual Debugging

```javascript
const browser = await chromium.launch({
  headless: false,  // See the browser
  slowMo: 500       // Slow down actions by 500ms
});

// Take screenshots at key points
await page.screenshot({ path: 'before-scrape.png' });

// After extraction
await page.screenshot({ path: 'after-scrape.png', fullPage: true });
```

### Logging

```javascript
// Enable verbose logging
page.on('console', msg => console.log('PAGE LOG:', msg.text()));
page.on('pageerror', error => console.error('PAGE ERROR:', error));
page.on('requestfailed', request => {
  console.error('REQUEST FAILED:', request.url(), request.failure().errorText);
});

// Log network activity
page.on('request', request => {
  console.log('→', request.method(), request.url());
});
page.on('response', response => {
  console.log('←', response.status(), response.url());
});
```

## Complete Example: Documentation Scraper

```javascript
#!/usr/bin/env node
const { chromium } = require('playwright');
const TurndownService = require('turndown');
const { gfm } = require('turndown-plugin-gfm');
const fs = require('fs');
const path = require('path');

// Configuration
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-'
});
turndownService.use(gfm);

async function scrapeDocumentation(urls, outputDir = './scraped-docs') {
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  // Anti-detection
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
  
  const results = [];
  
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`\n[${i + 1}/${urls.length}] Scraping: ${url}`);
    
    try {
      // Navigate
      await page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });
      
      // Wait for content
      await page.waitForSelector('article, main, .content', { timeout: 10000 });
      
      // Extract metadata and content
      const data = await page.evaluate(() => {
        // Find main content
        const contentSelectors = ['article', 'main', '.documentation', '.content', '#content'];
        let contentElement = null;
        
        for (const selector of contentSelectors) {
          contentElement = document.querySelector(selector);
          if (contentElement) break;
        }
        
        // Remove unwanted elements
        const unwantedSelectors = ['.sidebar', '.navigation', '.breadcrumb', '.footer', 'nav', '.toc'];
        unwantedSelectors.forEach(selector => {
          document.querySelectorAll(selector).forEach(el => el.remove());
        });
        
        return {
          title: document.title,
          url: window.location.href,
          html: contentElement ? contentElement.innerHTML : document.body.innerHTML
        };
      });
      
      // Convert to Markdown
      const markdown = turndownService.turndown(data.html);
      
      // Format output
      const output = `# ${data.title}

> **Source:** ${data.url}  
> **Scraped:** ${new Date().toISOString()}

---

${markdown}`;
      
      // Generate filename
      const urlParts = new URL(url).pathname.split('/').filter(Boolean);
      const filename = urlParts.slice(-2).join('-') + '.md';
      const filepath = path.join(outputDir, filename);
      
      // Save file
      fs.writeFileSync(filepath, output);
      
      console.log(`✓ Saved: ${filename} (${output.length} chars)`);
      
      results.push({
        url,
        filename,
        success: true,
        size: output.length
      });
      
      // Polite delay
      await page.waitForTimeout(1000 + Math.random() * 2000);
      
    } catch (error) {
      console.error(`✗ Failed: ${error.message}`);
      results.push({
        url,
        success: false,
        error: error.message
      });
    }
  }
  
  await browser.close();
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SCRAPING SUMMARY');
  console.log('='.repeat(60));
  const successful = results.filter(r => r.success).length;
  console.log(`Total URLs: ${urls.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${urls.length - successful}`);
  console.log(`Output directory: ${path.resolve(outputDir)}`);
  
  // Save summary
  fs.writeFileSync(
    path.join(outputDir, '_scrape-summary.json'),
    JSON.stringify(results, null, 2)
  );
  
  return results;
}

// Usage
if (require.main === module) {
  const urls = process.argv.slice(2);
  
  if (urls.length === 0) {
    console.log('Usage: node scraper.js <url1> <url2> ...');
    console.log('Example: node scraper.js https://example.com/doc1 https://example.com/doc2');
    process.exit(1);
  }
  
  scrapeDocumentation(urls)
    .then(() => console.log('\n✓ All done!'))
    .catch(error => {
      console.error('\n✗ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { scrapeDocumentation };
```

**Usage:**
```bash
# Make executable
chmod +x scraper.js

# Scrape single URL
./scraper.js https://docs.example.com/api

# Scrape multiple URLs
./scraper.js \
  https://docs.coveo.com/en/114/... \
  https://docs.coveo.com/en/1459/... \
  https://docs.coveo.com/en/1502/...
```

## Best Practices

1. **Always use headless mode in production** - Set `headless: true` unless debugging
2. **Implement polite delays** - Use `page.waitForTimeout()` between requests (1-3 seconds)
3. **Handle errors gracefully** - Use try-catch and provide meaningful error messages
4. **Respect robots.txt** - Check site's scraping policy before bulk scraping
5. **Use appropriate selectors** - Target main content areas to avoid navigation/footer noise
6. **Clean up resources** - Always close browsers/pages in finally blocks
7. **Limit concurrency** - Don't overwhelm servers with too many concurrent requests
8. **Cache results** - Save scraped content to avoid re-scraping
9. **Monitor rate limits** - Watch for 429 responses and implement backoff
10. **Test selectors first** - Verify content extraction on a single page before batch processing

## Troubleshooting

| Problem | Solution |
|---------|----------|
| **TimeoutError** | Increase timeout, check network, or use `waitUntil: 'domcontentloaded'` |
| **404/403 errors** | Enable anti-detection features, use realistic user agent |
| **Empty content** | Adjust selectors, wait for JavaScript rendering |
| **Slow performance** | Reuse browser context, enable request interception to block images/css |
| **Memory issues** | Close pages after use, limit concurrent operations |
| **Tables not formatted** | Ensure `turndown-plugin-gfm` is installed and used |
| **Missing code blocks** | Check `codeBlockStyle: 'fenced'` in Turndown config |

## Resources

- **Playwright Docs:** https://playwright.dev/docs/intro
- **Turndown Docs:** https://github.com/mixmark-io/turndown
- **Anti-Detection Guide:** https://playwright.dev/docs/emulation

---

**Remember:** This skill is for legitimate use cases only. Always respect website terms of service, rate limits, and copyright. Use responsibly.