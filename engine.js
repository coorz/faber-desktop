// Faber 本地引擎：在用户电脑上直接操作本地项目文件夹。
// 模型调用走云端 /api/agent/chat（计费），代码永远不出本地。
const fs = require('node:fs');
const path = require('node:path');
const { execFile, spawn } = require('node:child_process');
const os = require('node:os');
const memory = require('./memory.js');
const capabilities = require('./capabilities.js');

const API_BASE = 'https://faber.echo-ai.chat';
const MAX_STEPS = 24;

const PLATFORM = process.platform; // win32 | darwin | linux
const PLATFORM_NOTE = {
  win32: 'Platform: Windows. Shell is cmd/PowerShell: use \\.\\ or forward slashes accepted by tools, gradlew.bat instead of ./gradlew, where/dir instead of ls (though git-bash tools may exist). Env var: %VAR% or $env:VAR in PowerShell.',
  darwin: 'Platform: macOS (zsh/bash, Unix paths, Homebrew common). iOS builds possible if Xcode installed.',
  linux: 'Platform: Linux (bash, Unix paths, apt/yum/dnf for system packages).',
}[PLATFORM] || 'Platform: ' + PLATFORM;
const platKey = PLATFORM === 'win32' ? 'win' : PLATFORM === 'darwin' ? 'mac' : 'linux';
function pickCmd(manifest, key) {
  const over = manifest.platformOverrides?.[platKey] || {};
  return over[key] || manifest[key] || '';
}

// 权限分级：tier0 读（静默）；tier1 常规开发命令（自动，白名单）；tier2 高危（必须用户授权）
const SAFE_BINS = new Set(['node', 'npm', 'npx', 'yarn', 'pnpm', 'git', 'ls', 'cat', 'grep', 'rg', 'find', 'head', 'tail',
  'wc', 'diff', 'mkdir', 'touch', 'sed', 'echo', 'tar', 'unzip', 'zip', 'true',
  'python3', 'python', 'pip3', 'pytest', 'flutter', 'dart', 'java', 'gradle', './gradlew', 'go', 'cargo', 'dotnet', 'swift', 'xcodebuild', 'make', 'cmake']);
const DANGER_PATTERNS = [/(^|\s)(rm|del|rmdir|rd)\s/i, /git\s+push/i, /\bsudo\b/i, /\bdrop\s+(table|database)\b/i,
  /\b(mkfs|format)\b/i, /(curl|wget)[^|]*\|\s*(sh|bash|zsh)/i, /chmod\s+777/i, /\bshutdown\b|\breboot\b/i];
function classifyCmd(cmd) {
  const c = String(cmd).trim();
  for (const re of DANGER_PATTERNS) if (re.test(c)) return 2;
  const bin = c.split(/\s+/)[0];
  if (bin.startsWith('./')) return 1; // 项目内脚本
  if (!SAFE_BINS.has(bin)) return 2;  // 白名单外一律需授权
  return 1;
}

const EXCLUDE_SNAPSHOT = ['node_modules', '.git', 'Library', 'Temp', 'Logs', 'obj', 'bin', 'dist', 'build', '.gradle', '__pycache__', '.cache', '.faber'];

function scenariosDir() {
  // 打包后 process.resourcesPath/scenarios；开发态在上级目录
  const packed = path.join(process.resourcesPath || '', 'scenarios');
  if (fs.existsSync(packed)) return packed;
  return path.join(__dirname, '..', 'scenarios');
}

