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

## When to Use This Skill
- When encountering 404 or 403 errors with simple HTTP requests
- When web pages require JavaScript rendering to display content
- When websites have anti-bot/anti-scraping protections
- When you need to preserve formatting of tables, code blocks, and lists
- When scraping documentation sites, blogs, or technical articles
- When the user explicitly asks to "scrape", "extract from webpage", or "get content from URL"