// Faber 引擎扩展：语义索引（GLM embedding）+ MCP 最小 stdio 客户端
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const CODE_EXTS = new Set(['.js', '.jsx', '.ts', '.tsx', '.py', '.go', '.rs', '.java', '.kt', '.swift',
  '.c', '.h', '.cpp', '.hpp', '.cs', '.rb', '.php', '.vue', '.svelte', '.md', '.json', '.yaml', '.yml', '.sql', '.sh']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.cache', 'Library', 'Temp', 'Logs', 'obj', 'bin', '.gradle', '__pycache__', '.faber', '.sf']);
const MAX_FILE = 40_000;
const MAX_CHUNKS = 1500;

// ============ 语义索引 ============
function walkCode(dir, out = [], depth = 0) {
  if (depth > 6 || out.length > 400) return out;
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkCode(p, out, depth + 1);
    else if (CODE_EXTS.has(path.extname(e.name))) {
      try {
        const st = fs.statSync(p);
        if (st.size <= MAX_FILE) out.push(p);
      } catch {}
    }
    if (out.length > 400) break;
  }
  return out;
}

function chunkFile(p) {
  const rel = p;
  let lines = [];
  try { lines = fs.readFileSync(p, 'utf8').split('\n'); } catch { return []; }
  const chunks = [];
  const CH = 80, OV = 8;
  for (let i = 0; i < lines.length && chunks.length < 30; i += CH - OV) {
    const seg = lines.slice(i, i + CH).join('\n');
    if (seg.trim().length < 40) continue;
    chunks.push({ path: rel, start: i + 1, text: seg.slice(0, 6000) });
  }
  return chunks;
}

