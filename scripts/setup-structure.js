import fs from 'fs';
import path from 'path';

// Files and directories that belong in src/
const srcItems = [
  'App.tsx',
  'index.tsx',
  'types.ts',
  'vite-env.d.ts',
  'components',
  'views',
  'services',
  'utils',
  'styles' // in case you have it
];

const srcDir = path.resolve('src');

// Ensure src directory exists
if (!fs.existsSync(srcDir)) {
  console.log('📁 Creating src directory...');
  fs.mkdirSync(srcDir);
}

console.log('🧹 Organizing project structure...');

let movedCount = 0;

srcItems.forEach(item => {
  const sourcePath = path.resolve(item);
  const destPath = path.join(srcDir, item);

  if (fs.existsSync(sourcePath)) {
    // If destination already exists, we might need to merge or skip. 
    // For simplicity here, if dest exists, we assume it's already moved or handled manually to avoid overwriting.
    if (!fs.existsSync(destPath)) {
      try {
        fs.renameSync(sourcePath, destPath);
        console.log(`✅ Moved ${item} to src/`);
        movedCount++;
      } catch (err) {
        console.error(`❌ Failed to move ${item}:`, err.message);
      }
    } else {
      // If it exists in both places, maybe user copied it. 
      // We can optionally delete the root one to clean up, but safety first: leave it for now or warn.
      // console.log(`ℹ️  ${item} already exists in src/.`);
    }
  }
});

if (movedCount > 0) {
  console.log(`🎉 Moved ${movedCount} items to src/. Structure is clean.`);
} else {
  console.log('✨ Structure already looks good.');
}