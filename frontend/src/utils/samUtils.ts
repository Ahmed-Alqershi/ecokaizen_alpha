import { SAM } from './types';
import * as ExcelJS from 'exceljs';
import Papa from 'papaparse';

export const parseSamFromCsv = (csvContent: string): SAM | null => {
  try {
    const result = Papa.parse(csvContent, { header: true });
    if (result.errors.length > 0) {
      console.error('CSV parsing errors:', result.errors);
      return null;
    }

    const data = result.data as Record<string, string>[];
    const headers = Object.keys(data[0]).filter(h => h !== '');
    
    // Extract SAM entries, goods, factors, households
    const entries = [...headers];
    
    // Simplified for MVP - we'll refine this with backend coordination
    const goods = entries.filter(e => e.startsWith('SECTOR') || ['BRD', 'MLK'].includes(e));
    const factors = entries.filter(e => e.startsWith('FACTOR') || ['CAP', 'LAB'].includes(e));
    const households = entries.filter(e => e.startsWith('HH') || ['HOH'].includes(e));
    
    // Convert data to numeric matrix
    const numericData = data.map(row => {
      return headers.map(header => parseFloat(row[header] || '0'));
    });
    
    return {
      entries,
      goods,
      factors,
      households,
      data: numericData
    };
  } catch (error) {
    console.error('Error parsing CSV:', error);
    return null;
  }
};

export const parseSamFromExcel = async (file: File): Promise<SAM | null> => {
  try {
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = await file.arrayBuffer();
    await workbook.xlsx.load(arrayBuffer);
    
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      return null;
    }
    
    // Convert to CSV format
    let csvContent = '';
    worksheet.eachRow((row, rowNumber) => {
      const values = row.values as any[];
      // Start from index 1 since ExcelJS row values are 1-based
      csvContent += values.slice(1).join(',') + '\n';
    });
    
    return parseSamFromCsv(csvContent);
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
  
  // In a full implementation, we would check row/column sums
  // For MVP, we'll do a simplified check
  
  return { valid: true };
};