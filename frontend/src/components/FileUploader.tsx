import { useState, useRef } from 'react';
import { SAM } from '../utils/types';
import { ParsedSam, parseSamFromCsv, parseSamFromExcel } from '../utils/samUtils';

interface FileUploaderProps {
  onSamLoaded: (sam: SAM) => void;
  goods: string[];
  factors: string[];
  households: string[];
}

const FileUploader = ({ onSamLoaded, goods, factors, households }: FileUploaderProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await processFile(files[0]);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    
    const files = e.target.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  };

  const processFile = async (file: File) => {
    try {
      let parsed: ParsedSam | null = null;
      
      if (file.name.endsWith('.csv')) {
        const text = await file.text();
        parsed = parseSamFromCsv(text);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        parsed = await parseSamFromExcel(file);
      } else {
        setError('Unsupported file format. Please upload a CSV or Excel file.');
        return;
      }

      if (parsed) {
        const expectedEntries = [...goods, ...factors, ...households];
        const expectedSize = expectedEntries.length;

        const trimmedHeader = parsed.columnNames.map(n => n.trim());
        const trimmedRows = parsed.rowNames.map(n => n.trim());

        if (
          trimmedHeader.length !== expectedSize ||
          trimmedRows.length !== expectedSize ||
          parsed.data.length !== expectedSize ||
          parsed.data.some(row => row.length !== expectedSize)
        ) {
          setError(`SAM matrix must be ${expectedSize}x${expectedSize}. See below:`);
          return;
        }

        const trimmedExpected = expectedEntries.map(n => n.trim());

        const headerSet = new Set(trimmedHeader);
        const rowSet = new Set(trimmedRows);

        const headerMatches =
          headerSet.size === trimmedExpected.length &&
          trimmedExpected.every(n => headerSet.has(n));
        const rowMatches =
          rowSet.size === trimmedExpected.length &&
          trimmedExpected.every(n => rowSet.has(n));

        if (!headerMatches || !rowMatches) {
          setError(
            `Names must match configured entries: ${trimmedExpected.join(', ')}`
          );
          return;
        }

        // Reorder rows and columns to match expected entry order
        const colIndexMap: Record<string, number> = {};
        trimmedHeader.forEach((name, idx) => {
          colIndexMap[name] = idx;
        });

        const rowIndexMap: Record<string, number> = {};
        trimmedRows.forEach((name, idx) => {
          rowIndexMap[name] = idx;
        });

        const reorderedData = expectedEntries.map(rowName => {
          const originalRow = parsed!.data[rowIndexMap[rowName]];
          return expectedEntries.map(colName => originalRow[colIndexMap[colName]]);
        });

        const sam: SAM = {
          entries: expectedEntries,
          goods,
          factors,
          households,
          data: reorderedData,
        };

        setWarning(null);
        onSamLoaded(sam);
      } else {
        setError('Failed to parse the SAM data. Please check the file format.');
      }
    } catch (err) {
      console.error('Error processing file:', err);
      setError('An error occurred while processing the file. Please try again.');
    }
  };

  const handleClickUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="w-full">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center ${
          isDragging 
            ? 'border-primary bg-primary/5' 
            : 'border-midgray/50 hover:border-primary/50 hover:bg-neutral'
        } transition-colors duration-200 cursor-pointer`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClickUpload}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          accept=".csv,.xlsx,.xls"
          className="hidden"
        />
        
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-midgray"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          
          <p className="mt-1 text-sm text-darkgray/70">
            <span className="font-medium text-primary">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-darkgray/60">CSV or Excel files only</p>
        </div>
      </div>
      
      {error && (
        <div className="mt-2 text-sm text-warning">
          {error}
        </div>
      )}
      {warning && !error && (
        <div className="mt-2 text-sm text-warning">
          {warning}
        </div>
      )}
    </div>
  );
};

export default FileUploader;