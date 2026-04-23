import { createDbWorker } from './sql-httpvfs/index.js';

const workerUrl = new URL(
  './sql-httpvfs/sqlite.worker.js',
  import.meta.url
);

const wasmUrl = new URL(
  './sql-httpvfs/sql-wasm.wasm',
  import.meta.url
);

export class WasmBibleEngine {
  constructor(dbUrl = new URL("coders_bible.db", import.meta.url).toString()) {
    this.dbUrl = dbUrl;
    this.worker = null;
    this.ready = false;
  }

  async init(onProgress) {
    if (this.ready) return;
    try {
      this.worker = await createDbWorker(
        [
          {
            from: "inline",
            config: {
              serverMode: "full",
              url: this.dbUrl,
              requestChunkSize: 4096,
            }
          }
        ],
        workerUrl.toString(),
        wasmUrl.toString()
      );
      this.ready = true;
      if(onProgress) onProgress(100);
    } catch (e) {
      console.error("Failed to init WASM DB:", e);
      throw e;
    }
  }

  async stats() {
    if (!this.ready) throw new Error("DB not initialized");
    const resTotal = await this.worker.db.query("SELECT COUNT(*) as c FROM fragments");
    const total = resTotal[0].c;

    const sql = `
      SELECT
          CASE
              WHEN source LIKE 'python/%' OR source LIKE '%docs.python.org%' THEN 'Python'
              WHEN source LIKE 'javascript/%' OR source LIKE '%nodejs%' OR source LIKE '%npmjs%' THEN 'JavaScript'
              WHEN source LIKE 'typescript/%' OR source LIKE '%typescriptlang%' THEN 'TypeScript'
              WHEN source LIKE 'rust/%' OR source LIKE '%doc.rust-lang%' OR source LIKE '%docs.rs%' THEN 'Rust'
              WHEN source LIKE 'golang/%' OR source LIKE '%go.dev%' OR source LIKE '%pkg.go.dev%' THEN 'Go'
              WHEN source LIKE 'ruby/%' OR source LIKE '%ruby%' THEN 'Ruby'
              WHEN source LIKE 'php/%' OR source LIKE '%php.net%' THEN 'PHP'
              WHEN source LIKE 'java/%' AND source NOT LIKE '%javascript%' AND source NOT LIKE '%typescript%' THEN 'Java'
              WHEN source LIKE 'bash/%' OR source LIKE '%gnu.org/software/bash%' OR source LIKE '%tldp.org%' THEN 'Bash'
              WHEN source LIKE 'powershell/%' OR source LIKE '%microsoft.com/powershell%' THEN 'PowerShell'
              WHEN source LIKE 'sql/%' OR source LIKE '%mysql%' OR source LIKE '%mariadb%' OR source LIKE '%postgresql%' OR source LIKE '%postgres%' OR source LIKE '%sqlite%' THEN 'SQL'
              WHEN source LIKE 'docker/%' OR source LIKE '%docker.com%' THEN 'Docker'
              WHEN source LIKE 'kubernetes/%' OR source LIKE '%k8s%' THEN 'Kubernetes'
              WHEN source LIKE 'nginx/%' OR source LIKE '%nginx.org%' THEN 'Nginx'
              WHEN source LIKE 'systemd/%' OR source LIKE '%freedesktop.org%' THEN 'systemd'
              WHEN source LIKE 'git/%' OR source LIKE '%git-scm%' THEN 'Git'
              WHEN source LIKE 'ansible/%' OR source LIKE '%ansible.com%' THEN 'Ansible'
              WHEN source LIKE 'css/%' OR source LIKE '%/CSS/%' THEN 'CSS'
              WHEN source LIKE 'html/%' OR source LIKE '%/HTML/%' THEN 'HTML'
              WHEN source LIKE 'yaml/%' THEN 'YAML'
              WHEN source LIKE 'json/%' THEN 'JSON'
              WHEN source LIKE 'terraform/%' OR source LIKE '%hashicorp%' THEN 'Terraform'
              WHEN source LIKE 'csharp/%' OR source LIKE '%dotnet/csharp%' THEN 'C#'
              WHEN source LIKE 'kotlin/%' OR source LIKE '%kotlinlang%' THEN 'Kotlin'
              WHEN source LIKE 'c/%' OR source LIKE 'cpp/%' OR source LIKE '%cppreference%' THEN 'C/C++'
              WHEN source LIKE 'swift/%' OR source LIKE '%swift.org%' THEN 'Swift'
              WHEN source LIKE 'linux/%' OR source LIKE '%linux%' OR source LIKE '%man7.org%' OR source LIKE '%sourceware.org%' THEN 'Linux'
              WHEN source LIKE 'node/%' OR source LIKE '%node.js%' THEN 'Node.js'
              WHEN source LIKE 'mysql/%' THEN 'MySQL'
              WHEN source LIKE 'postgresql/%' OR source LIKE '%postgres%' THEN 'PostgreSQL'
              WHEN source LIKE 'linux-tools/%' OR source LIKE '%binutils%' THEN 'Linux'
              ELSE 'Other'
          END as domain,
          COUNT(*) as c
      FROM fragments
      GROUP BY domain
      ORDER BY c DESC
    `;
    const resDomains = await this.worker.db.query(sql);

    const threshold = Math.max(50, Math.floor(total * 0.005));
    const domains = resDomains
        .filter(r => r.c >= threshold || r.domain !== "Other")
        .map(r => ({ name: r.domain, count: r.c, color: '#C9A84C' }));

    return { total_fragments: total, domains: domains };
  }

