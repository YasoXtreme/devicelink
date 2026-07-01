const express = require("express");
const os = require("os");
require("dotenv").config({ quiet: true });

const PORT = parseInt(process.env.PORT) || 3000;
const DEVICE_NAME = process.env.DEVICE_NAME || "Unnamed";
const LAN_ADDRESS = getLanAddress();

class Devicelink {
  #app;

  constructor(port = 3000, deviceName = "Unnamed") {
    this.port = port;
    this.deviceName = deviceName;
    this.lanAddress = getLanAddress();
    this.isConnected = false;
    this.connectedHost = "";
    this.#app = express();
  }

  start() {
    this.#app.use(express.json());

    this.#app.get("/devicelink/start", (req, res) => {
      this.connectedHost = req.host;
      res.sendStatus(200);
    });

    this.#app.get("/devicelink/status", (req, res) => {
      res.json({
        devicelink_active: true,
        device_name: this.deviceName,
        is_connected: this.isConnected,
      });
    });

    this.#app.get(
      "/devicelink/message",
      this.#validateConnection,
      (req, res) => {
        const message = req.body;
        console.log(message);
        res.sendStatus(200);
      },
    );

    this.#app.listen(this.port);
  }

  async #connectToHost(host) {
    const response = await fetch(`http://${host}/devicelink/start`);
    if (!response.ok) return;
    console.log(`Successfully connected to ${host}`);
    this.connectedHost = host;
    this.isConnected = true;
  }

  #validateConnection(req, res, next) {
    const host = req.host;
    if (host != connectedHost) res.status(401).send("Unauthorized access");
    else {
      next();
    }
  }

  /**
   * @param {Number} port Devicelink will search for other active nearby devicelink instances on this port.
   * @return {Promise<DevicelinkDevice[]>} A list of discovered active devices.
   */
  async search(port = this.port) {
    const baseIp = getBaseIp(this.lanAddress);
    const promises = [];
    const timeoutMs = 1500;

    for (let i = 1; i <= 254; i++) {
      const targetIp = baseIp + i;
      promises.push(this.#pingDevice(targetIp, port, timeoutMs));
    }

    const results = await Promise.allSettled(promises);

    const foundDevices = results
      .filter(
        (result) => result.status === "fulfilled" && result.value !== null,
      )
      .map((result) => result.value);

    return foundDevices;
  }

  async #pingDevice(ip, port, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const host = `${ip}:${port}`;

    try {
      const url = `http://${host}/devicelink/status`;
      const response = await fetch(url, { signal: controller.signal });

      if (response.ok) {
        const data = await response.json();

        if (data) {
          const device = new DevicelinkDevice(
            host,
            data["device_name"],
            data["is_connected"],
            data["devicelink_active"],
          );
          return device;
        }
      }
    } catch (error) {
    } finally {
      clearTimeout(timeoutId);
    }

    return null;
  }
}

class DevicelinkDevice {
  #host;
  #deviceName;
  #isConnected;
  #isActive;

  constructor(host, deviceName, isConnected, isActive) {
    this.#host = host;
    this.#deviceName = deviceName;
    this.#isConnected = isConnected;
    this.#isActive = isActive;
  }

  get host() {
    return this.#host;
  }

  get deviceName() {
    return this.#deviceName;
  }

  get isConnected() {
    return this.#isConnected;
  }

  get isActive() {
    return this.#isActive;
  }

  [Symbol.for("nodejs.util.inspect.custom")]() {
    return `<DevicelinkDevice [${this.#deviceName}] at ${this.#host} (connected: ${this.#isConnected}, active: ${this.#isActive})>`;
  }
}

function getLanAddress() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "127.0.0.1";
}

function getBaseIp(ip = "121.0.0.1") {
  const parts = ip.split(".");
  parts.pop();
  return parts.join(".") + ".";
}

function convertToIpv4(ip = "::ffff:121.0.0.1") {
  if (ip.substring(0, 7) === "::ffff:") {
    ip = ip.substring(7);
  }

  return ip;
}

module.exports = Devicelink;
