const fs = require('fs');
const path = 'C:\\Users\\Windows-500GB\\.config\\moltbook\\credentials.json';
try {
    const content = fs.readFileSync(path, 'utf16le');
    console.log(content);
} catch (e) {
    console.error(e);
}
