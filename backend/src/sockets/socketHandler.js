const simulatorService = require('../services/simulatorService');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log(`Frontend client connected: ${socket.id}`);

    socket.on('command:shutdown', ({ machineId }) => { 
      simulatorService.toggleShutdown(machineId, true);
      io.emit('command:ack', { machineId, action: 'shutdown', status: 'executed', timestamp: new Date().toISOString() }); 
    });
    
    socket.on('command:restart', ({ machineId }) => { 
      simulatorService.toggleShutdown(machineId, false);
      io.emit('command:ack', { machineId, action: 'restart', status: 'executed', timestamp: new Date().toISOString() }); 
    });

    socket.on('engineer:add_machine', ({ type, zone }) => {
      const updatedMachines = simulatorService.addVirtualMachine(type, zone);
      io.emit('engineer:sync_virtual', updatedMachines);
    });
    
    socket.on('engineer:remove_machine', ({ id }) => {
      const updatedMachines = simulatorService.removeVirtualMachine(id);
      io.emit('engineer:sync_virtual', updatedMachines);
    });

    socket.on('engineer:reset_sim', () => {
      const updatedMachines = simulatorService.resetVirtualMachines();
      io.emit('engineer:sync_virtual', updatedMachines);
    });

    socket.on('disconnect', () => {
      console.log(`Frontend client disconnected: ${socket.id}`);
    });
  });
};