function loadScenario(id) {
  const dir = scenariosDir();
  const chain = [];
  let cur = id;
  for (let i = 0; i < 5; i++) {
    chain.unshift(cur);
    const mf = path.join(dir, cur, 'scenario.json');
    if (!fs.existsSync(mf)) break;
    try { const parent = JSON.parse(fs.readFileSync(mf, 'utf8')).extends; if (!parent || chain.includes(parent)) break; cur = parent; }
    catch { break; }
  }
  if (!chain.includes('generic')) chain.unshift('generic');
  const manifest = { id, testCmd: '', buildCmd: '', packageCmd: '', releaseCmd: '' };
  const skills = [];
  for (const sid of chain) {
    const mf = path.join(dir, sid, 'scenario.json');
    if (fs.existsSync(mf)) { try { Object.assign(manifest, JSON.parse(fs.readFileSync(mf, 'utf8'))); } catch {} }
    const sk = path.join(dir, sid, 'skills');
    if (fs.existsSync(sk)) {
      for (const e of fs.readdirSync(sk, { withFileTypes: true })) {
        const f = path.join(sk, e.name, 'SKILL.md');
        if (e.isDirectory() && fs.existsSync(f)) skills.push(fs.readFileSync(f, 'utf8'));
      }
    }
  }
  return { manifest, skills };
}

function insideDir(dir, p) {
  const abs = path.resolve(dir, p);
  return abs === dir || abs.startsWith(dir + path.sep);
}

function runCmd(dir, cmd, timeoutMs = 180000) {
  return new Promise((resolve) => {
    const child = spawn(process.platform === 'win32' ? 'cmd' : '/bin/bash',
      process.platform === 'win32' ? ['/c', cmd] : ['-c', cmd], { cwd: dir });
    let out = '';
    const cap = (d) => { if (out.length < 12000) out += d.toString(); };
    child.stdout.on('data', cap); child.stderr.on('data', cap);
    const t = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('close', (code) => { clearTimeout(t); resolve({ code: code ?? -1, out: out.slice(0, 12000) }); });
    child.on('error', (e) => { clearTimeout(t); resolve({ code: -1, out: String(e) }); });
  });
}

