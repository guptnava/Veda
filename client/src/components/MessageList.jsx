import React, { useMemo, useRef, useLayoutEffect, useCallback, useEffect, useState } from 'react';
import { VariableSizeList as List } from 'react-window';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import TableComponent from './TableComponent';

const MessageList = ({
  messages,
  currentStreamingMessage,
  mdComponents,
  maxRows,
  copiedIndex,
  copyToClipboard,
  containerHeight = 0,
}) => {
  const listRef = useRef(null);
  const itemHeightsRef = useRef(new Map());
  const lastResetRef = useRef(0);
  const outerRef = useRef(null);
  const streamingRef = useRef(null);

  const items = useMemo(() => [...messages], [messages]);

  const getItemSize = useCallback((index) => {
    const h = itemHeightsRef.current.get(index);
    return Math.max(100, h || 180);
  }, []);

  const Row = ({ index, style }) => {
    const rowRef = useRef(null);
    const msg = items[index];
    const isUser = msg.role === 'user';
    const isTableMessage = msg.tableData && msg.tableData.length > 0;
    const isGreeting = index === 0 && !isUser;

    useLayoutEffect(() => {
      if (!rowRef.current) return;
      const h = rowRef.current.offsetHeight;
      const prev = itemHeightsRef.current.get(index) || 0;
      if (!h || Math.abs(h - prev) < 12) return;
      itemHeightsRef.current.set(index, h);
      // Light reset without jumping
      listRef.current?.resetAfterIndex(index, false);
    }, [index, msg.content, msg.tableData, msg.filteredData, msg.responseTime]);

    return (
      <div style={{ ...(style || {}), width: '100%' }}>
        <div
          ref={rowRef}
          className={`message ${isUser ? 'user' : 'assistant'} ${isGreeting ? 'greeting' : ''}`}
          aria-label={isUser ? 'User message' : `Assistant response from model ${msg.model || ''}`}
        >
          {!isUser && msg.model && (msg.content?.length || 0) > 10 && (
            <div className="model-label" aria-hidden="true">Model: {msg.model}</div>
          )}

          {msg.content && (
            <ReactMarkdown children={msg.content} remarkPlugins={[remarkGfm]} components={mdComponents} />
          )}

          {isTableMessage && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
              <p style={{ fontSize: '0.9rem', color: '#ccc' }}>
                Displaying data. You can filter the table or generate a graph below.
              </p>
              <TableComponent data={msg.filteredData || msg.tableData} initialPageSize={maxRows} />
              <p style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '6px' }}>
                Showing {Math.min(msg.filteredData ? msg.filteredData.length : msg.tableData.length, maxRows)} of {msg.filteredData ? msg.filteredData.length : msg.tableData.length} rows. Use table controls to export or chart.
              </p>
            </div>
          )}

          {!isUser && !isTableMessage && (
            <button
              className={`copy-button ${copiedIndex === index ? 'copied' : ''}`}
              onClick={() => copyToClipboard?.(msg.content, index)}
              aria-label="Copy assistant response to clipboard"
            >
              {copiedIndex === index ? 'Copied!' : 'Copy'}
            </button>
          )}

          {!isUser && msg.responseTime && (
            <div className="response-time">Response time: {msg.responseTime}s</div>
          )}
        </div>
      </div>
    );
  };

  // Lightweight AutoSizer using ResizeObserver (no extra deps)
  const AutoSizer = ({ children }) => {
    const sizerRef = useRef(null);
    const [size, setSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
      const el = sizerRef.current;
      if (!el) return;
      const update = () => {
        const rect = el.getBoundingClientRect();
        setSize({ width: Math.max(0, Math.floor(rect.width)), height: Math.max(0, Math.floor(rect.height)) });
      };
      let ro;
      if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(update);
        ro.observe(el);
      }
      update();
      window.addEventListener('resize', update);
      return () => {
        window.removeEventListener('resize', update);
        if (ro) ro.disconnect();
      };
    }, []);

    return (
      <div ref={sizerRef} style={{ flex: 1, height: '100%' }}>
        {size.height > 0 ? children(size) : null}
      </div>
    );
  };

  // Auto scroll to bottom on new messages (virtualized path)
  useLayoutEffect(() => {
    try {
      listRef.current?.scrollToItem(items.length - 1);
    } catch {}
  }, [items.length]);

  // Keep the streaming item in view when it updates
  useEffect(() => {
    if (!currentStreamingMessage) return;
    streamingRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
  }, [
    currentStreamingMessage,
    currentStreamingMessage?.content,
    currentStreamingMessage?.tableData,
    currentStreamingMessage?.filteredData,
  ]);

  // During streaming, avoid virtualization to prevent flicker
  if (currentStreamingMessage) {
    const Streaming = () => {
      const m = currentStreamingMessage;
      const isTable = m.tableData && m.tableData.length > 0;
      return (
        <div className={`message assistant`} aria-label={`Assistant response from model ${m.model || ''}`}>
          <div className="model-label" aria-hidden="true">Model: {m.model}</div>
          {m.content && (
            <ReactMarkdown children={m.content} remarkPlugins={[remarkGfm]} components={mdComponents} />
          )}
          {isTable && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
              <p style={{ fontSize: '0.9rem', color: '#ccc' }}>
                Displaying data. You can filter the table or generate a graph below.
              </p>
              <TableComponent data={m.filteredData || m.tableData} initialPageSize={maxRows} />
              <p style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '6px' }}>
                Showing {Math.min(m.filteredData ? m.filteredData.length : m.tableData.length, maxRows)} of {m.filteredData ? m.filteredData.length : m.tableData.length} rows. Use table controls to export or chart.
              </p>
            </div>
          )}
        </div>
      );
    };

    return (
      <div ref={outerRef} style={{ width: '100%' }}>
        {items.map((_, idx) => (
          <Row key={idx} index={idx} style={{}} />
        ))}
        <div ref={streamingRef}>
          <Streaming />
        </div>
      </div>
    );
  }

  // Normal virtualized rendering
  return (
    <div ref={outerRef} style={{ flex: 1, minHeight: 200, display: 'flex' }}>
      <AutoSizer>
        {({ width, height }) => (
          height < 100 || items.length <= 5 ? (
            <div style={{ width: '100%' }}>
              {items.map((_, idx) => (
                <Row key={idx} index={idx} style={{}} />
              ))}
            </div>
          ) : (
            <List
              ref={listRef}
              height={height}
              width={width}
              itemCount={items.length}
              itemSize={getItemSize}
              estimatedItemSize={200}
              overscanCount={4}
            >
              {Row}
            </List>
          )
        )}
      </AutoSizer>
    </div>
  );
};

export default MessageList;

