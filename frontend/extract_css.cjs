const fs = require('fs');
const path = require('path');

const srcDir = path.join(process.cwd(), 'src');
const indexCssPath = path.join(srcDir, 'index.css');

let css = fs.readFileSync(indexCssPath, 'utf8');

const moveCss = (component, regexStr) => {
    const cssPath = path.join(srcDir, 'components', component, component + '.css');
    let compCss = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
    
    const blocks = [];
    // More robust block extraction: matches `.class-name { ... }` or `.class-name, .other { ... }`
    const regex = new RegExp(`(^|\\n)(\\s*\\.[a-zA-Z0-9_-]*(${regexStr})[a-zA-Z0-9_.-]*[\\s\\S]*?\\})`, 'g');
    
    let match;
    while ((match = regex.exec(css)) !== null) {
        blocks.push(match[2].trim());
        // Replace with empty string (we use split/join to avoid regex replace issues with special chars)
        css = css.replace(match[2], '');
    }
    
    if (blocks.length > 0) {
        fs.writeFileSync(cssPath, compCss + '\n\n' + blocks.join('\n\n') + '\n');
    }
}

moveCss('SortableMachineCard', 'machine-card|card-header|asset-heading|machine-id|machine-time|machine-status-chip|machine-health-row|health-metric');
moveCss('FloorPlan', 'map-container|map-mode-btn|map-option-btn|map-stage|map-viewport|machine-node');
moveCss('DiagnosticOverlay', 'diagnostic-overlay|overlay-header|overlay-content|diag-card|smart-copilot');
moveCss('SmartActionCenter', 'smart-action-center|action-center-header|smart-alert-card');

fs.writeFileSync(indexCssPath, css.replace(/\n{3,}/g, '\n\n'));
console.log('CSS rules distributed.');
