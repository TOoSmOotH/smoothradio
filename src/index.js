const path = require('path');
const { scanDirectory } = require('./scanner');

async function main() {
  const targetDir = process.argv[2];

  if (!targetDir) {
    console.error('Usage: node src/index.js <path-to-music-directory>');
    process.exit(1);
  }

  const resolved = path.resolve(targetDir);
  console.log(`Scanning: ${resolved}`);

  const tracks = await scanDirectory(resolved, {
    onError: (filePath, err) => {
      console.error(`[warn] Failed to read ${filePath}: ${err.message}`);
    },
  });

  console.log(`Found ${tracks.length} MP3 file(s).`);
  console.log(JSON.stringify(tracks, null, 2));
}

main().catch((err) => {
  console.error(`Scan failed: ${err.message}`);
  process.exit(1);
});
