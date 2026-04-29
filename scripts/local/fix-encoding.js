const fs = require('fs');
const path = require('path');
function fix(dir) {
    fs.readdirSync(dir).forEach(file => {
        const full = path.join(dir, file);
        if (fs.statSync(full).isDirectory()) fix(full);
        else if (full.endsWith('.ts') || full.endsWith('.tsx')) {
            const buf = fs.readFileSync(full);
            let content = '';
            if (buf[0] === 0xff && buf[1] === 0xfe) { // UTF-16LE
                content = buf.toString('utf16le');
            } else if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) { // UTF-8 BOM
                content = buf.toString('utf8').substring(1);
            } else {
                content = buf.toString('utf8');
            }
            fs.writeFileSync(full, content, 'utf8');
        }
    });
}
fix('src');
