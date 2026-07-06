
const PASSWORD_LENGTHS = [8, 10, 12, 16, 20, 24];
const PERSONALIZED_LENGTHS = [8, 10, 12, 16, 20];
const PIN_LENGTHS = [4, 6, 8, 10];
const AMBIGUOUS = "l1IO0";
const LEET = {a:'@', e:'3', i:'1', o:'0', s:'$', t:'7', b:'8'};

let mode = 'password';
let length = 12;
let history = [];

const chipRow = document.getElementById('chipRow');
const passwordOptions = document.getElementById('passwordOptions');
const pinNote = document.getElementById('pinNote');
const pwText = document.getElementById('pwText');
const strengthText = document.getElementById('strengthText');
const tumblersEl = document.getElementById('tumblers');
const historyList = document.getElementById('historyList');
const copiedToast = document.getElementById('copiedToast');

function lengthsForMode(){
  if(mode === 'password') return PASSWORD_LENGTHS;
  if(mode === 'personalized') return PERSONALIZED_LENGTHS;
  return PIN_LENGTHS;
}

function renderChips(){
  const lengths = lengthsForMode();
  if(!lengths.includes(length)) length = lengths[Math.floor(lengths.length/2)];
  chipRow.innerHTML = '';
  lengths.forEach(l => {
    const chip = document.createElement('div');
    chip.className = 'chip' + (l === length ? ' active' : '');
    chip.textContent = l;
    chip.onclick = () => { length = l; renderChips(); };
    chipRow.appendChild(chip);
  });
}

function setMode(newMode){
  mode = newMode;
  document.getElementById('modeBtnPassword').classList.toggle('active', mode==='password');
  document.getElementById('modeBtnPersonalized').classList.toggle('active', mode==='personalized');
  document.getElementById('modeBtnPin').classList.toggle('active', mode==='pin');
  passwordOptions.style.display = (mode === 'password' || mode === 'personalized') ? 'grid' : 'none';
  pinNote.style.display = mode === 'pin' ? 'block' : 'none';
  document.getElementById('personalizedNote').style.display = mode === 'personalized' ? 'block' : 'none';
  renderChips();
}

document.getElementById('modeBtnPassword').onclick = () => setMode('password');
document.getElementById('modeBtnPersonalized').onclick = () => setMode('personalized');
document.getElementById('modeBtnPin').onclick = () => setMode('pin');

function buildCharPool(){
  if(mode === 'pin') return '0123456789';
  let pool = '';
  if(document.getElementById('optUpper').checked) pool += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if(document.getElementById('optLower').checked) pool += 'abcdefghijklmnopqrstuvwxyz';
  if(document.getElementById('optNumbers').checked) pool += '0123456789';
  if(document.getElementById('optSymbols').checked) pool += '!@#$%^&*()-_=+[]{};:,.?';
  if(document.getElementById('optAmbiguous').checked){
    pool = pool.split('').filter(c => !AMBIGUOUS.includes(c)).join('');
  }
  return pool;
}

function secureRandomInt(max){
  const arr = new Uint32Array(1);
  const limit = Math.floor(0xFFFFFFFF / max) * max;
  let val;
  do { crypto.getRandomValues(arr); val = arr[0]; } while(val >= limit);
  return val % max;
}

function buildPersonalizedBase(){
  const name = document.getElementById('nameInput').value.trim();
  const email = document.getElementById('emailInput').value.trim();
  const emailUser = email.includes('@') ? email.split('@')[0] : email;
  let base = (name + emailUser).replace(/[^a-zA-Z0-9]/g, '');
  if(base.length === 0) base = 'guest';
  return base.split('').map(ch => {
    const lower = ch.toLowerCase();
    if(LEET[lower] && secureRandomInt(2) === 0) return LEET[lower];
    return secureRandomInt(2) === 0 ? ch.toUpperCase() : ch.toLowerCase();
  });
}

