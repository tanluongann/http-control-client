const ps = require('child_process');
const io = require('socket.io-client');
const nconf = require('nconf');

var socket = null;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Necessary fo self signed HTTPS
nconf.file({ file: "config.json" });

if(nconf.get('id') === 'default') {
  nconf.set('id', (new Date%9e6).toString(36) + (0|Math.random()*9e6).toString(36));
  nconf.save();
}

// Establich the connection to the server
var connect = function() {

  var url = nconf.get('server');
  var ts = (new Date()).toISOString();
  console.log('['+ts+'] Connecting to ' + url + '');
  socket = io(url, {
    "secure": true,
    "timeout": 50000,
    "reconnection": true,
    "reconnectionAttempts": Infinity,    
    "reconnectionDelayMax": 60000,
  }); // Communication socket

  socket.removeAllListeners('action');
  socket.removeAllListeners('message');
  socket.removeAllListeners('disconnect');
  socket.removeAllListeners('reconnect_failed');
  socket.removeAllListeners('error');
  socket.removeAllListeners('connect_error');
  socket.removeAllListeners('connect_timeout');
  socket.removeAllListeners('reconnect_attempt');
  socket.removeAllListeners('reconnect');
  socket.removeAllListeners('connect');
  socket.removeAllListeners('authenticated');

  // When the server sends an action to be executed
  socket.on('action', function (action) {
    var ts = (new Date()).toISOString();
    switch (action.type) {
      case 'sendstatus':
        console.log("["+ts+"] Status requested");
        sendStatus(socket);
        break;
      case 'execute':
        console.log("["+ts+"] Command execution requested");
        executeCommand(socket, action.command);
        break;
      case 'setup':
        console.log("["+ts+"] Box setup requested");
        setUpNewBox(socket, action.info);
        break;
    }
  });

  // When the server sends aa message to be displayed (debug mainly)
  socket.on('message', function (message) {
    var ts = (new Date()).toISOString();
    console.log("["+ts+"] Message: " + message);
  });

  // When the socket gets disconnected from the server (debug mainly)
  socket.on('disconnect', function () {
    var id = nconf.get('id');
    var ts = (new Date()).toISOString();
    console.log('['+ts+'] Disconnected (' + id + ')');
  });

  // When the socket fails to reconnect to the server (debug mainly)
  socket.on('reconnect_failed', function() {
    var ts = (new Date()).toISOString();
    console.log('['+ts+'] Giving up reconnection');
  });

  // When something wrong happens during the exchange (debug mainly)
  socket.on('error', function(error) {
    var ts = (new Date()).toISOString();
    console.log('['+ts+'] Unknown Error (' + error + ')');
  });

  // When something wrong happens during the exchange (debug mainly)
  socket.on('connect_error', function(error) {
    var ts = (new Date()).toISOString();
    console.log('['+ts+'] (Re)Connection error (' + error + ')');
  });

  // When something wrong happens during the exchange (debug mainly)
  socket.on('connect_timeout', function() {
    var ts = (new Date()).toISOString();
    console.log('['+ts+'] Connection timeout');
  });

  // When something wrong happens during the exchange (debug mainly)
  socket.on('reconnect_attempt', function() {
    var ts = (new Date()).toISOString();
    console.log('['+ts+'] Reconnecting to ' + url + '');
  });

  // When something wrong happens during the exchange (debug mainly)
  socket.on('reconnect', function() {
    var ts = (new Date()).toISOString();
    console.log('['+ts+'] Reconnection hanshake OK');
  });

  socket.on('authenticated', function(data) {
    var id = nconf.get('id');
    var ts = (new Date()).toISOString();
    console.log('['+ts+'] Connected as client (' + id + ')');
    console.log('['+ts+'] Auth response data', data);
    console.log('['+ts+'] Waiting for commands...');
    sendStatus(socket);
  });

  // When the socket connects to the server
  socket.on('connect', function() {
    var id = nconf.get('id');
    var ts = (new Date()).toISOString();
    console.log('['+ts+'] Connection hanshake OK');
    console.log('['+ts+'] Authenticating (' + id + ')');
    socket.emit('authentication', { username: nconf.get('id'), password: nconf.get('pw') });
  });


};

// Send local device status to the server
var sendStatus = function(socket) {
  var res = {
    id: nconf.get('id'),
    connected: true,
    version: nconf.get('version'),
    intact: nconf.get('intact'),
  };
  var res_s = JSON.stringify(res);
  socket.emit('status', res);
  var ts = (new Date()).toISOString();
  console.log("["+ts+"] Sending status");
};

// Execute a specified command on the local device
var executeCommand = function(socket, cmd) {
  var timeout = cmd.timeout ? cmd.timeout : 3 * 60 * 1000; // Default timeout 3 min in never-ending command 
  var ts = (new Date()).toISOString();
  console.log("["+ts+"] Executing command #" + cmd.id + " " + cmd.payload + " (TIMEOUT: " + timeout + ")");
  var ts = ((new Date())).getTime() / 1000;
  ps.exec(cmd.payload, { timeout: timeout }, function(error, stdout, stderr) {
    var ts2 = ((new Date())).getTime() / 1000;
    var dtt = ts2 - ts; // Calculate the execution time
    var status = !error ? "success" : 'error'; // Generate the status flag
    console.log("["+ts+"] Responding to command #" + cmd.id + " " + cmd.payload);
    var res = {
      type: 'command',
      id: cmd.id,
      payload: cmd.payload,
      status: status,
      timestamp: ts,
      executiontime: dtt,
      stdout: stdout,
      error: error,
      stderr: stderr,
    };
    socket.emit('command', res);
  });
  var res = {
    type: 'command',
    id: cmd.id,
    payload: cmd.payload,
    status: "pending",
    timestamp: ts,
  };
  socket.emit('command', res);
};

// Setup the box for the first time
var setUpNewBox = function(socket, info) {
  // TODO: Get id, login, password from the server
  for (var k in info) {
    var ts = (new Date()).toISOString();
    console.log('['+ts+'] Updating ' + k + ' to ' + info[k]);
    nconf.set(k, info[k]);
  }
  nconf.save();
  sendStatus(socket);
};

connect()

