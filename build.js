const fs = require('fs');
const path = require('path');

const srcDir = __dirname;
const distDir = path.join(__dirname, 'dist');

console.log('⚡ Starting Production Build for NEXUS // Quantum Cosmic Cube Engine...');

// 1. Clean and initialize dist directory
if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();
    if (isDirectory) {
        fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach(childItemName => {
            copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

// 2. Files to include in production bundle
const filesToCopy = ['index.html', 'styles.css', 'app.js', 'package.json'];
const dirsToCopy = ['public', 'components', 'lib'];

filesToCopy.forEach(file => {
    const srcPath = path.join(srcDir, file);
    const destPath = path.join(distDir, file);
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        const sizeKb = (fs.statSync(destPath).size / 1024).toFixed(2);
        console.log(`  ✓ Bundled ${file} (${sizeKb} KB)`);
    }
});

dirsToCopy.forEach(dir => {
    const srcPath = path.join(srcDir, dir);
    const destPath = path.join(distDir, dir);
    if (fs.existsSync(srcPath)) {
        copyRecursiveSync(srcPath, destPath);
        console.log(`  ✓ Bundled directory /${dir}`);
    }
});

console.log('\n✨ Production Build Completed Successfully!');
console.log(`📦 Distribution bundle is ready in: ${distDir}`);
