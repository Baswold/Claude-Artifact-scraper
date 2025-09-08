const puppeteer = require('puppeteer');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

class ClaudeArtifactScraper {
  constructor(options = {}) {
    this.baseUrl = 'https://www.google.com/search';
    this.searchQuery = 'site:claude.ai inurl:/public/artifacts/';
    this.scrapedArtifacts = new Set();
    this.dataFile = 'artifacts_database.json';
    this.maxPages = options.maxPages || 3; // Default to 3 pages
    this.headless = options.headless !== undefined ? options.headless : true;
    this.screenshots = options.screenshots !== undefined ? options.screenshots : true;
    this.debug = options.debug !== undefined ? options.debug : false;
  }

  async init() {
    // Load existing artifacts to avoid duplicates
    try {
      const data = await fs.readFile(this.dataFile, 'utf8');
      const existing = JSON.parse(data);
      existing.forEach(artifact => this.scrapedArtifacts.add(artifact.url));
      console.log(`Loaded ${existing.length} existing artifacts`);
      return existing;
    } catch (error) {
      console.log('No existing database found, starting fresh');
      return [];
    }
  }

  async searchGoogleForArtifacts(startIndex = 0) {
    const browser = await puppeteer.launch({
      headless: this.headless ? 'new' : false, // Use 'new' headless mode
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-features=site-per-process',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });

    try {
      const page = await browser.newPage();

      // Set realistic user agent and headers
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36');
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      });

      const searchUrl = `${this.baseUrl}?q=${encodeURIComponent(this.searchQuery)}&start=${startIndex}`;
      console.log(`Searching: ${searchUrl}`);

      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

      // Check for CAPTCHA or Cloudflare challenge
      const pageContent = await page.content();
      if (pageContent.includes('captcha') || pageContent.includes('Cloudflare')) {
        console.warn('⚠️ CAPTCHA or Cloudflare challenge detected, trying alternative approach...');
        // Implement a retry mechanism or alternative search here if needed
        return [];
      }

      // Wait for search results (adjust selector if needed)
      await page.waitForSelector('div[data-sokoban-container], #search', { timeout: 10000 });

      // Extract artifact URLs
      const artifactUrls = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="claude.ai/public/artifacts/"]'));
        return links.map(link => link.href).filter(
          href => href.includes('claude.ai/public/artifacts/') &&
          !href.includes('google.com')
        );
      });

      console.log(`Found ${artifactUrls.length} artifact URLs on this page`);
      return [...new Set(artifactUrls)]; // Remove duplicates

    } catch (error) {
      console.error('Error searching Google:', error);
      return [];
    } finally {
      await browser.close();
    }
  }

  async scrapeArtifactContent(artifactUrl) {
    console.log(`Scraping artifact: ${artifactUrl}`);

    const browser = await puppeteer.launch({ headless: this.headless ? 'new' : false });

    try {
      const page = await browser.newPage();
      await page.goto(artifactUrl, { waitUntil: 'networkidle2', timeout: 60000 });

      // Extract artifact metadata and content
      const artifactData = await page.evaluate((url) => {
        // Try to find artifact title
        const title = document.querySelector('title')?.textContent ||
                     document.querySelector('h1')?.textContent ||
                     'Untitled Artifact';

        // Look for description meta tags
        const description = document.querySelector('meta[name="description"]')?.content ||
                          document.querySelector('meta[property="og:description"]')?.content ||
                          '';

        // Try to extract author info (this might need adjustment based on actual page structure)
        const author = document.querySelector('[data-author]')?.textContent ||
                      document.querySelector('.author')?.textContent ||
                      'Unknown';

        // Get the main content (this will need to be adjusted based on actual page structure)
        const contentElement = document.querySelector('[data-artifact-content]') ||
                              document.querySelector('.artifact-content') ||
                              document.querySelector('main') ||
                              document.body;

        const content = contentElement ? contentElement.innerHTML : '';

        // Try to detect artifact type
        let type = 'html';
        if (content.includes('import React') || content.includes('function ')) {
          type = 'react';
        } else if (content.includes('<script>') || content.includes('javascript')) {
          type = 'html';
        } else if (content.includes('<svg')) {
          type = 'svg';
        }

        return {
          url,
          title: title.replace(' | Claude', '').trim(),
          description,
          author,
          content,
          type,
          scrapedAt: new Date().toISOString()
        };
      }, artifactUrl);

      // Take a screenshot for thumbnail
      if (this.screenshots) {
        const screenshotBuffer = await page.screenshot({
          type: 'png',
          fullPage: false,
          clip: { x: 0, y: 0, width: 1200, height: 800 }
        });

        // Save screenshot
        const artifactId = artifactUrl.split('/').pop();
        const screenshotPath = `screenshots/${artifactId}.png`;
        await fs.mkdir('screenshots', { recursive: true });
        await fs.writeFile(screenshotPath, screenshotBuffer);

        artifactData.thumbnail = screenshotPath;
        artifactData.id = artifactId;
      }

      return artifactData;

    } catch (error) {
      console.error(`Error scraping ${artifactUrl}:`, error);
      return null;
    } finally {
      await browser.close();
    }
  }

  async scrapeNewArtifacts() {
    const existingArtifacts = await this.init();
    const allNewArtifacts = [];

    // Search multiple pages of Google results
    for (let page = 0; page < this.maxPages * 10; page += 10) { // Adjust range as needed
      console.log(`\n--- Searching page ${page / 10 + 1} ---`);

      const urls = await this.searchGoogleForArtifacts(page);

      if (urls.length === 0) {
        console.log('No more results found');
        break;
      }

      const newUrls = urls.filter(url => !this.scrapedArtifacts.has(url));
      console.log(`${newUrls.length} new artifacts found on this page`);

      if (newUrls.length === 0) {
        console.log('No new artifacts on this page');
        continue;
      }

      // Scrape each new artifact with delay to be respectful
      for (const url of newUrls) {
        const artifactData = await this.scrapeArtifactContent(url);

        if (artifactData) {
          allNewArtifacts.push(artifactData);
          this.scrapedArtifacts.add(url);
          console.log(`✅ Scraped: ${artifactData.title}`);
        }

        // Be respectful with delays
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Delay between Google search pages
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Save updated database
    const updatedArtifacts = [...existingArtifacts, ...allNewArtifacts];
    await fs.writeFile(this.dataFile, JSON.stringify(updatedArtifacts, null, 2));

    console.log(`\n🎉 Scraping complete! Found ${allNewArtifacts.length} new artifacts`);
    console.log(`Total artifacts in database: ${updatedArtifacts.length}`);

    return allNewArtifacts;
  }

  // Method for testing - get artifact URLs from single page
  async getArtifactUrls() {
    try {
      return await this.searchGoogleForArtifacts(0);
    } catch (error) {
      console.error('Error getting artifact URLs:', error);
      return [];
    }
  }

  // Method for testing - scrape single artifact
  async scrapeArtifact(url) {
    try {
      return await this.scrapeArtifactContent(url);
    } catch (error) {
      console.error('Error scraping artifact:', error);
      return null;
    }
  }

  // Generate API-friendly format for your TikTok interface
  async generateFeedData() {
    const artifacts = await this.init();

    const feedData = artifacts.map((artifact, index) => ({
      id: index + 1,
      title: artifact.title,
      description: artifact.description,
      author: artifact.author,
      likes: Math.floor(Math.random() * 2000) + 100, // Mock data
      comments: Math.floor(Math.random() * 200) + 10, // Mock data
      type: artifact.type,
      content: artifact.content,
      url: artifact.url,
      thumbnail: artifact.thumbnail,
      createdAt: artifact.scrapedAt,
      isRenderable: true,
      previewCode: artifact.content.substring(0, 200) + '...'
    }));

    await fs.writeFile('feed_data.json', JSON.stringify(feedData, null, 2));
    console.log(`Generated feed data with ${feedData.length} artifacts`);

    return feedData;
  }
}

// Usage example
async function main() {
  const args = process.argv.slice(2);
  const isTestMode = args.includes('--test');
  const isHeadful = args.includes('--headful');

  const scraper = new ClaudeArtifactScraper({
    maxPages: isTestMode ? 1 : 3, // Only 1 page for test mode
    headless: !isHeadful,
    screenshots: true // Always take screenshots
  });

  if (isTestMode) {
    console.log('🚀 Initializing Claude Artifacts Scraper in Test Mode');
    // For testing, we'll just run a small scrape to verify functionality
    const newArtifacts = await scraper.scrapeNewArtifacts();
    // Generate a test_result.json for verification
    await fs.writeFile('test_result.json', JSON.stringify(newArtifacts, null, 2));
    console.log('Test mode complete. Check test_result.json');
  } else {
    console.log('🚀 Initializing Claude Artifacts Scraper');
    // Run daily scraper
    const newArtifacts = await scraper.scrapeNewArtifacts();

    // Generate feed data for your interface
    await scraper.generateFeedData();
  }
}

// Run the scraper
if (require.main === module) {
  main().catch(console.error);
}

module.exports = ClaudeArtifactScraper;


