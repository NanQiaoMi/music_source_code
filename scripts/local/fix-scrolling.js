const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/**/*.{tsx,jsx}', { nodir: true });
let changedFiles = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  if (content.includes('overflow-y-auto')) {
    let updated = content;
    
    // Use regex to find className strings containing overflow-y-auto but NOT min-h-0
    const regex = /(className=["'][^"']*overflow-y-auto[^"']*?)(["'])/g;
    
    updated = updated.replace(regex, (match, classNames, quote) => {
      if (classNames.includes('min-h-0')) {
        return match;
      }
      return classNames + ' min-h-0' + quote;
    });

    if (updated !== content) {
      fs.writeFileSync(file, updated);
      changedFiles++;
      console.log('Fixed:', file);
    }
  }
}

console.log('Total files fixed:', changedFiles);