async function llm(token, messages, tools, role) {
  const res = await fetch(`${API_BASE}/api/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages, tools, role }),
    signal: AbortSignal.timeout(240000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `API ${res.status}`);
  return json;
}

async function singleShot(token, system, user) {
  for (let i = 0; i < 2; i++) {
    try {
      const r = await llm(token, [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ], null, 'main');
      return r.content || '';
    } catch (e) {
      if (i === 1) throw e;
      console.log('[retry] singleShot:', e.message);
    }
  }
  return '';
}

function extractTasks(text) {
  const blocks = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1]);
  for (const b of blocks) {
    try { const j = JSON.parse(b.trim()); if (Array.isArray(j?.tasks) && j.tasks.length) return j.tasks; } catch {}
  }
  for (const b of blocks) {
    try { const j = JSON.parse(b.trim()); if (Array.isArray(j) && j[0]?.title) return j; } catch {}
  }
  return [];
}

function snapshot(userData, dir, label) {
  return new Promise((resolve) => {
    const gitDir = path.join(userData, 'vcs', Buffer.from(dir).toString('base64url') + '.git');
    execFile('git', ['--version'], { timeout: 5000 }, (err) => {
      if (err) return resolve(null); // 无 git 则跳过 checkpoint
      fs.mkdirSync(gitDir, { recursive: true });
      const excl = path.join(gitDir, 'info', 'exclude');
      try { fs.mkdirSync(path.dirname(excl), { recursive: true }); fs.writeFileSync(excl, EXCLUDE_SNAPSHOT.map((e) => e + '/').join('\n') + '\n'); } catch {}
      const base = ['--git-dir', gitDir, '--work-tree', dir, '-c', 'user.name=Faber', '-c', 'user.email=faber@local'];
      execFile('git', [...base, 'add', '-A'], { timeout: 60000 }, () => {
        execFile('git', [...base, 'commit', '-m', label], { timeout: 60000 }, () => resolve(gitDir));
      });
    });
  });
}

const TOOLS = [
  { type: 'function', function: { name: 'read_file', description: '读取项目内文件（相对路径）', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'write_file', description: '写入/覆盖项目内文件（相对路径，父目录自动创建）', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } } },
  { type: 'function', function: { name: 'list_dir', description: '列出目录内容', parameters: { type: 'object', properties: { path: { type: 'string' } } } } },
  { type: 'function', function: { name: 'run_cmd', description: '在项目根目录运行 shell 命令（构建/测试/包管理）', parameters: { type: 'object', properties: { command: { type: 'string' }, timeout: { type: 'number' } }, required: ['command'] } } },
  { type: 'function', function: { name: 'finish', description: '宣布任务完成并给一行摘要', parameters: { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] } } },
  { type: 'function', function: { name: 'remember', description: '写入长期记忆（preference=用户偏好/反感, solution=已验证有效方案, rule=用户准则, mistake=AI 易错点）。用户表达偏好或纠正时必须调用', parameters: { type: 'object', properties: { category: { type: 'string', enum: ['preference', 'solution', 'rule', 'mistake'] }, content: { type: 'string', description: '一句话中文' } }, required: ['category', 'content'] } } },
  { type: 'function', function: { name: 'search_code', description: '语义搜索本项目代码（按含义而非关键字）。改代码前先用它找相关文件', parameters: { type: 'object', properties: { query: { type: 'string', description: '自然语言描述要找的代码' } }, required: ['query'] } } },
];

function loadPerms(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, '.faber', 'permissions.json'), 'utf8')); } catch { return {}; }
}
function savePerm(dir, hash, allowed) {
  const p = loadPerms(dir);
  p[hash] = allowed;
  try { fs.mkdirSync(path.join(dir, '.faber'), { recursive: true }); fs.writeFileSync(path.join(dir, '.faber', 'permissions.json'), JSON.stringify(p)); } catch {}
}
function cmdHash(cmd) { return Buffer.from(cmd).toString('base64url').slice(0, 40); }

async function agentLoop(token, ctx, dir, phase, task, skillsText, mcpTools = []) {
  const allTools = [...TOOLS, ...mcpTools.map((m) => ({ type: 'function', function: { name: 'mcp_' + m.name.replace(/[^A-Za-z0-9_]/g, '_'), description: `[mcp] ${m.description}`, parameters: m.schema || { type: 'object', properties: {} } } }))];
  const messages = [
    { role: 'system', content: [
        '你是 Faber 的资深开发 agent，直接在用户的本地项目文件夹里工作。',
        `项目目录: ${dir}（所有相对路径限制在此目录内）`,
        PLATFORM_NOTE,
        memText,
        Object.keys(ctx.secrets || {}).length
          ? `本项目密钥已注入为环境变量：${Object.keys(ctx.secrets).join(', ')}。构建/测试命令可直接使用它们。绝对不要 echo/print 密钥值，不要把它们写进代码或文档。`
          : '',
        '原则：小步修改、随改随验证；不碰密钥文件；命令输出很长时自己提炼。',
        '完成后调用 finish；卡住也要 finish 说明卡点。',
        skillsText ? `\n## 场景技能\n${skillsText.slice(0, 6000)}` : '',
      ].join('\n') },
    { role: 'user', content: task },
  ];
  for (let step = 0; step < MAX_STEPS; step++) {
    const r = await llm(token, messages, allTools, 'main');
    ctx.credits += r.credits || 0;
    if (r.content) ctx.emit('log', { text: r.content.slice(0, 400) });
    if (!r.toolCalls || r.toolCalls.length === 0) return r.content || '(done)';
    messages.push({ role: 'assistant', content: r.content || null, tool_calls: r.toolCalls.map((tc) => ({ id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.arguments } })) });
    for (const tc of r.toolCalls) {
      let result = '';
      try {
        const a = JSON.parse(tc.arguments || '{}');
        if (tc.name === 'finish') { ctx.emit('log', { text: '✔ ' + String(a.summary || '').slice(0, 200) }); return String(a.summary || 'done'); }
        if (tc.name === 'read_file') {
          const p = path.resolve(dir, String(a.path));
          result = insideDir(dir, p) && fs.existsSync(p) && fs.statSync(p).isFile()
            ? fs.readFileSync(p, 'utf8').slice(0, 40000) : `文件不存在: ${a.path}`;
        } else if (tc.name === 'write_file') {
          const p = path.resolve(dir, String(a.path));
          if (!insideDir(dir, p)) result = '路径越界';
          else {
            const before = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
            fs.mkdirSync(path.dirname(p), { recursive: true });
            fs.writeFileSync(p, String(a.content ?? ''));
            if (before !== String(a.content ?? '')) ctx.recordChange(p, before, String(a.content ?? ''), task.split('\n')[0].slice(0, 80));
            result = `已写入 ${a.path}`;
          }
        } else if (tc.name === 'list_dir') {
          const p = path.resolve(dir, String(a.path || '.'));
          result = insideDir(dir, p) && fs.existsSync(p)
            ? fs.readdirSync(p, { withFileTypes: true }).map((e) => (e.isDirectory() ? 'd ' : '- ') + e.name).join('\n').slice(0, 4000)
            : '目录不存在';
        } else if (tc.name === 'search_code') {
          try {
            if (capabilities.indexStale(dir, ctx.userData)) { ctx.emit('log', { text: '[index] building semantic index…' }); await capabilities.buildIndex(token, dir, ctx.userData, (m2) => ctx.emit('log', { text: '[index] ' + m2 })); }
            const hits = await capabilities.searchIndex(token, dir, ctx.userData, String(a.query));
            result = hits.map((h) => `--- ${h.path}:${h.start} (score ${h.score.toFixed(2)})\n${h.text.slice(0, 800)}`).join('\n\n') || '无结果';
          } catch (e) { result = `搜索失败: ${e.message}（可改用 run_cmd grep）`; }
        } else if (tc.name.startsWith('mcp_')) {
          const toolName = tc.name.slice(4);
          const client = mcpTools.find((m) => 'mcp_' + m.name.replace(/[^A-Za-z0-9_]/g, '_') === tc.name)?.client;
          result = client ? await client.callTool(toolName, a) : 'MCP 客户端不可用';
        } else if (tc.name === 'run_cmd') {
          const cmdStr = String(a.command);
          const _run = runCmd;
          const runWithEnv = (c, t2) => new Promise((resolve) => {
            const child = require('node:child_process').spawn(process.platform === 'win32' ? 'cmd' : '/bin/bash',
              process.platform === 'win32' ? ['/c', c] : ['-c', c], { cwd: dir, env: { ...process.env, ...(ctx.secrets || {}) } });
            let out = '';
            const cap = (d) => { if (out.length < 12000) out += d.toString(); };
            child.stdout.on('data', cap); child.stderr.on('data', cap);
            const tm = setTimeout(() => child.kill('SIGKILL'), t2);
            child.on('close', (code) => { clearTimeout(tm); resolve({ code: code ?? -1, out: out.slice(0, 12000) }); });
            child.on('error', (e) => { clearTimeout(tm); resolve({ code: -1, out: String(e) }); });
          });
          const tier = classifyCmd(cmdStr);
          const h = cmdHash(cmdStr);
          const perms = loadPerms(dir);
          if (tier === 2 && perms[h] !== true) {
            const d = await ctx.confirm(cmdStr);
            if (d === 'deny') { result = '用户拒绝执行该命令。请换一种更安全的方式，或跳过此步骤并在 finish 中说明。'; }
            else {
              if (d === 'always') savePerm(dir, h, true);
              ctx.emit('log', { text: '[approved] $ ' + cmdStr.slice(0, 200) });
              const er = await runWithEnv(cmdStr, Math.min(600, Math.max(5, Number(a.timeout) || 180)) * 1000);
              result = `exit ${er.code}\n${ctx.scrubText(er.out) || '(no output)'}`;
            }
          } else {
            ctx.emit('log', { text: '$ ' + cmdStr.slice(0, 200) });
            const er = await runWithEnv(cmdStr, Math.min(600, Math.max(5, Number(a.timeout) || 180)) * 1000);
            result = `exit ${er.code}\n${ctx.scrubText(er.out) || '(no output)'}`;
          }
        } else if (tc.name === 'remember') {
          const cat = String(a.category);
          const scope = (cat === 'rule' || cat === 'preference') ? 'global' : 'project';
          const f = scope === 'global' ? memory._g(userData) : memory._p(dir);
          const ok = memory.addItem(f, scope, null, cat, a.content);
          result = ok ? `已记住（${cat}）` : '该记忆已存在';
          ctx.emit('memory', { category: cat, content: String(a.content).slice(0, 200) });
        } else result = `未知工具: ${tc.name}`;
      } catch (e) { result = `工具出错: ${e.message}`; }
      messages.push({ role: 'tool', tool_call_id: tc.id, content: String(result).slice(0, 20000) });
    }
  }
  return '达到步数上限';
}

