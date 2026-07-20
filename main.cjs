var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// electron/main.ts
var import_electron = require("electron");
var import_node_fs8 = __toESM(require("node:fs"), 1);
var import_node_http = __toESM(require("node:http"), 1);
var import_node_path5 = __toESM(require("node:path"), 1);

// server/middleware.ts
var import_node_child_process = require("node:child_process");
var import_node_fs7 = __toESM(require("node:fs"), 1);
var import_node_path4 = __toESM(require("node:path"), 1);

// shared/api.ts
var API = {
  roots: "/api/roots",
  files: "/api/files",
  file: "/api/file",
  raw: "/api/raw",
  store: "/api/store",
  open: "/api/open",
  tasks: "/api/tasks",
  hq: "/api/hq"
};

// shared/hq.ts
var HQ_STORE_NAMES = [
  "tasks",
  "timeline",
  "decisions",
  "experiments",
  "projects",
  "content"
];
function isHQStoreName(x) {
  return typeof x === "string" && HQ_STORE_NAMES.includes(x);
}
var isRef = (x) => typeof x === "object" && x !== null && typeof x.kind === "string" && typeof x.value === "string" && (x.label === void 0 || typeof x.label === "string");
function isHQBlock(x) {
  if (typeof x !== "object" || x === null) return false;
  const b = x;
  return typeof b.id === "string" && b.id.length > 0 && typeof b.kind === "string" && typeof b.title === "string" && typeof b.created === "string" && typeof b.updated === "string" && (b.status === void 0 || typeof b.status === "string") && (b.notes === void 0 || typeof b.notes === "string") && (b.refs === void 0 || Array.isArray(b.refs) && b.refs.every(isRef));
}
function blockProblem(x) {
  if (typeof x !== "object" || x === null) return "not an object";
  const b = x;
  if (typeof b.id !== "string" || b.id.length === 0) return "missing id";
  if (typeof b.kind !== "string") return "missing kind";
  if (typeof b.title !== "string") return "missing title";
  if (typeof b.created !== "string") return "missing created";
  if (typeof b.updated !== "string") return "missing updated";
  if (b.status !== void 0 && typeof b.status !== "string") return "status is not a string";
  if (b.notes !== void 0 && typeof b.notes !== "string") return "notes is not a string";
  if (b.refs !== void 0 && !(Array.isArray(b.refs) && b.refs.every(isRef)))
    return "refs is not Ref[]";
  return "invalid block";
}
function parseHQJsonl(text) {
  const blocks = [];
  const errors = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (isHQBlock(parsed)) blocks.push(parsed);
      else errors.push({ line: i + 1, reason: blockProblem(parsed) });
    } catch (e) {
      errors.push({ line: i + 1, reason: `invalid JSON: ${e.message}` });
    }
  }
  return { blocks, errors };
}
function serializeHQJsonl(blocks) {
  return blocks.map((b) => JSON.stringify(b)).join("\n") + (blocks.length > 0 ? "\n" : "");
}
function newBlock(input) {
  const t = (/* @__PURE__ */ new Date()).toISOString();
  const { title, kind = "block", status, notes, refs, ...extras } = input;
  return {
    // Extras first: identity and provenance always win over caller input.
    ...extras,
    id: crypto.randomUUID(),
    kind,
    title: title.trim(),
    ...status !== void 0 ? { status } : {},
    ...notes !== void 0 ? { notes } : {},
    ...refs !== void 0 ? { refs } : {},
    created: t,
    updated: t
  };
}
var PROTECTED = /* @__PURE__ */ new Set(["id", "kind", "created", "updated"]);
function patchBlock(blocks, id, patch) {
  const sets = {};
  const dels = [];
  for (const [k, v] of Object.entries(patch)) {
    if (PROTECTED.has(k)) continue;
    if (v === void 0 || v === null) dels.push(k);
    else sets[k] = v;
  }
  if (Object.keys(sets).length === 0 && dels.length === 0) return [...blocks];
  const now2 = (/* @__PURE__ */ new Date()).toISOString();
  return blocks.map((b) => {
    if (b.id !== id) return b;
    const next = { ...b, ...sets };
    for (const k of dels) delete next[k];
    return { ...next, updated: now2 };
  });
}
function removeBlock(blocks, id) {
  return blocks.filter((b) => b.id !== id);
}

