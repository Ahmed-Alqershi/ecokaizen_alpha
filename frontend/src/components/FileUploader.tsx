import { useState, useRef, useEffect, useCallback } from 'react';
import { SAM } from '../utils/types';
import { ParsedSam, parseSamFromCsv, parseSamFromExcel } from '../utils/samUtils';

interface FileUploaderProps {
  onSamLoaded: (sam: SAM) => void;
  goods: string[];
  factors: string[];
  households: string[];
  /**
   * When true, use the uploaded SAM's header names to populate sector,
   * factor and household names instead of validating against the
   * provided lists.
   */
  autoPopulateNames?: boolean;
  onNamesLoaded?: (goods: string[], factors: string[], households: string[]) => void;
}

interface UploadedFileInfo {
  name: string;
  size: number;
  type: string;
  uploadedAt: Date;
  dimensions: string;
}

const FileUploader = ({
  onSamLoaded,
  goods,
  factors,
  households,
  autoPopulateNames = false,
  onNamesLoaded,
}: FileUploaderProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<UploadedFileInfo | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Remove uploaded file if it becomes invalid due to dimension changes
  useEffect(() => {
    if (uploadedFile) {
      const expectedSize = goods.length + factors.length + households.length;
      const currentDimensions = `${expectedSize}×${expectedSize}`;
      
      // If the uploaded file's dimensions no longer match expected dimensions, remove it
      if (uploadedFile.dimensions !== currentDimensions) {
        setUploadedFile(null);
        setError(null);
        setWarning(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    }
  }, [goods.length, factors.length, households.length, uploadedFile]);

  // Clear dimension-related errors when dimensions change
  useEffect(() => {
    if (error && error.includes('SAM matrix must be')) {
      setError(null);
    }
  }, [goods.length, factors.length, households.length]);

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

  const processFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setWarning(null);
    
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
        const expectedSize = goods.length + factors.length + households.length;

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

        if (autoPopulateNames && onNamesLoaded) {
          const rowMismatch = trimmedRows.some((n, i) => n !== trimmedHeader[i]);
          if (rowMismatch) {
            setWarning('Row and column names differ; column names used.');
          } else {
            setWarning(null);
          }

          const goodsNames = trimmedHeader.slice(0, goods.length);
          const factorNames = trimmedHeader.slice(goods.length, goods.length + factors.length);
          const householdNames = trimmedHeader.slice(goods.length + factors.length);

          onNamesLoaded(goodsNames, factorNames, householdNames);

          const sam: SAM = {
            entries: trimmedHeader,
            goods: goodsNames,
            factors: factorNames,
            households: householdNames,
            data: parsed.data,
          };

          onSamLoaded(sam);
          
          // Track successful upload
          setUploadedFile({
            name: file.name,
            size: file.size,
            type: file.type || (file.name.endsWith('.csv') ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
            uploadedAt: new Date(),
            dimensions: `${expectedSize}×${expectedSize}`
          });
        } else {
          const expectedEntries = [...goods, ...factors, ...households];

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
          
          // Track successful upload
          setUploadedFile({
            name: file.name,
            size: file.size,
            type: file.type || (file.name.endsWith('.csv') ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
            uploadedAt: new Date(),
            dimensions: `${expectedSize}×${expectedSize}`
          });
        }
      } else {
        setError('Failed to parse the SAM data. Please check the file format.');
      }
    } catch (err) {
      console.error('Error processing file:', err);
      setError('An error occurred while processing the file. Please try again.');
    } finally {
      setIsProcessing(false);
      // Clear the file input value so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [goods, factors, households, autoPopulateNames, onSamLoaded, onNamesLoaded]);

  const handleClickUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setError(null);
    setWarning(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full">
      {uploadedFile ? (
        // Success State - File Uploaded
        <div className="border-2 border-green-200 bg-green-50 rounded-lg p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              {/* Success Icon */}
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              
              {/* File Info */}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-green-800">SAM Matrix Uploaded Successfully</h4>
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-green-700">
                    <span className="font-medium">File:</span> {uploadedFile.name}
                  </p>
                  <p className="text-sm text-green-700">
                    <span className="font-medium">Size:</span> {formatFileSize(uploadedFile.size)}
                  </p>
                  <p className="text-sm text-green-700">
                    <span className="font-medium">Dimensions:</span> {uploadedFile.dimensions}
                  </p>
                  <p className="text-sm text-green-600">
                    <span className="font-medium">Uploaded:</span> {uploadedFile.uploadedAt.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex flex-col space-y-2">
              <button
                onClick={handleClickUpload}
                className="text-xs text-green-700 hover:text-green-800 font-medium"
              >
                Replace File
              </button>
              <button
                onClick={handleRemoveFile}
                className="text-xs text-red-600 hover:text-red-700 font-medium"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        // Upload State
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center ${
            isDragging 
              ? 'border-primary bg-primary/5' 
              : 'border-midgray/50 hover:border-primary/50 hover:bg-neutral'
          } transition-colors duration-200 ${isProcessing ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}
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
            {isProcessing ? (
              // Processing State
              <>
                <svg className="mx-auto h-12 w-12 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="mt-2 text-sm text-darkgray/70 font-medium">Processing SAM file...</p>
              </>
            ) : (
              // Default Upload State
              <>
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
              </>
            )}
          </div>
        </div>
      )}
      
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