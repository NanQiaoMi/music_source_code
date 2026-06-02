#!/usr/bin/env node

const { execFileSync } = require("child_process");
const net = require("net");
const os = require("os");

const DEFAULT_PORT = 3025;
const RELEASE_TIMEOUT_MS = 5000;
const POLL_INTERVAL_MS = 100;

function formatPortAddressPattern(port) {
  return `:${port}`;
}

function isPortOwnedByLine(line, port) {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 5 || parts[0].toUpperCase() !== "TCP") return false;

  const localAddress = parts[1];
  const state = parts[3]?.toUpperCase();
  if (state !== "LISTENING") return false;

  return localAddress.endsWith(formatPortAddressPattern(port));
}

function parseWindowsNetstatForPort(output, port, currentPid = process.pid) {
  const pids = new Set();

  for (const line of output.split(/\r?\n/)) {
    if (!isPortOwnedByLine(line, port)) continue;

    const parts = line.trim().split(/\s+/);
    const pid = Number(parts[4]);
    if (Number.isInteger(pid) && pid > 0 && pid !== currentPid) {
      pids.add(pid);
    }
  }

  return [...pids];
}

function parseUnixLsofForPort(output, currentPid = process.pid) {
  const pids = new Set();
  const lines = output.trim().split(/\r?\n/).slice(1);

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    const pid = Number(parts[1]);
    if (Number.isInteger(pid) && pid > 0 && pid !== currentPid) {
      pids.add(pid);
    }
  }

  return [...pids];
}

function runCommand(command, args) {
  try {
    return execFileSync(command, args, { encoding: "utf8", windowsHide: true });
  } catch (error) {
    if (typeof error.stdout === "string" && error.stdout.trim()) return error.stdout;
    return "";
  }
}

function runFirstAvailableCommand(commands, args) {
  for (const command of commands) {
    const output = runCommand(command, args);
    if (output.trim()) return output;
  }

  return "";
}

function getWindowsNetstatCandidates(env = process.env) {
  const root = env.windir || env.SystemRoot;
  if (!root) return ["netstat"];

  return [`${root}\\Sysnative\\netstat.exe`, `${root}\\System32\\netstat.exe`, "netstat"];
}

function getWindowsTaskkillCandidates(env = process.env) {
  const root = env.windir || env.SystemRoot;
  if (!root) return ["taskkill"];

  return [`${root}\\Sysnative\\taskkill.exe`, `${root}\\System32\\taskkill.exe`, "taskkill"];
}

function findWindowsPids(port) {
  const output = runFirstAvailableCommand(getWindowsNetstatCandidates(), ["-ano", "-p", "tcp"]);
  return parseWindowsNetstatForPort(output, port);
}

function findUnixPids(port) {
  const output = runCommand("lsof", ["-nP", "-iTCP:" + port, "-sTCP:LISTEN"]);
  return parseUnixLsofForPort(output);
}

function findPortPids(port) {
  return os.platform() === "win32" ? findWindowsPids(port) : findUnixPids(port);
}

function execFirstAvailableCommand(commands, args) {
  let lastError;

  for (const command of commands) {
    try {
      return execFileSync(command, args, { encoding: "utf8", windowsHide: true });
    } catch (error) {
      lastError = error;
      if (error.code !== "ENOENT") throw error;
    }
  }

  throw lastError || new Error(`No command candidates were available: ${commands.join(", ")}`);
}

function killPid(pid) {
  if (os.platform() === "win32") {
    execFirstAvailableCommand(getWindowsTaskkillCandidates(), ["/PID", String(pid), "/F", "/T"]);
    return;
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch (error) {
    if (error && error.code !== "ESRCH") throw error;
  }
}

function isUnsupportedListenHost(error) {
  return error && (error.code === "EAFNOSUPPORT" || error.code === "EINVAL");
}

function canListenOnHost(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", (error) => resolve(isUnsupportedListenHost(error)));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function canListenOnPort(port) {
  for (const host of ["::", "0.0.0.0", "127.0.0.1"]) {
    if (!(await canListenOnHost(port, host))) return false;
  }

  return true;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPortRelease(port, timeoutMs = RELEASE_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await canListenOnPort(port)) return true;
    await sleep(POLL_INTERVAL_MS);
  }

  return canListenOnPort(port);
}

async function cleanPort(port = DEFAULT_PORT) {
  console.log(`[clean-port] Checking TCP port ${port}...`);

  const pids = findPortPids(port);
  if (pids.length === 0) {
    if (await canListenOnPort(port)) {
      console.log(`[clean-port] Port ${port} is available.`);
      return true;
    }

    console.error(`[clean-port] Port ${port} is occupied, but no owning PID was found.`);
    return false;
  }

  console.log(
    `[clean-port] Found ${pids.length} process(es) listening on port ${port}: ${pids.join(", ")}`
  );

  for (const pid of pids) {
    try {
      killPid(pid);
      console.log(`[clean-port] Terminated PID ${pid}.`);
    } catch (error) {
      console.error(`[clean-port] Failed to terminate PID ${pid}: ${error.message}`);
    }
  }

  const released = await waitForPortRelease(port);
  if (!released) {
    const remaining = findPortPids(port);
    console.error(
      `[clean-port] Port ${port} is still occupied${remaining.length ? ` by PID(s): ${remaining.join(", ")}` : ""}.`
    );
    return false;
  }

  console.log(`[clean-port] Port ${port} is available.`);
  return true;
}

if (require.main === module) {
  const portArg = Number(process.argv[2] || process.env.PORT || DEFAULT_PORT);
  const port = Number.isInteger(portArg) && portArg > 0 ? portArg : DEFAULT_PORT;

  cleanPort(port)
    .then((ok) => {
      if (!ok) process.exitCode = 1;
    })
    .catch((error) => {
      console.error(`[clean-port] Unexpected failure: ${error.stack || error.message}`);
      process.exitCode = 1;
    });
}

module.exports = {
  DEFAULT_PORT,
  canListenOnPort,
  cleanPort,
  findPortPids,
  formatPortAddressPattern,
  getWindowsNetstatCandidates,
  getWindowsTaskkillCandidates,
  isPortOwnedByLine,
  parseUnixLsofForPort,
  parseWindowsNetstatForPort,
  waitForPortRelease,
};
