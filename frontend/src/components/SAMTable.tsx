import { useState, useEffect, useCallback, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { SAM } from '../utils/types';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';

// Register all of the community modules
ModuleRegistry.registerModules([ AllCommunityModule ]);

interface SAMTableProps {
  sam: SAM;
  onChange: (updatedSam: SAM) => void;
  readOnly?: boolean;
}

const SAMTable = ({ sam, onChange, readOnly = false }: SAMTableProps) => {
  const [rowData, setRowData] = useState<any[]>([]);
  const [gridApi, setGridApi] = useState<any>(null);
  const [focusedCell, setFocusedCell] = useState<{row: number, col: string} | null>(null);

  // Create column definitions based on SAM entries
  const columnDefs = useMemo(() => {
    if (!sam || !sam.entries || sam.entries.length === 0) {
      return [];
    }

    const cols = sam.entries.map((entry, index) => ({
      headerName: entry,
      field: entry,
      editable: !readOnly,
      valueFormatter: (params: any) => {
        if (params.value === null || params.value === undefined) {
          return '0.00';
        }
        return parseFloat(params.value).toFixed(2);
      },
      valueParser: (params: any) => {
        const parsed = parseFloat(params.newValue);
        return isNaN(parsed) ? 0 : parsed;
      },
      cellStyle: (params: any) => {
        if (!params || !params.node) return { backgroundColor: '#f0fdf4', border: 'none', fontWeight: 'normal' };
        const rowIndex = params.node.rowIndex;
        const colField = params.colDef.field;

        // Check if this cell is currently focused
        const isFocused = focusedCell && focusedCell.row === rowIndex && focusedCell.col === colField;

        // Focused cell styling with prominent border and background
        if (isFocused) {
          return {
            backgroundColor: '#eff6ff',
            border: '2px solid #3b82f6',
            boxShadow: '0 0 0 1px #3b82f6',
            fontWeight: '600',
            outline: 'none'
          };
        }

        // Highlight diagonal cells (account balances)
        if (rowIndex === index) {
          return {
            backgroundColor: '#f1f5f9',
            border: '1px solid #cbd5e1',
            fontWeight: '500'
          };
        }

        // Light green background for all other cells
        return { backgroundColor: '#f0fdf4', border: 'none', fontWeight: 'normal' };
      },
    }));

    return [
      {
        headerName: 'Account',
        field: 'entryName',
        editable: false,
        width: 140,
        pinned: 'left' as const,
        cellStyle: {
          fontWeight: '600',
          backgroundColor: '#f8fafc',
          borderRight: '2px solid #e2e8f0',
          color: '#1e293b',
        },
        headerClass: 'sam-header-left',
        cellClass: 'sam-label-cell',
      },
      ...cols,
    ];
  }, [sam.entries, readOnly, focusedCell]);

  useEffect(() => {
    if (sam && sam.data) {
      const newRowData = sam.data.map((row, rowIndex) => {
        const rowObject: { [key: string]: any } = { entryName: sam.entries[rowIndex] };
        sam.entries.forEach((colName, colIndex) => {
          rowObject[colName] = row[colIndex];
        });
        return rowObject;
      });
      setRowData(newRowData);
    } else {
      setRowData([]);
    }
  }, [sam]);

  const onCellValueChanged = useCallback((event: any) => {
    const updatedMatrix = rowData.map((row) => ({ ...row })); // Deep copy
    const rowIndex = event.node.rowIndex;
    const colField = event.colDef.field;
    const newValue = event.newValue;

    if (rowIndex !== undefined && colField) {
      const updatedRow = { ...updatedMatrix[rowIndex], [colField]: newValue };
      updatedMatrix[rowIndex] = updatedRow;

      // Convert back to SAM format
      const newSamData = updatedMatrix.map((rowObj) =>
        sam.entries.map((entry) => rowObj[entry])
      );

      const updatedSam: SAM = {
        ...sam,
        data: newSamData,
      };
      onChange(updatedSam);
    }
  }, [rowData, sam, onChange]);

  const onGridReady = useCallback((params: any) => {
    setGridApi(params.api);
    params.api.sizeColumnsToFit();
  }, []);

  const onGridSizeChanged = useCallback((params: any) => {
    params.api.sizeColumnsToFit();
  }, []);

  // Handle cell focus events
  const onCellFocused = useCallback((event: any) => {
    if (event.rowIndex !== null && event.column && event.column.colId !== 'entryName') {
      setFocusedCell({
        row: event.rowIndex,
        col: event.column.colId
      });
    } else {
      setFocusedCell(null);
    }
  }, []);

  // Handle cell click events (also sets focus)
  const onCellClicked = useCallback((event: any) => {
    if (event.rowIndex !== null && event.column && event.column.colId !== 'entryName') {
      setFocusedCell({
        row: event.rowIndex,
        col: event.column.colId
      });
    }
  }, []);

  return (
    <div className="w-full">
      <div className="ag-theme-alpine sam-grid-container">
        <AgGridReact
          className="w-full h-full"
          key={`sam-grid-${sam.entries.length}`}
          columnDefs={columnDefs}
          rowData={rowData}
          onCellValueChanged={onCellValueChanged}
          onCellFocused={onCellFocused}
          onCellClicked={onCellClicked}
          suppressMovableColumns={true}
          onGridReady={onGridReady}
          onGridSizeChanged={onGridSizeChanged}
          defaultColDef={{
            resizable: true,
            sortable: false,
            editable: !readOnly,
            minWidth: 110,
            maxWidth: 150
          }}
          domLayout="autoHeight"
          rowHeight={45}
          theme="legacy"
          suppressRowClickSelection={true}
          suppressCellFocus={false}
          enableCellTextSelection={true}
        />
      </div>

    </div>
  );
};

export default SAMTable;