// shared/tasks.ts
var EMPTY_TASKS = { version: 1, tasks: [] };
var now = () => (/* @__PURE__ */ new Date()).toISOString();
function addTask(data, title) {
  const trimmed = title.trim();
  if (!trimmed) return data;
  const t = now();
  const task = { id: crypto.randomUUID(), title: trimmed, status: "todo", created: t, updated: t };
  return { ...data, tasks: [task, ...data.tasks] };
}
var patchTask = (data, id, patch) => ({
  ...data,
  tasks: data.tasks.map((t) => t.id === id ? { ...t, ...patch, updated: now() } : t)
});
function setStatus(data, id, status) {
  return patchTask(data, id, { status });
}
function editTask(data, id, patch) {
  return patchTask(data, id, patch);
}
function removeTask(data, id) {
  return { ...data, tasks: data.tasks.filter((t) => t.id !== id) };
}

// server/config.ts
var import_node_fs = __toESM(require("node:fs"), 1);
var import_node_os = __toESM(require("node:os"), 1);
var import_node_path = __toESM(require("node:path"), 1);
var ROOTS_CONFIG_FILE = ".novakai-docs-roots.json";
function defaultRoots(appDir2) {
  const candidates = [import_node_path.default.resolve(appDir2, ".."), import_node_path.default.join(import_node_os.default.homedir(), "Programming")];
  const unique = [...new Set(candidates)];
  return unique.filter((p) => {
    try {
      return import_node_fs.default.statSync(p).isDirectory();
    } catch {
      return false;
    }
  });
}
function loadRoots(configFile, defaults) {
  try {
    const j = JSON.parse(import_node_fs.default.readFileSync(configFile, "utf-8"));
    if (Array.isArray(j.roots)) {
      const roots = j.roots.filter((r) => typeof r === "string");
      if (roots.length > 0) return roots;
    }
  } catch {
  }
  return [...defaults];
}
function saveRoots(configFile, roots) {
  import_node_fs.default.writeFileSync(configFile, JSON.stringify({ roots }, null, 2));
}
function expandHome(p) {
  return p.replace(/^~(?=$|\/)/, import_node_os.default.homedir());
}

// server/dedup.ts
function dedupFiles(raw, hashFor) {
  const groups = /* @__PURE__ */ new Map();
  for (const f of raw) {
    const h = hashFor(f);
    const key = h || `nohash:${f.abs}`;
    const g = groups.get(key);
    if (g) g.push(f);
    else groups.set(key, [f]);
  }
  const entries = [];
  for (const g of groups.values()) {
    g.sort((a, b) => b.mtime - a.mtime);
    const primary = g[0];
    entries.push({
      id: `${primary.root}::${primary.rel}`,
      root: primary.root,
      path: primary.rel,
      name: primary.rel.split("/").pop() ?? primary.rel,
      mtime: primary.mtime,
      size: primary.size,
      copies: g.map((f) => ({ root: f.root, path: f.rel, mtime: f.mtime }))
    });
  }
  entries.sort((a, b) => b.mtime - a.mtime);
  return entries;
}

// server/hashing.ts
var import_node_crypto = __toESM(require("node:crypto"), 1);
var import_node_fs2 = __toESM(require("node:fs"), 1);
function createHashCache() {
  const cache = /* @__PURE__ */ new Map();
  const hashFor = (f) => {
    const hit = cache.get(f.abs);
    if (hit && hit.mtime === f.mtime && hit.size === f.size) return hit.hash;
    let hash = "";
    try {
      hash = import_node_crypto.default.createHash("sha256").update(import_node_fs2.default.readFileSync(f.abs)).digest("hex").slice(0, 16);
    } catch {
    }
    cache.set(f.abs, { mtime: f.mtime, size: f.size, hash });
    return hash;
  };
  return { hashFor, size: () => cache.size };
}

// server/hqFile.ts
var import_node_fs3 = __toESM(require("node:fs"), 1);
var import_node_path2 = __toESM(require("node:path"), 1);
var HQ_DIR = "data";
var hqStoreFile = (dir, store) => import_node_path2.default.join(dir, `${store}.jsonl`);
function loadHQStore(dir, store) {
  const file = hqStoreFile(dir, store);
  let text = "";
  try {
    text = import_node_fs3.default.readFileSync(file, "utf-8");
  } catch {
  }
  const { blocks, errors } = parseHQJsonl(text);
  return { store, blocks, errors, generatedAt: Date.now() };
}
function saveHQStore(dir, store, blocks) {
  const file = hqStoreFile(dir, store);
  const tmp = `${file}.tmp`;
  import_node_fs3.default.writeFileSync(tmp, serializeHQJsonl(blocks));
  import_node_fs3.default.renameSync(tmp, file);
}

