# Web Scraping with Playwright

## Overview
This skill enables AI Agent to scrape web pages using Playwright, a browser automation framework that can bypass anti-bot protections and handle JavaScript-rendered content. The scraped content is converted to clean Markdown format for easy reading and processing.

## Setup

**First-time setup (required):**
```bash
./scripts/ensure-setup.sh
```

This will install:
- Playwright (browser automation)
- Turndown (HTML to Markdown converter)
- Turndown-plugin-gfm (GitHub Flavored Markdown support)
- Chromium browser binaries

Alternatively, you can perform a **manual setup:**
```bash
npm install
npx playwright install chromium
npm test  # Verify installation
```

## When to Use This Skill
- When websites block simple HTTP requests (e.g. 403/404 due to anti-bot or anti-scraping protections)
- When web pages require JavaScript rendering to display content
- When you need to preserve formatting of tables, code blocks, and lists
- When scraping documentation sites, blogs, or technical articles