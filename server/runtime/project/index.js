/*
* Project manager: read, write, add, remove, ... and save 
*/

'use strict';

const fs = require('fs');
const path = require('path');

var events = require('../events');
var utils = require('../utils');
const prjstorage = require('./prjstorage');

const version = '1.00';
var settings;                   // Application settings
var logger;                     // Application logger

var data = {};                  // Project data

/**
 * Init Project resource and update project
 * @param {*} _settings 
 * @param {*} log 
 */
function init(_settings, log) {
    settings = _settings;
    logger = log;

    // Init Project database
    return new Promise(function (resolve, reject) {
        prjstorage.init(settings, logger).then(result => {
            logger.info('project.prjstorage-init-successful!');
            if (result) {
                resolve();
            } else {
                prjstorage.setDefault().then(result => {
                    logger.info('project.prjstorage-seDefault-successful!');
                    resolve();
                }).catch(function (err) {
                    logger.error('project.prjstorage.failed-seDefault: ' + err);
                    resolve();
                });
            }
        }).catch(function (err) {
            logger.error('project.prjstorage.failed-to-init: ' + err);
            reject(err);
        });
    });
}

/**
 * Load project resource in a local data
 * Read all storaged sections and fill in local data
 */
function load() {
    return new Promise(function (resolve, reject) {
        data = { devices: {}, hmi: { views: [] } };
        // load general data
        prjstorage.getSection(prjstorage.TableType.GENERAL).then(grows => {
            for (var ig = 0; ig < grows.length; ig++) {
                if (grows[ig].name === ProjectDataCmdType.HmiLayout) {
                    data.hmi[grows[ig].name] = JSON.parse(grows[ig].value);
                } else {
                    data[grows[ig].name] = JSON.parse(grows[ig].value);
                }
            }
            // load views
            prjstorage.getSection(prjstorage.TableType.VIEWS).then(vrows => {
                for (var iv = 0; iv < vrows.length; iv++) {
                    data.hmi.views.push(JSON.parse(vrows[iv].value));
                }
                // load devices
                prjstorage.getSection(prjstorage.TableType.DEVICES).then(drows => {
                    for (var id = 0; id < drows.length; id++) {
                        if (drows[id].name === 'server') {
                            data[drows[id].name] = JSON.parse(drows[id].value);
                        } else {
                            data.devices[drows[id].name] = JSON.parse(drows[id].value);
                        }
                    }
                    resolve();
                }).catch(function (err) {
                    logger.error('project.prjstorage.failed-to-load ' + prjstorage.TableType.DEVICES + ': ' + err);
                    reject(err);
                });
            }).catch(function (err) {
                logger.error('project.prjstorage.failed-to-load ' + prjstorage.TableType.VIEWS + ': ' + err);
                reject(err);
            });
        }).catch(function (err) {
            logger.error('project.prjstorage.failed-to-load ' + prjstorage.TableType.GENERAL + ': ' + err);
            reject(err);
        });
    });
}

/**
 * Save the value in project storage
 * First set the value in local data, then save in storage
 * @param {*} cmd 
 * @param {*} data 
 */
function setProjectData(cmd, value) {
    return new Promise(function (resolve, reject) {
        try {
            var toremove = false;
            var section = { table: '', name: '', value: value };
            if (cmd === ProjectDataCmdType.SetView) {
                section.table = prjstorage.TableType.VIEWS;
                section.name = value.id;
                setView(value);
            } else if (cmd === ProjectDataCmdType.DelView) {
                section.table = prjstorage.TableType.VIEWS;
                section.name = value.id;
                toremove = removeView(value);
            } else if (cmd === ProjectDataCmdType.HmiLayout) {
                section.table = prjstorage.TableType.GENERAL;
                section.name = cmd;
                setHmiLayout(value);
            } else if (cmd === ProjectDataCmdType.SetDevice) {
                section.table = prjstorage.TableType.DEVICES;
                section.name = value.name;
                setDevice(value);
            } else if (cmd === ProjectDataCmdType.DelDevice) {
                section.table = prjstorage.TableType.DEVICES;
                section.name = value.name;
                toremove = removeDevice(value);
            } else if (cmd === ProjectDataCmdType.Charts) {
                section.table = prjstorage.TableType.GENERAL;
                section.name = cmd;
                setCharts(value);
            }
            if (toremove) {
                prjstorage.deleteSection(section).then(result => {
                    resolve(true);
                }).catch(function (err) {
                    logger.error('prjstorage.failed-to-deletedata ' + section.table);
                    reject(err);
                });
            } else {
                prjstorage.setSection(section).then(result => {
                    resolve(true);
                }).catch(function (err) {
                    logger.error('prjstorage.failed-to-setdata ' + section.table);
                    reject(err);
                });
            }
        } catch (err) {
            reject();
        }
    });
}

