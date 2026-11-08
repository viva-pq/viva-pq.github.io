/* ============================================================
 * 记账本 App
 * 数据全部存储在本地 localStorage，支持离线使用
 * ============================================================ */

// ---------- 默认分类 ----------
const DEFAULT_CATEGORIES = {
  expense: [
    { id: 'food', name: '餐饮', icon: '🍔' },
    { id: 'transport', name: '交通', icon: '🚗' },
    { id: 'shopping', name: '购物', icon: '🛍️' },
    { id: 'entertainment', name: '娱乐', icon: '🎮' },
    { id: 'home', name: '居家', icon: '🏠' },
    { id: 'medical', name: '医疗', icon: '💊' },
    { id: 'education', name: '学习', icon: '📚' },
    { id: 'travel', name: '旅行', icon: '✈️' },
    { id: 'communication', name: '通讯', icon: '📱' },
    { id: 'other_exp', name: '其他', icon: '📦' },
  ],
  income: [
    { id: 'salary', name: '工资', icon: '💰' },
    { id: 'bonus', name: '奖金', icon: '🎁' },
    { id: 'invest', name: '理财', icon: '📈' },
    { id: 'parttime', name: '兼职', icon: '💼' },
    { id: 'other_inc', name: '其他', icon: '💵' },
  ],
};

const COLORS = ['#6366f1','#ef4444','#10b981','#f59e0b','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316','#06b6d4','#84cc16','#a855f7'];

// ---------- 存储 ----------
const STORAGE_KEY = 'account_book_data_v1';

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const data = JSON.parse(raw);
    if (!data.transactions) data.transactions = [];
    if (!data.categories) data.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
    return data;
  } catch (e) {
    return defaultData();
  }
}
function defaultData() {
  return {
    transactions: [],
    categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
  };
}
function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

let DATA = loadData();

// ---------- 工具函数 ----------
function fmt(n) {
  return '¥' + Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function monthKey(d) {
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toISOString().slice(0, 7); // YYYY-MM
}
function monthLabel(key) {
  const [y, m] = key.split('-');
  const now = monthKey(new Date());
  if (key === now) return '本月';
  const last = new Date(); last.setMonth(last.getMonth() - 1);
  if (key === monthKey(last)) return '上月';
  return `${y}年${parseInt(m)}月`;
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getCategoryById(id) {
  for (const type of ['expense', 'income']) {
    const c = DATA.categories[type].find(c => c.id === id);
    if (c) return { ...c, type };
  }
  return null;
}

// ---------- 当前状态 ----------
let currentMonth = monthKey(new Date());
let currentType = 'all'; // 列表筛选
let editingId = null;
let modalType = 'expense';
let selectedCatId = null;
let catManageType = 'expense';

// ---------- 渲染：首页 ----------
function renderHome() {
  const txs = DATA.transactions.filter(t => monthKey(t.date) === currentMonth);
  let income = 0, expense = 0;
  txs.forEach(t => {
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  });
  document.getElementById('balance-amount').textContent = fmt(income - expense);
  document.getElementById('income-amount').textContent = fmt(income);
  document.getElementById('expense-amount').textContent = fmt(expense);
  document.getElementById('current-month-text').textContent = monthLabel(currentMonth);

  // 支出分类图表
  renderCategoryChart(txs.filter(t => t.type === 'expense'));

  // 近期账单（最近 5 笔）
  const recent = [...txs].sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id)).slice(0, 5);
  renderTxList(document.getElementById('recent-tx-list'), recent, true);
}

