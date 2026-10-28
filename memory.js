// Faber 客户端持续记忆：分类存储（preference 用户偏好/反感 | solution 有效方案 |
// rule 用户准则 | mistake AI 易错点）。本机 JSON 存储，按内容哈希与服务器双向同步。
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const CATEGORIES = ['preference', 'solution', 'rule', 'mistake'];

function hashOf(category, content) {
  return crypto.createHash('md5').update(category + '|' + content.trim().toLowerCase()).digest('hex');
}

function globalFile(userData) { return path.join(userData, 'faber-memory-global.json'); }
function projectFile(dir) { return path.join(dir, '.faber', 'memory.json'); }

function readFile(f) {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return { items: [] }; }
}
function writeFile(f, data) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  data.items = data.items.slice(-300); // 上限 300 条
  fs.writeFileSync(f, JSON.stringify(data, null, 1));
}

function addItem(f, scope, projectKey, category, content) {
  category = String(category || '').trim();
  content = String(content || '').trim().slice(0, 500);
  if (!CATEGORIES.includes(category) || !content) return false;
  const data = readFile(f);
  const hash = hashOf(category, content);
  if (data.items.some((i) => i.hash === hash && !i.deleted)) return false; // 去重
  data.items.push({ hash, scope, projectKey: projectKey || null, category, content, uses: 0, at: new Date().toISOString(), deleted: false });
  writeFile(f, data);
  return true;
}

function listAll(userData, dir) {
  const g = readFile(globalFile(userData)).items.filter((i) => !i.deleted).map((i) => ({ ...i, scope: 'global' }));
  const p = dir ? readFile(projectFile(dir)).items.filter((i) => !i.deleted).map((i) => ({ ...i, scope: 'project' })) : [];
  return { global: g, project: p };
}

function deleteItem(userData, dir, hash) {
  let hit = false;
  for (const f of [globalFile(userData), ...(dir ? [projectFile(dir)] : [])]) {
    const data = readFile(f);
    const it = data.items.find((i) => i.hash === hash);
    if (it) { it.deleted = true; writeFile(f, data); hit = true; }
  }
  return hit;
}

// 供 agent 提示注入：rule/preference 全局，mistake/solution 项目+全局合并，各分类封顶
function forPrompt(userData, dir) {
  const { global: g, project: p } = listAll(userData, dir);
  const by = (c, cap) => {
    const items = [...g.filter((i) => i.category === c), ...p.filter((i) => i.category === c)];
    return items.slice(-cap);
  };
  return {
    rule: by('rule', 20),
    preference: by('preference', 20),
    mistake: by('mistake', 15),
    solution: by('solution', 15),
  };
}

function promptText(mem) {
  const lines = [];
  if (mem.rule.length) lines.push('### 用户准则（必须遵守）\n' + mem.rule.map((i) => '- ' + i.content).join('\n'));
  if (mem.preference.length) lines.push('### 用户偏好与反感（不要踩）\n' + mem.preference.map((i) => '- ' + i.content).join('\n'));
  if (mem.mistake.length) lines.push('### AI 曾犯过的错（不要重复）\n' + mem.mistake.map((i) => '- ' + i.content).join('\n'));
  if (mem.solution.length) lines.push('### 已验证有效的方案（优先复用）\n' + mem.solution.map((i) => '- ' + i.content).join('\n'));
  return lines.length ? '\n## 关于这位用户的持续记忆\n' + lines.join('\n\n') : '';
}

// 与服务器双向同步：上传本地全部（含 deleted 墓碑），合并服务器最新到本地
async function syncWithServer(userData, dir, token, apiBase = 'https://faber.echo-ai.chat') {
  const g = readFile(globalFile(userData)).items.map((i) => ({ ...i, scope: 'global', projectKey: null }));
  const p = dir ? readFile(projectFile(dir)).items.map((i) => ({ ...i, scope: 'project' })) : [];
  const items = [...g, ...p].map((i) => ({
    hash: i.hash, scope: i.scope, projectKey: i.projectKey, category: i.category,
    content: i.content, deleted: !!i.deleted, at: i.at,
  }));
  const res = await fetch(`${apiBase}/api/memory/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ items }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`sync ${res.status}`);
  const server = await res.json();
  // 合并：服务器有而本地没有的 → 落地
  let added = 0;
  const localHashes = new Set([
    ...readFile(globalFile(userData)).items.map((i) => i.hash),
    ...(dir ? readFile(projectFile(dir)).items.map((i) => i.hash) : []),
  ]);
  for (const it of server.items || []) {
    if (localHashes.has(it.hash)) continue;
    const f = it.scope === 'global' ? globalFile(userData) : projectFile(dir);
    if (!dir && it.scope === 'project') continue;
    const data = readFile(f);
    data.items.push({ hash: it.hash, scope: it.scope, projectKey: it.projectKey, category: it.category, content: it.content, uses: 0, at: it.at, deleted: !!it.deleted });
    writeFile(f, data);
    added++;
  }
  return { uploaded: items.length, added };
}

function _g(userData) { return globalFile(userData); }
function _p(dir) { return projectFile(dir); }
module.exports = { CATEGORIES, addItem, listAll, deleteItem, forPrompt, promptText, syncWithServer, hashOf, _g, _p };
