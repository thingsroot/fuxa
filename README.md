![fuxa logo](/client/src/favicon.ico) 
# FUXA
FUXA is a web-based Process Visualization (SCADA/HMI) software. With FUXA you can create modern process visualizations with individual designs for your machines and real-time data display.

![fuxa editor](/screenshot/fuxa-editor.png) 

![fuxa ani](/screenshot/fuxa-ani.gif)

## Features
- S7 Protocol to communicate with Siemens CPU
- A client for OPC UA connectivity
- SCADA/HMI Web-Editor - Engineering and Design completely web-based
- Cross-Platform Full-Stack - Backend with NodeJs and Frontend with Web technologies (HTML5, CSS, Javascript, Angular, SVG)

## Live Demo
Here is a [live demo](https://frangoteam.github.io) example of FUXA editor.

## Installing and Running
FUXA is developed with NodeJS (backend) and Angular (frontend). You can use the [released](/../../releases) Windows desktop version build with Electron framework or follow the installation.

You need to have installed [Node](https://nodejs.org) (Version 10.17) and NPM (Version 6.11). You need Python 2.7 (in Windows add to Environment Variable PATH) why some packages must be compiled from the source.

Clone this repository or download it
```
git clone https://github.com/frangoteam/fuxa.git
```
Install
```
cd ./server
npm install
```
Start NodeJS server at http://localhost:1881
```
cd ./server
npm start
```
Open up a browser (better Chrome) and navigate to http://localhost:1881

## Usage
First define your Device and bind the Variable or Signals
![fuxa device](/screenshot/fuxa-device.gif)

Then design your HMI pages with the SVG editor
![fuxa hmi](/screenshot/fuxa-hmi.gif)

Now you can test by changing the values to PLC or manually with the testbench
![fuxa test](/screenshot/fuxa-test.gif)

## To Debug (Full Stack)
Install and start to serve the frontend
```
cd ./client
npm install
npm start
```

Start the Server and Client (Browser) in Debug Mode
```
In vscode: Debug ‘Server & Client’
```

## To Build
Build the frontend for production
```
cd ./client
ng build --env=prod
```

## Test
Tested with:
- Windows 10, nodejs version 10.8.0, npm version 6.2.0
- Raspberry PI (Raspbian 2018-11-13, Kernel 4.14), nodejs version 10.15.3, npm version 6.4.1

## Issues
If you identify any errors, or have an idea for an improvement, please open an [issue](/../../issues).

## Let us know!
We’d be really happy if you send us your own shapes in order to collect a library to share it with others. Just send an email to 4frango@gmail.com and do let us know if you have any questions or suggestions regarding our work.

## Thank you!
- [SVG-edit](https://github.com/SVG-Edit/svgedit)
- [node-snap7](https://github.com/mathiask88/node-snap7)
- [node-opcua](https://github.com/node-opcua/node-opcua)

## License
MIT.
"# fuxa" 
