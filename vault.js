// Faber 客户端统一密钥库：OS 级加密（mac Keychain / Win DPAPI / Linux libsecret），
// 数据只存本机 userData，永不上传云端；运行命令时注入为环境变量，输出自动打码。
const { safeStorage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

let file = null;
function storeFile(userData) {
  if (!file) file = path.join(userData, 'secret-vault.json');
  return file;
}
function load(userData) {
  try { return JSON.parse(fs.readFileSync(storeFile(userData), 'utf8')); } catch { return {}; }
}
function save(userData, data) {
  fs.mkdirSync(path.dirname(storeFile(userData)), { recursive: true });
  fs.writeFileSync(storeFile(userData), JSON.stringify(data));
}

function enc(userData, value) {
  if (safeStorage.isEncryptionAvailable()) {
    return { e: true, d: safeStorage.encryptString(value).toString('base64') };
  }
  return { e: false, d: Buffer.from(value, 'utf8').toString('base64') }; // 无 OS 加密时降级（仍在用户本机）
}
function dec(userData, rec) {
  const buf = Buffer.from(rec.d, 'base64');
  return rec.e ? safeStorage.decryptString(buf) : buf.toString('utf8');
}

function list(userData) {
  const data = load(userData);
  return Object.entries(data).map(([name, rec]) => {
    const v = dec(userData, rec);
    return { name, encrypted: !!rec.e, masked: v.length > 8 ? v.slice(0, 3) + '****' + v.slice(-4) : '****' };
  });
}
function set(userData, name, value) {
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,100}$/.test(name)) throw new Error('密钥名只能是字母/数字/下划线');
  const data = load(userData);
  data[name] = enc(userData, String(value));
  save(userData, data);
  return true;
}
function del(userData, name) {
  const data = load(userData);
  delete data[name];
  save(userData, data);
  return true;
}
// 仅供引擎注入进程环境；永不进入模型上下文
function resolveAll(userData) {
  const data = load(userData);
  const out = {};
  for (const [name, rec] of Object.entries(data)) out[name] = dec(userData, rec);
  return out;
}
// 命令输出脱敏：把所有密钥值替换为 ***
function scrub(userData, text) {
  const data = load(userData);
  let out = String(text);
  for (const [, rec] of Object.entries(data)) {
    const v = dec(userData, rec);
    if (v.length >= 8) out = out.split(v).join('***');
  }
  return out;
}

module.exports = { list, set, del, resolveAll, scrub };