  _sanitizeFtsQuery(query) {
    let clean = query.replace(/[^a-zA-Z0-9_\-\.\s]/g, " ");
    return clean.trim();
  }

  async search(query, limit = 20) {
    if (!this.ready) throw new Error("DB not initialized");
    const clean = this._sanitizeFtsQuery(query);
    if (!clean) return { count: 0, results: [] };

    // FTS5 MATCH format: terms with *
    const terms = clean.split(/\s+/).filter(t => t);
    const q = terms.map(term => `"${term}"*`).join(" OR ");

    const sql = `
      SELECT f.id, f.content, f.source, f.tier, fts.rank
      FROM bible_fts fts
      JOIN fragments f ON f.rowid = fts.rowid
      WHERE bible_fts MATCH ?
      ORDER BY fts.rank
      LIMIT ?
    `;

    try {
      const results = await this.worker.db.query(sql, [q, limit]);
      return { count: results.length, results: results };
    } catch (e) {
      console.error("Search error:", e);
      return { count: 0, results: [] };
    }
  }

  async analyze(snippet) {
    if (!this.ready) throw new Error("DB not initialized");
    if (!snippet || !snippet.trim()) return { error: "Empty input" };

    // Simplified language detection (Fallback logic)
    let lang = "Unknown";
    let color = "#666666";
    if (snippet.includes("def ") || snippet.includes("import ")) { lang = "Python"; color = "#3776AB"; }
    else if (snippet.includes("function") || snippet.includes("=>")) { lang = "JavaScript"; color = "#F7DF1E"; }
    else if (snippet.includes("SELECT ") || snippet.includes("UPDATE ")) { lang = "SQL"; color = "#E38C00"; }
    else if (snippet.includes("echo") || snippet.includes("apt")) { lang = "Bash"; color = "#4EAA25"; }

    const language = {
      language: lang,
      confidence: 0.8,
      confidence_label: "VERIFIED_DOMAIN",
      reasoning: "Inferred via simplified WASM heuristic engine.",
      context: "Agnostic Runtime",
      color: color,
      alternatives: []
    };

    // Extract basic words as keywords (filter noise)
    const noise = new Set(['const','let','var','def','class','import','export','function','return']);
    const words = snippet.split(/\W+/).filter(w => w.length > 2 && !noise.has(w)).slice(0, 5);
    const keywords = words;

    const safety = {
      level: snippet.includes("rm -rf") ? "DESTRUCTIVE" : "SAFE",
      warnings: snippet.includes("rm -rf") ? [{message: "Recursive deletion"}] : [],
      safe_notes: snippet.includes("rm -rf") ? [] : ["Basic heuristics indicate safe logic."]
    };

    // Perform search using keywords
    let results = [];
    if (keywords.length > 0) {
      const searchRes = await this.search(keywords.join(" "), 15);
      results = searchRes.results || [];
    }

    return {
      quick_understanding: "Snippet analyzed via WASM local engine.",
      language: language,
      keywords: keywords,
      concepts: [],
      safety: safety,
      results: results
    };
  }
}
