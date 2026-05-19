const express = require('express');
const router = express.Router();
const simulatorService = require('../services/simulatorService');

router.post('/', (req, res) => {
  const { targetMachine, acceleration, source } = req.body;
  
  if (targetMachine && Number.isFinite(Number(acceleration))) {
    simulatorService.setSensorData({ 
      targetMachine, 
      acceleration: Number(acceleration), 
      source: source || 'unknown', 
      receivedAt: Date.now() 
    });
    res.json({ status: 'ok' });
  } else { 
    res.status(400).json({ error: 'Invalid data' }); 
  }
});

module.exports = router;