function renderCategoryChart(expenseTx) {
  const canvas = document.getElementById('category-chart');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = 220 * dpr;
  canvas.style.height = '220px';
  ctx.scale(dpr, dpr);
  const W = rect.width, H = 220;
  ctx.clearRect(0, 0, W, H);

  // 按分类汇总
  const map = {};
  expenseTx.forEach(t => {
    map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
  });
  const arr = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const total = arr.reduce((s, [, v]) => s + v, 0);
  const legend = document.getElementById('category-legend');
  legend.innerHTML = '';

  if (arr.length === 0) {
    ctx.fillStyle = '#9ca3af';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('本月暂无支出', W / 2, H / 2);
    return;
  }

  // 饼图
  const cx = W / 2, cy = H / 2, r = Math.min(W, H) * 0.38;
  let start = -Math.PI / 2;
  arr.forEach(([id, val], i) => {
    const angle = (val / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, start + angle);
    ctx.closePath();
    ctx.fillStyle = COLORS[i % COLORS.length];
    ctx.fill();
    start += angle;
  });
  // 中心圆
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--card-bg') || '#fff';
  ctx.fill();
  // 中心文字
  ctx.fillStyle = 'var(--text)';
  ctx.font = '600 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9ca3af';
  ctx.fillText('总支出', cx, cy - 6);
  ctx.fillStyle = '';
  ctx.font = '700 16px sans-serif';
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text') || '#1f2937';
  ctx.fillText(fmt(total).replace('¥', ''), cx, cy + 14);

  // 图例
  arr.forEach(([id, val], i) => {
    const cat = getCategoryById(id);
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <span class="legend-dot" style="background:${COLORS[i % COLORS.length]}"></span>
      <span class="legend-label">${cat ? cat.icon + ' ' + cat.name : '未知'}</span>
      <span class="legend-value">${((val / total) * 100).toFixed(0)}%</span>
    `;
    legend.appendChild(item);
  });
}

// ---------- 渲染：交易列表 ----------
function renderTxList(container, txs, simple = false) {
  if (txs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📒</div>
        <div class="empty-text">${simple ? '还没有记录，点击下方 + 开始记账' : '暂无记录'}</div>
      </div>`;
    return;
  }
  // 按日期分组
  const groups = {};
  txs.forEach(t => {
    if (!groups[t.date]) groups[t.date] = [];
    groups[t.date].push(t);
  });
  const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));
  let html = '';
  sortedDates.forEach(date => {
    const dayTxs = groups[date];
    let dayIn = 0, dayOut = 0;
    dayTxs.forEach(t => { if (t.type === 'income') dayIn += t.amount; else dayOut += t.amount; });
    const d = new Date(date);
    const week = ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()];
    html += `<div class="tx-day-group">
      <div class="tx-day-header">
        <span>${date.slice(5)} ${week}</span>
        <span>${dayIn > 0 ? '收 ' + fmt(dayIn) + ' ' : ''}${dayOut > 0 ? '支 ' + fmt(dayOut) : ''}</span>
      </div>`;
    dayTxs.forEach(t => {
      const cat = getCategoryById(t.categoryId);
      html += `<div class="tx-item" data-id="${t.id}">
        <div class="tx-icon">${cat ? cat.icon : '❓'}</div>
        <div class="tx-info">
          <div class="tx-name">${cat ? cat.name : '未知分类'}</div>
          <div class="tx-sub">${t.note || (t.type === 'income' ? '收入' : '支出')}</div>
        </div>
        <div class="tx-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${fmt(t.amount)}</div>
      </div>`;
    });
    html += `</div>`;
  });
  container.innerHTML = html;

  // 点击事件
  container.querySelectorAll('.tx-item').forEach(el => {
    el.addEventListener('click', () => openDetail(el.dataset.id));
  });
}

// ---------- 渲染：账单列表页 ----------
function renderListPage() {
  let txs = DATA.transactions.filter(t => monthKey(t.date) === currentMonth);
  if (currentType !== 'all') txs = txs.filter(t => t.type === currentType);
  txs.sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));
  renderTxList(document.getElementById('full-tx-list'), txs);
}

