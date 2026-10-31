// scripts/optimize_assets.js
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function processDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const files = fs.readdirSync(dirPath);
  let saved = 0;
  for (const f of files) {
    if (!f.endsWith('.png') && !f.endsWith('.jpg') && !f.endsWith('.jpeg')) continue;
    const full = path.join(dirPath, f);
    try {
      const input = fs.readFileSync(full);
      if (input.length > 150 * 1024) { // larger than 150KB
        const ext = path.extname(f).toLowerCase();
        let pipeline = sharp(input).resize({ width: 480, withoutEnlargement: true });
        if (ext === '.jpg' || ext === '.jpeg') {
          pipeline = pipeline.jpeg({ quality: 80 });
        } else {
          pipeline = pipeline.png({ quality: 80, compressionLevel: 8 });
        }
        const out = await pipeline.toBuffer();
        if (out.length < input.length) {
          fs.writeFileSync(full, out);
          saved += (input.length - out.length);
          console.log(`[OPT] ${f}: ${(input.length/1024/1024).toFixed(1)}MB -> ${(out.length/1024).toFixed(0)}KB`);
        }
      }
    } catch (e) {
      console.warn(`[OPT] Skip ${f}: ${e.message}`);
    }
  }
  console.log(`Finished ${dirPath}. Total saved: ${(saved/1024/1024).toFixed(2)} MB`);
}

(async () => {
  await processDirectory('assets/cards');
  await processDirectory('assets/icons');
  console.log('ALL ASSETS OPTIMIZED FOR HIGH-SPEED WEB LOADING!');
})();
