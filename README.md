<div align="center">
  <img src="https://raw.githubusercontent.com/VrtxOmega/Gravity-Omega/master/omega_icon.png" width="100" alt="CODER'S BIBLE" />
  <h1>CODER'S BIBLE</h1>
  <p><strong>Sovereign documentation knowledge engine — VERITAS & Omega Ecosystem</strong></p>
  <p>
    <a href="https://vrtxomega.github.io/the-coders-bible/"><strong>→ Open the live engine ←</strong></a>
  </p>
</div>

<div align="center">

![Status](https://img.shields.io/badge/Status-SHIPPED-success?style=for-the-badge&labelColor=000000&color=d4af37)
![Version](https://img.shields.io/badge/Version-v2.1.0-informational?style=for-the-badge&labelColor=000000&color=d4af37)
![Fragments](https://img.shields.io/badge/Fragments-67%2C213-informational?style=for-the-badge&labelColor=000000)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge&labelColor=000000)

</div>

---

**67,213 curated code fragments. 25 domains. Zero AI. Zero network. Pure signal.**

Coder's Bible is the developer knowledge engine of the Omega Universe. It harvests deterministic facts from official sources (man pages, SDK references, CLI docs, language references), tags every fragment with its provenance tier, and exposes them through five distinct surfaces — web, PWA, desktop app, VS Code extension, and a single-binary CLI. No cloud relay. No cache. No telemetry. Your queries never leave the machine.

---

## Surfaces

| Surface | What it is | Where to get it |
|---|---|---|
| **Web** | Live in any browser at vrtxomega.github.io/the-coders-bible | [Open](https://vrtxomega.github.io/the-coders-bible/) |
| **PWA** | Same site, installable as a native window via Edge/Chrome | Visit the site, click the install icon in the URL bar |
| **Desktop** | Tauri app — global Ctrl+Shift+Space hotkey, tray icon, real FTS5 | [Releases](https://github.com/VrtxOmega/coders-bible-desktop/releases) (.msi, .dmg, .deb, .AppImage, .rpm) |
| **VS Code** | Sidebar search + right-click "Analyze with Coder's Bible" | [coders-bible-2.1.0.vsix](vscode-extension/coders-bible-2.1.0.vsix) |
| **CLI** | Single ~4 MB Rust binary; `cb "docker compose"`, `cb analyze` | [Releases](https://github.com/VrtxOmega/coders-bible-cli/releases) |

All five surfaces share the same underlying database and analysis logic. Fragments are deterministic — the same query returns the same result on every machine, every day.

---

## What you can do

- **Search** 67K fragments instantly. FTS5 in the desktop/CLI/VS Code; ranked LIKE in the browser (sql.js stock build doesn't include FTS5).
- **Analyze** any pasted snippet. Identifies the language across 25 supported languages with confidence scoring; produces a line-by-line semantic decomposition; flags destructive patterns (rm -rf, DROP TABLE, eval, etc.) and surfaces matching Bible references.
- **Browse** by domain — Python, JavaScript, TypeScript, Rust, Go, Ruby, PHP, Java, Bash, PowerShell, SQL, Docker, Kubernetes, Nginx, systemd, Git, Ansible, Terraform, Linux, CSS, HTML, YAML, JSON, C/C++, Swift.

Everything works offline. The desktop ships the database bundled inside the installer; the PWA pulls a 64 MB SQLite file on first visit and caches it in IndexedDB.

---

## Architecture

```
                      Curated harvest sources
                  ┌──────────────────────────┐
                  │  pkg.go.dev   ruby-doc   │
                  │  doc.rust-lang.org       │
                  │  docs.docker.com         │
                  │  kubernetes.io           │
                  │  man7.org   ss64.com     │
                  │  python docs   git-scm   │
                  └────────────┬─────────────┘
                               │
                               ▼
                  ┌──────────────────────────┐
                  │  Ingestion pipeline      │
                  │  scrape → parse → tier   │
                  │  → embed → SQLite + FTS5 │
                  └────────────┬─────────────┘
                               │
                               ▼
              coders_bible.db  (~64 MB, 67,213 rows, A-B provenance)
                               │
            ┌──────────┬──────┴──────┬────────────┬──────────┐
            ▼          ▼             ▼            ▼          ▼
          Web        PWA         Desktop      VS Code      CLI
        (sql.js)  (sql.js +    (Tauri +     (cb.py /     (Rust +
                  IndexedDB)    rusqlite)    Rust CLI)    rusqlite)
```

The harvest pipeline is in this repo (`harvest_*.py`, `cb.py`). The five surface implementations live in their own repos for clean release independence:

| Component | Repo |
|---|---|
| Harvest pipeline + cb.py + web frontend | [VrtxOmega/the-coders-bible](https://github.com/VrtxOmega/the-coders-bible) |
| Tauri desktop + PWA assets | [VrtxOmega/coders-bible-desktop](https://github.com/VrtxOmega/coders-bible-desktop) |
| Rust CLI binary | [VrtxOmega/coders-bible-cli](https://github.com/VrtxOmega/coders-bible-cli) |

---

## How the data is built

The Python harvest pipeline runs on a governed cadence — typically nightly via cron — and ingests documentation from the source list above. Each scraper extracts deterministic facts (commands, syntax, flags, types, examples), tags them with a provenance tier, and stores them with a SHA-256–derived identifier for deduplication.

```bash
# Single-territory harvest (Go stdlib)
python harvest_go.py

# Full ecosystem scan
python ecosystem_scan.py --all-territories

# Inspect the corpus
python check_db.py
# Total fragments: 67,213 | Sources: 25 | Tiers: A=Official, B=Reference
```

### Provenance Tiers

| Tier | Meaning |
|---|---|
| A | Official documentation (e.g. python.org, docs.docker.com) |
| B | Reference material (man pages, language reference) |
| C | Single-source community content (currently unused — A/B only) |
| D | Unverified — not present in the shipped DB |

### Storage Schema

| Table | Description |
|---|---|
| `fragments` | id, content, source URL, tier, ingested_at, ftype, lang_version, tags |
| `bible_fts` | FTS5 virtual table (FTS5 builds: desktop, CLI, VS Code) |
| `sources` | Source metadata (domain, territory, reliability score) |
| `harvest_runs` | Audit log of each ingestion session |

---

## Quickstart

### Use the engine (no install)

Open https://vrtxomega.github.io/the-coders-bible/ — fragment count and search bar load in under a second after the DB caches.

### Run the harvester (this repo)

```bash
git clone https://github.com/VrtxOmega/the-coders-bible.git
cd the-coders-bible

pip install -r requirements.txt
python harvest_go.py            # one territory
python ecosystem_scan.py --all  # full sweep
python check_db.py              # inspect

# Schedule:
# 0 3 * * * cd /path/to/repo && python ecosystem_scan.py --all >> harvest.log 2>&1
```

### Build the desktop app from source

See [`coders-bible-desktop`](https://github.com/VrtxOmega/coders-bible-desktop) — `cargo tauri build` produces .msi / .dmg / .AppImage / .deb / .rpm. Or just download a pre-built installer from that repo's [releases page](https://github.com/VrtxOmega/coders-bible-desktop/releases).

### Build the CLI

```bash
git clone https://github.com/VrtxOmega/coders-bible-cli.git
cd coders-bible-cli
cargo build --release
./target/release/coders-bible-cli "docker compose" --limit 5
./target/release/coders-bible-cli --json analyze "chmod +x deploy.sh"
```

---

## Privacy & Sovereignty

- **Local-first**. The database lives on your machine. No fragment ever leaves.
- **No telemetry**. No analytics, no crash reporters, no phone-home.
- **No AI in the hot path**. Language detection is deterministic regex scoring across 25 weighted patterns per language — no LLM calls anywhere.
- **Provenance everywhere**. Every fragment carries its source URL and ingestion timestamp; everything is auditable.
- **Reproducible builds**. CI publishes SHA-256 checksums for each platform binary.

---

## Omega Universe

Related nodes in the VERITAS & Sovereign Ecosystem:

| Repository | Role |
|---|---|
| [omega-brain-mcp](https://github.com/VrtxOmega/omega-brain-mcp) | Governance and RAG query server |
| [veritas-vault](https://github.com/VrtxOmega/veritas-vault) | Knowledge retention and session capture |
| [Gravity-Omega](https://github.com/VrtxOmega/Gravity-Omega) | Desktop AI platform and agent orchestration |
| [Ollama-Omega](https://github.com/VrtxOmega/Ollama-Omega) | Local inference bridge for agents |

---


## 🌐 VERITAS Omega Ecosystem

This project is part of the [VERITAS Omega Universe](https://github.com/VrtxOmega/veritas-portfolio) — a sovereign AI infrastructure stack.

- [VERITAS-Omega-CODE](https://github.com/VrtxOmega/VERITAS-Omega-CODE) — Deterministic verification spec (10-gate pipeline)
- [omega-brain-mcp](https://github.com/VrtxOmega/omega-brain-mcp) — Governance MCP server (Triple-A rated on Glama)
- [Gravity-Omega](https://github.com/VrtxOmega/Gravity-Omega) — Desktop AI operator platform
- [Ollama-Omega](https://github.com/VrtxOmega/Ollama-Omega) — Ollama MCP bridge for any IDE
- [OmegaWallet](https://github.com/VrtxOmega/OmegaWallet) — Desktop Ethereum wallet (renderer-cannot-sign)
- [veritas-vault](https://github.com/VrtxOmega/veritas-vault) — Local-first AI knowledge engine
- [sovereign-arcade](https://github.com/VrtxOmega/sovereign-arcade) — 8-game arcade with VERITAS design system
- [SSWP](https://github.com/VrtxOmega/sswp-mcp) — Deterministic build attestation protocol
## License

Released under the [MIT License](LICENSE).

---

<div align="center">
  <sub>Built by <a href="https://github.com/VrtxOmega">RJ Lopez</a> &nbsp;|&nbsp; VERITAS &amp; Sovereign Ecosystem &mdash; Omega Universe</sub>
</div>
