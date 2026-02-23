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

async function scrapeDocumentation(urls, outputDir = './scraped-docs', waitUntil = 'load') {
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
          waitUntil,
          timeout: 30000
        });
      } catch (error) {
        if (error.message.includes('Timeout')) {
          console.log(`  ⚠ ${waitUntil} timeout, retrying with load...`);
          await page.goto(url, {
            waitUntil: 'load',
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

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);

  // Parse flags
  let outputDir = './scraped-docs';
  let waitUntil = 'load';
  const validWaitUntil = ['load', 'domcontentloaded', 'networkidle'];
  const urls = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output-dir' || args[i] === '-o') {
      i++;
      if (i < args.length) {
        outputDir = args[i];
      } else {
        console.error('Error: --output-dir requires a path argument');
        process.exit(1);
      }
    } else if (args[i] === '--wait-until' || args[i] === '-w') {
      i++;
      if (i < args.length) {
        waitUntil = args[i];
        if (!validWaitUntil.includes(waitUntil)) {
          console.error(`Error: --wait-until must be one of: ${validWaitUntil.join(', ')}`);
          process.exit(1);
        }
      } else {
        console.error('Error: --wait-until requires a value argument');
        process.exit(1);
      }
    } else if (args[i].startsWith('-')) {
      console.error(`Unknown flag: ${args[i]}`);
      process.exit(1);
    } else {
      urls.push(args[i]);
    }
  }

  if (urls.length === 0) {
    console.log('Usage: node scripts/scrape.js [options] <url1> <url2> ...');
    console.log('');
    console.log('Options:');
    console.log('  -o, --output-dir <path>    Output directory (default: ./scraped-docs)');
    console.log('  -w, --wait-until <event>   Navigation wait strategy (default: load)');
    console.log('                             Values: load, domcontentloaded, networkidle');
    console.log('');
    console.log('Example:');
    console.log('  node scripts/scrape.js https://docs.example.com/api');
    console.log('  node scripts/scrape.js -o ./my-docs https://example.com/page1 https://example.com/page2');
    console.log('  node scripts/scrape.js -w networkidle https://example.com/spa-page');
    process.exit(1);
  }

  scrapeDocumentation(urls, outputDir, waitUntil)
    .then(() => console.log('\n✓ All done!'))
    .catch(error => {
      console.error('\n✗ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { scrapeDocumentation };
