import { render } from '@testing-library/react';
import React from 'react';

// TableComponent is large; smoke test basic render with minimal props
import TableComponent from '../components/TableComponent.jsx';

test('renders TableComponent without crashing', () => {
  const rows = [
    { id: 1, name: 'Alice', amount: 10 },
    { id: 2, name: 'Bob', amount: 20 },
  ];
  const headers = ['id', 'name', 'amount'];
  render(
    <TableComponent
      data={rows}
      headers={headers}
      isMaximized={false}
      onToggleMaximize={() => {}}
      tablePermissions={{}}
    />
  );
});

