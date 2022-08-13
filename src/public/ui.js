const view = document.createElement("div");
view.classList.add("view");
document.body.append(view);

const svgNS = "http://www.w3.org/2000/svg";

let timeline = [];

async function tick() {
    const data = await getData();
    timeline = timeline.slice(-50);
    timeline.push(data);
    render(data, timeline);
}

function render(data, dataTimeline) {
    const cpuHistory = dataTimeline.map((his) => his.loadAvg[0]);
    const cpuGraph = drawBox("CPU Load", formatPercent(data.loadAvg[0], 0, 1), cpuHistory, 1);

    const cpuTempHistory = dataTimeline.map((his) => his.temp.main);
    const cpuTempGraph = drawBox(
        "CPU Temp",
        data.temp.main.toFixed(1) + "°C",
        cpuTempHistory,
        Math.max(...cpuTempHistory, 100)
    );

    const ramHistory = dataTimeline.map((his) => his.totalMem - his.freeMem);
    const ramGraph = drawBox(
        "RAM",
        `${formatBytes(data.totalMem - data.freeMem)} / ${formatBytes(data.totalMem)}`,
        ramHistory,
        data.totalMem
    );

    view.innerHTML = "";
    view.append(renderStatics(data));
    view.append(cpuGraph);
    view.append(cpuTempGraph);
    view.append(ramGraph);
    view.append(renderProcesses(data.processes.list));
}

//Data

const getSnapshot = getFromAPI("/stats/snapshot", 4000);
const getStatic = getFromAPI("/stats/static", 120_000);
const getProcesses = getFromAPI("/processes", 60_000);
async function getData() {
    return {
        ...(await getSnapshot)(),
        ...(await getStatic)(),
        processes: (await getProcesses)(),
    };
}

let timers = [];
async function getFromAPI(url, timeout) {
    let data = null;

    const requester = async () => {
        const res = await fetch(url);
        data = await res.json();
        const timer = setTimeout(() => {
            timers = timers.filter((t) => t !== timer);
            requester();
        }, timeout);
        timers.push(timer);
        return data;
    };
    await requester();

    return () => data;
}

const process = setInterval(tick, 4000);
window.stop = () => {
    clearInterval(process);
    for (const timer of timers) {
        clearTimeout(timer);
    }
};

// Render Utils

function drawBox(title, value, numArray, numArrayMax) {
    const box = document.createElement("div");
    box.classList.add("box");

    const h2 = document.createElement("h2");
    h2.innerText = title;
    box.append(h2);

    const output = document.createElement("output");
    output.innerText = value;
    box.append(output);

    box.append(drawGraph(numArray, numArrayMax));

    return box;
}

function drawGraph(numArray = [], max) {
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttributeNS(null, "viewBox", "0 0 100 100");
    svg.setAttributeNS(null, "preserveAspectRatio", "none");

    if (!max) {
        max = Math.max(...numArray);
    }

    const path = ["M0 100"];
    let x = 0;
    for (const val of numArray) {
        const percent = (val / max) * 100;
        path.push(`L${x} ${100 - percent}`);
        x += 2;
    }
    path.push("V 100");
    path.push("Z");

    const pathEl = document.createElementNS(svgNS, "path");
    pathEl.setAttributeNS(null, "fill", "currentColor");
    pathEl.setAttributeNS(null, "d", path.join(""));

    svg.append(pathEl);

    return svg;
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

function formatPercent(val, min = 0, max = 1) {
    const percent = val / (max - min);
    const roundedPercent = Math.round(percent * 10000) / 100;
    return `${roundedPercent}%`;
}

function renderStatics(data) {
    const box = document.createElement("dl");
    box.classList.add("box");
    box.classList.add("box_stats");

    function renderStat(name, stat) {
        const statName = document.createElement("dt");
        statName.innerText = name;
        box.append(statName);

        const statValue = document.createElement("dd");
        statValue.innerText = stat;
        box.append(statValue);
    }

    for (const i in data.cpus) {
        renderStat("CPU " + i, data.cpus[i].model);
        box.append(document.createElement("hr"));
    }

    renderStat("Platform", data.platform + " " + data.arch);
    renderStat("Uptime", formatDuration(data.upTime));
    renderStat("IP Address", data.network.ip4);
    renderStat("Connection type", data.network.type);
    renderStat("MAC Address", data.network.mac);

    box.append(document.createElement("hr"));
    for (const i in data.fsSize) {
        const drive = data.fsSize[i];
        renderStat("Drive " + i + " - Mount", drive.mount);
        renderStat("Drive " + i + " - Type", drive.type);
        renderStat("Drive " + i + " - Size", formatBytes(drive.size));
        renderStat("Drive " + i + " - Size Used", formatBytes(drive.used));
        renderStat("Drive " + i + " - Space Remaining", formatPercent(drive.size - drive.used, 0, drive.size));
        box.append(document.createElement("hr"));
    }

    return box;
}

function formatDuration(seconds) {
    const minutes = seconds / 60;
    const hours = minutes / 60;
    const days = hours / 24;
    const formatNum = (num, mod) => {
        return `${Math.floor(num % mod)}`.padStart(2, "0");
    };
    let format = `${formatNum(hours, 24)}:${formatNum(minutes, 60)}:${formatNum(seconds, 60)}`;
    if (Math.floor(days) > 0) {
        format = `${Math.floor(days)}d ${format}`;
    }
    return format;
}

function renderProcesses(processes) {
    const box = document.createElement("div");
    box.classList.add("box");
    box.classList.add("box_processes");

    const h2 = document.createElement("h2");
    h2.innerText = "Processes";
    box.append(h2);

    const table = document.createElement("table");
    box.append(table);

    const renderCell = (value, el = "td") => {
        const cell = document.createElement(el);
        cell.innerText = value;
        return cell;
    };
    const renderProcess = (process) => {
        const row = document.createElement("tr");
        const nameCell = renderCell(process.name);
        const path = process.path.length ? process.path + "/" : "";
        const command = path + process.command + " " + process.params;
        nameCell.append(document.createElement("br"));
        nameCell.append(command);
        row.append(nameCell);
        row.append(renderCell(process.user));
        row.append(renderCell(formatPercent(process.cpu, 0, 100)));
        row.append(renderCell(formatPercent(process.mem, 0, 100)));
        row.append(renderCell(process.started));
        table.append(row);
    };

    const sortedProcesses = [...processes].sort((a, b) => {
        const mem = b.mem - a.mem;
        if (mem !== 0) return mem;
        return b.cpu - a.cpu;
    });

    const headers = document.createElement("tr");
    headers.append(renderCell("Name", "th"));
    headers.append(renderCell("User", "th"));
    headers.append(renderCell("CPU %", "th"));
    headers.append(renderCell("RAM %", "th"));
    headers.append(renderCell("Started At", "th"));
    table.append(headers);

    for (const process of sortedProcesses) {
        renderProcess(process);
    }

    return box;
}