// ---------- 渲染：统计 ----------
function renderStats() {
  // 月度趋势（最近 6 个月）
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(monthKey(d));
  }
  const monthData = months.map(k => {
    const txs = DATA.transactions.filter(t => monthKey(t.date) === k);
    let inc = 0, exp = 0;
    txs.forEach(t => { if (t.type === 'income') inc += t.amount; else exp += t.amount; });
    return { key: k, inc, exp };
  });

  const canvas = document.getElementById('trend-chart');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = 220 * dpr;
  canvas.style.height = '220px';
  ctx.scale(dpr, dpr);
  const W = rect.width, H = 220;
  ctx.clearRect(0, 0, W, H);

  const padL = 40, padR = 16, padT = 20, padB = 28;
  const chartW = W - padL - padR, chartH = H - padT - padB;
  const maxVal = Math.max(1, ...monthData.map(d => Math.max(d.inc, d.exp)));
  const stepY = maxVal / 4;

  // 网格
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1;
  ctx.font = '10px sans-serif';
  ctx.fillStyle = '#9ca3af';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const y = padT + chartH - (i / 4) * chartH;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    ctx.fillText(Math.round(stepY * i), padL - 6, y + 3);
  }

  // 柱状
  const bw = chartW / months.length;
  monthData.forEach((d, i) => {
    const x = padL + i * bw + bw * 0.2;
    const w = bw * 0.28;
    const incH = (d.inc / maxVal) * chartH;
    const expH = (d.exp / maxVal) * chartH;
    ctx.fillStyle = '#10b981';
    ctx.fillRect(x, padT + chartH - incH, w, incH);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(x + w + bw * 0.08, padT + chartH - expH, w, expH);
    ctx.fillStyle = '#9ca3af';
    ctx.textAlign = 'center';
    ctx.fillText(d.key.slice(5), padL + i * bw + bw / 2, H - 10);
  });

  // 分类排行（当月支出）
  const expTxs = DATA.transactions.filter(t => monthKey(t.date) === currentMonth && t.type === 'expense');
  const map = {};
  expTxs.forEach(t => { map[t.categoryId] = (map[t.categoryId] || 0) + t.amount; });
  const arr = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const maxAmt = arr[0] ? arr[0][1] : 0;
  const rankEl = document.getElementById('category-ranking');
  if (arr.length === 0) {
    rankEl.innerHTML = '<div class="empty-state"><div class="empty-text">本月暂无支出</div></div>';
  } else {
    rankEl.innerHTML = arr.map(([id, val], i) => {
      const cat = getCategoryById(id);
      return `<div class="rank-item">
        <div class="rank-icon">${cat ? cat.icon : '❓'}</div>
        <div class="rank-info">
          <div class="rank-top">
            <span class="rank-name">${cat ? cat.name : '未知'}</span>
            <span class="rank-amount" style="color:var(--expense)">${fmt(val)}</span>
          </div>
          <div class="rank-bar"><div class="rank-bar-fill" style="width:${(val / maxAmt * 100).toFixed(1)}%;background:${COLORS[i % COLORS.length]}"></div></div>
        </div>
      </div>`;
    }).join('');
  }
}

// ---------- 渲染：我的 ----------
function renderProfile() {
  document.getElementById('profile-stat').textContent = `共 ${DATA.transactions.length} 笔记录`;
}

// ---------- 分类网格（记账弹窗） ----------
function renderCategoryGrid() {
  const grid = document.getElementById('category-grid');
  const cats = DATA.categories[modalType];
  if (!selectedCatId || !cats.find(c => c.id === selectedCatId)) {
    selectedCatId = cats[0] ? cats[0].id : null;
  }
  grid.innerHTML = cats.map(c => `
    <div class="cat-option ${c.id === selectedCatId ? 'active' : ''}" data-id="${c.id}">
      <div class="cat-icon">${c.icon}</div>
      <div class="cat-name">${c.name}</div>
    </div>
  `).join('');
  grid.querySelectorAll('.cat-option').forEach(el => {
    el.addEventListener('click', () => {
      selectedCatId = el.dataset.id;
      renderCategoryGrid();
    });
  });
}

// ---------- 弹窗：新增/编辑 ----------
function openAddModal(tx = null) {
  editingId = tx ? tx.id : null;
  modalType = tx ? tx.type : 'expense';
  selectedCatId = tx ? tx.categoryId : null;
  document.getElementById('add-modal-title').textContent = tx ? '编辑' : '记一笔';
  document.getElementById('tx-amount').value = tx ? tx.amount : '';
  document.getElementById('tx-date').value = tx ? tx.date : todayStr();
  document.getElementById('tx-note').value = tx ? (tx.note || '') : '';
  document.querySelectorAll('.type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === modalType);
  });
  renderCategoryGrid();
  showModal('add-modal');
  setTimeout(() => document.getElementById('tx-amount').focus(), 300);
}

function saveTransaction() {
  const amount = parseFloat(document.getElementById('tx-amount').value);
  const date = document.getElementById('tx-date').value;
  const note = document.getElementById('tx-note').value.trim();
  if (!amount || amount <= 0) { toast('请输入有效金额'); return; }
  if (!selectedCatId) { toast('请选择分类'); return; }
  if (!date) { toast('请选择日期'); return; }

  if (editingId) {
    const t = DATA.transactions.find(x => x.id === editingId);
    if (t) {
      t.type = modalType; t.amount = amount; t.categoryId = selectedCatId; t.date = date; t.note = note;
    }
  } else {
    DATA.transactions.push({
      id: uid(), type: modalType, amount, categoryId: selectedCatId, date, note,
      createdAt: Date.now(),
    });
  }
  saveData(DATA);
  hideModal('add-modal');
  toast(editingId ? '已更新' : '已保存');
  renderAll();
}

