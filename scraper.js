const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

class ClaudeArtifactScraper {
  constructor(options = {}) {
    this.maxPages = options.maxPages || 3;
    this.headless = options.headless !== false; // Default to true
    this.delay = options.delay || 2000;
    this.screenshots = options.screenshots !== false; // Default to true
    this.outputFile = options.outputFile || 'scraped_artifacts.json';
    this.feedFile = options.feedFile || 'feed_data.json';
    this.screenshotDir = options.screenshotDir || 'screenshots';
    this.updateOnly = options.updateOnly || false;
    
    this.artifacts = [];
    this.existingUrls = new Set();
    this.successCount = 0;
    this.totalFound = 0;
  }

  // Initialize scraper and load existing data
  async init() {
    console.log('🚀 Initializing Claude Artifacts Scraper\n');
    
    if (this.updateOnly || this.screenshots) {
      try {
        await fs.mkdir(this.screenshotDir, { recursive: true });
      } catch (error) {
        console.log(`⚠️  Could not create screenshots directory: ${error.message}`);
      }
    }
    
    // Load existing artifacts to avoid duplicates
    try {
      const existingData = await fs.readFile(this.outputFile, 'utf8');
      const parsed = JSON.parse(existingData);
      const existingArtifacts = parsed.artifacts || parsed || [];
      
      existingArtifacts.forEach(artifact => {
        if (artifact.url) {
          this.existingUrls.add(artifact.url);
        }
      });
      
      console.log(`📂 Loaded ${existingArtifacts.length} existing artifacts`);
      return existingArtifacts;
    } catch (error) {
      console.log('📂 No existing data found, starting fresh');
      return [];
    }
  }

  // Create browser instance with improved settings
  async createBrowser() {
    const options = {
      headless: this.headless ? "new" : false, // Use new headless mode
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ],
      defaultViewport: { width: 1200, height: 800 },
      timeout: 0
    };

    // Try to launch browser with retries
    for (let i = 0; i < 3; i++) {
      try {
        const browser = await puppeteer.launch(options);
        // Test the browser connection
        await browser.version();
        return browser;
      } catch (error) {
        console.log(`   ⚠️  Browser launch attempt ${i + 1}/3 failed: ${error.message}`);
        if (i === 2) throw error;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  // Search Google for Claude artifact URLs
  async getArtifactUrls() {
    console.log('🔍 Starting Google search for Claude artifacts...');
    
    const browser = await this.createBrowser();
    
    const allUrls = new Set();
    
    try {
      const page = await browser.newPage();
      
      // Set realistic user agent
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Enhanced headers to look more human
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      });
      
      // Disable images and CSS to load faster and look less suspicious
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        if(req.resourceType() == 'stylesheet' || req.resourceType() == 'image'){
          req.abort();
        } else {
          req.continue();
        }
      });
      
