#!/usr/bin/env node
/**
 * Verify that stable seed PNG images are up-to-date
 * This script regenerates the stable seed PNGs and compares them with existing ones
 * Exits with code 1 if images differ, 0 if they match
 */
import { generateStableSeedPngs } from '../test/stable-seed-pngs.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function verifyStablePngs() {
  console.log('🔍 Verifying stable seed PNG images are up-to-date...\n');
  
  const fs = await import('fs/promises');
  const imageDir = path.join(__dirname, '..', 'test', 'map-images');
  const tempDir = path.join(__dirname, '..', 'tmp', 'verification-pngs');
  
  try {
    // Create temp directory for verification images
    await fs.mkdir(tempDir, { recursive: true });
    
    // Store original image directory path
    const originalGenerateStableSeedPngs = generateStableSeedPngs;
    
    // Temporarily redirect PNG generation to temp directory
    const { generateMap } = await import('../dist/src/map-generator/index.js');
    const { saveMapPng } = await import('../dist/src/map-generator/png-generator.js');
    
    // 10 predefined stable seeds (same as in stable-seed-pngs.js)
    const STABLE_SEEDS = [
      12345, 54321, 98765, 11111, 77777,
      42424, 13579, 24680, 31415, 27182
    ];
    
    console.log('Generating verification PNG images...\n');
    
    const mapSize = 200;
    const results = [];
    
    for (let i = 0; i < STABLE_SEEDS.length; i++) {
      const seed = STABLE_SEEDS[i];
      console.log(`Generating verification map ${i + 1}/10 (seed: ${seed})...`);
      
      // Generate map
      const map = generateMap(mapSize, mapSize, seed);
      
      // Generate verification PNGs in temp directory
      const simplePngPath = path.join(tempDir, `seed-${seed}-simple.png`);
      const elevationPngPath = path.join(tempDir, `seed-${seed}-elevation.png`);
      
      await saveMapPng(map, simplePngPath, {
        width: mapSize,
        height: mapSize,
        cellSize: 2,
        showElevation: false
      });
      
      await saveMapPng(map, elevationPngPath, {
        width: mapSize,
        height: mapSize,
        cellSize: 2,
        showElevation: true
      });
      
      results.push({
        seed,
        simplePng: `seed-${seed}-simple.png`,
        elevationPng: `seed-${seed}-elevation.png`
      });
    }
    
    console.log('\n📊 Comparing images with committed versions...\n');
    
    let allMatch = true;
    const mismatches = [];
    
    // Compare each generated PNG with the committed version
    for (const result of results) {
      for (const pngFile of [result.simplePng, result.elevationPng]) {
        const verificationPath = path.join(tempDir, pngFile);
        const committedPath = path.join(imageDir, pngFile);
        
        try {
          // Check if committed file exists
          await fs.access(committedPath);
          
          // Read both files
          const verificationBuffer = await fs.readFile(verificationPath);
          const committedBuffer = await fs.readFile(committedPath);
          
          // Compare file sizes first (quick check)
          if (verificationBuffer.length !== committedBuffer.length) {
            allMatch = false;
            mismatches.push({
              file: pngFile,
              reason: 'Different file sizes',
              verificationSize: verificationBuffer.length,
              committedSize: committedBuffer.length
            });
            console.log(`❌ ${pngFile}: Different sizes (verification: ${verificationBuffer.length} bytes, committed: ${committedBuffer.length} bytes)`);
            continue;
          }
          
          // Compare file contents
          if (!verificationBuffer.equals(committedBuffer)) {
            allMatch = false;
            mismatches.push({
              file: pngFile,
              reason: 'Different content'
            });
            console.log(`❌ ${pngFile}: Content differs`);
          } else {
            console.log(`✅ ${pngFile}: Matches committed version`);
          }
        } catch (error) {
          allMatch = false;
          mismatches.push({
            file: pngFile,
            reason: `Missing committed file: ${error.message}`
          });
          console.log(`❌ ${pngFile}: Missing in committed files`);
        }
      }
    }
    
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
    
    console.log('\n=== Verification Results ===\n');
    
    if (allMatch) {
      console.log('✅ All stable seed PNG images match their committed versions');
      console.log('📸 Images are up-to-date with current world generation algorithm');
      return { success: true, mismatches: [] };
    } else {
      console.log('❌ Some stable seed PNG images differ from committed versions');
      console.log(`📊 ${mismatches.length} file(s) have mismatches:`);
      
      for (const mismatch of mismatches) {
        console.log(`   • ${mismatch.file}: ${mismatch.reason}`);
      }
      
      console.log('\n💡 To fix this issue:');
      console.log('   1. Run: npm run test:generate-pngs');
      console.log('   2. Commit the updated PNG files');
      console.log('   3. Push the changes');
      
      return { success: false, mismatches };
    }
    
  } catch (error) {
    console.error('❌ Error during PNG verification:', error.message);
    
    // Clean up temp directory even on error
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error('Warning: Failed to clean up temp directory:', cleanupError.message);
    }
    
    return { success: false, error: error.message };
  }
}

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyStablePngs()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error.message);
      process.exit(1);
    });
}

export { verifyStablePngs };