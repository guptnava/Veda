import { render, screen } from '@testing-library/react';
import LeftPanel from '../components/LeftPanel.jsx';

test('renders LeftPanel with settings header when open', () => {
  render(
    <LeftPanel
      isPanelOpen={true}
      temperature={0.7}
      setTemperature={() => {}}
      topK={10}
      setTopK={() => {}}
      topP={0.9}
      setTopP={() => {}}
      cosineSimilarityThreshold={0.58}
      setCosineSimilarityThreshold={() => {}}
      tableButtonPermissions={{}}
      setTableButtonPermissions={() => {}}
      commandHistory={[]}
      onHistoryClick={() => {}}
      onUpdateHistory={() => {}}
    />
  );

  expect(screen.getByText(/settings/i)).toBeInTheDocument();
});

