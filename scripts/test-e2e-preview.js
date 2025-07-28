#!/usr/bin/env node

/**
 * Deploy to Netlify preview and run E2E tests against the deployed environment
 * 
 * This script:
 * 1. Builds the project
 * 2. Deploys to Netlify as a preview environment
 * 3. Parses the deploy URL from Netlify CLI output
 * 4. Runs Playwright tests against that URL
 * 5. Optionally cleans up the deployment
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';

/**
 * Execute a command and return output
 */
function execCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n▶ Running: ${command} ${args.join(' ')}`);
    
    const child = spawn(command, args, {
      stdio: 'pipe',
      ...options
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      // Stream output in real-time for better feedback
      if (options.streamOutput) {
        process.stdout.write(output);
      }
    });

    child.stderr?.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      if (options.streamOutput) {
        process.stderr.write(output);
      }
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr || stdout}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Extract deploy URL from Netlify CLI output
 */
function extractDeployUrl(output) {
  // Look for patterns like:
  // "Website Draft URL: https://..."
  // "Draft URL: https://..."
  // "Deploy URL: https://..."
  const urlPatterns = [
    /Website Draft URL:\s*(https?:\/\/[^\s\n]+)/i,
    /Draft URL:\s*(https?:\/\/[^\s\n]+)/i,
    /Deploy URL:\s*(https?:\/\/[^\s\n]+)/i,
    /Live Draft URL:\s*(https?:\/\/[^\s\n]+)/i,
    /(https:\/\/[a-f0-9]+-[a-f0-9]+-[a-z0-9]+\.netlify\.app)/i
  ];

  for (const pattern of urlPatterns) {
    const match = output.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // If no pattern matches, try to find any netlify.app URL
  const netlifyUrls = output.match(/(https:\/\/[^\s]*\.netlify\.app[^\s]*)/gi);
  if (netlifyUrls && netlifyUrls.length > 0) {
    return netlifyUrls[0].trim();
  }

  return null;
}

/**
 * Wait for deployment to be ready
 */
async function waitForDeployment(url, maxAttempts = 30, delayMs = 5000) {
  console.log(`\n🔍 Waiting for deployment to be ready at: ${url}`);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log(`✅ Deployment is ready! (attempt ${attempt})`);
        return true;
      }
      console.log(`⏳ Attempt ${attempt}/${maxAttempts}: Status ${response.status}`);
    } catch (error) {
      console.log(`⏳ Attempt ${attempt}/${maxAttempts}: ${error.message}`);
    }
    
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw new Error(`Deployment not ready after ${maxAttempts} attempts`);
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🚀 Starting Netlify E2E Test Pipeline\n');

    // Check prerequisites
    if (!existsSync('netlify.toml')) {
      throw new Error('netlify.toml not found. Make sure you\'re in the project root.');
    }

    // Build the project
    console.log('🔨 Building project...');
    await execCommand('npm', ['run', 'build'], { streamOutput: true });
    console.log('✅ Build completed successfully');

    // Deploy to Netlify
    console.log('\n🌐 Deploying to Netlify preview...');
    const deployResult = await execCommand('npx', ['netlify', 'deploy', '--build', '--json'], {
      streamOutput: false
    });

    let deployUrl;
    try {
      // Try to parse as JSON first
      const deployData = JSON.parse(deployResult.stdout);
      deployUrl = deployData.deploy_url || deployData.url;
    } catch (parseError) {
      // Fallback to text parsing
      deployUrl = extractDeployUrl(deployResult.stdout);
    }

    if (!deployUrl) {
      console.error('Deploy output:', deployResult.stdout);
      throw new Error('Could not extract deploy URL from Netlify CLI output');
    }

    console.log(`✅ Deployed successfully to: ${deployUrl}`);

    // Wait for deployment to be ready
    await waitForDeployment(deployUrl);

    // Run Playwright tests against the deployed URL
    console.log('\n🎭 Running Playwright tests against deployed environment...');
    
    const env = {
      ...process.env,
      BASE_URL: deployUrl,
      SKIP_LOCAL_SERVER: 'true'
    };

    await execCommand('npx', ['playwright', 'test'], { 
      streamOutput: true,
      env
    });

    console.log('✅ All tests passed successfully!');
    console.log(`\n🎉 E2E testing completed for: ${deployUrl}`);

  } catch (error) {
    console.error('\n❌ E2E test pipeline failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main, extractDeployUrl, waitForDeployment };