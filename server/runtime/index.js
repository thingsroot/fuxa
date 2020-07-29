
/**
 * 'runtime': Manager the communication with frontend (socket.io)
 */

var Promise = require('bluebird');
var devices = require("./devices");
var project = require("./project");
var users = require("./users");
var events = require("./events");
var WebSocket = require('ws')
var prjstore = require('./project/prjstorage')
const daqstorage = require('./storage/daqstorage');

var apiDevice;
var settings
var logger;
var io;
let name = [];
let obj = {};
function init(_io, _api, _settings, log) {
    io = _io;
    settings = _settings;
    logger = log;
    if (_api) {
        apiDevice = _api;
    }

    if (!daqstorage.init(settings, logger)) {
        logger.error("daqstorage.failed-to-init");
    }

    users.init(settings, logger).then(result => {
        logger.info("runtime init users successful!");
    }).catch(function (err) {
        logger.error("runtime.failed-to-init users");
    });

    project.init(settings, logger).then(result => {
        logger.info("runtime init project successful!");
    }).catch(function (err) {
        logger.error("runtime.failed-to-init project");
    });
    devices.init(runtime);

    events.on("project-device:change", updateDevice);
    events.on("device-value:changed", updateDeviceValues);      // event from devices (S7/OPCUA/...)
    events.on("device-status:changed", updateDeviceStatus);     // event from devices (S7/OPCUA/...)

    io.on('connection', (socket) => {
        logger.info('io client connected');
        setTimeout(() => {
            const devices = project.getDevices();
            const keys = Object.keys(devices);
            if (keys.length <= 0 ) {
                return false;
            }
            name = [];
            keys.map(item=>{
                if (devices[item].type === 'OPCUA') {
                    // name = devices[item].name
                    name.push(devices[item].name)
                }
            })
            if (name && name.length > 0) {
                name.map(item=>{
                    prjstore.getSection('devicesSecurity', item).then(results=>{
                        if (results.length > 0) {
                            if (results[0].value === 'null') {
                                return false;
                            }
                            const accesskey = JSON.parse(results[0].value).accesskey;
                            const sn = JSON.parse(results[0].value).sn;
                            const ws = new WebSocket('ws://cloud.thingsroot.com:17654')
                                ws.onopen = function (evt) {
                                    // console.log("Connection open ...");
                                    ws.send(JSON.stringify({
                                        id: 1,
                                        code: 'login',
                                        data: accesskey
                                    }));
                                };
                                
                                ws.onmessage =  (event) => {
                                    const data = JSON.parse(event.data)
                                    if (data.code === 'login') {
                                        ws.send(JSON.stringify({
                                            id: 2,
                                            code: 'device_data',
                                            data: sn
                                        }))
                                    }
                                    if (data.code === 'device_data') {
                                        const datas = data.data;
                                        const dataKey = Object.keys(datas);
                                        if (dataKey.length > 0) {
                                            obj[item] = [];
                                            dataKey.map(items => {
                                                obj[item].push({
                                                        name: items,
                                                        id: items,
                                                        address: items,
                                                        type: 'Double',
                                                        value: datas[items]['PV']
                                                    })
                                            })
                                        }
                                        setTimeout(() => {
                                            ws.send(JSON.stringify({
                                                id: 2,
                                                code: 'device_data',
                                                data: sn
                                            }))
                                        }, 3000);
                                    }
                                }
                            }
                    })
                })
            }
            
        }, 1000);
        
        // client ask device status
        socket.on('device-status', (message) => {
            if (message === 'get') {
                var adevs = devices.getDevicesStatus();
                for (var id in adevs) {
                    updateDeviceStatus({ id: id, status: adevs[id] });
                }
            } else {
                updateDeviceStatus(message);
            }
        });
        // client ask device property
        socket.on('device-property', (message) => {
            try {
                if (message && message.endpoint && message.type) {
                    devices.getSupportedProperty(message.endpoint, message.type).then(result => {
                        message.result = result;
                        io.emit("device-property", message);
                    }).catch(function (err) {
                        logger.error('socket.on.device-property: ' + err);
                        message.error = err;
                        io.emit("device-property", message);
                    });
                } else {
                    logger.error('socket.on.device-property: wrong message');
                    message.error = 'wrong message';
                    io.emit("device-property", message);
                }
            } catch (err) {
                logger.error('socket.on.device-values: ' + err);
            }
        });        
        // client ask device values
        socket.on('device-values', (message) => {
            try {
                if (message === 'get') {
                    var adevs = devices.getDevicesValues();
                    for (var id in adevs) {
                        updateDeviceValues({ id: id, values: adevs[id] });
                    }
                } else if (message.cmd === 'set' && message.var) {
                    devices.setDeviceValue(message.var.source, message.var.name, message.var.value)
                }
            } catch (err) {
                logger.error('socket.on.device-values: ' + err);
            }
        });
        // client ask device browse
        socket.on('device-browse', (message) => {
            try {
                if (message) {
                    if (message.device) {
                        devices.browseDevice(message.device, message.node).then(result => {
                            message.result = result;
                            io.emit("device-browse", message);
                        }).catch(function (err) {
                            logger.error('socket.on.device-browse: ' + err);
                            message.error = err;
                            io.emit("device-browse", message);
                        });
                    }
                }
            } catch (err) {
                logger.error('socket.on.device-values: ' + err);
            }
        });
        // client ask device node attribute
        socket.on('device-node-attribute', (message) => {
            try {
                if (message) {
                    if (message.device) {
                        devices.readNodeAttribute(message.device, message.node).then(result => {
                            // message.result = result;
                            io.emit("device-node-attribute", message);
                        }).catch(function (err) {
                            logger.error('socket.on.read-node-attribute: ' + err);
                            message.error = err;
                            io.emit("device-node-attribute", message);
                        });
                    }
                }
            } catch (err) {
                logger.error('socket.on.device-node-attribute: ' + err);
            }
        });
        // client query DAQ values
        socket.on('daq-query', (msg) => {
            try {
                if (msg && msg.from && msg.to && msg.sids && msg.sids.length) {
                    console.log('>' + new Date(msg.from).toString() + ' ' + new Date(msg.to).toString());
                    var dbfncs = [];
                    for (let i = 0; i < msg.sids.length; i++) {
                        let tks = msg.sids[i].split('^~^');
                        dbfncs.push(daqstorage.getNodeValues(tks[0], tks[1], msg.from, msg.to));
                    }
                    var result = {};
                    Promise.all(dbfncs).then(values => {
                        for (var x = 0; x < values.length; x++) {
                            for (var y = 0; y < values[x].length; y++) {
                                if (!result[values[x][y].dt]) {
                                    result[values[x][y].dt] = Array(msg.sids.length + 1).fill(null);
                                    result[values[x][y].dt][0] = values[x][y].dt;
                                } 
                                result[values[x][y].dt][x + 1] = (values[x][y].value) ? parseFloat(values[x][y].value) : null;
                            }
                        }
                        let res = []
                        Object.keys(result).sort().forEach(k => {
                            res.push(result[k]);
                        });
                        io.emit('daq-result', {gid: msg.gid, values: res });
                    }, reason => {
                        if (reason && reason.stack) {
                            logger.error('socket.on.daq-query: ' + reason.stack);
                        } else {
                            logger.error('socket.on.daq-query: ' + reason);
                        }
                        io.emit('daq-error', { gid: msg.gid, error: reason });
                    });
                }
            } catch (err) {
                logger.error('socket.on.daq-query: ' + err);
            }
        });
    });
}

