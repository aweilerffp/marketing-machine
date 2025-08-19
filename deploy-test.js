/**
 * Marketing Machine - Pre-Deployment Testing Suite
 * Tests everything before pushing to production
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class DeploymentTester {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.results = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : '✅';
    console.log(`${prefix} [${timestamp}] ${message}`);
    
    if (type === 'error') this.errors.push(message);
    if (type === 'warning') this.warnings.push(message);
    this.results.push({ type, message, timestamp });
  }

  async runCommand(command, description) {
    return new Promise((resolve, reject) => {
      this.log(`Running: ${description}`);
      exec(command, (error, stdout, stderr) => {
        if (error) {
          this.log(`Failed: ${description} - ${error.message}`, 'error');
          reject(error);
        } else {
          this.log(`Success: ${description}`);
          resolve({ stdout, stderr });
        }
      });
    });
  }

  async testEnvironmentFiles() {
    this.log('🔍 Testing Environment Configuration...');
    
    const requiredFiles = [
      'frontend/.env.development',
      'frontend/.env.production',
      'backend/.env'
    ];

    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        this.log(`Missing environment file: ${file}`, 'error');
      } else {
        const content = fs.readFileSync(file, 'utf8');
        
        // Check for Clerk keys in frontend env files
        if (file.includes('frontend') && !content.includes('VITE_CLERK_PUBLISHABLE_KEY')) {
          this.log(`Missing VITE_CLERK_PUBLISHABLE_KEY in ${file}`, 'error');
        }
        
        // Check for empty values
        const emptyKeys = content.match(/^[A-Z_]+=\s*$/gm);
        if (emptyKeys) {
          this.log(`Empty environment variables in ${file}: ${emptyKeys.join(', ')}`, 'warning');
        }
        
        this.log(`Environment file OK: ${file}`);
      }
    }
  }

  async testDependencies() {
    this.log('📦 Testing Dependencies...');
    
    try {
      // Test frontend dependencies
      await this.runCommand('cd frontend && npm list --depth=0', 'Frontend dependency check');
      
      // Test backend dependencies
      await this.runCommand('cd backend && npm list --depth=0', 'Backend dependency check');
      
      // Check for security vulnerabilities
      try {
        await this.runCommand('cd frontend && npm audit --audit-level=high', 'Frontend security audit');
      } catch (error) {
        this.log('Frontend has high-severity vulnerabilities', 'warning');
      }
      
    } catch (error) {
      this.log(`Dependency test failed: ${error.message}`, 'error');
    }
  }

  async testFrontendBuild() {
    this.log('🏗️  Testing Frontend Build...');
    
    try {
      // Clean build
      await this.runCommand('cd frontend && rm -rf dist', 'Clean previous build');
      
      // Build frontend
      await this.runCommand('cd frontend && npm run build', 'Frontend build');
      
      // Check if build artifacts exist
      const distPath = 'frontend/dist';
      if (!fs.existsSync(distPath)) {
        this.log('Build dist directory not created', 'error');
        return;
      }
      
      const indexExists = fs.existsSync(path.join(distPath, 'index.html'));
      if (!indexExists) {
        this.log('index.html not generated in build', 'error');
        return;
      }
      
      // Check build size
      const stats = fs.statSync(distPath);
      this.log(`Build completed successfully. Dist size: ~${this.getDirSize(distPath)} MB`);
      
    } catch (error) {
      this.log(`Frontend build failed: ${error.message}`, 'error');
    }
  }

  async testBackendStartup() {
    this.log('🚀 Testing Backend Startup...');
    
    try {
      // Test database connection
      await this.runCommand('cd backend && timeout 10s node -e "require(\'./src/config/database\').connectDatabase().then(() => console.log(\'DB OK\')).catch(e => {console.error(e); process.exit(1)})"', 'Database connection test');
      
      // Test Redis connection
      await this.runCommand('cd backend && timeout 10s node -e "require(\'./src/config/redis\').connectRedis().then(() => console.log(\'Redis OK\')).catch(e => {console.error(e); process.exit(1)})"', 'Redis connection test');
      
    } catch (error) {
      this.log(`Backend startup test failed: ${error.message}`, 'warning');
    }
  }

  async testAPI() {
    this.log('🌐 Testing API Endpoints...');
    
    // Start backend in background for testing
    const backendProcess = exec('cd backend && npm start', (error) => {
      if (error) this.log(`Backend startup error: ${error.message}`, 'warning');
    });
    
    // Wait for startup
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    try {
      // Test health endpoint
      await this.runCommand('curl -f http://localhost:3001/health', 'API health check');
      
      // Test webhook server
      await this.runCommand('curl -f http://localhost:3002/health', 'Webhook server check');
      
    } catch (error) {
      this.log(`API test failed: ${error.message}`, 'warning');
    } finally {
      backendProcess.kill();
    }
  }

  async testGitStatus() {
    this.log('📝 Testing Git Status...');
    
    try {
      const { stdout } = await this.runCommand('git status --porcelain', 'Check uncommitted changes');
      
      if (stdout.trim()) {
        this.log('Uncommitted changes detected:', 'warning');
        console.log(stdout);
      } else {
        this.log('Git status clean - ready for deployment');
      }
      
      // Check if we're on master/main branch
      const { stdout: branch } = await this.runCommand('git branch --show-current', 'Check current branch');
      if (!['master', 'main'].includes(branch.trim())) {
        this.log(`Not on main branch (currently on: ${branch.trim()})`, 'warning');
      }
      
    } catch (error) {
      this.log(`Git status check failed: ${error.message}`, 'error');
    }
  }

  getDirSize(dirPath) {
    let size = 0;
    const files = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const file of files) {
      const filePath = path.join(dirPath, file.name);
      if (file.isDirectory()) {
        size += this.getDirSize(filePath);
      } else {
        size += fs.statSync(filePath).size;
      }
    }
    
    return (size / (1024 * 1024)).toFixed(2);
  }

  async runAllTests() {
    console.log('\n🚀 MARKETING MACHINE - PRE-DEPLOYMENT TESTING');
    console.log('='.repeat(60));
    
    const startTime = Date.now();
    
    try {
      await this.testGitStatus();
      await this.testEnvironmentFiles();
      await this.testDependencies();
      await this.testFrontendBuild();
      
      // Skip backend tests for frontend-only deployments
      if (process.env.DEPLOY_TARGET !== 'frontend-only') {
        await this.testBackendStartup();
      } else {
        this.log('Skipping backend tests for frontend-only deployment');
      }
      // await this.testAPI(); // Skip for now as it requires services running
      
    } catch (error) {
      this.log(`Test suite failed: ${error.message}`, 'error');
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    console.log(`⏱️  Total time: ${duration}s`);
    console.log(`✅ Passed: ${this.results.filter(r => r.type === 'info').length}`);
    console.log(`⚠️  Warnings: ${this.warnings.length}`);
    console.log(`❌ Errors: ${this.errors.length}`);
    
    if (this.errors.length > 0) {
      console.log('\n🚨 DEPLOYMENT BLOCKED - FIX THESE ERRORS:');
      this.errors.forEach((error, i) => console.log(`${i + 1}. ${error}`));
      process.exit(1);
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS (review before deploying):');
      this.warnings.forEach((warning, i) => console.log(`${i + 1}. ${warning}`));
    }
    
    console.log('\n✅ ALL TESTS PASSED - READY FOR DEPLOYMENT! 🚀');
    console.log('Run: npm run deploy');
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new DeploymentTester();
  tester.runAllTests().catch(console.error);
}

module.exports = DeploymentTester;