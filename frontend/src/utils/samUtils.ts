import { SAM } from './types';
import * as ExcelJS from 'exceljs';
import Papa from 'papaparse';

export interface ParsedSam {
  columnNames: string[];
  rowNames: string[];
  data: number[][];
}

export const parseSamFromCsv = (csvContent: string): ParsedSam | null => {
  try {
    const result = Papa.parse<string[]>(csvContent.trim());
    if (result.errors.length > 0) {
      console.error('CSV parsing errors:', result.errors);
      return null;
    }

    const rows = result.data as string[][];
    if (!rows || rows.length === 0) return null;

    const header = rows[0];
    const columnNames = header.slice(1).map(h => String(h).trim());

    const rowNames: string[] = [];
    const numericData: number[][] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      rowNames.push(String(row[0]).trim());
      const values: number[] = [];
      for (let j = 1; j <= columnNames.length; j++) {
        const val = row[j];
        const num = parseFloat(val ?? '0');
        values.push(isNaN(num) ? 0 : num);
      }
      numericData.push(values);
    }

    return { columnNames, rowNames, data: numericData };
  } catch (error) {
    console.error('Error parsing CSV:', error);
    return null;
  }
};

export const parseSamFromExcel = async (file: File): Promise<ParsedSam | null> => {
  try {
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = await file.arrayBuffer();
    await workbook.xlsx.load(arrayBuffer);
    
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      console.error('No worksheet found in Excel file');
      return null;
    }
    
    // Parse Excel data directly instead of converting to CSV
    const columnNames: string[] = [];
    const rowNames: string[] = [];
    const numericData: number[][] = [];
    
    let headerRow: any[] = [];
    let isFirstRow = true;
    
    worksheet.eachRow((row, rowNumber) => {
      const values = row.values as any[];
      
      // ExcelJS row.values is 1-based, so we need to slice from index 1
      const rowData = values.slice(1);
      
      if (isFirstRow) {
        // First row contains headers
        headerRow = rowData;
        // Column names are everything except the first cell (which should be empty or row label)
        for (let i = 1; i < rowData.length; i++) {
          const colName = rowData[i];
          columnNames.push(colName != null ? String(colName).trim() : '');
        }
        isFirstRow = false;
      } else {
        // Data rows
        if (rowData.length === 0) return; // Skip empty rows
        
        // First cell is the row name
        const rowName = rowData[0];
        rowNames.push(rowName != null ? String(rowName).trim() : '');
        
        // Rest are numeric values
        const values: number[] = [];
        for (let i = 1; i <= columnNames.length; i++) {
          const val = rowData[i];
          let num: number;
          
          if (val == null || val === '') {
            num = 0;
          } else {
            num = parseFloat(String(val));
            if (isNaN(num)) {
              num = 0;
            }
          }
          values.push(num);
        }
        numericData.push(values);
      }
    });
    
    console.log('Excel parsing result:', {
      columnNames,
      rowNames,
      dataRows: numericData.length,
      dataCols: numericData.length > 0 ? numericData[0].length : 0
    });
    
    // Validate that we have data
    if (columnNames.length === 0 || rowNames.length === 0 || numericData.length === 0) {
      console.error('Excel parsing failed: insufficient data extracted', {
        columnNamesCount: columnNames.length,
        rowNamesCount: rowNames.length,
        dataRowsCount: numericData.length
      });
      return null;
    }
    
    // Check that dimensions match
    if (rowNames.length !== numericData.length) {
      console.error('Excel parsing failed: row names count does not match data rows count', {
        rowNamesCount: rowNames.length,
        dataRowsCount: numericData.length
      });
      return null;
    }
    
    // Check that each data row has the right number of columns
    for (let i = 0; i < numericData.length; i++) {
      if (numericData[i].length !== columnNames.length) {
        console.error(`Excel parsing failed: row ${i} has ${numericData[i].length} values but expected ${columnNames.length}`, {
          rowName: rowNames[i],
          rowData: numericData[i],
          expectedColumns: columnNames.length
        });
        return null;
      }
    }
    
    return { columnNames, rowNames, data: numericData };
  } catch (error) {
    console.error('Error parsing Excel:', error);
    return null;
  }
};

export const generateDefaultSam = (): SAM => {
  // The default SAM is a 5x5 matrix with bread, milk, capital, labor, and household
  const entries = ['BRD', 'MLK', 'CAP', 'LAB', 'HOH'];
  const goods = ['BRD', 'MLK'];
  const factors = ['CAP', 'LAB'];
  const households = ['HOH'];

  // Create a balanced SAM
  const data = [
    [0, 0, 0, 0, 15],   // BRD row
    [0, 0, 0, 0, 35],   // MLK row
    [5, 20, 0, 0, 0],   // CAP row
    [10, 15, 0, 0, 0],  // LAB row
    [0, 0, 25, 25, 0]   // HOH row
  ];

  console.log('Generated default SAM:', { entries, goods, factors, households, data });

  return {
    entries,
    goods,
    factors,
    households,
    data
  };
};

