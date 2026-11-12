import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function optimizeOgImage() {
  const inputPath = path.join(__dirname, '../public/og-image.png');
  const outputPath = path.join(__dirname, '../public/og-image-optimized.png');
  
  console.log('Optimizing og-image.png...');
  
  const stats = fs.statSync(inputPath);
  console.log(`Original size: ${(stats.size / 1024).toFixed(2)} KB`);

  // Optimize with sharp: resize if needed and compress
  await sharp(inputPath)
    .resize(1200, 630, {
      fit: 'cover',
      position: 'center',
    })
    .png({
      quality: 85,
      compressionLevel: 9,
      effort: 10,
    })
    .toFile(outputPath);

  const newStats = fs.statSync(outputPath);
  console.log(`Optimized size: ${(newStats.size / 1024).toFixed(2)} KB`);
  
  if (newStats.size < 300 * 1024) {
    // Replace original with optimized
    fs.renameSync(outputPath, inputPath);
    console.log('✓ og-image.png optimized and replaced');
  } else {
    fs.unlinkSync(outputPath);
    console.log('⚠ Optimization did not achieve target size, keeping original');
  }
}

async function createFavicon() {
  const svgPath = path.join(__dirname, '../public/favicon.svg');
  const icoPath = path.join(__dirname, '../public/favicon.ico');
  
  console.log('\nGenerating favicon.ico from favicon.svg...');
  
  if (!fs.existsSync(svgPath)) {
    console.log('⚠ favicon.svg not found, skipping favicon.ico generation');
    return;
  }

  // Generate a 32x32 PNG from SVG, then convert to ICO format
  const pngBuffer = await sharp(svgPath)
    .resize(32, 32)
    .png()
    .toBuffer();
  
  // For a real ICO file, we'd need a proper ICO encoder
  // For now, just use the PNG buffer (browsers accept PNG as .ico)
  fs.writeFileSync(icoPath, pngBuffer);
  
  console.log('✓ favicon.ico generated');
}

async function main() {
  try {
    await optimizeOgImage();
    await createFavicon();
  } catch (error) {
    console.error('Error optimizing images:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { optimizeOgImage, createFavicon };