async function verifyWithRepair(token, ctx, dir, phase, label, cmd, skillsText) {
  for (let round = 0; round <= 2; round++) {
    ctx.emit('log', { text: `[verify:${label}] round ${round + 1}` });
    const child = require('node:child_process').spawn(process.platform === 'win32' ? 'cmd' : '/bin/bash',
      process.platform === 'win32' ? ['/c', cmd] : ['-c', cmd], { cwd: dir, env: { ...process.env, ...(ctx.secrets || {}) } });
    const er = await new Promise((resolve) => {
      let out = '';
      const cap = (d) => { if (out.length < 12000) out += d.toString(); };
      child.stdout.on('data', cap); child.stderr.on('data', cap);
      const tm = setTimeout(() => child.kill('SIGKILL'), 600000);
      child.on('close', (code) => { clearTimeout(tm); resolve({ code: code ?? -1, out: out.slice(0, 12000) }); });
      child.on('error', (e) => { clearTimeout(tm); resolve({ code: -1, out: String(e) }); });
    });
    if (er.code === 0) return { ok: true, out: er.out };
    if (round === 2) return { ok: false, out: er.out };
    ctx.emit('log', { text: `${label} 失败，agent 修复中…` });
    await agentLoop(token, ctx, dir, phase,
      `验证命令「${cmd}」失败（退出码 ${er.code}）。输出如下，定位并修复，不要引入新功能：\n\n${er.out.slice(-6000)}`, skillsText);
  }
  return { ok: false, out: '' };
}

