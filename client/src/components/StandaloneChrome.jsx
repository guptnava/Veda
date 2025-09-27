import React, { useState } from 'react';
import HeaderBar from './HeaderBar';
import FooterBar from './FooterBar';

/**
 * Simple chrome wrapper that renders the existing HeaderBar/FooterBar duo
 * for standalone tool pages launched from the footer toolset.
 */
export default function StandaloneChrome({ title, children }) {
  const [tableButtonPermissions, setTableButtonPermissions] = useState({});
  const [sendSqlToLlm, setSendSqlToLlm] = useState(false);
  const [perfMaxClientRows, setPerfMaxClientRows] = useState(5000);
  const [perfMaxScan, setPerfMaxScan] = useState(5000);
  const [perfMaxDistinct, setPerfMaxDistinct] = useState(50);
  const [virtualizeOnMaximize, setVirtualizeOnMaximize] = useState(true);
  const [virtMaxClientRows, setVirtMaxClientRows] = useState(50000);
  const [virtRowHeight, setVirtRowHeight] = useState(28);
  const [serverMode, setServerMode] = useState(false);
  const [tableOpsMode, setTableOpsMode] = useState('flask');
  const [pushDownDb, setPushDownDb] = useState(false);
  const [logEnabled, setLogEnabled] = useState(false);
  const [trainingUrl, setTrainingUrl] = useState(() => {
    try {
      const stored = localStorage.getItem('veda.trainingUrl');
      if (stored) return stored;
    } catch {}
    return 'http://localhost:8501';
  });
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [settingsAnchorRect, setSettingsAnchorRect] = useState(null);
  const [updateIntervalMs, setUpdateIntervalMs] = useState(200);
  const [minRowsPerUpdate, setMinRowsPerUpdate] = useState(100);
  const [clobPreview, setClobPreview] = useState(8192);
  const [blobPreview, setBlobPreview] = useState(2048);
  const [maxVisibleMessages, setMaxVisibleMessages] = useState(5);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [toolsetActive, setToolsetActive] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#0b0b0b' }}>
      <HeaderBar
        title={title}
        isPanelOpen={isPanelOpen}
        onTogglePanel={() => setIsPanelOpen((prev) => !prev)}
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
        trainingUrl={trainingUrl}
        setTrainingUrl={setTrainingUrl}
        settingsMenuOpen={settingsMenuOpen}
        onSettingsMenuChange={setSettingsMenuOpen}
        settingsAnchorRect={settingsAnchorRect}
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
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        {children}
      </div>
      <FooterBar
        heapUsedMB={null}
        rowsFetchedTotal={0}
        avgResponseTime={NaN}
        onFreeContent={() => {}}
        onToggleToolset={() => setToolsetActive((prev) => !prev)}
        toolsetActive={toolsetActive}
      />
    </div>
  );
}
