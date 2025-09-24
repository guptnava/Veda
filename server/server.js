import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import { fetch as undiciFetch } from 'undici';
import ExcelJS from 'exceljs'; // ← Add at top
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

import fs from 'fs';
import path from 'path';

import { fileURLToPath } from 'url';

// 👇 Recreate __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());

// Increase JSON body limit (example: 10 MB)
app.use(express.json({ limit: '1024mb' }));
app.use(express.urlencoded({ limit: '1024mb', extended: true }));

const hostname='localhost';
const port = 3000;

const FLASK_DATABASE_INTENT_URL = `http://${hostname}:5012`;
const FLASK_DATABASE_LANGCHAIN_URL = `http://${hostname}:5013`;
const FLASK_DATABASE_LANGCHAIN_PROMPT_ENG_URL = `http://${hostname}:5014`;
const FLASK_DATABASE_LLAMAINDEX_PROMPT_ENG_URL = `http://${hostname}:5003`;
const FLASK_DATABASE_LANGCHAIN_PROMPT_ENG_EMBD_URL = `http://${hostname}:5004`;
const FLASK_RESTFUL_PROMPT_ENG_EMBD_URL = `http://${hostname}:5006`;
const FLASK_DATABASE_LANGCHAIN_PROMPT_ENG_EMBD_NARRATED_URL = `http://${hostname}:5009`;
const FLASK_DATABASE_GENERIC_RAG_URL = `http://${hostname}:5010`;
const FLASK_DATABASE_INTENT_EMBDED_NOMODEL_URL = `http://${hostname}:5011`;
// Optional: dedicated Flask service for table ops (filter/sort/paginate/cache) if running
const FLASK_TABLE_OPS_URL = `http://${hostname}:5015`;

const OLLAMA_API_URL = `http://${hostname}:11434`; // Ollama HTTP API URL

const CACHE_EXPIRATION_MS = 30 * 60 * 1000; // 30 minutes cache expiration

// Simple in-memory cache: { key: { data, expiresAt } }
const cache = new Map();

function getCache(key) {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  if (cached) cache.delete(key);
  return null;
}

function setCache(key, data) {
  cache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_EXPIRATION_MS,
  });
}

// Separate cache for distinct responses with shorter TTL
const distinctCache = new Map(); // key -> { data, expiresAt }
const DISTINCT_TTL_MS = 5 * 60 * 1000; // 5 minutes
function getDistinctCache(key) {
  const c = distinctCache.get(key);
  if (c && c.expiresAt > Date.now()) return c.data;
  if (c) distinctCache.delete(key);
  return null;
}
function setDistinctCache(key, data) {
  distinctCache.set(key, { data, expiresAt: Date.now() + DISTINCT_TTL_MS });
}

// Stable stringify to build cache keys irrespective of key order
function stableStringify(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj).sort();
  const parts = keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k]));
  return '{' + parts.join(',') + '}';
}

// Helpers to apply filters on server
function matchesColFilter(row, col, f) {
  if (!f || !f.op) return true;
  const raw = row?.[col];
  const val = raw == null ? '' : raw;
  const op = f.op;
  const v1 = f.value;
  const v2 = f.value2;
  const numOps = ['=','!=','>','>=','<','<=','between'];
  if (numOps.includes(op)) {
    const n = Number(val);
    const a = Number(v1);
    const b = Number(v2);
    if (!isFinite(n)) return false;
    switch (op) {
      case '=': return n === a;
      case '!=': return n !== a;
      case '>': return n > a;
      case '>=': return n >= a;
      case '<': return n < a;
      case '<=': return n <= a;
      case 'between': return isFinite(a) && isFinite(b) ? (n >= Math.min(a,b) && n <= Math.max(a,b)) : true;
      default: return true;
    }
  }
  const s = String(val).toLowerCase();
  const t = String(v1 ?? '').toLowerCase();
  switch (op) {
    case 'contains': return s.includes(t);
    case 'equals': return s === t;
    case 'startsWith': return s.startsWith(t);
    case 'endsWith': return s.endsWith(t);
    case 'notContains': return !s.includes(t);
    case 'isEmpty': return s.length === 0;
    case 'notEmpty': return s.length > 0;
    default: return true;
  }
}
function applyContextFilters(rows, { columnFilters, valueFilters, advancedFilters }) {
  let out = rows;
  // Column filters (AND across columns)
  if (columnFilters && typeof columnFilters === 'object') {
    const cols = Object.keys(columnFilters).filter(c => columnFilters[c] && columnFilters[c].op && (columnFilters[c].op === 'isEmpty' || columnFilters[c].op === 'notEmpty' || (columnFilters[c].value != null && String(columnFilters[c].value).length > 0)));
    if (cols.length) out = out.filter(r => cols.every(c => matchesColFilter(r, c, columnFilters[c])));
  }
  // Advanced filters
  if (advancedFilters && Array.isArray(advancedFilters.rules) && advancedFilters.rules.length) {
    const rules = advancedFilters.rules;
    const combine = (advancedFilters.combine || 'AND').toUpperCase();
    const evalRule = (r, f) => matchesColFilter(r, f.column, f);
    out = out.filter(r => combine === 'OR' ? rules.some(f => evalRule(r, f)) : rules.every(f => evalRule(r, f)));
  }
  // Value filters (multi-select per column; null => no filter on that col)
  if (valueFilters && typeof valueFilters === 'object') {
    const vfCols = Object.keys(valueFilters).filter(c => Array.isArray(valueFilters[c]));
    if (vfCols.length) out = out.filter(r => vfCols.every(c => {
      const sel = valueFilters[c];
      const v = String(r?.[c] ?? '');
      return sel.includes(v);
    }));
  }
  return out;
}

