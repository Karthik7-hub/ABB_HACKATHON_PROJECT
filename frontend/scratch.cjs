const fs = require('fs');
const p = 'src/components/DiagnosticOverlay/DiagnosticOverlay.jsx';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
    '{copilotNarrative && (',
    '{machine.copilot && machine.copilot.smart_alarm && ('
).replace(
    '<strong>🚨 Problem:</strong> {copilotNarrative.problem}</p>',
    '<strong>🚨 Smart Alarm:</strong> {machine.copilot.smart_alarm}</p>'
);

c = c.replace(
    '{copilotNarrative ? (',
    '{machine.copilot ? ('
).replace(
    "<h3 style={{ fontSize: '18px', color: '#f8fafc', margin: '0 0 16px 0', lineHeight: 1.3 }}>{copilotNarrative.headline}</h3>",
    ""
).replace(
    "<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>",
    "<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}><div style={{ color: '#cbd5e1', fontSize: '14px', margin: 0, lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: machine.copilot.narrative.replace(/\\n/g, '<br/>').replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>').replace(/### (.*?)/, '<h3 style=\"font-size: 18px; color: #f8fafc; margin: 0 0 16px 0; line-height: 1.3\">$1</h3>') }} />"
).replace(
    "<p style={{ color: '#f59e0b', fontSize: '14px', margin: 0, lineHeight: 1.5 }}><strong>🔍 Reason:</strong> {copilotNarrative.reason}</p>",
    ""
).replace(
    "<p style={{ color: '#10b981', fontSize: '14px', margin: 0, lineHeight: 1.5 }}><strong>🛠️ Suggested Fix:</strong> {copilotNarrative.fix}</p>",
    ""
);

fs.writeFileSync(p, c);
console.log('Replaced successfully');