async function embedBatch(token, inputs) {
  const res = await fetch('https://faber.echo-ai.chat/api/agent/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ inputs }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`embed ${res.status}`);
  const j = await res.json();
  return j.vectors;
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

async function buildIndex(token, dir, userData, log = () => {}) {
  const files = walkCode(dir);
  const indexFile = path.join(userData, 'index-' + Buffer.from(dir).toString('base64url').slice(0, 20) + '.json');
  let chunks = [];
  for (const f of files) chunks.push(...chunkFile(f));
  chunks = chunks.slice(0, MAX_CHUNKS);
  if (!chunks.length) { fs.writeFileSync(indexFile, '{"chunks":[]}'); return 0; }
  log(`indexing ${chunks.length} chunks from ${files.length} files…`);
  let mode = 'vector';
  for (let i = 0; i < chunks.length; i += 8) {
    const batch = chunks.slice(i, i + 8);
    try {
      const vectors = await embedBatch(token, batch.map((c) => c.text.slice(0, 2000)));
      batch.forEach((c, k) => { c.vec = vectors[k]; });
    } catch (e) {
      if (i === 0) { mode = 'keyword'; log('embeddings unavailable, keyword mode'); }
      break; // 后续批次跳过嵌入
    }
  }
  const slim = chunks.map(({ vec, ...rest }) => ({ ...rest, vec }));
  fs.writeFileSync(indexFile, JSON.stringify({ builtAt: Date.now(), mode, chunks: slim }));
  return slim.length;
}

async function searchIndex(token, dir, userData, query, topK = 6) {
  const indexFile = path.join(userData, 'index-' + Buffer.from(dir).toString('base64url').slice(0, 20) + '.json');
  if (!fs.existsSync(indexFile)) await buildIndex(token, dir, userData);
  const idx = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
  if (!idx.chunks?.length) return [];
  if (idx.mode === 'keyword' || !idx.chunks[0].vec) {
    const terms = String(query).toLowerCase().split(/[^a-z0-9\u4e00-\u9fa5]+/).filter((w) => w.length > 1);
    return idx.chunks
      .map((c) => {
        const low = (c.path + ' ' + c.text).toLowerCase();
        const score = terms.reduce((s2, w) => s2 + (low.split(w).length - 1), 0) / (terms.length || 1);
        return { path: c.path, start: c.start, score, text: c.text };
      })
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
  const [qv] = await embedBatch(token, [query]);
  const scored = idx.chunks
    .map((c) => ({ ...c, score: cosine(qv, c.vec) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ vec, ...rest }) => ({ ...rest, vec: undefined }));
  return scored;
}

// 索引是否过期（任一源文件 mtime 晚于构建时间 → 重建）
function indexStale(dir, userData) {
  const indexFile = path.join(userData, 'index-' + Buffer.from(dir).toString('base64url').slice(0, 20) + '.json');
  if (!fs.existsSync(indexFile)) return true;
  try {
    const builtAt = JSON.parse(fs.readFileSync(indexFile, 'utf8')).builtAt || 0;
    for (const f of walkCode(dir).slice(0, 300)) {
      if (fs.statSync(f).mtimeMs > builtAt) return true;
    }
  } catch { return true; }
  return false;
}

// ============ MCP 最小 stdio 客户端 ============
class McpClient {
  constructor(name, cfg, log) {
    this.name = name; this.cfg = cfg; this.log = log; this.tools = []; this.nextId = 1; this.pending = new Map();
  }
  start() {
    return new Promise((resolve) => {
      const { command, args = [], env = {} } = this.cfg;
      this.proc = spawn(command, args, { env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
      let buf = '';
      this.proc.stdout.on('data', (d) => {
        buf += d.toString();
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i); buf = buf.slice(i + 1);
          try {
            const msg = JSON.parse(line);
            if (msg.id && this.pending.has(msg.id)) { this.pending.get(msg.id)(msg); this.pending.delete(msg.id); }
          } catch {}
        }
      });
      this.proc.stderr.on('data', (d) => this.log(`[mcp:${this.name}] ${d.toString().slice(0, 200)}`));
      this.proc.on('error', (e) => { this.log(`[mcp:${this.name}] spawn fail: ${e.message}`); resolve(false); });
      this.rpc('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'faber-desktop', version: '0.2.0' },
      }, 15000).then(async (init) => {
        if (!init) return resolve(false);
        this.notify('notifications/initialized');
        const tools = await this.rpc('tools/list', {}, 15000);
        this.tools = (tools?.result?.tools ?? []).map((t) => ({ name: t.name, description: t.description || '', schema: t.inputSchema }));
        this.log(`[mcp:${this.name}] ${this.tools.length} tools`);
        resolve(this.tools.length > 0);
      });
    });
  }
  rpc(method, params, timeoutMs = 30000) {
    const id = this.nextId++;
    return new Promise((resolve) => {
      const t = setTimeout(() => { this.pending.delete(id); resolve(null); }, timeoutMs);
      this.pending.set(id, (msg) => { clearTimeout(t); resolve(msg); });
      this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }
  notify(method, params) {
    try { this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n'); } catch {}
  }
  async callTool(toolName, args) {
    const msg = await this.rpc('tools/call', { name: toolName, arguments: args || {} }, 120000);
    if (!msg) return 'MCP 调用超时';
    if (msg.error) return `MCP 错误: ${JSON.stringify(msg.error).slice(0, 500)}`;
    const content = msg.result?.content ?? [];
    return content.map((c) => (c.type === 'text' ? c.text : `[${c.type}]`)).join('\n').slice(0, 20000) || '(空结果)';
  }
  stop() { try { this.proc?.kill(); } catch {} }
}

async function loadMcpServers(dir, userData, log) {
  const clients = [];
  const configs = [];
  for (const f of [path.join(userData, 'faber-mcp.json'), path.join(dir, '.faber', 'mcp.json')]) {
    try {
      const cfg = JSON.parse(fs.readFileSync(f, 'utf8'));
      for (const [name, c] of Object.entries(cfg.mcpServers ?? cfg)) configs.push([name, c]);
    } catch {}
  }
  for (const [name, cfg] of configs.slice(0, 4)) {
    const client = new McpClient(name, cfg, log);
    if (await client.start()) clients.push(client);
  }
  return clients;
}

module.exports = { buildIndex, searchIndex, indexStale, loadMcpServers, McpClient };
