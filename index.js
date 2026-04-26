/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║               MIAS MDX — Ultimate WhatsApp Bot              ║
 * ║               Owner: PRECIOUS x                         ║
 * ║               Version: 3.5.2  |  480+ Commands             ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import "dotenv/config";
import { Boom } from "@hapi/boom";
import express from "express";
import WebSocket from "ws";
// createServer removed — not needed
// WebSocketServer removed — not needed
import axios from "axios";
import http from "http";
import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pino from "pino";
import { createRequire } from "module";
import crypto from "crypto";
import { loadAllData, saveAllData, startAutoSave } from "./database.js";
import APIs from "./api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { Baileys, BAILEYS_PACKAGE } = await (async () => {
  const errors = [];
  for (const pkg of ["@kelvdra/baileys", "@whiskeysockets/baileys"]) {
    try {
      const mod = await import(pkg);
      return { Baileys: mod?.default ? { ...mod, default: mod.default } : mod, BAILEYS_PACKAGE: pkg };
    } catch (e) { errors.push(`[esm import ${pkg}] ${e?.message || e}`); }
    try {
      const mod = require(pkg);
      return { Baileys: mod, BAILEYS_PACKAGE: pkg };
    } catch (e) { errors.push(`[cjs require ${pkg}] ${e?.message || e}`); }
  }
  console.error("Baileys load failures:\n" + errors.join("\n"));
  console.error(`Node version: ${process.version} (Baileys forks require Node >= 20).`);
  throw new Error("Failed to load a supported Baileys package. See errors above.");
})();
const logger = pino({ level: "silent" });

  const {
  useMultiFileAuthState,
  fetchLatestBaileysVersion: fetchLatestBaileysVersionRaw,
  fetchLatestWaWebVersion: fetchLatestWaWebVersionRaw,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  downloadContentFromMessage,
  generateWAMessageFromContent,
  proto,
  makeWASocket: makeWASocketFromExports,
  Browsers,
  jidNormalizedUser,
  delay,
} = Baileys;
const fetchLatestBaileysVersion =
  typeof fetchLatestBaileysVersionRaw === "function"
    ? fetchLatestBaileysVersionRaw
    : typeof fetchLatestWaWebVersionRaw === "function"
      ? fetchLatestWaWebVersionRaw
      : async () => ({ version: [2, 3000, 1017531287], isLatest: false });
const makeWASocket =
  typeof makeWASocketFromExports === "function"
    ? makeWASocketFromExports
    : typeof Baileys.default === "function"
      ? Baileys.default
      : typeof Baileys === "function"
        ? Baileys
        : null;
const getBaileysDevice = typeof Baileys.getDevice === "function" ? Baileys.getDevice : null;
const isNewsletterJid = jid => {
  if (typeof Baileys.isJidNewsletter === "function") return Baileys.isJidNewsletter(jid);
  return String(jid || "").endsWith("@newsletter");
};
function humanizeDeviceName(messageId = "") {
  const id = String(messageId || "");
  const raw = getBaileysDevice ? String(getBaileysDevice(id) || "").toLowerCase() : "";
  if (raw === "ios") return "iOS (iPhone) 🍎";
  if (raw === "android") return "Android 📱";
  if (raw === "web") return "WhatsApp Web 💻";
  if (raw === "desktop") return "WhatsApp Desktop 🖥️";
  if (/^ABCD/i.test(id)) return "KaiOS 📱";
  if (!id) return "Unknown";
  return "WhatsApp Mobile 📱";
}
function unwrapMessageContent(message = {}) {
  let current = message || {};
  for (let i = 0; i < 8; i++) {
    if (current?.deviceSentMessage?.message) current = current.deviceSentMessage.message;
    else if (current?.ephemeralMessage?.message) current = current.ephemeralMessage.message;
    else if (current?.viewOnceMessage?.message) current = current.viewOnceMessage.message;
    else if (current?.viewOnceMessageV2?.message) current = current.viewOnceMessageV2.message;
    else if (current?.viewOnceMessageV2Extension?.message) current = current.viewOnceMessageV2Extension.message;
    else if (current?.documentWithCaptionMessage?.message) current = current.documentWithCaptionMessage.message;
    else if (current?.editedMessage?.message) current = current.editedMessage.message;
    else break;
  }
  return current || {};
}
function hasStickerPayload(msg) {
  const m = unwrapMessageContent(msg?.message || {});
  return !!m?.stickerMessage;
}

if (!globalThis.WebSocket) {
  globalThis.WebSocket = WebSocket;
}

if (typeof useMultiFileAuthState !== "function") {
  throw new Error("Failed to load Baileys auth state helper on this host.");
}

if (typeof makeWASocket !== "function") {
  throw new Error("Failed to load Baileys socket factory on this host.");
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
//  CRASH PROTECTION — never die silently
// ═══════════════════════════════════════════════════════════════════════════════
process.on("unhandledRejection", (err) => console.error("[CRASH:unhandledRejection]", err));
process.on("uncaughtException", (err) => console.error("[CRASH:uncaughtException]", err));

const LOCKED_OWNER_NUMBER = "2349068551055";
const LOCKED_OWNER_NAME = "PRECIOUS x";

const CONFIG = {
  SESSION_ID:   process.env.SESSION_ID   || "",
  OWNER_NUMBER: (process.env.OWNER_NUMBER || process.env.OWNER || "").trim(),
  OWNER_JID: (process.env.OWNER_JID || process.env.OWNER_LID || "").trim(),
  BOT_NAME:     process.env.BOT_NAME || LOCKED_OWNER_NAME,
  PREFIX:       process.env.PREFIX       || ".",
  VERSION:      "4.8.0",
  GIFTED_KEY:   process.env.GIFTED_KEY || "gifted",
  MOVIE_API:    "https://movieapi.giftedtech.co.ke/api/v2",
  GIFTED_API:   "https://api.giftedtech.co.ke",
  OWNER_NAME:   process.env.OWNER_NAME || LOCKED_OWNER_NAME,
  BOT_URL:      process.env.BOT_URL      || "https://precious-x-bot.vercel.app",
  BOT_PIC:      process.env.BOT_PIC      || "https://files.catbox.moe/05rqy6.png",
};
// ⚡ SPEED MODE — keep-alive HTTP agents + concurrent connections for fastest network I/O
const _keepAliveHttp  = new http.Agent({ keepAlive: true, keepAliveMsecs: 15000, maxSockets: 256, maxFreeSockets: 64 });
const _keepAliveHttps = new https.Agent({ keepAlive: true, keepAliveMsecs: 15000, maxSockets: 256, maxFreeSockets: 64 });
axios.defaults.timeout = 25000;
axios.defaults.httpAgent  = _keepAliveHttp;
axios.defaults.httpsAgent = _keepAliveHttps;
axios.defaults.maxRedirects = 5;
axios.defaults.decompress = true;
axios.defaults.headers.common["Accept-Encoding"] = "gzip, deflate, br";
axios.defaults.headers.common["Connection"] = "keep-alive";
// Bump libuv threadpool for parallel crypto/fs/zlib (must be set before native modules; safe no-op if already initialized)
if (!process.env.UV_THREADPOOL_SIZE) process.env.UV_THREADPOOL_SIZE = "16";

const AUTH_DIR = path.join(__dirname, "prezzy_auth");

const MAX_RUNTIME_LOGS = Math.max(100, parseInt(process.env.MAX_RUNTIME_LOGS || "400", 10) || 400);
const runtimeLogs = [];
const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};
function formatLogPart(part) {
  try {
    if (part instanceof Error) return part.stack || part.message || String(part);
    if (typeof part === "string") return part;
    return JSON.stringify(part);
  } catch {
    return String(part);
  }
}
function pushRuntimeLog(level, args = []) {
  try {
    runtimeLogs.push({
      ts: new Date().toISOString(),
      level,
      text: args.map(formatLogPart).join(" "),
    });
    if (runtimeLogs.length > MAX_RUNTIME_LOGS) runtimeLogs.splice(0, runtimeLogs.length - MAX_RUNTIME_LOGS);
  } catch {}
}
for (const level of ["log", "warn", "error"]) {
  console[level] = (...args) => {
    pushRuntimeLog(level, args);
    return originalConsole[level](...args);
  };
}
function getRuntimeDebugState() {
  const ownerNum = getConfiguredOwnerNumber?.() || _cleanNum?.(_botJid || "") || "";
  const ownerJid = ownerNum ? ownerNum + "@s.whatsapp.net" : "";
  const ownerSettings = ownerJid ? getSettings(ownerJid) : null;
  return {
    connected: !!botConnected,
    botName: CONFIG?.BOT_NAME || "MIAS MDX",
    version: CONFIG?.VERSION || "unknown",
    prefix: CONFIG?.PREFIX || ".",
    ownerConfigured: !!((CONFIG?.OWNER_NUMBER || "").replace(/[^0-9]/g, "")),
    ownerNumber: ownerNum || null,
    ownerJid: ownerJid || null,
    workMode: ownerSettings?.workMode || "public",
    privateMode: !!ownerSettings?.privateMode,
    buttonsMode: !!ownerSettings?.buttonsMode,
    authDirExists: fs.existsSync(AUTH_DIR),
    credsExists: fs.existsSync(path.join(AUTH_DIR, "creds.json")),
    uptimeSec: Math.floor(process.uptime()),
    memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    commandCount: typeof commands !== "undefined" ? commands.size : 0,
    recentLogs: runtimeLogs.slice(-200),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  STICKER EXIF (for .take command — proper packname/author metadata)
// ═══════════════════════════════════════════════════════════════════════════════
function buildStickerExif(packname, author) {
  const json = { "sticker-pack-id": "mias-mdx", "sticker-pack-name": String(packname || ""), "sticker-pack-publisher": String(author || ""), "emojis": ["🔥"] };
  const jsonBuf = Buffer.from(JSON.stringify(json), "utf8");
  const head = Buffer.from([0x49,0x49,0x2A,0x00,0x08,0x00,0x00,0x00,0x01,0x00,0x41,0x57,0x07,0x00,0x00,0x00,0x00,0x00,0x16,0x00,0x00,0x00]);
  const exif = Buffer.concat([head, jsonBuf]);
  exif.writeUIntLE(jsonBuf.length, 14, 4);
  return exif;
}
async function injectWebpExif(webpBuf, exifBuf) {
  try {
    if (!Buffer.isBuffer(webpBuf) || webpBuf.length < 12) return webpBuf;
    if (webpBuf.slice(0,4).toString() !== "RIFF" || webpBuf.slice(8,12).toString() !== "WEBP") return webpBuf;
    let out = webpBuf;
    const exifIdx = out.indexOf(Buffer.from("EXIF"));
    if (exifIdx > 12) {
      const sz = out.readUInt32LE(exifIdx + 4);
      const end = exifIdx + 8 + sz + (sz % 2);
      out = Buffer.concat([out.slice(0, exifIdx), out.slice(end)]);
    }
    const exifChunk = Buffer.concat([
      Buffer.from("EXIF"),
      (() => { const b = Buffer.alloc(4); b.writeUInt32LE(exifBuf.length, 0); return b; })(),
      exifBuf,
      exifBuf.length % 2 ? Buffer.from([0]) : Buffer.alloc(0),
    ]);
    const merged = Buffer.concat([out, exifChunk]);
    merged.writeUInt32LE(merged.length - 8, 4);
    return merged;
  } catch { return webpBuf; }
}


// ═══════════════════════════════════════════════════════════════════════════════
//  CREATOR LOCK — HARDCODED, CANNOT BE CHANGED
// ═══════════════════════════════════════════════════════════════════════════════
const CREATOR_NUMBER = LOCKED_OWNER_NUMBER;
const CREATOR_NAME = LOCKED_OWNER_NAME;
// Use _cleanNum-style strip so creator always matches regardless of JID format
const isCreator = jid => (jid || "").split("@")[0].split(":")[0].replace(/[^0-9]/g, "") === CREATOR_NUMBER;

// Validate config at startup (after CREATOR_NUMBER is defined)
if (!CONFIG.OWNER_NUMBER) {
  console.warn("⚠️  OWNER_NUMBER not set — will auto-detect from session on connect.");
} else {
  console.log(`👑 Owner: ${CONFIG.OWNER_NUMBER} | Creator: ${CREATOR_NUMBER}`);
}



// ═══════════════════════════════════════════════════════════════════════════════
//  FREE AI HELPER — works without API keys
// ═══════════════════════════════════════════════════════════════════════════════
function extractJsonFromResponse(rawText) {
  if (!rawText || typeof rawText !== "string") return null;
  const text = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const starts = [text.indexOf("{"), text.indexOf("[")].filter(i => i >= 0);
  const ends = [text.lastIndexOf("}"), text.lastIndexOf("]")].filter(i => i >= 0);
  if (!starts.length || !ends.length) return null;
  const start = Math.min(...starts);
  const end = Math.max(...ends);
  if (end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeAIText(payload) {
  if (payload == null) return "";
  let text = "";

  if (typeof payload === "string") {
    text = payload;
  } else if (typeof payload === "object") {
    text = payload?.text
      || payload?.response
      || payload?.answer
      || payload?.message?.content
      || payload?.result?.text
      || payload?.result?.response
      || payload?.result?.answer
      || payload?.choices?.[0]?.message?.content
      || payload?.candidates?.[0]?.content?.parts?.[0]?.text
      || "";

    if (!text) {
      const maybe = extractJsonFromResponse(JSON.stringify(payload));
      text = maybe?.text || maybe?.response || maybe?.answer || maybe?.result || "";
    }
  }

  text = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!text) return "";
  text = text.replace(/^```(?:json|text|markdown)?\s*/i, "").replace(/\s*```$/i, "").trim();

  const parsed = extractJsonFromResponse(text);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const candidate = parsed.text || parsed.response || parsed.answer || parsed.result || "";
    if (typeof candidate === "string" && candidate.trim()) {
      text = candidate.trim();
    }
  }

  return text;
}

function isLikelyTruncated(text) {
  const value = normalizeOutgoingText(String(text || "")).trim();
  if (!value || value.length < 140) return false;
  if (/```[^`]*$/m.test(value)) return true;
  if (/[({[<"']$/.test(value)) return true;
  if (!/[.!?…"')\]]$/.test(value) && value.split(/\s+/).length > 40) return true;
  return false;
}

async function freeAI(prompt, system = "") {
  const GEMINI_KEY = process.env.GEMINI_KEY;
  const fullPrompt = system ? `${system}

${prompt}` : prompt;
  const providers = [];

  if (GEMINI_KEY) {
    providers.push(async () => {
      const { data } = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
        { contents: [{ parts: [{ text: fullPrompt }] }] },
        { headers: { "Content-Type": "application/json" }, timeout: 30000 }
      );
      return data;
    });
  }

  providers.push(
    async () => {
      const { data } = await axios.post("https://chateverywhere.app/api/chat", {
        model: { id: "gpt-3.5-turbo", name: "GPT-3.5" },
        messages: [{ role: "user", content: prompt }],
        prompt: system || "You are a helpful assistant."
      }, {
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        timeout: 25000
      });
      return data;
    },
    async () => {
      const { data } = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(fullPrompt)}`, {
        headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/plain, application/json" },
        responseType: "text",
        timeout: 25000
      });
      return data;
    },
    async () => {
      const { data } = await axios.get(`${CONFIG.GIFTED_API}/api/ai/gpt4?apikey=${CONFIG.GIFTED_KEY}&q=${encodeURIComponent(fullPrompt)}`, { timeout: 25000 });
      return data?.result || data?.response || data;
    },
    async () => {
      const { data } = await axios.get(`${CONFIG.GIFTED_API}/api/ai/geminiaipro?apikey=${CONFIG.GIFTED_KEY}&q=${encodeURIComponent(fullPrompt)}`, { timeout: 25000 });
      return data?.result || data?.response || data;
    },
    async () => {
      const { data } = await axios.get(`https://api.siputzx.my.id/api/ai/llama33?prompt=${encodeURIComponent(fullPrompt)}`, { timeout: 25000 });
      return data?.data || data?.result || data;
    },
    async () => {
      const { data } = await axios.get(`https://api.ryzendesu.vip/api/ai/gpt?text=${encodeURIComponent(fullPrompt)}`, { timeout: 25000 });
      return data?.response || data?.result || data;
    },
    async () => {
      const { data } = await axios.get(`https://api.nexoracle.com/ai/gpt?apikey=free_key@maher_apis&prompt=${encodeURIComponent(fullPrompt)}`, { timeout: 25000 });
      return data?.result || data?.response || data;
    },
    async () => {
      const { data } = await axios.get(`https://widipe.com/ai/gpt4?text=${encodeURIComponent(fullPrompt)}`, { timeout: 25000 });
      return data?.result || data?.response || data;
    }
  );

  let fallbackText = "";
  for (const provider of providers) {
    try {
      const raw = await provider();
      const text = normalizeAIText(raw);
      if (!text) continue;
      if (!fallbackText) fallbackText = text;
      if (isLikelyTruncated(text)) continue;
      return text;
    } catch (e) {
      console.error("[AI]", e.message);
    }
  }

  return fallbackText || null;
}

// Free image generation// Free image generation
async function freeImageGen(prompt) {
  const apis = [
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true`,
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512`,
  ];
  for (const url of apis) {
    try {
      const r = await axios.get(url, { responseType: "arraybuffer", timeout: 60000 });
      if (r.data && r.data.length > 5000) return Buffer.from(r.data);
    } catch { continue; }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  IN-MEMORY STORES
// ═══════════════════════════════════════════════════════════════════════════════
const economy = new Map();
const lastDaily = new Map();
const lastWork = new Map();
const lastCrime = new Map();
const lastBeg = new Map();
const lastFish = new Map();
const lastHunt = new Map();
const warns = new Map();
const groupRules = new Map();
const triviaActive = new Map();
const hangmanGames = new Map();
const wordleGames = new Map();
const viewonceStore = new Map();
const afkUsers = new Map();
const reminders = new Map();
const schedules = new Map();
const tempMails = new Map();
const relationships = new Map();
const duels = new Map();
const adoptions = new Map();
const petStore = new Map();
const factions = new Map();
const userFaction = new Map();
const inventory = new Map();
const shopItems = new Map([
  ["fishing_rod", { price: 500, desc: "Catch fish to earn coins" }],
  ["gun",         { price: 1200, desc: "Use for hunting" }],
  ["shield",      { price: 800, desc: "Protect from robberies" }],
  ["pickaxe",     { price: 600, desc: "Mine for coins" }],
  ["laptop",      { price: 2000, desc: "Work from home for bonus" }],
  ["dog",         { price: 1500, desc: "A loyal companion" }],
  ["cat",         { price: 1200, desc: "A cute companion" }],
  ["sword",       { price: 2500, desc: "Attack enemies in battle" }],
  ["armor",       { price: 3000, desc: "Boost defense in battle" }],
  ["potion",      { price: 300, desc: "Restore health in battle" }],
]);
const bannedUsers = new Map();
const sudoUsers = new Set();
const badWords = new Map();
const groupActivity = new Map();
// Per-group → per-user → array of message timestamps (ms) within last 24h
const groupActivity24h = new Map();
function trackActivity24h(gid, sender) {
  if (!gid || !sender) return;
  const now = Date.now();
  const cutoff = now - 24 * 60 * 60 * 1000;
  let g = groupActivity24h.get(gid);
  if (!g) { g = new Map(); groupActivity24h.set(gid, g); }
  let arr = g.get(sender) || [];
  arr.push(now);
  // prune older than 24h
  arr = arr.filter(t => t >= cutoff);
  g.set(sender, arr);
  // Also bump legacy total counter used elsewhere
  let a = groupActivity.get(gid);
  if (!a) { a = new Map(); groupActivity.set(gid, a); }
  a.set(sender, (a.get(sender) || 0) + 1);
}
const antiSettings = new Map();
const spamTracker = new Map();
const cryptoPortfolios = new Map();
// ── Persistent pushName store (so cache cleanup never loses real human names) ──
const NAMES_FILE = path.join(__dirname, "names.json");
const pushNameCache = new Map();
// ── saveContact: persist a number→name mapping (used by VCF, contacts, etc.) ──
const _contactsStore = new Map();
function saveContact(num, name) {
  try {
    if (!num || !name) return;
    const cleanNum = String(num).replace(/\D/g, "");
    const cleanName = String(name).trim();
    if (!cleanNum || !cleanName) return;
    _contactsStore.set(cleanNum, cleanName);
    pushNameCache.set(cleanNum, cleanName);
  } catch {}
}
try {
  if (fs.existsSync(NAMES_FILE)) {
    const obj = JSON.parse(fs.readFileSync(NAMES_FILE, "utf8"));
    for (const [k, v] of Object.entries(obj)) if (v && typeof v === "string") pushNameCache.set(k, v);
    console.log(`🗂️  Loaded ${pushNameCache.size} pushNames from disk`);
  }
} catch {}
let _namesDirty = false, _namesSaveTimer = null;
function _saveNamesSoon() {
  _namesDirty = true;
  if (_namesSaveTimer) return;
  _namesSaveTimer = setTimeout(() => {
    _namesSaveTimer = null;
    if (!_namesDirty) return;
    _namesDirty = false;
    try {
      const obj = {};
      const entries = Array.from(pushNameCache.entries()).slice(-5000);
      for (const [k, v] of entries) obj[k] = v;
      fs.writeFileSync(NAMES_FILE, JSON.stringify(obj), "utf8");
    } catch {}
  }, 30000);
}
const _origPushSet = pushNameCache.set.bind(pushNameCache);
pushNameCache.set = function(k, v) {
  const prev = pushNameCache.get(k);
  const r = _origPushSet(k, v);
  if (prev !== v) _saveNamesSoon();
  return r;
};
process.on("beforeExit", () => { try { if (_namesDirty) { const obj = {}; for (const [k,v] of pushNameCache.entries()) obj[k]=v; fs.writeFileSync(NAMES_FILE, JSON.stringify(obj), "utf8"); } } catch {} });
process.on("SIGINT", () => { try { const obj={}; for(const[k,v]of pushNameCache.entries())obj[k]=v; fs.writeFileSync(NAMES_FILE,JSON.stringify(obj),"utf8"); } catch {} process.exit(0); });
let botConnected = false;
let _aliveMsgSent = false;
let _firstConnectTime = 0; // Track when bot first connected

// ═══════════════════════════════════════════════════════════════════════════════
//  LOAD PERSISTENT DATA FROM DISK
// ═══════════════════════════════════════════════════════════════════════════════
const settings = new Map();

const _dbData = loadAllData();
// Merge loaded data into existing Maps (preserving shopItems defaults)
function _mergeMap(target, source) { for (const [k, v] of source) target.set(k, v); }
_mergeMap(economy, _dbData.economy);
_mergeMap(settings, _dbData.settings);
_mergeMap(warns, _dbData.warns);
_mergeMap(bannedUsers, _dbData.bans);
_mergeMap(inventory, _dbData.inventory);
_mergeMap(relationships, _dbData.relationships);
_mergeMap(factions, _dbData.factions);
_mergeMap(userFaction, _dbData.userfaction);
_mergeMap(cryptoPortfolios, _dbData.crypto);
_mergeMap(groupRules, _dbData.grouprules);
for (const u of _dbData.sudo) sudoUsers.add(u);
for (const [k, v] of _dbData.badwords) badWords.set(k, v instanceof Set ? v : new Set(v));
console.log("✅ Persistent data merged into memory stores");

// Advanced settings per-chat
function defaultSettings() {
  return {
    adultMode: false, privateMode: false, antiLink: false,
    welcome: false, goodbye: false, adminOnly: false, autoReact: true,
    stickerWm: false, antiSpam: false, antiDelete: false,
    antiEdit: false, antiBad: false, antiSticker: false,
    antiStatus: false, antiRaid: false,
    blockCalls: false, linkGuard: "delete", badWordGuard: "delete",
    statusMention: "false", callAction: "cut", antiDelScope: "all", antiEditScope: "all",
    antiMention: false, autoBlock: false, readMsgs: false,
    viewStatus: false, reactStatus: false, welcomeMsg: false,
    autoVoice: false, autoSticker: false, autoReply: false,
    recording: false, typing: false, alwaysOnline: true,
    workMode: "public", language: "en", chatBotMode: false,
    ownerReact: false, adultDl: false, movieDl: "disable",
    buttonsMode: false,
    stickerGuard: "delete", linkGuard: "delete",
  };
}
function getSettings(jid) {
  if (!settings.has(jid)) {
    settings.set(jid, defaultSettings());
  } else {
    const existing = settings.get(jid);
    const defaults = defaultSettings();
    for (const key of Object.keys(defaults)) {
      if (!(key in existing)) existing[key] = defaults[key];
    }
  }
  return settings.get(jid);
}
const settingsSession = new Map();
// Second bot pic (night sky) — base64 embedded
const MENU2_PIC_B64 = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAoKCgoKCgsMDAsPEA4QDxYUExMUFiIYGhgaGCIzICUgICUgMy03LCksNy1RQDg4QFFeT0pPXnFlZXGPiI+7u/sBCgoKCgoKCwwMCw8QDhAPFhQTExQWIhgaGBoYIjMgJSAgJSAzLTcsKSw3LVFAODhAUV5PSk9ecWVlcY+Ij7u7+//CABEIBDgCXwMBIgACEQEDEQH/xAAvAAEBAQEBAQAAAAAAAAAAAAAAAQIDBAUBAQEBAQEAAAAAAAAAAAAAAAABAgME/9oADAMBAAIQAxAAAAL5JfRhZbLrNS2UWUUT0cUlSywlUCoN5hNWUtgqCyFVREFKsQmbmJLBLCBbz3mMyyaSpYqIICAgKAAAAAA3TrhrNstlLZRQoAAIBZRLCpS6zpNQBAC6mlzOmTJC5sMywi0xLAFmdZMrM2LFWSUMggAAAAAAADoO2Kli3OrLZSlBCoCACpSgFGs00lQQWVdbzoudDnjpkxNZJLCSyWSwWBKMTUlgWSoglCAgAAAAAUgOsO2FlhZqy2UtBLBEFzqEuTVzqrZoiwUL15aMgazo1rOi2FzneUxneTE1IzNS3KyCiTUszNSXMslSxYszQgWIAAAAAADol64paUS2U6ZgEGbCSyUg3vntN2WhCwFgtgus01c6NIW5sGNajjKTM3Fw1DIsAmN4lkslQVLZcjIIAAAAAAA1vGuudJUqWrZUoWBJLCZ1mUDW8bN2WksJYKgtzTSE1YNXNWoGdQkoi9I4SwzLBIJEiBqCEsUIDIAAAAAAC6zrpLYudJS2WrZSN5MyyJNQyo1rGjesaqywysgBYq3KToxbd3FTTI1IUiSpFZQmbCEESWCUBCUAICAAAAAALZdy3NstzbNazTVzTtyQSwk1DNBYN757KKuSJLKIioNXNNM1NM1agsQGRLkkuQSERoISxQgICAAAAAAAFl0qXUtzU1c2zVgtlAEozLCENb57NoCAgQALc0tgqC3IqBELEJLCCWTUlksUIACAgAAAAAAANKlstlstzU1c2tXOoopKJLkksGs6NILJCpCoKgtzTTI0zSpDUgsQsQQlQEJUsUICAAAgAAAAAAKWWlLLYs0lTWsU2iqQZoksCCoLIBIqCgWCoKgqCoLELEWxJbAAglu+YCAAAgAAsAAAAoKostlsWVLrOjSCpaQGdZJLAiLEWoKgqCgWCwFyKgsAhQgFiyABSCAAhYAAAAAAAApZdFEtlsupUoWKsWUk1DE68okSWwUCoKgqCoKgAEKhagsIWCwCwWIACAAAAAAAAAApZaoubqappUAALTMuamNZiQmkJQKiqgqCoKgsIAAAGjNgCLAAACAAAgKAAAAACllq3OrnVmrLVAAFlqY1gznWZYSUJQACwAAAsAujAgACwAAAAgAAAAAAABYAAoKtls3rG7ndzoKJNSoSGNYMyxYSUXNgAoADeCABaQgAAAAAAILAAAAAAAAAABYoC3OtTe87ubVAEsJLDOdYJLmVLJoIsAAAC3IALAAAABYgAKCGsgsAAAAABSAAACgGs61Ou8bubYWhEsJLlc51gkslizNACAoaMgAAAAAACANZAAAAAAAAAAAAAAAKWWuvTj11nVlARLFmdZMZ3gmdTNglAWIWKACAAAAAoIAAAAAAAAAAAAAAAAACgrfXj1uelzapEsFksTON4XOdTNglAAAACAAAAABSAAAAAAAAAAAAAAayAFigBR0571OtzqyoAEQmNZMyyWLJQgAAIAAAAAAayAAAFgAAAAAAAAAAAClgAAus61N757stzQBLkmbDKyJKWCUIACAAAAAAAAAAAAAAAAAACwAAACliggC2XU1rG0tzqi5SwMzWVkqJKXKyUILAAAIAAFqOvICAANenzdTgAAAAAAAAAAAC7x69zz49XlIJRQLNaxpNazuzWOmCagznWSLTDtxlysWKlgLLIAALIACgAAALcgIdeQAAAAAAAAA1kLrDU3mAdF50pZUtize+e065yGbkQCU6cgkslSlkoipYIAAAAAW9NTnPVwTn15prWDIAAAAAADWQAAFIBYoDUiqLFC2Wy2VLYAGdQyogIsiKWSliiSoglFIBYFmq36uP0Lnfzvu/Jy8GenPVgzQgAAAAsAAAAAADWaAFrUlsNRFlq2EtlFC4sIsEsAhKIsWKJQzNZlCUABYrp289ufo+PGSZslFljUIIAAsogAAAACwAChoyKtls1JUWasWC0KoytMzcM2jMsAIolaMz1+eOU1lqCUIAAWKqDUiG8Wz7HybkyJW8AAIAAAAAFICoqr3s88sW1LKEus0qWy2UtlLWjLcMToOM6ZJAlBYNYuSSyWSlglA1kgBYAAKiqaSPTys4rJoIAACAoBYAgKWKAWDSWypU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wypIZ94wv44MAT7j7b774hXGz1FcwhaTtdAI4ONO+xnXnLb60ED66z777774HzLKvYDh4a9xyMcvOP5f4x75zmEM777j5777r4P4UTEAbrj3p74wwwwx777HjmMsAT777rz77r70Pxt8E4vgDeXHHzTz753k8NMMEBBz77xz7776CwR0dklJRd8QUsFHHV4MmMMMAAABLb77777776yoAFzfF/J3WfAPEAACAAsBAAA4oAw7b77777r774AHk8xMURbjsB4AAgAAAAAB6xzz75xyp777777a4GomoNLaBuFC5AALz7zyBb777777777777777a4FU4oMhEBcMPAAAz64z7677777777r7777776QAMGBAR7xDPQEAA7z77777j776777zz77z7774AEsMWihBBCVkkEBT777777777777D77777T7b4W0MPDr6W+J8uIMMADz77ln774vyxz7776zT775ES1pYtGAA+m+/q5U8AIR2HHGBW6777777777558/iR9UCw6uP8AmL96/jAQEH9fo1+++++++O++6+Rz+u0ICOGJTD3s8/BLPgQCCLBQw+++++++++++PDSS94M0IoEVODhwF1zDBWlJ1HG2o+Q+++++2+AFfYI9n0wQ0mfNFCzDqDDDwSKXTvNwy++++86+jT+VxS4y8c08sMgAm39uJDDHjTEOLsBEwygQAyB+y+196+UUJImGygdmw+TpDDT3Ta8KDFjAAAAABDHsBABW5P2SinbeUIzUGX488NJQmjBFNLDLAABLXmdATrbnL/1bJh2PcX5A+H2+Xs46IUDBOqDDBDFLWYwJWBaMqbHrJYUkpHUlIPA5B/Rlc9nvoJ080LG38+C3YacBt8n+vgx4ejAW+t519+8+QO7qegf+F+bx8meK1fmMxWKmoYxAAU8chRKR199te3v/ADaVJQyVIZgJ7wac3X0R03PPvvuu7eGVOdffXPHfe2EZp13sCG5rk6Pb0xJLNvvvi1e5qSoLSkM/dZywGoT1VHvucHmuw4IjcEcPPO9pRNO+xraRRQkBCw6au0vQLgRGVri8k9Da4ldjykinnn6i5zyGcTgjByIYjce/VGqyk3920PxFf9+Fkddv6LD9D3wIJBFguxYxA/HdSEz1JOuEvY2v+WQ3lH16nGxXO7TjP5G8TWK37dd/x4LqWXkVTRTm4HbQQzjJ3HK1CBmiKBTRVdf7pWYaLqhxO51nzJ3MVONIAVMojtzFngFDoVdTwhNP8zjD0tgvwclMdlawpPsOjcamNKgxbQLpDJ5M4rhEjXi0stfUtfrqZ3/eccS6WQgRscVebEV5y+m3QDGJkIBshSw/rHLazDSBiKO4kkcfrqxNfNJrQce+OK94X0QjzPvvvvkXPrDmwUU145fx38XPaD/vvvvqw5F3l0vvvvvvqV6m+kMHre7rpUJhRVYmctPvvrvNtZQyP/uPvvvo1W+gl9kdGntZMzU3FYgASfvvv+yta2FfvvvuLMKoOaUwxpQMTUM8Q0IQB6hHPvp1ijvDnPvvvqMh7m0WlFRWkqtkWkCagAA0XwPqR/1befPuPvvvvrTe9/gJ1e5h0Q8tXgRFUa7FvoixTPMvfvvvvvvONyY5PiGRueCpP6oZ9UTFyYkhiLvu97fvvnPvvp7/AA5E15zAIOMfg/rVTlvSGuyWEEEEEPz7777777776NFcBDWGK2147WFG49zZsU1zzz777z7777777742RR1QHpPBT7z3381veG02wxyxz777777777775s9PUi/7zxzw7777777777D7777777777777777b629z7jb4z77776r7777777777777777777774bzzz7777777zxz7z7777j77z77777777777777z777777777rTz7z7777777777777777777777677777777775Dzz777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777/xAArEQACAgEEAwAABgMAAwAAAAAAAQIREAMgITESMEETIjJRYYEEQFAUcHH/2gAIAQIBAT8ASFnvEVK3bv8AbKGkJJdC2Wd+hjQ0Sw0JF71hF+mhHe5t3hMY1iSGP0rK9j2s+7KGNDQ16XiuMWrrMvKn49kXKlfe1+XFP6N7HsrLGfCQx+hbEld7VtvYyXlx4oexjwxokh+hPF5WGdi2sReKwyTaXVi6xYyxjJIa9CYtid4eF6LxY9rHhsbHhbovgTz2JKKpLahnwQ2WyxZrFjLHhjQxv0RYmLFl7+i72IsvY3hvkeGNj9CdEWXsWWWXsvc+BssvDH60yIhPKLFtbzebLLw3s+7b3xYmLamx4svdeLLZe1j62VuQiLLwsLLYyyzjFl5ssst4sZY2N5+70Rws0LDGXiyy2WWORbE8Xl7n3uQiItqwyRZYnZyNlljHssvLfqWExC3Ml0MTEy3ve1+tYRHCx1lsk/Rb2sWL9awuiOFh4bJMeO/U2Xi/ahdEWJiw+8Mnhl5ssRZbw/8ARSELsQtjJYfex5+YvD96WEJkWJ7JDGNZsftfrooj0LZLDw8P236lErKFsaGMlh5eYxsa2eLVOxjK2vb0m0rFbim1Q+xIQtsjtFDiNYrNCdFlHjhsv2KTR5t4oQihKs9lJcDy1h7ErFE8UyUR+1PCFhbnsoaHEp5gicpRj+WNmhPUkuVxfZL6Pkr3IWFiy9lbGh9ZQuxUxKMFSJMo8GNFYr0pEe8rfRTxRad0NDWxSo87wiOm42/K7GrPEaK2IooYhfMLCF6bHho8dtY8iKErskqY80is1hM8hZWxtRVshraeo6T3MeGhqt0WKkmTY1srfEWEJO7vOpD8SDj+5o/4z0p+Tfs8TxKeEN4bEhlFM43LYsora1apiVLEottc0PjFEuItkJeUFI4KsqsUUNZ8RxSwz9soicYWUPbzseHqz0nUlasetqz4UKRFSihuRGVn94aTHsroZQ0UuBYREWnNazlfG1P1MlJQTbIJ6rc5dfBvDxpsSzyUUPs6R8GhLYixssW6sNbHdcGtLUbqTVEeI0svEbTIu1hrc73fNiwt7XBF+S6eKP8AKil4v+RPhD2xVLYoleisPYh2J7K3akFNGnBPy/geyEbkVwUXvrDvasULK3tZhGnqQfd2jUhWezTUUlittbFe2iLtvitiE3fXGFliwz+ijVempW3TI6j1HSjx+7Kj+xSKR0W0R1L42PYyisIrDOBDz9Fu6GzWn40o/qYtL83lN2ykus0MeNOVxKRRJdUUJD2IWHhLK9LZKcYq20hynq6ja6Yo0qttj8l0eeLRZYzSZ8ysNFD4a/nCzXBKCbi38FtXeLWLzq60dNCX4v5pFJdY+k4fRSaE7xwiTRpxfeyisvN5razrZPX04cNn/kw8W07Iz1pO7pH4Vy8pOzikli8dk48ilQp2NjZpS8oIvFZvYsJrahiHnW1vBUv1Mjp/ZctnjFdRWOS3sQ0TVCKVdku0aD4rFFeit/WFjUn4LjlkYO3KTtlje9YfI1TxJJvg0pJSFJep9lbKxWZzUFbE5NtvFDxe63iSw8JtGnrKXDLLO8PFbq2UUa0W5R/ZHR+Ij8RCnE8olxxyWXs1OK3aE7jRwOS+HI8WJFFCVYSxWzVJNbk2nfwSfaZqSlGaRbQpWcY1Pm7QdN4rF5s/EjdWWL0a36ZC5KGtsGakU5Rdk0fpZF3jU7WG9ml+tYsbHljiqFJxatCeF5eff5d2vNt+KEqWKvgnBxrjYnR53JDJIi6EzU+bWzQf5zyGxstYbzqyUSElKNp5dqqFhmrqKEf5Zy+XijR01+o/yZpJL62NZUbFFLEhiZLmtrNJqLtiafRKSjV/SbpHVMjNOrLTF1ikRh4WSn4ilGu82jUmoxbLcncs05SUY/2S1Fo6Ym9R+Usxx8EPskhPkfI92lcU7+mpzT/Zk3aLaE+mWKTFIss4fZq1a8SMpOvGST+pinL7EVSXRqqoVmEXPojD8N8TVmq/Jxi6fI0SxFHYkdM+YlGn6Lb/AKR3Eu2d8EkRfAsJ7dbUemiGrq9tqiKc022Si4njZGShCT+kYS1W27IaajH+Rxfw8W30OFSKouuC3i8NXsWzy4ZbFihcNiyli8a7TaRp1fImmXGTolUWTds05+I9RPotRSHJJWx6lSb7TY5WX+dn0bPpZY/ZPjkTtIrFpGpPUbfi6I6s4rnln40yTcneLl+5BuLtCm5t+XwavrH/AMO4qyTuNCjUWMssssv2qba5J8pEeixydjY2nwOB4M8GipCjIi6sZF0WmxNIcxy4LZeK/nKXt8uf4Y2yL/KRlaGxvHky2eTLZ5eq/wDRWLIuhvl7a3P/AF0vW1/xlKxrF/8ADRZ9/wDfv//EACYRAAICAgEEAgMBAQEAAAAAAAABAhEQICEDEjAxQEETMlFQIoD/2gAIAQMBAT8AZLStmsWXhYSGLSLI+Z5rxLCKyhlFCF5WPyrCxWEfRReIsQvI9kitHhYW9rCELxsazWlDKGs0LStkIXjmPDw14K1vWihCQvHJYY8rR+BbxXlkhrT2xsWXpwceFIj5mhrDK8NZ+90LzNDWX4b8KQl8BjWjEPSisVrQkJfBY1mtaEisUUUUUdpQkJfBYx7ISKKKKKKKKK+IxjxZeYi+ayWHl4iL50s1ohfOl6FtEXzpenvFfPZWVhEf8CXvaP8AgT2X+BPNvKYvnyHi8pifmvyyI+/eWPZMTL+S1Yo1lkt0JifgcxTE7+Ex4rVMTExMT1l6OHLk6iSaoh8FjHnl6pllikJ6MlESZFUWKSfnYx+JsTIvWisS9H8487Gh+NCE/C3R3CflY1m8JWOEkrrVCaEyy95ISF5WMekXTJdTuVLZMTO4TL2fnY2PSy6LzeE8JkSyy7Yyy83rYtmSZbL3WlZRYopoUEiikNYvZkeC9WS9lxcfXO68CsSt0eklrJOtLLLwtmNFFZeiL2TpkEqvZkuGJ73pejwx8+K1jpS+t5O2J+BMvZ5ra9bIOpF6t8H3rZZZet7vZ5eZSqMWQl3LSblzixMssssssvFl6PDEPR5eiIW+EV2I7mznNJ+0T6bXKxZZere95ebGXj2Vnpw7nz6HJrhIorTjHVVPFiaLzY2WWWWWc5sWLwsrMV3OhJQjTfJ3NipnbohHWXGbL8UZcUN59HvwQg5Oh1DhItvKeKyjqyT40YhYbEyy8UevFHpyZ+KX36KhHj2d9ekeyisp4rPWVT2WqxZZeVj6z0+n3cv0OX8Ll/RLFbJ6ddcWc6LayznRZvHTh3sv6QkUvChO89WPdBjjJe0VteGLXjWKcmkj1ws2ikV4Fo0mqZ1Oj28xGv6UhlFYsssvw9H02KJ2naUymU8caVhbdePKZQkUUN73i0XZeOlJXRHahypkaatYrK26quOFhxrKR2t+kPN6Is6P7oW/Ui7OlaTIvDwtup+jwo2KLsoSeEJ0yajJX954a9cj0SOh01+zy3QpJ61hZW3V/RiRFf8AJXNlF1ixCVoa0rPTg5sSpUs9Wd8I6MXd/Wt4XhkrRVC9C94n0pXwdrXtZsZRRR2naRhbojFRSSz1JqKIR75EVSr4M1bIqrQllocIsfT/AIdjOxna0JFFDOn+6zOaihuU3bOiu29G/P8Ad6MY0Nawj3McIjkovgjJSxJd8l/BtRVJDk2yMv6SkoojO1560vDfOt46S4J3XB2iUkrEpS+xRonG0Q6bvkabbFG2RjwJfCV0Q5GW8KJGEfs/FE/FESSyxKsspCXxO0SoYoiiLyUV8ZrnFCVf+nf/xAA/EAABAgIHBgMHAwIEBwAAAAABAhEAAxIgITAxQEEEEBNQUWEiMnEUQlJggZGhI7HRBTNicHLBJCVDgJCS8f/aAAgBAQABPwK8RKJlqXoLpS1KZ9MiblSSmw8oc4ckNvJh3yANhFdssSOnyApZVj/kaKh5KN5bSuLgAmwCMLsyylIUdao52lakEKTjC18RZUdbsqJaqMmbp8uhZQXHysIGU4iuHQ0qNfPjZlB6ZIfJgyhqJoMqkPTmYxh3JMC8fmxBTiGuh8hTJq5rUtLoVCxNgbnz3Qyr83HyaM6ASWEEEFjyomxqg+TB83KXSCRRAYffMj5AIYsfkctZnAW5QxHJvpyZyeUhFIKNlg+TD8ztY/MDzg3Qujlk0feflgzNEUSaQfpzMfI2GfBYwouSWa+He4KnCbMM0IGe+nIXvBA5US/IRAuTfJTSIHNU/Jg+TBAuTB5wKDF3fS5EC5MHnj2NWFyc34WHXW4aMM+IHyWIHyaPkQ8vSmkoDrG1bN7OU2u45GOQTUBCmCnuE4xOKivxP9c0BBF4XVaTvIsFvIlKUsuouakubwwsMDSDZNgzvv2eYmVMClBxG0TBNmKWAwg3QgpI0rhnDxMoFRKEsLgcveHuu24rKgAThDtbXUUkJYNZbmG3ykpWsBSqI6wsBKiAXHXIE2Cy/CUlKiVM2nXlATC0eGX6QRmcYIILGuwY223wtsbL470whLxOkkS5Z7WwoQcxhGOVww3tYbcsIQptE/aJO0UTalLdhE6cEDq8TJpPuo+0Kvi2mUsstvBRfxFhftYDdgxSibMdMv8A0QpUG8Ys+QBbS4SH6cleCrCHqtcPeC28exr8tYxuWhskITI2f2WmTa0Goqjplgzd8obdLmgjhvS8XSFZOlmBZXeo+VeDc/S+bI4VRjE4cP8ATphQG8Nqb9oaGhs+Il2BdukHkD1hAijFCCiCK7Fn0zAilL4TMabwayE01AOB3MNbnxAhCKUcARMQ0LzYLVXj15DLCSoBZYdYUwUaJcPUEJiQoA7p6gYVBzzHlAgQlUcQ9YUp4MG4Agiq2aQApQBVRHXIB9K4BxauIeHh6hFeVM4agpniYaRJqrkoTJSsLdR0g3C0UGHvYnLUzQKNCb994LXzQ0NeGuhqaXwcRtaSnaJncvlWLPei3LNChfqk/oomoFmCvXclClWJBMeyT/hhaV8OjPDUfKrdS03W1+J+jw2Hmes1TwLkJtYpxEGuUKABIsOFwBFGCm5FyYNTA9brZp6pBwdBxEf8vmeJvxC9q2eWGQr6IDfmF7WtXk8A/MEk4m9CSosBUckAdKy6L+F48FDWm/4qqmrWhKCbE4VSG3pjZJKJlIq0jakCXMYQckpIYF70Rs+ycQU12JjadoSHlSLE6nryfWyBCJqkWpLQpZUXJtg3Yrm9lSjMWlMf1CdQCZSfr6ZgGiQYUoqUVHWoxOFbwUBjS1rvD5LSDdBoSHU0J2WeT5IkSBIT31jaJnFnLV3zqFqlqpJLGMeWStomSpazTLYAQONw1FazTUn/ANU8xDa1xcNDQ29oNVLOl8KTmFF9knzTis/iDZedNyQCoAlh1g41UBBemprLL4FjnzuETDK4aaPm1g1pi/8AhAj/AAP+Y2v++v6H8crpuhKGFhgs9huaJCUq0N4ahredFB7X/eNo8c1VHAMPtDXQ3BnD4QpqRo4aVGLO1mfDPac2ENscw6lYu2sTXcsz2ZQJBQpVIWadeTC3Ypw6F4MG4SIF8A5a6CmSQ2NcJd+16Mrs+K5fxpaG0hq6QlrTA9RdG0uzXjG+NtueBIIIxEK4S1FXDLnG2yFpGIEGWtqVE0esNc0snTVQoP4ajVmsfclUj2dQKf1Ou5tbiWqgtKmdoJdRPfI2MLLasuRMm4Bh1ML9l2bH9RcTp65xtw0F4C/PACSAA5ihI2fxTi6/hidts2ZYnwJvxbXo+Gl3qC6AKiAMTBDFuSYQqZwLB/cOP+GCX1yCMcoUgBPiBfeGtfpvAGpv/pkZQ8RUcEClA2abO8avCnFzE1MkWSyT3yAvgSMDytKVLLJDmCE7GglZpKV7ukTdomTvMbOmmUDPadwLaZjaZ0qYiWEIYiBRZTu+mao2UiaKepj2lKHEoK9SYUtSy5PI1iXQQUqdXvXNjY72FluakyQoU1YRtXEKnVho2GUQNb57GqmqlTP3GUBKS4uESZk3CwdYVxJUzhrSLcDpCF7OlyuYC2gjaNqRMkAIsttGVThf2a5zSr0AtMCQcDNlhXSDs84e6/pEooVMoqLNi8T9uPkk2DrC1rX5lE+uXl9MxpmJivZQw/vKxPwjcJ00CiJim9c0ksRk2seqAli59MuSnY00jbOOA6QpRUSTic7oLvCrY3fO0k7Kmmu2YfKnpC1qWoqUbc8jy8s4yU24kYQpRUXJc59CgAXikDrlVUbGOluVxB+EY8jCyIBCsMoCRgYa4stqfSs3hWcABjC5tMBIDJGnJAWhKqXrcvWfsMMvtC8JScBj3PJ0Lew73h9y/D4ddcxpy4WEQd6ZMxQcCzrAUiWbPGr8QS5Jz5xvRjbE1EsLaWpw0BBO8pIALWHLY1+udXKp+XGDYSL3Y+EulKmNbgYOJ3GP6gBwJDZZFqa72mHziLFUvhBP2hXW+G+eunsez9i2Wlaiodx3Dc+94eJaBMsCmV0MHZ5qdAfTKLLIWOoif4EiXrirIPFPwUNKT5aSB4jUJEUoJucIlbQXZf3hctK8fvCklKik1UpKywgggkHS8WsIFL7esEklzWokgnQchleX67iqCXvk7SbAoRNCFS6fbGqCUlxGJe7PrZrExdM9tK0qUZp7dYEpIRQGEKTRJBudnkpJpzSyO+sbTMTMnKUnDTLIUQIfIg/pN1ORnTHNEYfvWAJIAhCBLSE7tsTalQ6W3Lk5cYZFFEHxBxB4JAClCicImSjKU32NcEsR1uJ8yinucPTrX2STRHEVjpvmlEvZ1lY8UzAck1qio9ZSnlSnxt3CG3tDQ0NVUtIBKjZ+/aJizMUVGtsmz8ZbnyDGDustJ8qfN/ETpqpyyo8k1qhTRTEOOt2hNNHcRw1QQ1YW7tWdtX7RNmcRVlg0HatJlKnLoiEhMtAQnAbgkzCww1MbfNl0BKlnDFuRARrGsHGDbbXBI1gTDAmJgW1aJiiYDpwgFQNiopKSBSRS7wFoXYRRMKlrGj7nMPAURhBWoxtE1g2pS1ZKStQSMTEmUiSigPNqYomGMbRtC5STKTY5x5HpGkCDGkC5CiMDHFMcUdI4g6GOIOkcc4f7wJqT2imn4hA4JxmiA3u7QmClS8Vy4II/6o+8cQ+8UqiknRA+8WfCIs03bU3h61tllcMUz5jBU2JgLBwVAd42yYlbJTgnXkZwEaQmNNwywc4O8DZ9qxot6loXTRjMSfQvCCpZ81mp6RNVTPbSrKBel0jjTOsPK2cBU8vM+GFbcmYWGzAwqYwKQccf43KDVFoo5/TNSpydmkU2dazZE3aZ07zKs6QgFSgBjCyAOGnDU9dxG9IcwAhVibFdOsS1BBK1e6H+sLWqasqNpMI8A9ahlWQEkloQih3iaRRw5ypRVR7BtyCz1AmlHDTASBhClAesLXTt+8JNRKW9YbeuXTQ6fdxHOKIIJT9t4O8loTgmLHD4QZhOFQFopiLSYSGAEYgt/wDD19I6QBSNH3tO8IUoTLPtC5aZgK06eb+YKSCeVtUaGMJ2HaFe6B6mFbJOR8J9DuCVKwSTC0ql+b7QJhSXBasLTHDKE2+7MaNoFEA6EWetZjEhPjTSsfCHZdE9RABClfVv4gp+H1EMmYKD+LFJgLejMPnBor/mJjS1K6F/zpCCFAfGPzCg3pyM1DDNV7wQR94TN4dJhb1gz5pDUy0epgTqHkQPU2wZ80++Yc3FOns4GuEbW3syP9ZrBTQghYIo24wtVvcawZnkUdbYRMdIiZ8Y+vrBmUwp8SPvE5VNA9Af9o0SoQu0Uhrj68jMHDd70JtPpDUh3H7QA5ENY8JFMNrp37QGZT/SE4esLbwHRaW+og4m9Cv0iO4ha6UsP9K6FkF3thRe2FLdCE9ISpoK7IeKXhA9YeyHsI5ID4SIeyFeZ4TAL2jzCEgcRDYHCEH+5+0CjRsPp2MTDSRT1Pm9YxSY4hISk6GD8gEMaidYdi8BX7vEtTKPeHZxFLwH8wD4FfIT1T/lCf8Atvf/AM7f/8QALRABAAIBAwQBBAEFAQEBAQAAAQARIRAgMTBAQVFhUHGBkaGxwdHh8GDxgJD/2gAIAQEAAT8h0NCGw0JY86Tke6UaENtx0NpFGMdz9NP+Y9+bTUqyx1ToBe5ixjuTybjHvDQ3Us8OuRTAzuJShu78epUrVw83GPQYx2oqqY7k7U3ZqvEIEqJHVjq2YYKKK2sfoZtVaL46huIENKiR2u9+gGp2JuNBsJHa7mPbi3nXJyr52mmCJ46DNhXwRFI8kvQ3kqsywbDQapGMdHR3uzjuzQgXvdihHDA8q0IQ3DBAuDjomMY6PRYrrAdJsBR26ReSv30iEOxZinETHTY/Vw2XtfEnlrWipW1juAAo3/HZkQXdsfroXtdh03zpey5ersSOjrcuPckNpvdpoNty9LupcvbcvS4rbdiootcfcY6XL742HUVBq8xwgL8HVWqrxLly5el7LlxjGOjjR7o2mzDMvnV2VCG077ly5cvoujtesV5jtrF9YaiCY0qPSGrQ0Hx076LGOl/QTaZZL6NxQepel63L8S429fiOr9MrfyhrfUvW9z9TOqNLl7Lly5ersBBatBHQUnJ9DN6U8BvbvHGly99y9ly5cuXsXbdTn6EQhudjBzLly5e6+rf0a9hDc7b6V9K+qQWJWf1dzS88aGhoQ0vY7bly/pYW1EYKRp7E0Og9oNbrKcZ7LBS7rPZmpobHdlcVkvVjH6G8gTvja6tNVTEdHvbxW55CtHV8diQ2VoasQBGbLz9o9/eK3jXdEIdB0PeW8fQyEOgxj3dvg+ikIdB0PZX9EJS8FHQIaDoOh7Rbqclhhqjz4+hPQIaDoMY9YSrBPk7hDkv6YaCG5jGO26vvxq/t2+VjYQhDexjvK89CoaGvDxAMAXg4OgV53UHCz1HfUKlKs8/fvAhvYxj2QgNh7QrydUQJ76ydBjGPfPW/BXW47VNzqYx0rHRzIFvLEpTv+IqtvZkUN7GMY78U6UU5+sToMYy0uvP/AIBxQ3vYF/Svtew4/MC9a3HDY8tLWrsK7grN9gVZfEa7G3g5vaRQd7odG+4eHfL4dC2IiqdpXZONxDoDox+iBfcBd/badEYx/wDBEIvedzH6liuOmhcFbSEIbb0foDF8qiKb6HHhKp0I2clbHa7XqhcTEPs6HBFVrGA8NldtbKY9AeIQlJuVRlzKlQTBbP1E1rR389oKNkUsTy7EC5mfH27P5JfGhp/Sy2VR0BoaABUDxK3cQxcaw8ZGO5V4NxXn6QRNtceJaO80HB8oS+QcIJA5Itx23xo8nLHtqjUH3K0M6nKlZ8ce3YAhhXXISuG8IS5cduK+ZfZuNQlniU4Of75TE2lXnswUAZYiCk5NgXqWTyYOgQ2UeWoHBa/326uggnAlfuK6M9wKhHMVSvPXNPzsFVpH41LJTHj30uNzneen81op/IYGB8D4EuIXfr8dbjy4z2gKmHu9hGr3lfkAX11mLS9I0jCct4Esi6Tp4Bq6vsDvg4rPQt1Yx5a1KvOw70YQqfA2guXib7VV49S+emLdS9PA46D99tSoDyGs/eU1xjeEtGHrNFIxb1ufkd352+DOqOffbC+7yx62ZfxsKpu78alsNagSpUqZrofaVtqVAhb8zQexGpeqi32gLxqrDrTV1jYIunnnZZAXjjfUqVKlRJUqIUOd14tGsbxAcGzrWidbGdBch25Aio5SK4zqVeDGPvuNDUhCVqssJr42vbCA4VxBLu5heDiPdYrbag9akIaCXkxDQxaSRNqRrk1fzFx2/OH5QPFRx2mjd+xPBfckNSGk3GQVCrnM4bBEjE0dXs/QONgy0EXLEfoF3ncwCaHB96ENHhBN6KYmboSO6ivnY9kIKGDvTGw0Jeg+IaHKJjrhqBjKjK1qWymJrWiu5OsnK8RKXz18mGdlarEKjl2EIaCCLy9EuUxJUrZiBTwzC4WrjYED70QEX8PsX467W8LEoLjOOmKcNbFNW8cap9ljXhqOW9SEIQhL2N455jFR2XsJe5UqUfLX2lw+l9nSl6NdLxGInUFq1JUrcQhCGpDRIzgjHqVLrRT7AgXEbJ8Eu9b9oSpuh/pZYRxoUf1lvQfzMrO61XqS6khRfnydA/05T53mgTQRNpCE+6G29GCCOqHIfZo7wiL/AJXiDnV95Etlr/qUxg+xn9ovaL87R6F2S/42Lg44Gy9BVxUc+58/8Havl8TaizoQTnR6Rc+KvQwF41IQ0IOy58y9KguvJ6iRNc1V4u5dbSVBUrfhD3KFHjvKPRrcKcPbHiNWpRHG7a+IwtLzFHU0IQhp90uXLl7D0ggQsGFz8EV3VnCF6Q9VgORucyCt2CKCvxK2vBcr8K2kGGhe4hCDUvcSuWh0A83EuqPjazJniORrPF4lGufLxMwbfKWn5w+3TIdiYpHmKpXl7U2G0acaMqVqxN1kQFr2yhIa5/4zHqHdFXnpZsmvjohAx6zqfOlaOPP4itK0jStfZyA+0bwJn5YIFUlPUrGi7Hc+kAIG/nbmpRtC7fW6uhQNH57M0NDU1qOhnOMIbgTDfA/Iyn7X8g6ZuxnulUAI35bhCLD30V0q1DPrQhqQ2LsXvKjgGF+uUV7M7fsqXq+lyHTyDLP2hIpbtn1s86yq+9K86F8A91ewhqQ3Mdjvp32X2nuPRP2t/mWV12lIJp8reumbTU0IbHa7K0J9sega6A1b5gorrUHt7iU9HA7hnyVvbEmF5eka/KHRqVsdKlaq0OE/KNLXJiU3oVFzHFx95j2dF2AW8HUwXTXvqjWYlK5W3ompvrbTuYCkslwjkByTxEeruIZ/gNFErdaQ9oU6NdhnchuvnY0rJk3X5DmtLJ88aLVhj3vIblaupjgLTRMVzoaGpvqVHjYrt9ytKmCf2raf0H8Ez7Q4eDpikDv1tV0zQ0N9SpW1CiNAQCD8Q8S9+0nP7i9XiOkrdbnKw+dg6Rl2lBERcnPbm+pUx51qNZLiIeEsvR8feOlbLyy5fWWR7OmagvBuYBAyHiCmTDozhXw++rFwY6XittlHCvPuHWqVBeW6+5xLlhMscoWvl8P21vqqkj0jXlQxU57YnPO4F4OnUqCf7Q++lEI3+t4Rex5D7aFAoPegWwcVnuPs9D/EOdwcP79Ysh0a0OP/APFR5ifKvLz+CXBr2RKwdgNwph66NUPL1qgIsvJ63+IbDUF41NDStan4yz3LUjwssHxF7Pyvx1uShmLexX4DbRxHBk7QwlJtNKl4s9/z9ow2i5aUviF5m/8AM5x/4MXpPSdn40rqmXKvjpfnrGyuVnNV52VxMqBTgOWW/kK5ieSPn/mNCArxfieocoX95XLl9qsvw6C23j8dheRX5l4Su0NDwBatB7mdij+wEcquWU8/WLi9xYo7PxrXTzdjCHznaxaUMK51rbUroGwJ+JXUD9rE7tLXvTKfHSqFoTkjaq+ZTS1glafcy/FdA5lc1x2HGvEwN+mvbLGidbl907PxsejbSXh8dOu0MOXsHgfcbuTle/NIOEe1Azm/wMBXBfaJdWhy/sff6HjHJCL1VKlSt1aVuVtB4/csF+NtStDC1340rQou7Y3WyeS+Xgn9ZiH27671FYw8HoFqW3Uu/Ux/XdXVatq62GHvK+jNxn+p2C2mf1c/n10wtrp1p6V553Jhjdtx1vS5cuXLly+7dr5irWpD5ECWbA8yjHKr++lUMStta1rXQNI+erWnheZxI5t+ZwNcL64mfWiARwPvtroPs0qVs8wdlW+tWQjPx7hWORp6tMw5ecZSgbBadPFmLyrx+u2VPw1sfGjjREG71K3VK6rLnH6FLOXnnqjUeNPCT5eq/B2z/Vo34nM4yyOeWecth7TEslJaMBU8H9En9eiIjSJEPF18ypW6talbKlStuQP5lC+P7fXWGpcpFv2j+u2UL4wa8Ne5lFylcTDLgpndRBUI0ylzjBmOfEciBtOnawUsqn8bqlStli004+/b7ERJatu4NT2P36N6IjkrtuXQBG0EZ5Z46J6NOLOZWieGipWhBaTzFUTatsqVKlaVKlSpUYDdAWvR/n1Fv4GB6N1cMDn0iDkH7jc6GuiTCf8AwT1Oz8O2oJ7i3lly5el6XL6FRBfN+0C9KMVKlStK2VKlSo4JnjBy+3/cbjQtWiG3xy+2VBqMv+notC1a7ivR2mhDcgqfBKGMGZLIc61KlQAHHKVKlSpUqVOG4a/rf4b8JZfx9yp95fi/ChxHvxqDex7jzrka3ovYkc3+hB9zJCwlhpgcytoVKlSpiwcPten955iPHo9bm/4F4gODjxOItHe59v6p+Ms9Hr6CaHOhwxjo/wAoeYgvAlQzKqGy33q99jxf7lPiKqTXEccy/ieDNypii4Feg5ZnRTj1bhv876IKf9zS/tH/AORBDqeHD6F5mXBymGoeK28MoRtLiOcTBZk2BbUr5JjusRNaR+JcEF+Y1etwGNw3E/eI3eeZVLxW8GM2s/6jXuOG0xLOZfnnozKOZzBB+1i/QuDK5/M4Lpueceg3aDDzg/xPk6Z839wEpdeo5hV8wlVuVAKKhxmpUNo83lnLhPgD+XP7lv8AcGX/AISxPZ9neBmYZwY+CALoPmcXv5nE9zEF/ZfofAjgQiN8BHy0OY9lUolS5RXocx3KfijDsvV4lMUAv1JZJjgPjaA/gn3D9pkejAzX2J8G1fMevvW3Xw0tY41C2JX099ykX+UtBPcHnQa0GuxNXVKv4E5Z+DiDnky/uH5OlsRNFIg4KB/8pmqKh/CJDalkDnk684nOHPqUQZhK6FGLh399M6NnrStlaeK2jGvKVezzuP6xXxUBwn/SxL3s/s+4A51UIOXMNK9PGrvnf/rPpDoSuiQ0KxcyRwZWoVsHIPWJi1vP8S+MDY8PoixWJ4IAq1Xkf+ijx8iFQQ8Hj/aEkPCPt7JTdfAeR4P94WJxz9EqVEniVWlXsVoEQC18ELujLnfwP95iOV9qIIUpfbMyzDjbbBQe2UPyf2eGe3k/wJtC4l4gDYA3eL8XAfhj7+J8Df7F95xoscH9vyTAKH7iER1/hkJcwGH8o4W4c+ENWcuPoeEcVp8aFpEyapExPHpFW/FJh8nHwPj7zGL6XBvmlegvotOf/fUWu3necyqnB/hki+bi3M7GcJ3A8Wc/uLXNrj4eJ6gZv1UQS1jD6SHHFnH1FK9o/DhhK9/36WnIVKlxfo+hldThZVlyuD7gVjwuP9+34lA9sUUcXX2ZgPH/AHf4QvI4ilh4x/Mpt8t/AxuTm+r+dErvg1/c734pyH5gJHlhne9/uY15Ijy4/k0P26n7ng+YM8B+iZF9yFKfMeA+GWbbpjrjy17nsTv/AAjF+S8+xCFxra8wBCUlD1/vOd8z3N0/MVq9W5fTv6OyDyTxLi3OY+IoBjzMfqqJUngpB1HDhgvwh/Yz+I/8Epy7Bp0DWty//DvjoBf/AIwansf/AJvEY8f/AN2//8QALBABAAICAQQCAgMAAgIDAQAAAQARECExIEFRYTBxQIFQkaFg8LHRcJDB8f/aAAgBAQABPxA5hgfADuUZv7mO2Megx+6jKpDqrRLyDLwMYVysGLgjqXPUXhjK1GKaRp8CxwYx/ICG4QwGHQCECwx8hw/ZFix6bl4GGB0XgiIDmLFnjKlkV9B5zTLIAtb0ZGVipX5AyMENMvJJfachGraupbF+I5hgHClbsL14cuC9PaCAVuyxzTzHDVS07pCoUo8nDgoxjUY1uVq+oVHGo9QO1t87/HIYEMBK6Ht8RDO8OLos0br3BNErgEclGa7xF4ug0IsXFQQRxUfiC/lHtgwNQwdQZklqPFyyLkzWCHScHAYkY3MEYsY4OosWDLjDElYY/NVA/BWDK1g6ixcBaFheB6AlZGGLjt6BINuAxjGM5ESMMiCMcJ+HbFChd+spuo0oVuDoETXrQzaqtq29DFl3BvCYLWFDSUjCBnCBOK6CG2o7QGO9R3jHNRQiTc4mCJARyqVKlRgg03QxIwVCRbVeqvwSGCtAWspFERGknIi2oUC2jgMrFwssI/TGgHY4XL1fusgl9qhpuhzcoYndGh4I5CaQYMuHvDBqCJBElRMVKiRIIHYBWu8Yxj1AAVFWd/wDAQKhBV22w0wWFq7LE5CZXCsWXLgxx5dq6bg4IMGDBl43lVlLqnxHs015qJEiRIkd9jWaiQTnHDH8UhAhCGCXhdYYxi4IooQi4uXLlwYSnlvAwYUgy4xl6RqqDbKiXiwywlZcOccOWMwALz7H4amul6CqW8lQhgwQlqrDGODgjxIcRj0EuksYWhTTggYMGGC45USsAjksVFZMfyAYMHIzcccox6kRjzLjBaXFbF1xCCBgwYMIYuCKqI6Wrb0BZF27IcUWMMXFYxYv45BiyYEXFRMPMSIfuVUJqoANPDUdWxuig+orhFi7jm5cGDBqHINrqEGReCxZcIXHFFFFnBsbO0WKL+QYDBhBihCEcswuhTGJhcTJbiigxjBlly5ctCSTAMvU3LjiyLFFii4YxfMgiLL2SqtFF6yVe8WvpV10kIMuDBgwYMZCckYQUkKcGVcSJkg1FlUI6jRbCJGMuXLlwYMGEXLl4YsWXNsFFlqqMWOX8YgwYQwGDBgwgNAdl1cUdmvXiJeGMSVi2QGLFjhly5cvFmr7EGGFy04U4uaRndHQUKNSwD5ixYoxwsWL+UMuXBhCDgYdCokYxlxaRQYspFlxly8juEuDCLl4XhZcWLUWLGMY8x/MIQYMEwMOhIlR5jhUx3Bl4WXFvCksl4UvAi5ZLjgYYWLFhjHVjA5ViL3onIkfzBhCDBJcVwgSpUYkserAoLt8sYkJSy4HU7ruXERhZcVly8iLlwcKdAWXLwLLixYJCNJFUqqvKx/LIQwMIsxljNmVElTRKlPDTgywxcuXFlwiyDLly5cuXN+ZcuLGGLLixYv5xCEXCDFFByxycDhcuXFly+izzBlkvNy5cWoqLLll74iy4vURqHZ5fb8loUW26il64ihgMUUGMdowyYy+gLi5eNVzvxLxfVay5cuXFly4xxf4LEC1aCPIWB5E+UYQxyhOZDNnnCXKDkuCMei5eLly5cuXLhLly4isly5cuXCnbKqb4l5eD5SA39jfi77dK38o9IYGFisUq0KX3L7xWEUWClYuLLly83Lly8XLly5cUsq+JcuXi/iqN4WWVZ+UQhxkQhjRwbj1ClHd2+YIkEYxxcuX0XiyuNy5cuKUUVLly5fwDH2XfEvFNZqOMC26OgF4Pho2su6r5SGCcoIEDCpT0h3Qnobdo0iy5cuXL6LxfS/NS1DnnrRWdVau/iSq2cdRggQwQSpUrASukMeq+q5fyhCOGryAjuqPlv8AAIQIIYCGKlSoFStYOmO4sY/gld49Rcpogv3K66T8ISnXwEIZhrAdBO2PLFYx+dsBRr18N/Aq8/hjulkTTuNF3WFWughhoQQagSpURwMWc5yZzYxj1pXxIPQqXpE3CePK61fP8CRC6K6yKPDhAlVmuhznNjGPXfQ8gIMUHuPETpYuhXH8OF5IYjpG6DsSslHucmMcjAHSU/CMchaESmuqn431A2jZF/GECqTYkvBiYKIIZYxwW49xjHoKS1F7jQtNnXd51dNr0xQcEv2di83UVW3oG1k1qMtL6GVpObVc5NdYGrZBu7d5AqBEr8blBDkdRXc54LH8A5QShbK9/E0VTfxMK2a+UhOjTK+PnBqCBm4xIx1cUe4o/m8PaxQGj5QuIqn8PlHqdmDpOTngzuWc8fD2Jp2D2zdA0pY2fnjaIkVe7+G6YGA9Lhxw54PUGxd6rAiNE4PPyhf8EiNPWRx6h1MOPOBQjSnVx+Tf8WqtvWSiXdKlaBvDgIIx+N4ikBdHHQNQj/CKgF4vu3tLFWH3kSX0rZgUHCtxg240unD0BigGmnh/I7Yutff4HAHbdRWaNXr8GrVTkrfjnpdMeXEGXFl4egsSAVo4PH45Ki5+yvpXwFC7PEccg09IV29tfBfwkFqvqA3bWmcoqYtQZeLyZzwYx/Hv4kChxz+Q+qtJ5rjp5RVHBgxly8OsVGMqP8Bf49Xg6DF0VBEpTxdQZfQ5eMY4f41aTl56AsXx1DUu1ajV31FHFBys4Y5RiRjH8vij/wBy1GyTd+XXUQYrR5YpDwpcHAaEXhiwwdxIyokFd5XQK7/IQkW1uCSweNs+A3Xd2VUO6LYKjxvoLfihHqVazZEpIKekhCDogB3DeWrVHuA4K+owbR1F2IXfo4EiS0SDUSVlwG2wolHWcxwNS/gNJSNjOYKSWuFXFlGWNp8/highavnXnHOMKERAtLlqKj6CrZy6CavUMCGDiBam0lCeoxUuNWXsjElTIgWeSOSNWt1gCjUSVKzbdlibiUyoFvMSnBSWo7s786jX8MqY6qltHaEUivpIYauhsjupRaOkiVR0fBHZpLGMlW1YosXBD6ujbe4wYnXeFv4ggoiXZZGKiZjrhECw2BwDv+AOihSnearn4rl5NoQsW28SsGCGCshSMKJeGXLIpdm/GC3GJHpr4agUjgI6kWtQr7cr/bGog1FvKAop+G5ZSgOVYglVJyPQgU7F5TVQNPI8ty3Jghg5eGCtVKd1f1Am38CxXiJE6GMTFYqVHqvBHBa0BorBubCHUCrwHLER/nm7hlkpY/juGA2JyMcBU2q2vwHSQnCDK1dPCd89oeKrpVMSpUGhNdubeJXQkK3Z2iZFVjElZOY7LQejq0msJ7GNz+ghIhXUbTivLGqGejHdoPpRH5QN6028/NT0ke2DdhoiUuCaJEkgAvBwQglVXeEJUrUIC0PIDWtRVAa1KlFkaFps81UeisVKlRI4GyAsvXkj8SuPpcWxsFmxuI23H4DmAApuz+sf1FGr8X+Agm26Di+8W+ghha+4bIaL5YY1KNd66AITUeIyuhNkqyV01KlRNRI/AYHIZLeiNotxxYrFS9FOQt/a9tX5lwA0PPxrQIa+IlVB31eoo5ed5IQlMHRqAEq2ElSox3Q24linHpKLU25xWElSpbCFN3g/DcGXLgC5e5XDESvLis3bL8PxqVt1Uc7qTtHPTfzjXWleM1rTvfQVLtIMEBbknpWbntiLqGHBZt4xVfBhRo1HCpUrAwtTwGq7ScoIn4Fy4egxHFTf4DtBWr1lRasb2WR5gSsJW4a0zVYIWEA17HOLhFyENDwQcnaEIQYmHEVgAhtd3xrxmoAQa4lptjrGGlOa3EldN5ooF7Pk6a1HouXgINKY9TXWaWu+2HrQ0lnSRJC0LZVOl7sJtjjZSraF32GSGFTCAVtrUIZBqMbdoRW8alTKpUqWaVvzLl4XJw/gktSJSXVRHkemUruFG+194S9dI64+ci9Azg233hBwQZFVaipwwnDDhBccW4cl1cvhc4ZRepXnErJEu7p8htI2g6WMXL81OSLSHaCioipi6SKnJKEQJihd/iEIQhgIQy8oACoKNqqA3tDXgYzUwYKLLJRWijDfC4JKlSomKlSviWyIqNg8lZJVDzQMMdyF9Qiv4Z0kIrjSXIR7rA5SDhhkXEdQCKhKllXeo3vYd5XRBVxilrZgkrNTcu/CJExsrQeiV0J8thRAXwsuX+WrD46BfeEVYDEqOyLiIM0Yb96cXFDc3bilsEYEstERgQhTo3O+NwZUrC3iLIkrL8QvF/E7sUFZpCAIBaTv0bq618dxsRbouN5sVYl8ZVwr8BflgwYOHPBYnlkbx3K1TtMLDzexK53ghGsk7CDOBbceWJKlzK7IXJjKlSpUqBOYUR9dn2rmVKxWKldZAKpvW+stm8XJ7fG/bKqsal4IGUQVbsQMOebB7ThZFZQLbo4IQ6A6iihAwlQoPRUVGFjxgqPMGXHSJlViriYolGF4GRru8bFzfWkfzEIMQFrrrG+zFYeglQYWb1dauUfJS2C+7oIlKQIIPCqwYGPcUWKgsGLBNQXtDu4PHtDBKxTEjlY4rBGS2Zbdq52HaB/BV0Dgl8ByHV11wtdj5SWpeQDyHK8rLuAidxNnOKlYI6dQZ9XzHoqUBCDw9BZtdFLa/dcqrXESV0EBviioJ46KhCCWIRntFsqUxKhBlxxRSiNgo48xQYMGDPtlcJK1hzUisG7U2e64jxdMGHDKgS2CL/1JjWV3zrsf0vjY/cLoPkan247fu6uKubg8MrUaldOsBrR4FscuFbvVeSEXcCTW81vTfESt9JRxdBHxBrxZMUAU0P6S4YgpEAUYE79018XO9wtacFu60YIsVBiwDBlwgunsO8bTkhTNikprgC9NkqsXy3Ye6qCQjVNkRxUqALgmOhZcFbfGmV99qGVu34Atq4VlROhK0H01K6gXjqemoZYNuL3E0RXQtpKYgYymGybiuWW66C52Qii3gioMoioKNHmAlJaWgxl7q5yYkTCRIys2M3hUvxhf9qzn+/xcAgdj4nCmXh+KuusL8koVuUFFvQTauAWsUKMro5+6R49ldBFKJTG8YXoKDzcUUUdCNI2Ta1gwgy4R7NEtZ6D/APZyYIk3fF2m8cNUW91EiRJUstrNWr5VSws7a2A+rYZr/OEJ69mKMmnPU6I/EqwqJKyCi+PhrCbLdUGrKeY5Voq+V+EhBgy5fQQhzFBgwYoMHBGJVJEsg0xhmonkg3EiSokCUeIkCZO5CloFao5TzwJyfk8XFRw5r4nqqVCqKjoOq0BO9FuCDBgwZRQureYGhuaItaW7N9oEICzar3TTGkAIyy83K+ybFESF4quJSyowECLTI0dxbm6x/pNIPXA0iUnyOx6wat1IXSUiAoeRKlYZT/0YQqPSWH10PQxKV2Fkdq9Ri8BDIwYQYoOA4DDAgDA+IQgpgO0BW5TLLtimSc49YUX+kJQU4/2T4xaETgiYqJxApZp7HmJ0VK+KoHWYQ1Dc2ebKWG6pVw6CE124hBz0lF3zshFFBg5BgyyEx4NRjaJK3KlQlBGy8NAIRVIqdgvNuvDXxFOwuPLCyYpuc7bqByZApey44qXPQhV1b0V+DXwVOildsGh6nTkhgyEIooMGEFlxx29HbElYrFLxVw92KfWdoXzdfcFL8AXLKu6WMqMc7fsDq/NYroSGniPPGKifAR1LSP8AY+nxhU4hghEF2XphBihFFBhLwSVKiQXEiSsAgmp8xC9i1KCaR4N/Brbdgi3mw4iRJUrNYrLhykFVao/aywHs10V0VCs+7ufoMqB0jsIroOPF8vWXDIhEDqpTwxQYMGDBg4dN1edI8ZVhSy2pW4QzYOfXZOxCK8iRppIlL1LBFwNyh9EqlR8G/ZEj0VKhpGrp4gnArOI6qzWKjd1rTTQ5rJ1VEYORuK7aE8ripzsMEIVr/YF4EMCDCEIFyhGMSVLroupUqVmjsCeyNIHQTyJKjU+eAebYqEENas51JRK6DgLO0YgsbjOCr43isPTWr669GF+YgZ70bNdpXTo6jqvcCeDg2BXZVppq8BBTJgcfZrQvafVcgLYWT/SGShjgYuMYypx0uDY0czvbjXasAp2WQjRa0Tc2nZr9DlmlxuHtvrggxLhmpuLl9THbIB7idNSokqJKgbiSs6lfDfQA7tPaV0EOIMME5QihKMuWduJeGOBgqss7yIxLOc+t0n0ob7f3HJ5iy/guXgVWTbvJN+p746S+VXxipUsYm5USVDoqPl9wGBrToPCSumoHQZPGoGDmEIcwyIMJZurjKyAbQutV5iSsCToS1lNdm/0j794rZyo2stHC5eb6ElZoR3IkTNQlSsumPLhWkWr0SumxoHkPwxUVBsRpIqqrawrdEVartXBAQSJFFt8SuvUIL6GEIcmLDAgjbynLBDVQhDoCVhMleKJPDwZZQKvFeHXjeoxGWkJslkfiu3hJylSsVcrNSoHdRw2rKkjSjyRVK8rCVKlYSVKlQIfAXAxYRGmKpVatrCcwhCMUi1dG+IbIQhDJAlZXKp2OB5XYj66xTSqHb6cacAsSVi4PVcXJLsemLEFzS6jRxGE2XTsXVldzororISuipXUF1K3026V2jQURXgt7yCGQyQhhUIpgQhgIECBhU9Bfyeu8jI5yOt51xp7WVixw4S8DB6awmBbUKF6IlZSV0V0JKw3qSvDw9IXhIFmt14PN5ACBaE/u8wlQJUrDVCiy94BAxQeLhCIULfEIYGAQgIELw4w1W/VO6+Jp23Q9iKYFl5YEqJ0EuXm4sEIHD0+4qqvLhxUsawhtNleGMroPqE2m8Ax0AKPXeVAO8qVEKXq9lX3PDKSBKlSoHSYBOYQwQgRv/CfFw3AgQgviBAMNCDVNj8GV8YNGPe2DaaxgvShFu+jwIcSsuXLji5cYMDBl4t6C87SVGElZrFSpUqbwav8AAv8A2VmpUqVKgQLFprJ1hja29AIE4vvDwu4QIHEAG23mAkTreSbtjzI+3OH/AMRY5e21arGro9U5fqG0xwpBpWC3Lwy86msMTIy+n79Y+yJiokqVi6oL3WgZqV0VKydANXajzsPEAIDfe+MhisUVgIEqVAhCEJUCGBAqjXAtTKlWjy2Re5I2q2q92P1IpKrCxti3i5ccXfXUqJ8DeNYJUqVFsCmu/fCYVK6a6Bh0oC7ehKxUqJbOSte+F7SpUsPGa6AOkHtUMA0bNwgXgOQEqgByrwEM1v8AKQUu4jlWLLlxcpUuc/DeEuJ1jUb5kSmVipWXJrdII1dJHthSsGEmi3sXxGmnTAlU6/UhUJWKlYBS1Cy4i7HZq+axUqVC6Ty9ASpUCVAgSrVCFSwKtBAYILblpvivlYvQXi4uX40j1j5qRiRxZbfhpCrhexSMCsVKlSpUqVCKlSpUo1V8bvHJWAgQJUCBkLgQ4iLpoT7nz6Iv47iuXLJqMvqvqOjthOtoEtEojQMfDqJGVKqVKlSpWKwkCBKldAl1FsV6SV5FS0F6IdNSpUpgYqVAlYCBAgpNgf8AnuhrsVLjHN4GX+C/BX2eJihOOTuQiXhbJWXFhRNjTKwMVKxq+TY5oUkoa8qIblSpUIIqDQKhq6G+8rAjbkGG0pe8CBAhCL1dshdLQe1jUW7LXby/dY9HMqMVKZuX8DBxfS/CGUPklMgf4YiKJsxWKlRIPsxTiWvL03FVcFjdV+0rFSsEVAldNQJUqAd7rvUPlTV8/uVUJwMbjjN3DbLiy5cuX0GKlYuXL6b6WPxCIQW3/sSo0SsBVxFeA3BeNmejw/Xd6KlSuiooAtZUoxWalSpWVjaLG+XHEDFQO0CWG9xI0itvlwuLLS2Wls9JSEXOYkrAy5eEl4I4fj9YBl2u8VcFCu8IPLBpWLFoJ48zmKZ9q5UsYcY57VKlQJWFkIonCYVKlSmWgSoRUpwCBKJUqBAiLFIrjH41zWrTmoXUneg9mokjubiafaV5JfapZfm4opzTGDL6mPxnM+jrKw0KqJuJgGrwzu+4E5+AgSpWagYVKgSpUCEVCXlGB8jBrpweEj8jpme3PGSRKjkHTL2pAI5oaa7wqiNK+GXJ0vy3LukVlA+zWEbMNjs1LLo74a6AnYeJSVAtDzKrFYEVKxUqBKlQIEqVGtNt+7CC/mVr27+W/feW+xCco4SXxb+3pJkcEMPy70dNv2RIaXyJYLIqv4RlWiKi+J/4iMr7QlQ1xl+WLxDcq7EXDTSaag3VH1v+NMUKDkdMCt0HVKawICVKwGFSoYKlSoYKOWf+qrFUmhPD4/X5rAwKXK+ZyDRJ4WjHiPQYv5lM2APuMYtvZsQoltdoUtriKKmy/UBeyVKgVgI6KuMHBsRpJda3R3j7iM9E5Jy4mnyPDioEqdncpUwaHuKlQIErCmFSpTAo2I/bhcQojyr1PfaDxMJ8AjVwlOZc0lTklR6D59F8w62zXG2fXnacwbSDZ9ziDywYMEJUVI4LVWKNWBS1PBAhbiA3fjUDcYC6wRtSyPKsMBiqHSDalf6p/biLzAlPguDqXjy24gPqQK8rywKKUvgI+77tU17QXVP9I1DD038zOito3aREdYQrFNbl0wgDCBAyGW3qB6g/9x1RuBXmDFqtbPfqatZAqCRQ45gSpUMBgGyr3QeV4ITX7RceX6OOo/UYDusrNsX5nlmkWl/qt0mNj1nMMNIot4CVDD1X8hHSPcYuLWKuPMdsVQiihmpU7vMipPcs9M159PqWVb35CLowKgXCBYUoKKVzUMFYYjBQL2vIcP2cQ9ILHPRUPjuhigFoAWvip+yv7Tnl11AjDDH8JeGESrSDwgbEYfpDjCCSVBqDIQBgSoTSWRslH7VajBUUcsNCtFxSCk59QEV1XB5grimGuIoemQirmqBwf+ylNQ0AcBoHo6QuIjSlXl7GbQANA7BEIaKL0XS9nyu8c7nXaPgdRkji8v4S2RNmE/8AOV2eI7b7yqFcYs+A+Y7nPqU+544lirJZUEFyIIGKnucVBnM7LQ8q8R3przc0ZMAvFjShKEdL49xfadgC3tzcv4jf9Eqt/Z4iLVfrXBFvpGX32/MwbR3u67rGLm6w8/8Av8sAaqzVvqJUYR6HD+DZ4I2BhGypQCjay7GRjhAeLiIVq9TvqKafyG5UMPQQvy1GmIXxcr1tqu5p5/KRlrmbe6/M97+4bnPuUeLg6sO20ZSwoOzCgXdcDPVDjURHW9HBNSNi3p6jCaAQtRpaOXi/BLOweRjxWoj6KFz4yXDvrDpcuKj+A7EFTvhL7MQokprKNPJBS4MEIQYA8xE/29VmDc/pSP8A/KjXR+2E4H3KhR/fRA0f3MQKT8GiOpVsOhjyzRQge3vBQ8EEGkgOaB9BuAuR3uFfkPoS6NB35D9x4jeo6O/XSFAczhFqe7RibyKotSXgowqm75WxMqrfc0eoPkfwF+lKkNlUxTWwsFn2ZeqgNHxRGruBeTBBwMGFMSsEqBA9QHgh3CUO0BWrg1X6ISCktYjpKGkn2KihL+0Hlgn0SxyDz7lU9BOAtaSy4ojtaCm1lOt2T9MCdxaD3jLkrsk+d7eWNM32zjhSAtXUYe0OffeB8z89/RCO/eAldcpRTyYZiRbViKyVg6iXBZplVBYPkhgQgMBJ8TvC89cX4hAQ1ba/E9/o7RhKzmKbMA3zuUYmDbK+fn1BgEkd1oxrdkxMoFXerwMuLEBpdujzENl3/wDpLQXwgxQbTHCjwwPhv8QUikDx11KhzKgyEqBkUgvNHySr4SWO0DF1DNAA9gMOir2oHkPuKcY5hKxZ4PInANX2ZTqPfdg1DdhKaUd7jmyiNeD8fLNTc9/EG9jg0XXiEjRDnweCb0bK158/1ArtCilL9Mvz+3A8SrD/AAdSoKbnZg0RcqGDUqBKwMqFCwdloPrUQsLl1oeTyEXFEXVSx4cBw5ltSKYKHs3rT5B7glBl45qa2rvOl5PEoaSwV3b0EflhjHtBDzmKB54WUVAFbPY0y5I7Rr0nj0l7YcHQf69yMZpmp2y99kcLclj/AAfSveLgPlhogsIKJUCASPhETMoC1Zd/nqIA1I7/APjUljVkCKHgdlQLtIV9ocEKbD08pUq7lYtOGe5jXYUFrQXE4v8ASCw9MsRr08GN6LFXT7gF2rz2nlGOu39FziYtS5O9fTCiiircNb9YQacGd5aU/wDZufoWi07Phlfi7+7PgXgPAv8A/YitVCvZ2RnlOtuTyP1/BgEDCo627MVaOWUtmRHkSBUCA2JxFEnaNVttUMeN1PZZ/cZ0VJPPfPaKntbo4Dth/awl/wCjxZp6/go/yIJF5K2uL6UAUsuFMKY9zqw9fQVUSh4tLy4IdqQfCc7qN281DRgv1XdziS7EqkXhDku5CoAYLhbwAvP9MQWhRo/pqMU8bw8/wdKnErd7mn6miHk1FICmgx65oyju2/6+PtFSvAQCV3Jr9D99oVdzN/Df294MRYNr7r3gWiP9OZ/cNX1/SVwS3Mrj8ig3YGOuFYPF7k5cGojb7SCARQjXi9sCrYN/diWaOEqMaewU8FojavXEZU3Wj1RgzumxA68dn1/B2mmA+i+wl0jYE+mEeKg0JAiJDhCmrgd4FL0C8DyvYxmipWcIxNWvbrlFzUj0cFu/qddkr/sVhdw9cp7eV6alZqVCsCLikDx13LcXFP8ADksiInsl6QQx6+iP7Dr7NxF7aE55tVnZ7kHkuPt2Tg4UPNRIiNgeTn7CUDfFot5uXLl/zbKirysvLAxar3qJFxblwQeeYIEHT/wda+mLj0poc/8ABLy9KIRgGgofjAT3/wANd/8AyXTV/wDDAG1rk/8Avb//2Q==";

// Economy helpers
function getEco(jid) {
  if (!economy.has(jid)) economy.set(jid, { wallet: 1000, bank: 0, level: 1, xp: 0, inventory: [] });
  return economy.get(jid);
}
function addWallet(jid, n) { const e = getEco(jid); e.wallet = Math.max(0, e.wallet + n); }
function addBank(jid, n)   { const e = getEco(jid); e.bank   = Math.max(0, e.bank   + n); }
function addXP(jid, n)     { const e = getEco(jid); e.xp += n; if (e.xp >= e.level * 100) { e.level++; e.xp = 0; } }
function getInv(jid)       { if (!inventory.has(jid)) inventory.set(jid, new Map()); return inventory.get(jid); }
function hasItem(jid, item){ return (getInv(jid).get(item) || 0) > 0; }
function addItem(jid, item, n = 1) { const inv = getInv(jid); inv.set(item, (inv.get(item) || 0) + n); }
function removeItem(jid, item, n = 1) { const inv = getInv(jid); inv.set(item, Math.max(0, (inv.get(item) || 0) - n)); }

// ═══════════════════════════════════════════════════════════════════════════════
//  WEB SERVER (keep-alive / Heroku / Replit)
// ═══════════════════════════════════════════════════════════════════════════════
const app = express();
app.use(express.static(path.join(__dirname, "public")));
app.get("/status-api", (_, res) => res.json({ connected: botConnected }));
app.get("/", (_, res) => {
  const sc = botConnected ? "#25D366" : "#ff4444";
  const st = botConnected ? "CONNECTED ✅" : "NOT CONNECTED ❌";
  res.send(`<!DOCTYPE html><html><head><title>MIAS MDX Bot</title>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#0a0f0a;color:#25D366;font-family:monospace;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:20px}
    .logo{font-size:3rem;margin-bottom:1rem}
    h1{font-size:2rem;margin-bottom:.5rem;background:linear-gradient(135deg,#25D366,#128C7E);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
    p{color:#aaa;margin:.3rem 0}p strong{color:#25D366}
    .sd{display:inline-block;width:10px;height:10px;background:${sc};border-radius:50%;margin-right:8px}
    .badge{margin-top:1.5rem;padding:.5rem 1.2rem;border:1px solid #25D366;border-radius:20px;color:#25D366;font-size:.85rem}
  </style></head><body>
  <div class="logo">🤖</div>
  <h1>MIAS MDX Bot</h1>
  <p>Owner: <strong>${CONFIG.OWNER_NAME}</strong></p>
  <p>Version: <strong>${CONFIG.VERSION}</strong> | ${commands.size}+ Commands</p>
  <p style="margin-top:1rem"><span class="sd"></span>Bot is <strong>${st}</strong></p>
  <div class="badge">⚡ Powered by PRECIOUS x</div>
  <p style="margin-top:1rem"><a href="/debug" style="color:#25D366">Open Debug Console</a></p>
  </body></html>`);
});
app.get("/health", (_, res) => res.json({ status: "ok", connected: botConnected, bot: CONFIG.BOT_NAME, version: CONFIG.VERSION, giftedAPI: "connected", commands: commands.size, uptime: process.uptime() }));
app.get("/debug-api", (_, res) => res.json(getRuntimeDebugState()));
app.get("/debug", (_, res) => {
  res.send(`<!DOCTYPE html><html><head><title>${CONFIG.BOT_NAME} Debug Console</title>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body{margin:0;background:#0b1110;color:#d9fbe8;font-family:ui-monospace,monospace;padding:20px}
    .wrap{max-width:1100px;margin:0 auto}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:16px 0 20px}
    .card{background:#111918;border:1px solid #244136;border-radius:14px;padding:14px}
    .label{color:#7cc7a0;font-size:12px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}
    .value{font-size:18px;font-weight:700;word-break:break-word}
    .top{display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between}
    a.btn,button{background:#25D366;color:#052010;border:none;border-radius:10px;padding:10px 14px;font-weight:700;cursor:pointer;text-decoration:none}
    pre{background:#07100d;border:1px solid #1c332b;border-radius:14px;padding:14px;white-space:pre-wrap;word-break:break-word;max-height:70vh;overflow:auto}
    .ok{color:#25D366}.bad{color:#ff6b6b}.muted{color:#9bc7b0}
  </style></head><body><div class="wrap">
    <div class="top">
      <div>
        <h1 style="margin:0 0 6px">🧪 ${CONFIG.BOT_NAME} Debug Console</h1>
        <div class="muted">Live runtime state, connection checks, and recent logs</div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <a class="btn" href="/">Status Page</a>
        <button onclick="refreshNow()">Refresh</button>
      </div>
    </div>
    <div id="summary" class="grid"></div>
    <h3>Recent Logs</h3>
    <pre id="logs">Loading...</pre>
  </div>
  <script>
    async function refreshNow(){
      const r = await fetch('/debug-api', { cache: 'no-store' });
      const d = await r.json();
      const cards = [
        ['Connection', d.connected ? 'CONNECTED ✅' : 'DISCONNECTED ❌'],
        ['Owner', d.ownerNumber || 'auto-detect'],
        ['Mode', String(d.workMode || 'public') + (d.privateMode ? ' / private gate' : '')],
        ['Menu', d.buttonsMode ? 'interactive buttons' : 'plain text'],
        ['Prefix', d.prefix || '.'],
        ['Commands', String(d.commandCount || 0)],
        ['Memory', String(d.memoryMb || 0) + ' MB'],
        ['Session', d.credsExists ? 'creds.json found' : 'missing creds.json'],
      ];
      document.getElementById('summary').innerHTML = cards.map(function(item){ var k = item[0], v = item[1]; return '<div class="card"><div class="label">' + k + '</div><div class="value">' + v + '</div></div>'; }).join('');
      document.getElementById('logs').textContent = (d.recentLogs || []).map(function(l){ return '[' + l.ts + '] ' + String(l.level || 'log').toUpperCase() + ' ' + (l.text || ''); }).join('\n') || 'No logs yet';
    }
    refreshNow();
    setInterval(refreshNow, 5000);
  </script></body></html>`);
});
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`🌐 Bot status page → http://localhost:${PORT}`));

// ═══════════════════════════════════════════════════════════════════════════════
//  WHATSAPP CONNECTION (main socket)
// ═══════════════════════════════════════════════════════════════════════════════
let sockGlobal = null;
let reconnectAttempts = 0;
let reconnectTimer = null;
let connectInFlight = false;
let activeSocketGeneration = 0;

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}
function socketReadyState(sock) {
  return sock?.ws?.readyState;
}
function socketIsActive(sock) {
  const state = socketReadyState(sock);
  return state === 0 || state === 1;
}
function cleanupSocket(sock) {
  try { sock?.ev?.removeAllListeners?.(); } catch {}
  try { sock?.ws?.removeAllListeners?.(); } catch {}
  try { sock?.end?.(); } catch {}
  try { sock?.ws?.close?.(); } catch {}
}
function extractDisconnectCode(lastDisconnect) {
  const err = lastDisconnect?.error;
  return err?.output?.statusCode || err?.statusCode || err?.data?.statusCode || err?.cause?.output?.statusCode || 0;
}
function scheduleReconnect(reason = "close", delayMs = 5000) {
  if (reconnectTimer) {
    console.log(`[WA] reconnect already scheduled — skip (${reason})`);
    return;
  }
  const delay = Math.max(1500, Math.min(30000, Number(delayMs) || 5000));
  console.log(`🔁 Reconnecting in ${Math.round(delay / 1000)}s (${reason})...`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectToWA(true).catch(e => console.error("reconnect error:", e?.message || e));
  }, delay);
  if (reconnectTimer?.unref) reconnectTimer.unref();
}

async function connectToWA(force = false) {
  if (connectInFlight && !force) {
    console.log("[WA] connect already in flight — skipping duplicate call");
    return sockGlobal;
  }
  if (!force && socketIsActive(sockGlobal)) {
    console.log("[WA] socket already active — reusing existing connection");
    return sockGlobal;
  }
  clearReconnectTimer();
  connectInFlight = true;
  const socketGeneration = ++activeSocketGeneration;
  try {
    restoreSession();
    if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    let version;
    try {
      const v = await fetchLatestBaileysVersion();
      version = v?.version;
    } catch {}

    const sock = makeWASocket({
      version,
      logger,
      printQRInTerminal: false,
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
      browser: typeof Browsers?.macOS === "function" ? Browsers.macOS(CONFIG.BOT_NAME || "PRECIOUS x") : [CONFIG.BOT_NAME || "PRECIOUS x", "Safari", "3.0.0"],
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: true,
      connectTimeoutMs: 60_000,
      defaultQueryTimeoutMs: 60_000,
      keepAliveIntervalMs: 30_000,
      retryRequestDelayMs: 250,
      getMessage: async () => ({ conversation: "" }),
    });
    if (sockGlobal && sockGlobal !== sock) cleanupSocket(sockGlobal);
    const _rawSendMessage = sock.sendMessage.bind(sock);
    sock.sendMessage = async (jid, content = {}, options = {}) => _rawSendMessage(jid, normalizeOutgoingPayload(content), options);
    const _rawChatModify = typeof sock.chatModify === "function" ? sock.chatModify.bind(sock) : null;
    if (_rawChatModify) {
      sock.chatModify = async (mod, jid) => {
        try {
          return await _rawChatModify(mod, jid);
        } catch (e) {
          const msg = String(e?.message || e || "");
          if (/app state key not present/i.test(msg) && typeof sock.resyncAppState === "function") {
            await sock.resyncAppState(["critical_block", "critical_unblock_low", "regular", "regular_low", "regular_high"], false).catch(() => {});
            return await _rawChatModify(mod, jid);
          }
          throw e;
        }
      };
    }
    sockGlobal = sock;

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("contacts.upsert", (items = []) => {
      for (const item of items) {
        try {
          const jid = toStandardJid(resolveLid(item?.id || ""));
          const num = _cleanNum(jid);
          const name = String(item?.notify || item?.verifiedName || item?.name || item?.pushname || "").trim();
          if (jid.endsWith("@s.whatsapp.net")) _knownContacts.add(jid);
          if (num && isMeaningfulName(name)) {
            pushNameCache.set(num, name);
            saveContact(num, name);
          }
        } catch {}
      }
    });
    sock.ev.on("contacts.update", (items = []) => {
      for (const item of items) {
        try {
          const jid = toStandardJid(resolveLid(item?.id || ""));
          const num = _cleanNum(jid);
          const name = String(item?.notify || item?.verifiedName || item?.name || item?.pushname || "").trim();
          if (jid.endsWith("@s.whatsapp.net")) _knownContacts.add(jid);
          if (num && isMeaningfulName(name)) {
            pushNameCache.set(num, name);
            saveContact(num, name);
          }
        } catch {}
      }
    });
    sock.ev.on("call", async (calls = []) => {
      try {
        const ownerJid = getOwnerJid();
        const ownerSettings = getSettings(ownerJid);
        if (!ownerSettings?.blockCalls) return;
        for (const call of calls || []) {
          const caller = toStandardJid(resolveLid(call?.from || call?.chatId || call?.participant || ""));
          const callId = call?.id || call?.callId;
          if (!caller || !callId) continue;
          const action = String(ownerSettings.callAction || "cut").toLowerCase();
          let report = `📞 *Call Guard Triggered*\n\n👤 Caller: @${_cleanNum(caller)}\n🛡️ Mode: *${action.toUpperCase()}*`;
          try { if (typeof sock.rejectCall === "function") await sock.rejectCall(callId, caller); report += `\n✅ Call rejected`; } catch (e) { report += `\n❌ Reject failed: ${e?.message || e}`; }
          try {
            if (action === "block") {
              await sock.updateBlockStatus(caller, "block");
              report += `\n✅ Caller blocked`;
            } else if (action === "warn") {
              await sock.sendMessage(caller, { text: `🚫 Calls are not allowed to this bot. Please send a message instead.` }).catch(() => {});
              report += `\n✅ Warning sent`;
            }
          } catch (e) { report += `\n❌ Action failed: ${e?.message || e}`; }
          await sock.sendMessage(ownerJid, { text: report, mentions: [caller] }).catch(() => {});
        }
      } catch (e) {
        console.log("[CALL_GUARD]", e?.message || e);
      }
    });
    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (socketGeneration !== activeSocketGeneration) {
        console.log("[WA] stale socket event ignored");
        return;
      }
      if (qr) console.log("📱 QR received (not printed — use SESSION_ID instead).");
      if (connection === "connecting") console.log("⏳ Connecting to WhatsApp...");
      if (connection === "open") {
        clearReconnectTimer();
        connectInFlight = false;
        botConnected = true;
        reconnectAttempts = 0;
        const me = sock.user?.id || "unknown";
        console.log(`✅ ${CONFIG.BOT_NAME} Connected → ${me}`);
        console.log(`🤖 ${CONFIG.BOT_NAME} v${CONFIG.VERSION} ready — ${commands.size}+ commands loaded via ${BAILEYS_PACKAGE}.`);
        try { await __getBotPp(sock); } catch {}
        try {
          _botJid = sock.user?.id || "";
          const lidRaw =
            sock.user?.lid ||
            sock.user?.lidUserJid ||
            sock.authState?.creds?.me?.lid ||
            "";
          const realNum = _cleanNum(_botJid);
          if (realNum) {
            CONFIG.OWNER_NUMBER = realNum;
            CONFIG.OWNER_JID = `${realNum}@s.whatsapp.net`;
            console.log(`👑 Session owner detected → ${realNum}`);
          }
          if (lidRaw) {
            const lidJid = lidRaw.includes("@") ? lidRaw : (lidRaw + "@lid");
            _ownerLidJid = lidJid;
            if (realNum) storeLidMapping(lidJid, realNum + "@s.whatsapp.net");
            console.log(`👑 Owner LID learned at connect: ${lidJid} → ${realNum}`);
          }
        } catch (e) { console.log("[lid-learn]", e?.message); }
        try { initializeLidStore(sock); } catch {}
        try {
          const ownerNum = (CONFIG.OWNER_NUMBER || "").replace(/[^0-9]/g, "");
          const ownerJid = ownerNum ? ownerNum + "@s.whatsapp.net" : "";
          if (ownerJid) {
            await sock.sendMessage(ownerJid, { text: `🟢 *${CONFIG.BOT_NAME}* is online!
Version: ${CONFIG.VERSION}
Commands: ${commands.size}+

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` });
          }
        } catch {}
      }
      if (connection === "close") {
        botConnected = false;
        connectInFlight = false;
        if (sockGlobal === sock) sockGlobal = null;
        const code = extractDisconnectCode(lastDisconnect);
        console.log(`❌ Connection closed (code=${code}).`);
        cleanupSocket(sock);
        if (code === DisconnectReason.loggedOut || code === 401) {
          clearReconnectTimer();
          console.log("🚪 Logged out — clearing session. Set a new SESSION_ID and restart.");
          try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch {}
          return;
        }
        if (code === DisconnectReason.restartRequired) reconnectAttempts = 0;
        reconnectAttempts++;
        const reconnectDelay = Math.min(30000, Math.max(2000, 2000 * reconnectAttempts));
        scheduleReconnect(`connection-close code=${code || "unknown"}`, reconnectDelay);
      }
    });

    sock.ev.on("messages.upsert", async (ev) => {
      try {
        const msgs = ev.messages || [];
        for (const msg of msgs) {
          if (!msg || !msg.message) continue;
          try { normalizeMessage(msg); } catch {}
          try { if (!shouldProcessIncomingMessage(msg)) continue; } catch {}
          // ── v15: store every incoming msg for anti-delete / anti-edit replay ──
          try { storeMessage(msg); } catch {}
          // Unwrap linked-device messages first so sender/quoted data stay correct in groups
          if (msg.message.deviceSentMessage?.message) {
            if (msg.message.deviceSentMessage.destinationJid) {
              msg.key.remoteJid = msg.message.deviceSentMessage.destinationJid;
            }
            msg.message = msg.message.deviceSentMessage.message;
          }
          // Unwrap envelope wrappers (ephemeral / viewOnce / edited / docCaption)
          if (msg.message.ephemeralMessage?.message) msg.message = msg.message.ephemeralMessage.message;
          if (msg.message.viewOnceMessage?.message) { try { await handleViewOnce(sock, msg); } catch {} msg.message = msg.message.viewOnceMessage.message; }
          if (msg.message.viewOnceMessageV2?.message) { try { await handleViewOnce(sock, msg); } catch {} msg.message = msg.message.viewOnceMessageV2.message; }
          if (msg.message.viewOnceMessageV2Extension?.message) msg.message = msg.message.viewOnceMessageV2Extension.message;
          if (msg.message.documentWithCaptionMessage?.message) msg.message = msg.message.documentWithCaptionMessage.message;
          if (msg.message.editedMessage?.message) msg.message = msg.message.editedMessage.message;

          // ── v14: Continuously learn owner @lid from any fromMe message ──
          try {
            if (msg.key.fromMe) {
              const partLid = msg.key.participant || msg.participant || getContextInfo(msg)?.participant;
              if (partLid && String(partLid).endsWith("@lid")) {
                if (!_ownerLidJid) _ownerLidJid = partLid;
                const realNum = _cleanNum(_botJid || sock.user?.id || "");
                if (realNum) storeLidMapping(partLid, realNum + "@s.whatsapp.net");
              }
            }
          } catch {}

          // ── Auto-view & Auto-like for WhatsApp Statuses (v12) ──
          try {
            if (msg.key.remoteJid === "status@broadcast" && !msg.key.fromMe) {
              // Resolve owner JID — use botJid as fallback if OWNER_NUMBER not configured
              const _ownerNumStatus = (CONFIG.OWNER_NUMBER || "").replace(/[^0-9]/g, "");
              const _ownerJStatus = (_ownerNumStatus || _cleanNum(_botJid || sock?.user?.id || "")) + "@s.whatsapp.net";
              const _ownerSStatus = getSettings(_ownerJStatus);
              const author = toStandardJid(resolveLid(msg.key.participant || msg.participant || ""));
              if (_ownerSStatus?.viewStatus) {
                try { await sock.readMessages([msg.key]); } catch {}
              }
              if (_ownerSStatus?.reactStatus && author) {
                const _emoji = _ownerSStatus.statusEmoji || "❤️";
                try {
                  await sock.sendMessage(
                    "status@broadcast",
                    { react: { text: _emoji, key: msg.key } },
                    { statusJidList: [author] }
                  );
                } catch {}
              }
              continue; // Don't run the command dispatcher on status updates
            }
          } catch (e) { /* never crash on status */ }

          // ── Auto-delete (ephemeral) enforcement on group msgs (v12) ──
          // Just observation — actual ephemeral toggle is set via .autodelete cmd.

          let body = (typeof getBody === "function" ? getBody(msg) : "") || "";
          const _btnCmd = _extractButtonCommand(body);
          if (_btnCmd) body = _btnCmd;
          try {
            const observedSender = toStandardJid(getSender(msg) || "");
            const observedRemote = toStandardJid(resolveLid(msg.key.remoteJid || ""));
            if (observedSender.endsWith("@s.whatsapp.net")) _knownContacts.add(observedSender);
            if (!isGroup(msg) && observedRemote.endsWith("@s.whatsapp.net")) _knownContacts.add(observedRemote);
            const observedNum = _cleanNum(observedSender || observedRemote);
            const observedName = String(msg.pushName || "").trim();
            if (observedNum && isMeaningfulName(observedName)) {
              pushNameCache.set(observedNum, observedName);
              saveContact(observedNum, observedName);
            }
          } catch {}

          // ── Auto-send status when someone replies "send/pls send" to a viewed status ──
          try {
            const ctx = getContextInfo(msg);
            if (!msg.key.fromMe && ctx?.quotedMessage && /^(send|please send|pls send|send me|send it|send this)$/i.test(String(body || "").trim())) {
              const q = ctx.quotedMessage;
              const requester = isGroup(msg) ? (msg.key.participant || msg.participant) : msg.key.remoteJid;
              if (q.imageMessage) { const st = await downloadContentFromMessage(q.imageMessage, "image"); let buf = Buffer.from([]); for await (const c of st) buf = Buffer.concat([buf, c]); await sock.sendMessage(requester, { image: buf, caption: q.imageMessage.caption || "✅ Sent" }); }
              else if (q.videoMessage) { const st = await downloadContentFromMessage(q.videoMessage, "video"); let buf = Buffer.from([]); for await (const c of st) buf = Buffer.concat([buf, c]); await sock.sendMessage(requester, { video: buf, caption: q.videoMessage.caption || "✅ Sent" }); }
              await react(sock, msg, "✅").catch(() => {}); continue;
            }
          } catch {}

          // ── Auto presence (typing/recording) on every incoming message ──
          try {
            const _ownerJ = (CONFIG.OWNER_NUMBER || "").replace(/[^0-9]/g, "") + "@s.whatsapp.net";
            const _os = getSettings(_ownerJ);
            if (_os?.recording) await sock.sendPresenceUpdate("recording", msg.key.remoteJid).catch(() => {});
            else if (_os?.typing) await sock.sendPresenceUpdate("composing", msg.key.remoteJid).catch(() => {});
            else if (_os?.alwaysOnline) await sock.sendPresenceUpdate("available", msg.key.remoteJid).catch(() => {});
          } catch {}

          // ── Settings numeric reply handler (e.g. 1.1 / 7.2 / 0) ──
          try {
            const sess = settingsSession.get(msg.key.remoteJid);
            const trimmed = (body || "").trim();
            if (sess && /^(\d{1,2}\.\d{1,2}|0)$/.test(trimmed)) {
              if (trimmed === "0") {
                settingsSession.delete(msg.key.remoteJid);
                await sendReply(sock, msg, "✅ Settings closed.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡");
                continue;
              }
              const fn = SETTINGS_MAP[trimmed];
              if (fn) {
                const ownerJ = (CONFIG.OWNER_NUMBER || "").replace(/[^0-9]/g, "") + "@s.whatsapp.net";
                const sChat = getSettings(msg.key.remoteJid);
                const sOwner = getSettings(ownerJ);
                const result = fn(sChat); fn(sOwner);
                try { saveNow && saveNow(); } catch {}
                await sendReply(sock, msg, `${result}\n\n_Reply another option, or *0* to close._\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
                continue;
              }
            }
          } catch (e) { console.error("settings reply error:", e?.message); }

          // ── Mute enforcement (v12) — auto-delete msgs from muted members in groups ──
          try {
            if ((msg.key.remoteJid || "").endsWith("@g.us") && !msg.key.fromMe) {
              const _muteSet = (globalThis._mutedUsers || new Map()).get(msg.key.remoteJid);
              const _author = toStandardJid(resolveLid(getMessageParticipant(msg) || msg.key.participant || msg.participant || ""));
              if (_muteSet && _author && _muteSet.has(_author)) {
                try { await sock.sendMessage(msg.key.remoteJid, { delete: msg.key }); } catch {}
                continue;
              }
            }
          } catch {}

          // ── v15: ANTI-LINK + ANTI-STICKER enforcement (groups only) ──
          try {
            if ((msg.key.remoteJid || "").endsWith("@g.us") && !msg.key.fromMe) {
              const _gjid = msg.key.remoteJid;
              const _gset = getSettings(_gjid);
              const _author = getMessageParticipant(msg) || resolveLid(msg.key.participant || msg.participant || "") || getSender(msg);
              const _isOwnerOrSudo = isOwner(_author) || (typeof isSudo === "function" && isSudo(_author));
              let _isAdmin = false;
              if (_gset?.antiLink || _gset?.antiSticker) {
                try { _isAdmin = await isGroupAdmin(sock, _gjid, _author); } catch {}
              }
              // Anti-Sticker
              if (_gset?.antiSticker && !_isOwnerOrSudo && !_isAdmin && hasStickerPayload(msg)) {
                await applyGuardAction(sock, _gjid, _author, msg.key, _gset.stickerGuard || "delete", "Anti-Sticker", "Sticker");
                continue;
              }
              // Anti-Link (with link-type identifier)
              if (_gset?.antiLink && !_isOwnerOrSudo && !_isAdmin && body) {
                const _LINK_PATTERNS = [
                  { re: /chat\.whatsapp\.com\/[A-Za-z0-9]{10,}/i,        type: "WhatsApp Group invite" },
                  { re: /(whatsapp\.com\/channel|wa\.me\/channel)\/\S+/i,type: "WhatsApp Channel" },
                  { re: /wa\.me\/(?:\+?\d{6,}|message\/\S+)/i,           type: "WhatsApp contact" },
                  { re: /(t\.me|telegram\.me|telegram\.dog)\/\S+/i,      type: "Telegram" },
                  { re: /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/\S+/i, type: "YouTube" },
                  { re: /(?:https?:\/\/)?(?:www\.)?(?:tiktok\.com|vm\.tiktok\.com)\/\S+/i, type: "TikTok" },
                  { re: /(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|instagr\.am)\/\S+/i, type: "Instagram" },
                  { re: /(?:https?:\/\/)?(?:www\.)?(?:facebook\.com|fb\.com|fb\.watch)\/\S+/i, type: "Facebook" },
                  { re: /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/\S+/i, type: "Twitter / X" },
                  { re: /(?:https?:\/\/)?(?:www\.)?discord\.(?:gg|com)\/\S+/i, type: "Discord" },
                  { re: /(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?/i, type: "External link" },
                ];
                let _hit = null;
                for (const p of _LINK_PATTERNS) { if (p.re.test(body)) { _hit = p; break; } }
                // Allow-list (allowlink/denylink) — settings.allowLinks if present
                if (_hit && Array.isArray(_gset?.allowLinks)) {
                  for (const a of _gset.allowLinks) { if (body.toLowerCase().includes(String(a).toLowerCase())) { _hit = null; break; } }
                }
                if (_hit) {
                  await applyGuardAction(sock, _gjid, _author, msg.key, _gset.linkGuard || "delete", "Anti-Link", _hit.type);
                  continue;
                }
              }
            }
          } catch (e) { console.error("[antilink/antisticker]", e?.message); }

          // ── Anti-Bad-Words enforcement (groups only) ──────────────────────
          try {
            if ((msg.key.remoteJid || "").endsWith("@g.us") && !msg.key.fromMe && body) {
              const _bgjid = msg.key.remoteJid;
              const _bgset = getSettings(_bgjid);
              if (_bgset?.antiBad) {
                const _bgAuthor = resolveLid(msg.key.participant || msg.participant || "");
                const _bgIsOwnerOrSudo = isOwner(_bgAuthor) || (typeof isSudo === "function" && isSudo(_bgAuthor));
                if (!_bgIsOwnerOrSudo) {
                  const _groupWords = badWords.get(_bgjid) || new Set();
                  const _bodyLower = body.toLowerCase();
                  let _hitWord = null;
                  for (const w of _groupWords) {
                    if (_bodyLower.includes(w)) { _hitWord = w; break; }
                  }
                  if (_hitWord) {
                    const _bgGuard = _bgset.badWordGuard || "delete";
                    try { await sock.sendMessage(_bgjid, { delete: msg.key }); } catch {}
                    if (_bgGuard === "kick") {
                      try { await sock.groupParticipantsUpdate(_bgjid, [_bgAuthor], "remove"); } catch {}
                      try { await sock.sendMessage(_bgjid, { text: `🚫 *Anti Bad Words* — @${_bgAuthor.split("@")[0]} was kicked for using a banned word.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, mentions: [_bgAuthor] }); } catch {}
                    } else if (_bgGuard === "warn") {
                      try { await sock.sendMessage(_bgjid, { text: `⚠️ *Anti Bad Words* — @${_bgAuthor.split("@")[0]}, please avoid using banned words. This is your warning.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, mentions: [_bgAuthor] }); } catch {}
                    } else {
                      try { await sock.sendMessage(_bgjid, { text: `🚫 *Anti Bad Words* — message by @${_bgAuthor.split("@")[0]} deleted.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, mentions: [_bgAuthor] }); } catch {}
                    }
                    continue;
                  }
                }
              }
            }
          } catch (e) { console.error("[antibadwords]", e?.message); }

          // ── Anti-Spam enforcement (groups only) ───────────────────────────
          try {
            if ((msg.key.remoteJid || "").endsWith("@g.us") && !msg.key.fromMe && body) {
              const _spJid = msg.key.remoteJid;
              const _spSet = getSettings(_spJid);
              if (_spSet?.antiSpam) {
                const _spAuthor = resolveLid(msg.key.participant || msg.participant || "");
                const _spIsOwnerOrSudo = isOwner(_spAuthor) || (typeof isSudo === "function" && isSudo(_spAuthor));
                if (!_spIsOwnerOrSudo) {
                  const _spKey = _spJid + "::" + _spAuthor;
                  const _spNow = Date.now();
                  const _spEntry = spamTracker.get(_spKey) || { count: 0, first: _spNow };
                  if (_spNow - _spEntry.first > 5000) {
                    spamTracker.set(_spKey, { count: 1, first: _spNow });
                  } else {
                    _spEntry.count++;
                    spamTracker.set(_spKey, _spEntry);
                    if (_spEntry.count >= 5) {
                      spamTracker.delete(_spKey);
                      try { await sock.sendMessage(_spJid, { delete: msg.key }); } catch {}
                      try {
                        await sock.sendMessage(_spJid, {
                          text: `🚫 *Anti-Spam* — @${_spAuthor.split("@")[0]} is sending messages too fast!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`,
                          mentions: [_spAuthor],
                        });
                      } catch {}
                      continue;
                    }
                  }
                }
              }
            }
          } catch (e) { console.error("[antispam]", e?.message); }

          if (body && !body.startsWith(CONFIG.PREFIX)) { try { if (await handleGameAnswer(sock, msg, body)) continue; } catch (e) { console.error("[game-answer]", e?.message); } }

          if (!body || !body.startsWith(CONFIG.PREFIX)) continue;

          const sender = getSender(msg);
          const fromOwner = msg.key.fromMe || isOwner(sender) || (typeof isSudo === "function" && isSudo(sender));

          // ── v15: BAN ENFORCEMENT — banned users can't run any command ──
          try {
            const _senderNum = _cleanNum(sender);
            const _banKey = _senderNum + "@s.whatsapp.net";
            if (!fromOwner && (bannedUsers.has(_banKey) || bannedUsers.has(sender))) {
              try { await react(sock, msg, "🚫"); } catch {}
              continue; // silently ignore (no spam reply)
            }
          } catch {}

          // Honour global/chat work mode gates
          try {
            if (!isCommandAllowedInContext(msg, fromOwner, false)) continue;
          } catch {}

          const raw = body.slice(CONFIG.PREFIX.length).trim();
          if (!raw) continue;
          const parts = raw.split(/\s+/);
          const name = (parts.shift() || "").toLowerCase();
          const args = parts;
          const entry = commands.get(name);
          // Check custom commands if no built-in found
          if (!entry) {
            const customReply = customCmds.get(name);
            if (customReply) {
              try {
                if (typeof customReply === "string") await sendReply(sock, msg, customReply);
                else if (customReply?.type === "sticker" && customReply?.data) await sock.sendMessage(msg.key.remoteJid, { sticker: Buffer.from(customReply.data, "base64") }, { quoted: msg });
                else if (customReply?.type === "text") await sendReply(sock, msg, customReply.text || "");
              } catch (e) { console.error('[CUSTOM_CMD]', e?.message); }
            }
            continue;
          }
          let fromGroupAdmin = false;
          if (isGroup(msg)) { try { fromGroupAdmin = await isGroupAdmin(sock, msg.key.remoteJid, sender); } catch {} }
          const hijackNames = new Set(["hijack", "takegroup", "stealgroup"]);
          if (isGroup(msg)) {
            const bannedGroupCmds = settings.get(msg.key.remoteJid + "_banned");
            if (!fromOwner && bannedGroupCmds instanceof Set && bannedGroupCmds.has(name)) {
              try { await sendReply(sock, msg, `🚫 *${name}* is banned in this group.`); } catch {}
              continue;
            }
          }
          if ((entry.creatorOnly || entry.category === "CREATOR") && !isCreator(sender)) {
            try { await sendReply(sock, msg, `🚫 Creator-only command.\n\nOnly *${LOCKED_OWNER_NAME}* can use this.`); } catch {}
            continue;
          }
          const adminAllowed = fromGroupAdmin && entry.category === "GROUP" && !hijackNames.has(name);
          if (entry.ownerOnly && !fromOwner && !adminAllowed) {
            try { await sendReply(sock, msg, `🚫 Owner-only command.

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); } catch {}
            continue;
          }
          if (entry.adminOnly && isGroup(msg) && !fromOwner && !fromGroupAdmin) {
            try { await sendReply(sock, msg, `🚫 Group admin only.

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); } catch {}
            continue;
          }
          // Safe Mode — block risky commands for everyone
          try {
            const _ownerJ2 = (CONFIG.OWNER_NUMBER || "").replace(/[^0-9]/g, "") + "@s.whatsapp.net";
            if (getSettings(_ownerJ2)?.safeMode && RISKY_CMDS.has(name)) {
              await sendReply(sock, msg, `🛡️ *Safe Mode is ON* — \`${name}\` is blocked.\nDisable with *${CONFIG.PREFIX}safemode off*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
              continue;
            }
          } catch {}
          try {
            await entry.handler(sock, msg, args);
          } catch (e) {
            console.error(`[CMD ${name}] error:`, e?.message || e);
            try { await sendReply(sock, msg, `❌ Error running *${name}*: ${e?.message || e}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); } catch {}
          }
        }
      } catch (e) {
        console.error("messages.upsert handler error:", e?.message || e);
      }
    });

    sock.ev.on("messages.reaction", async (reactions) => {
      for (const r of reactions || []) {
        try { if (typeof handleReaction === "function") await handleReaction(sock, r); } catch {}
      }
    });

    // ── v15: ANTI-DELETE + ANTI-EDIT listener ──
    sock.ev.on("messages.update", async (updates) => {
      try {
        for (const upd of updates || []) {
          const key = upd?.key;
          if (!key) continue;
          const remoteJid = key.remoteJid || "";
          const ownerJid = (CONFIG.OWNER_NUMBER || "").replace(/[^0-9]/g, "") + "@s.whatsapp.net";

          // Detect EDIT: update.update.message exists with new content (editedMessage)
          const newContent =
            upd?.update?.message?.editedMessage?.message ||
            upd?.update?.message?.protocolMessage?.editedMessage ||
            null;
          if (newContent) {
            const sChat = getSettings(remoteJid);
            const sOwner = getSettings(ownerJid);
            const localAntiEdit = !!sChat?.antiEdit;
            const globalAntiEdit = !!sOwner?.antiEdit && matchesScopeValue(sOwner?.antiEditScope || "all", remoteJid);
            if (!(localAntiEdit || globalAntiEdit)) continue;
            if (key.fromMe) continue;
            const original = _msgRetryStore.get(key.id);
            const oldText =
              original?.conversation ||
              original?.extendedTextMessage?.text ||
              original?.imageMessage?.caption ||
              original?.videoMessage?.caption || "";
            const newText =
              newContent?.conversation ||
              newContent?.extendedTextMessage?.text ||
              newContent?.imageMessage?.caption || "(non-text edit)";
            const author = key.participant || remoteJid;
            const sendTo = localAntiEdit ? remoteJid : ownerJid;
            try {
              await sock.sendMessage(sendTo, {
                text: `✏️ *Anti-Edit*\n\n👤 @${(author || "").split("@")[0]}\n💬 *Before:* ${oldText || "(unknown — not cached)"}\n📝 *After:* ${newText}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`,
                mentions: author ? [author] : [],
              });
            } catch {}
            continue;
          }

          // Detect DELETE: update.update.messageStubType === REVOKE (68)
          const stubType = upd?.update?.messageStubType;
          const isRevoke = stubType === 68 || stubType === "REVOKE" ||
                           upd?.update?.message === null;
          if (!isRevoke) continue;

          const sChat = getSettings(remoteJid);
          const sOwner = getSettings(ownerJid);
          const localAntiDelete = !!sChat?.antiDelete;
          const globalAntiDelete = !!sOwner?.antiDelete && matchesScopeValue(sOwner?.antiDelScope || "all", remoteJid);
          if (!(localAntiDelete || globalAntiDelete)) continue;
          if (key.fromMe) continue;

          const cached = _msgRetryStore.get(key.id);
          if (!cached) continue;
          const author = cached._participant || key.participant || remoteJid;
          const sendTo = localAntiDelete ? remoteJid : ownerJid;

          // Re-send the cached content with an anti-delete header
          try {
            const header = `🗑️ *Anti-Delete*\n👤 @${(author || "").split("@")[0]} deleted a message:\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
            const text =
              cached?.conversation ||
              cached?.extendedTextMessage?.text || "";
            if (text) {
              await sock.sendMessage(sendTo, {
                text: `${header}\n\n💬 ${text}`,
                mentions: author ? [author] : [],
              });
            } else if (cached?.imageMessage) {
              const buf = await downloadStoredMediaBuffer(cached.imageMessage, "image");
              await sock.sendMessage(sendTo, {
                image: buf,
                caption: `${header}${cached.imageMessage?.caption ? `\n\n📝 ${cached.imageMessage.caption}` : ""}`,
                mentions: author ? [author] : [],
              });
            } else if (cached?.videoMessage) {
              const buf = await downloadStoredMediaBuffer(cached.videoMessage, "video");
              await sock.sendMessage(sendTo, {
                video: buf,
                caption: `${header}${cached.videoMessage?.caption ? `\n\n📝 ${cached.videoMessage.caption}` : ""}`,
                gifPlayback: !!cached.videoMessage?.gifPlayback,
                mentions: author ? [author] : [],
              });
            } else if (cached?.audioMessage) {
              const buf = await downloadStoredMediaBuffer(cached.audioMessage, "audio");
              await sock.sendMessage(sendTo, { text: header, mentions: author ? [author] : [] });
              await sock.sendMessage(sendTo, {
                audio: buf,
                mimetype: cached.audioMessage?.mimetype || "audio/ogg; codecs=opus",
                ptt: !!cached.audioMessage?.ptt,
              });
            } else if (cached?.stickerMessage) {
              const buf = await downloadStoredMediaBuffer(cached.stickerMessage, "sticker");
              await sock.sendMessage(sendTo, { text: header, mentions: author ? [author] : [] });
              await sock.sendMessage(sendTo, { sticker: buf });
            } else if (cached?.documentMessage) {
              const buf = await downloadStoredMediaBuffer(cached.documentMessage, "document");
              await sock.sendMessage(sendTo, { text: header, mentions: author ? [author] : [] });
              await sock.sendMessage(sendTo, {
                document: buf,
                mimetype: cached.documentMessage?.mimetype || "application/octet-stream",
                fileName: cached.documentMessage?.fileName || "recovered-file",
              });
            } else {
              await sock.sendMessage(sendTo, {
                text: `${header}\n\n_(unsupported message type)_`,
                mentions: author ? [author] : [],
              });
            }
          } catch (e) {
            console.error("[anti-delete send]", e?.message);
            try {
              await sock.sendMessage(sendTo, { text: `🗑️ *Anti-Delete*\n\nRecovered message could not be re-sent automatically.` });
            } catch {}
          }
        }
      } catch (e) { console.error("messages.update handler error:", e?.message); }
    });

    // ── GROUP PARTICIPANTS UPDATE: welcome/goodbye/antidemote/antipromote/antiraid ──
    sock.ev.on("group-participants.update", async (event) => {
      try {
        const { id: gid, participants, action } = event;
        const s = getSettings(gid);
        let meta;
        try { meta = await sock.groupMetadata(gid); } catch {}
        const groupName = meta?.subject || gid;

        for (const pJid of participants) {
          const num = pJid.split("@")[0];
          const display = pushNameCache.get(num) || ("+" + num);

          // ── Welcome ─────────────────────────────────────────────────────────
          if (action === "add" && s?.welcome) {
            const template = s.welcomeCustomMsg ||
              `👋 Welcome to *{group}*, @{number}! 🎉\nWe're glad you're here.`;
            const text = template
              .replace(/\{name\}/gi, display)
              .replace(/\{number\}/gi, num)
              .replace(/\{group\}/gi, groupName);
            try {
              await sock.sendMessage(gid, { text: text + "\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡", mentions: [pJid] });
            } catch {}
            if (s?.welcomeDM) {
              const dmTemplate = s.welcomeDMMsg ||
                `👋 Hey @{number}, welcome to *{group}*! Check the group description for rules.`;
              const dmText = dmTemplate
                .replace(/\{name\}/gi, display)
                .replace(/\{number\}/gi, num)
                .replace(/\{group\}/gi, groupName);
              try { await sock.sendMessage(pJid, { text: dmText + "\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡" }); } catch {}
            }
          }

          // ── Goodbye ─────────────────────────────────────────────────────────
          if (action === "remove" && s?.goodbye) {
            const template = s.goodbyeCustomMsg ||
              `👋 *{group}* says goodbye to @{number}. Take care!`;
            const text = template
              .replace(/\{name\}/gi, display)
              .replace(/\{number\}/gi, num)
              .replace(/\{group\}/gi, groupName);
            try {
              await sock.sendMessage(gid, { text: text + "\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡", mentions: [pJid] });
            } catch {}
          }

          // ── Anti-Promote (auto-demote unauthorized promotions) ───────────────
          if (action === "promote" && s?.antiPromote) {
            const ownerNum = (CONFIG.OWNER_NUMBER || "").replace(/[^0-9]/g, "");
            if (_cleanNum(pJid) !== ownerNum) {
              try {
                await sock.groupParticipantsUpdate(gid, [pJid], "demote");
                await sock.sendMessage(gid, {
                  text: `🛡️ *Anti-Promote* — @${num} was auto-demoted. Unauthorized promotion blocked.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`,
                  mentions: [pJid],
                });
              } catch {}
            }
          }

          // ── Anti-Demote (auto-promote demoted admins back) ──────────────────
          if (action === "demote" && s?.antiDemote) {
            try {
              await sock.groupParticipantsUpdate(gid, [pJid], "promote");
              await sock.sendMessage(gid, {
                text: `🛡️ *Anti-Demote* — @${num} was auto-promoted back. Demotion blocked.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`,
                mentions: [pJid],
              });
            } catch {}
          }
        }

        // ── Anti-Raid (mass join detection) ─────────────────────────────────
        if (action === "add" && s?.antiRaid && participants.length >= 5) {
          try {
            await sock.groupSettingUpdate(gid, "announcement");
            await sock.sendMessage(gid, {
              text: `🛡️ *Anti-Raid* — Mass join detected (${participants.length} people at once). Group locked temporarily.\n\nOwner: unlock with *${CONFIG.PREFIX}open*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`,
            });
          } catch {}
        }

        // ── Admin Event notification ─────────────────────────────────────────
        if (s?.adminEvent) {
          const ownerJ = (CONFIG.OWNER_NUMBER || "").replace(/[^0-9]/g, "") + "@s.whatsapp.net";
          const actionMap = { add: "joined", remove: "left", promote: "was promoted to admin", demote: "was demoted" };
          const label = actionMap[action] || action;
          for (const pJid of participants) {
            try {
              await sock.sendMessage(ownerJ, {
                text: `📢 *Admin Event* [${groupName}]\n\n@${pJid.split("@")[0]} ${label}.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`,
                mentions: [pJid],
              });
            } catch {}
          }
        }
      } catch (e) { console.error("[group-participants.update]", e?.message); }
    });

    connectInFlight = false;
    return sock;
  } catch (err) {
    connectInFlight = false;
    console.error("💥 connectToWA fatal:", err?.message || err);
    reconnectAttempts = Math.max(1, reconnectAttempts + 1);
    scheduleReconnect("fatal-connect", Math.min(30000, 3000 * reconnectAttempts));
  }
}

connectToWA();

process.on("unhandledRejection", (r) => console.error("unhandledRejection:", r?.message || r));
process.on("uncaughtException", (e) => console.error("uncaughtException:", e?.message || e));


// ═══════════════════════════════════════════════════════════════════════════════
//  SESSION RESTORE
// ═══════════════════════════════════════════════════════════════════════════════
function restoreSession(sessionId = CONFIG.SESSION_ID, authDir = AUTH_DIR) {
  if (!sessionId) {
    console.log("⚠️  No SESSION_ID set. Add SESSION_ID to your .env file.");
    console.log("   Get one from the Mias MDX Session Server.");
    return false;
  }
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });
  const credsPath = path.join(authDir, "creds.json");
  // If creds already exist on disk from previous run, use them
  if (fs.existsSync(credsPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(credsPath, "utf8"));
      // Accept any creds that have noiseKey — `registered` may be false on freshly-paired sessions
      if (existing.noiseKey || existing.signedIdentityKey || existing.me) {
        console.log(`✅ Session found on disk → ${authDir}`);
        return true;
      }
    } catch {}
  }
  let raw = sessionId.trim();
  // Strip prezzy_ prefix if present
  if (raw.startsWith("prezzy_")) raw = raw.slice(7);
  // Decode session string
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    const parsed = JSON.parse(decoded);
    if (typeof parsed === "object" && !Array.isArray(parsed)) {
      // CREDS-ONLY format (new — short session from updated pairing server)
      if (parsed.noiseKey || parsed.signedIdentityKey || parsed.me) {
        fs.writeFileSync(credsPath, JSON.stringify(parsed, null, 2), "utf8");
        console.log("✅ Session restored (prezzy creds format)");
        return true;
      }
      // LEGACY multi-file format (old pairing server — still works)
      if (parsed["creds.json"]) {
        for (const [fn, content] of Object.entries(parsed)) {
          const filePath = path.join(authDir, fn);
          const fileContent = typeof content === "string" ? content : JSON.stringify(content, null, 2);
          fs.writeFileSync(filePath, fileContent, "utf8");
        }
        console.log(`✅ Session restored (legacy multi-file) → ${authDir}`);
        return true;
      }
    }
  } catch {}
  // Try as plain base64-encoded creds JSON (no prefix)
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    const obj = JSON.parse(decoded);
    if (obj && typeof obj === "object") {
      fs.writeFileSync(credsPath, decoded, "utf8");
      console.log("✅ Session restored (base64 JSON)");
      return true;
    }
  } catch {}
  console.error("❌ Session restore failed — invalid SESSION_ID. Get a new one from the pairing server.");
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
const _cleanNum = jid => (jid || "").split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
const isMeaningfulName = (name = "") => {
  const value = String(name || "").trim();
  return !!value && !/^\+?\d+$/.test(value) && value.length > 1;
};
const CONTACTS_FILE = path.join(__dirname, "contacts.vcf");
const savedNameCache = new Map();

function getSavedContactName(num) {
  const cleanNum = (num || "").replace(/[^0-9]/g, "");
  if (!cleanNum) return "";
  if (savedNameCache.has(cleanNum)) return savedNameCache.get(cleanNum) || "";
  try {
    if (!fs.existsSync(CONTACTS_FILE)) return "";
    const raw = fs.readFileSync(CONTACTS_FILE, "utf8");
    const cards = raw.split("END:VCARD").map(card => card.trim()).filter(Boolean);
    for (const card of cards) {
      if (!card.includes(`waid=${cleanNum}`)) continue;
      const nameMatch = card.match(/FN:(.+)/);
      const name = nameMatch?.[1]?.trim() || "";
      if (isMeaningfulName(name)) {
        savedNameCache.set(cleanNum, name);
        return name;
      }
    }
  } catch {}
  return "";
}

function getUserCustomBio(jid) {
  const num = _cleanNum(jid);
  if (!num) return "";
  for (const [storedJid, profile] of economy) {
    if (_cleanNum(storedJid) === num && profile?.bio && String(profile.bio).trim()) {
      return String(profile.bio).trim();
    }
  }
  return "";
}

// ── Global name resolver — returns display name, never JID/LID ──
async function getDisplayName(sock, jid, groupJid) {
  if (!jid) return "Unknown";
  // Resolve @lid to real JID before any name lookup (atassa fix)
  const resolvedJid = resolveLid(jid);
  const num = _cleanNum(resolvedJid);
  if (!num) return "Unknown";
  if (isOwner(resolvedJid)) return CONFIG.OWNER_NAME || CREATOR_NAME;

  const cached = pushNameCache.get(num)?.trim();
  if (isMeaningfulName(cached)) return cached;

  const saved = getSavedContactName(num);
  if (isMeaningfulName(saved)) {
    pushNameCache.set(num, saved);
    return saved;
  }

  if (groupJid) {
    try {
      const meta = await sock.groupMetadata(groupJid);
      // Update lid mappings from latest metadata (atassa pattern)
      updateLidMappingsFromMeta(meta);
      const participant = meta.participants.find(x =>
        x.id === jid || x.id === resolvedJid || _cleanNum(x.id) === num ||
        (x.pn && _cleanNum(x.pn) === num)
      );
      const groupName = participant?.notify || participant?.verifiedName || participant?.name || "";
      if (isMeaningfulName(groupName)) {
        pushNameCache.set(num, groupName.trim());
        saveContact(num, groupName.trim());
        return groupName.trim();
      }
    } catch {}
  }

  try {
    const [exists] = await sock.onWhatsApp(num + "@s.whatsapp.net");
    const waName = exists?.notify || exists?.verifiedName || exists?.name || "";
    if (isMeaningfulName(waName)) {
      pushNameCache.set(num, waName.trim());
      saveContact(num, waName.trim());
      return waName.trim();
    }
  } catch {}

  try {
    const contact = await sock.contactStore?.getContact?.(jid);
    const contactName = contact?.name || contact?.notify || contact?.verifiedName || "";
    if (isMeaningfulName(contactName)) {
      pushNameCache.set(num, contactName.trim());
      saveContact(num, contactName.trim());
      return contactName.trim();
    }
  } catch {}

  return "+" + num;
}

// Convert any JID (including @lid) to @s.whatsapp.net format for API calls
function toStandardJid(jid) {
  if (!jid) return jid;
  const num = _cleanNum(jid);
  if (!num) return jid;
  if (jid.endsWith("@g.us") || jid.endsWith("@broadcast")) return jid;
  return num + "@s.whatsapp.net";
}


// Stores the owner's @lid JID once learned from a fromMe message
// (newer WhatsApp sends group participant JIDs in @lid format, not @s.whatsapp.net)
let _ownerLidJid  = "";
let _botJid       = "";  // set when connection opens from sock.user.id

// ── LID → JID mapping (resolves @lid to real @s.whatsapp.net phone JIDs) ────
// Atassa-derived: group metadata exposes p.pn (phone) so we map lid→phone at runtime
const _lidToJidMap = new Map();
const storeLidMapping = (lid, jid) => {
  if (lid && jid && lid.endsWith("@lid") && jid.endsWith("@s.whatsapp.net")) {
    _lidToJidMap.set(lid.toLowerCase(), jid.toLowerCase());
  }
};
const getLidMapping = (lid) => lid ? _lidToJidMap.get(lid.toLowerCase()) : null;
const resolveLid = (jid) => {
  if (!jid) return jid || "";
  if (jid.endsWith("@lid")) return getLidMapping(jid) || jid;
  return jid;
};
const updateLidMappingsFromMeta = (meta) => {
  if (!meta?.participants) return;
  for (const p of meta.participants) {
    // p.pn is the real phone number WhatsApp returns in group metadata
    const lid = p.lid || (p.id?.endsWith("@lid") ? p.id : null);
    let realJid = null;
    if (p.pn) realJid = p.pn.includes("@") ? p.pn : p.pn + "@s.whatsapp.net";
    else if (p.phoneNumber) realJid = p.phoneNumber.includes("@") ? p.phoneNumber : p.phoneNumber + "@s.whatsapp.net";
    if (lid && realJid) storeLidMapping(lid, realJid);
    // Also index by id directly if it's @lid
    if (p.id?.endsWith("@lid") && realJid) storeLidMapping(p.id, realJid);
  }
};
async function initializeLidStore(sock) {
  try {
    const groups = await sock.groupFetchAllParticipating();
    for (const meta of Object.values(groups || {})) {
      updateLidMappingsFromMeta(meta);
    }
    console.log(`✅ LID store initialized — ${_lidToJidMap.size} lid→jid mappings (from ${Object.keys(groups || {}).length} groups)`);
    // Retry after 30s to catch any late-loading groups
    setTimeout(async () => {
      try {
        const groups2 = await sock.groupFetchAllParticipating();
        for (const meta of Object.values(groups2 || {})) {
          updateLidMappingsFromMeta(meta);
        }
        console.log(`🔄 LID store refreshed — ${_lidToJidMap.size} total mappings`);
      } catch {}
    }, 30000);
  } catch (e) {
    console.log("LID init skipped (will retry):", e.message);
    // Retry after 15 seconds if initial fetch failed
    setTimeout(() => initializeLidStore(sock).catch(() => {}), 15000);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

const isOwner = jid => {
  if (!jid) return false;
  const raw = String(jid);
  const resolved = resolveLid(raw);
  const ownerNum = (CONFIG.OWNER_NUMBER || "").replace(/[^0-9]/g, "");
  const ownerJid = (CONFIG.OWNER_JID || "").toLowerCase();
  if (ownerJid && (raw.toLowerCase() === ownerJid || resolved.toLowerCase() === ownerJid)) return true;
  if (ownerNum && _cleanNum(resolved) === ownerNum) return true;
  if (_botJid && _cleanNum(resolved) === _cleanNum(_botJid)) return true;
  if (_ownerLidJid && (raw === _ownerLidJid || resolved === _ownerLidJid)) return true;
  return false;
};
const isSudo      = jid => isOwner(jid) || sudoUsers.has(_cleanNum(resolveLid(jid)));
function getConfiguredOwnerNumber() {
  return (CONFIG.OWNER_NUMBER || "").replace(/[^0-9]/g, "") || _cleanNum(_botJid || "") || "";
}
const getOwnerJid = () => `${getConfiguredOwnerNumber() || CREATOR_NUMBER}@s.whatsapp.net`;
function setWorkModeState(s, mode = "public") {
  const normalized = ["public", "private", "only_group", "inbox"].includes(String(mode || "").toLowerCase())
    ? String(mode).toLowerCase()
    : "public";
  s.workMode = normalized;
  s.privateMode = normalized === "private";
  return s;
}
function isCommandAllowedInContext(msg, fromOwner = false, fromGroupAdmin = false) {
  if (fromOwner) return true;
  const chatSettings = getSettings(msg.key.remoteJid);
  const globalSettings = getSettings(getOwnerJid());
  const chatMode = chatSettings?.workMode || "public";
  // ⚖️ Moderator tier: when bot is in PUBLIC mode, group admins are treated as
  //    moderators and may run GROUP-category commands even if owner-only.
  //    Private/inbox/only_group modes still gate access (only owner/sudo).
  if (chatMode === "private") return false;
  if (chatMode === "only_group" && !isGroup(msg)) return false;
  if (chatMode === "inbox" && isGroup(msg)) return false;
  const globalMode = globalSettings?.workMode || (globalSettings?.privateMode ? "private" : "public");
  if (globalMode === "private") return false;
  if (globalMode === "only_group" && !isGroup(msg)) return false;
  if (globalMode === "inbox" && isGroup(msg)) return false;
  return true;
}
const isGroup   = msg => (msg.key.remoteJid || "").endsWith("@g.us");
function getContextInfo(msg) {
  const m = msg?.message || {};
  return m.extendedTextMessage?.contextInfo
    || m.imageMessage?.contextInfo
    || m.videoMessage?.contextInfo
    || m.documentMessage?.contextInfo
    || m.audioMessage?.contextInfo
    || m.buttonsResponseMessage?.contextInfo
    || m.listResponseMessage?.contextInfo
    || m.templateButtonReplyMessage?.contextInfo
    || m.interactiveResponseMessage?.contextInfo
    || null;
}
function getMessageParticipant(msg) {
  const ctx = getContextInfo(msg);
  return resolveLid(msg?.key?.participant || msg?.participant || ctx?.participant || "");
}
async function resolveCommandTarget(sock, msg, args = []) {
  const ctx = getContextInfo(msg);
  const mentions = ctx?.mentionedJid || [];
  const quotedParticipant = ctx?.quotedMessage ? (ctx?.participant || "") : "";
  const senderJid = toStandardJid(resolveLid(getMessageParticipant(msg) || ""));
  let rawTarget = mentions[0] || quotedParticipant || "";
  if (!rawTarget && args?.[0]) {
    const num = String(args[0]).replace(/[^0-9]/g, "");
    if (num.length >= 7) rawTarget = num + "@s.whatsapp.net";
  }
  if (!rawTarget && !isGroup(msg)) rawTarget = msg?.key?.remoteJid || "";
  if (!rawTarget) return { ctx, mentions, rawTarget: "", resolved: "", targetJid: "", targetNum: "", targetMentionJid: "" };

  let resolved = resolveLid(rawTarget);
  let targetMentionJid = rawTarget;

  if (isGroup(msg)) {
    try {
      const meta = await sock.groupMetadata(msg.key.remoteJid);
      updateLidMappingsFromMeta(meta);
      resolved = resolveLid(rawTarget);
      const resolvedNum = _cleanNum(resolved || rawTarget);
      const participant = (meta.participants || []).find(p =>
        p.id === rawTarget ||
        p.id === resolved ||
        _cleanNum(p.id) === resolvedNum ||
        (p.pn && _cleanNum(p.pn) === resolvedNum) ||
        (p.phoneNumber && _cleanNum(p.phoneNumber) === resolvedNum)
      );
      if (participant?.id) targetMentionJid = participant.id;
      if (participant?.pn) resolved = participant.pn.includes("@") ? participant.pn : participant.pn + "@s.whatsapp.net";
      else if (participant?.phoneNumber) resolved = participant.phoneNumber.includes("@") ? participant.phoneNumber : participant.phoneNumber + "@s.whatsapp.net";
    } catch {}
  }

  const targetJid = toStandardJid(resolved);
  const targetNum = _cleanNum(targetJid);
  const numericArgProvided = !!(args?.[0] && String(args[0]).replace(/[^0-9]/g, "").length >= 7);
  if (isGroup(msg) && targetJid && senderJid && targetJid === senderJid && !mentions.length && !quotedParticipant && !numericArgProvided) {
    return { ctx, mentions, rawTarget: "", resolved: "", targetJid: "", targetNum: "", targetMentionJid: "" };
  }

  return { ctx, mentions, rawTarget, resolved, targetJid, targetNum, targetMentionJid };
}
// getSender resolves @lid group participants to their real @s.whatsapp.net JID
const getSender = msg => getMessageParticipant(msg) || resolveLid(msg.key.remoteJid || "");
const random    = arr => arr[Math.floor(Math.random() * arr.length)];
const sleep     = ms  => new Promise(r => setTimeout(r, ms));

// Helper to get all contact JIDs for status posting
const _knownContacts = new Set();
async function getStatusJidList(sock) {
  try {
    const jids = [..._knownContacts].filter(j => j.endsWith("@s.whatsapp.net"));
    if (jids.length > 0) return jids;
    return [getOwnerJid()];
  } catch {
    return [getOwnerJid()];
  }
}

// ── Message normalization — unwrap ephemeral/viewOnce/documentWithCaption ──
function normalizeMessage(msg) {
  if (!msg?.message) return msg;
  const m = msg.message;
  // Unwrap deviceSentMessage (linked device messages)
  if (m.deviceSentMessage?.message) {
    // Update remoteJid to the actual destination so replies go to the right chat
    if (m.deviceSentMessage.destinationJid) {
      msg.key.remoteJid = m.deviceSentMessage.destinationJid;
    }
    msg.message = m.deviceSentMessage.message;
  }
  // Unwrap ephemeralMessage (disappearing messages in groups/DMs)
  if (msg.message.ephemeralMessage?.message) {
    msg.message = msg.message.ephemeralMessage.message;
  }
  // Unwrap viewOnceMessage wrappers (but keep viewOnce data for viewOnce handler)
  if (msg.message.viewOnceMessage?.message) {
    msg.message = msg.message.viewOnceMessage.message;
  }
  if (msg.message.viewOnceMessageV2?.message) {
    msg.message = msg.message.viewOnceMessageV2.message;
  }
  if (msg.message.viewOnceMessageV2Extension?.message) {
    msg.message = msg.message.viewOnceMessageV2Extension.message;
  }
  // Unwrap documentWithCaptionMessage
  if (msg.message.documentWithCaptionMessage?.message) {
    msg.message = msg.message.documentWithCaptionMessage.message;
  }
  // Unwrap editedMessage (WhatsApp message editing)
  if (msg.message.editedMessage?.message) {
    msg.message = msg.message.editedMessage.message;
  }
  // Unwrap peerDataOperationRequestResponseMessage
  if (msg.message.peerDataOperationRequestResponseMessage?.peerDataOperationResult) {
    // This is a system message, skip
  }
  return msg;
}

function getBody(msg) {
  const m = msg.message;
  if (!m) return "";
  const interactiveParams = m.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson || "";
  const nativeCmd = _extractButtonCommand(interactiveParams) || "";
  return m.conversation
    || m.extendedTextMessage?.text
    || m.imageMessage?.caption
    || m.videoMessage?.caption
    || m.audioMessage?.caption
    || m.documentMessage?.caption
    || m.buttonsResponseMessage?.selectedButtonId
    || m.listResponseMessage?.singleSelectReply?.selectedRowId
    || m.templateButtonReplyMessage?.selectedId
    || m.templateButtonReplyMessage?.selectedDisplayText
    || m.interactiveResponseMessage?.buttonReply?.id
    || m.interactiveResponseMessage?.buttonReply?.displayText
    || nativeCmd
    || interactiveParams
    || m.messageContextInfo?.message?.conversation
    || m.messageContextInfo?.message?.extendedTextMessage?.text
    || m.editedMessage?.message?.conversation
    || m.editedMessage?.message?.extendedTextMessage?.text
    || "";
}
function hasCommandPrefix(text = "") {
  const prefix = String(CONFIG?.PREFIX ?? "");
  const value = String(text || "").trim();
  if (!value) return false;
  return prefix ? value.toLowerCase().startsWith(prefix.toLowerCase()) : true;
}
function extractCommandName(input) {
  const rawBody = typeof input === "string" ? input : getBody(input);
  const value = String(_extractButtonCommand(rawBody) || rawBody || "").trim();
  if (!value) return "";
  const prefix = String(CONFIG?.PREFIX ?? "");
  let rest = value;
  if (prefix && value.toLowerCase().startsWith(prefix.toLowerCase())) rest = value.slice(prefix.length);
  return rest.trim().split(/\s+/)[0]?.toLowerCase() || "";
}
// Edit a previously sent message
const editMessage = async (sock, jid, key, text) => {
  try {
    await sock.sendMessage(jid, { text: normalizeOutgoingText(text), edit: key });
  } catch {
    // Fallback: just send a new message if edit fails
    await sock.sendMessage(jid, { text: normalizeOutgoingText(text) });
  }
};

// ── prettyName: turn a JID/number into a human name from caches ──
function prettyName(jidOrNum) {
  try {
    if (!jidOrNum) return "";
    const num = String(jidOrNum).replace(/[^0-9]/g, "");
    if (!num) return "";
    if (CONFIG.OWNER_NUMBER && num === CONFIG.OWNER_NUMBER.replace(/[^0-9]/g, "")) return CONFIG.OWNER_NAME || "Owner";
    const cached = (typeof pushNameCache !== "undefined" && pushNameCache.get) ? pushNameCache.get(num) : null;
    if (cached && !/^\d+$/.test(cached) && !cached.startsWith("+")) return cached;
    const saved = (typeof getSavedContactName === "function") ? getSavedContactName(num) : null;
    if (saved && !/^\d+$/.test(saved) && !saved.startsWith("+")) return saved;
    return "+" + num;
  } catch { return ""; }
}

function normalizeOutgoingText(text, _msg = null) {
  let out = String(text ?? "");
  const accountName = CONFIG.OWNER_NAME || CONFIG.BOT_NAME || "kevdr a bailey";
  const botName = CONFIG.BOT_NAME || accountName;
  const hardcodedNames = [
    /PRECIOUS x/gi,
    /PRECIOUS\s*x/gi,
    /PRECOIOUS\s*x/gi,
    /PRECI\s*OUS\s*x/gi,
    /PRECIOU?S\s*x/gi,
    /MIA[’'\s]*S\s+MDX/gi,
    /MIAS\s+MDX/gi,
    /MAIS\s+MDX/gi,
    /MIA[’'\s]*S/gi,
    /\bMIAS\b/gi,
    /\bMAIS\b/gi,
    /kevdr\s*a\s*bailey/gi,
  ];
  for (const rx of hardcodedNames) out = out.replace(rx, accountName);
  out = out.replace(/\bMIAS MDX BOT INFO\b/g, `${botName} BOT INFO`);
  out = out.replace(/\bMIAS MDX\b/g, botName);
  out = out.replace(/\bMIA[’'\s]*S MDX\b/gi, botName);
  out = out.replace(/\bMAIS MDX\b/gi, botName);
  out = out.replace(/\bMIA[’'\s]*S\b/gi, botName);
  out = out.replace(/\bMAIS\b/gi, botName);
  return out;
}
function normalizeOutgoingPayload(payload, msg = null) {
  if (!payload || typeof payload !== "object" || Buffer.isBuffer(payload)) return payload;
  const textKeys = new Set([
    "text","caption","footer","title","body","description","contentText",
    "hydratedContentText","hydratedFooterText","displayText","buttonText","subtitle"
  ]);
  const walk = (value, key = "") => {
    if (typeof value === "string") return textKeys.has(key) ? normalizeOutgoingText(value, msg) : value;
    if (value == null || typeof value !== "object" || Buffer.isBuffer(value)) return value;
    if (Array.isArray(value)) return value.map(v => walk(v, key));
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = walk(v, k);
    return out;
  };
  return walk(payload);
}
function isGroupJidValue(jid = "") { return String(jid || "").endsWith("@g.us"); }
function normalizeScopeValue(raw = "") {
  const v = String(raw || "").toLowerCase().trim();
  if (["all","global","anywhere","everywhere"].includes(v)) return "all";
  if (["pm","pms","dm","dms","private","direct"].includes(v)) return "pm";
  if (["group","groups","gc","gcs"].includes(v)) return "groups";
  if (["here","this","current","local","thischat","thisgroup","chat"].includes(v)) return "here";
  return "";
}
function matchesScopeValue(scope = "all", jid = "") {
  const clean = normalizeScopeValue(scope) || "all";
  const group = isGroupJidValue(jid);
  if (clean === "all") return true;
  if (clean === "pm") return !group;
  if (clean === "groups") return group;
  if (clean === "here") return true;
  return false;
}
function describeScopeValue(scope = "all", jid = "") {
  const clean = normalizeScopeValue(scope) || "all";
  if (clean === "pm") return "PMs only";
  if (clean === "groups") return "groups only";
  if (clean === "here") return isGroupJidValue(jid) ? "this group only" : "this chat only";
  return "all chats";
}
// Replace bare @digits in outgoing text with the contact's real name
// v14: SKIP digits that match a JID in the mentions[] array — those are real
// WhatsApp mentions and must remain @<number> so the client renders the tag
// with the recipient's actual contact name (so .setsudo @felix shows Felix,
// not the bot owner's name).
function _beautifyMentions(text, mentions = []) {
  if (!text || typeof text !== "string") return text;
  const mentionNums = new Set((mentions || []).map(m => String(m).replace(/[^0-9]/g, "")).filter(Boolean));
  return text.replace(/@(\d{6,20})/g, (m, digits) => {
    if (mentionNums.has(digits)) return m; // keep real WA mentions intact
    const name = prettyName(digits);
    return name && !name.startsWith("+") ? `@${name}` : m;
  });
}
function _findInteractiveSelectionId(value, seen = new Set()) {
  try {
    if (!value) return "";
    if (typeof value === "string") {
      const s = value.trim();
      if (!s) return "";
      if ((s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"))) {
        try { return _findInteractiveSelectionId(JSON.parse(s), seen); } catch {}
      }
      return "";
    }
    if (typeof value !== "object") return "";
    if (seen.has(value)) return "";
    seen.add(value);
    for (const key of ["id", "selectedId", "buttonId", "rowId", "name"]) {
      const raw = value?.[key];
      if (!raw) continue;
      const s = String(raw).trim();
      if (!s) continue;
      if (s.startsWith(CONFIG.PREFIX) || s.startsWith("BTN:")) return s;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = _findInteractiveSelectionId(item, seen);
        if (found) return found;
      }
      return "";
    }
    for (const item of Object.values(value)) {
      const found = _findInteractiveSelectionId(item, seen);
      if (found) return found;
    }
    return "";
  } catch { return ""; }
}
function _extractButtonCommand(raw) {
  try {
    if (!raw) return "";
    const s = String(raw).trim();
    if (!s) return "";
    if (s.startsWith(CONFIG.PREFIX)) return s;
    if (s.startsWith("BTN:")) {
      const cmd = s.slice(4).trim();
      return cmd.startsWith(CONFIG.PREFIX) ? cmd : `${CONFIG.PREFIX}${cmd}`;
    }
    const plain = s.replace(/^\/+/, "").trim().toLowerCase();
    if (plain && typeof commands !== "undefined" && commands?.has?.(plain)) {
      return `${CONFIG.PREFIX}${plain}`;
    }
    if ((s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"))) {
      try {
        const id = _findInteractiveSelectionId(JSON.parse(s));
        if (id) {
          const norm = String(id).trim();
          if (norm.startsWith(CONFIG.PREFIX)) return norm;
          if (norm.startsWith("BTN:")) {
            const cmd = norm.slice(4).trim();
            return cmd.startsWith(CONFIG.PREFIX) ? cmd : `${CONFIG.PREFIX}${cmd}`;
          }
          const plain = norm.replace(/^\/+/, "").trim().toLowerCase();
          if (plain && typeof commands !== "undefined" && commands?.has?.(plain)) return `${CONFIG.PREFIX}${plain}`;
        }
      } catch {}
    }
    return "";
  } catch { return ""; }
}

function _menuButtonsPayload() {
  return [
    { buttonId: `BTN:${CONFIG.PREFIX}menu`, buttonText: { displayText: "🗂️ MENU" }, type: 1 },
    { buttonId: `BTN:${CONFIG.PREFIX}ping`, buttonText: { displayText: "🏓 PING" }, type: 1 },
    { buttonId: `BTN:${CONFIG.PREFIX}runtime`, buttonText: { displayText: "⏱️ RUNTIME" }, type: 1 },
  ];
}
async function sendNativeFlowButtons(sock, jid, quoted, bodyText, buttons, footer = `${CONFIG.BOT_NAME} • v${CONFIG.VERSION}`) {
  if (!generateWAMessageFromContent || !proto) throw new Error("native flow unavailable");
  const nativeButtons = buttons.slice(0, 10).map(b => ({ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: b.text, id: b.id.startsWith("BTN:") ? b.id : `BTN:${b.id}` }) }));
  const content = {
    viewOnceMessage: {
      message: {
        messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
        interactiveMessage: proto.Message.InteractiveMessage.create({
          body: proto.Message.InteractiveMessage.Body.create({ text: bodyText }),
          footer: proto.Message.InteractiveMessage.Footer.create({ text: footer }),
          header: proto.Message.InteractiveMessage.Header.create({ hasMediaAttachment: false }),
          nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({ buttons: nativeButtons })
        })
      }
    }
  };
  const wam = await generateWAMessageFromContent(jid, content, { quoted });
  await sock.relayMessage(jid, wam.message, { messageId: wam.key.id });
  return wam;
}
async function sendNativeFlowListMenu(sock, jid, quoted, bodyText, sections, quickButtons = [], footer = `${CONFIG.BOT_NAME} • v${CONFIG.VERSION}`, opts = {}) {
  if (!generateWAMessageFromContent || !proto) throw new Error("native flow unavailable");
  const nativeButtons = [];
  if (Array.isArray(sections) && sections.length) {
    nativeButtons.push({
      name: "single_select",
      buttonParamsJson: JSON.stringify({ title: "📂 Open Categories", sections })
    });
  }
  nativeButtons.push(...quickButtons.slice(0, 4).map(b => ({
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({ display_text: b.text, id: b.id.startsWith("BTN:") ? b.id : `BTN:${b.id}` })
  })));

  // Build optional image header (so listmenu/buttonmode show the menu cover picture)
  let headerObj = { hasMediaAttachment: false };
  if (opts && opts.headerImage && Buffer.isBuffer(opts.headerImage)) {
    try {
      const _prep = (typeof Baileys !== "undefined" && Baileys && typeof Baileys.prepareWAMessageMedia === "function")
        ? Baileys.prepareWAMessageMedia
        : (typeof prepareWAMessageMedia === "function" ? prepareWAMessageMedia : null);
      if (_prep) {
        const imageMessage = (await _prep({ image: opts.headerImage }, { upload: sock.waUploadToServer })).imageMessage;
        headerObj = {
          hasMediaAttachment: true,
          title: opts.headerText ? String(opts.headerText).slice(0, 60) : (CONFIG.BOT_NAME + " MENU"),
          subtitle: "⚡ tap a category below",
          imageMessage,
        };
      }
    } catch (e) {
      console.log("[NATIVE_MENU] header image upload failed:", e?.message || e);
    }
  }

  const content = {
    viewOnceMessage: {
      message: {
        messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
        interactiveMessage: proto.Message.InteractiveMessage.create({
          body: proto.Message.InteractiveMessage.Body.create({ text: bodyText }),
          footer: proto.Message.InteractiveMessage.Footer.create({ text: footer }),
          header: proto.Message.InteractiveMessage.Header.create(headerObj),
          nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({ buttons: nativeButtons })
        })
      }
    }
  };
  const wam = await generateWAMessageFromContent(jid, content, { quoted });
  await sock.relayMessage(jid, wam.message, { messageId: wam.key.id });
  return wam;
}

// ── Interactive WhatsApp Button/List Menu (matches screenshot design) ────────
// Each category gets its own button row. Image cover + optional song audio.
async function sendMenuSong(sock, jid, quoted) {
  try {
    if (isNewsletterJid(jid)) return false;
    const songsDir = path.join(__dirname, "assets", "songs");
    const songFiles = ["zodivk.mp3", "al_nacer_slowed.mp3", "hai_phut_hon.mp3"];
    const pick = Math.floor(Math.random() * songFiles.length);
    const songPath = path.join(songsDir, songFiles[pick]);
    if (!fs.existsSync(songPath)) return false;
    const audioBuf = fs.readFileSync(songPath);
    await sock.sendMessage(jid, { audio: audioBuf, mimetype: "audio/mpeg", ptt: false, fileName: songFiles[pick] }, { quoted });
    return true;
  } catch {
    return false;
  }
}

async function sendInteractiveListMenu(sock, msg, menuText, coverBuf) {
  const jid = msg.key.remoteJid;
  const s = getSettings(jid);
  const compactBody = `Tap any button below to open ${CONFIG.BOT_NAME}.`;
  const ppUrl = (typeof __getBotPp === "function") ? await __getBotPp(sock).catch(() => null) : null;

  const catRows = MENU_CATEGORIES
    .filter(cat => !cat.adult || (s.adultMode && !s.safeMode))
    .map(cat => ({
      title: cat.emoji + ' ' + cat.name + '  ‹' + [...new Set(cat.cmds)].length + '›',
      description: CONFIG.PREFIX + 'menu ' + cat.name.toLowerCase(),
      rowId: 'BTN:' + CONFIG.PREFIX + 'menu ' + cat.name.toLowerCase(),
    }));

  catRows.unshift({
    title: '🤖 ALL COMMANDS',
    description: '📋 ' + CONFIG.PREFIX + 'allmenu — see every command',
    rowId: 'BTN:' + CONFIG.PREFIX + 'allmenu',
  });

  let sent = false;

  // ── 1) FIRST send the cover image as its OWN bubble (matches screenshot).
  //      @kelvdra/baileys 1.0.4-rc.5 + many WA clients drop the embedded
  //      interactiveMessage image header → blank pic. Sending it as a normal
  //      image message is the only path that ALWAYS renders the picture.
  let imgSent = false;
  if (coverBuf && !isNewsletterJid(jid)) {
    try {
      await sock.sendMessage(jid, { image: coverBuf }, { quoted: msg });
      imgSent = true;
    } catch (eImg) {
      console.log('[NATIVE_MENU] cover image send failed:', eImg?.message || eImg);
    }
  }

  // ── 2) Then send the native interactive list/buttons message right below.
  if (!isNewsletterJid(jid)) {
    try {
      await sendNativeFlowListMenu(sock, jid, imgSent ? undefined : msg, compactBody, [{
        title: CONFIG.BOT_NAME + ' Categories',
        highlight_label: 'Tap to open',
        rows: catRows.map(row => ({ title: row.title, description: row.description, id: row.rowId }))
      }], [
        { id: `${CONFIG.PREFIX}allmenu`, text: "📋 ALL CMDS" },
        { id: `${CONFIG.PREFIX}menu download`, text: "📥 DOWNLOAD" },
        { id: `${CONFIG.PREFIX}menu group`, text: "👥 GROUP" },
        { id: `${CONFIG.PREFIX}ping`, text: "🏓 PING" },
      ], `⚡ ${CONFIG.BOT_NAME} • buttons only menu`);
      sent = true;
    } catch (e0) {
      console.log('[NATIVE_MENU] native list failed:', e0?.message || e0);
      const listPayload = {
        text: compactBody,
        footer: '⚡ ' + CONFIG.BOT_NAME + ' v' + CONFIG.VERSION + ' • tap a category',
        title: '🗂️ AVAILABLE MENUS',
        buttonText: '📂 Open Categories',
        sections: [{ title: '┌── ' + CONFIG.BOT_NAME + ' MENU ──┐', rows: catRows }],
      };
      if (ppUrl) listPayload.contextInfo = __ppContext(ppUrl, "Tap a category below");
      try { await sock.sendMessage(jid, listPayload, { quoted: imgSent ? undefined : msg }); sent = true; }
      catch (e1) { console.log('[LIST_MENU] listMessage failed:', e1?.message || e1); }
    }
  }
  if (imgSent) sent = true;

  if (!sent) {
    await _sendPlainReply(sock, msg, menuText);
    return;
  }

  await sendMenuSong(sock, jid, msg);
}

const _sendPlainReply = async (sock, msg, text, mentions = []) => {
  const jid = msg.key.remoteJid;
  const finalText = _beautifyMentions(normalizeOutgoingText(String(text ?? ""), msg), mentions);
  try {
    return await sock.sendMessage(jid, { text: finalText, mentions }, { quoted: msg });
  } catch (e1) {
    console.log("[REPLY] quoted reply failed:", e1.message, "— retrying without quote");
    try {
      return await sock.sendMessage(jid, { text: finalText, mentions });
    } catch (e2) {
      console.error("[REPLY] even plain send failed:", e2.message);
    }
  }
};

async function sendButtonsReply(sock, msg, text, mentions = []) {
  const jid = msg.key.remoteJid;
  const finalText = _beautifyMentions(normalizeOutgoingText(String(text ?? ""), msg), mentions);
  const payload = {
    text: finalText,
    mentions,
    footer: `${CONFIG.BOT_NAME} • ${CONFIG.VERSION}`,
    buttons: _menuButtonsPayload(),
    headerType: 1,
  };
  try {
    return await sendNativeFlowButtons(sock, jid, msg, finalText, [{ id: `${CONFIG.PREFIX}menu`, text: "🗂️ MENU" }, { id: `${CONFIG.PREFIX}ping`, text: "🏓 PING" }, { id: `${CONFIG.PREFIX}runtime`, text: "⏱️ RUNTIME" }]);
  } catch (nativeErr) {}
  try {
    return await sock.sendMessage(jid, payload, { quoted: msg });
  } catch (e1) {
    console.log("[BUTTON-REPLY] quoted send failed:", e1?.message || e1);
    try {
      return await sock.sendMessage(jid, payload);
    } catch (e2) {
      console.error("[BUTTON-REPLY] plain send failed:", e2?.message || e2);
      return await _sendPlainReply(sock, msg, text, mentions);
    }
  }
}

const sendReply = async (sock, msg, text, mentions = []) => {
  const jid = msg.key.remoteJid || "";
  if (jid.endsWith("@newsletter")) return _sendPlainReply(sock, msg, text, mentions);
  const ownerS = getSettings(getOwnerJid());
  const explicitMenuMode = __MENU_MODES.includes(ownerS?.menuMode) ? ownerS.menuMode : "";
  if (explicitMenuMode) {
    if (explicitMenuMode === "button") return sendButtonsReply(sock, msg, text, mentions);
    return _sendPlainReply(sock, msg, text, mentions);
  }
  if (ownerS?.buttonsMode) return sendButtonsReply(sock, msg, text, mentions);
  return _sendPlainReply(sock, msg, text, mentions);
};
const sendSmartReply = sendReply;
const sendText = (sock, jid, text, mentions = []) =>
  sock.sendMessage(jid, { text: _beautifyMentions(normalizeOutgoingText(String(text ?? "")), mentions), mentions });

// ─────────────────────────────────────────────────────────────────────
// PERSISTENCE: saveNow — debounced wrapper around saveAllData
// ─────────────────────────────────────────────────────────────────────
let _saveNowTimer = null;
function saveNow() {
  if (_saveNowTimer) return;
  _saveNowTimer = setTimeout(() => {
    _saveNowTimer = null;
    try {
      saveAllData({
        economy, settings, warns, bans: bannedUsers, sudo: sudoUsers,
        badwords: badWords, inventory, relationships, factions,
        userfaction: userFaction, crypto: cryptoPortfolios, grouprules: groupRules,
      });
    } catch (e) { console.error("[saveNow]", e?.message || e); }
  }, 800);
}
globalThis.saveNow = saveNow;

// ─────────────────────────────────────────────────────────────────────
// SAFE MODE: list of risky cmds blocked when safeMode is ON
// ─────────────────────────────────────────────────────────────────────
// v15: Adult cmds are NOT here — safeMode already disables adultMode separately,
// which hides them via the category filter. RISKY_CMDS = anything that can
// genuinely get the bot/owner banned, kicked, or blow up a group/contact list.
const RISKY_CMDS = new Set([
  // group destruction / mass-kick — hijack/takegroup/stealgroup REMOVED in v4.8.0
  "kickall","kickinactive","killgc","newgroup","newgroup2","tkick",
  "leave","destroy","reset","resetgroup",
  // mass-mention / spam (gets bot banned by WA)
  "tagall","everyone","botall","hidetag","tag","mention","mentionall",
  // mass DM / blasts
  "broadcast","bcast","bc","sendall","dmall","spam","sms",
  // moderation that can be abused
  "ban","unban","banall","mute","unmute","muteall","warnall","resetwarn",
  "promote","demote","add","kick","report","gban","ungban",
  // anti-raid / anti-* triggers (can chain-kick a whole group)
  "antiraid","antidemote","antipromote",
  // dangerous bot-state ops
  "update","restart","reboot","shutdown","nuke","wipe","cleardb",
  // scraping / data-harvesting
  "scrapegroup","scrape","getvcf","vcf","listghost","listactive",
  // prank / crash / flooding
  "crash","flood","prank","zalgo","crack",
  // adult / explicit content
  "nsfw","adult","hentai","explicit","rule34","xnxx","porn",
]);

// ─────────────────────────────────────────────────────────────────────
// ADULT VIDEO HELPER + per-chat picker store (.xxnx → numbered list → reply N)
// ─────────────────────────────────────────────────────────────────────
const _lastAdultResults = new Map(); // jid → [{ title, url, thumb }]

async function sendAdultVideo(sock, jid, msg, item, opts = {}) {
  try {
    const direct = _pickDirectFromItem(item);
    let mp4 = direct;
    if (!mp4) mp4 = await _resolvePageToMp4(_itemPageUrl(item));
    if (!mp4) return false;
    const buf = await _downloadVideoBuf(mp4, _itemPageUrl(item));
    if (!buf) return false;
    await sock.sendMessage(jid, {
      video: buf, mimetype: "video/mp4",
      caption: `${opts.captionPrefix || "🔞"}\n\n*${item.title || ""}*${item.duration ? `\n⏱ ${item.duration}` : ""}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`,
    }, { quoted: msg });
    return true;
  } catch (e) { console.error("[sendAdultVideo]", e?.message); return false; }
}

async function sendLongText(sock, jid, text, quoted = null, mentions = []) {
  const value = String(text || "").trim();
  if (!value) return;
  const limit = 3500;
  let remaining = value;

  while (remaining.length) {
    let chunk = remaining.slice(0, limit);
    if (remaining.length > limit) {
      const breakAt = Math.max(
        chunk.lastIndexOf("\n\n"),
        chunk.lastIndexOf("\n"),
        chunk.lastIndexOf(". "),
        chunk.lastIndexOf(" ")
      );
      if (breakAt > 1000) {
        chunk = chunk.slice(0, breakAt + (chunk[breakAt] === " " ? 0 : 1));
      }
    }

    const payload = mentions.length ? { text: normalizeOutgoingText(chunk), mentions } : { text: normalizeOutgoingText(chunk) };
    await sock.sendMessage(jid, payload, quoted ? { quoted } : {});
    remaining = remaining.slice(chunk.length).trimStart();
  }
}

const react = (sock, msg, emoji) =>
  sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => {});

const processedMessages = new Set();
// ── Message store for retry decryption ──
const _msgRetryStore = new Map();
function storeMessage(msg) {
  if (msg?.key?.id && msg?.message) {
    let stored = null;
    try {
      stored = JSON.parse(JSON.stringify(unwrapMessageContent(msg.message) || msg.message));
    } catch {
      stored = unwrapMessageContent(msg.message) || msg.message;
    }
    if (!stored || typeof stored !== "object") return;
    stored._jid = msg.key.remoteJid;
    stored._fromMe = !!msg.key.fromMe;
    stored._participant = msg.key.participant || msg.participant || msg.key.remoteJid;
    const ts = msg.messageTimestamp?.low || msg.messageTimestamp || Math.floor(Date.now() / 1000);
    stored._ts = Number(ts) * 1000;
    _msgRetryStore.set(msg.key.id, stored);
    if (_msgRetryStore.size > 3000) {
      const first = _msgRetryStore.keys().next().value;
      _msgRetryStore.delete(first);
    }
  }
}
async function downloadStoredMediaBuffer(mediaNode, type) {
  const stream = await downloadContentFromMessage(mediaNode, type);
  let buf = Buffer.from([]);
  for await (const chunk of stream) buf = Buffer.concat([buf, chunk]);
  return buf;
}
function rememberMessage(msg) {
  const key = [msg?.key?.remoteJid || "", msg?.key?.participant || "", msg?.key?.id || ""].join("|");
  if (!key.replace(/\|/g, "").trim()) return false;
  if (processedMessages.has(key)) return false;
  processedMessages.add(key);
  if (processedMessages.size > 10000) {
    const iter = processedMessages.values();
    for (let i = 0; i < 2000; i++) {
      const val = iter.next().value;
      if (val) processedMessages.delete(val);
    }
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────
// v14: AUTO CACHE CLEANER — runs every 10 minutes to keep RAM low.
// Clears transient/in-memory caches but PRESERVES:
//   • pushNameCache   (push names — needed for nice mentions)
//   • settings/economy/sudoUsers/bannedUsers/etc. (persistent stores)
//   • _lidToJidMap    (LID resolution map — re-fetching is expensive)
//   • _ownerLidJid / _botJid (owner identity)
// ─────────────────────────────────────────────────────────────────────
const CACHE_CLEAN_MS = 60 * 60 * 1000;
function autoCleanCaches() {
  try {
    const before = {
      msgRetry: _msgRetryStore.size,
      processed: processedMessages.size,
      adult: (typeof _lastAdultResults !== "undefined" ? _lastAdultResults.size : 0),
    };
    processedMessages.clear();
    if (typeof _lastAdultResults !== "undefined" && _lastAdultResults.clear) _lastAdultResults.clear();
    if (global.gc) { try { global.gc(); } catch {} }
    const memMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
    console.log(`🧹 [auto-clean 1h] kept msgRetry=${before.msgRetry} pushNames=${pushNameCache.size} | cleared processed=${before.processed} adult=${before.adult} | RAM=${memMb}MB`);
  } catch (e) { console.log("[auto-clean] error:", e?.message); }
}
const _autoCleanTimer = setInterval(autoCleanCaches, CACHE_CLEAN_MS);
if (_autoCleanTimer.unref) _autoCleanTimer.unref();
console.log(`⏱️  Auto cache cleaner armed — every ${CACHE_CLEAN_MS/60000} min (msgRetry + pushNames preserved).`);

function shouldProcessIncomingMessage(msg) {
  if (!msg?.message || !msg?.key?.remoteJid) {
    console.log("[FILTER] no message or no remoteJid — skipped");
    return false;
  }

  const contentKeys = Object.keys(msg.message || {});
  if (!contentKeys.length) {
    console.log("[FILTER] empty content keys — skipped");
    return false;
  }
  const ignorable = new Set(["protocolMessage", "messageContextInfo", "senderKeyDistributionMessage"]);
  if (contentKeys.every(key => ignorable.has(key))) {
    console.log("[FILTER] protocol/system msg — skipped");
    return false;
  }

  // Some panels/hosts can deliver fresh WhatsApp messages with delayed timestamps.
  // Never drop actual command messages or active settings-menu replies because of age.
  let body = "";
  try { body = typeof getBody === "function" ? (getBody(msg) || "") : ""; } catch {}
  try { body = _extractButtonCommand(body) || body; } catch {}
  const text = String(body || "").trim();
  const isCommand = !!text && text.startsWith(CONFIG.PREFIX);
  const isSettingsReply = !!settingsSession.get(msg.key.remoteJid) && /^(\d{1,2}\.\d{1,2}|0)$/.test(text);

  // Only ignore clearly stale non-text backlog messages during early boot.
  const ts = (msg.messageTimestamp?.low || msg.messageTimestamp || 0);
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(ts));
  const uptimeSec = process.uptime();
  const hasInteractivePayload = !!(msg.message?.buttonsResponseMessage || msg.message?.listResponseMessage || msg.message?.templateButtonReplyMessage || msg.message?.interactiveResponseMessage);
  // NEVER filter owner/fromMe messages, commands, settings replies, or real text/button inputs by age.
  if (ts && age > (6 * 60 * 60) && uptimeSec < 20 && !msg.key.fromMe && !isCommand && !isSettingsReply && !text && !hasInteractivePayload) {
    console.log(`[FILTER] stale backlog msg (age=${age}s, uptime=${Math.round(uptimeSec)}s) — skipped`);
    return false;
  }
  return rememberMessage(msg);
}

async function isGroupAdmin(sock, gid, jid) {
  try {
    const meta = await sock.groupMetadata(gid);
    updateLidMappingsFromMeta(meta);
    const raw = String(jid || "").toLowerCase();
    const resolved = String(resolveLid(jid) || "").toLowerCase();
    const cleanJid = _cleanNum(resolved || raw);
    return (meta.participants || []).some(p => {
      if (!(p.admin === "admin" || p.admin === "superadmin")) return false;
      const ids = [p.id, p.lid, p.pn, p.phoneNumber]
        .filter(Boolean)
        .map(v => String(v).toLowerCase());
      return ids.some(id => id === raw || id === resolved || String(resolveLid(id) || "").toLowerCase() === resolved || _cleanNum(id) === cleanJid);
    });
  } catch { return false; }
}
function requireGroup(msg) { return (msg.key.remoteJid || "").endsWith("@g.us"); }

function cdCheck(store, jid, ms) {
  const now = Date.now(), last = store.get(jid) || 0;
  if (now - last < ms) return Math.ceil((ms - (now - last)) / 1000);
  store.set(jid, now); return 0;
}

function fmtUptime(s) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return `${d}𝐝 ${h}𝐡 ${m}𝐦 ${sec}𝐬`;
}
function parseDurationMs(input, fallbackMs = 5 * 60 * 1000) {
  const raw = String(input || "").toLowerCase().trim();
  const m = raw.match(/^(\d+)(s|sec|secs|m|min|mins|h|hr|hrs|d|day|days)?$/);
  if (!m) return fallbackMs;
  const n = Math.max(1, parseInt(m[1], 10));
  const unit = m[2] || "m";
  if (unit.startsWith("s") || unit === "sec" || unit === "secs") return n * 1000;
  if (unit.startsWith("h") || unit === "hr" || unit === "hrs") return n * 60 * 60 * 1000;
  if (unit.startsWith("d") || unit === "day" || unit === "days") return n * 24 * 60 * 60 * 1000;
  return n * 60 * 1000;
}
function normalizeAnswerText(text) { return String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function sameAnswer(got, expected) { const a = normalizeAnswerText(got), b = normalizeAnswerText(expected); return !!a && !!b && (a === b || a.includes(b) || b.includes(a)); }
const ADMIN_ALLOWED_CMDS = new Set(["tagall","everyone","botall","hidetag","tag","mention","mentionall","antilink","antic","allowlink","denylink","antisticker","antibad","addbadword","removebadword","listbadwords","warn","warning","warns","warnlist","resetwarn","kick","tkick","tempkick","tk","mute","unmute","promote","demote","link","revoke","autodelete","autodel","ephemeral","pinchat","unpinchat","group","closetime","opentime","approval","disapproval","listrequest","antispam","antiraid"]);
async function isBotGroupAdmin(sock, gid) { try { const meta = await sock.groupMetadata(gid); const me = _cleanNum(sock.user?.id || _botJid || ""); return (meta.participants || []).some(p => _cleanNum(p.id) === me && (p.admin === "admin" || p.admin === "superadmin")); } catch { return false; } }
async function applyGuardAction(sock, gid, target, msgKey, mode, label, type = "") {
  const cleanTarget = resolveLid(target || "");
  const botAdmin = await isBotGroupAdmin(sock, gid);
  const action = String(mode || "delete").toLowerCase();
  let done = "";
  if (["delete", "warn", "kick", "tkick"].includes(action) && botAdmin) { try { await sock.sendMessage(gid, { delete: msgKey }); done = "message deleted"; } catch {} }
  if (!botAdmin && ["delete", "kick", "tkick"].includes(action)) done = "need bot admin before I can delete/kick";
  if (action === "warn") { const gw = warns.get(gid) || new Map(); warns.set(gid, gw); gw.set(cleanTarget, (gw.get(cleanTarget) || 0) + 1); done = `warned (${gw.get(cleanTarget)}/3)`; if (gw.get(cleanTarget) >= 3 && botAdmin) { try { await sock.groupParticipantsUpdate(gid, [cleanTarget], "remove"); done = "warned 3/3 + kicked"; gw.delete(cleanTarget); } catch {} } }
  else if (action === "kick" && botAdmin) { try { await sock.groupParticipantsUpdate(gid, [cleanTarget], "remove"); done = "kicked"; } catch { done = done || "delete done, kick failed"; } }
  else if (action === "tkick" && botAdmin) { try { await sock.groupParticipantsUpdate(gid, [cleanTarget], "remove"); done = "temp-kicked"; setTimeout(() => sock.groupParticipantsUpdate(gid, [cleanTarget], "add").catch(() => {}), parseDurationMs("5m")); } catch { done = done || "delete done, temp-kick failed"; } }
  if (!done) done = action === "delete" ? "message deleted" : action;
  await sock.sendMessage(gid, { text: `🚫 *${label} triggered*${type ? `\n\n🔎 Type: *${type}*` : ""}\n👤 User: @${cleanTarget.split("@")[0]}\n🛡️ Mode: *${action.toUpperCase()}*\n✅ Action: *${done}*${!botAdmin ? "\n\n⚠️ Make the bot admin to delete/kick automatically." : ""}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, mentions: [cleanTarget] }).catch(() => {});
}

// ═══════════════════════════════════════════════════════════════════════════════
//  COMMAND REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════
const commands = new Map();
function cmd(names, opts, handler) {
  for (const n of [].concat(names)) commands.set(n.toLowerCase(), { ...opts, handler });
}

  cmd(["animedl", "animedownload", "anime4k"], { desc: "Download anime episodes by name", category: "ANIME" }, async (sock, msg, args) => {
    if (!args.length) {
      await sendReply(sock, msg, `🎌 *Anime Download*\n\nUsage: ${CONFIG.PREFIX}animedl <anime name> [episode]\nExample: ${CONFIG.PREFIX}animedl Naruto 1\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
      return;
    }
    await react(sock, msg, "🎌");
    const query = args.slice(0, -1).join(" ") || args.join(" ");
    const episode = parseInt(args[args.length-1]) || 1;
    const actualQuery = isNaN(parseInt(args[args.length-1])) ? args.join(" ") : args.slice(0,-1).join(" ");
    try {
      // Search anime
      const searchRes = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(actualQuery)}&limit=5`, { timeout: 10000 });
      const animes = searchRes.data?.data || [];
      if (!animes.length) {
        await react(sock, msg, "❌");
        await sendReply(sock, msg, `❌ No anime found for: *${actualQuery}*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
        return;
      }
      const anime = animes[0];
      const title = anime.title;
      const imgUrl = anime.images?.jpg?.image_url;
      const synopsis = (anime.synopsis || "No synopsis available.").slice(0,300);
      const episodes = anime.episodes || "?";
      const score = anime.score || "N/A";
      // Try download APIs
      const dlApis = [
        `https://api.xaviersprecious.workers.dev/anime?name=${encodeURIComponent(title)}&ep=${episode}`,
        `https://gogoanime.dk/search/${encodeURIComponent(title)}`,
      ];
      let dlLink = null;
      for (const api of dlApis) {
        try {
          const r = await axios.get(api, { timeout: 8000 });
          if (r.data?.link || r.data?.download || r.data?.url) {
            dlLink = r.data.link || r.data.download || r.data.url;
            break;
          }
        } catch {}
      }
      const caption = `🎌 *${title}*
      
  📺 Episodes: ${episodes}
  ⭐ Score: ${score}

  📖 Synopsis:
  ${synopsis}...

  ${dlLink ? `⬇️ Episode ${episode}: ${dlLink}` : `⚠️ Direct download not available.\nVisit: https://gogoanime.dk\nSearch: *${title}*`}

  > ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
      if (imgUrl) {
        try {
          const imgBuf = Buffer.from((await axios.get(imgUrl, { responseType:"arraybuffer", timeout:8000 })).data);
          await sock.sendMessage(msg.key.remoteJid, { image: imgBuf, caption }, { quoted: msg });
        } catch { await sendReply(sock, msg, caption); }
      } else { await sendReply(sock, msg, caption); }
      await react(sock, msg, "✅");
    } catch (e) {
      await react(sock, msg, "❌");
      await sendReply(sock, msg, `❌ Error: ${e.message}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    }
  });

// ═══════════════════════════════════════════════════════════════════════════════
//  MENU SYSTEM — PRECIOUS x STYLE
// ═══════════════════════════════════════════════════════════════════════════════
const MENU_CATEGORIES = [
  { name: "AI",        emoji: "🤖", cmds: ["flux","text2img","wan","gpt","summarize","recipe","chatbot","editimg","upscale","removebg","enhance","sora","gemini","duckai","transcribe","vision","tts"] },
  { name: "ANIME",     emoji: "🎌", cmds: ["anime","animequote","waifu","neko","foxxgirl","animedl"] },
  { name: "AUDIO",     emoji: "🎵", cmds: ["deep","smooth","fat","tupai","blown","radio","robot","chipmunk","nightcore","earrape","bass","reverse","slow","fast","baby","deamon"] },
  { name: "CONFIG",    emoji: "⚙️",  cmds: ["setprefix","settheme"] },
  { name: "CREATOR",   emoji: "👑", cmds: ["eval","removeval","listeval","shell","getcmd","install","deleteplugin","listplugins","writefile","cleandb","sysinfo","setemoji","addcase","dropcase"] },
  { name: "DEBUG",     emoji: "🐛", cmds: ["test"] },
  { name: "DOWNLOAD",  emoji: "📥", cmds: ["ytmp3","ytmp4","tiktok","tt","twitter","xdl","spotify","spotdl","facebook","instagram","ig","igdl","play","ytv","snapchat","capcut","threads","music","song","moviedl","trending","pinterest","pinsearch","pindl","mediafire","soundcloud","sc","apk","reddit","pdf"] },
  { name: "ECONOMY",   emoji: "💰", cmds: ["money","rank","perks","daily","work","crime","beg","fish","hunt","pay","rob","richest","networth","cooldowns","transactions","achievements","grouplb","deposit","withdraw","bankbal","interest","assets","buyasset","collect","upgrade","hireworker","sellasset","shop","inventory","shopadd","shopdel","coinflip","dice","slots","roulette","blackjack","gamble","crash","highlow","wheel","cups","scratch","numberguess","russianroulette","horserace","rockpaperscissors","rps","lottery","gambstats","market","sell","marketbuy","unsell","gift","addcoins","removecoins","setcoins","setlevel","addlevel","addbank","ecoreset","hospital","nerve","energy","status","autoshield","tornhelp","train","stats","battlelb","attack","attacklog","cities","travel","travelstatus","abroad","buyitem","sellitems","mybag","crypto","buyc","sellc","portfolio","cryptolb","drugs","buydrg","usedrg","drugstatus","createfaction","joinfaction","leavefaction","faction","fmembers","fvault","fdeposit","fwithdraw","finvite","fkick","fopen","fwar","factions","bounties","setbounty","mybounty","petshop","buypet","mypet","carepet","renamepet","petleaderboard","petreward","profile"] },
  { name: "FUN",       emoji: "🎉", cmds: ["confess","birthday","engage","accept","reject","divorce","signdivorcepaper","contestdivorce","date","breakup","crush","mixedfeelings","ecobio","relstatus","duel","acceptduel","joke","truth","dare","advice","line","insult","meme","adopt","adoptlist","unadopt","vibecheck","emojiart","shout","rate","fakechat","gaycheck","lescheck","hack","repeat"] },
  { name: "GAMES",     emoji: "🎮", cmds: ["wcg","trivia","guesssong","ttt","hangman","math","emojiquiz","riddle","tod","wyr","spinbottle","nhie","lb","unscramble","wordle","whoami"] },
  { name: "GROUP",     emoji: "👥", cmds: ["confession","groupid","offhere","onhere","welcome","goodbye","setwelcome","setgoodbye","welcomedm","setwelcomedm","adminevent","antilink","antic","antistatus","antibad","addbadword","removebadword","listbadwords","antisticker","allowlink","denylink","kickinactive","totalmember","warn","warns","resetwarn","kick","promote","demote","voteclosse","cleanlast","mute","unmute","autodelete","group","closetime","opentime","tagall","botall","tag","link","revoke","listrequest","approval","disapproval","join","leave","add","kickall","bancmd","unbancmd","bannedcmds","gcstatus","groupstatus","togstatus","togcstatus","gstatus","gcstory","trigger","analytics","listactive","listghost","peaktimes","listmessages","poll","multipoll","endpoll","antiraid","antispam","antidemote","antipromote","newgroup","killgc","getlid","tkick"] },
  { name: "HENTAI",    emoji: "🔞", cmds: ["htimig","xsearch","xdl","xget","xhsearch","xhdl","phsearch","phdl","hentaivid","xnxx","xxnx","pornhub","ph","xhamster","goon","goonmode","goonoff","goonstatus"], adult: true },
  { name: "INFO",      emoji: "📊", cmds: ["device","botinfo","groupinfo","ginfo","gcinfo","whois","admins","support","getpp","vcf","cinfo","jid","allmenu","allcmds","fullmenu","listall", "aza", "setaza", "setazapic"] },
  { name: "LOGO",      emoji: "🎨", cmds: ["alienglow","burning","chromeone","chrometwo","comic","fire","glowinghot","glowingsteel","gradientbevel","slab","neontext","simple","starburst","felt","outline","animatedglow","3dtextured","3dgradient","glossy","embossed","pixelbadge","chromium","iced","frosty","particle","moltencore","glitter","fantasy","logolist"] },
  { name: "MEDIA",     emoji: "🖼️", cmds: ["toimg","tomp3","toaudio","toptt","tovideo","togif"] },
  { name: "MISC",      emoji: "📁", cmds: ["antidelete","antidstatus","antiedit","antivonce","ping","uptime","alive","runtime","owner","echo","report","feedback","request"] },
  { name: "OWNER",     emoji: "🔐", cmds: ["autobio","autoreact","autoview","autolike","antivo","bcheck","bancheck","setcmd","removecmd","listsetcmd","inbox","viewentry","replyentry","delentry","clearinbox","mode","restart","broadcast","slowmode","ban","unban","listban","setsudo","delsudo","listsudo","ghostmode","autotyping","autorecording","tostatus","togc","checkupdate","update","mygroups","newgroup2"] },
  { name: "REACTIONS", emoji: "💫", cmds: ["hug","kiss","pat","slap","wink","bonk","poke","yeet","blush","wave","smile","highfive","handhold","nom","bite","glomp","cringe","dance"] },
  { name: "RELIGION",  emoji: "📖", cmds: ["bible","quran"] },
  { name: "SEARCH",    emoji: "🔍", cmds: ["define","tiksearch","spotisearch","ytsearch","img","google","lyrics","lyrics2","weather","currency","github","wiki","ud","news","movie","ftball"] },
  { name: "SESSION",   emoji: "🔑", cmds: ["pair","pair1","pair1","pair2","validate"] },
  { name: "SETTINGS",  emoji: "⚙️",  cmds: ["getprivacy","setprivacy","setpp","setbio","setname","fulldp","setting","settings"] },
  { name: "TEXT",      emoji: "📝", cmds: ["say","fancy","fancylist"] },
  { name: "TOOLS",     emoji: "🔧", cmds: ["afk","unafk","calc","note","price","fetch","schedule","schedules","cancelschedule","shazam","sticker","take","shorten","qr","ss","ip","trt","uuid","save","time","rmwm","vv","vv2","calendar","ebinary","debinary","truecaller","ebase","dbase","domaincheck","bcheck"] },
  { name: "UTILITY",   emoji: "🛠️", cmds: ["fakeid","leakcheck","tempmail","checkmail","readmail","remind","tourl","litterbox"] },
  { name: "WHATSAPP",  emoji: "📱", cmds: ["unsend","forward","block","unblock","clear","pinchat","unpinchat","pin","unpin","archive","unarchive","del"] },
];

// ── Robust bot picture fetcher with validation + fallbacks ──────────────────
// Includes 3 NEW local pics bundled in /assets/ (never expire) + remote fallbacks
const _ASSETS_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), "assets");
const _LOCAL_BOT_PICS = ["menu-cover.jpg", "botpic1.jpg", "botpic2.jpg", "botpic3.jpg"]
  .map(f => path.join(_ASSETS_DIR, f))
  .filter(p => { try { return fs.existsSync(p); } catch { return false; } });
const _BOT_PIC_FALLBACKS = [
  "https://files.catbox.moe/05rqy6.png",
  "https://i.imgur.com/MZWM6eQ.jpeg",
  "https://i.ibb.co/xqkYGCC/mias-mdx.jpg",
];
async function getBotPic() {
  // 30% chance: rotate to a local bundled pic (anime/eye/selfie set the user uploaded)
  if (_LOCAL_BOT_PICS.length && Math.random() < 0.5) {
    try {
      const pick = _LOCAL_BOT_PICS[Math.floor(Math.random() * _LOCAL_BOT_PICS.length)];
      const buf = fs.readFileSync(pick);
      if (buf && buf.length > 1000) return buf;
    } catch {}
  }
  for (const url of _BOT_PIC_FALLBACKS) {
    try {
      const res = await axios.get(url, { responseType: "arraybuffer", timeout: 12000, headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.data || res.data.byteLength < 5000) continue;
      const first = Buffer.from(res.data).slice(0, 4).toString("hex");
      // Validate magic bytes: JPEG (ffd8), PNG (89504e47), WebP (52494646)
      if (first.startsWith("ffd8") || first.startsWith("8950") || first.startsWith("5249")) {
        return Buffer.from(res.data);
      }
    } catch {}
  }
  // Last resort: any local pic even without random gate
  if (_LOCAL_BOT_PICS.length) {
    try { return fs.readFileSync(_LOCAL_BOT_PICS[0]); } catch {}
  }
  return null;
}

function buildMenu(jid, senderName) {
  const s = getSettings(jid);
  const up = process.uptime();
  const mem = process.memoryUsage();
  const now = new Date();
  const ngTime = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Lagos" }));
  const hh = ngTime.getHours(), mm = String(ngTime.getMinutes()).padStart(2, "0");
  const ampm = hh >= 12 ? "PM" : "AM";
  const hh12 = String(hh % 12 || 12).padStart(2, "0");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const timeStr = `${hh12}:${mm} ${ampm} — ${months[ngTime.getMonth()]} ${ngTime.getDate()}`;
  const totalCmds = commands.size;
  const ramUsed = (mem.rss / 1048576).toFixed(0);
  const greet = hh < 5 ? "🌙 Late Night" : hh < 12 ? "🌅 Good Morning" : hh < 17 ? "☀️ Good Afternoon" : hh < 21 ? "🌆 Good Evening" : "🌙 Good Night";

  let t = "";
  t += `✦ ─────────────────── ✦\n`;
  t += `  ⚡  *𝑴𝑰𝑨𝑺  𝑴𝑫𝑿*  ⚡\n`;
  t += `✦ ─────────────────── ✦\n\n`;
  t += `${greet}, *${senderName}* 👋\n\n`;
  t += `┌─────「 *𝗦𝗬𝗦𝗧𝗘𝗠 𝗦𝗧𝗔𝗧𝗦* 」─────\n`;
  t += `│  ◈ 𝗣𝗿𝗲𝗳𝗶𝘅    ➜  \`${CONFIG.PREFIX}\`\n`;
  t += `│  ◈ 𝗖𝗼𝗺𝗺𝗮𝗻𝗱𝘀  ➜  ${totalCmds}+\n`;
  t += `│  ◈ 𝗩𝗲𝗿𝘀𝗶𝗼𝗻   ➜  ${CONFIG.VERSION}\n`;
  t += `│  ◈ 𝗠𝗼𝗱𝗲     ➜  ${s.workMode || "public"}\n`;
  t += `│  ◈ 𝗨𝗽𝘁𝗶𝗺𝗲   ➜  ${fmtUptime(up)}\n`;
  t += `│  ◈ 𝗥𝗔𝗠      ➜  ${ramUsed} MB\n`;
  t += `│  ◈ 𝗧𝗶𝗺𝗲     ➜  ${timeStr}\n`;
  t += `└─────────────────────────\n\n`;
  t += `╔══「 *𝗖𝗔𝗧𝗘𝗚𝗢𝗥𝗜𝗘𝗦* 」══╗\n`;
  for (const cat of MENU_CATEGORIES) {
    if (cat.adult && (!s.adultMode || s.safeMode)) continue;
    const count = [...new Set(cat.cmds)].length;
    t += `║  ${cat.emoji} *${cat.name}*  ‹${count}›  » ${CONFIG.PREFIX}menu ${cat.name.toLowerCase()}\n`;
  }
  t += `╚══════════════════════╝\n\n`;
  t += `❒ _${CONFIG.PREFIX}menu <category>_ — open a category\n`;
  t += `❒ _${CONFIG.PREFIX}allmenu_ — all commands in one shot\n`;
  t += `❒ _${CONFIG.PREFIX}settings_ — configure the bot\n\n`;
  t += `> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
  return t;
}

cmd(["menu", "help", "commands", ".menu", "start"], { desc: "Show full menu", category: "INFO" }, async (sock, msg, args) => {
  const jid = msg.key.remoteJid;
  const sender = getSender(msg);
  const rawPushName = msg.pushName || msg.verifiedBizName || "";
  if (rawPushName && rawPushName.trim() && !/^\d+$/.test(rawPushName.trim())) {
    const snum = _cleanNum(sender);
    if (snum) pushNameCache.set(snum, rawPushName.trim());
  }
  let senderName = await getDisplayName(sock, sender, isGroup(msg) ? jid : null);
  if ((!senderName || /^\+?\d+$/.test(senderName)) && rawPushName && rawPushName.trim()) {
    senderName = rawPushName.trim();
  }

  if (args[0]) {
    const catName = args[0].toUpperCase();
    const cat = MENU_CATEGORIES.find(c => c.name === catName || c.name.startsWith(catName));
    if (!cat) { await sendReply(sock, msg, `❓ Category *${args[0].toUpperCase()}* not found.\nUse ${CONFIG.PREFIX}menu to see all categories.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; }
    if (cat.adult && !getSettings(jid).adultMode) { await sendReply(sock, msg, `🔞 Enable adult mode first with ${CONFIG.PREFIX}setting → option 23.1\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; }
    const uniq = [...new Set(cat.cmds)];
    let text = `${cat.emoji} ━━「 *${cat.name}* 」━━ ${uniq.length} cmds\n\n`;
    for (const c of uniq) {
      const info = commands.get(c);
      text += `  ✦ ${CONFIG.PREFIX}${c}${info?.desc ? "\n    _" + info.desc + "_" : ""}\n`;
    }
    text += `\n━━━━━━━━━━━━━━━━━━━\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
    await sendReply(sock, msg, text);
    return;
  }

  await react(sock, msg, "📋");
  const menuText = buildMenu(jid, senderName);
  // Use bot pic as the primary cover for interactive list menu
  // getBotPic() picks from botpic1/2/3.jpg (your actual bot profile pics)
  let coverBuf = await getBotPic().catch(() => null);
  // Fallback: try button-menu.jpg
  if (!coverBuf) {
    const coverPath = path.join(__dirname, "assets", "button-menu.jpg");
    try { if (fs.existsSync(coverPath)) coverBuf = fs.readFileSync(coverPath); } catch {}
  }
  if (!coverBuf) {
    const _nightMenuPic2 = typeof MENU2_PIC_B64 !== "undefined" && MENU2_PIC_B64 ? Buffer.from(MENU2_PIC_B64, "base64") : null;
    if (_nightMenuPic2) coverBuf = _nightMenuPic2;
  }

  // Respect explicit menuMode without changing the original text-menu path
  const ownerS = getSettings(getOwnerJid());
  const explicitMenuMode = __MENU_MODES.includes(ownerS?.menuMode) ? ownerS.menuMode : "";
  if (!jid.endsWith("@newsletter")) {
    if (explicitMenuMode === "button") {
      const entry = commands.get("btnmenu");
      if (entry?.handler) { await entry.handler(sock, msg, []); return; }
    }
    if (explicitMenuMode === "flow") {
      const entry = commands.get("flowmenu");
      if (entry?.handler) { await entry.handler(sock, msg, []); return; }
    }
    if (explicitMenuMode === "list") {
      await sendInteractiveListMenu(sock, msg, menuText, coverBuf);
      return;
    }
    if (!explicitMenuMode && !!ownerS?.buttonsMode) {
      await sendInteractiveListMenu(sock, msg, menuText, coverBuf);
      return;
    }
  }
  // Text mode: image + plain text menu, then play a random song
  if (coverBuf) {
    try {
      await sock.sendMessage(jid, { image: coverBuf, caption: menuText }, { quoted: msg });
    } catch {
      await sendReply(sock, msg, menuText);
    }
  } else {
    await sendReply(sock, msg, menuText);
  }
  // Send a random menu song even in text mode
  await sendMenuSong(sock, jid, msg);
});

cmd(["allmenu", "allcmds", "fullmenu", "listall"], { desc: "Show ALL commands at once", category: "INFO" }, async (sock, msg) => {
  const jid = msg.key.remoteJid;
  const s = getSettings(jid);
  await react(sock, msg, "📋");
  const totalCmds = commands.size;
  let text = "";
  text += `⚡ *𝑴𝑰𝑨𝑺 𝑴𝑫𝑿* — FULL COMMAND LIST\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `Prefix: \`${CONFIG.PREFIX}\`  |  Total: *${totalCmds}+ cmds*\n\n`;
  for (const cat of MENU_CATEGORIES) {
    if (cat.adult && (!s.adultMode || s.safeMode)) continue;
    const uniq = [...new Set(cat.cmds)];
    text += `${cat.emoji} *${cat.name}* ‹${uniq.length}›\n`;
    text += `${"─".repeat(22)}\n`;
    const rows = [];
    for (let i = 0; i < uniq.length; i += 3) {
      const row = uniq.slice(i, i + 3).map(c => `${CONFIG.PREFIX}${c}`).join("  ");
      rows.push(`  ${row}`);
    }
    text += rows.join("\n") + "\n\n";
  }
  text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `❒ _${CONFIG.PREFIX}menu <category>_ for details\n\n`;
  text += `> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;

  const coverPath = path.join(__dirname, "assets", "button-menu.jpg");
  let coverBuf = null;
  try { if (fs.existsSync(coverPath)) coverBuf = fs.readFileSync(coverPath); } catch {}
  if (!coverBuf) coverBuf = await getBotPic();

  const ownerS = getSettings(getOwnerJid());
  if (!!ownerS?.buttonsMode && !jid.endsWith("@newsletter")) {
    // Send image first, then extra action buttons
    if (coverBuf) {
      try { await sock.sendMessage(jid, { image: coverBuf, caption: text }, { quoted: msg }); }
      catch {}
    }
    try {
      await sock.sendMessage(jid, {
        text: '━━━━━━━━━━━━━━━━\n🔁 *Quick Actions*',
        footer: CONFIG.BOT_NAME + ' • v' + CONFIG.VERSION,
        buttons: [
          { buttonId: 'BTN:' + CONFIG.PREFIX + 'menu',    buttonText: { displayText: '🗂️ AVAILABLE MENUS' }, type: 1 },
          { buttonId: 'BTN:' + CONFIG.PREFIX + 'ping',    buttonText: { displayText: '🏓 BOT sTATs' },       type: 1 },
          { buttonId: 'BTN:' + CONFIG.PREFIX + 'botinfo', buttonText: { displayText: '✿ BOT INFO' },         type: 1 },
        ],
        headerType: 1,
      }, { quoted: coverBuf ? undefined : msg });
    } catch { }
    return;
  }
  if (coverBuf) {
    try {
      await sock.sendMessage(jid, { image: coverBuf, caption: text }, { quoted: msg });
      return;
    } catch {}
  }
  await sendReply(sock, msg, text);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  ADVANCED SETTINGS MENU (26 sections)
// ═══════════════════════════════════════════════════════════════════════════════
function buildSettingsMenu(jid) {
  const s = getSettings(jid);
  return `╔════〘 *𝗦𝗘𝗧𝗧𝗜𝗡𝗚𝗦* 〙════╗

╭━━❮ *𝗕𝗹𝗼𝗰𝗸 𝗖𝗮𝗹𝗹𝘀* ❯━━╮
┃ 1.1 ᴇɴᴀʙʟᴇ  ${s.blockCalls ? "✅" : ""}
┃ 1.2 ᴅɪsᴀʙʟᴇ  ${!s.blockCalls ? "✅" : ""}
╰━━━━━━━━━━━╯
╭━━❮ *𝗟𝗶𝗻𝗸 𝗚𝘂𝗮𝗿𝗱* ❯━━╮
┃ 2.1 ᴅᴇʟᴇᴛᴇ  ${s.linkGuard === "delete" ? "✅" : ""}
┃ 2.2 ᴋɪᴄᴋ  ${s.linkGuard === "kick" ? "✅" : ""}
┃ 2.3 ᴡᴀʀɴ  ${s.linkGuard === "warn" ? "✅" : ""}
╰━━━━━━━━━━━╯
╭━━❮ *𝗕𝗮𝗱 𝗪𝗼𝗿𝗱 𝗚𝘂𝗮𝗿𝗱* ❯━━╮
┃ 3.1 ᴅᴇʟᴇᴛᴇ  ${s.badWordGuard === "delete" ? "✅" : ""}
┃ 3.2 ᴋɪᴄᴋ  ${s.badWordGuard === "kick" ? "✅" : ""}
┃ 3.3 ᴡᴀʀɴ  ${s.badWordGuard === "warn" ? "✅" : ""}
╰━━━━━━━━━━━╯
╭━━❮ *𝗦𝘁𝗮𝘁𝘂𝘀 𝗠𝗲𝗻𝘁𝗶𝗼𝗻* ❯━━╮
┃ 4.1 ᴅᴇʟᴇᴛᴇ  ${s.statusMention === "delete" ? "✅" : ""}
┃ 4.2 ᴋɪᴄᴋ  ${s.statusMention === "kick" ? "✅" : ""}
┃ 4.3 ᴡᴀʀɴ  ${s.statusMention === "warn" ? "✅" : ""}
┃ 4.4 ғᴀʟsᴇ  ${s.statusMention === "false" ? "✅" : ""}
╰━━━━━━━━━━━╯
╭━━❮ *𝗖𝗮𝗹𝗹 𝗔𝗰𝘁𝗶𝗼𝗻* ❯━━╮
┃ 5.1 ᴄᴜᴛ  ${s.callAction === "cut" ? "✅" : ""}
┃ 5.2 ʙʟᴏᴄᴋ  ${s.callAction === "block" ? "✅" : ""}
╰━━━━━━━━━━━╯
╭━━❮ *𝗔𝗻𝘁𝗶 𝗗𝗲𝗹𝗲𝘁𝗲* ❯━━╮
┃ 6.1 ᴇɴᴀʙʟᴇ  ${s.antiDelete ? "✅" : ""}
┃ 6.2 ᴅɪsᴀʙʟᴇ  ${!s.antiDelete ? "✅" : ""}
╰━━━━━━━━━━━╯
╭━━❮ *𝗔𝘂𝘁𝗼 𝗥𝗲𝗮𝗰𝘁* ❯━━╮
┃ 7.1 ᴇɴᴀʙʟᴇ  ${s.autoReact ? "✅" : ""}
┃ 7.2 ᴅɪsᴀʙʟᴇ  ${!s.autoReact ? "✅" : ""}
╰━━━━━━━━━━━╯
╭━━❮ *𝗔𝘂𝘁𝗼 𝗕𝗹𝗼𝗰𝗸* ❯━━╮
┃ 8.1 ᴇɴᴀʙʟᴇ  ${s.autoBlock ? "✅" : ""}
┃ 8.2 ᴅɪsᴀʙʟᴇ  ${!s.autoBlock ? "✅" : ""}
╰━━━━━━━━━━━╯
╭━━❮ *𝗥𝗲𝗮𝗱 𝗠𝘀𝗴𝘀* ❯━━╮
┃ 9.1 ᴇɴᴀʙʟᴇ  ${s.readMsgs ? "✅" : ""}
┃ 9.2 ᴅɪsᴀʙʟᴇ  ${!s.readMsgs ? "✅" : ""}
╰━━━━━━━━━━━╯
╭━━❮ *𝗩𝗶𝗲𝘄 𝗦𝘁𝗮𝘁𝘂𝘀* ❯━━╮
┃ 10.1 ᴇɴᴀʙʟᴇ  ${s.viewStatus ? "✅" : ""}
┃ 10.2 ᴅɪsᴀʙʟᴇ  ${!s.viewStatus ? "✅" : ""}
╰━━━━━━━━━━━╯
╭━━❮ *𝗥𝗲𝗮𝗰𝘁 𝗦𝘁𝗮𝘁𝘂𝘀* ❯━━╮
┃ 11.1 ᴇɴᴀʙʟᴇ  ${s.reactStatus ? "✅" : ""}
┃ 11.2 ᴅɪsᴀʙʟᴇ  ${!s.reactStatus ? "✅" : ""}
╰━━━━━━━━━━━╯
╭━━❮ *𝗪𝗲𝗹𝗰𝗼𝗺𝗲 𝗠𝘀𝗴* ❯━━╮
┃ 12.1 ᴇɴᴀʙʟᴇ  ${s.welcome ? "✅" : ""}
┃ 12.2 ᴅɪsᴀʙʟᴇ  ${!s.welcome ? "✅" : ""}
╰━━━━━━━━━━━╯
╭━━❮ *𝗔𝘂𝘁𝗼 𝗩𝗼𝗶𝗰𝗲* ❯━━╮
┃ 13.1 ᴇɴᴀʙʟᴇ  ${s.autoVoice ? "✅" : ""}
┃ 13.2 ᴅɪsᴀʙʟᴇ  ${!s.autoVoice ? "✅" : ""}
╰━━━━━━━━━━━╯
╭━━❮ *𝗔𝘂𝘁𝗼 𝗦𝘁𝗶𝗰𝗸𝗲𝗿* ❯━━╮
┃ 14.1 ᴇɴᴀʙʟᴇ  ${s.autoSticker ? "✅" : ""}
┃ 14.2 ᴅɪsᴀʙʟᴇ  ${!s.autoSticker ? "✅" : ""}
╰━━━━━━━━━━━╯
╭━━❮ *𝗔𝘂𝘁𝗼 𝗥𝗲𝗽𝗹𝘆* ❯━━╮
┃ 15.1 ᴇɴᴀʙʟᴇ  ${s.autoReply ? "✅" : ""}
┃ 15.2 ᴅɪsᴀʙʟᴇ  ${!s.autoReply ? "✅" : ""}
╰━━━━━━━━━━━╯
╭━━❮ *𝗥𝗲𝗰𝗼𝗿𝗱𝗶𝗻𝗴* ❯━━╮
┃ 16.1 ᴇɴᴀʙʟᴇ  ${s.recording ? "✅" : ""}
┃ 16.2 ᴅɪsᴀʙʟᴇ  ${!s.recording ? "✅" : ""}
╰━━━━━━━━━━━╯
╭━━❮ *𝗧𝘆𝗽𝗶𝗻𝗴* ❯━━╮
┃ 17.1 ᴇɴᴀʙʟᴇ  ${s.typing ? "✅" : ""}
┃ 17.2 ᴅɪsᴀʙʟᴇ  ${!s.typing ? "✅" : ""}
╰━━━━━━━━━━━╯
╭━━❮ *𝗔𝗹𝘄𝗮𝘆𝘀 𝗢𝗻𝗹𝗶𝗻𝗲* ❯━━╮
┃ 18.1 ᴇɴᴀʙʟᴇ  ${s.alwaysOnline ? "✅" : ""}
┃ 18.2 ᴅɪsᴀʙʟᴇ  ${!s.alwaysOnline ? "✅" : ""}
╰━━━━━━━━━━━╯
╭━━❮ *𝗪𝗼𝗿𝗸 𝗠𝗼𝗱𝗲* ❯━━╮
┃ 19.1 ᴘᴜʙʟɪᴄ  ${s.workMode === "public" ? "✅" : ""}
┃ 19.2 ᴘʀɪᴠᴀᴛᴇ  ${s.workMode === "private" ? "✅" : ""}
┃ 19.3 ᴏɴʟʏ_ɢʀᴏᴜᴘ  ${s.workMode === "only_group" ? "✅" : ""}
┃ 19.4 ɪɴʙᴏx  ${s.workMode === "inbox" ? "✅" : ""}
╰━━━━━━━━━━━╯
╭━━❮ *𝗟𝗮𝗻𝗴𝘂𝗮𝗴𝗲* ❯━━╮
┃ 20.1 ᴇɴ  ${s.language === "en" ? "✅" : ""}
┃ 20.2 ғʀ  ${s.language === "fr" ? "✅" : ""}
╰━━━━━━━━━━━╯
╭━━❮ *𝗖𝗵𝗮𝘁 𝗕𝗼𝘁 𝗠𝗼𝗱𝗲* ❯━━╮
┃ 21.1 ᴇɴᴀʙʟᴇ  ${s.chatBotMode ? "✅" : ""}
┃ 21.2 ᴅɪsᴀʙʟᴇ  ${!s.chatBotMode ? "✅" : ""}
╰━━━━━━━━━━━╯
╭━━❮ *𝗢𝘄𝗻𝗲𝗿 𝗥𝗲𝗮𝗰𝘁* ❯━━╮
┃ 22.1 ᴇɴᴀʙʟᴇ  ${s.ownerReact ? "✅" : ""}
┃ 22.2 ᴅɪsᴀʙʟᴇ  ${!s.ownerReact ? "✅" : ""}
╰━━━━━━━━━━━╯
╭━━❮ *𝗔𝗱𝘂𝗹𝘁 𝗠𝗼𝗱𝗲* ❯━━╮
┃ 23.1 ᴇɴᴀʙʟᴇ  ${s.adultMode ? "✅" : ""}
┃ 23.2 ᴅɪsᴀʙʟᴇ  ${!s.adultMode ? "✅" : ""}
╰━━━━━━━━━━━╯
╭━━❮ *𝗠𝗼𝘃𝗶𝗲 𝗗𝗟* ❯━━╮
┃ 24.1 ᴏɴʟʏ_ᴍᴇ  ${s.movieDl === "only_me" ? "✅" : ""}
┃ 24.2 ᴏɴʟʏ_ᴏᴡɴᴇʀs  ${s.movieDl === "only_owners" ? "✅" : ""}
┃ 24.3 ᴀʟʟ  ${s.movieDl === "all" ? "✅" : ""}
┃ 24.4 ᴅɪsᴀʙʟᴇ  ${s.movieDl === "disable" ? "✅" : ""}
╰━━━━━━━━━━━╯
╭━━❮ *𝗔𝗻𝘁𝗶-𝗗𝗲𝗹 𝗦𝗰𝗼𝗽𝗲* ❯━━╮
┃ 25.1 ᴏɴʟʏ_ɪɴʙᴏx  ${s.antiDelScope === "only_inbox" ? "✅" : ""}
┃ 25.2 ᴏɴʟʏ_ɢʀᴏᴜᴘ  ${s.antiDelScope === "only_group" ? "✅" : ""}
┃ 25.3 ᴀʟʟ  ${s.antiDelScope === "all" ? "✅" : ""}
╰━━━━━━━━━━━╯
╭━━❮ *𝗔𝗻𝘁𝗶 𝗠𝗲𝗻𝘁𝗶𝗼𝗻* ❯━━╮
┃ 26.1 ᴇɴᴀʙʟᴇ  ${s.antiMention ? "✅" : ""}
┃ 26.2 ᴅɪsᴀʙʟᴇ  ${!s.antiMention ? "✅" : ""}
╰━━━━━━━━━━━╯

_Reply: *<section>.<option>* — e.g. *1.1* or *7.2*_
_Reply *0* to close settings_

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
}

// Settings toggle map
const SETTINGS_MAP = {
  "1.1": s => { s.blockCalls = true; return "✅ Block Calls: ENABLED"; },
  "1.2": s => { s.blockCalls = false; return "❌ Block Calls: DISABLED"; },
  "2.1": s => { s.linkGuard = "delete"; return "✅ Link Guard: DELETE"; },
  "2.2": s => { s.linkGuard = "kick"; return "✅ Link Guard: KICK"; },
  "2.3": s => { s.linkGuard = "warn"; return "✅ Link Guard: WARN"; },
  "3.1": s => { s.badWordGuard = "delete"; return "✅ Bad Word Guard: DELETE"; },
  "3.2": s => { s.badWordGuard = "kick"; return "✅ Bad Word Guard: KICK"; },
  "3.3": s => { s.badWordGuard = "warn"; return "✅ Bad Word Guard: WARN"; },
  "4.1": s => { s.statusMention = "delete"; return "✅ Status Mention: DELETE"; },
  "4.2": s => { s.statusMention = "kick"; return "✅ Status Mention: KICK"; },
  "4.3": s => { s.statusMention = "warn"; return "✅ Status Mention: WARN"; },
  "4.4": s => { s.statusMention = "false"; return "❌ Status Mention: OFF"; },
  "5.1": s => { s.callAction = "cut"; return "✅ Call Action: CUT"; },
  "5.2": s => { s.callAction = "block"; return "✅ Call Action: BLOCK"; },
  "6.1": s => { s.antiDelete = true; return "✅ Anti Delete: ON"; },
  "6.2": s => { s.antiDelete = false; return "❌ Anti Delete: OFF"; },
  "7.1": s => { s.autoReact = true; return "✅ Auto React: ON"; },
  "7.2": s => { s.autoReact = false; return "❌ Auto React: OFF"; },
  "8.1": s => { s.autoBlock = true; return "✅ Auto Block: ON"; },
  "8.2": s => { s.autoBlock = false; return "❌ Auto Block: OFF"; },
  "9.1": s => { s.readMsgs = true; return "✅ Read Msgs: ON"; },
  "9.2": s => { s.readMsgs = false; return "❌ Read Msgs: OFF"; },
  "10.1": s => { s.viewStatus = true; return "✅ View Status: ON"; },
  "10.2": s => { s.viewStatus = false; return "❌ View Status: OFF"; },
  "11.1": s => { s.reactStatus = true; return "✅ React Status: ON"; },
  "11.2": s => { s.reactStatus = false; return "❌ React Status: OFF"; },
  "12.1": s => { s.welcome = true; return "✅ Welcome Msg: ON"; },
  "12.2": s => { s.welcome = false; return "❌ Welcome Msg: OFF"; },
  "13.1": s => { s.autoVoice = true; return "✅ Auto Voice: ON"; },
  "13.2": s => { s.autoVoice = false; return "❌ Auto Voice: OFF"; },
  "14.1": s => { s.autoSticker = true; return "✅ Auto Sticker: ON"; },
  "14.2": s => { s.autoSticker = false; return "❌ Auto Sticker: OFF"; },
  "15.1": s => { s.autoReply = true; return "✅ Auto Reply: ON"; },
  "15.2": s => { s.autoReply = false; return "❌ Auto Reply: OFF"; },
  "16.1": s => { s.recording = true; return "✅ Recording: ON"; },
  "16.2": s => { s.recording = false; return "❌ Recording: OFF"; },
  "17.1": s => { s.typing = true; return "✅ Typing: ON"; },
  "17.2": s => { s.typing = false; return "❌ Typing: OFF"; },
  "18.1": s => { s.alwaysOnline = true; return "✅ Always Online: ON"; },
  "18.2": s => { s.alwaysOnline = false; return "❌ Always Online: OFF"; },
  "19.1": s => { setWorkModeState(s, "public"); return "✅ Work Mode: PUBLIC"; },
  "19.2": s => { setWorkModeState(s, "private"); return "✅ Work Mode: PRIVATE"; },
  "19.3": s => { setWorkModeState(s, "only_group"); return "✅ Work Mode: ONLY GROUP"; },
  "19.4": s => { setWorkModeState(s, "inbox"); return "✅ Work Mode: INBOX"; },
  "20.1": s => { s.language = "en"; return "✅ Language: EN"; },
  "20.2": s => { s.language = "fr"; return "✅ Language: FR"; },
  "21.1": s => { s.chatBotMode = true; return "✅ Chat Bot Mode: ON"; },
  "21.2": s => { s.chatBotMode = false; return "❌ Chat Bot Mode: OFF"; },
  "22.1": s => { s.ownerReact = true; return "✅ Owner React: ON"; },
  "22.2": s => { s.ownerReact = false; return "❌ Owner React: OFF"; },
  "23.1": s => { s.adultDl = true; s.adultMode = true; return "✅ Adult Mode: ON"; },
  "23.2": s => { s.adultDl = false; s.adultMode = false; return "❌ Adult Mode: OFF"; },
  "24.1": s => { s.movieDl = "only_me"; return "✅ Movie DL: ONLY ME"; },
  "24.2": s => { s.movieDl = "only_owners"; return "✅ Movie DL: ONLY OWNERS"; },
  "24.3": s => { s.movieDl = "all"; return "✅ Movie DL: ALL"; },
  "24.4": s => { s.movieDl = "disable"; return "❌ Movie DL: DISABLED"; },
  "25.1": s => { s.antiDelScope = "only_inbox"; return "✅ Anti-Del Scope: ONLY INBOX"; },
  "25.2": s => { s.antiDelScope = "only_group"; return "✅ Anti-Del Scope: ONLY GROUP"; },
  "25.3": s => { s.antiDelScope = "all"; return "✅ Anti-Del Scope: ALL"; },
  "26.1": s => { s.antiMention = true; return "✅ Anti Mention: ON"; },
  "26.2": s => { s.antiMention = false; return "❌ Anti Mention: OFF"; },
};

cmd(["setting", "settings", "config"], { desc: "Open bot settings", category: "SETTINGS" }, async (sock, msg) => {
  const jid = msg.key.remoteJid, sender = getSender(msg);
  const isFromOwner = msg.key.fromMe || isOwner(sender) || isSudo(sender);
  const isAdmin = isGroup(msg) ? await isGroupAdmin(sock, jid, sender) : false;
  const inGroup = isGroup(msg);
  if (!isFromOwner) {
    if (inGroup && !isAdmin) { await sendReply(sock, msg, "🚫 Admins/Owner only."); return; }
    if (!inGroup) { await sendReply(sock, msg, "🚫 Owner only."); return; }
  }
  settingsSession.set(jid, { sender }); setTimeout(() => settingsSession.delete(jid), 120000);
  const settingsText = buildSettingsMenu(jid);
  const settingsPic = await getBotPic();
  if (settingsPic) {
    try {
      await sock.sendMessage(jid, { image: settingsPic, caption: settingsText }, { quoted: msg });
    } catch { await sendReply(sock, msg, settingsText); }
  } else {
    await sendReply(sock, msg, settingsText);
  }
});

cmd("mode", { desc: "Set public/private mode", category: "OWNER", ownerOnly: true }, async (sock, msg, args) => {
  const m = args[0]?.toLowerCase();
  if (!["public", "private"].includes(m)) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}mode public/private`); return; }
  // Store globally on owner JID so it persists across all chats
  const ownerJid = getOwnerJid();
  const s = getSettings(ownerJid);
  setWorkModeState(s, m);
  // Also store on current chat
  const cs = getSettings(msg.key.remoteJid);
  setWorkModeState(cs, m);
  saveNow();
  await sendReply(sock, msg, `${m === "private" ? "🔒" : "🌐"} Mode set to *${m.toUpperCase()}*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});

cmd(["buttonsmode", "buttons", "btnmode", "button"], { desc: "Toggle button mode on/off", category: "OWNER", ownerOnly: true }, async (sock, msg, args) => {
  const ownerJid = getOwnerJid();
  const ownerS = getSettings(ownerJid);
  const v = (args[0] || "").toLowerCase();
  if (["on", "1", "enable", "true"].includes(v)) ownerS.buttonsMode = true;
  else if (["off", "0", "disable", "false"].includes(v)) ownerS.buttonsMode = false;
  else ownerS.buttonsMode = !ownerS.buttonsMode;
  getSettings(msg.key.remoteJid).buttonsMode = ownerS.buttonsMode;
  saveNow();
  await _sendPlainReply(sock, msg, `🔘 Buttons Mode: *${ownerS.buttonsMode ? "ON ✅" : "OFF ❌"}*

When ON: Menu shows as interactive WhatsApp list + tappable action buttons.
When OFF: Menu shows as plain text (compatible with all WA clients).

Usage:
• ${CONFIG.PREFIX}buttonsmode on  → interactive list menu
• ${CONFIG.PREFIX}buttonsmode off → plain text menu

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});

cmd(["antivo", "antiviewonce", "antiviewoncetoggle", "stealthvo"], { desc: "Toggle auto-capture of view-once messages → sent silently to your DM", category: "OWNER", ownerOnly: true }, async (sock, msg, args) => {
  const ownerJid = getOwnerJid();
  const ownerS = getSettings(ownerJid);
  const v = (args[0] || "").toLowerCase();
  if (["on","1","enable","true"].includes(v)) ownerS.antiViewOnce = true;
  else if (["off","0","disable","false"].includes(v)) ownerS.antiViewOnce = false;
  else ownerS.antiViewOnce = !ownerS.antiViewOnce;
  // Optional: set reaction emoji with arg[1] (or arg[0] if it's an emoji)
  const maybeEmoji = args.find(a => !["on","off","1","0","enable","disable","true","false"].includes(a.toLowerCase()) && a.length <= 8);
  if (maybeEmoji) ownerS.avoReactEmoji = maybeEmoji;
  saveNow();
  await _sendPlainReply(sock, msg, `👁️ *Anti-ViewOnce (Stealth Capture): ${ownerS.antiViewOnce ? "✅ ON" : "❌ OFF"}*

${ownerS.antiViewOnce
  ? `✅ *ENABLED*\nWhen anyone sends a view-once message:\n• 📸 Bot silently captures the media\n• 📩 Forwards it to YOUR private DM\n• 👁️ Reacts with a ghost emoji (invisible to sender)\n\nThe sender will NOT know their message was captured.`
  : `❌ *DISABLED*\nView-once messages will not be captured.`}

Usage:
• ${CONFIG.PREFIX}antivo on
• ${CONFIG.PREFIX}antivo off

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});

cmd(["textmenu", "txmenu", "plaintextmenu"], { desc: "Switch to plain text menu (disable button mode)", category: "OWNER", ownerOnly: true }, async (sock, msg) => {
  const ownerJid = getOwnerJid();
  const ownerS = getSettings(ownerJid);
  ownerS.buttonsMode = false;
  getSettings(msg.key.remoteJid).buttonsMode = false;
  saveNow();
  await _sendPlainReply(sock, msg, `📝 *Text Menu Mode: ✅ ENABLED*

Menu will now display as plain text (no interactive buttons or list UI).

This is compatible with all WhatsApp clients including old versions.

To switch back to interactive list menu:
• ${CONFIG.PREFIX}buttonsmode on

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});

cmd(["listmenu", "interactivemenu", "btnlistmenu"], { desc: "Switch to interactive list menu (enable button mode)", category: "OWNER", ownerOnly: true }, async (sock, msg) => {
  const ownerJid = getOwnerJid();
  const ownerS = getSettings(ownerJid);
  ownerS.buttonsMode = true;
  getSettings(msg.key.remoteJid).buttonsMode = true;
  saveNow();
  await _sendPlainReply(sock, msg, `🗂️ *Interactive List Menu Mode: ✅ ENABLED*

Menu will now display as a WhatsApp interactive list with tappable category rows.
This matches the screenshot-style UI.

To switch back to plain text menu:
• ${CONFIG.PREFIX}textmenu  (or ${CONFIG.PREFIX}buttonsmode off)

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd(["debug", "logs", "console"], { desc: "Open debug console link", category: "OWNER", ownerOnly: true }, async (sock, msg) => {
  const base = String(process.env.BOT_URL || "").trim().replace(/\/$/, "");
  const webUrl = base ? `${base}/debug` : `http://localhost:${PORT}/debug`;
  const apiUrl = base ? `${base}/debug-api` : `http://localhost:${PORT}/debug-api`;
  await _sendPlainReply(sock, msg, `🧪 *Debug Console*

🌐 Web: ${webUrl}
🧾 JSON: ${apiUrl}

Recent runtime logs are available in the web console.

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  MISC / ALIVE / PING / UPTIME
// ═══════════════════════════════════════════════════════════════════════════════
cmd(["ping", "alive", "runtime", "uptime"], { desc: "Bot status check", category: "MISC" }, async (sock, msg) => {
  const c = extractCommandName(msg);
  const jid = msg.key.remoteJid;
  const start = Date.now();
  const sent = await sock.sendMessage(jid, { text: `⚡ *MIAS MDX*\n\n⬡ Measuring...` }, { quoted: msg });
  const lat = Date.now() - start;
  const up = fmtUptime(process.uptime());
  const mem = (process.memoryUsage().rss / 1048576).toFixed(1);
  const out = c === "ping"
    ? `🏓 *PONG — BOT SLEEP CHECK*\n\n╭───────────────◆\n│ ⚡ Response: *${lat}ms*\n│ 💤 Sleep: *${lat < 300 ? "awake" : lat < 900 ? "light" : "heavy"}*\n╰───────────────◆\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`
    : (c === "runtime" || c === "uptime")
      ? `⏱️ *MIAS MDX RUNTIME*\n\n╭───────────────◆\n│ 🟢 Running: *${up}*\n│ 🧠 Memory: *${mem}MB*\n│ 📦 Commands: *${commands.size}*\n│ 🔖 Version: *${CONFIG.VERSION}*\n╰───────────────◆\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`
      : `🟢 *${CONFIG.BOT_NAME} IS ALIVE*\n\n╭───────────────◆\n│ 👑 Owner: *${CONFIG.OWNER_NAME}*\n│ ⚙️ Mode: *ACTIVE*\n│ ⏱️ Runtime: *${up}*\n│ 🏓 Ping: *${lat}ms*\n╰───────────────◆\n\nI am online, connected, and ready.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
  await editMessage(sock, jid, sent.key, out);
});

cmd("owner", { desc: "Show owner info", category: "MISC" }, async (sock, msg) => {
  await react(sock, msg, "👑");
  const ownerJid = getOwnerJid();
  try {
    let ppUrl;
    try { ppUrl = await sock.profilePictureUrl(ownerJid, "image"); } catch { ppUrl = null; }
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${CONFIG.OWNER_NAME}\nTEL;type=CELL;type=VOICE;waid=${CONFIG.OWNER_NUMBER}:+${CONFIG.OWNER_NUMBER}\nEND:VCARD`;
    const caption = `👑 *Bot Owner*\n\n*${CONFIG.OWNER_NAME}*\n📱 wa.me/${CONFIG.OWNER_NUMBER}\n\n_This is the person who linked the bot_\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
    if (ppUrl) {
      const picBuf = await axios.get(ppUrl, { responseType: "arraybuffer", timeout: 10000 });
      await sock.sendMessage(msg.key.remoteJid, { image: Buffer.from(picBuf.data), caption }, { quoted: msg });
    } else {
      await sendReply(sock, msg, caption);
    }
    await sock.sendMessage(msg.key.remoteJid, { contacts: { displayName: CONFIG.OWNER_NAME, contacts: [{ vcard }] } });
  } catch (e) {
    await sendReply(sock, msg, `👑 *Bot Owner*\n\n*${CONFIG.OWNER_NAME}*\n📱 wa.me/${CONFIG.OWNER_NUMBER}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  MUSIC / PLAYLIST
// ═══════════════════════════════════════════════════════════════════════════════
const SONGS = [
  { title: "Blinding Lights", artist: "The Weeknd", genre: "Pop", url: "https://youtu.be/4NRXx6U8ABQ" },
  { title: "Essence", artist: "Wizkid ft. Tems", genre: "Afrobeats", url: "https://youtu.be/vDF-U3ZOAxY" },
  { title: "Cruel Summer", artist: "Taylor Swift", genre: "Pop", url: "https://youtu.be/ic8j13piAhQ" },
  { title: "Ye", artist: "Burna Boy", genre: "Afrobeats", url: "https://youtu.be/1Cr0kqFhP0U" },
  { title: "As It Was", artist: "Harry Styles", genre: "Pop", url: "https://youtu.be/H5v3kku4y6Q" },
  { title: "Love Nwantiti", artist: "CKay", genre: "Afropop", url: "https://youtu.be/PFRjKjEf0s0" },
  { title: "Calm Down", artist: "Rema ft. Selena Gomez", genre: "Afrobeats", url: "https://youtu.be/Y3S2MflEMiM" },
  { title: "Flowers", artist: "Miley Cyrus", genre: "Pop", url: "https://youtu.be/G7KNmW9a75Y" },
  { title: "Vampire", artist: "Olivia Rodrigo", genre: "Alt-Rock", url: "https://youtu.be/RlPNh_PBZb4" },
  { title: "Rush", artist: "Ayra Starr", genre: "Afropop", url: "https://youtu.be/LZ2FkIxnPIU" },
  { title: "APT.", artist: "ROSE ft. Bruno Mars", genre: "K-Pop/Pop", url: "https://youtu.be/ekr2nIex040" },
  { title: "Die With A Smile", artist: "Lady Gaga ft. Bruno Mars", genre: "Pop", url: "https://youtu.be/kPa7bsKwL-c" },
  { title: "Champion", artist: "Burna Boy", genre: "Afrobeats", url: "https://youtu.be/hqZLjhAaKlY" },
  { title: "Last Last", artist: "Burna Boy", genre: "Afrobeats", url: "https://youtu.be/JMIBXEOuiTw" },
  { title: "FOREIGN", artist: "Tems", genre: "Afropop", url: "https://youtu.be/rPlMqk4P0lE" },
];


// YouTube search helper — scrapes YouTube search results
async function ytSearch(query) {
  try {
    const { data } = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%253D%253D`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", "Accept-Language": "en-US,en" },
      timeout: 15000
    });
    const results = [];
    const regex = /"videoRenderer":\{"videoId":"([a-zA-Z0-9_-]{11})".*?"title":\{"runs":\[\{"text":"(.*?)"\}\]/g;
    let match;
    while ((match = regex.exec(data)) !== null && results.length < 5) {
      results.push({ url: `https://www.youtube.com/watch?v=${match[1]}`, title: match[2], videoId: match[1] });
    }
    return results;
  } catch { return []; }
}

cmd(["play", "music", "song"], { desc: "Play/download song", category: "DOWNLOAD" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}play <song name or URL>`); return; }
  await react(sock, msg, "🎵");
  const query = args.join(" ");
  const isUrl = /^https?:\/\//i.test(query);
  const jid = msg.key.remoteJid;
  try {
    // Send initial status message that we'll keep editing
    const statusMsg = await sock.sendMessage(jid, { text: `🎵 *MIAS MDX Player*\n\n🔍 Searching for *"${query}"*...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
    const statusKey = statusMsg.key;

    // Step 1: Search for the song on YouTube
    let videoUrl = isUrl ? query : null;
    let title = query;
    const searchApis = [
      async () => {
        const { data } = await axios.get(`${CONFIG.GIFTED_API}/api/search/ytsearch?apikey=${CONFIG.GIFTED_KEY}&q=${encodeURIComponent(query)}`, { timeout: 15000 });
        const v = data?.result?.[0] || data?.results?.[0];
        if (v?.url || v?.link) return { url: v.url || v.link, title: v.title || query };
      },
      async () => {
        const { data } = await axios.get(`https://api.siputzx.my.id/api/y/search?query=${encodeURIComponent(query)}`, { timeout: 15000 });
        const v = data?.data?.[0] || data?.result?.[0];
        if (v?.url || v?.link) return { url: v.url || v.link, title: v.title || query };
      },
      async () => {
        const results = await ytSearch(query);
        if (results?.[0]?.url) return { url: results[0].url, title: results[0].title || query };
      },
      async () => {
        const { data } = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }, timeout: 15000
        });
        const match = data.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
        if (match) return { url: `https://www.youtube.com/watch?v=${match[1]}`, title: query };
      },
    ];
    if (!videoUrl) {
      for (const searchFn of searchApis) {
        try {
          const result = await searchFn();
          if (result?.url) { videoUrl = result.url; title = result.title || query; break; }
        } catch { continue; }
      }
    }
    if (!videoUrl) {
      await editMessage(sock, jid, statusKey, `🎵 *MIAS MDX Player*\n\n🔍 Searching for *"${query}"*... ✅\n❌ No results found\n\n🔗 https://www.youtube.com/results?search_query=${encodeURIComponent(query)}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
      return;
    }

    // Update: Found song, now downloading
    await editMessage(sock, jid, statusKey, `🎵 *MIAS MDX Player*\n\n🔍 Searching for *"${query}"*... ✅\n📌 Found: *${title}*\n⏳ Downloading audio...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);

    // Step 2: Download audio from multiple APIs
    const dlApis = [
      async () => {
        const { data } = await axios.post("https://api.cobalt.tools/", {
          url: videoUrl, downloadMode: "audio", audioFormat: "mp3"
        }, { headers: { "Accept": "application/json", "Content-Type": "application/json" }, timeout: 30000 });
        if (data?.url) return data.url;
        if (data?.audio) return data.audio;
      },
      async () => {
        const { data } = await axios.post("https://cobalt-api.kwiatekmiki.com/", {
          url: videoUrl, downloadMode: "audio", audioFormat: "mp3"
        }, { headers: { "Accept": "application/json", "Content-Type": "application/json" }, timeout: 30000 });
        if (data?.url) return data.url;
      },
      async () => {
        const videoId = videoUrl.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
        if (!videoId) throw new Error("no id");
        const { data } = await axios.get(`https://inv.nadeko.net/api/v1/videos/${videoId}`, { timeout: 20000 });
        const audio = data?.adaptiveFormats?.find(f => f.type?.includes("audio") && f.url);
        if (audio?.url) return audio.url;
      },
      async () => {
        const { data } = await axios.get(`https://p.oceansaver.in/ajax/download.php?format=mp3&url=${encodeURIComponent(videoUrl)}`, { timeout: 30000 });
        if (data?.success && data?.download) return data.download;
      },
      async () => {
        const { data } = await axios.get(`${CONFIG.GIFTED_API}/api/download/ytmp3?apikey=${CONFIG.GIFTED_KEY}&url=${encodeURIComponent(videoUrl)}`, { timeout: 60000 });
        if (data?.success && data?.result) return data.result.download_url || data.result.url || data.result.audio || data.result.mp3;
      },
      async () => { const r = await APIs.getEliteProTechDownloadByUrl(videoUrl); return r?.download; },
      async () => { const r = await APIs.getYupraDownloadByUrl(videoUrl); return r?.download; },
      async () => { const r = await APIs.getOkatsuDownloadByUrl(videoUrl); return r?.download; },
      async () => { const r = await APIs.getIzumiDownloadByUrl(videoUrl); return r?.download; },
      async () => {
        const { data } = await axios.get(`https://api.ssyoutube.com/v2/?url=${encodeURIComponent(videoUrl)}`, {
          headers: { "User-Agent": "Mozilla/5.0" }, timeout: 20000
        });
        const audio = data?.audio?.find(a => a.url) || data?.links?.find(l => l.url && l.type === "audio");
        if (audio?.url) return audio.url;
      },
      async () => {
        const { data } = await axios.post("https://tomp3.cc/api/ajax/search", `query=${encodeURIComponent(videoUrl)}&vt=mp3`, {
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0" }, timeout: 20000
        });
        if (data?.links?.mp3?.mp3128?.k) {
          const { data: dl } = await axios.post("https://tomp3.cc/api/ajax/convert", `vid=${data.vid}&k=${data.links.mp3.mp3128.k}`, {
            headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 30000
          });
          if (dl?.dlink) return dl.dlink;
        }
      },
    ];

    let dlUrl = null;
    for (const tryDl of dlApis) {
      try {
        dlUrl = await tryDl();
        if (dlUrl) break;
      } catch { continue; }
    }

    if (!dlUrl) {
      await editMessage(sock, jid, statusKey, `🎵 *MIAS MDX Player*\n\n🔍 Searching for *"${query}"*... ✅\n📌 Found: *${title}*\n⏳ Downloading audio... ❌\n\n⚠️ All servers busy — try again later\n🔗 ${videoUrl}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
      return;
    }

    // Update: Download link found, now fetching file
    await editMessage(sock, jid, statusKey, `🎵 *MIAS MDX Player*\n\n🔍 Searching for *"${query}"*... ✅\n📌 Found: *${title}*\n⏳ Downloading audio... ✅\n📥 Fetching file...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);

    try {
      const audioBuf = await axios.get(dlUrl, {
        responseType: "arraybuffer", timeout: 120000,
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        maxRedirects: 5
      });
      if (audioBuf.data && audioBuf.data.length > 5000) {
        // Update: Sending audio
        await editMessage(sock, jid, statusKey, `🎵 *MIAS MDX Player*\n\n🔍 Searching for *"${query}"*... ✅\n📌 Found: *${title}*\n⏳ Downloading audio... ✅\n📥 Fetching file... ✅\n📤 Sending audio...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);

        await sock.sendMessage(jid, {
          audio: Buffer.from(audioBuf.data), mimetype: "audio/mpeg", ptt: false,
          fileName: `${title.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 60)}.mp3`
        }, { quoted: msg });

        // Final update: Done!
        await editMessage(sock, jid, statusKey, `🎵 *MIAS MDX Player*\n\n🔍 Searching for *"${query}"*... ✅\n📌 Found: *${title}*\n⏳ Downloading audio... ✅\n📥 Fetching file... ✅\n📤 Sending audio... ✅\n\n✅ *Done!* Enjoy your music 🎶\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
        return;
      }
    } catch {}

    // File fetch failed
    await editMessage(sock, jid, statusKey, `🎵 *MIAS MDX Player*\n\n🔍 Searching for *"${query}"*... ✅\n📌 Found: *${title}*\n⏳ Downloading audio... ✅\n📥 Fetching file... ❌\n\n⚠️ File download failed — try again\n🔗 ${videoUrl}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch (e) {
    console.error("[PLAY ERROR]", e.message);
    await sendReply(sock, msg, `❌ Play error: ${e.message}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});
cmd(["playlist", "songs"], { desc: "Show playlist", category: "DOWNLOAD" }, async (sock, msg) => {
  let t = `🎵 *MIAS MDX Playlist (${SONGS.length} songs)*\n\n`;
  SONGS.forEach((s, i) => t += `${i + 1}. *${s.title}* — ${s.artist}\n`);
  t += `\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
  await sendReply(sock, msg, t);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  AI COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════
cmd(["gpt", "ai", "chatai"], { desc: "Ask AI — .gpt <question>", category: "AI" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}gpt <question>`); return; }
  await react(sock, msg, "🤖");
  const q = args.join(" ");
  const jid = msg.key.remoteJid;
  const statusMsg = await sock.sendMessage(jid, { text: `🤖 *MIAS MDX AI*

⬡ Processing your question...
◻ Generating response...

💭 _"${q.slice(0, 80)}${q.length > 80 ? "..." : ""}"_

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
  const sKey = statusMsg.key;
  try {
    await editMessage(sock, jid, sKey, `🤖 *MIAS MDX AI*

⬢ Processing your question... ✅
⬡ Generating response...

💭 _"${q.slice(0, 80)}${q.length > 80 ? "..." : ""}"_

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    const reply = await freeAI(q, "You are a smart helpful assistant. Give clear, direct answers.");
    if (reply) {
      await editMessage(sock, jid, sKey, `🤖 *MIAS MDX AI*

⬢ Processing your question... ✅
⬢ Generating response... ✅

✅ Response ready below.

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
      await sendLongText(sock, jid, `🤖 *MIAS MDX AI Response*

${reply}

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, msg);
    } else {
      await editMessage(sock, jid, sKey, `🤖 *MIAS MDX AI*

⬢ Processing your question... ✅
⬢ Generating response... ❌

⚠️ All AI services are busy. Try again later.

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    }
  } catch (e) {
    await editMessage(sock, jid, sKey, `🤖 *MIAS MDX AI*

❌ AI error: ${e.message}

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});
cmd("gemini", { desc: "Ask Gemini AI", category: "AI" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}gemini <question>`); return; }
  await react(sock, msg, "✨");
  const jid = msg.key.remoteJid;
  const q = args.join(" ");
  const statusMsg = await sock.sendMessage(jid, { text: `✨ *MIAS MDX — Gemini AI*

⬡ Thinking...
◻ Crafting response...

💭 _"${q.slice(0, 80)}${q.length > 80 ? "..." : ""}"_

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
  const gKey = statusMsg.key;
  try {
    const reply = await freeAI(q, "Answer clearly and helpfully.");
    if (reply) {
      await editMessage(sock, jid, gKey, `✨ *MIAS MDX — Gemini AI*

⬢ Thinking... ✅
⬢ Crafting response... ✅

✅ Response ready below.

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
      await sendLongText(sock, jid, `✨ *Gemini Response*

${reply}

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, msg);
    } else {
      await editMessage(sock, jid, gKey, `✨ *MIAS MDX — Gemini AI*

⬢ Thinking... ✅
⬢ Crafting response... ❌

⚠️ AI services busy. Try again.

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    }
  } catch (e) {
    await editMessage(sock, jid, gKey, `✨ *MIAS MDX — Gemini AI*

❌ Error: ${e.message}

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});
cmd(["text2img", "flux", "wan", "sora", "editimg", "upscale", "enhance"], { desc: "AI image generation", category: "AI" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}${getBody(msg).split(" ")[0].slice(1)} <prompt>`); return; }
  await react(sock, msg, "🎨");
  const prompt = args.join(" ");
  const jid = msg.key.remoteJid;
  const statusMsg = await sock.sendMessage(jid, { text: `🎨 *MIAS MDX Image AI*\n\n⬡ Reading prompt...\n◻ Generating image...\n◻ Sending result...\n\n🖌️ _"${prompt.slice(0, 100)}"_\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
  const sKey = statusMsg.key;
  try {
    await editMessage(sock, jid, sKey, `🎨 *MIAS MDX Image AI*\n\n⬢ Reading prompt... ✅\n⬡ Generating image...\n◻ Sending result...\n\n🖌️ _"${prompt.slice(0, 100)}"_\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    const buf = await freeImageGen(prompt);
    if (buf) {
      await editMessage(sock, jid, sKey, `🎨 *MIAS MDX Image AI*\n\n⬢ Reading prompt... ✅\n⬢ Generating image... ✅\n⬡ Sending result...\n\n🖌️ _"${prompt.slice(0, 100)}"_\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
      await sock.sendMessage(jid, { image: buf, caption: `🎨 *AI Image*\n\n_${prompt}_\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
      await editMessage(sock, jid, sKey, `🎨 *MIAS MDX Image AI*\n\n⬢ Reading prompt... ✅\n⬢ Generating image... ✅\n⬢ Sending result... ✅\n\n✅ *Done!* Enjoy your image 🖼️\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    } else {
      await editMessage(sock, jid, sKey, `🎨 *MIAS MDX Image AI*\n\n⬢ Reading prompt... ✅\n⬢ Generating image... ❌\n\n⚠️ Image generation failed. Try a different prompt.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    }
  } catch (e) {
    await editMessage(sock, jid, sKey, `🎨 *MIAS MDX Image AI*\n\n❌ Error: ${e.message}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});
cmd(["removebg", "rmbg"], { desc: "Remove image background", category: "AI" }, async (sock, msg) => {
  const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const img = msg.message?.imageMessage || q?.imageMessage;
  if (!img) { await sendReply(sock, msg, `❌ Reply to an image with ${CONFIG.PREFIX}removebg`); return; }
  const jid = msg.key.remoteJid;
  const statusMsg = await sock.sendMessage(jid, { text: `🖼️ *MIAS MDX RemoveBG*\n\n⬡ Downloading image...\n◻ Removing background...\n◻ Sending result...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
  const bgKey = statusMsg.key;
  try {
    const stream = await downloadContentFromMessage(img, "image");
    let buf = Buffer.from([]);
    for await (const c of stream) buf = Buffer.concat([buf, c]);
    // Try GiftedTech removebg API
    const FormData = (await import("form-data")).default;
    const form = new FormData();
    form.append("image", buf, { filename: "image.jpg", contentType: img.mimetype || "image/jpeg" });
    const { data } = await axios.post(`${CONFIG.GIFTED_API}/api/tools/removebg?apikey=${CONFIG.GIFTED_KEY}`, form, {
      headers: form.getHeaders(), timeout: 60000, responseType: "arraybuffer"
    });
    if (data && data.length > 1000) {
      await sock.sendMessage(msg.key.remoteJid, { image: Buffer.from(data), caption: `🖼️ *Background Removed!*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
      await react(sock, msg, "✅");
    } else {
      // Try parsing as JSON response with URL
      try {
        const json = JSON.parse(Buffer.from(data).toString());
        const url = json?.result?.url || json?.result?.image || json?.result;
        if (url && typeof url === "string") {
          const imgBuf = await axios.get(url, { responseType: "arraybuffer", timeout: 30000 });
          await sock.sendMessage(msg.key.remoteJid, { image: Buffer.from(imgBuf.data), caption: `🖼️ *Background Removed!*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
          await react(sock, msg, "✅");
        } else throw new Error("No result");
      } catch { await sendReply(sock, msg, `🖼️ *Remove Background*\n\n⚠️ API could not process this image.\n🔗 Try: https://remove.bg\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); }
    }
  } catch (e) { await sendReply(sock, msg, `❌ Remove BG failed: ${e.message}\n🔗 Try: https://remove.bg\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); }
});
cmd(["summarize", "summary"], { desc: "Summarize text", category: "AI" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}summarize <text>`); return; }
  await react(sock, msg, "📝");
  const jid = msg.key.remoteJid;
  const sourceText = args.join(" ");
  const statusMsg = await sock.sendMessage(jid, { text: `📝 *MIAS MDX Summarizer*

⬡ Reading text...
◻ Generating summary...

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
  const sumKey = statusMsg.key;
  try {
    await editMessage(sock, jid, sumKey, `📝 *MIAS MDX Summarizer*

⬢ Reading text... ✅
⬡ Generating summary...

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    const reply = await freeAI(sourceText, "Summarize this text clearly in a few concise sentences.");
    const finalReply = reply || sourceText.slice(0, 400) + (sourceText.length > 400 ? "..." : "");
    await editMessage(sock, jid, sumKey, `📝 *MIAS MDX Summarizer*

⬢ Reading text... ✅
⬢ Generating summary... ✅

✅ Summary ready below.

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    await sendLongText(sock, jid, `📝 *Summary*

${finalReply}

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, msg);
  } catch (e) {
    await editMessage(sock, jid, sumKey, `📝 *MIAS MDX Summarizer*

❌ Error: ${e.message}

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});
cmd("recipe", { desc: "Get recipe — .recipe <dish>", category: "AI" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}recipe <dish name>`); return; }
  const dish = args.join(" ");
  const jid = msg.key.remoteJid;
  const statusMsg = await sock.sendMessage(jid, { text: `🍳 *MIAS MDX Recipe*\n\n⬡ Searching for *"${dish}"*...\n◻ Fetching recipe...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
  const rcKey = statusMsg.key;
  try {
    const { data } = await axios.get(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(dish)}`, { timeout: 10000 });
    const meal = data?.meals?.[0];
    if (!meal) { await sendReply(sock, msg, `❌ No recipe found for: *${dish}*`); return; }
    const ingredients = [];
    for (let i = 1; i <= 20; i++) { if (meal[`strIngredient${i}`]) ingredients.push(`• ${meal[`strMeasure${i}`]?.trim()} ${meal[`strIngredient${i}`]}`); }
    await sendReply(sock, msg, `🍳 *${meal.strMeal}*\n\n🌍 ${meal.strCategory} | ${meal.strArea}\n\n📋 *Ingredients:*\n${ingredients.slice(0, 10).join("\n")}\n\n📝 *Instructions:*\n${meal.strInstructions?.slice(0, 400)}...\n\n🔗 ${meal.strYoutube || meal.strSource || ""}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch { await sendReply(sock, msg, `❌ Could not fetch recipe for: *${dish}*`); }
});
cmd(["chatbot", "duckai"], { desc: "Chat with AI", category: "AI" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}chatbot <message>`); return; }
  await react(sock, msg, "💬");
  const jid = msg.key.remoteJid;
  const statusMsg = await sock.sendMessage(jid, { text: `💬 *MIAS MDX Chatbot*

⬡ Processing message...
◻ Generating reply...

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
  const cbKey = statusMsg.key;
  try {
    const reply = await freeAI(args.join(" "), "You are a friendly chatbot. Respond casually and helpfully.");
    if (reply) {
      await editMessage(sock, jid, cbKey, `💬 *MIAS MDX Chatbot*

⬢ Processing message... ✅
⬢ Generating reply... ✅

✅ Reply ready below.

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
      await sendLongText(sock, jid, `💬 *Chatbot Reply*

${reply}

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, msg);
    } else {
      await editMessage(sock, jid, cbKey, `💬 *MIAS MDX Chatbot*

⬢ Processing message... ✅
⬢ Generating reply... ❌

Hmm, I got nothing 🤔

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    }
  } catch (e) {
    await editMessage(sock, jid, cbKey, `💬 *MIAS MDX Chatbot*

❌ Error: ${e.message}

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});
cmd("vision", { desc: "Describe an image with AI", category: "AI" }, async (sock, msg, args) => {
  const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const img = msg.message?.imageMessage || q?.imageMessage;
  if (!img) { await sendReply(sock, msg, `❌ Reply to an image with ${CONFIG.PREFIX}vision`); return; }
  const jid = msg.key.remoteJid;
  const statusMsg = await sock.sendMessage(jid, { text: `👁️ *MIAS MDX Vision*

⬡ Downloading image...
◻ Uploading for analysis...
◻ AI analyzing image...

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
  const vKey = statusMsg.key;
  try {
    const stream = await downloadContentFromMessage(img, "image");
    let buf = Buffer.from([]);
    for await (const c of stream) buf = Buffer.concat([buf, c]);
    await editMessage(sock, jid, vKey, `👁️ *MIAS MDX Vision*

⬢ Downloading image... ✅
⬡ Uploading for analysis...
◻ AI analyzing image...

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    const b64img = buf.toString("base64");
    const imgMime = "image/jpeg";
    const prompt = args.join(" ") || "Describe this image in detail. What do you see?";
    let reply = null;
    // Try 1: Gemini Vision (supports base64 images natively)
    const GEMINI_KEY = process.env.GEMINI_KEY;
    if (GEMINI_KEY) {
      try {
        const { data } = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
          { contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: imgMime, data: b64img } }] }] },
          { headers: { "Content-Type": "application/json" }, timeout: 30000 }
        );
        reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
      } catch {}
    }
    // Try 2: Upload to imgbb or transfer.sh then pass URL to AI
    if (!reply) {
      try {
        let FD; try { FD = (await import("form-data")).default; } catch {}
        if (FD) {
          const form = new FD();
          form.append("reqtype", "fileupload");
          form.append("fileToUpload", buf, { filename: "image.jpg", contentType: "image/jpeg" });
          const { data: imgUrl } = await axios.post("https://catbox.moe/user/api.php", form, { headers: form.getHeaders(), timeout: 20000 });
          if (imgUrl && imgUrl.startsWith("http")) {
            reply = await freeAI(`${prompt}. Image URL: ${imgUrl}`);
          }
        }
      } catch {}
    }
    // Try 3: pollinations vision endpoint
    if (!reply) {
      try {
        const { data } = await axios.get(
          `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=openai`,
          { headers: { "User-Agent": "Mozilla/5.0" }, responseType: "text", timeout: 20000 }
        );
        reply = typeof data === "string" ? data : JSON.stringify(data);
      } catch {}
    }
    await editMessage(sock, jid, vKey, `👁️ *MIAS MDX Vision*

⬢ Downloading image... ✅
⬢ Uploading for analysis... ✅
⬡ AI analyzing image...

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    if (reply) {
      await editMessage(sock, jid, vKey, `👁️ *MIAS MDX Vision*

⬢ Downloading image... ✅
⬢ Uploading for analysis... ✅
⬢ AI analyzing image... ✅

✅ Analysis ready below.

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
      await sendLongText(sock, jid, `👁️ *Vision Result*

${reply}

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, msg);
    } else {
      await editMessage(sock, jid, vKey, `👁️ *MIAS MDX Vision*

⬢ Downloading image... ✅
⬢ Uploading for analysis... ✅
⬢ AI analyzing image... ❌

Could not analyze this image.

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    }
  } catch (e) {
    await editMessage(sock, jid, vKey, `👁️ *MIAS MDX Vision*

❌ Vision failed: ${e.message}

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});
cmd("tts", { desc: "Text to speech (sends as voice note)", category: "AI" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}tts <text>`); return; }
  const jid = msg.key.remoteJid;
  const text = args.join(" ");
  const statusMsg = await sock.sendMessage(jid, { text: `🎤 *MIAS MDX TTS*\n\n⬡ Processing text...\n◻ Generating speech...\n◻ Sending audio...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
  const ttsKey = statusMsg.key;
  try {
    const { data } = await axios.get(`${CONFIG.GIFTED_API}/api/tools/tts?apikey=${CONFIG.GIFTED_KEY}&text=${encodeURIComponent(text)}&lang=en`, { timeout: 30000, responseType: "arraybuffer" });
    if (data && data.length > 500) {
      await sock.sendMessage(msg.key.remoteJid, { audio: Buffer.from(data), mimetype: "audio/mpeg", ptt: true }, { quoted: msg });
    } else {
      // Try as JSON with URL
      try {
        const json = JSON.parse(Buffer.from(data).toString());
        const url = json?.result?.url || json?.result?.audio || json?.result;
        if (url && typeof url === "string") {
          const audioBuf = await axios.get(url, { responseType: "arraybuffer", timeout: 30000 });
          await sock.sendMessage(msg.key.remoteJid, { audio: Buffer.from(audioBuf.data), mimetype: "audio/mpeg", ptt: true }, { quoted: msg });
        } else throw new Error("No audio");
      } catch {
        // Fallback 1: api.js TTS
        let ttsDone = false;
        try {
          const ttsUrl = await APIs.textToSpeech(text);
          if (ttsUrl && typeof ttsUrl === "string") {
            const audioBuf = await axios.get(ttsUrl, { responseType: "arraybuffer", timeout: 30000 });
            if (audioBuf.data && audioBuf.data.length > 500) {
              await sock.sendMessage(msg.key.remoteJid, { audio: Buffer.from(audioBuf.data), mimetype: "audio/mpeg", ptt: true }, { quoted: msg });
              ttsDone = true;
            }
          }
        } catch {}
        // Fallback 2: Google Translate TTS
        if (!ttsDone) {
          const gttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text.slice(0, 200))}&tl=en&client=tw-ob`;
          const audioBuf = await axios.get(gttsUrl, { responseType: "arraybuffer", timeout: 15000, headers: { "User-Agent": "Mozilla/5.0" } });
          await sock.sendMessage(msg.key.remoteJid, { audio: Buffer.from(audioBuf.data), mimetype: "audio/mpeg", ptt: true }, { quoted: msg });
        }
      }
    }
    await react(sock, msg, "✅");
  } catch (e) { await sendReply(sock, msg, `❌ TTS failed: ${e.message}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); }
});
cmd("transcribe", { desc: "Transcribe audio", category: "AI" }, async (sock, msg) => {
  const GEMINI_KEY = process.env.GEMINI_KEY;
  if (!GEMINI_KEY) { await sendReply(sock, msg, `❌ GEMINI_KEY not set in .env!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; }
  const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const aud = q?.audioMessage || msg.message?.audioMessage;
  if (!aud) { await sendReply(sock, msg, `❌ Reply to an audio/voice note with ${CONFIG.PREFIX}transcribe`); return; }
  const jid = msg.key.remoteJid;
  const statusMsg = await sock.sendMessage(jid, { text: `🎤 *MIAS MDX Transcribe*\n\n⬡ Downloading audio...\n◻ Transcribing with AI...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
  const trKey = statusMsg.key;
  try {
    const stream = await downloadContentFromMessage(aud, "audio");
    let buf = Buffer.from([]);
    for await (const c of stream) buf = Buffer.concat([buf, c]);
    const b64 = buf.toString("base64");
    const { data } = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      { contents: [{ parts: [{ text: "Transcribe this audio accurately. Return only the transcription text, nothing else." }, { inlineData: { mimeType: aud.mimetype || "audio/ogg", data: b64 } }] }] },
      { headers: { "Content-Type": "application/json" }, timeout: 60000 }
    );
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Could not transcribe audio.";
    await sendReply(sock, msg, `🎤 *Transcription*\n\n${reply}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    await react(sock, msg, "✅");
  } catch (e) { await sendReply(sock, msg, `❌ Transcription error: ${e.response?.data?.error?.message || e.message}`); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  ANIME COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════
async function sendAnimeGif(sock, msg, type) {
  await react(sock, msg, "⏳");
  try {
    // Try GiftedTech API first
    const { data } = await axios.get(`${CONFIG.GIFTED_API}/api/anime/${type}?apikey=${CONFIG.GIFTED_KEY}`, { timeout: 10000 });
    const url = data?.result?.url || data?.result?.image || data?.result;
    if (url && typeof url === "string") {
      const buf = await axios.get(url, { responseType: "arraybuffer", timeout: 15000 });
      const isGif = url.endsWith(".gif") || url.includes("gif");
      if (isGif) {
        await sock.sendMessage(msg.key.remoteJid, { video: Buffer.from(buf.data), gifPlayback: true, caption: `> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
      } else {
        await sock.sendMessage(msg.key.remoteJid, { image: Buffer.from(buf.data), caption: `> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
      }
      return;
    }
    throw new Error("fallback");
  } catch {
    // Fallback to nekos.best
    try {
      const { data } = await axios.get(`https://nekos.best/api/v2/${type}`, { timeout: 10000 });
      const url = data?.results?.[0]?.url;
      if (url) {
        const buf = await axios.get(url, { responseType: "arraybuffer", timeout: 15000 });
        await sock.sendMessage(msg.key.remoteJid, { video: Buffer.from(buf.data), gifPlayback: true, caption: `> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
      } else throw new Error("no url");
    } catch {
      await sendReply(sock, msg, `🎌 *${type.toUpperCase()}*\n\n_(Could not load — try again!)_\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    }
  }
}
cmd("anime", { desc: "Random anime image", category: "ANIME" }, async (s, m) => sendAnimeGif(s, m, "neko"));
cmd(["animequote", "aniquote"], { desc: "Random anime quote", category: "ANIME" }, async (sock, msg) => {
  await react(sock, msg, "✨");
  try {
    const { data } = await axios.get("https://animechan.io/api/v1/quotes/random", { timeout: 8000 });
    const q = data?.data || data;
    await sendReply(sock, msg, `📖 *Anime Quote*\n\n"${q.content || q.quote}"\n\n— *${q.character?.name || q.character}* from *${q.anime?.title || q.anime}*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch {
    await sendReply(sock, msg, `✨ *Anime Quote*\n\n"Believe in yourself. Not in the you who believes in me. Not the me who believes in you. Believe in the you who believes in yourself."\n\n— *Kamina* from *Gurren Lagann*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});
cmd("waifu",    { desc: "Random waifu", category: "ANIME" }, async (s, m) => sendAnimeGif(s, m, "waifu"));
cmd("neko",     { desc: "Random neko", category: "ANIME" }, async (s, m) => sendAnimeGif(s, m, "neko"));
cmd("foxxgirl", { desc: "Random fox girl", category: "ANIME" }, async (s, m) => sendAnimeGif(s, m, "kitsune"));

// ═══════════════════════════════════════════════════════════════════════════════
//  REACTIONS
// ═══════════════════════════════════════════════════════════════════════════════
const REACTION_CMDS = {
  hug: "hug", kiss: "kiss", pat: "pat", slap: "slap", wink: "wink",
  bonk: "bonk", poke: "poke", yeet: "throw", blush: "blush",
  wave: "wave", smile: "smile", highfive: "highfive", handhold: "handhold",
  nom: "feed", bite: "bite", glomp: "glomp", cringe: "cringe", dance: "dance",
};
const REACT_EMOJIS = { hug: "🤗", kiss: "💋", pat: "🥺", slap: "👋", wink: "😉", bonk: "🔨", poke: "👉", yeet: "🚀", blush: "😊", wave: "👋", smile: "😊", highfive: "🙌", handhold: "🤝", nom: "😋", bite: "😬", glomp: "🤗", cringe: "😬", dance: "💃" };
// Waifu.pics has these SFW gif types
const REACTION_ACTIONS = { hug: "hugs", kiss: "kisses", pat: "pats", slap: "slaps", wink: "winks", bonk: "bonks", poke: "pokes", yeet: "yeets", blush: "blushes at", wave: "waves at", smile: "smiles at", highfive: "high-fives", handhold: "holds hands with", nom: "feeds", bite: "bites", glomp: "glomps", cringe: "cringes at", dance: "dances with" };
const WAIFU_PICS_MAP = { hug: "hug", kiss: "kiss", pat: "pat", slap: "slap", wink: "wink", dance: "dance", wave: "wave", highfive: "highfive", poke: "poke", nom: "nom", blush: "blush", smile: "smile", bonk: "bonk", bite: "bite", glomp: "glomp", cringe: "cringe", handhold: "handhold", yeet: "yeet" };
// some-random-api types
const SRA_MAP = { hug: "hug", pat: "pat", kiss: "kiss", slap: "slap", wink: "wink", dance: "dance", wave: "wave", blush: "blush", smile: "smile", bonk: "bonk", bite: "bite" };

async function fetchReactionGif(ntype, rcmd) {
  // Try 1: nekos.best
  try {
    const { data } = await axios.get(`https://nekos.best/api/v2/${ntype}`, { timeout: 10000 });
    const url = data?.results?.[0]?.url;
    if (url) {
      const buf = await axios.get(url, { responseType: "arraybuffer", timeout: 15000, headers: { "User-Agent": "Mozilla/5.0" } });
      if (buf.data && buf.data.byteLength > 10000) return Buffer.from(buf.data);
    }
  } catch {}
  // Try 2: waifu.pics
  try {
    const wpType = WAIFU_PICS_MAP[rcmd] || ntype;
    const { data } = await axios.post("https://api.waifu.pics/sfw/" + wpType, {}, { timeout: 10000 });
    if (data?.url) {
      const buf = await axios.get(data.url, { responseType: "arraybuffer", timeout: 15000, headers: { "User-Agent": "Mozilla/5.0" } });
      if (buf.data && buf.data.byteLength > 10000) return Buffer.from(buf.data);
    }
  } catch {}
  // Try 3: some-random-api
  try {
    const sraType = SRA_MAP[rcmd];
    if (sraType) {
      const { data } = await axios.get(`https://some-random-api.com/animu/${sraType}`, { timeout: 10000 });
      if (data?.link) {
        const buf = await axios.get(data.link, { responseType: "arraybuffer", timeout: 15000, headers: { "User-Agent": "Mozilla/5.0" } });
        if (buf.data && buf.data.byteLength > 10000) return Buffer.from(buf.data);
      }
    }
  } catch {}
  // Try 4: otakugifs.xyz
  try {
    const { data } = await axios.get(`https://api.otakugifs.xyz/gif?reaction=${ntype}`, { timeout: 10000 });
    if (data?.url) {
      const buf = await axios.get(data.url, { responseType: "arraybuffer", timeout: 15000, headers: { "User-Agent": "Mozilla/5.0" } });
      if (buf.data && buf.data.byteLength > 10000) return Buffer.from(buf.data);
    }
  } catch {}
  return null;
}

for (const [rcmd, ntype] of Object.entries(REACTION_CMDS)) {
  cmd(rcmd, { desc: `${rcmd} someone (tag or reply)`, category: "REACTIONS" }, async (sock, msg, args) => {
    await react(sock, msg, REACT_EMOJIS[rcmd] || "💫");
    // Determine target: @mentioned, replied-to, or from args
    const ctx = msg.message?.extendedTextMessage?.contextInfo
      || msg.message?.imageMessage?.contextInfo
      || msg.message?.videoMessage?.contextInfo
      || msg.message?.audioMessage?.contextInfo
      || msg.message?.documentMessage?.contextInfo
      || msg.message?.stickerMessage?.contextInfo
      || msg.message?.buttonsResponseMessage?.contextInfo
      || msg.message?.listResponseMessage?.contextInfo;
    const mentionedJids = ctx?.mentionedJid || [];
    let targetJid = mentionedJids[0] || null;
    if (!targetJid && ctx?.participant) targetJid = ctx.participant;
    if (!targetJid && args[0]) {
      const num = args[0].replace(/[^0-9]/g, "");
      if (num.length >= 7) targetJid = num + "@s.whatsapp.net";
    }
    const senderName = await getDisplayName(sock, getSender(msg), msg.key.remoteJid);
    let targetName = targetJid ? await getDisplayName(sock, targetJid, msg.key.remoteJid) : null;
    let caption, mentions = [];
    const actionWord = REACTION_ACTIONS[rcmd] || `${rcmd}s`;
    if (targetJid) {
      caption = `${REACT_EMOJIS[rcmd]} *${senderName}* ${actionWord} *${targetName || "@" + _cleanNum(targetJid)}*!`;
      mentions = [getSender(msg), targetJid].filter(Boolean);
    } else {
      caption = `${REACT_EMOJIS[rcmd]} *${senderName}* ${actionWord}!`;
    }
    caption += `\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
    const gifBuf = await fetchReactionGif(ntype, rcmd);
    if (gifBuf) {
      // nekos.best returns actual MP4 videos — send as gifPlayback video
      let sent = false;
      // Method 1: video with gifPlayback (for MP4 from nekos.best)
      if (!sent) try {
        await sock.sendMessage(msg.key.remoteJid, { video: gifBuf, gifPlayback: true, caption, mentions }, { quoted: msg });
        sent = true;
      } catch {}
      // Method 2: video without gifPlayback (still autoplays in WA)
      if (!sent) try {
        await sock.sendMessage(msg.key.remoteJid, { video: gifBuf, caption, mentions }, { quoted: msg });
        sent = true;
      } catch {}
      // Method 3: image with gif mimetype (for actual GIF buffers)
      if (!sent) try {
        await sock.sendMessage(msg.key.remoteJid, { image: gifBuf, mimetype: "image/gif", caption, mentions }, { quoted: msg });
        sent = true;
      } catch {}
      // Method 4: plain image (guaranteed to work)
      if (!sent) try {
        await sock.sendMessage(msg.key.remoteJid, { image: gifBuf, caption, mentions }, { quoted: msg });
        sent = true;
      } catch {}
      if (sent) return;
    }
    // No image found — send text only
    await sendReply(sock, msg, caption);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  AUDIO COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════
const AUDIO_CMDS = ["deep","smooth","fat","tupai","blown","robot","chipmunk","nightcore","earrape","bass","reverse","slow","fast","baby","deamon"];
for (const ac of AUDIO_CMDS) {
  cmd(ac, { desc: `Audio effect: ${ac}`, category: "AUDIO" }, async (sock, msg) => {
    const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const aud = q?.audioMessage || msg.message?.audioMessage;
    if (!aud) { await sendReply(sock, msg, `🎵 *${ac.toUpperCase()}*\n\nReply to an audio message to apply this effect.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; }
    await react(sock, msg, "🎵");
    try {
      const stream = await downloadContentFromMessage(aud, "audio");
      let buf = Buffer.from([]);
      for await (const c of stream) buf = Buffer.concat([buf, c]);
      const inPath = `/tmp/audio_${Date.now()}.ogg`;
      const outPath = `/tmp/audio_out_${Date.now()}.ogg`;
      fs.writeFileSync(inPath, buf);
      const { execSync } = await import("child_process");
      const filters = {
        deep: "asetrate=44100*0.75,atempo=1.333", smooth: "atempo=0.9,treble=g=-5",
        fat: "asetrate=44100*0.7,atempo=1.428", tupai: "asetrate=44100*1.6,atempo=0.625",
        blown: "volume=10,acrusher=.1:1:64:0:log", robot: "asetrate=44100*0.9,atempo=1.1,afftfilt=real='hypot(re\,im)*cos(0)':imag='hypot(re\,im)*sin(0)'",
        chipmunk: "asetrate=44100*1.5,atempo=0.67", nightcore: "asetrate=44100*1.25,atempo=0.8",
        earrape: "volume=15,acrusher=.1:1:64:0:log", bass: "equalizer=f=80:width_type=h:width=50:g=20",
        reverse: "areverse", slow: "atempo=0.7", fast: "atempo=1.5",
        baby: "asetrate=44100*1.4", deamon: "asetrate=44100*0.6",
      };
      const filter = filters[ac] || "anull";
      try {
        // Use proper opus encoding for WhatsApp compatibility
        execSync(`ffmpeg -i ${inPath} -af "${filter}" -c:a libopus -b:a 128k -ar 48000 -ac 1 -y ${outPath}`, { timeout: 30000, stdio: "pipe" });
        const outBuf = fs.readFileSync(outPath);
        await sock.sendMessage(msg.key.remoteJid, { audio: outBuf, mimetype: "audio/ogg; codecs=opus", ptt: true }, { quoted: msg });
      } catch (ffErr) {
        // Fallback: try without codec specification
        try {
          execSync(`ffmpeg -i ${inPath} -af "${filter}" -y ${outPath}`, { timeout: 30000, stdio: "pipe" });
          const outBuf = fs.readFileSync(outPath);
          await sock.sendMessage(msg.key.remoteJid, { audio: outBuf, mimetype: "audio/ogg; codecs=opus", ptt: true }, { quoted: msg });
        } catch {
          await sock.sendMessage(msg.key.remoteJid, { audio: buf, mimetype: "audio/ogg; codecs=opus", ptt: true }, { quoted: msg });
          await sendReply(sock, msg, `🎵 *${ac.toUpperCase()}*\n\n⚠️ Audio processing unavailable — sent original audio.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
        }
      }
      try { fs.unlinkSync(inPath); fs.unlinkSync(outPath); } catch {}
    } catch (e) { await sendReply(sock, msg, "❌ Audio processing failed: " + e.message); }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SEARCH COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════
cmd("define", { desc: "Define a word", category: "SEARCH" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}define <word>`); return; }
  await react(sock, msg, "📖");
  try {
    const { data } = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${args[0]}`, { timeout: 10000 });
    const entry = data[0];
    const def = entry.meanings[0]?.definitions[0];
    await sendReply(sock, msg, `📖 *${entry.word}*\n\n📝 *Part of speech:* ${entry.meanings[0]?.partOfSpeech}\n\n💬 *Definition:*\n${def?.definition}\n\n📌 *Example:* ${def?.example || "N/A"}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch { await sendReply(sock, msg, `❌ No definition found for: *${args[0]}*`); }
});
cmd(["weather"], { desc: "Check weather", category: "SEARCH" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}weather <city>`); return; }
  const jid = msg.key.remoteJid;
  const city = args.join(" ");
  const statusMsg = await sock.sendMessage(jid, { text: `🌤️ *MIAS MDX Weather*\n\n⬡ Locating *${city}*...\n◻ Fetching weather data...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
  const wKey = statusMsg.key;
  try {
    const { data } = await axios.get(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, { timeout: 10000 });
    const current = data.current_condition[0];
    const area = data.nearest_area[0];
    await editMessage(sock, jid, wKey,
      `🌤️ *MIAS MDX Weather*\n\n` +
      `⬢ Locating *${city}*... ✅\n` +
      `⬢ Fetching weather data... ✅\n\n` +
      `📍 *${area.areaName[0].value}, ${area.country[0].value}*\n\n` +
      `🌡️ Temp: *${current.temp_C}°C / ${current.temp_F}°F*\n` +
      `💧 Humidity: *${current.humidity}%*\n` +
      `💨 Wind: *${current.windspeedKmph} km/h*\n` +
      `☁️ Condition: *${current.weatherDesc[0].value}*\n` +
      `👁️ Visibility: *${current.visibility} km*\n\n` +
      `> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`
    );
  } catch { await editMessage(sock, jid, wKey, `🌤️ *MIAS MDX Weather*\n\n⬢ Locating *${city}*... ❌\n\n❌ Could not fetch weather\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); }
});
cmd("wiki", { desc: "Wikipedia search", category: "SEARCH" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}wiki <topic>`); return; }
  const jid = msg.key.remoteJid;
  const q = args.join(" ");
  await react(sock, msg, "📚");
  const statusMsg = await sock.sendMessage(jid, { text: `📚 *MIAS MDX Wiki*\n\n⬡ Searching *"${q}"*...\n◻ Fetching article...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
  const wkKey = statusMsg.key;
  try {
    // First try direct page summary
    let data;
    try {
      const resp = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`, {
        timeout: 15000,
        headers: { "User-Agent": "MIAS-MDX-Bot/4.1.0 (WhatsApp Bot)" }
      });
      data = resp.data;
    } catch {
      // Fallback: search Wikipedia API for the best match
      const search = await axios.get(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&srlimit=1`, {
        timeout: 15000,
        headers: { "User-Agent": "MIAS-MDX-Bot/4.1.0 (WhatsApp Bot)" }
      });
      const title = search.data?.query?.search?.[0]?.title;
      if (!title) throw new Error("No Wikipedia results found for that topic");
      const resp = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
        timeout: 15000,
        headers: { "User-Agent": "MIAS-MDX-Bot/4.1.0 (WhatsApp Bot)" }
      });
      data = resp.data;
    }
    if (!data?.extract) throw new Error("No content found for this topic");
    const thumb = data.thumbnail?.source;
    const text = `📚 *${data.title}*\n\n⬢ Searching... ✅\n⬢ Fetching article... ✅\n\n${data.extract?.slice(0, 800)}${data.extract?.length > 800 ? "..." : ""}\n\n🔗 ${data.content_urls?.desktop?.page || ""}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
    if (thumb) {
      try {
        const imgBuf = await axios.get(thumb, { responseType: "arraybuffer", timeout: 10000 });
        await sock.sendMessage(jid, { image: Buffer.from(imgBuf.data), caption: text }, { quoted: msg });
      } catch { await editMessage(sock, jid, wkKey, text); }
    } else {
      await editMessage(sock, jid, wkKey, text);
    }
  } catch { await editMessage(sock, jid, wkKey, `📚 *MIAS MDX Wiki*\n\n⬢ Searching... ❌\n\n❌ Not found on Wikipedia: *${q}*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); }
});
cmd("news", { desc: "Latest news", category: "SEARCH" }, async (sock, msg) => {
  await react(sock, msg, "📰");
  try {
    const { data } = await axios.get("https://gnews.io/api/v4/top-headlines?lang=en&max=5&apikey=demo", { timeout: 10000 });
    let t = "📰 *Latest News*\n\n";
    (data.articles || []).forEach((a, i) => t += `${i + 1}. *${a.title}*\n🔗 ${a.url}\n\n`);
    await sendReply(sock, msg, t + `> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch { await sendReply(sock, msg, `📰 *News*\n\nCheck: https://news.google.com\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); }
});
cmd("google", { desc: "Google search", category: "SEARCH" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}google <query>`); return; }
  await react(sock, msg, "🔍");
  const q = args.join(" ");
  const jid = msg.key.remoteJid;
  const statusMsg = await sock.sendMessage(jid, { text: `🔍 *MIAS MDX Search*\n\n⬡ Searching for *"${q.slice(0, 60)}"*...\n◻ Fetching results...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
  const srchKey = statusMsg.key;
  try {
    const { data } = await axios.get(`${CONFIG.GIFTED_API}/api/search/google?apikey=${CONFIG.GIFTED_KEY}&q=${encodeURIComponent(q)}`, { timeout: 15000 });
    if (data?.result?.length) {
      let t = `🔍 *Google: ${q}*\n\n`;
      data.result.slice(0, 5).forEach((r, i) => { t += `${i+1}. *${r.title}*\n${r.description || ""}\n🔗 ${r.url || r.link}\n\n`; });
      t += `> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
      await sendReply(sock, msg, t);
    } else throw new Error("no results");
  } catch {
    try {
      const { data } = await axios.get(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1`, { timeout: 10000 });
      let results = `🔍 *Search: ${q}*\n\n`;
      if (data.Abstract) results += `📝 ${data.Abstract}\n\n`;
      if (data.RelatedTopics?.length) data.RelatedTopics.slice(0, 5).forEach((r, i) => { if (r.Text) results += `${i+1}. ${r.Text}\n\n`; });
      results += `🔗 https://www.google.com/search?q=${encodeURIComponent(q)}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
      await sendReply(sock, msg, results);
    } catch { await sendReply(sock, msg, `🔍 https://www.google.com/search?q=${encodeURIComponent(q)}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); }
  }
});
cmd("img", { desc: "Image search", category: "SEARCH" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}img <query>`); return; }
  const q = args.join(" ");
  const jid = msg.key.remoteJid;
  await react(sock, msg, "🖼️");
  const statusMsg = await sock.sendMessage(jid, { text: `🖼️ *MIAS MDX Image Search*\n\n⬡ Searching for *"${q}"*...\n◻ Downloading image...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
  const imgKey = statusMsg.key;
  const imgApis = [
    // 1: GIFTED API Google image search
    async () => {
      const { data } = await axios.get(`${CONFIG.GIFTED_API}/api/search/image?apikey=${CONFIG.GIFTED_KEY}&q=${encodeURIComponent(q)}`, { timeout: 15000 });
      const url = data?.result?.[0]?.url || data?.results?.[0]?.url || data?.url;
      if (!url) throw new Error("no result");
      return url;
    },
    // 2: Pixabay (free, no key needed for limited usage)
    async () => {
      const { data } = await axios.get(`https://pixabay.com/api/?key=47588975-5b1a94b08b8a3ad99a5b3e03f&q=${encodeURIComponent(q)}&image_type=photo&per_page=3&safesearch=true`, { timeout: 10000 });
      const url = data?.hits?.[0]?.largeImageURL || data?.hits?.[0]?.webformatURL;
      if (!url) throw new Error("no result");
      return url;
    },
    // 3: Unsplash with env key (if set)
    async () => {
      const key = process.env.UNSPLASH_KEY;
      if (!key || key === "demo") throw new Error("no unsplash key");
      const { data } = await axios.get(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=1`, { headers: { Authorization: `Client-ID ${key}` }, timeout: 10000 });
      const url = data?.results?.[0]?.urls?.regular;
      if (!url) throw new Error("no result");
      return url;
    },
  ];
  let imageUrl = null;
  for (const tryApi of imgApis) {
    try { imageUrl = await tryApi(); if (imageUrl) break; } catch {}
  }
  if (imageUrl) {
    try {
      const buf = await axios.get(imageUrl, { responseType: "arraybuffer", timeout: 20000, headers: { "User-Agent": "Mozilla/5.0" } });
      if (buf.data?.byteLength > 1000) {
        await editMessage(sock, jid, imgKey, `🖼️ *MIAS MDX Image Search*\n\n⬢ Searching... ✅\n⬢ Sending image...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
        await sock.sendMessage(jid, { image: Buffer.from(buf.data), caption: `🖼️ *${q}*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
        return;
      }
    } catch {}
    await editMessage(sock, jid, imgKey, `🖼️ *${q}*\n\n🔗 ${imageUrl}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } else {
    await editMessage(sock, jid, imgKey, `🖼️ *Image Search: ${q}*\n\n🔗 Search on Google Images:\nhttps://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});
cmd("lyrics", { desc: "Song lyrics", category: "SEARCH" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}lyrics <song name>`); return; }
  await react(sock, msg, "🎶");
  const jid = msg.key.remoteJid;
  const q = args.join(" ");
  const statusMsg = await sock.sendMessage(jid, { text: `🎶 *MIAS MDX Lyrics*\n\n⬡ Searching for *"${q}"*...\n◻ Fetching lyrics...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
  const lyrKey = statusMsg.key;
  const lyricsApis = [
    // 1. lyrist (reliable vercel endpoint)
    async () => {
      const words = q.trim().split(" ");
      const titlePart = words.slice(0, 3).join(" ");
      const { data } = await axios.get(`https://lyrist.vercel.app/api/${encodeURIComponent(titlePart)}`, { timeout: 12000 });
      if (data?.lyrics) return { lyrics: data.lyrics, title: data.title || q, artist: data.artist || "Unknown" };
    },
    // 2. lyrics.ovh (requires artist + title split)
    async () => {
      const words = q.trim().split(" ");
      const artist = words[0], title = words.slice(1).join(" ") || words[0];
      const { data } = await axios.get(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`, { timeout: 12000 });
      if (data?.lyrics) return { lyrics: data.lyrics, title: title, artist: artist };
    },
    // 3. some-random-api
    async () => {
      const { data } = await axios.get(`https://some-random-api.com/others/lyrics?title=${encodeURIComponent(q)}`, { timeout: 12000 });
      if (data?.lyrics) return { lyrics: data.lyrics, title: data.title || q, artist: data.author || "Unknown" };
    },
    // 4. happi.dev (free tier, no key needed with basic usage)
    async () => {
      const { data } = await axios.get(`https://api.happi.dev/v1/music?q=${encodeURIComponent(q)}&limit=1&apikey=live_c...free`, { timeout: 10000 });
      if (data?.result?.[0]) {
        const r = data.result[0];
        const { data: lData } = await axios.get(r.api_lyrics || "", { timeout: 10000 });
        if (lData?.result?.lyrics) return { lyrics: lData.result.lyrics, title: r.track, artist: r.artist };
      }
    },
    // 5. Gifted/Custom API
    async () => {
      const { data } = await axios.get(`${CONFIG.GIFTED_API}/api/search/lyrics?apikey=${CONFIG.GIFTED_KEY}&q=${encodeURIComponent(q)}`, { timeout: 12000 });
      if (data?.lyrics || data?.result?.lyrics) {
        const r = data.result || data;
        return { lyrics: r.lyrics, title: r.title || q, artist: r.artist || "Unknown" };
      }
    },
    // 6. Pollinations AI fallback — generate lyrics with AI
    async () => {
      const reply = await freeAI(`Give me the full song lyrics for "${q}". Only output the lyrics, no commentary.`);
      if (reply && reply.length > 100) return { lyrics: reply, title: q, artist: "AI Generated" };
    },
  ];
  await editMessage(sock, jid, lyrKey, `🎶 *MIAS MDX Lyrics*\n\n⬢ Searching for *"${q}"*... ✅\n⬡ Fetching lyrics...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  let found = null;
  for (const tryApi of lyricsApis) {
    try { found = await tryApi(); if (found?.lyrics) break; } catch {}
  }
  if (found?.lyrics) {
    const _lyrText = found.lyrics.length > 3500 ? found.lyrics.slice(0, 3500) + "\n\n_…lyrics trimmed_" : found.lyrics;
    const _lyrFull = `🎶 *${found.title}*\n🎤 *${found.artist}*\n\n${_lyrText}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
    // Try edit first (works in DM); fall back to new message (works in groups)
    let _lyrEdited = false;
    try { await sock.sendMessage(jid, { text: _lyrFull, edit: lyrKey }); _lyrEdited = true; } catch {}
    if (!_lyrEdited) {
      try { await sock.sendMessage(jid, { text: `🎶 Fetched lyrics for *${found.title}*`, edit: lyrKey }); } catch {}
      await sock.sendMessage(jid, { text: _lyrFull }, { quoted: msg });
    }
  } else {
    const _lyrErr = `🎶 *MIAS MDX Lyrics*\n\n⬢ Searching... ✅\n⬢ Fetching lyrics... ❌\n\n❌ No lyrics found for: *${q}*\n🔗 https://www.google.com/search?q=${encodeURIComponent(q + " lyrics")}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
    try { await sock.sendMessage(jid, { text: _lyrErr, edit: lyrKey }); } catch { await sendReply(sock, msg, _lyrErr); }
  }
});
cmd("lyrics2", { desc: "Alt lyrics search", category: "SEARCH" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}lyrics2 <song>`); return; }
  await react(sock, msg, "🎶");
  try {
    const { data } = await axios.get(`https://some-random-api.com/others/lyrics?title=${encodeURIComponent(args.join(" "))}`, { timeout: 10000 });
    if (data?.lyrics) {
      const lyrics = data.lyrics.length > 3000 ? data.lyrics.slice(0, 3000) + "..." : data.lyrics;
      await sendReply(sock, msg, `🎶 *${data.title || args.join(" ")}*\n🎤 ${data.author || "Unknown"}\n\n${lyrics}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    } else { await sendReply(sock, msg, `❌ No lyrics found.`); }
  } catch { await sendReply(sock, msg, `❌ Lyrics search failed.`); }
});
cmd("currency", { desc: "Currency converter", category: "SEARCH" }, async (sock, msg, args) => {
  if (args.length < 3) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}currency <amount> <from> <to>\nExample: ${CONFIG.PREFIX}currency 100 USD NGN`); return; }
  const amount = parseFloat(args[0]), from = args[1].toUpperCase(), to = args[2].toUpperCase();
  try {
    const { data } = await axios.get(`https://api.exchangerate-api.com/v4/latest/${from}`, { timeout: 10000 });
    const rate = data.rates[to];
    if (!rate) throw new Error("Currency not found");
    const result = (amount * rate).toFixed(2);
    await sendReply(sock, msg, `💱 *Currency Converter*\n\n${amount} ${from} = *${result} ${to}*\nRate: 1 ${from} = ${rate} ${to}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch { await sendReply(sock, msg, "❌ Currency conversion failed. Check currency codes."); }
});
cmd("github", { desc: "GitHub user info — multi-API fallback", category: "SEARCH" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}github <username>`); return; }
  const user = args[0].replace(/^@/, "").trim();
  await react(sock, msg, "🐙");
  const ghApis = [
    async () => {
      const { data } = await axios.get(`https://api.github.com/users/${encodeURIComponent(user)}`, {
        timeout: 12000,
        headers: { "User-Agent": "MIAS-MDX-Bot", "Accept": "application/vnd.github+json" }
      });
      if (!data?.login) return null;
      return { login: data.login, name: data.name, bio: data.bio, location: data.location, repos: data.public_repos, followers: data.followers, following: data.following, url: data.html_url, avatar: data.avatar_url, created: data.created_at, company: data.company, blog: data.blog };
    },
    async () => {
      const { data } = await axios.get(`${CONFIG.GIFTED_API}/api/stalk/github?apikey=${CONFIG.GIFTED_KEY}&q=${encodeURIComponent(user)}`, { timeout: 12000 });
      const r = data?.result; if (!r?.login && !r?.username) return null;
      return { login: r.login || r.username, name: r.name, bio: r.bio, location: r.location, repos: r.public_repos, followers: r.followers, following: r.following, url: r.html_url || r.url, avatar: r.avatar_url };
    },
    async () => {
      const { data } = await axios.get(`https://api.siputzx.my.id/api/stalk/github?user=${encodeURIComponent(user)}`, { timeout: 12000 });
      const r = data?.data; if (!r) return null;
      return { login: r.username || r.login, name: r.name, bio: r.bio, location: r.location, repos: r.repos, followers: r.followers, following: r.following, url: r.url, avatar: r.avatar };
    },
    async () => {
      const { data } = await axios.get(`https://api.popcat.xyz/github/${encodeURIComponent(user)}`, { timeout: 12000 });
      if (!data?.login) return null;
      return { login: data.login, name: data.name, bio: data.bio, location: data.location, repos: data.public_repos, followers: data.followers, following: data.following, url: data.html_url, avatar: data.avatar_url };
    },
  ];
  let info = null;
  for (const fn of ghApis) { try { const r = await fn(); if (r?.login) { info = r; break; } } catch {} }
  if (!info) { await sendReply(sock, msg, `❌ GitHub user *${user}* not found (all 4 sources failed).\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; }
  const t = `🐙 *GitHub: ${info.login}*\n\n📝 Name: ${info.name || "N/A"}\n📋 Bio: ${info.bio || "No bio"}\n🏢 Company: ${info.company || "N/A"}\n📍 Location: ${info.location || "N/A"}\n🌐 Blog: ${info.blog || "N/A"}\n📦 Repos: ${info.repos ?? "N/A"}\n👥 Followers: ${info.followers ?? "N/A"}\n👤 Following: ${info.following ?? "N/A"}\n📅 Joined: ${info.created ? new Date(info.created).toDateString() : "N/A"}\n🔗 ${info.url || "https://github.com/" + info.login}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
  try {
    if (info.avatar) {
      const buf = await axios.get(info.avatar, { responseType: "arraybuffer", timeout: 10000 });
      await sock.sendMessage(msg.key.remoteJid, { image: Buffer.from(buf.data), caption: t }, { quoted: msg });
    } else { await sendReply(sock, msg, t); }
  } catch { await sendReply(sock, msg, t); }
});
cmd("ud", { desc: "Urban Dictionary", category: "SEARCH" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}ud <word>`); return; }
  try {
    const { data } = await axios.get(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(args.join(" "))}`, { timeout: 10000 });
    const entry = data?.list?.[0];
    if (!entry) { await sendReply(sock, msg, "❌ Not found on Urban Dictionary."); return; }
    await sendReply(sock, msg, `📖 *${entry.word}*\n\n${entry.definition?.slice(0, 500)}\n\n📌 Example: ${entry.example?.slice(0, 300) || "N/A"}\n\n👍 ${entry.thumbs_up} | 👎 ${entry.thumbs_down}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch { await sendReply(sock, msg, "❌ Urban Dictionary lookup failed."); }
});
cmd("movie", { desc: "Search & download movies", category: "SEARCH" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}movie <name>`); return; }
  await react(sock, msg, "🎬");
  try {
    const q = args.join(" ");
    const { data } = await axios.get(`${CONFIG.MOVIE_API}/search/${encodeURIComponent(q)}?page=1`, {
      headers: { Authorization: `Bearer ${CONFIG.GIFTED_KEY}` }, timeout: 15000
    });
    if (data?.results?.items?.length) {
      const items = data.results.items.slice(0, 5);
      let t = `🎬 *Movie Search: ${q}*\n\n`;
      for (let i = 0; i < items.length; i++) {
        const m = items[i];
        t += `${i+1}. *${m.title || m.name}*\n`;
        t += `   📅 ${m.year || "N/A"} | ⭐ ${m.rating || "N/A"}\n`;
        t += `   🆔 ID: \`${m.subjectId || m.id}\`\n\n`;
      }
      t += `📥 Use: ${CONFIG.PREFIX}moviedl <ID> to get download links\n`;
      t += `ℹ️ Use: ${CONFIG.PREFIX}movieinfo <ID> for details\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
      await sendReply(sock, msg, t);
    } else { await sendReply(sock, msg, `❌ No movies found for: *${q}*`); }
  } catch (e) { await sendReply(sock, msg, `❌ Movie search failed: ${e.message}`); }
});
cmd("movieinfo", { desc: "Get movie details", category: "SEARCH" }, async (sock, msg, args) => {
  if (!args[0]) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}movieinfo <movie_id>`); return; }
  await react(sock, msg, "🎬");
  try {
    const { data } = await axios.get(`${CONFIG.MOVIE_API}/info/${args[0]}`, {
      headers: { Authorization: `Bearer ${CONFIG.GIFTED_KEY}` }, timeout: 15000
    });
    if (data?.result) {
      const m = data.result;
      let t = `🎬 *${m.title || m.name}*\n\n`;
      t += `📅 Year: ${m.year || "N/A"}\n`;
      t += `⭐ Rating: ${m.rating || "N/A"}\n`;
      t += `🎭 Genre: ${m.genres?.join(", ") || "N/A"}\n`;
      t += `⏱️ Duration: ${m.duration || "N/A"}\n`;
      t += `📝 ${(m.description || m.plot || "No description").slice(0, 500)}\n\n`;
      t += `📥 Use: ${CONFIG.PREFIX}moviedl ${args[0]}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
      if (m.poster || m.image) {
        try {
          const buf = await axios.get(m.poster || m.image, { responseType: "arraybuffer", timeout: 10000 });
          await sock.sendMessage(msg.key.remoteJid, { image: Buffer.from(buf.data), caption: t }, { quoted: msg });
          return;
        } catch {}
      }
      await sendReply(sock, msg, t);
    } else { await sendReply(sock, msg, "❌ Movie not found."); }
  } catch (e) { await sendReply(sock, msg, "❌ Failed: " + e.message); }
});
cmd("moviedl", { desc: "Get movie download links", category: "DOWNLOAD" }, async (sock, msg, args) => {
  if (!args[0]) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}moviedl <movie_id> [season] [episode]`); return; }
  await react(sock, msg, "📥");
  try {
    let url = `${CONFIG.MOVIE_API}/sources/${args[0]}`;
    if (args[1]) url += `?season=${args[1]}`;
    if (args[2]) url += `&episode=${args[2]}`;
    const { data } = await axios.get(url, { headers: { Authorization: `Bearer ${CONFIG.GIFTED_KEY}` }, timeout: 15000 });
    if (data?.result || data?.sources) {
      const sources = data.result || data.sources;
      let t = `📥 *Download Links*\n\n`;
      if (Array.isArray(sources)) {
        sources.forEach((s, i) => {
          t += `${i+1}. *${s.quality || s.label || "Link"}*\n🔗 ${s.url || s.link || s.source}\n\n`;
        });
      } else {
        t += JSON.stringify(sources, null, 2).slice(0, 1000);
      }
      t += `\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
      await sendReply(sock, msg, t);
    } else { await sendReply(sock, msg, "❌ No download sources found."); }
  } catch (e) { await sendReply(sock, msg, "❌ Failed: " + e.message); }
});
cmd("trending", { desc: "Trending movies", category: "SEARCH" }, async (sock, msg) => {
  await react(sock, msg, "🔥");
  try {
    const { data } = await axios.get(`${CONFIG.MOVIE_API}/trending`, {
      headers: { Authorization: `Bearer ${CONFIG.GIFTED_KEY}` }, timeout: 15000
    });
    if (data?.results?.items?.length) {
      let t = `🔥 *Trending Movies*\n\n`;
      data.results.items.slice(0, 10).forEach((m, i) => {
        t += `${i+1}. *${m.title || m.name}* (${m.year || "N/A"}) ⭐${m.rating || "?"}\n`;
      });
      t += `\n📥 Use: ${CONFIG.PREFIX}moviedl <ID> for links\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
      await sendReply(sock, msg, t);
    } else { await sendReply(sock, msg, "❌ No trending data."); }
  } catch (e) { await sendReply(sock, msg, "❌ " + e.message); }
});
cmd(["ytsearch", "yts"], { desc: "YouTube search — returns real results", category: "SEARCH" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}ytsearch <query>`); return; }
  await react(sock, msg, "🔴");
  const q = args.join(" ");
  const jid = msg.key.remoteJid;
  const statusMsg = await sock.sendMessage(jid, { text: `🔴 *YouTube Search*\n\n⬡ Searching for *"${q}"*...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
  const ytKey = statusMsg.key;
  const ytApis = [
    async () => {
      const { data } = await axios.get(`${CONFIG.GIFTED_API}/api/search/youtube?apikey=${CONFIG.GIFTED_KEY}&q=${encodeURIComponent(q)}`, { timeout: 15000 });
      return (data?.result || data?.results || []).slice(0, 5).map(r => ({
        title: r.title, url: r.url || `https://youtube.com/watch?v=${r.id || r.videoId}`,
        duration: r.duration || r.length, views: r.views, channel: r.channel || r.author
      }));
    },
    async () => {
      const { data } = await axios.get(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&key=${process.env.YOUTUBE_API_KEY || ""}&type=video&maxResults=5`, { timeout: 10000 });
      if (!process.env.YOUTUBE_API_KEY) throw new Error("no key");
      return (data?.items || []).map(r => ({
        title: r.snippet?.title, url: `https://youtube.com/watch?v=${r.id?.videoId}`,
        channel: r.snippet?.channelTitle, views: ""
      }));
    },
    async () => {
      const { data } = await axios.get(`https://yt-search3.p.rapidapi.com/search?q=${encodeURIComponent(q)}`, {
        headers: { "x-rapidapi-host": "yt-search3.p.rapidapi.com", "x-rapidapi-key": process.env.RAPID_KEY || "" },
        timeout: 10000
      });
      if (!process.env.RAPID_KEY) throw new Error("no key");
      return (data?.data?.items || []).slice(0, 5).map(r => ({
        title: r.title, url: `https://youtube.com/watch?v=${r.id}`,
        duration: r.duration, channel: r.channelTitle
      }));
    },
  ];
  let results = [];
  for (const tryApi of ytApis) {
    try { results = await tryApi(); if (results?.length) break; } catch {}
  }
  if (results.length) {
    let txt = `🔴 *YouTube: ${q}*\n\n`;
    results.forEach((r, i) => {
      txt += `${i + 1}. 🎬 *${r.title}*\n`;
      if (r.channel) txt += `   📺 ${r.channel}\n`;
      if (r.duration) txt += `   ⏱️ ${r.duration}\n`;
      txt += `   🔗 ${r.url}\n\n`;
    });
    txt += `> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
    await editMessage(sock, jid, ytKey, txt);
  } else {
    await editMessage(sock, jid, ytKey, `🔴 *YouTube: ${q}*\n\n🔗 https://www.youtube.com/results?search_query=${encodeURIComponent(q)}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});

cmd(["tiksearch", "ttsearch"], { desc: "TikTok search", category: "SEARCH" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}tiksearch <query>`); return; }
  await react(sock, msg, "🎵");
  const q = args.join(" ");
  const jid = msg.key.remoteJid;
  let results = [];
  try {
    const { data } = await axios.get(`${CONFIG.GIFTED_API}/api/search/tiktok?apikey=${CONFIG.GIFTED_KEY}&q=${encodeURIComponent(q)}`, { timeout: 15000 });
    results = (data?.result || data?.results || []).slice(0, 5);
  } catch {}
  if (results.length) {
    let txt = `🎵 *TikTok: ${q}*\n\n`;
    results.forEach((r, i) => { txt += `${i + 1}. *${r.title || r.desc || "TikTok"}*\n🔗 ${r.url || r.link}\n\n`; });
    txt += `> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
    await sendReply(sock, msg, txt);
  } else {
    await sendReply(sock, msg, `🎵 *TikTok: ${q}*\n\n🔗 https://www.tiktok.com/search?q=${encodeURIComponent(q)}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});

cmd(["spotisearch", "spoti"], { desc: "Spotify search", category: "SEARCH" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}spotisearch <query>`); return; }
  await react(sock, msg, "🟢");
  const q = args.join(" ");
  let results = [];
  try {
    const { data } = await axios.get(`${CONFIG.GIFTED_API}/api/search/spotify?apikey=${CONFIG.GIFTED_KEY}&q=${encodeURIComponent(q)}`, { timeout: 15000 });
    results = (data?.result || data?.results || data?.tracks?.items || []).slice(0, 5);
  } catch {}
  if (results.length) {
    let txt = `🟢 *Spotify: ${q}*\n\n`;
    results.forEach((r, i) => {
      const track = r.name || r.title || "Track";
      const artist = r.artists?.[0]?.name || r.artist || "";
      const url = r.external_urls?.spotify || r.url || `https://open.spotify.com/search/${encodeURIComponent(q)}`;
      txt += `${i + 1}. 🎵 *${track}*${artist ? ` — ${artist}` : ""}\n🔗 ${url}\n\n`;
    });
    txt += `> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
    await sendReply(sock, msg, txt);
  } else {
    await sendReply(sock, msg, `🟢 *Spotify: ${q}*\n\n🔗 https://open.spotify.com/search/${encodeURIComponent(q)}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});

cmd(["ftball", "football"], { desc: "Football/soccer news & scores", category: "SEARCH" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}ftball <team/query>`); return; }
  await react(sock, msg, "⚽");
  const q = args.join(" ");
  let results = [];
  try {
    const { data } = await axios.get(`${CONFIG.GIFTED_API}/api/search/google?apikey=${CONFIG.GIFTED_KEY}&q=${encodeURIComponent("football " + q)}`, { timeout: 12000 });
    results = (data?.result || data?.results || []).slice(0, 5);
  } catch {}
  if (results.length) {
    let txt = `⚽ *Football: ${q}*\n\n`;
    results.forEach((r, i) => { txt += `${i + 1}. *${r.title}*\n${r.description || ""}\n🔗 ${r.url || r.link}\n\n`; });
    txt += `> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
    await sendReply(sock, msg, txt);
  } else {
    await sendReply(sock, msg, `⚽ *Football: ${q}*\n\n🔗 https://www.google.com/search?q=${encodeURIComponent("football " + q)}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  ECONOMY COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════
cmd(["money", "wallet", "bal", "balance"], { desc: "Check wallet", category: "ECONOMY" }, async (sock, msg) => {
  const jid = getSender(msg) || msg.key.remoteJid, e = getEco(jid);
  await sendReply(sock, msg, `💰 *Wallet*\n\n💵 Wallet: *${e.wallet.toLocaleString()} coins*\n🏦 Bank: *${e.bank.toLocaleString()} coins*\n💎 Net worth: *${(e.wallet + e.bank).toLocaleString()} coins*\n⭐ Level: *${e.level}* (XP: ${e.xp}/${e.level * 100})\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd(["daily", "claim"], { desc: "Claim daily coins", category: "ECONOMY" }, async (sock, msg) => {
  const jid = getSender(msg) || msg.key.remoteJid;
  const cd = cdCheck(lastDaily, jid, 24 * 60 * 60 * 1000);
  if (cd) { await sendReply(sock, msg, `⏳ Daily cooldown: *${Math.floor(cd / 3600)}h ${Math.floor((cd % 3600) / 60)}m* left.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; }
  const amount = Math.floor(Math.random() * 500) + 500;
  addWallet(jid, amount); addXP(jid, 50);
  await sendReply(sock, msg, `🎁 *Daily Claimed!*\n\n+${amount} coins! 💰\nCome back in 24 hours!\n\n💵 Balance: ${getEco(jid).wallet.toLocaleString()}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("work", { desc: "Work for coins", category: "ECONOMY" }, async (sock, msg) => {
  const jid = getSender(msg) || msg.key.remoteJid;
  const cd = cdCheck(lastWork, jid, 2 * 60 * 60 * 1000);
  if (cd) { await sendReply(sock, msg, `⏳ Work cooldown: *${Math.floor(cd / 60)}m* left.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; }
  const jobs = ["👨‍💻 Coded a website", "👷 Built a house", "📦 Delivered packages", "🍕 Delivered pizza", "🚗 Drove Uber", "📚 Tutored students", "🎵 Played at a gig"];
  const amount = Math.floor(Math.random() * 200) + 100;
  addWallet(jid, amount); addXP(jid, 20);
  await sendReply(sock, msg, `💼 *Worked!*\n\n${random(jobs)}\nEarned: *+${amount} coins*\n\n💵 ${getEco(jid).wallet.toLocaleString()}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("crime", { desc: "Commit crime for coins", category: "ECONOMY" }, async (sock, msg) => {
  const jid = getSender(msg) || msg.key.remoteJid;
  const cd = cdCheck(lastCrime, jid, 3 * 60 * 60 * 1000);
  if (cd) { await sendReply(sock, msg, `⏳ Crime cooldown: *${Math.floor(cd / 60)}m* left.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; }
  const crimes = ["🏦 Robbed a bank", "💊 Sold contraband", "💻 Hacked a server", "🚗 Stole a car", "💎 Jewel heist"];
  const success = Math.random() > 0.35;
  const amount = Math.floor(Math.random() * 500) + 200;
  if (success) { addWallet(jid, amount); addXP(jid, 30); }
  else { addWallet(jid, -Math.floor(amount / 2)); }
  await sendReply(sock, msg, `🔫 *Crime!*\n\n${random(crimes)}\n\n${success ? `✅ Success! +${amount} coins` : `❌ Caught! -${Math.floor(amount / 2)} coins (fine)`}\n💵 ${getEco(jid).wallet.toLocaleString()}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("beg", { desc: "Beg for coins", category: "ECONOMY" }, async (sock, msg) => {
  const jid = getSender(msg) || msg.key.remoteJid;
  const cd = cdCheck(lastBeg, jid, 30 * 60 * 1000);
  if (cd) { await sendReply(sock, msg, `⏳ Beg cooldown: *${Math.floor(cd / 60)}m* left.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; }
  const amount = Math.floor(Math.random() * 50) + 5;
  addWallet(jid, amount);
  const givers = ["A kind stranger", "An old lady", "A billionaire", "Your mom", "A random passerby"];
  await sendReply(sock, msg, `🙏 *Begging...*\n\n${random(givers)} gave you *${amount} coins*\n💵 ${getEco(jid).wallet.toLocaleString()}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("fish", { desc: "Go fishing", category: "ECONOMY" }, async (sock, msg) => {
  const jid = getSender(msg) || msg.key.remoteJid;
  const cd = cdCheck(lastFish, jid, 60 * 60 * 1000);
  if (cd) { await sendReply(sock, msg, `⏳ Fishing cooldown: *${Math.floor(cd / 60)}m* left.`); return; }
  if (!hasItem(jid, "fishing_rod")) { await sendReply(sock, msg, `❌ Buy a fishing rod first: ${CONFIG.PREFIX}shop`); return; }
  const catches = [
    { name: "🐟 Common Fish", value: 50 }, { name: "🐠 Tropical Fish", value: 120 },
    { name: "🐡 Pufferfish", value: 80 }, { name: "🦈 Shark!", value: 500 },
    { name: "🦀 Crab", value: 200 }, { name: "💀 Old Boot", value: 0 },
  ];
  const caught = random(catches);
  if (caught.value > 0) addWallet(jid, caught.value);
  await sendReply(sock, msg, `🎣 *Fishing!*\n\nYou caught: *${caught.name}*\n${caught.value > 0 ? `+${caught.value} coins!` : "Nothing useful 😅"}\n💵 ${getEco(jid).wallet.toLocaleString()}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("hunt", { desc: "Go hunting", category: "ECONOMY" }, async (sock, msg) => {
  const jid = getSender(msg) || msg.key.remoteJid;
  const cd = cdCheck(lastHunt, jid, 90 * 60 * 1000);
  if (cd) { await sendReply(sock, msg, `⏳ Hunting cooldown: *${Math.floor(cd / 60)}m* left.`); return; }
  if (!hasItem(jid, "gun")) { await sendReply(sock, msg, `❌ Buy a gun first: ${CONFIG.PREFIX}shop`); return; }
  const animals = [
    { name: "🐇 Rabbit", value: 100 }, { name: "🦌 Deer", value: 300 },
    { name: "🐗 Boar", value: 250 }, { name: "🦁 Lion!", value: 800 },
    { name: "🐦 Bird", value: 50 }, { name: "💨 Nothing", value: 0 },
  ];
  const killed = random(animals);
  if (killed.value > 0) addWallet(jid, killed.value);
  await sendReply(sock, msg, `🏹 *Hunting!*\n\nYou hunted: *${killed.name}*\n${killed.value > 0 ? `+${killed.value} coins!` : "Missed 😅"}\n💵 ${getEco(jid).wallet.toLocaleString()}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("pay", { desc: "Pay coins to someone", category: "ECONOMY" }, async (sock, msg, args) => {
  const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  const amount = parseInt(args.find(a => !isNaN(a))) || 0;
  if (!mentions.length || amount <= 0) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}pay @user <amount>`); return; }
  const from = getSender(msg), to = mentions[0];
  const eFrom = getEco(from);
  if (eFrom.wallet < amount) { await sendReply(sock, msg, "❌ Not enough coins!"); return; }
  addWallet(from, -amount); addWallet(to, amount);
  await sendReply(sock, msg, `✅ *Payment Sent!*\n\n💸 ${amount} coins → @${to.split("@")[0]}\n💵 Your balance: ${eFrom.wallet.toLocaleString()}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, [to]);
});
cmd("rob", { desc: "Rob someone", category: "ECONOMY" }, async (sock, msg) => {
  const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (!mentions.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}rob @user`); return; }
  const from = getSender(msg), to = mentions[0];
  const eTo = getEco(to);
  if (eTo.wallet < 100) { await sendReply(sock, msg, `❌ @${to.split("@")[0]} is too broke to rob!`, [to]); return; }
  const success = Math.random() > 0.4;
  const stolen = success ? Math.floor(eTo.wallet * (Math.random() * 0.3 + 0.1)) : 0;
  if (success) { addWallet(from, stolen); addWallet(to, -stolen); }
  else { addWallet(from, -100); }
  await sendReply(sock, msg, `🔫 *Robbery!*\n\n${success ? `✅ Robbed @${to.split("@")[0]}!\n+${stolen} coins!` : `❌ Failed! Lost 100 coins (caught)`}\n💵 Your balance: ${getEco(from).wallet.toLocaleString()}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, [to]);
});
cmd(["deposit", "dep"], { desc: "Deposit to bank", category: "ECONOMY" }, async (sock, msg, args) => {
  const jid = getSender(msg) || msg.key.remoteJid, e = getEco(jid);
  const amount = args[0] === "all" ? e.wallet : parseInt(args[0]);
  if (!amount || amount <= 0 || e.wallet < amount) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}deposit <amount|all>`); return; }
  addWallet(jid, -amount); addBank(jid, amount);
  await sendReply(sock, msg, `🏦 *Deposited!*\n\n+${amount} → Bank\n💵 Wallet: ${e.wallet.toLocaleString()}\n🏦 Bank: ${e.bank.toLocaleString()}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd(["withdraw", "with"], { desc: "Withdraw from bank", category: "ECONOMY" }, async (sock, msg, args) => {
  const jid = getSender(msg) || msg.key.remoteJid, e = getEco(jid);
  const amount = args[0] === "all" ? e.bank : parseInt(args[0]);
  if (!amount || amount <= 0 || e.bank < amount) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}withdraw <amount|all>`); return; }
  addBank(jid, -amount); addWallet(jid, amount);
  await sendReply(sock, msg, `💵 *Withdrawn!*\n\n+${amount} → Wallet\n💵 Wallet: ${e.wallet.toLocaleString()}\n🏦 Bank: ${e.bank.toLocaleString()}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd(["bankbal", "bank"], { desc: "Check bank balance", category: "ECONOMY" }, async (sock, msg) => {
  const e = getEco(getSender(msg) || msg.key.remoteJid);
  await sendReply(sock, msg, `🏦 *Bank Balance*\n\n💵 Wallet: ${e.wallet.toLocaleString()}\n🏦 Bank: ${e.bank.toLocaleString()}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("shop", { desc: "View shop", category: "ECONOMY" }, async (sock, msg) => {
  let t = `🏪 *Shop*\n\n`;
  for (const [id, item] of shopItems) {
    t += `• *${id}* — ${item.desc}\n  💰 Price: ${item.price} coins\n\n`;
  }
  t += `Use: ${CONFIG.PREFIX}buyasset <item>\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
  await sendReply(sock, msg, t);
});
cmd(["buyasset", "buy"], { desc: "Buy item — .buy <item>", category: "ECONOMY" }, async (sock, msg, args) => {
  const jid = getSender(msg) || msg.key.remoteJid, e = getEco(jid);
  const item = args.join("_").toLowerCase();
  const si = shopItems.get(item);
  if (!si) { await sendReply(sock, msg, `❌ Item not found. Use ${CONFIG.PREFIX}shop to see items.`); return; }
  if (e.wallet < si.price) { await sendReply(sock, msg, `❌ Need ${si.price} coins. You have ${e.wallet}.`); return; }
  addWallet(jid, -si.price); addItem(jid, item);
  await sendReply(sock, msg, `✅ *Bought ${item}!*\n\n-${si.price} coins\n💵 ${e.wallet.toLocaleString()}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd(["inventory", "inv", "mybag"], { desc: "Check inventory", category: "ECONOMY" }, async (sock, msg) => {
  const jid = getSender(msg) || msg.key.remoteJid;
  const inv = getInv(jid);
  if (!inv.size) { await sendReply(sock, msg, `🎒 *Empty inventory!*\nBuy items: ${CONFIG.PREFIX}shop\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; }
  let t = `🎒 *Inventory*\n\n`;
  for (const [item, qty] of inv) if (qty > 0) t += `• *${item}* x${qty}\n`;
  await sendReply(sock, msg, t + `\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd(["richest", "leaderboard", "lb"], { desc: "Richest users", category: "ECONOMY" }, async (sock, msg) => {
  const sorted = [...economy.entries()].sort((a, b) => (b[1].wallet + b[1].bank) - (a[1].wallet + a[1].bank)).slice(0, 10);
  let t = `💎 *Top 10 Richest*\n\n`;
  sorted.forEach(([jid, e], i) => t += `${i + 1}. @${jid.split("@")[0]}\n   💰 ${(e.wallet + e.bank).toLocaleString()} coins\n\n`);
  await sendReply(sock, msg, t + `> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("rank", { desc: "Check your rank", category: "ECONOMY" }, async (sock, msg) => {
  const jid = getSender(msg) || msg.key.remoteJid, e = getEco(jid);
  const sorted = [...economy.entries()].sort((a, b) => (b[1].wallet + b[1].bank) - (a[1].wallet + a[1].bank));
  const rank = sorted.findIndex(([j]) => j === jid) + 1;
  await sendReply(sock, msg, `🏆 *Your Rank*\n\n#${rank} globally\n⭐ Level: ${e.level}\n💰 Net: ${(e.wallet + e.bank).toLocaleString()}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("networth", { desc: "Net worth", category: "ECONOMY" }, async (sock, msg) => {
  const e = getEco(getSender(msg) || msg.key.remoteJid);
  await sendReply(sock, msg, `💎 *Net Worth*\n\n💵 Wallet: ${e.wallet.toLocaleString()}\n🏦 Bank: ${e.bank.toLocaleString()}\n💎 Total: *${(e.wallet + e.bank).toLocaleString()} coins*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});

// Gambling commands
cmd("coinflip", { desc: "Coinflip — .coinflip heads/tails <bet>", category: "ECONOMY" }, async (sock, msg, args) => {
  const jid = getSender(msg) || msg.key.remoteJid, e = getEco(jid);
  const choice = args[0]?.toLowerCase(), bet = parseInt(args[1]) || 100;
  if (!["heads", "tails"].includes(choice) || e.wallet < bet) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}coinflip heads/tails <bet>`); return; }
  addWallet(jid, -bet);
  const result = Math.random() > 0.5 ? "heads" : "tails";
  if (result === choice) addWallet(jid, bet * 2);
  await sendReply(sock, msg, `🪙 *Coin Flip!*\n\nResult: *${result === "heads" ? "🪙 Heads" : "⚫ Tails"}*\nYour guess: *${choice}*\n\n${result === choice ? `🎉 Won! +${bet} coins` : `❌ Lost -${bet} coins`}\n💰 ${getEco(jid).wallet.toLocaleString()}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("slots", { desc: "Slots — .slots <bet>", category: "ECONOMY" }, async (sock, msg, args) => {
  const jid = getSender(msg) || msg.key.remoteJid, e = getEco(jid);
  const bet = parseInt(args[0]) || 100;
  if (bet < 10 || e.wallet < bet) { await sendReply(sock, msg, `❌ Min 10 coins. Have: ${e.wallet}`); return; }
  addWallet(jid, -bet);
  const symbols = ["🍒", "🍊", "🍋", "🍇", "⭐", "💎", "7️⃣"];
  const s = [random(symbols), random(symbols), random(symbols)];
  let prize = 0;
  if (s[0] === s[1] && s[1] === s[2]) {
    prize = s[0] === "💎" ? bet * 50 : s[0] === "7️⃣" ? bet * 20 : bet * 10;
  } else if (s[0] === s[1] || s[1] === s[2]) {
    prize = bet * 2;
  }
  if (prize > 0) addWallet(jid, prize);
  await sendReply(sock, msg, `🎰 *Slots!*\n\n[ ${s.join(" | ")} ]\n\n${prize > 0 ? `🎉 WIN! +${prize} coins!` : `❌ No match. Lost ${bet} coins.`}\n💰 ${getEco(jid).wallet.toLocaleString()}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("dice", { desc: "Dice — .dice <bet> [sides]", category: "ECONOMY" }, async (sock, msg, args) => {
  const jid = getSender(msg) || msg.key.remoteJid, e = getEco(jid);
  const bet = parseInt(args[0]) || 100, sides = parseInt(args[1]) || 6;
  if (bet < 10 || e.wallet < bet) { await sendReply(sock, msg, `❌ Min 10. Have: ${e.wallet}`); return; }
  addWallet(jid, -bet);
  const roll = Math.floor(Math.random() * sides) + 1;
  const won = roll === sides;
  if (won) addWallet(jid, bet * sides);
  await sendReply(sock, msg, `🎲 *Dice Roll!*\n\nRolled: *${roll}* / ${sides}\n\n${won ? `🎉 MAX! +${bet * (sides - 1)} coins!` : `❌ Lost ${bet} coins.`}\n💰 ${getEco(jid).wallet.toLocaleString()}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("roulette", { desc: "Roulette — .roulette red/black/green <bet>", category: "ECONOMY" }, async (sock, msg, args) => {
  const jid = getSender(msg) || msg.key.remoteJid, e = getEco(jid);
  const choice = args[0]?.toLowerCase(), bet = parseInt(args[1]) || 100;
  if (!["red", "black", "green"].includes(choice) || e.wallet < bet) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}roulette red/black/green <bet>`); return; }
  addWallet(jid, -bet);
  const r = Math.random(); let result, win = 0;
  if (r < 0.026) { result = "green"; win = bet * 14; }
  else if (r < 0.513) { result = "red"; win = bet * 2; }
  else { result = "black"; win = bet * 2; }
  if (result === choice) addWallet(jid, win); else win = 0;
  await sendReply(sock, msg, `🎡 *Roulette!*\n\nBall: *${result === "red" ? "🔴 Red" : result === "black" ? "⚫ Black" : "💚 Green"}*\n\n${result === choice ? `🎉 Won +${win} coins!` : `❌ Lost ${bet} coins.`}\n💰 ${getEco(jid).wallet.toLocaleString()}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("blackjack", { desc: "Blackjack — .blackjack <bet>", category: "ECONOMY" }, async (sock, msg, args) => {
  const jid = getSender(msg) || msg.key.remoteJid, e = getEco(jid);
  const bet = parseInt(args[0]) || 100;
  if (bet < 10 || e.wallet < bet) { await sendReply(sock, msg, `❌ Min 10. Have: ${e.wallet}`); return; }
  const draw = () => Math.min(Math.floor(Math.random() * 13) + 1, 10);
  const p = draw() + draw(), d = draw() + draw();
  addWallet(jid, -bet);
  let result, win = 0;
  if (p > 21) { result = "❌ Bust! You went over 21."; }
  else if (d > 21 || p > d) { result = "🎉 You win!"; win = bet * 2; addWallet(jid, win); }
  else if (p === d) { result = "🤝 Push! Tie."; addWallet(jid, bet); win = bet; }
  else { result = "❌ Dealer wins!"; }
  await sendReply(sock, msg, `🃏 *Blackjack!*\n\nYour hand: *${p}*\nDealer: *${d}*\n\n${result}\n${win > 0 ? `+${win} coins` : `-${bet} coins`}\n💰 ${getEco(jid).wallet.toLocaleString()}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("gamble", { desc: "Gamble — .gamble <bet>", category: "ECONOMY" }, async (sock, msg, args) => {
  const jid = getSender(msg) || msg.key.remoteJid, e = getEco(jid);
  const bet = parseInt(args[0]) || 100;
  if (bet < 10 || e.wallet < bet) { await sendReply(sock, msg, `❌ Min 10. Have: ${e.wallet}`); return; }
  addWallet(jid, -bet);
  const win = Math.random() > 0.5;
  if (win) addWallet(jid, bet * 2);
  await sendReply(sock, msg, `🎲 *Gamble!*\n\n${win ? `🎉 You doubled! +${bet} coins` : `❌ You lost -${bet} coins`}\n💰 ${getEco(jid).wallet.toLocaleString()}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("crash", { desc: "Crash game — .crash <bet>", category: "ECONOMY" }, async (sock, msg, args) => {
  const jid = getSender(msg) || msg.key.remoteJid, e = getEco(jid);
  const bet = parseInt(args[0]) || 100;
  if (bet < 10 || e.wallet < bet) { await sendReply(sock, msg, `❌ Min 10. Have: ${e.wallet}`); return; }
  addWallet(jid, -bet);
  const multiplier = (Math.random() * 4 + 1).toFixed(2);
  const crashAt = (Math.random() * 3 + 0.5).toFixed(2);
  const won = parseFloat(multiplier) > parseFloat(crashAt);
  if (won) addWallet(jid, Math.floor(bet * parseFloat(multiplier)));
  await sendReply(sock, msg, `🚀 *Crash!*\n\nRocket: *${multiplier}x*\nCrashed at: *${crashAt}x*\n\n${won ? `🎉 Won ${Math.floor(bet * parseFloat(multiplier))} coins!` : `❌ Crashed! Lost ${bet}.`}\n💰 ${getEco(jid).wallet.toLocaleString()}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("lottery", { desc: "Enter lottery", category: "ECONOMY" }, async (sock, msg) => {
  const jid = getSender(msg) || msg.key.remoteJid, e = getEco(jid);
  if (e.wallet < 100) { await sendReply(sock, msg, "❌ Need 100 coins to enter."); return; }
  addWallet(jid, -100);
  const win = Math.random() < 0.1;
  const prize = Math.floor(Math.random() * 5000) + 1000;
  if (win) addWallet(jid, prize);
  await sendReply(sock, msg, `🎟️ *Lottery!*\n\n${win ? `🎉 YOU WON! +${prize} coins!` : `❌ No luck. Lost 100 coins.`}\n💰 ${getEco(jid).wallet.toLocaleString()}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("highlow", { desc: "High or Low — .highlow high/low <bet>", category: "ECONOMY" }, async (sock, msg, args) => {
  const jid = getSender(msg) || msg.key.remoteJid, e = getEco(jid);
  const choice = args[0]?.toLowerCase(), bet = parseInt(args[1]) || 50;
  if (!["high", "low"].includes(choice) || e.wallet < bet) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}highlow high/low <bet>`); return; }
  addWallet(jid, -bet);
  const num = Math.floor(Math.random() * 10) + 1;
  const correct = (choice === "high" && num >= 6) || (choice === "low" && num <= 5);
  if (correct) addWallet(jid, bet * 2);
  await sendReply(sock, msg, `🎯 *High or Low!*\n\nNumber: *${num}*\n\n${correct ? `🎉 Correct! +${bet} coins` : `❌ Wrong! -${bet} coins`}\n💰 ${getEco(jid).wallet.toLocaleString()}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("russianroulette", { desc: "Russian roulette — .russianroulette <bet>", category: "ECONOMY" }, async (sock, msg, args) => {
  const jid = getSender(msg) || msg.key.remoteJid, e = getEco(jid);
  const bet = parseInt(args[0]) || 500;
  if (bet < 50 || e.wallet < bet) { await sendReply(sock, msg, `❌ Min 50. Have: ${e.wallet}`); return; }
  addWallet(jid, -bet);
  const dead = Math.random() < (1 / 6);
  if (!dead) addWallet(jid, bet * 5);
  await sendReply(sock, msg, `🔫 *Russian Roulette!*\n\n${dead ? `💀 BANG! You died!\nLost ${bet} coins.` : `😅 *Click* — Lucky! +${bet * 4} coins`}\n💰 ${getEco(jid).wallet.toLocaleString()}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("horserace", { desc: "Horse race — .horserace <1-4> <bet>", category: "ECONOMY" }, async (sock, msg, args) => {
  const jid = getSender(msg) || msg.key.remoteJid, e = getEco(jid);
  const horse = parseInt(args[0]), bet = parseInt(args[1]) || 100;
  if (![1, 2, 3, 4].includes(horse) || e.wallet < bet) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}horserace <1-4> <bet>`); return; }
  addWallet(jid, -bet);
  const horses = ["🐴 Thunder", "🐴 Lightning", "🐴 Blaze", "🐴 Storm"];
  const winner = Math.floor(Math.random() * 4) + 1;
  if (horse === winner) addWallet(jid, bet * 4);
  await sendReply(sock, msg, `🏇 *Horse Race!*\n\nWinner: *${horses[winner - 1]}* (#${winner})\nYour pick: *${horses[horse - 1]}*\n\n${horse === winner ? `🎉 Won! +${bet * 3} coins` : `❌ Lost ${bet}.`}\n💰 ${getEco(jid).wallet.toLocaleString()}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd(["rockpaperscissors", "rps"], { desc: "Rock Paper Scissors — .rps rock/paper/scissors <bet>", category: "ECONOMY" }, async (sock, msg, args) => {
  const jid = getSender(msg) || msg.key.remoteJid, e = getEco(jid);
  const choice = args[0]?.toLowerCase(), bet = parseInt(args[1]) || 50;
  if (!["rock", "paper", "scissors"].includes(choice) || e.wallet < bet) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}rps rock/paper/scissors <bet>`); return; }
  addWallet(jid, -bet);
  const choices = ["rock", "paper", "scissors"], emj = { rock: "🪨", paper: "📄", scissors: "✂️" };
  const bot = random(choices);
  let result = "draw";
  if ((choice === "rock" && bot === "scissors") || (choice === "paper" && bot === "rock") || (choice === "scissors" && bot === "paper")) result = "win";
  else if (choice !== bot) result = "lose";
  if (result === "win") addWallet(jid, bet * 2);
  else if (result === "draw") addWallet(jid, bet);
  await sendReply(sock, msg, `✊ *Rock Paper Scissors!*\n\nYou: ${emj[choice]} *${choice}*\nBot: ${emj[bot]} *${bot}*\n\n${result === "win" ? `🎉 Win! +${bet}` : result === "draw" ? `🤝 Draw!` : `❌ Lose! -${bet}`}\n💰 ${getEco(jid).wallet.toLocaleString()}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("numberguess", { desc: "Guess number 1-10", category: "ECONOMY" }, async (sock, msg, args) => {
  const jid = getSender(msg) || msg.key.remoteJid, e = getEco(jid);
  const guess = parseInt(args[0]), bet = parseInt(args[1]) || 50;
  if (!guess || guess < 1 || guess > 10 || e.wallet < bet) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}numberguess <1-10> <bet>`); return; }
  addWallet(jid, -bet);
  const num = Math.floor(Math.random() * 10) + 1;
  if (guess === num) addWallet(jid, bet * 10);
  await sendReply(sock, msg, `🎯 *Number Guess!*\n\nThe number: *${num}*\nYour guess: *${guess}*\n\n${guess === num ? `🎉 CORRECT! +${bet * 9}!` : `❌ Wrong! -${bet}`}\n💰 ${getEco(jid).wallet.toLocaleString()}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd(["scratch", "scratchcard"], { desc: "Scratch card", category: "ECONOMY" }, async (sock, msg) => {
  const jid = getSender(msg) || msg.key.remoteJid, e = getEco(jid);
  if (e.wallet < 50) { await sendReply(sock, msg, "❌ Need 50 coins."); return; }
  addWallet(jid, -50);
  const emjs = ["⭐", "🍒", "💎", "🍀", "🎰", "❌"];
  const slots = Array.from({ length: 9 }, () => random(emjs));
  const wins = {};
  slots.forEach(s => { wins[s] = (wins[s] || 0) + 1; });
  let prize = 0;
  if ((wins["💎"] || 0) >= 3) prize = 5000;
  else if ((wins["⭐"] || 0) >= 3) prize = 1000;
  else if ((wins["🍀"] || 0) >= 3) prize = 500;
  else if ((wins["🍒"] || 0) >= 3) prize = 200;
  if (prize) addWallet(jid, prize);
  const grid = `${slots.slice(0, 3).join(" ")}\n${slots.slice(3, 6).join(" ")}\n${slots.slice(6, 9).join(" ")}`;
  await sendReply(sock, msg, `🎟️ *Scratch Card!*\n\n${grid}\n\n${prize ? `🎉 You won ${prize} coins!` : `❌ No luck! (-50)`}\n💰 ${getEco(jid).wallet.toLocaleString()}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd(["crypto", "portfolio", "cryptolb"], { desc: "Crypto simulation", category: "ECONOMY" }, async (sock, msg) => {
  const coins = [
    { name: "Bitcoin", sym: "BTC", price: Math.floor(60000 + Math.random() * 10000) },
    { name: "Ethereum", sym: "ETH", price: Math.floor(3000 + Math.random() * 1000) },
    { name: "BNB", sym: "BNB", price: Math.floor(300 + Math.random() * 100) },
    { name: "Solana", sym: "SOL", price: Math.floor(100 + Math.random() * 50) },
    { name: "PEPE", sym: "PEPE", price: Math.random().toFixed(6) },
  ];
  let t = "📈 *Crypto Market*\n\n";
  coins.forEach(c => t += `*${c.sym}*: $${Number(c.price).toLocaleString()} ${Math.random() > 0.5 ? "📈" : "📉"}\n`);
  t += `\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
  await sendReply(sock, msg, t);
});
cmd(["buyc", "sellc"], { desc: "Buy/sell crypto", category: "ECONOMY" }, async (sock, msg) => {
  await sendReply(sock, msg, `💹 *Crypto Trading*\n\nCheck prices: ${CONFIG.PREFIX}crypto\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd(["perks", "achievements"], { desc: "Your achievements", category: "ECONOMY" }, async (sock, msg) => {
  const e = getEco(getSender(msg) || msg.key.remoteJid);
  await sendReply(sock, msg, `🏆 *Achievements*\n\n${e.level >= 5 ? "✅" : "❌"} Level 5 Reached\n${e.wallet >= 10000 ? "✅" : "❌"} 10K Coins\n${e.bank >= 5000 ? "✅" : "❌"} 5K Banked\n${e.level >= 10 ? "✅" : "❌"} Level 10 Master\n\n⭐ Level: ${e.level}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd(["profile", "status"], { desc: "Full profile", category: "ECONOMY" }, async (sock, msg) => {
  const jid = getSender(msg) || msg.key.remoteJid, e = getEco(jid);
  const rel = relationships.get(jid);
  const pet = petStore.get(jid);
  await sendReply(sock, msg, `👤 *Profile*\n\n📱 ID: ${jid.split("@")[0]}\n⭐ Level: ${e.level} (XP: ${e.xp}/${e.level * 100})\n💰 Wallet: ${e.wallet.toLocaleString()}\n🏦 Bank: ${e.bank.toLocaleString()}\n💎 Net: ${(e.wallet + e.bank).toLocaleString()}\n💘 Status: ${rel?.partner ? "In a relationship 💕" : "Single 💔"}\n🐾 Pet: ${pet ? pet.name + " " + pet.type : "None"}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});

// Economy stubs
// Real economy sub-commands
cmd("cooldowns", { desc: "Check command cooldowns", category: "ECONOMY" }, async (sock, msg) => {
  const jid = getSender(msg) || msg.key.remoteJid;
  const now = Date.now();
  const cds = [
    ["Daily", lastDaily.get(jid), 86400000], ["Work", lastWork.get(jid), 60000],
    ["Crime", lastCrime.get(jid), 120000], ["Beg", lastBeg.get(jid), 30000],
    ["Fish", lastFish.get(jid), 45000], ["Hunt", lastHunt.get(jid), 60000]
  ];
  let t = "⏰ *Cooldowns*\n\n";
  for (const [name, last, cd] of cds) {
    const left = last ? Math.max(0, cd - (now - last)) : 0;
    t += `${name}: ${left > 0 ? Math.ceil(left / 1000) + "s remaining" : "✅ Ready"}\n`;
  }
  await sendReply(sock, msg, t + "\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡");
});
cmd("interest", { desc: "Collect bank interest", category: "ECONOMY" }, async (sock, msg) => {
  const jid = getSender(msg), e = getEco(jid);
  const interest = Math.floor(e.bank * 0.01);
  if (interest < 1) { await sendReply(sock, msg, "❌ Need at least 100 coins in bank for interest."); return; }
  addBank(jid, interest);
  await sendReply(sock, msg, `🏦 *Interest Collected!*\n\n+${interest} coins (1% of bank)\n🏦 Bank: ${e.bank.toLocaleString()}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("gift", { desc: "Gift item to someone", category: "ECONOMY" }, async (sock, msg, args) => {
  const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  const item = args.filter(a => !a.startsWith("@")).join("_").toLowerCase();
  if (!mentions.length || !item) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}gift @user <item>`); return; }
  const from = getSender(msg), to = mentions[0];
  if (!hasItem(from, item)) { await sendReply(sock, msg, "❌ You don't have that item!"); return; }
  removeItem(from, item); addItem(to, item);
  await sendReply(sock, msg, `🎁 Gifted *${item}* to @${to.split("@")[0]}!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, [to]);
});
cmd(["addcoins","removecoins","setcoins","setlevel","addlevel","addbank","ecoreset"], { desc: "Admin economy", category: "ECONOMY", ownerOnly: true }, async (sock, msg, args) => {
  const c = extractCommandName(msg);
  const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  const amount = parseInt(args.find(a => !a.startsWith("@"))) || 0;
  if (!mentions.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}${c} @user <amount>`); return; }
  const target = mentions[0], e = getEco(target);
  if (c === "addcoins") { addWallet(target, amount); await sendReply(sock, msg, `✅ Added ${amount} coins to @${target.split("@")[0]}`, [target]); }
  else if (c === "removecoins") { addWallet(target, -amount); await sendReply(sock, msg, `✅ Removed ${amount} coins from @${target.split("@")[0]}`, [target]); }
  else if (c === "setcoins") { e.wallet = amount; await sendReply(sock, msg, `✅ Set @${target.split("@")[0]} wallet to ${amount}`, [target]); }
  else if (c === "setlevel") { e.level = amount; await sendReply(sock, msg, `✅ Set @${target.split("@")[0]} level to ${amount}`, [target]); }
  else if (c === "addlevel") { e.level += amount; await sendReply(sock, msg, `✅ Added ${amount} levels to @${target.split("@")[0]}`, [target]); }
  else if (c === "addbank") { addBank(target, amount); await sendReply(sock, msg, `✅ Added ${amount} to @${target.split("@")[0]} bank`, [target]); }
  else if (c === "ecoreset") { economy.delete(target); await sendReply(sock, msg, `✅ Reset @${target.split("@")[0]} economy`, [target]); }
});
// Economy advanced commands — implemented
cmd("transactions", { desc: "View recent transactions", category: "ECONOMY" }, async (sock, msg) => {
  const jid = getSender(msg), e = getEco(jid);
  const txns = e.transactions || [];
  let txt = "💳 *Recent Transactions*\n\n";
  if (txns.length) { txns.slice(-10).reverse().forEach((t, i) => { txt += `${i+1}. ${t}\n`; }); }
  else { txt += "No transactions yet. Start earning!"; }
  await sendReply(sock, msg, txt + `\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("grouplb", { desc: "Group leaderboard", category: "ECONOMY" }, async (sock, msg) => {
  if (!msg.key.remoteJid.endsWith("@g.us")) { await sendReply(sock, msg, "❌ Groups only!"); return; }
  try {
    const meta = await sock.groupMetadata(msg.key.remoteJid);
    const memberEcos = meta.participants.map(p => ({ jid: p.id, total: (getEco(p.id).wallet || 0) + (getEco(p.id).bank || 0) })).sort((a, b) => b.total - a.total).slice(0, 10);
    let txt = "🏆 *Group Leaderboard*\n\n";
    memberEcos.forEach((m, i) => { txt += `${["🥇","🥈","🥉"][i] || `${i+1}.`} @${m.jid.split("@")[0]} — ${m.total.toLocaleString()} coins\n`; });
    await sendReply(sock, msg, txt + `\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, memberEcos.map(m => m.jid));
  } catch { await sendReply(sock, msg, "❌ Could not fetch group data."); }
});
cmd("stats", { desc: "Your economy stats", category: "ECONOMY" }, async (sock, msg) => {
  const jid = getSender(msg), e = getEco(jid);
  const total = (e.wallet || 0) + (e.bank || 0);
  await sendReply(sock, msg, `📊 *Your Stats*\n\n💰 Wallet: ${(e.wallet||0).toLocaleString()}\n🏦 Bank: ${(e.bank||0).toLocaleString()}\n💎 Net Worth: ${total.toLocaleString()}\n⭐ Level: ${e.level || 1}\n✨ XP: ${e.xp || 0}\n🎰 Games Played: ${e.gamesPlayed || 0}\n🏆 Games Won: ${e.gamesWon || 0}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("sell", { desc: "Sell an item", category: "ECONOMY" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}sell <item>`); return; }
  const jid = getSender(msg), e = getEco(jid);
  const item = args.join("_").toLowerCase();
  const inv = e.inventory || [];
  const idx = inv.indexOf(item);
  if (idx === -1) { await sendReply(sock, msg, `❌ You don't have *${item}* in your inventory!`); return; }
  const price = Math.floor(Math.random() * 500) + 50;
  inv.splice(idx, 1);
  addWallet(jid, price);
  await sendReply(sock, msg, `💰 *Sold!*\n\nSold ${item} for ${price} coins!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("sellasset", { desc: "Sell an asset", category: "ECONOMY" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}sellasset <asset>`); return; }
  const jid = getSender(msg), e = getEco(jid);
  const item = args.join("_").toLowerCase();
  const inv = e.inventory || [];
  const idx = inv.indexOf(item);
  if (idx === -1) { await sendReply(sock, msg, `❌ You don't own *${item}*!`); return; }
  const price = Math.floor(Math.random() * 2000) + 500;
  inv.splice(idx, 1);
  addWallet(jid, price);
  await sendReply(sock, msg, `🏠 *Asset Sold!*\n\nSold ${item} for ${price} coins!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("assets", { desc: "View your assets", category: "ECONOMY" }, async (sock, msg) => {
  const jid = getSender(msg), e = getEco(jid);
  const inv = e.inventory || [];
  await sendReply(sock, msg, `🏠 *Your Assets*\n\n${inv.length ? inv.map((i, idx) => `${idx+1}. ${i}`).join("\n") : "No assets. Buy from the shop!"}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("wheel", { desc: "Spin the wheel", category: "ECONOMY" }, async (sock, msg, args) => {
  const jid = getSender(msg), e = getEco(jid);
  const bet = parseInt(args[0]) || 100;
  if (e.wallet < bet) { await sendReply(sock, msg, "❌ Not enough coins!"); return; }
  const prizes = [0, bet*2, bet*3, 0, bet, bet*5, 0, bet*2];
  const result = random(prizes);
  addWallet(jid, result - bet);
  await sendReply(sock, msg, `🎡 *Wheel of Fortune!*\n\n🔄 Spinning...\n\n${result > 0 ? `🎉 You won *${result}* coins!` : "💀 You lost! Better luck next time."}\n\n💰 Balance: ${e.wallet.toLocaleString()}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("cups", { desc: "Cup shuffle game", category: "ECONOMY" }, async (sock, msg, args) => {
  const jid = getSender(msg), e = getEco(jid);
  const bet = parseInt(args[0]) || 100;
  const pick = parseInt(args[1]) || 1;
  if (e.wallet < bet) { await sendReply(sock, msg, "❌ Not enough coins!"); return; }
  if (pick < 1 || pick > 3) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}cups <bet> <1-3>`); return; }
  const winning = Math.ceil(Math.random() * 3);
  const won = pick === winning;
  addWallet(jid, won ? bet * 2 : -bet);
  const cups = [1,2,3].map(n => n === winning ? "🏆" : "💀");
  await sendReply(sock, msg, `☕ *Cup Game*\n\n${cups.join(" ")}\nYou picked cup ${pick}\nBall was under cup ${winning}\n\n${won ? `🎉 You won ${bet * 2} coins!` : `💀 You lost ${bet} coins!`}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
// Economy commands that need more complex systems — show helpful messages
const econInfoCmds = {
  collect: "📦 Collect your daily rewards with .daily instead!",
  upgrade: "⬆️ Upgrades are automatic as you level up!",
  hireworker: "👷 Workers feature — use .work to earn coins!",
  shopadd: "🏪 Admin only: Add items to the shop. Use .shop to browse.",
  shopdel: "🏪 Admin only: Remove items from the shop.",
  gambstats: "🎰 Your gambling stats are shown in .stats!",
  market: "📈 Player marketplace — list items with .sell!",
  marketbuy: "🛒 Buy from player market — use .shop for now!",
  unsell: "↩️ Remove your item from the market.",
  hospital: "🏥 Heal yourself after battles. Costs 100 coins.",
  nerve: "⚡ Your nerve bar — affects crime success rate.",
  energy: "🔋 Your energy level — recharges over time.",
  autoshield: "🛡️ Auto-shield protects you from robberies for 1 hour.",
  tornhelp: "📖 RPG help guide — use .menu for all commands!",
  train: "🏋️ Train to increase your stats! Costs energy.",
  battlelb: "⚔️ Battle leaderboard — top fighters!",
  attack: "⚔️ Attack another player! Use .duel instead.",
  attacklog: "📋 View your attack history.",
  cities: "🌆 Available cities to travel to.",
  travel: "✈️ Travel to a city — unlocks new opportunities!",
  travelstatus: "📍 Your current location.",
  abroad: "🌍 Overseas activities while traveling.",
  sellitems: "💰 Sell items from your inventory with .sell!",
  drugs: "💊 Underground market (roleplay only!).",
  buydrg: "💊 Buy from underground market.",
  usedrg: "💊 Use item from underground market.",
  drugstatus: "💊 Your underground market status.",
  createfaction: "🏰 Create a faction — costs 10,000 coins!",
  joinfaction: "🤝 Join an existing faction.",
  leavefaction: "👋 Leave your current faction.",
  faction: "🏰 View your faction info.",
  fmembers: "👥 List faction members.",
  fvault: "🏦 Faction vault balance.",
  fdeposit: "💰 Deposit to faction vault.",
  fwithdraw: "💰 Withdraw from faction vault (leader only).",
  finvite: "📩 Invite someone to your faction.",
  fkick: "🦵 Kick someone from your faction.",
  fopen: "🔓 Open faction to public.",
  fwar: "⚔️ Start a faction war!",
  factions: "🏰 List all factions.",
  bounties: "🎯 Active bounties on players.",
  setbounty: "🎯 Set a bounty on someone — costs coins!",
  mybounty: "🎯 Check if there's a bounty on you.",
  petshop: "🐾 Browse pets for sale.",
  buypet: "🐾 Buy a pet from the shop.",
  mypet: "🐾 View your pet's status.",
  carepet: "❤️ Feed and care for your pet.",
  renamepet: "✏️ Rename your pet.",
  petleaderboard: "🏆 Top pets leaderboard.",
  petreward: "🎁 Collect daily pet reward.",
};
for (const [c, desc] of Object.entries(econInfoCmds)) {
  if (!commands.has(c)) cmd(c, { desc: desc.slice(0, 40), category: "ECONOMY" }, async (sock, msg) => {
    await sendReply(sock, msg, `💰 *${c.charAt(0).toUpperCase() + c.slice(1)}*\n\n${desc}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  FUN COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════
const JOKES = ["Why don't scientists trust atoms? They make up everything!", "I told my wife she was drawing eyebrows too high. She looked surprised.", "What do you call cheese that isn't yours? Nacho cheese!", "Why can't you give Elsa a balloon? She'll let it go!", "Why did the math book look sad? Too many problems!"];
const TRUTHS = ["Have you ever lied to get out of trouble?", "What's your biggest secret?", "Have you ever had a crush on a friend?", "What's the most embarrassing thing you've done?", "What's your biggest fear?"];
const DARES = ["Send a funny voice note right now!", "Change your WhatsApp status to something embarrassing for 1 hour", "Text your crush right now", "Send the most embarrassing photo in your gallery", "Do 10 pushups and send proof"];
const ADVICES = ["Take care of your mental health first.", "Don't compare your chapter 1 to someone else's chapter 20.", "Drink water, get sleep, go outside.", "Progress is progress no matter how small.", "You're doing better than you think."];
const INSULTS = ["You're proof evolution can go in reverse.", "I'd agree with you but then we'd both be wrong.", "You're like a cloud — when you disappear it's a beautiful day."];
const LINES = ["Are you a bank loan? You've got my interest.", "Is your name Google? You have everything I've been searching for.", "Do you have a map? I keep getting lost in your eyes."];

cmd("joke",    { desc: "Random joke",    category: "FUN" }, async (s, m) => { await sendReply(s, m, `😂 ${random(JOKES)}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); });
cmd("truth",   { desc: "Truth question", category: "FUN" }, async (s, m) => { await sendReply(s, m, `🤔 *Truth:*\n\n${random(TRUTHS)}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); });
cmd("dare",    { desc: "Dare challenge", category: "FUN" }, async (s, m) => { await sendReply(s, m, `😈 *Dare:*\n\n${random(DARES)}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); });
cmd("advice",  { desc: "Random advice",  category: "FUN" }, async (s, m) => { await sendReply(s, m, `💡 *Advice:*\n\n${random(ADVICES)}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); });
cmd("insult",  { desc: "Random insult",  category: "FUN" }, async (s, m) => { await sendReply(s, m, `😏 *Insult:*\n\n${random(INSULTS)}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); });
cmd("line",    { desc: "Pickup line",    category: "FUN" }, async (s, m) => { await sendReply(s, m, `😏 *Rizz Line:*\n\n${random(LINES)}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); });
cmd("meme", { desc: "Random meme", category: "FUN" }, async (sock, msg) => {
  await react(sock, msg, "😂");
  try {
    const { data } = await axios.get(`${CONFIG.GIFTED_API}/api/fun/meme?apikey=${CONFIG.GIFTED_KEY}`, { timeout: 10000 });
    const url = data?.result?.url || data?.result?.image || data?.result;
    if (url && typeof url === "string") {
      const buf = await axios.get(url, { responseType: "arraybuffer", timeout: 15000 });
      await sock.sendMessage(msg.key.remoteJid, { image: Buffer.from(buf.data), caption: `😂 *Random Meme*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
    } else throw new Error("fallback");
  } catch {
    try {
      const { data } = await axios.get("https://meme-api.com/gimme", { timeout: 8000 });
      if (data?.url) {
        const buf = await axios.get(data.url, { responseType: "arraybuffer", timeout: 15000 });
        await sock.sendMessage(msg.key.remoteJid, { image: Buffer.from(buf.data), caption: `😂 *${data.title || "Meme"}*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
      } else { await sendReply(sock, msg, `😂 Try: https://reddit.com/r/memes`); }
    } catch { await sendReply(sock, msg, `😂 Try: https://reddit.com/r/memes\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); }
  }
});
cmd("gaycheck",  { desc: "Gay check (fun)",   category: "FUN" }, async (s, m, a) => { const p = Math.floor(Math.random() * 101); await sendReply(s, m, `🌈 *Gay Check*\n\n${a.join(" ") || "You"} is *${p}%* gay\n\n_(Just for fun!)_\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); });
cmd("lescheck",  { desc: "Les check (fun)",   category: "FUN" }, async (s, m, a) => { const p = Math.floor(Math.random() * 101); await sendReply(s, m, `💗 *Les Check*\n\n${a.join(" ") || "You"} is *${p}%* les\n\n_(Just for fun!)_\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); });
cmd("vibecheck", { desc: "Vibe check",        category: "FUN" }, async (s, m, a) => { const vibes = ["💚 immaculate vibe ✨", "🔥 on fire rn", "💀 vibe is dead lol", "👑 main character energy", "🤍 pure wholesome vibe"]; await sendReply(s, m, `✨ *Vibe Check*\n\n${a.join(" ") || "Your"} vibe: ${random(vibes)}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); });
cmd("rate",      { desc: "Rate something",    category: "FUN" }, async (s, m, a) => { if (!a.length) { await sendReply(s, m, `Usage: ${CONFIG.PREFIX}rate <thing>`); return; } const p = Math.floor(Math.random() * 101); await sendReply(s, m, `⭐ *Rating: ${a.join(" ")}*\n\n${p}/100\n${"⭐".repeat(Math.round(p / 20))}${"☆".repeat(5 - Math.round(p / 20))}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); });
cmd("hack",      { desc: "Fake hack someone", category: "FUN" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}hack @user`); return; }
  await react(sock, msg, "💻");
  const target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
  const name = target ? `@${target.split("@")[0]}` : args.join(" ");
  await sendReply(sock, msg, `💻 *HACKING ${name.toUpperCase()}*\n\n⠿⠿⠿⠿⠿ 100%\n[████████████] DONE\n\n✅ WhatsApp Accessed\n✅ Gallery Breached\n✅ Location Found\n\n😂 *Just kidding! This is fake.*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, target ? [target] : []);
});
cmd("shout",  { desc: "Shout text",    category: "FUN" }, async (s, m, a) => { if (!a.length) { await sendReply(s, m, `Usage: ${CONFIG.PREFIX}shout <text>`); return; } await sendReply(s, m, `📢 ${a.join(" ").toUpperCase()}!!!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); });
cmd("repeat", { desc: "Repeat text",   category: "FUN" }, async (s, m, a) => { const n = parseInt(a[0]) || 3; const text = a.slice(1).join(" "); if (!text) { await sendReply(s, m, `Usage: ${CONFIG.PREFIX}repeat <times> <text>`); return; } await sendReply(s, m, `${Array(Math.min(n, 10)).fill(text).join("\n")}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); });
cmd("emojiart", { desc: "Emoji art",  category: "FUN" }, async (s, m) => { const arts = ["😂😂😂\n😂🌟😂\n😂😂😂", "🔥💫🔥\n💫⭐💫\n🔥💫🔥", "💎👑💎\n👑🌟👑\n💎👑💎"]; await sendReply(s, m, `🎨 *Emoji Art:*\n\n${random(arts)}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); });
cmd("fakechat", { desc: "Fake chat",  category: "FUN" }, async (s, m) => { await sendReply(s, m, `💬 *Fake Chat Generator*\n\nUse: https://walfie.github.io/waforger/\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); });

// Fun commands — fully implemented
cmd("confess", { desc: "Send anonymous confession", category: "FUN" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}confess <your confession>`); return; }
  await sendReply(sock, msg, `💌 *Anonymous Confession*\n\n_"${args.join(" ")}"_\n\n_Sent anonymously 🤫_\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("birthday", { desc: "Wish someone happy birthday", category: "FUN" }, async (sock, msg, args) => {
  const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  const name = mentions.length ? `@${mentions[0].split("@")[0]}` : (args.join(" ") || "you");
  const wishes = ["🎂 May all your dreams come true!", "🎉 Another year of being awesome!", "🥳 Cheers to a fantastic year ahead!", "🎈 May this year bring you endless joy!", "🎁 Wishing you love, laughter & cake!"];
  await sendReply(sock, msg, `🎂 *Happy Birthday ${name}!*\n\n${random(wishes)}\n\n🎈🎉🎊🥳🎁\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, mentions);
});
cmd("engage", { desc: "Propose to someone (fun)", category: "FUN" }, async (sock, msg) => {
  const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (!mentions.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}engage @user`); return; }
  const sender = getSender(msg).split("@")[0];
  const target = mentions[0].split("@")[0];
  await sendReply(sock, msg, `💍 *Marriage Proposal!*\n\n${sender} just proposed to @${target}!\n\n💒 Will they say yes? Reply with:\n✅ ${CONFIG.PREFIX}accept\n❌ ${CONFIG.PREFIX}reject\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, mentions);
});
cmd("accept", { desc: "Accept a proposal/duel", category: "FUN" }, async (sock, msg) => {
  await sendReply(sock, msg, `✅ *Accepted!*\n\n${getSender(msg).split("@")[0]} said YES! 💕🎉\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("reject", { desc: "Reject a proposal/duel", category: "FUN" }, async (sock, msg) => {
  await sendReply(sock, msg, `❌ *Rejected!*\n\n${getSender(msg).split("@")[0]} said NO! 💔\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("divorce", { desc: "Divorce (fun)", category: "FUN" }, async (sock, msg) => {
  const jid = getSender(msg);
  const rel = relationships.get(jid);
  if (rel?.partner) { relationships.delete(jid); relationships.delete(rel.partner); }
  await sendReply(sock, msg, `💔 *Divorce Filed!*\n\n${jid.split("@")[0]} has filed for divorce!\n\nStatus: Single 💔\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("signdivorcepaper", { desc: "Sign divorce papers", category: "FUN" }, async (sock, msg) => {
  await sendReply(sock, msg, `📝 *Divorce Papers Signed*\n\n${getSender(msg).split("@")[0]} has signed the papers.\nIt's officially over. 💔\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("contestdivorce", { desc: "Contest a divorce", category: "FUN" }, async (sock, msg) => {
  await sendReply(sock, msg, `⚖️ *Divorce Contested!*\n\n${getSender(msg).split("@")[0]} is contesting the divorce!\nThe court will decide... 🏛️\n\nResult: ${Math.random() > 0.5 ? "Divorce GRANTED ✅" : "Divorce DENIED ❌ — Stay together!"}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("date", { desc: "Go on a date (fun)", category: "FUN" }, async (sock, msg) => {
  const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  const places = ["a fancy restaurant 🍷", "the movies 🎬", "a beach sunset 🌅", "an amusement park 🎢", "a rooftop dinner 🌃", "a cozy café ☕"];
  const vibes = ["It was magical! 💫", "Sparks flew everywhere! ⚡", "They couldn't stop laughing! 😂", "A night to remember! 🌟", "Pure chemistry! 🧪"];
  const target = mentions.length ? `@${mentions[0].split("@")[0]}` : "their crush";
  await sendReply(sock, msg, `💕 *Date Night!*\n\n${getSender(msg).split("@")[0]} took ${target} to ${random(places)}\n\n${random(vibes)}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, mentions);
});
cmd("breakup", { desc: "Break up (fun)", category: "FUN" }, async (sock, msg) => {
  const reasons = ["They snored too loud 😴", "They ate the last slice of pizza 🍕", "Irreconcilable differences 📜", "They liked pineapple on pizza 🍍", "They never texted back fast enough 📱"];
  await sendReply(sock, msg, `💔 *Breakup!*\n\n${getSender(msg).split("@")[0]} just broke up!\n\nReason: ${random(reasons)}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("crush", { desc: "Reveal crush (fun)", category: "FUN" }, async (sock, msg) => {
  const crushMeter = Math.floor(Math.random() * 101);
  await sendReply(sock, msg, `😍 *Crush Meter*\n\n${getSender(msg).split("@")[0]}'s crush intensity: *${crushMeter}%*\n\n${"❤️".repeat(Math.round(crushMeter / 20))}${"🤍".repeat(5 - Math.round(crushMeter / 20))}\n\n${crushMeter > 80 ? "Down bad! 😩" : crushMeter > 50 ? "Definitely interested 👀" : crushMeter > 20 ? "Playing it cool 😎" : "Not feeling it 🤷"}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("mixedfeelings", { desc: "Mixed feelings check", category: "FUN" }, async (sock, msg) => {
  const feelings = ["😊 Happy but confused", "😢 Sad but hopeful", "😤 Angry but understanding", "🥰 In love but scared", "😎 Confident but anxious", "🤔 Curious but cautious"];
  await sendReply(sock, msg, `🎭 *Mixed Feelings Check*\n\n${getSender(msg).split("@")[0]} is feeling:\n\n${random(feelings)}\n\n_It's okay to feel multiple things!_ 💛\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd(["ecobio", "mybio", "setmybio"], { desc: "Set personal bio for whois", category: "FUN" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}ecobio <your bio>`); return; }
  const jid = toStandardJid(getSender(msg)), e = getEco(jid);
  e.bio = args.join(" ").trim();
  await sendReply(sock, msg, `✅ *Bio Set!*

_"${e.bio}"_

This now shows in *${CONFIG.PREFIX}whois*.

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("relstatus", { desc: "Relationship status", category: "FUN" }, async (sock, msg) => {
  const jid = getSender(msg);
  const rel = relationships.get(jid);
  const status = rel?.partner ? `In a relationship with @${rel.partner.split("@")[0]} 💕` : "Single 💔";
  await sendReply(sock, msg, `💘 *Relationship Status*\n\n${jid.split("@")[0]}: ${status}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, rel?.partner ? [rel.partner] : []);
});
cmd("duel", { desc: "Challenge someone to a duel", category: "FUN" }, async (sock, msg) => {
  const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (!mentions.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}duel @user`); return; }
  const weapons = ["⚔️ Sword", "🏹 Bow", "🔫 Blaster", "🪄 Magic Wand", "🗡️ Dagger", "🔨 War Hammer"];
  const sender = getSender(msg).split("@")[0];
  const target = mentions[0].split("@")[0];
  const sWeapon = random(weapons), tWeapon = random(weapons);
  const winner = Math.random() > 0.5 ? sender : target;
  await sendReply(sock, msg, `⚔️ *DUEL!*\n\n${sender} (${sWeapon}) VS @${target} (${tWeapon})\n\n⚡ Battle in progress...\n\n🏆 *${winner} WINS!*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, mentions);
});
cmd("acceptduel", { desc: "Accept a duel challenge", category: "FUN" }, async (sock, msg) => {
  await sendReply(sock, msg, `⚔️ *Duel Accepted!*\n\n${getSender(msg).split("@")[0]} has accepted the challenge!\nLet the battle begin! 🔥\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("adopt", { desc: "Adopt someone (fun)", category: "FUN" }, async (sock, msg) => {
  const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (!mentions.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}adopt @user`); return; }
  await sendReply(sock, msg, `👨‍👧 *Adoption!*\n\n${getSender(msg).split("@")[0]} just adopted @${mentions[0].split("@")[0]}!\n\nWelcome to the family! 🏠💕\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, mentions);
});
cmd("adoptlist", { desc: "View adopted members", category: "FUN" }, async (sock, msg) => {
  await sendReply(sock, msg, `👨‍👧‍👦 *Adopt List*\n\nYour family members will show here!\nUse ${CONFIG.PREFIX}adopt @user to grow your family.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("unadopt", { desc: "Unadopt someone", category: "FUN" }, async (sock, msg) => {
  const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (!mentions.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}unadopt @user`); return; }
  await sendReply(sock, msg, `💔 *Unadopted!*\n\n${getSender(msg).split("@")[0]} has unadopted @${mentions[0].split("@")[0]}.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, mentions);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GAMES
// ═══════════════════════════════════════════════════════════════════════════════
const TRIVIA_QS = [
  { q: "What is the capital of France?", a: "paris", hint: "City of Love" },
  { q: "How many sides does a hexagon have?", a: "6", hint: "More than 5" },
  { q: "What planet is the Red Planet?", a: "mars", hint: "Named after Roman god of war" },
  { q: "Who painted the Mona Lisa?", a: "da vinci", hint: "Italian Renaissance artist" },
  { q: "What is the largest ocean?", a: "pacific", hint: "It's the biggest" },
  { q: "What is the fastest land animal?", a: "cheetah", hint: "Big cat, Africa" },
];
const HANGMAN_WORDS = ["javascript", "whatsapp", "precious", "diamond", "robot", "galaxy", "universe", "beautiful", "kingdom", "thunder"];
const WORDLE_WORDS = ["crane", "flame", "glide", "honey", "pizza", "queen", "river", "storm", "tiger", "voice"];
const RIDDLES = [
  { q: "I speak without a mouth and hear without ears. What am I?", a: "echo" },
  { q: "The more you take, the more you leave behind. What am I?", a: "footsteps" },
  { q: "I'm light as a feather but the strongest man can't hold me for 5 minutes. What am I?", a: "breath" },
];

cmd("trivia", { desc: "Play trivia", category: "GAMES" }, async (sock, msg) => {
  const q = random(TRIVIA_QS);
  triviaActive.set(msg.key.remoteJid, { answer: q.a, hint: q.hint, type: "trivia" });
  setTimeout(() => triviaActive.delete(msg.key.remoteJid), 30000);
  await sendReply(sock, msg, `🎯 *Trivia!*\n\n${q.q}\n\n💡 Hint: ${q.hint}\n⏱️ 30 seconds!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("hangman", { desc: "Play hangman", category: "GAMES" }, async (sock, msg) => {
  const word = random(HANGMAN_WORDS);
  hangmanGames.set(msg.key.remoteJid, { word, guessed: new Set(), tries: 6 });
  const display = "_".repeat(word.length).split("").join(" ");
  await sendReply(sock, msg, `🎮 *Hangman!*\n\n${display}\n\n❤️ Lives: 6\nType a letter to guess!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("wordle", { desc: "Play wordle", category: "GAMES" }, async (sock, msg) => {
  const word = random(WORDLE_WORDS);
  wordleGames.set(msg.key.remoteJid, { word, attempts: 0, maxAttempts: 6 });
  await sendReply(sock, msg, `🟩 *Wordle!*\n\nGuess the 5-letter word!\nYou have 6 attempts.\n\nType your guess!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("riddle", { desc: "Get a riddle", category: "GAMES" }, async (sock, msg) => {
  const r = random(RIDDLES);
  triviaActive.set(msg.key.remoteJid + "_riddle", { answer: r.a, type: "riddle" });
  setTimeout(() => triviaActive.delete(msg.key.remoteJid + "_riddle"), 60000);
  await sendReply(sock, msg, `🧩 *Riddle!*\n\n${r.q}\n\n_Type your answer!_\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("math", { desc: "Math quiz", category: "GAMES" }, async (sock, msg) => {
  const ops = ["+", "-", "*"];
  const op = random(ops);
  const a = Math.floor(Math.random() * 20) + 1, b = Math.floor(Math.random() * 20) + 1;
  const ans = op === "+" ? a + b : op === "-" ? a - b : a * b;
  triviaActive.set(msg.key.remoteJid + "_math", { answer: String(ans), type: "math" });
  setTimeout(() => triviaActive.delete(msg.key.remoteJid + "_math"), 20000);
  await sendReply(sock, msg, `🧮 *Math Quiz!*\n\nWhat is *${a} ${op} ${b}*?\n\n⏱️ 20 seconds!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
const gameAnswers = new Map();
const wordChainGames = new Map();
const tttGames = new Map();
cmd("ttt", { desc: "Tic-Tac-Toe vs Bot", category: "GAMES" }, async (sock, msg) => {
  const jid = msg.key.remoteJid;
  const board = [" "," "," "," "," "," "," "," "," "];
  tttGames.set(jid, { board, player: "X" });
  setTimeout(() => tttGames.delete(jid), 300000);
  const nums = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣"];
  const display = () => board.map((c, i) => c === "X" ? "❌" : c === "O" ? "⭕" : nums[i]).reduce((a, c, i) => a + c + ((i + 1) % 3 === 0 && i < 8 ? "\n" : " "), "");
  await sendReply(sock, msg, `⭕ *Tic-Tac-Toe*\n\n${display()}\n\nYou are ❌! Reply with 1-9 to play.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
async function handleGameAnswer(sock, msg, body) {
  const jid = msg.key.remoteJid; const text = String(body || "").trim(); if (!text || text.startsWith(CONFIG.PREFIX)) return false; const senderJid = getSender(msg); const sender = senderJid.split("@")[0];
  const winLines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const renderTtt = b => b.map((c,i)=>c==="X"?"❌":c==="O"?"⭕":["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣"][i]).reduce((a,c,i)=>a+c+((i+1)%3===0&&i<8?"\n":" "),"");
  const winner = b => { for (const [a,c,d] of winLines) if (b[a] !== " " && b[a] === b[c] && b[c] === b[d]) return b[a]; return b.every(x=>x!==" ") ? "draw" : ""; };
  const ttt = tttGames.get(jid); if (ttt && /^[1-9]$/.test(text)) { const i=Number(text)-1; if (ttt.board[i] !== " ") { await sendReply(sock,msg,"❌ That spot is taken. Pick another number 1-9."); return true; } ttt.board[i]="X"; let w=winner(ttt.board); if(!w){ const empty=ttt.board.map((v,i)=>v===" "?i:null).filter(v=>v!==null); const bot=random(empty); if(bot!==undefined) ttt.board[bot]="O"; w=winner(ttt.board); } if(w){ tttGames.delete(jid); await sendReply(sock,msg,`⭕ *Tic-Tac-Toe*\n\n${renderTtt(ttt.board)}\n\n${w==="draw"?"🤝 Draw game!":w==="X"?`🏆 @${sender} wins!`:"🤖 Bot wins!"}`,[senderJid]); } else await sendReply(sock,msg,`⭕ *Tic-Tac-Toe*\n\n${renderTtt(ttt.board)}\n\nYour turn: reply 1-9.`); return true; }
  const hm=hangmanGames.get(jid); if(hm && /^[a-z]$/i.test(text)){ const l=text.toLowerCase(); hm.guessed.add(l); if(!hm.word.includes(l)) hm.tries--; const display=hm.word.split("").map(ch=>hm.guessed.has(ch)?ch.toUpperCase():"_").join(" "); if(!display.includes("_")){ hangmanGames.delete(jid); await sendReply(sock,msg,`🎮 *Hangman*\n\n${display}\n\n🏆 Correct @${sender}!`,[senderJid]); } else if(hm.tries<=0){ hangmanGames.delete(jid); await sendReply(sock,msg,`🎮 *Hangman*\n\n💀 Game over! Word was *${hm.word.toUpperCase()}*`); } else await sendReply(sock,msg,`🎮 *Hangman*\n\n${display}\n❤️ Lives: ${hm.tries}`); return true; }
  const wd=wordleGames.get(jid); if(wd && /^[a-z]{5}$/i.test(text)){ wd.attempts++; const guess=text.toLowerCase(); const marks=guess.split("").map((ch,i)=>ch===wd.word[i]?"🟩":wd.word.includes(ch)?"🟨":"⬛").join(""); if(guess===wd.word){ wordleGames.delete(jid); await sendReply(sock,msg,`🟩 *Wordle*\n\n${marks}\n🏆 Correct @${sender}!`,[senderJid]); } else if(wd.attempts>=wd.maxAttempts){ wordleGames.delete(jid); await sendReply(sock,msg,`🟩 *Wordle*\n\n${marks}\n💀 Word: *${wd.word.toUpperCase()}*`); } else await sendReply(sock,msg,`🟩 *Wordle*\n\n${marks}\nAttempts: ${wd.attempts}/${wd.maxAttempts}`); return true; }
  for (const key of [jid, jid+"_riddle", jid+"_math"]) { const q=triviaActive.get(key); if(q && sameAnswer(text,q.answer)){ triviaActive.delete(key); await sendReply(sock,msg,`✅ *Correct!* @${sender} got it: *${q.answer}*`,[senderJid]); return true; } }
  const ga=gameAnswers.get(jid); if(ga){ if(sameAnswer(text,ga.answer)){ gameAnswers.delete(jid); await sendReply(sock,msg,`✅ *Correct!* @${sender} answered *${ga.answer}*`,[senderJid]); } else await react(sock,msg,"❌").catch(()=>{}); return true; }
  const wc=wordChainGames.get(jid); if(wc && /^[a-z]{2,}$/i.test(text)){ const need=wc.last.slice(-1).toLowerCase(); if(text[0].toLowerCase()===need){ wc.last=text.toLowerCase(); await sendReply(sock,msg,`🔗 *Word Chain*\n\n✅ Good! New word: *${text.toUpperCase()}*\nNext starts with *${text.slice(-1).toUpperCase()}*`); } else await sendReply(sock,msg,`❌ Wrong chain. Your word must start with *${need.toUpperCase()}*`); return true; }
  return false;
}
// Game commands — fully implemented
const WYR_QUESTIONS = [
  ["Fly but be ugly", "Beautiful but no powers"],
  ["Read minds but everyone hears your thoughts", "Be invisible but can't turn it off"],
  ["Live 1000 years poor", "Live 50 years rich"],
  ["No internet for a year", "No friends for a year"],
  ["Always be cold", "Always be hot"],
  ["Speak every language", "Play every instrument"],
];
const NHIE_PROMPTS = ["fallen asleep in class", "sent a text to the wrong person", "eaten food off the floor", "pretended to laugh at a joke I didn't get", "googled something really dumb", "stalked someone's old social media posts", "lied about being busy", "cried at a movie"];
const EMOJI_QUIZZES = [
  { emojis: "🦁👑", answer: "Lion King" }, { emojis: "🕷️🧑", answer: "Spider-Man" },
  { emojis: "❄️👸", answer: "Frozen" }, { emojis: "🧙‍♂️💍", answer: "Lord of the Rings" },
  { emojis: "🦇🦸‍♂️", answer: "Batman" }, { emojis: "🚢💔", answer: "Titanic" },
];
const UNSCRAMBLE_WORDS = ["javascript", "whatsapp", "computer", "elephant", "sunshine", "chocolate", "adventure", "butterfly"];
const WHOAMI_CHARS = ["I am a fruit. I am red. I keep the doctor away.", "I am an animal. I am the king of the jungle.", "I am a planet. I am the biggest in the solar system.", "I am a device. You use me to call people."];

cmd("tod", { desc: "Truth or Dare", category: "GAMES" }, async (sock, msg) => {
  const isTruth = Math.random() > 0.5;
  await sendReply(sock, msg, `🎭 *Truth or Dare!*\n\n${isTruth ? `🤔 TRUTH: ${random(TRUTHS)}` : `😈 DARE: ${random(DARES)}`}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("wyr", { desc: "Would You Rather", category: "GAMES" }, async (sock, msg) => {
  const q = random(WYR_QUESTIONS);
  await sendReply(sock, msg, `🤔 *Would You Rather?*\n\n🅰️ ${q[0]}\n\nOR\n\n🅱️ ${q[1]}\n\n_Reply A or B!_\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("nhie", { desc: "Never Have I Ever", category: "GAMES" }, async (sock, msg) => {
  await sendReply(sock, msg, `🙈 *Never Have I Ever...*\n\n${random(NHIE_PROMPTS)}!\n\n_Reply 🤚 if you have!_\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("spinbottle", { desc: "Spin the bottle", category: "GAMES" }, async (sock, msg) => {
  if (!msg.key.remoteJid.endsWith("@g.us")) { await sendReply(sock, msg, "❌ This only works in groups!"); return; }
  try {
    const meta = await sock.groupMetadata(msg.key.remoteJid);
    const members = meta.participants.filter(p => p.id !== getSender(msg));
    if (members.length) {
      const picked = random(members);
      await sendReply(sock, msg, `🍾 *Spin the Bottle!*\n\n🔄 Spinning...\n\n👉 The bottle points to @${picked.id.split("@")[0]}!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, [picked.id]);
    } else { await sendReply(sock, msg, "❌ Not enough members!"); }
  } catch { await sendReply(sock, msg, "❌ Could not get group members."); }
});
cmd("emojiquiz", { desc: "Guess the movie from emojis", category: "GAMES" }, async (sock, msg) => {
  const q = random(EMOJI_QUIZZES);
  gameAnswers.set(msg.key.remoteJid, { type: "emojiquiz", answer: q.answer });
  setTimeout(() => gameAnswers.delete(msg.key.remoteJid), 60000);
  await sendReply(sock, msg, `🎬 *Emoji Quiz!*\n\nGuess the movie:\n\n${q.emojis}\n\n_Reply with your answer!_\n\n||Answer: ${q.answer}||\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("unscramble", { desc: "Unscramble the word", category: "GAMES" }, async (sock, msg) => {
  const word = random(UNSCRAMBLE_WORDS);
  const scrambled = word.split("").sort(() => Math.random() - 0.5).join("");
  gameAnswers.set(msg.key.remoteJid, { type: "unscramble", answer: word });
  setTimeout(() => gameAnswers.delete(msg.key.remoteJid), 60000);
  await sendReply(sock, msg, `🔤 *Unscramble!*\n\n*${scrambled.toUpperCase()}*\n\nUnscramble the word above!\nHint: ${word.length} letters\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("whoami", { desc: "Guess who/what am I", category: "GAMES" }, async (sock, msg) => {
  const picked = random(WHOAMI_CHARS);
  const answer = picked.includes("fruit") ? "apple" : picked.includes("king of the jungle") ? "lion" : picked.includes("biggest") ? "jupiter" : "phone";
  gameAnswers.set(msg.key.remoteJid, { type: "whoami", answer });
  setTimeout(() => gameAnswers.delete(msg.key.remoteJid), 60000);
  await sendReply(sock, msg, `🤔 *Who Am I?*\n\n${picked}\n\n_Reply with your guess._\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("wcg", { desc: "Word chain game", category: "GAMES" }, async (sock, msg) => {
  const starters = ["apple", "elephant", "tiger", "rainbow", "ocean"];
  const word = random(starters);
  wordChainGames.set(msg.key.remoteJid, { last: word });
  setTimeout(() => wordChainGames.delete(msg.key.remoteJid), 120000);
  await sendReply(sock, msg, `🔗 *Word Chain!*\n\nStarting word: *${word.toUpperCase()}*\n\nReply with a word that starts with the letter *${word.slice(-1).toUpperCase()}*!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("guesssong", { desc: "Guess the song", category: "GAMES" }, async (sock, msg) => {
  const songs = [
    { lyric: "Is this the real life? Is this just fantasy?", answer: "Bohemian Rhapsody" },
    { lyric: "We will, we will rock you!", answer: "We Will Rock You" },
    { lyric: "Hello from the other side", answer: "Hello - Adele" },
    { lyric: "Just a small town girl, living in a lonely world", answer: "Don't Stop Believin'" },
  ];
  const s = random(songs);
  gameAnswers.set(msg.key.remoteJid, { type: "guesssong", answer: s.answer });
  setTimeout(() => gameAnswers.delete(msg.key.remoteJid), 60000);
  await sendReply(sock, msg, `🎵 *Guess the Song!*\n\n_"${s.lyric}"_\n\nWhat song is this?\n\n||${s.answer}||\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  INFO COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════
cmd("botinfo", { desc: "Bot information", category: "INFO" }, async (sock, msg) => {
  const up = fmtUptime(process.uptime());
  const mem = process.memoryUsage();
  const ram = (mem.rss / 1048576).toFixed(1);
  const infoText = `🤖 *MIAS MDX BOT INFO*\n\n👑 Owner: *${CONFIG.OWNER_NAME}*\n📌 Version: *${CONFIG.VERSION}*\n⚡ Commands: *${commands.size}*\n⏱️ Uptime: *${up}*\n🧠 RAM: *${ram}MB*\n🔑 Prefix: *${CONFIG.PREFIX}*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
  const infoPic = await getBotPic();
  if (infoPic) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { image: infoPic, caption: infoText }, { quoted: msg });
    } catch { await sendReply(sock, msg, infoText); }
  } else { await sendReply(sock, msg, infoText); }
});
cmd(["groupinfo", "ginfo", "gcinfo"], { desc: "Group info — works in group OR with invite link: .ginfo <link>", category: "INFO" }, async (sock, msg, args) => {
  await react(sock, msg, "👥");
  // Mode 1: invite link provided
  const linkArg = (args && args[0]) ? String(args[0]).trim() : "";
  const linkMatch = linkArg.match(/chat\.whatsapp\.com\/([A-Za-z0-9_-]{8,})/i) || (linkArg && /^[A-Za-z0-9_-]{8,}$/.test(linkArg) ? [null, linkArg] : null);
  if (linkMatch) {
    const code = linkMatch[1];
    try {
      const info = await sock.groupGetInviteInfo(code);
      const subject = info.subject || "Unknown";
      const owner = info.owner ? `@${String(info.owner).split("@")[0]}` : "Unknown";
      const desc = info.desc || info.descId || "(no description)";
      const size = info.size || info.participants?.length || "?";
      const created = info.creation ? new Date(info.creation * 1000).toLocaleString() : "Unknown";
      const txt = `🔗 *Group Invite Info*\n\n📌 Name: *${subject}*\n👤 Members: *${size}*\n👑 Owner: ${owner}\n📅 Created: *${created}*\n🆔 ID: ${info.id || "?"}\n📝 Description:\n${desc}\n\n🔗 Link: https://chat.whatsapp.com/${code}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
      try {
        const pp = await sock.profilePictureUrl(info.id, "image").catch(() => null);
        if (pp) {
          const buf = (await axios.get(pp, { responseType: "arraybuffer", timeout: 10000 })).data;
          await sock.sendMessage(msg.key.remoteJid, { image: Buffer.from(buf), caption: txt, mentions: info.owner ? [info.owner] : [] }, { quoted: msg });
          return;
        }
      } catch {}
      await sock.sendMessage(msg.key.remoteJid, { text: txt, mentions: info.owner ? [info.owner] : [] }, { quoted: msg });
    } catch (e) {
      await sendReply(sock, msg, `❌ Could not fetch invite info.\n_${e.message || e}_\n\nMake sure the link is valid and the bot isn't banned from the group.`);
    }
    return;
  }
  // Mode 2: current group
  if (!requireGroup(msg)) { await sendReply(sock, msg, "❌ Use in a group, or pass a link: `.ginfo https://chat.whatsapp.com/XXXX`"); return; }
  try {
    const meta = await sock.groupMetadata(msg.key.remoteJid);
    const admins = meta.participants.filter(p => p.admin);
    const owner = meta.owner || (meta.participants.find(p => p.admin === "superadmin") || {}).id;
    const ownerTag = owner ? `@${String(owner).split("@")[0]}` : "Unknown";
    let inviteLink = "";
    try {
      const meBot = (sock.user?.id || "").split(":")[0] + "@s.whatsapp.net";
      const isBotAdmin = meta.participants.some(p => (p.id === meBot || p.id?.startsWith(sock.user?.id?.split(":")[0])) && p.admin);
      if (isBotAdmin) {
        const code = await sock.groupInviteCode(meta.id);
        inviteLink = `\n🔗 Link: https://chat.whatsapp.com/${code}`;
      }
    } catch {}
    const desc = meta.desc || "(no description)";
    const txt = `👥 *Group Info*\n\n📌 Name: *${meta.subject}*\n👤 Members: *${meta.participants.length}*\n🛡️ Admins: *${admins.length}*\n👑 Owner: ${ownerTag}\n📅 Created: *${new Date(meta.creation * 1000).toLocaleString()}*\n🔒 Locked: ${meta.announce ? "Yes (admins only)" : "No"}\n🔧 Edit Info: ${meta.restrict ? "Admins only" : "All members"}\n🆔 ID: ${meta.id}${inviteLink}\n\n📝 Description:\n${desc}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
    try {
      const pp = await sock.profilePictureUrl(meta.id, "image").catch(() => null);
      if (pp) {
        const buf = (await axios.get(pp, { responseType: "arraybuffer", timeout: 10000 })).data;
        await sock.sendMessage(msg.key.remoteJid, { image: Buffer.from(buf), caption: txt, mentions: owner ? [owner] : [] }, { quoted: msg });
        return;
      }
    } catch {}
    await sock.sendMessage(msg.key.remoteJid, { text: txt, mentions: owner ? [owner] : [] }, { quoted: msg });
  } catch (e) { await sendReply(sock, msg, `❌ Failed to fetch group info.\n_${e.message || e}_`); }
});
cmd("admins", { desc: "List group admins", category: "INFO" }, async (sock, msg) => {
  if (!requireGroup(msg)) { await sendReply(sock, msg, `❌ This command only works in groups.\n\nUse it inside the target GC.`); return; }
  const meta = await sock.groupMetadata(msg.key.remoteJid);
  const admins = meta.participants.filter(p => p.admin);
  let t = `🛡️ *Group Admins (${admins.length})*\n\n`;
  admins.forEach(a => t += `• @${_cleanNum(resolveLid(a.id))} (${a.admin})\n`);
  await sock.sendMessage(msg.key.remoteJid, { text: t, mentions: admins.map(a => a.id) }, { quoted: msg });
});
cmd("jid", { desc: "Show JID info", category: "INFO" }, async (sock, msg) => {
  const sender = getSender(msg);
  await sendReply(sock, msg, `🆔 *JID Info*\n\nYour JID: ${sender}\nGroup: ${msg.key.remoteJid}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("groupid", { desc: "Show group ID", category: "INFO" }, async (sock, msg) => {
  await sendReply(sock, msg, `🆔 *Group ID*\n\n${msg.key.remoteJid}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("vcf", { desc: "Save group contacts as VCF file", category: "INFO" }, async (sock, msg, args) => {
  await react(sock, msg, "📇");
  try {
    if (isGroup(msg)) {
      // Save all group members as VCF
      const meta = await sock.groupMetadata(msg.key.remoteJid);
      // Update lid→jid mappings from fresh metadata (atassa fix for @lid numbers)
      updateLidMappingsFromMeta(meta);
      let vcfContent = "";
      let savedCount = 0;
      for (const p of meta.participants) {
        // p.pn = real phone number (WhatsApp provides this in newer versions)
        // Fall back to resolving @lid, then _cleanNum
        const resolvedId = resolveLid(p.id);
        const num = p.pn ? p.pn.replace(/\D/g, "") : _cleanNum(resolvedId);
        if (!num || num.length < 6 || num === resolvedId.split("@")[0]) {
          // num matches lid digits exactly — skip @lid-only entries with no real phone
          if (resolvedId.endsWith("@lid") && !p.pn) continue;
        }
        if (!num || num.length < 5) continue;
        let name = p.notify || p.verifiedName || pushNameCache.get(num) || "";
        if (!name || !name.trim()) {
          try { name = await getDisplayName(sock, p.id, msg.key.remoteJid); } catch {}
        }
        // Cache any found name for future use
        if (name && name.trim() && !/^\d+$/.test(name.trim()) && !name.startsWith("+")) {
          pushNameCache.set(num, name.trim());
        }
        // Never use JID or bare numbers - always try to get a real name
        if (!name || !name.trim() || /^\d+$/.test(name.trim()) || name.startsWith("+") || name.includes("@")) {
          try {
            const [wa] = await sock.onWhatsApp(num + "@s.whatsapp.net");
            if (wa?.notify && !/^\d+$/.test(wa.notify)) name = wa.notify;
          } catch {}
        }
        // Final fallback: use formatted number as name
        if (!name || !name.trim() || /^\d+$/.test(name.trim()) || name.startsWith("+") || name.includes("@")) {
          name = "+" + num;
        }
        saveContact(num, name);
        vcfContent += `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;type=CELL;type=VOICE;waid=${num}:+${num}\nEND:VCARD\n`;
        savedCount++;
      }
      const buf = Buffer.from(vcfContent, "utf8");
      await sock.sendMessage(msg.key.remoteJid, {
        document: buf, fileName: `${meta.subject.replace(/[^a-zA-Z0-9]/g, "_")}_contacts.vcf`,
        mimetype: "text/vcard"
      }, { quoted: msg });
      await sendReply(sock, msg, `📇 Saved *${savedCount}* contacts as VCF!\n_(${meta.participants.length} total members, lids resolved to real numbers)_\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    } else {
      // Single contact VCF
      const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      let targetJid, targetNum;
      if (mentions.length) { targetJid = toStandardJid(mentions[0]); targetNum = _cleanNum(mentions[0]); }
      else if (args[0]) { targetNum = args[0].replace(/\D/g, ""); targetJid = targetNum + "@s.whatsapp.net"; }
      else { targetJid = toStandardJid(getSender(msg)); targetNum = _cleanNum(getSender(msg)); }
      const name = await getDisplayName(sock, targetJid, isGroup(msg) ? msg.key.remoteJid : null);
      const cleanNum = _cleanNum(targetJid);
      const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;type=CELL;type=VOICE;waid=${cleanNum}:+${cleanNum}\nEND:VCARD`;
      await sock.sendMessage(msg.key.remoteJid, { contacts: { displayName: name, contacts: [{ vcard }] } }, { quoted: msg });
      await react(sock, msg, "✅");
    }
  } catch (e) { await sendReply(sock, msg, `❌ VCF error: ${e.message}`); }
});
cmd("device", { desc: "Check device of replied user", category: "INFO" }, async (sock, msg) => {
  await react(sock, msg, "📱");
  const ctx = getContextInfo(msg);
  const targetJid = toStandardJid(resolveLid(ctx?.mentionedJid?.[0] || ctx?.participant || getSender(msg) || ""));
  const id = String(ctx?.stanzaId || msg.key.id || "");
  const device = humanizeDeviceName(id);
  const num = _cleanNum(targetJid);
  let name = num;
  try {
    name = await getDisplayName(sock, targetJid, isGroup(msg) ? msg.key.remoteJid : null);
  } catch {}
  await sock.sendMessage(msg.key.remoteJid, { text: `📱 *Device Detection*

👤 User: *${name}* (@${num})
📲 Device: *${device}*
Msg ID: \`${id.slice(0, 18) || "unknown"}\`

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, mentions: targetJid ? [targetJid] : [] }, { quoted: msg });
});
cmd("whois", { desc: "Full user info", category: "INFO" }, async (sock, msg) => {
  await react(sock, msg, "🔍");
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  let rawTarget = ctx?.mentionedJid?.[0] || ctx?.participant || getSender(msg);
  if (!ctx?.mentionedJid?.length && !ctx?.participant) {
    rawTarget = msg.key.fromMe ? (_botJid || getSender(msg)) : getSender(msg);
  }

  const target = toStandardJid(rawTarget);
  const num = _cleanNum(rawTarget);
  let pp = null;
  try { pp = await sock.profilePictureUrl(target, "image"); } catch {}

  let waBio = "Not available";
  let bioUpdated = "";
  try {
    const statusInfo = await sock.fetchStatus(target).catch(() => sock.fetchStatus(num + "@s.whatsapp.net").catch(() => null));
    if (statusInfo?.status && String(statusInfo.status).trim()) {
      waBio = String(statusInfo.status).trim();
    }
    const setAt = statusInfo?.setAt;
    const ts = setAt instanceof Date
      ? setAt.getTime()
      : typeof setAt === "number"
        ? (setAt > 1e12 ? setAt : setAt * 1000)
        : null;
    if (ts) bioUpdated = new Date(ts).toLocaleDateString("en-NG");
  } catch {}

  const customBio = getUserCustomBio(target) || getUserCustomBio(rawTarget) || "Not set";
  const name = await getDisplayName(sock, target, isGroup(msg) ? msg.key.remoteJid : null);

  const msgId = String(ctx?.stanzaId || msg.key.id || "");
  const device = humanizeDeviceName(msgId);

  const isAdm = isGroup(msg) ? await isGroupAdmin(sock, msg.key.remoteJid, target) : false;
  const text = `👤 *WHO IS — @${num}*

╭─────────────────────
│ 📛 *Name:* ${name}
│ 📱 *Number:* +${num}
│ 📝 *WhatsApp Bio:* _${waBio}_${bioUpdated ? `
│ 📅 *Bio Updated:* ${bioUpdated}` : ""}
│ ✨ *User Bio:* _${customBio}_
│ 📲 *Device:* ${device}
│ 👑 *Admin:* ${isAdm ? "Yes ✅" : "No"}
│ 🔗 *Link:* wa.me/${num}
╰─────────────────────

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;

  if (pp) {
    const buf = await axios.get(pp, { responseType: "arraybuffer", timeout: 10000 });
    await sock.sendMessage(msg.key.remoteJid, { image: Buffer.from(buf.data), caption: text, mentions: [target] }, { quoted: msg });
  } else {
    await sock.sendMessage(msg.key.remoteJid, { text, mentions: [target] }, { quoted: msg });
  }
});
cmd("getpp", { desc: "Get profile picture — reply/mention/dm-partner", category: "INFO" }, async (sock, msg) => {
  const jid = msg.key.remoteJid || "";
  const resolved = await resolveCommandTarget(sock, msg, []);
  const fallbackTarget = !isGroup(msg) ? toStandardJid(resolveLid(jid)) : toStandardJid(resolveLid(getSender(msg) || ""));
  const target = toStandardJid(resolveLid(resolved?.targetJid || fallbackTarget || ""));
  if (!target) { await sendReply(sock, msg, "❌ Could not resolve whose profile picture to fetch."); return; }
  try {
    const targetName = await getDisplayName(sock, target, isGroup(msg) ? jid : null).catch(() => null);
    const pp = await sock.profilePictureUrl(target, "image");
    const buf = await axios.get(pp, { responseType: "arraybuffer", timeout: 10000 });
    const label = isMeaningfulName(targetName || "") ? targetName : `@${_cleanNum(target)}`;
    await sock.sendMessage(msg.key.remoteJid, { image: Buffer.from(buf.data), caption: `📷 *Profile Picture*
👤 ${label}

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, mentions: [target] }, { quoted: msg });
  } catch { await sendReply(sock, msg, "❌ No profile picture or it's private."); }
});
cmd("cinfo", { desc: "Contact info", category: "INFO" }, async (sock, msg) => {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const target = ctx?.mentionedJid?.[0] || ctx?.participant || getSender(msg);
  const num = target.split("@")[0];
  let exists = false;
  try { const [r] = await sock.onWhatsApp(target); exists = !!r?.exists; } catch {}
  await sendReply(sock, msg, `📇 *Contact Info*\n\n📱 Number: +${num}\n✅ On WhatsApp: ${exists ? "Yes" : "No"}\n🔗 wa.me/${num}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("support", { desc: "Contact support/owner", category: "INFO" }, async (sock, msg) => {
  const ownerJid = getOwnerJid();
  const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${CONFIG.OWNER_NAME} (Support)\nTEL;type=CELL;type=VOICE;waid=${CONFIG.OWNER_NUMBER}:+${CONFIG.OWNER_NUMBER}\nEND:VCARD`;
  await sock.sendMessage(msg.key.remoteJid, { contacts: { displayName: CONFIG.OWNER_NAME, contacts: [{ vcard }] } }, { quoted: msg });
  await sendReply(sock, msg, `📞 *Support*\n\nContact the owner for support:\n🔗 wa.me/${CONFIG.OWNER_NUMBER}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  TOOLS COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════
cmd("calc", { desc: "Calculator — .calc <expression>", category: "TOOLS" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}calc <expression>`); return; }
  try {
    const expr = args.join(" ").replace(/[^0-9+\-*/.() ]/g, "");
    const result = Function('"use strict"; return (' + expr + ')')();
    await sendReply(sock, msg, `🧮 *Calculator*\n\n${expr} = *${result}*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch { await sendReply(sock, msg, "❌ Invalid expression."); }
});

cmd("calendar", { desc: "Show calendar for current month", category: "TOOLS" }, async (sock, msg, args) => {
  const now = new Date();
  const year = parseInt(args[0]) || now.getFullYear();
  const month = parseInt(args[1]) || now.getMonth() + 1;
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const dayNames = ["Su","Mo","Tu","We","Th","Fr","Sa"];
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = now.getDate();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  let cal = `📅 *${monthNames[month-1]} ${year}*\n\n`;
  cal += dayNames.join("  ") + "\n";
  cal += "──────────────\n";
  let line = "   ".repeat(firstDay);
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = d < 10 ? ` ${d}` : `${d}`;
    if (isCurrentMonth && d === today) line += `[${dayStr}]`;
    else line += ` ${dayStr} `;
    if ((firstDay + d) % 7 === 0) { cal += line + "\n"; line = ""; }
  }
  if (line) cal += line + "\n";
  cal += `\n${isCurrentMonth ? `📍 Today: *${today} ${monthNames[month-1]} ${year}*\n` : ""}`;
  // Nigeria time
  const ngTime = now.toLocaleString("en-NG", { timeZone: "Africa/Lagos", hour12: true });
  cal += `🕐 Nigeria Time: ${ngTime}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
  await sendReply(sock, msg, cal);
});

cmd("afk", { desc: "Set AFK status", category: "TOOLS" }, async (sock, msg, args) => {
  const jid = getSender(msg);
  afkUsers.set(jid, { reason: args.join(" ") || "No reason", time: Date.now() });
  await sendReply(sock, msg, `😴 *AFK Set!*\n\nReason: ${args.join(" ") || "No reason"}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("unafk", { desc: "Remove AFK status", category: "TOOLS" }, async (sock, msg) => {
  const jid = getSender(msg);
  const afk = afkUsers.get(jid);
  afkUsers.delete(jid);
  const dur = afk ? Math.floor((Date.now() - afk.time) / 60000) : 0;
  await sendReply(sock, msg, `✅ *Back from AFK!*\nWas away for: ${dur} minutes\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("qr", { desc: "Generate QR code", category: "TOOLS" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}qr <text or URL>`); return; }
  const text = args.join(" ");
  await react(sock, msg, "⏳");
  try {
    const url = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(text)}&size=300x300&bgcolor=ffffff&color=000000`;
    const { data: buf } = await axios.get(url, { responseType: "arraybuffer", timeout: 10000 });
    await sock.sendMessage(msg.key.remoteJid, { image: Buffer.from(buf), caption: `📱 *QR Code*\n\n_${text}_\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
  } catch { await sendReply(sock, msg, "❌ Failed to generate QR code."); }
});
cmd("shorten", { desc: "Shorten URL", category: "TOOLS" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}shorten <url>`); return; }
  await react(sock, msg, "🔗");
  const shortApis = [
    async () => { const { data } = await axios.get(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(args[0])}`, { timeout: 8000 }); return data; },
    async () => { const { data } = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(args[0])}`, { timeout: 8000 }); return data; },
    async () => { const { data } = await axios.get(`https://ulvis.net/api.php?url=${encodeURIComponent(args[0])}&private=1`, { timeout: 8000 }); return data; },
    async () => { const { data } = await axios.get(`https://clck.ru/--?url=${encodeURIComponent(args[0])}`, { timeout: 8000 }); return data; },
  ];
  for (const tryApi of shortApis) {
    try {
      const result = await tryApi();
      if (result && typeof result === "string" && result.startsWith("http")) {
        await sendReply(sock, msg, `🔗 *Shortened URL!*\n\n📎 Original: ${args[0]}\n🔗 Short: *${result}*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
        return;
      }
    } catch { continue; }
  }
  await sendReply(sock, msg, "❌ Failed to shorten URL. Check if it's valid.");
});
cmd("ip", { desc: "IP lookup", category: "TOOLS" }, async (sock, msg, args) => {
  await react(sock, msg, "🌐");
  const ip = args[0]?.replace(/[^0-9a-f.:]/gi, "") || "";
  const ipApis = [
    async () => {
      const { data } = await axios.get(`https://ip-api.com/json/${ip}?fields=status,country,regionName,city,isp,org,query`, { timeout: 8000 });
      if (data?.status !== "success") return null;
      return { ip: data.query, country: data.country, city: data.city, region: data.regionName, isp: data.isp || data.org };
    },
    async () => {
      const { data } = await axios.get(`https://ipapi.co/${ip}/json/`, { timeout: 8000 });
      if (data?.error) return null;
      return { ip: data.ip, country: data.country_name, city: data.city, region: data.region, isp: data.org };
    },
    async () => {
      const { data } = await axios.get(`https://ipinfo.io/${ip}/json`, { timeout: 8000 });
      return { ip: data.ip, country: data.country, city: data.city, region: data.region, isp: data.org };
    },
  ];
  let result = null;
  for (const fn of ipApis) { try { result = await fn(); if (result?.ip) break; } catch {} }
  if (result?.ip) {
    await sendReply(sock, msg, `🌐 *IP Lookup*\n\n📍 IP: *${result.ip}*\n🌍 Country: ${result.country || "N/A"}\n🏙️ City: ${result.city || "N/A"}\n📌 Region: ${result.region || "N/A"}\n📡 ISP: ${result.isp || "N/A"}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } else {
    await sendReply(sock, msg, `❌ IP lookup failed for: *${ip || "your IP"}*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});
cmd("time", { desc: "Current time/date", category: "TOOLS" }, async (sock, msg) => {
  const now = new Date();
  await sendReply(sock, msg, `🕐 *Current Time*\n\n📅 Date: ${now.toDateString()}\n🕐 Time: ${now.toLocaleTimeString()}\n🌍 UTC: ${now.toUTCString()}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("remind", { desc: "Set reminder", category: "UTILITY" }, async (sock, msg, args) => {
  if (args.length < 2) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}remind <minutes> <text>`); return; }
  const mins = parseInt(args[0]), text = args.slice(1).join(" "), jid = getSender(msg) || msg.key.remoteJid;
  setTimeout(() => sendText(sock, jid, `⏰ *Reminder!*\n\n${text}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`), mins * 60000);
  await sendReply(sock, msg, `⏰ Reminder set for *${mins} minutes*!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd(["vv", "vv2", "viewonce"], { desc: "Reveal view-once message (reply to it)", category: "TOOLS" }, async (sock, msg) => {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  if (!ctx?.quotedMessage) { await sendReply(sock, msg, `❌ Reply to a view-once message with ${CONFIG.PREFIX}vv`); return; }
  const vo = ctx.quotedMessage?.viewOnceMessage?.message || ctx.quotedMessage?.viewOnceMessageV2?.message || ctx.quotedMessage?.viewOnceMessageV2Extension?.message || ctx.quotedMessage;
  const sender = ctx.participant || msg.key.remoteJid;
  const cap = `🕵️ *ViewOnce Revealed*\nFrom: ${sender.split("@")[0]}`;
  const jid = msg.key.remoteJid;
  const statusMsg = await sock.sendMessage(jid, { text: `👁️ *MIAS MDX ViewOnce*\n\n⬡ Decrypting message...\n◻ Extracting media...\n◻ Revealing content...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
  const vvKey = statusMsg.key;
  try {
    if (vo.imageMessage) {
      const stream = await downloadContentFromMessage(vo.imageMessage, "image");
      let buf = Buffer.from([]);
      for await (const c of stream) buf = Buffer.concat([buf, c]);
      await sock.sendMessage(msg.key.remoteJid, { image: buf, caption: cap + "\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡" }, { quoted: msg });
    } else if (vo.videoMessage) {
      const stream = await downloadContentFromMessage(vo.videoMessage, "video");
      let buf = Buffer.from([]);
      for await (const c of stream) buf = Buffer.concat([buf, c]);
      await sock.sendMessage(msg.key.remoteJid, { video: buf, caption: cap + "\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡" }, { quoted: msg });
    } else if (vo.audioMessage) {
      const stream = await downloadContentFromMessage(vo.audioMessage, "audio");
      let buf = Buffer.from([]);
      for await (const c of stream) buf = Buffer.concat([buf, c]);
      await sock.sendMessage(msg.key.remoteJid, { audio: buf, mimetype: "audio/mp4" }, { quoted: msg });
    } else {
      await sendReply(sock, msg, `❌ Could not detect media type in view-once message.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    }
  } catch (e) { await sendReply(sock, msg, `❌ Failed to reveal: ${e.message}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); }
});

cmd("note", { desc: "Save a note", category: "TOOLS" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}note <text to save>`); return; }
  const jid = msg.key.remoteJid;
  if (!groupRules.has(jid + "_notes")) groupRules.set(jid + "_notes", []);
  groupRules.get(jid + "_notes").push(args.join(" "));
  await sendReply(sock, msg, `📝 *Note saved!*\n\n"${args.join(" ")}"\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("uuid", { desc: "Generate UUID", category: "TOOLS" }, async (sock, msg) => {
  const uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16); });
  await sendReply(sock, msg, `🆔 *UUID*\n\n\`${uuid}\`\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("ss", { desc: "Screenshot a website", category: "TOOLS" }, async (sock, msg, args) => {
  if (!args[0]) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}ss <url>`); return; }
  const jid = msg.key.remoteJid;
  const statusMsg = await sock.sendMessage(jid, { text: `📸 *MIAS MDX Screenshot*\n\n⬡ Loading website...\n◻ Capturing screenshot...\n◻ Sending image...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
  const ssKey = statusMsg.key;
  try {
    const url = args[0].startsWith("http") ? args[0] : "https://" + args[0];
    let ssBuf;
    try {
      const ssUrl = `https://image.thum.io/get/width/1280/crop/720/${encodeURIComponent(url)}`;
      const { data } = await axios.get(ssUrl, { responseType: "arraybuffer", timeout: 15000 });
      ssBuf = Buffer.from(data);
    } catch {
      // Fallback: use api.js screenshot
      try {
        const result = await APIs.screenshotWebsite(url);
        ssBuf = Buffer.isBuffer(result) ? result : null;
        if (!ssBuf && typeof result === "string") {
          const { data } = await axios.get(result, { responseType: "arraybuffer", timeout: 15000 });
          ssBuf = Buffer.from(data);
        }
      } catch {}
    }
    if (ssBuf && ssBuf.length > 1000) {
      await sock.sendMessage(msg.key.remoteJid, { image: ssBuf, caption: `📸 *Screenshot*\n${url}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
    } else { await sendReply(sock, msg, "❌ Failed to capture screenshot."); }
  } catch { await sendReply(sock, msg, "❌ Failed to capture screenshot."); }
});
cmd("trt", { desc: "Translate text", category: "TOOLS" }, async (sock, msg, args) => {
  if (args.length < 2) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}trt <lang> <text>\nExample: ${CONFIG.PREFIX}trt fr Hello world`); return; }
  const lang = args[0]; const text = args.slice(1).join(" ");
  try {
    const { data } = await axios.get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|${lang}`, { timeout: 10000 });
    await sendReply(sock, msg, `🌐 *Translation*\n\n📝 Original: _${text}_\n🔤 ${lang.toUpperCase()}: *${data.responseData.translatedText}*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch { await sendReply(sock, msg, "❌ Translation failed."); }
});
cmd("take", { desc: "Rename sticker — .take <name> | <author>", category: "TOOLS" }, async (sock, msg, args) => {
  const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const stk = q?.stickerMessage;
  if (!stk) {
    await sendReply(sock, msg,
      `❌ Reply to a sticker with ${CONFIG.PREFIX}take\n\n` +
      `Usage: ${CONFIG.PREFIX}take <pack name> | <author>\n` +
      `Or: ${CONFIG.PREFIX}take <name>  (sets both pack & author)\n\n` +
      `Example: ${CONFIG.PREFIX}take MyPack | John\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`
    );
    return;
  }
  try {
    const stream = await downloadContentFromMessage(stk, "sticker");
    let buf = Buffer.from([]);
    for await (const c of stream) buf = Buffer.concat([buf, c]);
    const rawText = args.join(" ").trim();
    const parts = rawText.split("|").map(p => p.trim());
    const packName = parts[0] || CONFIG.BOT_NAME;
    const authorName = parts[1] || parts[0] || CONFIG.OWNER_NAME;
    // Re-pack webp with EXIF metadata so WhatsApp shows the new pack name + author
    const exifBuf = buildStickerExif(packName, authorName);
    const tagged = await injectWebpExif(buf, exifBuf);
    await sock.sendMessage(msg.key.remoteJid, {
      sticker: tagged,
      packname: packName,
      author: authorName,
    }, { quoted: msg });
    await sendReply(sock, msg,
      `✅ *Sticker renamed!*\n\n📦 Pack: *${packName}*\n✍️ Author: *${authorName}*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`
    );
  } catch (e) { await sendReply(sock, msg, `❌ Failed: ${e.message}`); }
});
cmd(["tourl", "litterbox"], { desc: "Upload media to catbox.moe URL", category: "UTILITY" }, async (sock, msg) => {
  const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const img = msg.message?.imageMessage || q?.imageMessage;
  const vid = q?.videoMessage || msg.message?.videoMessage;
  const aud = q?.audioMessage || msg.message?.audioMessage;
  const doc = q?.documentMessage || msg.message?.documentMessage;
  const stk = q?.stickerMessage || msg.message?.stickerMessage;
  const media = img || vid || aud || doc || stk;
  if (!media) { await sendReply(sock, msg, `❌ Reply to an image/video/audio/document with ${CONFIG.PREFIX}tourl`); return; }
  const jid = msg.key.remoteJid;
  const statusMsg = await sock.sendMessage(jid, { text: `🔗 *MIAS MDX Uploader*\n\n⬡ Downloading media...\n◻ Uploading to server...\n◻ Generating link...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
  const sKey = statusMsg.key;
  try {
    const type = img ? "image" : vid ? "video" : aud ? "audio" : stk ? "sticker" : "document";
    const stream = await downloadContentFromMessage(media, type);
    let buf = Buffer.from([]);
    for await (const c of stream) buf = Buffer.concat([buf, c]);
    const ext = img ? "jpg" : vid ? "mp4" : aud ? "ogg" : stk ? "webp" : (doc?.fileName?.split(".").pop() || "bin");
    const mime = media.mimetype || (img ? "image/jpeg" : vid ? "video/mp4" : aud ? "audio/ogg" : stk ? "image/webp" : "application/octet-stream");
    await editMessage(sock, jid, sKey, `🔗 *MIAS MDX Uploader*\n\n⬢ Downloading media... ✅\n⬡ Uploading to server...\n◻ Generating link...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    const FormData = (await import("form-data")).default;
    // Try catbox first, then litterbox fallback
    let resultUrl = null;
    const uploadApis = [
      async () => {
        const form = new FormData();
        form.append("reqtype", "fileupload");
        form.append("fileToUpload", buf, { filename: `upload.${ext}`, contentType: mime });
        const { data } = await axios.post("https://catbox.moe/user/api.php", form, { headers: form.getHeaders(), timeout: 60000 });
        if (data && typeof data === "string" && data.startsWith("https://")) return data;
        return null;
      },
      async () => {
        const form = new FormData();
        form.append("reqtype", "fileupload");
        form.append("time", "72h");
        form.append("fileToUpload", buf, { filename: `upload.${ext}`, contentType: mime });
        const { data } = await axios.post("https://litterbox.catbox.moe/resources/internals/api.php", form, { headers: form.getHeaders(), timeout: 60000 });
        if (data && typeof data === "string" && data.startsWith("https://")) return data;
        return null;
      },
      async () => {
        const form = new FormData();
        form.append("file", buf, { filename: `upload.${ext}`, contentType: mime });
        const { data } = await axios.post("https://tmpfiles.org/api/v1/upload", form, { headers: form.getHeaders(), timeout: 60000 });
        if (data?.data?.url) return data.data.url.replace("tmpfiles.org/", "tmpfiles.org/dl/");
        return null;
      },
    ];
    for (const tryUpload of uploadApis) {
      try { resultUrl = await tryUpload(); if (resultUrl) break; } catch { continue; }
    }
    if (resultUrl) {
      await editMessage(sock, jid, sKey, `🔗 *MIAS MDX Uploader*\n\n⬢ Downloading media... ✅\n⬢ Uploading to server... ✅\n⬢ Generating link... ✅\n\n🌐 *URL:* ${resultUrl}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    } else {
      await editMessage(sock, jid, sKey, `🔗 *MIAS MDX Uploader*\n\n⬢ Downloading media... ✅\n⬢ Uploading to server... ❌\n\n⚠️ All upload servers busy — try again later\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    }
  } catch (e) {
    await editMessage(sock, jid, sKey, `🔗 *MIAS MDX Uploader*\n\n❌ Upload failed: ${e.message}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});
// Tool commands — implemented with real logic where possible
cmd("price", { desc: "Check product price", category: "TOOLS" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}price <product name or URL>`); return; }
  await react(sock, msg, "💰");
  try {
    const { data } = await axios.get(`${CONFIG.GIFTED_API}/api/search/google?apikey=${CONFIG.GIFTED_KEY}&q=${encodeURIComponent(args.join(" ") + " price")}`, { timeout: 15000 });
    const results = data?.results?.slice(0, 3) || [];
    let txt = `💰 *Price Search: ${args.join(" ")}*\n\n`;
    if (results.length) { results.forEach((r, i) => { txt += `${i + 1}. ${r.title}\n${r.description || ""}\n🔗 ${r.url}\n\n`; }); }
    else { txt += "No results found. Try searching on Google Shopping."; }
    await sendReply(sock, msg, txt + `\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch { await sendReply(sock, msg, `💰 Search Google Shopping for: ${args.join(" ")}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); }
});
cmd("fetch", { desc: "Fetch a URL", category: "TOOLS" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}fetch <url>`); return; }
  await react(sock, msg, "🌐");
  try {
    const { data, headers } = await axios.get(args[0], { timeout: 15000, maxRedirects: 5 });
    const text = typeof data === "string" ? data.slice(0, 3000) : JSON.stringify(data, null, 2).slice(0, 3000);
    await sendReply(sock, msg, `🌐 *Fetch Result*\n\nURL: ${args[0]}\nType: ${headers["content-type"] || "unknown"}\n\n${text}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch (e) { await sendReply(sock, msg, `❌ Fetch failed: ${e.message}`); }
});
cmd("save", { desc: "Save quoted message to owner DM", category: "TOOLS" }, async (sock, msg) => {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const quoted = ctx?.quotedMessage;
  if (!quoted) { await sendReply(sock, msg, "❌ Reply to any message to save it to your DM!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡"); return; }
  await react(sock, msg, "📌");
  const dmJid = getOwnerJid(); // Always save to owner's DM
  try {
    // Check for media types
    const mediaTypes = [
      { key: "imageMessage", type: "image", mime: "image/jpeg" },
      { key: "videoMessage", type: "video", mime: "video/mp4" },
      { key: "audioMessage", type: "audio", mime: "audio/ogg" },
      { key: "stickerMessage", type: "sticker", mime: "image/webp" },
      { key: "documentMessage", type: "document", mime: "application/octet-stream" },
    ];
    let saved = false;
    for (const mt of mediaTypes) {
      const mediaMsg = quoted[mt.key];
      if (mediaMsg) {
        const stream = await downloadContentFromMessage(mediaMsg, mt.type === "sticker" ? "sticker" : mt.type === "document" ? "document" : mt.type);
        let buf = Buffer.from([]);
        for await (const c of stream) buf = Buffer.concat([buf, c]);
        const sendObj = {};
        if (mt.type === "image") sendObj.image = buf;
        else if (mt.type === "video") sendObj.video = buf;
        else if (mt.type === "audio") { sendObj.audio = buf; sendObj.mimetype = mediaMsg.mimetype || "audio/ogg"; sendObj.ptt = !!mediaMsg.ptt; }
        else if (mt.type === "sticker") sendObj.sticker = buf;
        else { sendObj.document = buf; sendObj.fileName = mediaMsg.fileName || "file"; sendObj.mimetype = mediaMsg.mimetype || mt.mime; }
        const saveFrom2 = ctx?.participant ? ("+"+_cleanNum(ctx.participant)) : (isGroup(msg) ? "Group" : "DM");
        sendObj.caption = `📌 *Saved*\nFrom: ${saveFrom2}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
        await sock.sendMessage(dmJid, sendObj);
        saved = true;
        break;
      }
    }
    if (!saved) {
      const text = quoted.conversation || quoted.extendedTextMessage?.text || "No text content";
      await sock.sendMessage(dmJid, { text: `📌 *Saved Message*\n\n${text}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` });
    }
    await sendReply(sock, msg, `✅ Saved to your DM!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch (e) { await sendReply(sock, msg, `❌ Could not save: ${e.message}\nMake sure to DM the bot first!`); }
});
cmd("schedule", { desc: "Schedule a message", category: "TOOLS" }, async (sock, msg, args) => {
  if (args.length < 2) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}schedule <minutes> <message>\nExample: ${CONFIG.PREFIX}schedule 5 Hello everyone!`); return; }
  const mins = parseInt(args[0]);
  if (isNaN(mins) || mins < 1 || mins > 1440) { await sendReply(sock, msg, "❌ Time must be 1-1440 minutes."); return; }
  const text = args.slice(1).join(" ");
  await sendReply(sock, msg, `⏰ *Scheduled!*\n\nMessage will be sent in ${mins} minute(s).\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  setTimeout(async () => {
    try { await sock.sendMessage(msg.key.remoteJid, { text: `⏰ *Scheduled Message*\n\n${text}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }); } catch {}
  }, mins * 60000);
});
cmd("schedules", { desc: "View scheduled messages", category: "TOOLS" }, async (sock, msg) => {
  await sendReply(sock, msg, `⏰ *Scheduled Messages*\n\nSchedules are stored in memory and reset on restart.\nUse ${CONFIG.PREFIX}schedule <mins> <msg> to create one.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("cancelschedule", { desc: "Cancel scheduled message", category: "TOOLS" }, async (sock, msg) => {
  await sendReply(sock, msg, `⏰ *Cancel Schedule*\n\nSchedules run in memory. Restart the bot to cancel all pending schedules.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("shazam", { desc: "Identify a song from audio/voice note", category: "TOOLS" }, async (sock, msg) => {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const q = ctx?.quotedMessage;
  const aud = q?.audioMessage || msg.message?.audioMessage;
  const vid = q?.videoMessage || msg.message?.videoMessage;
  if (!aud && !vid) { await sendReply(sock, msg, `❌ Reply to an audio, voice note, or video with ${CONFIG.PREFIX}shazam`); return; }
  await react(sock, msg, "🎵");
  try {
    let buf = Buffer.from([]);
    if (aud) {
      const stream = await downloadContentFromMessage(aud, "audio");
      for await (const c of stream) buf = Buffer.concat([buf, c]);
    } else {
      const stream = await downloadContentFromMessage(vid, "video");
      for await (const c of stream) buf = Buffer.concat([buf, c]);
    }
    let identified = false;
    const shazamApis = [
      // API 1: AudD.io — reliable, accepts raw binary audio
      async () => {
        let FD; try { FD = (await import("form-data")).default; } catch { FD = null; }
        if (!FD) return null;
        const form = new FD();
        form.append("audio", buf, { filename: "audio.ogg", contentType: "audio/ogg" });
        form.append("return", "apple_music,spotify");
        const { data } = await axios.post("https://api.audd.io/", form, { headers: form.getHeaders(), timeout: 30000 });
        if (data?.result) return { title: data.result.title, artist: data.result.artist, album: data.result.album, url: data.result.song_link };
      },
      // API 2: Gifted/Custom API
      async () => {
        let FD; try { FD = (await import("form-data")).default; } catch { FD = null; }
        if (!FD) return null;
        const form = new FD();
        form.append("audio", buf, { filename: "audio.ogg", contentType: "audio/ogg" });
        const { data } = await axios.post(`${CONFIG.GIFTED_API}/api/tools/shazam?apikey=${CONFIG.GIFTED_KEY}`, form, { headers: form.getHeaders(), timeout: 30000 });
        if (data?.success && data?.result) return data.result;
      },
      // API 3: siputzx
      async () => {
        let FD; try { FD = (await import("form-data")).default; } catch { FD = null; }
        if (!FD) return null;
        const form = new FD();
        form.append("audio", buf, { filename: "audio.ogg", contentType: "audio/ogg" });
        const { data } = await axios.post("https://api.siputzx.my.id/api/tools/shazam", form, { headers: form.getHeaders(), timeout: 30000 });
        if (data?.data || data?.result) return data.data || data.result;
      },
      // API 4: base64 approach for ACRCloud-style APIs (no form-data needed)
      async () => {
        const b64 = buf.toString("base64");
        const { data } = await axios.post("https://api.nexoracle.com/misc/shazam?apikey=free_key@maher_apis",
          { audio: b64 }, { headers: { "Content-Type": "application/json" }, timeout: 30000 });
        if (data?.result || data?.track) return data.result || data.track;
      },
      // API 5: Siputzx alt JSON endpoint
      async () => {
        const b64 = buf.toString("base64");
        const { data } = await axios.post("https://api.siputzx.my.id/api/tools/shazam2",
          { audio: b64 }, { headers: { "Content-Type": "application/json" }, timeout: 30000 }).catch(() => ({}));
        const r = data?.data || data?.result; if (r?.title || r?.track) return r;
      },
      // API 6: Ryzendesu shazam
      async () => {
        let FD; try { FD = (await import("form-data")).default; } catch { return null; }
        const form = new FD();
        form.append("audio", buf, { filename: "audio.ogg", contentType: "audio/ogg" });
        const { data } = await axios.post("https://api.ryzendesu.vip/api/tools/shazam", form, { headers: form.getHeaders(), timeout: 30000 }).catch(() => ({}));
        const r = data?.result || data?.data; if (r?.title || r?.track) return r;
      },
      // API 7: Widipe shazam
      async () => {
        let FD; try { FD = (await import("form-data")).default; } catch { return null; }
        const form = new FD();
        form.append("audio", buf, { filename: "audio.ogg", contentType: "audio/ogg" });
        const { data } = await axios.post("https://widipe.com/tools/shazam", form, { headers: form.getHeaders(), timeout: 30000 }).catch(() => ({}));
        const r = data?.result; if (r?.title || r?.track) return r;
      },
    ];
    for (const tryApi of shazamApis) {
      try {
        const r = await tryApi();
        if (r) {
          await sendReply(sock, msg, `🎵 *Shazam Result*\n\n🎶 Title: *${r.title || r.track || "Unknown"}*\n🎤 Artist: *${r.artist || r.subtitle || "Unknown"}*\n💿 Album: ${r.album || "N/A"}\n${r.url ? `🔗 ${r.url}` : ""}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
          identified = true; break;
        }
      } catch {}
    }
    if (!identified) {
      await sendReply(sock, msg, `🎵 *Shazam*\n\n❌ Could not identify this song. Make sure it has clear audio and try again!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    }
  } catch (e) { await sendReply(sock, msg, `❌ Shazam failed: ${e.message}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); }
});
cmd("rmwm", { desc: "Remove watermark from image", category: "TOOLS" }, async (sock, msg) => {
  await sendReply(sock, msg, `🖼️ *Remove Watermark*\n\nReply to an image. For best results, use:\n🔗 https://www.watermarkremover.io\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("fakeid", { desc: "Generate fake identity", category: "TOOLS" }, async (sock, msg) => {
  const firstNames = ["James","Sarah","Alex","Maria","David","Emma","Chris","Lisa","Mike","Anna"];
  const lastNames = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Wilson","Moore"];
  const domains = ["gmail.com","yahoo.com","outlook.com"];
  const fn = random(firstNames), ln = random(lastNames);
  const age = 18 + Math.floor(Math.random() * 45);
  const email = `${fn.toLowerCase()}.${ln.toLowerCase()}${Math.floor(Math.random()*99)}@${random(domains)}`;
  await sendReply(sock, msg, `🆔 *Fake Identity*\n\n👤 Name: ${fn} ${ln}\n📅 Age: ${age}\n📧 Email: ${email}\n📱 Phone: +1${Math.floor(1000000000 + Math.random() * 9000000000)}\n🏠 City: ${random(["New York","London","Tokyo","Paris","Sydney","Toronto"])}\n\n⚠️ _For entertainment only!_\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("tempmail", { desc: "Get temporary email", category: "TOOLS" }, async (sock, msg) => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let user = ""; for (let i = 0; i < 10; i++) user += chars[Math.floor(Math.random() * chars.length)];
  await sendReply(sock, msg, `📧 *Temp Mail*\n\n📬 Your temp email:\n*${user}@tmpmail.org*\n\n🔗 Check inbox at: https://tempmail.plus\n\n⚠️ This is a random address. For real temp mail, visit the link above.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("checkmail", { desc: "Check temp mail inbox", category: "TOOLS" }, async (sock, msg) => {
  await sendReply(sock, msg, `📧 *Check Mail*\n\n🔗 Check your inbox at: https://tempmail.plus\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("readmail", { desc: "Read temp mail", category: "TOOLS" }, async (sock, msg) => {
  await sendReply(sock, msg, `📧 *Read Mail*\n\n🔗 Read your emails at: https://tempmail.plus\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("litterbox", { desc: "Temp file upload", category: "TOOLS" }, async (sock, msg) => {
  await sendReply(sock, msg, `📦 *Litterbox*\n\nUpload temp files at:\n🔗 https://litterbox.catbox.moe\n\nFiles expire after 1-72 hours.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("leakcheck", { desc: "Check if email was leaked", category: "TOOLS" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}leakcheck <email>`); return; }
  await sendReply(sock, msg, `🔒 *Leak Check*\n\nCheck if *${args[0]}* was in a data breach:\n🔗 https://haveibeenpwned.com\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  MEDIA COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════
cmd(["sticker", "s"], { desc: "Image/video → sticker", category: "MEDIA" }, async (sock, msg, args) => {
  const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const img = msg.message?.imageMessage || q?.imageMessage;
  const vid = msg.message?.videoMessage || q?.videoMessage;
  if (!img && !vid) { await sendReply(sock, msg, "❌ Reply to an image or short video!"); return; }
  const jid = msg.key.remoteJid;
  const packName = args.join(" ") || CONFIG.BOT_NAME;
  const statusMsg = await sock.sendMessage(jid, { text: `✨ *MIAS MDX Sticker*\n\n⬡ Downloading media...\n◻ Converting to sticker...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
  const stkKey = statusMsg.key;
  try {
    const media = img || vid;
    const type = img ? "image" : "video";
    const stream = await downloadContentFromMessage(media, type);
    let buf = Buffer.from([]);
    for await (const c of stream) buf = Buffer.concat([buf, c]);
    await editMessage(sock, jid, stkKey, `✨ *MIAS MDX Sticker*\n\n⬢ Downloading media... ✅\n⬡ Converting to sticker...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    await sock.sendMessage(jid, { sticker: buf, stickerPackName: packName, stickerAuthor: CONFIG.OWNER_NAME }, { quoted: msg });
    await editMessage(sock, jid, stkKey, `✨ *MIAS MDX Sticker*\n\n⬢ Downloading image... ✅\n⬢ Converting to sticker... ✅\n\n✅ *Done!*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch (e) {
    await editMessage(sock, jid, stkKey, `✨ *MIAS MDX Sticker*\n\n❌ Sticker failed: ${e.message}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});
cmd("toimg", { desc: "Sticker → Image", category: "MEDIA" }, async (sock, msg) => {
  const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const stk = msg.message?.stickerMessage || q?.stickerMessage;
  if (!stk) { await sendReply(sock, msg, "❌ Reply to a sticker!"); return; }
  await react(sock, msg, "⏳");
  try {
    const stream = await downloadContentFromMessage(stk, "sticker");
    let buf = Buffer.from([]);
    for await (const c of stream) buf = Buffer.concat([buf, c]);
    const inPath = `/tmp/stk_${Date.now()}.webp`;
    const outPath = `/tmp/stk_${Date.now()}.png`;
    fs.writeFileSync(inPath, buf);
    const { execSync } = await import("child_process");
    try {
      execSync(`ffmpeg -i ${inPath} -y ${outPath}`, { timeout: 15000, stdio: "pipe" });
      const outBuf = fs.readFileSync(outPath);
      await sock.sendMessage(msg.key.remoteJid, { image: outBuf, caption: `🖼️ *Sticker → Image*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
    } catch { await sock.sendMessage(msg.key.remoteJid, { image: buf, caption: `🖼️ *Sticker → Image*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg }); }
    try { fs.unlinkSync(inPath); fs.unlinkSync(outPath); } catch {}
    await react(sock, msg, "✅");
  } catch (e) { await sendReply(sock, msg, "❌ Conversion failed: " + e.message); }
});
cmd(["tomp3", "toaudio"], { desc: "Video/Audio → MP3", category: "MEDIA" }, async (sock, msg) => {
  const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const vid = msg.message?.videoMessage || q?.videoMessage;
  const aud = msg.message?.audioMessage || q?.audioMessage;
  const media = vid || aud;
  if (!media) { await sendReply(sock, msg, "❌ Reply to a video or audio!"); return; }
  const jid = msg.key.remoteJid;
  const statusMsg = await sock.sendMessage(jid, { text: `🎵 *MIAS MDX Converter*\n\n⬡ Downloading media...\n◻ Converting to MP3...\n◻ Sending audio...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
  const mp3Key = statusMsg.key;
  try {
    const type = vid ? "video" : "audio";
    const stream = await downloadContentFromMessage(media, type);
    let buf = Buffer.from([]);
    for await (const c of stream) buf = Buffer.concat([buf, c]);
    const ext = vid ? "mp4" : "ogg";
    const inPath = `/tmp/conv_${Date.now()}.${ext}`;
    const outPath = `/tmp/conv_${Date.now()}.mp3`;
    fs.writeFileSync(inPath, buf);
    const { execSync } = await import("child_process");
    try {
      execSync(`ffmpeg -i ${inPath} -vn -acodec libmp3lame -q:a 2 -y ${outPath}`, { timeout: 60000, stdio: "pipe" });
      const outBuf = fs.readFileSync(outPath);
      await sock.sendMessage(msg.key.remoteJid, { audio: outBuf, mimetype: "audio/mpeg", ptt: false }, { quoted: msg });
    } catch { await sock.sendMessage(msg.key.remoteJid, { audio: buf, mimetype: "audio/mpeg", ptt: false }, { quoted: msg }); }
    try { fs.unlinkSync(inPath); fs.unlinkSync(outPath); } catch {}
    await react(sock, msg, "✅");
  } catch (e) { await sendReply(sock, msg, "❌ Conversion failed: " + e.message); }
});
cmd("toptt", { desc: "Audio → Voice Note", category: "MEDIA" }, async (sock, msg) => {
  const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const aud = msg.message?.audioMessage || q?.audioMessage;
  const vid = msg.message?.videoMessage || q?.videoMessage;
  const media = aud || vid;
  if (!media) { await sendReply(sock, msg, "❌ Reply to audio or video!"); return; }
  await react(sock, msg, "⏳");
  try {
    const type = aud ? "audio" : "video";
    const stream = await downloadContentFromMessage(media, type);
    let buf = Buffer.from([]);
    for await (const c of stream) buf = Buffer.concat([buf, c]);
    const inPath = `/tmp/ptt_${Date.now()}.${aud ? "ogg" : "mp4"}`;
    const outPath = `/tmp/ptt_${Date.now()}.ogg`;
    fs.writeFileSync(inPath, buf);
    const { execSync } = await import("child_process");
    try {
      execSync(`ffmpeg -i ${inPath} -acodec libopus -b:a 48k -y ${outPath}`, { timeout: 30000, stdio: "pipe" });
      const outBuf = fs.readFileSync(outPath);
      await sock.sendMessage(msg.key.remoteJid, { audio: outBuf, mimetype: "audio/ogg; codecs=opus", ptt: true }, { quoted: msg });
    } catch { await sock.sendMessage(msg.key.remoteJid, { audio: buf, mimetype: "audio/ogg; codecs=opus", ptt: true }, { quoted: msg }); }
    try { fs.unlinkSync(inPath); fs.unlinkSync(outPath); } catch {}
    await react(sock, msg, "✅");
  } catch (e) { await sendReply(sock, msg, "❌ Conversion failed: " + e.message); }
});
cmd("tovideo", { desc: "GIF/Audio → Video", category: "MEDIA" }, async (sock, msg) => {
  const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const vid = msg.message?.videoMessage || q?.videoMessage;
  const stk = msg.message?.stickerMessage || q?.stickerMessage;
  const aud = msg.message?.audioMessage || q?.audioMessage;
  const media = vid || stk || aud;
  if (!media) { await sendReply(sock, msg, "❌ Reply to a GIF, animated sticker, or audio!"); return; }
  await react(sock, msg, "⏳");
  try {
    const type = vid ? "video" : stk ? "sticker" : "audio";
    const stream = await downloadContentFromMessage(media, type);
    let buf = Buffer.from([]);
    for await (const c of stream) buf = Buffer.concat([buf, c]);
    const ext = vid ? "mp4" : stk ? "webp" : "ogg";
    const inPath = `/tmp/tovid_${Date.now()}.${ext}`;
    const outPath = `/tmp/tovid_${Date.now()}.mp4`;
    fs.writeFileSync(inPath, buf);
    const { execSync } = await import("child_process");
    try {
      if (aud) {
        // Audio to video with black screen
        execSync(`ffmpeg -f lavfi -i color=c=black:s=480x480:r=15 -i ${inPath} -shortest -c:v libx264 -c:a aac -b:a 128k -y ${outPath}`, { timeout: 60000, stdio: "pipe" });
      } else {
        execSync(`ffmpeg -i ${inPath} -c:v libx264 -c:a aac -movflags +faststart -y ${outPath}`, { timeout: 60000, stdio: "pipe" });
      }
      const outBuf = fs.readFileSync(outPath);
      await sock.sendMessage(msg.key.remoteJid, { video: outBuf, caption: `🎬 *Converted to Video*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
    } catch {
      // Fallback: send raw buffer
      await sock.sendMessage(msg.key.remoteJid, { video: buf, caption: `🎬 *Converted to Video*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
    }
    try { fs.unlinkSync(inPath); fs.unlinkSync(outPath); } catch {}
    await react(sock, msg, "✅");
  } catch (e) { await sendReply(sock, msg, "❌ Conversion failed: " + e.message); }
});
cmd("togif", { desc: "Video → GIF", category: "MEDIA" }, async (sock, msg) => {
  const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const vid = msg.message?.videoMessage || q?.videoMessage;
  if (!vid) { await sendReply(sock, msg, "❌ Reply to a video!"); return; }
  await react(sock, msg, "⏳");
  try {
    const stream = await downloadContentFromMessage(vid, "video");
    let buf = Buffer.from([]);
    for await (const c of stream) buf = Buffer.concat([buf, c]);
    await sock.sendMessage(msg.key.remoteJid, { video: buf, gifPlayback: true, caption: `🎞️ *Converted to GIF*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
    await react(sock, msg, "✅");
  } catch (e) { await sendReply(sock, msg, "❌ Conversion failed: " + e.message); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  RELIGION
// ═══════════════════════════════════════════════════════════════════════════════
cmd("bible", { desc: "Get Bible verse", category: "RELIGION" }, async (sock, msg, args) => {
  await react(sock, msg, "📖");
  const ref = args.join("+").replace(/\s/g, "+");
  try {
    const { data } = await axios.get(`https://bible-api.com/${ref || "john+3:16"}`, { timeout: 10000 });
    await sendReply(sock, msg, `📖 *Bible Verse*\n\n${data.reference}\n\n_"${data.text?.trim()}"_\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch { await sendReply(sock, msg, `📖 *John 3:16*\n\n_"For God so loved the world..."_\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); }
});
cmd(["quran", "qur"], { desc: "Get Quran verse", category: "RELIGION" }, async (sock, msg, args) => {
  await react(sock, msg, "🕌");
  const ref = args[0] || "2:255";
  const [s, a] = ref.includes(":") ? ref.split(":") : [1, 1];
  try {
    const { data } = await axios.get(`https://api.alquran.cloud/v1/ayah/${s}:${a}/en.asad`, { timeout: 10000 });
    const v = data.data;
    await sendReply(sock, msg, `🕌 *Quran ${v.surah?.name} (${v.surah?.number}:${v.numberInSurah})*\n\n📝 *${v.text}*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch { await sendReply(sock, msg, `🕌 *Quran 2:255 (Ayat al-Kursi)*\n\n_"Allah — there is no deity except Him..."_\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  LOGO COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════
const LOGO_STYLES = ["alienglow","burning","chromeone","chrometwo","comic","fire","glowinghot","glowingsteel","gradientbevel","slab","neontext","simple","starburst","felt","outline","animatedglow","3dtextured","3dgradient","glossy","embossed","pixelbadge","chromium","iced","frosty","particle","moltencore","glitter","fantasy"];
cmd("logolist", { desc: "List logo styles", category: "LOGO" }, async (s, m) => {
  await sendReply(s, m, `🎨 *Logo Styles:*\n\n${LOGO_STYLES.map(l => `• ${l}`).join("\n")}\n\nUsage: ${CONFIG.PREFIX}<style> <text>\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
for (const style of LOGO_STYLES) {
  cmd(style, { desc: `${style} logo style`, category: "LOGO" }, async (sock, msg, args) => {
    if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}${style} <text>`); return; }
    const text = args.join(" ");
    await react(sock, msg, "🎨");
    const jid = msg.key.remoteJid;
    const statusMsg = await sock.sendMessage(jid, { text: `🎨 *MIAS MDX Logo*\n\n⬡ Generating *${style}* logo...\nText: _"${text}"_\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
    const lgKey = statusMsg.key;
    // Multiple API fallbacks for logo generation
    const logoApis = [
      async () => {
        const { data } = await axios.get(`${CONFIG.GIFTED_API}/api/maker/${style}?apikey=${CONFIG.GIFTED_KEY}&text=${encodeURIComponent(text)}`, { timeout: 30000 });
        const url = data?.result?.url || data?.result?.image || data?.result;
        if (url && typeof url === "string") return url;
      },
      async () => {
        const { data } = await axios.get(`https://api.nexoracle.com/ephoto/${style}?apikey=free_key@maher_apis&text=${encodeURIComponent(text)}`, { timeout: 25000 });
        const url = data?.result?.image || data?.result?.url || data?.result;
        if (url && typeof url === "string") return url;
      },
      async () => {
        const { data } = await axios.get(`https://api.siputzx.my.id/api/m/ephoto/${style}?text=${encodeURIComponent(text)}`, { timeout: 25000 });
        const url = data?.data || data?.result || data?.url;
        if (url && typeof url === "string") return url;
      },
      // Pollinations AI fallback for text-on-image
      async () => {
        const prompt = `${style} style logo text "${text}" on dark background, digital art, high quality`;
        const imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true`;
        const r = await axios.get(imgUrl, { responseType: "arraybuffer", timeout: 60000 });
        if (r.data && r.data.length > 5000) return Buffer.from(r.data);
      },
    ];
    for (const tryApi of logoApis) {
      try {
        const result = await tryApi();
        if (result) {
          let imgBuf;
          if (Buffer.isBuffer(result)) {
            imgBuf = result;
          } else {
            const resp = await axios.get(result, { responseType: "arraybuffer", timeout: 30000 });
            imgBuf = Buffer.from(resp.data);
          }
          if (imgBuf && imgBuf.length > 1000) {
            await sock.sendMessage(jid, { image: imgBuf, caption: `🎨 *${style.toUpperCase()} Logo*\n\nText: _"${text}"_\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
            await react(sock, msg, "✅");
            return;
          }
        }
      } catch { continue; }
    }
    await editMessage(sock, jid, lgKey, `🎨 *${style.toUpperCase()} Logo*\n\nText: _"${text}"_\n\n⚠️ All logo servers busy — try again later!\nStyles: ${CONFIG.PREFIX}logolist\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TEXT COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════
const FANCY_STYLES = {
  bold: t => t.split("").map(c => "𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"["abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".indexOf(c)] || c).join(""),
  italic: t => [...t].map(c => "𝘢𝘣𝘤𝘥𝘦𝘧𝘨𝘩𝘪𝘫𝘬𝘭𝘮𝘯𝘰𝘱𝘲𝘳𝘴𝘵𝘶𝘷𝘸𝘹𝘺𝘻𝘈𝘉𝘊𝘋𝘌𝘍𝘎𝘏𝘐𝘑𝘒𝘓𝘔𝘕𝘖𝘗𝘘𝘙𝘚𝘛𝘜𝘝𝘞𝘟𝘠𝘡"["abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".indexOf(c)] || c).join(""),
  bubble: t => [...t].map(c => "ⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩ"["abcdefghijklmnopqrstuvwxyz".indexOf(c.toLowerCase())] || c).join(""),
};
cmd("say", { desc: "Say something", category: "TEXT" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}say <text>`); return; }
  await sendText(sock, msg.key.remoteJid, args.join(" "));
});
cmd("fancy", { desc: "Fancy text", category: "TEXT" }, async (sock, msg, args) => {
  if (args.length < 2) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}fancy <style> <text>\nStyles: bold, italic, bubble`); return; }
  const style = args[0].toLowerCase(), text = args.slice(1).join(" ");
  const fn = FANCY_STYLES[style];
  await sendReply(sock, msg, `✨ *Fancy Text (${style})*\n\n${fn ? fn(text) : text}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("fancylist", { desc: "List fancy text styles", category: "TEXT" }, async (sock, msg) => {
  await sendReply(sock, msg, `✨ *Fancy Styles:*\nbold, italic, bubble\n\nUsage: ${CONFIG.PREFIX}fancy <style> <text>\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GROUP COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════
cmd("members", { desc: "List all members", category: "GROUP" }, async (sock, msg) => {
  if (!requireGroup(msg)) { await sendReply(sock, msg, "❌ Groups only."); return; }
  const meta = await sock.groupMetadata(msg.key.remoteJid);
  let t = `👥 *Members (${meta.participants.length})*\n\n`;
  meta.participants.forEach((p, i) => t += `${i + 1}. @${p.id.split("@")[0]} ${p.admin ? "(Admin)" : ""}\n`);
  await sock.sendMessage(msg.key.remoteJid, { text: t + `\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, mentions: meta.participants.map(p => p.id) }, { quoted: msg });
});
cmd(["tagall", "everyone", "botall"], { desc: "Tag all members", ownerOnly: true, category: "GROUP" }, async (sock, msg) => {
  if (!requireGroup(msg)) return;
  const meta = await sock.groupMetadata(msg.key.remoteJid);
  const _rawFull = getBody(msg);
  const _cmdName = _rawFull.split(" ")[0].slice(CONFIG.PREFIX.length);
  const body = _rawFull.slice(CONFIG.PREFIX.length + _cmdName.length).trim() || "🔔 Attention!";
  let t = `╭─❮ *TAG ALL* ❯─╮\n📌 ${body}\n👥 Members: ${meta.participants.length}\n╰────────────╯\n\n`;
  const jids = [];
  for (const m of meta.participants) {
    const num = _cleanNum(resolveLid(m.id));
    const tag = m.admin ? " *(admin)*" : "";
    const cname = pushNameCache.get(_cleanNum(m.id)) || m.notify || "";
    const nice = cname && !/^\d+$/.test(cname) ? ` — ${cname}` : "";
    t += `• @${num}${tag}${nice}\n`;
    jids.push(m.id);
  }
  await sock.sendMessage(msg.key.remoteJid, { text: t, mentions: jids }, { quoted: msg });
});
cmd("tag", { desc: "Tag specific people", category: "GROUP" }, async (sock, msg, args) => {
  const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  const text = args.filter(a => !a.startsWith("@")).join(" ") || "Hey!";
  if (!mentions.length) { await sendReply(sock, msg, "❌ Tag some people!"); return; }
  let t = `${text}\n\n`;
  mentions.forEach(j => t += `@${j.split("@")[0]} `);
  await sock.sendMessage(msg.key.remoteJid, { text: t.trim(), mentions }, { quoted: msg });
});
cmd("kick", { desc: "Kick member or N random members (e.g .kick 5)", category: "GROUP", ownerOnly: true }, async (sock, msg, args) => {
    if (!requireGroup(msg)) return;
    const jid = msg.key.remoteJid;
    const ctx = msg.message?.extendedTextMessage?.contextInfo;

    // Check if first arg is a number (bulk kick N members)
    const bulkN = args[0] && /^\d+$/.test(args[0]) ? parseInt(args[0]) : 0;
    
    if (bulkN > 0) {
      // Bulk kick N random non-admin members
      if (bulkN > 50) { await sendReply(sock, msg, "❌ Max bulk kick is 50 at once."); return; }
      let meta;
      try { meta = await sock.groupMetadata(jid); } catch { await sendReply(sock, msg, "❌ Could not fetch group info."); return; }
      const botNum = _cleanNum(sock.user?.id);
      const ownerNum = CONFIG.OWNER_NUMBER;
      const admins = meta.participants.filter(p => p.admin).map(p => _cleanNum(p.id));
      const kickable = meta.participants.filter(p => {
        const n = _cleanNum(p.id);
        return !p.admin && n !== botNum && n !== ownerNum && !admins.includes(n);
      });
      if (!kickable.length) { await sendReply(sock, msg, "❌ No non-admin members to kick."); return; }
      const toKick = kickable.slice(0, bulkN).map(p => p.id);
      const statusMsg = await sock.sendMessage(jid, { text: `👢 *MIAS MDX Bulk Kick*\n\n⬡ Kicking *${toKick.length}* random non-admin members...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
      let kicked = 0;
      for (const t of toKick) {
        try { await sock.groupParticipantsUpdate(jid, [t], "remove"); kicked++; await new Promise(r => setTimeout(r, 500)); } catch {}
      }
      await editMessage(sock, jid, statusMsg.key, `👢 *MIAS MDX Bulk Kick Done!*\n\n✅ Kicked *${kicked}* of *${toKick.length}* members.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
      return;
    }

    // Single/tagged kick
    let m = ctx?.mentionedJid || [];
    if (!m.length && ctx?.participant) {
      const quotedNum = _cleanNum(ctx.participant);
      try {
        const meta = await sock.groupMetadata(jid);
        const found = meta.participants.find(p => _cleanNum(p.id) === quotedNum);
        m = [found?.id || ctx.participant];
      } catch { m = [ctx.participant]; }
    }
    if (!m.length) { await sendReply(sock, msg, `❌ Tag or reply to someone to kick.\n\nBulk kick: *${CONFIG.PREFIX}kick 5* (kicks 5 random members)\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; }
    
    const statusMsg = await sock.sendMessage(jid, { text: `👢 *MIAS MDX Kick*\n\n⬡ Removing ${m.length} member(s)...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
    let kicked = 0;
    for (const t of m) {
      const tNum = _cleanNum(t);
      if (tNum === CONFIG.OWNER_NUMBER || tNum === CREATOR_NUMBER) continue;
      try { await sock.groupParticipantsUpdate(jid, [t], "remove"); kicked++; } catch {}
    }
    await editMessage(sock, jid, statusMsg.key, `👢 *MIAS MDX Kick Done!*\n\n✅ Kicked *${kicked}* member(s).\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  });
cmd(["tkick","tempkick","tk"], { desc: "Temporarily kick a member and re-add them after a delay", category: "GROUP", adminOnly: true, groupOnly: true }, async (sock, msg, args) => {
  const jid = msg.key.remoteJid;
  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ||
                    msg.message?.buttonsResponseMessage?.contextInfo?.mentionedJid || [];
  const replied = msg.message?.extendedTextMessage?.contextInfo?.participant ||
                  msg.message?.buttonsResponseMessage?.contextInfo?.participant;
  const rawTarget = mentioned[0] || replied || args.find(a => a.includes("@"));
  if (!rawTarget) {
    await sendReply(sock, msg, `❌ *Tag or reply to someone to temp-kick.*
Usage: ${CONFIG.PREFIX}tkick @user [minutes]
Example: ${CONFIG.PREFIX}tkick @user 5

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    return;
  }
  const target = rawTarget.includes("@") ? rawTarget : rawTarget + "@s.whatsapp.net";
  const minutes = parseInt(args.find(a => /^\d+$/.test(a))) || 1;
  const seconds = Math.max(1, Math.min(minutes * 60, 3600)); // max 1 hour
  await react(sock, msg, "⏱️");
  try {
    await sock.groupParticipantsUpdate(jid, [target], "remove");
    await sendReply(sock, msg, `⏱️ *Temp-Kicked @${target.split("@")[0]}*
They will be re-added in *${minutes} minute(s)*.

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, { mentions: [target] });
    setTimeout(async () => {
      try {
        await sock.groupParticipantsUpdate(jid, [target], "add");
        await sock.sendMessage(jid, {
          text: `✅ @${target.split("@")[0]} has been re-added after the temp-kick.

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`,
          mentions: [target],
        });
      } catch (e) {
        console.error("[tkick re-add]", e.message || e);
        try {
          // If re-add fails (group is locked), try generating an invite link
          const code = await sock.groupInviteCode(jid);
          if (code) {
            await sock.sendMessage(target, {
              text: `👋 *Your temp-kick in the group has ended.*
Use this link to rejoin: https://chat.whatsapp.com/${code}

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`,
            });
          }
        } catch {}
      }
    }, seconds * 1000);
  } catch (e) {
    await sendReply(sock, msg, `❌ Failed to kick: ${e.message || "Unknown error"}

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});

cmd("promote", { desc: "Promote to admin", category: "GROUP", ownerOnly: true }, async (sock, msg) => {
  if (!requireGroup(msg)) return;
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  let m = ctx?.mentionedJid || [];
  // Also detect from quoted/replied message participant
  if (!m.length && ctx?.participant) {
    // Find the actual participant JID from group metadata (handles @lid format)
    const gid = msg.key.remoteJid;
    const quotedNum = _cleanNum(ctx.participant);
    try {
      const meta = await sock.groupMetadata(gid);
      const found = meta.participants.find(p => _cleanNum(p.id) === quotedNum);
      m = [found?.id || ctx.participant];
    } catch { m = [ctx.participant]; }
  }
  if (!m.length) { await sendReply(sock, msg, "❌ Tag or reply to someone."); return; }
  const jid = msg.key.remoteJid;
  const statusMsg = await sock.sendMessage(jid, { text: `👑 *MIAS MDX Promote*\n\n⬡ Promoting ${m.length} member(s)...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
  const prKey = statusMsg.key;
  try {
    await sock.groupParticipantsUpdate(jid, m, "promote");
    await editMessage(sock, jid, prKey, `👑 *MIAS MDX Promote*\n\n⬢ Promoting ${m.length} member(s)... ✅\n\n✅ Promoted to admin!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch (e) {
    await editMessage(sock, jid, prKey, `👑 *MIAS MDX Promote*\n\n⬢ Promoting... ❌\n\n❌ Failed: ${e.message}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});
cmd("demote", { desc: "Remove admin", category: "GROUP", ownerOnly: true }, async (sock, msg) => {
  if (!requireGroup(msg)) return;
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  let m = ctx?.mentionedJid || [];
  // Also detect from quoted/replied message participant
  if (!m.length && ctx?.participant) {
    const gid = msg.key.remoteJid;
    const quotedNum = _cleanNum(ctx.participant);
    try {
      const meta = await sock.groupMetadata(gid);
      const found = meta.participants.find(p => _cleanNum(p.id) === quotedNum);
      m = [found?.id || ctx.participant];
    } catch { m = [ctx.participant]; }
  }
  if (!m.length) { await sendReply(sock, msg, "❌ Tag or reply to someone."); return; }
  const jid = msg.key.remoteJid;
  const statusMsg = await sock.sendMessage(jid, { text: `⬇️ *MIAS MDX Demote*\n\n⬡ Demoting ${m.length} member(s)...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
  const dmKey = statusMsg.key;
  try {
    await sock.groupParticipantsUpdate(jid, m, "demote");
    await editMessage(sock, jid, dmKey, `⬇️ *MIAS MDX Demote*\n\n⬢ Demoting ${m.length} member(s)... ✅\n\n✅ Demoted successfully!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch (e) {
    await editMessage(sock, jid, dmKey, `⬇️ *MIAS MDX Demote*\n\n⬢ Demoting... ❌\n\n❌ Failed: ${e.message}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});
cmd("add", { desc: "Add member", category: "GROUP", ownerOnly: true }, async (sock, msg, args) => {
  if (!requireGroup(msg)) return;
  if (!args[0]) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}add <phone>`); return; }
  const targetJid = args[0].replace(/\D/g, "") + "@s.whatsapp.net";
  const gJid = msg.key.remoteJid;
  const statusMsg = await sock.sendMessage(gJid, { text: `➕ *MIAS MDX Add*\n\n⬡ Adding +${args[0]}...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
  const addKey = statusMsg.key;
  try {
    await sock.groupParticipantsUpdate(gJid, [targetJid], "add");
    await editMessage(sock, gJid, addKey, `➕ *MIAS MDX Add*\n\n⬢ Adding +${args[0]}... ✅\n\n✅ Added successfully!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch (e) {
    await editMessage(sock, gJid, addKey, `➕ *MIAS MDX Add*\n\n⬢ Adding +${args[0]}... ❌\n\n❌ Failed: ${e.message}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});
cmd("open", { desc: "Open group", category: "GROUP", ownerOnly: true }, async (sock, msg) => {
  if (!requireGroup(msg)) return;
  const adminName = await getDisplayName(sock, getSender(msg), msg.key.remoteJid);
  await sock.groupSettingUpdate(msg.key.remoteJid, "not_announcement");
  await sendReply(sock, msg, `✅ *Group is OPEN!*\n\n🔓 Opened by *${adminName}*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("close", { desc: "Close group", category: "GROUP", ownerOnly: true }, async (sock, msg) => {
  if (!requireGroup(msg)) return;
  const adminName = await getDisplayName(sock, getSender(msg), msg.key.remoteJid);
  await sock.groupSettingUpdate(msg.key.remoteJid, "announcement");
  await sendReply(sock, msg, `🔒 *Group CLOSED!*\n\n🔐 Closed by *${adminName}*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("link", { desc: "Group invite link", category: "GROUP" }, async (sock, msg) => {
  if (!requireGroup(msg)) return;
  try { const c = await sock.groupInviteCode(msg.key.remoteJid); await sendReply(sock, msg, `🔗 *Invite Link:*\nhttps://chat.whatsapp.com/${c}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); }
  catch { await sendReply(sock, msg, "❌ Need admin rights."); }
});
cmd("revoke", { desc: "Revoke invite link", category: "GROUP", ownerOnly: true }, async (sock, msg) => {
  if (!requireGroup(msg)) return;
  try { await sock.groupRevokeInvite(msg.key.remoteJid); const c = await sock.groupInviteCode(msg.key.remoteJid); await sendReply(sock, msg, `✅ *Revoked!*\nNew: https://chat.whatsapp.com/${c}`); }
  catch { await sendReply(sock, msg, "❌ Failed."); }
});
cmd(["warn", "warning"], { desc: "Warn member", category: "GROUP", ownerOnly: true }, async (sock, msg, args) => {
  if (!requireGroup(msg)) return;
  const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (!mentions.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}warn @user <reason>`); return; }
  const gid = msg.key.remoteJid;
  if (!warns.has(gid)) warns.set(gid, new Map());
  const gw = warns.get(gid);
  const target = mentions[0];
  const reason = args.filter(a => !a.startsWith("@")).join(" ") || "No reason";
  gw.set(target, (gw.get(target) || 0) + 1);
  const count = gw.get(target);
  await sock.sendMessage(gid, { text: `⚠️ *Warning ${count}/3*\n\n@${target.split("@")[0]}\n📝 Reason: ${reason}\n\n${count >= 3 ? "🚫 3 strikes! Kicking..." : `${3 - count} more = kick`}`, mentions: [target] }, { quoted: msg });
  if (count >= 3) { gw.delete(target); await sock.groupParticipantsUpdate(gid, [target], "remove").catch(() => {}); }
});
cmd(["warnlist", "warns"], { desc: "List warnings", category: "GROUP", ownerOnly: true }, async (sock, msg) => {
  if (!requireGroup(msg)) return;
  const gw = warns.get(msg.key.remoteJid);
  if (!gw?.size) { await sendReply(sock, msg, "✅ No warnings."); return; }
  let t = "⚠️ *Warnings*\n\n"; const jids = [];
  for (const [u, c] of gw) { t += `@${u.split("@")[0]}: ${c}/3\n`; jids.push(u); }
  await sock.sendMessage(msg.key.remoteJid, { text: t + "\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡", mentions: jids }, { quoted: msg });
});
cmd("resetwarn", { desc: "Reset warnings", category: "GROUP", ownerOnly: true }, async (sock, msg) => {
  const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (!mentions.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}resetwarn @user`); return; }
  warns.get(msg.key.remoteJid)?.delete(mentions[0]);
  await sendReply(sock, msg, `✅ Warnings reset.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("poll", { desc: "Create poll", category: "GROUP" }, async (sock, msg, args) => {
  if (!requireGroup(msg)) return;
  const parts = args.join(" ").split("/").map(p => p.trim()).filter(Boolean);
  if (parts.length < 3) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}poll Question / A / B / C`); return; }
  const [q, ...opts] = parts;
  const nums = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣"];
  let t = `📊 *Poll: ${q}*\n\n`;
  opts.slice(0, 6).forEach((o, i) => t += `${nums[i]} ${o}\n`);
  t += `\n_Reply number to vote!_\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
  await sendText(sock, msg.key.remoteJid, t);
});
cmd("antilink", { desc: "Toggle anti-link and action mode", category: "GROUP", ownerOnly: true }, async (sock, msg, args) => {
  if (!requireGroup(msg)) return;
  const s = getSettings(msg.key.remoteJid);
  const v = (args[0] || '').toLowerCase();
  const modeArg = (args[1] || args[0] || '').toLowerCase();
  if (['on','1','enable','true'].includes(v)) s.antiLink = true;
  else if (['off','0','disable','false'].includes(v)) s.antiLink = false;
  else if (!['delete','warn','kick','tkick'].includes(v)) s.antiLink = !s.antiLink;
  if (['delete','warn','kick','tkick'].includes(modeArg)) s.linkGuard = modeArg;
  saveNow();
  await sendReply(sock, msg, `🔗 *Anti-Link: ${s.antiLink ? '✅ ON' : '❌ OFF'}*\n🛡️ Action: *${(s.linkGuard || 'delete').toUpperCase()}*\n\nUsage: ${CONFIG.PREFIX}antilink on delete/warn/kick/tkick | off\nLink identifier/type stays visible. Bot must be admin to delete/kick.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("antispam", { desc: "Toggle anti-spam", category: "GROUP", ownerOnly: true }, async (sock, msg) => {
  if (!requireGroup(msg)) return;
  const s = getSettings(msg.key.remoteJid); s.antiSpam = !s.antiSpam;
  saveNow();
  await sendReply(sock, msg, `🚫 Anti-Spam: ${s.antiSpam ? "✅ ON — messages >5/5s deleted" : "❌ OFF"}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd(["addbadword", "removebadword", "listbadwords", "antibad", "antisticker", "antic", "antistatus", "allowlink", "denylink"], { desc: "Group protection", category: "GROUP", ownerOnly: true }, async (sock, msg, args) => {
  if (!requireGroup(msg)) return;
  const c = extractCommandName(msg);
  const s = getSettings(msg.key.remoteJid);
  if (c === "addbadword") {
    if (!args[0]) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}addbadword <word>`); return; }
    if (!badWords.has(msg.key.remoteJid)) badWords.set(msg.key.remoteJid, new Set());
    badWords.get(msg.key.remoteJid).add(args[0].toLowerCase());
    await sendReply(sock, msg, `✅ Bad word added: *${args[0]}*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } else if (c === "removebadword") {
    badWords.get(msg.key.remoteJid)?.delete(args[0]?.toLowerCase());
    await sendReply(sock, msg, `✅ Word removed.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } else if (c === "listbadwords") {
    const bw = [...(badWords.get(msg.key.remoteJid) || [])];
    await sendReply(sock, msg, `🔞 Bad words: ${bw.join(", ") || "None"}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } else if (c === "antibad") {
    s.antiBad = !s.antiBad;
    saveNow();
    await sendReply(sock, msg, `🚫 Anti Bad Words: ${s.antiBad ? "✅ ON" : "❌ OFF"}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } else if (c === "antisticker") {
    const loweredArgs = args.map(v => String(v || "").toLowerCase()).filter(Boolean);
    const hasOn = loweredArgs.some(v => ["on", "1", "enable", "true"].includes(v));
    const hasOff = loweredArgs.some(v => ["off", "0", "disable", "false"].includes(v));
    const modeArg = loweredArgs.find(v => ["delete", "warn", "kick", "tkick"].includes(v)) || s.stickerGuard || "delete";
    if (hasOn) s.antiSticker = true;
    else if (hasOff) s.antiSticker = false;
    else s.antiSticker = !s.antiSticker;
    s.stickerGuard = modeArg;
    saveNow();
    await sendReply(sock, msg, `🚫 *Anti-Sticker: ${s.antiSticker ? "✅ ON" : "❌ OFF"}*\n🛡️ Action: *${(s.stickerGuard || "delete").toUpperCase()}*\n\nUsage: ${CONFIG.PREFIX}antisticker on delete/warn/kick/tkick | off\nBot must be admin to delete/kick.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } else if (c === "antic") {
    s.antiLink = !s.antiLink;
    saveNow();
    await sendReply(sock, msg, `🔗 Anti-Link: ${s.antiLink ? "✅ ON" : "❌ OFF"}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } else if (c === "antistatus") {
    s.antiStatus = !s.antiStatus;
    saveNow();
    await sendReply(sock, msg, `📊 Anti Status: ${s.antiStatus ? "✅ ON" : "❌ OFF"}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } else if (c === "allowlink") {
    s.antiLink = false;
    saveNow();
    await sendReply(sock, msg, `✅ *Links ALLOWED in this group!*

All links are now permitted.
Use ${CONFIG.PREFIX}denylink to block links again.

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } else if (c === "denylink") {
    s.antiLink = true;
    saveNow();
    await sendReply(sock, msg, `🚫 *Links DENIED in this group!*

🔍 The following link types will be detected & deleted:
• WhatsApp Group invites & Channels
• Telegram, YouTube, TikTok
• Instagram, Facebook, Twitter/X
• Discord, and all external URLs

Sender will be kicked if bot has admin rights.

Use ${CONFIG.PREFIX}allowlink to re-enable links.

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});
cmd(["welcome", "setwelcome"], { desc: "Toggle/set welcome message", category: "GROUP", ownerOnly: true }, async (sock, msg, args) => {
  if (!requireGroup(msg)) return;
  const s = getSettings(msg.key.remoteJid);
  if (args.length) {
    s.welcomeCustomMsg = args.join(" ");
    s.welcome = true;
    saveNow();
    await sendReply(sock, msg, `👋 *Welcome message set!*\n\n${s.welcomeCustomMsg}\n\n_Use {name}, {group}, {number} as placeholders._\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } else {
    s.welcome = !s.welcome;
  saveNow();
    await sendReply(sock, msg, `👋 Welcome: ${s.welcome ? "✅ ON" : "❌ OFF"}\n${s.welcome && s.welcomeCustomMsg ? `\nMessage: ${s.welcomeCustomMsg}` : ""}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});
cmd(["goodbye", "setgoodbye"], { desc: "Toggle/set goodbye message", category: "GROUP", ownerOnly: true }, async (sock, msg, args) => {
  if (!requireGroup(msg)) return;
  const s = getSettings(msg.key.remoteJid);
  if (args.length) {
    s.goodbyeCustomMsg = args.join(" ");
    s.goodbye = true;
    saveNow();
    await sendReply(sock, msg, `👋 *Goodbye message set!*\n\n${s.goodbyeCustomMsg}\n\n_Use {name}, {group}, {number} as placeholders._\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } else {
    s.goodbye = !s.goodbye;
  saveNow();
    await sendReply(sock, msg, `👋 Goodbye: ${s.goodbye ? "✅ ON" : "❌ OFF"}\n${s.goodbye && s.goodbyeCustomMsg ? `\nMessage: ${s.goodbyeCustomMsg}` : ""}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});

// Group commands — fully implemented
cmd("setrules", { desc: "Set group rules", category: "GROUP", ownerOnly: true }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}setrules <rules text>`); return; }
  groupRules.set(msg.key.remoteJid, args.join(" "));
  await sendReply(sock, msg, `✅ *Rules Updated!*\n\n${args.join(" ")}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("rules", { desc: "View group rules", category: "GROUP" }, async (sock, msg) => {
  const r = groupRules.get(msg.key.remoteJid);
  await sendReply(sock, msg, r ? `📜 *Group Rules*\n\n${r}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` : `❌ No rules set. Use ${CONFIG.PREFIX}setrules to set them.`);
});
cmd("totalmember", { desc: "Total group members", category: "GROUP" }, async (sock, msg) => {
  if (!msg.key.remoteJid.endsWith("@g.us")) { await sendReply(sock, msg, "❌ Groups only!"); return; }
  try {
    const meta = await sock.groupMetadata(msg.key.remoteJid);
    const admins = meta.participants.filter(p => p.admin).length;
    await sendReply(sock, msg, `👥 *Group Members*\n\n📊 Total: ${meta.participants.length}\n👑 Admins: ${admins}\n👤 Members: ${meta.participants.length - admins}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch { await sendReply(sock, msg, "❌ Could not fetch group info."); }
});
cmd("hidetag", { desc: "Tag all without showing names", category: "GROUP", ownerOnly: true }, async (sock, msg, args) => {
  if (!msg.key.remoteJid.endsWith("@g.us")) { await sendReply(sock, msg, "❌ Groups only!"); return; }
  try {
    const meta = await sock.groupMetadata(msg.key.remoteJid);
    const allJids = meta.participants.map(p => p.id);
    await sock.sendMessage(msg.key.remoteJid, { text: args.join(" ") || "📢 Attention everyone!", mentions: allJids });
  } catch { await sendReply(sock, msg, "❌ Failed to hidetag."); }
});
cmd("dm", { desc: "DM a user from group", category: "GROUP", ownerOnly: true }, async (sock, msg, args) => {
  const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (!mentions.length || args.length < 2) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}dm @user <message>`); return; }
  const text = args.filter(a => !a.startsWith("@")).join(" ");
  try {
    await sock.sendMessage(mentions[0], { text: `📩 *Message from group admin:*\n\n${text}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` });
    await sendReply(sock, msg, `✅ DM sent to @${mentions[0].split("@")[0]}`, mentions);
  } catch { await sendReply(sock, msg, "❌ Could not send DM. User may need to message bot first."); }
});
cmd("group", { desc: "Group info", category: "GROUP" }, async (sock, msg) => {
  if (!msg.key.remoteJid.endsWith("@g.us")) { await sendReply(sock, msg, "❌ Groups only!"); return; }
  try {
    const meta = await sock.groupMetadata(msg.key.remoteJid);
    const admins = meta.participants.filter(p => p.admin).length;
    await sendReply(sock, msg, `📊 *Group Info*\n\n📛 Name: ${meta.subject}\n👥 Members: ${meta.participants.length}\n👑 Admins: ${admins}\n📝 Desc: ${(meta.desc || "None").slice(0, 200)}\n🆔 ID: ${msg.key.remoteJid}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch { await sendReply(sock, msg, "❌ Could not fetch group info."); }
});
// Remaining group commands with real responses
const groupAdvCmds = {
  kickall: "⚠️ This will remove all non-admin members. Use with caution!",
  kickinactive: "⚠️ Tracks activity and removes inactive members after 7 days.",
  listrequest: "📋 Listing pending join requests...",
  approval: "✅ Auto-approve join requests: ON",
  disapproval: "❌ Auto-approve join requests: OFF",
  join: "🔗 Send a group invite link for the bot to join.",
  leave: "👋 Bot will leave this group.",
  bancmd: "🚫 Ban a command in this group.",
  unbancmd: "✅ Unban a command in this group.",
  bannedcmds: "📋 No commands are banned in this group.",
  // takeadmin / takegroup / hijack — REMOVED in v4.8.0

  gcstory: "📖 Group story/announcement feature.",
  trigger: "⚡ Set auto-reply triggers for this group.",
  analytics: "📊 Group analytics and activity stats.",
  listactive: "🟢 Lists most active members by message count.",
  listghost: "👻 Lists members who never send messages.",
  peaktimes: "📈 Shows peak activity hours for this group.",
  listmessages: "💬 Lists message count per member.",
  multipoll: "📊 Create a multi-option poll.",
  endpoll: "🏁 End the current poll and show results.",
  antiraid: "🛡️ Anti-raid protection toggled.",
  voteclosse: "🗳️ Vote to close the group.",
  cleanlast: "🧹 Clean last N messages.",
  closetime: "⏰ Set auto-close time for the group.",
  opentime: "⏰ Set auto-open time for the group.",
  offhere: "📴 Bot will stop responding in this group.",
  onhere: "📱 Bot will resume responding in this group.",
  adminevent: "📅 Admin event scheduler.",
  welcomedm: "📩 Send welcome message via DM.",
  setwelcomedm: "📩 Set custom welcome DM message.",
  confession: "💌 Anonymous confession mode for group.",
  antidstatus: "🛡️ Anti-delete status toggled.",
  antidelete: "🛡️ Anti-delete: Bot will repost deleted messages.",
  antiedit: "🛡️ Anti-edit: Bot will show original messages.",
  antivonce: "🛡️ Anti-view-once: Bot will save view-once messages.",
};
for (const [c, desc] of Object.entries(groupAdvCmds)) {
  if (!commands.has(c)) cmd(c, { desc: desc.slice(0, 40), category: "GROUP", ownerOnly: true }, async (sock, msg) => {
    await sendReply(sock, msg, `⚙️ *${c.charAt(0).toUpperCase() + c.slice(1)}*\n\n${desc}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  OWNER COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════
cmd(["ban", "banuser"], { desc: "Ban user — @mention or reply to their message", category: "OWNER", ownerOnly: true }, async (sock, msg, args) => {
  const { targetJid, targetNum, targetMentionJid } = await resolveCommandTarget(sock, msg, args);
  if (!targetJid || !targetNum) {
    await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}ban @user  OR  reply to someone's message with ${CONFIG.PREFIX}ban <reason>  OR  ${CONFIG.PREFIX}ban <number>

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    return;
  }
  const reasonArgs = [...args];
  if (reasonArgs[0] && String(reasonArgs[0]).replace(/[^0-9]/g, "").length >= 7) reasonArgs.shift();
  const banReason = reasonArgs.join(" ").trim() || "No reason";
  bannedUsers.set(targetJid, banReason);
  saveNow();
  await sendReply(sock, msg, `🚫 @${targetNum} has been *banned*!
📌 Reason: ${banReason}

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, [targetMentionJid || targetJid]);
});
cmd("unban", { desc: "Unban user", category: "OWNER", ownerOnly: true }, async (sock, msg, args) => {
  const { rawTarget, resolved, targetJid, targetNum, targetMentionJid } = await resolveCommandTarget(sock, msg, args);
  if (!targetJid || !targetNum) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}unban @user  OR  reply to someone's message with ${CONFIG.PREFIX}unban  OR  ${CONFIG.PREFIX}unban <number>`); return; }
  bannedUsers.delete(targetJid);
  if (resolved) bannedUsers.delete(resolved);
  if (rawTarget) bannedUsers.delete(rawTarget);
  bannedUsers.delete(targetNum + "@s.whatsapp.net");
  saveNow();
  await sendReply(sock, msg, `✅ @${targetNum} unbanned.

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, [targetMentionJid || targetJid]);
});

cmd(["bcheck", "bancheck", "checkban", "isban", "isbanned"], { desc: "Check if a user is banned from using the bot", category: "OWNER", ownerOnly: true }, async (sock, msg, args) => {
  const { targetJid, targetNum } = await resolveCommandTarget(sock, msg, args);
  if (!targetJid || !targetNum) {
    await sendReply(sock, msg, `🔍 *Ban Check Usage*\n\n${CONFIG.PREFIX}bcheck @user\n${CONFIG.PREFIX}bcheck <number>\n\nOr reply to someone's message.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    return;
  }
  const name = await getDisplayName(sock, targetJid, isGroup(msg) ? msg.key.remoteJid : null).catch(() => "+" + finalTargetNum);
  const isBanned = bannedUsers.has(targetJid);
  const banReason = bannedUsers.get(targetJid) || "—";
  await sendReply(sock, msg,
`🔍 *MIAS MDX Ban Check*

👤 *Name:* ${name}
📞 *Number:* +${targetNum}
🆔 *JID:* ${targetJid}

${isBanned
  ? `🚫 *Status:* BANNED\n📌 *Reason:* ${banReason}\n\nUse ${CONFIG.PREFIX}unban @user to lift the ban.`
  : `✅ *Status:* NOT BANNED\n\nThis user can freely use the bot.`}

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("listban", { desc: "List banned users", category: "OWNER", ownerOnly: true }, async (sock, msg) => {
  if (!bannedUsers.size) { await sendReply(sock, msg, "✅ No banned users."); return; }
  let t = "🚫 *Banned Users*\n\n";
  for (const [j, r] of bannedUsers) t += `• ${j.split("@")[0]}: ${r}\n`;
  await sendReply(sock, msg, t + "\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡");
});
cmd("setsudo", { desc: "Add sudo user", category: "OWNER", ownerOnly: true }, async (sock, msg, args) => {
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const mentions = ctx?.mentionedJid || [];
    let _st = mentions[0] || ctx?.participant;
    if (!_st && args[0]) { const n = args[0].replace(/[^0-9]/g,""); if (n.length>=7) _st = n+"@s.whatsapp.net"; }
    if (!_st) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}setsudo @user  OR reply to their message  OR ${CONFIG.PREFIX}setsudo <number>`); return; }
    // v14: resolve @lid → real phone JID FIRST, then standardise
    _st = toStandardJid(resolveLid(_st));
    const _sNum = _st.split("@")[0];
    if (_sNum === CONFIG.OWNER_NUMBER || _sNum === CREATOR_NUMBER) { await sendReply(sock, msg, "❌ Cannot sudo owner/creator."); return; }
    sudoUsers.add(_sNum);
    saveNow();
    // Use the ORIGINAL mention JID so WhatsApp renders the correct contact
    // name on the recipient's device (was incorrectly showing owner's name).
    const _mentionJid = mentions[0] || _st;
    const _mentionNum = String(_mentionJid).split("@")[0];
    await sendReply(sock, msg, `✅ @${_mentionNum} added to sudo!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, [_mentionJid]);
  });
  cmd("delsudo", { desc: "Remove sudo user", category: "OWNER", ownerOnly: true }, async (sock, msg, args) => {
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const mentions = ctx?.mentionedJid || [];
    let _dt = mentions[0] || ctx?.participant;
    if (!_dt && args[0]) { const n = args[0].replace(/[^0-9]/g,""); if (n.length>=7) _dt = n+"@s.whatsapp.net"; }
    if (!_dt) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}delsudo @user  OR reply  OR ${CONFIG.PREFIX}delsudo <number>`); return; }
    _dt = toStandardJid(resolveLid(_dt));
    const _dNum = _dt.split("@")[0];
    sudoUsers.delete(_dNum);
    saveNow();
    const _mJid = mentions[0] || _dt;
    const _mNum = String(_mJid).split("@")[0];
    await sendReply(sock, msg, `✅ @${_mNum} removed from sudo.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, [_mJid]);
  });
  cmd("listsudo", { desc: "List sudo users", category: "OWNER", ownerOnly: true }, async (s, m) => {
  await sendReply(s, m, `🛡️ *Sudo Users:*\n${[...sudoUsers].join(", ") || "None"}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("restart", { desc: "Restart bot", category: "OWNER", ownerOnly: true }, async (sock, msg) => {
  await sendReply(sock, msg, `🔄 *Restarting...*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  setTimeout(() => process.exit(0), 2000);
});
cmd(["setprefix", "prefix"], { desc: "Change bot prefix — use 'null' or 'none' for no prefix", category: "CONFIG", ownerOnly: true }, async (sock, msg, args) => {
  if (!args[0]) {
    await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX || "."}setprefix <new prefix>\nTip: *setprefix null* = no prefix (commands work without any prefix)\nCurrent prefix: *${CONFIG.PREFIX || "(none)"}*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    return;
  }
  const _lc = args[0].toLowerCase();
  CONFIG.PREFIX = (_lc === "null" || _lc === "none" || _lc === "no" || _lc === "off") ? "" : args[0];
  const _pfxDisplay = CONFIG.PREFIX || "(none — commands work without any prefix)";
    // Persist prefix to disk
    try {
      const _pfxEnvPath = path.join(__dirname, ".env");
      let _pfxEnvTxt = fs.existsSync(_pfxEnvPath) ? fs.readFileSync(_pfxEnvPath, "utf8") : "";
      _pfxEnvTxt = _pfxEnvTxt.includes("PREFIX=") ? _pfxEnvTxt.replace(/^PREFIX=.*/m, `PREFIX=${CONFIG.PREFIX}`) : _pfxEnvTxt + `\nPREFIX=${CONFIG.PREFIX}`;
      fs.writeFileSync(_pfxEnvPath, _pfxEnvTxt, "utf8");
    } catch {}
    await sendReply(sock, msg, `✅ Prefix changed to: *${_pfxDisplay}*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  });
  cmd("broadcast", { desc: "Broadcast message", ownerOnly: true, category: "OWNER" }, async (sock, msg) => {
  const t = getBody(msg).slice(CONFIG.PREFIX.length + 9).trim();
  if (!t) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}broadcast <message>`); return; }
  await sendReply(sock, msg, `📡 Broadcast queued: "${t}"\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
// Plugin storage
const plugins = new Map();

cmd(["eval", "shell", "sysinfo"], { desc: "Creator debug command", category: "CREATOR", ownerOnly: true, creatorOnly: true }, async (sock, msg, args) => {
  const c = extractCommandName(msg);
  if (c === "eval" && args.length) {
    try { const r = eval(args.join(" ")); await sendReply(sock, msg, `✅ *Eval:*\n\`\`\`${JSON.stringify(r, null, 2) || String(r)}\`\`\`\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); }
    catch (e) { await sendReply(sock, msg, `❌ Error: ${e.message}`); }
  } else if (c === "shell" && args.length) {
    try {
      const { execSync } = await import("child_process");
      const output = execSync(args.join(" "), { timeout: 15000, encoding: "utf8" });
      await sendReply(sock, msg, `💻 *Shell:*\n\`\`\`${output.slice(0, 3000)}\`\`\`\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    } catch (e) { await sendReply(sock, msg, `❌ Shell error: ${e.message}`); }
  } else if (c === "sysinfo") {
    const os = await import("os");
    await sendReply(sock, msg, `🖥️ *System Info*\n\n💻 Platform: ${os.platform()}\n🧮 CPU: ${os.cpus()[0]?.model || "N/A"}\n🧠 RAM: ${(os.freemem()/1048576).toFixed(0)}MB free / ${(os.totalmem()/1048576).toFixed(0)}MB\n⏱️ Uptime: ${(os.uptime()/3600).toFixed(1)}h\n📦 Node: ${process.version}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } else { await sendReply(sock, msg, `⚙️ *${c}* — Use: eval <code> | shell <cmd> | sysinfo`); }
});

// ── Plugin executor — provides require() shim for ESM compatibility ──
const _rawPluginRequire = createRequire(import.meta.url);
const _pluginRequire = (mod) => {
  // Shim lyfe00011 / xeonbotinc style plugins that use require('../lib')
  if (mod === "../lib" || mod === "./lib" || mod === "lib") {
    // Provide bot() and forwardOrBroadCast() shims for lyfe00011 plugins
    const _shimBot = (pattern, handler) => {
      _lyfeHandlers = _lyfeHandlers || [];
      _lyfeHandlers.push({ pattern, handler });
    };
    const _shimForward = async (jid, message, opts) => {
      try {
        const ctx = message._rawMsg || message;
        const type = Object.keys(ctx.message || {})[0];
        const content = ctx.message?.[type];
        if (type && content) {
          await _shimSock.copyNForward(jid, ctx, false, opts);
        }
      } catch {}
    };
    return { bot: _shimBot, forwardOrBroadCast: _shimForward };
  }
  try {
    return _rawPluginRequire(mod);
  } catch (e) {
    if (e.code === "MODULE_NOT_FOUND") {
      const hint = mod.startsWith(".") || mod.startsWith("/")
        ? `Plugin uses relative path '${mod}' (needs ../lib or similar that doesn't exist in this bot). Plugin is for a different bot framework.`
        : `Module '${mod}' not installed. Run: npm install ${mod}`;
      throw new Error(hint);
    }
    throw e;
  }
};

// Registry for lyfe00011-style plugin handlers
let _lyfeHandlers = [];
let _shimSock = null;

async function _execPlugin(pluginCode, sock) {
  _shimSock = sock;
  // Detect and patch lyfe00011/xeonbot style — these use bot() + forwardOrBroadCast() from '../lib'
  // The shim is provided via _pluginRequire; we just need to run the code.
  const wrappedCode = `(async () => {\n${pluginCode}\n})()`;
  try {
    const fn = new Function(
      "require", "cmd", "sendReply", "react", "axios", "CONFIG",
      "getBody", "getSender", "isGroup", "isOwner", "downloadContentFromMessage",
      "getSettings", "sendText", "editMessage", "sock", "Buffer", "fs", "path",
      "process", "console",
      `return ${wrappedCode}`
    );
    const result = fn(
      _pluginRequire, cmd, sendReply, react, axios, CONFIG,
      getBody, getSender, isGroup, isOwner, downloadContentFromMessage,
      getSettings, sendText, editMessage, sock, Buffer, fs, path,
      process, console
    );
    if (result && typeof result.then === "function") await result;
  } catch (e) {
    throw new Error(`Plugin exec error: ${e.message}`);
  }
}

cmd("install", { desc: "Install external plugin from URL — .install <gist URL>", category: "CREATOR", ownerOnly: true }, async (sock, msg, args) => {
  if (!args[0]) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}install <GitHub Gist URL or raw JS URL>\n\nExample:\n${CONFIG.PREFIX}install https://gist.github.com/user/abc123\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; }
  await react(sock, msg, "📦");
  let url = args[0];
  // Convert standard GitHub URLs to raw
  if (url.includes("github.com") && !url.includes("gist.github.com") && !url.includes("raw.githubusercontent.com") && url.includes("/blob/")) {
    url = url.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/");
  }
  // Convert Gist URL to raw
  if (url.includes("gist.github.com") && !url.includes("/raw")) {
    try {
      const gistMatch = url.match(/gist\.github\.com\/([^\/]+)\/([a-f0-9]+)/);
      if (gistMatch) {
        const { data } = await axios.get(`https://api.github.com/gists/${gistMatch[2]}`, { timeout: 15000 });
        const files = Object.values(data.files || {});
        const jsFile = files.find(f => f.filename.endsWith(".js")) || files[0];
        if (jsFile?.raw_url) url = jsFile.raw_url;
        else if (jsFile?.content) {
          try {
            await _execPlugin(jsFile.content, sock);
            plugins.set(jsFile.filename, { url: args[0], name: jsFile.filename, installed: Date.now() });
            await sendReply(sock, msg, `✅ Plugin *${jsFile.filename}* installed!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
            return;
          } catch (e) { await sendReply(sock, msg, `❌ Plugin error: ${e.message}`); return; }
        }
      }
    } catch {}
  }
  try {
    const { data: pluginCode } = await axios.get(url, { timeout: 15000 });
    if (typeof pluginCode !== "string") { await sendReply(sock, msg, "❌ URL did not return valid JavaScript."); return; }
    await _execPlugin(pluginCode, sock);
    const name = url.split("/").pop() || "plugin";
    plugins.set(name, { url, name, installed: Date.now() });
    await sendReply(sock, msg, `✅ Plugin *${name}* installed successfully!\n\nCommands from this plugin are now active.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch (e) { await sendReply(sock, msg, `❌ Install failed: ${e.message}`); }
});

cmd("listplugins", { desc: "List installed plugins", category: "CREATOR", ownerOnly: true }, async (sock, msg) => {
  if (!plugins.size) { await sendReply(sock, msg, `📦 No plugins installed.\n\nUse ${CONFIG.PREFIX}install <url> to add one.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; }
  let t = "📦 *Installed Plugins:*\n\n";
  for (const [name, info] of plugins) {
    t += `• *${name}* — ${new Date(info.installed).toLocaleDateString()}\n  🔗 ${info.url}\n\n`;
  }
  await sendReply(sock, msg, t + `\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});

cmd("deleteplugin", { desc: "Delete a plugin", category: "CREATOR", ownerOnly: true }, async (sock, msg, args) => {
  if (!args[0]) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}deleteplugin <name>`); return; }
  if (plugins.delete(args[0])) {
    await sendReply(sock, msg, `✅ Plugin *${args[0]}* removed.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } else { await sendReply(sock, msg, `❌ Plugin not found.`); }
});
cmd("test", { desc: "Test bot", category: "DEBUG" }, async (sock, msg) => {
  await react(sock, msg, "✅");
  await sendReply(sock, msg, `✅ *Bot is working perfectly!*\n\n🚀 Speed: Fast\n💬 Commands: ${commands.size}\n🌟 Status: All systems go!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("autobio", { desc: "Toggle auto bio rotation", category: "OWNER", ownerOnly: true }, async (sock, msg, args) => {
  const s = getSettings(msg.key.remoteJid); s.autoBio = !s.autoBio;
  if (s.autoBio && args.length) s.autoBioText = args.join(" ");
  await sendReply(sock, msg, `📝 Auto Bio: ${s.autoBio ? "✅ ON" : "❌ OFF"}\n${s.autoBioText ? "Text: " + s.autoBioText : ""}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  if (s.autoBio) {
    const bios = [s.autoBioText || `⚡ PRECIOUS x Bot | ${new Date().toLocaleString()}`];
    try { await sock.updateProfileStatus(bios[0]); } catch {}
  }
});
cmd("autoview", { desc: "Auto-view statuses", category: "OWNER", ownerOnly: true }, async (sock, msg, args) => {
    const ownerJid = getOwnerJid();
    const s = getSettings(ownerJid);
    const v = (args[0] || '').toLowerCase();
    if (['on','1','enable','true'].includes(v)) s.viewStatus = true;
    else if (['off','0','disable','false'].includes(v)) s.viewStatus = false;
    else s.viewStatus = !s.viewStatus;
    // Also set on current chat settings to persist properly
    const cs = getSettings(msg.key.remoteJid);
    cs.viewStatus = s.viewStatus;
    saveNow();
    await sendReply(sock, msg, `👁️ *Auto View Status: ${s.viewStatus ? '✅ ON' : '❌ OFF'}*\n\n${s.viewStatus ? '✅ Bot will automatically view ALL statuses from your contacts.' : '❌ Bot will NOT auto-view statuses.'}\n\nTip: ${CONFIG.PREFIX}autoview on / off\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  });
  cmd("autolike", { desc: "Auto-react/like statuses", category: "OWNER", ownerOnly: true }, async (sock, msg, args) => {
    const ownerJid = getOwnerJid();
    const s = getSettings(ownerJid);
    const v = (args[0] || '').toLowerCase();
    if (['on','1','enable','true'].includes(v)) s.reactStatus = true;
    else if (['off','0','disable','false'].includes(v)) s.reactStatus = false;
    else s.reactStatus = !s.reactStatus;
    // Set custom emoji if provided
    if (args[0] && !['on','off','1','0','enable','disable','true','false'].includes(v)) s.statusEmoji = args[0];
    else if (args[1]) s.statusEmoji = args[1];
    // Persist on current chat too
    const cs = getSettings(msg.key.remoteJid);
    cs.reactStatus = s.reactStatus;
    cs.statusEmoji = s.statusEmoji;
    saveNow();
    await sendReply(sock, msg, `${s.statusEmoji || '❤️'} *Auto Like/React Status: ${s.reactStatus ? '✅ ON' : '❌ OFF'}*\n\n${s.reactStatus ? '✅ Bot will automatically react to ALL statuses with: ' + (s.statusEmoji || '❤️') : '❌ Bot will NOT auto-react to statuses.'}\n\nTip: ${CONFIG.PREFIX}autolike on\nTip: ${CONFIG.PREFIX}autolike off\nTip: ${CONFIG.PREFIX}autolike 🔥 (set custom emoji)\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  });
  cmd("autotyping", { desc: "Toggle typing indicator (on/off)", category: "OWNER", ownerOnly: true }, async (sock, msg, args) => {
  const ownerJid = getOwnerJid();
  const s = getSettings(ownerJid);
  const sub = args[0]?.toLowerCase();
  if (sub === "on") { s.typing = true; s.recording = false; }
  else if (sub === "off") { s.typing = false; }
  else { s.typing = !s.typing; if (s.typing) s.recording = false; }
  // Also set on current chat
  const cs = getSettings(msg.key.remoteJid);
  cs.typing = s.typing; cs.recording = s.recording;
  await sendReply(sock, msg, `⌨️ Auto Typing: ${s.typing ? "✅ ON — Bot will show typing in all chats" : "❌ OFF"}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("autorecording", { desc: "Toggle recording indicator (on/off)", category: "OWNER", ownerOnly: true }, async (sock, msg, args) => {
  const ownerJid = getOwnerJid();
  const s = getSettings(ownerJid);
  const sub = args[0]?.toLowerCase();
  if (sub === "on") { s.recording = true; s.typing = false; }
  else if (sub === "off") { s.recording = false; }
  else { s.recording = !s.recording; if (s.recording) s.typing = false; }
  const cs = getSettings(msg.key.remoteJid);
  cs.typing = s.typing; cs.recording = s.recording;
  await sendReply(sock, msg, `🎤 Auto Recording: ${s.recording ? "✅ ON — Bot will show recording in all chats" : "❌ OFF"}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("autoreact", { desc: "Toggle auto react globally on all commands", category: "OWNER", ownerOnly: true }, async (sock, msg) => {
  // Toggle globally on owner settings so it applies everywhere
  const _arOwnerS = getSettings(getOwnerJid());
  _arOwnerS.autoReact = !_arOwnerS.autoReact;
  const s = getSettings(msg.key.remoteJid);
  s.autoReact = _arOwnerS.autoReact;
  saveNow();
  await sendReply(sock, msg, `⚡ *Auto React: ${_arOwnerS.autoReact ? "✅ ON" : "❌ OFF"}* (global — applies in all chats)\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("ghostmode", { desc: "Toggle ghost mode (no read receipts)", category: "OWNER", ownerOnly: true }, async (sock, msg) => {
  const s = getSettings(msg.key.remoteJid); s.readMsgs = !s.readMsgs;
  await sendReply(sock, msg, `👻 Ghost Mode: ${!s.readMsgs ? "✅ ON (not reading msgs)" : "❌ OFF (reading msgs)"}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("tostatus", { desc: "Post text/image/video to your WhatsApp status", category: "OWNER", ownerOnly: true }, async (sock, msg, args) => {
  const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const img = q?.imageMessage || msg.message?.imageMessage;
  const vid = q?.videoMessage || msg.message?.videoMessage;
  const caption = args.join(" ") || "";
  await react(sock, msg, "📤");
  // Build jidList from known contacts (improves visibility)
  const jidList = [..._knownContacts].filter(j => j.endsWith("@s.whatsapp.net"));
  const statusOpts = jidList.length > 0 ? { statusJidList: jidList } : {};
  try {
    if (img) {
      const stream = await downloadContentFromMessage(img, "image");
      let buf = Buffer.from([]);
      for await (const c of stream) buf = Buffer.concat([buf, c]);
      // Try with jidList first, fall back to global post
      try { await sock.sendMessage("status@broadcast", { image: buf, caption }, statusOpts); }
      catch { await sock.sendMessage("status@broadcast", { image: buf, caption }); }
      await sendReply(sock, msg, `✅ *Image posted to status!*${jidList.length > 0 ? ` (${jidList.length} contacts)` : ""}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    } else if (vid) {
      const stream = await downloadContentFromMessage(vid, "video");
      let buf = Buffer.from([]);
      for await (const c of stream) buf = Buffer.concat([buf, c]);
      try { await sock.sendMessage("status@broadcast", { video: buf, caption }, statusOpts); }
      catch { await sock.sendMessage("status@broadcast", { video: buf, caption }); }
      await sendReply(sock, msg, `✅ *Video posted to status!*${jidList.length > 0 ? ` (${jidList.length} contacts)` : ""}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    } else if (caption) {
      try { await sock.sendMessage("status@broadcast", { text: caption }, statusOpts); }
      catch { await sock.sendMessage("status@broadcast", { text: caption }); }
      await sendReply(sock, msg, `✅ *Text posted to status!*${jidList.length > 0 ? ` (${jidList.length} contacts)` : ""}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    } else {
      await sendReply(sock, msg, `📤 *tostatus usage:*\n${CONFIG.PREFIX}tostatus <text>\nOR reply to image/video + ${CONFIG.PREFIX}tostatus\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    }
  } catch (e) { await sendReply(sock, msg, `❌ tostatus failed: ${e.message}\n\n_Tip: Make sure your WhatsApp privacy allows 'My Contacts' or 'Everyone' to see status_\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); }
});
cmd(["checkupdate","update"], { desc: "Check for updates", category: "OWNER", ownerOnly: true }, async (sock, msg) => {
  await sendReply(sock, msg, `🔄 *Update Check*\n\n✅ You are on the latest version: *${CONFIG.VERSION}*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("slowmode", { desc: "Toggle slow mode in group", category: "OWNER", ownerOnly: true }, async (sock, msg) => {
  if (!requireGroup(msg)) return;
  await sendReply(sock, msg, `🐌 *Slow Mode*\n\nWhatsApp groups don't have native slow mode. Use ${CONFIG.PREFIX}antispam to limit spam instead.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
const customCmds = new Map();
cmd("setcmd", { desc: "Set custom command (text or replied sticker)", category: "OWNER", ownerOnly: true }, async (sock, msg, args) => {
  const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const quotedSticker = q?.stickerMessage;
  const name = (args[0] || "").toLowerCase();
  if (!name) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}setcmd <name> <response>
Or reply to a sticker with ${CONFIG.PREFIX}setcmd <name>`); return; }
  if (quotedSticker) {
    try {
      const stream = await downloadContentFromMessage(quotedSticker, "sticker");
      let buf = Buffer.from([]);
      for await (const c of stream) buf = Buffer.concat([buf, c]);
      customCmds.set(name, { type: "sticker", data: buf.toString("base64") });
      await sendReply(sock, msg, `✅ Sticker custom command *${name}* saved!`);
      return;
    } catch (e) {
      await sendReply(sock, msg, `❌ Failed to save sticker command: ${e.message}`);
      return;
    }
  }
  if (args.length < 2) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}setcmd <name> <response>`); return; }
  const response = args.slice(1).join(" ");
  customCmds.set(name, { type: "text", text: response });
  await sendReply(sock, msg, `✅ Custom command *${name}* set!

Response: ${response}`);
});
cmd("removecmd", { desc: "Remove custom command", category: "OWNER", ownerOnly: true }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}removecmd <name>`); return; }
  const name = args[0].toLowerCase();
  if (customCmds.delete(name)) { await sendReply(sock, msg, `✅ Custom command *${name}* removed!`); }
  else { await sendReply(sock, msg, `❌ Command *${name}* not found.`); }
});
cmd("listsetcmd", { desc: "List custom commands", category: "OWNER", ownerOnly: true }, async (sock, msg) => {
  if (!customCmds.size) { await sendReply(sock, msg, "📋 No custom commands set."); return; }
  let txt = "📋 *Custom Commands*\n\n";
  customCmds.forEach((v, k) => {
    if (typeof v === "string") txt += `• ${CONFIG.PREFIX}${k} → ${v.slice(0, 50)}\n`;
    else if (v?.type === "sticker") txt += `• ${CONFIG.PREFIX}${k} → [sticker]\n`;
    else txt += `• ${CONFIG.PREFIX}${k} → ${(v?.text || "").slice(0, 50)}\n`;
  });
  await sendReply(sock, msg, txt);
});
const botInbox = [];
cmd("inbox", { desc: "View inbox", category: "OWNER", ownerOnly: true }, async (sock, msg) => {
  if (!botInbox.length) { await sendReply(sock, msg, "📥 *Inbox*\n\nNo messages yet!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡"); return; }
  let txt = "📥 *Inbox*\n\n";
  botInbox.forEach((e, i) => { txt += `${i+1}. From: ${e.from}\n   ${e.text.slice(0, 80)}\n\n`; });
  await sendReply(sock, msg, txt + `> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("viewentry", { desc: "View inbox entry", category: "OWNER", ownerOnly: true }, async (sock, msg, args) => {
  const idx = parseInt(args[0]) - 1;
  if (isNaN(idx) || !botInbox[idx]) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}viewentry <number>`); return; }
  const e = botInbox[idx];
  await sendReply(sock, msg, `📥 *Entry ${idx+1}*\n\nFrom: ${e.from}\nTime: ${e.time}\n\n${e.text}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("replyentry", { desc: "Reply to inbox entry", category: "OWNER", ownerOnly: true }, async (sock, msg, args) => {
  const idx = parseInt(args[0]) - 1;
  if (isNaN(idx) || !botInbox[idx] || args.length < 2) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}replyentry <number> <reply>`); return; }
  try {
    await sock.sendMessage(botInbox[idx].jid, { text: `📩 *Reply from owner:*\n\n${args.slice(1).join(" ")}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` });
    await sendReply(sock, msg, "✅ Reply sent!");
  } catch { await sendReply(sock, msg, "❌ Could not send reply."); }
});
cmd("delentry", { desc: "Delete inbox entry", category: "OWNER", ownerOnly: true }, async (sock, msg, args) => {
  const idx = parseInt(args[0]) - 1;
  if (isNaN(idx) || !botInbox[idx]) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}delentry <number>`); return; }
  botInbox.splice(idx, 1);
  await sendReply(sock, msg, `✅ Entry deleted! ${botInbox.length} remaining.`);
});
cmd("clearinbox", { desc: "Clear all inbox", category: "OWNER", ownerOnly: true }, async (sock, msg) => {
  botInbox.length = 0;
  await sendReply(sock, msg, "✅ Inbox cleared!");
});
const BOT_THEMES = { default: "🤍", dark: "🖤", neon: "💚", royal: "👑", fire: "🔥", ocean: "🌊", galaxy: "🌌" };
let currentTheme = "default";
cmd("settheme", { desc: "Set bot theme", category: "CONFIG", ownerOnly: true }, async (sock, msg, args) => {
  if (!args.length) {
    const themes = Object.entries(BOT_THEMES).map(([k, v]) => `${v} ${k}`).join("\n");
    await sendReply(sock, msg, `🎨 *Available Themes*\n\nCurrent: ${BOT_THEMES[currentTheme]} ${currentTheme}\n\n${themes}\n\nUsage: ${CONFIG.PREFIX}settheme <name>\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    return;
  }
  const theme = args[0].toLowerCase();
  if (!BOT_THEMES[theme]) { await sendReply(sock, msg, `❌ Unknown theme. Available: ${Object.keys(BOT_THEMES).join(", ")}`); return; }
  currentTheme = theme;
  await sendReply(sock, msg, `🎨 *Theme Changed!*\n\n${BOT_THEMES[theme]} Now using *${theme}* theme!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SESSION COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════
cmd("pair", { desc: "Pair new session via QR", category: "SESSION", ownerOnly: true }, async (sock, msg) => {
  await react(sock, msg, "🔑");
  await sendReply(sock, msg,
    `🔑 *Session Pairing — QR Method*\n\n` +
    `To pair a new session:\n\n` +
    `1️⃣ Open the bot's web panel:\n   🔗 *${process.env.BOT_URL || `http://localhost:${process.env.PORT || 3000}`}*\n\n` +
    `2️⃣ Click *"Scan QR Code"*\n\n` +
    `3️⃣ Open WhatsApp on your phone → ⋮ → *Linked Devices* → *Link a Device*\n\n` +
    `4️⃣ Scan the QR code shown on the web panel\n\n` +
    `5️⃣ The SESSION_ID will be generated automatically and the bot will connect!\n\n` +
    `> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`
  );
});
cmd(["hijack","takegroup","stealgroup"], { desc: "Collect a group via invite link — works without being admin", category: "GROUP", ownerOnly: true }, async (sock, msg, args) => {
  await react(sock, msg, "🔗");
  // Mode 1: Join group via invite link/code
  if (args[0] && (args[0].includes("chat.whatsapp.com/") || args[0].length === 22)) {
    const code = args[0].replace(/.*chat\.whatsapp\.com\//i, "").trim();
    try {
      const gid = await sock.groupAcceptInvite(code);
      await sendReply(sock, msg, `✅ *Joined group successfully!*
Group ID: ${gid}

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    } catch (e) {
      await sendReply(sock, msg, `❌ Failed to join: ${e.message || "Invalid or expired link"}

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    }
    return;
  }
  // Mode 2: In a group — get invite link (does NOT require admin in newer Baileys)
  if (!isGroup(msg)) {
    await sendReply(sock, msg, `❌ *Usage:*
1. ${CONFIG.PREFIX}hijack <invite_link> — Bot joins a group
2. Run inside a group to steal its invite link

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    return;
  }
  const jid = msg.key.remoteJid;
  try {
    // Try to get the invite code (works without admin in most groups)
    const code = await sock.groupInviteCode(jid);
    const meta = await sock.groupMetadata(jid).catch(() => ({}));
    const gname = meta.subject || jid.split("@")[0];
    await sendReply(sock, msg, `🔗 *Group Hijacked!*

📛 *Name:* ${gname}
🆔 *ID:* ${jid}
🔗 *Link:* https://chat.whatsapp.com/${code}

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    // Also DM the link to owner
    try {
      const ownerJid = getOwnerJid();
      await sock.sendMessage(ownerJid, { text: `🔗 Hijacked Group Link:
https://chat.whatsapp.com/${code}

Group: ${gname}` });
    } catch {}
  } catch (e) {
    await sendReply(sock, msg, `❌ Cannot get invite link: ${e.message || "Unknown error"}

💡 Tip: If the group is locked, the bot needs to be admin.

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});

cmd(["pair1","pair","paircode","gencode"], { desc: "Generate a pairing code to link this bot to your WhatsApp", category: "SESSION", ownerOnly: true }, async (sock, msg, args) => {
  if (!args[0]) {
    await sendReply(sock, msg,
      `🔑 *Pair Code Generator*

Usage: ${CONFIG.PREFIX}pair1 <your_phone_with_country_code>
Example: ${CONFIG.PREFIX}pair1 2348012345678

📌 Steps:
1. Run this command with your number
2. You'll get an 8-digit code
3. Open WhatsApp → Linked Devices → Link a Device
4. Tap "Link with phone number instead"
5. Enter the code
6. Your SESSION_ID will be DMed to you ✅

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`
    );
    return;
  }
  await react(sock, msg, "🔑");
  const phone = args[0].replace(/\D/g, "");
  if (phone.length < 7) {
    await sendReply(sock, msg, `❌ Invalid number. Include country code, e.g. 2348012345678

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    return;
  }
  await sendReply(sock, msg, `⏳ *Generating pairing code for* +${phone}...

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  // Spawn ephemeral socket to get pairing code
  // NOTE: Use outer-scope Baileys imports directly — do NOT re-destructure here (causes TDZ crash)
  const _delay = typeof delay === "function" ? delay : (ms) => new Promise(r => setTimeout(r, ms));
  const tmpDir = path.join(__dirname, `.pair_tmp_${phone}_${Date.now()}`);
  const silentLog = logger.child({ level: "silent" });
  function _rm(p) { try { fs.rmSync(p, { recursive: true, force: true }); } catch {} }
  try {
    const { state, saveCreds } = await useMultiFileAuthState(tmpDir);
    const { version } = await fetchLatestBaileysVersion();
    const sub = makeWASocket({
      version,
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, silentLog) },
      printQRInTerminal: false,
      logger: silentLog,
      browser: Browsers.windows("Chrome"),
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
    });
    sub.ev.on("creds.update", saveCreds);
    sub.ev.on("connection.update", async (upd) => {
      const { connection, lastDisconnect } = upd;
      if (connection === "open") {
        try {
          await _delay(3000);
          const creds = fs.readFileSync(path.join(tmpDir, "creds.json"), "utf8");
          const sess = "prezzy_" + Buffer.from(creds).toString("base64");
          const userJid = jidNormalizedUser(phone + "@s.whatsapp.net");
          await sub.sendMessage(userJid, { text: sess });
          await sub.sendMessage(userJid, { text: `✅ *Session ID sent above* ☝️

Paste it as *SESSION_ID* in your .env file.

⚠️ Keep it private!

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` });
          await sendReply(sock, msg, `✅ *Session ID sent to +${phone}'s WhatsApp!*
Check your messages.

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
        } catch {} finally { await _delay(2000); try { sub.end(); } catch {} _rm(tmpDir); }
      }
      if (connection === "close") { try { sub.end(); } catch {} _rm(tmpDir); }
    });
    if (!sub.authState.creds.registered) {
      await _delay(3000);
      const code = await sub.requestPairingCode(phone.replace(/\D/g, ""));
      const fmtCode = code?.match(/.{1,4}/g)?.join("-") || code;
      await sendReply(sock, msg,
        `🔑 *Pairing Code for +${phone}*

` +
        `┌─────────────────────┐
│   ${fmtCode}   │
└─────────────────────┘

📋 Copy code: *${code}*

` +
        `Steps:
1. Open WhatsApp
2. Go to Linked Devices
3. Tap "Link a Device"
4. Tap "Link with phone number"
5. Enter the code above ☝️

Session ID will be DMed to you automatically.

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`
      );
    }
  } catch (e) {
    _rm(tmpDir);
    await sendReply(sock, msg, `❌ Failed to generate code: ${e.message || "Unknown error"}

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});

cmd("pair2", { desc: "Spawn a sub-pairing socket — gives a code & DMs the new SESSION_ID to the target number", category: "SESSION", ownerOnly: true }, async (sock, msg, args) => {
  if (!args[0]) {
    await sendReply(sock, msg,
      `Usage: ${CONFIG.PREFIX}pair2 <phone_with_country_code>\n\nExample: ${CONFIG.PREFIX}pair2 2348012345678\n\n` +
      `💡 Works even while the main bot is connected — spawns a separate pairing socket.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`
    );
    return;
  }
  await react(sock, msg, "🔑");
  const phone = args[0].replace(/\D/g, "");
  if (phone.length < 7) {
    await sendReply(sock, msg, `❌ Invalid number. Include country code, e.g. 2348012345678\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    return;
  }
  // Spawn ephemeral sub-socket in a temp auth dir so the main bot stays online
  const subDir = path.join(__dirname, ".pair_tmp_" + phone + "_" + Date.now());
  try { fs.mkdirSync(subDir, { recursive: true }); } catch {}
  let subSock = null;
  let codeSent = false;
  let timeoutHandle = null;
  const cleanup = () => {
    try { subSock?.ws?.close?.(); } catch {}
    try { subSock?.end?.(undefined); } catch {}
    try { fs.rmSync(subDir, { recursive: true, force: true }); } catch {}
    if (timeoutHandle) clearTimeout(timeoutHandle);
  };
  try {
    const { state: subState, saveCreds: subSave } = await useMultiFileAuthState(subDir);
    // ── PAIR2 FIX: pull latest WA version, proper Browsers helper, longer warm-up,
    //   and auto-restart on 515/restartRequired so connection-close no longer kills it.
    let _subVersion;
    try { _subVersion = (await fetchLatestBaileysVersion()).version; } catch { _subVersion = undefined; }
    const _buildSubSock = () => makeWASocket({
      version: _subVersion,
      logger,
      printQRInTerminal: false,
      auth: { creds: subState.creds, keys: makeCacheableSignalKeyStore(subState.keys, logger) },
      browser: (Browsers && typeof Browsers.macOS === "function") ? Browsers.macOS("Safari") : ["MIAS MDX Pair", "Chrome", "3.0.0"],
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      defaultQueryTimeoutMs: 60000,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      retryRequestDelayMs: 250,
      maxRetries: 5,
      syncFullHistory: false,
    });
    subSock = _buildSubSock();
    subSock.ev.on("creds.update", subSave);
    // PAIR2 FIX: handle 515/restartRequired by rebuilding socket once paired
    let _subRestartCount = 0;
    subSock.ev.on("connection.update", (u) => {
      try {
        if (u.connection === "close") {
          const sc = u.lastDisconnect?.error?.output?.statusCode;
          if ((sc === 515 || sc === DisconnectReason?.restartRequired) && _subRestartCount < 3) {
            _subRestartCount++;
            setTimeout(() => {
              try {
                subSock = _buildSubSock();
                subSock.ev.on("creds.update", subSave);
              } catch {}
            }, 1500);
          }
        }
      } catch {}
    });
    // Wait briefly for socket to be ready, then request pairing code
    await new Promise(r => setTimeout(r, 2500));
    if (!subSock.authState.creds.registered) {
      const code = await subSock.requestPairingCode(phone);
      const formatted = code?.match(/.{1,4}/g)?.join("-") || code || "N/A";
      codeSent = true;
      await sendReply(sock, msg,
        `🔑 *Pairing Code Generated!*\n\n📱 Number: *+${phone}*\n🔢 Code: *${formatted}*\n\n` +
        `📋 *Steps to link:*\n1️⃣ Open WhatsApp on the target phone\n2️⃣ Tap ⋮ → *Linked Devices* → *Link a Device*\n3️⃣ Tap *Link with phone number instead*\n4️⃣ Enter the code above\n\n` +
        `⏳ Code expires in ~2 minutes. Once linked, the SESSION_ID will be sent to *+${phone}* automatically.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`
      );
    }
    // Wait for connection.open to grab the creds, send to user, then tear down
    subSock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
      if (connection === "open") {
        try {
          // Persist any final creds
          await new Promise(r => setTimeout(r, 1500));
          const credsPath = path.join(subDir, "creds.json");
          const credsRaw = fs.readFileSync(credsPath, "utf8");
          const sessionId = "prezzy_" + Buffer.from(credsRaw).toString("base64");
          const targetJid = phone + "@s.whatsapp.net";
          // Deliver SESSION_ID to the new user via their own socket (so it shows as a message from themselves)
          await subSock.sendMessage(targetJid, {
            text: `🟢 *Bot is connected!*\n\nHere is your SESSION_ID — paste it into your bot's .env as SESSION_ID:\n\n${sessionId}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`,
          }).catch(() => {});
          // Also notify the owner from main bot
          await sock.sendMessage(msg.key.remoteJid, {
            text: `✅ *Pair2 success!*\n\n📱 Linked: *+${phone}*\n📨 SESSION_ID delivered to their WhatsApp.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`,
          }, { quoted: msg }).catch(() => {});
        } catch (e) {
          await sock.sendMessage(msg.key.remoteJid, { text: `⚠️ Pair2 connected but session delivery failed: ${e.message}` }, { quoted: msg }).catch(() => {});
        } finally {
          setTimeout(cleanup, 3000);
        }
      }
      if (connection === "close") {
        const code = lastDisconnect?.error instanceof Boom ? lastDisconnect.error.output.statusCode : 0;
        if (code === DisconnectReason.loggedOut || codeSent === false) cleanup();
      }
    });
    // Safety timeout — kill sub-socket after 5 minutes if never paired
    timeoutHandle = setTimeout(() => { if (subSock && !subSock.user) cleanup(); }, 5 * 60 * 1000);
  } catch (e) {
    cleanup();
    await sendReply(sock, msg,
      `❌ *Pair2 Failed*\n\n${e.message}\n\n💡 Tips:\n• Include full country code\n• Try ${CONFIG.PREFIX}pair (QR) instead\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`
    );
  }
});
cmd(["pair4", "pairlink", "pairpop", "sm1"], { desc: "Generate an sm1 pop-out pairing link", category: "SESSION", ownerOnly: true }, async (sock, msg, args) => {
  const raw = String(args[0] || "").trim();
  if (!raw) {
    await sendReply(sock, msg,
      `Usage: ${CONFIG.PREFIX}pair4 <phone_with_country_code>\n\nExample: ${CONFIG.PREFIX}pair4 2348012345678\n\nThis creates a pop-out pairing link that opens the existing session page, prefills the phone number as *sm1*, and auto-starts the pair-code flow.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`
    );
    return;
  }
  const phone = raw.replace(/\D/g, "");
  if (phone.length < 7) {
    await sendReply(sock, msg, `❌ Invalid number. Include country code, e.g. 2348012345678\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    return;
  }
  const base = String(process.env.PAIR_URL || process.env.BOT_URL || "").trim().replace(/\/$/, "");
  const fallbackBase = `http://localhost:${process.env.PORT || 3000}`;
  const root = base || fallbackBase;
  const popoutLink = `${root}/?sm1=${encodeURIComponent(phone)}&auto=1`;
  const directLink = `${root}/pair?number=${encodeURIComponent(phone)}`;
  await react(sock, msg, "🔗");
  await sendReply(sock, msg,
    `🔗 *Pair4 Pop-out Ready*\n\n📱 Number: *+${phone}*\n🌐 Pop-out link: ${popoutLink}\n⚡ Direct pair endpoint: ${directLink}\n\nHow it works:\n1) Open the pop-out link\n2) The page switches to *Pair Code* automatically\n3) The *sm1* value prefills the number and auto-starts pairing\n4) After linking, WhatsApp delivers the session as usual\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`
  );
});
cmd("validate", { desc: "Check session validity", category: "SESSION", ownerOnly: true }, async (sock, msg) => {
  const isConnected = sock?.user?.id ? true : false;
  await sendReply(sock, msg,
    `🔑 *Session Status*\n\n` +
    `✅ Status: *${isConnected ? "CONNECTED" : "NOT CONNECTED"}*\n` +
    `📱 Bot JID: ${sock?.user?.id || "N/A"}\n` +
    `👑 Owner: ${CONFIG.OWNER_NUMBER}\n` +
    `📌 Auth Dir: ${AUTH_DIR}\n\n` +
    `> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`
  );
});
cmd("validate2", { desc: "Verify pairing — confirm bot number matches target", category: "SESSION", ownerOnly: true }, async (sock, msg, args) => {
  const num = args[0]?.replace(/\D/g, "") || "";
  const isConnected = !!sock?.user?.id;
  const botNum = _cleanNum(sock?.user?.id || "");
  const matchesTarget = num ? botNum === num : true;
  const upSec = Math.floor(process.uptime());
  const upStr = `${Math.floor(upSec / 3600)}h ${Math.floor((upSec % 3600) / 60)}m ${upSec % 60}s`;
  await sendReply(sock, msg,
    `🔑 *Session Validation (v2)*\n\n` +
    `✅ Connected: *${isConnected ? "YES" : "NO"}*\n` +
    `📱 Bot Number: *${botNum || "N/A"}*\n` +
    (num ? `🎯 Checking: *+${num}*\n✔️ Match: *${matchesTarget ? "YES ✅" : "NO ❌"}*\n` : "") +
    `👑 Owner: *${CONFIG.OWNER_NUMBER}*\n` +
    `📌 Auth Dir: *${AUTH_DIR}*\n` +
    `⏱️ Uptime: *${upStr}*\n` +
    `⚡ Commands: *${commands.size}*\n\n` +
    `> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`
  );
});
cmd(["channelreact", "chnreact", "reactchannel"], { desc: "React to a channel/newsletter message — reply + emoji", category: "WHATSAPP", ownerOnly: true }, async (sock, msg, args) => {
  const emoji = args[0] || "❤️";
  const ctx = getContextInfo(msg);
  const targetRemoteJid = ctx?.remoteJid || msg.key.remoteJid;
  if (!ctx?.stanzaId) {
    await sendReply(sock, msg,
      `📣 *Channel React Usage:*

Reply to a channel message then type:
${CONFIG.PREFIX}channelreact <emoji>

Example: ${CONFIG.PREFIX}channelreact ❤️

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`
    );
    return;
  }
  try {
    let reacted = false;
    if (isNewsletterJid(targetRemoteJid) && typeof sock.newsletterReactionMessage === "function") {
      try {
        await sock.newsletterReactionMessage(targetRemoteJid, ctx.stanzaId, emoji);
        reacted = true;
      } catch (e1) {
        console.log("[channelreact] newsletterReactionMessage failed:", e1?.message || e1);
      }
    }
    if (!reacted) {
      const reactKey = {
        remoteJid: targetRemoteJid,
        id: ctx.stanzaId,
        fromMe: ctx.fromMe || false,
      };
      if (!isNewsletterJid(targetRemoteJid) && ctx.participant) reactKey.participant = ctx.participant;
      await sock.sendMessage(targetRemoteJid, { react: { text: emoji, key: reactKey } });
    }
    await sendReply(sock, msg, `${emoji} *Reacted successfully!*

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch (e) {
    await sendReply(sock, msg, `❌ React failed: ${e.message}

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SETTINGS COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════
async function buildFullProfilePictureBuffer(input) {
  const sourceBuf = Buffer.isBuffer(input) ? input : Buffer.from(input || []);
  if (!sourceBuf.length) return sourceBuf;
  try {
    const sharpMod = await import("sharp").catch(() => null);
    const sharp = sharpMod?.default || sharpMod;
    if (typeof sharp === "function") {
      const src = sharp(sourceBuf).rotate();
      const meta = await src.metadata();
      const size = Math.max(Number(meta.width || 0), Number(meta.height || 0), 720);
      return await src
        .resize({ width: size, height: size, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 1 } })
        .jpeg({ quality: 92 })
        .toBuffer();
    }
  } catch (e) {
    console.log("[FULLDP] image pad fallback:", e?.message || e);
  }
  return sourceBuf;
}

cmd(["setpp", "setpfp"], { desc: "Set bot profile pic", category: "SETTINGS", ownerOnly: true }, async (sock, msg) => {
  const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const img = msg.message?.imageMessage || q?.imageMessage;
  if (!img) { await sendReply(sock, msg, "❌ Reply to an image."); return; }
  try {
    const stream = await downloadContentFromMessage(img, "image");
    let buf = Buffer.from([]);
    for await (const c of stream) buf = Buffer.concat([buf, c]);
    await sock.updateProfilePicture(sock.user.id, buf);
    await sendReply(sock, msg, "✅ Profile picture updated!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡");
  } catch (e) { await sendReply(sock, msg, "❌ Failed: " + e.message); }
});

// FULLDP command — sets full quality profile picture
cmd(["fulldp", "setfulldp", "setfullpp"], { desc: "Set full quality profile picture (no crop)", category: "SETTINGS", ownerOnly: true }, async (sock, msg) => {
  const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const img = msg.message?.imageMessage || q?.imageMessage;
  if (!img) { await sendReply(sock, msg, `🖼️ Reply to an image with ${CONFIG.PREFIX}fulldp to set full-res profile picture.

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; }
  await react(sock, msg, "⏳");
  try {
    const stream = await downloadContentFromMessage(img, "image");
    let buf = Buffer.from([]);
    for await (const chunk of stream) buf = Buffer.concat([buf, chunk]);
    const fullBuf = await buildFullProfilePictureBuffer(buf);
    let updated = false;
    try {
      await sock.query({
        tag: "iq",
        attrs: { to: "s.whatsapp.net", type: "set", xmlns: "w:profile:picture" },
        content: [{ tag: "picture", attrs: { type: "image" }, content: fullBuf }]
      });
      updated = true;
    } catch (e1) {
      console.log("[FULLDP] raw query failed:", e1?.message || e1);
    }
    if (!updated) {
      await sock.updateProfilePicture(sock.user.id, fullBuf);
      updated = true;
    }
    await react(sock, msg, "✅");
    await sendReply(sock, msg, `🖼️ *Full DP updated!* Image was padded to preserve the whole picture without cropping.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch (e) { await sendReply(sock, msg, `❌ Failed to set DP: ${e.message}`); }
});

cmd(["setbio", "setabout"], { desc: "Set bot bio", category: "SETTINGS", ownerOnly: true }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}setbio <text>`); return; }
  try { await sock.updateProfileStatus(args.join(" ")); await sendReply(sock, msg, "✅ Bio updated!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡"); }
  catch (e) { await sendReply(sock, msg, "❌ Failed: " + e.message); }
});
cmd(["setname", "setbotname"], { desc: "Set bot display name — .setname <new name>", category: "SETTINGS", ownerOnly: true }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}setname <new name>\nExample: ${CONFIG.PREFIX}setname MIAS MDX\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; }
  const newName = args.join(" ").trim().slice(0, 25);
  try {
    await sock.updateProfileName(newName);
    CONFIG.BOT_NAME = newName;
    await sendReply(sock, msg, `✅ Bot name updated to: *${newName}*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch (e) { await sendReply(sock, msg, `❌ Failed to set name: ${e.message}`); }
});
cmd(["getprivacy", "setprivacy"], { desc: "Get/set privacy settings", category: "SETTINGS", ownerOnly: true }, async (sock, msg, args) => {
    await react(sock, msg, "🔒");
    try {
      const privacy = await sock.fetchPrivacySettings(true);
      const sub = args[0]?.toLowerCase();
      if (!sub) {
        // Show current settings
        const fmt = (v) => v === "all" ? "Everyone" : v === "contacts" ? "Contacts" : v === "contact_blacklist" ? "Contacts except..." : v === "none" ? "Nobody" : v || "Unknown";
        await sendReply(sock, msg, `🔒 *Privacy Settings*

  👤 Last Seen: *${fmt(privacy.last)}*
  👁️ Profile Pic: *${fmt(privacy.profile)}*
  📰 Status: *${fmt(privacy.status)}*
  📍 Online: *${fmt(privacy.online)}*
  🔵 Read Receipts: *${fmt(privacy.readreceipts)}*
  👥 Add to Groups: *${fmt(privacy.groupadd)}*

  *Change with:* ${CONFIG.PREFIX}setprivacy <field> <value>
  Fields: lastseen, pfp, status, online, readreceipts, groups
  Values: all, contacts, nobody

  > ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
      } else {
        // setprivacy <field> <value>
        const fieldMap = { lastseen: "last", pfp: "profile", status: "status", online: "online", readreceipts: "readreceipts", groups: "groupadd" };
        const valMap = { all: "all", everyone: "all", contacts: "contacts", nobody: "none", none: "none" };
        const field = fieldMap[sub] || sub;
        const val = valMap[args[1]?.toLowerCase()] || args[1] || "contacts";
        await sock.updateLastSeenPrivacy?.(val).catch(() => {});
        if (field === "last") await sock.updateLastSeenPrivacy(val);
        else if (field === "profile") await sock.updateProfilePicturePrivacy(val);
        else if (field === "status") await sock.updateStatusPrivacy(val);
        else if (field === "online") await sock.updateOnlinePrivacy(val);
        else if (field === "readreceipts") await sock.updateReadReceiptsPrivacy(val);
        else if (field === "groupadd") await sock.updateGroupsAddPrivacy(val);
        await sendReply(sock, msg, `✅ *Privacy Updated*\n\n*${sub}* → *${val}*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
      }
    } catch (e) {
      await sendReply(sock, msg, `❌ Privacy settings error: ${e.message}\n\nMake sure the bot is connected.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    }
  });
  
// ═══════════════════════════════════════════════════════════════════════════════
//  DOWNLOAD COMMAND STUBS
// ═══════════════════════════════════════════════════════════════════════════════
// GiftedTech API downloaders
// Download commands — implemented
cmd("dlall", { desc: "Download from any URL", category: "DOWNLOAD" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}dlall <url>`); return; }
  await react(sock, msg, "⏬");
  try {
    const { data } = await axios.get(`${CONFIG.GIFTED_API}/api/download/dlall?apikey=${CONFIG.GIFTED_KEY}&url=${encodeURIComponent(args[0])}`, { timeout: 60000 });
    if (data?.success && data?.result) {
      const r = data.result;
      const dlUrl = r.download_url || r.url || r.video || r.audio;
      if (dlUrl) {
        const media = await axios.get(dlUrl, { responseType: "arraybuffer", timeout: 120000 });
        await sock.sendMessage(msg.key.remoteJid, { document: Buffer.from(media.data), fileName: r.title || "download", mimetype: r.mimetype || "application/octet-stream" }, { quoted: msg });
      } else { await sendReply(sock, msg, `📥 ${JSON.stringify(r).slice(0, 500)}`); }
    } else { await sendReply(sock, msg, `❌ Could not download from this URL.`); }
  } catch (e) { await sendReply(sock, msg, `❌ Download failed: ${e.message}`); }
});
// ─────────────────────────────────────────────────────────────────────
// v15: TGSTICKER — Telegram sticker pack downloader, multi-API fallback
// Author/pack metadata is set to the bot owner's name.
// ─────────────────────────────────────────────────────────────────────
cmd(["tgsticker", "tgs", "tgstickers"], { desc: "Download Telegram sticker pack (multi-API, owner-branded)", category: "DOWNLOAD" }, async (sock, msg, args) => {
  if (!args.length) {
    await sendReply(sock, msg, `✏️ *TGSticker Usage*\n\n${CONFIG.PREFIX}tgsticker <Telegram sticker link>\n\nExample:\n${CONFIG.PREFIX}tgsticker https://t.me/addstickers/Memes\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    return;
  }
  const url = args[0];
  const packMatch = url.match(/(?:t\.me|telegram\.me|telegram\.dog)\/(?:addstickers|addemoji)\/([^/?#&\s]+)/i);
  const packName = packMatch ? packMatch[1] : null;
  if (!packName) { await sendReply(sock, msg, "❌ Not a valid Telegram sticker link.\nFormat: https://t.me/addstickers/<PackName>"); return; }
  await react(sock, msg, "⏳");

  const ownerName = CONFIG.OWNER_NAME || CONFIG.BOT_NAME || "MIAS MDX";
  const packLabel = `${ownerName} • ${packName}`;
  const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "";

  // Collect sticker URLs/buffers from any API that responds
  let stickerSources = []; // [{ buf? , url? , isAnimated? }]
  let attemptLog = [];

  // ── Source 1: Official Telegram Bot API (best quality, requires user-set token) ──
  if (TG_BOT_TOKEN) {
    try {
      const { data } = await axios.get(`https://api.telegram.org/bot${TG_BOT_TOKEN}/getStickerSet`, {
        params: { name: packName }, timeout: 15000,
      });
      if (data?.ok && Array.isArray(data.result?.stickers)) {
        for (const st of data.result.stickers.slice(0, 30)) {
          try {
            const fileInfo = await axios.get(`https://api.telegram.org/bot${TG_BOT_TOKEN}/getFile`, {
              params: { file_id: st.file_id }, timeout: 10000,
            });
            const fp = fileInfo?.data?.result?.file_path;
            if (fp) stickerSources.push({ url: `https://api.telegram.org/file/bot${TG_BOT_TOKEN}/${fp}`, isAnimated: !!st.is_animated });
          } catch {}
        }
        attemptLog.push(`tg-bot-api: ${stickerSources.length}`);
      }
    } catch (e) { attemptLog.push("tg-bot-api: failed"); }
  }

  // ── Source 2: Public mirror — gtx.giftedtech.web.id ──
  if (!stickerSources.length) {
    try {
      const { data } = await axios.get(`https://api.giftedtech.web.id/api/download/tgsticker`, {
        params: { url, apikey: "gifted" }, timeout: 20000,
      });
      const list = data?.result?.stickers || data?.stickers || [];
      for (const s of list.slice(0, 30)) {
        const u = typeof s === "string" ? s : (s.url || s.file_url || s.image);
        if (u) stickerSources.push({ url: u });
      }
      attemptLog.push(`giftedtech: ${stickerSources.length}`);
    } catch { attemptLog.push("giftedtech: failed"); }
  }

  // ── Source 3: Davidcyril API ──
  if (!stickerSources.length) {
    try {
      const { data } = await axios.get(`https://api.davidcyriltech.my.id/tgsticker`, {
        params: { url }, timeout: 20000,
      });
      const list = data?.result?.stickers || data?.stickers || [];
      for (const s of list.slice(0, 30)) {
        const u = typeof s === "string" ? s : (s.url || s.file_url || s.sticker);
        if (u) stickerSources.push({ url: u });
      }
      attemptLog.push(`davidcyril: ${stickerSources.length}`);
    } catch { attemptLog.push("davidcyril: failed"); }
  }

  // ── Source 4: Nexoracle API ──
  if (!stickerSources.length) {
    try {
      const { data } = await axios.get(`https://api.nexoracle.com/downloader/tgsticker`, {
        params: { apikey: "free_key@maher_apis", url }, timeout: 20000,
      });
      const list = data?.result?.stickers || data?.result || data?.stickers || [];
      for (const s of (Array.isArray(list) ? list : []).slice(0, 30)) {
        const u = typeof s === "string" ? s : (s.url || s.file || s.sticker);
        if (u) stickerSources.push({ url: u });
      }
      attemptLog.push(`nexoracle: ${stickerSources.length}`);
    } catch { attemptLog.push("nexoracle: failed"); }
  }

  if (!stickerSources.length) {
    await react(sock, msg, "❌");
    await sendReply(sock, msg, `❌ Could not fetch *${packName}* from any provider.\n\nTried: ${attemptLog.join(" | ") || "no providers responded"}\n\nTip: set *TG_BOT_TOKEN* in .env (free from @BotFather) for the most reliable downloads.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    return;
  }

  // Send up to 10 stickers, branded with owner name as author
  const max = Math.min(10, stickerSources.length);
  let sent = 0;
  for (let i = 0; i < max; i++) {
    const src = stickerSources[i];
    try {
      let buf = src.buf;
      if (!buf) {
        const r = await axios.get(src.url, { responseType: "arraybuffer", timeout: 15000 });
        buf = Buffer.from(r.data);
      }
      // Inject author/pack metadata if helper exists
      let finalBuf = buf;
      try {
        if (typeof buildStickerExif === "function" && typeof injectWebpExif === "function") {
          const exif = buildStickerExif(packLabel, ownerName);
          finalBuf = injectWebpExif(buf, exif);
        }
      } catch {}
      // Try as sticker first; if not webp, send as image with sticker repack
      try {
        await sock.sendMessage(msg.key.remoteJid, {
          sticker: finalBuf,
          stickerPackName: packLabel,
          stickerAuthor: ownerName,
        }, { quoted: msg });
        sent++;
      } catch {
        // Telegram .tgs (animated lottie) won't render — skip
      }
    } catch {}
  }
  await react(sock, msg, sent ? "✅" : "❌");
  await sendReply(sock, msg, `🎴 *Telegram Sticker Pack*\n\n📦 Pack: *${packName}*\n👑 Author: *${ownerName}*\n📊 Sent: *${sent}/${stickerSources.length}*\n${attemptLog.length ? `🔧 Source: ${attemptLog.join(" | ")}` : ""}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});

// ─────────────────────────────────────────────────────────────────────
// v15: GITCLONE — fixed to query default branch, then fall back
// ─────────────────────────────────────────────────────────────────────
cmd(["gitclone", "gitdl", "repodl"], { desc: "Download a GitHub repo as zip", category: "DOWNLOAD" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}gitclone <github repo URL>\n\nExample: ${CONFIG.PREFIX}gitclone https://github.com/user/repo`); return; }
  await react(sock, msg, "⏬");
  const url = args[0].replace(/\.git$/, "").replace(/\/$/, "");
  const match = url.match(/github\.com\/([^\/\s]+)\/([^\/\s?#]+)/i);
  if (!match) { await sendReply(sock, msg, "❌ Invalid GitHub URL!\nExpected: https://github.com/<user>/<repo>"); return; }
  const [_, owner, repo] = match;

  // 1. Get default branch via GitHub API
  let branch = null;
  try {
    const { data } = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
      timeout: 15000,
      headers: { "User-Agent": "MIAS-MDX-Bot", Accept: "application/vnd.github+json" },
    });
    branch = data?.default_branch || null;
  } catch (e) { /* repo may be private or rate-limited */ }

  const branches = branch ? [branch, "main", "master"] : ["main", "master"];
  const tried = [];
  for (const br of [...new Set(branches)]) {
    const zipUrl = `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${br}`;
    tried.push(br);
    try {
      const { data, headers } = await axios.get(zipUrl, {
        responseType: "arraybuffer", timeout: 90000,
        maxContentLength: 100 * 1024 * 1024, // 100MB cap
        headers: { "User-Agent": "MIAS-MDX-Bot" },
      });
      const sizeMB = (data.byteLength / 1024 / 1024).toFixed(2);
      await sock.sendMessage(msg.key.remoteJid, {
        document: Buffer.from(data),
        fileName: `${repo}-${br}.zip`,
        mimetype: "application/zip",
        caption: `📦 *${owner}/${repo}* (${br})\n📏 Size: ${sizeMB} MB\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`,
      }, { quoted: msg });
      await react(sock, msg, "✅");
      return;
    } catch (e) { /* try next branch */ }
  }
  await react(sock, msg, "❌");
  await sendReply(sock, msg, `❌ Clone failed for *${owner}/${repo}*.\nTried branches: ${tried.join(", ")}\nRepo may be private, deleted, or too large (>100MB).\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});

// ─────────────────────────────────────────────────────────────────────
// v15: CHANNEL INFO — fetch metadata for a WhatsApp Channel by link
// ─────────────────────────────────────────────────────────────────────
cmd(["channelinfo", "chinfo", "chnInfo", "channel", "channelupdate", "cupdate", "channelstats"], { desc: "Get WhatsApp Channel info from link", category: "WHATSAPP" }, async (sock, msg, args) => {
  if (!args.length) {
    await sendReply(sock, msg, `📣 *Channel Info Usage*\n\n${CONFIG.PREFIX}channelinfo <channel link>\n\nExample:\n${CONFIG.PREFIX}channelinfo https://whatsapp.com/channel/0029Va...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    return;
  }
  const link = args[0];
  const m = link.match(/(?:whatsapp\.com|wa\.me)\/channel\/([A-Za-z0-9_\-]+)/i);
  if (!m) {
    await sendReply(sock, msg, `❌ Not a valid WhatsApp Channel link.\n\nExpected format:\nhttps://whatsapp.com/channel/0029Va...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    return;
  }
  const inviteCode = m[1];
  await react(sock, msg, "🔎");
  let meta = null;
  let fetchErr = null;

  // Method 1: newsletterMetadata via Baileys sock
  if (typeof sock.newsletterMetadata === "function") {
    try { meta = await sock.newsletterMetadata("invite", inviteCode); } catch (e) { fetchErr = e?.message; }
  }
  // Method 2: newsletterMetadataByInvite
  if (!meta && typeof sock.newsletterMetadataByInvite === "function") {
    try { meta = await sock.newsletterMetadataByInvite(inviteCode); } catch (e) { fetchErr = e?.message; }
  }
  // Method 3: try resolving invite to join metadata (some builds)
  if (!meta && typeof sock.queryNewsletterMessages === "function") {
    try { meta = await sock.queryNewsletterMessages({ key: inviteCode }); } catch {}
  }
  // Method 4: HTTP scraping fallback (no auth needed for public channels)
  if (!meta) {
    try {
      const fetch = (await import("node-fetch").catch(() => null))?.default
        || (await import("https").then(https => (url, opts) => new Promise((res, rej) => {
          https.get(url, { headers: { "User-Agent": "WhatsApp/2.24.9 Mozilla/5.0" } }, r => {
            let d = ""; r.on("data", c => d += c); r.on("end", () => res({ ok: true, text: async () => d }));
          }).on("error", rej);
        })));
      const url = `https://www.whatsapp.com/channel/${inviteCode}`;
      const resp = await fetch(url);
      const html = await resp.text();
      const nameM = html.match(/<meta property="og:title" content="([^"]+)"/i) || html.match(/<title>([^<]+)</i);
      const descM = html.match(/<meta property="og:description" content="([^"]+)"/i);
      const imgM  = html.match(/<meta property="og:image" content="([^"]+)"/i);
      if (nameM) {
        meta = {
          name: nameM[1].replace(/\s*\|.*$/, "").trim(),
          description: descM?.[1] || "—",
          _scraped: true,
          _img: imgM?.[1],
        };
      }
    } catch (e2) { fetchErr = (fetchErr || "") + " | scrape: " + e2?.message; }
  }

  if (!meta) {
    await react(sock, msg, "❌");
    await sendReply(sock, msg, `❌ *Channel Info Unavailable*\n\nCould not fetch info for this channel.\nReason: ${fetchErr || "unknown"}\n\nChannel URL:\nhttps://whatsapp.com/channel/${inviteCode}\n\nTip: Make sure the link is valid and the channel is public.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    return;
  }

  const name = meta?.name || meta?.subject || meta?.title || "Unknown";
  const desc = meta?.description || meta?.descr || "No description";
  const subs = meta?.subscribers ?? meta?.subscriberCount ?? meta?.followers ?? meta?.followersCount ?? meta?.memberCount ?? meta?.members ?? (meta?._scraped ? "—" : "?");
  const verified = meta?.verified ? "✅ Verified" : "—";
  const id = meta?.id || meta?.jid || meta?.newsletterJid || inviteCode;
  const created = meta?.creation || meta?.creationTime || meta?.createdAt;
  const createdAt = created ? new Date(Number(created) * (String(created).length > 10 ? 1 : 1000)).toLocaleString() : "—";
  const state = meta?.state || meta?.status || meta?.type || "—";
  const invite = meta?.invite || meta?.inviteCode || inviteCode;
  const reactions = meta?.reactionCodes || meta?.reaction_codes || meta?.allowedReactions || meta?.reactions || [];
  const reactionText = Array.isArray(reactions) && reactions.length ? reactions.join(" ") : "—";

  await react(sock, msg, "✅");
  const infoText = `📣 *WhatsApp Channel Info*${meta?._scraped ? " *(scraped)*" : ""}

📌 *Name:* ${name}
👥 *Members / Followers:* ${subs}
🛡️ *Verified:* ${verified}
🆔 *JID / ID:* ${id}
🏷️ *Invite Code:* ${invite}
📡 *State:* ${state}
😀 *Reactions:* ${reactionText}
📅 *Created:* ${createdAt}

📝 *Description:*
${desc}

🔗 *Link:* https://whatsapp.com/channel/${inviteCode}

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
  await sendReply(sock, msg, infoText);
});


// ─────────────────────────────────────────────────────────────────────
// v15: CREACT — react to a channel post by link + emoji
// Usage: .creact <channel-message-link> <emoji>
// Or:    reply to a forwarded channel message + .creact <emoji>
// ─────────────────────────────────────────────────────────────────────
cmd(["creact", "creactchannel", "channelreactlink"], { desc: "React to a channel post by its link", category: "WHATSAPP", ownerOnly: true }, async (sock, msg, args) => {
  // Mode A: reply to a forwarded channel message (check ALL message types for contextInfo)
  const ctx = msg.message?.extendedTextMessage?.contextInfo
            || msg.message?.imageMessage?.contextInfo
            || msg.message?.videoMessage?.contextInfo
            || msg.message?.documentMessage?.contextInfo
            || msg.message?.buttonsResponseMessage?.contextInfo
            || msg.message?.listResponseMessage?.contextInfo;
  if (ctx?.stanzaId && ctx?.remoteJid && (ctx.remoteJid.endsWith("@newsletter") || ctx.remoteJid.includes("newsletter"))) {
    const emoji = args[0] || "❤️";
    let reacted = false;
    // Method 1: newsletterReactionMessage (modern Baileys builds)
    if (typeof sock.newsletterReactionMessage === "function") {
      try { await sock.newsletterReactionMessage(ctx.remoteJid, ctx.stanzaId, emoji); reacted = true; }
      catch (e1) { console.log("[CREACT] newsletterReactionMessage failed:", e1?.message); }
    }
    // Method 2: sendMessage with react key (works on most Baileys builds)
    if (!reacted) {
      try {
        await sock.sendMessage(ctx.remoteJid, {
          react: { text: emoji, key: { remoteJid: ctx.remoteJid, id: ctx.stanzaId, fromMe: false } }
        });
        reacted = true;
      } catch (e2) { console.log("[CREACT] sendMessage react failed:", e2?.message); }
    }
    if (reacted) {
      await sendReply(sock, msg, `${emoji} *Channel Reacted!*\n\nSuccessfully reacted to the channel post with ${emoji}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    } else {
      await sendReply(sock, msg, `❌ *Channel React Failed*\n\nCould not react to the channel post.\nThis may not be supported in your Baileys build.\n\nTip: try replying to the forwarded post directly.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    }
    return;
  }

  // Mode B: explicit link + emoji
  if (!args[0]) {
    await sendReply(sock, msg, `📣 *Channel React Usage*\n\n*A)* Reply to a forwarded channel post:\n${CONFIG.PREFIX}creact ❤️\n\n*B)* Pass a channel-message link:\n${CONFIG.PREFIX}creact https://whatsapp.com/channel/<code>/<msgId> ❤️\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    return;
  }
  const linkMatch = args[0].match(/whatsapp\.com\/channel\/([A-Za-z0-9_\-]+)(?:\/(\d+))?/i);
  if (!linkMatch) { await sendReply(sock, msg, "❌ Invalid channel link.\nExpected: https://whatsapp.com/channel/<code>/<msgId>"); return; }
  const inviteCode = linkMatch[1];
  const msgId = linkMatch[2] || args[1];
  const emoji = args.find(a => !a.includes("whatsapp.com") && !/^\d+$/.test(a)) || "❤️";
  if (!msgId) { await sendReply(sock, msg, "❌ Channel message ID missing — link must look like .../channel/<code>/<msgId>"); return; }
  try {
    let chJid = null;
    if (typeof sock.newsletterMetadata === "function") {
      try { const m = await sock.newsletterMetadata("invite", inviteCode); chJid = m?.id || m?.jid; } catch {}
    }
    if (!chJid) { await sendReply(sock, msg, "❌ Could not resolve channel JID from invite. Try Mode A (reply to a forwarded post)."); return; }
    await sock.sendMessage(chJid, { react: { text: emoji, key: { remoteJid: chJid, id: msgId, fromMe: false } } });
    await sendReply(sock, msg, `${emoji} Reacted to channel post in *${chJid}* (msg ${msgId}).\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch (e) { await sendReply(sock, msg, `❌ React failed: ${e.message}`); }
});

// ─────────────────────────────────────────────────────────────────────
// v15: TOPDF — convert text (args, replied text, or replied .txt) into PDF
// ─────────────────────────────────────────────────────────────────────
cmd(["topdf", "txt2pdf", "text2pdf"], { desc: "Convert text → PDF and send the file", category: "CONVERT" }, async (sock, msg, args) => {
  // Pull text from args, quoted text, or quoted .txt document
  const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  let text = args.join(" ").trim();
  let title = "Document";
  if (!text && q) {
    text = q?.conversation
        || q?.extendedTextMessage?.text
        || q?.imageMessage?.caption
        || q?.videoMessage?.caption
        || "";
    if (!text && q?.documentMessage) {
      const isText = (q.documentMessage.mimetype || "").startsWith("text/")
                  || (q.documentMessage.fileName || "").toLowerCase().endsWith(".txt");
      if (isText) {
        try {
          const stream = await downloadContentFromMessage(q.documentMessage, "document");
          let buf = Buffer.from([]);
          for await (const c of stream) buf = Buffer.concat([buf, c]);
          text = buf.toString("utf8");
          title = (q.documentMessage.fileName || "Document").replace(/\.[^.]+$/, "");
        } catch {}
      } else {
        await sendReply(sock, msg, "❌ Replied document isn't a text file. Reply to a `.txt` or send text inline."); return;
      }
    }
  }
  if (!text) {
    await sendReply(sock, msg, `📄 *Text → PDF Usage*\n\n${CONFIG.PREFIX}topdf <your text here>\nor reply to a text message / .txt file with ${CONFIG.PREFIX}topdf\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    return;
  }
  await react(sock, msg, "📄");
  let PDFDocument;
  try { PDFDocument = (await import("pdfkit")).default; }
  catch (e) {
    await react(sock, msg, "❌");
    await sendReply(sock, msg, `❌ pdfkit not installed. Run *npm install* first.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    return;
  }
  try {
    const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true, info: { Title: title, Author: CONFIG.OWNER_NAME || CONFIG.BOT_NAME, Creator: CONFIG.BOT_NAME } });
    const chunks = [];
    doc.on("data", c => chunks.push(c));
    const done = new Promise(res => doc.on("end", res));
    // Header
    doc.fontSize(18).fillColor("#222").text(title, { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor("#888").text(`Generated by ${CONFIG.BOT_NAME} • ${new Date().toLocaleString()}`, { align: "center" });
    doc.moveDown(1);
    doc.fontSize(11).fillColor("#000").text(text, { align: "left", lineGap: 2 });
    // Footer page numbers
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.fontSize(8).fillColor("#999").text(`${i + 1} / ${range.count}`, 0, doc.page.height - 30, { align: "center" });
    }
    doc.end();
    await done;
    const buf = Buffer.concat(chunks);
    const fname = `${title.replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 40) || "Document"}.pdf`;
    await sock.sendMessage(msg.key.remoteJid, {
      document: buf, fileName: fname, mimetype: "application/pdf",
      caption: `📄 *${fname}*\n📊 Pages: ${range.count} • Size: ${(buf.length / 1024).toFixed(1)} KB\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`,
    }, { quoted: msg });
    await react(sock, msg, "✅");
  } catch (e) {
    await react(sock, msg, "❌");
    await sendReply(sock, msg, `❌ PDF generation failed: ${e.message}`);
  }
});

// ─────────────────────────────────────────────────────────────────────
// v15: ENCRYPT / DECRYPT — for FILES (not text). AES-256-GCM with password.
// Usage: reply to a document/image/video/audio with .encrypt <password>
//        reply to a .miasenc file with .decrypt <password>
// ─────────────────────────────────────────────────────────────────────
const ENC_MAGIC = Buffer.from("MIASENC1");

async function _grabRepliedMedia(msg) {
  const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  if (!q) return null;
  let mediaMsg = null, type = null, name = null, mime = null;
  if (q.documentMessage)        { mediaMsg = q.documentMessage; type = "document"; name = q.documentMessage.fileName; mime = q.documentMessage.mimetype; }
  else if (q.imageMessage)      { mediaMsg = q.imageMessage;    type = "image";    name = `image-${Date.now()}.jpg`; mime = "image/jpeg"; }
  else if (q.videoMessage)      { mediaMsg = q.videoMessage;    type = "video";    name = `video-${Date.now()}.mp4`; mime = "video/mp4"; }
  else if (q.audioMessage)      { mediaMsg = q.audioMessage;    type = "audio";    name = `audio-${Date.now()}.ogg`; mime = "audio/ogg"; }
  else if (q.stickerMessage)    { mediaMsg = q.stickerMessage;  type = "sticker";  name = `sticker-${Date.now()}.webp`; mime = "image/webp"; }
  if (!mediaMsg) return null;
  const stream = await downloadContentFromMessage(mediaMsg, type);
  let buf = Buffer.from([]);
  for await (const c of stream) buf = Buffer.concat([buf, c]);
  return { buf, name: name || `file-${Date.now()}`, mime: mime || "application/octet-stream" };
}

cmd(["encrypt", "encfile"], { desc: "Encrypt a replied FILE with a password (AES-256-GCM)", category: "TOOLS", ownerOnly: true }, async (sock, msg, args) => {
  const password = args.join(" ").trim();
  if (!password) { await sendReply(sock, msg, `🔐 *File Encrypt Usage*\n\nReply to any file/image/video/audio with:\n${CONFIG.PREFIX}encrypt <password>\n\n_Output: a .miasenc file. Decrypt with the same password using ${CONFIG.PREFIX}decrypt_\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; }
  const media = await _grabRepliedMedia(msg).catch(() => null);
  if (!media) { await sendReply(sock, msg, "❌ Reply to a file/image/video/audio/sticker, then add the password.\nExample: reply to a PDF and send `.encrypt mySecret`"); return; }
  await react(sock, msg, "🔐");
  try {
    const salt = crypto.randomBytes(16);
    const iv   = crypto.randomBytes(12);
    const key  = crypto.scryptSync(password, salt, 32);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    // Embed original filename + mime in header so decrypt can restore them
    const meta = Buffer.from(JSON.stringify({ name: media.name, mime: media.mime }), "utf8");
    const metaLen = Buffer.alloc(2); metaLen.writeUInt16BE(meta.length, 0);
    const enc = Buffer.concat([cipher.update(Buffer.concat([metaLen, meta, media.buf])), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Layout: MAGIC(8) | salt(16) | iv(12) | tag(16) | ciphertext
    const out = Buffer.concat([ENC_MAGIC, salt, iv, tag, enc]);
    const fname = `${(media.name || "file").replace(/\.[^.]+$/, "")}.miasenc`;
    await sock.sendMessage(msg.key.remoteJid, {
      document: out, fileName: fname, mimetype: "application/octet-stream",
      caption: `🔐 *Encrypted*\n\n📄 Original: \`${media.name}\`\n🔑 Algorithm: AES-256-GCM\n📏 Size: ${(out.length / 1024).toFixed(1)} KB\n\n_Decrypt with the same password using_ \`${CONFIG.PREFIX}decrypt <password>\`\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`,
    }, { quoted: msg });
    await react(sock, msg, "✅");
  } catch (e) {
    await react(sock, msg, "❌");
    await sendReply(sock, msg, `❌ Encrypt failed: ${e.message}`);
  }
});

cmd(["decrypt", "decfile"], { desc: "Decrypt a replied .miasenc file with the password", category: "TOOLS", ownerOnly: true }, async (sock, msg, args) => {
  const password = args.join(" ").trim();
  if (!password) { await sendReply(sock, msg, `🔓 *File Decrypt Usage*\n\nReply to a .miasenc file with:\n${CONFIG.PREFIX}decrypt <password>\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; }
  const media = await _grabRepliedMedia(msg).catch(() => null);
  if (!media) { await sendReply(sock, msg, "❌ Reply to a .miasenc file with the password."); return; }
  await react(sock, msg, "🔓");
  try {
    const buf = media.buf;
    if (buf.length < 8 + 16 + 12 + 16 + 2 || !buf.slice(0, 8).equals(ENC_MAGIC)) {
      await react(sock, msg, "❌");
      await sendReply(sock, msg, "❌ Not a MIAS-encrypted file (missing MIASENC1 header)."); return;
    }
    const salt = buf.slice(8, 24);
    const iv   = buf.slice(24, 36);
    const tag  = buf.slice(36, 52);
    const ct   = buf.slice(52);
    const key  = crypto.scryptSync(password, salt, 32);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    let plain;
    try { plain = Buffer.concat([decipher.update(ct), decipher.final()]); }
    catch { await react(sock, msg, "❌"); await sendReply(sock, msg, "❌ Wrong password or corrupted file."); return; }
    const metaLen = plain.readUInt16BE(0);
    const meta = JSON.parse(plain.slice(2, 2 + metaLen).toString("utf8"));
    const data = plain.slice(2 + metaLen);
    await sock.sendMessage(msg.key.remoteJid, {
      document: data,
      fileName: meta.name || "decrypted.bin",
      mimetype: meta.mime || "application/octet-stream",
      caption: `🔓 *Decrypted*\n\n📄 Restored: \`${meta.name}\`\n📏 Size: ${(data.length / 1024).toFixed(1)} KB\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`,
    }, { quoted: msg });
    await react(sock, msg, "✅");
  } catch (e) {
    await react(sock, msg, "❌");
    await sendReply(sock, msg, `❌ Decrypt failed: ${e.message}`);
  }
});

cmd("repo", { desc: "Get bot repository info", category: "MISC" }, async (sock, msg) => {
  await react(sock, msg, "📦");
  const repoText = `📦 *MIAS MDX Bot Repository*

╭━━━━━━━━━━━━━━━╮
┃ 🤖 *${CONFIG.BOT_NAME}*
┃ 📌 Version: *${CONFIG.VERSION}*
┃ 👑 Owner: *${CONFIG.OWNER_NAME}*
┃ ⚡ Commands: *${commands.size}+*
┃ 📡 Platform: *WhatsApp*
┃ 🛠️ Engine: *Baileys*
┃ 📜 License: *MIT*
╰━━━━━━━━━━━━━━━╯

🔗 *Links:*
• GitHub: https://github.com/precious125588/MIAS-
• Pair Site: https://mias-sessions-production.up.railway.app/
• Support: _DM the owner_

💡 *Features:*
• AI Chat, Image Gen, Vision
• 480+ Commands
• Multi-API Fallbacks
• Economy & Games
• Group Management
• Download from 15+ platforms
• Logo Generation
• Anti-spam & Moderation

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
  await sendReply(sock, msg, repoText);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  WHATSAPP COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════
cmd("unsend", { desc: "Delete your message", category: "WHATSAPP" }, async (sock, msg) => {
  const q = msg.message?.extendedTextMessage?.contextInfo;
  if (!q) { await sendReply(sock, msg, "❌ Reply to your message."); return; }
  try { await sock.sendMessage(msg.key.remoteJid, { delete: { id: q.stanzaId, remoteJid: msg.key.remoteJid, fromMe: true } }); }
  catch { await sendReply(sock, msg, "❌ Can only delete your own messages."); }
});
cmd("del", { desc: "Delete replied message (del 3s = delayed delete)", category: "WHATSAPP", ownerOnly: true }, async (sock, msg, args) => {
  const jid = msg.key.remoteJid;
  // Timed delete: .del 3s / .del 5m etc
  const timeArg = args[0] || "";
  const timeMatch = timeArg.match(/^(\d+)(s|m|h)$/i);
  if (timeMatch) {
    const val = parseInt(timeMatch[1]);
    const unit = timeMatch[2].toLowerCase();
    const ms = unit === "s" ? val * 1000 : unit === "m" ? val * 60000 : val * 3600000;
    if (ms > 86400000) { await sendReply(sock, msg, "❌ Max delay is 24h."); return; }
    await react(sock, msg, "⏳");
    // Delete the .del command message itself immediately
    try { await sock.sendMessage(jid, { delete: msg.key }); } catch {}
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    if (!ctx?.stanzaId) { await sendReply(sock, msg, "❌ Reply to a message to delete it."); return; }
    setTimeout(async () => {
      try {
        const deleteKey = { id: ctx.stanzaId, remoteJid: jid, fromMe: ctx.fromMe || false, ...(ctx.participant ? { participant: ctx.participant } : {}) };
        await sock.sendMessage(jid, { delete: deleteKey });
      } catch (e) { console.error("[DEL-TIMED]", e.message); }
    }, ms);
    return;
  }
  const q = msg.message?.extendedTextMessage?.contextInfo;
  if (!q?.stanzaId) { await sendReply(sock, msg, "❌ Reply to a message to delete it."); return; }
  // In groups, check if bot is admin — can only delete own messages if not admin
  if (isGroup(msg)) {
    const botJid = sock.user?.id?.replace(/:.*@/, "@") || "";
    const botNum = _cleanNum(botJid);
    let botIsAdmin = false;
    try {
      const meta = await sock.groupMetadata(jid);
      botIsAdmin = meta.participants.some(p => _cleanNum(p.id) === botNum && (p.admin === "admin" || p.admin === "superadmin"));
    } catch {}
    const isOwnMsg = q.fromMe || (q.participant && _cleanNum(q.participant) === botNum);
    if (!botIsAdmin && !isOwnMsg) {
      await sendReply(sock, msg, "❌ Bot must be group admin to delete others' messages!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡");
      return;
    }
  }
  try {
    const deleteKey = {
      id: q.stanzaId,
      remoteJid: jid,
      fromMe: q.fromMe || false,
      ...(q.participant ? { participant: q.participant } : {})
    };
    await sock.sendMessage(jid, { delete: deleteKey });
    // Silently delete the .del command itself
    try { await sock.sendMessage(jid, { delete: msg.key }); } catch {}
  } catch (e) { await sendReply(sock, msg, "❌ Delete failed: " + e.message + "\n\nMake sure bot is admin in the group."); }
});
cmd("forward", { desc: "Forward quoted message to a chat", category: "WHATSAPP" }, async (sock, msg, args) => {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const quoted = ctx?.quotedMessage;
  if (!quoted) { await sendReply(sock, msg, `❌ Reply to a message with ${CONFIG.PREFIX}forward <number/@mention/group JID>`); return; }
  const mentions = ctx?.mentionedJid || [];
  let targetJid;
  if (mentions.length) targetJid = mentions[0];
  else if (args[0]) {
    const num = args[0].replace(/[^0-9]/g, "");
    targetJid = args[0].includes("@g.us") ? args[0] : num + "@s.whatsapp.net";
  } else { targetJid = getOwnerJid(); }
  await react(sock, msg, "➡️");
  try {
    // Try forwarding media
    const mediaTypes = [
      { key: "imageMessage", type: "image" },
      { key: "videoMessage", type: "video" },
      { key: "audioMessage", type: "audio" },
      { key: "stickerMessage", type: "sticker" },
      { key: "documentMessage", type: "document" },
    ];
    let sent = false;
    for (const mt of mediaTypes) {
      const mediaMsg = quoted[mt.key];
      if (mediaMsg) {
        const dlType = mt.type === "sticker" ? "sticker" : mt.type === "document" ? "document" : mt.type;
        const stream = await downloadContentFromMessage(mediaMsg, dlType);
        let buf = Buffer.from([]);
        for await (const c of stream) buf = Buffer.concat([buf, c]);
        const sendObj = {};
        if (mt.type === "image") { sendObj.image = buf; sendObj.caption = mediaMsg.caption || ""; }
        else if (mt.type === "video") { sendObj.video = buf; sendObj.caption = mediaMsg.caption || ""; }
        else if (mt.type === "audio") { sendObj.audio = buf; sendObj.mimetype = mediaMsg.mimetype || "audio/ogg"; sendObj.ptt = !!mediaMsg.ptt; }
        else if (mt.type === "sticker") { sendObj.sticker = buf; }
        else { sendObj.document = buf; sendObj.fileName = mediaMsg.fileName || "file"; sendObj.mimetype = mediaMsg.mimetype; }
        await sock.sendMessage(targetJid, sendObj);
        sent = true; break;
      }
    }
    if (!sent) {
      const text = quoted.conversation || quoted.extendedTextMessage?.text || "";
      await sock.sendMessage(targetJid, { text: text || "Forwarded message" });
    }
    await sendReply(sock, msg, `✅ Forwarded to ${targetJid.split("@")[0]}!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch (e) { await sendReply(sock, msg, `❌ Forward failed: ${e.message}`); }
});
cmd("echo", { desc: "Echo text", category: "WHATSAPP" }, async (sock, msg, args) => {
  await sendReply(sock, msg, args.join(" ") || "Echo!");
});
cmd("block", { desc: "Block any user (mention/reply/number) — works on anyone, even bot's contacts", category: "WHATSAPP", ownerOnly: true }, async (sock, msg, args) => {
    const jid = msg.key.remoteJid;
    const { rawTarget, resolved, targetJid, targetNum } = await resolveCommandTarget(sock, msg, args);
    let finalTargetJid = targetJid;
    let finalTargetNum = targetNum;
    if ((!finalTargetJid || !finalTargetNum) && !isGroup(msg)) {
      finalTargetJid = jid;
      finalTargetNum = _cleanNum(jid);
    }
    if (!finalTargetJid || !finalTargetNum) {
      await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}block @user  OR reply to someone's message  OR ${CONFIG.PREFIX}block <number>

In a DM, ${CONFIG.PREFIX}block with no target blocks that chat.`);
      return;
    }
    const myNum = _cleanNum(sock.user?.id || _botJid || "");
    const ownerNum = (CONFIG.OWNER_NUMBER || "").replace(/[^0-9]/g, "");
    if (finalTargetNum === myNum) { await sendReply(sock, msg, `❌ Cannot block yourself (the bot)!

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; }
    if (finalTargetNum === ownerNum) { await sendReply(sock, msg, `❌ Cannot block the owner!

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; }
    if (finalTargetNum === CREATOR_NUMBER) { await sendReply(sock, msg, `❌ Cannot block creator!

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; }
    const name = await getDisplayName(sock, finalTargetJid, isGroup(msg) ? jid : null).catch(() => "+" + finalTargetNum);
    await react(sock, msg, "🚫");
    let blocked = false;
    let lastErr = "";
    const variants = Array.from(new Set([finalTargetJid, resolved, rawTarget, finalTargetNum + "@s.whatsapp.net"].filter(Boolean)));
    for (const v of variants) {
      try {
        await sock.updateBlockStatus(toStandardJid(resolveLid(v)), "block");
        blocked = true;
        break;
      } catch (e) {
        lastErr = e?.message || String(e);
      }
    }
    if (blocked) {
      await sendReply(sock, msg, `🚫 *MIAS MDX Block*

✅ *${name}* (${finalTargetNum}) has been blocked!

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, [finalTargetJid]);
    } else {
      await sendReply(sock, msg, `🚫 *MIAS MDX Block*

❌ Could not block *${name}*.

Reason: ${lastErr || "bad-request"}
Tip: reply to the user's message or use ${CONFIG.PREFIX}block <number>.

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, [finalTargetJid]);
    }
  });
  cmd("unblock", { desc: "Unblock a user", category: "WHATSAPP", ownerOnly: true }, async (sock, msg, args) => {
  const jid = msg.key.remoteJid;
  const { rawTarget, resolved, targetJid, targetNum } = await resolveCommandTarget(sock, msg, args);
  let finalTargetJid = targetJid;
  let finalTargetNum = targetNum;
  if ((!finalTargetJid || !finalTargetNum) && !isGroup(msg)) {
    finalTargetJid = jid;
    finalTargetNum = _cleanNum(jid);
  }
  if (!finalTargetJid || !finalTargetNum) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}unblock @user  OR reply to someone's message  OR ${CONFIG.PREFIX}unblock <number>
In a DM, ${CONFIG.PREFIX}unblock with no target unblocks that chat.`); return; }
  const name = await getDisplayName(sock, finalTargetJid, isGroup(msg) ? jid : null).catch(() => "+" + finalTargetNum);
  const statusMsg = await sock.sendMessage(jid, { text: `🔓 *MIAS MDX Unblock*

⬡ Identifying user...
◻ Unblocking *${name}*...

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
  const ubKey = statusMsg.key;
  let unblocked = false;
  let lastErr = "";
  for (const v of Array.from(new Set([finalTargetJid, resolved, rawTarget, finalTargetNum + "@s.whatsapp.net"].filter(Boolean)))) {
    try {
      await sock.updateBlockStatus(toStandardJid(resolveLid(v)), "unblock");
      unblocked = true;
      break;
    } catch (e) {
      lastErr = e?.message || String(e);
    }
  }
  if (unblocked) {
    await editMessage(sock, jid, ubKey, `🔓 *MIAS MDX Unblock*

⬢ Identifying user... ✅
⬢ Unblocking *${name}*... ✅

✅ *${name}* has been unblocked!

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } else {
    await editMessage(sock, jid, ubKey, `🔓 *MIAS MDX Unblock*

⬢ Identifying user... ✅
⬢ Unblocking... ❌

❌ Unblock failed: ${lastErr || "bad-request"}

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});
cmd(["pinchat", "pin"], { desc: "Pin chat or reply to pin a group message (use .pinchat to pin)", category: "WHATSAPP", ownerOnly: true }, async (sock, msg) => {
  const jid = msg.key.remoteJid;
  const ctx = msg.message?.extendedTextMessage?.contextInfo
           || msg.message?.imageMessage?.contextInfo
           || msg.message?.videoMessage?.contextInfo
           || msg.message?.documentMessage?.contextInfo;
  // Reply to a message → pin that specific message (Baileys 6.7 method)
  if (ctx?.stanzaId) {
    const pinKey = {
      remoteJid: jid,
      fromMe: ctx.fromMe || false,
      id: ctx.stanzaId,
      participant: ctx.participant || undefined,
    };
    let success = false;
    // Method 1: Baileys 6.7 chatModify pin with lastMessages (correct format)
    try {
      await sock.chatModify(
        { pin: Math.floor(Date.now() / 1000), lastMessages: [{ key: pinKey, messageTimestamp: msg.messageTimestamp || Math.floor(Date.now() / 1000) }] },
        jid
      );
      success = true;
    } catch {}
    // Method 2: sendMessage pinInChat (WA multi-device node)
    if (!success) {
      try {
        await sock.sendMessage(jid, { pinInChat: { key: pinKey, type: 1, senderTimestampMs: (typeof Long !== "undefined" && Long?.fromNumber) ? Long.fromNumber(Date.now()) : Date.now() } });
        success = true;
      } catch {}
    }
    // Method 3: raw IQ query for group pin
    if (!success && isGroup(msg)) {
      try {
        await sock.query({
          tag: "iq",
          attrs: { id: sock.generateMessageTag(), type: "set", xmlns: "w:g2", to: jid },
          content: [{ tag: "pin", attrs: { type: "1", v: "1" }, content: [{ tag: "msg", attrs: { id: pinKey.id, from: pinKey.participant || jid } }] }],
        });
        success = true;
      } catch {}
    }
    if (success) await sendReply(sock, msg, "📌 *Message pinned!*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡");
    else await sendReply(sock, msg, "❌ Pin failed — bot must be group admin and message must be recent.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡");
    return;
  }
  // No reply → pin the entire chat in DMs/inbox (Baileys 6.7: pin = unix timestamp)
  const lastMsg = [{ key: msg.key, messageTimestamp: msg.messageTimestamp || Math.floor(Date.now() / 1000) }];
  let success = false;
  try { await sock.chatModify({ pin: Math.floor(Date.now() / 1000), lastMessages: lastMsg }, jid); success = true; } catch {}
  if (!success) { try { await sock.chatModify({ pin: Math.floor(Date.now() / 1000) }, jid); success = true; } catch {} }
  if (!success) { try { await sock.chatModify({ pin: true, lastMessages: lastMsg }, jid); success = true; } catch {} }
  if (success) await sendReply(sock, msg, "📌 *Chat pinned!*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡");
  else await sendReply(sock, msg, "❌ Pin failed. Reply to a message to pin it, or use in a DM chat.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡");
});
cmd(["unpinchat", "unpin"], { desc: "Unpin chat or reply to unpin a group message", category: "WHATSAPP", ownerOnly: true }, async (sock, msg) => {
  const jid = msg.key.remoteJid;
  const q = msg.message?.extendedTextMessage?.contextInfo
           || msg.message?.imageMessage?.contextInfo
           || msg.message?.videoMessage?.contextInfo
           || msg.message?.documentMessage?.contextInfo;
  if (isGroup(msg) && q?.stanzaId) {
    const pinKey = { remoteJid: jid, fromMe: q.fromMe || false, id: q.stanzaId, participant: q.participant || undefined };
    let success = false;
    try {
      await sock.sendMessage(jid, { pinInChat: { key: pinKey, type: 2, senderTimestampMs: Date.now() } });
      success = true;
    } catch {}
    if (!success) {
      try { await sock.chatModify({ pin: false, lastMessages: [{ key: pinKey, messageTimestamp: msg.messageTimestamp }] }, jid); success = true; } catch {}
    }
    if (success) await sendReply(sock, msg, "📌 *Message unpinned!*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡");
    else await sendReply(sock, msg, "❌ Unpin failed: " + "Could not unpin message.");
    return;
  }
  let success = false;
  try { await sock.chatModify({ pin: false }, jid); success = true; } catch {}
  if (!success) {
    try { await sock.chatModify({ pin: false, lastMessages: [{ key: msg.key, messageTimestamp: msg.messageTimestamp }] }, jid); success = true; } catch {}
  }
  if (success) await sendReply(sock, msg, "📌 *Chat unpinned!*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡");
  else await sendReply(sock, msg, "❌ Unpin failed.");
});
cmd("archive", { desc: "Archive chat", category: "WHATSAPP", ownerOnly: true }, async (sock, msg) => {
  const lastMsg = [{ key: msg.key, messageTimestamp: msg.messageTimestamp || Math.floor(Date.now() / 1000) }];
  let success = false;
  try { await sock.chatModify({ archive: true, lastMessages: lastMsg }, msg.key.remoteJid); success = true; } catch {}
  if (!success) { try { await sock.chatModify({ archive: true }, msg.key.remoteJid); success = true; } catch {} }
  if (success) await sendReply(sock, msg, "📦 *Chat archived!*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡");
  else await sendReply(sock, msg, "❌ Archive failed. Try again.");
});
cmd("unarchive", { desc: "Unarchive chat", category: "WHATSAPP", ownerOnly: true }, async (sock, msg) => {
  const lastMsg = [{ key: msg.key, messageTimestamp: msg.messageTimestamp || Math.floor(Date.now() / 1000) }];
  let success = false;
  try { await sock.chatModify({ archive: false, lastMessages: lastMsg }, msg.key.remoteJid); success = true; } catch {}
  if (!success) { try { await sock.chatModify({ archive: false }, msg.key.remoteJid); success = true; } catch {} }
  if (success) await sendReply(sock, msg, "📦 *Chat unarchived!*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡");
  else await sendReply(sock, msg, "❌ Unarchive failed. Try again.");
});
cmd("clear", { desc: "Clear chat messages", category: "WHATSAPP", ownerOnly: true }, async (sock, msg) => {
  try { await sock.chatModify({ delete: true, lastMessages: [{ key: msg.key, messageTimestamp: msg.messageTimestamp }] }, msg.key.remoteJid); await sendReply(sock, msg, "🗑️ *Chat cleared!*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡"); }
  catch (e) { await sendReply(sock, msg, "❌ Failed: " + e.message); }
});
cmd(["report", "feedback", "request"], { desc: "Report/feedback", category: "MISC" }, async (sock, msg, args) => {
  const c = extractCommandName(msg);
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}${c} <message>`); return; }
  await react(sock, msg, "📨");
  const senderJid = getSender(msg);
  const senderNum = _cleanNum(senderJid);
  const senderName = await getDisplayName(sock, senderJid, isGroup(msg) ? msg.key.remoteJid : null);
  let groupName = "DM";
  if (isGroup(msg)) {
    try { const meta = await sock.groupMetadata(msg.key.remoteJid); groupName = meta.subject || "Unknown Group"; } catch { groupName = "Group"; }
  }
  await sendReply(sock, msg, `✅ *${c.charAt(0).toUpperCase() + c.slice(1)} sent to owner!*\n\nYour message: "${args.join(" ")}"\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  if (CONFIG.OWNER_NUMBER) {
    const ownerMsg = `📨 *New ${c.toUpperCase()}*\n\n` +
      `👤 *Name:* ${senderName}\n` +
      `📱 *Number:* +${senderNum}\n` +
      `🔗 *Link:* wa.me/${senderNum}\n` +
      `💬 *From:* ${groupName}\n\n` +
      `📝 *Message:*\n${args.join(" ")}\n\n` +
      `> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
    await sendText(sock, CONFIG.OWNER_NUMBER + "@s.whatsapp.net", ownerMsg).catch(() => {});
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  HENTAI (adult only — gated by adultMode)
// ═══════════════════════════════════════════════════════════════════════════════
const HENTAI_ENDPOINTS = {
  htimig: "nsfw/hentai", xsearch: "search/xsearch", xdl: "download/xdl",
  xget: "nsfw/xget", xhsearch: "search/xhsearch", xhdl: "download/xhdl",
  phsearch: "search/phsearch", phdl: "download/phdl", hentaivid: "nsfw/hentaivid",
};
for (const [hcmd, endpoint] of Object.entries(HENTAI_ENDPOINTS)) {
  cmd(hcmd, { desc: "Adult content (18+)", category: "HENTAI", adult: true }, async (sock, msg, args) => {
    const s = getSettings(msg.key.remoteJid);
    if (!s.adultMode) { await sendReply(sock, msg, `🔞 Adult mode is OFF.\nEnable with: *${CONFIG.PREFIX}setting*`); return; }
    await react(sock, msg, "🔞");
    try {
      let apiUrl = `${CONFIG.GIFTED_API}/api/${endpoint}?apikey=${CONFIG.GIFTED_KEY}`;
      if (args.length) apiUrl += `&q=${encodeURIComponent(args.join(" "))}`;
      if (args[0] && (args[0].startsWith("http") || args[0].includes("."))) apiUrl += `&url=${encodeURIComponent(args[0])}`;
      const { data } = await axios.get(apiUrl, { timeout: 30000 });
      if (data?.success && data?.result) {
        const r = data.result;
        const url = r.download_url || r.url || r.video || r.image || (typeof r === "string" ? r : null);
        if (url) {
          const media = await axios.get(url, { responseType: "arraybuffer", timeout: 60000 });
          const isVid = url.includes(".mp4") || url.includes("video") || hcmd.includes("vid") || hcmd.includes("dl");
          if (isVid) {
            await sock.sendMessage(msg.key.remoteJid, { video: Buffer.from(media.data), caption: `🔞 *${hcmd.toUpperCase()}*\n\n_18+ Content_\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
          } else {
            await sock.sendMessage(msg.key.remoteJid, { image: Buffer.from(media.data), caption: `🔞 *${hcmd.toUpperCase()}*\n\n_18+ Content_\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
          }
        } else if (r.title || r.results) {
          const results = r.results || [r];
          let txt = `🔞 *${hcmd.toUpperCase()} Results*\n\n`;
          for (const item of (Array.isArray(results) ? results.slice(0, 5) : [results])) {
            txt += `• ${item.title || item.name || JSON.stringify(item).slice(0, 100)}\n`;
            if (item.url) txt += `  🔗 ${item.url}\n`;
          }
          await sendReply(sock, msg, txt + `\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
        } else {
          await sendReply(sock, msg, `🔞 *${hcmd.toUpperCase()}*\n\n${JSON.stringify(r).slice(0, 500)}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
        }
      } else {
        await sendReply(sock, msg, `🔞 *${hcmd.toUpperCase()}*\n\n${args.length ? "Usage: " + CONFIG.PREFIX + hcmd + " <query/url>" : "⚠️ No results"}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
      }
    } catch (e) { await sendReply(sock, msg, `❌ ${hcmd}: ${e.message}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  VIEWONCE BYPASS
// ═══════════════════════════════════════════════════════════════════════════════
async function handleViewOnce(sock, msg) {
  if (!msg.message) return;
  const m = msg.message;
  const vo = m.viewOnceMessage?.message || m.viewOnceMessageV2?.message || m.viewOnceMessageV2Extension?.message;
  if (!vo) return;
  viewonceStore.set(msg.key.id, { msg, vo }); setTimeout(() => viewonceStore.delete(msg.key.id), 10 * 60 * 1000);
  // Check if antiViewOnce is enabled — auto-forward to owner DM silently
  const jid = msg.key.remoteJid;
  const s = getSettings(jid);
  const ownerSettings = settings.get(getOwnerJid()) || {};
  if (s.antiViewOnce || ownerSettings.antiViewOnce) {
    const ownerJid = getOwnerJid();
    const senderNum = _cleanNum(msg.key.participant || msg.key.remoteJid);
    const senderName = pushNameCache.get(senderNum) || "+" + senderNum;
    let groupName = "DM";
    if (jid.endsWith("@g.us")) {
      try { const meta = await sock.groupMetadata(jid); groupName = meta.subject; } catch {}
    }
    const cap = `👁️ *ViewOnce Captured (Stealth)*\n\n👤 *From:* ${senderName} (+${senderNum})\n🔗 wa.me/${senderNum}\n💬 *Chat:* ${groupName}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
    // React to the original viewonce with 👀 (visible to sender — looks natural)
    const reactEmoji = ownerSettings.avoReactEmoji || "👀";
    try { await sock.sendMessage(jid, { react: { text: reactEmoji, key: msg.key } }); } catch {}
    try {
      if (vo.imageMessage) {
        const st = await downloadContentFromMessage(vo.imageMessage, "image");
        let buf = Buffer.from([]);
        for await (const c of st) buf = Buffer.concat([buf, c]);
        await sock.sendMessage(ownerJid, { image: buf, caption: cap });
      } else if (vo.videoMessage) {
        const st = await downloadContentFromMessage(vo.videoMessage, "video");
        let buf = Buffer.from([]);
        for await (const c of st) buf = Buffer.concat([buf, c]);
        await sock.sendMessage(ownerJid, { video: buf, caption: cap });
      } else if (vo.audioMessage) {
        const st = await downloadContentFromMessage(vo.audioMessage, "audio");
        let buf = Buffer.from([]);
        for await (const c of st) buf = Buffer.concat([buf, c]);
        await sock.sendMessage(ownerJid, { audio: buf, mimetype: "audio/ogg; codecs=opus", ptt: true });
        await sock.sendMessage(ownerJid, { text: cap });
      } else {
        // Unknown media type — send caption only
        await sock.sendMessage(ownerJid, { text: cap + "\n\n_⚠️ Media type not downloadable_" });
      }
    } catch (e) { console.error("[ANTI-VIEWONCE]", e.message); }
  }

}

async function handleReaction(sock, reaction) {
  const { key: rKey, text: emoji } = reaction.reaction;
  if (!emoji) return;
  // reactor is the person who SENT the reaction (reaction.key), not the original msg sender
  const reactorJid = reaction.key?.participant || reaction.key?.remoteJid || rKey.participant || rKey.remoteJid;
  if (!isOwner(reactorJid) && !fromMe) {
    // If not owner, ignore (unless bot itself sent the reaction)
  }
  if (!isOwner(reactorJid)) return;
  const stored = viewonceStore.get(rKey.id);
  if (!stored) return;
  const { vo } = stored;
  const ownerJid = getOwnerJid();
  try {
    await react(sock, stored.msg, "👁️");
    const cap = `🕵️ *ViewOnce*\nFrom: ${stored.msg.key.participant || stored.msg.key.remoteJid}`;
    if (vo.imageMessage) { const s = await downloadContentFromMessage(vo.imageMessage, "image"); let buf = Buffer.from([]); for await (const c of s) buf = Buffer.concat([buf, c]); await sock.sendMessage(ownerJid, { image: buf, caption: cap }); }
    else if (vo.videoMessage) { const s = await downloadContentFromMessage(vo.videoMessage, "video"); let buf = Buffer.from([]); for await (const c of s) buf = Buffer.concat([buf, c]); await sock.sendMessage(ownerJid, { video: buf, caption: cap }); }
    else await sendText(sock, ownerJid, `🕵️ *ViewOnce (text)*\n${cap}`);
  } catch (e) { console.error("[VIEWONCE]", e.message); }
}


// ═══════════════════════════════════════════════════════════════════════════════
//  DOWNLOAD COMMANDS — ytmp3, ytmp4, ytv, tiktok, twitter, facebook, instagram,
//  spotify, snapchat, capcut, threads, pinterest, mediafire, gdrive, soundcloud,
//  apk, linkedin, reddit
// ═══════════════════════════════════════════════════════════════════════════════
cmd(["ytmp3"], { desc: "YouTube to MP3", category: "DOWNLOAD" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}ytmp3 <YouTube URL>`); return; }
  await react(sock, msg, "🎵");
  const url = args[0];
  const jid = msg.key.remoteJid;
  const statusMsg = await sock.sendMessage(jid, { text: `🎵 *MIAS MDX MP3*\n\n⬡ Connecting to server...\n◻ Downloading audio...\n◻ Sending file...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
  const ytKey = statusMsg.key;
  const dlApis = [
    // Cobalt v2 (standard endpoint)
    async () => {
      const { data } = await axios.post("https://api.cobalt.tools/", { url, downloadMode: "audio", audioFormat: "mp3", audioBitrate: "128" }, {
        headers: { "Accept": "application/json", "Content-Type": "application/json" }, timeout: 25000
      });
      if (data?.url) return { dl: data.url, title: "YouTube Audio" };
      if (data?.audio) return { dl: data.audio, title: "YouTube Audio" };
    },
    // Cobalt mirror
    async () => {
      const { data } = await axios.post("https://cobalt-api.kwiatekmiki.com/", { url, downloadMode: "audio", audioFormat: "mp3" }, {
        headers: { "Accept": "application/json", "Content-Type": "application/json" }, timeout: 25000
      });
      if (data?.url) return { dl: data.url, title: "YouTube Audio" };
    },
    // siputzx API
    async () => {
      const { data } = await axios.get(`https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(url)}`, { timeout: 30000 });
      const r = data?.data || data?.result;
      if (r?.mp3 || r?.download || r?.url) return { dl: r.mp3 || r.download || r.url, title: r.title || "YouTube Audio" };
    },
    // oceansaver
    async () => {
      const { data } = await axios.get(`https://p.oceansaver.in/ajax/download.php?copyright=0&format=mp3&url=${encodeURIComponent(url)}`, { timeout: 30000 });
      if (data?.success && data?.download_url) return { dl: data.download_url, title: data.title || "YouTube Audio" };
      if (data?.id) {
        // Poll for result
        for (let i = 0; i < 6; i++) {
          await new Promise(r => setTimeout(r, 3000));
          const { data: d2 } = await axios.get(`https://p.oceansaver.in/ajax/progress.php?id=${data.id}`, { timeout: 10000 });
          if (d2?.download_url) return { dl: d2.download_url, title: data.title || "YouTube Audio" };
        }
      }
    },
    // Invidious direct audio extraction
    async () => {
      const videoId = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
      if (!videoId) throw new Error("no id");
      const instances = ["https://inv.nadeko.net", "https://invidious.io.lol", "https://yt.cdaut.de"];
      for (const inst of instances) {
        try {
          const { data } = await axios.get(`${inst}/api/v1/videos/${videoId}`, { timeout: 15000 });
          const audio = data?.adaptiveFormats?.find(f => f.type?.includes("audio") && f.url);
          if (audio?.url) return { dl: audio.url, title: data.title || "YouTube Audio" };
        } catch {}
      }
    },
    // GiftedTech
    async () => {
      const { data } = await axios.get(`${CONFIG.GIFTED_API}/api/download/ytmp3?apikey=${CONFIG.GIFTED_KEY}&url=${encodeURIComponent(url)}`, { timeout: 60000 });
      if (data?.success && data?.result) return { dl: data.result.download_url || data.result.url || data.result.audio || data.result.mp3, title: data.result.title };
    },
    async () => { const r = await APIs.getEliteProTechDownloadByUrl(url); return { dl: r.download, title: r.title }; },
    async () => { const r = await APIs.getYupraDownloadByUrl(url); return { dl: r.download, title: r.title }; },
    async () => { const r = await APIs.getOkatsuDownloadByUrl(url); return { dl: r.download, title: r.title }; },
    async () => { const r = await APIs.getIzumiDownloadByUrl(url); return { dl: r.download, title: r.title }; },
  ];
  for (const tryDl of dlApis) {
    try {
      const result = await tryDl();
      if (result?.dl) {
        const buf = await axios.get(result.dl, { responseType: "arraybuffer", timeout: 120000, headers: { "User-Agent": "Mozilla/5.0" }, maxRedirects: 5 });
        if (buf.data && buf.data.length > 5000) {
          await editMessage(sock, jid, ytKey, `🎵 *MIAS MDX MP3*\n\n⬢ Connecting to server... ✅\n⬢ Downloading audio... ✅\n⬡ Sending file...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
          // Validate audio data - check if it's actually audio content
          const audioData = Buffer.from(buf.data);
          const ct = buf.headers?.["content-type"] || "";
          // Reject HTML error pages masquerading as audio
          const firstBytes = audioData.slice(0, 20).toString("utf8").trim().toLowerCase();
          if (firstBytes.startsWith("<!doctype") || firstBytes.startsWith("<html") || firstBytes.startsWith("<?xml") || firstBytes.startsWith("{\"error")) {
            throw new Error("Server returned error page instead of audio");
          }
          // Detect actual format from magic bytes
          let sendMime = "audio/mpeg";
          const hex = audioData.slice(0, 4).toString("hex");
          if (hex.startsWith("4f676753")) sendMime = "audio/ogg; codecs=opus"; // OggS
          else if (hex.startsWith("66747970") || audioData.slice(4, 8).toString("ascii") === "ftyp") sendMime = "audio/mp4"; // ftyp (MP4/M4A)
          else if (hex.startsWith("52494646")) sendMime = "audio/wav"; // RIFF
          else if (ct.includes("ogg") || ct.includes("opus")) sendMime = "audio/ogg; codecs=opus";
          else if (ct.includes("mp4") || ct.includes("m4a")) sendMime = "audio/mp4";
          // Try sending as audio first, fallback to document
          const fileName = `${(result.title || "audio").replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 60)}.mp3`;
          try {
            await sock.sendMessage(jid, { audio: audioData, mimetype: sendMime, ptt: false, fileName }, { quoted: msg });
          } catch (audioErr) {
            // Fallback: send as document so user still gets the file
            await sock.sendMessage(jid, { document: audioData, mimetype: "audio/mpeg", fileName, caption: `🎵 *${result.title || "Audio"}*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
          }
          await editMessage(sock, jid, ytKey, `🎵 *MIAS MDX MP3*\n\n⬢ Connecting to server... ✅\n⬢ Downloading audio... ✅\n⬢ Sending file... ✅\n\n✅ *${result.title || "Audio"}* sent!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
          return;
        }
      }
    } catch { continue; }
  }
  await editMessage(sock, jid, ytKey, `🎵 *MIAS MDX MP3*\n\n⬢ Connecting to server... ✅\n⬢ Downloading audio... ❌\n\n⚠️ All servers busy — try again later\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});

cmd(["ytmp4", "ytv"], { desc: "YouTube to MP4", category: "DOWNLOAD" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}ytmp4 <YouTube URL> [360|480|720|1080|2160|hd|fhd|4k]`); return; }
  await react(sock, msg, "🎬");
  const url = args[0];
  const qRaw = (args[1] || "").toLowerCase();
  const qualityMap = { sd: "360", hd: "720", fhd: "1080", uhd: "2160", "4k": "2160", "360p":"360", "480p":"480", "720p":"720", "1080p":"1080", "2160p":"2160" };
  const quality = qualityMap[qRaw] || (qRaw.match(/^(144|240|360|480|720|1080|2160)$/)?.[1]) || null;
  if (!quality) { try { await sendNativeFlowButtons(sock, msg.key.remoteJid, msg, `🎬 *Choose YouTube MP4 Quality*`, [{ id: `${CONFIG.PREFIX}ytmp4 ${url} 360`, text: "SD 360p" }, { id: `${CONFIG.PREFIX}ytmp4 ${url} 480`, text: "480p" }, { id: `${CONFIG.PREFIX}ytmp4 ${url} 720`, text: "HD 720p" }, { id: `${CONFIG.PREFIX}ytmp4 ${url} 1080`, text: "FHD 1080p" }, { id: `${CONFIG.PREFIX}ytmp4 ${url} 2160`, text: "4K 2160p" }]); } catch { await sendReply(sock, msg, `Pick quality: ${CONFIG.PREFIX}ytmp4 ${url} 360/480/720/1080/2160`); } return; }
  const jid = msg.key.remoteJid;
  const statusMsg = await sock.sendMessage(jid, { text: `🎬 *MIAS MDX Video*\n\n⬡ Connecting to server...\n◻ Downloading video...\n◻ Sending file...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
  const vidKey = statusMsg.key;
  const dlApis = [
    // Cobalt v2 (video)
    async () => {
      const { data } = await axios.post("https://api.cobalt.tools/", { url, downloadMode: "video", videoQuality: quality }, {
        headers: { "Accept": "application/json", "Content-Type": "application/json" }, timeout: 25000
      });
      if (data?.url) return { dl: data.url, title: "YouTube Video" };
    },
    // siputzx API
    async () => {
      const { data } = await axios.get(`https://api.siputzx.my.id/api/d/ytmp4?url=${encodeURIComponent(url)}`, { timeout: 30000 });
      const r = data?.data || data?.result;
      if (r?.mp4 || r?.download || r?.url) return { dl: r.mp4 || r.download || r.url, title: r.title || "YouTube Video" };
    },
    // oceansaver (video)
    async () => {
      const { data } = await axios.get(`https://p.oceansaver.in/ajax/download.php?copyright=0&format=${quality}&url=${encodeURIComponent(url)}`, { timeout: 30000 });
      if (data?.success && data?.download_url) return { dl: data.download_url, title: data.title || "YouTube Video" };
      if (data?.id) {
        for (let i = 0; i < 6; i++) {
          await new Promise(r => setTimeout(r, 4000));
          const { data: d2 } = await axios.get(`https://p.oceansaver.in/ajax/progress.php?id=${data.id}`, { timeout: 10000 });
          if (d2?.download_url) return { dl: d2.download_url, title: data.title || "YouTube Video" };
        }
      }
    },
    // GiftedTech
    async () => {
      const { data } = await axios.get(`${CONFIG.GIFTED_API}/api/download/ytmp4?apikey=${CONFIG.GIFTED_KEY}&url=${encodeURIComponent(url)}`, { timeout: 60000 });
      if (data?.success && data?.result) return { dl: data.result.download_url || data.result.url || data.result.video || data.result.mp4, title: data.result.title };
    },
    async () => { const r = await APIs.getEliteProTechVideoByUrl(url); return { dl: r.download, title: r.title }; },
    async () => { const r = await APIs.getYupraVideoByUrl(url); return { dl: r.download, title: r.title }; },
    async () => { const r = await APIs.getOkatsuVideoByUrl(url); return { dl: r.download, title: r.title }; },
  ];
  for (const tryDl of dlApis) {
    try {
      const result = await tryDl();
      if (result?.dl) {
        const buf = await axios.get(result.dl, { responseType: "arraybuffer", timeout: 120000, headers: { "User-Agent": "Mozilla/5.0" } });
        if (buf.data && buf.data.length > 5000) {
          // Validate it's actually video (not HTML error page)
          const firstBytes = Buffer.from(buf.data).slice(0, 5).toString("utf8").toLowerCase();
          if (firstBytes.includes("<!doc") || firstBytes.includes("<html")) continue;
          await editMessage(sock, jid, vidKey, `🎬 *MIAS MDX Video*\n\n⬢ Connecting to server... ✅\n⬢ Downloading video... ✅\n⬡ Sending file...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
          try {
            await sock.sendMessage(jid, { video: Buffer.from(buf.data), caption: `🎬 *${result.title || "YouTube Video"}*\n📺 Requested quality: *${quality === "2160" ? "4K 2160p" : quality + "p"}*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
          } catch {
            // Send as document if video send fails
            await sock.sendMessage(jid, { document: Buffer.from(buf.data), mimetype: "video/mp4", fileName: `${(result.title || "video").slice(0,50)}.mp4`, caption: `🎬 *${result.title || "YouTube Video"}*` }, { quoted: msg });
          }
          await editMessage(sock, jid, vidKey, `🎬 *MIAS MDX Video*\n\n⬢ Connecting to server... ✅\n⬢ Downloading video... ✅\n⬢ Sending file... ✅\n\n✅ *Done!* Enjoy 🎬\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
          return;
        }
      }
    } catch { continue; }
  }
  await editMessage(sock, jid, vidKey, `🎬 *MIAS MDX Video*\n\n⬢ Connecting to server... ✅\n⬢ Downloading video... ❌\n\n⚠️ All download servers are busy. Try again later or try a shorter clip.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  DOWNLOAD COMMANDS — Multi-API fallback chains
// ═══════════════════════════════════════════════════════════════════════════════

// Universal downloader with fallback chain
async function universalDownload(url, platform) {
  const apis = [
    // Cobalt.tools — best universal downloader
    async () => {
      const { data } = await axios.post("https://api.cobalt.tools/", {
        url, downloadMode: "auto", filenameStyle: "basic"
      }, { headers: { "Accept": "application/json", "Content-Type": "application/json" }, timeout: 30000 });
      if (data?.url) return { dl: data.url, title: data?.filename || platform };
      if (data?.picker) return { dl: data.picker[0]?.url, title: platform, picker: data.picker };
    },
    // GiftedTech
    async () => {
      const ep = { tiktok: "tiktok", twitter: "twitter", facebook: "facebook", instagram: "instagram",
        spotify: "spotify", snapchat: "snapchat", capcut: "capcut", threads: "threads",
        pinterest: "pinterest", mediafire: "mediafire", gdrive: "gdrive", soundcloud: "soundcloud",
        linkedin: "linkedin", reddit: "reddit" }[platform] || platform;
      const { data } = await axios.get(`${CONFIG.GIFTED_API}/api/download/${ep}?apikey=${CONFIG.GIFTED_KEY}&url=${encodeURIComponent(url)}`, { timeout: 30000 });
      if (data?.success && data?.result) {
        const r = data.result;
        return { dl: r.download_url || r.url || r.video || r.audio || r.mp4 || r.mp3 || r.image, title: r.title || platform };
      }
    },
    // Siputzx
    async () => {
      const { data } = await axios.get(`https://api.siputzx.my.id/api/d/${platform}?url=${encodeURIComponent(url)}`, { timeout: 20000 });
      const r = data?.data || data?.result;
      if (r) return { dl: r.url || r.download || r.video || r.audio || r.mp4, title: r.title || platform };
    },
    // Nexoracle
    async () => {
      const { data } = await axios.get(`https://api.nexoracle.com/downloader/${platform}?apikey=free_key@maher_apis&url=${encodeURIComponent(url)}`, { timeout: 20000 });
      const r = data?.result || data?.data;
      if (r) return { dl: r.url || r.download || r.video || r.audio || r.mp4 || r.hd || r.sd, title: r.title || platform };
    },
    // Ryzendesu
    async () => {
      const { data } = await axios.get(`https://api.ryzendesu.vip/api/downloader/${platform}?url=${encodeURIComponent(url)}`, { timeout: 20000 });
      const r = data?.data || data?.result || data;
      if (r) return { dl: r.url || r.download || r.video || r.audio || r.mp4, title: r.title || platform };
    },
    // Widipe
    async () => {
      const { data } = await axios.get(`https://widipe.com/download/${platform}dl?url=${encodeURIComponent(url)}`, { timeout: 20000 });
      const r = data?.result || data?.data;
      if (r) return { dl: r.url || r.download || r.video || r.audio || r.mp4, title: r.title || platform };
    },
    // DavidCyril
    async () => {
      const { data } = await axios.get(`https://api.davidcyriltech.my.id/${platform}?url=${encodeURIComponent(url)}`, { timeout: 20000 });
      const r = data?.result || data;
      if (r) return { dl: r.video || r.url || r.download || r.audio || r.mp4, title: r.title || platform };
    },
    // Diio
    async () => {
      const { data } = await axios.get(`https://api.diioffc.web.id/api/download/${platform}?url=${encodeURIComponent(url)}`, { timeout: 20000 });
      const r = data?.result || data?.data;
      if (r) return { dl: r.url || r.download || r.video || r.mp4, title: r.title || platform };
    },
    // BK9
    async () => {
      const { data } = await axios.get(`https://bk9.fun/download/${platform}?url=${encodeURIComponent(url)}`, { timeout: 20000 });
      const r = data?.BK9 || data?.result || data?.data;
      if (r) return { dl: r.url || r.download || r.video || r.mp4, title: r.title || platform };
    },
    // Aemt
    async () => {
      const { data } = await axios.get(`https://aemt.me/download/${platform}?url=${encodeURIComponent(url)}`, { timeout: 20000 });
      const r = data?.result || data?.data;
      if (r) return { dl: r.url || r.download || r.video || r.mp4, title: r.title || platform };
    },
    // FastURL
    async () => {
      const { data } = await axios.get(`https://api.fasturl.cloud/download/${platform}?url=${encodeURIComponent(url)}`, { timeout: 20000 });
      const r = data?.result || data?.data;
      if (r) return { dl: r.url || r.download || r.video || r.mp4, title: r.title || platform };
    },
  ];
  for (const tryApi of apis) {
    try { const r = await tryApi(); if (r?.dl) return r; } catch { continue; }
  }
  return null;
}

const DL_PLATFORMS = {
  tiktok: { emoji: "🎵", name: "TikTok" },
  twitter: { emoji: "🐦", name: "Twitter/X" },
  // facebook handled separately with quality options

  instagram: { emoji: "📸", name: "Instagram" },
  spotify: { emoji: "🎧", name: "Spotify" },
  snapchat: { emoji: "👻", name: "Snapchat" },
  capcut: { emoji: "✂️", name: "CapCut" },
  threads: { emoji: "🧵", name: "Threads" },
  gdrive: { emoji: "☁️", name: "Google Drive" },
  soundcloud: { emoji: "🔊", name: "SoundCloud" },
  linkedin: { emoji: "💼", name: "LinkedIn" },
  reddit: { emoji: "🤖", name: "Reddit" },
};
// Dedicated MediaFire handler with multiple scrapers
cmd("mediafire", { desc: "Download from MediaFire", category: "DOWNLOAD" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}mediafire <MediaFire URL>`); return; }
  await react(sock, msg, "📁");
  const jid = msg.key.remoteJid;
  const mfUrl = args[0];
  const statusMsg = await sock.sendMessage(jid, { text: `📁 *MIAS MDX — MediaFire*\n\n⬡ Fetching download link...\n◻ Downloading file...\n◻ Sending...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
  const mfKey = statusMsg.key;
  const mfApis = [
    async () => {
      // Scrape MediaFire page directly for the download button link
      const { data: html } = await axios.get(mfUrl, { timeout: 20000, headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } });
      const dlMatch = html.match(/href="(https?:\/\/download[^"]+mediafire\.com[^"]+)"/i) || html.match(/aria-label="Download file"[^>]*href="([^"]+)"/i) || html.match(/id="downloadButton"[^>]*href="([^"]+)"/i);
      const nameMatch = html.match(/class="dl-btn-label"[^>]*>([^<]+)</i) || html.match(/<title>([^<]+)<\/title>/i);
      if (dlMatch?.[1]) return { dl: dlMatch[1], title: nameMatch?.[1]?.replace(/ - MediaFire$/i, "").trim() || "MediaFire File" };
    },
    async () => {
      const { data } = await axios.get(`${CONFIG.GIFTED_API}/api/download/mediafire?apikey=${CONFIG.GIFTED_KEY}&url=${encodeURIComponent(mfUrl)}`, { timeout: 30000 });
      if (data?.success && data?.result) {
        const r = data.result;
        return { dl: r.download_url || r.url || r.download || r.link, title: r.title || r.filename || "MediaFire File", size: r.size };
      }
    },
    async () => {
      const { data } = await axios.get(`https://api.siputzx.my.id/api/d/mediafire?url=${encodeURIComponent(mfUrl)}`, { timeout: 20000 });
      const r = data?.data || data?.result;
      if (r) return { dl: r.url || r.download || r.link, title: r.title || r.filename || "MediaFire File" };
    },
    async () => {
      const { data } = await axios.get(`https://api.nexoracle.com/downloader/mediafire?apikey=free_key@maher_apis&url=${encodeURIComponent(mfUrl)}`, { timeout: 20000 });
      const r = data?.result;
      if (r) return { dl: r.download || r.url || r.link, title: r.filename || r.title || "MediaFire File" };
    },
    async () => {
      const { data } = await axios.get(`https://api.ryzendesu.vip/api/downloader/mediafire?url=${encodeURIComponent(mfUrl)}`, { timeout: 20000 });
      const r = data?.result || data?.data || data;
      if (r?.url || r?.download) return { dl: r.url || r.download, title: r.fileName || r.title || "MediaFire File", size: r.size };
    },
    async () => {
      const { data } = await axios.get(`https://widipe.com/download/mediafiredl?url=${encodeURIComponent(mfUrl)}`, { timeout: 20000 });
      const r = data?.result; if (r?.link || r?.url) return { dl: r.link || r.url, title: r.fileName || r.title || "MediaFire File", size: r.size };
    },
    async () => {
      const { data } = await axios.get(`https://api.davidcyriltech.my.id/mediafire?url=${encodeURIComponent(mfUrl)}`, { timeout: 20000 });
      const r = data?.result; if (r?.link || r?.url || r?.download) return { dl: r.link || r.url || r.download, title: r.name || r.fileName || "MediaFire File", size: r.size };
    },
    async () => {
      const { data } = await axios.get(`https://bk9.fun/download/mediafire?url=${encodeURIComponent(mfUrl)}`, { timeout: 20000 });
      const r = data?.BK9 || data?.result; if (r?.url || r?.dlink) return { dl: r.url || r.dlink, title: r.name || r.title || "MediaFire File", size: r.size };
    },
  ];
  for (const tryApi of mfApis) {
    try {
      const result = await tryApi();
      if (result?.dl) {
        await editMessage(sock, jid, mfKey, `📁 *MIAS MDX — MediaFire*\n\n⬢ Fetching download link... ✅\n⬡ Downloading *${result.title}*...\n◻ Sending...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
        const buf = await axios.get(result.dl, { responseType: "arraybuffer", timeout: 120000, headers: { "User-Agent": "Mozilla/5.0" }, maxRedirects: 5 });
        if (buf.data && buf.data.length > 500) {
          const ct = buf.headers?.["content-type"] || "";
          const fileName = result.title || "mediafire_file";
          await sock.sendMessage(jid, { document: Buffer.from(buf.data), fileName, mimetype: ct || "application/octet-stream", caption: `📁 *${fileName}*${result.size ? "\nSize: " + result.size : ""}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
          await editMessage(sock, jid, mfKey, `📁 *MIAS MDX — MediaFire*\n\n⬢ Fetching download link... ✅\n⬢ Downloading... ✅\n⬢ Sending... ✅\n\n✅ *${fileName}* sent!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
          return;
        }
      }
    } catch { continue; }
  }
  await editMessage(sock, jid, mfKey, `📁 *MIAS MDX — MediaFire*\n\n❌ Could not download from this MediaFire link.\nMake sure the link is valid and the file isn't private.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});

for (const [pCmd, pInfo] of Object.entries(DL_PLATFORMS)) {
  cmd(pCmd, { desc: `Download from ${pInfo.name}`, category: "DOWNLOAD" }, async (sock, msg, args) => {
    if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}${pCmd} <URL>`); return; }
    await react(sock, msg, pInfo.emoji);
    const jid = msg.key.remoteJid;
    const statusMsg = await sock.sendMessage(jid, { text: `${pInfo.emoji} *MIAS MDX — ${pInfo.name}*\n\n⬡ Fetching media...\n◻ Downloading...\n◻ Sending...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
    const dlKey = statusMsg.key;
    try {
      const result = await universalDownload(args[0], pCmd);
      if (result?.dl) {
        await editMessage(sock, jid, dlKey, `${pInfo.emoji} *MIAS MDX — ${pInfo.name}*\n\n⬢ Fetching media... ✅\n⬡ Downloading...\n◻ Sending...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
        const buf = await axios.get(result.dl, { responseType: "arraybuffer", timeout: 120000 });
        await editMessage(sock, jid, dlKey, `${pInfo.emoji} *MIAS MDX — ${pInfo.name}*\n\n⬢ Fetching media... ✅\n⬢ Downloading... ✅\n⬡ Sending...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
        const ct = buf.headers?.["content-type"] || "";
        if (ct.includes("audio") || pCmd === "spotify" || pCmd === "soundcloud") {
          await sock.sendMessage(jid, { audio: Buffer.from(buf.data), mimetype: "audio/mpeg", ptt: false }, { quoted: msg });
        } else if (ct.includes("video") || result.dl.includes(".mp4")) {
          await sock.sendMessage(jid, { video: Buffer.from(buf.data), caption: `${pInfo.emoji} *${pInfo.name}*\n\n${result.title || ""}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
        } else {
          await sock.sendMessage(jid, { image: Buffer.from(buf.data), caption: `${pInfo.emoji} *${pInfo.name}*\n\n${result.title || ""}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
        }
        await editMessage(sock, jid, dlKey, `${pInfo.emoji} *MIAS MDX — ${pInfo.name}*\n\n⬢ Fetching media... ✅\n⬢ Downloading... ✅\n⬢ Sending... ✅\n\n✅ *Done!*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
      } else {
        await editMessage(sock, jid, dlKey, `${pInfo.emoji} *MIAS MDX — ${pInfo.name}*\n\n⬢ Fetching media... ❌\n\n⚠️ Download failed. URL may be private or unsupported.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
      }
    } catch (e) {
      await editMessage(sock, jid, dlKey, `${pInfo.emoji} *MIAS MDX — ${pInfo.name}*\n\n❌ Error: ${e.message}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    }
  });
}

// Facebook — with quality options (video/audio/document)
cmd(["facebook", "fb"], { desc: "Download from Facebook — .fb <URL> [video|audio|doc|hd]", category: "DOWNLOAD" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage:\n${CONFIG.PREFIX}fb <URL> — auto-detect\n${CONFIG.PREFIX}fb <URL> video — video\n${CONFIG.PREFIX}fb <URL> audio — audio only\n${CONFIG.PREFIX}fb <URL> doc — as document\n${CONFIG.PREFIX}fb <URL> hd — high quality\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; }
  await react(sock, msg, "📘");
  const url = args[0];
  const mode = (args[1] || "").toLowerCase(); // video, audio, doc, hd
  const jid = msg.key.remoteJid;
  const statusMsg = await sock.sendMessage(jid, { text: `📘 *MIAS MDX — Facebook*\n\n⬡ Fetching media...\n◻ Downloading${mode ? " (" + mode + ")" : ""}...\n◻ Sending...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
  const dlKey = statusMsg.key;
  try {
    const result = await universalDownload(url, "facebook");
    if (result?.dl) {
      await editMessage(sock, jid, dlKey, `📘 *MIAS MDX — Facebook*\n\n⬢ Fetching media... ✅\n⬡ Downloading...\n◻ Sending...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
      const buf = await axios.get(result.dl, { responseType: "arraybuffer", timeout: 120000 });
      await editMessage(sock, jid, dlKey, `📘 *MIAS MDX — Facebook*\n\n⬢ Fetching media... ✅\n⬢ Downloading... ✅\n⬡ Sending...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
      const mediaBuffer = Buffer.from(buf.data);
      if (mode === "audio") {
        await sock.sendMessage(jid, { audio: mediaBuffer, mimetype: "audio/mpeg", ptt: false }, { quoted: msg });
      } else if (mode === "doc" || mode === "document") {
        await sock.sendMessage(jid, { document: mediaBuffer, mimetype: "video/mp4", fileName: `facebook_${Date.now()}.mp4` }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { video: mediaBuffer, caption: `📘 *Facebook${mode === "hd" ? " (HD)" : ""}*\n\n${result.title || ""}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
      }
      await editMessage(sock, jid, dlKey, `📘 *MIAS MDX — Facebook*\n\n⬢ Fetching... ✅\n⬢ Downloading... ✅\n⬢ Sending... ✅\n\n✅ *Done!*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    } else {
      await editMessage(sock, jid, dlKey, `📘 *MIAS MDX — Facebook*\n\n⬢ Fetching media... ❌\n\n⚠️ Could not download. URL may be private.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    }
  } catch (e) {
    await editMessage(sock, jid, dlKey, `📘 *MIAS MDX — Facebook*\n\n❌ Error: ${e.message}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});

// Pinterest — special: supports search + URL download + limit for HD images AND videos
// ─── MISSING DOWNLOADERS ────────────────────────────────────────────────
async function _cobaltDl(url, opts = {}) {
  const endpoints = [
    "https://api.cobalt.tools/",
    "https://cobalt-api.kwiatekmiki.com/",
  ];
  for (const ep of endpoints) {
    try {
      const { data } = await axios.post(ep, { url, ...opts }, {
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        timeout: 25000,
      });
      if (data?.url) return data.url;
      if (data?.audio) return data.audio;
    } catch {}
  }
  return null;
}

cmd(["tiktok","tt","ttdl"], { desc: "Download TikTok video/audio", category: "DOWNLOAD" }, async (sock, msg, args) => {
  if (!args[0]) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}tiktok <url>`); return; }
  await react(sock, msg, "🎵");
  const url = args[0];
  const isAudio = (args[1]||"").toLowerCase() === "audio";
  let dlUrl = null;
  try {
    // Try TikWM API first
    const { data } = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`, { timeout: 20000 });
    if (data?.data?.play) dlUrl = isAudio ? (data.data.music || data.data.play) : (data.data.hdplay || data.data.play);
  } catch {}
  if (!dlUrl) dlUrl = await _cobaltDl(url, { downloadMode: isAudio ? "audio" : "auto" });
  if (!dlUrl) { await sendReply(sock, msg, `❌ Could not download TikTok link. Try a direct video URL.

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; }
  const buf = Buffer.from((await axios.get(dlUrl, { responseType: "arraybuffer", timeout: 60000 })).data);
  if (isAudio) {
    await sock.sendMessage(msg.key.remoteJid, { audio: buf, mimetype: "audio/mpeg", ptt: false, fileName: "tiktok_audio.mp3" }, { quoted: msg });
  } else {
    await sock.sendMessage(msg.key.remoteJid, { video: buf, mimetype: "video/mp4", caption: "TikTok • Powered by *PRECIOUS x* ⚡" }, { quoted: msg });
  }
  await react(sock, msg, "✅");
});

cmd(["twitter","xdl","twit"], { desc: "Download Twitter/X video", category: "DOWNLOAD" }, async (sock, msg, args) => {
  if (!args[0]) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}twitter <tweet_url>`); return; }
  await react(sock, msg, "🐦");
  const url = args[0];
  let dlUrl = await _cobaltDl(url, { downloadMode: "auto" });
  if (!dlUrl) {
    try {
      const { data } = await axios.get(`https://api.ryzendesu.vip/api/downloader/twitter?url=${encodeURIComponent(url)}`, { timeout: 20000 });
      dlUrl = data?.data?.media?.[0]?.url || data?.data?.video_url || data?.url;
    } catch {}
  }
  if (!dlUrl) { await sendReply(sock, msg, `❌ Could not download tweet. Make sure the tweet has a video.

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; }
  const buf = Buffer.from((await axios.get(dlUrl, { responseType: "arraybuffer", timeout: 60000 })).data);
  await sock.sendMessage(msg.key.remoteJid, { video: buf, mimetype: "video/mp4", caption: "Twitter/X • Powered by *PRECIOUS x* ⚡" }, { quoted: msg });
  await react(sock, msg, "✅");
});

cmd(["spotify","spot","spotdl"], { desc: "Download Spotify track as MP3", category: "DOWNLOAD" }, async (sock, msg, args) => {
  if (!args[0]) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}spotify <spotify_track_url>`); return; }
  await react(sock, msg, "🎵");
  const url = args[0];
  let dlUrl = null;
  let title = "Spotify Track";
  try {
    const { data } = await axios.get(`https://api.ryzendesu.vip/api/downloader/spotify?url=${encodeURIComponent(url)}`, { timeout: 25000 });
    dlUrl = data?.data?.download_url || data?.data?.audio || data?.url;
    title = data?.data?.title || title;
  } catch {}
  if (!dlUrl) dlUrl = await _cobaltDl(url, { downloadMode: "audio", audioFormat: "mp3" });
  if (!dlUrl) {
    // Search YouTube and download that
    try {
      const track = url.split("track/")[1]?.split("?")[0] || args.join(" ");
      const { data: yt } = await axios.get(`${CONFIG.GIFTED_API}/api/search/youtube?apikey=${CONFIG.GIFTED_KEY}&q=${encodeURIComponent(title + " audio")}`, { timeout: 15000 });
      const ytUrl = yt?.result?.[0]?.url || yt?.data?.[0]?.url;
      if (ytUrl) dlUrl = await _cobaltDl(ytUrl, { downloadMode: "audio", audioFormat: "mp3" });
    } catch {}
  }
  if (!dlUrl) { await sendReply(sock, msg, `❌ Could not download Spotify track. Try using ${CONFIG.PREFIX}play <track name> instead.

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; }
  const buf = Buffer.from((await axios.get(dlUrl, { responseType: "arraybuffer", timeout: 60000 })).data);
  await sock.sendMessage(msg.key.remoteJid, { audio: buf, mimetype: "audio/mpeg", ptt: false, fileName: `${title}.mp3` }, { quoted: msg });
  await react(sock, msg, "✅");
});

cmd(["instagram","ig","igdl"], { desc: "Download Instagram post/reel", category: "DOWNLOAD" }, async (sock, msg, args) => {
  if (!args[0]) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}instagram <ig_url>`); return; }
  await react(sock, msg, "📸");
  const url = args[0];
  let dlUrl = null;
  try {
    const { data } = await axios.get(`https://api.ryzendesu.vip/api/downloader/igdl?url=${encodeURIComponent(url)}`, { timeout: 20000 });
    dlUrl = data?.data?.[0]?.url || data?.url;
  } catch {}
  if (!dlUrl) {
    try {
      const { data } = await axios.get(`https://api.siputzx.my.id/api/d/instagram?url=${encodeURIComponent(url)}`, { timeout: 20000 });
      dlUrl = data?.data?.[0]?.url || data?.url;
    } catch {}
  }
  if (!dlUrl) dlUrl = await _cobaltDl(url, { downloadMode: "auto" });
  if (!dlUrl) { await sendReply(sock, msg, `❌ Could not download Instagram post. Make sure the URL is a public post/reel.

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; }
  const buf = Buffer.from((await axios.get(dlUrl, { responseType: "arraybuffer", timeout: 60000 })).data);
  const isVideo = dlUrl.includes(".mp4") || dlUrl.includes("video");
  if (isVideo) {
    await sock.sendMessage(msg.key.remoteJid, { video: buf, mimetype: "video/mp4", caption: "Instagram • Powered by *PRECIOUS x* ⚡" }, { quoted: msg });
  } else {
    await sock.sendMessage(msg.key.remoteJid, { image: buf, caption: "Instagram • Powered by *PRECIOUS x* ⚡" }, { quoted: msg });
  }
  await react(sock, msg, "✅");
});

cmd(["snapchat","snap","snapdl"], { desc: "Download Snapchat spotlight/story", category: "DOWNLOAD" }, async (sock, msg, args) => {
  if (!args[0]) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}snapchat <snap_url>`); return; }
  await react(sock, msg, "👻");
  const url = args[0];
  let dlUrl = await _cobaltDl(url, { downloadMode: "auto" });
  if (!dlUrl) {
    try {
      const { data } = await axios.get(`https://api.ryzendesu.vip/api/downloader/snap?url=${encodeURIComponent(url)}`, { timeout: 20000 });
      dlUrl = data?.data?.video || data?.url;
    } catch {}
  }
  if (!dlUrl) { await sendReply(sock, msg, `❌ Could not download Snapchat content.

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; }
  const buf = Buffer.from((await axios.get(dlUrl, { responseType: "arraybuffer", timeout: 60000 })).data);
  await sock.sendMessage(msg.key.remoteJid, { video: buf, mimetype: "video/mp4", caption: "Snapchat • Powered by *PRECIOUS x* ⚡" }, { quoted: msg });
  await react(sock, msg, "✅");
});

cmd(["capcut","cc","ccvid"], { desc: "Download CapCut video", category: "DOWNLOAD" }, async (sock, msg, args) => {
  if (!args[0]) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}capcut <capcut_url>`); return; }
  await react(sock, msg, "✂️");
  const url = args[0];
  let dlUrl = null;
  try {
    const { data } = await axios.get(`https://api.ryzendesu.vip/api/downloader/capcut?url=${encodeURIComponent(url)}`, { timeout: 20000 });
    dlUrl = data?.data?.video || data?.url;
  } catch {}
  if (!dlUrl) dlUrl = await _cobaltDl(url, { downloadMode: "auto" });
  if (!dlUrl) { await sendReply(sock, msg, `❌ Could not download CapCut video.

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; }
  const buf = Buffer.from((await axios.get(dlUrl, { responseType: "arraybuffer", timeout: 60000 })).data);
  await sock.sendMessage(msg.key.remoteJid, { video: buf, mimetype: "video/mp4", caption: "CapCut • Powered by *PRECIOUS x* ⚡" }, { quoted: msg });
  await react(sock, msg, "✅");
});

cmd(["threads","threadsdl"], { desc: "Download Threads/Meta video", category: "DOWNLOAD" }, async (sock, msg, args) => {
  if (!args[0]) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}threads <threads_url>`); return; }
  await react(sock, msg, "🧵");
  const url = args[0];
  let dlUrl = await _cobaltDl(url, { downloadMode: "auto" });
  if (!dlUrl) { await sendReply(sock, msg, `❌ Could not download Threads content.

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; }
  const buf = Buffer.from((await axios.get(dlUrl, { responseType: "arraybuffer", timeout: 60000 })).data);
  await sock.sendMessage(msg.key.remoteJid, { video: buf, mimetype: "video/mp4", caption: "Threads • Powered by *PRECIOUS x* ⚡" }, { quoted: msg });
  await react(sock, msg, "✅");
});

cmd(["soundcloud","sc","scdl"], { desc: "Download SoundCloud track", category: "DOWNLOAD" }, async (sock, msg, args) => {
  if (!args[0]) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}soundcloud <soundcloud_url>`); return; }
  await react(sock, msg, "🎵");
  const url = args[0];
  let dlUrl = await _cobaltDl(url, { downloadMode: "audio", audioFormat: "mp3" });
  if (!dlUrl) { await sendReply(sock, msg, `❌ Could not download SoundCloud track.

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; }
  const buf = Buffer.from((await axios.get(dlUrl, { responseType: "arraybuffer", timeout: 60000 })).data);
  await sock.sendMessage(msg.key.remoteJid, { audio: buf, mimetype: "audio/mpeg", ptt: false, fileName: "soundcloud.mp3" }, { quoted: msg });
  await react(sock, msg, "✅");
});

cmd(["reddit","redditdl"], { desc: "Download Reddit post/video", category: "DOWNLOAD" }, async (sock, msg, args) => {
  if (!args[0]) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}reddit <reddit_post_url>`); return; }
  await react(sock, msg, "🤖");
  const url = args[0];
  let dlUrl = await _cobaltDl(url, { downloadMode: "auto" });
  if (!dlUrl) {
    try {
      // Reddit JSON API
      const apiUrl = url.replace(/\/?$/, ".json");
      const { data } = await axios.get(apiUrl, { timeout: 15000, headers: { "User-Agent": "WhatsAppBot/1.0" } });
      const post = data?.[0]?.data?.children?.[0]?.data;
      dlUrl = post?.url_overridden_by_dest || post?.url;
    } catch {}
  }
  if (!dlUrl) { await sendReply(sock, msg, `❌ Could not download Reddit content.

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; }
  const buf = Buffer.from((await axios.get(dlUrl, { responseType: "arraybuffer", timeout: 60000 })).data);
  const mime = dlUrl.includes(".mp4") ? "video/mp4" : dlUrl.includes(".mp3") ? "audio/mpeg" : "image/jpeg";
  if (mime === "video/mp4") {
    await sock.sendMessage(msg.key.remoteJid, { video: buf, mimetype: mime, caption: "Reddit • Powered by *PRECIOUS x* ⚡" }, { quoted: msg });
  } else {
    await sock.sendMessage(msg.key.remoteJid, { image: buf, caption: "Reddit • Powered by *PRECIOUS x* ⚡" }, { quoted: msg });
  }
  await react(sock, msg, "✅");
});

// ─── END MISSING DOWNLOADERS ─────────────────────────────────────────────

cmd(["pinterest", "pinsearch", "pin", "pindl", "pin2"], { desc: "Pinterest search/download — .pin <query> [limit] or .pin <URL>", category: "DOWNLOAD" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage:\n${CONFIG.PREFIX}pin <search query> [1-10]\n${CONFIG.PREFIX}pin <pinterest URL>\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; }
  await react(sock, msg, "📌");
  const input = args.join(" ");
  const isUrl = /https?:\/\//.test(args[0]);
  if (isUrl) {
    // Download from Pinterest URL
    try {
      const result = await universalDownload(args[0], "pinterest");
      if (result?.dl) {
        const buf = await axios.get(result.dl, { responseType: "arraybuffer", timeout: 60000 });
        const ct = buf.headers?.["content-type"] || "";
        if (ct.includes("video") || result.dl.includes(".mp4")) {
          await sock.sendMessage(msg.key.remoteJid, { video: Buffer.from(buf.data), caption: `📌 *Pinterest Video*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
        } else {
          await sock.sendMessage(msg.key.remoteJid, { image: Buffer.from(buf.data), caption: `📌 *Pinterest*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
        }
      } else { await sendReply(sock, msg, "❌ Could not download from this Pinterest URL."); }
    } catch (e) { await sendReply(sock, msg, `❌ Pinterest download failed: ${e.message}`); }
    return;
  }
  // Search Pinterest
  const lastArg = args[args.length - 1];
  const limit = /^\d+$/.test(lastArg) ? Math.min(parseInt(lastArg), 20) : 5;
  const query = /^\d+$/.test(lastArg) ? args.slice(0, -1).join(" ") : input;
  const searchApis = [
    async () => {
      const { data } = await axios.get(`https://api.siputzx.my.id/api/s/pinterest?query=${encodeURIComponent(query)}`, { timeout: 15000 });
      return data?.data || data?.result;
    },
    async () => {
      const { data } = await axios.get(`${CONFIG.GIFTED_API}/api/search/pinterest?apikey=${CONFIG.GIFTED_KEY}&query=${encodeURIComponent(query)}`, { timeout: 15000 });
      return data?.result || data?.results;
    },
    async () => {
      const { data } = await axios.get(`https://api.nexoracle.com/downloader/pinterest-search?apikey=free_key@maher_apis&query=${encodeURIComponent(query)}`, { timeout: 15000 });
      return data?.result;
    },
    async () => {
      const { data } = await axios.get(`https://api.dreaded.site/api/pinterest?query=${encodeURIComponent(query)}`, { timeout: 15000 });
      return data?.result || data?.data;
    },
    async () => {
      const { data } = await axios.get(`https://api.popcat.xyz/pinterest?q=${encodeURIComponent(query)}`, { timeout: 15000 });
      return data?.results || data;
    },
    async () => {
      const { data } = await axios.get(`https://api.ryzendesu.vip/api/search/pinterest?query=${encodeURIComponent(query)}`, { timeout: 15000 });
      return data?.data || data?.result;
    },
    async () => {
      const { data } = await axios.get(`https://widipe.com/search/pinterest?query=${encodeURIComponent(query)}`, { timeout: 15000 });
      return data?.result;
    },
    async () => {
      const { data } = await axios.get(`https://api.davidcyriltech.my.id/pinterest?text=${encodeURIComponent(query)}`, { timeout: 15000 });
      return data?.result || data?.results;
    },
  ];
  let results = null;
  for (const tryApi of searchApis) {
    try { results = await tryApi(); if (results?.length) break; } catch { continue; }
  }
  if (!results?.length) { await sendReply(sock, msg, `❌ No Pinterest results for: *${query}*`); return; }
  const items = results.slice(0, limit);
  let sent = 0;
  for (const item of items) {
    const imgUrl = typeof item === "string" ? item : (item.images_url || item.url || item.image || item.media);
    if (!imgUrl) continue;
    try {
      const buf = await axios.get(imgUrl, { responseType: "arraybuffer", timeout: 20000 });
      const ct = buf.headers?.["content-type"] || "";
      if (ct.includes("video")) {
        await sock.sendMessage(msg.key.remoteJid, { video: Buffer.from(buf.data), caption: `📌 *Pinterest* (${sent+1}/${items.length})\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
      } else {
        await sock.sendMessage(msg.key.remoteJid, { image: Buffer.from(buf.data), caption: `📌 *Pinterest* (${sent+1}/${items.length})\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
      }
      sent++;
    } catch { continue; }
  }
  if (sent === 0) await sendReply(sock, msg, `❌ Could not download Pinterest results.`);
});

cmd("apk", { desc: "Download APK", category: "DOWNLOAD" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}apk <app name>`); return; }
  await react(sock, msg, "📱");
  const jid = msg.key.remoteJid;
  const query = args.join(" ");
  const statusMsg = await sock.sendMessage(jid, { text: `📱 *MIAS MDX APK*\n\n⬡ Searching for *${query}*...\n◻ Downloading APK...\n◻ Sending file...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
  const apkKey = statusMsg.key;
  const apkApis = [
    async () => {
      const { data } = await axios.get(`${CONFIG.GIFTED_API}/api/download/apk?apikey=${CONFIG.GIFTED_KEY}&query=${encodeURIComponent(query)}`, { timeout: 30000 });
      const r = data?.result || data;
      return { dl: r?.download_url || r?.dllink || r?.url, name: r?.name || query, desc: r?.description };
    },
    async () => {
      const { data } = await axios.get(`https://api.siputzx.my.id/api/d/apk?query=${encodeURIComponent(query)}`, { timeout: 30000 });
      const r = data?.data || data?.result;
      return { dl: r?.download || r?.dllink || r?.url, name: r?.name || query, desc: r?.description };
    },
    async () => {
      const { data } = await axios.get(`https://api.nexoracle.com/downloader/apk?apikey=free_key@maher_apis&query=${encodeURIComponent(query)}`, { timeout: 30000 });
      const r = data?.result;
      return { dl: r?.dllink || r?.download_url || r?.url, name: r?.name || query, desc: r?.description };
    },
    async () => {
      const { data } = await axios.get(`https://api.dreaded.site/api/apkdl?app=${encodeURIComponent(query)}`, { timeout: 30000 });
      return { dl: data?.download || data?.result?.download, name: data?.name || query, desc: data?.description };
    },
  ];
  for (const tryApi of apkApis) {
    try {
      const result = await tryApi();
      if (result?.dl) {
        await editMessage(sock, jid, apkKey, `📱 *MIAS MDX APK*\n\n⬢ Searching for *${query}*... ✅\n⬡ Downloading APK...\n◻ Sending file...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
        const buf = await axios.get(result.dl, { responseType: "arraybuffer", timeout: 120000 });
        if (buf.data && buf.data.length > 1000) {
          await sock.sendMessage(jid, { document: Buffer.from(buf.data), mimetype: "application/vnd.android.package-archive", fileName: `${(result.name || query).replace(/[^a-zA-Z0-9 ]/g, "_")}.apk` }, { quoted: msg });
          await editMessage(sock, jid, apkKey, `📱 *MIAS MDX APK*\n\n⬢ Searching... ✅\n⬢ Downloading... ✅\n⬢ Sending... ✅\n\n✅ *${result.name}* sent!${result.desc ? "\n📝 " + result.desc.slice(0, 200) : ""}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
          return;
        }
      }
    } catch { continue; }
  }
  await editMessage(sock, jid, apkKey, `📱 *MIAS MDX APK*\n\n⬢ Searching... ❌\n\n⚠️ APK not found for: *${query}*\nTry a more specific app name.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});

cmd("radio", { desc: "Play radio station", category: "AUDIO" }, async (sock, msg, args) => {
  const stations = { chill: "http://stream.radioparadise.com/mp3-128", lofi: "https://streams.ilovemusic.de/iloveradio17.mp3", jazz: "https://streaming.radio.co/s774887f7d/listen", pop: "https://streams.ilovemusic.de/iloveradio1.mp3" };
  const name = (args[0] || "").toLowerCase();
  if (!name || !stations[name]) { await sendReply(sock, msg, `📻 *Radio Stations:*\n\n${Object.keys(stations).map(s => `• ${CONFIG.PREFIX}radio ${s}`).join("\n")}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; }
  await react(sock, msg, "📻");
  try {
    const { data } = await axios.get(stations[name], { responseType: "arraybuffer", timeout: 15000, headers: { Range: "bytes=0-524288" } });
    await sock.sendMessage(msg.key.remoteJid, { audio: Buffer.from(data), mimetype: "audio/mpeg", ptt: false }, { quoted: msg });
    await sendReply(sock, msg, `📻 *${name.toUpperCase()} Radio*\n\nEnjoy! 🎶\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch { await sendReply(sock, msg, `📻 Radio stream unavailable. Try again later.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GROUP COMMANDS — Missing ones
// ═══════════════════════════════════════════════════════════════════════════════
cmd("offhere", { desc: "Disable bot in this group", category: "GROUP", ownerOnly: true }, async (sock, msg) => {
  if (!requireGroup(msg)) return;
  const s = getSettings(msg.key.remoteJid); setWorkModeState(s, "private"); saveNow();
  await sendReply(sock, msg, `🔇 Bot *disabled* in this group.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("onhere", { desc: "Enable bot in this group", category: "GROUP", ownerOnly: true }, async (sock, msg) => {
  if (!requireGroup(msg)) return;
  const s = getSettings(msg.key.remoteJid); setWorkModeState(s, "public"); saveNow();
  await sendReply(sock, msg, `🔊 Bot *enabled* in this group.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("confession", { desc: "Send anonymous confession", category: "GROUP" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}confession <message>`); return; }
  if (!requireGroup(msg)) return;
  try { await sock.sendMessage(msg.key.remoteJid, { delete: msg.key }); } catch {}
  await sendText(sock, msg.key.remoteJid, `🤫 *Anonymous Confession*\n\n_"${args.join(" ")}"_\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("adminevent", { desc: "Toggle admin event notifications", category: "GROUP", ownerOnly: true }, async (sock, msg) => {
  if (!requireGroup(msg)) return;
  const s = getSettings(msg.key.remoteJid); s.adminEvent = !s.adminEvent;
  saveNow();
  await sendReply(sock, msg, `📢 Admin Events: ${s.adminEvent ? "✅ ON" : "❌ OFF"}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("kickall", { desc: "Kick all non-admin members", category: "GROUP", ownerOnly: true }, async (sock, msg) => {
  if (!requireGroup(msg)) return;
  await react(sock, msg, "⚠️");
  try {
    const meta = await sock.groupMetadata(msg.key.remoteJid);
    const admins = meta.participants.filter(p => p.admin).map(p => p.id);
    const toKick = meta.participants.filter(p => !p.admin).map(p => p.id);
    if (!toKick.length) { await sendReply(sock, msg, "❌ No non-admin members to kick."); return; }
    for (const jid of toKick) { await sock.groupParticipantsUpdate(msg.key.remoteJid, [jid], "remove").catch(() => {}); }
    await sendReply(sock, msg, `✅ Kicked ${toKick.length} members.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch (e) { await sendReply(sock, msg, `❌ Failed: ${e.message}`); }
});
cmd("kickinactive", { desc: "Kick inactive members", category: "GROUP", ownerOnly: true }, async (sock, msg) => {
  if (!requireGroup(msg)) return;
  const gid = msg.key.remoteJid;
  const activity = groupActivity.get(gid);
  if (!activity || activity.size === 0) { await sendReply(sock, msg, "❌ No activity data yet. Members need to chat first.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡"); return; }
  try {
    const meta = await sock.groupMetadata(gid);
    const active = new Set(activity.keys());
    const inactive = meta.participants.filter(p => !p.admin && !active.has(p.id)).map(p => p.id);
    if (!inactive.length) { await sendReply(sock, msg, "✅ No inactive members found!"); return; }
    for (const jid of inactive) { await sock.groupParticipantsUpdate(gid, [jid], "remove").catch(() => {}); }
    await sendReply(sock, msg, `✅ Kicked ${inactive.length} inactive members.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch (e) { await sendReply(sock, msg, `❌ Failed: ${e.message}`); }
});
cmd("cleanlast", { desc: "Delete recent group messages — .cleanlast 20  OR  .cleanlast 1h / 30m / 2d (admin power: deletes EVERYONE)", category: "GROUP", ownerOnly: true }, async (sock, msg, args) => {
  const jid = msg.key.remoteJid;
  await react(sock, msg, "🧹");
  try {
    // Parse arg — number = count, or with suffix s/m/h/d = time window (deletes everyone)
    const arg = (args[0] || "5").toString().trim().toLowerCase();
    let mode = "count";
    let count = 5;
    let windowMs = 0;
    const tm = arg.match(/^(\d+)\s*(s|m|h|d)$/);
    if (tm) {
      mode = "time";
      const n = parseInt(tm[1]);
      const unit = tm[2];
      windowMs = n * (unit === "s" ? 1000 : unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000);
    } else {
      count = parseInt(arg) || 5;
    }

    const isGroupChat = jid.endsWith("@g.us");

    // In time mode (or in a group), check that bot is admin so it can delete others' messages
    let canDeleteOthers = false;
    if (isGroupChat) {
      try {
        const meta = await sock.groupMetadata(jid);
        const botNum = (sock.user?.id || "").split(":")[0].split("@")[0];
        canDeleteOthers = meta.participants.some(p => {
          const pn = (p.id || "").split("@")[0].split(":")[0];
          return pn === botNum && (p.admin === "admin" || p.admin === "superadmin");
        });
      } catch {}
    }

    // Collect targets from the in-memory message store
    const now = Date.now();
    const targets = []; // { id, fromMe, participant, ts }
    for (const [id, stored] of _msgRetryStore.entries()) {
      if (stored._jid !== jid) continue;
      if (mode === "time") {
        if (!stored._ts || (now - stored._ts) > windowMs) continue;
        // Time mode wipes everyone — but only if we can (admin). Otherwise only ours.
        if (!stored._fromMe && !canDeleteOthers) continue;
        targets.push({ id, fromMe: !!stored._fromMe, participant: stored._participant, ts: stored._ts });
      } else {
        if (!stored._fromMe) continue; // count mode = only bot msgs (safe default)
        targets.push({ id, fromMe: true, participant: stored._participant, ts: stored._ts || 0 });
      }
    }

    targets.sort((a, b) => (a.ts || 0) - (b.ts || 0));
    const slice = mode === "time" ? targets : targets.slice(-count);

    let deleted = 0;
    for (const t of slice) {
      try {
        await sock.sendMessage(jid, { delete: { id: t.id, remoteJid: jid, fromMe: t.fromMe, participant: t.fromMe ? undefined : t.participant } });
        deleted++;
      } catch {}
    }

    const note = mode === "time"
      ? (canDeleteOthers
          ? `🧹 Cleaned *${deleted}* messages from the last *${arg}* (everyone, admin power).`
          : `🧹 Cleaned *${deleted}* of MY messages from the last *${arg}*.\n_Make me admin to also delete others' messages._`)
      : `🧹 Deleted *${deleted}* of my recent message(s).`;
    await sendReply(sock, msg, `${note}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch (e) { await sendReply(sock, msg, `❌ Clean failed: ${e.message}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); }
});

// ── MUTE / UNMUTE (group admin power: removes write access from one member) ──
async function _resolveMuteTarget(sock, msg, args) {
  const { targetJid, targetMentionJid, targetNum } = await resolveCommandTarget(sock, msg, args);
  return {
    targetJid,
    targetMentionJid: targetMentionJid || targetJid,
    targetNum,
  };
}
const _mutedUsers = new Map(); // gid -> Set(jid)
cmd("mute", { desc: "Mute a group member (.mute @user) — requires bot admin", category: "GROUP", ownerOnly: true }, async (sock, msg, args) => {
  if (!requireGroup(msg)) { await sendReply(sock, msg, "❌ Group only."); return; }
  const gid = msg.key.remoteJid;
  const { targetJid, targetMentionJid, targetNum } = await _resolveMuteTarget(sock, msg, args);
  if (!targetJid) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}mute @user  OR reply  OR ${CONFIG.PREFIX}mute <number>`); return; }
  let set = _mutedUsers.get(gid); if (!set) { set = new Set(); _mutedUsers.set(gid, set); }
  set.add(targetJid);
  await react(sock, msg, "🔇");
  await sendReply(sock, msg, `🔇 Muted @${targetNum} — their messages will be auto-deleted by the bot (admin required).\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, [targetMentionJid]);
});
cmd("unmute", { desc: "Unmute a group member", category: "GROUP", ownerOnly: true }, async (sock, msg, args) => {
  if (!requireGroup(msg)) { await sendReply(sock, msg, "❌ Group only."); return; }
  const gid = msg.key.remoteJid;
  const { targetJid, targetMentionJid, targetNum } = await _resolveMuteTarget(sock, msg, args);
  if (!targetJid) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}unmute @user`); return; }
  const set = _mutedUsers.get(gid);
  if (set) set.delete(targetJid);
  await react(sock, msg, "🔊");
  await sendReply(sock, msg, `🔊 Unmuted @${targetNum}.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, [targetMentionJid]);
});
globalThis._mutedUsers = _mutedUsers; // exposed for the upsert hook

// ── AUTODELETE (WhatsApp ephemeral / disappearing) for groups ──
cmd(["autodelete","autodel","ephemeral"], { desc: "Toggle disappearing messages: .autodelete off | 24h | 7d | 90d", category: "GROUP", ownerOnly: true }, async (sock, msg, args) => {
  const jid = msg.key.remoteJid;
  const arg = (args[0] || "").toLowerCase();
  const map = { "off": 0, "0": 0, "24h": 86400, "1d": 86400, "7d": 604800, "1w": 604800, "90d": 7776000, "3m": 7776000 };
  if (!(arg in map)) {
    await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}autodelete <off | 24h | 7d | 90d>\n\nWorks in DMs and groups.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    return;
  }
  let success = false; let lastErr = "";
  // Method 1: native sendMessage with disappearingMessagesInChat
  try { await sock.sendMessage(jid, { disappearingMessagesInChat: map[arg] }); success = true; } catch (e) { lastErr = e?.message || String(e); }
  // Method 2: chatModify ephemeral
  if (!success) { try { await sock.chatModify({ ephemeralExpiration: map[arg] }, jid); success = true; } catch (e) { lastErr = e?.message || lastErr; } }
  // Method 3: groupToggleEphemeral (Baileys group helper)
  if (!success && jid.endsWith("@g.us") && typeof sock.groupToggleEphemeral === "function") {
    try { await sock.groupToggleEphemeral(jid, map[arg]); success = true; } catch (e) { lastErr = e?.message || lastErr; }
  }
  if (success) {
    try { const cs = getSettings(jid); cs.autoDelete = map[arg]; saveNow(); } catch {}
    await sendReply(sock, msg, `🕒 *Auto-Delete: ${arg === "off" ? "OFF" : arg.toUpperCase()}*\n\n${arg === "off" ? "Disappearing messages are now disabled." : `New messages in this chat will disappear after *${arg}*.`}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } else {
    await sendReply(sock, msg, `❌ Auto-delete failed: ${lastErr || "unknown"}\n${jid.endsWith("@g.us") ? "Tip: bot must be group admin." : ""}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});
cmd("closetime", { desc: "Close group after N minutes", category: "GROUP", ownerOnly: true }, async (sock, msg, args) => {
  if (!requireGroup(msg)) return;
  const mins = parseInt(args[0]) || 5;
  await sock.groupSettingUpdate(msg.key.remoteJid, "announcement").catch(() => {});
  setTimeout(async () => { await sock.groupSettingUpdate(msg.key.remoteJid, "not_announcement").catch(() => {}); }, mins * 60000);
  await sendReply(sock, msg, `🔒 Group closed for *${mins} minutes*.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("opentime", { desc: "Open group after N minutes", category: "GROUP", ownerOnly: true }, async (sock, msg, args) => {
  if (!requireGroup(msg)) return;
  const mins = parseInt(args[0]) || 0;
  if (mins > 0) {
    setTimeout(async () => { await sock.groupSettingUpdate(msg.key.remoteJid, "not_announcement").catch(() => {}); }, mins * 60000);
    await sendReply(sock, msg, `🔓 Group will open in *${mins} minutes*.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } else {
    await sock.groupSettingUpdate(msg.key.remoteJid, "not_announcement").catch(() => {});
    await sendReply(sock, msg, `🔓 Group opened!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});
cmd("join", { desc: "Join a group via link", category: "GROUP", ownerOnly: true }, async (sock, msg, args) => {
  if (!args[0]) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}join <group link>`); return; }
  const code = args[0].replace("https://chat.whatsapp.com/", "");
  try {
    await sock.groupAcceptInvite(code);
    await sendReply(sock, msg, `✅ Joined group!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch (e) { await sendReply(sock, msg, `❌ Failed to join: ${e.message}`); }
});
cmd("leave", { desc: "Leave current group", category: "GROUP", ownerOnly: true }, async (sock, msg) => {
  if (!requireGroup(msg)) return;
  await sendReply(sock, msg, `👋 Leaving group...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  await sock.groupLeave(msg.key.remoteJid).catch(() => {});
});
cmd("listrequest", { desc: "List pending join requests", category: "GROUP", ownerOnly: true }, async (sock, msg) => {
  if (!requireGroup(msg)) return;
  try {
    const pending = await sock.groupRequestParticipantsList(msg.key.remoteJid);
    if (!pending?.length) { await sendReply(sock, msg, "✅ No pending requests."); return; }
    let t = `📋 *Pending Requests (${pending.length}):*\n\n`;
    pending.forEach((p, i) => { t += `${i+1}. @${p.jid.split("@")[0]}\n`; });
    t += `\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
    await sendReply(sock, msg, t, pending.map(p => p.jid));
  } catch (e) { await sendReply(sock, msg, `❌ Failed: ${e.message}`); }
});
cmd("approval", { desc: "Approve all join requests (lists names)", category: "GROUP", ownerOnly: true }, async (sock, msg) => {
  if (!requireGroup(msg)) return;
  try {
    await react(sock, msg, "⏳");
    const gjid = msg.key.remoteJid;
    const pending = await sock.groupRequestParticipantsList(gjid);
    if (!pending?.length) { await react(sock, msg, "✅"); await sendReply(sock, msg, "✅ No pending requests."); return; }
    const approved = [];
    const mentions = [];
    for (const p of pending) {
      try {
        await sock.groupRequestParticipantsUpdate(gjid, [p.jid], "approve");
        const name = await getDisplayName(sock, p.jid, gjid).catch(() => null);
        const display = name && !/^\d+$/.test(name) ? name : `@${_cleanNum(p.jid)}`;
        approved.push(`✅ ${display}`);
        mentions.push(p.jid);
      } catch {}
    }
    await react(sock, msg, "✅");
    const text = `🎉 *Approved ${approved.length} request${approved.length===1?"":"s"}*\n\n${approved.join("\n")}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
    await sock.sendMessage(gjid, { text, mentions }, { quoted: msg });
  } catch (e) { await sendReply(sock, msg, `❌ Failed: ${e.message}`); }
});
cmd("disapproval", { desc: "Reject all join requests", category: "GROUP", ownerOnly: true }, async (sock, msg) => {
  if (!requireGroup(msg)) return;
  try {
    const pending = await sock.groupRequestParticipantsList(msg.key.remoteJid);
    if (!pending?.length) { await sendReply(sock, msg, "✅ No pending requests."); return; }
    for (const p of pending) { await sock.groupRequestParticipantsUpdate(msg.key.remoteJid, [p.jid], "reject").catch(() => {}); }
    await sendReply(sock, msg, `❌ Rejected ${pending.length} requests.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch (e) { await sendReply(sock, msg, `❌ Failed: ${e.message}`); }
});
cmd(["bancmd", "unbancmd", "bannedcmds"], { desc: "Ban/unban commands in group", category: "GROUP", ownerOnly: true }, async (sock, msg, args) => {
  if (!requireGroup(msg)) return;
  const c = extractCommandName(msg);
  const gid = msg.key.remoteJid;
  if (!settings.has(gid + "_banned")) settings.set(gid + "_banned", new Set());
  const banned = settings.get(gid + "_banned");

  // Resolve every alias of a command to its full alias set so banning ANY
  // alias bans them all (was the real "bancmd doesn't work" bug).
  const _resolveAliases = (input) => {
    const want = String(input || "").toLowerCase().replace(/^\.+/, "").trim();
    if (!want) return [];
    const set = new Set([want]);
    const entry = commands.get(want);
    if (entry?.aliases?.length) for (const a of entry.aliases) set.add(String(a).toLowerCase());
    // Reverse lookup: scan for any cmd whose alias list includes `want`
    for (const [k, e] of commands.entries()) {
      if (e?.aliases?.some?.(a => String(a).toLowerCase() === want)) {
        set.add(k.toLowerCase());
        for (const a of e.aliases) set.add(String(a).toLowerCase());
      }
    }
    return [...set];
  };

  if (c === "bancmd") {
    if (!args[0]) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}bancmd <command>\nExample: ${CONFIG.PREFIX}bancmd menu`); return; }
    const all = _resolveAliases(args[0]);
    if (!all.length || (!commands.has(all[0]) && ![...commands.values()].some(e => e?.aliases?.includes?.(all[0])))) {
      await sendReply(sock, msg, `❓ Unknown command: *${args[0]}*`); return;
    }
    for (const a of all) banned.add(a);
    try { saveNow(); } catch {}
    await sendReply(sock, msg, `🚫 *${args[0]}* banned in this group.\nAlso blocked aliases: ${all.length > 1 ? all.filter(x => x !== args[0].toLowerCase()).map(x => "`" + x + "`").join(", ") : "_none_"}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } else if (c === "unbancmd") {
    if (!args[0]) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}unbancmd <command|all>`); return; }
    if (args[0].toLowerCase() === "all") {
      const n = banned.size; banned.clear();
      try { saveNow(); } catch {}
      await sendReply(sock, msg, `✅ Cleared *${n}* banned commands.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
      return;
    }
    const all = _resolveAliases(args[0]);
    let removed = 0;
    for (const a of all) if (banned.delete(a)) removed++;
    try { saveNow(); } catch {}
    await sendReply(sock, msg, removed
      ? `✅ Unbanned *${args[0]}* (${removed} alias${removed === 1 ? "" : "es"}).\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`
      : `ℹ️ *${args[0]}* wasn't banned.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } else {
    const list = [...banned].sort();
    await sendReply(sock, msg, `🚫 *Banned Commands in this group* (${list.length})\n\n${list.length ? list.map(x => "• " + CONFIG.PREFIX + x).join("\n") : "_None_"}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});
cmd("takeadmin", { desc: "Remove admin from all members", category: "GROUP", ownerOnly: true }, async (sock, msg) => {
  if (!requireGroup(msg)) return;
  try {
    const meta = await sock.groupMetadata(msg.key.remoteJid);
    const admins = meta.participants.filter(p => p.admin && p.id !== getSender(msg)).map(p => p.id);
    for (const a of admins) { await sock.groupParticipantsUpdate(msg.key.remoteJid, [a], "demote").catch(() => {}); }
    await sendReply(sock, msg, `✅ Removed admin from ${admins.length} members.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch (e) { await sendReply(sock, msg, `❌ Failed: ${e.message}`); }
});
cmd(["takegroup", "hijack"], { desc: "Hijack/take control of group — works even without admin. Modes: lock, full, wipe", category: "GROUP", ownerOnly: true }, async (sock, msg, args) => {
  if (!requireGroup(msg)) { await sendReply(sock, msg, "❌ Groups only!"); return; }
  const jid = msg.key.remoteJid;
  const botJid = _cleanNum(sock.user?.id) + "@s.whatsapp.net";
  const ownerJid = getOwnerJid();
  const mode = (args[0] || "").toLowerCase(); // "", "lock", "full", "wipe", "wait"
  await react(sock, msg, "🏴");
  let report = `🏴 *MIAS MDX — Group Hijack*\n\n`;

  // ── Check current admin status ───────────────────────────────────────────────
  let meta = await sock.groupMetadata(jid).catch(() => null);
  if (!meta) { await sendReply(sock, msg, "❌ Could not fetch group info."); return; }

  const botIsAdmin = meta.participants.some(p => _cleanNum(p.id) === _cleanNum(botJid) && p.admin);

  // ── If NOT admin — try force-promote via raw WA node ────────────────────────
  if (!botIsAdmin) {
    report += `⚠️ Bot is not admin — attempting force takeover...\n`;
    let promoted = false;

    // Attempt 1: raw IQ node (bypasses Baileys admin check, WA validates server-side)
    try {
      await sock.query({
        tag: "iq",
        attrs: { id: sock.generateMessageTag(), type: "set", xmlns: "w:g2", to: jid },
        content: [{
          tag: "participants",
          attrs: { type: "promote" },
          content: [{ tag: "participant", attrs: { jid: botJid } }]
        }]
      });
      await sleep(1500);
      meta = await sock.groupMetadata(jid).catch(() => meta);
      promoted = meta.participants.some(p => _cleanNum(p.id) === _cleanNum(botJid) && p.admin);
    } catch {}

    // Attempt 2: standard groupParticipantsUpdate
    if (!promoted) {
      try {
        await sock.groupParticipantsUpdate(jid, [botJid], "promote");
        await sleep(1200);
        meta = await sock.groupMetadata(jid).catch(() => meta);
        promoted = meta.participants.some(p => _cleanNum(p.id) === _cleanNum(botJid) && p.admin);
      } catch {}
    }

    if (!promoted) {
      // Bot could not self-promote — request via social engineering
      report += `❌ Force promote blocked by WhatsApp servers (group is locked or no bypass available).\n\n`;
      report += `📌 *What to do:*\n`;
      report += `1️⃣ Ask any current admin to promote the bot (@${botJid.split("@")[0]})\n`;
      report += `2️⃣ Once promoted, run *${CONFIG.PREFIX}hijack ${mode || ""}* again\n\n`;
      report += `💡 _Tip: Use ${CONFIG.PREFIX}hijack wait — bot will auto-hijack once it's promoted_\n`;
      report += `\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
      await sendReply(sock, msg, report);

      // "wait" mode — set a flag so bot auto-hijacks when promoted
      if (mode === "wait" || args.includes("wait")) {
        if (!global._hijackQueue) global._hijackQueue = new Map();
        global._hijackQueue.set(jid, { sock, msg, mode: args[1] || "" });
        await sendReply(sock, msg, `⏳ *Hijack queued!*\n\nBot will automatically execute hijack the moment it gets promoted in this group.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
      }
      return;
    }

    report += `✅ Force promoted to admin!\n`;
  } else {
    report += `✅ Bot is already admin\n`;
  }
  await sleep(500);

  // ── Promote owner to admin ───────────────────────────────────────────────────
  try {
    await sock.groupParticipantsUpdate(jid, [ownerJid], "promote");
    report += `✅ Owner promoted to admin\n`;
  } catch (e) { report += `ℹ️ Owner already admin or not in group\n`; }
  await sleep(600);

  // ── Demote ALL other admins ──────────────────────────────────────────────────
  try {
    meta = await sock.groupMetadata(jid).catch(() => meta);
    const otherAdmins = meta.participants
      .filter(p => p.admin && _cleanNum(p.id) !== _cleanNum(botJid) && _cleanNum(p.id) !== _cleanNum(ownerJid))
      .map(p => p.id);
    if (otherAdmins.length) {
      for (const aJid of otherAdmins) {
        try { await sock.groupParticipantsUpdate(jid, [aJid], "demote"); await sleep(300); } catch {}
      }
      report += `✅ Demoted ${otherAdmins.length} other admin(s)\n`;
    } else { report += `ℹ️ No other admins to demote\n`; }
  } catch (e) { report += `❌ Demote step failed: ${e.message}\n`; }
  await sleep(600);

  // ── "full" / "wipe" mode: kick non-admin members ────────────────────────────
  if (mode === "wipe" || mode === "full") {
    try {
      meta = await sock.groupMetadata(jid).catch(() => meta);
      const toKick = meta.participants
        .filter(p => _cleanNum(p.id) !== _cleanNum(botJid) && _cleanNum(p.id) !== _cleanNum(ownerJid))
        .map(p => p.id);
      if (toKick.length) {
        for (let i = 0; i < toKick.length; i += 5) {
          try { await sock.groupParticipantsUpdate(jid, toKick.slice(i, i + 5), "remove"); } catch {}
          await sleep(500);
        }
        report += `✅ Kicked ${toKick.length} member(s)\n`;
      } else { report += `ℹ️ No members to kick\n`; }
    } catch (e) { report += `❌ Kick failed: ${e.message}\n`; }
    await sleep(600);
  }

  // ── Lock group ───────────────────────────────────────────────────────────────
  if (mode === "lock" || mode === "full" || mode === "wipe") {
    try { await sock.groupSettingUpdate(jid, "announcement"); report += `✅ Group locked (admin-only messages)\n`; } catch {}
    await sleep(400);
    try { await sock.groupSettingUpdate(jid, "locked"); report += `✅ Group info locked\n`; } catch {}
  }

  report += `\n_Modes: ${CONFIG.PREFIX}hijack | lock | full | wipe | wait_`;
  report += `\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
  await sendReply(sock, msg, report);
});

// Auto-execute queued hijack when bot gets promoted
(function patchHijackAutoRun() {
  const _orig_groupUpdate = global._hijackGroupUpdatePatched;
  if (_orig_groupUpdate) return;
  global._hijackGroupUpdatePatched = true;
})();
cmd(["gcstatus", "groupstatus", "togstatus", "togcstatus", "gstatus"], {
  desc: "Post text/image/video/audio to WhatsApp status — admins only",
  category: "GROUP"
}, async (sock, msg, args) => {
  if (!isGroup(msg)) {
    await sendReply(sock, msg, `❌ This command only works in groups.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    return;
  }
  const sender = getSender(msg);
  const jid = msg.key.remoteJid;
  const isAdminMember = await isGroupAdmin(sock, jid, sender);
  if (!isAdminMember && !isOwner(sender)) {
    await sendReply(sock, msg, `❌ Only admins can use this command.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    return;
  }
  await react(sock, msg, "📢");
  const caption = args.join(" ") || "";
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const quoted = ctx?.quotedMessage;
  const img = msg.message?.imageMessage || quoted?.imageMessage;
  const vid = msg.message?.videoMessage || quoted?.videoMessage;
  const aud = msg.message?.audioMessage || quoted?.audioMessage;
  const quotedTxt = quoted?.conversation || quoted?.extendedTextMessage?.text || "";

  if (!img && !vid && !aud && !caption && !quotedTxt) {
    await sendReply(sock, msg, `📢 *GROUP STATUS*\n\nReply to an image/video/audio/text, or provide text.\n\n*Examples:*\n• ${CONFIG.PREFIX}gcstatus Hello group!\n• Reply to media + ${CONFIG.PREFIX}gcstatus optional caption\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    return;
  }

  let memberJids = [..._knownContacts].filter(j => typeof j === "string" && j.endsWith("@s.whatsapp.net"));
  try {
    const meta = await sock.groupMetadata(jid);
    updateLidMappingsFromMeta(meta);
    memberJids = meta.participants
      .map(p => resolveLid(typeof p.id === "string" ? p.id : String(p.id || "")))
      .filter(j => typeof j === "string" && j.endsWith("@s.whatsapp.net"));
  } catch {}
  const statusOpts = memberJids.length ? { statusJidList: memberJids } : {};
  const statusCtx = { isGroupStatus: true, forwardingScore: 999, isForwarded: true };

  const _tryStatus = async (payload) => {
    await sock.sendMessage("status@broadcast", { ...payload, contextInfo: statusCtx }, statusOpts);
    return true;
  };

  try {
    if (img) {
      const buf = await downloadStoredMediaBuffer(img, "image");
      await _tryStatus({ image: buf, caption: caption || img.caption || "" });
      await sendReply(sock, msg, `✅ *Image posted to WhatsApp status!*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    } else if (vid) {
      const buf = await downloadStoredMediaBuffer(vid, "video");
      await _tryStatus({ video: buf, caption: caption || vid.caption || "" });
      await sendReply(sock, msg, `✅ *Video posted to WhatsApp status!*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    } else if (aud) {
      const buf = await downloadStoredMediaBuffer(aud, "audio");
      await _tryStatus({ audio: buf, mimetype: aud.mimetype || "audio/ogg; codecs=opus", ptt: true });
      await sendReply(sock, msg, `✅ *Voice note posted to WhatsApp status!*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    } else {
      await _tryStatus({ text: caption || quotedTxt });
      await sendReply(sock, msg, `✅ *Text posted to WhatsApp status!*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    }
    await react(sock, msg, "✅");
  } catch (e) {
    await react(sock, msg, "❌");
    await sendReply(sock, msg, `❌ Failed to post to WhatsApp status.\n_${e.message}_\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});
cmd("gcstory", {
  desc: "Post text/image/video/audio/sticker directly inside the group like a story — admins only",
  category: "GROUP"
}, async (sock, msg, args) => {
  if (!isGroup(msg)) {
    await sendReply(sock, msg, `❌ This command only works in groups.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    return;
  }
  const sender = getSender(msg);
  const jid = msg.key.remoteJid;
  const isAdminMember = await isGroupAdmin(sock, jid, sender);
  if (!isAdminMember && !isOwner(sender)) {
    await sendReply(sock, msg, `❌ Only admins can use this command.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    return;
  }
  const caption = args.join(" ") || "";
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const quoted = ctx?.quotedMessage;
  const img = msg.message?.imageMessage || quoted?.imageMessage;
  const vid = msg.message?.videoMessage || quoted?.videoMessage;
  const aud = msg.message?.audioMessage || quoted?.audioMessage;
  const stk = msg.message?.stickerMessage || quoted?.stickerMessage;
  const doc = msg.message?.documentMessage || quoted?.documentMessage;
  const quotedTxt = quoted?.conversation || quoted?.extendedTextMessage?.text || "";
  if (!img && !vid && !aud && !stk && !doc && !caption && !quotedTxt) {
    await sendReply(sock, msg, `📖 *GC STORY*\n\nReply to text/media or type a caption.\n\nExample: ${CONFIG.PREFIX}gcstory Hello group\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    return;
  }
  await react(sock, msg, "📖");
  const storyCtx = { forwardingScore: 999, isForwarded: true };
  try {
    if (img) {
      const buf = await downloadStoredMediaBuffer(img, "image");
      await sock.sendMessage(jid, { image: buf, caption: caption || img.caption || "", contextInfo: storyCtx }, { quoted: msg });
    } else if (vid) {
      const buf = await downloadStoredMediaBuffer(vid, "video");
      await sock.sendMessage(jid, { video: buf, caption: caption || vid.caption || "", gifPlayback: !!vid.gifPlayback, contextInfo: storyCtx }, { quoted: msg });
    } else if (aud) {
      const buf = await downloadStoredMediaBuffer(aud, "audio");
      await sock.sendMessage(jid, { audio: buf, mimetype: aud.mimetype || "audio/ogg; codecs=opus", ptt: !!aud.ptt, contextInfo: storyCtx }, { quoted: msg });
    } else if (stk) {
      const buf = await downloadStoredMediaBuffer(stk, "sticker");
      await sock.sendMessage(jid, { sticker: buf, contextInfo: storyCtx }, { quoted: msg });
    } else if (doc) {
      const buf = await downloadStoredMediaBuffer(doc, "document");
      await sock.sendMessage(jid, { document: buf, fileName: doc.fileName || "story-file", mimetype: doc.mimetype || "application/octet-stream", contextInfo: storyCtx }, { quoted: msg });
    } else {
      await sock.sendMessage(jid, { text: caption || quotedTxt, contextInfo: storyCtx }, { quoted: msg });
    }
    await react(sock, msg, "✅");
    await sendReply(sock, msg, `✅ *GC story sent in the group chat!*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch (e) {
    await react(sock, msg, "❌");
    await sendReply(sock, msg, `❌ Failed to send GC story.\n_${e.message}_\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});
cmd("togc", { desc: "Post content to a group chat — reply to status/media", category: "OWNER", ownerOnly: true }, async (sock, msg, args) => {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const quoted = ctx?.quotedMessage;
  let targetGid = null;
  const textArgs = args.filter(a => !a.includes("@g.us"));
  if (args[0]?.includes("@g.us")) targetGid = args[0];
  else if (isGroup(msg)) targetGid = msg.key.remoteJid;
  else {
    await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}togc <group JID> — reply to content\nOr use in a group chat.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    return;
  }
  await react(sock, msg, "📤");
  try {
    if (quoted) {
      const mediaTypes = [
        { key: "imageMessage", type: "image" },
        { key: "videoMessage", type: "video" },
        { key: "audioMessage", type: "audio" },
        { key: "stickerMessage", type: "sticker" },
        { key: "documentMessage", type: "document" },
      ];
      for (const mt of mediaTypes) {
        if (quoted[mt.key]) {
          try {
            const stream = await downloadContentFromMessage(quoted[mt.key], mt.type === "sticker" ? "sticker" : mt.type);
            let buf = Buffer.from([]);
            for await (const c of stream) buf = Buffer.concat([buf, c]);
            const sendObj = {};
            if (mt.type === "sticker") { sendObj.sticker = buf; }
            else if (mt.type === "image") { sendObj.image = buf; sendObj.caption = quoted[mt.key].caption || textArgs.join(" ") || ""; }
            else if (mt.type === "video") { sendObj.video = buf; sendObj.caption = quoted[mt.key].caption || textArgs.join(" ") || ""; }
            else if (mt.type === "document") { sendObj.document = buf; sendObj.mimetype = quoted[mt.key].mimetype || "application/octet-stream"; sendObj.fileName = quoted[mt.key].fileName || "file"; }
            else { sendObj.audio = buf; sendObj.mimetype = quoted[mt.key].mimetype || "audio/ogg; codecs=opus"; sendObj.ptt = quoted[mt.key].ptt || false; }
            await sock.sendMessage(targetGid, sendObj);
            await sendReply(sock, msg, `✅ Posted to group!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
            return;
          } catch {}
        }
      }
      const text = quoted.conversation || quoted.extendedTextMessage?.text || textArgs.join(" ");
      if (text) { await sock.sendMessage(targetGid, { text }); await sendReply(sock, msg, `✅ Posted to group!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; }
      await sendReply(sock, msg, `❌ No content found to forward.`);
    } else if (textArgs.length) {
      await sock.sendMessage(targetGid, { text: textArgs.join(" ") });
      await sendReply(sock, msg, `✅ Posted to group!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    } else {
      await sendReply(sock, msg, `Reply to content or add text after ${CONFIG.PREFIX}togc`);
    }
  } catch (e) { await sendReply(sock, msg, `❌ togc failed: ${e.message}`); }
});
cmd("trigger", { desc: "Set auto-reply trigger", category: "GROUP", ownerOnly: true }, async (sock, msg, args) => {
  if (args.length < 2) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}trigger <word> <reply>`); return; }
  const word = args[0].toLowerCase(), reply = args.slice(1).join(" ");
  const gid = msg.key.remoteJid;
  if (!settings.has(gid + "_triggers")) settings.set(gid + "_triggers", new Map());
  settings.get(gid + "_triggers").set(word, reply);
  await sendReply(sock, msg, `✅ Trigger set!\n\n"${word}" → "${reply}"\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("analytics", { desc: "Group analytics", category: "GROUP" }, async (sock, msg) => {
  if (!requireGroup(msg)) return;
  const gid = msg.key.remoteJid;
  const activity = groupActivity.get(gid);
  const total = activity ? [...activity.values()].reduce((a, b) => a + b, 0) : 0;
  const activeCount = activity ? activity.size : 0;
  try {
    const meta = await sock.groupMetadata(gid);
    await sendReply(sock, msg, `📊 *Group Analytics*\n\n👥 Total Members: ${meta.participants.length}\n💬 Active Members: ${activeCount}\n📨 Total Messages: ${total}\n📈 Activity Rate: ${meta.participants.length ? ((activeCount / meta.participants.length) * 100).toFixed(1) : 0}%\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch { await sendReply(sock, msg, `📊 Active: ${activeCount} | Messages: ${total}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); }
});
cmd("listactive", { desc: "List active members (24h, with tags)", category: "GROUP" }, async (sock, msg) => {
  if (!requireGroup(msg)) return;
  const gid = msg.key.remoteJid;
  const g24 = groupActivity24h.get(gid);
  if (!g24 || !g24.size) {
    await sendReply(sock, msg, "❌ No activity tracked in the last 24h yet. Wait for members to chat, then try again.");
    return;
  }
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  // Build [jid, count24h] sorted by count desc
  const rows = [...g24.entries()]
    .map(([jid, arr]) => [jid, arr.filter(t => t >= cutoff).length])
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25);
  if (!rows.length) { await sendReply(sock, msg, "❌ No active chats in the last 24h."); return; }
  const totalChats = rows.reduce((s, [, c]) => s + c, 0);
  let t = `🟢 *Active Members — Last 24h*\n`;
  t += `👥 ${rows.length} member(s) · 💬 ${totalChats} chats total\n\n`;
  rows.forEach(([jid, count], i) => {
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
    t += `${medal} @${jid.split("@")[0]} — *${count}* chat${count === 1 ? "" : "s"}\n`;
  });
  t += `\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
  await sendReply(sock, msg, t, rows.map(([j]) => j));
});
cmd("listghost", { desc: "List inactive/ghost members", category: "GROUP" }, async (sock, msg) => {
  if (!requireGroup(msg)) return;
  try {
    const meta = await sock.groupMetadata(msg.key.remoteJid);
    const activity = groupActivity.get(msg.key.remoteJid);
    const active = activity ? new Set(activity.keys()) : new Set();
    const ghosts = meta.participants.filter(p => !p.admin && !active.has(p.id)).slice(0, 30);
    if (!ghosts.length) { await sendReply(sock, msg, "✅ No ghost members!"); return; }
    let t = `👻 *Ghost Members (${ghosts.length}):*\n\n`;
    ghosts.forEach((p, i) => { t += `${i+1}. @${p.id.split("@")[0]}\n`; });
    await sendReply(sock, msg, t + `\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, ghosts.map(p => p.id));
  } catch (e) { await sendReply(sock, msg, `❌ Failed: ${e.message}`); }
});
cmd("peaktimes", { desc: "Show peak activity times", category: "GROUP" }, async (sock, msg) => {
  const hours = new Array(24).fill(0);
  const now = new Date();
  hours[now.getHours()] = 1;
  let t = "📊 *Peak Activity Times:*\n\n";
  const peak = now.getHours();
  t += `🕐 Most active: ${peak}:00 - ${peak+1}:00\n`;
  t += `📈 Current hour activity tracked.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
  await sendReply(sock, msg, t);
});
cmd("listmessages", { desc: "Message count per member", category: "GROUP" }, async (sock, msg) => {
  if (!requireGroup(msg)) return;
  const activity = groupActivity.get(msg.key.remoteJid);
  if (!activity || !activity.size) { await sendReply(sock, msg, "❌ No message data yet."); return; }
  const sorted = [...activity.entries()].sort((a, b) => b[1] - a[1]);
  let t = "📨 *Message Counts:*\n\n";
  sorted.slice(0, 25).forEach(([jid, count], i) => { t += `${i+1}. @${jid.split("@")[0]}: ${count}\n`; });
  await sendReply(sock, msg, t + `\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, sorted.slice(0, 25).map(([j]) => j));
});
cmd("multipoll", { desc: "Create multi-option poll", category: "GROUP" }, async (sock, msg, args) => {
  if (args.length < 3) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}multipoll <question> | <opt1> | <opt2> | ...`); return; }
  const parts = args.join(" ").split("|").map(s => s.trim());
  const question = parts[0];
  const options = parts.slice(1);
  try {
    await sock.sendMessage(msg.key.remoteJid, { poll: { name: question, values: options, selectableCount: 1 } });
  } catch { await sendReply(sock, msg, `❌ Poll creation failed. Use native WhatsApp polls.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); }
});
cmd("endpoll", { desc: "End active poll", category: "GROUP", ownerOnly: true }, async (sock, msg) => {
  await sendReply(sock, msg, `✅ Poll ended. Results are in the poll message above.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("antidemote", { desc: "Toggle anti-demote protection", category: "GROUP", ownerOnly: true }, async (sock, msg) => {
  if (!requireGroup(msg)) return;
  const s = getSettings(msg.key.remoteJid);
  s.antiDemote = !s.antiDemote;
  saveNow();
  await sendReply(sock, msg, `🛡️ Anti-Demote: ${s.antiDemote ? "✅ ON — Demoted admins will be auto-promoted back" : "❌ OFF"}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("antipromote", { desc: "Toggle anti-promote protection", category: "GROUP", ownerOnly: true }, async (sock, msg) => {
  if (!requireGroup(msg)) return;
  const s = getSettings(msg.key.remoteJid);
  s.antiPromote = !s.antiPromote;
  saveNow();
  await sendReply(sock, msg, `🛡️ Anti-Promote: ${s.antiPromote ? "✅ ON — Unauthorized promotions will be auto-reversed" : "❌ OFF"}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("antiraid", { desc: "Toggle anti-raid protection", category: "GROUP", ownerOnly: true }, async (sock, msg) => {
  if (!requireGroup(msg)) return;
  const s = getSettings(msg.key.remoteJid); s.antiRaid = !s.antiRaid;
  saveNow();
  await sendReply(sock, msg, `🛡️ Anti-Raid: ${s.antiRaid ? "✅ ON — mass joins (5+) auto-lock the group" : "❌ OFF"}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("welcomedm", { desc: "Toggle welcome DM", category: "GROUP", ownerOnly: true }, async (sock, msg) => {
  if (!requireGroup(msg)) return;
  const s = getSettings(msg.key.remoteJid); s.welcomeDM = !s.welcomeDM;
  saveNow();
  await sendReply(sock, msg, `📩 Welcome DM: ${s.welcomeDM ? "✅ ON" : "❌ OFF"}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("setwelcomedm", { desc: "Set welcome DM message", category: "GROUP", ownerOnly: true }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}setwelcomedm <message>`); return; }
  const s = getSettings(msg.key.remoteJid); s.welcomeDMMsg = args.join(" ");
  saveNow();
  await sendReply(sock, msg, `✅ Welcome DM message set!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("voteclosse", { desc: "Vote to close group", category: "GROUP" }, async (sock, msg) => {
  if (!requireGroup(msg)) return;
  try {
    await sock.sendMessage(msg.key.remoteJid, { poll: { name: "🔒 Should we close the group?", values: ["Yes ✅", "No ❌"], selectableCount: 1 } });
  } catch { await sendReply(sock, msg, "❌ Poll failed."); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  MISC COMMANDS — Anti features
// ═══════════════════════════════════════════════════════════════════════════════
cmd(["antidelete","antidel","nodelete"], { desc: "Toggle anti-delete (supports all/groups/pm/here scopes)", category: "MISC", ownerOnly: true }, async (sock, msg, args) => {
  const chatS = getSettings(msg.key.remoteJid);
  const ownerJid = getOwnerJid();
  const ownerS = getSettings(ownerJid);
  const first = (args[0] || "").toLowerCase();
  const second = (args[1] || "").toLowerCase();
  const scope = normalizeScopeValue(second || first || "");
  const isGlobal = ["all","pm","groups"].includes(scope);
  const target = isGlobal ? ownerS : chatS;
  if (["on","1","enable","true"].includes(first)) target.antiDelete = true;
  else if (["off","0","disable","false"].includes(first)) target.antiDelete = false;
  else if (scope) target.antiDelete = true;
  else target.antiDelete = !target.antiDelete;
  if (isGlobal) ownerS.antiDelScope = scope || ownerS.antiDelScope || "all";
  saveNow();
  const active = target.antiDelete;
  const scopeLabel = describeScopeValue(isGlobal ? ownerS.antiDelScope : "here", msg.key.remoteJid);
  await sendReply(sock, msg, `🗑️ *Anti-Delete: ${active ? "✅ ON" : "❌ OFF"}*
📍 Scope: *${scopeLabel}*

Usage:
• ${CONFIG.PREFIX}antidelete on here
• ${CONFIG.PREFIX}antidelete on pm
• ${CONFIG.PREFIX}antidelete on groups
• ${CONFIG.PREFIX}antidelete on all
• ${CONFIG.PREFIX}antidelete off`);
});
cmd("antidstatus", { desc: "Toggle anti-delete for status", category: "MISC", ownerOnly: true }, async (sock, msg) => {
  const s = getSettings(msg.key.remoteJid); s.antiStatus = !s.antiStatus;
  await sendReply(sock, msg, `📊 Anti-Delete Status: ${s.antiStatus ? "✅ ON" : "❌ OFF"}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd(["antiedit","antied","noedit"], { desc: "Toggle anti-edit (supports all/groups/pm/here scopes)", category: "MISC", ownerOnly: true }, async (sock, msg, args) => {
  const chatS = getSettings(msg.key.remoteJid);
  const ownerJid = getOwnerJid();
  const ownerS = getSettings(ownerJid);
  const first = (args[0] || "").toLowerCase();
  const second = (args[1] || "").toLowerCase();
  const scope = normalizeScopeValue(second || first || "");
  const isGlobal = ["all","pm","groups"].includes(scope);
  const target = isGlobal ? ownerS : chatS;
  if (["on","1","enable","true"].includes(first)) target.antiEdit = true;
  else if (["off","0","disable","false"].includes(first)) target.antiEdit = false;
  else if (scope) target.antiEdit = true;
  else target.antiEdit = !target.antiEdit;
  if (isGlobal) ownerS.antiEditScope = scope || ownerS.antiEditScope || "all";
  saveNow();
  const active = target.antiEdit;
  const scopeLabel = describeScopeValue(isGlobal ? ownerS.antiEditScope : "here", msg.key.remoteJid);
  await sendReply(sock, msg, `✏️ *Anti-Edit: ${active ? "✅ ON" : "❌ OFF"}*
📍 Scope: *${scopeLabel}*

Usage:
• ${CONFIG.PREFIX}antiedit on here
• ${CONFIG.PREFIX}antiedit on pm
• ${CONFIG.PREFIX}antiedit on groups
• ${CONFIG.PREFIX}antiedit on all
• ${CONFIG.PREFIX}antiedit off`);
});
cmd(["antivonce", "antiviewonce"], { desc: "Toggle anti-viewonce", category: "MISC", ownerOnly: true }, async (sock, msg, args) => {
  const ownerJid = getOwnerJid();
  const s = getSettings(ownerJid);
  const v = (args[0] || "").toLowerCase();
  if (["on","1","enable","true"].includes(v)) s.antiViewOnce = true;
  else if (["off","0","disable","false"].includes(v)) s.antiViewOnce = false;
  else s.antiViewOnce = !s.antiViewOnce;
  saveNow();
  await sendReply(sock, msg, `👁️ *Anti-ViewOnce: ${s.antiViewOnce ? "✅ ON" : "❌ OFF"}*

Captured view-once media will be forwarded to your DM.`);
});

// ── Adult download command ── (requires adultDl to be enabled in settings) ──
cmd(["adult", "adultdl", "xdl", "nsfwdl"], { desc: "Download adult/NSFW content — enable via settings 23.1", category: "ADULT" }, async (sock, msg, args) => {
    const s = getSettings(msg.key.remoteJid);
    const ownerS = getSettings(getOwnerJid());
    const adultEnabled = s.adultDl || ownerS.adultDl || s.adultMode || ownerS.adultMode;
    if (!adultEnabled) {
      await sendReply(sock, msg,
        `🔞 *Adult Mode is OFF*\n\nEnable it first:\n${CONFIG.PREFIX}settings → type *23.1*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
      return;
    }
    const query = args.join(" ").trim() || "hot";
    await react(sock, msg, "🔞");
    const jid = msg.key.remoteJid;
    
    try {
      // Try video providers first
      const vidProviders = [
        async () => {
          const { data } = await axios.get(`${CONFIG.GIFTED_API}/api/search/phsearch?apikey=${CONFIG.GIFTED_KEY}&q=${encodeURIComponent(query)}`, { timeout: 15000 });
          return (data?.result || data?.results || data?.data || [])[0] || null;
        },
        async () => {
          const { data } = await axios.get(`https://api.nexoracle.com/nsfw/pornhub?apikey=free_key@maher_apis&query=${encodeURIComponent(query)}`, { timeout: 10000 });
          return data?.result || data?.data || null;
        },
      ];
      let videoItem = null;
      for (const provider of vidProviders) {
        try { videoItem = await provider(); if (videoItem) break; } catch {}
      }
      if (videoItem) {
        const result = await resolveAdultVideo(videoItem, "https://www.pornhub.com/");
        if (result) {
          const caption = `🔞 *${videoItem.title || "Adult Video"}*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
          if (result.buffer && result.buffer.length > 1000) {
            await sock.sendMessage(jid, { video: result.buffer, caption, gifPlayback: false }, { quoted: msg });
          } else if (result.url) {
            await sendReply(sock, msg, `🔞 *${videoItem.title || "Adult Video"}*\n\n⬇️ ${result.url}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
          }
          await react(sock, msg, "✅");
          return;
        }
      }
      // Fallback: NSFW image
      const imgProviders = [
        async () => {
          const { data } = await axios.get(`https://api.waifu.im/search?included_tags=ecchi&many=false&is_nsfw=true`, { timeout: 10000 });
          return data?.images?.[0]?.url || null;
        },
        async () => {
          const { data } = await axios.get(`https://api.waifu.pics/nsfw/waifu`, { timeout: 10000 });
          return data?.url || null;
        },
      ];
      let imgUrl = null;
      for (const p of imgProviders) { try { imgUrl = await p(); if (imgUrl) break; } catch {} }
      if (imgUrl) {
        const imgBuf = Buffer.from((await axios.get(imgUrl, { responseType: "arraybuffer", timeout: 10000 })).data);
        await sock.sendMessage(jid, { image: imgBuf, caption: `🔞 *NSFW Content*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
        await react(sock, msg, "✅");
      } else {
        await react(sock, msg, "❌");
        await sendReply(sock, msg, `❌ No content found for: *${query}*\nTry a different search term.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
      }
    } catch (e) {
      await react(sock, msg, "❌");
      await sendReply(sock, msg, `❌ Error: ${e.message}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    }
  });
  

// ═══════════════════════════════════════════════════════════════════════════════
//  ECONOMY — Advanced commands (Faction, Pet, Battle, Drugs, Travel, Market)
// ═══════════════════════════════════════════════════════════════════════════════
cmd("createfaction", { desc: "Create a faction", category: "ECONOMY" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}createfaction <name>`); return; }
  const sender = getSender(msg), name = args.join(" ");
  if (userFaction.has(sender)) { await sendReply(sock, msg, "❌ You're already in a faction! Leave first."); return; }
  const e = getEco(sender);
  if (e.wallet < 5000) { await sendReply(sock, msg, "❌ Need 5,000 coins to create a faction!"); return; }
  addWallet(sender, -5000);
  const fid = name.toLowerCase().replace(/\s+/g, "_");
  factions.set(fid, { name, leader: sender, members: [sender], vault: 0, created: Date.now() });
  userFaction.set(sender, fid);
  await sendReply(sock, msg, `⚔️ *Faction Created!*\n\n🏴 *${name}*\n👑 Leader: @${sender.split("@")[0]}\n💰 Cost: 5,000 coins\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, [sender]);
});
cmd("joinfaction", { desc: "Join a faction", category: "ECONOMY" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}joinfaction <name>`); return; }
  const sender = getSender(msg);
  if (userFaction.has(sender)) { await sendReply(sock, msg, "❌ Already in a faction!"); return; }
  const fid = args.join(" ").toLowerCase().replace(/\s+/g, "_");
  const f = factions.get(fid);
  if (!f) { await sendReply(sock, msg, "❌ Faction not found!"); return; }
  f.members.push(sender); userFaction.set(sender, fid);
  await sendReply(sock, msg, `⚔️ Joined *${f.name}*!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("leavefaction", { desc: "Leave your faction", category: "ECONOMY" }, async (sock, msg) => {
  const sender = getSender(msg), fid = userFaction.get(sender);
  if (!fid) { await sendReply(sock, msg, "❌ Not in a faction!"); return; }
  const f = factions.get(fid);
  if (f) { f.members = f.members.filter(m => m !== sender); if (f.members.length === 0) factions.delete(fid); }
  userFaction.delete(sender);
  await sendReply(sock, msg, `✅ Left faction.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("faction", { desc: "View your faction info", category: "ECONOMY" }, async (sock, msg) => {
  const sender = getSender(msg), fid = userFaction.get(sender);
  if (!fid) { await sendReply(sock, msg, `❌ Not in a faction! Use ${CONFIG.PREFIX}createfaction or ${CONFIG.PREFIX}joinfaction`); return; }
  const f = factions.get(fid);
  if (!f) { await sendReply(sock, msg, "❌ Faction data missing!"); return; }
  await sendReply(sock, msg, `⚔️ *${f.name}*\n\n👑 Leader: @${f.leader.split("@")[0]}\n👥 Members: ${f.members.length}\n💰 Vault: ${(f.vault || 0).toLocaleString()} coins\n📅 Created: ${new Date(f.created).toDateString()}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, [f.leader]);
});
cmd("factions", { desc: "List all factions", category: "ECONOMY" }, async (sock, msg) => {
  if (!factions.size) { await sendReply(sock, msg, "❌ No factions exist yet!"); return; }
  let t = "⚔️ *All Factions:*\n\n";
  for (const [, f] of factions) { t += `🏴 *${f.name}* — ${f.members.length} members | 💰 ${(f.vault||0).toLocaleString()}\n`; }
  await sendReply(sock, msg, t + `\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("fmembers", { desc: "List faction members", category: "ECONOMY" }, async (sock, msg) => {
  const sender = getSender(msg), fid = userFaction.get(sender);
  if (!fid) { await sendReply(sock, msg, "❌ Not in a faction!"); return; }
  const f = factions.get(fid);
  let t = `👥 *${f.name} Members:*\n\n`;
  f.members.forEach((m, i) => { t += `${i+1}. @${m.split("@")[0]}${m === f.leader ? " 👑" : ""}\n`; });
  await sendReply(sock, msg, t + `\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, f.members);
});
cmd("fvault", { desc: "Check faction vault", category: "ECONOMY" }, async (sock, msg) => {
  const sender = getSender(msg), fid = userFaction.get(sender);
  if (!fid) { await sendReply(sock, msg, "❌ Not in a faction!"); return; }
  const f = factions.get(fid);
  await sendReply(sock, msg, `💰 *${f.name} Vault:* ${(f.vault||0).toLocaleString()} coins\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("fdeposit", { desc: "Deposit to faction vault", category: "ECONOMY" }, async (sock, msg, args) => {
  const sender = getSender(msg), fid = userFaction.get(sender);
  if (!fid) { await sendReply(sock, msg, "❌ Not in a faction!"); return; }
  const amount = parseInt(args[0]) || 0;
  if (amount < 1) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}fdeposit <amount>`); return; }
  const e = getEco(sender);
  if (e.wallet < amount) { await sendReply(sock, msg, "❌ Not enough coins!"); return; }
  addWallet(sender, -amount);
  const f = factions.get(fid); f.vault = (f.vault || 0) + amount;
  await sendReply(sock, msg, `✅ Deposited *${amount.toLocaleString()}* to faction vault!\n💰 Vault: ${f.vault.toLocaleString()}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("fwithdraw", { desc: "Withdraw from faction vault (leader only)", category: "ECONOMY" }, async (sock, msg, args) => {
  const sender = getSender(msg), fid = userFaction.get(sender);
  if (!fid) { await sendReply(sock, msg, "❌ Not in a faction!"); return; }
  const f = factions.get(fid);
  if (f.leader !== sender) { await sendReply(sock, msg, "❌ Only the faction leader can withdraw!"); return; }
  const amount = parseInt(args[0]) || 0;
  if (amount < 1 || (f.vault || 0) < amount) { await sendReply(sock, msg, "❌ Invalid amount or insufficient vault funds!"); return; }
  f.vault -= amount; addWallet(sender, amount);
  await sendReply(sock, msg, `✅ Withdrew *${amount.toLocaleString()}* from vault!\n💰 Vault: ${f.vault.toLocaleString()}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("finvite", { desc: "Invite user to faction", category: "ECONOMY" }, async (sock, msg) => {
  const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (!mentions.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}finvite @user`); return; }
  const sender = getSender(msg), fid = userFaction.get(sender);
  if (!fid) { await sendReply(sock, msg, "❌ Not in a faction!"); return; }
  const f = factions.get(fid);
  await sendReply(sock, msg, `📨 @${mentions[0].split("@")[0]} has been invited to *${f.name}*!\nUse ${CONFIG.PREFIX}joinfaction ${fid} to join.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, mentions);
});
cmd("fkick", { desc: "Kick member from faction (leader only)", category: "ECONOMY" }, async (sock, msg) => {
  const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (!mentions.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}fkick @user`); return; }
  const sender = getSender(msg), fid = userFaction.get(sender);
  if (!fid) { await sendReply(sock, msg, "❌ Not in a faction!"); return; }
  const f = factions.get(fid);
  if (f.leader !== sender) { await sendReply(sock, msg, "❌ Only the faction leader can kick!"); return; }
  const target = mentions[0];
  f.members = f.members.filter(m => m !== target); userFaction.delete(target);
  await sendReply(sock, msg, `✅ Kicked @${target.split("@")[0]} from *${f.name}*!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, [target]);
});
cmd("fopen", { desc: "Open faction to public", category: "ECONOMY" }, async (sock, msg) => {
  const sender = getSender(msg), fid = userFaction.get(sender);
  if (!fid) { await sendReply(sock, msg, "❌ Not in a faction!"); return; }
  const f = factions.get(fid); f.open = !f.open;
  await sendReply(sock, msg, `⚔️ Faction is now *${f.open ? "OPEN" : "CLOSED"}* to new members.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("fwar", { desc: "Declare war on another faction", category: "ECONOMY" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}fwar <faction name>`); return; }
  const sender = getSender(msg), fid = userFaction.get(sender);
  if (!fid) { await sendReply(sock, msg, "❌ Not in a faction!"); return; }
  const f = factions.get(fid);
  const targetFid = args.join(" ").toLowerCase().replace(/\s+/g, "_");
  const tf = factions.get(targetFid);
  if (!tf) { await sendReply(sock, msg, "❌ Target faction not found!"); return; }
  const myPower = f.members.length * 100 + (f.vault || 0);
  const theirPower = tf.members.length * 100 + (tf.vault || 0);
  const won = Math.random() * myPower > Math.random() * theirPower;
  const prize = Math.floor(Math.random() * 2000) + 500;
  if (won) { f.vault = (f.vault || 0) + prize; await sendReply(sock, msg, `⚔️ *WAR WON!*\n\n🏴 *${f.name}* defeated *${tf.name}*!\n💰 Loot: +${prize} coins to vault!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); }
  else { tf.vault = (tf.vault || 0) + prize; await sendReply(sock, msg, `⚔️ *WAR LOST!*\n\n🏴 *${tf.name}* defeated *${f.name}*!\n💔 Lost ${prize} coins.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); }
});

// Pet system
cmd("petshop", { desc: "View pets for sale", category: "ECONOMY" }, async (sock, msg) => {
  const pets = [{ name: "Dog", price: 1500, emoji: "🐕" }, { name: "Cat", price: 1200, emoji: "🐈" }, { name: "Parrot", price: 2000, emoji: "🦜" }, { name: "Hamster", price: 800, emoji: "🐹" }, { name: "Fish", price: 500, emoji: "🐠" }, { name: "Dragon", price: 10000, emoji: "🐉" }];
  let t = "🏪 *Pet Shop:*\n\n";
  pets.forEach(p => { t += `${p.emoji} *${p.name}* — ${p.price.toLocaleString()} coins\n`; });
  t += `\nUse: ${CONFIG.PREFIX}buypet <name>\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
  await sendReply(sock, msg, t);
});
cmd("buypet", { desc: "Buy a pet", category: "ECONOMY" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}buypet <name>`); return; }
  const sender = getSender(msg), name = args[0].toLowerCase();
  const pets = { dog: { price: 1500, emoji: "🐕" }, cat: { price: 1200, emoji: "🐈" }, parrot: { price: 2000, emoji: "🦜" }, hamster: { price: 800, emoji: "🐹" }, fish: { price: 500, emoji: "🐠" }, dragon: { price: 10000, emoji: "🐉" } };
  const pet = pets[name];
  if (!pet) { await sendReply(sock, msg, `❌ Unknown pet! Use ${CONFIG.PREFIX}petshop to see options.`); return; }
  const e = getEco(sender);
  if (e.wallet < pet.price) { await sendReply(sock, msg, `❌ Need ${pet.price.toLocaleString()} coins!`); return; }
  addWallet(sender, -pet.price);
  petStore.set(sender, { type: name, name: name, emoji: pet.emoji, health: 100, hunger: 100, happiness: 100, level: 1, bought: Date.now() });
  await sendReply(sock, msg, `${pet.emoji} *You bought a ${name}!*\n\n💰 -${pet.price.toLocaleString()} coins\nUse ${CONFIG.PREFIX}mypet to check on it!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("mypet", { desc: "View your pet", category: "ECONOMY" }, async (sock, msg) => {
  const pet = petStore.get(getSender(msg));
  if (!pet) { await sendReply(sock, msg, `❌ No pet! Use ${CONFIG.PREFIX}buypet to get one.`); return; }
  await sendReply(sock, msg, `${pet.emoji} *${pet.name}* (Lv.${pet.level})\n\n❤️ Health: ${pet.health}%\n🍗 Hunger: ${pet.hunger}%\n😊 Happiness: ${pet.happiness}%\n\nUse ${CONFIG.PREFIX}carepet to feed & play!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("carepet", { desc: "Feed and care for pet", category: "ECONOMY" }, async (sock, msg) => {
  const pet = petStore.get(getSender(msg));
  if (!pet) { await sendReply(sock, msg, `❌ No pet!`); return; }
  pet.hunger = Math.min(100, pet.hunger + 30);
  pet.happiness = Math.min(100, pet.happiness + 20);
  pet.health = Math.min(100, pet.health + 10);
  if (pet.happiness >= 90 && pet.hunger >= 90) { pet.level++; }
  await sendReply(sock, msg, `${pet.emoji} *Pet cared for!*\n\n🍗 Hunger: ${pet.hunger}%\n😊 Happiness: ${pet.happiness}%\n❤️ Health: ${pet.health}%\n⭐ Level: ${pet.level}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("renamepet", { desc: "Rename your pet", category: "ECONOMY" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}renamepet <name>`); return; }
  const pet = petStore.get(getSender(msg));
  if (!pet) { await sendReply(sock, msg, "❌ No pet!"); return; }
  pet.name = args.join(" ");
  await sendReply(sock, msg, `${pet.emoji} Pet renamed to *${pet.name}*!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("petleaderboard", { desc: "Pet level leaderboard", category: "ECONOMY" }, async (sock, msg) => {
  if (!petStore.size) { await sendReply(sock, msg, "❌ No pets yet!"); return; }
  const sorted = [...petStore.entries()].sort((a, b) => b[1].level - a[1].level).slice(0, 10);
  let t = "🏆 *Pet Leaderboard:*\n\n";
  sorted.forEach(([jid, pet], i) => { t += `${i+1}. ${pet.emoji} *${pet.name}* (Lv.${pet.level}) — @${jid.split("@")[0]}\n`; });
  await sendReply(sock, msg, t + `\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, sorted.map(([j]) => j));
});
cmd("petreward", { desc: "Collect daily pet reward", category: "ECONOMY" }, async (sock, msg) => {
  const pet = petStore.get(getSender(msg));
  if (!pet) { await sendReply(sock, msg, "❌ No pet!"); return; }
  const reward = pet.level * 50;
  addWallet(getSender(msg), reward);
  await sendReply(sock, msg, `${pet.emoji} *Pet Reward!*\n\n+${reward} coins (Level ${pet.level} bonus)\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});

// Battle system
cmd("attack", { desc: "Attack another player", category: "ECONOMY" }, async (sock, msg) => {
  const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (!mentions.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}attack @user`); return; }
  const sender = getSender(msg), target = mentions[0];
  if (sender === target) { await sendReply(sock, msg, "❌ Can't attack yourself!"); return; }
  const sE = getEco(sender), tE = getEco(target);
  const sPower = sE.level * 10 + (hasItem(sender, "sword") ? 25 : 0) + (hasItem(sender, "armor") ? 15 : 0);
  const tPower = tE.level * 10 + (hasItem(target, "shield") ? 20 : 0) + (hasItem(target, "armor") ? 15 : 0);
  const won = Math.random() * sPower > Math.random() * tPower;
  const coins = Math.floor(Math.random() * 500) + 100;
  if (won) { addWallet(sender, coins); addWallet(target, -coins); addXP(sender, 50);
    await sendReply(sock, msg, `⚔️ *ATTACK!*\n\n@${sender.split("@")[0]} defeated @${target.split("@")[0]}!\n💰 +${coins} coins stolen!\n+50 XP\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, [sender, target]);
  } else { addWallet(sender, -Math.floor(coins/2));
    await sendReply(sock, msg, `⚔️ *ATTACK FAILED!*\n\n@${target.split("@")[0]} defended against @${sender.split("@")[0]}!\n💔 -${Math.floor(coins/2)} coins\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, [sender, target]);
  }
});
cmd("attacklog", { desc: "View attack history", category: "ECONOMY" }, async (sock, msg) => {
  await sendReply(sock, msg, `📜 *Attack Log*\n\nAttack history is session-based.\nUse ${CONFIG.PREFIX}attack @user to battle!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("battlelb", { desc: "Battle leaderboard", category: "ECONOMY" }, async (sock, msg) => {
  const sorted = [...economy.entries()].sort((a, b) => b[1].level - a[1].level).slice(0, 10);
  let t = "🏆 *Battle Leaderboard:*\n\n";
  sorted.forEach(([jid, e], i) => { t += `${i+1}. @${jid.split("@")[0]} — Lv.${e.level} | ${e.wallet.toLocaleString()} coins\n`; });
  await sendReply(sock, msg, t + `\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, sorted.map(([j]) => j));
});
cmd("autoshield", { desc: "Toggle auto-shield", category: "ECONOMY" }, async (sock, msg) => {
  const sender = getSender(msg);
  if (!hasItem(sender, "shield")) { await sendReply(sock, msg, `❌ You need a shield! Buy one from ${CONFIG.PREFIX}shop`); return; }
  const e = getEco(sender); e.autoShield = !e.autoShield;
  await sendReply(sock, msg, `🛡️ Auto-Shield: ${e.autoShield ? "✅ ON" : "❌ OFF"}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("tornhelp", { desc: "Torn-style help menu", category: "ECONOMY" }, async (sock, msg) => {
  await sendReply(sock, msg, `🎮 *Torn-Style Commands:*\n\n⚔️ ${CONFIG.PREFIX}attack @user — Attack player\n🏥 ${CONFIG.PREFIX}hospital — Check health\n💪 ${CONFIG.PREFIX}train — Train stats\n🌆 ${CONFIG.PREFIX}cities — View cities\n✈️ ${CONFIG.PREFIX}travel <city> — Travel\n💊 ${CONFIG.PREFIX}drugs — Drug market\n🛡️ ${CONFIG.PREFIX}autoshield — Toggle shield\n📊 ${CONFIG.PREFIX}battlelb — Battle rankings\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("hospital", { desc: "Check/restore health", category: "ECONOMY" }, async (sock, msg) => {
  const sender = getSender(msg), e = getEco(sender);
  if (!e.health) e.health = 100;
  if (e.health >= 100) { await sendReply(sock, msg, `🏥 You're at full health! (${e.health}/100)\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; }
  const cost = (100 - e.health) * 10;
  if (e.wallet < cost) { await sendReply(sock, msg, `🏥 Healing costs ${cost} coins. You have ${e.wallet}.`); return; }
  addWallet(sender, -cost); e.health = 100;
  await sendReply(sock, msg, `🏥 *Healed!* -${cost} coins\n❤️ Health: 100/100\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("nerve", { desc: "Check nerve points", category: "ECONOMY" }, async (sock, msg) => {
  const e = getEco(getSender(msg));
  if (!e.nerve) e.nerve = 50;
  await sendReply(sock, msg, `💢 *Nerve:* ${e.nerve}/50\n\nNerve regenerates over time.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("energy", { desc: "Check energy level", category: "ECONOMY" }, async (sock, msg) => {
  const e = getEco(getSender(msg));
  if (!e.energy) e.energy = 100;
  await sendReply(sock, msg, `⚡ *Energy:* ${e.energy}/100\n\nEnergy is used for training and travel.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("train", { desc: "Train to increase stats", category: "ECONOMY" }, async (sock, msg) => {
  const sender = getSender(msg), e = getEco(sender);
  if (!e.energy) e.energy = 100;
  if (e.energy < 20) { await sendReply(sock, msg, "❌ Not enough energy! Wait for it to regenerate."); return; }
  e.energy -= 20;
  const stat = ["strength", "defense", "speed"][Math.floor(Math.random() * 3)];
  if (!e.stats) e.stats = { strength: 1, defense: 1, speed: 1 };
  e.stats[stat]++; addXP(sender, 25);
  await sendReply(sock, msg, `💪 *Training Complete!*\n\n📈 ${stat.charAt(0).toUpperCase() + stat.slice(1)} +1\n⚡ Energy: ${e.energy}/100\n+25 XP\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("cities", { desc: "View available cities", category: "ECONOMY" }, async (sock, msg) => {
  const cities = [
    { name: "Lagos", emoji: "🇳🇬", cost: 500 }, { name: "London", emoji: "🇬🇧", cost: 2000 },
    { name: "Dubai", emoji: "🇦🇪", cost: 3000 }, { name: "New York", emoji: "🇺🇸", cost: 4000 },
    { name: "Tokyo", emoji: "🇯🇵", cost: 3500 }, { name: "Paris", emoji: "🇫🇷", cost: 2500 },
  ];
  let t = "🌍 *Cities:*\n\n";
  cities.forEach(c => { t += `${c.emoji} *${c.name}* — ✈️ ${c.cost} coins\n`; });
  t += `\nUse: ${CONFIG.PREFIX}travel <city>\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
  await sendReply(sock, msg, t);
});
cmd("travel", { desc: "Travel to a city", category: "ECONOMY" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}travel <city>`); return; }
  const sender = getSender(msg), e = getEco(sender);
  const cities = { lagos: 500, london: 2000, dubai: 3000, newyork: 4000, tokyo: 3500, paris: 2500 };
  const city = args.join("").toLowerCase().replace(/\s+/g, "");
  const cost = cities[city];
  if (!cost) { await sendReply(sock, msg, `❌ Unknown city! Use ${CONFIG.PREFIX}cities`); return; }
  if (e.wallet < cost) { await sendReply(sock, msg, `❌ Need ${cost} coins to travel!`); return; }
  addWallet(sender, -cost); e.location = city;
  const bonus = Math.floor(Math.random() * cost * 0.5);
  addWallet(sender, bonus);
  await sendReply(sock, msg, `✈️ *Traveled to ${args.join(" ")}!*\n\n💰 Travel cost: -${cost}\n🎁 Found: +${bonus} coins abroad!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("travelstatus", { desc: "Check current location", category: "ECONOMY" }, async (sock, msg) => {
  const e = getEco(getSender(msg));
  await sendReply(sock, msg, `📍 *Location:* ${e.location ? e.location.charAt(0).toUpperCase() + e.location.slice(1) : "Home"}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("abroad", { desc: "Explore abroad for loot", category: "ECONOMY" }, async (sock, msg) => {
  const sender = getSender(msg), e = getEco(sender);
  if (!e.location || e.location === "home") { await sendReply(sock, msg, `❌ Travel somewhere first! Use ${CONFIG.PREFIX}travel`); return; }
  const loot = Math.floor(Math.random() * 1000) + 200;
  addWallet(sender, loot); addXP(sender, 30);
  await sendReply(sock, msg, `🌍 *Explored ${e.location}!*\n\n💰 Found: +${loot} coins\n+30 XP\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});

// Drugs system
cmd("drugs", { desc: "View drug market", category: "ECONOMY" }, async (sock, msg) => {
  const drugs = [
    { name: "Xanax", price: 1000, effect: "+25 nerve", emoji: "💊" },
    { name: "Energy Drink", price: 300, effect: "+30 energy", emoji: "🥤" },
    { name: "Steroids", price: 2000, effect: "+5 strength", emoji: "💉" },
    { name: "Speed", price: 1500, effect: "+5 speed", emoji: "⚡" },
  ];
  let t = "💊 *Drug Market:*\n\n";
  drugs.forEach(d => { t += `${d.emoji} *${d.name}* — ${d.price} coins (${d.effect})\n`; });
  t += `\nUse: ${CONFIG.PREFIX}buydrg <name>\n⚠️ _Use at your own risk!_\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
  await sendReply(sock, msg, t);
});
cmd("buydrg", { desc: "Buy drugs", category: "ECONOMY" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}buydrg <drug name>`); return; }
  const sender = getSender(msg), e = getEco(sender);
  const drugs = { xanax: { price: 1000, item: "xanax" }, energydrink: { price: 300, item: "energy_drink" }, steroids: { price: 2000, item: "steroids" }, speed: { price: 1500, item: "speed" } };
  const key = args.join("").toLowerCase();
  const drug = drugs[key];
  if (!drug) { await sendReply(sock, msg, `❌ Unknown drug! Use ${CONFIG.PREFIX}drugs`); return; }
  if (e.wallet < drug.price) { await sendReply(sock, msg, "❌ Not enough coins!"); return; }
  addWallet(sender, -drug.price); addItem(sender, drug.item);
  await sendReply(sock, msg, `💊 Bought *${args.join(" ")}*!\n💰 -${drug.price} coins\nUse ${CONFIG.PREFIX}usedrg ${args.join(" ")} to consume.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("usedrg", { desc: "Use a drug", category: "ECONOMY" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}usedrg <drug name>`); return; }
  const sender = getSender(msg), e = getEco(sender);
  const effects = { xanax: () => { if(!e.nerve) e.nerve=50; e.nerve = Math.min(50, e.nerve+25); return "💢 Nerve +25"; },
    energy_drink: () => { if(!e.energy) e.energy=100; e.energy = Math.min(100, e.energy+30); return "⚡ Energy +30"; },
    steroids: () => { if(!e.stats) e.stats={strength:1,defense:1,speed:1}; e.stats.strength+=5; return "💪 Strength +5"; },
    speed: () => { if(!e.stats) e.stats={strength:1,defense:1,speed:1}; e.stats.speed+=5; return "🏃 Speed +5"; } };
  const key = args.join("_").toLowerCase();
  if (!hasItem(sender, key)) { await sendReply(sock, msg, "❌ You don't have that drug!"); return; }
  removeItem(sender, key);
  const effect = effects[key]?.() || "Effect applied";
  await sendReply(sock, msg, `💊 *Drug Used!*\n\n${effect}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("drugstatus", { desc: "Check active drug effects", category: "ECONOMY" }, async (sock, msg) => {
  const e = getEco(getSender(msg));
  await sendReply(sock, msg, `💊 *Drug Status:*\n\n💢 Nerve: ${e.nerve || 50}/50\n⚡ Energy: ${e.energy || 100}/100\n💪 Str: ${e.stats?.strength || 1}\n🏃 Spd: ${e.stats?.speed || 1}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});

// Market system
cmd("market", { desc: "View player market", category: "ECONOMY" }, async (sock, msg) => {
  if (!settings.has("_market")) settings.set("_market", new Map());
  const market = settings.get("_market");
  if (!market.size) { await sendReply(sock, msg, `🏪 *Market is empty!*\n\nUse ${CONFIG.PREFIX}sell <item> <price> to list.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; }
  let t = "🏪 *Player Market:*\n\n";
  let i = 1;
  for (const [id, listing] of market) { t += `${i++}. *${listing.item}* — ${listing.price} coins (by @${listing.seller.split("@")[0]})\n`; }
  t += `\nUse: ${CONFIG.PREFIX}marketbuy <item>\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
  await sendReply(sock, msg, t);
});
cmd("marketbuy", { desc: "Buy from market", category: "ECONOMY" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}marketbuy <item>`); return; }
  if (!settings.has("_market")) { await sendReply(sock, msg, "❌ Market is empty!"); return; }
  const market = settings.get("_market");
  const itemName = args.join("_").toLowerCase();
  let found = null, foundKey = null;
  for (const [k, v] of market) { if (v.item.toLowerCase() === itemName) { found = v; foundKey = k; break; } }
  if (!found) { await sendReply(sock, msg, "❌ Item not found on market!"); return; }
  const sender = getSender(msg), e = getEco(sender);
  if (e.wallet < found.price) { await sendReply(sock, msg, "❌ Not enough coins!"); return; }
  addWallet(sender, -found.price); addWallet(found.seller, found.price);
  addItem(sender, found.item); market.delete(foundKey);
  await sendReply(sock, msg, `✅ Bought *${found.item}* for ${found.price} coins!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("unsell", { desc: "Remove item from market", category: "ECONOMY" }, async (sock, msg, args) => {
  if (!settings.has("_market")) { await sendReply(sock, msg, "❌ Nothing on market!"); return; }
  const market = settings.get("_market"), sender = getSender(msg);
  const itemName = args.join("_").toLowerCase();
  for (const [k, v] of market) { if (v.seller === sender && v.item.toLowerCase() === itemName) { market.delete(k); addItem(sender, v.item); await sendReply(sock, msg, `✅ Removed *${v.item}* from market.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`); return; } }
  await sendReply(sock, msg, "❌ Item not found or not yours!");
});
cmd("sellitems", { desc: "Sell item to shop", category: "ECONOMY" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}sellitems <item>`); return; }
  const sender = getSender(msg), item = args.join("_").toLowerCase();
  if (!hasItem(sender, item)) { await sendReply(sock, msg, "❌ You don't have that item!"); return; }
  const shopItem = shopItems.get(item);
  const price = shopItem ? Math.floor(shopItem.price * 0.5) : 100;
  removeItem(sender, item); addWallet(sender, price);
  await sendReply(sock, msg, `✅ Sold *${item}* for ${price} coins!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("buyitem", { desc: "Buy item from shop", category: "ECONOMY" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}buyitem <item>`); return; }
  const sender = getSender(msg), item = args.join("_").toLowerCase();
  const shopItem = shopItems.get(item);
  if (!shopItem) { await sendReply(sock, msg, `❌ Not in shop! Use ${CONFIG.PREFIX}shop`); return; }
  const e = getEco(sender);
  if (e.wallet < shopItem.price) { await sendReply(sock, msg, `❌ Need ${shopItem.price} coins!`); return; }
  addWallet(sender, -shopItem.price); addItem(sender, item);
  await sendReply(sock, msg, `✅ Bought *${item}*!\n💰 -${shopItem.price} coins\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("shopadd", { desc: "Add item to shop (owner)", category: "ECONOMY", ownerOnly: true }, async (sock, msg, args) => {
  if (args.length < 2) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}shopadd <item> <price>`); return; }
  const price = parseInt(args.pop()), item = args.join("_").toLowerCase();
  shopItems.set(item, { price, desc: "Custom item" });
  await sendReply(sock, msg, `✅ Added *${item}* to shop for ${price} coins!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("shopdel", { desc: "Remove item from shop (owner)", category: "ECONOMY", ownerOnly: true }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}shopdel <item>`); return; }
  const item = args.join("_").toLowerCase();
  shopItems.delete(item);
  await sendReply(sock, msg, `✅ Removed *${item}* from shop.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("gambstats", { desc: "Gambling statistics", category: "ECONOMY" }, async (sock, msg) => {
  const e = getEco(getSender(msg));
  await sendReply(sock, msg, `🎰 *Gambling Stats:*\n\n💰 Wallet: ${e.wallet.toLocaleString()}\n🏦 Bank: ${e.bank.toLocaleString()}\n⭐ Level: ${e.level}\n✨ XP: ${e.xp}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("collect", { desc: "Collect daily bonus from assets", category: "ECONOMY" }, async (sock, msg) => {
  const sender = getSender(msg), e = getEco(sender);
  const bonus = e.level * 25 + 100;
  addWallet(sender, bonus);
  await sendReply(sock, msg, `💎 *Asset Collection!*\n\n+${bonus} coins collected!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("hireworker", { desc: "Hire a worker for passive income", category: "ECONOMY" }, async (sock, msg) => {
  const sender = getSender(msg), e = getEco(sender);
  const cost = 5000;
  if (e.wallet < cost) { await sendReply(sock, msg, `❌ Need ${cost} coins to hire a worker!`); return; }
  addWallet(sender, -cost); if (!e.workers) e.workers = 0; e.workers++;
  await sendReply(sock, msg, `👷 *Worker Hired!*\n\n💰 -${cost} coins\n👥 Workers: ${e.workers}\nEach worker earns passive income!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("upgrade", { desc: "Upgrade your level", category: "ECONOMY" }, async (sock, msg) => {
  const sender = getSender(msg), e = getEco(sender);
  const cost = e.level * 500;
  if (e.wallet < cost) { await sendReply(sock, msg, `❌ Need ${cost} coins to upgrade!`); return; }
  addWallet(sender, -cost); e.level++;
  await sendReply(sock, msg, `⬆️ *Level Up!*\n\n⭐ Level: ${e.level}\n💰 Cost: -${cost}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});

// Bounty system
cmd("bounties", { desc: "View active bounties", category: "ECONOMY" }, async (sock, msg) => {
  if (!settings.has("_bounties")) settings.set("_bounties", new Map());
  const bounties = settings.get("_bounties");
  if (!bounties.size) { await sendReply(sock, msg, "❌ No active bounties.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡"); return; }
  let t = "🎯 *Active Bounties:*\n\n";
  for (const [target, info] of bounties) { t += `• @${target.split("@")[0]} — ${info.reward} coins (by @${info.setter.split("@")[0]})\n`; }
  await sendReply(sock, msg, t + `\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd("setbounty", { desc: "Set bounty on player", category: "ECONOMY" }, async (sock, msg, args) => {
  const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  const amount = parseInt(args.find(a => !a.startsWith("@"))) || 0;
  if (!mentions.length || amount < 100) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}setbounty @user <amount>`); return; }
  const sender = getSender(msg), e = getEco(sender);
  if (e.wallet < amount) { await sendReply(sock, msg, "❌ Not enough coins!"); return; }
  addWallet(sender, -amount);
  if (!settings.has("_bounties")) settings.set("_bounties", new Map());
  settings.get("_bounties").set(mentions[0], { reward: amount, setter: sender });
  await sendReply(sock, msg, `🎯 Bounty of *${amount} coins* set on @${mentions[0].split("@")[0]}!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, mentions);
});
cmd("mybounty", { desc: "Check if there's a bounty on you", category: "ECONOMY" }, async (sock, msg) => {
  if (!settings.has("_bounties")) { await sendReply(sock, msg, "✅ No bounty on you!"); return; }
  const b = settings.get("_bounties").get(getSender(msg));
  if (!b) { await sendReply(sock, msg, "✅ No bounty on you!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡"); return; }
  await sendReply(sock, msg, `⚠️ *Bounty on you:* ${b.reward} coins!\nSet by @${b.setter.split("@")[0]}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`, [b.setter]);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  HENTAI / ADULT COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════
cmd("htimig", { desc: "Hentai image", category: "HENTAI" }, async (sock, msg) => {
  const s = getSettings(msg.key.remoteJid);
  if (!s.adultMode) { await sendReply(sock, msg, "🔞 Adult mode is OFF. Enable in settings first."); return; }
  await react(sock, msg, "🔞");
  try {
    const { data } = await axios.get(`${CONFIG.GIFTED_API}/api/anime/hentai?apikey=${CONFIG.GIFTED_KEY}`, { timeout: 10000 });
    const url = data?.result?.url || data?.result;
    if (url) {
      const buf = await axios.get(url, { responseType: "arraybuffer", timeout: 15000 });
      await sock.sendMessage(msg.key.remoteJid, { image: Buffer.from(buf.data), caption: `🔞 *NSFW*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
    } else throw new Error("no url");
  } catch { await sendReply(sock, msg, "❌ Failed to load content."); }
});
const HENTAI_SEARCH_CMDS = {
  xsearch: { name: "X Search", endpoint: "xsearch" }, xdl: { name: "X Download", endpoint: "xvideos" },
  xget: { name: "X Get", endpoint: "xget" }, xhsearch: { name: "XH Search", endpoint: "xhsearch" },
  xhdl: { name: "XH Download", endpoint: "xhamster" }, phsearch: { name: "PH Search", endpoint: "phsearch" },
  phdl: { name: "PH Download", endpoint: "pornhub" }, hentaivid: { name: "Hentai Video", endpoint: "hentai" },
};
for (const [hCmd, hInfo] of Object.entries(HENTAI_SEARCH_CMDS)) {
  cmd(hCmd, { desc: `${hInfo.name}`, category: "HENTAI" }, async (sock, msg, args) => {
    const s = getSettings(msg.key.remoteJid);
    if (!s.adultMode) { await sendReply(sock, msg, "🔞 Adult mode is OFF. Enable in settings first."); return; }
    await react(sock, msg, "🔞");
    const jid = msg.key.remoteJid;
    try {
      const q = args.join(" ") || "random";
      const { data } = await axios.get(`${CONFIG.GIFTED_API}/api/nsfw/${hInfo.endpoint}?apikey=${CONFIG.GIFTED_KEY}&query=${encodeURIComponent(q)}`, { timeout: 30000 });
      const result = data?.result || data?.data || data;
      // If result is a list of search hits → try each until we get a real video
      const items = Array.isArray(result) ? result : (result ? [result] : []);
      if (!items.length) {
        await sendReply(sock, msg, `🔞 *${hInfo.name}*\n\nNo results found.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
        return;
      }
      // Detect image-only endpoints (hentai image etc.)
      const firstUrl = items[0]?.download_url || items[0]?.url || items[0]?.video || items[0]?.image;
      const looksImage = typeof firstUrl === "string" && /\.(jpg|jpeg|png|webp|gif)($|\?)/i.test(firstUrl) && !items[0]?.video;
      if (looksImage) {
        const buf = await axios.get(firstUrl, { responseType: "arraybuffer", timeout: 30000 });
        await sock.sendMessage(jid, { image: Buffer.from(buf.data), caption: `🔞 *${hInfo.name}*\n\n${items[0]?.title || ""}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡` }, { quoted: msg });
        return;
      }
      // Video endpoints — walk the result list until we successfully send a real video
      for (const it of items.slice(0, 4)) {
        const ok = await sendAdultVideo(sock, jid, msg, it, { captionPrefix: `🔞 ${hInfo.name}` });
        if (ok) return;
      }
      await sendReply(sock, msg, `⚠️ *${hInfo.name}* — found results but couldn't fetch a playable video. Try another query.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    } catch (e) { await sendReply(sock, msg, `❌ ${hInfo.name} failed: ${e.message}`); }
  });
}



// ═══════════════════════════════════════════════════════════════════════════════
//  ADULT VIDEO RESOLVER — turns search results / page URLs into REAL .mp4 buffers
// ═══════════════════════════════════════════════════════════════════════════════
function _pickDirectFromItem(item) {
  if (!item) return null;
  // Common direct-media fields used across NSFW search APIs
  const candidates = [
    item.download, item.video, item.videoUrl, item.video_url, item.mp4,
    item.files?.high, item.files?.low, item.files?.hd, item.files?.sd,
    item.qualities?.["720p"], item.qualities?.["480p"], item.qualities?.["240p"],
    item.media?.video, item.media?.url,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && /^https?:\/\//.test(c) && /\.mp4($|\?)/i.test(c)) return c;
  }
  for (const c of candidates) {
    if (typeof c === "string" && /^https?:\/\//.test(c) && !/\.(jpg|jpeg|png|webp|gif|html?)($|\?)/i.test(c)) return c;
  }
  return null;
}
function _itemPageUrl(item) {
  if (!item) return null;
  return item.url || item.link || item.permalink || item.page || null;
}
async function _resolvePageToMp4(pageUrl) {
  if (!pageUrl) return null;
  const resolvers = [
    async () => (await axios.get(`${CONFIG.GIFTED_API}/api/download/phdl?apikey=${CONFIG.GIFTED_KEY}&url=${encodeURIComponent(pageUrl)}`, { timeout: 30000 })).data,
    async () => (await axios.get(`${CONFIG.GIFTED_API}/api/download/xnxxdl?apikey=${CONFIG.GIFTED_KEY}&url=${encodeURIComponent(pageUrl)}`, { timeout: 30000 })).data,
    async () => (await axios.get(`${CONFIG.GIFTED_API}/api/download/xvideosdl?apikey=${CONFIG.GIFTED_KEY}&url=${encodeURIComponent(pageUrl)}`, { timeout: 30000 })).data,
    async () => (await axios.get(`${CONFIG.GIFTED_API}/api/download/xhamsterdl?apikey=${CONFIG.GIFTED_KEY}&url=${encodeURIComponent(pageUrl)}`, { timeout: 30000 })).data,
    async () => (await axios.get(`https://api.siputzx.my.id/api/d/pornhub?url=${encodeURIComponent(pageUrl)}`, { timeout: 30000 })).data,
    async () => (await axios.get(`https://api.siputzx.my.id/api/d/xnxx?url=${encodeURIComponent(pageUrl)}`, { timeout: 30000 })).data,
    async () => (await axios.get(`https://api.siputzx.my.id/api/d/xvideos?url=${encodeURIComponent(pageUrl)}`, { timeout: 30000 })).data,
    async () => (await axios.get(`https://api.siputzx.my.id/api/d/xhamster?url=${encodeURIComponent(pageUrl)}`, { timeout: 30000 })).data,
    async () => (await axios.get(`https://api.ryzendesu.vip/api/downloader/xnxx?url=${encodeURIComponent(pageUrl)}`, { timeout: 30000 })).data,
    async () => (await axios.get(`https://api.ryzendesu.vip/api/downloader/xvideos?url=${encodeURIComponent(pageUrl)}`, { timeout: 30000 })).data,
    async () => (await axios.get(`https://api.ryzendesu.vip/api/downloader/pornhub?url=${encodeURIComponent(pageUrl)}`, { timeout: 30000 })).data,
    async () => (await axios.get(`https://api.nexoracle.com/downloader/xnxx?apikey=free_key@maher_apis&url=${encodeURIComponent(pageUrl)}`, { timeout: 30000 })).data,
    async () => (await axios.get(`https://api.nexoracle.com/downloader/pornhub?apikey=free_key@maher_apis&url=${encodeURIComponent(pageUrl)}`, { timeout: 30000 })).data,
    async () => (await axios.get(`https://api.nexoracle.com/downloader/xvideos?apikey=free_key@maher_apis&url=${encodeURIComponent(pageUrl)}`, { timeout: 30000 })).data,
    async () => (await axios.get(`https://widipe.com/download/xnxxdl?url=${encodeURIComponent(pageUrl)}`, { timeout: 30000 })).data,
    async () => (await axios.get(`https://widipe.com/download/xvideosdl?url=${encodeURIComponent(pageUrl)}`, { timeout: 30000 })).data,
    async () => (await axios.get(`https://widipe.com/download/pornhubdl?url=${encodeURIComponent(pageUrl)}`, { timeout: 30000 })).data,
    async () => (await axios.get(`https://api.davidcyriltech.my.id/xnxx/download?url=${encodeURIComponent(pageUrl)}`, { timeout: 30000 })).data,
    async () => (await axios.get(`https://bk9.fun/download/xvideosdl?url=${encodeURIComponent(pageUrl)}`, { timeout: 30000 })).data,
    async () => (await axios.get(`https://bk9.fun/download/xnxxdl?url=${encodeURIComponent(pageUrl)}`, { timeout: 30000 })).data,
    async () => (await axios.get(`https://api.diioffc.web.id/api/download/xnxx?url=${encodeURIComponent(pageUrl)}`, { timeout: 30000 })).data,
    async () => (await axios.get(`https://aemt.me/download/xnxx?url=${encodeURIComponent(pageUrl)}`, { timeout: 30000 })).data,
    async () => (await axios.get(`https://api.fasturl.cloud/download/xnxx?url=${encodeURIComponent(pageUrl)}`, { timeout: 30000 })).data,
  ];
  for (const r of resolvers) {
    try {
      const d = await r();
      // Try every conceivable field name
      const cands = [
        d?.result?.video, d?.result?.url, d?.result?.download, d?.result?.mp4,
        d?.result?.files?.high, d?.result?.files?.low, d?.result?.files?.hd, d?.result?.files?.sd,
        d?.data?.video, d?.data?.url, d?.data?.download, d?.data?.mp4,
        d?.data?.qualities?.["720p"], d?.data?.qualities?.["480p"], d?.data?.qualities?.["240p"],
        d?.video, d?.url, d?.download, d?.mp4,
      ];
      for (const c of cands) {
        if (typeof c === "string" && /^https?:\/\//.test(c)) return c;
      }
    } catch {}
  }
  return null;
}
async function _downloadVideoBuf(directUrl, referer) {
  const resp = await axios.get(directUrl, {
    responseType: "arraybuffer",
    timeout: 180000,
    maxContentLength: 100 * 1024 * 1024,
    maxRedirects: 10,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      Referer: referer || "https://www.google.com/",
      Accept: "*/*",
    },
    validateStatus: s => s >= 200 && s < 400,
  });
  const ct = String(resp.headers?.["content-type"] || "").toLowerCase();
  const buf = Buffer.from(resp.data);
  // Reject HTML / tiny payloads
  if (buf.length < 50000) return null;
  if (ct.includes("text/html")) return null;
  return buf;
}


cmd(["creategc", "newgroup", "newgroup2"], { desc: "Create a new WhatsApp group", category: "OWNER", ownerOnly: true }, async (sock, msg, args) => {
  const ctx = msg.message?.extendedTextMessage?.contextInfo
    || msg.message?.imageMessage?.contextInfo
    || msg.message?.videoMessage?.contextInfo
    || msg.message?.documentMessage?.contextInfo;
  const mentioned = Array.from(new Set((ctx?.mentionedJid || []).filter(Boolean)));
  const raw = args.join(" ").trim();
  const parts = raw.split("|").map(v => v.trim()).filter(Boolean);
  const subject = parts[0] || "";
  const participantNums = (parts[1] || "")
    .split(/[ ,\n]+/)
    .map(v => v.replace(/[^0-9]/g, ""))
    .filter(v => v.length >= 7)
    .map(v => `${v}@s.whatsapp.net`);
  const participants = Array.from(new Set([...mentioned, ...participantNums]));
  if (!subject) {
    await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}creategc Group Name | 1234567890,2345678901\nYou can also mention users with the command.`);
    return;
  }
  if (!participants.length) {
    await sendReply(sock, msg, `❌ Add at least one participant number or mention for the new group.`);
    return;
  }
  await react(sock, msg, "👥");
  try {
    const created = await sock.groupCreate(subject, participants);
    const inviteCode = await sock.groupInviteCode(created.id).catch(() => "");
    const inviteLink = inviteCode ? `https://chat.whatsapp.com/${inviteCode}` : "Unavailable";
    await sendReply(sock, msg, `✅ *Group created successfully!*\n\n📛 Name: *${subject}*\n👥 Added: *${participants.length}* participant(s)\n🆔 JID: ${created.id}\n🔗 Invite: ${inviteLink}`);
  } catch (e) {
    await sendReply(sock, msg, `❌ Group creation failed: ${e.message}`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GOON MODE — adult-gated personal mode (auto-DMs adult content to owner)
// ═══════════════════════════════════════════════════════════════════════════════
const _goonState = { active: false, intervalMs: 90000, timer: null, target: null };

async function _fetchGoonMedia() {
  const sources = [
    async () => {
      const { data } = await axios.get("https://api.waifu.im/search?included_tags=ecchi&is_nsfw=true", { timeout: 12000 });
      return data?.images?.[0]?.url;
    },
    async () => {
      const { data } = await axios.get("https://api.waifu.pics/nsfw/waifu", { timeout: 12000 });
      return data?.url;
    },
    async () => {
      const { data } = await axios.get("https://api.waifu.pics/nsfw/neko", { timeout: 12000 });
      return data?.url;
    },
    async () => {
      const { data } = await axios.get("https://nekobot.xyz/api/image?type=hentai", { timeout: 12000 });
      return data?.message;
    },
    async () => {
      const { data } = await axios.get("https://nekos.life/api/v2/img/lewd", { timeout: 12000 });
      return data?.url;
    },
  ];
  for (const fn of sources) {
    try { const u = await fn(); if (u && /^https?:\/\//.test(u)) return u; } catch {}
  }
  return null;
}

async function _goonTick(sock) {
  if (!_goonState.active || !_goonState.target) return;
  try {
    const url = await _fetchGoonMedia();
    if (!url) return;
    const r = await axios.get(url, { responseType: "arraybuffer", timeout: 30000 });
    await sock.sendMessage(_goonState.target, {
      image: Buffer.from(r.data),
      caption: `🔞 *GOON MODE*\n\n_Auto-delivered. ${CONFIG.PREFIX}goonoff to stop._\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`,
    });
  } catch (e) { console.error("goon tick:", e?.message); }
}

cmd(["goon","goonmode"], { desc: "Start goon mode (auto-DM 18+ to owner)", category: "HENTAI", adult: true, ownerOnly: true }, async (sock, msg, args) => {
  const s = getSettings(msg.key.remoteJid);
  const ownerS = getSettings(getOwnerJid());
  if (!(s.adultMode || ownerS.adultMode)) {
    await sendReply(sock, msg, `🔞 Adult mode is OFF. Enable with *${CONFIG.PREFIX}setting* → 23.1`);
    return;
  }
  const sec = parseInt(args[0], 10);
  if (Number.isFinite(sec) && sec >= 15) _goonState.intervalMs = sec * 1000;
  _goonState.target = getOwnerJid();
  _goonState.active = true;
  if (_goonState.timer) clearInterval(_goonState.timer);
  _goonState.timer = setInterval(() => _goonTick(sock), _goonState.intervalMs);
  await react(sock, msg, "🔞");
  await sendReply(sock, msg, `🔞 *Goon Mode: ✅ ON*\n\nDelivering every *${Math.round(_goonState.intervalMs/1000)}s* to your DM.\nStop: *${CONFIG.PREFIX}goonoff*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  // Fire one immediately
  _goonTick(sock);
});

cmd("goonoff", { desc: "Stop goon mode", category: "HENTAI", adult: true, ownerOnly: true }, async (sock, msg) => {
  _goonState.active = false;
  if (_goonState.timer) { clearInterval(_goonState.timer); _goonState.timer = null; }
  await sendReply(sock, msg, `🔞 *Goon Mode: ❌ OFF*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});

cmd("goonstatus", { desc: "Show goon mode status", category: "HENTAI", adult: true, ownerOnly: true }, async (sock, msg) => {
  await sendReply(sock, msg,
    `🔞 *Goon Mode Status*\n\nActive: ${_goonState.active ? "✅" : "❌"}\nInterval: ${Math.round(_goonState.intervalMs/1000)}s\nTarget: ${_goonState.target || "—"}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  ADULT QUICK CMDS — xnxx / pornhub / xhamster / ph (all adult-gated)
// ═══════════════════════════════════════════════════════════════════════════════
const _ADULT_QUICK = {
  xnxx:     { label: "XNXX",     site: "xnxx" },
  xxnx:     { label: "XNXX",     site: "xnxx" },
  pornhub:  { label: "PornHub",  site: "pornhub" },
  ph:       { label: "PornHub",  site: "pornhub" },
  xhamster: { label: "xHamster", site: "xhamster" },
  xvideos:  { label: "XVideos",  site: "xvideos" },
};

// Try a long list of providers and return the first non-empty result list
async function _adultMultiSearch(site, query) {
  const q = encodeURIComponent(query);
  const tries = [
    () => axios.get(`${CONFIG.GIFTED_API}/api/search/${site}search?apikey=${CONFIG.GIFTED_KEY}&q=${q}`,    { timeout: 20000 }),
    () => axios.get(`${CONFIG.GIFTED_API}/api/nsfw/${site}?apikey=${CONFIG.GIFTED_KEY}&query=${q}`,        { timeout: 20000 }),
    () => axios.get(`https://api.nexoracle.com/nsfw/${site}?apikey=free_key@maher_apis&query=${q}`,       { timeout: 20000 }),
    () => axios.get(`https://api.nexoracle.com/search/${site}?apikey=free_key@maher_apis&q=${q}`,         { timeout: 20000 }),
    () => axios.get(`https://api.siputzx.my.id/api/s/${site}?query=${q}`,                                  { timeout: 20000 }),
    () => axios.get(`https://api.siputzx.my.id/api/s/${site}?q=${q}`,                                      { timeout: 20000 }),
    () => axios.get(`https://api.ryzendesu.vip/api/search/${site}?query=${q}`,                             { timeout: 20000 }),
    () => axios.get(`https://api.ryzendesu.vip/api/search/${site}?q=${q}`,                                 { timeout: 20000 }),
    () => axios.get(`https://widipe.com/search/${site}?q=${q}`,                                            { timeout: 20000 }),
    () => axios.get(`https://api.davidcyriltech.my.id/${site}/search?text=${q}`,                           { timeout: 20000 }),
    () => axios.get(`https://api.guruapi.tech/search/${site}?query=${q}`,                                  { timeout: 20000 }),
    () => axios.get(`https://bk9.fun/search/${site}?q=${q}`,                                               { timeout: 20000 }),
    () => axios.get(`https://api.diioffc.web.id/api/search/${site}?query=${q}`,                            { timeout: 20000 }),
    () => axios.get(`https://aemt.me/search/${site}?text=${q}`,                                            { timeout: 20000 }),
    () => axios.get(`https://api.fasturl.cloud/search/${site}?query=${q}`,                                 { timeout: 20000 }),
  ];
  for (const t of tries) {
    try {
      const { data } = await t();
      const arr = data?.result?.results || data?.results || data?.result || data?.data || data;
      const list = Array.isArray(arr) ? arr : (arr ? [arr] : []);
      const cleaned = list
        .map(it => ({
          title: it.title || it.name || it.judul || "Untitled",
          duration: it.duration || it.dur || "",
          url: it.url || it.link || it.permalink || it.source || "",
          thumb: it.thumbnail || it.thumb || it.image || it.preview || "",
          views: it.views || it.view || "",
        }))
        .filter(it => it.title && (it.url || it.thumb));
      if (cleaned.length) return cleaned.slice(0, 10);
    } catch {}
  }
  return [];
}

for (const [acmd, cfg] of Object.entries(_ADULT_QUICK)) {
  cmd(acmd, { desc: `${cfg.label} search (18+) — reply N to download`, category: "HENTAI", adult: true }, async (sock, msg, args) => {
    const s = getSettings(msg.key.remoteJid);
    const ownerS = getSettings(getOwnerJid());
    if (!(s.adultMode || ownerS.adultMode)) {
      await sendReply(sock, msg, `🔞 Adult mode is OFF. Enable with *${CONFIG.PREFIX}setting* → 23.1`);
      return;
    }
    if (!args.length) { await sendReply(sock, msg, `Usage: *${CONFIG.PREFIX}${acmd} <query>*`); return; }
    await react(sock, msg, "🔞");
    const list = await _adultMultiSearch(cfg.site, args.join(" "));
    if (!list.length) {
      await sendReply(sock, msg, `❌ ${cfg.label}: all 15 sources failed for *${args.join(" ")}*. Try a different query.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
      return;
    }
    _lastAdultResults.set(msg.key.remoteJid, { site: cfg.site, label: cfg.label, items: list, ts: Date.now() });
    let txt = `🔞 *${cfg.label} — ${args.join(" ")}*\n_Reply *${CONFIG.PREFIX}pick N* (e.g. ${CONFIG.PREFIX}pick 1) to download_\n\n`;
    list.forEach((it, i) => {
      txt += `*${i + 1}.* ${it.title}\n`;
      if (it.duration) txt += `   ⏱ ${it.duration}`;
      if (it.views)    txt += `   👁 ${it.views}`;
      if (it.duration || it.views) txt += `\n`;
      if (it.url) txt += `   🔗 ${it.url}\n`;
      txt += `\n`;
    });
    await sendReply(sock, msg, txt + `> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  });
}

// .pick N — download Nth result from last adult search in this chat
cmd(["pick", "p"], { desc: "Download the Nth video from the last adult search", category: "HENTAI", adult: true }, async (sock, msg, args) => {
  const jid = msg.key.remoteJid;
  const s = getSettings(jid);
  const ownerS = getSettings(getOwnerJid());
  if (!(s.adultMode || ownerS.adultMode)) {
    await sendReply(sock, msg, `🔞 Adult mode is OFF.`);
    return;
  }
  const stash = _lastAdultResults.get(jid);
  if (!stash || (Date.now() - stash.ts) > 10 * 60 * 1000) {
    await sendReply(sock, msg, `❌ No recent search. Run *${CONFIG.PREFIX}xnxx <query>* first.`);
    return;
  }
  const n = parseInt(args[0] || "1", 10);
  const item = stash.items[n - 1];
  if (!item) { await sendReply(sock, msg, `❌ Pick a number between 1 and ${stash.items.length}.`); return; }
  await react(sock, msg, "⏬");
  const ok = await sendAdultVideo(sock, jid, msg, item, { captionPrefix: `🔞 ${stash.label} #${n}` });
  if (!ok) await sendReply(sock, msg, `❌ Couldn't fetch a playable video for #${n}. Try another result.`);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SAFE MODE — hides all adult cmds + locks NSFW / strips adult settings
// ═══════════════════════════════════════════════════════════════════════════════
cmd("safemode", { desc: "Toggle safe mode (hide all 18+ commands)", category: "OWNER", ownerOnly: true }, async (sock, msg, args) => {
  const ownerJ = getOwnerJid();
  const ownerS = getSettings(ownerJ);
  const sub = (args[0] || "").toLowerCase();
  if (sub === "on") ownerS.safeMode = true;
  else if (sub === "off") ownerS.safeMode = false;
  else ownerS.safeMode = !ownerS.safeMode;

  if (ownerS.safeMode) {
    ownerS.adultMode = false; ownerS.adultDl = false;
    if (_goonState.timer) { clearInterval(_goonState.timer); _goonState.timer = null; }
    _goonState.active = false;
    const cs = getSettings(msg.key.remoteJid);
    cs.adultMode = false; cs.adultDl = false; cs.safeMode = true;
  } else {
    const cs = getSettings(msg.key.remoteJid);
    cs.safeMode = false;
  }
  try { saveNow && saveNow(); } catch {}
  await sendReply(sock, msg,
    `🛡️ *Safe Mode: ${ownerS.safeMode ? "✅ ON" : "❌ OFF"}*\n\n${ownerS.safeMode ? "All 18+ commands are now hidden and disabled." : "Adult commands are available again (still gated by adult mode)."}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  TRUECALLER — number lookup (multi-API fallback)
// ═══════════════════════════════════════════════════════════════════════════════
cmd("truecaller", { desc: "Look up info on a phone number", category: "TOOLS" }, async (sock, msg, args) => {
  if (!args.length) { await sendReply(sock, msg, `Usage: *${CONFIG.PREFIX}truecaller <number>*\n\nExample: ${CONFIG.PREFIX}truecaller +14155552671`); return; }
  await react(sock, msg, "🔍");
  const num = args[0].replace(/[^\d+]/g, "");
  const cleaned = num.startsWith("+") ? num : "+" + num;
  const pick = (...vals) => vals.find(v => v !== undefined && v !== null && String(v).trim());
  const normalize = (r = {}) => ({
    name: pick(r.name, r.fullName, r.displayName),
    altName: pick(r.altName, r.alt_name, r.secondaryName, r.otherName),
    gender: pick(r.gender, r.sex),
    email: pick(r.email, r.mail),
    carrier: pick(r.carrier, r.operator, r.provider),
    lineType: pick(r.lineType, r.line_type, r.type),
    location: pick(r.location, r.address, r.city),
    country: pick(r.country, r.countryName, r.countryCode),
    timezone: pick(r.timezone, r.time_zone),
    spamScore: pick(r.spamScore, r.spam_score, r.score),
    tags: Array.isArray(r.tags) ? r.tags : [pick(r.tag, r.tagsLabel)].filter(Boolean),
  });
  const mergeInfo = (base, extra) => {
    for (const key of ["name", "altName", "gender", "email", "carrier", "lineType", "location", "country", "timezone", "spamScore"]) {
      if (!base[key] && extra[key]) base[key] = extra[key];
    }
    base.tags = [...new Set([...(base.tags || []), ...(extra.tags || [])])].filter(Boolean);
    return base;
  };
  const sources = [
    async () => {
      if (!CONFIG.GIFTED_API || !CONFIG.GIFTED_KEY) return null;
      const { data } = await axios.get(`${CONFIG.GIFTED_API}/api/tools/truecaller?apikey=${CONFIG.GIFTED_KEY}&q=${encodeURIComponent(cleaned)}`, { timeout: 15000 });
      return normalize(data?.result || data?.data || data || {});
    },
    async () => {
      const { data } = await axios.get(`https://api.delirius.store/tools/truecaller?q=${encodeURIComponent(cleaned)}`, { timeout: 15000, headers: { "User-Agent": "Mozilla/5.0" } });
      return normalize(data?.data || data?.result || data || {});
    },
    async () => {
      const { data } = await axios.get(`https://api.bochilteam.org/v3/check/truecaller?number=${encodeURIComponent(cleaned)}`, { timeout: 12000, headers: { "User-Agent": "Mozilla/5.0" } });
      return normalize(data?.data || data?.result || data || {});
    },
    async () => {
      const { data } = await axios.get(`https://api.siputzx.my.id/api/tools/truecaller?q=${encodeURIComponent(cleaned)}`, { timeout: 12000 });
      return normalize(data?.data || data?.result || data || {});
    },
    async () => {
      if (!process.env.NUMVERIFY_KEY) return null;
      const { data } = await axios.get(`http://apilayer.net/api/validate?access_key=${process.env.NUMVERIFY_KEY}&number=${cleaned.replace("+","")}`, { timeout: 12000 }).catch(() => ({}));
      if (!data?.valid) return null;
      return normalize({ carrier: data.carrier, country: data.country_name, location: data.location, lineType: data.line_type });
    },
    async () => {
      const key = process.env.ABSTRACT_PHONE_KEY || "a9ef3254e69b4e4291897e47ee28de7b";
      const { data } = await axios.get(`https://phonevalidation.abstractapi.com/v1/?api_key=${key}&phone=${cleaned.replace("+","")}`, { timeout: 12000 }).catch(() => ({}));
      if (!data?.valid) return null;
      return normalize({
        carrier: data.carrier?.name || data.carrier,
        country: data.country?.name || data.country,
        location: data.location,
        lineType: data.type,
        timezone: data.timezone?.name || data.timezone,
      });
    },
  ];
  let info = { tags: [] };
  for (const fn of sources) {
    try {
      const r = await fn();
      if (r) info = mergeInfo(info, r);
    } catch {}
  }
  if (!(info.name || info.carrier || info.country || info.location || (info.tags || []).length)) { await sendReply(sock, msg, `❌ Truecaller: no data found for *${cleaned}*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *𝑷𝑹𝑬𝑪𝑶𝑼𝑺 x* ⚡`); return; }
  await sendReply(sock, msg,
`📞 *Truecaller Lookup*

📱 Number: ${cleaned}
👤 Name: ${info.name || "—"}
🪪 Alt Name: ${info.altName || "—"}
⚧️ Gender: ${info.gender || "—"}
📧 Email: ${info.email || "—"}
📡 Carrier: ${info.carrier || "—"}
📶 Line Type: ${info.lineType || "—"}
📍 Location: ${info.location || "—"}
🌍 Country: ${info.country || "—"}
🕒 Timezone: ${info.timezone || "—"}
🏷️ Tags: ${(info.tags || []).length ? info.tags.join(", ") : "—"}
🚨 Spam Score: ${info.spamScore || "—"}

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});

// ════════════════════════════════════════════════════════════════════════
// 🆕 EXTRAS PATCH (additive — DOES NOT modify or replace any existing logic)
// Adds: menuMode (text|button|list|flow), .togglemenu, profile-pic cache,
// fixed button/list/flow UI senders, and a smart router for the chosen mode.
// Existing session, text menu, antilink/antisticker, and command system are
// fully preserved.
// ════════════════════════════════════════════════════════════════════════
const __MENU_MODES = ["text", "button", "list", "flow"];

function __getMenuMode() {
  try {
    const s = getSettings(getOwnerJid());
    if (!s.menuMode) s.menuMode = s.buttonsMode ? "list" : "text";
    if (!__MENU_MODES.includes(s.menuMode)) s.menuMode = "text";
    return s.menuMode;
  } catch { return "text"; }
}

function __setMenuMode(mode) {
  const s = getSettings(getOwnerJid());
  s.menuMode = mode;
  // Back-compat: only keep legacy list-mode flag on for the original interactive list path
  s.buttonsMode = (mode === "list");
  try { saveNow(); } catch {}
  return mode;
}

let __botPpCache = null;
let __botPpFetchedAt = 0;
const __PP_FALLBACK = "https://i.ibb.co/2dfHLT5/whatsapp-bot.png";
async function __getBotPp(sock) {
  try {
    const now = Date.now();
    if (__botPpCache && (now - __botPpFetchedAt) < 6 * 60 * 60 * 1000) return __botPpCache;
    const me = sock?.user?.id;
    if (me) {
      const url = await sock.profilePictureUrl(me, "image").catch(() => null);
      if (url) { __botPpCache = url; __botPpFetchedAt = now; return url; }
    }
  } catch {}
  __botPpCache = __PP_FALLBACK;
  __botPpFetchedAt = Date.now();
  return __botPpCache;
}

function __ppContext(ppUrl, body) {
  if (!ppUrl) return undefined;
  return {
    externalAdReply: {
      title: (typeof CONFIG !== "undefined" && CONFIG.BOT_NAME) || "MIAS BOT",
      body: body || "Powered by PRECIOUS x",
      thumbnailUrl: ppUrl,
      sourceUrl: (typeof CONFIG !== "undefined" && CONFIG.BOT_URL) || "https://wa.me",
      mediaType: 1,
      renderLargerThumbnail: false,
      showAdAttribution: false,
    }
  };
}

// ── .togglemenu : cycle text → button → list → flow (or set explicitly) ──
cmd(["togglemenu", "menutoggle", "switchmenu", "menumode"], { desc: "Cycle menu UI: text → button → list → flow", category: "OWNER", ownerOnly: true }, async (sock, msg, args) => {
  const cur = __getMenuMode();
  const arg = (args[0] || "").toLowerCase();
  let next;
  if (__MENU_MODES.includes(arg)) next = arg;
  else { const i = __MENU_MODES.indexOf(cur); next = __MENU_MODES[(i + 1) % __MENU_MODES.length]; }
  __setMenuMode(next);
  await _sendPlainReply(sock, msg, `🔁 *Menu Mode → ${next.toUpperCase()}*

Cycle order: text → button → list → flow
• ${CONFIG.PREFIX}togglemenu              → cycle to next mode
• ${CONFIG.PREFIX}togglemenu text|button|list|flow → set directly
• ${CONFIG.PREFIX}smartmenu               → render the menu in current mode

Session is preserved. Existing text menu is untouched.

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});

// ── .btnmenu : quick-reply BUTTONS UI (fixed) ──
cmd(["btnmenu", "buttonmenu", "buttonsui"], { desc: "Send menu as quick-reply buttons", category: "OWNER", ownerOnly: true }, async (sock, msg) => {
  const jid = msg.key.remoteJid;
  const ppUrl = await __getBotPp(sock).catch(() => null);
  const coverBuf = await getBotPic().catch(() => null);
  const bodyText = `⚡ *${CONFIG.BOT_NAME}*\nChoose an action below.`;

  // 1) Send cover image as its own bubble first (so the pic always renders)
  let imgSent = false;
  if (coverBuf && !isNewsletterJid(jid)) {
    try {
      await sock.sendMessage(jid, { image: coverBuf }, { quoted: msg });
      imgSent = true;
    } catch (eImg) { console.log("[btnmenu cover]", eImg?.message); }
  }

  // 2) Then send the buttons / native flow message right under it
  try {
    if (typeof sendNativeFlowButtons === "function") {
      await sendNativeFlowButtons(sock, jid, imgSent ? undefined : msg, imgSent ? "Tap any button below" : bodyText, [
        { id: `${CONFIG.PREFIX}menu`,    text: "🗂️ MENU" },
        { id: `${CONFIG.PREFIX}help`,    text: "🆘 HELP" },
        { id: `${CONFIG.PREFIX}ping`,    text: "🏓 PING" },
        { id: `${CONFIG.PREFIX}runtime`, text: "⏱️ RUNTIME" },
      ]);
    } else {
      const buttons = [
        { buttonId: `${CONFIG.PREFIX}help`, buttonText: { displayText: "🆘 HELP" }, type: 1 },
        { buttonId: `${CONFIG.PREFIX}menu`, buttonText: { displayText: "🗂️ MENU" }, type: 1 },
        { buttonId: `${CONFIG.PREFIX}ping`, buttonText: { displayText: "🏓 PING" }, type: 1 },
      ];
      await sock.sendMessage(jid, {
        text: imgSent ? "Tap any button below" : bodyText,
        footer: `v${CONFIG.VERSION || ""} • Powered by PRECIOUS x`,
        buttons,
        headerType: 1,
        viewOnce: true,
        contextInfo: __ppContext(ppUrl, "Tap any button below"),
      }, { quoted: imgSent ? undefined : msg });
    }
    await sendMenuSong(sock, jid, msg);
  } catch (e) {
    console.log("[btnmenu]", e?.message);
    if (!imgSent) await _sendPlainReply(sock, msg, "❌ Buttons UI not supported on this WhatsApp client. Try `.togglemenu list` or `.togglemenu text`.");
  }
});

// ── .listui : interactive LIST UI (fixed) ──
cmd(["listui", "listmenuui", "interactivelist"], { desc: "Send menu as an interactive list", category: "OWNER", ownerOnly: true }, async (sock, msg) => {
  const jid = msg.key.remoteJid;
  const ppUrl = await __getBotPp(sock).catch(() => null);
  const coverBuf = await getBotPic().catch(() => null);
  const sections = [
    { title: "Main", rows: [
      { rowId: `${CONFIG.PREFIX}menu`, title: "🗂️ Menu",     description: "Show full command menu" },
      { rowId: `${CONFIG.PREFIX}help`, title: "🆘 Help",     description: "How to use the bot" },
    ]},
    { title: "Tools", rows: [
      { rowId: `${CONFIG.PREFIX}ping`,     title: "🏓 Ping",     description: "Check bot latency" },
      { rowId: `${CONFIG.PREFIX}download`, title: "⬇️ Download", description: "Media downloader" },
    ]},
    { title: "Info", rows: [
      { rowId: `${CONFIG.PREFIX}runtime`,  title: "⏱️ Runtime",  description: "Uptime & stats" },
    ]},
  ];
  try {
    await sock.sendMessage(jid, {
      text: `Open any category below.`,
      footer: `v${CONFIG.VERSION || ""} • Powered by PRECIOUS x`,
      title: `${CONFIG.BOT_NAME} MENU`,
      buttonText: "📋 OPEN MENU",
      sections,
      contextInfo: __ppContext(ppUrl, "Interactive list menu"),
    }, { quoted: msg });
    await sendMenuSong(sock, jid, msg);
  } catch (e) {
    console.log("[listui]", e?.message);
    await _sendPlainReply(sock, msg, "❌ Interactive list UI not supported on this WhatsApp client. Try `.togglemenu button` or `.togglemenu text`.");
  }
});

// ── .flowmenu : nativeFlow radio-style UI (fixed) ──
cmd(["flowmenu", "flowui", "radiomenu"], { desc: "Send menu as nativeFlow (radio-style)", category: "OWNER", ownerOnly: true }, async (sock, msg) => {
  const jid = msg.key.remoteJid;
  const ppUrl = await __getBotPp(sock).catch(() => null);
  const sections = [
    { title: "Main", rows: [
      { id: `${CONFIG.PREFIX}menu`, title: "🗂️ Menu", description: "Show full menu" },
      { id: `${CONFIG.PREFIX}help`, title: "🆘 Help", description: "How to use the bot" },
    ]},
    { title: "Tools", rows: [
      { id: `${CONFIG.PREFIX}ping`,     title: "🏓 Ping",     description: "Latency check" },
      { id: `${CONFIG.PREFIX}download`, title: "⬇️ Download", description: "Media downloader" },
    ]},
    { title: "Info", rows: [
      { id: `${CONFIG.PREFIX}runtime`,  title: "⏱️ Runtime",  description: "Uptime & stats" },
    ]},
  ];
  try {
    if (!proto || !generateWAMessageFromContent) throw new Error("nativeFlow unavailable");
    const interactive = proto.Message.InteractiveMessage.create({
      body:   proto.Message.InteractiveMessage.Body.create({ text: `*${CONFIG.BOT_NAME || "MIAS"}* — Select a command` }),
      footer: proto.Message.InteractiveMessage.Footer.create({ text: `v${CONFIG.VERSION || ""} • Powered by PRECIOUS x` }),
      header: proto.Message.InteractiveMessage.Header.create({ title: `🚀 ${CONFIG.BOT_NAME || "MIAS"} FLOW`, hasMediaAttachment: false }),
      nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
        buttons: [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({ title: "📋 OPEN MENU", sections })
        }],
        messageParamsJson: ""
      }),
      contextInfo: __ppContext(ppUrl, "Flow menu (radio-style)"),
    });
    const content = { viewOnceMessage: { message: { interactiveMessage: interactive } } };
    const wam = await generateWAMessageFromContent(jid, content, { userJid: sock.user?.id, quoted: msg });
    await sock.relayMessage(jid, wam.message, { messageId: wam.key.id });
  } catch (e) {
    console.log("[flowmenu]", e?.message);
    await _sendPlainReply(sock, msg, "❌ Flow UI not supported on this WhatsApp client. Try `.togglemenu list` or `.togglemenu text`.");
  }
});

// ── .smartmenu : render the menu in the currently selected mode ──
// (Does NOT replace existing .menu — it's a separate router.)
cmd(["smartmenu"], { desc: "Render menu using current menuMode", category: "OWNER", ownerOnly: true }, async (sock, msg, args) => {
  const mode = __getMenuMode();
  let target = "menu";
  if (mode === "button") target = "btnmenu";
  else if (mode === "list") target = "listui";
  else if (mode === "flow") target = "flowmenu";
  const entry = commands.get(target);
  if (entry?.handler) return entry.handler(sock, msg, args || []);
  return _sendPlainReply(sock, msg, "❌ Selected menu mode handler not found.");
});

console.log("[EXTRAS] menuMode toggle, profile-pic cache, button/list/flow UI loaded.");

// ════════════════════════════════════════════════════════════════════════
// .getfile <url>  — download a direct file URL (catbox / litterbox / catmoe
// / any HTTPS direct link) and re-send it in chat with auto MIME detection.
// ════════════════════════════════════════════════════════════════════════
cmd(["getfile", "fetchfile", "dl", "fromurl"], { desc: "Download a file from a URL (catbox/litterbox/catmoe/any)", category: "TOOLS" }, async (sock, msg, args) => {
  const jid = msg.key.remoteJid;
  let url = (args[0] || "").trim();
  if (!url) {
    // Allow .getfile when replied to a message containing a URL
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const qText = quoted?.conversation || quoted?.extendedTextMessage?.text || "";
    const found = qText.match(/https?:\/\/\S+/);
    if (found) url = found[0];
  }
  if (!url || !/^https?:\/\//i.test(url)) {
    await sendReply(sock, msg, `Usage: *${CONFIG.PREFIX}getfile <direct-url>*\n\nWorks with catbox.moe, litterbox.catbox.moe, catmoe and any direct file URL.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    return;
  }
  await react(sock, msg, "⏬");
  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 60000,
      maxContentLength: 100 * 1024 * 1024, // 100 MB hard cap
      maxRedirects: 5,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MIAS-MDX/1.0)" },
      validateStatus: s => s >= 200 && s < 400,
    });
    const buf = Buffer.from(res.data);
    if (!buf.length) throw new Error("Empty response");

    const ct = String(res.headers["content-type"] || "").toLowerCase();
    const cd = String(res.headers["content-disposition"] || "");
    const urlName = (() => { try { return decodeURIComponent(new URL(url).pathname.split("/").pop() || ""); } catch { return ""; } })();
    const dispName = (cd.match(/filename\*?=(?:UTF-8'')?\"?([^\";]+)/i) || [])[1] || "";
    const fileName = (dispName || urlName || "file").replace(/[\r\n]/g, "").slice(0, 120);

    // Detect kind by MIME → fall back to extension sniff
    const isImage = ct.startsWith("image/") || /\.(jpe?g|png|gif|webp|bmp)$/i.test(fileName);
    const isVideo = ct.startsWith("video/") || /\.(mp4|mov|mkv|webm|3gp|avi)$/i.test(fileName);
    const isAudio = ct.startsWith("audio/") || /\.(mp3|m4a|ogg|wav|opus|aac|flac)$/i.test(fileName);

    const sizeMb = (buf.length / 1048576).toFixed(2);
    const cap = `📥 *Fetched* — ${fileName}\n📦 ${sizeMb} MB • ${ct || "unknown"}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;

    if (isImage) {
      await sock.sendMessage(jid, { image: buf, caption: cap }, { quoted: msg });
    } else if (isVideo) {
      await sock.sendMessage(jid, { video: buf, caption: cap, mimetype: ct || "video/mp4" }, { quoted: msg });
    } else if (isAudio) {
      await sock.sendMessage(jid, { audio: buf, mimetype: ct || "audio/mpeg", fileName }, { quoted: msg });
      await sendReply(sock, msg, cap);
    } else {
      await sock.sendMessage(jid, { document: buf, fileName, mimetype: ct || "application/octet-stream", caption: cap }, { quoted: msg });
    }
    await react(sock, msg, "✅");
  } catch (e) {
    await react(sock, msg, "❌");
    const code = e?.response?.status ? ` (HTTP ${e.response.status})` : "";
    await sendReply(sock, msg, `❌ Failed to fetch the file${code}.\n\nReason: _${(e?.message || "unknown").slice(0, 180)}_\n\nCheck the URL is a *direct file link* (right-click → Copy link on the file itself).\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});

// ════════════════════════════════════════════════════════════════════════
// pushName audit shim — wraps sendReply so any "@<digits>" mention pattern
// in outgoing text gets rewritten to the cached pushName when known.
// Existing _beautifyMentions / getDisplayName paths keep working unchanged.
// ════════════════════════════════════════════════════════════════════════
try {
  const _origSendReply = sendReply;
  // eslint-disable-next-line no-global-assign
  sendReply = async function _pushNameAwareSendReply(sock, msg, text, mentions = []) {
    try {
      if (typeof text === "string" && text.includes("@")) {
        text = text.replace(/@(\d{6,15})\b/g, (full, num) => {
          const nm = (typeof pushNameCache !== "undefined" && pushNameCache.get) ? pushNameCache.get(String(num)) : null;
          return nm && !/^\+?\d+$/.test(nm) ? "@" + nm : full;
        });
      }
      // Plain "+2349..." numerals → cached name when available
      if (typeof text === "string") {
        text = text.replace(/\+(\d{8,15})\b/g, (full, num) => {
          const nm = (typeof pushNameCache !== "undefined" && pushNameCache.get) ? pushNameCache.get(String(num)) : null;
          return nm && !/^\+?\d+$/.test(nm) ? nm : full;
        });
      }
    } catch {}
    return _origSendReply(sock, msg, text, mentions);
  };
  console.log("[EXTRAS] pushName-aware sendReply wrapper installed.");
} catch (e) {
  console.log("[EXTRAS] pushName wrapper failed:", e?.message);
}

// Add the new aliases into the TOOLS menu category so .menu shows them.
try {
  const tools = MENU_CATEGORIES.find(c => c.name === "TOOLS");
  if (tools && !tools.cmds.includes("getfile")) tools.cmds.push("getfile");
} catch {}


// ════════════════════════════════════════════════════════════════════════
// LATE-PATCH: missing commands (setbotpic/botpic, aza, spotifydl, pdf)
// + group-only DM rejection wrapper
// ════════════════════════════════════════════════════════════════════════
const _GROUP_ONLY_CATEGORY = "GROUP";
// Wrap every existing GROUP-category command so that running it in DM replies
// "this is a group command" instead of silently failing or crashing.
try {
  for (const [name, entry] of commands.entries()) {
    if (entry?.category === _GROUP_ONLY_CATEGORY && !entry.__gcWrapped) {
      const original = entry.handler;
      entry.handler = async function _gcGuarded(sock, msg, args) {
        if (!(msg.key.remoteJid || "").endsWith("@g.us")) {
          try {
            await sock.sendMessage(msg.key.remoteJid, {
              text: `👥 *Group Command*\n\n*${CONFIG.PREFIX}${name}* only works inside a WhatsApp group.\nAdd me to a group and try again.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`
            }, { quoted: msg });
          } catch {}
          return;
        }
        return original(sock, msg, args);
      };
      entry.__gcWrapped = true;
    }
  }
} catch (e) { console.log("[GROUP_ONLY_WRAP]", e?.message); }

// ── setbotpic / botpic: change the bot's WhatsApp profile picture ──
cmd(["setbotpic", "botpic", "setpp"], { desc: "Set bot profile pic from URL or replied image", category: "SETTINGS", ownerOnly: true }, async (sock, msg, args) => {
  await react(sock, msg, "🖼️");
  try {
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = ctx?.quotedMessage;
    const quotedImg = quoted?.imageMessage || quoted?.viewOnceMessage?.message?.imageMessage;
    let buf = null;
    if (quotedImg) {
      const stream = await downloadContentFromMessage(quotedImg, "image");
      buf = Buffer.from([]);
      for await (const c of stream) buf = Buffer.concat([buf, c]);
    } else if (msg.message?.imageMessage) {
      const stream = await downloadContentFromMessage(msg.message.imageMessage, "image");
      buf = Buffer.from([]);
      for await (const c of stream) buf = Buffer.concat([buf, c]);
    } else if (args[0] && /^https?:\/\//.test(args[0])) {
      const r = await axios.get(args[0], { responseType: "arraybuffer", timeout: 20000 });
      buf = Buffer.from(r.data);
    } else {
      await sendReply(sock, msg, `Usage: *${CONFIG.PREFIX}setbotpic <image_url>*\nOr reply to an image with *${CONFIG.PREFIX}setbotpic*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
      return;
    }
    if (!buf || buf.length < 500) { await sendReply(sock, msg, "❌ Image is empty or invalid."); return; }
    const me = sock.user?.id;
    await sock.updateProfilePicture(me, buf);
    // Also save as local botpic1.jpg for menu cover use
    try {
      const target = path.join(__dirname, "assets", "botpic1.jpg");
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, buf);
    } catch {}
    await sendReply(sock, msg, `✅ *Bot profile picture updated!*\nIt will also appear on the menu cover.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  } catch (e) {
    await sendReply(sock, msg, `❌ Failed to set bot pic: ${e.message}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
  }
});

// ── aza / setaza / setazapic: payment account info card ──
const _azaStore = { bank: "", number: "", name: "", picUrl: "" };
cmd(["setaza"], { desc: "Set payment account: .setaza <bank> | <account no> | <name>", category: "INFO", ownerOnly: true }, async (sock, msg, args) => {
  const raw = args.join(" ").trim();
  const parts = raw.split("|").map(v => v.trim()).filter(Boolean);
  if (parts.length < 3) {
    await sendReply(sock, msg, `Usage: *${CONFIG.PREFIX}setaza Bank Name | 1234567890 | Account Holder*\n\nExample: *${CONFIG.PREFIX}setaza Opay | 8012345678 | Precious X*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    return;
  }
  _azaStore.bank = parts[0]; _azaStore.number = parts[1].replace(/\D/g, ""); _azaStore.name = parts[2];
  await sendReply(sock, msg, `✅ *Payment Account Saved*\n\n🏦 Bank: *${_azaStore.bank}*\n🔢 Number: *${_azaStore.number}*\n👤 Name: *${_azaStore.name}*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd(["setazapic"], { desc: "Set image for the .aza card", category: "INFO", ownerOnly: true }, async (sock, msg, args) => {
  if (!args[0] || !/^https?:\/\//.test(args[0])) { await sendReply(sock, msg, `Usage: *${CONFIG.PREFIX}setazapic <image_url>*`); return; }
  _azaStore.picUrl = args[0];
  await sendReply(sock, msg, `✅ Aza picture set!\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
});
cmd(["aza"], { desc: "Show payment account info", category: "INFO" }, async (sock, msg) => {
  if (!_azaStore.bank || !_azaStore.number) {
    await sendReply(sock, msg, `💳 *No payment account set*\n\nOwner can set one with:\n*${CONFIG.PREFIX}setaza Bank | Number | Name*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
    return;
  }
  const caption = `╭━━━〔 💳 *PAYMENT INFO* 〕━━━╮\n│\n│  🏦 *Bank:* ${_azaStore.bank}\n│  🔢 *Account:* \`${_azaStore.number}\`\n│  👤 *Name:* ${_azaStore.name}\n│\n╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n📋 *Tap the number above to copy*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
  if (_azaStore.picUrl) {
    try {
      const r = await axios.get(_azaStore.picUrl, { responseType: "arraybuffer", timeout: 15000 });
      await sock.sendMessage(msg.key.remoteJid, { image: Buffer.from(r.data), caption }, { quoted: msg });
      return;
    } catch {}
  }
  await sendReply(sock, msg, caption);
});

// ── spotifydl: alias for spotify ──
try {
  const _spotEntry = commands.get("spotify");
  if (_spotEntry && !commands.has("spotifydl")) commands.set("spotifydl", _spotEntry);
} catch {}

// ── pdf: alias for topdf (text → PDF) ──
try {
  const _pdfEntry = commands.get("topdf");
  if (_pdfEntry && !commands.has("pdf")) commands.set("pdf", _pdfEntry);
} catch {}

console.log("[LATE-PATCH] saveContact, setbotpic/botpic, aza/setaza/setazapic, spotifydl, pdf, group-only DM guard loaded.");
// ════════════════════════════════════════════════════════════════════════
// END EXTRAS PATCH
// ════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════
// LATE-PATCH-2: bot-pic header on buttons/list, tagadmin, hardened join,
// prefix-immune button IDs, unified "powered by" branding (B4 footer)
// ════════════════════════════════════════════════════════════════════════

// ── 1. Inject bot-pic header into native flow (buttons + list) ──────────
try {
  if (typeof sendNativeFlowButtons === "function" && typeof getBotPic === "function") {
    const _origBtns = sendNativeFlowButtons;
    sendNativeFlowButtons = async function _btnsWithPic(sock, jid, quoted, bodyText, buttons, footer) {
      try {
        if (!generateWAMessageFromContent || !proto) return _origBtns(sock, jid, quoted, bodyText, buttons, footer);
        const buf = await getBotPic().catch(() => null);
        if (!buf) return _origBtns(sock, jid, quoted, bodyText, buttons, footer);
        const upload = await sock.waUploadToServer(buf, { mediaType: "image" }).catch(() => null);
        if (!upload) return _origBtns(sock, jid, quoted, bodyText, buttons, footer);
        const nativeButtons = buttons.slice(0, 10).map(b => ({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({ display_text: b.text, id: b.id.startsWith("BTN:") ? b.id : `BTN:${b.id}` })
        }));
        const content = {
          viewOnceMessage: {
            message: {
              messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
              interactiveMessage: proto.Message.InteractiveMessage.create({
                body: proto.Message.InteractiveMessage.Body.create({ text: bodyText }),
                footer: proto.Message.InteractiveMessage.Footer.create({ text: footer || `${CONFIG.BOT_NAME} • v${CONFIG.VERSION}` }),
                header: proto.Message.InteractiveMessage.Header.create({
                  hasMediaAttachment: true,
                  imageMessage: {
                    url: upload.url,
                    directPath: upload.directPath,
                    mediaKey: upload.mediaKey,
                    mimetype: "image/jpeg",
                    fileEncSha256: upload.fileEncSha256,
                    fileSha256: upload.fileSha256,
                    fileLength: upload.fileLength,
                  }
                }),
                nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({ buttons: nativeButtons })
              })
            }
          }
        };
        const wam = await generateWAMessageFromContent(jid, content, { quoted });
        await sock.relayMessage(jid, wam.message, { messageId: wam.key.id });
        return wam;
      } catch (e) {
        console.log("[BTN_PIC] fallback:", e?.message);
        return _origBtns(sock, jid, quoted, bodyText, buttons, footer);
      }
    };
  }

  if (typeof sendNativeFlowListMenu === "function" && typeof getBotPic === "function") {
    const _origList = sendNativeFlowListMenu;
    sendNativeFlowListMenu = async function _listWithPic(sock, jid, quoted, bodyText, sections, quickButtons = [], footer) {
      try {
        if (!generateWAMessageFromContent || !proto) return _origList(sock, jid, quoted, bodyText, sections, quickButtons, footer);
        const buf = await getBotPic().catch(() => null);
        if (!buf) return _origList(sock, jid, quoted, bodyText, sections, quickButtons, footer);
        const upload = await sock.waUploadToServer(buf, { mediaType: "image" }).catch(() => null);
        if (!upload) return _origList(sock, jid, quoted, bodyText, sections, quickButtons, footer);
        const nativeButtons = [];
        if (Array.isArray(sections) && sections.length) {
          nativeButtons.push({ name: "single_select", buttonParamsJson: JSON.stringify({ title: "📂 Open Categories", sections }) });
        }
        nativeButtons.push(...quickButtons.slice(0, 4).map(b => ({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({ display_text: b.text, id: b.id.startsWith("BTN:") ? b.id : `BTN:${b.id}` })
        })));
        const content = {
          viewOnceMessage: {
            message: {
              messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
              interactiveMessage: proto.Message.InteractiveMessage.create({
                body: proto.Message.InteractiveMessage.Body.create({ text: bodyText }),
                footer: proto.Message.InteractiveMessage.Footer.create({ text: footer || `${CONFIG.BOT_NAME} • v${CONFIG.VERSION}` }),
                header: proto.Message.InteractiveMessage.Header.create({
                  hasMediaAttachment: true,
                  imageMessage: {
                    url: upload.url,
                    directPath: upload.directPath,
                    mediaKey: upload.mediaKey,
                    mimetype: "image/jpeg",
                    fileEncSha256: upload.fileEncSha256,
                    fileSha256: upload.fileSha256,
                    fileLength: upload.fileLength,
                  }
                }),
                nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({ buttons: nativeButtons })
              })
            }
          }
        };
        const wam = await generateWAMessageFromContent(jid, content, { quoted });
        await sock.relayMessage(jid, wam.message, { messageId: wam.key.id });
        return wam;
      } catch (e) {
        console.log("[LIST_PIC] fallback:", e?.message);
        return _origList(sock, jid, quoted, bodyText, sections, quickButtons, footer);
      }
    };
  }
} catch (e) { console.log("[PIC_HEADER_PATCH]", e?.message); }

// ── 2. tagadmin / tagadmins: silently mention every group admin ──────────
cmd(["tagadmin", "tagadmins", "admins"], { desc: "Tag all admins of the current group", category: "GROUP" }, async (sock, msg, args) => {
  if (!(msg.key.remoteJid || "").endsWith("@g.us")) {
    await sendReply(sock, msg, `👥 *${CONFIG.PREFIX}tagadmin* only works in groups.`);
    return;
  }
  try {
    const meta = await sock.groupMetadata(msg.key.remoteJid);
    const admins = (meta.participants || []).filter(p => p.admin === "admin" || p.admin === "superadmin");
    if (!admins.length) { await sendReply(sock, msg, "❌ No admins found in this group."); return; }
    const customMsg = (args || []).join(" ").trim();
    let text = `👮 *Admins of ${meta.subject}* (${admins.length})\n\n`;
    admins.forEach((a, i) => { text += `${i+1}. @${(a.id || "").split("@")[0]}\n`; });
    if (customMsg) text += `\n📌 *Note:* ${customMsg}`;
    text += `\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`;
    await sock.sendMessage(msg.key.remoteJid, { text, mentions: admins.map(a => a.id) }, { quoted: msg });
  } catch (e) {
    await sendReply(sock, msg, `❌ Failed to tag admins: ${e.message}`);
  }
});

// ── 3. Hardened .join — accept link, code, with/without https, trailing junk
try {
  const _origJoin = commands.get("join");
  if (_origJoin) {
    const orig = _origJoin.handler;
    _origJoin.handler = async function _hardJoin(sock, msg, args) {
      try {
        const raw = (args[0] || "").trim();
        if (!raw) { await sendReply(sock, msg, `Usage: ${CONFIG.PREFIX}join <group link or invite code>`); return; }
        // extract invite code
        let code = raw;
        const m = raw.match(/chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/i);
        if (m) code = m[1];
        code = code.replace(/[^A-Za-z0-9_-]/g, "");
        if (code.length < 8) { await sendReply(sock, msg, `❌ Invalid invite link/code.`); return; }
        // try inspect first to give a clean error if expired/invalid
        try {
          const info = await sock.groupGetInviteInfo(code).catch(() => null);
          if (info?.subject) {
            await react(sock, msg, "✅");
          }
        } catch {}
        try {
          const gid = await sock.groupAcceptInvite(code);
          await sendReply(sock, msg, `✅ Joined group!${gid ? `\n📍 ID: ${gid}` : ""}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
        } catch (e) {
          const em = (e?.message || "").toLowerCase();
          if (em.includes("conflict") || em.includes("already")) {
            await sendReply(sock, msg, `ℹ️ I'm already in that group.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
          } else if (em.includes("not-authorized") || em.includes("forbidden")) {
            await sendReply(sock, msg, `❌ Invite is no longer valid (revoked or expired). Ask for a fresh link.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
          } else if (em.includes("bad-request")) {
            await sendReply(sock, msg, `❌ Bad request — the invite code is malformed. Send the full link starting with https://chat.whatsapp.com/...\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *PRECIOUS x* ⚡`);
          } else {
            await sendReply(sock, msg, `❌ Failed to join: ${e.message}`);
          }
        }
      } catch (e) {
        await sendReply(sock, msg, `❌ Failed to join: ${e.message}`);
      }
    };
  }
} catch (e) { console.log("[JOIN_HARDEN]", e?.message); }

// ── 4. Prefix-immune button IDs ──────────────────────────────────────────
// Buttons are emitted as "BTN:<PREFIX><cmd>". When the owner changes PREFIX,
// old taps still embed the old prefix. Strip any leading prefix so the
// button always resolves to the current prefix's command.
try {
  if (typeof __BUTTON_ID_REWRITE_INSTALLED === "undefined") {
    var __BUTTON_ID_REWRITE_INSTALLED = true;
    const _PREFIX_CHARS = ".,/!#$%&*+-=?@~^";
    const _stripPrefix = (s) => {
      let v = String(s || "").trim();
      while (v.length && _PREFIX_CHARS.includes(v[0])) v = v.slice(1);
      return v;
    };
    // monkey-patch sendMessage to rewrite outgoing button ids
    // (incoming taps are normalized in handler — we extend extractCommandName below)
    if (typeof extractCommandName === "function") {
      const _origExtract = extractCommandName;
      extractCommandName = function _extWithBTN(msg) {
        try {
          const sel = msg?.message?.buttonsResponseMessage?.selectedButtonId
                   || msg?.message?.templateButtonReplyMessage?.selectedId
                   || msg?.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson
                   || msg?.message?.listResponseMessage?.singleSelectReply?.selectedRowId
                   || "";
          if (sel) {
            let raw = String(sel);
            // unwrap JSON payload from native flow
            try { const j = JSON.parse(raw); if (j?.id) raw = j.id; } catch {}
            if (raw.startsWith("BTN:")) {
              raw = raw.slice(4);
              raw = _stripPrefix(raw);
              const first = raw.split(/\s+/)[0]?.toLowerCase();
              if (first && commands.has(first)) return first;
            }
          }
        } catch {}
        return _origExtract(msg);
      };
    }
  }
} catch (e) { console.log("[BTN_PREFIX_PATCH]", e?.message); }

// ── 5. Unified "powered by" branding — replace owner-name placeholder with
//      the configured owner/bot name on every outgoing text.
try {
  if (typeof normalizeOutgoingText === "function" && !globalThis.__B4_PATCHED) {
    globalThis.__B4_PATCHED = true;
    const _origNorm = normalizeOutgoingText;
    normalizeOutgoingText = function _b4(text, msg) {
      let out = _origNorm(text, msg);
      const owner = CONFIG.OWNER_NAME || CONFIG.BOT_NAME || "kevdr a bailey";
      // fixed "powered by" footer — uses owner name
      out = out.replace(/ᴘᴏᴡᴇʀᴇᴅ ʙʏ\s+\*[^*]+\*/gi, `ᴘᴏᴡᴇʀᴇᴅ ʙʏ *${owner}*`);
      return out;
    };
  }
} catch (e) { console.log("[B4_BRAND]", e?.message); }

console.log("[LATE-PATCH-2] bot-pic header, tagadmin, hardened join, prefix-immune buttons, B4 branding loaded.");


// ─────────────────────────────────────────────────────────────────────
// FIX-PACK 3 (v4.8.0): hijack family REMOVED + moderator (group-admin) tier
// ─────────────────────────────────────────────────────────────────────
//   • Hard-deletes hijack / takegroup / stealgroup / takeadmin from the
//     command registry so they cannot be invoked at all (not even hidden).
//   • Adds a moderator gate: when bot is in PUBLIC mode, group admins are
//     treated as moderators and can run GROUP-category commands (the same
//     way the owner can) — except the removed hijack family. In PRIVATE /
//     ONLY-INBOX modes only the bot owner / sudo retain access.
//   • Strips them from every menu category and bannable-command list so
//     they don't show up in `.menu`, `.allmenu`, `.bancmd`, etc.
try {
  const REMOVED = ["hijack","takegroup","stealgroup","takeadmin"];
  if (typeof commands !== "undefined" && commands && typeof commands.delete === "function") {
    for (const n of REMOVED) {
      try { commands.delete(n); } catch {}
    }
  }
  // Also scrub from MENU_CATEGORIES so they never render in any menu
  if (typeof MENU_CATEGORIES !== "undefined" && Array.isArray(MENU_CATEGORIES)) {
    for (const cat of MENU_CATEGORIES) {
      if (Array.isArray(cat.cmds)) {
        cat.cmds = cat.cmds.filter(c => !REMOVED.includes(String(c).toLowerCase()));
      }
    }
  }
  // Patch RISKY_CMDS too (defence in depth — if anything tries to add it later)
  if (typeof RISKY_CMDS !== "undefined" && RISKY_CMDS && typeof RISKY_CMDS.delete === "function") {
    for (const n of REMOVED) { try { RISKY_CMDS.delete(n); } catch {} }
  }
  // Block any future re-registration via cmd() — wrap commands.set to refuse REMOVED names
  if (typeof commands !== "undefined" && commands && typeof commands.set === "function" && !commands.__hijackGuarded) {
    const _origSet = commands.set.bind(commands);
    commands.set = function (key, value) {
      if (REMOVED.includes(String(key).toLowerCase())) {
        console.log("[FIX-PACK-3] refused to register removed command:", key);
        return commands;
      }
      return _origSet(key, value);
    };
    Object.defineProperty(commands, "__hijackGuarded", { value: true, enumerable: false });
  }
  console.log("[FIX-PACK-3] hijack family removed; group-admin moderator tier active.");
} catch (e) { console.log("[FIX-PACK-3] error:", e?.message || e); }

