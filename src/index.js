const os = require("os");
const si = require("systeminformation");
const express = require("express");

const app = express();
const port = process.env.PORT || 3000;

app.get("/stats/snapshot", async (req, res) => {
    res.set({
        "Access-Control-Allow-Origin": "*",
    }).send({
        totalMem: os.totalmem(),
        freeMem: os.freemem(),
        loadAvg: os.loadavg(),
        upTime: os.uptime(),
        temp: await si.cpuTemperature(),
        //cpuLoad: await si.currentLoad(),
        //network: await si.networkStats(),
    });
});

app.get("/stats/static", async (req, res) => {
    res.set({
        "Access-Control-Allow-Origin": "*",
    }).send({
        arch: os.arch(),
        platform: os.platform(),
        cpus: os.cpus(),
        fsSize: await si.fsSize(),
        network: await si.networkInterfaces("default"),
    });
});

app.get("/processes", async (req, res) => {
    res.set({
        "Access-Control-Allow-Origin": "*",
    }).send(await si.processes());
});

app.use(express.static("src/public"));

app.listen(port, () => {
    console.log("Listening on port " + port);
});
