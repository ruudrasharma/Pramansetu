const fs = require('fs');
const path = require('path');

const walkSync = (dir, callback) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filepath = path.join(dir, file);
    const stats = fs.statSync(filepath);
    if (stats.isDirectory()) {
      if (['node_modules', '.git', '.next', 'dist', 'build', 'coverage'].includes(file)) continue;
      walkSync(filepath, callback);
    } else if (stats.isFile()) {
      if (/\.(png|jpe?g|gif|ico|svg|woff2?|ttf|eot|mp4|webm|pdf)$/i.test(file)) continue;
      // Skip the script itself
      if (file === 'rebrand.js') continue;
      callback(filepath);
    }
  }
};

const replacements = [
  // GitHub URLs
  { from: /ruudrasharma\/Cipherloom/g, to: 'ruudrasharma/Pramansetu' },
  { from: /ruudrasharma\/cipherloom/g, to: 'ruudrasharma/Pramansetu' },
  
  // Specific Ambiguous Answers
  { from: /BEL Blockchain-Based Secure Platform/g, to: 'Praman Setu Blockchain-Based Secure Platform' },
  { from: /BEL SecureChain/g, to: 'Praman Setu' },
  { from: /--brand-bel/g, to: '--brand-praman-setu' },

  { from: /BEL Chain/g, to: 'Praman Setu' },
  { from: /BEL CHAIN/g, to: 'PRAMAN SETU' },
  { from: /bel chain/g, to: 'praman setu' },

  { from: /BEL-Chain/g, to: 'Praman Setu' }, 

  { from: /bel-chain/g, to: 'praman-setu' }, 
  { from: /bel_chain/g, to: 'praman_setu' }, 
  { from: /BEL_CHAIN/g, to: 'PRAMAN_SETU' }, 
  { from: /BELChain/g, to: 'PramanSetu' }, 
  { from: /belChain/g, to: 'pramanSetu' }, 
  { from: /BELCHAIN/g, to: 'PRAMAN_SETU' }, 

  { from: /CIPHERLOOM/g, to: 'PRAMAN_SETU' }, 
  { from: /cipher-loom/g, to: 'praman-setu' },
  { from: /cipher_loom/g, to: 'praman_setu' },
  
  { 
    from: /CipherLoom|Cipherloom|cipherloom/g, 
    to: (match, offset, string) => {
      if (match === 'cipherloom') return 'praman-setu';
      if (match === 'CipherLoom') return 'PramanSetu';
      
      const prevChar = string[offset - 1] || ' ';
      const nextChar = string[offset + match.length] || ' ';
      
      const isNextLetter = /[a-zA-Z]/.test(nextChar);
      const isPrevLetter = /[a-zA-Z]/.test(prevChar);
      
      if (isNextLetter || isPrevLetter) {
         if (/[a-z]/.test(prevChar)) return 'pramanSetu';
         return 'PramanSetu';
      }
      return 'Praman Setu';
    }
  }
];

let changedFiles = 0;

walkSync(__dirname, (filepath) => {
  let content;
  try {
    content = fs.readFileSync(filepath, 'utf8');
  } catch(e) {
    return; // binary file or unreadable
  }
  
  let newContent = content;
  for (const {from, to} of replacements) {
    if (typeof to === 'function') {
      newContent = newContent.replace(from, to);
    } else {
      newContent = newContent.replace(from, to);
    }
  }
  
  if (content !== newContent) {
    fs.writeFileSync(filepath, newContent, 'utf8');
    changedFiles++;
    console.log(`Updated: ${filepath}`);
  }
});

console.log(`Rebrand complete. Files updated: ${changedFiles}`);