// ---------- 弹窗：详情 ----------
function openDetail(id) {
  const t = DATA.transactions.find(x => x.id === id);
  if (!t) return;
  const cat = getCategoryById(t.categoryId);
  const d = new Date(t.date);
  const week = ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()];
  document.getElementById('detail-content').innerHTML = `
    <div class="detail-row"><span class="detail-label">类型</span><span class="detail-value">${t.type === 'income' ? '收入' : '支出'}</span></div>
    <div class="detail-row"><span class="detail-label">金额</span><span class="detail-value" style="color:var(--${t.type})">${t.type === 'income' ? '+' : '-'}${fmt(t.amount)}</span></div>
    <div class="detail-row"><span class="detail-label">分类</span><span class="detail-value">${cat ? cat.icon + ' ' + cat.name : '未知'}</span></div>
    <div class="detail-row"><span class="detail-label">日期</span><span class="detail-value">${t.date} ${week}</span></div>
    <div class="detail-row"><span class="detail-label">备注</span><span class="detail-value">${t.note || '无'}</span></div>
    <button class="menu-item" style="width:100%;margin-top:12px" id="detail-edit">
      <span class="menu-icon">✏️</span><span class="menu-text">编辑此记录</span><span class="menu-arrow">›</span>
    </button>
  `;
  document.getElementById('detail-edit').addEventListener('click', () => {
    hideModal('detail-modal');
    openAddModal(t);
  });
  document.getElementById('detail-delete').onclick = () => {
    if (confirm('确定删除这条记录吗？')) {
      DATA.transactions = DATA.transactions.filter(x => x.id !== id);
      saveData(DATA);
      hideModal('detail-modal');
      toast('已删除');
      renderAll();
    }
  };
  showModal('detail-modal');
}

// ---------- 月份选择 ----------
function openMonthPicker() {
  const picker = document.getElementById('month-picker');
  const months = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(monthKey(d));
  }
  picker.innerHTML = months.map(k => `
    <button class="month-btn ${k === currentMonth ? 'active' : ''}" data-key="${k}">${monthLabel(k)}</button>
  `).join('');
  picker.querySelectorAll('.month-btn').forEach(b => {
    b.addEventListener('click', () => {
      currentMonth = b.dataset.key;
      hideModal('month-modal');
      renderAll();
    });
  });
  showModal('month-modal');
}

// ---------- 分类管理 ----------
function openCatManage() {
  catManageType = 'expense';
  document.querySelectorAll('.cat-tab').forEach(t => t.classList.toggle('active', t.dataset.type === catManageType));
  renderCatList();
  showModal('cat-modal');
}
function renderCatList() {
  const list = document.getElementById('cat-list');
  const cats = DATA.categories[catManageType];
  list.innerHTML = cats.map(c => `
    <div class="cat-row">
      <span class="cat-icon">${c.icon}</span>
      <span class="cat-name">${c.name}</span>
      <button class="cat-del" data-id="${c.id}">✕</button>
    </div>
  `).join('');
  list.querySelectorAll('.cat-del').forEach(b => {
    b.addEventListener('click', () => {
      if (cats.length <= 1) { toast('至少保留一个分类'); return; }
      if (confirm('删除该分类？相关记录不会被删除。')) {
        DATA.categories[catManageType] = cats.filter(c => c.id !== b.dataset.id);
        saveData(DATA);
        renderCatList();
      }
    });
  });
}
function addCategory() {
  const name = prompt('请输入分类名称');
  if (!name) return;
  const icons = ['💰','🍔','🚗','🛍️','🎮','🏠','💊','📚','✈️','📱','📦','🎁','📈','💼','💵','🍎','🎬','⚽','🎨','☕'];
  const icon = icons[Math.floor(Math.random() * icons.length)];
  DATA.categories[catManageType].push({ id: uid(), name: name.slice(0, 8), icon });
  saveData(DATA);
  renderCatList();
  toast('已添加');
}