// server/scanner.ts
var import_node_fs4 = __toESM(require("node:fs"), 1);
var import_node_path3 = __toESM(require("node:path"), 1);
var SKIP_DIRS = /* @__PURE__ */ new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".cache",
  ".turbo",
  "coverage",
  "target",
  ".venv",
  "venv",
  "__pycache__"
]);
var MD_RE = /\.(md|markdown|mdown|txt)$/i;
var MAX_DEPTH = 8;
var MAX_FILES = 8e3;
function scanRoot(root, out, opts = {}) {
  const skip = opts.skipDirs ?? SKIP_DIRS;
  const maxDepth = opts.maxDepth ?? MAX_DEPTH;
  const maxFiles = opts.maxFiles ?? MAX_FILES;
  const appDir2 = opts.appDir ?? null;
  try {
    if (!import_node_fs4.default.statSync(root).isDirectory()) return { error: "not a directory" };
  } catch {
    return { error: "folder does not exist" };
  }
  const walk = (dir, depth) => {
    if (depth > maxDepth || out.length >= maxFiles) return;
    let entries;
    try {
      entries = import_node_fs4.default.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (out.length >= maxFiles) return;
      if (skip.has(e.name) || e.name === ".DS_Store") continue;
      const full = import_node_path3.default.join(dir, e.name);
      if (appDir2 && full === appDir2) continue;
      if (e.isDirectory()) {
        walk(full, depth + 1);
      } else if (MD_RE.test(e.name)) {
        try {
          const st = import_node_fs4.default.statSync(full);
          out.push({
            root,
            abs: full,
            rel: import_node_path3.default.relative(root, full).split(import_node_path3.default.sep).join("/"),
            mtime: st.mtimeMs,
            size: st.size
          });
        } catch {
        }
      }
    }
  };
  walk(root, 1);
  return { error: null };
}

// server/storeFile.ts
var import_node_fs5 = __toESM(require("node:fs"), 1);

// shared/store.ts
var MAX_RECENTS = 12;
var EMPTY_STORE = { favorites: [], recents: [] };

// server/storeFile.ts
var STORE_FILE = ".novakai-docs-store.json";
var isRef2 = (x) => typeof x === "object" && x !== null && typeof x.root === "string" && typeof x.path === "string";
var isHQLayout = (x) => {
  if (typeof x !== "object" || x === null) return false;
  const l = x;
  if (l.inspectorWidth !== void 0 && typeof l.inspectorWidth !== "number") return false;
  if (l.inspectorOpen !== void 0 && typeof l.inspectorOpen !== "boolean") return false;
  if (l.boardColumnWidths !== void 0) {
    if (typeof l.boardColumnWidths !== "object" || l.boardColumnWidths === null) return false;
    if (!Object.values(l.boardColumnWidths).every((w) => typeof w === "number")) return false;
  }
  return true;
};
function isStoreData(x) {
  if (typeof x !== "object" || x === null) return false;
  const d = x;
  return Array.isArray(d.favorites) && Array.isArray(d.recents) && d.favorites.every(isRef2) && d.recents.every(isRef2) && (d.hqLayout === void 0 || isHQLayout(d.hqLayout));
}
function loadStore(file) {
  try {
    const j = JSON.parse(import_node_fs5.default.readFileSync(file, "utf-8"));
    if (isStoreData(j)) {
      return {
        favorites: j.favorites,
        recents: j.recents.slice(0, MAX_RECENTS),
        ...j.hqLayout ? { hqLayout: j.hqLayout } : {}
      };
    }
  } catch {
  }
  return { ...EMPTY_STORE, favorites: [], recents: [] };
}
function saveStore(file, data) {
  import_node_fs5.default.writeFileSync(file, JSON.stringify(data, null, 2));
}

