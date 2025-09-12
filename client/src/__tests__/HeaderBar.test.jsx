import { render, screen, fireEvent } from '@testing-library/react';
import HeaderBar from '../components/HeaderBar.jsx';

function noop() {}

test('renders HeaderBar and opens training manager', () => {
  const openSpy = vi.spyOn(window, 'open');
  render(
    <HeaderBar
      isPanelOpen={false}
      onTogglePanel={noop}
      model="None"
      onModelChange={noop}
      interactionMode="direct"
      onInteractionModeChange={noop}
      loading={false}
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
      heapUsedMB={123}
      rowsFetchedTotal={456}
      avgResponseTime={1.23}
      onFreeContent={noop}
    />
  );

  const btn = screen.getByRole('button', { name: /open training manager/i });
  fireEvent.click(btn);
  expect(openSpy).toHaveBeenCalled();
  openSpy.mockRestore();
});

