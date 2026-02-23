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

## Scraping Web Pages to Markdown

Run the scraping script from this skill's directory:

```bash
# Scrape one or more URLs (output defaults to ./scraped-docs/)
node scripts/scrape.js <url1> <url2> ...

# Specify a custom output directory
node scripts/scrape.js --output-dir ./my-output <url1> <url2> ...
# or
node scripts/scrape.js -o ./my-output <url1> <url2> ...

# Use a different navigation wait strategy (default: load)
node scripts/scrape.js --wait-until load <url1> <url2> ...
```

The script will:
- Launch a headless Chromium browser with anti-bot detection bypasses
- Warm up the browser to avoid cold-start timeouts
- Navigate to each URL using the specified `--wait-until` strategy (default: `load`), with automatic fallback to `load` on timeout
- Extract the main content area (using selectors: `article`, `main`, `.documentation`, `.content`, `#content`)
- Remove navigation/sidebar/footer elements
- Convert HTML to GitHub-flavored Markdown
- Save each page as a `.md` file in the output directory
- Write a `_scrape-summary.json` with per-URL results

**IMPORTANT:** Always run from this skill's directory (where `package.json` is located) so Node.js can resolve the installed packages.

### `--wait-until` Options

| Option | Description | Use when |
|--------|-------------|----------|
| `load` (default) | Waits for the `load` event. Fast and reliable, works with most sites. | **Default choice** — use this for most scraping tasks. |
| `domcontentloaded` | Waits for the DOM to be parsed. Fastest option but JavaScript may not have executed. | Static content or when speed is critical. |
| `networkidle` | Waits until no network connections for 500ms. | Only when `load` misses dynamically loaded content. |