// ============ 主入口 ============
let pendingConfirms = [];

async function runPipeline(opts) {
  const { dir, scenario, brief, token, emit, userData, getApproval } = opts;
  pendingConfirms = opts.onConfirmWait ? pendingConfirms : [];
  pendingConfirms.length = 0;
  opts._setConfirmResolver = (resolve) => pendingConfirms.push(resolve);
  const ctx = { credits: 0, logs: [], emit: (type, data) => emit({ type, at: Date.now(), data }), secrets: opts.secrets || {} };
  const mem = memory.forPrompt(userData, dir);
  const memText = memory.promptText(mem);
  const changes = []; // Review 面板数据：{path, before, after, task}
  ctx.recordChange = (p, before, after, taskTitle) => {
    changes.push({ path: path.relative(dir, p), before, after, task: taskTitle, at: Date.now() });
    fs.mkdirSync(path.join(dir, '.faber'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.faber', 'changes.json'), JSON.stringify(changes.map((c) => ({ ...c, before: c.before.slice(0, 200000), after: c.after.slice(0, 200000) }))));
  };
  const secrets = opts.secrets || {};
  const scrubText = (t) => {
    let out = String(t);
    for (const v of Object.values(secrets)) if (v && v.length >= 8) out = out.split(v).join('***');
    return out;
  };
  ctx.scrubText = scrubText;
  ctx.secretsRef = secrets;
  ctx.userData = userData;
  ctx.emitRaw = (text) => { ctx.logs.push(text); if (ctx.logs.length > 400) ctx.logs.shift(); };
  const runsFile = path.join(dir, '.faber', 'runs.json');
  function saveRun() {
    try {
      entry.phase = state.phase; entry.status = state.status; entry.credits = ctx.credits;
      entry.tasks = state.tasks.map((t2) => ({ seq: t2.seq, title: t2.title, status: t2.status }));
      entry.changes = changes.map((c) => ({ path: c.path, task: c.task, at: c.at }));
      entry.logs = ctx.logs.slice(-250);
      let runs = [];
      try { runs = JSON.parse(fs.readFileSync(runsFile, 'utf8')); } catch {}
      runs = runs.filter((r) => r.id !== entry.id);
      runs.unshift(entry);
      fs.mkdirSync(path.dirname(runsFile), { recursive: true });
      fs.writeFileSync(runsFile, JSON.stringify(runs.slice(0, 50), null, 1));
    } catch (e) { console.error('[saveRun]', e?.message, e?.stack?.split('\n')[1]); }
  }
  // 历史事件进 logs
  const _emit = ctx.emit;
  ctx.emit = (type, data) => {
    if (type === 'log') ctx.emitRaw(String(data.text || ''));
    else if (type === 'task') ctx.emitRaw(`[task ${data.status}] ${data.title}`);
    else if (type === 'phase') ctx.emitRaw(`[phase] ${data.phase} -> ${data.status}`);
    _emit(type, data);
  };
  ctx.confirm = (command) => new Promise((resolve) => {
    const id = 'c' + Date.now() + Math.random().toString(36).slice(2, 6);
    opts.registerConfirm(id, resolve);
    emit({ type: 'confirm', at: Date.now(), data: { id, command } });
  });
  const stateFile = path.join(dir, '.faber', 'state.json');
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : { phase: 'requirements', status: 'idle', tasks: [], notes: '' };
  const entry = {
    id: 'r' + Date.now().toString(36), startedAt: new Date().toISOString(), endedAt: null,
    status: 'running', phase: state.phase, credits: 0, brief: String(brief || '').slice(0, 200),
    fav: false, tasks: [], logs: ctx.logs,
  };
  const { manifest, skills } = loadScenario(scenario);
  // MCP 服务器接入（.faber/mcp.json 或全局 faber-mcp.json）
  const mcpClients = await capabilities.loadMcpServers(dir, userData, (t2) => ctx.emit('log', { text: t2 }));
  const mcpTools = mcpClients.flatMap((c) => c.tools.map((t2) => ({ client: c, name: t2.name, description: t2.description, schema: t2.schema })));
  const skillsOf = (ph) => skills.filter((s) => s.includes(`phase:\n`) === false || true).join('\n\n');
  const phaseSkills = (ph) => skills.join('\n\n');

  async function setState() { fs.writeFileSync(stateFile, JSON.stringify(state, null, 2)); ctx.emit('phase', { phase: state.phase, status: state.status }); }
  async function gate() {
    state.status = 'awaiting_approval'; await setState();
    ctx.emit('gate', { phase: state.phase, requires: 'approval' });
    const d = await getApproval();
    state.status = 'idle'; state.notes = d.notes || ''; await setState();
    saveRun();
    if (d.decision === 'reject') {
      if (d.notes) memory.addItem(memory._g(userData), 'global', null, 'preference', '用户驳回过：' + d.notes);
      return false;
    }
    return true;
  }
  const readDoc = (f) => { try { return fs.readFileSync(path.join(dir, 'docs', f), 'utf8'); } catch { return null; } };
  const writeDoc = (f, c) => { fs.mkdirSync(path.join(dir, 'docs'), { recursive: true }); fs.writeFileSync(path.join(dir, 'docs', f), c); };

  const PHASES = ['requirements', 'design', 'dev', 'test', 'package', 'release', 'marketing'];
  while (state.phase) {
    ctx.emit('phase', { phase: state.phase, status: 'running' });
    try {
      if (state.phase === 'requirements') {
        const md = await singleShot(token,
          '你是资深产品顾问。输出结构化 PRD（Markdown）：# 产品概述、## 目标用户、## 用户故事（含 Given/When/Then 验收标准）、## 范围外、## 成功指标。中文，直接输出。',
          `项目需求描述：\n${brief || '（未填写，保守推断）'}`);
        writeDoc('requirements.md', md);
        ctx.emit('artifact', { title: 'requirements.md' });
      } else if (state.phase === 'design') {
        const prd = readDoc('requirements.md');
        const out = await singleShot(token,
          '你是资深架构师。基于 PRD 输出技术方案（Markdown）：## 技术选型、## 架构、## 数据模型、## 任务拆分。最后附 ```json 块 {"tasks":[{"title","detail"}]}，任务 ≤1h 粒度，第一个任务是脚手架+空跑验证。',
          `PRD：\n${prd || brief}`);
        writeDoc('tech-plan.md', out);
        state.tasks = extractTasks(out).slice(0, 30).map((t2, i) => ({ seq: i, title: t2.title, detail: t2.detail || '', status: 'pending' }));
        ctx.emit('artifact', { title: 'tech-plan.md' });
      } else if (state.phase === 'dev') {
        for (const t2 of state.tasks.filter((x) => x.status !== 'done')) {
          t2.status = 'active'; await setState();
          ctx.emit('task', { ...t2 });
          await snapshot(userData, dir, `dev: start ${t2.title}`);
          const r = await agentLoop(token, ctx, dir, 'dev',
            [`任务：${t2.title}`, t2.detail ? `要点：${t2.detail}` : '', state.notes ? `人工备注（必须遵守）：${state.notes}` : ''].filter(Boolean).join('\n'),
            phaseSkills('dev'));
          let ok = true;
          for (const [label, cmd] of [['build', pickCmd(manifest, 'buildCmd')], ['test', pickCmd(manifest, 'testCmd')]]) {
            if (!cmd) continue;
            const v = await verifyWithRepair(token, ctx, dir, 'dev', label, cmd, phaseSkills('dev'));
            if (!v.ok) { ok = false; t2.status = 'failed'; ctx.emit('task', { ...t2 }); break; }
          }
          if (!ok) { state.status = 'blocked'; state.notes = `任务「${t2.title}」验证失败`; entry.endedAt = new Date().toISOString(); await setState(); saveRun(); return; }
          t2.status = 'done'; t2.result = String(r).slice(0, 200); ctx.emit('task', { ...t2 });
          await snapshot(userData, dir, `dev: done ${t2.title}`);
        }
      } else if (state.phase === 'test') {
        const testCmd = pickCmd(manifest, 'testCmd');
        if (testCmd) {
          const v = await verifyWithRepair(token, ctx, dir, 'test', 'full-test', testCmd, phaseSkills('test'));
          writeDoc('test-report.md', `# Test Report\n\n- result: ${v.ok ? 'PASS' : 'FAIL'}\n- command: ${testCmd}\n\n\`\`\`\n${v.out.slice(0, 8000)}\n\`\`\`\n`);
          ctx.emit('artifact', { title: 'test-report.md' });
          if (!v.ok) { state.status = 'blocked'; state.notes = '全量测试未通过'; entry.endedAt = new Date().toISOString(); await setState(); saveRun(); return; }
        }
      } else if (state.phase === 'package') {
        const pkgCmd = pickCmd(manifest, 'packageCmd');
        if (pkgCmd) {
          const er = await runCmd(dir, pkgCmd, 600000);
          if (er.code !== 0) { state.status = 'blocked'; state.notes = `打包失败:\n${er.out.slice(-2000)}`; entry.endedAt = new Date().toISOString(); await setState(); saveRun(); return; }
        }
      } else if (state.phase === 'release') {
        const relCmd = pickCmd(manifest, 'releaseCmd');
        if (relCmd) {
          const er = await runCmd(dir, relCmd, 600000);
          if (er.code !== 0) { state.status = 'blocked'; state.notes = `发布失败:\n${er.out.slice(-2000)}`; entry.endedAt = new Date().toISOString(); await setState(); saveRun(); return; }
        }
      } else if (state.phase === 'marketing') {
        const r = await fetch(`${API_BASE}/api/agent/marketing`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ brief, prd: readDoc('requirements.md'), plan: readDoc('tech-plan.md') }),
          signal: AbortSignal.timeout(300000),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || `API ${r.status}`);
        ctx.credits += j.credits || 0;
        writeDoc('marketing.md', j.content || '');
        ctx.emit('artifact', { title: 'marketing.md' });
      }

      saveRun();
      const idx = PHASES.indexOf(state.phase);
      const needsGate = ['requirements', 'design', 'package'].includes(state.phase);
      if (needsGate) {
        state.status = 'awaiting_approval'; await setState();
        const ok = await gate();
        if (!ok) { ctx.emit('phase', { phase: state.phase, status: 'idle' }); return; }
      }
      if (idx + 1 >= PHASES.length) { state.status = 'done'; await setState(); entry.endedAt = new Date().toISOString(); saveRun(); ctx.emit('phase', { phase: 'done', status: 'done' }); return; }
      state.phase = PHASES[idx + 1]; state.status = 'idle'; await setState();
      if (state.phase === 'dev' && state.tasks.length === 0) { // 设计被跳过时兜底
        state.status = 'blocked'; state.notes = '没有任务清单，请先运行设计阶段'; entry.endedAt = new Date().toISOString(); await setState(); saveRun(); return;
      }
    } catch (e) {
      console.error('[pipeline-error]', e?.stack || e);
      state.status = 'blocked'; state.notes = String(e?.message ?? e).slice(0, 1000); await setState();
      entry.endedAt = new Date().toISOString(); saveRun();
      ctx.emit('phase', { phase: state.phase, status: 'blocked', notes: state.notes });
      return;
    }
  }
}

