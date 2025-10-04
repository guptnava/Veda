import React, { useState, useCallback, useEffect, useRef } from 'react';
import minimiseIcon from '../icons/minimise.svg';
import maximiseIcon from '../icons/maximise.svg';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import StandaloneChrome from './StandaloneChrome';
import Editor from '@monaco-editor/react';
import TableComponent, { TABLE_COMPONENT_DEFAULT_PAGE_SIZE } from './TableComponent';
import runIcon from '../icons/run.svg';
import copyIcon from '../icons/copy.svg';
import addCellIcon from '../icons/add_cell.svg';
import removeCellIcon from '../icons/remove_cell.svg';
import worksheetIcon from '../icons/worksheet_viewer.svg';
import csvIcon from '../icons/csv.svg';

const baseTable = [
  { region: 'North', revenue: 125000, growth: 12 },
  { region: 'South', revenue: 98000, growth: 9 },
  { region: 'East', revenue: 143500, growth: 15 },
  { region: 'West', revenue: 112300, growth: 11 },
];

const makeId = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

const cellTemplates = {
  text: {
    title: 'NLP Prompt',
    language: 'markdown',
    placeholder: 'Describe the goal of this analysis…',
    content: 'Hello LLaMA3.2:1b. Are you there?',
    autoRun: false,
  },
  sql: {
    title: 'SQL Exploration',
    language: 'sql',
    placeholder: 'SELECT region, revenue, growth FROM sales_performance',
    content: 'SELECT region, revenue, growth FROM sales_performance ORDER BY revenue DESC;',
    autoRun: false,
  },
  python: {
    title: 'Python Transform',
    language: 'python',
    placeholder: `import pandas as pd
    import numpy as np`,
    content: `import json
import pandas as pd
from pprint import pprint

# Simulated input: list of JSON-like dictionaries
data = [
    {"_base_sql": "SELECT * FROM sales"},
    {
        "_column_types": {
            "sale_id": "number",
            "customer_id": "number",
            "product_id": "number",
            "sale_date": "date",
            "quantity": "number",
            "unit_price": "number",
            "total_amount": "number",
            "region": "string"
        },
        "_search_columns": [
            "sale_id", "customer_id", "product_id", "sale_date",
            "quantity", "unit_price", "total_amount", "region"
        ]
    },
    {
        "sale_id": 448467,
        "customer_id": 4,
        "product_id": 102,
        "sale_date": "2025-07-04T00:00:00",
        "quantity": 1.0,
        "unit_price": 900.0,
        "total_amount": 900,
        "region": "North America"
    },
    {
        "sale_id": 448468,
        "customer_id": 5,
        "product_id": 105,
        "sale_date": "2025-07-05T00:00:00",
        "quantity": 2.0,
        "unit_price": 350.0,
        "total_amount": 700,
        "region": "Europe"
    }
]

# Output 1: Base SQL
base_sql = data[0]["_base_sql"]
print("🔹 Base SQL:")
print(base_sql)

# Output 2: Column Types and Searchable Columns
column_types = data[1]["_column_types"]
search_columns = data[1]["_search_columns"]
print("🔹 Column Types:")
pprint(column_types)
print("🔹 Searchable Columns:")
print(search_columns)

# Output 3: DataFrame from records
records = data[2:]
df = pd.DataFrame(records)
print("🔹 DataFrame Preview:")
print(df)

# Output 4: Schema Summary
print("🔹 Schema Summary:")
print(df.dtypes)`,
    autoRun: false,
  },
};





const createCell = (type = 'text') => {
  const template = cellTemplates[type] || cellTemplates.text;
  return {
    id: makeId('cell'),
    type,
    collapsed: false,
    dfName: null,
    showOutput: false,
    outputCollapsed: false,
    outputData: null,
    outputActiveColumn: null,
    outputRaw: '',
    outputTableProps: null,
    outputFigures: [],
    ...template,
  };
};

const initialCells = () => [createCell('text')];

const cardStyle = {
  borderRadius: 12,
  border: '1px solid #253248',
  background: 'linear-gradient(160deg, rgba(26,31,44,0.98) 0%, rgba(11,14,24,0.98) 100%)',
  padding: '18px 20px',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  boxShadow: '0 18px 36px rgba(0,0,0,0.35)',
};

const IGNORED_META_KEYS = new Set(['_base_sql', '_column_types', '_search_columns']);
const DB_AGENTS = ['database', 'langchainprompt', 'restful', 'embedded', 'embedded_narrated', 'generic_rag', 'database1'];

