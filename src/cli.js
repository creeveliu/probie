#!/usr/bin/env node
import { execFile, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const appName = "probie";
const profiles = {
  openai: [
    ["openai_api", "https://api.openai.com/v1/models"],
  ],
  anthropic: [
    ["anthropic_api", "https://api.anthropic.com/v1/messages"],
  ],
  gemini: [
    ["google_ai_api", "https://generativelanguage.googleapis.com/v1beta/models"],
  ],
  deepseek: [
    ["deepseek_api", "https://api.deepseek.com/models"],
  ],
  openrouter: [
    ["openrouter_api", "https://openrouter.ai/api/v1/models"],
  ],
  groq: [
    ["groq_api", "https://api.groq.com/openai/v1/models"],
  ],
  mistral: [
    ["mistral_api", "https://api.mistral.ai/v1/models"],
  ],
  xai: [
    ["xai_api", "https://api.x.ai/v1/models"],
  ],
  perplexity: [
    ["perplexity_api", "https://api.perplexity.ai/models"],
  ],
  together: [
    ["together_api", "https://api.together.xyz/v1/models"],
  ],
  cohere: [
    ["cohere_api", "https://api.cohere.com/v1/models"],
  ],
};
const profileAliases = {
  chatgpt: "openai",
  "claude-code": "anthropic",
};
const defaultConfig = {
  profiles: ["openai"],
  urls: [],
  interval: 5,
  connectTimeout: 6,
  maxTime: 10,
  confirmConnectTimeout: 20,
  confirmMaxTime: 30,
  failThreshold: 3,
  retries: 0,
  concurrency: 3,
};
let egressCache = null;

const messages = {
  zh: {
    allOk: (names) => `${names} 全部可连通；如果对应工具仍重试，更像客户端或服务端短时问题。`,
    partial: (good, bad) => `部分目标可连通；正常：${good}；异常：${bad}。更像 DNS、规则、节点或上游局部波动。`,
    allFail: (reasons) => `所选目标都不可连通；更像本机网络、代理/VPN、DNS 或节点问题。失败阶段：${reasons}`,
    notifyDownTitle: "服务不可达",
    notifyDown: (names) => `${names} 当前不可达`,
    notifyUpTitle: "服务已恢复",
    notifyUp: (names) => `${names} 已恢复可达`,
    selectTitle: "选择要监控的平台",
    selectHelp: "空格: 切换   上/下: 移动   回车: 保存",
    cancelled: "已取消",
    saved: "已保存",
    run: "运行",
    checking: "检测中",
    checkingNext: "下一轮检测中",
    profiles: "服务",
    route: "路由",
    egress: "出口",
    verdict: "结论",
    ctrlC: "Ctrl+C 退出",
    someEndpoints: "部分端点",
  },
  en: {
    allOk: (names) => `${names} reachable; if the matching tool is still retrying, it is more likely a client or service-side issue.`,
    partial: (good, bad) => `Some targets are reachable; healthy: ${good}; failing: ${bad}. Likely DNS, routing, proxy, or partial upstream instability.`,
    allFail: (reasons) => `All selected targets are unreachable; likely local network, proxy/VPN, DNS, or node issue. Failure stage: ${reasons}`,
    notifyDownTitle: "Service unreachable",
    notifyDown: (names) => `${names} is currently unreachable`,
    notifyUpTitle: "Service recovered",
    notifyUp: (names) => `${names} is reachable again`,
    selectTitle: "Select platforms to monitor",
    selectHelp: "Space: toggle   Up/Down: move   Enter: save",
    cancelled: "Cancelled",
    saved: "Saved",
    run: "Run",
    checking: "checking",
    checkingNext: "checking next round",
    profiles: "Profiles",
    route: "route",
    egress: "egress",
    verdict: "verdict",
    ctrlC: "Ctrl+C to exit",
    someEndpoints: "some endpoints",
  },
};

function lang() {
  const raw = (process.env.NETWATCHER_LANG || process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || "").toLowerCase();
  if (raw.startsWith("zh")) return "zh";
  if (raw && !["c", "c.utf-8", "posix"].includes(raw)) return "en";
  return macosLocale().startsWith("zh") ? "zh" : "en";
}

function t() {
  return messages[lang()];
}

function macosLocale() {
  if (platform() !== "darwin") return "";
  try {
    const locale = execFileSyncText("defaults", ["read", "-g", "AppleLocale"]).toLowerCase();
    if (locale) return locale;
  } catch {
  }
  try {
    return execFileSyncText("defaults", ["read", "-g", "AppleLanguages"]).toLowerCase();
  } catch {
    return "";
  }
}

function execFileSyncText(cmd, args) {
  return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function sep() {
  return lang() === "zh" ? "、" : ", ";
}

function configPath() {
  const base = process.env.XDG_CONFIG_HOME || `${homedir()}/.config`;
  return `${base}/${appName}/config.json`;
}

function loadConfig() {
  const path = configPath();
  if (!existsSync(path)) return { ...defaultConfig };
  return { ...defaultConfig, ...JSON.parse(readFileSync(path, "utf8")) };
}

function saveConfig(cfg) {
  const path = configPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(cfg, null, 2)}\n`);
  return path;
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("-")) {
      out._.push(a);
    } else if (["--profile", "-p"].includes(a)) {
      out.profile ??= [];
      out.profile.push(argv[++i]);
    } else if (a === "--url") {
      out.url ??= [];
      out.url.push(argv[++i]);
    } else if (["--interval", "-i"].includes(a)) {
      out.interval = Number(argv[++i]);
    } else if (a === "--connect-timeout") {
      out.connectTimeout = Number(argv[++i]);
    } else if (a === "--max-time") {
      out.maxTime = Number(argv[++i]);
    } else if (a === "--confirm-connect-timeout") {
      out.confirmConnectTimeout = Number(argv[++i]);
    } else if (a === "--confirm-max-time") {
      out.confirmMaxTime = Number(argv[++i]);
    } else if (a === "--fail-threshold") {
      out.failThreshold = Number(argv[++i]);
    } else if (a === "--retries") {
      out.retries = Number(argv[++i]);
    } else if (a === "--concurrency") {
      out.concurrency = Number(argv[++i]);
    } else if (a === "--json") {
      out.json = true;
    } else if (a === "--notify") {
      out.notify = true;
    } else if (a === "--quiet") {
      out.quiet = true;
    } else if (a === "--no-color") {
      out.noColor = true;
    } else if (a === "--help" || a === "-h") {
      out.help = true;
    } else {
      throw new Error(`unknown option: ${a}`);
    }
  }
  return out;
}

function help() {
  console.log(`probie

Usage:
  probie watch [--profile openai --profile anthropic] [--notify]
  probie once [--profile openai]
  probie status [--profile openai --profile anthropic]
  probie setup
  probie config show
  probie config set --profile openai --profile anthropic --interval 5 --connect-timeout 6 --max-time 10 --confirm-connect-timeout 20 --confirm-max-time 30 --concurrency 3
  probie config add-profile anthropic
  probie config remove-profile anthropic
  probie config add-url https://example.com/
  probie config remove-url https://example.com/
  probie install-autostart
  probie uninstall-autostart
`);
}

function resolveTargets(selectedProfiles, urls) {
  const targets = [];
  const profileTargets = {};
  const normalized = [...new Set(selectedProfiles.map((p) => profileAliases[p] || p))];
  for (const profile of normalized) {
    if (!profiles[profile]) throw new Error(`unknown profile: ${profile}`);
    profileTargets[profile] = [];
    for (const [name, url] of profiles[profile]) {
      const fullName = `${profile}:${name}`;
      targets.push([fullName, url]);
      profileTargets[profile].push(fullName);
    }
  }
  urls.forEach((url, i) => {
    const name = `custom:${i + 1}`;
    targets.push([name, url]);
    profileTargets.custom ??= [];
    profileTargets.custom.push(name);
  });
  return { targets, profileTargets };
}

async function interactiveSetup() {
  if (!process.stdin.isTTY) throw new Error("setup requires an interactive terminal");
  const cfg = loadConfig();
  const choices = Object.keys(profiles);
  const selected = new Set((cfg.profiles || []).map((p) => profileAliases[p] || p).filter((p) => choices.includes(p)));
  let cursor = 0;

  const renderSelect = () => {
    console.clear();
    console.log(t().selectTitle);
    console.log(`${t().selectHelp}\n`);
    choices.forEach((name, i) => {
      const pointer = i === cursor ? ">" : " ";
      const mark = selected.has(name) ? "[x]" : "[ ]";
      console.log(`${pointer} ${mark} ${name}`);
    });
  };

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  renderSelect();

  await new Promise((resolvePromise) => {
    const onData = (key) => {
      if (key === "\u0003") {
        process.stdin.setRawMode(false);
        process.stdin.off("data", onData);
        console.log(`\n${t().cancelled}`);
        process.exit(130);
      }
      if (key === "\u001b[A" || key === "k") cursor = Math.max(0, cursor - 1);
      else if (key === "\u001b[B" || key === "j") cursor = Math.min(choices.length - 1, cursor + 1);
      else if (key === " ") {
        const name = choices[cursor];
        if (selected.has(name)) selected.delete(name);
        else selected.add(name);
      } else if (key === "\r" || key === "\n") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.off("data", onData);
        resolvePromise();
        return;
      }
      renderSelect();
    };
    process.stdin.on("data", onData);
  });

  if (!selected.size) selected.add("openai");
  cfg.profiles = [...selected];
  const path = saveConfig(cfg);
  console.log(`\n${t().saved}: ${path}`);
  console.log(`Profiles: ${cfg.profiles.join(", ")}`);
  console.log(`${t().run}: probie watch`);
  process.exit(0);
}

async function runCmd(cmd, args, timeoutMs = 4000) {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, { timeout: timeoutMs });
    return { code: 0, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (e) {
    return {
      code: typeof e.code === "number" ? e.code : 1,
      stdout: (e.stdout || "").trim(),
      stderr: (e.stderr || e.message || "").trim(),
    };
  }
}

async function curlProbe(name, url, timeouts) {
  const attempts = [];
  const fast = await curlProbeOnce(name, url, {
    connectTimeout: timeouts.connectTimeout,
    maxTime: timeouts.maxTime,
  });
  attempts.push(fast);
  if (fast.ok) return { ...fast, confirmed: false, attempts };

  for (let attempt = 0; attempt <= timeouts.retries; attempt++) {
    const confirm = await curlProbeOnce(name, url, {
      connectTimeout: timeouts.confirmConnectTimeout,
      maxTime: timeouts.confirmMaxTime,
    });
    attempts.push(confirm);
    if (confirm.ok) return { ...confirm, confirmed: true, attempts };
    if (attempt < timeouts.retries) await new Promise((r) => setTimeout(r, 500));
  }
  return { ...attempts[attempts.length - 1], attempts };
}

async function curlProbeOnce(name, url, timeouts) {
  const fmt = JSON.stringify({
    http_code: "%{http_code}",
    remote_ip: "%{remote_ip}",
    namelookup: "%{time_namelookup}",
    connect: "%{time_connect}",
    tls: "%{time_appconnect}",
    starttransfer: "%{time_starttransfer}",
    total: "%{time_total}",
    errormsg: "%{errormsg}",
  });
  const args = [
    "-L",
    "-sS",
    "-o",
    "/dev/null",
    "--connect-timeout",
    String(timeouts.connectTimeout),
    "--max-time",
    String(timeouts.maxTime),
    "-w",
    fmt,
    "--noproxy",
    "*",
    url,
  ];
  const res = await runCmd("curl", args, (timeouts.maxTime + 2) * 1000);
  let data = {};
  try {
    data = JSON.parse(res.stdout || "{}");
  } catch {
    data = {};
  }
  const http = Number(data.http_code || 0);
  return { ...data, name, url, exit_code: res.code, stderr: res.stderr, ok: res.code === 0 && http > 0 && http < 500 };
}

async function getSystemProxy() {
  const res = await runCmd("scutil", ["--proxy"]);
  const raw = res.stdout || "";
  const keys = ["HTTPEnable", "HTTPSEnable", "SOCKSEnable", "ProxyAutoConfigEnable", "ProxyAutoDiscoveryEnable"];
  return Object.fromEntries(keys.map((k) => [k, new RegExp(`\\b${k}\\s*:\\s*1`).test(raw)]));
}

async function getRoute() {
  const res = await runCmd("route", ["-n", "get", "default"]);
  const data = {};
  for (const line of (res.stdout || "").split("\n")) {
    const m = line.match(/^\s*([^:]+):\s*(.*)$/);
    if (m) data[m[1].trim()] = m[2].trim();
  }
  return data;
}

async function getDns() {
  const res = await runCmd("scutil", ["--dns"]);
  const nameservers = [...new Set([...res.stdout.matchAll(/nameserver\[[0-9]+\]\s*:\s*([^\s]+)/g)].map((m) => m[1]))];
  return {
    nameservers: nameservers.slice(0, 8),
    scoped_utun: /if_index\s*:\s*\d+\s+\(utun\d+\)/.test(res.stdout),
  };
}

async function getEgress() {
  if (egressCache && Date.now() - egressCache.at < 60_000) return egressCache.value;

  const value = await getEgressFromSources();
  egressCache = { at: Date.now(), value };
  return value;
}

async function getEgressFromSources() {
  const ipwho = await runCmd("curl", ["-L", "-sS", "--connect-timeout", "4", "--max-time", "8", "https://ipwho.is/"], 10000);
  if (ipwho.code === 0) {
    const parsed = parseIpWho(ipwho.stdout);
    if (parsed.ok) return parsed;
  }

  const ipApi = await runCmd("curl", ["-L", "-sS", "--connect-timeout", "4", "--max-time", "8", "http://ip-api.com/json/"], 10000);
  if (ipApi.code === 0) {
    const parsed = parseIpApi(ipApi.stdout);
    if (parsed.ok) return parsed;
  }

  return { ok: false, error: ipwho.stderr || ipApi.stderr || "egress lookup failed" };
}

function parseIpWho(text) {
  try {
    const data = JSON.parse(text);
    if (!data.success) return { ok: false, error: data.message || "ipwho.is failed" };
    return {
      ok: true,
      ip: data.ip,
      city: data.city,
      region: data.region,
      country: data.country_code || data.country,
      org: data.connection?.org || data.connection?.isp,
      timezone: data.timezone?.id,
    };
  } catch {
    return { ok: false, error: "invalid ipwho.is response" };
  }
}

function parseIpApi(text) {
  try {
    const data = JSON.parse(text);
    if (data.status !== "success") return { ok: false, error: data.message || "ip-api failed" };
    return {
      ok: true,
      ip: data.query,
      city: data.city,
      region: data.regionName,
      country: data.countryCode || data.country,
      org: data.org || data.isp || data.as,
      timezone: data.timezone,
    };
  } catch {
    return { ok: false, error: "invalid ip-api response" };
  }
}

function envProxies() {
  const keys = ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy", "NO_PROXY", "no_proxy"];
  return Object.fromEntries(keys.filter((k) => process.env[k]).map((k) => [k, process.env[k]]));
}

function profileStatuses(snapshot) {
  const result = {};
  for (const [profile, names] of Object.entries(snapshot.profile_targets)) {
    const probes = snapshot.probes.filter((p) => names.includes(p.name));
    result[profile] = probes.length > 0 && probes.every((p) => p.ok);
  }
  return result;
}

function failureStage(probe) {
  const err = `${probe.errormsg || ""} ${probe.stderr || ""}`.toLowerCase();
  const http = Number(probe.http_code || 0);
  if (err.includes("resolve")) return "DNS";
  if (err.includes("timed out") || err.includes("timeout")) return "timeout";
  if (err.includes("ssl") || err.includes("tls") || err.includes("certificate")) return "TLS";
  if (http >= 500) return "upstream 5xx";
  if (http) return `HTTP ${http}`;
  return "connect failed";
}

function classify(snapshot) {
  const ok = snapshot.probes.filter((p) => p.ok);
  const failed = snapshot.probes.filter((p) => !p.ok);
  const statuses = snapshot.profile_statuses;
  const i18n = t();
  if (ok.length === snapshot.probes.length) {
    return i18n.allOk(Object.keys(statuses).join(sep()));
  }
  if (ok.length) {
    const good = Object.entries(statuses).filter(([, v]) => v).map(([k]) => k).join(sep()) || i18n.someEndpoints;
    const bad = Object.entries(statuses).filter(([, v]) => !v).map(([k]) => k).join(sep()) || i18n.someEndpoints;
    return i18n.partial(good, bad);
  }
  const reasons = [...new Set(failed.map(failureStage))].join(" / ");
  return i18n.allFail(reasons);
}

async function collect(targets, profileTargets, timeouts) {
  const probes = await mapLimit(targets, timeouts.concurrency, ([name, url]) => curlProbe(name, url, timeouts));
  const snapshot = {
    time: formatTime(),
    profiles: Object.keys(profileTargets),
    profile_targets: profileTargets,
    system_proxy_enabled: await getSystemProxy(),
    route: await getRoute(),
    dns: await getDns(),
    egress: await getEgress(),
    env_proxies: envProxies(),
    probes,
  };
  snapshot.profile_statuses = profileStatuses(snapshot);
  snapshot.verdict = classify(snapshot);
  return snapshot;
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit || 1, items.length)) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function formatTime() {
  const d = new Date();
  if (lang() !== "zh") return d.toLocaleString();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function color(text, code, enabled) {
  return enabled ? `\x1b[${code}m${text}\x1b[0m` : text;
}

function render(s, noColor, checking = false, streaks = null) {
  console.clear();
  const c = !noColor;
  const i18n = t();
  console.log(color("Probie", "36", c), s.time, checking ? color(`(${i18n.checkingNext}...)`, "33", c) : "");
  console.log();
  console.log("Network path:", `default_route=${s.route.interface || "?"}`);
  console.log("System proxy:", Object.values(s.system_proxy_enabled).some(Boolean) ? "ON" : "OFF");
  console.log("Shell proxy:", Object.keys(s.env_proxies).length ? "ON" : "OFF");
  console.log("DNS:", s.dns.nameservers.join(",") || "-", "scoped_utun=", s.dns.scoped_utun);
  console.log(`${i18n.egress}:`, formatEgress(s.egress));
  console.log(`${i18n.profiles}:`, Object.entries(s.profile_statuses).map(([k, v]) => `${k}=${v ? "OK" : "FAIL"}`).join(" "));
  if (streaks) {
    const failing = Object.entries(s.profile_statuses)
      .filter(([, ok]) => !ok)
      .map(([name]) => `${name}=${streaks[name] || 0}`)
      .join(" ");
    if (failing) console.log("Fail streak:", failing);
  }
  console.log();
  for (const p of s.probes) {
    const status = p.ok ? color("OK", "32", c) : color("FAIL", "31", c);
    console.log(`${p.name.padEnd(28)} ${status} http=${p.http_code} ip=${p.remote_ip || "-"} dns=${ms(p.namelookup)} tls=${ms(p.tls)} total=${ms(p.total)} err=${p.errormsg || p.stderr || "-"}`);
  }
  console.log();
  console.log(color(`${i18n.verdict}: ${s.verdict}`, s.verdict.includes("全部可连通") || s.verdict.includes("reachable;") ? "32" : "33", c));
  console.log(color(i18n.ctrlC, "2", c));
}

function renderStatus(s) {
  const i18n = t();
  console.log(`time: ${s.time}`);
  console.log(`${i18n.profiles.toLowerCase()}: ${Object.entries(s.profile_statuses).map(([k, v]) => `${k}=${v ? "OK" : "FAIL"}`).join(" ")}`);
  console.log(`${i18n.route}: ${s.route.interface || "?"}`);
  console.log(`dns: ${s.dns.nameservers.join(",") || "-"}`);
  console.log(`${i18n.egress}: ${formatEgress(s.egress)}`);
  for (const p of s.probes) {
    console.log(`${p.name}: ${p.ok ? "OK" : "FAIL"} http=${p.http_code} total=${ms(p.total)} err=${p.errormsg || p.stderr || "-"}`);
  }
  console.log(`${i18n.verdict}: ${s.verdict}`);
}

function ms(seconds) {
  const n = Number(seconds);
  if (!Number.isFinite(n)) return "-";
  return `${Math.round(n * 1000)}ms`;
}

function formatEgress(egress) {
  if (!egress?.ok) return `unknown${egress?.error ? ` (${egress.error})` : ""}`;
  const place = [egress.country, egress.region, egress.city].filter(Boolean).join("/");
  return `${egress.ip || "-"} ${place || "-"} ${egress.org || ""}`.trim();
}

async function notify(title, message) {
  if (platform() === "darwin") {
    const script = `display notification ${JSON.stringify(message)} with title ${JSON.stringify(title)}`;
    await runCmd("osascript", ["-e", script], 3000);
  } else {
    process.stdout.write(`\u0007${title}: ${message}\n`);
  }
}

async function maybeNotify(prev, snapshot, streaks, notifiedDown) {
  const current = snapshot.profile_statuses;
  for (const [name, ok] of Object.entries(current)) {
    streaks[name] = ok ? 0 : (streaks[name] || 0) + 1;
  }
  if (!prev) {
    const down = Object.entries(current).filter(([, ok]) => !ok).map(([name]) => name);
    if (down.length) await notify(t().notifyDownTitle, t().notifyDown(down.join(sep())));
    for (const name of down) notifiedDown[name] = true;
    return current;
  }
  const down = Object.entries(current).filter(([name, ok]) => !ok && !notifiedDown[name]).map(([name]) => name);
  const up = Object.entries(current).filter(([name, ok]) => ok && notifiedDown[name]).map(([name]) => name);
  if (down.length) await notify(t().notifyDownTitle, t().notifyDown(down.join(sep())));
  for (const name of down) notifiedDown[name] = true;
  if (up.length) await notify(t().notifyUpTitle, t().notifyUp(up.join(sep())));
  for (const name of up) notifiedDown[name] = false;
  return current;
}

function launchAgentPath() {
  return `${homedir()}/Library/LaunchAgents/com.probie.monitor.plist`;
}

function currentBin() {
  return resolve(fileURLToPath(import.meta.url));
}

async function installAutostart() {
  const plist = launchAgentPath();
  const logs = `${homedir()}/Library/Logs/${appName}`;
  mkdirSync(dirname(plist), { recursive: true });
  mkdirSync(logs, { recursive: true });
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.probie.monitor</string>
  <key>ProgramArguments</key><array>
    <string>${process.execPath}</string>
    <string>${currentBin()}</string>
    <string>watch</string>
    <string>--notify</string>
    <string>--quiet</string>
    <string>--no-color</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${logs}/monitor.log</string>
  <key>StandardErrorPath</key><string>${logs}/monitor.err.log</string>
</dict></plist>
`;
  writeFileSync(plist, content);
  await runCmd("launchctl", ["unload", plist], 3000);
  const res = await runCmd("launchctl", ["load", plist], 3000);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
  console.log(`installed: ${plist}`);
  console.log(`logs: ${logs}/monitor.log`);
}

async function uninstallAutostart() {
  const plist = launchAgentPath();
  if (existsSync(plist)) {
    await runCmd("launchctl", ["unload", plist], 3000);
    unlinkSync(plist);
  }
  console.log(`removed: ${plist}`);
}

async function configCommand(rest) {
  const sub = rest[0];
  const args = parseArgs(rest.slice(1));
  const cfg = loadConfig();
  if (sub === "show") {
    console.log(JSON.stringify({ path: configPath(), ...cfg }, null, 2));
    return;
  }
  if (sub === "set") {
    if (args.profile) cfg.profiles = args.profile;
    if (args.url) cfg.urls = args.url;
    if (args.interval) cfg.interval = args.interval;
    if (args.connectTimeout) cfg.connectTimeout = args.connectTimeout;
    if (args.maxTime) cfg.maxTime = args.maxTime;
    if (args.confirmConnectTimeout) cfg.confirmConnectTimeout = args.confirmConnectTimeout;
    if (args.confirmMaxTime) cfg.confirmMaxTime = args.confirmMaxTime;
    if (args.failThreshold) cfg.failThreshold = args.failThreshold;
    if (args.retries !== undefined) cfg.retries = args.retries;
    if (args.concurrency) cfg.concurrency = args.concurrency;
  } else if (sub === "add-profile") {
    const name = profileAliases[args._[0]] || args._[0];
    if (!profiles[name]) throw new Error(`unknown profile: ${name}`);
    if (!cfg.profiles.includes(name)) cfg.profiles.push(name);
  } else if (sub === "remove-profile") {
    const name = profileAliases[args._[0]] || args._[0];
    cfg.profiles = cfg.profiles.filter((p) => p !== name);
    if (!cfg.profiles.length && !cfg.urls.length) cfg.profiles = ["openai"];
  } else if (sub === "add-url") {
    const url = args._[0];
    if (!cfg.urls.includes(url)) cfg.urls.push(url);
  } else if (sub === "remove-url") {
    const url = args._[0];
    cfg.urls = cfg.urls.filter((u) => u !== url);
  } else {
    throw new Error(`unknown config command: ${sub}`);
  }
  console.log(`saved: ${saveConfig(cfg)}`);
}

async function runMonitor(args, once, status = false) {
  const cfg = loadConfig();
  const selected = args.profile || cfg.profiles || ["openai"];
  const urls = args.url || cfg.urls || [];
  const interval = args.interval || cfg.interval || 5;
  const timeouts = {
    connectTimeout: args.connectTimeout || cfg.connectTimeout || 6,
    maxTime: args.maxTime || cfg.maxTime || 10,
    confirmConnectTimeout: args.confirmConnectTimeout || cfg.confirmConnectTimeout || 20,
    confirmMaxTime: args.confirmMaxTime || cfg.confirmMaxTime || 30,
    retries: args.retries ?? cfg.retries ?? 0,
    concurrency: args.concurrency || cfg.concurrency || 3,
  };
  const { targets, profileTargets } = resolveTargets(selected, urls);
  let prev = null;
  const streaks = {};
  const notifiedDown = {};
  let lastSnapshot = null;
  while (true) {
    if (!once && !status && !args.quiet) {
      if (lastSnapshot) {
        render(lastSnapshot, args.noColor, true, streaks);
      } else {
        console.clear();
        console.log(color("Probie", "36", !args.noColor), formatTime(), color(`(${t().checking}...)`, "33", !args.noColor));
      }
    }
    const snapshot = await collect(targets, profileTargets, timeouts);
    lastSnapshot = snapshot;
    if (args.notify) prev = await maybeNotify(prev, snapshot, streaks, notifiedDown);
    if (once || args.json) {
      console.log(JSON.stringify(snapshot, null, 2));
      return;
    }
    if (status) {
      renderStatus(snapshot);
      return;
    }
    if (args.quiet) {
      console.log(JSON.stringify({ time: snapshot.time, profiles: snapshot.profile_statuses, verdict: snapshot.verdict }));
    } else {
      render(snapshot, args.noColor, false, streaks);
    }
    await new Promise((r) => setTimeout(r, interval * 1000));
  }
}

async function main() {
  const [cmd = "run", ...rest] = process.argv.slice(2);
  if (cmd === "--help" || cmd === "-h") return help();
  if (cmd === "setup") return interactiveSetup();
  if (cmd === "config") return configCommand(rest);
  if (cmd === "install-autostart") return installAutostart();
  if (cmd === "uninstall-autostart") return uninstallAutostart();
  const args = parseArgs(rest);
  if (args.help) return help();
  if (cmd === "once") return runMonitor(args, true);
  if (cmd === "status") return runMonitor(args, false, true);
  if (cmd === "watch") return runMonitor(args, false);
  if (cmd === "run") return runMonitor(args, false);
  throw new Error(`unknown command: ${cmd}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