async function history(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, '.faber', 'runs.json'), 'utf8')); } catch { return []; }
}
async function star(dir, runId, fav) {
  try {
    const runsFile = path.join(dir, '.faber', 'runs.json');
    const runs = JSON.parse(fs.readFileSync(runsFile, 'utf8'));
    const r = runs.find((x) => x.id === runId);
    if (r) { r.fav = fav; fs.writeFileSync(runsFile, JSON.stringify(runs, null, 1)); }
    return true;
  } catch { return false; }
}
async function extractMemories(token, ctx, userData, dir) {
  try {
    const text = ctx.logs.slice(-120).join('\n').slice(-6000);
    if (text.length < 100) return;
    const r = await llm(token, [
      { role: 'system', content: '从开发日志提取值得长期记住的条目。只提取明确的：用户表达的反感或偏好（preference）、用户给出的准则（rule）、验证有效的方案（solution）、AI 犯过的错误（mistake）。输出 JSON：{"items":[{"category":"...","content":"一句话中文"}]}。没有就输出 {"items":[]}。最多 5 条。' },
      { role: 'user', content: text },
    ], null, 'fast');
    const m = (r.content || '').match(/\{[\s\S]*\}/);
    if (!m) return;
    const parsed = JSON.parse(m[0]);
    for (const it of (parsed.items || []).slice(0, 5)) {
      if (!it.content || !it.category) continue;
      const scope = (it.category === 'rule' || it.category === 'preference') ? 'global' : 'project';
      const f = scope === 'global' ? memory._g(userData) : memory._p(dir);
      memory.addItem(f, scope, null, it.category, it.content);
    }
  } catch { /* 提取失败不影响主流程 */ }
}

async function syncMemories(token, userData, dir) {
  try { return await memory.syncWithServer(userData, dir, token); } catch { return null; }
}

module.exports = { runPipeline, loadScenario, snapshot, history, star, extractMemories, syncMemories };
