const express = require('express');
const os = require('os');
require('dotenv').config({quiet: true});

const PORT = process.env.PORT || 3000;
const LAN_ADDRESS = getLanAddress();
const app = express();
let connectedIPAddress = "";

app.get("/devicelink/start", (req, res) => {
    connectedIPAddress = req.ip;
    res.sendStatus(200);
});

app.get('/devicelink/status', (req, res) => {
    res.json({ connectedIPAddress, lanAddress: getLanAddress() });
});

app.get("/devicelink/message", validateConnection, (req, res) => {
    const message = req.body;
    console.log(message);
    res.sendStatus(200);
});

app.listen(PORT);
console.log(`====================
    Waiting for a devicelink connection on port: ${PORT}
    LAN Address: ${LAN_ADDRESS}
    ====================`);

function getLanAddress() {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return '127.0.0.1';
}

function validateConnection(req, res, next) {
    const IPAddress = req.ip;
    if (IPAddress != connectedIPAddress) res.status(401).send('Unauthorized access');
    else {
        console.log("Connection validated!!");
        next();
    }
}