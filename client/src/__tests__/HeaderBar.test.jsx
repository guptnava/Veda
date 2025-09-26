import { render, screen, fireEvent } from '@testing-library/react';
import { vi, expect, test } from 'vitest';
import HeaderBar from '../components/HeaderBar.jsx';

function noop() {}

test('renders HeaderBar and opens training manager', () => {
  const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
  render(
    <HeaderBar
      isPanelOpen={false}
      onTogglePanel={noop}
      tableButtonPermissions={{}}
      setTableButtonPermissions={noop}
      sendSqlToLlm={false}
      setSendSqlToLlm={noop}
      perfMaxClientRows={1000}
      setPerfMaxClientRows={noop}
      perfMaxScan={100000}
      setPerfMaxScan={noop}
      perfMaxDistinct={1000}
      setPerfMaxDistinct={noop}
      maxVisibleMessages={50}
      setMaxVisibleMessages={noop}
      clobPreview={2048}
      setClobPreview={noop}
      blobPreview={1024}
      setBlobPreview={noop}
      updateIntervalMs={200}
      setUpdateIntervalMs={noop}
      minRowsPerUpdate={100}
      setMinRowsPerUpdate={noop}
      virtualizeOnMaximize={false}
      setVirtualizeOnMaximize={noop}
      virtMaxClientRows={5000}
      setVirtMaxClientRows={noop}
      virtRowHeight={24}
      setVirtRowHeight={noop}
      serverMode="client"
      setServerMode={noop}
      tableOpsMode="client"
      setTableOpsMode={noop}
      pushDownDb={false}
      setPushDownDb={noop}
      logEnabled={false}
      setLogEnabled={noop}
      trainingUrl="https://training.example.com"
      setTrainingUrl={noop}
      settingsMenuOpen
      onSettingsMenuChange={noop}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: /training manager/i }));
  const btn = screen.getByRole('button', { name: /open training manager/i });
  fireEvent.click(btn);
  expect(openSpy).toHaveBeenCalled();
  openSpy.mockRestore();
});