// ---------- 导出 / 导入 ----------
function exportData() {
  const blob = new Blob([JSON.stringify(DATA, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `记账本_${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('已导出');
}
function importData(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.transactions || !data.categories) throw new Error('格式错误');
      if (confirm('导入将合并现有数据，确定继续？')) {
        const existIds = new Set(DATA.transactions.map(t => t.id));
        data.transactions.forEach(t => { if (!existIds.has(t.id)) DATA.transactions.push(t); });
        // 合并分类
        for (const type of ['expense', 'income']) {
          const exist = new Set(DATA.categories[type].map(c => c.id));
          data.categories[type].forEach(c => { if (!exist.has(c.id)) DATA.categories[type].push(c); });
        }
        saveData(DATA);
        renderAll();
        toast('导入成功');
      }
    } catch (err) {
      toast('文件格式错误');
    }
  };
  reader.readAsText(file);
}

function clearAll() {
  if (confirm('确定清空所有数据？此操作不可恢复！')) {
    DATA = defaultData();
    saveData(DATA);
    renderAll();
    toast('已清空');
  }
}

// ---------- 通用 ----------
function showModal(id) { document.getElementById(id).classList.add('show'); }
function hideModal(id) { document.getElementById(id).classList.remove('show'); }
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 1800);
}
function renderAll() {
  renderHome();
  renderListPage();
  renderStats();
  renderProfile();
}

// ---------- 页面切换 ----------
function switchPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  if (page === 'add') {
    openAddModal();
    return;
  }
  document.getElementById('page-' + page).classList.add('active');
  document.querySelector(`.tab-btn[data-page="${page}"]`).classList.add('active');
  // 重新渲染对应页面
  if (page === 'stats') renderStats();
  else if (page === 'list') renderListPage();
  else if (page === 'profile') renderProfile();
  else if (page === 'home') renderHome();
}

// ---------- 事件绑定 ----------
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchPage(btn.dataset.page));
});

document.getElementById('btn-add').addEventListener('click', () => openAddModal());
document.getElementById('add-close').addEventListener('click', () => hideModal('add-modal'));
document.getElementById('add-save').addEventListener('click', saveTransaction);

document.querySelectorAll('.type-btn').forEach(b => {
  b.addEventListener('click', () => {
    modalType = b.dataset.type;
    selectedCatId = null;
    document.querySelectorAll('.type-btn').forEach(x => x.classList.toggle('active', x === b));
    renderCategoryGrid();
  });
});

document.getElementById('btn-view-all').addEventListener('click', () => switchPage('list'));
document.getElementById('btn-month-picker').addEventListener('click', openMonthPicker);
document.getElementById('month-close').addEventListener('click', () => hideModal('month-modal'));
document.getElementById('detail-close').addEventListener('click', () => hideModal('detail-modal'));

document.querySelectorAll('.seg-btn').forEach(b => {
  b.addEventListener('click', () => {
    currentType = b.dataset.type;
    document.querySelectorAll('.seg-btn').forEach(x => x.classList.toggle('active', x === b));
    renderListPage();
  });
});

document.getElementById('btn-export').addEventListener('click', exportData);
document.getElementById('btn-import').addEventListener('click', () => document.getElementById('import-file').click());
document.getElementById('import-file').addEventListener('change', e => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ''; });
document.getElementById('btn-manage-categories').addEventListener('click', openCatManage);
document.getElementById('btn-clear-all').addEventListener('click', clearAll);

document.getElementById('cat-close').addEventListener('click', () => hideModal('cat-modal'));
document.getElementById('cat-add').addEventListener('click', addCategory);
document.querySelectorAll('.cat-tab').forEach(t => {
  t.addEventListener('click', () => {
    catManageType = t.dataset.type;
    document.querySelectorAll('.cat-tab').forEach(x => x.classList.toggle('active', x === t));
    renderCatList();
  });
});

// 点击遮罩关闭弹窗
['add-modal', 'month-modal', 'detail-modal', 'cat-modal'].forEach(id => {
  document.getElementById(id).addEventListener('click', e => {
    if (e.target.id === id) hideModal(id);
  });
});

// 阻止数字输入框的滚轮
document.getElementById('tx-amount').addEventListener('wheel', e => e.target.blur());

// 注册 Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// 初始化
renderAll();
