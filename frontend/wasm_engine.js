// sql.js vendored locally — no CDN, no SharedArrayBuffer / COEP required
const SQL_WASM_URL = new URL('sql-wasm.wasm', import.meta.url).toString();
const IDB_NAME = 'coders-bible';
const IDB_STORE = 'db-cache';
const IDB_KEY   = 'coders_bible.db';

// ─── Language registry ────────────────────────────────────────────────────────
// Each entry: [name, color, [...[weight, regex]]]
// Regexes are tested line-by-line; scores accumulate.
const LANGS = [
  ['Python', '#3776AB', [
    [10, /^\s*def\s+\w+\s*\(/],
    [10, /^\s*class\s+\w+/],
    [8,  /^\s*(import|from)\s+\w+/],
    [7,  /^\s*if\s+__name__\s*==\s*['"]__main__['"]/],
    [6,  /^\s*@\w+/],
    [5,  /\bself\.\w+/],
    [5,  /^\s*(print|len|range|enumerate|zip|map|filter|lambda)\s*\(/],
    [4,  /^\s*(try:|except\s|finally:|raise\s|with\s.*as\s|yield\s|async\s|await\s)/],
    [3,  /:\s*$/],
  ]],
  ['JavaScript', '#F7DF1E', [
    [10, /^\s*(const|let|var)\s+\w+\s*=/],
    [9,  /=>\s*[\{\(]/],
    [9,  /^\s*function\s+\w*\s*\(/],
    [8,  /^\s*(import|export)\s+(default\s+)?[\{\w]/],
    [7,  /\.\s*(then|catch|finally)\s*\(/],
    [6,  /\bconsole\.(log|error|warn)\s*\(/],
    [6,  /\basync\s+(function|\(|[a-z_]\w*\s*=>)/],
    [5,  /\bdocument\.(querySelector|getElementById)\b/],
    [4,  /\bnew\s+Promise\b/],
    [3,  /;\s*$/],
  ]],
  ['TypeScript', '#3178C6', [
    [10, /:\s*(string|number|boolean|void|any|never|unknown)\b/],
    [10, /^\s*(interface|type)\s+\w+/],
    [9,  /^\s*const\s+\w+\s*:\s*/],
    [8,  /<\w+(\s*,\s*\w+)*>/],
    [7,  /^\s*(export|import)\s+(type\s+)?[\{\w]/],
    [6,  /\bReadonly<|Partial<|Required<|Record</],
    [5,  /^\s*enum\s+\w+/],
  ]],
  ['Rust', '#CE422B', [
    [10, /^\s*(fn|pub\s+fn|async\s+fn)\s+\w+/],
    [9,  /^\s*(let\s+mut|let)\s+\w+:\s*/],
    [8,  /^\s*use\s+[\w:]+::/],
    [8,  /^\s*(impl|trait|struct|enum)\s+\w+/],
    [7,  /\bOption<|Result<|Vec<|Box</],
    [6,  /\bunwrap\(\)|expect\(|unwrap_or\(/],
    [5,  /\bmatch\s+\w+\s*\{/],
    [4,  /^\s*\/\/!/],
  ]],
  ['Go', '#00ADD8', [
    [10, /^\s*func\s+(\(\w+\s+\*?\w+\)\s+)?\w+\s*\(/],
    [9,  /^\s*(type|struct)\s+\w+/],
    [8,  /^\s*package\s+\w+/],
    [7,  /^\s*import\s+[\("]/],
    [6,  /\bgo\s+\w+\s*\(/],
    [6,  /:\s*=\s*/],
    [5,  /\bchan\s+\w+/],
    [4,  /^\s*defer\s+/],
  ]],
  ['Ruby', '#CC342D', [
    [10, /^\s*def\s+\w+/],
    [9,  /^\s*(class|module)\s+\w+/],
    [8,  /^\s*require(_relative)?\s+['"]/],
    [7,  /^\s*attr_(accessor|reader|writer)\s+:/],
    [6,  /\bdo\s*\|[\w,\s]+\|/],
    [5,  /\bend\s*$/],
    [4,  /^\s*puts\s+/],
  ]],
  ['PHP', '#777BB4', [
    [10, /^\s*<\?php/],
    [9,  /\$\w+\s*=/],
    [8,  /^\s*(function|class)\s+\w+/],
    [7,  /^\s*echo\s+['"\$]/],
    [6,  /->\w+\(/],
    [5,  /\barray\s*\(|\[\s*\]/],
    [4,  /^\s*namespace\s+\w+/],
  ]],
  ['Java', '#ED8B00', [
    [10, /^\s*public\s+(static\s+)?\w+\s+\w+\s*\(/],
    [9,  /^\s*(public|private|protected)\s+(class|interface|enum)\s+\w+/],
    [8,  /^\s*import\s+[\w.]+\.\w+;/],
    [7,  /\bSystem\.(out|err)\.(print|println)\s*\(/],
    [6,  /@Override\b/],
    [5,  /^\s*package\s+[\w.]+;/],
    [4,  /\bArrayList<|HashMap<|List<\w+>/],
  ]],
  ['C#', '#9B4F96', [
    [10, /^\s*(public|private|protected|internal)\s+(static\s+)?\w+\s+\w+\s*[\(\{]/],
    [9,  /^\s*(namespace|using)\s+[\w.]+/],
    [8,  /^\s*(class|interface|struct|enum|record)\s+\w+/],
    [7,  /\bConsole\.(Write|Read|WriteLine)\s*\(/],
    [6,  /\bvar\s+\w+\s*=\s*new\s+/],
    [5,  /^\s*\[[\w,\s"']+\]/],
    [4,  /\bLINQ\b|\.Select\(|\.Where\(|\.FirstOrDefault\(/],
  ]],
  ['Kotlin', '#7F52FF', [
    [10, /^\s*fun\s+\w+\s*\(/],
    [9,  /^\s*(data\s+)?class\s+\w+/],
    [8,  /^\s*(val|var)\s+\w+\s*:\s*/],
    [7,  /\bprintln\s*\(/],
    [6,  /\bnullable\?|[?!]\./],
    [5,  /^\s*object\s+\w+/],
    [4,  /\bwhen\s*\(/],
  ]],
  ['Swift', '#FA7343', [
    [10, /^\s*func\s+\w+\s*\(/],
    [9,  /^\s*(class|struct|enum|protocol)\s+\w+/],
    [8,  /^\s*(let|var)\s+\w+\s*:\s*/],
    [7,  /\bprint\s*\(/],
    [6,  /\bguard\s+let\b|\bif\s+let\b/],
    [5,  /^\s*import\s+(UIKit|Foundation|SwiftUI)\b/],
    [4,  /\boptional\?|\b!$/],
  ]],
  ['C/C++', '#00589D', [
    [10, /^\s*#include\s*[<"]/],
    [9,  /^\s*(int|void|char|float|double|bool)\s+\w+\s*\(/],
    [8,  /\bstd::\w+/],
    [7,  /^\s*(struct|class|namespace|template)\s+\w*/],
    [6,  /\bcout\s*<<|cin\s*>>/],
    [5,  /\bnullptr\b|\bNULL\b/],
    [4,  /^\s*#define\s+\w+/],
  ]],
  ['Bash', '#4EAA25', [
    [10, /^\s*#!/],
    [9,  /^\s*(if|then|fi|elif|else|for|do|done|while|until|case|esac)\b/],
    [8,  /^\s*(echo|printf|read|export|source|alias|unset|set)\s/],
    [7,  /\$\{?\w+\}?/],
    [6,  /\|\s*(grep|awk|sed|sort|uniq|wc|head|tail|cut|xargs)\b/],
    [5,  /^\s*(sudo|apt|yum|dnf|brew|pacman|chmod|chown|mkdir|rm|ls|cp|mv)\b/],
    [4,  /\[\[.*\]\]|\[.*\]/],
    [3,  /&\s*$/],
  ]],
  ['PowerShell', '#012456', [
    [10, /^\s*(Get-|Set-|New-|Remove-|Invoke-|Start-|Stop-|Write-|Test-|Import-|Export-)\w+/],
    [9,  /\$\w+\s*=/],
    [8,  /\|\s*(Select-Object|Where-Object|ForEach-Object|Sort-Object)\b/],
    [7,  /^\s*param\s*\(/],
    [6,  /\[Parameter\(/],
    [5,  /-\w+\s+\$/],
    [4,  /^\s*function\s+\w+-\w+/],
  ]],
  ['SQL', '#E38C00', [
    [10, /^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE)\b/i],
    [9,  /\b(FROM|WHERE|JOIN|GROUP BY|ORDER BY|HAVING|LIMIT)\b/i],
    [8,  /\b(INNER JOIN|LEFT JOIN|RIGHT JOIN|FULL OUTER JOIN)\b/i],
    [7,  /\b(COUNT|SUM|AVG|MAX|MIN)\s*\(/i],
    [6,  /\b(PRIMARY KEY|FOREIGN KEY|NOT NULL|UNIQUE|INDEX)\b/i],
    [4,  /;\s*$/],
  ]],
  ['Docker', '#2496ED', [
    [10, /^\s*(FROM|RUN|CMD|ENTRYPOINT|EXPOSE|ENV|ADD|COPY|VOLUME|WORKDIR|LABEL|ARG)\s/],
    [8,  /^\s*docker\s+(run|build|push|pull|exec|ps|images|volume|network)\b/],
    [6,  /^\s*HEALTHCHECK\s/],
    [5,  /^\s*USER\s/],
  ]],
  ['YAML', '#CB171E', [
    [10, /^---\s*$/],
    [8,  /^\s*\w[\w-]*:\s*$/],
    [7,  /^\s*\w[\w-]*:\s+\S/],
    [6,  /^\s*-\s+\w+/],
    [5,  /^\s*#.+/],
  ]],
  ['JSON', '#292929', [
    [10, /^\s*[\{\[]/],
    [8,  /"\w+":\s*("|[\d\[\{])/],
    [7,  /^\s*\}\s*,?\s*$/],
    [6,  /^\s*\]\s*,?\s*$/],
  ]],
  ['HTML', '#E34F26', [
    [10, /^\s*<!DOCTYPE\s+html/i],
    [9,  /^\s*<(html|head|body|div|span|p|a|ul|ol|li|form|input|button|script|style|link|meta)\b/i],
    [7,  /\s(class|id|href|src|type|name|value|data-\w+)=/],
    [5,  /^\s*<\/\w+>/],
  ]],
  ['CSS', '#1572B6', [
    [10, /^\s*[\.\#]?\w[\w-]*\s*\{/],
    [9,  /^\s*(margin|padding|color|background|font|display|position|width|height|border|flex|grid)\s*:/],
    [8,  /^\s*@(media|keyframes|import|charset|font-face)/],
    [6,  /:\s*(var\(--)?\w[\w-]*(\))?\s*;$/],
    [5,  /^\s*\}/],
  ]],
  ['Terraform', '#7B42BC', [
    [10, /^\s*(resource|data|module|variable|output|provider|terraform)\s+"\w+"/],
    [8,  /^\s*(locals|required_providers)\s*\{/],
    [6,  /\$\{[\w.]+\}/],
    [5,  /=\s*(true|false|null)\b/],
  ]],
  ['Ansible', '#EE0000', [
    [10, /^\s*-\s+(name|hosts|tasks|roles|handlers):\s*/],
    [8,  /^\s*(ansible\.builtin\.|community\.)\w+:/],
    [7,  /^\s*vars:\s*$/],
    [6,  /\{\{\s*\w+\s*\}\}/],
    [5,  /^\s*become:\s*(yes|true|no|false)\s*$/],
  ]],
  ['Nginx', '#009900', [
    [10, /^\s*(server|location|upstream|http|events)\s*\{/],
    [9,  /^\s*(listen|server_name|root|index|try_files|proxy_pass|return|rewrite)\s+/],
    [6,  /;\s*$/],
  ]],
  ['systemd', '#4A86CF', [
    [10, /^\s*\[(Unit|Service|Install|Socket|Timer|Mount|Automount)\]/],
    [9,  /^\s*(ExecStart|ExecStop|Type|Restart|User|Group|WorkingDirectory|Environment)\s*=/],
    [6,  /^\s*(WantedBy|RequiredBy|After|Before|Requires|Wants)\s*=/],
  ]],
  ['Makefile', '#427819', [
    [10, /^\w[\w\-\.]+\s*:\s*/],
    [8,  /^\t\$\([\w]+\)\s/],
    [7,  /^\s*\.PHONY\s*:/],
    [5,  /\$\(CC\)|\$\(CFLAGS\)/],
  ]],
];

const LANG_COLORS = Object.fromEntries(LANGS.map(([n,c]) => [n,c]));

// ─── Safety patterns ──────────────────────────────────────────────────────────
const DANGER_PATTERNS = [
  [/\brm\s+-[rR][fF]?\b|\brm\s+-[fF][rR]\b/,           'Recursive file deletion (rm -rf)'],
  [/\bformat\s+(c:|d:)|mkfs\./i,                          'Disk formatting command'],
  [/\bDROP\s+(TABLE|DATABASE|SCHEMA)\b/i,                 'Destructive SQL — drops table/database'],
  [/\bTRUNCATE\s+TABLE\b/i,                               'SQL TRUNCATE — irreversible row deletion'],
  [/\bDELETE\s+FROM\b(?!.*\bWHERE\b)/i,                  'Unbounded SQL DELETE — no WHERE clause'],
  [/\beval\s*\(|exec\s*\(/,                               'Dynamic code execution via eval/exec'],
  [/\bos\.system\s*\(|subprocess\.call\s*\(.*shell\s*=\s*True/,  'Shell injection risk (subprocess shell=True)'],
  [/\bchmod\s+777\b/,                                     'Permissive chmod 777 — world-writable'],
  [/\bdd\s+if=/,                                          'Raw disk write via dd'],
  [/\b(wget|curl)\s+.*\|\s*(ba)?sh/,                      'Pipe-to-shell pattern — remote code execution'],
  [/\bkill\s+-9\b/,                                       'SIGKILL — forceful process termination'],
  [/\bsudo\s+rm\b/,                                       'Privileged file deletion'],
  [/:(){:|:&};:/,                                          'Fork bomb detected'],
  [/\bnpm\s+--global\s+install\b|\bnpm\s+install\s+-g\b/, 'Global npm install — system-wide impact'],
  [/\bgit\s+push\s+.*--force\b|\bgit\s+push\s+-f\b/,     'Force push — rewrites remote history'],
  [/\bHistory\s*\.\s*replaceState|window\.location\s*=\s*['"]/,  'Browser navigation manipulation'],
  [/innerHTML\s*=/,                                        'innerHTML assignment — potential XSS'],
  [/document\.write\s*\(/,                                 'document.write — deprecated, XSS risk'],
];

const CAUTION_PATTERNS = [
  [/\bsudo\s+/,                           'Uses sudo — elevated privileges'],
  [/\bNetwork\.|fetch\s*\(|XMLHttpRequest/, 'Makes network requests'],
  [/\bopen\s*\(.+['"w]['"]\)/,            'File write operation'],
  [/\bfs\.(writeFile|appendFile|unlink)\s*\(/, 'File system write/delete'],
  [/\bos\.(remove|unlink|rename|replace)\s*\(/, 'File system mutation'],
  [/\bawait\s+exec\b/,                    'Async shell execution'],
  [/\bsetInterval\s*\(|setInterval\s*,\s*0\)/, 'Repeated execution timer'],
];

// ─── Breakdown concept labels ─────────────────────────────────────────────────
// Ordered — first match wins per line
const CONCEPTS = [
  [/^\s*#!.+/,                                   'Shebang — interpreter declaration'],
  [/^\s*(\/\/|#|--)\s*MARK:|^\s*\/\/\s*─+/,     'Section marker / separator'],
  [/^\s*(\/\/|#|--|\/\*).*/,                      'Comment'],
  [/^\s*(import|from\s+\w+\s+import|using|require|include|use\s+\w+::)/,  'Import / dependency'],
  [/^\s*package\s+\w+/,                           'Package declaration'],
  [/^\s*(public\s+)?(class|struct|interface|trait|protocol|record)\s+\w+/, 'Type / class definition'],
  [/^\s*def\s+\w+|^\s*(pub\s+)?fn\s+\w+|^\s*function\s+\w+|^\s*func\s+\w+|^\s*(public|private|protected)\s+\w+\s+\w+\s*\(/, 'Function / method definition'],
  [/^\s*(const|let|val|var)\s+\w+\s*=.*=>/,      'Arrow function / lambda'],
  [/^\s*\w[\w.]*\s*=>/,                           'Lambda expression'],
  [/^\s*(const|let|var|val|auto)\s+\w+\s*=/,     'Variable declaration'],
  [/^\s*\w[\w.]*\s*:=\s*/,                        'Short variable declaration (Go)'],
  [/^\s*(if|unless)\s+/,                          'Conditional branch'],
  [/^\s*(else if|elif|elsif)\s*/,                 'Else-if branch'],
  [/^\s*else\s*[\{:]?\s*$/,                       'Else branch'],
  [/^\s*(for|foreach|while|until|loop)\s+/,       'Loop construct'],
  [/^\s*(switch|match|case)\s+/,                  'Pattern match / switch'],
  [/^\s*(try|begin)\s*[\{:]?\s*$/,                'Exception guard (try block)'],
  [/^\s*(catch|except|rescue)\s+/,                'Error handler'],
  [/^\s*(finally|ensure)\s*[\{:]?\s*$/,           'Finally / cleanup block'],
  [/^\s*throw\s+|^\s*raise\s+/,                   'Throws / raises exception'],
  [/^\s*return\s+/,                               'Return statement'],
  [/^\s*yield\s+/,                                'Yield / generator'],
  [/^\s*await\s+/,                                'Async await'],
  [/^\s*async\s+/,                                'Async declaration'],
  [/^\s*(export|module\.exports)\s+/,             'Module export'],
  [/^\s*\w[\w.]*\s*\([^)]*\)\s*;?\s*$/,          'Function call'],
  [/^\s*(console\.(log|error|warn)|print|echo|puts)\s*\(/, 'Logging / output'],
  [/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\b/i, 'SQL statement'],
  [/^\s*(FROM|RUN|CMD|ENTRYPOINT|EXPOSE|ENV|COPY|WORKDIR)\s/,  'Dockerfile directive'],
  [/^\s*(ExecStart|Type|Restart|WantedBy)\s*=/,  'systemd unit directive'],
  [/^\s*-\s*(name|hosts|tasks):\s*/,             'Ansible task / play'],
  [/^\s*(listen|proxy_pass|server_name|root)\s+/, 'Nginx directive'],
  [/^\s*[A-Z_]+\s*=\s*/,                         'Constant / environment variable'],
  [/^\s*\w[\w.]*\s*=\s*/,                        'Assignment'],
  [/^\s*[\}\]]\s*[,;]?\s*$/,                     'Block close'],
  [/^\s*[\{\[]\s*$/,                             'Block open'],
];

// ─── Keyword extractor ────────────────────────────────────────────────────────
const NOISE = new Set([
  'const','let','var','def','class','import','export','function','return',
  'true','false','null','undefined','this','self','new','if','else','for',
  'while','do','switch','case','break','continue','try','catch','finally',
  'async','await','yield','from','as','in','of','with','end','then','elif',
  'elsif','unless','public','private','protected','static','void','int','str',
  'bool','float','double','char','byte','long','short','type','struct','enum',
  'interface','package','namespace','use','require','include','super','base',
  'get','set','init','print','echo','puts','throw','raise','pass','and','or',
  'not','is','are','the','has','have','when','that','than','like','each',
]);

function extractKeywords(snippet, lang) {
  const found = new Set();

  // CLI command on first token of a line
  const cliRe = /^\s*(\w[\w.-]*)(?:\s|$)/gm;
  let m;
  while ((m = cliRe.exec(snippet)) !== null) {
    const w = m[1].toLowerCase();
    if (w.length > 1 && !NOISE.has(w) && /^[a-z]/.test(w)) found.add(m[1]);
  }

  // Function / method names
  const fnRe = /(?:def|func?|fn|function)\s+(\w+)/g;
  while ((m = fnRe.exec(snippet)) !== null) found.add(m[1]);

  // Class / type names
  const classRe = /(?:class|struct|interface|type|enum|trait|protocol)\s+(\w+)/g;
  while ((m = classRe.exec(snippet)) !== null) found.add(m[1]);

  // Identifiers (camelCase, snake_case, PascalCase)
  const identRe = /\b([A-Z][a-z]\w+|[a-z]+_[a-z]\w*|[A-Z]{2,}\w*)\b/g;
  while ((m = identRe.exec(snippet)) !== null) {
    if (!NOISE.has(m[1].toLowerCase())) found.add(m[1]);
  }

  // Filter noise and return top-N
  return [...found]
    .filter(w => w.length > 2 && w.length < 30 && !NOISE.has(w.toLowerCase()))
    .slice(0, 8);
}

// ─── Language detection ───────────────────────────────────────────────────────
function detectLanguage(snippet) {
  const lines = snippet.split('\n').filter(l => l.trim());
  const scores = {};
  const hits   = {};

  for (const [name, , patterns] of LANGS) {
    scores[name] = 0;
    hits[name]   = [];
    for (const line of lines) {
      for (const [w, re] of patterns) {
        if (re.test(line)) {
          scores[name] += w;
          hits[name].push({ line: line.trim(), weight: w });
        }
      }
    }
  }

  const ranked = Object.entries(scores)
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1]);

  if (ranked.length === 0) {
    return { language: 'Unknown', color: '#888', confidence: 0, reasoning: 'No recognizable patterns.', alternatives: [] };
  }

  const [[name, top], ...rest] = ranked;
  const total = ranked.reduce((s, [, v]) => s + v, 0);
  const conf  = Math.min(top / (total || 1), 1);

  const topHit = hits[name][0];
  const reasoning = topHit
    ? `Strongest signal: "${topHit.line.substring(0, 60)}" (weight ${topHit.weight})`
    : `Pattern scoring — ${name} leads with ${top} points.`;

  const alternatives = rest.slice(0, 3).map(([n, s]) => ({
    language: n, confidence: Math.min(s / (total || 1), 1)
  }));

  return {
    language: name,
    color: LANG_COLORS[name] || '#C9A84C',
    confidence: conf,
    reasoning,
    alternatives,
  };
}

// ─── Line breakdown ───────────────────────────────────────────────────────────
function buildBreakdown(snippet) {
  const lines = snippet.split('\n');
  const result = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim() || line.trim().length < 2) continue;
    let concept = 'Statement';
    for (const [re, label] of CONCEPTS) {
      if (re.test(line)) { concept = label; break; }
    }
    result.push({ code: line, concept });
    if (result.length >= 20) break;
  }
  return result;
}

// ─── Safety scan ─────────────────────────────────────────────────────────────
function scanSafety(snippet) {
  const warnings  = [];
  const cautions  = [];
  const safeNotes = [];

  for (const [re, msg] of DANGER_PATTERNS) {
    if (re.test(snippet)) warnings.push({ level: 'danger', message: msg });
  }
  for (const [re, msg] of CAUTION_PATTERNS) {
    if (re.test(snippet)) cautions.push({ level: 'caution', message: msg });
  }

  const level = warnings.length ? 'DESTRUCTIVE' : cautions.length ? 'CAUTION' : 'SAFE';

  if (level === 'SAFE') {
    if (/\btry\b|\bcatch\b|\bexcept\b/.test(snippet))  safeNotes.push('Handles exceptions');
    if (/\bconst\b|\bval\b|\breadonly\b/.test(snippet)) safeNotes.push('Uses immutable bindings');
    if (/\btype\s+\w+|:\s*(string|number|bool)/.test(snippet)) safeNotes.push('Type-annotated');
    if (safeNotes.length === 0) safeNotes.push('No dangerous patterns detected');
  }

  return { level, warnings: [...warnings, ...cautions], safe_notes: safeNotes };
}

// ─── Quick understanding ──────────────────────────────────────────────────────
function synthesizeUnderstanding(snippet, langResult, keywords) {
  const lang   = langResult.language;
  const lines  = snippet.split('\n').filter(l => l.trim());
  const lc     = snippet.toLowerCase();

  // Count structural elements
  const fnCount  = (snippet.match(/\bdef\s+\w+|\bfn\s+\w+|\bfunc\s+\w+|\bfunction\s+\w+/g) || []).length;
  const classCount = (snippet.match(/\bclass\s+\w+|\bstruct\s+\w+|\binterface\s+\w+/g) || []).length;
  const importCount = (snippet.match(/\b(import|require|include|use\s)\b/g) || []).length;

  const parts = [];

  if (importCount > 0) parts.push(`imports ${importCount} module${importCount > 1 ? 's' : ''}`);
  if (classCount > 0)  parts.push(`defines ${classCount} class${classCount > 1 ? 'es' : ''}`);
  if (fnCount > 0)     parts.push(`defines ${fnCount} function${fnCount > 1 ? 's' : ''}`);

  // Detect common patterns
  if (/SELECT.*FROM/i.test(snippet))             parts.push('queries a database');
  if (/\b(http|fetch|curl|wget|requests)\b/i.test(snippet)) parts.push('makes HTTP requests');
  if (/\bfor\b.*\bin\b|\bwhile\b|\bforeach\b/i.test(snippet)) parts.push('iterates over data');
  if (/\btry\b|\bcatch\b|\bexcept\b/.test(snippet)) parts.push('handles exceptions');
  if (/\basync\b|\bawait\b|\bpromise\b/i.test(snippet)) parts.push('uses async/await');
  if (/docker|FROM\s+\w+:\w+/i.test(snippet))   parts.push('builds a container image');
  if (/kubectl|apiVersion:/i.test(snippet))      parts.push('configures Kubernetes resources');

  const desc = parts.length
    ? parts.join(', ')
    : `${lines.length}-line ${lang} snippet`;

  const top = keywords.slice(0, 3).join(', ');
  return `${lang} snippet — ${desc}${top ? `. Key identifiers: ${top}` : ''}.`;
}

// ─── IndexedDB helpers ────────────────────────────────────────────────────────
function openIDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(IDB_STORE);
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}
async function idbGet(db, key) {
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}
async function idbPut(db, key, value) {
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const req = tx.objectStore(IDB_STORE).put(value, key);
    req.onsuccess = () => res();
    req.onerror   = e => rej(e.target.error);
  });
}

// ─── BibleEngine ─────────────────────────────────────────────────────────────
export class WasmBibleEngine {
  constructor(dbUrl = new URL('coders_bible.db', import.meta.url).toString()) {
    this.dbUrl = dbUrl;
    this._db   = null;
    this.ready = false;
  }

  async init(onProgress) {
    if (this.ready) return;

    // sql.js loaded as a classic <script> tag — window.initSqlJs is the factory
    const SQL = await window.initSqlJs({ locateFile: () => SQL_WASM_URL });

    // Try IndexedDB cache first
    let buf;
    try {
      const idb = await openIDB();
      buf = await idbGet(idb, IDB_KEY);
      if (buf) {
        if (onProgress) onProgress(100);
      } else {
        buf = await this._download(onProgress);
        await idbPut(idb, IDB_KEY, buf);
      }
    } catch {
      // Cache unavailable — download anyway
      buf = await this._download(onProgress);
    }

    this._db  = new SQL.Database(buf);
    this.ready = true;
  }

  async _download(onProgress) {
    const resp  = await fetch(this.dbUrl);
    const total = parseInt(resp.headers.get('content-length') || '0', 10);
    const reader = resp.body.getReader();
    const chunks = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (onProgress && total) onProgress(Math.round((received / total) * 95));
    }
    if (onProgress) onProgress(99);
    const merged = new Uint8Array(received);
    let offset = 0;
    for (const c of chunks) { merged.set(c, offset); offset += c.length; }
    return merged;
  }

  _query(sql, params = []) {
    const stmt = this._db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }

  async stats() {
    if (!this.ready) throw new Error('DB not initialized');
    const [{ c: total }] = this._query('SELECT COUNT(*) as c FROM fragments');

    const sql = `
      SELECT
        CASE
          WHEN source LIKE 'python/%'    OR source LIKE '%docs.python.org%'   THEN 'Python'
          WHEN source LIKE 'javascript/' OR source LIKE '%nodejs%'
            OR source LIKE '%npmjs%'     OR source LIKE '%nodebestpractices%'  THEN 'JavaScript'
          WHEN source LIKE 'typescript/' OR source LIKE '%typescriptlang%'     THEN 'TypeScript'
          WHEN source LIKE 'rust/%'      OR source LIKE '%doc.rust-lang%'
            OR source LIKE '%docs.rs%'                                          THEN 'Rust'
          WHEN source LIKE 'golang/%'    OR source LIKE '%go.dev%'
            OR source LIKE '%pkg.go.dev%'                                       THEN 'Go'
          WHEN source LIKE 'ruby/%'      OR source LIKE '%ruby%'               THEN 'Ruby'
          WHEN source LIKE 'php/%'       OR source LIKE '%php.net%'            THEN 'PHP'
          WHEN source LIKE 'java/%'      AND source NOT LIKE '%javascript%'
            AND source NOT LIKE '%typescript%'                                  THEN 'Java'
          WHEN source LIKE 'bash/%'      OR source LIKE '%gnu.org/software/bash%'
            OR source LIKE '%ss64%bash%'                                        THEN 'Bash'
          WHEN source LIKE 'powershell/' OR source LIKE '%learn.microsoft.com/powershell%'
            OR source LIKE '%ss64%powershell%'                                  THEN 'PowerShell'
          WHEN source LIKE 'sql/%'       OR source LIKE '%mysql%'
            OR source LIKE '%postgresql%' OR source LIKE '%sqlite%'            THEN 'SQL'
          WHEN source LIKE 'docker/%'    OR source LIKE '%docker.com%'         THEN 'Docker'
          WHEN source LIKE 'kubernetes/' OR source LIKE '%k8s%'
            OR source LIKE '%kubectl%'                                          THEN 'Kubernetes'
          WHEN source LIKE 'nginx/%'     OR source LIKE '%nginx.org%'          THEN 'Nginx'
          WHEN source LIKE 'systemd/%'                                          THEN 'systemd'
          WHEN source LIKE 'git/%'       OR source LIKE '%git-scm%'            THEN 'Git'
          WHEN source LIKE 'ansible/%'   OR source LIKE '%ansible.com%'        THEN 'Ansible'
          WHEN source LIKE 'css/%'       OR source LIKE '%/CSS/%'              THEN 'CSS'
          WHEN source LIKE 'html/%'      OR source LIKE '%/HTML/%'             THEN 'HTML'
          WHEN source LIKE 'yaml/%'                                             THEN 'YAML'
          WHEN source LIKE 'json/%'                                             THEN 'JSON'
          WHEN source LIKE 'terraform/%' OR source LIKE '%hashicorp%'          THEN 'Terraform'
          WHEN source LIKE 'csharp/%'    OR source LIKE '%dotnet/csharp%'      THEN 'C#'
          WHEN source LIKE 'kotlin/%'    OR source LIKE '%kotlinlang%'         THEN 'Kotlin'
          WHEN source LIKE 'c/%'         OR source LIKE 'cpp/%'
            OR source LIKE '%cppreference%'                                     THEN 'C/C++'
          WHEN source LIKE 'swift/%'     OR source LIKE '%swift.org%'          THEN 'Swift'
          WHEN source LIKE 'linux/%'     OR source LIKE '%man7.org%'
            OR source LIKE '%sourceware.org%' OR source LIKE '%ss64%nt%'       THEN 'Linux'
          WHEN source LIKE 'node/%'      OR source LIKE '%node.js%'            THEN 'Node.js'
          ELSE 'Other'
        END as domain,
        COUNT(*) as c
      FROM fragments
      GROUP BY domain
      ORDER BY c DESC
    `;
    const rows = this._query(sql);
    const threshold = Math.max(50, Math.floor(total * 0.003));
    const domains = rows
      .filter(r => r.c >= threshold || r.domain !== 'Other')
      .map(r => ({ name: r.domain, count: r.c, color: LANG_COLORS[r.domain] || '#C9A84C' }));

    return { total_fragments: total, domains };
  }

  async search(query, limit = 20) {
    if (!this.ready) throw new Error('DB not initialized');
    const clean = query.replace(/[^a-zA-Z0-9_\-.\s]/g, ' ').trim();
    if (!clean) return { count: 0, results: [] };

    // Multi-term LIKE search. sql.js's stock build doesn't include FTS5,
    // so we scan the fragments table directly. ~67K rows × LIKE is sub-second.
    // OR all terms (any match), rank by how many terms hit, prefer source matches.
    const terms = clean.split(/\s+/).filter(t => t.length > 1).slice(0, 6);
    if (!terms.length) return { count: 0, results: [] };

    const rankExpr  = terms.map(() =>
      '(CASE WHEN content LIKE ? THEN 2 ELSE 0 END) + (CASE WHEN source LIKE ? THEN 3 ELSE 0 END)'
    ).join(' + ');
    const whereExpr = terms.map(() => '(content LIKE ? OR source LIKE ?)').join(' OR ');
    const likes     = terms.flatMap(t => [`%${t}%`, `%${t}%`]);

    try {
      const results = this._query(
        `SELECT id, content, source, tier, (${rankExpr}) AS rank
         FROM fragments
         WHERE ${whereExpr}
         ORDER BY rank DESC, length(content) ASC
         LIMIT ?`,
        [...likes, ...likes, limit]
      );
      return { count: results.length, results };
    } catch {
      return { count: 0, results: [] };
    }
  }

  async analyze(snippet) {
    if (!this.ready) throw new Error('DB not initialized');
    if (!snippet?.trim()) return { error: 'Empty input' };

    const langResult = detectLanguage(snippet);
    const breakdown  = buildBreakdown(snippet);
    const safety     = scanSafety(snippet);
    const keywords   = extractKeywords(snippet, langResult.language);
    const quick      = synthesizeUnderstanding(snippet, langResult, keywords);

    // Search using detected language + keywords
    const searchTerms = [langResult.language !== 'Unknown' ? langResult.language : '', ...keywords.slice(0, 4)]
      .filter(Boolean).join(' ');
    let results = [];
    if (searchTerms.trim()) {
      const res = await this.search(searchTerms, 15);
      results = res.results || [];
    }

    return {
      quick_understanding: quick,
      language: {
        language:          langResult.language,
        confidence:        langResult.confidence,
        confidence_label:  langResult.confidence > 0.7 ? 'HIGH' : langResult.confidence > 0.4 ? 'MEDIUM' : 'LOW',
        reasoning:         langResult.reasoning,
        color:             langResult.color,
        alternatives:      langResult.alternatives,
      },
      breakdown,
      safety,
      keywords,
      results,
    };
  }
}