/**
 * Set or add if not exist (check with view.id) the View in Project
 * @param {*} view 
 */
function setView(view) {
    
    return false;
    var pos = -1;
    for (var i = 0; i < data.hmi.views.length; i++) {
        if (data.hmi.views[i].id === view.id) {
            pos = i;
        }
    }
    if (pos >= 0) {
        data.hmi.views[pos] = view;
    } else {
        data.hmi.views.push(view);
    }
}

/**
 * Remove the View from Project
 * @param {*} view 
 */
function removeView(view) {
    var pos = -1;
    for (var i = 0; i < data.hmi.views.length; i++) {
        if (data.hmi.views[i].id === view.id) {
            data.hmi.views.splice(i, 1);
            return true;
        }
    }
    return false;
}

/**
 * Set Device to loacal data
 * @param {*} device 
 */
function setDevice(device) {
    data.devices[device.name] = device;
}

/**
 * Remove Device from local data
 * @param {*} device 
 */
function removeDevice(device) {
    delete data.devices[device.name];
    return true;
}

/**
 * Set HMI Layout to local data
 * @param {*} layout 
 */
function setHmiLayout(layout) {
    data.hmi.layout = layout;
}

/**
 * Set Charts  
 * @param {*} charts 
 */
function setCharts(charts) {
    data.charts = charts;
}

/**
 * Get the project data in accordance with autorization
 */
function getProject(userId, userGroups) {
    return new Promise(function (resolve, reject) {
        const pdata = _filterProjectGroups(userGroups);
        resolve(pdata);
    });
}

/**
 * Set the new Project, clear all from database and add the new content
 * @param {*} prjcontent 
 */
function setProject(prjcontent) {
    return new Promise(function (resolve, reject) {
        try {
            prjstorage.clearAll().then(result => {
                var scs = [];
                Object.keys(prjcontent).forEach((key) => {
                    if (key === 'devices') {
                        // devices
                        var devices = prjcontent[key];
                        if (devices) {
                            Object.values(prjcontent[key]).forEach((device) => {
                                scs.push({ table: prjstorage.TableType.DEVICES, name: device.name, value: device });
                            });
                        }
                    } else if (key === 'hmi') {
                        // hmi
                        var hmi = prjcontent[key];
                        if (hmi) {
                            Object.keys(hmi).forEach((hk) => {
                                if (hk === 'views') {
                                    // views
                                    if (hmi[hk] && hmi[hk].length > 0) {
                                        for (var i = 0; i < hmi[hk].length; i++) {
                                            var view = hmi[hk][i];
                                            scs.push({ table: prjstorage.TableType.VIEWS, name: view.id, value: view });
                                        }
                                    }
                                } else {
                                    // layout
                                    scs.push({ table: prjstorage.TableType.GENERAL, name: hk, value: hmi[hk] });
                                }
                            });
                        }
                    } else if (key === 'server') {
                        // server
                        scs.push({ table: prjstorage.TableType.DEVICES, name: key, value: prjcontent[key] });
                    } else {
                        // charts, version
                        scs.push({ table: prjstorage.TableType.GENERAL, name: key, value: prjcontent[key] });
                    }
                });
                prjstorage.setSections(scs).then(() => {
                    logger.info('project.prjstorage.set-project successfull!');
                    resolve(true);
                }).catch(function (err) {
                    reject(err);
                });
            }).catch(function (err) {
                logger.error('project.prjstorage.failed-to-clear: ' + err);
                reject(err);
            });
        } catch (err) {
            reject();
        }
    });
}

