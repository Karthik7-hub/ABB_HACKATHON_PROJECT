const mongoose = require('mongoose');

const WorkspaceSettingsSchema = new mongoose.Schema({
    id: { type: String, default: 'default', unique: true },
    backgroundUrl: { type: String, default: '' },
    backgroundName: { type: String, default: '' },
    gridVisible: { type: Boolean, default: true },
    layoutLocked: { type: Boolean, default: false },
    zonesLocked: { type: Boolean, default: false },
    zoom: { type: Number, default: 1 },
    panX: { type: Number, default: 0 },
    panY: { type: Number, default: 0 },
    zones: { type: Object, default: {} },
    connections: { type: Object, default: {} },
    showZones: { type: Boolean, default: true },
    showFlow: { type: Boolean, default: true },
    showRisk: { type: Boolean, default: true },
    lastSavedTimestamp: { type: String, default: '' }
});

module.exports = mongoose.model('WorkspaceSettings', WorkspaceSettingsSchema);
