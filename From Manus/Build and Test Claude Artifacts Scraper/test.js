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

  // Run all tests
  async runAllTests() {
    console.log('🚀 Starting Claude Artifacts Scraper Test Suite\n');
    console.log('='.repeat(50));
    
    await this.testInitialization();
    await this.testLiveScraping();
    
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
}

// Main execution
async function main() {
  const tester = new ScraperTester();
  
  try {
    const success = await tester.runAllTests();
    process.exit(success ? 0 : 1);
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


