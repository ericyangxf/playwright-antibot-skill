---
name: playwright-antibot
description: Scrape web pages using Playwright, a browser automation framework that can bypass anti-bot protections and handle JavaScript-rendered content. The scraped content is converted to clean Markdown format for easy reading and processing. Use when encountering 404 or 403 errors with simple HTTP requests. Use when web pages require JavaScript rendering to display content. Use when websites have anti-bot/anti-scraping protections. Use when you need to preserve formatting of tables, code blocks, and lists. Use when scraping documentation sites, blogs, or technical articles. Use when the user explicitly asks to "scrape", "extract from webpage", or "get content from URL".
allowed-tools: playwright, turndown, turndown-plugin-gfm, fs
---

# Web Scraping with Playwright

🚨 **FIRST-TIME SETUP REQUIRED** 🚨
Before using this skill, run: `./scripts/ensure-setup.sh` (from the skill directory)

## Prerequisites

### Setup Instructions
**IMPORTANT:** Before using this skill for the FIRST time, run the setup script:

```bash
./scripts/ensure-setup.sh
```

This will automatically:
- Install required npm packages (playwright, turndown, turndown-plugin-gfm)
- Download Chromium browser binaries
- Verify the installation

**Manual Setup (if needed):**
```bash
npm install
npx playwright install chromium
npm test  # Verify installation
```

**EXECUTION NOTE:** All JavaScript code examples must be executed from this skill's directory (where package.json is located) to ensure Node.js can find the installed packages.

## Web Pages Scraping and save as Markdown

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

  // IMPORTANT: Warm up the browser with a simple navigation first
  // This prevents the first real URL from timing out due to cold-start delays
  try {
    await page.goto('about:blank', { timeout: 5000 });
    // Optional: navigate to the domain to establish connection
    if (urls.length > 0) {
      const firstDomain = new URL(urls[0]).origin;
      await page.goto(firstDomain, {
        waitUntil: 'domcontentloaded',
        timeout: 10000
      }).catch(() => {}); // Ignore errors, this is just a warm-up
    }
  } catch (e) {
    // Warm-up failed, but continue anyway
  }

  const results = [];
  
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`\n[${i + 1}/${urls.length}] Scraping: ${url}`);
    
    try {
      // Navigate with fallback strategy
      try {
        await page.goto(url, {
          waitUntil: 'load',  // Use 'load' for reliability
          timeout: 30000
        });
      } catch (error) {
        if (error.message.includes('Timeout')) {
          console.log('  ⚠ Load timeout, retrying with domcontentloaded...');
          await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });
        } else {
          throw error;
        }
      }

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

## Advanced Techniques

### Understanding `waitUntil` Options

The `waitUntil` parameter in `page.goto()` controls when the navigation is considered complete:

| Option | When it completes | Pros | Cons | Use when |
|--------|------------------|------|------|----------|
| **`'load'`** | When the `load` event fires | ✅ Fast and reliable<br>✅ Works with most sites<br>✅ Rarely times out | ⚠️ May not wait for all dynamic content | **Default choice** - Use for most scraping tasks |
| **`'domcontentloaded'`** | When the DOM is loaded | ✅ Fastest option<br>✅ Good for static content | ⚠️ JavaScript may not have executed<br>⚠️ Images/stylesheets may not load | Early scraping, extracting structure |
| **`'networkidle'`** | When no network connections for 500ms | ✅ Ensures all content loaded<br>✅ Good for complex SPAs | ❌ **Often times out**<br>❌ Fails with persistent connections<br>❌ Slow | Only when 'load' misses content |

**⚠️ Common Pitfall:** `'networkidle'` frequently times out on the first URL due to:
- Cold-start connection delays
- Analytics/tracking scripts keeping connections open
- WebSocket connections
- Polling/long-running requests

**Best Practice:**
1. Use `'load'` as your default - it works 95% of the time
2. Only use `'networkidle'` if you observe missing content with `'load'`
3. If using `'networkidle'`, always implement the fallback pattern shown in "Multiple Pages Scraping"

### Anti-Bot Detection Bypassing (Already Enabled by Default)

**Note:** The basic scraping examples above already include anti-bot detection bypassing. These techniques are built into the default configuration and include:

- **Browser launch args**: Disables automation flags that bots typically have
- **Realistic user agent**: Uses a current Chrome user agent string
- **Browser fingerprint**: Sets realistic viewport, locale, timezone, and HTTP headers
- **Navigator properties**: Hides webdriver flag and sets realistic plugin/language values

If you encounter sites with more sophisticated bot detection, you may need additional techniques such as:
- Using residential proxies
- Adding random mouse movements: `await page.mouse.move(100, 200)`
- Adding random delays between actions
- Rotating user agents for each request

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
7. **Cache results** - Save scraped content to avoid re-scraping
8. **Test selectors first** - Verify content extraction on a single page before batch processing

## Troubleshooting

| Problem | Solution |
|---------|----------|
| **First URL timeouts but retries succeed** | Cold-start issue: add a warm-up navigation to `about:blank` or the target domain before scraping. Use `waitUntil: 'load'` instead of `'networkidle'` as fallback. |
| **TimeoutError** | Increase timeout, check network, or use `waitUntil: 'domcontentloaded'` |
| **404/403 errors** | Use additional techniques for Anti-Bot Detection Bypassing |
| **Empty content** | Adjust selectors, wait for JavaScript rendering |
| **Slow performance** | Reuse browser context, enable request interception to block images/css |
| **Memory issues** | Close pages after use, limit concurrent operations |
| **Tables not formatted** | Ensure `turndown-plugin-gfm` is installed and used |
| **Missing code blocks** | Check `codeBlockStyle: 'fenced'` in Turndown config |

## Resources

- **Playwright Docs:** https://playwright.dev/docs/intro
- **Turndown Docs:** https://github.com/mixmark-io/turndown
- **Anti-Detection Guide:** https://playwright.dev/docs/emulation
