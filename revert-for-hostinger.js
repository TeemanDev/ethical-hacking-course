const fs = require('fs');

// 1. Fix server.js
let serverContent = fs.readFileSync('server.js', 'utf8');
serverContent = serverContent.replace(/app\.listen\(PORT, '0\.0\.0\.0',/g, 'app.listen(PORT,');
fs.writeFileSync('server.js', serverContent);
console.log('✅ Fixed server.js');

// 2. Delete zeabur.json
if (fs.existsSync('zeabur.json')) {
    fs.unlinkSync('zeabur.json');
    console.log('✅ Deleted zeabur.json');
}

// 3. Fix API URLs in HTML files
const files = ['course.html', 'login.html', 'dashboard.html', 'admin.html'];
files.forEach(file => {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');
        // Replace any Zeabur URL with relative path
        content = content.replace(/const API_URL = 'https:\/\/[^']+';/g, "const API_URL = '/api';");
        fs.writeFileSync(file, content);
        console.log(`✅ Fixed ${file}`);
    }
});

console.log('🎉 All files reverted for Hostinger! Run: git add . && git commit -m "Revert for Hostinger" && git push');