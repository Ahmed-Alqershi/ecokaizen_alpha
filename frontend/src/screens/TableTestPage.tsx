import { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';

// Register all of the community modules
ModuleRegistry.registerModules([ AllCommunityModule ]);

const TableTestPage = () => {
  const entries = ['A', 'B', 'C', 'D', 'E'];

  const columnDefs = useMemo(
    () => [
      { headerName: '', field: 'entryName', editable: false, width: 120 },
      ...entries.map((entry, index) => ({
        headerName: entry,
        field: `cell${index}`,
        editable: true,
        width: 100
      }))
    ],
    []
  );

  const rowData = useMemo(() => {
    return entries.map((entry, rowIndex) => {
      const row: any = { entryName: entry };
      entries.forEach((_, colIndex) => {
        row[`cell${colIndex}`] = `${rowIndex},${colIndex}`;
      });
      return row;
    });
  }, []);

  return (
    <div className="max-w-7xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">AG Grid Test</h1>
      <div className="ag-theme-alpine w-full h-[60vh] border border-midgray">
        <AgGridReact
          /* Ensure grid re-renders correctly by using a key based on the
             number of entries */
          key={`test-grid-${entries.length}`}
          className="w-full h-full"
          columnDefs={columnDefs}
          rowData={rowData}
          defaultColDef={{ resizable: true, sortable: false, editable: true }}
          domLayout="normal"
          immutableData={false}
          rowHeight={40}
        />
      </div>
    </div>
  );
};

export default TableTestPage;
