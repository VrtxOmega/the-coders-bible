// extension.js — The Coder's Bible VS Code Extension
// Sovereign offline developer knowledge engine
// Zero AI. Search/stats via cb.py; analyze via coders-bible-cli (Rust).
"use strict";

const vscode = require("vscode");
const { execFile } = require("child_process");
const path = require("path");
const fs   = require("fs");

let sidebarProvider;
let analyzePanel = null;

// ── Locate cb.py ──────────────────────────────────────────────────────────────
function findCbPy() {
  const cfg = vscode.workspace.getConfiguration("codersBible");
  const explicit = cfg.get("dbPath");
  if (explicit) {
    const candidate = path.join(path.dirname(explicit), "cb.py");
    if (fs.existsSync(candidate)) return candidate;
  }
  // Walk up from workspace folders
  for (const folder of (vscode.workspace.workspaceFolders || [])) {
    const candidate = path.join(folder.uri.fsPath, "cb.py");
    if (fs.existsSync(candidate)) return candidate;
  }
  // Well-known default
  const def = "C:\\Veritas_Lab\\coders-bible\\cb.py";
  if (fs.existsSync(def)) return def;
  return null;
}

function getPython() {
  return vscode.workspace.getConfiguration("codersBible").get("pythonPath") || "python";
}

// ── Run cb.py ─────────────────────────────────────────────────────────────────
function runCb(args, callback) {
  const cbPy = findCbPy();
  if (!cbPy) {
    callback(null, "ERROR: cb.py not found. Set codersBible.dbPath in settings.");
    return;
  }
  const python = getPython();
  const env = { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" };
  execFile(python, [cbPy, ...args], { env, timeout: 15000, maxBuffer: 1024 * 512 },
    (err, stdout, stderr) => {
      callback(err, stdout || stderr || "No output");
    }
  );
}

// ── Strip ANSI codes ──────────────────────────────────────────────────────────
function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*[mGKHF]/g, "");
}

// ── Sidebar WebView Provider ──────────────────────────────────────────────────
class CoderBibleSidebarProvider {
  constructor(context) {
    this._context = context;
    this._view = null;
  }

  resolveWebviewView(webviewView) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._context.extensionUri],
    };
    webviewView.webview.html = getSidebarHtml(webviewView.webview, this._context);

    webviewView.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case "search":
          this._doSearch(msg.query, msg.domain, msg.ftype, msg.limit);
          break;
        case "stats":
          this._doStats();
          break;
        case "insert":
          this._insertText(msg.text);
          break;
        case "copy":
          vscode.env.clipboard.writeText(msg.text).then(() => {
            vscode.window.showInformationMessage("The Coder Bible: Copied to clipboard");
          });
          break;
      }
    });

    // Load stats on open
    this._doStats();
  }

  _doSearch(query, domain, ftype, limit = 10) {
    if (!query || query.trim().length < 2) return;
    const args = ["search", query.trim(), "--limit", String(limit)];
    if (domain && domain !== "all") args.push("--domain", domain);
    if (ftype  && ftype  !== "all") args.push("-t", ftype);
    args.push("--json");

    this._post({ type: "loading", query });
    runCb(args, (err, out) => {
      if (err) {
        this._post({ type: "error", message: stripAnsi(out) });
        return;
      }
      try {
        const results = JSON.parse(out);
        this._post({ type: "results", results, query });
      } catch (_) {
        // cb.py may not have --json yet; parse text output
        this._post({ type: "raw", text: stripAnsi(out), query });
      }
    });
  }

  _doStats() {
    runCb(["stats", "--json"], (err, out) => {
      if (err) return;
      try {
        const stats = JSON.parse(out);
        this._post({ type: "stats", stats });
      } catch (_) {
        // ignore
      }
    });
  }

  _insertText(text) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage("The Coder Bible: No active editor to insert into.");
      return;
    }
    editor.edit((eb) => {
      eb.replace(editor.selection, text);
    });
  }

  _post(msg) {
    if (this._view) {
      this._view.webview.postMessage(msg);
    }
  }

  // Public method for keybinding command
  focusAndSearch(query) {
    if (this._view) {
      this._view.webview.postMessage({ type: "focusSearch", query: query || "" });
    }
  }
}

