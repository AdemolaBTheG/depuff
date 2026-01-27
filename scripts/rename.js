const fs = require('fs');
const path = require('path');

const newName = process.argv[2];
const newBundleId = process.argv[3];

if (!newName) {
    console.log('Usage: node scripts/rename.js <NewProjectName> [com.bundle.id]');
    process.exit(1);
}

const slug = newName.toLowerCase().replace(/[^a-z0-9]/g, '-');
const bundleId = newBundleId || `com.${slug.replace(/-/g, '.')}.app`;

const packagePath = path.join(__dirname, '../package.json');
const appJsonPath = path.join(__dirname, '../app.json');

// 1. Update package.json
if (fs.existsSync(packagePath)) {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    pkg.name = slug;
    fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`✅ Updated package.json name to: ${slug}`);
}

// 2. Update app.json
if (fs.existsSync(appJsonPath)) {
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    appJson.expo.name = newName;
    appJson.expo.slug = slug;

    if (appJson.expo.ios) {
        appJson.expo.ios.bundleIdentifier = bundleId;
    }
    if (appJson.expo.android) {
        appJson.expo.android.package = bundleId;
    }

    fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');
    console.log(`✅ Updated app.json: name="${newName}", slug="${slug}", bundleId="${bundleId}"`);
}

console.log('\n🚀 Project renamed successfully!');
console.log('Next step: rm -rf .git && git init (if starting a fresh project)');
