const ClaudeArtifactScraper = require('./scraper.js');
const fs = require('fs').promises;

class ScraperTester {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  // Log test result
  logTest(testName, passed, message = '') {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${testName}`);
    if (message) {
      console.log(`   ${message}`);
    }
    
    this.testResults.tests.push({
      name: testName,
      passed,
      message
    });
    
    if (passed) {
      this.testResults.passed++;
    } else {
      this.testResults.failed++;
    }
  }

  // Test 1: Basic scraper initialization
  async testInitialization() {
    console.log('\n🧪 Test 1: Scraper Initialization');
    
    try {
      const scraper = new ClaudeArtifactScraper({
        maxPages: 1,
        headless: true,
        screenshots: false
      });
      
      this.logTest('Scraper constructor', !!scraper, 'Scraper instance created successfully');
      this.logTest('Default options', scraper.maxPages === 1 && scraper.headless === true, 'Options set correctly');
      
    } catch (error) {
      this.logTest('Scraper initialization', false, error.message);
    }
  }

  // Test 2: URL validation
  async testUrlValidation() {
    console.log('\n🧪 Test 2: URL Validation');
    
    const validUrls = [
      'https://claude.ai/public/artifacts/abc123-def456',
      'https://claude.ai/public/artifacts/123-456-789'
    ];
    
    const invalidUrls = [
      'https://google.com',
      'https://claude.ai/chat',
      'invalid-url'
    ];
    
    // Test valid URL pattern
    const urlPattern = /claude\.ai\/public\/artifacts\/[a-f0-9-]+/;
    
    let validPassed = validUrls.every(url => urlPattern.test(url));
    let invalidPassed = invalidUrls.every(url => !urlPattern.test(url));
    
    this.logTest('Valid URLs recognized', validPassed, `${validUrls.length} valid URLs passed`);
    this.logTest('Invalid URLs rejected', invalidPassed, `${invalidUrls.length} invalid URLs rejected`);
  }

  // Test 3: File operations
  async testFileOperations() {
    console.log('\n🧪 Test 3: File Operations');
    
    try {
      // Test creating screenshots directory
      await fs.mkdir('test-screenshots', { recursive: true });
      this.logTest('Directory creation', true, 'test-screenshots directory created');
      
      // Test writing JSON file
      const testData = { test: 'data', timestamp: new Date().toISOString() };
      await fs.writeFile('test-output.json', JSON.stringify(testData, null, 2));
      this.logTest('File writing', true, 'test-output.json written successfully');
      
      // Test reading JSON file
      const readData = await fs.readFile('test-output.json', 'utf8');
      const parsed = JSON.parse(readData);
      this.logTest('File reading', parsed.test === 'data', 'test-output.json read and parsed correctly');
      
      // Cleanup test files
      await fs.unlink('test-output.json');
      await fs.rmdir('test-screenshots');
      
    } catch (error) {
      this.logTest('File operations', false, error.message);
    }
  }

  // Test 4: Data structure validation
  async testDataStructures() {
    console.log('\n🧪 Test 4: Data Structure Validation');
    
    // Mock enhanced artifact data structure
    const mockArtifact = {
      id: 'test-123',
      url: 'https://claude.ai/public/artifacts/test-123',
      title: 'Test Artifact',
      description: 'A test artifact for validation',
      content: '<div>Test content</div>',
      rawCode: '<div style="color: blue;">Hello World</div>',
      type: 'html',
      language: 'html',
      codeLength: 42,
      hasCode: true,
      scrapedAt: new Date().toISOString(),
      author: 'Unknown'
    };
    
    // Validate required fields (enhanced)
    const requiredFields = ['id', 'url', 'title', 'description', 'content', 'rawCode', 'type', 'language', 'codeLength', 'hasCode', 'scrapedAt', 'author'];
    const hasAllFields = requiredFields.every(field => mockArtifact.hasOwnProperty(field));
    
    this.logTest('Enhanced artifact structure', hasAllFields, `All ${requiredFields.length} enhanced fields present`);
    
    // Validate field types
    const fieldTypes = {
      id: 'string',
      url: 'string',
      title: 'string',
      description: 'string',
      content: 'string',
      rawCode: 'string',
      type: 'string',
      language: 'string',
      codeLength: 'number',
      hasCode: 'boolean',
      scrapedAt: 'string',
      author: 'string'
    };
    
    const typesCorrect = Object.entries(fieldTypes).every(([field, expectedType]) => 
      typeof mockArtifact[field] === expectedType
    );
    
    this.logTest('Enhanced field types', typesCorrect, 'All enhanced field types are correct');
    
    // Test enhanced feed data transformation
    const feedItem = {
      id: 1,
      title: mockArtifact.title,
      description: mockArtifact.description,
      author: mockArtifact.author,
      likes: 100,
      comments: 10,
      type: mockArtifact.type,
      language: mockArtifact.language,
      content: mockArtifact.content,
      rawCode: mockArtifact.rawCode,
      codeLength: mockArtifact.codeLength,
      hasCode: mockArtifact.hasCode,
      url: mockArtifact.url,
      thumbnail: null,
      createdAt: mockArtifact.scrapedAt,
      isRenderable: true,
      previewCode: mockArtifact.rawCode.substring(0, 200) + '...'
    };
    
    const feedFields = ['id', 'title', 'description', 'author', 'likes', 'comments', 'type', 'language', 'content', 'rawCode', 'codeLength', 'hasCode', 'url', 'thumbnail', 'createdAt', 'isRenderable', 'previewCode'];
    const hasFeedFields = feedFields.every(field => feedItem.hasOwnProperty(field));
    
    this.logTest('Enhanced feed data structure', hasFeedFields, `Enhanced feed format has all ${feedFields.length} required fields`);
    
    // Test code extraction validation
    const hasRawCode = feedItem.rawCode && feedItem.rawCode.length > 0;
    const isRenderable = feedItem.isRenderable && feedItem.hasCode;
    
    this.logTest('Code extraction ready', hasRawCode && isRenderable, 'Raw code available for TikTok interface rendering');
  }

  // Test 5: Live scraper test (minimal)
  async testLiveScraping() {
    console.log('\n🧪 Test 5: Live Scraping (Limited)');
    
    try {
      const scraper = new ClaudeArtifactScraper({
        maxPages: 1,
        headless: true,
        screenshots: false
      });
      
      console.log('   🔍 Searching for artifacts...');
      const urls = await scraper.getArtifactUrls();
      
      this.logTest('Google search', urls.length > 0, `Found ${urls.length} artifact URLs`);
      
      if (urls.length > 0) {
        console.log(`   🎯 Testing scrape on first artifact...`);
        const firstUrl = urls[0];
        const artifactData = await scraper.scrapeArtifact(firstUrl, 0, 1);
        
        if (artifactData) {
          this.logTest('Artifact scraping', true, `Successfully scraped: "${artifactData.title}"`);
          this.logTest('Data completeness', !!(artifactData.id && artifactData.url && artifactData.title), 'Essential fields populated');
          
          // Save minimal test result
          await fs.writeFile('test_result.json', JSON.stringify([artifactData], null, 2));
          console.log('   💾 Test result saved to test_result.json');
          
        } else {
          this.logTest('Artifact scraping', false, 'Failed to scrape test artifact');
        }
      } else {
        this.logTest('Artifact availability', false, 'No artifacts found for testing');
      }
      
    } catch (error) {
      this.logTest('Live scraping', false, error.message);
    }
  }

  // Test 6: Error handling
  async testErrorHandling() {
    console.log('\n🧪 Test 6: Error Handling');
    
    try {
      const scraper = new ClaudeArtifactScraper({
        headless: true,
        screenshots: false
      });
      
      // Test invalid URL handling
      const invalidUrl = 'https://example.com/invalid';
      const result = await scraper.scrapeArtifact(invalidUrl, 0, 1);
      
      this.logTest('Invalid URL handling', result === null, 'Invalid URL returns null gracefully');
      
      // Test missing file handling
      try {
        await fs.readFile('non-existent-file.json', 'utf8');
        this.logTest('Missing file handling', false, 'Should have thrown error');
      } catch (error) {
        this.logTest('Missing file handling', true, 'Missing file throws error as expected');
      }
      
    } catch (error) {
      this.logTest('Error handling test', false, error.message);
    }
  }

  // Run all tests
  async runAllTests() {
    console.log('🚀 Starting Claude Artifacts Scraper Test Suite\n');
    console.log('=' .repeat(50));
    
    await this.testInitialization();
    await this.testUrlValidation();
    await this.testFileOperations();
    await this.testDataStructures();
    await this.testLiveScraping();
    await this.testErrorHandling();
    
    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST SUMMARY');
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);
    console.log(`📈 Success Rate: ${Math.round((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100)}%`);
    
    if (this.testResults.failed > 0) {
      console.log('\n💡 Failed Tests:');
      this.testResults.tests
        .filter(test => !test.passed)
        .forEach(test => {
          console.log(`   • ${test.name}: ${test.message}`);
        });
    }
    
    console.log('\n🎉 Test suite complete!');
    
    // Return success/failure
    return this.testResults.failed === 0;
  }

  // Quick validation test
  async quickTest() {
    console.log('🧪 Running Quick Validation Test\n');
    
    try {
      const scraper = new ClaudeArtifactScraper({
        maxPages: 1,
        headless: true,
        screenshots: false
      });
      
      await scraper.testScrape(2); // Test with 2 artifacts
      console.log('✅ Quick test completed successfully');
      return true;
      
    } catch (error) {
      console.error('❌ Quick test failed:', error.message);
      return false;
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const isQuickTest = args.includes('--quick');
  
  const tester = new ScraperTester();
  
  try {
    if (isQuickTest) {
      await tester.quickTest();
    } else {
      const success = await tester.runAllTests();
      process.exit(success ? 0 : 1);
    }
  } catch (error) {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = ScraperTester;