// ── Sidebar HTML ──────────────────────────────────────────────────────────────
function getSidebarHtml(webview, context) {
  const nonce = getNonce();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>The Coder Bible</title>
<style>
  :root {
    --gold:    #C9A84C;
    --gold2:   #E8C96D;
    --dark:    #0D0D0D;
    --surface: #141414;
    --border:  #2a2a2a;
    --text:    #E0E0E0;
    --muted:   #888;
    --gotcha:  #FF6B6B;
    --recipe:  #4ECDC4;
    --doc:     #6C91BF;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--dark);
    color: var(--text);
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 12px;
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  /* ── Header ── */
  .header {
    padding: 10px 12px 8px;
    border-bottom: 1px solid var(--border);
    background: linear-gradient(135deg, #0a0a0a 0%, #1a1500 100%);
    flex-shrink: 0;
  }
  .logo {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 8px;
  }
  .logo-omega {
    font-family: Georgia, serif;
    font-size: 18px;
    color: var(--gold);
    line-height: 1;
    text-shadow: 0 0 12px rgba(201,168,76,0.6);
  }
  .logo-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--gold2);
    letter-spacing: 0.5px;
  }

  /* ── Search bar ── */
  .search-wrap {
    display: flex;
    gap: 4px;
  }
  #searchInput {
    flex: 1;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 5px 8px;
    border-radius: 4px;
    font-size: 12px;
    outline: none;
    transition: border-color 0.15s;
  }
  #searchInput:focus { border-color: var(--gold); }
  #searchInput::placeholder { color: var(--muted); }

  .btn {
    background: linear-gradient(135deg, var(--gold), #b8941a);
    color: #000;
    border: none;
    border-radius: 4px;
    padding: 5px 10px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .btn:hover { opacity: 0.85; }
  .btn-sm {
    background: var(--surface);
    color: var(--gold);
    border: 1px solid var(--border);
    font-weight: 600;
    padding: 3px 7px;
    font-size: 10px;
  }

  /* ── Filters ── */
  .filters {
    display: flex;
    gap: 4px;
    margin-top: 6px;
    flex-wrap: wrap;
  }
  .filters select {
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 3px 5px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    flex: 1;
    min-width: 70px;
  }
  .filters select:focus { outline: 1px solid var(--gold); }

  /* ── Stats bar ── */
  .stats-bar {
    padding: 5px 12px;
    background: #0f0f0f;
    border-bottom: 1px solid var(--border);
    display: flex;
    gap: 10px;
    font-size: 10px;
    color: var(--muted);
    flex-shrink: 0;
  }
  .stat-pill {
    display: flex;
    align-items: center;
    gap: 3px;
  }
  .stat-pill .dot {
    width: 6px; height: 6px;
    border-radius: 50%;
  }
  .dot-total  { background: var(--gold); }
  .dot-gotcha { background: var(--gotcha); }
  .dot-recipe { background: var(--recipe); }
  .dot-doc    { background: var(--doc); }

  /* ── Results ── */
  .results-wrap {
    flex: 1;
    overflow-y: auto;
    padding: 6px 8px;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }
  .results-wrap::-webkit-scrollbar { width: 4px; }
  .results-wrap::-webkit-scrollbar-track { background: transparent; }
  .results-wrap::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

  .result-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-left: 3px solid var(--gold);
    border-radius: 4px;
    margin-bottom: 6px;
    padding: 7px 9px;
    transition: border-color 0.15s, background 0.15s;
    cursor: default;
  }
  .result-card:hover { background: #1a1a1a; border-color: #3a3a3a; }
  .result-card.gotcha { border-left-color: var(--gotcha); }
  .result-card.recipe { border-left-color: var(--recipe); }
  .result-card.doc    { border-left-color: var(--doc); }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 5px;
  }
  .card-badges {
    display: flex;
    gap: 4px;
    align-items: center;
  }
  .badge {
    font-size: 9px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 3px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .badge-gotcha { background: rgba(255,107,107,0.2); color: var(--gotcha); border: 1px solid rgba(255,107,107,0.3); }
  .badge-recipe { background: rgba(78,205,196,0.2); color: var(--recipe); border: 1px solid rgba(78,205,196,0.3); }
  .badge-doc    { background: rgba(108,145,191,0.2); color: var(--doc);    border: 1px solid rgba(108,145,191,0.3); }
  .badge-domain {
    font-size: 9px; font-weight: 600;
    color: var(--gold); background: rgba(201,168,76,0.12);
    border: 1px solid rgba(201,168,76,0.25);
    padding: 1px 5px; border-radius: 3px;
  }

  .card-actions {
    display: flex;
    gap: 3px;
  }

  .card-content {
    font-family: 'Cascadia Code', 'Courier New', monospace;
    font-size: 11px;
    color: #ccc;
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.5;
    max-height: 120px;
    overflow: hidden;
    position: relative;
  }
  .card-content.expanded { max-height: none; }
  .card-expand {
    font-size: 10px;
    color: var(--gold);
    cursor: pointer;
    margin-top: 3px;
    display: inline-block;
  }
  .card-source {
    font-size: 9px;
    color: #444;
    margin-top: 5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ── States ── */
  .state-msg {
    text-align: center;
    color: var(--muted);
    padding: 30px 16px;
    line-height: 1.7;
  }
  .state-msg .omega {
    font-family: Georgia, serif;
    font-size: 32px;
    color: var(--gold);
    display: block;
    text-shadow: 0 0 20px rgba(201,168,76,0.4);
    margin-bottom: 8px;
  }
  .loading-bar {
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--gold), transparent);
    animation: sweep 1.2s infinite;
    margin: 12px 0;
  }
  @keyframes sweep {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  .result-meta {
    font-size: 10px;
    color: var(--muted);
    padding: 4px 0 8px;
  }
</style>
</head>
<body>

<div class="header">
  <div class="logo">
    <span class="logo-omega">Ω</span>
    <span class="logo-title">THE CODER BIBLE</span>
  </div>
  <div class="search-wrap">
    <input id="searchInput" type="text" placeholder="Search gotchas, recipes, docs..." autocomplete="off">
    <button class="btn" onclick="doSearch()">Go</button>
  </div>
  <div class="filters">
    <select id="domainFilter">
      <option value="all">All Domains</option>
      <option value="python">Python</option>
      <option value="javascript">JavaScript</option>
      <option value="typescript">TypeScript</option>
      <option value="rust">Rust</option>
      <option value="golang">Go</option>
      <option value="bash">Bash</option>
      <option value="sql">SQL</option>
      <option value="docker">Docker</option>
      <option value="kubernetes">Kubernetes</option>
      <option value="css">CSS</option>
      <option value="git">Git</option>
      <option value="makefile">Makefile</option>
      <option value="regex">Regex</option>
    </select>
    <select id="ftypeFilter">
      <option value="all">All Types</option>
      <option value="gotcha">!! Gotchas</option>
      <option value="recipe">&gt;&gt; Recipes</option>
      <option value="doc">-- Docs</option>
    </select>
    <select id="limitFilter">
      <option value="10">10</option>
      <option value="20">20</option>
      <option value="50">50</option>
    </select>
  </div>
</div>

<div class="stats-bar" id="statsBar">
  <span class="stat-pill"><span class="dot dot-total"></span><span id="statTotal">--</span> total</span>
  <span class="stat-pill"><span class="dot dot-gotcha"></span><span id="statGotcha">--</span> gotchas</span>
  <span class="stat-pill"><span class="dot dot-recipe"></span><span id="statRecipe">--</span> recipes</span>
  <span class="stat-pill"><span class="dot dot-doc"></span><span id="statDoc">--</span> docs</span>
</div>

<div class="results-wrap" id="resultsWrap">
  <div class="state-msg">
    <span class="omega">Ω</span>
    Sovereign offline knowledge.<br>
    <strong style="color:#ccc">60K+ fragments.</strong><br>
    No internet. No AI. Pure signal.<br><br>
    <small>Ctrl+Shift+B to search</small>
  </div>
</div>

<script nonce="${nonce}">
const vscode = acquireVsCodeApi();

// ── Search ────────────────────────────────────────────────────────────────────
function doSearch() {
  const query  = document.getElementById('searchInput').value.trim();
  const domain = document.getElementById('domainFilter').value;
  const ftype  = document.getElementById('ftypeFilter').value;
  const limit  = document.getElementById('limitFilter').value;
  if (!query) return;
  vscode.postMessage({ type: 'search', query, domain, ftype, limit: parseInt(limit) });
}

document.getElementById('searchInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') doSearch();
});

