const express = require('express');
const os = require('os');
require('dotenv').config({quiet: true});

const PORT = parseInt(process.env.PORT) || 3000;
const DEVICE_NAME = process.env.DEVICE_NAME || "Unnamed"
const LAN_ADDRESS = getLanAddress();
const app = express();

let connectedIPAddress = "";
let isConnected = false;

app.use(express.json())

function start(port=PORT) {
    app.get("/devicelink/start", (req, res) => {
        connectedIPAddress = convertToIpv4(req.ip);
        res.sendStatus(200);
    });
    
    app.get('/devicelink/status', (req, res) => {
        res.json({ "devicelink_active": true, "device_name": DEVICE_NAME, "is_connected": isConnected});
        console.log(`${req.ip} has requested this device's status.`);
    });
    
    app.get("/devicelink/message", validateConnection, (req, res) => {
        const message = req.body;
        console.log(message);
        res.sendStatus(200);
    });

    app.listen(port);
    console.log(`====================
    Waiting for a devicelink connection on port: ${port}
    LAN Address: ${LAN_ADDRESS}:${port}
    ====================`);
}

async function search(port=PORT) {
    const devices = await scanForDevicelink()
    connectedIPAddress = devices[0]["ip"]
    isConnected = true
}

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

function getBaseIp(ip="121.0.0.1") {
    const parts = ip.split(".");
    parts.pop();
    return parts.join(".") + ".";
}

function validateConnection(req, res, next) {
    const IPAddress = convertToIpv4(req.ip);
    if (IPAddress != connectedIPAddress) res.status(401).send('Unauthorized access');
    else {
        console.log("Connection validated!!");
        next();
    }
}

function convertToIpv4(ip="::ffff:121.0.0.1") {
    if (ip.substring(0, 7) === "::ffff:") {
        ip = ip.substring(7);
    }
    
    return ip
}

async function scanForDevicelink(port) {
    const baseIp = getBaseIp(getLanAddress());
    console.log(`Starting Devicelink scan on subnet: ${baseIp}1 to ${baseIp}254`);

    const promises = [];
    const timeoutMs = 1500;

    for (let i = 1; i <= 254; i++) {
        const targetIp = baseIp + i;
        promises.push(pingDevice(targetIp, port, timeoutMs));
    }

    const results = await Promise.allSettled(promises);
    
    const foundDevices = results
        .filter(result => result.status === 'fulfilled' && result.value !== null)
        .map(result => result.value);

    return foundDevices;
}

async function pingDevice(ip, port, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const url = `http://${ip}:${port}/devicelink/status`;
        const response = await fetch(url, { signal: controller.signal });

        if (response.ok) {
            const data = await response.json();
            
            if (data && data["devicelink_active"] && !data["is_connected"]) {
                return { ip, data };
            }
        }
    } catch (error) {
        
    } finally {
        clearTimeout(timeoutId);
    }
    
    return null;
}

module.exports = {start, search}