const sanitizeName = (value) =>
  (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const deriveColumnsForCsv = (rows, tableProps) => {
  if (!Array.isArray(rows) || !rows.length) return [];

  const explicitColumns = Array.isArray(tableProps?.columns) ? tableProps.columns : null;
  if (explicitColumns?.length) return explicitColumns;

  const explicitHeaders = Array.isArray(tableProps?.headers) ? tableProps.headers : null;
  if (explicitHeaders?.length) return explicitHeaders;

  const objectColumns = [];
  let maxArrayLength = 0;

  for (const row of rows) {
    if (Array.isArray(row)) {
      maxArrayLength = Math.max(maxArrayLength, row.length);
      continue;
    }
    if (row && typeof row === 'object') {
      for (const key of Object.keys(row)) {
        if (IGNORED_META_KEYS.has(key)) continue;
        if (!objectColumns.includes(key)) objectColumns.push(key);
      }
    }
  }

  if (objectColumns.length) return objectColumns;
  if (maxArrayLength) {
    return Array.from({ length: maxArrayLength }, (_, idx) => `column_${idx + 1}`);
  }
  return ['value'];
};

const encodeCsvValue = (value) => {
  if (value == null) return '';
  let normalized = value;
  if (typeof normalized === 'object') {
    try {
      normalized = JSON.stringify(normalized);
    } catch (err) {
      normalized = String(normalized);
    }
  }
  const stringValue = String(normalized);
  if (/["\n,\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const buildCsvFromTableProps = (tableProps) => {
  if (!tableProps) return null;
  const rows = Array.isArray(tableProps.data) ? tableProps.data : [];
  if (!rows.length) return null;

  const columns = deriveColumnsForCsv(rows, tableProps);
  if (!columns.length) return null;

  const lines = [columns.map(encodeCsvValue).join(',')];

  for (const row of rows) {
    const values = columns.map((col, idx) => {
      if (row == null) return '';
      if (Array.isArray(row)) return row[idx];
      if (row && typeof row === 'object') return row[col];
      if (columns.length === 1) return row;
      return '';
    });
    lines.push(values.map(encodeCsvValue).join(','));
  }

  return lines.join('\n');
};

const buildGraphExampleBlock = (dfVar, label) => `if plt is not None:
    try:
        numeric_cols = [col for col in ${dfVar}.select_dtypes(include=['number']).columns]
        if numeric_cols:
            preview = ${dfVar}.head(10)
            fig, ax = plt.subplots(figsize=(8, 4))
            preview[numeric_cols].plot(kind='bar', ax=ax)
            ax.set_title('${label ? label.replace(/'/g, "\\'") : 'Quick Preview'} (first 10 rows)')
            ax.set_xlabel('Row Index')
            ax.set_ylabel('Value')
            fig.tight_layout()
    except Exception:
        pass`;

const buildPythonDataframeSnippet = ({
  dfName,
  sourceType,
  totalRows = null,
  csvMeta = null,
  savedViewRequest = null,
}) => {
  const safeName = sanitizeName(dfName) || 'dataset';
  const commentParts = [`Dataset: ${safeName}`];
  if (Number.isFinite(totalRows)) commentParts.push(`rows=${totalRows}`);
  const commentLine = `# ${commentParts.join(' | ')}`;
  const friendlyLabel = (dfName || safeName || 'Dataset').replace(/'/g, "\\'");

  const importsBlock = `import os\nimport json\nimport requests\nimport pandas as pd\nimport importlib\n\nmatplotlib = None\nplt = None\ntry:\n    matplotlib_spec = importlib.util.find_spec('matplotlib')\nexcept Exception:\n    matplotlib_spec = None\nif matplotlib_spec is not None:\n    try:\n        matplotlib = importlib.import_module('matplotlib')\n        matplotlib.use('Agg')\n        plt = importlib.import_module('matplotlib.pyplot')\n    except Exception:\n        matplotlib = None\n        plt = None\n\nAPI_BASE_URL = os.getenv("VEDA_API_BASE", "http://localhost:3000")\nAPI_TOKEN = os.getenv("VEDA_API_TOKEN")\n\n_session = requests.Session()\nif API_TOKEN:\n    _session.headers.update({"Authorization": f"Bearer {API_TOKEN}"})\n\n`;

  if (sourceType === 'csv' && csvMeta?.endpoint) {
    const endpoint = csvMeta.endpoint;
    const graphBlock = buildGraphExampleBlock(safeName, friendlyLabel);
    return `${importsBlock}${commentLine}\nresponse = _session.get(f"{API_BASE_URL}${endpoint}", timeout=120)\nresponse.raise_for_status()\npayload = response.json()\n\ntable = payload.get("table", {})\ndata = table.get("data") or table.get("rows") or []\nheaders = table.get("headers") or table.get("columns")\nif headers and data and isinstance(data[0], (list, tuple)):\n    records = [dict(zip(headers, row)) for row in data]\nelse:\n    records = data\n\n${safeName} = pd.DataFrame(records)\n# publish(${safeName}, "${safeName}")  # Uncomment to preview in notebook\n${graphBlock}\n${safeName}`;
  }

  if (sourceType === 'saved-view' && savedViewRequest) {
    const pythonJson = JSON.stringify(savedViewRequest, null, 2)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/`/g, '\\`');

    const graphBlock = buildGraphExampleBlock(safeName, friendlyLabel);
    return `${importsBlock}${commentLine}\nquery_payload = json.loads('''${pythonJson}''')\nquery_payload['all'] = True\nresponse = _session.post(f"{API_BASE_URL}/api/table/query", json=query_payload, timeout=180)\nresponse.raise_for_status()\nresult = response.json()\n\nrows = result.get("rows") or result.get("data") or []\ncolumns = result.get("columns")\nif not columns:\n    table = result.get("table") or {}\n    columns = table.get("columns") or table.get("headers")\nif columns and rows and isinstance(rows[0], (list, tuple)):\n    records = [dict(zip(columns, row)) for row in rows]\nelse:\n    records = rows\n\n${safeName} = pd.DataFrame(records)\n# publish(${safeName}, "${safeName}")  # Uncomment to preview in notebook\n${graphBlock}\n${safeName}`;
  }

  const graphBlock = buildGraphExampleBlock(safeName, friendlyLabel);
  return `${importsBlock}${commentLine}\n${safeName} = pd.DataFrame([])\n# publish(${safeName}, "${safeName}")  # Uncomment to preview in notebook\n${graphBlock}\n${safeName}`;
};

const appendObjectRecord = (target, obj, limit = Infinity) => {
  if (!obj || typeof obj !== 'object') return;
  const sanitized = {};
  let hasData = false;
  for (const [key, value] of Object.entries(obj)) {
    if (IGNORED_META_KEYS.has(key) || key.startsWith('_')) continue;
    if (['columns', 'rows', 'data', 'tableData', 'records', 'outputs'].includes(key)) continue;
    sanitized[key] = value;
    hasData = true;
  }
  if (hasData && Object.keys(sanitized).length && target.length < limit) {
    target.push(sanitized);
    return true;
  }
  return false;
};

const normalizeRecords = (rows) => {
  if (!Array.isArray(rows)) return [];
  const result = [];
  for (const row of rows) {
    if (Array.isArray(row?.columns) && Array.isArray(row?.rows)) {
      const keys = row.columns.filter((key) => !IGNORED_META_KEYS.has(key));
      for (const values of row.rows) {
        if (Array.isArray(values)) {
          const obj = {};
          keys.forEach((key, idx) => {
            obj[key] = values[idx];
          });
          if (Object.keys(obj).length > 0) result.push(obj);
        } else if (values && typeof values === 'object') {
          const sanitized = {};
          for (const key of keys) sanitized[key] = values[key];
          if (Object.keys(sanitized).length > 0) result.push(sanitized);
        }
      }
      continue;
    }
    if (Array.isArray(row?.columns) && Array.isArray(row?.data)) {
      const keys = row.columns.filter((key) => !IGNORED_META_KEYS.has(key));
      for (const values of row.data) {
        if (Array.isArray(values)) {
          const obj = {};
          keys.forEach((key, idx) => {
            obj[key] = values[idx];
          });
          if (Object.keys(obj).length > 0) result.push(obj);
        } else if (values && typeof values === 'object') {
          const sanitized = {};
          for (const key of keys) sanitized[key] = values[key];
          if (Object.keys(sanitized).length > 0) result.push(sanitized);
        }
      }
      continue;
    }
    if (Array.isArray(row?.columns) && Array.isArray(row?.values)) {
      const keys = row.columns.filter((key) => !IGNORED_META_KEYS.has(key));
      const obj = {};
      keys.forEach((key, idx) => {
        obj[key] = row.values[idx];
      });
      if (Object.keys(obj).length > 0) {
        result.push(obj);
        continue;
      }
    }
    if (row && typeof row === 'object' && !Array.isArray(row)) {
      const sanitized = {};
      for (const [key, value] of Object.entries(row)) {
        if (!IGNORED_META_KEYS.has(key)) sanitized[key] = value;
      }
      if (Object.keys(sanitized).length > 0) {
        result.push(sanitized);
      }
    } else if (row != null && row !== undefined) {
      result.push({ value: row });
    }
  }
  return result;
};

const cleanText = (value) => {
  try {
    return String(value ?? '')
      .replace(/\r\n?/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } catch {
    return '';
  }
};

const cleanStreamText = (value) => {
  try {
    const normalized = String(value ?? '').replace(/\r\n?/g, '\n');
    const withoutTrailingSpaces = normalized.replace(/[ \t]+\n/g, '\n');
    return withoutTrailingSpaces.replace(/\n{3,}/g, '\n\n');
  } catch {
    return value;
  }
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildTablePreviewHtml = (tableProps) => {
  if (!tableProps || !Array.isArray(tableProps.data)) return '';
  const rows = tableProps.data.slice(0, 100);
  if (!rows.length) return '';
  const columns = Array.from(
    rows.reduce((set, row) => {
      if (row && typeof row === 'object' && !Array.isArray(row)) {
        Object.keys(row).forEach((key) => set.add(key));
      }
      return set;
    }, new Set()),
  );
  const headerHtml = columns
    .map((col) => `<th>${escapeHtml(col)}</th>`)
    .join('');
  const bodyHtml = rows
    .map((row) => {
      if (row && typeof row === 'object' && !Array.isArray(row)) {
        return `<tr>${columns.map((col) => `<td>${escapeHtml(row[col])}</td>`).join('')}</tr>`;
      }
      return `<tr><td>${escapeHtml(row)}</td></tr>`;
    })
    .join('');
  const note = tableProps.data.length > rows.length ? `<div class="note">Showing first ${rows.length} of ${tableProps.data.length} rows.</div>` : '';
  return `
    <section class="panel-section">
      <h3>Tabular Output</h3>
      <div class="table-wrapper">
        <table>
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>${bodyHtml}</tbody>
        </table>
      </div>
      ${note}
    </section>
  `;
};

const buildFiguresHtml = (figures) => {
  if (!Array.isArray(figures) || !figures.length) return '';
  const blocks = figures
    .map((fig, index) => {
      if (!fig || !fig.image) return '';
      const caption = fig.name ? escapeHtml(fig.name) : `Figure ${index + 1}`;
      return `
        <figure class="figure">
          <img src="data:image/png;base64,${fig.image}" alt="${caption}" />
          <figcaption>${caption}</figcaption>
        </figure>
      `;
    })
    .join('');
  return `
    <section class="panel-section">
      <h3>Figures</h3>
      <div class="figures">${blocks}</div>
    </section>
  `;
};

const buildGenericOutputHtml = (cell) => {
  const blocks = [];
  if (cell.outputRaw) {
    blocks.push(`
      <section class="panel-section">
        <h3>Text Output</h3>
        <pre class="code-block">${escapeHtml(cell.outputRaw)}</pre>
      </section>
    `);
  }
  const data = Array.isArray(cell.outputData) ? cell.outputData : [];
  if (!cell.outputTableProps && data.length) {
    const preview = escapeHtml(JSON.stringify(data.slice(0, 20), null, 2));
    blocks.push(`
      <section class="panel-section">
        <h3>Data Preview</h3>
        <pre class="code-block">${preview}</pre>
      </section>
    `);
  }
  if (!blocks.length) {
    blocks.push('<section class="panel-section"><div class="empty">No output captured yet.</div></section>');
  }
  return blocks.join('');
};

const buildMaximizedPageHtml = (cell) => {
  const codeLabel = cell.type === 'python' ? 'Python' : cell.type === 'text' ? 'Prompt' : cell.type === 'sql' ? 'SQL' : 'Editor';
  const languageClass = (() => {
    if (cell?.language) return String(cell.language).toLowerCase();
    if (cell?.type === 'python') return 'python';
    if (cell?.type === 'sql') return 'sql';
    if (cell?.type === 'text') return 'markdown';
    return 'plaintext';
  })();
  const escapedContent = escapeHtml(cell.content || '');
  const isPythonCell = cell.type === 'python';
  const codeEditorHtml = isPythonCell
    ? `<div id="code-editor-host" class="code-editor-host">${escapedContent || ''}</div>`
    : `<pre><code class="hljs language-${escapeHtml(languageClass)}">${escapedContent || '// Empty cell'}</code></pre>`;
  const metadataEntries = [
    cell.dfName ? `<div><span>DataFrame</span><strong>${escapeHtml(cell.dfName)}</strong></div>` : '',
    `<div><span>Mode</span><strong>${escapeHtml(cell.type ? cell.type.toUpperCase() : 'UNKNOWN')}</strong></div>`,
  ].filter(Boolean);
  const metadataHtml = [
    metadataEntries.length ? metadataEntries.join('') : '<div><span>Status</span><strong>Ready</strong></div>',
    `<div><span>Cell ID</span><strong>${escapeHtml(cell.id || '')}</strong></div>`,
  ].join('');
  const initialOutputHtml = '<section class="panel-section"><div class="empty">Run this cell here to capture fresh output.</div></section>';
  const runButtonLabel = isPythonCell ? 'Run Python' : 'Run Cell';
  const sidebarTip = isPythonCell
    ? 'Edit and execute Python in this window. Results stay here for review.'
    : 'Use this window for focused editing. Return to the notebook to execute.';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(cell.title || 'Notebook Cell')} · Maximize</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/vs2015.min.css" integrity="sha512-8ncNehJIK/gY/SiAj+QIrbOOgqX7FnGk3REScLf36ToYPpIk79gdn7nc6FwQLKZoCxJqxNd9wVF6dFTqgCSw9g==" crossorigin="anonymous" referrerpolicy="no-referrer" />
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: 'Segoe UI', 'Inter', 'Roboto', sans-serif;
        background: #1e1e1e;
        color: #e7e7e7;
        height: 100vh;
        display: flex;
        flex-direction: column;
      }
      header {
        height: 36px;
        background: linear-gradient(90deg, #0f4c75, #1b262c);
        display: flex;
        align-items: center;
        padding: 0 16px;
        font-size: 0.85rem;
        letter-spacing: 0.3px;
      }
      header span { opacity: 0.8; margin-left: 8px; }
      .workspace { flex: 1; display: flex; overflow: hidden; }
      .activity-bar {
        width: 48px;
        background: #252526;
        border-right: 1px solid rgba(255,255,255,0.04);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        padding: 12px 0;
        font-size: 0.9rem;
        color: rgba(255,255,255,0.4);
      }
      .sidebar {
        width: 240px;
        background: #1f2430;
        border-right: 1px solid rgba(255,255,255,0.04);
        padding: 12px 16px;
        display: flex;
        flex-direction: column;
        transition: width 0.2s ease;
        overflow: hidden;
      }
      .sidebar.collapsed {
        width: 56px;
        padding: 12px 8px;
      }
      .sidebar details {
        flex: 1;
        display: flex;
        flex-direction: column;
        color: rgba(231,231,231,0.85);
      }
      .sidebar summary {
        margin: 0;
        font-size: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 0.2em;
        color: #9db4ff;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .sidebar summary::-webkit-details-marker { display: none; }
      .sidebar summary::after {
        content: '+';
        margin-left: auto;
        font-size: 1rem;
        color: rgba(157,180,255,0.8);
        transition: transform 0.2s ease;
      }
      .sidebar details[open] > summary::after {
        content: '-';
      }
      .sidebar .collapsible-body {
        margin-top: 12px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        flex: 1;
      }
      .sidebar .meta {
        display: flex;
        flex-direction: column;
        gap: 10px;
        font-size: 0.78rem;
      }
      .sidebar .meta div {
        display: flex;
        justify-content: space-between;
        gap: 6px;
        color: rgba(231,231,231,0.85);
      }
      .sidebar .meta span { color: rgba(231,231,231,0.5); }
      .sidebar .tip {
        font-size: 0.75rem;
        color: rgba(255,255,255,0.55);
        line-height: 1.4;
      }
      .sidebar.collapsed summary {
        justify-content: center;
      }
      .sidebar.collapsed .collapsible-body {
        display: none;
      }
      .main { flex: 1; display: flex; flex-direction: column; }
      .tab-bar {
        height: 34px;
        background: #2d2d2d;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 0 16px;
        font-size: 0.8rem;
      }
      .tab {
        padding: 6px 12px;
        border-radius: 6px 6px 0 0;
        background: #1e1e1e;
        border: 1px solid rgba(255,255,255,0.06);
        border-bottom: none;
        color: #c6d4ff;
      }
      .panels { flex: 1; display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 30%); overflow: hidden; }
      .panel { flex: 1; display: flex; flex-direction: column; background: #1e1e1e; border-right: 1px solid rgba(255,255,255,0.04); }
      .panel:last-child { border-right: none; }
      .panel.panel-editor { grid-column: 1; min-width: 0; }
      .panel.panel-output { grid-column: 2; min-width: 0; width: 100%; border-left: 1px solid rgba(255,255,255,0.04); overflow: hidden; }
      .panel.panel-output .panel-content { overflow-x: auto; overflow-y: auto; }
      @media (max-width: 960px) {
        .panels { grid-template-columns: minmax(0, 1fr) minmax(220px, 30%); }
      }
      .panel-header {
        height: 32px;
        padding: 0 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 0.78rem;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        color: #9db4ff;
        border-bottom: 1px solid rgba(255,255,255,0.04);
      }
      .panel-content {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 18px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-height: 0;
      }
      .code-editor {
        background: #1d1f24;
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 8px;
        padding: 0;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.02);
        flex: 1;
        display: flex;
      }
      .code-editor-host {
        flex: 1;
        width: 100%;
        min-height: 320px;
        border-radius: 8px;
        overflow: hidden;
        background: #1d1f24;
        color: #e7e7e7;
        font-family: 'Fira Code', 'Source Code Pro', monospace;
        font-size: 0.9rem;
        line-height: 1.6;
      }
      .code-editor-host textarea {
        width: 100%;
        height: 100%;
        padding: 14px 16px;
        border: none;
        background: transparent;
        color: #e7e7e7;
        resize: none;
        outline: none;
        font-family: 'Fira Code', 'Source Code Pro', monospace;
        font-size: 0.9rem;
        line-height: 1.6;
      }
      .code-textarea {
        width: 100%;
        height: 100%;
        padding: 14px 16px;
        border: none;
        background: transparent;
        color: #e7e7e7;
        resize: none;
        outline: none;
        font-family: 'Fira Code', 'Source Code Pro', monospace;
        font-size: 0.9rem;
        line-height: 1.6;
      }
      .ace_editor {
        width: 100% !important;
        height: 100% !important;
        font-family: 'Fira Code', 'Source Code Pro', monospace !important;
        font-size: 14px !important;
      }
      .ace_editor .ace_scroller {
        padding: 14px 16px;
      }
      .ace_editor .ace_print-margin {
        display: none;
      }
      .code-input:focus { outline: 2px solid rgba(79,160,255,0.45); }
      .command-bar {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-bottom: 12px;
      }
      .command-bar button {
        background: #0e639c;
        color: #fff;
        border: none;
        border-radius: 4px;
        padding: 6px 12px;
        font-size: 0.78rem;
        cursor: pointer;
      }
      .command-bar button.secondary {
        background: #3a3d41;
        color: rgba(255,255,255,0.85);
      }
      .command-bar button:disabled { cursor: not-allowed; opacity: 0.6; }
      .panel-section h3 { margin: 0 0 8px; font-size: 0.9rem; color: #c6d4ff; }
      .panel-section .note { margin-top: 8px; font-size: 0.75rem; color: rgba(255,255,255,0.6); }
      .table-wrapper { overflow: auto; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; max-height: 360px; }
      table { width: max-content; min-width: 100%; border-collapse: collapse; font-size: 0.82rem; }
      thead { background: rgba(30,64,120,0.35); }
      th, td { padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.06); text-align: left; }
      tr:nth-child(even) td { background: rgba(255,255,255,0.03); }
      .code-block {
        background: rgba(15,20,30,0.9);
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 6px;
        padding: 12px;
        font-family: 'Fira Code', 'Source Code Pro', monospace;
        font-size: 0.82rem;
        white-space: pre-wrap;
      }
      .empty {
        padding: 16px;
        background: rgba(255,255,255,0.03);
        border-radius: 6px;
        color: rgba(255,255,255,0.6);
      }
      .figures { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
      .figure {
        margin: 0;
        background: rgba(255,255,255,0.03);
        border-radius: 6px;
        padding: 10px;
        border: 1px solid rgba(255,255,255,0.04);
      }
      .figure img { width: 100%; display: block; border-radius: 4px; }
      .figure figcaption { margin-top: 6px; font-size: 0.75rem; color: rgba(255,255,255,0.65); }
    </style>
  </head>
  <body>
    <header>
      <strong>${escapeHtml(cell.title || 'Notebook Cell')}</strong>
      <span>Maximized view</span>
    </header>
    <div class="workspace">
      <nav class="activity-bar">
        <div>●</div>
        <div>●</div>
        <div>●</div>
      </nav>
      <aside class="sidebar">
        <details id="sidebar-details" open>
          <summary>Details</summary>
          <div class="collapsible-body">
            <div class="meta">
              ${metadataHtml}
            </div>
            <div class="tip">${escapeHtml(sidebarTip)}</div>
          </div>
        </details>
      </aside>
      <section class="main">
        <div class="tab-bar">
          <div class="tab">${escapeHtml(cell.title || 'Cell')}</div>
        </div>
        <div class="panels">
          <section class="panel panel-editor">
            <div class="panel-header">
              <span>${escapeHtml(codeLabel)} Editor</span>
              <div class="command-bar">
                <button id="run-button" type="button">${escapeHtml(runButtonLabel)}</button>
                <button id="close-button" class="secondary" type="button">Close</button>
              </div>
            </div>
            <div class="panel-content">
              <div class="code-editor">
                ${codeEditorHtml}
              </div>
            </div>
          </section>
          <section class="panel panel-output">
            <div class="panel-header">
              <span>Execution Output</span>
            </div>
            <div class="panel-content" id="output-panel">
              ${initialOutputHtml}
            </div>
          </section>
        </div>
      </section>
    </div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/ace/1.32.3/ace.js" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js" integrity="sha512-ZUJ0uCwZ0pniS3pSke1Mt2rt7NmBGG99nmHn7+O+kO5OVwOB1p5MNDoAuCEi0aKBslZx2drXr/7EQo1leChX8w==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
    <script>
      (function() {
        const cellType = '${escapeHtml(cell.type || '')}';
        const cellId = '${escapeHtml(cell.id || '')}';
        const runButton = document.getElementById('run-button');
        const closeButton = document.getElementById('close-button');
        const outputPanel = document.getElementById('output-panel');
        const editorHost = document.getElementById('code-editor-host');
        const sidebar = document.querySelector('.sidebar');
        const sidebarDetails = document.getElementById('sidebar-details');
        if (sidebar && sidebarDetails) {
          const syncSidebarState = () => {
            if (sidebarDetails.open) {
              sidebar.classList.remove('collapsed');
            } else {
              sidebar.classList.add('collapsed');
            }
          };
          sidebarDetails.addEventListener('toggle', syncSidebarState);
          syncSidebarState();
        }
        let codeProvider = {
          getValue: () => '',
          focus: () => {},
          onShortcut: () => {},
        };

        const escapeHtmlSafe = (value) => {
          if (value === null || value === undefined) return '';
          return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        };

        const showStatus = (message) => {
          if (!outputPanel) return;
          outputPanel.innerHTML = '<section class="panel-section"><div class="note">' + escapeHtmlSafe(message) + '</div></section>';
        };

        const renderPythonResult = (payload) => {
          if (!outputPanel) return;
          if (!payload || typeof payload !== 'object') {
            outputPanel.innerHTML = '<section class="panel-section"><div class="empty">No output captured.</div></section>';
            return;
          }
          const sections = [];
          const stdout = payload.stdout || '';
          const stderr = payload.stderr || '';
          const tables = payload.tables && typeof payload.tables === 'object' ? payload.tables : {};
          const figures = Array.isArray(payload.figures) ? payload.figures : [];

          if (stdout.trim()) {
            sections.push('<section class="panel-section"><h3>stdout</h3><pre class="code-block">' + escapeHtmlSafe(stdout) + '</pre></section>');
          }
          if (stderr.trim()) {
            sections.push('<section class="panel-section"><h3>stderr</h3><pre class="code-block">' + escapeHtmlSafe(stderr) + '</pre></section>');
          }

          const buildTable = (name, rows) => {
            if (!Array.isArray(rows) || !rows.length) return '';
            const safeName = name ? escapeHtmlSafe(name) : 'table';
            const limited = rows.slice(0, 100);
            if (typeof rows[0] === 'object' && rows[0] !== null && !Array.isArray(rows[0])) {
              const columns = Object.keys(rows[0]);
              const head = columns.map((col) => '<th>' + escapeHtmlSafe(col) + '</th>').join('');
              const body = limited
                .map((row) => '<tr>' + columns.map((col) => '<td>' + escapeHtmlSafe(row[col]) + '</td>').join('') + '</tr>')
                .join('');
              return '<section class="panel-section"><h3>Table: ' + safeName + '</h3><div class="table-wrapper"><table><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>' + (rows.length > 100 ? '<div class="note">Showing first 100 rows.</div>' : '') + '</section>';
            }
            const body = limited.map((value) => '<tr><td>' + escapeHtmlSafe(value) + '</td></tr>').join('');
            return '<section class="panel-section"><h3>Table: ' + safeName + '</h3><div class="table-wrapper"><table><thead><tr><th>value</th></tr></thead><tbody>' + body + '</tbody></table></div>' + (rows.length > 100 ? '<div class="note">Showing first 100 rows.</div>' : '') + '</section>';
          };

          for (const [name, rows] of Object.entries(tables)) {
            const tableHtml = buildTable(name, rows);
            if (tableHtml) sections.push(tableHtml);
          }

          if (figures.length) {
            const figureBlocks = figures
              .map((fig, index) => {
                const image = fig && typeof fig.image === 'string' ? fig.image.trim() : '';
                if (!image) return '';
                const caption = fig && typeof fig.name === 'string' && fig.name.trim() ? fig.name : 'Figure ' + (index + 1);
                return '<figure class="figure"><img src="data:image/png;base64,' + image + '" alt="' + escapeHtmlSafe(caption) + '" /><figcaption>' + escapeHtmlSafe(caption) + '</figcaption></figure>';
              })
              .filter(Boolean)
              .join('');
            if (figureBlocks) {
              sections.push('<section class="panel-section"><h3>Figures</h3><div class="figures">' + figureBlocks + '</div></section>');
            }
          }

          if (!sections.length) {
            sections.push('<section class="panel-section"><div class="empty">No output captured.</div></section>');
          }
          outputPanel.innerHTML = sections.join('');
        };

        if (closeButton) {
          closeButton.addEventListener('click', () => window.close());
        }

        if (cellType === 'python') {
          const initialCode = editorHost ? editorHost.textContent || '' : '';
          const encodeForTextarea = (value) => escapeHtmlSafe(value || '');

          if (editorHost) {
            editorHost.textContent = '';
          }

          let aceInitialized = false;

          if (editorHost && window.ace && typeof window.ace.edit === 'function') {
            try {
              if (window.ace.config && typeof window.ace.config.set === 'function') {
                window.ace.config.set('basePath', 'https://cdnjs.cloudflare.com/ajax/libs/ace/1.32.3/');
              }
              const aceEditor = window.ace.edit(editorHost, {
                useWorker: false,
              });
              aceEditor.setTheme('ace/theme/twilight');
              aceEditor.session.setMode('ace/mode/python');
              aceEditor.session.setUseWrapMode(true);
              aceEditor.session.setTabSize(2);
              aceEditor.session.setUseSoftTabs(true);
              aceEditor.setShowPrintMargin(false);
              aceEditor.renderer.setScrollMargin(8, 8, 12, 8);
              aceEditor.setValue(initialCode || '', -1);
              aceEditor.focus();

              codeProvider = {
                getValue: () => aceEditor.getValue(),
                focus: () => aceEditor.focus(),
                onShortcut: (handler) => {
                  if (!handler) return;
                  aceEditor.commands.addCommand({
                    name: 'run-python-cell',
                    bindKey: { win: 'Ctrl-Enter', mac: 'Command-Enter' },
                    exec: handler,
                  });
                },
              };
              aceInitialized = true;
            } catch (err) {
              console.error('Ace editor initialization failed', err);
            }
          }

          if (!aceInitialized && editorHost) {
            // Ace unavailable — fallback to textarea.
            editorHost.textContent = '';
            const fallbackEditor = document.createElement('textarea');
            fallbackEditor.id = 'code-editor';
            fallbackEditor.className = 'code-textarea';
            fallbackEditor.spellcheck = false;
            fallbackEditor.value = initialCode || '';
            editorHost.appendChild(fallbackEditor);
            if (fallbackEditor) {
              fallbackEditor.addEventListener('keydown', (event) => {
                if (event.key === 'Tab') {
                  event.preventDefault();
                  const start = fallbackEditor.selectionStart;
                  const end = fallbackEditor.selectionEnd;
                  const value = fallbackEditor.value;
                  const insert = '  ';
                  fallbackEditor.value = value.slice(0, start) + insert + value.slice(end);
                  fallbackEditor.selectionStart = fallbackEditor.selectionEnd = start + insert.length;
                }
              });
            }
            codeProvider = {
              getValue: () => (fallbackEditor ? fallbackEditor.value : ''),
              focus: () => fallbackEditor && fallbackEditor.focus(),
              onShortcut: (handler) => {
                if (!fallbackEditor || !handler) return;
                fallbackEditor.addEventListener('keydown', (event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                    event.preventDefault();
                    handler();
                  }
                });
              },
            };
          }

          const resolveApiUrl = (path) => {
            const candidates = [
              () => (window.opener && window.opener.location ? window.opener.location.origin : null),
              () => {
                try {
                  return document.referrer ? new URL(document.referrer).origin : null;
                } catch (_) {
                  return null;
                }
              },
              () => window.location.origin,
            ];
            for (const getBase of candidates) {
              try {
                const base = getBase();
                if (base && base !== 'null' && base !== 'undefined') {
                  return new URL(path, base).toString();
                }
              } catch (_) {
                continue;
              }
            }
            return path;
          };

          const handleRun = async () => {
            if (!runButton) return;
            const code = codeProvider.getValue ? codeProvider.getValue() : '';
            const originalText = runButton.textContent;
            runButton.disabled = true;
            runButton.textContent = 'Running…';
            showStatus('Executing Python code…');
            try {
              const endpoint = resolveApiUrl('/api/python/execute');
              const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
              });
              if (!response.ok) {
                let message = 'Python execution failed.';
                try {
                  const errJson = await response.json();
                  if (errJson && errJson.error) message = errJson.error;
                } catch (_) {}
                throw new Error(message);
              }
              const data = await response.json();
              renderPythonResult(data);
              if (window.opener && typeof window.opener.postMessage === 'function') {
                window.opener.postMessage({ type: 'maximized-python-sync', cellId, payload: data, code }, '*');
              }
            } catch (error) {
              const message = error && error.message ? error.message : String(error);
              outputPanel.innerHTML = '<section class="panel-section"><h3>Error</h3><pre class="code-block">' + escapeHtmlSafe(message) + '</pre></section>';
            } finally {
              runButton.textContent = originalText;
              runButton.disabled = false;
            }
          };

          if (runButton) {
            runButton.addEventListener('click', handleRun);
          }
          if (codeProvider.onShortcut) {
            codeProvider.onShortcut(handleRun);
          }
        } else {
          try {
            if (window.hljs && typeof window.hljs.highlightAll === 'function') {
              window.hljs.highlightAll();
            }
          } catch (error) {
            console.error(error);
          }

          if (runButton) {
            runButton.disabled = true;
            runButton.textContent = 'Run in Notebook';
            runButton.title = 'Use the main window to execute this cell';
          }
        }
      })();
    </script>
  </body>
</html>`;
};
const SAVED_VIEW_TOTAL_KEYS = [
  'totalRows', 'rowsTotal', 'rowCount', 'totalRowCount',
  'total_rows', 'rows_total', 'row_count',
  'TOTAL_ROWS', 'ROWS_TOTAL', 'ROW_COUNT',
  'total',
];
const SAVED_VIEW_SERVER_KEYS = ['serverMode', 'server_mode', 'SERVER_MODE'];

const parseMaybeJsonObject = (value) => {
  if (!value || typeof value === 'function') return null;
  if (Array.isArray(value)) return null;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
};

const collectSavedViewScopes = (viewContent, exportContext, jsonPayload) => {
  const scopes = [];
  const pushScope = (candidate) => {
    const parsed = parseMaybeJsonObject(candidate);
    if (parsed) scopes.push(parsed);
  };

  pushScope(jsonPayload);
  if (jsonPayload && typeof jsonPayload === 'object') {
    pushScope(jsonPayload.pagination);
    pushScope(jsonPayload.meta);
  }

  pushScope(viewContent);
  if (viewContent && typeof viewContent === 'object') {
    pushScope(viewContent.state);
    pushScope(viewContent.STATE);
    pushScope(viewContent.content);
    pushScope(viewContent.CONTENT);
  }

  const viewState = parseMaybeJsonObject(viewContent?.viewState || viewContent?.view_state);
  if (viewState) {
    pushScope(viewState);
    pushScope(viewState.state || viewState.STATE);
    pushScope(viewState.viewState || viewState.view_state);
    pushScope(viewState.options || viewState.OPTIONS);
  }

  const contentOptions = parseMaybeJsonObject(viewContent?.options || viewContent?.OPTIONS);
  if (contentOptions) pushScope(contentOptions);

  const nestedState = parseMaybeJsonObject(viewContent?.state || viewContent?.STATE);
  if (nestedState) {
    pushScope(nestedState);
    pushScope(nestedState.options || nestedState.OPTIONS);
  }

  const parsedExport = parseMaybeJsonObject(exportContext);
  if (parsedExport) pushScope(parsedExport);

  return scopes;
};

const pickFirstFiniteNumber = (values) => {
  for (const value of values) {
    const num = Number(value);
    if (Number.isFinite(num) && num >= 0) return num;
  }
  return null;
};

const pickFirstBoolean = (values) => {
  for (const value of values) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
      if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    }
    if (typeof value === 'number') {
      if (value === 1) return true;
      if (value === 0) return false;
    }
  }
  return null;
};

const deriveSavedViewTotalRows = (viewContent, jsonPayload, exportContext, fallbackCount) => {
  const scopes = collectSavedViewScopes(viewContent, exportContext, jsonPayload);
  const values = [];
  if (jsonPayload && typeof jsonPayload === 'object' && 'total' in jsonPayload) values.push(jsonPayload.total);
  for (const scope of scopes) {
    for (const key of SAVED_VIEW_TOTAL_KEYS) {
      if (Object.prototype.hasOwnProperty.call(scope, key)) {
        values.push(scope[key]);
      }
    }
  }
  const picked = pickFirstFiniteNumber(values);
  if (picked !== null) return picked;
  return Number.isFinite(fallbackCount) && fallbackCount >= 0 ? fallbackCount : 0;
};

const deriveSavedViewServerMode = (viewContent, jsonPayload, exportContext, totalRows, sampleRows, defaultMode) => {
  const scopes = collectSavedViewScopes(viewContent, exportContext, jsonPayload);
  const candidates = [];
  for (const scope of scopes) {
    for (const key of SAVED_VIEW_SERVER_KEYS) {
      if (Object.prototype.hasOwnProperty.call(scope, key)) {
        candidates.push(scope[key]);
      }
    }
  }

  const explicit = pickFirstBoolean(candidates);
  if (explicit === true) return true;
  if (explicit === false) {
    if (exportContext && Number.isFinite(totalRows) && totalRows > (sampleRows || 0)) {
      return true;
    }
    return false;
  }

  if (exportContext) {
    if (Number.isFinite(totalRows) && totalRows > (sampleRows || 0)) return true;
    return true;
  }

  return defaultMode;
};

export default function NotebookWorkbench({
  tableButtonPermissions: _tableButtonPermissions = {},
  sendSqlToLlm: _sendSqlToLlm = false,
  perfMaxClientRows = 5000,
  perfMaxScan = 5000,
  perfMaxDistinct = 50,
  virtualizeOnMaximize = true,
  virtMaxClientRows: _virtMaxClientRows = 50000,
  virtRowHeight = 28,
  serverMode: globalServerMode = false,
  tableOpsMode: defaultTableOpsMode = 'flask',
  pushDownDb: defaultPushDownDb = false,
  logEnabled: _logEnabled = false,
  trainingUrl: _trainingUrl = '',
  updateIntervalMs = 200,
  minRowsPerUpdate = 100,
  clobPreview = 8192,
  blobPreview = 2048,
  maxVisibleMessages: _maxVisibleMessages = 5,
} = {}) {
  const [cells, setCells] = useState(() => initialCells());
  const [results, setResults] = useState({
    table: baseTable,
    dataFrame: baseTable,
    dataFrames: { base: baseTable },
    activeDataFrameName: 'base',
    logs: ['Notebook initialized.'],
  });
  const [savedViews, setSavedViews] = useState([]);
  const [loadingViews, setLoadingViews] = useState(false);
  const [viewsError, setViewsError] = useState(null);
  const [model, setModel] = useState('llama3.2:1b');
  const [agent, setAgent] = useState('direct');
  const [runningCellId, setRunningCellId] = useState(null);
  const [dragOverCellId, setDragOverCellId] = useState(null);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [savedViewsCollapsed, setSavedViewsCollapsed] = useState(false);
  const [logWrapEnabled, setLogWrapEnabled] = useState(false);
  const runCellByIdRef = useRef(() => {});

  const handleMaximizeCell = useCallback((targetCell) => {
    if (!targetCell) return;
    try {
      const html = buildMaximizedPageHtml(targetCell);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const win = window.open('', '_blank');
      if (!win) {
        URL.revokeObjectURL(url);
        window.alert('Unable to open the maximized view. Please check your browser pop-up settings.');
        return;
      }

      const revoke = () => {
        URL.revokeObjectURL(url);
        win.removeEventListener('load', revoke);
      };
      win.addEventListener('load', revoke);
      win.location = url;
    } catch (error) {
      console.error('Maximize cell failed', error);
    }
  }, []);

  const handleExportLogs = useCallback(() => {
    try {
      const content = Array.isArray(results?.logs) ? results.logs.join('\n') : '';
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `notebook_logs_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Log export failed', error);
    }
  }, [results?.logs]);
  const [csvCollapsed, setCsvCollapsed] = useState(false);
  const [csvEntries, setCsvEntries] = useState([]);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvError, setCsvError] = useState(null);
  const [selectedCsvIds, setSelectedCsvIds] = useState(() => new Set());
  const [pythonScripts, setPythonScripts] = useState([]);
  const [pythonScriptsLoading, setPythonScriptsLoading] = useState(false);
  const [pythonScriptsError, setPythonScriptsError] = useState(null);
  const [pythonScriptsSaving, setPythonScriptsSaving] = useState(false);
  const [pythonScriptSelections, setPythonScriptSelections] = useState({});
  const [pythonScriptsCollapsed, setPythonScriptsCollapsed] = useState({});
  const [pythonScriptLoadingId, setPythonScriptLoadingId] = useState(null);

  const resolvedPerfMaxClientRows = Number(perfMaxClientRows);
  const maxClientRowsCap = resolvedPerfMaxClientRows < 0
    ? Number.POSITIVE_INFINITY
    : Math.max(1, Math.min(5000, resolvedPerfMaxClientRows || 5000));
  const resolvedPerfOptions = {
    maxScan: Number.isFinite(perfMaxScan) ? perfMaxScan : 5000,
    maxDistinct: Number.isFinite(perfMaxDistinct) ? perfMaxDistinct : 50,
  };
  const resolvedPreviewOptions = { maxClob: clobPreview, maxBlob: blobPreview };
  const effectiveTableOpsMode = defaultTableOpsMode || 'flask';
  const effectivePushDownDb = !!defaultPushDownDb;

  const runCell = useCallback(
    async (cell, silent = false) => {
      if (!cell) return;
      if (!silent) setRunningCellId(cell.id);
      const stamp = new Date().toLocaleTimeString();
      const cellIndex = cells.findIndex((c) => c.id === cell.id);
      const inferredName = `df_${cellIndex >= 0 ? cellIndex + 1 : cells.length + 1}`;
      const dfName = cell.dfName || inferredName;

      if (cell.type === 'text') {
        const prompt = cell.content?.trim();
        if (!prompt) {
          if (!silent) {
            setResults((prev) => ({
              ...prev,
              logs: [...prev.logs, `⚠️ [${stamp}] NLP cell skipped — no prompt provided.`],
            }));
          }
          if (!silent) setRunningCellId(null);
          return;
        }

        const isDbLike = DB_AGENTS.includes(agent);
        setResults((prev) => ({
          ...prev,
          logs: [...prev.logs, `📡 [${stamp}] Sending NLP prompt using model ${model || 'default'} and agent ${agent}.`],
        }));

        try {
          setCells((prev) =>
            prev.map((c) =>
              c.id === cell.id
                ? {
                    ...c,
                    dfName,
                    showOutput: true,
                    outputCollapsed: false,
                    outputData: [],
                    outputActiveColumn: null,
                    outputRaw: '',
                    outputTableProps: null,
                  }
                : c,
            ),
          );

          const res = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              prompt,
              mode: agent,
              stream: true,
            }),
          });

          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`${res.status} ${res.statusText}: ${errorText}`);
          }

          const reader = res.body && typeof res.body.getReader === 'function' ? res.body.getReader() : null;

          if (!reader) {
            const raw = await res.text();
            const cleaned = cleanStreamText(raw);
            setCells((prev) =>
              prev.map((c) =>
                c.id === cell.id
                  ? {
                      ...c,
                      dfName,
                      showOutput: true,
                      outputCollapsed: false,
                      outputRaw: cleaned,
                      outputData: [],
                      outputActiveColumn: null,
                      outputTableProps: null,
                    }
                  : c,
              ),
            );
            setResults((prev) => ({
              ...prev,
              logs: [...prev.logs, `🤖 [${stamp}] NLP completed (text response).`],
            }));
          } else if (isDbLike) {
            const decoder = new TextDecoder('utf-8');
            let buffer = '';
            const aggregatedRows = [];
            let narrationText = '';
            let baseSql = null;
            let columnTypes = null;
            let searchColumns = null;
            const updateInterval = Math.max(50, Math.min(5000, Number(updateIntervalMs) || 200));
            const minRowsThreshold = Math.max(1, Math.min(500, Number(minRowsPerUpdate) || 100));
            let lastFlush = performance.now();
            let rowsSinceFlush = 0;
            const appendRecords = (records) => {
              const normalized = normalizeRecords(records);
              if (!normalized.length) return;
              const remaining = maxClientRowsCap - aggregatedRows.length;
              if (remaining <= 0) return;
              const slice = normalized.slice(0, remaining);
              aggregatedRows.push(...slice);
              rowsSinceFlush += slice.length;
            };

            const flushUpdate = () => {
              setCells((prev) =>
                prev.map((c) => {
                  if (c.id !== cell.id) return c;
                  const rowsForOutput = aggregatedRows.slice();
                  const columns = rowsForOutput.length && typeof rowsForOutput[0] === 'object' ? Object.keys(rowsForOutput[0]) : [];
                  const activeColumn = columns.length ? columns[0] : null;
                  const tableProps = rowsForOutput.length
                    ? {
                        data: rowsForOutput,
                        exportContext: baseSql
                          ? {
                              prompt,
                              mode: agent,
                              model,
                              baseSql,
                              columnTypes: columnTypes || null,
                              searchColumns: searchColumns || null,
                            }
                          : null,
                        tableOpsMode: effectiveTableOpsMode,
                        pushDownDb: effectivePushDownDb && !!baseSql,
                        totalRows: rowsForOutput.length,
                        serverMode: globalServerMode,
                        initialPageSize: TABLE_COMPONENT_DEFAULT_PAGE_SIZE,
                        initialFontSize: 11,
                        buttonsDisabled: false,
                        previewOptions: { ...resolvedPreviewOptions },
                        perfOptions: { ...resolvedPerfOptions },
                        initialViewState: null,
                        initialSchema: columnTypes ? { columnTypes } : null,
                        virtualizeOnMaximize,
                        virtualRowHeight: virtRowHeight,
                        initialMaximized: false,
                        showMaximizeControl: true,
                      }
                    : null;

                  return {
                    ...c,
                    dfName,
                    showOutput: true,
                    outputCollapsed: false,
                    outputData: rowsForOutput,
                    outputActiveColumn: activeColumn,
                    outputRaw: narrationText ? cleanStreamText(narrationText) : '',
                  outputTableProps: tableProps,
                };
              }),
            );
            };

            const updateRawOnly = () => {
              const formatted = narrationText ? cleanStreamText(narrationText) : '';
              setCells((prev) =>
                prev.map((c) => (c.id === cell.id ? { ...c, outputRaw: formatted } : c)),
              );
            };

            const maybeFlush = (force = false) => {
              const now = performance.now();
              const shouldFlush = force || rowsSinceFlush >= minRowsThreshold || now - lastFlush >= updateInterval;
              if (shouldFlush) {
                flushUpdate();
                lastFlush = now;
                rowsSinceFlush = 0;
              } else if (narrationText) {
                updateRawOnly();
              }
            };

            const handleLine = (line) => {
              if (typeof line !== 'string') return;
              const trimmed = line.trim();
              if (!trimmed) return;
              if (trimmed === '[DONE]') return;
              const withoutPrefix = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
              let parsed = null;
              try {
                parsed = JSON.parse(withoutPrefix);
              } catch {
                parsed = null;
              }

              if (parsed && typeof parsed === 'object') {
                if (parsed._narration) narrationText = parsed._narration;
                if (parsed._base_sql) baseSql = String(parsed._base_sql);
                if (parsed._column_types && typeof parsed._column_types === 'object') columnTypes = parsed._column_types;
                if (Array.isArray(parsed._search_columns)) searchColumns = parsed._search_columns;
                if (Array.isArray(parsed.rows)) appendRecords(parsed.rows);
                if (Array.isArray(parsed.tableData)) appendRecords(parsed.tableData);
                if (Array.isArray(parsed.data)) appendRecords(parsed.data);
                if (Array.isArray(parsed.records)) appendRecords(parsed.records);
                if (Array.isArray(parsed.outputs)) appendRecords(parsed.outputs);
                if (parsed.response !== undefined && parsed.response !== null) {
                  narrationText += String(parsed.response);
                }
                if (appendObjectRecord(aggregatedRows, parsed, maxClientRowsCap)) rowsSinceFlush += 1;
              } else if (Array.isArray(parsed)) {
                appendRecords(parsed);
              } else if (parsed && typeof parsed === 'string') {
                narrationText += parsed;
              } else if (!parsed) {
                narrationText += withoutPrefix;
              }

              maybeFlush();
            };

            let doneReading = false;
            while (!doneReading) {
              const { value, done: doneChunk } = await reader.read();
              doneReading = doneChunk;
              const chunkText = value ? decoder.decode(value, { stream: !doneChunk }) : decoder.decode();
              if (chunkText) buffer += chunkText;

              let newlineIndex = buffer.indexOf('\n');
              while (newlineIndex !== -1) {
                const line = buffer.slice(0, newlineIndex);
                buffer = buffer.slice(newlineIndex + 1);
                handleLine(line);
                newlineIndex = buffer.indexOf('\n');
              }
            }

            const remainder = buffer.trim();
            if (remainder) handleLine(remainder);

            maybeFlush(true);

            const finalRows = aggregatedRows.slice();
            const finalNarration = narrationText ? cleanStreamText(narrationText) : '';
            const columns = finalRows.length && typeof finalRows[0] === 'object' ? Object.keys(finalRows[0]) : [];
            const activeColumnFinal = columns.length ? columns[0] : null;

            setCells((prev) =>
              prev.map((c) => {
                if (c.id !== cell.id) return c;
                const tableProps = finalRows.length
                  ? {
                      data: finalRows,
                      exportContext: baseSql
                        ? {
                            prompt,
                            mode: agent,
                            model,
                            baseSql,
                            columnTypes: columnTypes || null,
                            searchColumns: searchColumns || null,
                          }
                        : null,
                      tableOpsMode: effectiveTableOpsMode,
                      pushDownDb: effectivePushDownDb && !!baseSql,
                      totalRows: finalRows.length,
                      serverMode: globalServerMode,
                      initialPageSize: TABLE_COMPONENT_DEFAULT_PAGE_SIZE,
                      initialFontSize: 11,
                      buttonsDisabled: false,
                      previewOptions: { ...resolvedPreviewOptions },
                      perfOptions: { ...resolvedPerfOptions },
                      initialViewState: null,
                      initialSchema: columnTypes ? { columnTypes } : null,
                      virtualizeOnMaximize,
                      virtualRowHeight: virtRowHeight,
                      initialMaximized: false,
                      showMaximizeControl: true,
                    }
                  : null;

                return {
                  ...c,
                  dfName,
                  showOutput: true,
                  outputCollapsed: false,
                  outputData: finalRows,
                  outputActiveColumn: finalRows.length ? activeColumnFinal : null,
                  outputRaw: finalNarration,
                  outputTableProps: tableProps,
                };
              }),
            );

            setResults((prev) => {
              const logs = [...prev.logs];
              if (finalRows.length) {
                const dataFrames = { ...prev.dataFrames, [dfName]: finalRows };
                logs.push(`🤖 [${stamp}] NLP completed (${finalRows.length} rows captured).`, `📦 [${stamp}] Output stored as ${dfName}.`);
                return {
                  ...prev,
                  table: finalRows,
                  dataFrame: finalRows,
                  dataFrames,
                  activeDataFrameName: dfName,
                  logs,
                };
              }
              logs.push(`ℹ️ [${stamp}] NLP response captured.`);
              return { ...prev, logs };
            });
          } else {
            const decoder = new TextDecoder('utf-8');
            let buffer = '';
            let aggregatedText = '';
            let activeColumn = cell.outputActiveColumn || null;
            let baseSql = null;
            let columnTypes = null;
            let searchColumns = null;
            const aggregatedRows = [];

            const appendRecords = (records) => {
              const normalized = normalizeRecords(records);
              if (normalized.length) aggregatedRows.push(...normalized);
            };

            const flushUpdate = () => {
              const formatted = aggregatedText ? cleanStreamText(aggregatedText) : '';
              const rowsForOutput = aggregatedRows.length ? aggregatedRows.slice() : [];
              const columns = rowsForOutput.length && typeof rowsForOutput[0] === 'object' ? Object.keys(rowsForOutput[0]) : [];
              if (columns.length) {
                activeColumn = columns.includes(activeColumn) ? activeColumn : columns[0];
              } else {
                activeColumn = null;
              }

              setCells((prev) =>
                prev.map((c) => {
                  if (c.id !== cell.id) return c;
                  const tableProps = isDbLike && rowsForOutput.length
                    ? {
                        data: rowsForOutput,
                        exportContext: baseSql
                          ? {
                              prompt,
                              mode: agent,
                              model,
                              baseSql,
                              columnTypes: columnTypes || null,
                              searchColumns: searchColumns || null,
                            }
                          : null,
                        tableOpsMode: effectiveTableOpsMode,
                        pushDownDb: effectivePushDownDb && !!baseSql,
                        totalRows: rowsForOutput.length,
                        serverMode: globalServerMode,
                        initialPageSize: TABLE_COMPONENT_DEFAULT_PAGE_SIZE,
                        initialFontSize: 11,
                        buttonsDisabled: false,
                        previewOptions: { ...resolvedPreviewOptions },
                        perfOptions: { ...resolvedPerfOptions },
                        initialViewState: null,
                        initialSchema: columnTypes ? { columnTypes } : null,
                        virtualizeOnMaximize,
                        virtualRowHeight: virtRowHeight,
                        initialMaximized: false,
                        showMaximizeControl: true,
                      }
                    : null;

                  return {
                    ...c,
                    dfName,
                    showOutput: true,
                    outputCollapsed: false,
                    outputData: rowsForOutput,
                    outputActiveColumn: activeColumn,
                    outputRaw: formatted,
                    outputTableProps: tableProps,
                  };
                }),
              );
            };

            const handleLine = (line) => {
              if (typeof line !== 'string') return;
              const trimmed = line.trim();
              if (!trimmed) return;
              if (trimmed === '[DONE]') return;
              const withoutPrefix = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
              let parsed = null;
              try {
                parsed = JSON.parse(withoutPrefix);
              } catch {
                parsed = null;
              }

              if (parsed && typeof parsed === 'object') {
                if (Array.isArray(parsed)) {
                  appendRecords(parsed);
                } else {
                  if (parsed._base_sql) baseSql = String(parsed._base_sql);
                  if (parsed._column_types && typeof parsed._column_types === 'object') columnTypes = parsed._column_types;
                  if (Array.isArray(parsed._search_columns)) searchColumns = parsed._search_columns;
                  if (Array.isArray(parsed.rows)) appendRecords(parsed.rows);
                  if (Array.isArray(parsed.tableData)) appendRecords(parsed.tableData);
                  if (Array.isArray(parsed.data)) appendRecords(parsed.data);
                  if (Array.isArray(parsed.records)) appendRecords(parsed.records);
                  if (Array.isArray(parsed.outputs)) appendRecords(parsed.outputs);
                  if (parsed.response !== undefined && parsed.response !== null) {
                    aggregatedText += String(parsed.response);
                  }
                  appendObjectRecord(aggregatedRows, parsed);
                }
              } else if (parsed && typeof parsed === 'string') {
                aggregatedText += parsed;
              } else if (!parsed) {
                aggregatedText += withoutPrefix;
              }

              flushUpdate();
            };

            let doneReading = false;
            while (!doneReading) {
              const { value, done: doneChunk } = await reader.read();
              doneReading = doneChunk;
              const chunkText = value ? decoder.decode(value, { stream: !doneChunk }) : decoder.decode();
              if (chunkText) buffer += chunkText;

              let newlineIndex = buffer.indexOf('\n');
              while (newlineIndex !== -1) {
                const line = buffer.slice(0, newlineIndex);
                buffer = buffer.slice(newlineIndex + 1);
                handleLine(line);
                newlineIndex = buffer.indexOf('\n');
              }
            }

            const remainder = buffer.trim();
            if (remainder) handleLine(remainder);

            const finalText = aggregatedText ? cleanStreamText(aggregatedText) : '';
            const finalRows = aggregatedRows.slice();
            const columns = finalRows.length && typeof finalRows[0] === 'object' ? Object.keys(finalRows[0]) : [];
            const activeColumnFinal = columns.length ? columns[0] : null;

            setCells((prev) =>
              prev.map((c) => {
                if (c.id !== cell.id) return c;
                const tableProps = finalRows.length
                  && isDbLike
                  ? {
                      data: finalRows,
                      exportContext: baseSql
                        ? {
                            prompt,
                            mode: agent,
                            model,
                            baseSql,
                            columnTypes: columnTypes || null,
                            searchColumns: searchColumns || null,
                          }
                        : null,
                      tableOpsMode: effectiveTableOpsMode,
                      pushDownDb: effectivePushDownDb && !!baseSql,
                      totalRows: finalRows.length,
                      serverMode: globalServerMode,
                      initialPageSize: TABLE_COMPONENT_DEFAULT_PAGE_SIZE,
                      initialFontSize: 11,
                      buttonsDisabled: false,
                      previewOptions: { ...resolvedPreviewOptions },
                      perfOptions: { ...resolvedPerfOptions },
                      initialViewState: null,
                      initialSchema: columnTypes ? { columnTypes } : null,
                      virtualizeOnMaximize,
                      virtualRowHeight: virtRowHeight,
                      initialMaximized: false,
                      showMaximizeControl: true,
                    }
                  : null;

                return {
                  ...c,
                  dfName,
                  showOutput: true,
                  outputCollapsed: false,
                  outputData: finalRows,
                  outputActiveColumn: finalRows.length ? activeColumnFinal : null,
                  outputRaw: finalText,
                  outputTableProps: tableProps,
                };
              }),
            );

            setResults((prev) => {
              const logs = [...prev.logs];
              let next = { ...prev };
              if (finalRows.length) {
                const dataFrames = { ...prev.dataFrames, [dfName]: finalRows };
                logs.push(`🤖 [${stamp}] NLP completed (${finalRows.length} rows captured).`, `📦 [${stamp}] Output stored as ${dfName}.`);
                next = {
                  ...prev,
                  table: finalRows,
                  dataFrame: finalRows,
                  dataFrames,
                  activeDataFrameName: dfName,
                  logs,
                };
              } else if (finalText) {
                logs.push(`🤖 [${stamp}] NLP response captured.`);
                next = { ...prev, logs };
              } else {
                logs.push(`ℹ️ [${stamp}] NLP completed with no visible output.`);
                next = { ...prev, logs };
              }
              return next;
            });
          }
        } catch (err) {
          setResults((prev) => ({
            ...prev,
            logs: [...prev.logs, `⚠️ [${stamp}] NLP error: ${err.message}`],
          }));
          setCells((prev) =>
            prev.map((c) =>
              c.id === cell.id
                ? {
                    ...c,
                    showOutput: true,
                    outputCollapsed: false,
                    outputData: [],
                    outputActiveColumn: null,
                    outputRaw: `Failed to process prompt: ${err.message}`,
                    outputTableProps: null,
                  }
                : c,
            ),
          );
        } finally {
          if (!silent) setRunningCellId(null);
        }
        return;
      }

      if (cell.type === 'python') {
        try {
          const pyRes = await fetch('/api/python/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: cell.content || '',
            }),
          });

          if (!pyRes.ok) {
            const errJson = await pyRes.json().catch(() => ({}));
            throw new Error(errJson.error || `HTTP ${pyRes.status}`);
          }

          const payload = await pyRes.json();
          const tables = payload.tables || {};
          const sanitizedTables = {};
          for (const [name, rows] of Object.entries(tables)) {
            sanitizedTables[name] = normalizeRecords(rows);
          }

          let primaryKey = sanitizedTables[dfName] ? dfName : Object.keys(sanitizedTables)[0] || dfName;
          let primaryData = primaryKey && sanitizedTables[primaryKey] ? sanitizedTables[primaryKey] : [];
          const stdoutClean = cleanText(payload.stdout || '');
          const stderrClean = cleanText(payload.stderr || '');

          if (!primaryData.length && stdoutClean) {
            primaryData = [{ stdout: stdoutClean }];
            sanitizedTables[primaryKey] = primaryData;
          }

          const figures = Array.isArray(payload.figures) ? payload.figures.filter((fig) => fig && fig.image) : [];

          setResults((prev) => {
            const dataFrames = { ...prev.dataFrames, ...sanitizedTables };
            const logs = [...prev.logs, `🐍 [${stamp}] Python cell executed (${primaryData.length} rows).`];
            if (stdoutClean) logs.push(`ℹ️ [${stamp}] stdout captured (${stdoutClean.length} chars hidden).`);
            if (stderrClean) logs.push(`ℹ️ [${stamp}] stderr captured (${stderrClean.length} chars hidden).`);
            if (primaryData.length) logs.push(`📦 [${stamp}] Output stored as ${primaryKey}.`);
            if (figures.length) logs.push(`🖼️ [${stamp}] Python produced ${figures.length} figure(s).`);
            return {
              ...prev,
              table: primaryData.length ? primaryData : prev.table,
              dataFrame: primaryData.length ? primaryData : prev.dataFrame,
              dataFrames,
              activeDataFrameName: primaryData.length ? primaryKey : prev.activeDataFrameName,
              logs,
            };
          });

          const firstColumn = primaryData.length && typeof primaryData[0] === 'object'
            ? Object.keys(primaryData[0])[0] || null
            : null;

          const pythonTableProps = primaryData.length
            ? {
                data: primaryData,
                exportContext: null,
                tableOpsMode: 'python-local',
                pushDownDb: false,
                totalRows: primaryData.length,
                serverMode: false,
                initialPageSize: Math.min(TABLE_COMPONENT_DEFAULT_PAGE_SIZE, primaryData.length),
                initialFontSize: 11,
                buttonsDisabled: false,
                previewOptions: { ...resolvedPreviewOptions },
                perfOptions: { ...resolvedPerfOptions },
                initialViewState: null,
                initialSchema: null,
                virtualizeOnMaximize,
                virtualRowHeight: virtRowHeight,
              }
            : null;

          const textBlocks = [];
          if (stdoutClean) textBlocks.push(`### stdout\n\n\`\`\`\n${stdoutClean}\n\`\`\``);
          if (stderrClean) textBlocks.push(`### stderr\n\n\`\`\`\n${stderrClean}\n\`\`\``);
          const combinedText = textBlocks.join('\n\n');

          setCells((prev) =>
            prev.map((c) => {
              if (c.id !== cell.id) return c;
              return {
                ...c,
                dfName: primaryKey,
                showOutput: !!(primaryData.length || figures.length || combinedText),
                outputData: primaryData.length ? primaryData : null,
                outputCollapsed: false,
                outputActiveColumn: primaryData.length ? firstColumn : null,
                outputRaw: combinedText,
                outputTableProps: primaryData.length ? pythonTableProps : null,
                outputFigures: figures,
              };
            }),
          );
        } catch (err) {
          setResults((prev) => ({
            ...prev,
            logs: [...prev.logs, `⚠️ [${stamp}] Python error: ${err.message}`],
          }));
        } finally {
          if (!silent) setRunningCellId(null);
        }
        return;
      }

      if (cell.type === 'sql') {
        setResults((prev) => {
          const next = { ...prev };
          const activeName = prev.activeDataFrameName;
          const sourceTable = (activeName && Array.isArray(prev.dataFrames?.[activeName]) && prev.dataFrames[activeName].length)
            ? prev.dataFrames[activeName]
            : baseTable;
          let workingData = sourceTable.map((row) => ({ ...row }));

          let filtered = workingData;
          if (cell.content?.toLowerCase().includes('where')) {
            filtered = filtered.filter((row) => {
              if (typeof row.growth === 'number') return row.growth >= 12;
              return true;
            });
          }
          workingData = filtered;
        const nextData = normalizeRecords(workingData);
        const columns = nextData.length && typeof nextData[0] === 'object' ? Object.keys(nextData[0]) : [];
        const activeColumn = columns[0] || null;
        const dataFrames = { ...prev.dataFrames, [dfName]: nextData };
          next.dataFrame = nextData;
          next.dataFrames = dataFrames;
          next.activeDataFrameName = dfName;
          next.table = nextData.length ? nextData : prev.table;
          next.logs = [...prev.logs, `🗃️ [${stamp}] SQL cell executed (${nextData.length} rows).`, `📦 [${stamp}] Output stored as ${dfName}.`];
          if (!silent) next.logs.push(`✅ [${stamp}] ${cell.title} finished.`);

          setCells((prevCells) =>
            prevCells.map((c) => {
              if (c.id !== cell.id) return c;
              if (c.showOutput) {
                return {
                  ...c,
                  dfName,
                  outputData: nextData,
                  outputCollapsed: false,
                  outputActiveColumn: activeColumn,
                  outputRaw: '',
                  outputTableProps: null,
                };
              }
              return { ...c, dfName, outputData: nextData, outputActiveColumn: activeColumn, outputRaw: '', outputTableProps: null };
            }),
          );

          return next;
        });
        if (!silent) setRunningCellId(null);
        return;
      }

      if (!silent) {
        setResults((prev) => ({
          ...prev,
          logs: [...prev.logs, `⚠️ [${stamp}] Unsupported cell type ${cell.type}.`],
        }));
        setRunningCellId(null);
      }
    },
    [agent, model, cells, results],
  );

  const runCellById = useCallback(
    (id, silent = false) => {
      if (!id) return;
      const target = cells.find((c) => c.id === id);
      if (target) runCell(target, silent);
    },
    [cells, runCell],
  );

  useEffect(() => {
    runCellByIdRef.current = runCellById;
  }, [runCellById]);

  useEffect(() => {
    const handleMessage = (event) => {
      if (!event || !event.data) return;
      const { type, cellId } = event.data;
      if (type === 'maximized-run' && cellId) {
        const target = cells.find((cell) => cell.id === cellId);
        if (target) {
          runCellById(target.id);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [cells, runCellById]);

  const updateCellContent = useCallback(
    (id, nextContent) => {
      setCells((prev) => {
        const nextCells = prev.map((cell) =>
          cell.id === id
            ? {
                ...cell,
                content: nextContent,
              }
            : cell,
        );
        return nextCells;
      });
    },
    [],
  );

  const updateCellType = useCallback(
    (id, nextType) => {
      const template = cellTemplates[nextType] || cellTemplates.text;
      setCells((prev) =>
        prev.map((cell) => {
          if (cell.id !== id) return cell;
          const nextCell = {
            ...cell,
            type: nextType,
            title: template.title,
            language: template.language,
            placeholder: template.placeholder,
            autoRun: template.autoRun,
            content: template.content || '',
            outputData: null,
            dfName: null,
            outputRaw: '',
            outputTableProps: null,
            outputFigures: [],
            showOutput: false,
            outputCollapsed: false,
            outputActiveColumn: null,
          };
          return nextCell;
        }),
      );
    },
    [],
  );

  const addCell = useCallback(() => {
    const next = createCell('text');
    setCells((prev) => [...prev, next]);
  }, []);

  const removeCell = useCallback((id) => {
    setCells((prev) => prev.filter((cell) => cell.id !== id));
  }, []);

  const toggleCollapse = useCallback((id) => {
    setCells((prev) => prev.map((cell) => (cell.id === id ? { ...cell, collapsed: !cell.collapsed } : cell)));
  }, []);

  const renderOutputPreview = (cell) => {
    const figures = Array.isArray(cell?.outputFigures) ? cell.outputFigures.filter((fig) => fig && fig.image) : [];
    const renderFigures = () => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {figures.map((fig, idx) => (
          <div key={`${fig.name || 'figure'}-${idx}`} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <img
              src={`data:image/png;base64,${fig.image}`}
              alt={fig.name || `Figure ${idx + 1}`}
              style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid rgba(80,110,150,0.4)' }}
            />
            {(fig.name && fig.name.trim()) ? (
              <span style={{ fontSize: '0.75rem', color: '#94a7c8' }}>{fig.name}</span>
            ) : null}
          </div>
        ))}
      </div>
    );

    if (cell?.outputTableProps) {
      const {
        data = [],
        exportContext = null,
        tableOpsMode = effectiveTableOpsMode,
        pushDownDb = effectivePushDownDb,
        totalRows = undefined,
        serverMode: tableServerMode = globalServerMode,
        initialPageSize = TABLE_COMPONENT_DEFAULT_PAGE_SIZE,
        initialFontSize = 11,
        buttonsDisabled = false,
        previewOptions = resolvedPreviewOptions,
        perfOptions = resolvedPerfOptions,
        initialViewState = null,
        initialSchema = null,
        virtualizeOnMaximize: tableVirtualize = virtualizeOnMaximize,
        virtualRowHeight: tableVirtualRowHeight = virtRowHeight,
      } = cell.outputTableProps;
      const hasDownloadableCsv = Array.isArray(data) && data.length > 0;
      const handleSaveCsv = async () => {
        if (!hasDownloadableCsv) return;
        try {
          const csvPayload = buildCsvFromTableProps(cell.outputTableProps);
          if (!csvPayload) return;

          const rawName = cell.dfName || cell.title || cell.id || 'notebook_output';
          const fileNameBase = sanitizeName(rawName) || 'notebook_output';
          const finalFileName = fileNameBase.endsWith('.csv') ? fileNameBase : `${fileNameBase}.csv`;

          setCsvError(null);
          setCsvLoading(true);

          const res = await fetch('/api/table/csv_entries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName: finalFileName, content: csvPayload }),
          });
          const contentType = res.headers?.get?.('content-type') || '';
          const payload = contentType.includes('application/json') ? await res.json() : await res.text();
          if (!res.ok) {
            const message = (payload && payload.error)
              || (typeof payload === 'string' ? payload : `HTTP ${res.status}`);
            throw new Error(message);
          }

          if (payload && typeof payload === 'object' && payload.entry) {
            const newEntry = payload.entry;
            setCsvEntries((prev) => {
              const list = Array.isArray(prev) ? prev : [];
              const filtered = list.filter((entry) => entry?.id !== newEntry.id);
              return [newEntry, ...filtered];
            });
          }

          const rowsCount = Array.isArray(data) ? data.length : 0;
          const successStamp = new Date().toLocaleTimeString();
          setResults((prev) => ({
            ...prev,
            logs: [...prev.logs, `✅ [${successStamp}] Saved ${finalFileName} (${rowsCount} rows) to CSV library.`],
          }));

          await refreshCsvEntries();
        } catch (error) {
          const failStamp = new Date().toLocaleTimeString();
          const message = error?.message || 'Failed to save CSV';
          setResults((prev) => ({
            ...prev,
            logs: [...prev.logs, `⚠️ [${failStamp}] CSV save failed: ${message}`],
          }));
          setCsvError(message);
        } finally {
          setCsvLoading(false);
        }
      };
      return (
        <div style={{ minHeight: 220 }}>
          {hasDownloadableCsv ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button
                type="button"
                onClick={handleSaveCsv}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  color: csvLoading ? 'rgba(157,180,255,0.5)' : '#9db4ff',
                  fontSize: '0.82rem',
                  cursor: csvLoading ? 'not-allowed' : 'pointer',
                  pointerEvents: csvLoading ? 'none' : 'auto',
                  textDecoration: 'underline',
                }}
                disabled={csvLoading}
              >
                <img src={csvIcon} alt="" style={{ width: 14, height: 14, opacity: 0.85 }} />
                <span>Save as CSV</span>
              </button>
            </div>
          ) : null}
          <TableComponent
            data={Array.isArray(data) ? data : []}
            exportContext={exportContext}
            tableOpsMode={tableOpsMode}
            pushDownDb={!!pushDownDb}
            totalRows={totalRows}
            serverMode={!!tableServerMode}
            initialPageSize={initialPageSize}
            initialFontSize={initialFontSize}
            buttonsDisabled={buttonsDisabled}
            previewOptions={previewOptions}
            perfOptions={perfOptions}
            initialViewState={initialViewState}
            initialSchema={initialSchema}
            virtualizeOnMaximize={tableVirtualize}
            virtualRowHeight={tableVirtualRowHeight}
          />
          {cell.outputRaw ? (
            <div style={{ marginTop: 16, fontSize: '0.9rem', color: '#d7e4ff', lineHeight: 1.5 }}>
              <ReactMarkdown children={cell.outputRaw} remarkPlugins={[remarkGfm]} />
            </div>
          ) : null}
          {figures.length ? (
            <div style={{ marginTop: 16 }}>{renderFigures()}</div>
          ) : null}
        </div>
      );
    }
    if (figures.length) {
      return renderFigures();
    }
    if (cell?.outputRaw) {
      return (
        <div style={{ fontSize: '0.9rem', color: '#d7e4ff', lineHeight: 1.5 }}>
          <ReactMarkdown children={cell.outputRaw} remarkPlugins={[remarkGfm]} />
        </div>
      );
    }
    const data = cell?.outputData;
    if (!data || (Array.isArray(data) && data.length === 0)) {
      return <div style={{ color: '#8ca4cb', fontSize: '0.82rem' }}>No output captured yet.</div>;
    }
    if (Array.isArray(data)) {
      if (!data.length) {
        return <div style={{ color: '#8ca4cb', fontSize: '0.82rem' }}>No output captured yet.</div>;
      }
      const slice = data.slice(0, 10);
      const first = slice[0];
      if (first && typeof first === 'object' && !Array.isArray(first)) {
        const columns = Object.keys(first);
        if (columns.length === 0) {
          return (
            <pre style={{ margin: 0, fontSize: '0.8rem', color: '#d7e4ff', whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(slice, null, 2)}
            </pre>
          );
        }
        const activeColumn = columns.includes(cell.outputActiveColumn) ? cell.outputActiveColumn : columns[0];
        const handleTabClick = (col) => {
          setCells((prev) =>
            prev.map((c) => (c.id === cell.id ? { ...c, outputActiveColumn: col } : c)),
          );
        };
        const rows = data.map((row, idx) => ({ index: idx, value: row[activeColumn] }));
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {columns.map((col) => {
                const isActive = col === activeColumn;
                return (
                  <button
                    key={col}
                    type="button"
                    onClick={() => handleTabClick(col)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 999,
                      border: '1px solid rgba(90,120,165,0.8)',
                      background: isActive ? 'rgba(60,100,160,0.4)' : 'rgba(18,24,36,0.65)',
                      color: '#f0f6ff',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                    }}
                  >
                    {col}
                  </button>
                );
              })}
            </div>
            <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid rgba(52,82,120,0.6)', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', color: '#ecf3ff', fontSize: '0.85rem' }}>
                <thead style={{ background: 'rgba(32,54,92,0.55)' }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #2d3e5a', width: 80 }}>Row</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #2d3e5a' }}>{activeColumn.toUpperCase()}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((row) => (
                    <tr key={`row-${row.index}`} style={{ background: row.index % 2 === 0 ? 'rgba(22,27,36,0.65)' : 'rgba(18,24,32,0.65)' }}>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #222d40', color: '#9db0d6' }}>{row.index + 1}</td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #222d40' }}>{String(row.value ?? '')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 50 && (
                <div style={{ padding: '6px 10px', fontSize: '0.75rem', color: '#8ca4cb' }}>
                  Showing first 50 of {rows.length} rows.
                </div>
              )}
            </div>
          </div>
        );
      }
      return (
        <pre style={{ margin: 0, fontSize: '0.8rem', color: '#d7e4ff', whiteSpace: 'pre-wrap' }}>
          {JSON.stringify(slice, null, 2)}
        </pre>
      );
    }
    if (typeof data === 'object') {
      return (
        <pre style={{ margin: 0, fontSize: '0.8rem', color: '#d7e4ff', whiteSpace: 'pre-wrap' }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      );
    }
    return (
      <pre style={{ margin: 0, fontSize: '0.8rem', color: '#d7e4ff', whiteSpace: 'pre-wrap' }}>
        {String(data)}
      </pre>
    );
  };

  useEffect(() => {
    const fetchViews = async () => {
      try {
        setLoadingViews(true);
        setViewsError(null);
        const res = await fetch('/api/table/saved_views');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        const views = Array.isArray(payload?.views) ? payload.views : [];
        setSavedViews(views);
      } catch (err) {
        setViewsError(err.message || 'Failed to load saved views');
        setSavedViews([]);
      } finally {
        setLoadingViews(false);
      }
    };
    fetchViews();
  }, []);

  const resolveCsvEntryKey = useCallback((entry) => {
    if (!entry || typeof entry !== 'object') return null;
    return (
      entry.id
      ?? entry.entryId
      ?? entry.entry_id
      ?? entry.storedPath
      ?? entry.stored_path
      ?? entry.relativePath
      ?? entry.relative_path
      ?? entry.fileName
      ?? entry.FILE_NAME
      ?? entry.originalName
      ?? entry.ORIGINAL_NAME
      ?? null
    );
  }, []);

  const refreshCsvEntries = useCallback(async () => {
    try {
      setCsvLoading(true);
      setCsvError(null);
      const res = await fetch('/api/table/csv_entries');
      const contentType = res.headers?.get?.('content-type') || '';
      const payload = contentType.includes('application/json') ? await res.json() : await res.text();
      if (!res.ok) {
        const message = (payload && payload.error)
          || (typeof payload === 'string' ? payload : `HTTP ${res.status}`);
        throw new Error(message);
      }
      const entries = Array.isArray(payload?.entries) ? payload.entries : [];
      setCsvEntries(entries);
      setSelectedCsvIds((prev) => {
        if (!(prev instanceof Set)) return new Set();
        const allowed = new Set(entries.map((entry) => resolveCsvEntryKey(entry)).filter(Boolean));
        let changed = false;
        const next = new Set();
        prev.forEach((key) => {
          if (allowed.has(key)) {
            next.add(key);
          } else {
            changed = true;
          }
        });
        if (!changed && next.size === prev.size) return prev;
        return next;
      });
    } catch (err) {
      console.error('CSV entries fetch failed', err);
      setCsvError(err?.message || 'Failed to load CSV entries');
      setCsvEntries([]);
    } finally {
      setCsvLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCsvEntries();
  }, [refreshCsvEntries]);

  const refreshPythonScripts = useCallback(async () => {
    try {
      setPythonScriptsLoading(true);
      setPythonScriptsError(null);
      const res = await fetch('/api/python_scripts');
      const contentType = res.headers?.get?.('content-type') || '';
      const payload = contentType.includes('application/json') ? await res.json() : await res.text();
      if (!res.ok) {
        const message = (payload && payload.error)
          || (typeof payload === 'string' ? payload : `HTTP ${res.status}`);
        throw new Error(message);
      }
      const scripts = Array.isArray(payload?.scripts) ? payload.scripts : [];
      setPythonScripts(scripts);
      setPythonScriptSelections((prev) => {
        if (!prev || typeof prev !== 'object') return {};
        const allowed = new Set(scripts.map((script) => script.id).filter(Boolean));
        let changed = false;
        const next = { ...prev };
        Object.keys(prev).forEach((key) => {
          const value = prev[key];
          if (value && !allowed.has(value)) {
            delete next[key];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    } catch (err) {
      console.error('Python scripts fetch failed', err);
      setPythonScriptsError(err?.message || 'Failed to load Python scripts');
      setPythonScripts([]);
    } finally {
      setPythonScriptsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshPythonScripts();
  }, [refreshPythonScripts]);

  const handleSavedViewDragStart = useCallback((event, view) => {
    if (!event?.dataTransfer || !view) return;
    try {
      const payload = JSON.stringify({
        kind: 'saved-view',
        viewName: view.viewName || view.name || '',
        datasetSig: view.datasetSig || view.dataset_sig || '',
        content: view.content || view.viewState || view.view_state || null,
      });
      event.dataTransfer.setData('application/json', payload);
      event.dataTransfer.setData('text/plain', payload);
      event.dataTransfer.effectAllowed = 'copy';
    } catch {}
  }, []);

  const handleCsvDragStart = useCallback((event, entry) => {
    if (!event?.dataTransfer || !entry) return;
    const entryId = entry.id ?? entry.entryId ?? entry.entry_id;
    if (!entryId) return;
    try {
      const payload = JSON.stringify({
        kind: 'csv-entry',
          entry: {
            id: entryId,
            fileName: entry.fileName || entry.FILE_NAME || entry.originalName || entry.ORIGINAL_NAME || '',
          },
      });
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('application/json', payload);
      event.dataTransfer.setData('text/plain', payload);
    } catch (err) {
      console.warn('CSV drag start failed', err);
    }
  }, []);

  const handleCsvDownload = useCallback(async (entry) => {
    if (!entry) return;
    const entryId = entry.id ?? entry.entryId ?? entry.entry_id;
    const storedPath = entry.storedPath || entry.stored_path || entry.relativePath || entry.relative_path;
    const fileName = entry.fileName || entry.FILE_NAME || entry.originalName || entry.ORIGINAL_NAME || `csv_${entryId || 'download'}.csv`;
    const entryKey = resolveCsvEntryKey(entry);

    const resolvedId = entryId || (storedPath ? encodeURIComponent(storedPath) : null);
    if (!resolvedId) return;

    try {
      const res = await fetch(`/api/table/csv_entries/${resolvedId}/load`);
      const contentType = res.headers?.get?.('content-type') || '';
      const payload = contentType.includes('application/json') ? await res.json() : await res.text();
      if (!res.ok) {
        const message = (payload && payload.error)
          || (typeof payload === 'string' ? payload : `HTTP ${res.status}`);
        throw new Error(message);
      }

      const table = payload?.table || {};
      const rows = Array.isArray(table?.data) ? table.data : [];
      const headers = Array.isArray(table?.headers) ? table.headers : null;

      const downloadFileName = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;

      if (!rows.length) {
        const blob = new Blob([], { type: 'text/csv;charset=utf-8;' });
        const downloadUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = downloadUrl;
        anchor.download = downloadFileName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(downloadUrl);
        if (entryKey) {
          setSelectedCsvIds((prev) => {
            if (!(prev instanceof Set) || !prev.has(entryKey)) return prev;
            const next = new Set(prev);
            next.delete(entryKey);
            return next;
          });
        }
        return;
      }

      const csvContent = buildCsvFromTableProps({ data: rows, headers }) || '';
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = downloadFileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(downloadUrl);
      if (entryKey) {
        setSelectedCsvIds((prev) => {
          if (!(prev instanceof Set) || !prev.has(entryKey)) return prev;
          const next = new Set(prev);
          next.delete(entryKey);
          return next;
        });
      }
    } catch (err) {
      console.error('CSV download failed', err);
      const failStamp = new Date().toLocaleTimeString();
      setResults((prev) => ({
        ...prev,
        logs: [...prev.logs, `⚠️ [${failStamp}] CSV download failed: ${err?.message || 'Unknown error'}`],
      }));
    }
  }, [resolveCsvEntryKey, setResults]);

  const handleSavePythonScript = useCallback(async (cell) => {
    if (!cell || cell.type !== 'python') return;
    const defaultName = cell.title?.trim() || `python_cell_${cell.id.slice(-4)}`;
    let name = defaultName;
    try {
      if (typeof window !== 'undefined' && window.prompt) {
        const response = window.prompt('Save Python script as:', defaultName);
        if (!response) return;
        name = response.trim();
        if (!name) return;
      }
    } catch (err) {
      console.warn('Script name prompt failed', err);
    }

    try {
      setPythonScriptsSaving(true);
      setPythonScriptsError(null);
      const res = await fetch('/api/python_scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: name, content: cell.content || '' }),
      });
      const contentType = res.headers?.get?.('content-type') || '';
      const payload = contentType.includes('application/json') ? await res.json() : await res.text();
      if (!res.ok) {
        const message = (payload && payload.error)
          || (typeof payload === 'string' ? payload : `HTTP ${res.status}`);
        throw new Error(message);
      }
      const script = payload?.script;
      const stamp = new Date().toLocaleTimeString();
      setResults((prev) => ({
        ...prev,
        logs: [...prev.logs, `✅ [${stamp}] Saved Python script ${script?.fileName || name}.`],
      }));
      await refreshPythonScripts();
    } catch (err) {
      console.error('Python script save failed', err);
      const failStamp = new Date().toLocaleTimeString();
      setResults((prev) => ({
        ...prev,
        logs: [...prev.logs, `⚠️ [${failStamp}] Python script save failed: ${err?.message || 'Unknown error'}`],
      }));
      setPythonScriptsError(err?.message || 'Failed to save Python script');
    } finally {
      setPythonScriptsSaving(false);
    }
  }, [refreshPythonScripts, setResults]);

  const handleLoadPythonScript = useCallback(async (cell, scriptId) => {
    if (!cell || cell.type !== 'python' || !scriptId) return;
    try {
      setPythonScriptLoadingId(scriptId);
      setPythonScriptsError(null);
      const res = await fetch(`/api/python_scripts/${encodeURIComponent(scriptId)}`);
      const contentType = res.headers?.get?.('content-type') || '';
      const payload = contentType.includes('application/json') ? await res.json() : await res.text();
      if (!res.ok) {
        const message = (payload && payload.error)
          || (typeof payload === 'string' ? payload : `HTTP ${res.status}`);
        throw new Error(message);
      }
      const script = payload?.script;
      const scriptContent = script?.content ?? '';
      setCells((prev) =>
        prev.map((c) =>
          c.id === cell.id
            ? {
                ...c,
                content: scriptContent,
              }
            : c,
        ),
      );
      setResults((prev) => ({
        ...prev,
        logs: [...prev.logs, `✅ [${new Date().toLocaleTimeString()}] Loaded Python script ${script?.fileName || scriptId} into cell.`],
      }));
    } catch (err) {
      console.error('Python script load failed', err);
      const failStamp = new Date().toLocaleTimeString();
      setResults((prev) => ({
        ...prev,
        logs: [...prev.logs, `⚠️ [${failStamp}] Python script load failed: ${err?.message || 'Unknown error'}`],
      }));
      setPythonScriptsError(err?.message || 'Failed to load Python script');
    } finally {
      setPythonScriptLoadingId(null);
    }
  }, [setCells, setResults]);

  const toggleCsvSelection = useCallback((entry) => {
    const key = resolveCsvEntryKey(entry) || null;
    if (!key) return;
    setSelectedCsvIds((prev) => {
      const next = prev instanceof Set ? new Set(prev) : new Set();
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, [resolveCsvEntryKey]);

  const isCsvSelected = useCallback((entry) => {
    if (!(selectedCsvIds instanceof Set)) return false;
    const key = resolveCsvEntryKey(entry);
    if (!key) return false;
    return selectedCsvIds.has(key);
  }, [selectedCsvIds, resolveCsvEntryKey]);

  const handleBulkCsvDownload = useCallback(async () => {
    if (!(selectedCsvIds instanceof Set) || !selectedCsvIds.size) return;
    const entryMap = new Map();
    for (const entry of csvEntries) {
      const key = resolveCsvEntryKey(entry);
      if (key) entryMap.set(key, entry);
    }
    const keys = Array.from(selectedCsvIds);
    for (const key of keys) {
      const entry = entryMap.get(key);
      if (!entry) continue;
      // eslint-disable-next-line no-await-in-loop
      await handleCsvDownload(entry);
      setSelectedCsvIds((prev) => {
        if (!(prev instanceof Set)) return new Set();
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, [csvEntries, selectedCsvIds, resolveCsvEntryKey, handleCsvDownload]);

  const handleCellDragEnter = useCallback((event, cell) => {
    if (!cell || (cell.type !== 'text' && cell.type !== 'python')) return;
    event.preventDefault();
    event.stopPropagation();
    setDragOverCellId(cell.id);
  }, []);

  const handleCellDragOver = useCallback((event, cell) => {
    if (!cell || (cell.type !== 'text' && cell.type !== 'python')) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      event.dataTransfer.dropEffect = 'copy';
    } catch {}
  }, []);

  const handleCellDragLeave = useCallback((event, cell) => {
    if (!cell || (cell.type !== 'text' && cell.type !== 'python')) return;
    try {
      const related = event.relatedTarget;
      if (related && event.currentTarget && event.currentTarget.contains(related)) return;
    } catch {}
    setDragOverCellId((prev) => (prev === cell.id ? null : prev));
  }, []);

  const handlePanelItemHover = useCallback((event, hovered) => {
    const target = event?.currentTarget;
    if (!target) return;
    const background = hovered ? 'rgba(58,92,148,0.25)' : 'rgba(18,28,44,0.22)';
    const shadow = hovered ? '0 4px 12px rgba(0,0,0,0.22)' : 'none';
    target.style.background = background;
    target.style.boxShadow = shadow;
  }, []);

  const handlePanelItemDrop = useCallback(
    async (event, cell) => {
      if (!cell || (cell.type !== 'text' && cell.type !== 'python')) return;
      event.preventDefault();
      event.stopPropagation();
      setDragOverCellId(null);

      const isPythonTarget = cell.type === 'python';

      const transfer = event.dataTransfer;
      let rawPayload = '';
      if (transfer) {
        try {
          rawPayload = transfer.getData('application/json') || transfer.getData('text/plain') || '';
        } catch {
          rawPayload = '';
        }
      }

      if (!rawPayload) return;
      let payload = null;
      try {
        payload = JSON.parse(rawPayload);
      } catch {
        payload = null;
      }
      if (!payload) return;

      if (payload.kind === 'csv-entry') {
        const entryMeta = (payload.entry && typeof payload.entry === 'object') ? payload.entry : payload;
        const entryId = entryMeta?.id ?? entryMeta?.entryId ?? entryMeta?.entry_id;
        if (!entryId) return;
        const entryLabel = entryMeta?.fileName
          || entryMeta?.FILE_NAME
          || entryMeta?.originalName
          || entryMeta?.ORIGINAL_NAME
          || `CSV ${entryId}`;
        const startStamp = new Date().toLocaleTimeString();

        setRunningCellId(cell.id);
        setCells((prev) =>
          prev.map((c) =>
            c.id === cell.id
              ? {
                  ...c,
                  showOutput: true,
                  outputCollapsed: false,
                  outputData: [],
                  outputRaw: 'Loading CSV entry…',
                  outputActiveColumn: null,
                  outputTableProps: null,
                }
              : c,
          ),
        );
        setResults((prev) => ({
          ...prev,
          logs: [...prev.logs, `📥 [${startStamp}] Loading CSV entry ${entryLabel}.`],
        }));

        const csvEndpointPath = `/api/table/csv_entries/${entryId}/load`;

        try {
          const res = await fetch(csvEndpointPath);
          const contentType = res.headers?.get?.('content-type') || '';
          const body = contentType.includes('application/json') ? await res.json() : await res.text();
          if (!res.ok) {
            const message = (body && body.error)
              || (typeof body === 'string' ? body : `HTTP ${res.status}`);
            throw new Error(message);
          }

          const entry = (body && body.entry) || entryMeta || {};
          const table = (body && body.table) || {};
          const headers = Array.isArray(table?.headers)
            ? table.headers
            : Array.isArray(table?.columns)
              ? table.columns
              : [];
          let tableData = Array.isArray(table?.data) ? table.data : [];
          if (!tableData.length && Array.isArray(table?.rows)) {
            tableData = table.rows;
          }

          let csvRows = [];
          if (Array.isArray(tableData) && tableData.length) {
            if (Array.isArray(tableData[0])) {
              if (headers.length) {
                csvRows = tableData.map((row) => {
                  const obj = {};
                  headers.forEach((header, idx) => {
                    obj[header] = row[idx];
                  });
                  return obj;
                });
              } else {
                csvRows = tableData.map((row) => ({ value: Array.isArray(row) ? row.join(', ') : row }));
              }
            } else if (typeof tableData[0] === 'object') {
              csvRows = tableData.map((row) => (row && typeof row === 'object' ? row : { value: row }));
            } else {
              csvRows = tableData.map((row) => ({ value: row }));
            }
          }

          if (!csvRows.length && Array.isArray(table?.rows) && Array.isArray(table?.columns)) {
            csvRows = normalizeRecords([{ columns: table.columns, rows: table.rows }]);
          }
          if (!csvRows.length) {
            csvRows = normalizeRecords(tableData);
          }

          const labelForName = entry?.fileName || entry?.FILE_NAME || entryLabel;
          const resolvedDfName = cell.dfName
            || (sanitizeName(labelForName)
              ? `${sanitizeName(labelForName)}_${cell.id.slice(-4)}`
              : `csv_${cell.id.slice(-4)}`);
          const finishStamp = new Date().toLocaleTimeString();
          const totalRows = Number(table?.totalRows ?? table?.total ?? csvRows.length);
          const columns = csvRows.length && typeof csvRows[0] === 'object' ? Object.keys(csvRows[0] || {}) : [];
          const activeColumn = columns.length ? columns[0] : null;

          setResults((prev) => {
            const logs = [...prev.logs];
            if (csvRows.length) {
              if (isPythonTarget) {
                logs.push(`✅ [${finishStamp}] CSV entry ${entryLabel} ready for Python cell (${csvRows.length} rows).`);
              } else {
                logs.push(`✅ [${finishStamp}] CSV entry ${entryLabel} loaded (${csvRows.length} rows).`);
              }
            } else {
              logs.push(`ℹ️ [${finishStamp}] CSV entry ${entryLabel} returned no rows.`);
            }
            const dataFrames = csvRows.length ? { ...prev.dataFrames, [resolvedDfName]: csvRows } : prev.dataFrames;
            return {
              ...prev,
              table: csvRows.length ? csvRows : prev.table,
              dataFrame: csvRows.length ? csvRows : prev.dataFrame,
              dataFrames,
              activeDataFrameName: csvRows.length ? resolvedDfName : prev.activeDataFrameName,
              logs,
            };
          });

          const pythonSnippet = isPythonTarget
            ? buildPythonDataframeSnippet({
                dfName: resolvedDfName,
                sourceType: 'csv',
                totalRows,
                csvMeta: { endpoint: csvEndpointPath },
              })
            : null;

          setCells((prev) =>
            prev.map((c) => {
              if (c.id !== cell.id) return c;
              const baseUpdate = {
                ...c,
                dfName: resolvedDfName,
                content: pythonSnippet ? pythonSnippet : c.content,
                outputFigures: [],
              };

              if (isPythonTarget) {
                return {
                  ...baseUpdate,
                  showOutput: false,
                  outputCollapsed: false,
                  outputData: null,
                  outputRaw: '',
                  outputActiveColumn: null,
                  outputTableProps: null,
                };
              }

              return {
                ...baseUpdate,
                showOutput: true,
                outputCollapsed: false,
                outputData: csvRows,
                outputRaw: csvRows.length ? '' : 'CSV entry returned no rows.',
                outputActiveColumn: csvRows.length ? activeColumn : null,
                outputTableProps: {
                  data: csvRows,
                  exportContext: null,
                  tableOpsMode: 'csv-import',
                  pushDownDb: false,
                  totalRows,
                  serverMode: false,
                  initialPageSize: csvRows.length
                    ? Math.min(TABLE_COMPONENT_DEFAULT_PAGE_SIZE, csvRows.length)
                    : TABLE_COMPONENT_DEFAULT_PAGE_SIZE,
                  initialFontSize: 11,
                  buttonsDisabled: false,
                  previewOptions: { ...resolvedPreviewOptions },
                  perfOptions: { ...resolvedPerfOptions },
                  initialViewState: null,
                  initialSchema: null,
                  virtualizeOnMaximize,
                  virtualRowHeight: virtRowHeight,
                },
                outputFigures: [],
              };
            }),
          );
        } catch (error) {
          const message = error?.message || 'Failed to load CSV entry.';
          const failStamp = new Date().toLocaleTimeString();
          setCells((prev) =>
            prev.map((c) =>
              c.id === cell.id
                ? {
                    ...c,
                    showOutput: true,
                    outputCollapsed: false,
                    outputData: [],
                    outputRaw: `Failed to load CSV entry: ${message}`,
                    outputActiveColumn: null,
                    outputTableProps: null,
                    outputFigures: [],
                  }
                : c,
            ),
          );
          setResults((prev) => ({
            ...prev,
            logs: [...prev.logs, `⚠️ [${failStamp}] CSV entry ${entryLabel} failed: ${message}`],
          }));
        } finally {
          setRunningCellId((prev) => (prev === cell.id ? null : prev));
        }

        return;
      }

      if (payload.kind !== 'saved-view') return;

      const viewName = payload.viewName || 'Saved view';
      const viewContent = payload.content || {};
      let exportContext = viewContent.exportContext || viewContent.export_context || null;
      if (!exportContext) {
        const scopeWithExport = collectSavedViewScopes(viewContent, null, null).find((scope) => {
          if (!scope) return false;
          return Boolean(scope.exportContext || scope.export_context);
        });
        if (scopeWithExport) {
          exportContext = scopeWithExport.exportContext || scopeWithExport.export_context;
        }
      }
      const parsedExportCtx = parseMaybeJsonObject(exportContext);
      if (parsedExportCtx) exportContext = parsedExportCtx;
      if (!exportContext || typeof exportContext !== 'object' || !exportContext.prompt || !exportContext.mode || !exportContext.model) {
        const message = 'Saved view is missing query context; unable to preview.';
        setCells((prev) =>
          prev.map((c) =>
            c.id === cell.id
              ? {
                  ...c,
                  showOutput: true,
                  outputCollapsed: false,
                  outputData: [],
                  outputRaw: message,
                  outputActiveColumn: null,
                  outputTableProps: null,
                  outputFigures: [],
                }
              : c,
          ),
        );
        const warnStamp = new Date().toLocaleTimeString();
        setResults((prev) => ({
          ...prev,
          logs: [...prev.logs, `⚠️ [${warnStamp}] Saved view ${viewName} is missing export context.`],
        }));
        return;
      }

      const startStamp = new Date().toLocaleTimeString();
      setRunningCellId(cell.id);
      setCells((prev) =>
        prev.map((c) =>
          c.id === cell.id
            ? {
                ...c,
                showOutput: true,
                outputCollapsed: false,
                outputData: [],
                outputRaw: 'Loading saved view…',
                outputActiveColumn: null,
                outputTableProps: null,
              }
            : c,
        ),
      );
      setResults((prev) => ({
        ...prev,
        logs: [...prev.logs, `📥 [${startStamp}] Loading saved view ${viewName}.`],
      }));

      const viewTableOpsMode = viewContent.tableOpsMode ?? viewContent.table_ops_mode ?? effectiveTableOpsMode;
      const viewPushDownSetting = viewContent.pushDownDb ?? viewContent.push_down_db;
      const pushDownDb = typeof viewPushDownSetting === 'boolean' ? viewPushDownSetting : effectivePushDownDb;
      const headers = Array.isArray(viewContent.headers)
        ? viewContent.headers
        : Array.isArray(viewContent.visibleColumns)
          ? viewContent.visibleColumns
          : undefined;
      const pageSize = Math.max(1, Number(viewContent.pageSize) || TABLE_COMPONENT_DEFAULT_PAGE_SIZE);

      const requestBody = {
        model: exportContext.model,
        mode: exportContext.mode,
        prompt: exportContext.prompt,
        page: 1,
        pageSize,
        tableOpsMode: viewTableOpsMode,
        pushDownDb,
      };
      if (exportContext.baseSql) requestBody.baseSql = exportContext.baseSql;
      if (exportContext.columnTypes) requestBody.columnTypes = exportContext.columnTypes;
      if (exportContext.searchColumns) requestBody.searchColumns = exportContext.searchColumns;
      else if (headers) requestBody.searchColumns = headers;

      try {
        const res = await fetch('/api/table/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          throw new Error(errText || `HTTP ${res.status}`);
        }
        const json = await res.json();
        const rawRows = Array.isArray(json?.rows)
          ? json.rows
          : Array.isArray(json?.data)
            ? json.data
            : [];
        let nextRows = normalizeRecords(rawRows);
        if (!nextRows.length && rawRows.length) {
          nextRows = rawRows.map((row) => {
            if (row && typeof row === 'object') return row;
            return { value: row };
          });
        }
        if (!nextRows.length && json && typeof json === 'object') {
          nextRows = normalizeRecords([json]);
        }

        const defaultName = cell.dfName
          || (sanitizeName(viewName) ? `${sanitizeName(viewName)}_${cell.id.slice(-4)}` : `view_${cell.id.slice(-4)}`);
        const resolvedDfName = defaultName || `view_${cell.id.slice(-4)}`;
        const finishStamp = new Date().toLocaleTimeString();

        setResults((prev) => {
          const logs = [...prev.logs];
          if (nextRows.length) {
            if (isPythonTarget) {
              logs.push(`✅ [${finishStamp}] Saved view ${viewName} ready for Python cell (${nextRows.length} rows).`);
            } else {
              logs.push(`✅ [${finishStamp}] Saved view ${viewName} loaded (${nextRows.length} rows).`);
            }
          } else {
            logs.push(`ℹ️ [${finishStamp}] Saved view ${viewName} returned no rows.`);
          }
          const dataFrames = nextRows.length ? { ...prev.dataFrames, [resolvedDfName]: nextRows } : prev.dataFrames;
          return {
            ...prev,
            table: nextRows.length ? nextRows : prev.table,
            dataFrame: nextRows.length ? nextRows : prev.dataFrame,
            dataFrames,
            activeDataFrameName: nextRows.length ? resolvedDfName : prev.activeDataFrameName,
            logs,
          };
        });

        const columns = nextRows.length && typeof nextRows[0] === 'object' ? Object.keys(nextRows[0] || {}) : [];
        const activeColumn = columns.length ? columns[0] : null;
        const sampleRows = nextRows.length;
        const totalRows = deriveSavedViewTotalRows(viewContent, json, exportContext, sampleRows);
        const resolvedServerMode = deriveSavedViewServerMode(viewContent, json, exportContext, totalRows, sampleRows, globalServerMode);
        const initialPageSize = Math.max(1, Number(viewContent.pageSize) || TABLE_COMPONENT_DEFAULT_PAGE_SIZE);
        const initialFontSize = Number(viewContent.fontSize) || 11;
        const initialViewState = viewContent.viewState || viewContent.view_state || viewContent.initialViewState || viewContent || null;
        const initialSchema = viewContent.initialSchema || viewContent.schema || null;
        const perfOptions = viewContent.perfOptions || viewContent.perf_options || { ...resolvedPerfOptions };
        const previewOptions = viewContent.previewOptions || viewContent.preview_options || { ...resolvedPreviewOptions };
        const pythonSnippet = isPythonTarget
          ? buildPythonDataframeSnippet({
              dfName: resolvedDfName,
              sourceType: 'saved-view',
              totalRows,
              savedViewRequest: requestBody,
            })
          : null;

        setCells((prev) =>
          prev.map((c) => {
            if (c.id !== cell.id) return c;
            const baseUpdate = {
              ...c,
              dfName: resolvedDfName,
              content: pythonSnippet ? pythonSnippet : c.content,
              outputFigures: [],
            };

            if (isPythonTarget) {
              return {
                ...baseUpdate,
                showOutput: false,
                outputCollapsed: false,
                outputData: null,
                outputRaw: '',
                outputActiveColumn: null,
                outputTableProps: null,
              };
            }

            return {
              ...baseUpdate,
              showOutput: true,
              outputCollapsed: false,
              outputData: nextRows,
              outputRaw: nextRows.length ? '' : 'Saved view returned no rows.',
              outputActiveColumn: nextRows.length ? activeColumn : null,
              outputTableProps: {
                data: nextRows,
                exportContext,
                tableOpsMode: viewTableOpsMode,
                pushDownDb,
                totalRows,
                serverMode: resolvedServerMode,
                initialPageSize,
                initialFontSize,
                buttonsDisabled: false,
                previewOptions,
                perfOptions,
                initialViewState,
                initialSchema,
                virtualizeOnMaximize,
                virtualRowHeight: virtRowHeight,
              },
              outputFigures: [],
            };
          }),
        );
      } catch (error) {
        const message = error?.message || 'Failed to load saved view.';
        const failStamp = new Date().toLocaleTimeString();
        setCells((prev) =>
          prev.map((c) =>
            c.id === cell.id
              ? {
                  ...c,
                  showOutput: true,
                  outputCollapsed: false,
                  outputData: [],
                  outputRaw: `Failed to load saved view: ${message}`,
                  outputActiveColumn: null,
                  outputTableProps: null,
                  outputFigures: [],
                }
              : c,
          ),
        );
        setResults((prev) => ({
          ...prev,
          logs: [...prev.logs, `⚠️ [${failStamp}] Saved view ${viewName} failed: ${message}`],
        }));
      } finally {
        setRunningCellId((prev) => (prev === cell.id ? null : prev));
      }
    },
    [
      effectivePushDownDb,
      effectiveTableOpsMode,
      globalServerMode,
      resolvedPerfOptions,
      resolvedPreviewOptions,
      setCells,
      setDragOverCellId,
      setResults,
      setRunningCellId,
      virtualizeOnMaximize,
      virtRowHeight,
    ],
  );

  const leftPanelFlex = leftPanelCollapsed ? '0 0 48px' : '0 0 clamp(210px, 18vw, 260px)';
  const rightPanelFlex = rightPanelCollapsed ? '0 0 48px' : '0 0 clamp(260px, 24vw, 340px)';
  const collapsibleHeaderButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    border: 'none',
    background: 'transparent',
    color: '#9ab5e9',
    fontSize: '0.7rem',
    fontWeight: 600,
    letterSpacing: 0.32,
    textTransform: 'uppercase',
    cursor: 'pointer',
    padding: '2px 2px 4px',
  };

  return (
    <StandaloneChrome title="Notebook Workbench">
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <div
        style={{
          flex: 1,
          display: 'flex',
          gap: 20,
          padding: '24px 24px 20px',
          background: '#0d111a',
          color: '#f1f6ff',
          minHeight: 0,
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            flex: leftPanelFlex,
            display: 'flex',
            flexDirection: 'column',
            background: 'rgba(13,18,28,0.88)',
            border: '1px solid rgba(40,58,84,0.6)',
            borderRadius: 12,
            boxShadow: '0 18px 32px rgba(0,0,0,0.35)',
            overflow: 'hidden',
            transition: 'flex-basis 0.2s ease',
            minHeight: 0,
          }}
        >
          <button
            type="button"
            onClick={() => setLeftPanelCollapsed((prev) => !prev)}
            aria-expanded={!leftPanelCollapsed}
            style={{
              padding: leftPanelCollapsed ? '12px 8px' : '10px 12px',
              border: 'none',
              borderBottom: '1px solid rgba(40,58,84,0.6)',
              background: 'rgba(12,18,28,0.95)',
              color: '#8fb1ff',
              fontSize: leftPanelCollapsed ? '1.1rem' : '0.82rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: leftPanelCollapsed ? 'center' : 'space-between',
              cursor: 'pointer',
              gap: 8,
            }}
          >
            {leftPanelCollapsed ? (
              <span style={{ lineHeight: 1 }}>»</span>
            ) : (
              <>
                <span style={{ letterSpacing: 0.4 }}>Data Sources</span>
                <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>«</span>
              </>
            )}
          </button>
          {!leftPanelCollapsed && (
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                padding: '16px 14px',
                overflowY: 'auto',
                overflowX: 'hidden',
              }}
            >
              <div
                style={{
                  border: '1px solid rgba(40,58,84,0.6)',
                  borderRadius: 10,
                  background: 'rgba(18,24,36,0.9)',
                  padding: '12px 12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label htmlFor="workbench-model-select" style={{ fontSize: '0.8rem', color: '#d4e2ff', fontWeight: 600 }}>Model</label>
                  <select
                    id="workbench-model-select"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: '1px solid rgba(60,88,130,0.8)',
                      background: 'rgba(18,24,32,0.9)',
                      color: '#f2f6ff',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
                    }}
                  >
                    <option value="None">None</option>
                    <option value="dbLLM">Deutsche Bank - dbLLM</option>
                    <option value="llama3.2:1b">LLaMA3.2:1b</option>
                    <option value="codellama:7b-instruct">CodeLLaMA:7b-instruct</option>
                    <option value="sqlcoder">SQLCoder:7b</option>
                    <option value="gemma">Gemma</option>
                    <option value="llama3">LLaMA3</option>
                    <option value="mistral">Mistral</option>
                    <option value="phi3">Phi-3</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label htmlFor="workbench-agent-select" style={{ fontSize: '0.8rem', color: '#d4e2ff', fontWeight: 600 }}>Agent</label>
                  <select
                    id="workbench-agent-select"
                    value={agent}
                    onChange={(e) => setAgent(e.target.value)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: '1px solid rgba(60,88,130,0.8)',
                      background: 'rgba(18,24,32,0.9)',
                      color: '#f2f6ff',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
                    }}
                  >
                    <option value="direct">Developer Assistant</option>
                    <option value="database">Database - Direct Intent Routes</option>
                    <option value="database1">Database - Direct Intent embeded nomodel Routes</option>
                    <option value="restful">API Assistant (Trained)</option>
                    <option value="langchain">Database Assistant (Un-Trained)</option>
                    <option value="langchainprompt">Database Assistant (Partially Trained)</option>
                    <option value="embedded">Database Assistant (Fully Trained)</option>
                    <option value="webscrape">Documentation Assistant</option>
                    <option value="riskdata">Data Analysis Assistant</option>
                    <option value="embedded_narrated">Database Assistant with Narration</option>
                    <option value="generic_rag">Database Assistant - Generic RAG</option>
                  </select>
                </div>
              </div>

              <div
                style={{
                  border: '1px solid rgba(40,58,84,0.6)',
                  borderRadius: 10,
                  background: 'rgba(18,24,36,0.9)',
                  padding: '12px 12px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  minHeight: 0,
                  flex: savedViewsCollapsed ? '0 0 auto' : '1 1 0%',
                }}
              >
                <button
                  type="button"
                  onClick={() => setSavedViewsCollapsed((prev) => !prev)}
                  style={collapsibleHeaderButtonStyle}
                  aria-expanded={!savedViewsCollapsed}
                >
                  <span>Saved Views</span>
                  <span style={{ fontSize: '0.82rem', lineHeight: 1 }}>{savedViewsCollapsed ? '▸' : '▾'}</span>
                </button>
                {!savedViewsCollapsed && (
                  <>
                    <div style={{ fontSize: '0.7rem', color: '#92a8c7' }}>
                      Quickly reopen curated worksheets to feed the notebook.
                    </div>
                    <div
                      style={{
                        flex: 1,
                        minHeight: 0,
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        paddingRight: 4,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      {loadingViews ? (
                        <div style={{ color: '#9db6d8', fontSize: '0.82rem' }}>Loading views…</div>
                      ) : viewsError ? (
                        <div style={{ color: '#e89aa9', fontSize: '0.82rem' }}>{viewsError}</div>
                      ) : savedViews.length === 0 ? (
                        <div style={{ color: '#8396b2', fontSize: '0.82rem' }}>No saved views yet.</div>
                      ) : (
                        savedViews.map((view) => {
                          const title = view.viewName || view.name || 'Untitled view';
                          const handleOpen = () => {
                            try {
                              const params = new URLSearchParams({ page: 'worksheet-viewer' });
                              if (view.viewName) params.set('pinnedId', view.viewName);
                              window.open(`${window.location.pathname}?${params.toString()}`, '_blank', 'noopener');
                            } catch {}
                          };
                          return (
                          <button
                            key={`${view.viewName || view.name || view.id}`}
                            type="button"
                            onClick={handleOpen}
                            draggable
                            onDragStart={(event) => handleSavedViewDragStart(event, view)}
                            onMouseEnter={(event) => handlePanelItemHover(event, true)}
                            onMouseLeave={(event) => handlePanelItemHover(event, false)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '8px 10px',
                              borderRadius: 9,
                              border: 'none',
                              background: 'rgba(18,28,44,0.25)',
                              color: '#f0f6ff',
                              cursor: 'pointer',
                              textAlign: 'left',
                              fontSize: '0.72rem',
                              transition: 'background 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease',
                            }}
                          >
                            <img src={worksheetIcon} alt="" aria-hidden="true" style={{ width: 12, height: 12 }} />
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
                          </button>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </div>

              <div
                style={{
                  border: '1px solid rgba(40,58,84,0.6)',
                  borderRadius: 10,
                  background: 'rgba(18,24,36,0.9)',
                  padding: '12px 12px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  minHeight: 0,
                  flex: csvCollapsed ? '0 0 auto' : '1 1 0%',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setCsvCollapsed((prev) => !prev)}
                    style={collapsibleHeaderButtonStyle}
                    aria-expanded={!csvCollapsed}
                  >
                    <span>CSV Tables</span>
                    <span style={{ fontSize: '0.82rem', lineHeight: 1 }}>{csvCollapsed ? '▸' : '▾'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkCsvDownload}
                    disabled={!selectedCsvIds?.size || csvLoading}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: !selectedCsvIds?.size || csvLoading ? 'rgba(157,180,255,0.5)' : '#9db4ff',
                      textDecoration: 'underline',
                      fontSize: '0.75rem',
                      cursor: !selectedCsvIds?.size || csvLoading ? 'not-allowed' : 'pointer',
                      padding: 0,
                      flex: '0 0 auto',
                    }}
                  >
                    Download Selected
                  </button>
                </div>
                {!csvCollapsed && (
                  <div
                    style={{
                      flex: 1,
                      minHeight: 0,
                      overflowY: 'auto',
                      overflowX: 'auto',
                      paddingRight: 4,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    {csvLoading ? (
                      <div style={{ color: '#9db6d8', fontSize: '0.82rem' }}>Loading CSV tables…</div>
                    ) : csvError ? (
                      <div style={{ color: '#e89aa9', fontSize: '0.82rem' }}>{csvError}</div>
                    ) : csvEntries.length === 0 ? (
                      <div style={{ color: '#8396b2', fontSize: '0.82rem' }}>No CSV tables available.</div>
                    ) : (
                      csvEntries.map((entry) => {
                        const entryId = entry.id ?? entry.entryId ?? entry.entry_id;
                        const baseName = entry.fileName || entry.FILE_NAME || entry.originalName || entry.ORIGINAL_NAME || (entryId ? `CSV ${entryId}` : 'CSV Table');
                        const timestamp = entry.createdAt || entry.created_at || entry.created || entry.timestamp || entry.uploadedAt || entry.uploaded_at || null;
                        const formattedTimestamp = (() => {
                          if (!timestamp) return null;
                          try {
                            const date = new Date(timestamp);
                            if (Number.isNaN(date.getTime())) return null;
                            return date.toLocaleString();
                          } catch (err) {
                            return null;
                          }
                        })();
                        const name = formattedTimestamp ? `${baseName} (${formattedTimestamp})` : baseName;
                        const entryKey = resolveCsvEntryKey(entry) || `${entryId || baseName}`;
                        const checked = isCsvSelected(entry);
                        return (
                          <div
                            key={entryKey}
                            draggable
                            onDragStart={(event) => handleCsvDragStart(event, entry)}
                            onMouseEnter={(event) => handlePanelItemHover(event, true)}
                            onMouseLeave={(event) => handlePanelItemHover(event, false)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '7px 9px',
                              borderRadius: 9,
                              border: 'none',
                              background: checked ? 'rgba(56,94,162,0.35)' : 'rgba(18,28,44,0.25)',
                              color: '#f0f6ff',
                              cursor: 'grab',
                              textAlign: 'left',
                              fontSize: '0.72rem',
                              transition: 'background 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease',
                              minWidth: 'max-content',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => {
                                event.stopPropagation();
                                toggleCsvSelection(entry);
                              }}
                              onMouseDown={(event) => event.stopPropagation()}
                              onClick={(event) => event.stopPropagation()}
                              style={{ flex: '0 0 auto', width: 10, height: 10 }}
                              aria-label={`Select ${name}`}
                            />
                            <img
                              src={csvIcon}
                              alt="CSV"
                              style={{ width: 14, height: 14, flex: '0 0 auto', filter: 'drop-shadow(0 0 2px rgba(80,150,255,0.2))' }}
                            />
                            <span style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}>{name}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            flex: '1 1 0%',
            display: 'flex',
            flexDirection: 'column',
            paddingRight: 4,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              paddingRight: 2,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {cells.map((cell) => {
            const isPython = cell.type === 'python';
            const isText = cell.type === 'text';
            const editorHeight = isPython ? 360 : isText ? 150 : 200;
            const isCollapsed = !!cell.collapsed;
            const dfLabel = cell.dfName ? `DataFrame: ${cell.dfName}` : 'No dataframe yet';
            const isDroppableCell = cell.type === 'text' || cell.type === 'python';
            const isDragTarget = isDroppableCell && dragOverCellId === cell.id;
            const outputWrapperStyleBase = {
              marginTop: 12,
                  border: '1px solid rgba(56,74,104,0.55)',
                  borderRadius: 9,
                  padding: '8px 10px',
              background: 'rgba(18,24,36,0.85)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            };
            const outputWrapperStyle = (() => {
              if (cell.outputTableProps) {
                return {
                  ...outputWrapperStyleBase,
                  maxHeight: isPython ? 560 : 460,
                  minHeight: isPython ? 260 : 220,
                  overflow: 'auto',
                };
              }
              if (isPython) {
                return {
                  ...outputWrapperStyleBase,
                  maxHeight: 420,
                  minHeight: 200,
                  overflow: 'auto',
                };
              }
              return { ...outputWrapperStyleBase, maxHeight: 220, overflow: 'auto' };
            })();
            const outputContainerStyle = (() => {
              if (cell.outputTableProps) {
                return { height: isPython ? 360 : 320, overflow: 'auto', paddingRight: 3 };
              }
              if (isPython) {
                return { maxHeight: 320, overflow: 'auto', paddingRight: 3 };
              }
              return { maxHeight: 150, overflow: 'auto', paddingRight: 3 };
            })();
            const editorSectionStyle = (() => {
              const base = { display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 3 };
              if (isPython) {
                return base;
              }
              return { ...base, maxHeight: 300, overflowY: 'auto' };
            })();

            if (isCollapsed) {
              return (
                <section
                  key={cell.id}
                  style={{
                    ...cardStyle,
                    border: '1px solid #2c3b58',
                    padding: '6px 10px',
                    gap: 6,
                    flexDirection: 'row',
                    alignItems: 'center',
                    ...(isDragTarget
                      ? {
                          border: '1px solid #5a8cff',
                          boxShadow: '0 0 0 2px rgba(90,140,255,0.35)',
                        }
                      : {}),
                  }}
                  onDragEnter={(event) => handleCellDragEnter(event, cell)}
                  onDragOver={(event) => handleCellDragOver(event, cell)}
                  onDragLeave={(event) => handleCellDragLeave(event, cell)}
                  onDropCapture={(event) => handlePanelItemDrop(event, cell)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <button
                      type="button"
                      onClick={() => toggleCollapse(cell.id)}
                      style={{ border: 'none', background: 'transparent', color: '#96b8ff', cursor: 'pointer', fontSize: '0.78rem', padding: '4px 6px' }}
                    >
                      Expand
                    </button>
                    <span style={{ color: '#f1f6ff', fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {cell.title}
                    </span>
                    <span style={{ color: '#7ea2d8', fontSize: '0.75rem' }}>• {cell.type.toUpperCase()}</span>
                    <span style={{ color: '#5f7baf', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{dfLabel}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => runCellById(cell.id)}
                      disabled={runningCellId === cell.id}
                      style={{ border: 'none', background: 'transparent', padding: 4, opacity: runningCellId === cell.id ? 0.6 : 1, cursor: runningCellId === cell.id ? 'default' : 'pointer' }}
                      aria-label="Run cell"
                      title="Run cell"
                    >
                      {runningCellId === cell.id ? (
                        <span style={{ display: 'inline-block', width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(120,170,255,0.35)', borderTopColor: 'rgba(120,170,255,0.85)', animation: 'spin 0.8s linear infinite' }} />
                      ) : (
                        <img src={runIcon} alt="Run" style={{ width: 20, height: 20 }} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMaximizeCell(cell)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        padding: '4px 6px',
                        cursor: 'pointer',
                        color: '#6fc3ff',
                        fontSize: '0.75rem',
                        textDecoration: 'underline',
                      }}
                    >
                      Maximize
                    </button>
                    <button
                      type="button"
                      onClick={addCell}
                      style={{ border: 'none', background: 'transparent', padding: 4, cursor: 'pointer' }}
                      aria-label="Add cell"
                      title="Add cell"
                    >
                      <img src={addCellIcon} alt="Add" style={{ width: 18, height: 18 }} />
                    </button>
                    {cells.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCell(cell.id)}
                        style={{ border: 'none', background: 'transparent', padding: 4, cursor: 'pointer' }}
                        aria-label="Delete cell"
                        title="Delete cell"
                      >
                        <img src={removeCellIcon} alt="Remove" style={{ width: 18, height: 18 }} />
                      </button>
                    )}
                  </div>
                </section>
              );
            }

            return (
              <section
                key={cell.id}
                style={{
                  ...cardStyle,
                  border: '1px solid #2c3b58',
                  overflow: 'hidden',
                  position: 'relative',
                  paddingTop: 36,
                  ...(isDragTarget
                    ? {
                        border: '1px solid #5a8cff',
                        boxShadow: '0 0 0 2px rgba(90,140,255,0.35)',
                      }
                    : {}),
                }}
                onDragEnter={(event) => handleCellDragEnter(event, cell)}
                onDragOver={(event) => handleCellDragOver(event, cell)}
                onDragLeave={(event) => handleCellDragLeave(event, cell)}
                onDropCapture={(event) => handlePanelItemDrop(event, cell)}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 8,
                    left: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleCollapse(cell.id)}
                    aria-label={isCollapsed ? 'Expand cell' : 'Collapse cell'}
                    title={isCollapsed ? 'Expand' : 'Collapse'}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      cursor: 'pointer',
                      width: 22,
                      height: 22,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <img src={minimiseIcon} alt="Collapse" style={{ width: 22, height: 22 }} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMaximizeCell(cell)}
                    aria-label="Maximize cell"
                    title="Maximize"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      cursor: 'pointer',
                      width: 22,
                      height: 22,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <img src={maximiseIcon} alt="Maximize" style={{ width: 22, height: 22 }} />
                  </button>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    paddingBottom: 8,
                    borderBottom: '1px solid rgba(45,66,94,0.65)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <label htmlFor={`mode-select-${cell.id}`} style={{ fontSize: '0.8rem', color: '#8da8cc' }}>
                      Mode
                    </label>
                    <select
                      id={`mode-select-${cell.id}`}
                      value={cell.type}
                      onChange={(e) => updateCellType(cell.id, e.target.value)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: '1px solid rgba(52,82,120,0.8)',
                        background: 'rgba(18,24,32,0.9)',
                        color: '#f2f6ff',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
                      }}
                    >
                      <option value="text">NLP</option>
                      <option value="python">Python</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(cell.content || '')}
                      title="Copy cell contents"
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        padding: '4px 6px',
                        borderRadius: 6,
                      }}
                      aria-label="Copy cell"
                    >
                      <img src={copyIcon} alt="" aria-hidden="true" style={{ width: 18, height: 18 }} />
                    </button>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#9bb8ff' }}>
                      <input
                        type="checkbox"
                        checked={!!cell.showOutput}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setCells((prev) =>
                            prev.map((c) =>
                              c.id === cell.id
                                ? {
                                    ...c,
                                    showOutput: checked,
                                    outputCollapsed: false,
                                    outputData: checked ? c.outputData : null,
                                    outputActiveColumn: checked && Array.isArray(c.outputData) && c.outputData.length
                                      ? Object.keys(c.outputData[0] || {})[0] || null
                                      : null,
                                    outputTableProps: checked ? c.outputTableProps : null,
                                  }
                                : c,
                            ),
                          );
                        }}
                      />
                      Inline output
                    </label>
                    {isPython && (
                      <button
                        type="button"
                        onClick={() => handleSavePythonScript(cell)}
                        disabled={pythonScriptsSaving}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          cursor: pythonScriptsSaving ? 'not-allowed' : 'pointer',
                          padding: '4px 6px',
                          borderRadius: 6,
                          color: pythonScriptsSaving ? 'rgba(159,199,255,0.6)' : '#9db4ff',
                          fontSize: '0.78rem',
                          textDecoration: 'underline',
                        }}
                      >
                        {pythonScriptsSaving ? 'Saving…' : 'Save Script'}
                      </button>
                    )}
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#7ea2d8' }}>{dfLabel}</span>
                </div>

                <div style={editorSectionStyle}>
                  <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
                    <div>
                      <h2 style={{ margin: '8px 0 4px', fontSize: '1.1rem', color: '#f5f9ff' }}>{cell.title}</h2>
                      <span style={{ fontSize: '0.8rem', color: '#8da8cc' }}>{cell.placeholder}</span>
                    </div>
                  </header>
                  {isPython ? (
                    <div
                      style={{
                        marginTop: 6,
                        marginBottom: 10,
                        padding: '10px 12px',
                        borderRadius: 9,
                        border: '1px solid rgba(48,74,110,0.8)',
                        background: 'rgba(18,26,40,0.65)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      {(() => {
                        const scriptsCollapsed = !!pythonScriptsCollapsed[cell.id];
                        return (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                              <span style={{ fontSize: '0.78rem', color: '#9bb8ff', fontWeight: 600 }}>Saved Python Scripts</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {!scriptsCollapsed && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={refreshPythonScripts}
                                      disabled={pythonScriptsLoading}
                                      style={{
                                        border: 'none',
                                        background: 'transparent',
                                        cursor: pythonScriptsLoading ? 'not-allowed' : 'pointer',
                                        color: pythonScriptsLoading ? 'rgba(159,199,255,0.6)' : '#9db4ff',
                                        fontSize: '0.75rem',
                                        textDecoration: 'underline',
                                        padding: 0,
                                      }}
                                    >
                                      {pythonScriptsLoading ? 'Refreshing…' : 'Refresh'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const selectedId = pythonScriptSelections[cell.id] || '';
                                        if (selectedId) {
                                          handleLoadPythonScript(cell, selectedId);
                                        }
                                      }}
                                      disabled={pythonScriptsLoading || !pythonScriptSelections[cell.id] || pythonScriptLoadingId === pythonScriptSelections[cell.id]}
                                      style={{
                                        border: '1px solid rgba(90,130,190,0.8)',
                                        background: 'rgba(24,34,52,0.95)',
                                        color: '#dfe8ff',
                                        fontSize: '0.75rem',
                                        padding: '4px 10px',
                                        borderRadius: 6,
                                        cursor: pythonScriptsLoading || !pythonScriptSelections[cell.id] ? 'not-allowed' : 'pointer',
                                        opacity: pythonScriptsLoading || !pythonScriptSelections[cell.id] ? 0.6 : 1,
                                      }}
                                    >
                                      {pythonScriptLoadingId === pythonScriptSelections[cell.id] ? 'Loading…' : 'Load into cell'}
                                    </button>
                                  </>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPythonScriptsCollapsed((prev) => ({
                                      ...prev,
                                      [cell.id]: !scriptsCollapsed,
                                    }))
                                  }
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    color: '#9bb8ff',
                                    fontSize: '0.75rem',
                                    textDecoration: 'underline',
                                    padding: 0,
                                  }}
                                >
                                  {scriptsCollapsed ? 'Expand' : 'Collapse'}
                                </button>
                              </div>
                            </div>
                            {!scriptsCollapsed ? (
                              pythonScriptsError ? (
                                <div style={{ fontSize: '0.75rem', color: '#e89aa9' }}>{pythonScriptsError}</div>
                              ) : pythonScriptsLoading ? (
                                <div style={{ fontSize: '0.75rem', color: '#9db6d8' }}>Loading scripts…</div>
                              ) : pythonScripts.length === 0 ? (
                                <div style={{ fontSize: '0.75rem', color: '#8298b8' }}>No saved scripts yet.</div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  <label style={{ fontSize: '0.72rem', color: '#a8bcdf', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    Select script
                                    <select
                                      value={pythonScriptSelections[cell.id] || ''}
                                      onChange={(event) => {
                                        const value = event.target.value;
                                        setPythonScriptSelections((prev) => ({
                                          ...prev,
                                          [cell.id]: value,
                                        }));
                                      }}
                                      style={{
                                        padding: '6px 10px',
                                        borderRadius: 6,
                                        border: '1px solid rgba(60,90,138,0.8)',
                                        background: 'rgba(14,20,30,0.95)',
                                        color: '#f2f6ff',
                                        fontSize: '0.78rem',
                                      }}
                                    >
                                      <option value="">Choose a script…</option>
                                      {pythonScripts.map((script) => (
                                        <option key={script.id} value={script.id}>
                                          {script.fileName}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                </div>
                              )
                            ) : null}
                          </>
                        );
                      })()}
                    </div>
                  ) : null}
                  <div style={{ border: '1px solid #202c44', borderRadius: 9, overflow: 'hidden' }}>
                    <Editor
                      height={editorHeight}
                      language={cell.language}
                      theme="vs-dark"
                      value={cell.content}
                      onChange={(value) => updateCellContent(cell.id, value ?? '')}
                      onMount={(editorInstance, monacoInstance) => {
                        try {
                          editorInstance.addCommand(
                            monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter,
                            () => runCellByIdRef.current(cell.id),
                          );
                        } catch {}
                      }}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                      }}
                    />
                  </div>
                </div>

                {cell.showOutput && (
                  <div style={outputWrapperStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <span style={{ fontSize: '0.8rem', color: '#9db8e6' }}>Inline Output ({cell.dfName || dfLabel.replace('DataFrame: ', '')})</span>
                      <button
                        type="button"
                        onClick={() =>
                          setCells((prev) =>
                            prev.map((c) =>
                              c.id === cell.id
                                ? { ...c, outputCollapsed: !c.outputCollapsed }
                                : c,
                            ),
                          )
                        }
                        style={{
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          padding: '4px 6px',
                          borderRadius: 6,
                          color: '#96b8ff',
                          fontSize: '0.78rem',
                        }}
                      >
                        {cell.outputCollapsed ? 'Expand Output' : 'Collapse Output'}
                      </button>
                    </div>
                    {cell.outputCollapsed ? (
                      <div style={{ fontSize: '0.78rem', color: '#859bbd' }}>Output hidden. Expand to review the last run.</div>
                    ) : (
                      <div style={outputContainerStyle}>{renderOutputPreview(cell)}</div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => runCellById(cell.id)}
                      disabled={runningCellId === cell.id}
                      style={{
                        border: 'none',
                        background: 'rgba(30,46,72,0.85)',
                        borderRadius: 6,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: runningCellId === cell.id ? 'default' : 'pointer',
                        padding: '6px 10px',
                        gap: 6,
                        color: '#e6f0ff',
                        fontSize: '0.76rem',
                        opacity: runningCellId === cell.id ? 0.6 : 1,
                      }}
                      aria-label="Run cell"
                      title="Run cell"
                    >
                      {runningCellId === cell.id ? (
                        <span
                          style={{
                            display: 'inline-block',
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            border: '2px solid rgba(120,170,255,0.35)',
                            borderTopColor: 'rgba(120,170,255,0.85)',
                            animation: 'spin 0.8s linear infinite',
                          }}
                        />
                      ) : (
                        <img src={runIcon} alt="Run" style={{ width: 14, height: 14 }} />
                      )}
                      <span>Run</span>
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      type="button"
                      onClick={addCell}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: 4,
                      }}
                      aria-label="Add cell"
                      title="Add cell"
                    >
                      <img src={addCellIcon} alt="Add" style={{ width: 22, height: 22 }} />
                    </button>
                    {cells.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCell(cell.id)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          padding: 4,
                        }}
                        aria-label="Delete cell"
                        title="Delete cell"
                      >
                        <img src={removeCellIcon} alt="Remove" style={{ width: 20, height: 20 }} />
                      </button>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
            </div>
          </div>
        </div>
        <div
          style={{
            flex: rightPanelFlex,
            display: 'flex',
            flexDirection: 'column',
            background: 'rgba(13,18,28,0.88)',
            border: '1px solid rgba(40,58,84,0.6)',
            borderRadius: 12,
            boxShadow: '0 18px 32px rgba(0,0,0,0.35)',
            overflow: 'hidden',
            transition: 'flex-basis 0.2s ease',
            minHeight: 0,
          }}
        >
          <button
            type="button"
            onClick={() => setRightPanelCollapsed((prev) => !prev)}
            aria-expanded={!rightPanelCollapsed}
            style={{
              padding: rightPanelCollapsed ? '10px 8px' : '10px 12px',
              border: 'none',
              borderBottom: '1px solid rgba(40,58,84,0.6)',
              background: 'rgba(12,18,28,0.95)',
              color: '#8fb1ff',
              fontSize: rightPanelCollapsed ? '0.74rem' : '0.82rem',
              fontWeight: 600,
              display: 'flex',
              flexDirection: rightPanelCollapsed ? 'column' : 'row',
              alignItems: 'center',
              justifyContent: rightPanelCollapsed ? 'center' : 'space-between',
              cursor: 'pointer',
              gap: rightPanelCollapsed ? 6 : 8,
              textAlign: 'center',
            }}
          >
            {rightPanelCollapsed ? (
              <>
                <span
                  style={{
                    letterSpacing: 0.3,
                    fontSize: '0.72rem',
                    lineHeight: 1.1,
                    writingMode: 'vertical-rl',
                    transform: 'rotate(180deg)',
                    textTransform: 'uppercase',
                    color: '#9fb6ff',
                  }}
                >
                  NotebookSLM
                </span>
                <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>«</span>
              </>
            ) : (
              <>
                <span style={{ letterSpacing: 0.4 }}>Notebook SLM</span>
                <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>»</span>
              </>
            )}
          </button>
          <div
            style={{
              flex: rightPanelCollapsed ? '0 0 auto' : 1,
              minHeight: 0,
              padding: rightPanelCollapsed ? '6px 6px 10px' : '16px 14px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              transition: 'padding 0.2s ease',
            }}
          >
            <section
              style={{
                ...cardStyle,
                border: '1px solid #2c3b58',
                marginBottom: 0,
                flex: rightPanelCollapsed ? '0 0 auto' : 1,
                minHeight: rightPanelCollapsed ? 'auto' : 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: rightPanelCollapsed ? 'visible' : 'hidden',
                transition: 'flex 0.2s ease, max-height 0.2s ease',
              }}
            >
              <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem' }}>NotebookSLM</h2>
                <span style={{ fontSize: '0.75rem', color: '#8da8cc' }}>Use names in downstream scripts</span>
              </header>

              {!rightPanelCollapsed && (
                <>
                  <div style={{ border: '1px solid #26324a', borderRadius: 10, padding: 12, background: 'rgba(18,24,36,0.9)', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflow: 'auto' }}>
                    <div style={{ fontSize: '0.82rem', color: '#9db8e6' }}>Active dataframe: <span style={{ color: '#eef4ff', fontWeight: 600 }}>{results.activeDataFrameName || '—'}</span></div>
                    <div style={{ fontSize: '0.78rem', color: '#7fa2d1' }}>Available:</div>
                    <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {Object.entries(results.dataFrames || {}).map(([name, data]) => (
                        <li key={name} style={{ color: '#d5e4ff', fontSize: '0.82rem' }}>
                          {name} <span style={{ color: '#7fa2d1' }}>({Array.isArray(data) ? data.length : 0} rows)</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div style={{
                    border: '1px solid #26324a',
                    borderRadius: 10,
                    padding: 12,
                    background: 'rgba(18,24,36,0.9)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    flex: 1,
                    minHeight: 0,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ fontSize: '0.8rem', color: '#7fa2d1' }}>Execution Log</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#9fb6ff', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={logWrapEnabled}
                            onChange={(event) => setLogWrapEnabled(event.target.checked)}
                            style={{ accentColor: '#4c86ff' }}
                          />
                          Wrap lines
                        </label>
                        <button
                          type="button"
                          onClick={handleExportLogs}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#6fc3ff',
                            textDecoration: 'underline',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          Export log
                        </button>
                      </div>
                    </div>
                    <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', paddingRight: 6 }}>
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: 18,
                          color: '#d5e4ff',
                          fontSize: '0.85rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                          whiteSpace: logWrapEnabled ? 'pre-wrap' : 'pre',
                          wordBreak: logWrapEnabled ? 'break-word' : 'normal',
                          overflowWrap: logWrapEnabled ? 'anywhere' : 'normal',
                          minWidth: logWrapEnabled ? 'auto' : 'min-content',
                        }}
                      >
                        {results.logs.map((line, idx) => (
                          <li key={`${line}-${idx}`}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      </div>
    </StandaloneChrome>
  );
}