// server/tasksFile.ts
var import_node_fs6 = __toESM(require("node:fs"), 1);
var TASKS_FILE = "tasks.json";
var isTask = (x) => {
  if (typeof x !== "object" || x === null) return false;
  const t = x;
  return typeof t.id === "string" && typeof t.title === "string" && (t.status === "todo" || t.status === "done") && typeof t.created === "string" && typeof t.updated === "string" && (t.notes === void 0 || typeof t.notes === "string");
};
function isTasksData(x) {
  if (typeof x !== "object" || x === null) return false;
  const d = x;
  return d.version === 1 && Array.isArray(d.tasks) && d.tasks.every(isTask);
}
function loadTasks(file) {
  try {
    const j = JSON.parse(import_node_fs6.default.readFileSync(file, "utf-8"));
    if (isTasksData(j)) return j;
  } catch {
  }
  return { ...EMPTY_TASKS, tasks: [] };
}
function saveTasks(file, data) {
  import_node_fs6.default.writeFileSync(file, JSON.stringify(data, null, 2));
}

// server/middleware.ts
var MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".avif": "image/avif"
};
function sendJson(res, code, data) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}
function sendError(res, code, error) {
  sendJson(res, code, { error });
}
function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (c) => body += c);
    req.on("end", () => resolve(body));
    req.on("error", () => resolve(""));
  });
}
function revealInOs(abs) {
  if (process.platform === "darwin") {
    (0, import_node_child_process.spawn)("open", ["-R", abs], { detached: true, stdio: "ignore" }).unref();
    return null;
  }
  if (process.platform === "win32") {
    (0, import_node_child_process.spawn)("explorer", [`/select,${abs}`], { detached: true, stdio: "ignore" }).unref();
    return null;
  }
  if (process.platform === "linux") {
    (0, import_node_child_process.spawn)("xdg-open", [import_node_path4.default.dirname(abs)], { detached: true, stdio: "ignore" }).unref();
    return null;
  }
  return `unsupported platform: ${process.platform}`;
}
function createMdApiMiddleware(deps) {
  const configFile = import_node_path4.default.join(deps.appDir, ROOTS_CONFIG_FILE);
  const storeFile = import_node_path4.default.join(deps.appDir, STORE_FILE);
  const hqDir = import_node_path4.default.join(deps.appDir, HQ_DIR);
  let roots = deps.roots ?? loadRoots(configFile, defaultRoots(deps.appDir));
  const hashCache = createHashCache();
  const rootInfo = () => roots.map((r) => ({ path: r, name: import_node_path4.default.basename(r) || r }));
  const sendRoots = (res) => sendJson(res, 200, { roots: rootInfo() });
  const safeResolve = (root, rel) => {
    if (!root || !rel || !roots.includes(root)) return null;
    const abs = import_node_path4.default.resolve(root, rel);
    if (abs !== root && !abs.startsWith(root + import_node_path4.default.sep)) return null;
    return abs;
  };
  const buildIndex = () => {
    const raw = [];
    const statuses = [];
    for (const r of roots) {
      const before = raw.length;
      const { error } = scanRoot(r, raw, { appDir: deps.appDir });
      statuses.push({
        path: r,
        name: import_node_path4.default.basename(r) || r,
        fileCount: raw.length - before,
        error
      });
    }
    return {
      files: dedupFiles(raw, hashCache.hashFor),
      roots: statuses,
      total: raw.length,
      truncated: raw.length >= 8e3,
      generatedAt: Date.now()
    };
  };
  return function mdApiMiddleware(req, res, next) {
    const url = new URL(req.url || "/", "http://localhost");
    const pathname = url.pathname;
    if (pathname === API.roots && req.method === "GET") {
      sendRoots(res);
      return;
    }
    if (pathname === API.roots && req.method === "POST") {
      void readBody(req).then((body) => {
        try {
          const { path: p } = JSON.parse(body || "{}");
          if (typeof p !== "string" || !p.trim()) {
            sendError(res, 400, "missing path");
            return;
          }
          const abs = import_node_path4.default.resolve(expandHome(p.trim()));
          if (!import_node_fs7.default.existsSync(abs) || !import_node_fs7.default.statSync(abs).isDirectory()) {
            sendError(res, 400, `Not a folder: ${abs}`);
            return;
          }
          if (!roots.includes(abs)) {
            roots = [...roots, abs];
            saveRoots(configFile, roots);
          }
          sendRoots(res);
        } catch {
          sendError(res, 400, "bad request");
        }
      });
      return;
    }
    if (pathname === API.roots && req.method === "DELETE") {
      const p = url.searchParams.get("path") || "";
      roots = roots.filter((r) => r !== p);
      saveRoots(configFile, roots);
      sendRoots(res);
      return;
    }
    if (pathname === API.files && req.method === "GET") {
      try {
        sendJson(res, 200, buildIndex());
      } catch (err) {
        sendError(res, 500, String(err));
      }
      return;
    }
    if (pathname === API.file && req.method === "GET") {
      const abs = safeResolve(url.searchParams.get("root") || "", url.searchParams.get("path") || "");
      if (!abs || !MD_RE.test(abs) || !import_node_fs7.default.existsSync(abs) || !import_node_fs7.default.statSync(abs).isFile()) {
        sendError(res, 400, "invalid path");
        return;
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end(import_node_fs7.default.readFileSync(abs, "utf-8"));
      return;
    }
    if (pathname === API.raw && req.method === "GET") {
      const abs = safeResolve(url.searchParams.get("root") || "", url.searchParams.get("path") || "");
      const mime = abs ? MIME[import_node_path4.default.extname(abs).toLowerCase()] : void 0;
      if (!abs || !mime || !import_node_fs7.default.existsSync(abs) || !import_node_fs7.default.statSync(abs).isFile()) {
        sendError(res, 404, "not found");
        return;
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", mime);
      res.setHeader("Cache-Control", "no-cache");
      import_node_fs7.default.createReadStream(abs).pipe(res);
      return;
    }
    if (pathname === API.store && req.method === "GET") {
      sendJson(res, 200, loadStore(storeFile));
      return;
    }
    if (pathname === API.store && req.method === "PUT") {
      void readBody(req).then((body) => {
        try {
          const data = JSON.parse(body || "{}");
          if (!isStoreData(data)) {
            sendError(res, 400, "expected { favorites: FileRef[], recents: FileRef[] }");
            return;
          }
          saveStore(storeFile, data);
          sendJson(res, 200, data);
        } catch {
          sendError(res, 400, "bad request");
        }
      });
      return;
    }
    const taskFile = () => {
      const root = url.searchParams.get("root") || "";
      return roots.includes(root) ? { root, file: import_node_path4.default.join(root, TASKS_FILE) } : null;
    };
    if (pathname === API.tasks && req.method === "GET") {
      const t = taskFile();
      if (!t) {
        sendError(res, 400, "unknown root");
        return;
      }
      sendJson(res, 200, loadTasks(t.file));
      return;
    }
    if (pathname === API.tasks && req.method === "POST") {
      void readBody(req).then((body) => {
        try {
          const t = taskFile();
          if (!t) {
            sendError(res, 400, "unknown root");
            return;
          }
          const { title } = JSON.parse(body || "{}");
          if (typeof title !== "string" || !title.trim()) {
            sendError(res, 400, "missing title");
            return;
          }
          const next2 = addTask(loadTasks(t.file), title);
          saveTasks(t.file, next2);
          sendJson(res, 200, next2);
        } catch {
          sendError(res, 400, "bad request");
        }
      });
      return;
    }
    if (pathname.startsWith(`${API.tasks}/`) && (req.method === "PATCH" || req.method === "DELETE")) {
      void readBody(req).then((body) => {
        try {
          const t = taskFile();
          if (!t) {
            sendError(res, 400, "unknown root");
            return;
          }
          const id = decodeURIComponent(pathname.slice(API.tasks.length + 1));
          const data = loadTasks(t.file);
          if (!data.tasks.some((task) => task.id === id)) {
            sendError(res, 404, "task not found");
            return;
          }
          let next2;
          if (req.method === "DELETE") {
            next2 = removeTask(data, id);
          } else {
            const patch = JSON.parse(body || "{}");
            next2 = data;
            if (patch.status === "todo" || patch.status === "done") next2 = setStatus(next2, id, patch.status);
            if (typeof patch.title === "string" && patch.title.trim())
              next2 = editTask(next2, id, { title: patch.title.trim() });
            if (typeof patch.notes === "string") next2 = editTask(next2, id, { notes: patch.notes });
            if (next2 === data) {
              sendError(res, 400, "nothing to patch");
              return;
            }
          }
          saveTasks(t.file, next2);
          sendJson(res, 200, next2);
        } catch {
          sendError(res, 400, "bad request");
        }
      });
      return;
    }
    const hqStore = () => {
      const s = url.searchParams.get("store") || "";
      return isHQStoreName(s) ? s : null;
    };
    if (pathname === API.hq && req.method === "GET") {
      const store = hqStore();
      if (!store) {
        sendError(res, 400, "unknown store");
        return;
      }
      try {
        sendJson(res, 200, loadHQStore(hqDir, store));
      } catch (err) {
        sendError(res, 500, String(err));
      }
      return;
    }
    if (pathname === API.hq && req.method === "POST") {
      void readBody(req).then((body) => {
        try {
          const store = hqStore();
          if (!store) {
            sendError(res, 400, "unknown store");
            return;
          }
          const input = JSON.parse(body || "{}");
          if (typeof input.title !== "string" || !input.title.trim()) {
            sendError(res, 400, "missing title");
            return;
          }
          const data = loadHQStore(hqDir, store);
          const created = newBlock({ ...input, title: input.title, kind: input.kind ?? store });
          saveHQStore(hqDir, store, [...data.blocks, created]);
          sendJson(res, 200, created);
        } catch {
          sendError(res, 400, "bad request");
        }
      });
      return;
    }
    if (pathname === `${API.hq}/reorder` && req.method === "POST") {
      void readBody(req).then((body) => {
        try {
          const store = hqStore();
          if (!store) {
            sendError(res, 400, "unknown store");
            return;
          }
          const { ids } = JSON.parse(body || "{}");
          if (!Array.isArray(ids) || !ids.every((i) => typeof i === "string")) {
            sendError(res, 400, "expected { ids: string[] }");
            return;
          }
          const data = loadHQStore(hqDir, store);
          const rank = new Map(ids.map((id, i) => [id, i]));
          const ordered = [...data.blocks].sort(
            (a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER)
          );
          saveHQStore(hqDir, store, ordered);
          sendJson(res, 200, { ...data, blocks: ordered, generatedAt: Date.now() });
        } catch {
          sendError(res, 400, "bad request");
        }
      });
      return;
    }
    if (pathname.startsWith(`${API.hq}/`) && (req.method === "PATCH" || req.method === "DELETE")) {
      void readBody(req).then((body) => {
        try {
          const store = hqStore();
          if (!store) {
            sendError(res, 400, "unknown store");
            return;
          }
          const id = decodeURIComponent(pathname.slice(API.hq.length + 1));
          const data = loadHQStore(hqDir, store);
          const existing = data.blocks.find((b) => b.id === id);
          if (!existing) {
            sendError(res, 404, "block not found");
            return;
          }
          if (req.method === "DELETE") {
            saveHQStore(hqDir, store, removeBlock(data.blocks, id));
            sendJson(res, 200, existing);
            return;
          }
          const patch = JSON.parse(body || "{}");
          const next2 = patchBlock(data.blocks, id, patch);
          if (next2.every((b, i) => b === data.blocks[i])) {
            sendError(res, 400, "nothing to patch");
            return;
          }
          saveHQStore(hqDir, store, next2);
          const updated = next2.find((b) => b.id === id);
          if (!updated) {
            sendError(res, 500, "patch lost the block");
            return;
          }
          sendJson(res, 200, updated);
        } catch {
          sendError(res, 400, "bad request");
        }
      });
      return;
    }
    if (pathname === API.open && req.method === "POST") {
      void readBody(req).then((body) => {
        try {
          const { root, path: rel } = JSON.parse(body || "{}");
          const abs = safeResolve(typeof root === "string" ? root : "", typeof rel === "string" ? rel : "");
          if (!abs || !import_node_fs7.default.existsSync(abs)) {
            sendError(res, 400, "invalid path");
            return;
          }
          const problem = revealInOs(abs);
          if (problem) sendError(res, 400, problem);
          else sendJson(res, 200, { ok: true });
        } catch {
          sendError(res, 400, "bad request");
        }
      });
      return;
    }
    next();
  };
}

// electron/main.ts
var APP_NAME = "Novakai HQ";
var isMac = process.platform === "darwin";
var DEFAULT_WIDTH = 1440;
var DEFAULT_HEIGHT = 900;
var MIN_WIDTH = 1024;
var MIN_HEIGHT = 700;
var MIME2 = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8"
};
var appDir = import_electron.app.getAppPath();
var distDir = import_node_path5.default.join(appDir, "dist");
var dataDir = import_electron.app.isPackaged ? import_electron.app.getPath("userData") : appDir;
function serveStatic(pathname, res) {
  const rel = pathname.replace(/^\/+/, "") || "index.html";
  const abs = import_node_path5.default.resolve(distDir, rel);
  const inside = abs === distDir || abs.startsWith(distDir + import_node_path5.default.sep);
  if (inside && import_node_fs8.default.existsSync(abs) && import_node_fs8.default.statSync(abs).isFile()) {
    res.statusCode = 200;
    res.setHeader("Content-Type", MIME2[import_node_path5.default.extname(abs).toLowerCase()] ?? "application/octet-stream");
    import_node_fs8.default.createReadStream(abs).pipe(res);
    return;
  }
  if (!import_node_path5.default.extname(rel) && import_node_fs8.default.existsSync(import_node_path5.default.join(distDir, "index.html"))) {
    res.statusCode = 200;
    res.setHeader("Content-Type", MIME2[".html"]);
    import_node_fs8.default.createReadStream(import_node_path5.default.join(distDir, "index.html")).pipe(res);
    return;
  }
  res.statusCode = 404;
  res.end("not found");
}
async function startServer() {
  const api = createMdApiMiddleware({ appDir: dataDir });
  const server = import_node_http.default.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (url.pathname.startsWith("/api/")) {
      api(req, res, () => {
        res.statusCode = 404;
        res.end("not found");
      });
      return;
    }
    serveStatic(url.pathname, res);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("loopback server has no port");
  import_electron.app.on("will-quit", () => server.close());
  return `http://127.0.0.1:${address.port}`;
}
async function resolveUrl() {
  const devUrl = process.env.NOVAKAI_HQ_DEV_URL;
  if (devUrl) {
    try {
      const res = await fetch(devUrl, { signal: AbortSignal.timeout(3e3) });
      if (res.ok) return devUrl;
    } catch {
    }
  }
  return startServer();
}
var boundsFile = () => import_node_path5.default.join(import_electron.app.getPath("userData"), "window-bounds.json");
function loadBounds() {
  try {
    const b = JSON.parse(import_node_fs8.default.readFileSync(boundsFile(), "utf-8"));
    const width = typeof b.width === "number" && b.width >= MIN_WIDTH ? b.width : DEFAULT_WIDTH;
    const height = typeof b.height === "number" && b.height >= MIN_HEIGHT ? b.height : DEFAULT_HEIGHT;
    if (typeof b.x === "number" && typeof b.y === "number") {
      const { x, y } = b;
      const visible = import_electron.screen.getAllDisplays().some(
        (d) => x >= d.workArea.x && y >= d.workArea.y && x < d.workArea.x + d.workArea.width && y < d.workArea.y + d.workArea.height
      );
      if (visible) return { x, y, width, height };
    }
    return { width, height };
  } catch {
    return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  }
}
function saveBounds(win) {
  if (win.isDestroyed() || win.isMinimized() || win.isFullScreen()) return;
  try {
    import_node_fs8.default.mkdirSync(import_electron.app.getPath("userData"), { recursive: true });
    import_node_fs8.default.writeFileSync(boundsFile(), JSON.stringify(win.getNormalBounds(), null, 2));
  } catch {
  }
}
var mainWindow = null;
var startUrl = null;
function createWindow() {
  if (!startUrl) return;
  const bounds = loadBounds();
  const win = new import_electron.BrowserWindow({
    ...bounds,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    backgroundColor: "#0b0b0d",
    title: APP_NAME,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow = win;
  win.on("close", () => saveBounds(win));
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });
  void win.loadURL(startUrl);
}
import_electron.app.setName(APP_NAME);
if (!import_electron.app.requestSingleInstanceLock()) {
  import_electron.app.quit();
} else {
  import_electron.app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });
  void import_electron.app.whenReady().then(async () => {
    startUrl = await resolveUrl();
    createWindow();
    import_electron.app.on("activate", () => {
      if (import_electron.BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  import_electron.app.on("window-all-closed", () => {
    if (!isMac) import_electron.app.quit();
  });
}