      // Add random mouse movements to seem more human
      await page.mouse.move(100, 100);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      for (let pageNum = 0; pageNum < this.maxPages; pageNum++) {
        console.log(`📄 Searching page ${pageNum + 1}/${this.maxPages}...`);
        
        try {
          // Multiple search strategies to improve results
          const searchQueries = [
            'site:claude.ai "public/artifacts"',
            'claude.ai/public/artifacts/',
            '"claude.ai/public/artifacts/" -site:reddit.com -site:github.com'
          ];
          
          const searchQuery = searchQueries[pageNum % searchQueries.length];
          const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&start=${Math.floor(pageNum / searchQueries.length) * 10}&hl=en&safe=off&filter=0`;
          
          console.log(`   🔎 Using query: "${searchQuery}"`);
          
          // Navigate with human-like behavior
          await page.goto(searchUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
          });
          
          // Add random delays to seem more human
          await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
          
          // Check for CAPTCHA or bot detection
          const captchaExists = await page.$('div[id="captcha"]') || await page.$('.g-recaptcha');
          if (captchaExists) {
            console.log('   ⚠️  CAPTCHA detected, trying alternative approach...');
            continue;
          }
          
          // Enhanced URL extraction with multiple strategies
          const urls = await page.evaluate(() => {
            // Multiple selectors for different Google layouts
            const selectors = [
              'a[href*="claude.ai/public/artifacts/"]',
              'h3 a[href*="claude.ai"]',
              '[data-ved] a[href*="claude.ai"]',
              '.yuRUbf a[href*="claude.ai"]',
              '.g a[href*="claude.ai"]',
              '[jsname] a[href*="claude.ai"]',
              'div[data-snf] a[href*="claude.ai"]'
            ];
            
            let links = [];
            for (const selector of selectors) {
              const elements = Array.from(document.querySelectorAll(selector));
              links = links.concat(elements);
            }
            
            // Also search in text content for URLs
            const textContent = document.body.innerText;
            const urlRegex = /https?:\/\/claude\.ai\/public\/artifacts\/[a-f0-9-]+/g;
            const textUrls = textContent.match(urlRegex) || [];
            
            const allFoundUrls = links
              .map(link => {
                let href = link.href;
                // Clean up Google redirect URLs
                if (href.includes('/url?')) {
                  const urlMatch = href.match(/url=([^&]+)/);
                  if (urlMatch) {
                    try {
                      href = decodeURIComponent(urlMatch[1]);
                    } catch (e) {
                      // If decoding fails, try the original
                    }
                  }
                }
                return href;
              })
              .concat(textUrls)
              .filter(href => {
                if (!href || typeof href !== 'string') return false;
                return href.includes('claude.ai/public/artifacts/') && 
                       !href.includes('google.com') &&
                       href.match(/claude\.ai\/public\/artifacts\/[a-f0-9-]{8,}/);
              })
              .map(href => {
                // Clean URL
                try {
                  const url = new URL(href);
                  return `${url.protocol}//${url.host}${url.pathname}`;
                } catch (e) {
                  return href.split('#')[0].split('?')[0];
                }
              });
            
            return [...new Set(allFoundUrls)];
          });
          
          console.log(`   ✅ Found ${urls.length} artifact URLs`);
          if (urls.length > 0) {
            console.log(`   📝 Sample URLs:`);
            urls.slice(0, 2).forEach(url => console.log(`      - ${url}`));
          }
          urls.forEach(url => allUrls.add(url));
          
          // Human-like browsing behavior
          await page.mouse.move(Math.random() * 800, Math.random() * 600);
          
          // Variable delay between searches
          if (pageNum < this.maxPages - 1) {
            const delay = 3000 + Math.random() * 4000; // 3-7 seconds
            console.log(`   ⏳ Waiting ${Math.round(delay/1000)}s before next search...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
        } catch (error) {
          console.log(`   ❌ Error on search page ${pageNum + 1}:`, error.message);
          
          // Take a screenshot for debugging
          try {
            await page.screenshot({ path: `debug_page_${pageNum + 1}.png` });
            console.log(`   📸 Debug screenshot saved: debug_page_${pageNum + 1}.png`);
          } catch (e) {
            // Ignore screenshot errors
          }
          
          // Wait a bit longer before retrying
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
      
    } catch (error) {
      console.error('❌ Critical error during Google search:', error.message);
    } finally {
      try {
        await browser.close();
      } catch (e) {
        // Ignore close errors
      }
    }
    
    const uniqueUrls = Array.from(allUrls);
    this.totalFound = uniqueUrls.length;
    console.log(`✅ Total unique artifacts found: ${uniqueUrls.length}`);
    
    // If no URLs found, try alternative search methods
    if (uniqueUrls.length === 0) {
      console.log('🔄 No artifacts found with Google search, trying alternative methods...');
      const alternativeUrls = await this.getArtifactUrlsAlternative();
      alternativeUrls.forEach(url => allUrls.add(url));
      const finalUrls = Array.from(allUrls);
      console.log(`✅ Alternative search found: ${alternativeUrls.length} additional artifacts`);
      console.log(`📊 Total artifacts found: ${finalUrls.length}\n`);
      return finalUrls;
    }
    
    console.log('');
    return uniqueUrls;
  }

  // Alternative method to find artifacts when Google search fails
  async getArtifactUrlsAlternative() {
    console.log('🔍 Trying alternative artifact discovery methods...');
    const alternativeUrls = new Set();
    
    try {
      // Method 1: Try some example artifact URLs for testing
      const testArtifactUrls = [];
      testArtifactUrls.forEach(url => alternativeUrls.add(url));
      
      // Method 2: Try searching other search engines
      const alternativeSearchResults = await this.searchDuckDuckGo();
      alternativeSearchResults.forEach(url => alternativeUrls.add(url));
      
      // Method 3: Check Claude community forums/discussions for shared artifacts
      const forumUrls = await this.searchForumsAndCommunities();
      forumUrls.forEach(url => alternativeUrls.add(url));
      
      // Method 4: Try web archive services
      const archiveUrls = await this.searchWebArchives();
      archiveUrls.forEach(url => alternativeUrls.add(url));
      
    } catch (error) {
      console.log('⚠️  Alternative search methods failed:', error.message);
    }
    
    return Array.from(alternativeUrls);
  }

  // Search DuckDuckGo as alternative to Google
  async searchDuckDuckGo() {
    console.log('   🦆 Searching DuckDuckGo...');
    const browser = await this.createBrowser();
    const urls = new Set();
    
    try {
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
      
      const searchQuery = 'claude.ai/public/artifacts';
      const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(searchQuery)}&t=h_&ia=web`;
      
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const foundUrls = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="claude.ai"]'));
        return links
          .map(link => link.href)
          .filter(href => href && href.includes('claude.ai/public/artifacts/'))
          .filter(href => href.match(/claude\.ai\/public\/artifacts\/[a-f0-9-]{8,}/));
      });
      
      foundUrls.forEach(url => urls.add(url));
      console.log(`      Found ${foundUrls.length} URLs on DuckDuckGo`);
      
    } catch (error) {
      console.log(`      ❌ DuckDuckGo search failed: ${error.message}`);
    } finally {
      try { await browser.close(); } catch (e) {}
    }
    
    return Array.from(urls);
  }

  // Search forums and communities for shared artifacts
  async searchForumsAndCommunities() {
    console.log('   💬 Searching forums and communities...');
    const urls = new Set();
    
    try {
      // Search Reddit for shared artifacts
      const redditUrls = await this.searchRedditForArtifacts();
      redditUrls.forEach(url => urls.add(url));
      
      console.log(`      Found ${urls.size} URLs from community sources`);
      
    } catch (error) {
      console.log(`      ❌ Community search failed: ${error.message}`);
    }
    
    return Array.from(urls);
  }

  // Search web archives for cached artifacts
  async searchWebArchives() {
    console.log('   🏛️ Searching web archives...');
    const urls = new Set();
    
    try {
      // Try Internet Archive's CDX API to find archived artifacts
      const archiveUrls = await this.searchInternetArchive();
      archiveUrls.forEach(url => urls.add(url));
      
      console.log(`      Found ${urls.size} URLs from web archives`);
      
    } catch (error) {
      console.log(`      ❌ Archive search failed: ${error.message}`);
    }
    
    return Array.from(urls);
  }

  // Search Internet Archive for cached artifacts
  async searchInternetArchive() {
    console.log('      📚 Checking Internet Archive...');
    const urls = new Set();
    
    try {
      // Use Internet Archive's CDX API to search for archived artifacts
      const cdxUrl = 'http://web.archive.org/cdx/search/cdx?url=claude.ai/public/artifacts/*&output=json&limit=100&fl=original';
      
      const response = await fetch(cdxUrl);
      if (response.ok) {
        const data = await response.json();
        
        // Skip header row
        for (let i = 1; i < data.length; i++) {
          const originalUrl = data[i][0];
          if (originalUrl && originalUrl.match(/claude\.ai\/public\/artifacts\/[a-f0-9-]{8,}/)) {
            urls.add(originalUrl);
          }
        }
      }
      
    } catch (error) {
      console.log(`        ❌ Internet Archive API failed: ${error.message}`);
    }
    
    return Array.from(urls);
  }

  // Search Reddit for shared Claude artifacts
  async searchRedditForArtifacts() {
    console.log('      📱 Checking Reddit...');
    const urls = new Set();
    
    try {
      // Use Reddit's JSON API to search for Claude artifacts
      const searchTerms = ['claude.ai/public/artifacts/', 'claude artifacts', 'claude ai artifacts'];
      
      for (const term of searchTerms) {
        const redditUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(term)}&limit=25&sort=new`;
        
        try {
          const response = await fetch(redditUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            
            // Extract URLs from Reddit posts and comments
            data.data?.children?.forEach(post => {
              const text = post.data.selftext + ' ' + post.data.url + ' ' + post.data.title;
              const matches = text.match(/https?:\/\/claude\.ai\/public\/artifacts\/[a-f0-9-]{8,}/g) || [];
              matches.forEach(url => urls.add(url));
            });
          }
        } catch (e) {
          // Continue with next search term
        }
        
        // Be respectful with API calls
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      console.log(`        ❌ Reddit search failed: ${error.message}`);
    }
    
    return Array.from(urls);
  }

  // Alternative scraping methods that bypass Claude's bot detection
  async scrapeArtifactAlternative(url) {
    console.log(`   🕵️  Trying alternative content extraction...`);
    
    try {
      // Method 1: Try to find API endpoints
      let content = await this.tryApiEndpoints(url);
      if (content) return content;
      
      // Method 2: Try Internet Archive cached version
      content = await this.tryInternetArchiveContent(url);
      if (content) return content;
      
      // Method 3: Try proxy services
      content = await this.tryProxyServices(url);
      if (content) return content;
      
      // Method 4: Try social media metadata extraction
      content = await this.trySocialMetadata(url);
      if (content) return content;
      
      return null;
      
    } catch (error) {
      console.log(`   ⚠️  Alternative methods failed: ${error.message}`);
      return null;
    }
  }

  // Try to find API endpoints that serve artifact data
  async tryApiEndpoints(url) {
    console.log(`      🔌 Checking API endpoints...`);
    
    try {
      const artifactId = url.split('/').pop();
      
      // Try common API patterns
      const apiEndpoints = [
        `https://claude.ai/api/public/artifacts/${artifactId}`,
        `https://claude.ai/api/v1/artifacts/${artifactId}`,
        `https://claude.ai/public/artifacts/${artifactId}/raw`,
        `https://claude.ai/public/artifacts/${artifactId}/content`,
        `https://claude.ai/public/artifacts/${artifactId}.json`,
        `https://api.claude.ai/artifacts/${artifactId}`,
        // Try subdomain variations
        `https://artifacts.claude.ai/${artifactId}`,
        `https://cdn.claude.ai/artifacts/${artifactId}`,
      ];
      
      for (const endpoint of apiEndpoints) {
        try {
          const response = await fetch(endpoint, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
              'Accept': 'application/json, text/html, */*',
              'Referer': 'https://claude.ai/',
            },
            timeout: 10000
          });
          
          if (response.ok) {
            const contentType = response.headers.get('content-type');
            let data;
            
            if (contentType?.includes('application/json')) {
              data = await response.json();
            } else {
              data = await response.text();
            }
            
            // Check if we got actual artifact content
            if (data && (typeof data === 'object' || data.length > 100)) {
              console.log(`        ✅ Found content at: ${endpoint}`);
              return this.parseArtifactData(url, data, 'api');
            }
          }
        } catch (e) {
          // Continue to next endpoint
        }
      }
      
    } catch (error) {
      console.log(`        ❌ API endpoint search failed: ${error.message}`);
    }
    
    return null;
  }

  // Try to get content from Internet Archive
  async tryInternetArchiveContent(url) {
    console.log(`      🏛️  Checking Internet Archive content...`);
    
    try {
      // Get the latest archived version
      const archiveUrl = `http://web.archive.org/web/${url}`;
      
      const response = await fetch(archiveUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        },
        timeout: 15000
      });
      
      if (response.ok) {
        const html = await response.text();
        
        // Check if this looks like a real artifact page (not a security challenge)
        if (!html.includes('Verify you are human') && !html.includes('Just a moment')) {
          console.log(`        ✅ Found cached content in Internet Archive`);
          return this.parseArtifactData(url, html, 'archive');
        }
      }
      
    } catch (error) {
      console.log(`        ❌ Internet Archive failed: ${error.message}`);
    }
    
    return null;
  }

  // Try proxy services that can bypass bot detection
  async tryProxyServices(url) {
    console.log(`      🌐 Trying proxy services...`);
    
    try {
      // Method 1: Try ScrapingBee (example - you'd need API key)
      // const proxyServices = [
      //   `https://app.scrapingbee.com/api/v1/?api_key=YOUR_KEY&url=${encodeURIComponent(url)}`,
      //   `https://api.scraperapi.com?api_key=YOUR_KEY&url=${encodeURIComponent(url)}`,
      // ];
      
      // Method 2: Try free proxy alternatives
      const freeProxies = [
        `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
        `https://cors-anywhere.herokuapp.com/${url}`,
      ];
      
      for (const proxyUrl of freeProxies) {
        try {
          const response = await fetch(proxyUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            },
            timeout: 20000
          });
          
          if (response.ok) {
            let data = await response.text();
            
            // Handle AllOrigins response format
            if (proxyUrl.includes('allorigins')) {
              const parsed = JSON.parse(data);
              data = parsed.contents;
            }
            
            // Check if we got real content
            if (data && !data.includes('Verify you are human') && data.length > 500) {
              console.log(`        ✅ Got content via proxy service`);
              return this.parseArtifactData(url, data, 'proxy');
            }
          }
        } catch (e) {
          // Continue to next proxy
        }
      }
      
    } catch (error) {
      console.log(`        ❌ Proxy services failed: ${error.message}`);
    }
    
    return null;
  }

  // Try to extract metadata from social media when artifacts are shared
  async trySocialMetadata(url) {
    console.log(`      📱 Checking social media metadata...`);
    
    try {
      // Try OpenGraph and Twitter Card extractors
      const metadataServices = [
        `https://opengraph.io/api/1.1/site/${encodeURIComponent(url)}`,
        `https://api.linkpreview.net/?key=FREE_KEY&q=${encodeURIComponent(url)}`, // Example
      ];
      
      // For now, we'll just extract what we can from the URL structure
      const artifactId = url.split('/').pop();
      
      if (artifactId && artifactId.match(/[a-f0-9-]{8,}/)) {
        // Create minimal artifact data from URL structure
        return {
          id: artifactId,
          url: url,
          title: `Artifact ${artifactId.substring(0, 8)}`,
          description: 'Discovered via URL pattern matching',
          content: '',
          rawCode: '',
          type: 'unknown',
          language: '',
          codeLength: 0,
          hasCode: false,
          scrapedAt: new Date().toISOString(),
          author: 'Unknown',
          method: 'social_metadata'
        };
      }
      
    } catch (error) {
      console.log(`        ❌ Social metadata failed: ${error.message}`);
    }
    
    return null;
  }

  // Parse artifact data from various sources
  parseArtifactData(url, data, method) {
    const artifactId = url.split('/').pop();
    
    try {
      let content = '';
      let rawCode = '';
      let title = '';
      let hasCode = false;
      
      if (typeof data === 'object' && data.content) {
        // JSON API response
        content = data.content;
        rawCode = data.content;
        title = data.title || data.name || 'Untitled Artifact';
        hasCode = true;
      } else if (typeof data === 'string') {
        // HTML response
        if (method === 'archive' || method === 'proxy') {
          // Extract from HTML
          const scriptMatch = data.match(/<script[^>]*>[\s\S]*?artifact[\s\S]*?<\/script>/i);
          if (scriptMatch) {
            rawCode = scriptMatch[0];
            hasCode = true;
          }
          
          const titleMatch = data.match(/<title[^>]*>([^<]+)</i);
          title = titleMatch ? titleMatch[1].replace(' | Claude', '').trim() : 'Untitled Artifact';
        }
        
        content = data;
      }
      
      return {
        id: artifactId,
        url: url,
        title: title || `Artifact ${artifactId.substring(0, 8)}`,
        description: `Extracted via ${method}`,
        content: content.substring(0, 10000),
        rawCode: rawCode.substring(0, 10000),
        type: this.detectArtifactType(rawCode),
        language: this.detectLanguage(rawCode),
        codeLength: rawCode.length,
        hasCode: hasCode,
        scrapedAt: new Date().toISOString(),
        author: 'Unknown',
        method: method
      };
      
    } catch (error) {
      console.log(`        ❌ Failed to parse artifact data: ${error.message}`);
      return null;
    }
  }

  // Detect artifact type from code content
  detectArtifactType(code) {
    if (!code) return 'unknown';
    
    const codeUpper = code.toUpperCase();
    
    if (code.includes('import React') || code.includes('useState')) return 'react';
    if (code.includes('<svg')) return 'svg';
    if (code.includes('<!DOCTYPE') || code.includes('<html')) return 'html';
    if (code.includes('function ') || code.includes('const ')) return 'javascript';
    if (codeUpper.includes('MERMAID')) return 'mermaid';
    
    return 'html';
  }

  // Detect programming language
  detectLanguage(code) {
    if (!code) return '';
    
    if (code.includes('import React') || code.includes('jsx')) return 'jsx';
    if (code.includes('<svg')) return 'xml';
    if (code.includes('function ') || code.includes('const ')) return 'javascript';
    if (code.includes('<!DOCTYPE') || code.includes('<html')) return 'html';
    if (code.includes('{') && code.includes('}') && code.includes(':')) return 'css';
    
    return 'html';
  }

  // Scrape individual artifact data
  async scrapeArtifact(url, index, total) {
    console.log(`[${index + 1}/${total}] 🎨 Scraping: ${url.substring(0, 60)}...`);
    
    // First try alternative methods to get content WITHOUT visiting Claude directly
    let artifactData = await this.scrapeArtifactAlternative(url);
    
    if (artifactData && artifactData.hasCode) {
      console.log(`   ✅ Got content via alternative method!`);
      return artifactData;
    }
    
    // Fallback to browser scraping if alternative methods fail
    console.log(`   🔄 Trying browser scraping as fallback...`);
    const browser = await this.createBrowser();
    
    try {
      const page = await browser.newPage();
      
      // Set user agent
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
      
      // Navigate to artifact
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check for Cloudflare or other security challenges
      const isCloudflareChallenge = await page.$('div[class*="main-content"]') && 
                                   await page.$('h1[class*="zone-name-title"]');
      
      if (isCloudflareChallenge) {
        console.log('   ⚠️  Cloudflare challenge detected, waiting...');
        // Wait longer for Cloudflare to resolve
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Check if we got through
        const stillChallenge = await page.evaluate(() => {
          return document.body.innerText.includes('Verify you are human') || 
                 document.body.innerText.includes('Just a moment');
        });
        
        if (stillChallenge) {
          console.log('   ❌ Could not bypass security challenge');
          return null;
        }
      }
      
      // Extract artifact data with enhanced code extraction
      const artifactData = await page.evaluate((sourceUrl) => {
        // Get the artifact ID from URL
        const urlParts = sourceUrl.split('/');
        const id = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
        
        // Try to find title from various sources
        let title = document.title || 'Untitled Artifact';
        title = title.replace(' | Claude', '').replace(' - Claude', '').trim();
        
        // If title is still generic, try to find a better one
        if (title === 'Claude' || title === 'Untitled Artifact') {
          const h1 = document.querySelector('h1');
          const h2 = document.querySelector('h2');
          const h3 = document.querySelector('h3');
          title = h1?.textContent || h2?.textContent || h3?.textContent || title;
        }
        
        // Try to get description from meta tags
        const description = document.querySelector('meta[name="description"]')?.content ||
                          document.querySelector('meta[property="og:description"]')?.content ||
                          document.querySelector('meta[name="twitter:description"]')?.content ||
                          'No description available';
        
        // Enhanced artifact code extraction
        let content = '';
        let rawCode = '';
        let type = 'html';
        let language = '';
        
        // Strategy 1: Look for script tags with artifact data (common in Claude)
        const scriptTags = document.querySelectorAll('script[type="application/json"], script:not([src])');
        let artifactFound = false;
        
        for (const script of scriptTags) {
          if (script.textContent && (
            script.textContent.includes('artifact') ||
            script.textContent.includes('content') ||
            script.textContent.includes('code') ||
            script.textContent.includes('html') ||
            script.textContent.includes('react')
          )) {
            try {
              const data = JSON.parse(script.textContent);
              // Look for artifact code in various possible locations
              if (data.artifact?.content) {
                rawCode = data.artifact.content;
                type = data.artifact.type || 'html';
                artifactFound = true;
                break;
              } else if (data.content) {
                rawCode = data.content;
                artifactFound = true;
                break;
              } else if (data.code) {
                rawCode = data.code;
                artifactFound = true;
                break;
              }
            } catch (e) {
              // Not JSON, check if it's direct code
              if (script.textContent.includes('<') && script.textContent.includes('>')) {
                rawCode = script.textContent;
                artifactFound = true;
                break;
              }
            }
          }
        }
        
        // Strategy 2: Look for pre/code blocks containing the artifact code
        if (!artifactFound) {
          const codeBlocks = document.querySelectorAll('pre code, code, pre');
          for (const block of codeBlocks) {
            const text = block.textContent || block.innerText;
            if (text && text.length > 100 && (
              text.includes('<html') ||
              text.includes('<div') ||
              text.includes('function ') ||
              text.includes('const ') ||
              text.includes('import ') ||
              text.includes('<svg')
            )) {
              rawCode = text;
              artifactFound = true;
              break;
            }
          }
        }
        
        // Strategy 3: Look in data attributes
        if (!artifactFound) {
          const dataElements = document.querySelectorAll('[data-artifact], [data-code], [data-content]');
          for (const element of dataElements) {
            if (element.dataset.artifact) {
              rawCode = element.dataset.artifact;
              artifactFound = true;
              break;
            } else if (element.dataset.code) {
              rawCode = element.dataset.code;
              artifactFound = true;
              break;
            } else if (element.dataset.content) {
              rawCode = element.dataset.content;
              artifactFound = true;
              break;
            }
          }
        }
        
        // Strategy 4: Look for iframe with srcdoc (contains the actual HTML)
        if (!artifactFound) {
          const iframe = document.querySelector('iframe[srcdoc]');
          if (iframe && iframe.getAttribute('srcdoc')) {
            rawCode = iframe.getAttribute('srcdoc');
            type = 'html';
            artifactFound = true;
          }
        }
        
        // Strategy 5: Look for textareas or divs that might contain code
        if (!artifactFound) {
          const textAreas = document.querySelectorAll('textarea, [contenteditable="true"]');
          for (const area of textAreas) {
            const text = area.value || area.textContent;
            if (text && text.length > 50 && (
              text.includes('<') || 
              text.includes('function') || 
              text.includes('const') ||
              text.includes('import')
            )) {
              rawCode = text;
              artifactFound = true;
              break;
            }
          }
        }
        
        // Strategy 6: Fallback - get iframe content or main content
        if (!artifactFound) {
          const iframe = document.querySelector('iframe');
          if (iframe && iframe.src) {
            content = `<iframe src="${iframe.src}"></iframe>`;
            rawCode = content;
            type = 'html';
          } else {
            // Last resort: get main content
            const main = document.querySelector('main') || 
                         document.querySelector('[role="main"]') ||
                         document.querySelector('.artifact-content') ||
                         document.body;
            
            if (main) {
              rawCode = main.innerHTML;
            }
          }
        }
        
        // Process the extracted code
        content = rawCode;
        
        // Detect artifact type and language from code content
        if (rawCode) {
          const codeUpper = rawCode.toUpperCase();
          
          // React detection
          if (rawCode.includes('import React') || 
              rawCode.includes('export default function') ||
              rawCode.includes('function ') && rawCode.includes('return (') ||
              rawCode.includes('const ') && rawCode.includes('=> {') ||
              rawCode.includes('useState') ||
              rawCode.includes('useEffect')) {
            type = 'react';
            language = 'jsx';
          }
          // SVG detection
          else if (rawCode.includes('<svg') || codeUpper.includes('SVG')) {
            type = 'svg';
            language = 'xml';
          }
          // HTML detection
          else if (rawCode.includes('<!DOCTYPE') || 
                   rawCode.includes('<html') ||
                   rawCode.includes('<head') ||
                   rawCode.includes('<body')) {
            type = 'html';
            language = 'html';
          }
          // JavaScript detection
          else if (rawCode.includes('function ') ||
                   rawCode.includes('const ') ||
                   rawCode.includes('let ') ||
                   rawCode.includes('var ')) {
            type = 'javascript';
            language = 'javascript';
          }
          // CSS detection
          else if (rawCode.includes('{') && rawCode.includes('}') && rawCode.includes(':')) {
            type = 'css';
            language = 'css';
          }
          // Default to HTML if it contains tags
          else if (rawCode.includes('<') && rawCode.includes('>')) {
            type = 'html';
            language = 'html';
          }
        }
        
        return {
          id,
          url: sourceUrl,
          title: title.substring(0, 200),
          description: description.substring(0, 500),
          content: content,
          rawCode: rawCode, // The actual artifact source code
          type: type,
          language: language,
          codeLength: rawCode.length,
          hasCode: artifactFound,
          scrapedAt: new Date().toISOString(),
          author: 'Unknown'
        };
      }, url);
      
      // Take screenshot if enabled
      if (this.screenshots) {
        try {
          const screenshotPath = path.join(this.screenshotDir, `${artifactData.id}.png`);
          
          await page.screenshot({ 
            path: screenshotPath,
            fullPage: false,
            clip: { x: 0, y: 0, width: 1200, height: 800 }
          });
          
          artifactData.screenshot = screenshotPath;
          console.log(`   📸 Screenshot saved`);
        } catch (screenshotError) {
          console.log(`   ⚠️  Screenshot failed: ${screenshotError.message}`);
        }
      }
      
      console.log(`   ✅ Success: ${artifactData.title}`);
      return artifactData;
      
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
      return null;
    } finally {
      try {
        await browser.close();
      } catch (e) {
        // Ignore close errors
      }
    }
  }

  // Main scraping function
  async scrapeAll() {
    const existingArtifacts = await this.init();
    
    // Get all artifact URLs
    const urls = await this.getArtifactUrls();
    
    if (urls.length === 0) {
      console.log('❌ No artifacts found. Check your internet connection or try again later.');
      return;
    }
    
    // Filter out existing URLs if updateOnly is true
    let urlsToScrape = urls;
    if (this.updateOnly) {
      urlsToScrape = urls.filter(url => !this.existingUrls.has(url));
      console.log(`🔄 Update mode: ${urlsToScrape.length} new artifacts to scrape\n`);
    } else {
      console.log(`🎯 Found ${urls.length} artifacts to scrape\n`);
    }
    
    if (urlsToScrape.length === 0) {
      console.log('✅ No new artifacts found. Database is up to date.');
      return existingArtifacts;
    }
    
    // Scrape each artifact
    for (let i = 0; i < urlsToScrape.length; i++) {
      const url = urlsToScrape[i];
      
      const artifactData = await this.scrapeArtifact(url, i, urlsToScrape.length);
      
      if (artifactData) {
        this.artifacts.push(artifactData);
        this.successCount++;
      }
      
      // Delay between artifact scrapes
      if (i < urlsToScrape.length - 1) {
        console.log(`   ⏳ Waiting 2 seconds...\n`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Combine with existing artifacts
    const allArtifacts = this.updateOnly ? [...existingArtifacts, ...this.artifacts] : this.artifacts;
    
    // Save results
    await this.saveResults(allArtifacts);
    
    // Print summary
    console.log(`\n🎉 Scraping complete!`);
    console.log(`✅ Successfully scraped: ${this.successCount}/${urlsToScrape.length} artifacts`);
    console.log(`📊 Total artifacts: ${allArtifacts.length}`);
    console.log(`💾 Data saved to: ${this.outputFile} and ${this.feedFile}`);
    
    return allArtifacts;
  }

  // Save results to JSON files
  async saveResults(artifacts) {
    // Save complete data
    const completeData = {
      scrapedAt: new Date().toISOString(),
      totalArtifacts: artifacts.length,
      artifacts: artifacts
    };
    
    await fs.writeFile(this.outputFile, JSON.stringify(completeData, null, 2));
    
    // Create feed data for TikTok-style interface
    const feedData = artifacts.map((artifact, index) => ({
      id: index + 1,
      title: artifact.title,
      description: artifact.description,
      author: artifact.author,
      likes: Math.floor(Math.random() * 1000) + 50, // Mock engagement data
      comments: Math.floor(Math.random() * 100) + 5,
      type: artifact.type,
      language: artifact.language || 'html',
      content: artifact.content, // Keep original content for fallback
      rawCode: artifact.rawCode || artifact.content, // The actual executable code
      codeLength: artifact.codeLength || 0,
      hasCode: artifact.hasCode || false,
      url: artifact.url,
      thumbnail: artifact.screenshot || null,
      createdAt: artifact.scrapedAt,
      // Additional metadata for TikTok interface
      isRenderable: !!(artifact.rawCode && artifact.hasCode),
      previewCode: artifact.rawCode ? artifact.rawCode.substring(0, 200) + '...' : ''
    }));
    
    await fs.writeFile(this.feedFile, JSON.stringify(feedData, null, 2));
  }

  // Test function for validation
  async testScrape(maxArtifacts = 3) {
    console.log('🧪 Running test scrape...\n');
    
    const originalMaxPages = this.maxPages;
    this.maxPages = 1; // Only search first page for testing
    
    try {
      const urls = await this.getArtifactUrls();
      const testUrls = urls.slice(0, maxArtifacts);
      
      console.log(`🎯 Testing with ${testUrls.length} artifacts\n`);
      
      for (let i = 0; i < testUrls.length; i++) {
        const artifactData = await this.scrapeArtifact(testUrls[i], i, testUrls.length);
        if (artifactData) {
          this.artifacts.push(artifactData);
          this.successCount++;
        }
        
        if (i < testUrls.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Shorter delay for testing
        }
      }
      
      // Save test results
      await fs.writeFile('test_result.json', JSON.stringify(this.artifacts, null, 2));
      
      console.log(`\n🧪 Test complete!`);
      console.log(`✅ Successfully scraped: ${this.successCount}/${testUrls.length} artifacts`);
      console.log(`💾 Test data saved to: test_result.json`);
      
    } finally {
      this.maxPages = originalMaxPages;
    }
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  const isTest = args.includes('--test');
  const isUpdateOnly = args.includes('--update-only');
  const isHeadful = args.includes('--headful');
  
  const options = {
    updateOnly: isUpdateOnly,
    headless: !isHeadful
  };
  
  const scraper = new ClaudeArtifactScraper(options);
  
  try {
    if (isTest) {
      await scraper.testScrape();
    } else {
      await scraper.scrapeAll();
    }
  } catch (error) {
    console.error('💥 Scraper failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = ClaudeArtifactScraper;