export const generateEmptySam = (
  sectorCount: number = 2,
  factorCount: number = 2,
  householdCount: number = 1,
  sectorNames?: string[],
  factorNames?: string[],
  householdNames?: string[]
): SAM => {
  // Ensure we have positive values for dimensions
  sectorCount = Math.max(1, sectorCount);
  factorCount = Math.max(1, factorCount);
  householdCount = Math.max(1, householdCount);

  // Generate entry names based on specified dimensions
  const goods = sectorNames || Array.from({ length: sectorCount }, (_, i) => `SECTOR${i+1}`);
  const factors = factorNames || Array.from({ length: factorCount }, (_, i) => `FACTOR${i+1}`);
  const households = householdNames || Array.from({ length: householdCount }, (_, i) => `HH${i+1}`);

  // Check for empty arrays (should never happen with the sanitization above)
  if (goods.length === 0) goods.push('SECTOR1');
  if (factors.length === 0) factors.push('FACTOR1');
  if (households.length === 0) households.push('HH1');

  // Combine all entries
  const entries = [...goods, ...factors, ...households];
  const totalEntries = entries.length;

  // Create empty data matrix (all zeros)
  // Ensure each row is a new array instance to avoid shared references
  const data = [];
  for (let i = 0; i < totalEntries; i++) {
    const row = Array(totalEntries).fill(0);
    data.push(row);
  }

  console.log('Generated empty SAM template:', {
    entries,
    goods,
    factors,
    households,
    dimensions: `${totalEntries}x${totalEntries}`,
    dataRows: data.length,
    dataCols: data.length > 0 ? data[0].length : 0
  });

  return {
    entries,
    goods,
    factors,
    households,
    data
  };
};

export const generateKoreaSam = (): SAM => {
  return generateEmptySam(
    3,
    2,
    2,
    ['AGR', 'IND', 'SVC'],
    ['CAP', 'LAB'],
    ['LABH', 'CAPH']
  );
};

export const generateSaudiSam = (): SAM => {
  return generateEmptySam(
    3,
    2,
    2,
    ['agricult', 'oilgas', 'tourism'],
    ['CAP', 'LAB'],
    ['saudi-hh', 'expat-hh']
  );
};

export const exportSamToCsv = (sam: SAM): string => {
  const headers = sam.entries;
  const rows = sam.data.map((row, index) => {
    const rowData: Record<string, string | number> = { '': sam.entries[index] };
    row.forEach((cell, cellIndex) => {
      rowData[headers[cellIndex]] = cell;
    });
    return rowData;
  });

  return Papa.unparse(rows);
};

export const exportSamToExcel = async (sam: SAM): Promise<Blob> => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('SAM');

  worksheet.addRow(['', ...sam.entries]);
  sam.data.forEach((row, idx) => {
    worksheet.addRow([sam.entries[idx], ...row]);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
};

export const validateSam = (sam: SAM): { valid: boolean; message?: string } => {
  // Check if SAM has required properties
  if (!sam.entries || !sam.data || !sam.goods || !sam.factors || !sam.households) {
    return { 
      valid: false, 
      message: 'SAM is missing required properties' 
    };
  }
  
  // Check matrix dimensions
  if (sam.entries.length !== sam.data.length) {
    return { 
      valid: false, 
      message: `SAM matrix rows (${sam.data.length}) do not match entries count (${sam.entries.length})` 
    };
  }
  
  for (const row of sam.data) {
    if (row.length !== sam.entries.length) {
      return {
        valid: false,
        message: `SAM matrix columns (${row.length}) do not match entries count (${sam.entries.length})`
      };
    }
  }

  // Check that row sums equal column sums (balanced SAM)
  const rowSums = sam.data.map(row => row.reduce((sum, val) => sum + Number(val || 0), 0));
  const colSums = sam.entries.map((_, colIndex) => sam.data.reduce((sum, row) => sum + Number(row[colIndex] || 0), 0));

  for (let i = 0; i < sam.entries.length; i++) {
    if (Math.abs(rowSums[i] - colSums[i]) > 1e-6) {
      return {
        valid: false,
        message: `Row and column totals differ for ${sam.entries[i]}`,
      };
    }
  }

  return { valid: true };
};