const listEl = document.getElementById('list');
const historyEl = document.getElementById('history');
const countEl = document.getElementById('count');

const items = new Map();

function fmtSize(bytes) {
  if (!bytes && bytes !== 0) return '--';
  const units = ['B','KB','MB','GB','TB'];
  let i = 0; let b = bytes;
  while (b >= 1024 && i < units.length - 1) { b /= 1024; i++; }
  return `${b.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function renderItem(data) {
  let row = document.getElementById(`item-${data.id}`);
  if (!row) {
    row = document.createElement('div');
    row.className = 'item';
    row.id = `item-${data.id}`;
    const meta = document.createElement('div');
    meta.className = 'meta';
    const name = document.createElement('div');
    name.className = 'name';
    const stats = document.createElement('div');
    stats.className = 'stats';
    const bar = document.createElement('div');
    bar.className = 'bar';
    const barInner = document.createElement('div');
    bar.appendChild(barInner);
    meta.appendChild(name);
    meta.appendChild(stats);
    meta.appendChild(bar);
    const actions = document.createElement('div');
    actions.className = 'actions';
    const openBtn = document.createElement('button');
    openBtn.className = 'btn';
    openBtn.textContent = '打开文件';
    openBtn.onclick = () => window.downloadsAPI.openFile(data.id);
    const folderBtn = document.createElement('button');
    folderBtn.className = 'btn';
    folderBtn.textContent = '打开文件夹';
    folderBtn.onclick = () => window.downloadsAPI.openFolder(data.id);
    actions.appendChild(openBtn);
    actions.appendChild(folderBtn);
    row.appendChild(meta);
    row.appendChild(actions);
    listEl.appendChild(row);
  }
  const nameEl = row.querySelector('.name');
  const statsEl = row.querySelector('.stats');
  const barInnerEl = row.querySelector('.bar > div');
  const barEl = row.querySelector('.bar');
  nameEl.textContent = data.filename;
  const pct = data.totalBytes > 0 ? Math.floor((data.receivedBytes / data.totalBytes) * 100) : 0;
  if (data.state === 'downloading') {
    if (barEl) barEl.style.display = 'block';
    barInnerEl.style.width = `${pct}%`;
    const speedStr = data.speed ? `${fmtSize(data.speed)}/s` : '--';
    statsEl.textContent = `${fmtSize(data.receivedBytes)} / ${fmtSize(data.totalBytes)} · ${speedStr}`;
  } else {
    if (barEl) barEl.style.display = 'none';
    statsEl.textContent = `${fmtSize(data.totalBytes)} · ${data.state === 'completed' ? '已完成' : '已取消'}`;
  }
}

function renderHistory(itemsArr) {
  historyEl.innerHTML = '';
  itemsArr.forEach(d => {
    const row = document.createElement('div');
    row.className = 'item';
    const meta = document.createElement('div');
    meta.className = 'meta';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = d.filename;
    const stats = document.createElement('div');
    stats.className = 'stats';
    stats.textContent = `${fmtSize(d.totalBytes)} · ${d.state === 'completed' ? '已完成' : '已取消'}`;
    meta.appendChild(name);
    meta.appendChild(stats);
    const actions = document.createElement('div');
    actions.className = 'actions';
    const openBtn = document.createElement('button');
    openBtn.className = 'btn';
    openBtn.textContent = '打开文件';
    openBtn.onclick = () => window.downloadsAPI.openFile(d.id);
    const folderBtn = document.createElement('button');
    folderBtn.className = 'btn';
    folderBtn.textContent = '打开文件夹';
    folderBtn.onclick = () => window.downloadsAPI.openFolder(d.id);
    row.appendChild(meta);
    actions.appendChild(openBtn);
    actions.appendChild(folderBtn);
    row.appendChild(actions);
    historyEl.appendChild(row);
  });
}

window.downloadsAPI.onStart((data) => {
  items.set(data.id, data);
  renderItem(data);
  countEl.textContent = `共 ${items.size} 项`;
});

window.downloadsAPI.onProgress((data) => {
  items.set(data.id, data);
  renderItem(data);
});

window.downloadsAPI.onComplete((data) => {
  items.set(data.id, data);
  renderItem(data);
});

window.downloadsAPI.onCancelled((data) => {
  items.set(data.id, data);
  renderItem(data);
});

window.downloadsAPI.onList(({ list, history }) => {
  list.forEach(d => { items.set(d.id, d); renderItem(d); });
  countEl.textContent = `共 ${items.size} 项`;
  renderHistory(history);
});

window.downloadsAPI.windowReady();
