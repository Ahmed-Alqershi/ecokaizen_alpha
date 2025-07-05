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

  // Ensure we always have a valid SAM object
  useEffect(() => {
    console.log('SAMTable initial render', {hasEntries: sam?.entries?.length > 0, hasData: sam?.data?.length > 0});

    // Force grid refresh when component mounts, even if SAM data is empty
    return () => {
      console.log('SAMTable component unmounting');
    };
  }, []);

  // Log SAM data for debugging
  useEffect(() => {
    console.log('SAM data in SAMTable:', {
      entries: sam.entries,
      data: sam.data,
      rowCount: sam.data.length,
      colCount: sam.data.length > 0 ? sam.data[0].length : 0
    });
  }, [sam]);

  // Create column definitions based on SAM entries
  const columnDefs = useMemo(() => {
    console.log('Creating column defs with entries:', sam?.entries || []);

    if (!sam?.entries || sam.entries.length === 0) {
      return [{
        headerName: 'No Data',
        field: 'dummy',
        editable: false
      }];
    }

    return [
      {
        headerName: '',
        field: 'entryName',
        editable: false,
        width: 120,
        pinned: 'left',
        cellStyle: { fontWeight: 'bold' }
      },
      ...sam.entries.map((entry, index) => ({
        headerName: entry,
        field: `cell${index}`,
        editable: !readOnly,
        width: 100,
        cellStyle: (params: any) => {
          if (!params || !params.node) return null;
          const rowIndex = params.node.rowIndex;
          // Highlight diagonal cells (if applicable to this model)
          if (rowIndex === index) {
            return { backgroundColor: '#f9fafb' };
          }
          return null;
        },
        valueParser: (params: any) => {
          if (!params) return 0;
          const value = Number(params.newValue);
          return isNaN(value) ? 0 : value;
        }
      }))
    ];
  }, [sam?.entries, readOnly]);

  // Prepare row data for AgGrid
  useEffect(() => {
    if (!sam || !sam.entries || !sam.data) {
      console.warn('SAM is null or missing required data');
      setRowData([]);
      return;
    }

    if (sam.entries.length === 0) {
      console.warn('SAM entries array is empty');
      setRowData([]);
      return;
    }

    try {
      console.log('Processing SAM data for grid:', {
        entriesLength: sam.entries.length,
        dataLength: sam.data.length
      });

      const rows = sam.entries.map((entry, rowIndex) => {
        const rowData: any = { entryName: entry };

        // Handle case where data array is missing or too short
        if (!sam.data || rowIndex >= sam.data.length) {
          console.warn(`Creating empty row data for ${entry} at row ${rowIndex}`);
          sam.entries.forEach((_, colIndex) => {
            rowData[`cell${colIndex}`] = 0;
          });
          return rowData;
        }

        // Add cell data for this row
        sam.data[rowIndex].forEach((cell, colIndex) => {
          rowData[`cell${colIndex}`] = cell;
        });

        return rowData;
      });

      console.log('Created row data:', rows);
      setRowData(rows);

      // Refresh grid if API is available
      if (gridApi) {
        setTimeout(() => {
          gridApi.sizeColumnsToFit();
          gridApi.refreshCells({ force: true });
        }, 0);
      }
    } catch (error) {
      console.error('Error creating row data:', error);
    }
  }, [sam, gridApi]);

  // Handle cell value changes
  const onCellValueChanged = useCallback(
    (params: any) => {
      if (params.oldValue === params.newValue) return;
      
      const rowIndex = params.node.rowIndex;
      const colField = params.colDef.field;
      
      if (colField === 'entryName') return;
      
      const colIndex = parseInt(colField.replace('cell', ''), 10);
      
      // Create a deep copy of the current SAM data
      const newData = sam.data.map(row => [...row]);
      
      // Update the cell value
      newData[rowIndex][colIndex] = params.newValue;
      
      // Call the onChange handler with updated SAM
      onChange({
        ...sam,
        data: newData
      });

      // Resize columns so the grid stays full width after edits
      if (gridApi) {
        setTimeout(() => {
          gridApi.sizeColumnsToFit();
        }, 0);
      }
    },
    [sam, onChange, gridApi]
  );

  // Store the grid API when ready
  const onGridReady = (params: any) => {
    console.log('Grid API ready');
    setGridApi(params.api);

    // Use setTimeout to give the grid time to render before sizing columns
    setTimeout(() => {
      if (params.api) {
        params.api.sizeColumnsToFit();

        // Force a redraw to ensure columns are displayed properly
        params.api.redrawRows();
      }
    }, 100);
  };

  // Ensure columns fit whenever the grid size changes
  const onGridSizeChanged = useCallback(() => {
    if (gridApi) {
      gridApi.sizeColumnsToFit();
    }
  }, [gridApi]);

  // Keep grid full width whenever data changes
  useEffect(() => {
    if (gridApi) {
      setTimeout(() => {
        gridApi.sizeColumnsToFit();
      }, 0);
    }
  }, [rowData, gridApi]);

  // Log SAM data when it changes
  useEffect(() => {
    console.log('SAM data changed in SAMTable:', {
      entries: sam.entries,
      data: sam.data ? sam.data.length : 0,
      isEmpty: sam.entries.length === 0 || sam.data.length === 0
    });
  }, [sam]);

  return (
    <div className="w-full">
      <div
        className="ag-theme-alpine w-full max-h-[60vh] border border-midgray overflow-auto"
      >
        {!sam || !sam.entries || sam.entries.length === 0 ? (
          <div className="flex flex-col h-full">
            <div className="flex-grow flex items-center justify-center bg-neutral/50 border border-midgray/30 rounded-md">
              <p className="text-darkgray/70">
                Set dimensions above to display an editable SAM matrix.
              </p>
            </div>
          </div>
        ) : (
          /* Key AG-Grid fixes:
             1. Auto height layout to fit content
             2. Added immutableData={false}
             3. Added key based on entries length to force re-render
          */
          <AgGridReact
            className="w-full h-full"
            key={`sam-grid-${sam.entries.length}`}
            columnDefs={columnDefs}
            rowData={rowData}
            onCellValueChanged={onCellValueChanged}
            suppressMovableColumns={true}
            onGridReady={onGridReady}
            onGridSizeChanged={onGridSizeChanged}
            defaultColDef={{
              resizable: true,
              sortable: false,
              editable: !readOnly,
              minWidth: 100
            }}
            domLayout="autoHeight"
            immutableData={false}
            rowHeight={40}
          />
        )}
      </div>

      {/* Debug info */}
      <div className="mt-2 text-xs text-gray-500">
        <p>Entries: {sam.entries ? sam.entries.length : 0} | Data rows: {sam.data ? sam.data.length : 0}</p>
        {sam.entries && sam.entries.length > 0 && (
          <p>SAM entries: {sam.entries.join(', ')}</p>
        )}
      </div>
    </div>
  );
};

export default SAMTable;