// ── Render ────────────────────────────────────────────────────────────────────
function ftypeBadge(ftype) {
  const f = (ftype || 'doc').toLowerCase();
  const labels = { gotcha: '!! Gotcha', recipe: '>> Recipe', doc: '-- Doc' };
  return '<span class="badge badge-' + f + '">' + (labels[f] || f) + '</span>';
}

function renderCard(r, idx) {
  const ftype   = (r.ftype || 'doc').toLowerCase();
  const domain  = r.domain || (r.source || '').split('/')[0] || '';
  const content = (r.content || r.text || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const source  = (r.source || '').replace('@raw.githubusercontent.com','');
  const isLong  = (r.content || '').length > 300;

  return \`
<div class="result-card \${ftype}" id="card\${idx}">
  <div class="card-header">
    <div class="card-badges">
      \${ftypeBadge(ftype)}
      \${domain ? '<span class="badge badge-domain">' + domain + '</span>' : ''}
    </div>
    <div class="card-actions">
      <button class="btn btn-sm" onclick="insertResult(\${idx})" title="Insert at cursor">INS</button>
      <button class="btn btn-sm" onclick="copyResult(\${idx})" title="Copy to clipboard">CPY</button>
    </div>
  </div>
  <div class="card-content" id="content\${idx}">\${content.slice(0,600)}</div>
  \${isLong ? '<span class="card-expand" onclick="expandCard(' + idx + ')">Show more ↓</span>' : ''}
  <div class="card-source" title="\${source}">\${source.slice(0, 80)}</div>
</div>\`;
}

const _contents = {};

function expandCard(idx) {
  const el = document.getElementById('content' + idx);
  el.classList.toggle('expanded');
  const btn = el.nextElementSibling;
  if (btn && btn.classList.contains('card-expand')) {
    btn.textContent = el.classList.contains('expanded') ? 'Show less ↑' : 'Show more ↓';
  }
}

function insertResult(idx) {
  vscode.postMessage({ type: 'insert', text: _contents[idx] || '' });
}
function copyResult(idx) {
  vscode.postMessage({ type: 'copy', text: _contents[idx] || '' });
}

// ── Message handler ───────────────────────────────────────────────────────────
window.addEventListener('message', e => {
  const msg = e.data;
  const wrap = document.getElementById('resultsWrap');

  switch (msg.type) {
    case 'loading':
      wrap.innerHTML = '<div class="state-msg"><div class="loading-bar"></div>Searching for <strong style="color:#ccc">' + msg.query + '</strong>...</div>';
      break;

    case 'results': {
      const results = msg.results || [];
      if (!results.length) {
        wrap.innerHTML = '<div class="state-msg">No results for <strong style="color:#ccc">' + msg.query + '</strong></div>';
        return;
      }
      let html = '<div class="result-meta">' + results.length + ' result' + (results.length !== 1 ? 's' : '') + ' for <strong style="color:#ccc">' + msg.query + '</strong></div>';
      results.forEach((r, i) => {
        _contents[i] = r.content || r.text || '';
        html += renderCard(r, i);
      });
      wrap.innerHTML = html;
      break;
    }

    case 'raw': {
      // plain text fallback
      wrap.innerHTML = '<div class="state-msg" style="text-align:left;padding:10px"><pre style="white-space:pre-wrap;font-size:11px;color:#bbb">' + (msg.text || '').replace(/</g,'&lt;').slice(0,4000) + '</pre></div>';
      break;
    }

    case 'error':
      wrap.innerHTML = '<div class="state-msg" style="color:#FF6B6B">Error: ' + msg.message + '</div>';
      break;

    case 'stats': {
      const s = msg.stats || {};
      document.getElementById('statTotal').textContent  = (s.total  || '--').toLocaleString();
      document.getElementById('statGotcha').textContent = (s.gotcha || '--').toLocaleString();
      document.getElementById('statRecipe').textContent = (s.recipe || '--').toLocaleString();
      document.getElementById('statDoc').textContent    = (s.doc    || '--').toLocaleString();
      
      if (s.domains) {
        const df = document.getElementById('domainFilter');
        const currentVal = df.value;
        let html = '<option value="all">All Domains</option>';
        const sortedDomains = Object.keys(s.domains).sort();
        for (const d of sortedDomains) {
          const cap = d.charAt(0).toUpperCase() + d.slice(1);
          html += '<option value="' + d + '">' + cap + ' (' + s.domains[d].toLocaleString() + ')</option>';
        }
        df.innerHTML = html;
        if (sortedDomains.includes(currentVal) || currentVal === 'all') {
          df.value = currentVal;
        } else {
          df.value = 'all';
        }
      }
      break;
    }

    case 'focusSearch':
      document.getElementById('searchInput').value = msg.query || '';
      document.getElementById('searchInput').focus();
      if (msg.query) doSearch();
      break;
  }
});
</script>
</body>
</html>`;
}

function getNonce() {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// ── Locate coders-bible-cli (Rust binary) ─────────────────────────────────────
function findBibleBin() {
  const cfg = vscode.workspace.getConfiguration("codersBible");
  const explicit = (cfg.get("binPath") || "").trim();
  if (explicit && fs.existsSync(explicit)) return explicit;

  const exe = process.platform === "win32" ? ".exe" : "";
  const names = [`coders-bible-cli${exe}`, `cb${exe}`];

  // Workspace-relative builds
  for (const folder of (vscode.workspace.workspaceFolders || [])) {
    for (const sub of ["target/release", "target/debug", "bin"]) {
      for (const n of names) {
        const c = path.join(folder.uri.fsPath, sub, n);
        if (fs.existsSync(c)) return c;
      }
    }
  }

  // PATH lookup
  const dirs = (process.env.PATH || "").split(path.delimiter);
  for (const d of dirs) {
    for (const n of names) {
      const c = path.join(d, n);
      if (c && fs.existsSync(c)) return c;
    }
  }
  return null;
}

// ── Run analyze via Rust CLI ──────────────────────────────────────────────────
// CLI signature: `cb --json analyze <snippet...>` — snippet is positional Vec<String>.
function runAnalyze(snippet, callback) {
  const bin = findBibleBin();
  if (!bin) {
    callback(new Error("not-found"), null);
    return;
  }
  // Long selections can exceed CMD's 8KB limit on Windows. The web/desktop
  // engine truncates analyze input the same way; cap to 8000 chars here.
  const safe = snippet.length > 8000 ? snippet.slice(0, 8000) : snippet;
  execFile(bin, ["--json", "analyze", safe],
    { timeout: 15000, maxBuffer: 2 * 1024 * 1024, windowsHide: true },
    (err, stdout, stderr) => {
      if (err) { callback(err, stderr || err.message); return; }
      try { callback(null, JSON.parse(stdout)); }
      catch (e) { callback(e, stdout); }
    }
  );
}

// ── Render analyze result as a webview ────────────────────────────────────────
function showAnalyzeResult(snippet, data, context) {
  const column = vscode.window.activeTextEditor?.viewColumn;
  if (analyzePanel) {
    analyzePanel.reveal(column);
  } else {
    analyzePanel = vscode.window.createWebviewPanel(
      "codersBibleAnalyze", "Coder's Bible — Analyze",
      column ?? vscode.ViewColumn.Beside,
      { enableScripts: false, retainContextWhenHidden: true }
    );
    analyzePanel.onDidDispose(() => { analyzePanel = null; }, null, context.subscriptions);
  }
  analyzePanel.webview.html = renderAnalyzeHtml(snippet, data);
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function renderAnalyzeHtml(snippet, d) {
  const lang = d.language || {};
  const safety = d.safety || {};
  const breakdown = d.breakdown || [];
  const keywords = d.keywords || [];
  const results = d.results || [];

  const safetyColor = safety.level === "DESTRUCTIVE" ? "#FF6B6B"
                    : safety.level === "CAUTION"     ? "#E8C96D"
                    : "#4ECDC4";
  const warnings = (safety.warnings || []).map(w =>
    `<li>${escapeHtml(w.message || w)}</li>`).join("");
  const notes = (safety.safe_notes || []).map(n =>
    `<li>${escapeHtml(n)}</li>`).join("");
  const breakdownRows = breakdown.map(b =>
    `<tr><td><code>${escapeHtml(b.code)}</code></td><td class="concept">${escapeHtml(b.concept)}</td></tr>`
  ).join("");
  const keywordPills = keywords.map(k =>
    `<span class="pill">${escapeHtml(k)}</span>`).join("");
  const refList = results.slice(0, 8).map(r => `
    <div class="ref">
      <div class="ref-src">${escapeHtml(r.source || "")}</div>
      <pre class="ref-body">${escapeHtml((r.content || "").slice(0, 400))}</pre>
    </div>`).join("");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 16px; }
  h2 { color: #C9A84C; border-bottom: 1px solid #2a2a2a; padding-bottom: 6px; margin-top: 22px; }
  .qu { background: rgba(201,168,76,0.08); border-left: 3px solid #C9A84C; padding: 10px 14px; border-radius: 4px; margin-bottom: 16px; }
  .lang-badge { display: inline-block; padding: 6px 14px; border-radius: 6px; background: ${escapeHtml(lang.color || "#C9A84C")}; color: #000; font-weight: 700; }
  .conf { margin-left: 10px; color: var(--vscode-descriptionForeground); }
  pre { background: var(--vscode-textBlockQuote-background); padding: 8px 10px; border-radius: 4px; white-space: pre-wrap; word-break: break-word; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 4px 8px; vertical-align: top; border-bottom: 1px solid rgba(255,255,255,0.05); }
  td.concept { color: #C9A84C; font-size: 0.9em; white-space: nowrap; }
  .pill { display: inline-block; background: rgba(201,168,76,0.12); color: #E8C96D; padding: 2px 8px; border-radius: 99px; margin: 0 4px 4px 0; font-size: 0.85em; }
  .safety { padding: 10px 14px; border-radius: 4px; border-left: 3px solid ${safetyColor}; background: rgba(255,255,255,0.03); }
  .ref { background: rgba(255,255,255,0.02); padding: 8px 10px; border-radius: 4px; margin-bottom: 8px; border-left: 2px solid #2a2a2a; }
  .ref-src { font-size: 0.8em; color: var(--vscode-descriptionForeground); margin-bottom: 4px; }
  .ref-body { font-size: 0.85em; margin: 0; }
</style></head><body>
  ${d.quick_understanding ? `<div class="qu">⚡ ${escapeHtml(d.quick_understanding)}</div>` : ""}

  <h2>Identification</h2>
  <span class="lang-badge">${escapeHtml(lang.language || "Unknown")}</span>
  <span class="conf">${Math.round((lang.confidence || 0) * 100)}% — ${escapeHtml(lang.reasoning || "")}</span>
  <pre style="margin-top:10px">${escapeHtml(snippet)}</pre>

  ${breakdownRows ? `<h2>Semantic Decomposition</h2><table>${breakdownRows}</table>` : ""}

  <h2>Safety Assessment</h2>
  <div class="safety">
    <strong style="color:${safetyColor}">${escapeHtml(safety.level || "SAFE")}</strong>
    ${warnings ? `<ul>${warnings}</ul>` : ""}
    ${notes && !warnings ? `<ul>${notes}</ul>` : ""}
  </div>

  ${keywordPills ? `<h2>Keywords</h2><div>${keywordPills}</div>` : ""}

  ${refList ? `<h2>Bible References</h2>${refList}` : ""}
</body></html>`;
}

// ── Activate ──────────────────────────────────────────────────────────────────
function activate(context) {
  sidebarProvider = new CoderBibleSidebarProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("codersBible.sidebar", sidebarProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  // Search command (keybinding)
  context.subscriptions.push(
    vscode.commands.registerCommand("codersBible.search", () => {
      vscode.commands.executeCommand("workbench.view.extension.codersBible");
      const selection = vscode.window.activeTextEditor?.document.getText(
        vscode.window.activeTextEditor.selection
      );
      setTimeout(() => {
        sidebarProvider.focusAndSearch(selection || "");
      }, 200);
    })
  );

  // Analyze command (right-click on selection)
  context.subscriptions.push(
    vscode.commands.registerCommand("codersBible.analyze", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage("Coder's Bible: open a file and select code to analyze.");
        return;
      }
      const snippet = editor.document.getText(editor.selection) || editor.document.getText();
      if (!snippet.trim()) {
        vscode.window.showWarningMessage("Coder's Bible: nothing to analyze.");
        return;
      }
      vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "Coder's Bible: analyzing…" },
        () => new Promise(resolve => {
          runAnalyze(snippet, (err, data) => {
            if (err && err.message === "not-found") {
              vscode.window.showErrorMessage(
                "coders-bible-cli not found. Install the Rust CLI from github.com/VrtxOmega/the-coders-bible/releases, or set codersBible.binPath."
              );
            } else if (err) {
              vscode.window.showErrorMessage(`Coder's Bible: analyze failed — ${err.message || err}`);
            } else {
              showAnalyzeResult(snippet, data, context);
            }
            resolve();
          });
        })
      );
    })
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
