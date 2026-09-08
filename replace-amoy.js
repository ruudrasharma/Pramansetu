const fs = require('fs');
const path = require('path');

function getFiles(dir, files = []) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    if (fullPath.includes('.git') || fullPath.includes('node_modules') || fullPath.includes('.next') || fullPath.includes('coverage') || fullPath.includes('artifacts') || fullPath.includes('cache') || fullPath.includes('typechain-types')) {
      continue;
    }
    if (fs.statSync(fullPath).isDirectory()) {
      getFiles(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

const files = getFiles('.');
let replacedFiles = 0;

for (const file of files) {
  try {
    let content = fs.readFileSync(file, 'utf8');
    // Only target files in docs, root, and task.md
    if (file.includes('CHANGELOG.md')) continue; // Skip historical changelogs
    if (!file.includes('docs/') && !file.endsWith('.md')) continue;
    
    let newContent = content.replace(/Polygon Amoy/g, 'Ethereum Sepolia')
                            .replace(/amoy/g, 'sepolia')
                            .replace(/Amoy/g, 'Sepolia')
                            .replace(/PolygonScan/g, 'Etherscan');
    if (content !== newContent) {
      fs.writeFileSync(file, newContent, 'utf8');
      console.log(`Updated ${file}`);
      replacedFiles++;
    }
  } catch (e) {
    // Ignore binary files or read errors
  }
}
console.log(`Replaced in ${replacedFiles} files.`);
