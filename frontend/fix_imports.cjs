const fs = require('fs');
const path = require('path');

const srcDir = path.join(process.cwd(), 'src');
const componentsDir = path.join(srcDir, 'components');
const appJsxPath = path.join(srcDir, 'App.jsx');

// Update App.jsx imports
let appJsx = fs.readFileSync(appJsxPath, 'utf8');
appJsx = appJsx.replace(/\.\/components\/([A-Za-z0-9_]+)/g, './components/$1/$1');
fs.writeFileSync(appJsxPath, appJsx);

// Process each component
const components = fs.readdirSync(componentsDir).filter(f => fs.statSync(path.join(componentsDir, f)).isDirectory());

components.forEach(comp => {
    const jsxPath = path.join(componentsDir, comp, comp + '.jsx');
    if (fs.existsSync(jsxPath)) {
        let content = fs.readFileSync(jsxPath, 'utf8');
        
        // Add CSS import if not present
        if (!content.includes(`import './${comp}.css'`)) {
            // Find last import
            const importMatches = [...content.matchAll(/^import .* from '.*';$/gm)];
            if (importMatches.length > 0) {
                const lastImport = importMatches[importMatches.length - 1];
                const insertPos = lastImport.index + lastImport[0].length;
                content = content.slice(0, insertPos) + `\nimport './${comp}.css';` + content.slice(insertPos);
            } else {
                content = `import './${comp}.css';\n` + content;
            }
        }
        
        // Fix relative imports to other components and utils
        content = content.replace(/from '\.\.\/utils/g, "from '../../utils");
        content = content.replace(/from '\.\/([A-Za-z0-9_]+)'/g, "from '../$1/$1'");
        
        fs.writeFileSync(jsxPath, content);
    }
});
console.log('Imports fixed.');