app.post('/api/generate', async (req, res) => {
  const { model, prompt, mode, stream } = req.body;
  let flask_endpoint = '';

  if (mode === 'database') flask_endpoint = `${FLASK_DATABASE_INTENT_URL}/query`;
  else if (mode === 'langchain') flask_endpoint = `${FLASK_DATABASE_LANGCHAIN_URL}/query`;
  else if (mode === 'langchainprompt') flask_endpoint = `${FLASK_DATABASE_LANGCHAIN_PROMPT_ENG_URL}/query`;
  else if (mode === 'restful') flask_endpoint = `${FLASK_RESTFUL_PROMPT_ENG_EMBD_URL}/query`;
  else if (mode === 'embedded') flask_endpoint = `${FLASK_DATABASE_LANGCHAIN_PROMPT_ENG_EMBD_URL}/query`;
  else if (mode === 'llamaindex') flask_endpoint = `${FLASK_DATABASE_LLAMAINDEX_PROMPT_ENG_URL}/query`;
  else if (mode === 'embedded_narrated') flask_endpoint = `${FLASK_DATABASE_LANGCHAIN_PROMPT_ENG_EMBD_NARRATED_URL}/query`;
  else if (mode === 'generic_rag') flask_endpoint = `${FLASK_DATABASE_GENERIC_RAG_URL}/query`;
  else if (mode === 'database1') flask_endpoint = `${FLASK_DATABASE_INTENT_EMBDED_NOMODEL_URL}/query`;
  
  
  try {
    if (["database", "langchainprompt", "restful", "embedded", "embedded_narrated", "generic_rag", "database1",].includes(mode))  {
      // Proxy to Flask API for DB queries with caching and logging
     /*  const cached = getCache(prompt);
      if (cached) {
        return res.json({ response: cached, cached: true });
      }
 */
      // Pass user-agent and IP info
      const userAgent = req.headers['user-agent'] || 'unknown';
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

      const flaskRes = await undiciFetch(flask_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': userAgent,
          'X-Forwarded-For': clientIp,
        },
        // Forward full body so flags (e.g., sendSqlToLlm) and sliders reach Flask services
        body: JSON.stringify(req.body),
      });

      if (!flaskRes.ok) {
        const error = await flaskRes.json();
        return res.status(flaskRes.status).json({ error: error.error || 'Flask API error' });
      }

      // Set the same content-type header so frontend knows it's NDJSON
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      // Pipe the Flask response stream to the client response stream
      const reader = flaskRes.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;

      while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          if (value) {
            const chunk = decoder.decode(value);
            res.write(chunk);
          }
        }
        res.end();

        // Optionally, you can implement caching logic here by buffering chunks, but streaming + caching is more complex

    } else if (mode === 'direct') {
      // Direct mode — call Ollama HTTP API with streaming

      const ollamaRes = await undiciFetch(`${OLLAMA_API_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream,
        }),
      });

      if (!ollamaRes.ok || !ollamaRes.body) {
        throw new Error(`Failed to start stream: ${ollamaRes.status} ${ollamaRes.statusText}`);
      }

      res.setHeader('Content-Type', 'application/json; charset=utf-8');

      const reader = ollamaRes.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value);
          res.write(chunk);
        }
      }
      res.end();

    } else if (["langchain", "llamaindex"].includes(mode)){
      // Direct mode — call Ollama HTTP API with streaming

      // Proxy to Flask API for DB queries with caching and logging
     /*  const cached = getCache(prompt);
      if (cached) {
        return res.json({ response: cached, cached: true });
      }
       */
      // Pass user-agent and IP info
      const userAgent = req.headers['user-agent'] || 'unknown';
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

      const flaskRes = await undiciFetch(flask_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': userAgent,
          'X-Forwarded-For': clientIp,
        },
        body: JSON.stringify(req.body),
      });
      
      if (!flaskRes.ok || !flaskRes.body) {
        throw new Error(`Failed to start stream: ${flaskRes.status} ${flaskRes.statusText}`);
      }

      res.setHeader('Content-Type', 'application/json; charset=utf-8');

      const reader = flaskRes.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value);
          res.write(chunk);
        }
      }
      res.end();

    } else {
      res.status(400).json({ error: 'Invalid interaction mode' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



// Excel file download route
app.post('/api/download-excel', async (req, res) => {
  const { data, filename = 'chatbot_data.xlsx' } = req.body;

  if (!Array.isArray(data) || data.length === 0) {
    return res.status(400).json({ error: 'No tabular data provided' });
  }

  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data');

    // Auto-set columns from keys of first row
    worksheet.columns = Object.keys(data[0]).map((key) => ({
      header: key,
      key: key,
      width: 20,
    }));

    // Add each row
    data.forEach((row) => {
      worksheet.addRow(row);
    });

    // Set headers for file download
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Stream workbook to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ error: 'Failed to generate Excel file' });
  }
});

app.post('/api/download-csv', async (req, res) => {
  const { data, filename = 'chatbot_data.csv' } = req.body;

  if (!Array.isArray(data) || data.length === 0) {
    return res.status(400).json({ error: 'No tabular data provided' });
  }

  const headers = Object.keys(data[0]);
  const csv = [headers.join(',')].concat(
    data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','))
  ).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

// Full CSV export by re-running the query against Flask and streaming to CSV
app.post('/api/download-csv-query', async (req, res) => {
  try {
    // Expect a single hidden field 'payload' containing JSON
    let payload = '';
    if (req.is('application/json')) {
      payload = JSON.stringify(req.body);
    } else {
      // Parse urlencoded
      payload = req.body?.payload;
    }
    const body = typeof payload === 'string' ? JSON.parse(payload) : payload;
    const { model, prompt, mode } = body || {};
    if (!prompt || !mode || !model) return res.status(400).json({ error: 'Missing prompt/mode/model' });

    let flask_endpoint = '';
    if (mode === 'database') flask_endpoint = `${FLASK_DATABASE_INTENT_URL}/query`;
    else if (mode === 'langchain') flask_endpoint = `${FLASK_DATABASE_LANGCHAIN_URL}/query`;
    else if (mode === 'langchainprompt') flask_endpoint = `${FLASK_DATABASE_LANGCHAIN_PROMPT_ENG_URL}/query`;
    else if (mode === 'restful') flask_endpoint = `${FLASK_RESTFUL_PROMPT_ENG_EMBD_URL}/query`;
    else if (mode === 'embedded') flask_endpoint = `${FLASK_DATABASE_LANGCHAIN_PROMPT_ENG_EMBD_URL}/query`;
    else if (mode === 'llamaindex') flask_endpoint = `${FLASK_DATABASE_LLAMAINDEX_PROMPT_ENG_URL}/query`;
    else if (mode === 'embedded_narrated') flask_endpoint = `${FLASK_DATABASE_LANGCHAIN_PROMPT_ENG_EMBD_NARRATED_URL}/query`;
    else if (mode === 'generic_rag') flask_endpoint = `${FLASK_DATABASE_GENERIC_RAG_URL}/query`;
    else if (mode === 'database1') flask_endpoint = `${FLASK_DATABASE_INTENT_EMBDED_NOMODEL_URL}/query`;
    else return res.status(400).json({ error: 'Invalid mode' });

    const userAgent = 'csv-export';
    const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
    const flaskRes = await undiciFetch(flask_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': userAgent, 'X-Forwarded-For': clientIp },
      body: JSON.stringify(body),
    });
    if (!flaskRes.ok || !flaskRes.body) {
      const errText = await flaskRes.text();
      return res.status(flaskRes.status).json({ error: errText || 'Flask error' });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="table.csv"');

    const reader = flaskRes.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let done = false;
    let headers = null;
    const escape = (v) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };

    while (!done) {
      const { value, done: dr } = await reader.read();
      done = dr;
      if (value) {
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.trim());
        for (const line of lines) {
          try {
            const obj = JSON.parse(line);
            if (obj._narration || obj._base_sql || obj._column_types || obj._search_columns) continue; // skip narration/metadata lines
            if (!headers) {
              headers = Object.keys(obj);
              res.write(headers.map(escape).join(',') + '\n');
            }
            const row = headers.map(h => escape(obj[h]));
            res.write(row.join(',') + '\n');
          } catch (e) {
            // skip broken
          }
        }
      }
    }
    res.end();
  } catch (e) {
    console.error('download-csv-query failed', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/download-pdf', async (req, res) => {
  const { data, filename = 'chatbot_data.pdf' } = req.body;

  // Validate input
  if (!Array.isArray(data) || data.length === 0) {
    return res.status(400).json({ error: 'No tabular data provided' });
  }

  try {
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595, 842]); // A4 size in points (595x842)
    const { width, height } = page.getSize();

    // Load fonts
    const normalFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Optional: Embed custom fonts if needed
    /*
    const normalFontPath = path.join(__dirname, 'fonts', 'DejaVuSans.ttf');
    const boldFontPath = path.join(__dirname, 'fonts', 'DejaVuSans-Bold.ttf');
    const normalFont = await pdfDoc.embedFont(fs.readFileSync(normalFontPath));
    const boldFont = await pdfDoc.embedFont(fs.readFileSync(boldFontPath));
    */

    const headers = Object.keys(data[0]);
    const margin = 30;
    const cellPadding = 5;
    const availableWidth = width - 2 * margin;
    let y = height - margin - 20; // Start near top of page

    // Calculate fixed column widths (equal distribution for simplicity)
    const colWidth = availableWidth / headers.length;
    const colWidths = headers.map(() => colWidth); // Equal width for each column

    // Alternative: Dynamic column widths based on content (uncomment to use)
    /*
    const calculateTextWidth = (text, font, size) => {
      return font.widthOfTextAtSize(String(text ?? ''), size);
    };
    const colWidths = headers.map((header, i) => {
      const headerWidth = calculateTextWidth(header, boldFont, 12);
      const maxContentWidth = Math.max(
        ...data.map(row => calculateTextWidth(row[header] ?? '', normalFont, 10))
      );
      return Math.min(Math.max(headerWidth, maxContentWidth) + 2 * cellPadding, availableWidth / headers.length);
    });
    const totalColWidth = colWidths.reduce((sum, w) => sum + w, 0);
    if (totalColWidth > availableWidth) {
      const scaleFactor = availableWidth / totalColWidth;
      colWidths.forEach((_, i) => { colWidths[i] *= scaleFactor; });
    }
    console.log('Column Widths:', colWidths);
    */

    // Draw title
    page.drawText('Chatbot Data Export', {
      x: margin,
      y,
      size: 16,
      font: boldFont,
      color: rgb(0, 0, 0),
      maxWidth: availableWidth,
      lineHeight: 20,
    });
    y -= 40; // Move down after title

    // Function to truncate text if too long
    const truncateText = (text, font, size, maxWidth) => {
      let safeText = String(text ?? '').replace(/[^\x20-\x7E]/g, ''); // Remove non-ASCII
      while (font.widthOfTextAtSize(safeText, size) > maxWidth && safeText.length > 0) {
        safeText = safeText.slice(0, -1); // Truncate character by character
      }
      return safeText + (safeText.length < String(text ?? '').length ? '...' : '');
    };

    // Function to draw a cell
    const drawCell = (text, x, y, width, height, isHeader = false, isOddRow = false) => {
      // Draw cell background (for headers and alternating rows)
      page.drawRectangle({
        x,
        y: y - height,
        width,
        height,
        fillColor: isHeader ? rgb(0.9, 0.9, 0.9) : (isOddRow ? rgb(0.95, 0.95, 0.95) : rgb(1, 1, 1)),
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      });

      // Truncate text to fit within cell
      const safeText = truncateText(text, isHeader ? boldFont : normalFont, isHeader ? 12 : 10, width - 2 * cellPadding);

      // Draw text
      page.drawText(safeText, {
        x: x + cellPadding,
        y: y - cellPadding - (isHeader ? 12 : 10),
        size: isHeader ? 12 : 10,
        font: isHeader ? boldFont : normalFont,
        color: rgb(0, 0, 0),
        maxWidth: width - 2 * cellPadding,
        lineHeight: isHeader ? 14 : 12,
      });
    };

    // Draw header row
    const headerHeight = 20;
    let x = margin;
    headers.forEach((header, i) => {
      drawCell(header, x, y, colWidths[i], headerHeight, true);
      x += colWidths[i];
    });
    y -= headerHeight;

    // Draw data rows
    const rowHeight = 20;
    data.forEach((row, rowIndex) => {
      x = margin;
      headers.forEach((key, i) => {
        drawCell(row[key], x, y, colWidths[i], rowHeight, false, rowIndex % 2 === 1);
        x += colWidths[i];
      });
      y -= rowHeight;

      // Page break if needed
      if (y - rowHeight < margin) {
        page = pdfDoc.addPage([595, 842]);
        y = height - margin;
        // Redraw headers on new page
        x = margin;
        headers.forEach((header, i) => {
          drawCell(header, x, y, colWidths[i], headerHeight, true);
          x += colWidths[i];
        });
        y -= headerHeight;
      }
    });

    // Save PDF and send response
    const pdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('Error generating PDF:', err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Full Excel export by re-running the query and writing workbook incrementally
app.post('/api/download-excel-query', async (req, res) => {
  try {
    const payloadStr = req.body?.payload ? req.body.payload : JSON.stringify(req.body || {});
    const body = typeof payloadStr === 'string' ? JSON.parse(payloadStr) : payloadStr;
    const { model, prompt, mode } = body || {};
    if (!prompt || !mode || !model) return res.status(400).json({ error: 'Missing prompt/mode/model' });

    let flask_endpoint = '';
    if (mode === 'database') flask_endpoint = `${FLASK_DATABASE_INTENT_URL}/query`;
    else if (mode === 'langchain') flask_endpoint = `${FLASK_DATABASE_LANGCHAIN_URL}/query`;
    else if (mode === 'langchainprompt') flask_endpoint = `${FLASK_DATABASE_LANGCHAIN_PROMPT_ENG_URL}/query`;
    else if (mode === 'restful') flask_endpoint = `${FLASK_RESTFUL_PROMPT_ENG_EMBD_URL}/query`;
    else if (mode === 'embedded') flask_endpoint = `${FLASK_DATABASE_LANGCHAIN_PROMPT_ENG_EMBD_URL}/query`;
    else if (mode === 'llamaindex') flask_endpoint = `${FLASK_DATABASE_LLAMAINDEX_PROMPT_ENG_URL}/query`;
    else if (mode === 'embedded_narrated') flask_endpoint = `${FLASK_DATABASE_LANGCHAIN_PROMPT_ENG_EMBD_NARRATED_URL}/query`;
    else if (mode === 'generic_rag') flask_endpoint = `${FLASK_DATABASE_GENERIC_RAG_URL}/query`;
    else if (mode === 'database1') flask_endpoint = `${FLASK_DATABASE_INTENT_EMBDED_NOMODEL_URL}/query`;
    else return res.status(400).json({ error: 'Invalid mode' });

    const userAgent = 'excel-export';
    const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
    const flaskRes = await undiciFetch(flask_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': userAgent, 'X-Forwarded-For': clientIp }, body: JSON.stringify(body) });
    if (!flaskRes.ok || !flaskRes.body) return res.status(flaskRes.status).end();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="table.xlsx"');

    const reader = flaskRes.body.getReader();
    const decoder = new TextDecoder('utf-8');
    // Use already-imported ExcelJS (ESM default import at top)
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Data');
    let headers = null;
    let firstRowWritten = false;
    ws.properties.defaultRowHeight = 15;

    let done = false;
    while (!done) {
      const { value, done: dr } = await reader.read();
      done = dr;
      if (value) {
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.trim());
        for (const line of lines) {
          try {
            const obj = JSON.parse(line);
            if (!obj || obj._narration || obj._base_sql || obj._column_types || obj._search_columns) continue;
            if (!headers) {
              headers = Object.keys(obj);
              ws.addRow(headers);
              ws.getRow(1).font = { bold: true };
              firstRowWritten = true;
            }
            ws.addRow(headers.map(h => obj[h]));
          } catch (e) {}
        }
      }
    }
    await workbook.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error('download-excel-query failed', e);
    res.status(500).json({ error: e.message });
  }
});

// Save current view to Oracle via table-ops Flask service
app.post('/api/table/save_view', async (req, res) => {
  try {
    const url = `${FLASK_TABLE_OPS_URL}/table/save_view`;
    const flaskRes = await undiciFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {}),
    });
    const ct = flaskRes.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const json = await flaskRes.json();
      return res.status(flaskRes.status).json(json);
    } else {
      const text = await flaskRes.text();
      return res.status(flaskRes.status).send(text);
    }
  } catch (e) {
    console.error('save_view proxy failed', e);
    res.status(500).json({ error: e.message });
  }
});

// List saved views
app.get('/api/table/saved_views', async (req, res) => {
  try {
    const qs = new URLSearchParams();
    if (req.query.datasetSig) qs.set('datasetSig', req.query.datasetSig);
    if (req.query.owner) qs.set('owner', req.query.owner);
    const url = `${FLASK_TABLE_OPS_URL}/table/saved_views?${qs.toString()}`;
    const flaskRes = await undiciFetch(url, { method: 'GET' });
    const ct = flaskRes.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const json = await flaskRes.json();
      return res.status(flaskRes.status).json(json);
    } else {
      const text = await flaskRes.text();
      return res.status(flaskRes.status).send(text);
    }
  } catch (e) {
    console.error('saved_views proxy failed', e);
    res.status(500).json({ error: e.message });
  }
});

// Dashboards proxy routes
app.post('/api/dashboard/save', async (req, res) => {
  try {
    const url = `${FLASK_TABLE_OPS_URL}/dashboard/save`;
    const flaskRes = await undiciFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req.body || {}) });
    const ct = flaskRes.headers.get('content-type') || '';
    if (ct.includes('application/json')) { const json = await flaskRes.json(); return res.status(flaskRes.status).json(json); }
    const text = await flaskRes.text(); return res.status(flaskRes.status).send(text);
  } catch (e) { console.error('dashboard save proxy failed', e); res.status(500).json({ error: e.message }); }
});

app.get('/api/dashboard/list', async (req, res) => {
  try {
    const qs = new URLSearchParams(); if (req.query.owner) qs.set('owner', req.query.owner);
    const url = `${FLASK_TABLE_OPS_URL}/dashboard/list?${qs.toString()}`;
    const flaskRes = await undiciFetch(url, { method: 'GET' });
    const ct = flaskRes.headers.get('content-type') || '';
    if (ct.includes('application/json')) { const json = await flaskRes.json(); return res.status(flaskRes.status).json(json); }
    const text = await flaskRes.text(); return res.status(flaskRes.status).send(text);
  } catch (e) { console.error('dashboard list proxy failed', e); res.status(500).json({ error: e.message }); }
});

app.get('/api/dashboard/get', async (req, res) => {
  try {
    const qs = new URLSearchParams(); if (req.query.name) qs.set('name', req.query.name); if (req.query.owner) qs.set('owner', req.query.owner);
    const url = `${FLASK_TABLE_OPS_URL}/dashboard/get?${qs.toString()}`;
    const flaskRes = await undiciFetch(url, { method: 'GET' });
    const ct = flaskRes.headers.get('content-type') || '';
    if (ct.includes('application/json')) { const json = await flaskRes.json(); return res.status(flaskRes.status).json(json); }
    const text = await flaskRes.text(); return res.status(flaskRes.status).send(text);
  } catch (e) { console.error('dashboard get proxy failed', e); res.status(500).json({ error: e.message }); }
});

// Full PDF export by re-running the query and rendering rows
app.post('/api/download-pdf-query', async (req, res) => {
  try {
    const payloadStr = req.body?.payload ? req.body.payload : JSON.stringify(req.body || {});
    const body = typeof payloadStr === 'string' ? JSON.parse(payloadStr) : payloadStr;
    const { model, prompt, mode } = body || {};
    if (!prompt || !mode || !model) return res.status(400).json({ error: 'Missing prompt/mode/model' });

    let flask_endpoint = '';
    if (mode === 'database') flask_endpoint = `${FLASK_DATABASE_INTENT_URL}/query`;
    else if (mode === 'langchain') flask_endpoint = `${FLASK_DATABASE_LANGCHAIN_URL}/query`;
    else if (mode === 'langchainprompt') flask_endpoint = `${FLASK_DATABASE_LANGCHAIN_PROMPT_ENG_URL}/query`;
    else if (mode === 'restful') flask_endpoint = `${FLASK_RESTFUL_PROMPT_ENG_EMBD_URL}/query`;
    else if (mode === 'embedded') flask_endpoint = `${FLASK_DATABASE_LANGCHAIN_PROMPT_ENG_EMBD_URL}/query`;
    else if (mode === 'llamaindex') flask_endpoint = `${FLASK_DATABASE_LLAMAINDEX_PROMPT_ENG_URL}/query`;
    else if (mode === 'embedded_narrated') flask_endpoint = `${FLASK_DATABASE_LANGCHAIN_PROMPT_ENG_EMBD_NARRATED_URL}/query`;
    else if (mode === 'generic_rag') flask_endpoint = `${FLASK_DATABASE_GENERIC_RAG_URL}/query`;
    else if (mode === 'database1') flask_endpoint = `${FLASK_DATABASE_INTENT_EMBDED_NOMODEL_URL}/query`;
    else return res.status(400).json({ error: 'Invalid mode' });

    const userAgent = 'pdf-export';
    const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
    const flaskRes = await undiciFetch(flask_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': userAgent, 'X-Forwarded-For': clientIp }, body: JSON.stringify(body) });
    if (!flaskRes.ok || !flaskRes.body) return res.status(flaskRes.status).end();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="table.pdf"');

    const reader = flaskRes.body.getReader();
    const decoder = new TextDecoder('utf-8');
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([842, 595]); // landscape A4
    const { width, height } = page.getSize();
    const normalFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const margin = 30;
    let y = height - margin - 20;
    let headers = null;
    let colWidths = [];

    const drawRow = (values, font, size = 8) => {
      const availableWidth = width - 2 * margin;
      if (!colWidths.length) colWidths = values.map(() => availableWidth / values.length);
      let x = margin;
      values.forEach((val, i) => {
        page.drawText(String(val ?? ''), { x, y, size, font });
        x += colWidths[i];
      });
      y -= 12;
      if (y < margin + 20) {
        page = pdfDoc.addPage([842, 595]);
        y = height - margin - 20;
      }
    };

    let done = false;
    while (!done) {
      const { value, done: dr } = await reader.read();
      done = dr;
      if (value) {
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.trim());
        for (const line of lines) {
          try {
            const obj = JSON.parse(line);
            if (!obj || obj._narration || obj._base_sql || obj._column_types || obj._search_columns) continue;
            if (!headers) {
              headers = Object.keys(obj);
              drawRow(headers, boldFont, 9);
            }
            drawRow(headers.map(h => obj[h]), normalFont, 8);
          } catch (e) {}
        }
      }
    }
    const pdfBytes = await pdfDoc.save();
    res.end(Buffer.from(pdfBytes));
  } catch (e) {
    console.error('download-pdf-query failed', e);
    res.status(500).json({ error: e.message });
  }
});

// Full JSON export by re-running the query and streaming to array
app.post('/api/download-json-query', async (req, res) => {
  try {
    const payloadStr = req.body?.payload ? req.body.payload : JSON.stringify(req.body || {});
    const body = typeof payloadStr === 'string' ? JSON.parse(payloadStr) : payloadStr;
    const { model, prompt, mode } = body || {};
    if (!prompt || !mode || !model) return res.status(400).json({ error: 'Missing prompt/mode/model' });

    let flask_endpoint = '';
    if (mode === 'database') flask_endpoint = `${FLASK_DATABASE_INTENT_URL}/query`;
    else if (mode === 'langchain') flask_endpoint = `${FLASK_DATABASE_LANGCHAIN_URL}/query`;
    else if (mode === 'langchainprompt') flask_endpoint = `${FLASK_DATABASE_LANGCHAIN_PROMPT_ENG_URL}/query`;
    else if (mode === 'restful') flask_endpoint = `${FLASK_RESTFUL_PROMPT_ENG_EMBD_URL}/query`;
    else if (mode === 'embedded') flask_endpoint = `${FLASK_DATABASE_LANGCHAIN_PROMPT_ENG_EMBD_URL}/query`;
    else if (mode === 'llamaindex') flask_endpoint = `${FLASK_DATABASE_LLAMAINDEX_PROMPT_ENG_URL}/query`;
    else if (mode === 'embedded_narrated') flask_endpoint = `${FLASK_DATABASE_LANGCHAIN_PROMPT_ENG_EMBD_NARRATED_URL}/query`;
    else if (mode === 'generic_rag') flask_endpoint = `${FLASK_DATABASE_GENERIC_RAG_URL}/query`;
    else if (mode === 'database1') flask_endpoint = `${FLASK_DATABASE_INTENT_EMBDED_NOMODEL_URL}/query`;
    else return res.status(400).json({ error: 'Invalid mode' });

    const userAgent = 'json-export';
    const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
    const flaskRes = await undiciFetch(flask_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': userAgent, 'X-Forwarded-For': clientIp }, body: JSON.stringify(body) });
    if (!flaskRes.ok || !flaskRes.body) return res.status(flaskRes.status).end();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="table.json"');

    const reader = flaskRes.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let first = true;
    res.write('[');
    let done = false;
    while (!done) {
      const { value, done: dr } = await reader.read();
      done = dr;
      if (value) {
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.trim());
        for (const line of lines) {
          try {
            const obj = JSON.parse(line);
            if (obj._narration || obj._base_sql || obj._column_types || obj._search_columns) continue;
            const seg = JSON.stringify(obj);
            if (!first) res.write(',');
            res.write(seg);
            first = false;
          } catch (e) {}
        }
      }
    }
    res.write(']');
    res.end();
  } catch (e) {
    console.error('download-json-query failed', e);
    res.status(500).json({ error: e.message });
  }
});

// Minimal server-side table query (scaffold)
// Accepts: { model, mode, prompt, page, pageSize, sort?, search?, filters? }
// Currently: streams full result from Flask, applies simple sort + pagination in Node, returns JSON
app.post('/api/table/query', async (req, res) => {
  try {
    const { model, prompt, mode } = req.body || {};
    let { page, pageSize, sort, search, all } = req.body || {};
    if (!prompt || !mode || !model) return res.status(400).json({ error: 'Missing prompt/mode/model' });
    page = Math.max(1, Number(page) || 1);
    pageSize = Math.max(1, Math.min(1000, Number(pageSize) || 50));

    // Build cache key for pre-pagination storage (post-search/filter/sort, pre-slice)
    const keySig = {
      model,
      mode,
      prompt,
      search,
      columnFilters: req.body?.columnFilters,
      valueFilters: req.body?.valueFilters,
      advancedFilters: req.body?.advancedFilters,
      sort,
    };
    const cacheKey = 'table:query:' + stableStringify(keySig);

    let flask_endpoint = '';
    if (mode === 'database') flask_endpoint = `${FLASK_DATABASE_INTENT_URL}/query`;
    else if (mode === 'langchain') flask_endpoint = `${FLASK_DATABASE_LANGCHAIN_URL}/query`;
    else if (mode === 'langchainprompt') flask_endpoint = `${FLASK_DATABASE_LANGCHAIN_PROMPT_ENG_URL}/query`;
    else if (mode === 'restful') flask_endpoint = `${FLASK_RESTFUL_PROMPT_ENG_EMBD_URL}/query`;
    else if (mode === 'embedded') flask_endpoint = `${FLASK_DATABASE_LANGCHAIN_PROMPT_ENG_EMBD_URL}/query`;
    else if (mode === 'llamaindex') flask_endpoint = `${FLASK_DATABASE_LLAMAINDEX_PROMPT_ENG_URL}/query`;
    else if (mode === 'embedded_narrated') flask_endpoint = `${FLASK_DATABASE_LANGCHAIN_PROMPT_ENG_EMBD_NARRATED_URL}/query`;
    else if (mode === 'generic_rag') flask_endpoint = `${FLASK_DATABASE_GENERIC_RAG_URL}/query`;
    else if (mode === 'database1') flask_endpoint = `${FLASK_DATABASE_INTENT_EMBDED_NOMODEL_URL}/query`;
    else return res.status(400).json({ error: 'Invalid mode' });

    // Respect client preference: tableOpsMode ('flask'|'node')
    const tableOpsMode = (req.body && req.body.tableOpsMode) || 'flask';
    if (tableOpsMode === 'flask') {
      try {
        const resp = await undiciFetch(`${FLASK_TABLE_OPS_URL}/table/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req.body),
        });
        if (resp.ok) {
          res.setHeader('Content-Type', 'application/json');
          const text = await resp.text();
          return res.end(text);
        }
      } catch {}
    }

    // Otherwise, compute in Node with pre-pagination cache
    // Try cache first
    let effective = getCache(cacheKey);
    const fromCache = !!effective;
    if (!effective) {
      const userAgent = 'table-query';
      const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
      const flaskRes = await undiciFetch(flask_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': userAgent, 'X-Forwarded-For': clientIp },
        body: JSON.stringify(req.body),
      });
      if (!flaskRes.ok || !flaskRes.body) {
        const err = await flaskRes.text();
        return res.status(flaskRes.status).json({ error: err || 'Flask error' });
      }

      const reader = flaskRes.body.getReader();
      const decoder = new TextDecoder('utf-8');
      const rows = [];
      const MAX_ROWS = 200000; // safety cap for scaffold
      let done = false;
      while (!done && rows.length < MAX_ROWS) {
        const { value, done: dr } = await reader.read();
        done = dr;
        if (value) {
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(l => l.trim());
          for (const line of lines) {
            try {
              const obj = JSON.parse(line);
              if (!obj || obj._narration || obj._base_sql || obj._column_types || obj._search_columns) { } else { rows.push(obj); }
              if (rows.length >= MAX_ROWS) break;
            } catch {}
          }
        }
      }

      // Basic global search support (substring)
      const cleaned = rows.filter(r => { if (!r || typeof r !== 'object') return true; const vals = Object.values(r); if (!vals.length) return true; for (const v of vals) { if (v == null) continue; if (typeof v === 'string' && v.trim() === '') continue; return true; } return false; });
      effective = cleaned;
      if (search && typeof search.query === 'string' && search.query.length) {
        const q = String(search.query);
        const cs = !!search.caseSensitive;
        const re = search.mode === 'regex' ? (() => { try { return new RegExp(q, cs ? '' : 'i'); } catch { return null; } })() : null;
        const qn = cs ? q : q.toLowerCase();
        effective = rows.filter(r => {
          const cols = Object.keys(r);
          for (const c of cols) {
            const v = r[c];
            const s = v == null ? '' : String(v);
            if (re) { if (re.test(s)) return true; }
            else {
              const ss = cs ? s : s.toLowerCase();
              if (search.mode === 'exact') { if (ss === qn) return true; }
              else { if (ss.includes(qn)) return true; }
            }
          }
          return false;
        });
      }

      // Apply column/value/advanced filters
      const { columnFilters, valueFilters, advancedFilters } = req.body || {};
      effective = applyContextFilters(effective, { columnFilters, valueFilters, advancedFilters });

      // Basic sort: [{key, direction}]
      if (Array.isArray(sort) && sort.length) {
        effective = [...effective].sort((a, b) => {
          for (const { key, direction } of sort) {
            const av = a?.[key];
            const bv = b?.[key];
            if (av === bv) continue;
            let cmp = 0;
            if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
            else cmp = String(av ?? '').localeCompare(String(bv ?? ''));
            if (cmp !== 0) return direction === 'desc' ? -cmp : cmp;
          }
          return 0;
        });
      }

      // Cache pre-pagination result for subsequent page requests
      setCache(cacheKey, effective);
    }

    const total = effective.length;
    if (all === true) {
      // Return full, pre-pagination rows (use with care). Cache already applied above.
      return res.json({ rows: effective, total, page: 1, pageSize: total, cached: fromCache, all: true });
    }
    const start = (page - 1) * pageSize;
    const rowsPage = effective.slice(start, start + pageSize);
    res.json({ rows: rowsPage, total, page, pageSize, cached: fromCache });
  } catch (e) {
    console.error('table/query failed', e);
    res.status(500).json({ error: e.message });
  }
});

