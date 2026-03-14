#!/usr/bin/env node
/**
 * Verify that stable seed PNG images are up-to-date.
 * Regenerates the stable seed PNGs to a temp directory and compares them
 * with the committed versions. Exits with code 1 if images differ.
 */
import { generateStableSeedPngs } from '../test/stable-seed-pngs.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function verifyStablePngs() {
  console.log('Verifying stable seed PNG images are up-to-date...\n');

  const imageDir = path.join(__dirname, '..', 'test', 'map-images');
  const tempDir = path.join(__dirname, '..', 'tmp', 'verification-pngs');

  try {
    await fs.mkdir(tempDir, { recursive: true });

    // Regenerate to temp directory
    await generateStableSeedPngs(tempDir);

    console.log('\nComparing images with committed versions...\n');

    const tempFiles = await fs.readdir(tempDir);
    const pngFiles = tempFiles.filter(f => f.endsWith('.png'));

    let allMatch = true;
    const mismatches = [];

    for (const pngFile of pngFiles) {
      const verificationPath = path.join(tempDir, pngFile);
      const committedPath = path.join(imageDir, pngFile);

      try {
        await fs.access(committedPath);

        const verificationBuffer = await fs.readFile(verificationPath);
        const committedBuffer = await fs.readFile(committedPath);

        if (verificationBuffer.length !== committedBuffer.length || !verificationBuffer.equals(committedBuffer)) {
          allMatch = false;
          mismatches.push(pngFile);
          console.log(`FAIL ${pngFile}: content differs`);
        } else {
          console.log(`OK   ${pngFile}`);
        }
      } catch {
        allMatch = false;
        mismatches.push(pngFile);
        console.log(`FAIL ${pngFile}: missing from committed files`);
      }
    }

    await fs.rm(tempDir, { recursive: true, force: true });

    console.log('\n=== Verification Results ===\n');

    if (allMatch) {
      console.log('All stable seed PNG images match committed versions.');
      return true;
    } else {
      console.log(`${mismatches.length} file(s) do not match committed versions:`);
      mismatches.forEach(f => console.log(`  - ${f}`));
      console.log('\nTo fix: run npm run test:generate-pngs, then commit the updated images.');
      return false;
    }
  } catch (error) {
    console.error('Error during PNG verification:', error.message);
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
    return false;
  }
}

verifyStablePngs().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
