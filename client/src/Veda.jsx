import React, { useState, useRef, useEffect, useMemo } from 'react';
import HeaderBar from './components/HeaderBar';
import TableauStyleDashboard from './components/tableau_style_dashboard';
import DashboardViewer from './components/DashboardViewer';
import earthIcon from './icons/earth.jpg';
import LeftPanel from './components/LeftPanel';
import './Veda.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
// removed unused imports
import TableComponent from './components/TableComponent';
import Composer from './components/Composer';


// Define a custom markdown component for rendering code blocks
const components = {
  code({ node, inline, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '');
    return !inline && match ? (
      <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div" {...props}>
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    ) : (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
};


export default function App() {
  // If dashboard mode (?dashboard=1), render the builder page
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('dashboard2') === '1') {
      return (
        <div style={{ background: '#0b0b0b', minHeight: '100vh' }}>
          <TableauStyleDashboard />
        </div>
      );
    }
    if (params.get('dashboard') === '1') {
      return (
        <div style={{ background: '#0b0b0b', minHeight: '100vh' }}>
          <TableauStyleDashboard />
        </div>
      );
    }
    if (params.get('dashboardView')) {
      return (
        <div style={{ background: '#0b0b0b', minHeight: '100vh' }}>
          <DashboardViewer />
        </div>
      );
    }
  } catch {}
  const cleanStreamText = (s) => {
    try {
      // Normalize newlines, trim trailing spaces, and cap blank lines at 2
      const normalized = String(s).replace(/\r\n?/g, '\n');
      const noTrailingSpaces = normalized.replace(/[ \t]+\n/g, '\n');
      return noTrailingSpaces.replace(/\n{3,}/g, '\n\n');
    } catch {
      return s;
    }
  };
  const os = navigator.platform;
  console.log(`Hello! Welcome from your ${os} device 🤖`);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) {
      return 'Good morning! What can I help you with today?';
    } else if (hour < 18) {
      return 'Good afternoon! How can I assist you?';
    } else {
      return 'Good evening! How can I help?';
    }
  };

  const [messages, setMessages] = useState([
    {
      id: 0,
      role: 'system',
      content: getGreeting(),
    },
  ]);
  const [model, setModel] = useState('llama3.2:1b');
  const [interactionMode, setInteractionMode] = useState('direct');
  const inputRef = useRef(null); // Use a ref for the input element
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const messagesEndRef = useRef(null);
  const abortRef = useRef(null);

  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [temperature, setTemperature] = useState(0.7);
  const [topK, setTopK] = useState(50);
  const [topP, setTopP] = useState(0.9);
  const [cosineSimilarityThreshold, setCosineSimilarityThreshold] = useState(0.8);
  const [maxRows, setMaxRows] = useState(10);
  const [commandHistory, setCommandHistory] = useState([]);
  const [lastQueryContext, setLastQueryContext] = useState(null); // {prompt, mode, model}
  // Performance caps (persisted)
  const [perfMaxClientRows, setPerfMaxClientRows] = useState(5000);
  const [perfMaxScan, setPerfMaxScan] = useState(5000);
  const [perfMaxDistinct, setPerfMaxDistinct] = useState(50);
  // Virtualized table settings
  const [virtualizeOnMaximize, setVirtualizeOnMaximize] = useState(true);
  const [virtMaxClientRows, setVirtMaxClientRows] = useState(50000);
  const [virtRowHeight, setVirtRowHeight] = useState(28);
  const [maxVisibleMessages, setMaxVisibleMessages] = useState(5);
  const [updateIntervalMs, setUpdateIntervalMs] = useState(200);
  const [minRowsPerUpdate, setMinRowsPerUpdate] = useState(100);
  const [serverMode, setServerMode] = useState(false);
  const [tableOpsMode, setTableOpsMode] = useState('flask'); // 'node' | 'flask'
  const lastBaseSqlRef = useRef(null);
  const lastColumnTypesRef = useRef(null);
  const [pushDownDb, setPushDownDb] = useState(false);
  const [logEnabled, setLogEnabled] = useState(false);
  const activeAssistantIdRef = useRef(null);
  const [clobPreview, setClobPreview] = useState(8192);
  const [blobPreview, setBlobPreview] = useState(2048);

  // Load persisted performance settings
  useEffect(() => {
    try {
      const rawA = localStorage.getItem('veda.perf.maxClientRows');
      const rawB = localStorage.getItem('veda.perf.maxScan');
      const rawC = localStorage.getItem('veda.perf.maxDistinct');
      if (rawA != null) {
        if (rawA === 'full' || Number(rawA) < 0) setPerfMaxClientRows(-1);
        else {
          const a = Number(rawA);
          if (Number.isFinite(a)) setPerfMaxClientRows(Math.max(1, a));
        }
      }
      if (rawB != null) {
        if (rawB === 'full' || Number(rawB) < 0) setPerfMaxScan(-1);
        else {
          const b = Number(rawB);
          if (Number.isFinite(b)) setPerfMaxScan(Math.max(1, Math.min(5000, b)));
        }
      }
      if (rawC != null) {
        if (rawC === 'full' || Number(rawC) < 0) setPerfMaxDistinct(-1);
        else {
          const c = Number(rawC);
          if (Number.isFinite(c)) setPerfMaxDistinct(Math.max(1, Math.min(50, c)));
        }
      }
    } catch {}
  }, []);
  // Persist/load serverMode
  useEffect(() => {
    try {
      const s = localStorage.getItem('veda.perf.serverMode');
      if (s != null) setServerMode(s === 'true');
    } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem('veda.perf.serverMode', String(!!serverMode)); } catch {} }, [serverMode]);
  // Load/persist table ops routing + pushdown
  useEffect(() => {
    try {
      const m = localStorage.getItem('veda.perf.tableOpsMode');
      if (m === 'node' || m === 'flask') setTableOpsMode(m);
      const p = localStorage.getItem('veda.perf.pushDownDb');
      if (p != null) setPushDownDb(p === 'true');
      const lg = localStorage.getItem('veda.perf.logEnabled');
      if (lg != null) setLogEnabled(lg === 'true');
    } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem('veda.perf.tableOpsMode', tableOpsMode); } catch {} }, [tableOpsMode]);
  useEffect(() => { try { localStorage.setItem('veda.perf.pushDownDb', String(!!pushDownDb)); } catch {} }, [pushDownDb]);
  useEffect(() => { try { localStorage.setItem('veda.perf.logEnabled', String(!!logEnabled)); } catch {} }, [logEnabled]);
  useEffect(() => { try { localStorage.setItem('veda.perf.maxClientRows', String(perfMaxClientRows)); } catch {} }, [perfMaxClientRows]);
  useEffect(() => { try { localStorage.setItem('veda.perf.maxScan', String(perfMaxScan)); } catch {} }, [perfMaxScan]);
  useEffect(() => { try { localStorage.setItem('veda.perf.maxDistinct', String(perfMaxDistinct)); } catch {} }, [perfMaxDistinct]);
  // Load/persist max visible messages (1..10)
  useEffect(() => {
    try {
      const d = Number(localStorage.getItem('veda.perf.maxVisibleMessages'));
      if (Number.isFinite(d)) setMaxVisibleMessages(Math.max(1, Math.min(10, d)));
    } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem('veda.perf.maxVisibleMessages', String(maxVisibleMessages)); } catch {} }, [maxVisibleMessages]);
  // Load/persist streaming perf knobs
  useEffect(() => {
    try {
      const a = Number(localStorage.getItem('veda.perf.updateIntervalMs'));
      const b = Number(localStorage.getItem('veda.perf.minRowsPerUpdate'));
      if (Number.isFinite(a)) setUpdateIntervalMs(Math.max(50, Math.min(5000, a)));
      if (Number.isFinite(b)) setMinRowsPerUpdate(Math.max(10, Math.min(500, b)));
    } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem('veda.perf.updateIntervalMs', String(updateIntervalMs)); } catch {} }, [updateIntervalMs]);
  useEffect(() => { try { localStorage.setItem('veda.perf.minRowsPerUpdate', String(minRowsPerUpdate)); } catch {} }, [minRowsPerUpdate]);
  // Load/persist LOB preview limits
  useEffect(() => {
    try {
      const a = Number(localStorage.getItem('veda.perf.maxClobPreview'));
      const b = Number(localStorage.getItem('veda.perf.maxBlobPreview'));
      if (Number.isFinite(a)) setClobPreview(Math.max(0, Math.min(100000, a)));
      if (Number.isFinite(b)) setBlobPreview(Math.max(0, Math.min(65536, b)));
    } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem('veda.perf.maxClobPreview', String(clobPreview)); } catch {} }, [clobPreview]);
  useEffect(() => { try { localStorage.setItem('veda.perf.maxBlobPreview', String(blobPreview)); } catch {} }, [blobPreview]);
  const [sendSqlToLlm, setSendSqlToLlm] = useState(false);
  const [tableButtonPermissions, setTableButtonPermissions] = useState({
    searchAndSorting: true,
    columns: true,
    pivot: true,
    derived: true,
    formatting: true,
    filters: true,
    advanced: true,
    headerMenu: true,
    chart: true,
    pagination: true,
    export: true,
  });

  // Persist command history to localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('veda.commandHistory');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setCommandHistory(parsed);
      }
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem('veda.commandHistory', JSON.stringify(commandHistory)); } catch {}
  }, [commandHistory]);
  
  // Removed legacy toggles (filters/graph/downloads) now handled by TableComponent
  
  // New state to hold the in-progress streaming message
  const [currentStreamingMessage, setCurrentStreamingMessage] = useState(null);
  const [rowsFetchedTotal, setRowsFetchedTotal] = useState(0);
  const [loadingMoreId, setLoadingMoreId] = useState(null);
  const refetchFullForMessage = async (msg) => {
    try {
      if (!msg) return;
      if (loadingMoreId === msg.id) return;
      const desiredCap = Math.max(5000, Math.min(200000, Number(virtMaxClientRows) || 50000));
      const already = Array.isArray(msg.tableData) ? msg.tableData.length : 0;
      const totalServer = Number(msg.totalRowCount) || 0;
      if (already >= desiredCap) return;
      if (totalServer > 0 && already >= totalServer) return;
      const prompt = msg.sourcePrompt || lastQueryContext?.prompt;
      const mode = msg.mode || lastQueryContext?.mode || interactionMode;
      const mdl = msg.model || lastQueryContext?.model || model;
      if (!prompt || !mode || !mdl) return;

      setLoadingMoreId(msg.id);
      const res = await fetch('/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: mdl, prompt, mode, stream: true,
          temperature, topK, top_k: topK, topP, top_p: topP,
          cosineSimilarityThreshold, cosine_similarity_threshold: cosineSimilarityThreshold,
          maxRows, maxClobPreview: clobPreview, maxBlobPreview: blobPreview,
          sendSqlToLlm, send_sql_to_llm: sendSqlToLlm,
          logEnabled,
        }),
      });
      if (!res.ok || !res.body) { setLoadingMoreId(null); return; }
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let allData = [];
      let totalRowCount = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            if (json._narration || json._base_sql || json._column_types || json._search_columns) { continue; }
            if (Array.isArray(json)) {
              totalRowCount += json.length;
              const remaining = desiredCap - allData.length;
              if (remaining > 0) Array.prototype.push.apply(allData, json.slice(0, remaining));
            } else if (typeof json === 'object') {
              totalRowCount += 1; if (allData.length < desiredCap) allData.push(json);
            } else {
              totalRowCount += 1; if (allData.length < desiredCap) allData.push({ data: json });
            }
          } catch {}
        }
      }
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, tableData: allData.length ? allData : m.tableData, totalRowCount: totalRowCount || m.totalRowCount } : m));
      if (allData.length) setRowsFetchedTotal(n => n + Math.max(0, allData.length - already));
    } catch {
    } finally {
      setLoadingMoreId(null);
    }
  };
  const [heapUsedMB, setHeapUsedMB] = useState(null);
  const stopStreaming = () => {
    try { abortRef.current?.abort(); } catch {}
    setCurrentStreamingMessage(null);
    setLoading(false);
  };

  useEffect(() => {
    // Set browser tab title and favicon (replace all existing icons)
    try {
      document.title = 'Veda';
      const head = document.head || document.getElementsByTagName('head')[0];
      // Remove any existing icons
      const existing = head.querySelectorAll("link[rel~='icon'], link[rel='shortcut icon'], link[rel='apple-touch-icon']");
      existing.forEach(el => head.removeChild(el));
      // Add standard icon
      const icon = document.createElement('link');
      icon.rel = 'icon';
      icon.type = 'image/jpeg';
      icon.href = earthIcon;
      head.appendChild(icon);
      // Add shortcut icon for broader browser support
      const shortcut = document.createElement('link');
      shortcut.rel = 'shortcut icon';
      shortcut.type = 'image/jpeg';
      shortcut.href = earthIcon;
      head.appendChild(shortcut);
      // Optional: Apple touch icon
      const touch = document.createElement('link');
      touch.rel = 'apple-touch-icon';
      touch.href = earthIcon;
      head.appendChild(touch);
    } catch {}

    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStreamingMessage]);

  const visibleMessages = useMemo(() => {
    const cap = Math.max(1, Math.min(10, maxVisibleMessages || 5));
    if (!Array.isArray(messages) || messages.length <= cap + 1) return messages;
    const first = messages[0] ? [messages[0]] : [];
    const tail = messages.slice(-cap);
    return first.concat(tail);
  }, [messages, maxVisibleMessages]);

  // Poll JS heap usage if available
  useEffect(() => {
    let t;
    const poll = () => {
      try {
        const mem = performance && performance.memory && performance.memory.usedJSHeapSize;
        if (typeof mem === 'number') {
          setHeapUsedMB(Math.round(mem / (1024 * 1024)));
        }
      } catch {}
      t = setTimeout(poll, 5000);
    };
    poll();
    return () => { if (t) clearTimeout(t); };
  }, []);

  const avgResponseTime = useMemo(() => {
    const times = (messages || []).map(m => parseFloat(m.responseTime)).filter(n => Number.isFinite(n));
    if (times.length === 0) return NaN;
    return times.reduce((a, b) => a + b, 0) / times.length;
  }, [messages]);

  // Abort any in-flight request on unmount
  useEffect(() => {
    return () => {
      try { abortRef.current?.abort(); } catch {}
    };
  }, []);

  const jsonToMarkdownTable = useMemo(() => {
    return (jsonArray, limit = 10) => {
      if (!Array.isArray(jsonArray) || jsonArray.length === 0) return '';

      const headers = Object.keys(jsonArray[0]);
      const headerRow = `| ${headers.join(' | ')} |`;
      const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;

      const rows = jsonArray
        .slice(0, limit)
        .map((obj) =>
          headers
            .map((header) => {
              const val = obj[header];
              return typeof val === 'object' ? JSON.stringify(val) : String(val);
            })
            .join(' | ')
        )
        .map((row) => `| ${row} |`)
        .join('\n');

      return [headerRow, separatorRow, rows].join('\n');
    };
  }, []);



  //Main function for interaction and driving the backend
  async function sendMessage() {
    const input = inputRef.current.value.trim();
    if (!input) return;

    // Store an unbounded command history (searchable in LeftPanel)
    setCommandHistory(prev => [...prev, { command: input, model, mode: interactionMode, pinned: false, ts: Date.now() }]);

    const userMessage = { id: messages.length, role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    inputRef.current.value = ''; // Clear the input using the ref
    setLoading(true);
    
    // Initialize assistant streaming: for table/DB modes, insert a single in-progress message with a stable id
    const isDbLike = ['database', 'database1', 'langchainprompt', 'restful', 'embedded', 'embedded_narrated', 'generic_rag'].includes(interactionMode);
    if (isDbLike) {
      const assistantId = Date.now();
      activeAssistantIdRef.current = assistantId;
      const placeholder = { id: assistantId, role: 'assistant', content: '', model, mode: interactionMode, sourcePrompt: userMessage.content, tableData: null };
      setMessages((prev) => [...prev, placeholder]);
    } else {
      // For non-table streaming, use separate transient streaming message for smoother typing animation
      setCurrentStreamingMessage({ id: messages.length + 1, role: 'assistant', content: '', model, mode: interactionMode, sourcePrompt: userMessage.content, tableData: null });
    }
    // Remember last query context for full exports
    if ([ 'database', 'database1', 'langchainprompt', 'restful', 'embedded', 'embedded_narrated', 'generic_rag' ].includes(interactionMode)) {
      setLastQueryContext({ prompt: userMessage.content, mode: interactionMode, model });
      try { window.__vedaLastQueryContext = { prompt: userMessage.content, mode: interactionMode, model }; } catch {}
    }

    let currentResponseContent = '';
    let tableData = [];
    
    const startTime = performance.now();

    try {
      // Abort any previous in-flight request before starting a new one
      try { abortRef.current?.abort(); } catch {}
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: userMessage.content,
          mode: interactionMode,
          stream: ['direct', 'database', 'database1', 'langchain', 'langchainprompt', 'restful', 'embedded', 'embedded_narrated', 'generic_rag'].includes(interactionMode),
          // slider values
          temperature,
          topK,
          top_k: topK,
          topP,
          top_p: topP,
          cosineSimilarityThreshold,
          cosine_similarity_threshold: cosineSimilarityThreshold,
          maxRows,
          // LOB preview sizes for DB backends
          maxClobPreview: clobPreview,
          maxBlobPreview: blobPreview,
          // LLM narration preference
          sendSqlToLlm,
          send_sql_to_llm: sendSqlToLlm,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`❌ Failed to fetch response: ${res.status} ${res.statusText}. Server response: ${errorText}`);
      }
      
      if (!res.body) {
         throw new Error('❌ Failed to fetch response: The response body is empty.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      
      if (['database', 'langchainprompt', 'restful', 'embedded', 'embedded_narrated', 'generic_rag', 'database1'].includes(interactionMode)) {
        let buffer = '';
        let allData = [];
        let narrationText = null;
        // Choose a higher client cap when virtualization is enabled so we can render more rows smoothly
        const MAX_CLIENT_ROWS = (Number(perfMaxClientRows) < 0) ? Number.POSITIVE_INFINITY : Math.max(1, Math.min(5000, Number(perfMaxClientRows) || 5000));
        let totalRowCount = 0; // counts all rows received, beyond client cap
        // Smooth streaming: throttle table updates to reduce flicker (configurable)
        const UPDATE_INTERVAL_MS = Math.max(50, Math.min(5000, updateIntervalMs || 200));
        const MIN_ROWS_PER_UPDATE = Math.max(10, Math.min(500, minRowsPerUpdate || 100));
        let lastFlush = performance.now();
        let rowsSinceFlush = 0;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const json = JSON.parse(line);

              if (json._narration) {
                narrationText = json._narration;
              } else if (json._base_sql || json._column_types || json._search_columns) {
                // Capture base SQL and schema metadata for pushdown
                if (json._base_sql) { lastBaseSqlRef.current = String(json._base_sql); }
                if (json._column_types && typeof json._column_types === 'object') { lastColumnTypesRef.current = json._column_types; }
                // stash on the active message too
                setCurrentStreamingMessage(prev => prev ? { ...prev, baseSql: lastBaseSqlRef.current, columnTypes: lastColumnTypesRef.current, searchColumns: json._search_columns } : prev);
              } else {
                if (Array.isArray(json)) {
                  totalRowCount += json.length;
                  if (allData.length < MAX_CLIENT_ROWS) {
                    const remaining = MAX_CLIENT_ROWS - allData.length;
                    if (remaining > 0) {
                      const slice = json.slice(0, remaining);
                      // mutate in place to keep reference stable
                      Array.prototype.push.apply(allData, slice);
                      rowsSinceFlush += slice.length;
                    }
                  }
                } else if (typeof json === 'object') {
                  totalRowCount += 1;
                  if (allData.length < MAX_CLIENT_ROWS) { allData.push(json); rowsSinceFlush += 1; }
                } else {
                  totalRowCount += 1;
                  if (allData.length < MAX_CLIENT_ROWS) { allData.push({ data: json }); rowsSinceFlush += 1; }
                }
                tableData = allData;
              }

              currentResponseContent = narrationText ? `📝 ${narrationText}` : '';
              if (currentResponseContent) currentResponseContent = cleanStreamText(currentResponseContent);

            } catch (err) {
              console.warn('⚠️ JSON parse error:', err, line);
              currentResponseContent = `⚠️ Error parsing response: ${err.message}`;
              break;
            }
          }
          // Throttle updates to the heavy table props to avoid flicker
          const now = performance.now();
          const shouldFlush = rowsSinceFlush >= MIN_ROWS_PER_UPDATE || (now - lastFlush) >= UPDATE_INTERVAL_MS;
          if (shouldFlush) {
            lastFlush = now;
            rowsSinceFlush = 0;
          }
          // Update the single in-progress assistant message in-place
          const activeId = activeAssistantIdRef.current;
          if (activeId != null) {
            if (shouldFlush) {
              const snapshot = allData.slice(0);
              setMessages(prev => prev.map(m => m.id === activeId ? { ...m, content: cleanStreamText(currentResponseContent), tableData: snapshot, totalRowCount } : m));
            } else {
              // Update content frequently but avoid table re-render
              setMessages(prev => prev.map(m => m.id === activeId ? { ...m, content: cleanStreamText(currentResponseContent) } : m));
            }
          }
        }

        const endTime = performance.now();
        const elapsed = ((endTime - startTime) / 1000).toFixed(2);
        
        // Final flush: update the same message instead of appending a new one
        const finalData = allData.slice(0);
        const activeId = activeAssistantIdRef.current;
        if (activeId != null) {
          setMessages(prev => prev.map(m => m.id === activeId ? { ...m, content: cleanStreamText(currentResponseContent), tableData: finalData.length > 0 ? finalData : null, responseTime: elapsed, totalRowCount, baseSql: lastBaseSqlRef.current, columnTypes: lastColumnTypesRef.current } : m));
          activeAssistantIdRef.current = null;
        }
        if (Array.isArray(tableData) && tableData.length) setRowsFetchedTotal((n) => n + tableData.length);
        setCurrentStreamingMessage(null);
        
      } else {
        while (true) {
          const { value, done: doneReading } = await reader.read();
          if (doneReading) break;
          
          if (value) {
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter((line) => line.trim());

            for (const line of lines) {
              const clean = line.replace(/^data:\s*/, '').trim();
              if (clean === '[DONE]') continue;

              try {
                const data = JSON.parse(clean);
                const token = data.response;

                if (token) {
                  currentResponseContent += token;
                  const cleaned = cleanStreamText(currentResponseContent);
                  setCurrentStreamingMessage(prev => ({ ...prev, content: cleaned }));
                }
              } catch {
              }
            }
          }
        }
        
        const endTime = performance.now();
        const elapsed = ((endTime - startTime) / 1000).toFixed(2);
        
        setMessages(prev => [...prev, {
          ...currentStreamingMessage,
          content: cleanStreamText(currentResponseContent),
          responseTime: elapsed
        }]);
        setCurrentStreamingMessage(null);
      }

    } catch (err) {
      if (err && (err.name === 'AbortError' || String(err).includes('AbortError'))) {
        // Silently handle user-initiated cancellation
        setCurrentStreamingMessage(null);
        return;
      }
      setMessages((prev) => [
        ...prev,
        { id: prev.length, role: 'assistant', content: `⚠️ Error: ${err.message}`, model },
      ]);
      setCurrentStreamingMessage(null);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }


  async function copyToClipboard(text, index) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      stopStreaming();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const handleHistoryClick = (historyItem) => {
    if (inputRef.current) {
        inputRef.current.value = historyItem.command;
    }
    setModel(historyItem.model);
    setInteractionMode(historyItem.mode);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: '#1e1e1e',
      color: '#d4d4d4',
      fontFamily: 'Inter, sans-serif'
    }}>
      
  <HeaderBar
        isPanelOpen={isPanelOpen}
        onTogglePanel={() => setIsPanelOpen(prev => !prev)}
        model={model}
        onModelChange={setModel}
        interactionMode={interactionMode}
        onInteractionModeChange={setInteractionMode}
        loading={loading}
        tableButtonPermissions={tableButtonPermissions}
        setTableButtonPermissions={setTableButtonPermissions}
        sendSqlToLlm={sendSqlToLlm}
        setSendSqlToLlm={setSendSqlToLlm}
        perfMaxClientRows={perfMaxClientRows}
        setPerfMaxClientRows={setPerfMaxClientRows}
        perfMaxScan={perfMaxScan}
        setPerfMaxScan={setPerfMaxScan}
        perfMaxDistinct={perfMaxDistinct}
        setPerfMaxDistinct={setPerfMaxDistinct}
        virtualizeOnMaximize={virtualizeOnMaximize}
        setVirtualizeOnMaximize={setVirtualizeOnMaximize}
        virtMaxClientRows={virtMaxClientRows}
        setVirtMaxClientRows={setVirtMaxClientRows}
        virtRowHeight={virtRowHeight}
        setVirtRowHeight={setVirtRowHeight}
        serverMode={serverMode}
        setServerMode={setServerMode}
        tableOpsMode={tableOpsMode}
        setTableOpsMode={setTableOpsMode}
        pushDownDb={pushDownDb}
        setPushDownDb={setPushDownDb}
        logEnabled={logEnabled}
        setLogEnabled={setLogEnabled}
        heapUsedMB={heapUsedMB}
        rowsFetchedTotal={rowsFetchedTotal}
        avgResponseTime={avgResponseTime}
        updateIntervalMs={updateIntervalMs}
        setUpdateIntervalMs={setUpdateIntervalMs}
        minRowsPerUpdate={minRowsPerUpdate}
        setMinRowsPerUpdate={setMinRowsPerUpdate}
        clobPreview={clobPreview}
        setClobPreview={setClobPreview}
        blobPreview={blobPreview}
        setBlobPreview={setBlobPreview}
        maxVisibleMessages={maxVisibleMessages}
        setMaxVisibleMessages={setMaxVisibleMessages}
        onFreeContent={() => {
          const keep = 1; // keep greeting only
          setMessages(prev => prev.slice(0, keep));
          setCurrentStreamingMessage(null);
          // Optionally reduce fetched rows count since we dropped content; leave as-is to reflect session total
        }}
      />

      <div style={{ flexGrow: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        <LeftPanel
          isPanelOpen={isPanelOpen}
          temperature={temperature}
          setTemperature={setTemperature}
          topK={topK}
          setTopK={setTopK}
          topP={topP}
          setTopP={setTopP}
          cosineSimilarityThreshold={cosineSimilarityThreshold}
          setCosineSimilarityThreshold={setCosineSimilarityThreshold}
          tableButtonPermissions={tableButtonPermissions}
          setTableButtonPermissions={setTableButtonPermissions}
          maxRows={maxRows}
          setMaxRows={setMaxRows}
          commandHistory={commandHistory}
          onHistoryClick={handleHistoryClick}
          onUpdateHistory={(updater) => setCommandHistory(prev => (typeof updater === 'function' ? updater(prev) : updater))}
        />
        <main className="chat-scroll-area" aria-live="polite" aria-relevant="additions" tabIndex={-1}>
          {visibleMessages
            .map((msg, index) => {
              const isUser = msg.role === 'user';
              const isTableMessage = msg.tableData && msg.tableData.length > 0;
              const isGreeting = index === 0 && !isUser; // Added condition to identify the greeting
              return (
                <div
                  key={msg.id ?? index}
                  className={`message ${isUser ? 'user' : 'assistant'} ${isGreeting ? 'greeting' : ''}`}
                  aria-label={isUser ? 'User message' : `Assistant response from model ${msg.model || ''}`}
                >
                  {!isUser && msg.model && msg.content.length > 10 && (
                    <div className="model-label" aria-hidden="true">
                      Model: {msg.model}
                    </div>
                  )}

                  {isTableMessage && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
                      <p style={{ fontSize: '0.9rem', color: '#ccc' }}>
                        Displaying data. You can filter the table or generate a graph below.
                      </p>
                      <TableComponent
                        data={msg.filteredData || msg.tableData}
                        initialPageSize={maxRows}
                        buttonPermissions={tableButtonPermissions}
                        perfOptions={{ maxScan: perfMaxScan, maxDistinct: perfMaxDistinct }}
                        previewOptions={{ maxClob: clobPreview, maxBlob: blobPreview }}
                        virtualizeOnMaximize={virtualizeOnMaximize}
                        virtualRowHeight={virtRowHeight}
                        onMaximize={() => { if (virtualizeOnMaximize) refetchFullForMessage(msg); }}
                        exportContext={{
                          prompt: msg.sourcePrompt || lastQueryContext?.prompt || (typeof window !== 'undefined' && window.__vedaLastQueryContext?.prompt),
                          mode: msg.mode || lastQueryContext?.mode || (typeof window !== 'undefined' && window.__vedaLastQueryContext?.mode),
                          model: msg.model || lastQueryContext?.model || model,
                          baseSql: msg.baseSql || lastBaseSqlRef.current,
                          columnTypes: msg.columnTypes || lastColumnTypesRef.current,
                        }}
                        totalRows={msg.totalRowCount}
                        serverMode={serverMode}
                        tableOpsMode={tableOpsMode}
                        pushDownDb={pushDownDb}
                      />
                      {/* Summary is shown inside TableComponent footer for accuracy */}
                    </div>
                  )}

                  {msg.content && (
                    <ReactMarkdown
                      children={msg.content}
                      remarkPlugins={[remarkGfm]}
                      components={components}
                    />
                  )}

                  {!isUser && !isTableMessage && (
                    <button
                      className={`copy-button ${copiedIndex === index ? 'copied' : ''}`}
                      onClick={() => copyToClipboard(msg.content, index)}
                      aria-label="Copy assistant response to clipboard"
                    >
                      {copiedIndex === index ? 'Copied!' : 'Copy'}
                    </button>
                  )}
                  
                  {!isUser && msg.responseTime && (
                    <div className="response-time">
                      Response time: {msg.responseTime}s
                    </div>
                  )}
                  {/* Removed legacy TableAndGraphOptions (charts/downloads now handled inside TableComponent) */}
                </div>
              );
            })}
          
          {/* Render the streaming message separately for better performance */}
          {currentStreamingMessage && (
            <div
              key="streaming"
              className="message assistant"
              aria-label={`Assistant response from model ${currentStreamingMessage.model || ''}`}
            >
              <div className="model-label" aria-hidden="true">
                Model: {currentStreamingMessage.model}
              </div>
              {currentStreamingMessage.tableData && currentStreamingMessage.tableData.length > 0 && (
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
                    <p style={{ fontSize: '0.9rem', color: '#ccc' }}>
                        Displaying data. You can filter the table or generate a graph below.
                    </p>
                    <TableComponent
                      data={currentStreamingMessage.filteredData || currentStreamingMessage.tableData}
                      initialPageSize={maxRows}
                      buttonPermissions={tableButtonPermissions}
                      perfOptions={{ maxScan: perfMaxScan, maxDistinct: perfMaxDistinct }}
                      previewOptions={{ maxClob: clobPreview, maxBlob: blobPreview }}
                      virtualizeOnMaximize={virtualizeOnMaximize}
                      virtualRowHeight={virtRowHeight}
                      onMaximize={() => { if (virtualizeOnMaximize) refetchFullForMessage(currentStreamingMessage); }}
                      exportContext={{ prompt: currentStreamingMessage.sourcePrompt || lastQueryContext?.prompt, mode: currentStreamingMessage.mode || lastQueryContext?.mode, model: currentStreamingMessage.model || lastQueryContext?.model, baseSql: currentStreamingMessage.baseSql || lastBaseSqlRef.current, columnTypes: currentStreamingMessage.columnTypes || lastColumnTypesRef.current }}
                      totalRows={currentStreamingMessage.totalRowCount}
                      serverMode={serverMode}
                      tableOpsMode={tableOpsMode}
                      pushDownDb={pushDownDb}
                    />
                    {/* Summary is shown inside TableComponent footer for accuracy */}
                </div>
              )}
              <ReactMarkdown
                children={currentStreamingMessage.content}
                remarkPlugins={[remarkGfm]}
                components={components}
              />
            </div>
          )}
          <div ref={messagesEndRef} />
        </main>
      </div>
      <Composer inputRef={inputRef} loading={loading} onSubmit={sendMessage} onKeyDown={handleKeyDown} onStop={stopStreaming} />
    </div>
  );
  // Load/persist virtualization settings
  useEffect(() => {
    try {
      const v = localStorage.getItem('veda.perf.virtualizeOnMaximize');
      const r = Number(localStorage.getItem('veda.perf.virtMaxClientRows'));
      const h = Number(localStorage.getItem('veda.perf.virtRowHeight'));
      if (v != null) setVirtualizeOnMaximize(v === 'true');
      if (Number.isFinite(r)) setVirtMaxClientRows(Math.max(5000, Math.min(200000, r)));
      if (Number.isFinite(h)) setVirtRowHeight(Math.max(18, Math.min(80, h)));
    } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem('veda.perf.virtualizeOnMaximize', String(virtualizeOnMaximize)); } catch {} }, [virtualizeOnMaximize]);
  useEffect(() => { try { localStorage.setItem('veda.perf.virtMaxClientRows', String(virtMaxClientRows)); } catch {} }, [virtMaxClientRows]);
  useEffect(() => { try { localStorage.setItem('veda.perf.virtRowHeight', String(virtRowHeight)); } catch {} }, [virtRowHeight]);
}