// Minimal distinct values endpoint (scaffold)
// Accepts: { model, mode, prompt, column, limit=50, searchTerm? }
app.post('/api/table/distinct', async (req, res) => {
  try {
    const { model, prompt, mode, column } = req.body || {};
    let { limit, searchTerm } = req.body || {};
    if (!prompt || !mode || !model || !column) return res.status(400).json({ error: 'Missing prompt/mode/model/column' });
    if (limit === 'full' || (typeof limit === 'number' && limit < 0)) {
      limit = 5000; // reasonable upper bound for 'full' distincts
    } else {
      limit = Math.max(1, Math.min(500, Number(limit) || 50));
    }

    // Cache key based on query signature + column + filters + searchTerm + limit
    const sig = stableStringify({ model, mode, prompt, column, limit, searchTerm, columnFilters: req.body?.columnFilters, valueFilters: req.body?.valueFilters, advancedFilters: req.body?.advancedFilters });
    const cached = getDistinctCache(sig);
    if (cached) return res.json(cached);

    let flask_endpoint = '';
    if (mode === 'database') flask_endpoint = `${FLASK_DATABASE_INTENT_URL}/query`;
    else if (mode === 'langchain') flask_endpoint = `${FLASK_DATABASE_LANGCHAIN_URL}/query`;
    else if (mode === 'langchainprompt') flask_endpoint = `${FLASK_DATABASE_LANGCHAIN_PROMPT_ENG_URL}/query`;
    else if (mode === 'restful') flask_endpoint = `${FLASK_RESTFUL_PROMPT_ENG_EMBD_URL}/query`;
    else if (mode === 'embedded') flask_endpoint = `${FLASK_DATABASE_LANGCHAIN_PROMPT_ENG_EMBD_URL}/query`;
    else if (mode === 'llamaindex') flask_endpoint = `${FLASK_DATABASE_LLAMAINDEX_PROMPT_ENG_URL}/query`;
    else if (mode === 'embedded_narrated') flask_endpoint = `${FLASK_DATABASE_LANGCHAIN_PROMPT_ENG_EMBD_NARRATED_URL}/query`;
    else if (mode === 'generic_rag') flask_endpoint = `${FLASK_DATABASE_GENERIC_RAG_URL}/query`;
    else if (mode === 'database1') flask_endpoint = `${FLASK_DATABASE_INTENT_EMBDED_NOMODEL_URL}/query`;
    else return res.status(400).json({ error: 'Invalid mode' });

    // Prefer dedicated Flask table-ops if requested
    const tableOpsModeD = (req.body && req.body.tableOpsMode) || 'flask';
    if (tableOpsModeD === 'flask') {
      try {
        const resp = await undiciFetch(`${FLASK_TABLE_OPS_URL}/table/distinct`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req.body)
        });
        if (resp.ok) {
          res.setHeader('Content-Type', 'application/json');
          const text = await resp.text();
          return res.end(text);
        }
      } catch {}
    }

    const controller = new AbortController();
    const flaskRes = await undiciFetch(flask_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'table-distinct' },
      body: JSON.stringify(req.body),
      signal: controller.signal,
    });
    if (!flaskRes.ok || !flaskRes.body) return res.status(flaskRes.status).end();

    const reader = flaskRes.body.getReader();
    const decoder = new TextDecoder('utf-8');
    const set = new Set();
    const term = typeof searchTerm === 'string' && searchTerm.length ? String(searchTerm).toLowerCase() : null;
    const { columnFilters, valueFilters, advancedFilters } = req.body || {};
    let done = false;
    while (!done && set.size < limit) {
      const { value, done: dr } = await reader.read();
      done = dr;
      if (value) {
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.trim());
        for (const line of lines) {
          try {
            const obj = JSON.parse(line);
            if (obj && !obj._narration) {
              // Apply context filters for correctness
              const pass = applyContextFilters([obj], { columnFilters, valueFilters, advancedFilters });
              if (pass.length) {
                const raw = obj[column];
                const s = raw == null ? '' : String(raw);
                if (!term || s.toLowerCase().includes(term)) set.add(s);
                if (set.size >= limit) break;
              }
            }
          } catch {}
        }
      }
    }
    try { controller.abort(); } catch {}
    const payload = { distinct: Array.from(set).sort((a, b) => String(a).localeCompare(String(b))), column, count: set.size };
    setDistinctCache(sig, payload);
    res.json(payload);
  } catch (e) {
    console.error('table/distinct failed', e);
    res.status(500).json({ error: e.message });
  }
});

// Health check endpoint that proxies Flask health
app.get('/health', async (req, res) => {
  try {
    const flaskHealth = await fetch(`${FLASK_API_URL}/health`);
    if (!flaskHealth.ok) {
      return res.status(500).json({ status: 'Flask API unhealthy' });
    }
    const healthJson = await flaskHealth.json();
    res.json({ status: 'ok', flask: healthJson });
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(`Node.js server listening on port ${PORT}`);
// });


// Export app for testing; avoid listening in test env
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, hostname, () => {
    console.log(`AI-Nova Server Running at http://${hostname}:${port}/`);
  });
}

export default app;