function generatePersonalizedPassword(){
  const padPool = buildCharPool();
  const effectivePool = padPool.length > 0 ? padPool : '0123456789!@#$%';
  let chars = buildPersonalizedBase();
  const baseLen = chars.length;

  if(chars.length > length){
    chars = chars.slice(0, Math.max(1, length - 2));
  }
  const randomToInsert = Math.max(0, length - chars.length);
  for(let i=0;i<randomToInsert;i++){
    const pos = secureRandomInt(chars.length + 1);
    chars.splice(pos, 0, effectivePool[secureRandomInt(effectivePool.length)]);
  }
  chars = chars.slice(0, length);

  const usedBaseChars = Math.min(baseLen, chars.length);
  const insertedCount = chars.length - Math.max(0, chars.length - randomToInsert);
  const bits = (randomToInsert * Math.log2(effectivePool.length)) + (usedBaseChars * 1.2);
  updateStrength(bits);
  return chars.join('');
}

function generatePassword(){
  if(mode === 'personalized'){
    return generatePersonalizedPassword();
  }
  const pool = buildCharPool();
  if(pool.length === 0){
    pwText.textContent = 'Select at least one character type';
    return null;
  }
  let out = '';
  for(let i=0;i<length;i++){
    out += pool[secureRandomInt(pool.length)];
  }
  const bits = length * Math.log2(pool.length);
  updateStrength(bits);
  return out;
}

function updateStrength(bits){
  let level, label, color;
  if(bits < 28){ level=1; label='Weak'; color='var(--coral)'; }
  else if(bits < 45){ level=2; label='Fair'; color='var(--amber)'; }
  else if(bits < 65){ level=3; label='Strong'; color='var(--teal)'; }
  else { level=4; label='Very strong'; color='var(--teal)'; }

  strengthText.textContent = label + ' (~' + Math.round(bits) + ' bits)';
  tumblersEl.innerHTML = '';
  for(let i=1;i<=4;i++){
    const bar = document.createElement('div');
    bar.className = 'tumbler';
    bar.style.height = (10 + i*6) + 'px';
    bar.style.background = i <= level ? color : 'var(--border)';
    tumblersEl.appendChild(bar);
  }
}

function labelFor(){
  const name = document.getElementById('nameInput').value.trim();
  const email = document.getElementById('emailInput').value.trim();
  if(name && email) return name + ' · ' + maskEmail(email);
  if(name) return name;
  if(email) return maskEmail(email);
  return mode === 'pin' ? 'PIN' : (mode === 'personalized' ? 'Personalized' : 'Password');
}

function maskEmail(email){
  const at = email.indexOf('@');
  if(at < 1) return email;
  const user = email.slice(0, at);
  const domain = email.slice(at);
  const visible = user.slice(0, Math.min(2, user.length));
  return visible + '***' + domain;
}

function renderHistory(){
  if(history.length === 0){
    historyList.innerHTML = '<p class="empty">No passwords generated yet.</p>';
    return;
  }
  historyList.innerHTML = '';
  history.slice().reverse().forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'hist-item';
    row.innerHTML =
      '<span class="hist-tag">' + escapeHtml(item.label) + '</span>' +
      '<span class="hist-pw">' + '•'.repeat(item.password.length) + '</span>' +
      '<button class="icon-btn hist-copy" title="Copy" aria-label="Copy">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M5 15V5a2 2 0 0 1 2-2h10" stroke="currentColor" stroke-width="1.6"/></svg>' +
      '</button>';
    row.querySelector('.hist-copy').onclick = () => copyToClipboard(item.password);
    historyList.appendChild(row);
  });
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function copyToClipboard(text){
  navigator.clipboard.writeText(text).then(() => {
    copiedToast.classList.add('show');
    setTimeout(() => copiedToast.classList.remove('show'), 1400);
  }).catch(() => {});
}

document.getElementById('generateBtn').onclick = () => {
  const pw = generatePassword();
  if(!pw) return;
  pwText.textContent = pw;
  history.push({ label: labelFor(), password: pw });
  if(history.length > 20) history.shift();
  renderHistory();
};

document.getElementById('copyBtn').onclick = () => {
  const text = pwText.textContent;
  if(text && text !== 'Press generate to begin' && text !== 'Select at least one character type'){
    copyToClipboard(text);
  }
};

renderChips();