/**
 * Return Devices list
 */
function getDevices() {
    return data.devices;
}

/**
 * Get the device property
 */
function getDeviceProperty(query) {
    return new Promise(function (resolve, reject) {
        if (query.query === 'security') {
            prjstorage.getSection(prjstorage.TableType.DEVICESSECURITY, query.name).then(drows => {
                if (drows.length > 0) {
                    resolve(drows[0]);
                } else {
                    resolve();
                }
            }).catch(function (err) {
                logger.error('project.prjstorage.failed-to-getdevice-property ' + prjstorage.TableType.DEVICESSECURITY + ': ' + err);
                reject(err);
            });
        } else {
            reject();
        }
    });
}

/**
 * Set the device property
 */
function setDeviceProperty(query) {
    return new Promise(function (resolve, reject) {
        if (query.query === 'security') {
            prjstorage.setSection({ table: prjstorage.TableType.DEVICESSECURITY, name: query.name, value: query.value }).then(() => {
                resolve();
            }).catch(function (err) {
                logger.error('project.prjstorage.failed-to-setdevice-property ' + prjstorage.TableType.DEVICESSECURITY + ': ' + err);
                reject(err);
            });
        } else {
            reject();
        }
    });
}

/**
 * Return Project demo from file
 */
function getProjectDemo() {
    var demoProject = path.join(settings.appDir, 'project.demo.fuxap');
    return JSON.parse(fs.readFileSync(demoProject, 'utf8'));;
}

function _filterProjectGroups(groups) {
    var result = JSON.parse(JSON.stringify(data));// = { devices: {}, hmi: { views: [] } };
    var admin = (groups === -1 || groups === 255) ? true : false;
    if (!admin) {
        // from device remove the not used (no permission)
        // delete result.devices;
        delete result.server;
        // check navigation permission
        if (result.hmi.layout && result.hmi.layout.navigation.items) {
            for (var i = result.hmi.layout.navigation.items.length - 1; i >= 0; i--) {
                var permission = result.hmi.layout.navigation.items[i].permission;
                if (permission && !(permission & groups)) {
                    result.hmi.layout.navigation.items.splice(i, 1);
                }
            }
        }
        // check view item permission show / enabled
        for (var i = 0; i < result.hmi.views.length; i++) {
            if (result.hmi.views[i].items) {
                Object.values(result.hmi.views[i].items).forEach((item) => {
                    if (item.property && item.property.permission) {
                        var view = result.hmi.views[i];
                        var mask = (item.property.permission >> 8);
                        var show = (mask) ? mask & groups : 1;
                        mask = (item.property.permission & 255);
                        var enabled = (mask) ? mask & groups : 1;
                        if (!show) {
                            var position = view.svgcontent.indexOf(item.id);
                            if (position) {
                                position += item.id.length + 1;
                                var hidetext = ' visibility="hidden" ';
                                view.svgcontent = view.svgcontent.slice(0, position) + hidetext + view.svgcontent.slice(position);
                            }
                        } else if (!enabled) {
                            item.property.events = [];
                            // disable the html controls (select, input, button)
                            var splitted = utils.domStringSplitter(view.svgcontent, 'foreignobject', view.svgcontent.indexOf(item.id));
                            if (splitted.tagcontent && splitted.tagcontent.length) {
                                var disabled = utils.domStringSetAttribute(splitted.tagcontent, ['select', 'input', 'button'], 'disabled');
                                view.svgcontent = splitted.before + disabled + splitted.after;
                            }
                        }
                    }
                });
            }
        }
    }
    return result;
}

const ProjectDataCmdType = {
    SetDevice: 'set-device',
    DelDevice: 'del-device',
    SetView: 'set-view',
    DelView: 'del-view',
    HmiLayout: 'layout',
    Charts: 'charts',
}

module.exports = {
    init: init,
    load: load,
    getDevices: getDevices,
    getDeviceProperty: getDeviceProperty,
    setDeviceProperty: setDeviceProperty,
    setProjectData: setProjectData,
    getProject: getProject,
    setProject: setProject,
    getProjectDemo: getProjectDemo,
    ProjectDataCmdType, ProjectDataCmdType,
};
