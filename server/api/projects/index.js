/**
 * 'api/project': Project API to GET/POST project data
 */

var express = require("express");
const authJwt = require('../jwt-helper');
var WebSocket = require('ws')
var prjstore = require('../../runtime/project/prjstorage')
var runtime;
var secureFnc;
var checkGroupsFnc;

module.exports = {
    init: function (_runtime, _secureFnc, _checkGroupsFnc) {
        runtime = _runtime;
        secureFnc = _secureFnc;
        checkGroupsFnc = _checkGroupsFnc;
    },
    app: function () {
        var prjApp = express();
        prjApp.use(function(req,res,next) {
            if (!runtime.project) {
                res.status(404).end();
            } else {
                next();
            }
        });

        /**
         * GET Project data
         * Take from project storage and reply 
         */
        prjApp.get("/api/project", secureFnc, function(req, res) {
            var groups = checkGroupsFnc(req);
            runtime.project.getProject(req.userId, groups).then(result => {
                // res.header("Access-Control-Allow-Origin", "*");
                // res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
                if (result) {
                    const devices = result.devices;
                    const keys = Object.keys(devices);
                    if (keys.length <= 0) {
                        res.json(result)
                        return false;
                    }
                    let name = [];
                    keys.map(item=>{
                        if (devices[item].type === 'OPCUA') {
                            // name = devices[item].name;
                            name.push(devices[item].name)
                        }
                    })
                    function asyncWebsocket (name, index, len){
                        const items = name[index]
                        if (index >= len) {
                            res.json(result)
                            return false;
                        }
                        prjstore.getSection('devicesSecurity', items).then(results=>{
                            if (results.length > 0) {
                                if (results[0].value === 'null') {
                                    res.json(result)
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
                                    if (data.code === 'device_data' && data.data !== '0') {
                                        const devices = result.devices;
                                        const key = Object.keys(devices);
                                        if (key.length > 0) {
                                            const datas = data.data;
                                            const dataKey = Object.keys(datas);
                                            const obj = {}
                                            dataKey.map(item => {
                                                obj[item] = {
                                                    name: item,
                                                    id: item,
                                                    address: item,
                                                    type: 'Double',
                                                    value: null
                                                }
                                            })
                                            result.devices[items].tags = obj;
                                            asyncWebsocket(name, index + 1, len)
                                        }
                                        ws.close()
                                        if (data.code === 'welcome') {
                                            res.json(result);
                                            ws.close()
                                        }
                                    }
                                }
                            } else {
                                res.json(result)
                            }
                        })
                    }
                    if (name.length > 0) {
                            asyncWebsocket(name, 0, name.length)
                    } else {
                        res.json(result)
                    }
                    
                    
                } else {
                    res.status(404).end();
                    runtime.logger.error("api get project: Not Found!");
                }
            }).catch(function(err) {
                if (err.code) {
                    if (err.code !== 'ERR_HTTP_HEADERS_SENT') {
                        res.status(400).json({error:err.code, message: err.message});
                    }
                } else {
                    res.status(400).json({error:"unexpected_error", message:err.toString()});
                }
                runtime.logger.error("api get project: " + err.message);
            });
        });

        /**
         * POST Project data
         * Set to project storage
         */
        prjApp.post("/api/project", secureFnc, function(req, res, next) {
            var groups = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api post project: Tocken Expired");
            } else if (authJwt.adminGroups.indexOf(groups) === -1 ) {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api post project: Unauthorized");
            } else {
                runtime.project.setProject(req.body).then(function(data) {
                    runtime.restart().then(function(result) {
                        res.end();
                    });
                }).catch(function(err) {
                    if (err.code) {
                        res.status(400).json({error:err.code, message: err.message});
                    } else {
                        res.status(400).json({error:"unexpected_error", message:err.toString()});
                    }
                    runtime.logger.error("api post project: " + err.message);
                });
            }
        });

        /**
         * POST Single Project data
         * Set the value (general/view/device/...) to project storage
         */
        prjApp.post("/api/projectData", secureFnc, function(req, res, next) {
            var groups = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api post projectData: Tocken Expired");
            } else if (authJwt.adminGroups.indexOf(groups) === -1 ) {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api post projectData: Unauthorized");
            } else {
                runtime.project.setProjectData(req.body.cmd, req.body.data).then(setres => {
                    runtime.update(req.body.cmd, req.body.data).then(result => {
                        res.end();
                    });
                }).catch(function(err) {
                    if (err.code) {
                        res.status(400).json({error:err.code, message: err.message});
                    } else {
                        res.status(400).json({error:"unexpected_error", message:err.toString()});
                    }
                    runtime.logger.error("api post projectData: " + err.message);
                });
            }
        });

        /**
         * GET Project demo data
         * Take the project demo file from server folder 
         */
        prjApp.get("/api/projectdemo", secureFnc, function (req, res) {
            const data = runtime.project.getProjectDemo();
            // res.header("Access-Control-Allow-Origin", "*");
            // res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            if (data) {
                res.json(data);
            } else {
                res.status(404).end();
                runtime.logger.error("api get project: Not Found!");
            }
        });

        /**
         * GET Device property like security
         * Take from project storage and reply 
         */
        prjApp.get("/api/device", secureFnc, function(req, res) {
            var groups = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api get device: Tocken Expired");
            } else if (authJwt.adminGroups.indexOf(groups) === -1 ) {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api get device: Unauthorized");
            } else {
                runtime.project.getDeviceProperty(req.query).then(result => {
                    // res.header("Access-Control-Allow-Origin", "*");
                    // res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
                    if (result) {
                        res.json(result);
                    } else {
                        res.end();
                    }
                }).catch(function(err) {
                    if (err.code) {
                        res.status(400).json({error:err.code, message: err.message});
                    } else {
                        res.status(400).json({error:"unexpected_error", message:err.toString()});
                    }
                    runtime.logger.error("api get device: " + err.message);
                });
            }
        });

        /**
         * POST Device property
         * Set to project storage
         */
        prjApp.post("/api/device", secureFnc, function(req, res, next) {
            var groups = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api post device: Tocken Expired");
            } else if (authJwt.adminGroups.indexOf(groups) === -1 ) {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api post device: Unauthorized");
            } else {
                runtime.project.setDeviceProperty(req.body.params).then(function(data) {
                    res.end();
                }).catch(function(err) {
                    if (err.code) {
                        res.status(400).json({error:err.code, message: err.message});
                    } else {
                        res.status(400).json({error:"unexpected_error", message:err.toString()});
                    }
                    runtime.logger.error("api post device: " + err.message);
                });                
            }
        });
 
        return prjApp;
    }
}