function start() {
    return new Promise(function (resolve, reject) {
        // load project
        project.load().then(result => {
            // start to comunicate with devices
            devices.start().then(function () {
                // devices.woking = null;
                resolve(true);
            }).catch(function (err) {
                logger.error('runtime.failed-to-start: ' + err);
                reject();
            });
        }).catch(function (err) {
            logger.error('runtime.failed-to-start: ' + err);
            reject();
        });
    });
}

function stop() {
    return new Promise(function (resolve, reject) {
        devices.stop().then(function () {

        }).catch(function (err) {
            logger.error('runtime.failed-to-stop: ' + err);
        });
        resolve(true);
    });
}

function update(cmd, data) {
    return new Promise(function (resolve, reject) {
        try {
            if (cmd === project.ProjectDataCmdType.SetDevice) {
                devices.updateDevice(data);
            }
            resolve(true);
        } catch (err) {
            if (err.stack) {
                logger.error(err.stack);
            } else {
                logger.error(err);
            }
            reject();
        }
    });
}

function restart() {
    return new Promise(function (resolve, reject) {
        try {
            stop().then(function () {
                logger.info('runtime.update-project: stopped!');
                start().then(function () {
                    logger.info('runtime.update-project: start!');
                    resolve(true);
                }).catch(function (err) {
                    logger.error('runtime.update-project-start: ' + err);
                    reject();
                });                
            }).catch(function (err) {
                logger.error('runtime.update-project-stop: ' + err);
                reject();
            });
        } catch (err) {
            if (err.stack) {
                logger.error(err.stack);
            } else {
                logger.error(err);
            }
            reject();
        }
    });
}


function updateDevice(event) {
    console.log('emit updateDevice: ' + event);
}

/**
 * Transmit the device values to all frontend
 * @param {*} event 
 */
function updateDeviceValues(event) {
    try {
        if (name.length > 0) {
            name.map(item => {
                io.emit('device-values', {
                    id: event.id !== item ? item : event.id,
                    values: obj[item]
                })
            })
        }
        // io.emit('device-values', {
        //     id: event.id !== name ? name : event.id,
        //     values: obj
        // })
    } catch (err) {
        console.log(err, 'err')
    }
}

/**
 * Transmit the device status to all frontend
 * @param {*} event 
 */
function updateDeviceStatus(event) {
    try {
        // io.emit('device-status', event);
        io.emit('device-status', {id: event.id, status: 'connect-ok'});
    } catch (err) {
    }
}

var runtime = module.exports = {
    init: init,
    project: project,
    users: users,
    start: start,
    stop: stop,
    update: update,
    restart: restart,
    
    get io() { return io },
    get logger() { return logger },
    get settings() { return settings },
    get daqStorage() { return daqstorage },
    events: events,

}