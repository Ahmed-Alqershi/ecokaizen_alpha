import { useParams } from 'react-router-dom';
import { useReducer, useEffect, useCallback, useState } from 'react';
import FileUploader from '../components/FileUploader';
import SAMTable from '../components/SAMTable';
import ClosureRuleBuilder from '../components/ClosureRuleBuilder';
import ShockBuilder from '../components/ShockBuilder';
import { exportSamToCsv, exportSamToExcel } from '../utils/samUtils';
import { SAM, ClosureRule, Shock, ModelParameters } from '../utils/types';
import { solveModel } from '../utils/api';
import ExcelJS from 'exceljs';

const FACTOR_NAMES = ['LAB', 'CAP'];

// State interface for better type safety
interface ModelStudioState {
  // Model dimensions
  dimensions: {
    industries: number;
    consumers: number;
  };
  
  // Names and labels
  names: {
    goods: string[];
    consumers: string[];
    useSamNames: boolean;
  };
  
  // Economic parameters
  parameters: {
    goodsPrices: number[];
    wageRate: number;
    calibrationMode: 'auto' | 'manual';
    betaMatrix: number[][];
    alphaParams: number[];
    techParams: number[];
  };
  
  // Model constraints and shocks
  constraints: {
    closureRules: ClosureRule[];
    shocks: Shock[];
  };
  
  // SAM data
  sam: SAM;
  
  // UI state
  ui: {
    samSectionOpen: boolean;
    benchmarkSectionOpen: boolean;
    calibrationSectionOpen: boolean;
    closureSectionOpen: boolean;
    shockSectionOpen: boolean;
    solveSectionOpen: boolean;
    solving: boolean;
  };
  
  // Results and validation
  results: {
    report: { name: string; benchmark: number; solution: number; change: number }[] | null;
    professional_reports?: any; // Added for new professional reports
  };
  
  // Error states
  errors: {
    sam: string;
    goods: string;
    consumers: string;
  };
}

// Action types for reducer
type ModelStudioAction =
  | { type: 'SET_DIMENSIONS'; payload: { industries?: number; consumers?: number } }
  | { type: 'SET_NAMES'; payload: { goods?: string[]; consumers?: string[]; useSamNames?: boolean } }
  | { type: 'SET_PARAMETERS'; payload: Partial<ModelStudioState['parameters']> }
  | { type: 'SET_CONSTRAINTS'; payload: Partial<ModelStudioState['constraints']> }
  | { type: 'SET_SAM'; payload: SAM }
  | { type: 'TOGGLE_SECTION'; payload: { section: keyof ModelStudioState['ui'] } }
  | { type: 'SET_UI_STATE'; payload: Partial<ModelStudioState['ui']> }
  | { type: 'SET_RESULTS'; payload: Partial<ModelStudioState['results']> }
  | { type: 'SET_ERRORS'; payload: Partial<ModelStudioState['errors']> }
  | { type: 'RESET_MODEL' };

// Utility functions
const adjustLength = (arr: string[], len: number, prefix: string): string[] => {
  const copy = [...arr];
  if (copy.length < len) {
    for (let i = copy.length; i < len; i++) copy.push(`${prefix}${i + 1}`);
  } else if (copy.length > len) {
    copy.length = len;
  }
  return copy;
};

const adjustNumericArray = (arr: number[], len: number, defaultValue: number): number[] => {
  const copy = [...arr];
  if (copy.length < len) {
    for (let i = copy.length; i < len; i++) copy.push(defaultValue);
  } else if (copy.length > len) {
    copy.length = len;
  }
  return copy;
};

  const createEmptySam = (goods: string[], factors: string[], households: string[]): SAM => {
    const entries = [...goods, ...factors, ...households];
    const size = entries.length;
    return {
      entries,
      goods,
      factors,
      households,
      data: Array.from({ length: size }, () => Array(size).fill(0)),
    };
  };

// Initial state
const getInitialState = (): ModelStudioState => ({
  dimensions: {
    industries: 2,
    consumers: 1,
  },
  names: {
    goods: ['IND1', 'IND2'],
    consumers: ['HH1'],
    useSamNames: true,
  },
  parameters: {
    goodsPrices: [1, 1],
    wageRate: 1,
    calibrationMode: 'auto',
    betaMatrix: [[0.5, 0.5]],
    alphaParams: [1, 1],
    techParams: [1, 1],
  },
  constraints: {
    closureRules: [],
    shocks: [],
  },
  sam: createEmptySam(['IND1', 'IND2'], FACTOR_NAMES, ['HH1']),
  ui: {
    samSectionOpen: true,
    benchmarkSectionOpen: true,
    calibrationSectionOpen: true,
    closureSectionOpen: true,
    shockSectionOpen: true,
    solveSectionOpen: true,
    solving: false,
  },
  results: {
    report: null,
  },
  errors: {
    sam: '',
    goods: '',
    consumers: '',
  },
});

// Reducer function
const modelStudioReducer = (state: ModelStudioState, action: ModelStudioAction): ModelStudioState => {
  switch (action.type) {
    case 'SET_DIMENSIONS': {
      const newDimensions = { ...state.dimensions, ...action.payload };
      const newGoodsNames = adjustLength(state.names.goods, newDimensions.industries, 'IND');
      const newConsumerNames = adjustLength(state.names.consumers, newDimensions.consumers, 'HH');
      const newGoodsPrices = adjustNumericArray(state.parameters.goodsPrices, newDimensions.industries, 1);
      const newAlphaParams = adjustNumericArray(state.parameters.alphaParams, newDimensions.industries, 1);
      const newTechParams = adjustNumericArray(state.parameters.techParams, newDimensions.industries, 1);
      const newBetaMatrix = Array.from({ length: newDimensions.consumers }, (_, i) =>
        Array.from({ length: newDimensions.industries }, (_, j) => 
          state.parameters.betaMatrix[i]?.[j] ?? 0.5
        )
      );
      
      return {
        ...state,
        dimensions: newDimensions,
        names: {
          ...state.names,
          goods: newGoodsNames,
          consumers: newConsumerNames,
        },
        parameters: {
          ...state.parameters,
          goodsPrices: newGoodsPrices,
          alphaParams: newAlphaParams,
          techParams: newTechParams,
          betaMatrix: newBetaMatrix,
        },
        sam: createEmptySam(newGoodsNames, FACTOR_NAMES, newConsumerNames),
      };
    }
    
    case 'SET_NAMES':
      return {
        ...state,
        names: { ...state.names, ...action.payload },
      };
    
    case 'SET_PARAMETERS':
      return {
        ...state,
        parameters: { ...state.parameters, ...action.payload },
      };
    
    case 'SET_CONSTRAINTS':
      return {
        ...state,
        constraints: { ...state.constraints, ...action.payload },
      };
    
    case 'SET_SAM':
      return {
        ...state,
        sam: action.payload,
      };
    
    case 'TOGGLE_SECTION':
      return {
        ...state,
        ui: {
          ...state.ui,
          [action.payload.section]: !state.ui[action.payload.section],
        },
      };
    
    case 'SET_UI_STATE':
      return {
        ...state,
        ui: { ...state.ui, ...action.payload },
      };
    
    case 'SET_RESULTS':
      return {
        ...state,
        results: { ...state.results, ...action.payload },
      };
    
    case 'SET_ERRORS':
      return {
        ...state,
        errors: { ...state.errors, ...action.payload },
      };
    
    case 'RESET_MODEL':
      return getInitialState();
    
    default:
      return state;
  }
};

const ModelStudioPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [state, dispatch] = useReducer(modelStudioReducer, getInitialState());

  // Auto-save functionality
  useEffect(() => {
    if (!projectId) return;
    
    const saveTimer = setTimeout(() => {
      // Auto-save project state every 30 seconds
      console.log('Auto-saving project state...', projectId);
      // TODO: Implement auto-save API call
    }, 30000);

    return () => clearTimeout(saveTimer);
  }, [projectId, state]);

  // SAM validation effect
  useEffect(() => {
    const expected = state.dimensions.industries + FACTOR_NAMES.length + state.dimensions.consumers;
    if (
      state.sam.data.length !== expected ||
      state.sam.data.some((row) => row.length !== expected)
    ) {
      dispatch({
        type: 'SET_ERRORS',
        payload: {
          sam: `SAM dimensions (${state.sam.data.length}x${state.sam.data.length}) do not match m=${state.dimensions.industries} and n=${state.dimensions.consumers}.`
        }
      });
    } else {
      dispatch({
        type: 'SET_ERRORS',
        payload: { sam: '' }
      });
    }
  }, [state.sam, state.dimensions]);

  // Update SAM when names change
  useEffect(() => {
    const newSam = createEmptySam(state.names.goods, FACTOR_NAMES, state.names.consumers);
    // Preserve existing data if dimensions match
    if (state.sam.data.length === newSam.data.length) {
      newSam.data = state.sam.data.map((row, i) =>
        row.map((cell, j) => (newSam.data[i] && newSam.data[i][j] !== undefined) ? cell : 0)
      );
    }
    dispatch({ type: 'SET_SAM', payload: newSam });
  }, [state.names.goods, state.names.consumers]);

  // Event handlers
  const handleDimensionChange = useCallback((type: 'industries' | 'consumers', value: number) => {
    dispatch({
      type: 'SET_DIMENSIONS',
      payload: { [type]: value },
    });
  }, []);

  // Name editing state interface
  interface EditingNamesState {
    goods: string[];
    consumers: string[];
    isEditingGoods: boolean;
    isEditingConsumers: boolean;
  }

  // Name editing state
  const [editingNames, setEditingNames] = useState<EditingNamesState>({
    goods: state.names.goods,
    consumers: state.names.consumers,
    isEditingGoods: false,
    isEditingConsumers: false,
  });

  // Update editing state when actual names change (e.g., from dimension changes)
  useEffect(() => {
    if (!editingNames.isEditingGoods) {
      setEditingNames(prev => ({ ...prev, goods: state.names.goods }));
    }
    if (!editingNames.isEditingConsumers) {
      setEditingNames(prev => ({ ...prev, consumers: state.names.consumers }));
    }
  }, [state.names.goods, state.names.consumers, editingNames.isEditingGoods, editingNames.isEditingConsumers]);

  const handleStartEditingGoods = useCallback(() => {
    setEditingNames(prev => ({
      ...prev,
      goods: state.names.goods,
      isEditingGoods: true
    }));
  }, [state.names.goods]);

  const handleStartEditingConsumers = useCallback(() => {
    setEditingNames(prev => ({
      ...prev,
      consumers: state.names.consumers,
      isEditingConsumers: true
    }));
  }, [state.names.consumers]);

  const handleGoodsEditChange = useCallback((value: string) => {
    const names = value.split(',').map((n) => n.trim());
    setEditingNames(prev => ({ ...prev, goods: names }));
  }, []);

  const handleConsumersEditChange = useCallback((value: string) => {
    const names = value.split(',').map((n) => n.trim());
    setEditingNames(prev => ({ ...prev, consumers: names }));
  }, []);

  const handleApplyGoodsNames = useCallback(() => {
    const validNames = editingNames.goods.filter(Boolean);
    
    if (validNames.length === 0) {
      // If no valid names provided, use defaults
      const adjustedNames = adjustLength([], state.dimensions.industries, 'IND');
      dispatch({
        type: 'SET_NAMES',
        payload: { goods: adjustedNames },
      });
      setEditingNames(prev => ({ ...prev, goods: adjustedNames, isEditingGoods: false }));
    } else if (validNames.length === state.dimensions.industries) {
      // Perfect match - apply names
      dispatch({
        type: 'SET_NAMES',
        payload: { goods: validNames },
      });
      setEditingNames(prev => ({ ...prev, goods: validNames, isEditingGoods: false }));
      dispatch({
        type: 'SET_ERRORS',
        payload: { goods: '' }
      });
    } else {
      // Wrong number of names - show error but allow continued editing
      dispatch({
        type: 'SET_ERRORS',
        payload: {
          goods: `Please enter exactly ${state.dimensions.industries} names (you have ${validNames.length})`
        }
      });
      return; // Don't exit edit mode
    }
  }, [editingNames.goods, state.dimensions.industries]);

  const handleApplyConsumersNames = useCallback(() => {
    const validNames = editingNames.consumers.filter(Boolean);
    
    if (validNames.length === 0) {
      // If no valid names provided, use defaults
      const adjustedNames = adjustLength([], state.dimensions.consumers, 'HH');
      dispatch({
        type: 'SET_NAMES',
        payload: { consumers: adjustedNames },
      });
      setEditingNames(prev => ({ ...prev, consumers: adjustedNames, isEditingConsumers: false }));
    } else if (validNames.length === state.dimensions.consumers) {
      // Perfect match - apply names
      dispatch({
        type: 'SET_NAMES',
        payload: { consumers: validNames },
      });
      setEditingNames(prev => ({ ...prev, consumers: validNames, isEditingConsumers: false }));
      dispatch({
        type: 'SET_ERRORS',
        payload: { consumers: '' }
      });
    } else {
      // Wrong number of names - show error but allow continued editing
      dispatch({
        type: 'SET_ERRORS',
        payload: {
          consumers: `Please enter exactly ${state.dimensions.consumers} names (you have ${validNames.length})`
        }
      });
      return; // Don't exit edit mode
    }
  }, [editingNames.consumers, state.dimensions.consumers]);

  const handleCancelGoodsEdit = useCallback(() => {
    setEditingNames(prev => ({
      ...prev,
      goods: state.names.goods,
      isEditingGoods: false
    }));
    dispatch({
      type: 'SET_ERRORS',
      payload: { goods: '' }
    });
  }, [state.names.goods]);

  const handleCancelConsumersEdit = useCallback(() => {
    setEditingNames(prev => ({
      ...prev,
      consumers: state.names.consumers,
      isEditingConsumers: false
    }));
    dispatch({
      type: 'SET_ERRORS',
      payload: { consumers: '' }
    });
  }, [state.names.consumers]);

  const handlePriceChange = useCallback((index: number, value: number) => {
    const newPrices = [...state.parameters.goodsPrices];
    newPrices[index] = value;
    dispatch({
      type: 'SET_PARAMETERS',
      payload: { goodsPrices: newPrices },
    });
  }, [state.parameters.goodsPrices]);

  const handleBetaMatrixChange = useCallback((consumerIndex: number, goodIndex: number, value: number) => {
    const newMatrix = state.parameters.betaMatrix.map((row) => [...row]);
    newMatrix[consumerIndex][goodIndex] = isNaN(value) ? 0 : value;
    dispatch({
      type: 'SET_PARAMETERS',
      payload: { betaMatrix: newMatrix },
    });
  }, [state.parameters.betaMatrix]);

  const normalizeBetaRows = useCallback(() => {
    const normalizedMatrix = state.parameters.betaMatrix.map((row) => {
        const sum = row.reduce((a, b) => a + b, 0);
        return sum ? row.map((v) => v / sum) : row;
    });
    dispatch({
      type: 'SET_PARAMETERS',
      payload: { betaMatrix: normalizedMatrix },
    });
  }, [state.parameters.betaMatrix]);

  const handleSolve = useCallback(async () => {
    dispatch({ type: 'SET_UI_STATE', payload: { solving: true } });
    dispatch({ type: 'SET_RESULTS', payload: { report: null } });
    
    const params: ModelParameters = {
      alpha: state.parameters.alphaParams, // Required field for ModelParameters interface
      b: state.parameters.techParams, // Required field for ModelParameters interface  
      prices: state.parameters.goodsPrices,
      wage: state.parameters.wageRate,
      beta: state.parameters.betaMatrix.flat(),
      A: state.parameters.techParams,
      closureRules: state.constraints.closureRules,
      shocks: state.constraints.shocks,
      calibration: state.parameters.calibrationMode,
    };
    
    try {
      const res = await solveModel('mn1', params, state.sam);
      
      // Check if we have professional reports (new structure)
      if (res.professional_reports) {
        // Use the new professional reports structure
        dispatch({ type: 'SET_RESULTS', payload: { 
          report: null, // Clear old report
          professional_reports: res.professional_reports 
        } });
      } else {
        // Fallback to old structure for backward compatibility
        const table: { name: string; benchmark: number; solution: number; change: number }[] = [];
        
        if (res.production) {
          Object.entries(res.production).forEach(([k, v]) => {
            // Use benchmark values from backend if available, otherwise fallback to 1
            const bench = res.benchmark?.production?.[k] ?? 1;
            const change = bench ? ((v - bench) / bench) * 100 : 0;
            table.push({ name: `XS[${k}]`, benchmark: bench, solution: v, change });
          });
        }
        
        if (res.prices) {
          Object.entries(res.prices).forEach(([k, v]) => {
            // Use benchmark values from backend if available, otherwise use user input prices
            const bench = res.benchmark?.prices?.[k] ?? state.parameters.goodsPrices[state.names.goods.indexOf(k)] ?? 1;
            const change = bench ? ((v - bench) / bench) * 100 : 0;
            table.push({ name: `P[${k}]`, benchmark: bench, solution: v, change });
          });
        }
        
        if (typeof res.utility === 'number') {
          const bench = 1; // Utility benchmark is always 1 for MN1
          const v = res.utility;
          const change = ((v - bench) / bench) * 100;
          table.push({ name: 'U', benchmark: bench, solution: v, change });
        }
        
        dispatch({ type: 'SET_RESULTS', payload: { report: table } });
      }
    } catch (err) {
      console.error('Model solving error:', err);
    } finally {
      dispatch({ type: 'SET_UI_STATE', payload: { solving: false } });
    }
  }, [state.parameters, state.constraints, state.sam, state.names.goods]);

  // File download handlers
  const handleDownloadCsv = useCallback(() => {
    const csv = exportSamToCsv(state.sam);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'sam.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [state.sam]);

  const handleDownloadExcel = useCallback(async () => {
    const blob = await exportSamToExcel(state.sam);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'sam.xlsx');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [state.sam]);

  const handleDownloadReportCsv = useCallback(() => {
    if (!state.results.report) return;
    const header = 'Variable,Benchmark,Solution,% Change';
    const rows = state.results.report.map(
      (r) => `${r.name},${r.benchmark},${r.solution},${r.change}`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [state.results.report]);

  const handleDownloadReportExcel = useCallback(async () => {
    if (!state.results.report) return;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Report');
    ws.addRow(['Variable', 'Benchmark', 'Solution', '% Change']);
    state.results.report.forEach((r) => ws.addRow([r.name, r.benchmark, r.solution, r.change]));
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'report.xlsx');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [state.results.report]);

  return (
    <div
      className="w-full max-w-6xl mx-auto my-12 p-4 space-y-8"
      data-project-id={projectId}
    >
      <div className="bg-[#2F3A4A] text-white rounded-lg p-6 text-center shadow-lg">
        <h1 className="text-2xl font-bold mb-2">
          Welcome to your Model Studio!
        </h1>
        <p>
          Let's help you set up and run your CGE model step-by-step.
        </p>
      </div>

      {/* SAM Setup Section */}
      <section className={state.ui.solving ? 'opacity-50 pointer-events-none' : ''}>
        <div
          className="flex items-center mb-4 cursor-pointer text-[#2F3A4A]"
          onClick={() => dispatch({ type: 'TOGGLE_SECTION', payload: { section: 'samSectionOpen' } })}
        >
          <span className="mr-2">{state.ui.samSectionOpen ? '▼' : '►'}</span>
          <h2 className="text-xl font-semibold">1. SAM Setup</h2>
        </div>
        <div
          className={`bg-white rounded-lg shadow-md space-y-6 overflow-hidden transition-all duration-300 ${
            state.ui.samSectionOpen ? 'max-h-[5000px] p-6' : 'max-h-0 p-0'
          }`}
        >
          <div>
            <label className="block mb-2 font-medium">Upload SAM</label>
            <FileUploader
              onSamLoaded={(sam) => dispatch({ type: 'SET_SAM', payload: sam })}
              goods={state.names.goods}
              factors={FACTOR_NAMES}
              households={state.names.consumers}
              autoPopulateNames={state.names.useSamNames}
              onNamesLoaded={(g, _f, h) => {
                dispatch({ type: 'SET_NAMES', payload: { goods: g, consumers: h } });
              }}
            />
            {state.errors.sam && (
              <p className="mt-2 text-sm text-danger">{state.errors.sam}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 font-medium">
                Number of industries (m)
              </label>
              <input
                type="number"
                min={1}
                className="input w-full"
                value={state.dimensions.industries}
                onChange={(e) => handleDimensionChange('industries', parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">
                Number of consumers (n)
              </label>
              <input
                type="number"
                min={1}
                className="input w-full"
                value={state.dimensions.consumers}
                onChange={(e) => handleDimensionChange('consumers', parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                className="mr-2"
                checked={state.names.useSamNames}
                onChange={(e) => dispatch({ 
                  type: 'SET_NAMES', 
                  payload: { useSamNames: e.target.checked } 
                })}
              />
              <span className="text-sm">Load names from uploaded SAM</span>
            </label>
          </div>

          {!state.names.useSamNames && (
            <div className="space-y-4">
              {/* Industry Names Section */}
              <div>
                <label className="block mb-1 font-medium">
                  Industry Names
                </label>
                {!editingNames.isEditingGoods ? (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-md">
                      <span className="text-gray-700">{state.names.goods.join(', ')}</span>
                    </div>
                    <button
                      onClick={handleStartEditingGoods}
                      className="btn bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 text-sm transition-colors"
                    >
                      Edit Names
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                <input
                  type="text"
                  className={`input w-full ${
                        state.errors.goods ? 'border-danger focus:ring-danger' : 'border-blue-300 focus:ring-blue-500'
                      }`}
                      value={editingNames.goods.join(', ')}
                      onChange={(e) => handleGoodsEditChange(e.target.value)}
                      placeholder="Enter industry names separated by commas..."
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleApplyGoodsNames}
                        className="btn bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 text-sm transition-colors"
                      >
                        Apply Changes
                      </button>
                      <button
                        onClick={handleCancelGoodsEdit}
                        className="btn bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 text-sm transition-colors"
                      >
                        Cancel
                      </button>
                      <span className="text-xs text-gray-500">
                        Need exactly {state.dimensions.industries} names
                      </span>
                    </div>
                  </div>
                )}
                {state.errors.goods && (
                  <p className="mt-1 text-xs text-danger">{state.errors.goods}</p>
                )}
              </div>

              {/* Consumer Names Section */}
              <div>
                <label className="block mb-1 font-medium">
                  Consumer Names
                </label>
                {!editingNames.isEditingConsumers ? (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-md">
                      <span className="text-gray-700">{state.names.consumers.join(', ')}</span>
                    </div>
                    <button
                      onClick={handleStartEditingConsumers}
                      className="btn bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 text-sm transition-colors"
                    >
                      Edit Names
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                <input
                  type="text"
                  className={`input w-full ${
                        state.errors.consumers ? 'border-danger focus:ring-danger' : 'border-blue-300 focus:ring-blue-500'
                      }`}
                      value={editingNames.consumers.join(', ')}
                      onChange={(e) => handleConsumersEditChange(e.target.value)}
                      placeholder="Enter consumer names separated by commas..."
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleApplyConsumersNames}
                        className="btn bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 text-sm transition-colors"
                      >
                        Apply Changes
                      </button>
                      <button
                        onClick={handleCancelConsumersEdit}
                        className="btn bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 text-sm transition-colors"
                      >
                        Cancel
                      </button>
                      <span className="text-xs text-gray-500">
                        Need exactly {state.dimensions.consumers} names
                      </span>
                    </div>
                  </div>
                )}
                {state.errors.consumers && (
                  <p className="mt-1 text-xs text-danger">{state.errors.consumers}</p>
                )}
              </div>
            </div>
          )}

          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-medium">SAM Editor</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadCsv}
                  className="btn bg-white border border-midgray text-darkgray hover:bg-neutral text-sm"
                >
                  Download CSV
                </button>
                <button
                  onClick={handleDownloadExcel}
                  className="btn bg-white border border-midgray text-darkgray hover:bg-neutral text-sm"
                >
                  Download Excel
                </button>
              </div>
            </div>
            <SAMTable 
              sam={state.sam} 
              onChange={(sam) => dispatch({ type: 'SET_SAM', payload: sam })} 
            />
          </div>
        </div>
      </section>

      {/* Benchmark Prices Section */}
      <section className={state.ui.solving ? 'opacity-50 pointer-events-none' : ''}>
        <div
          className="flex items-center mb-4 cursor-pointer text-[#2F3A4A]"
          onClick={() => dispatch({ type: 'TOGGLE_SECTION', payload: { section: 'benchmarkSectionOpen' } })}
        >
          <span className="mr-2">{state.ui.benchmarkSectionOpen ? '▼' : '►'}</span>
          <h2 className="text-xl font-semibold">2. Benchmark Prices</h2>
        </div>
        <div
          className={`bg-white rounded-lg shadow-md space-y-6 overflow-hidden transition-all duration-300 ${
            state.ui.benchmarkSectionOpen ? 'max-h-[5000px] p-6' : 'max-h-0 p-0'
          }`}
        >
          <div>
            <label className="block mb-2 font-medium">Price of goods (PO)</label>
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="pb-2">Industry</th>
                  <th className="pb-2">Benchmark Price (PO)</th>
                </tr>
              </thead>
              <tbody>
                {state.names.goods.map((name, idx) => (
                  <tr key={name} className="align-top">
                    <td className="py-2 pr-4">{name}</td>
                    <td className="py-2">
                      <input
                        type="number"
                        step="any"
                        className={`input w-full ${
                          state.parameters.goodsPrices[idx] > 0
                            ? ''
                            : 'border-danger focus:ring-danger'
                        }`}
                        value={state.parameters.goodsPrices[idx]}
                        placeholder="Enter price (PO)"
                        onChange={(e) => handlePriceChange(idx, parseFloat(e.target.value))}
                      />
                      {state.parameters.goodsPrices[idx] > 0 ? null : (
                        <p className="mt-1 text-xs text-danger">
                          Enter a positive number
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <label className="block mb-2 font-medium">Wage rate (WO)</label>
            <input
              type="number"
              step="any"
              className={`input w-full ${
                state.parameters.wageRate > 0 ? '' : 'border-danger focus:ring-danger'
              }`}
              value={state.parameters.wageRate}
              placeholder="Enter wage rate (WO)"
              onChange={(e) => dispatch({ 
                type: 'SET_PARAMETERS', 
                payload: { wageRate: parseFloat(e.target.value) } 
              })}
            />
            {state.parameters.wageRate > 0 ? null : (
              <p className="mt-1 text-xs text-danger">Enter a positive number</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              The wage rate represents the price of labor. Default = 1.0
            </p>
          </div>
        </div>
      </section>

      {/* Calibration Section */}
      <section className={state.ui.solving ? 'opacity-50 pointer-events-none' : ''}>
        <div
          className="flex items-center mb-4 cursor-pointer text-[#2F3A4A]"
          onClick={() => dispatch({ type: 'TOGGLE_SECTION', payload: { section: 'calibrationSectionOpen' } })}
        >
          <span className="mr-2">{state.ui.calibrationSectionOpen ? '▼' : '►'}</span>
          <h2 className="text-xl font-semibold">3. Model Calibration</h2>
        </div>
        <div
          className={`bg-white rounded-lg shadow-md space-y-6 overflow-hidden transition-all duration-300 ${
            state.ui.calibrationSectionOpen ? 'max-h-[5000px] p-6' : 'max-h-0 p-0'
          }`}
        >
          <div>
            <label className="block mb-2 font-medium">Calibration Mode:</label>
            <div className="flex gap-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  checked={state.parameters.calibrationMode === 'auto'}
                  onChange={() => dispatch({ 
                    type: 'SET_PARAMETERS', 
                    payload: { calibrationMode: 'auto' } 
                  })}
                  className="mr-2"
                />
                <span>Auto-calibrate (recommended)</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  checked={state.parameters.calibrationMode === 'manual'}
                  onChange={() => dispatch({ 
                    type: 'SET_PARAMETERS', 
                    payload: { calibrationMode: 'manual' } 
                  })}
                  className="mr-2"
                />
                <span>Manual input</span>
              </label>
            </div>
          </div>
          {state.parameters.calibrationMode === 'manual' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-medium mb-2">A. Utility Parameters (BETA)</h3>
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      <th className="pb-2">Consumer \ Industry</th>
                      {state.names.goods.map((g) => (
                        <th key={g} className="pb-2">
                          {g}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {state.names.consumers.map((c, i) => (
                      <tr key={c} className="align-top">
                        <td className="py-2 pr-4">{c}</td>
                        {state.names.goods.map((g, j) => (
                          <td key={g} className="py-2">
                            <input
                              type="number"
                              step="any"
                              className="input w-full"
                              value={state.parameters.betaMatrix[i]?.[j] ?? 0}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                handleBetaMatrixChange(i, j, val);
                              }}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-1 text-xs text-gray-500">
                  Each row (consumer) must sum to 1.0
                </p>
                <button
                  type="button"
                  onClick={normalizeBetaRows}
                  className="btn bg-white border border-midgray text-darkgray hover:bg-neutral text-sm mt-2"
                >
                  Normalize Rows
                </button>
              </div>
              <div>
                <h3 className="font-medium mb-2">B. Production Parameters (ALPHA)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {state.names.goods.map((name, idx) => (
                    <div key={`alpha-${name}`}> 
                      <label className="block mb-1 font-medium">{name}</label>
                      <input
                        type="number"
                        step="any"
                        className="input w-full"
                        value={state.parameters.alphaParams[idx] ?? 1}
                        onChange={(e) => {
                          const newParams = [...state.parameters.alphaParams];
                          newParams[idx] = parseFloat(e.target.value);
                          dispatch({
                            type: 'SET_PARAMETERS',
                            payload: { alphaParams: newParams },
                          });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-medium mb-2">C. Technology coefficient per industry (A)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {state.names.goods.map((name, idx) => (
                    <div key={`tech-${name}`}>
                      <label className="block mb-1 font-medium">{name}</label>
                      <input
                        type="number"
                        step="any"
                        className="input w-full"
                        value={state.parameters.techParams[idx] ?? 1}
                        onChange={(e) => {
                          const newParams = [...state.parameters.techParams];
                          newParams[idx] = parseFloat(e.target.value);
                          dispatch({
                            type: 'SET_PARAMETERS',
                            payload: { techParams: newParams },
                          });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Closure Rules Section */}
      <section className={state.ui.solving ? 'opacity-50 pointer-events-none' : ''}>
        <div
          className="flex items-center mb-4 cursor-pointer text-[#2F3A4A]"
          onClick={() => dispatch({ type: 'TOGGLE_SECTION', payload: { section: 'closureSectionOpen' } })}
        >
          <span className="mr-2">{state.ui.closureSectionOpen ? '▼' : '►'}</span>
          <h2 className="text-xl font-semibold">4. Define Closure Rules</h2>
        </div>
        <div
          className={`bg-white rounded-lg shadow-md space-y-6 overflow-hidden transition-all duration-300 ${
            state.ui.closureSectionOpen ? 'max-h-[5000px] p-6' : 'max-h-0 p-0'
          }`}
        >
          <ClosureRuleBuilder
            rules={state.constraints.closureRules}
            goods={state.names.goods}
            consumers={state.names.consumers}
            onAdd={(r) => dispatch({
              type: 'SET_CONSTRAINTS',
              payload: { closureRules: [...state.constraints.closureRules, r] },
            })}
            onRemove={(i) => dispatch({
              type: 'SET_CONSTRAINTS',
              payload: { 
                closureRules: state.constraints.closureRules.filter((_, idx) => idx !== i) 
              },
            })}
          />
        </div>
      </section>

      {/* Shocks Section */}
      <section className={state.ui.solving ? 'opacity-50 pointer-events-none' : ''}>
        <div
          className="flex items-center mb-4 cursor-pointer text-[#2F3A4A]"
          onClick={() => dispatch({ type: 'TOGGLE_SECTION', payload: { section: 'shockSectionOpen' } })}
        >
          <span className="mr-2">{state.ui.shockSectionOpen ? '▼' : '►'}</span>
          <h2 className="text-xl font-semibold">5. Apply Economic Shocks</h2>
        </div>
        <div
          className={`bg-white rounded-lg shadow-md space-y-6 overflow-hidden transition-all duration-300 ${
            state.ui.shockSectionOpen ? 'max-h-[5000px] p-6' : 'max-h-0 p-0'
          }`}
        >
          <ShockBuilder
            shocks={state.constraints.shocks}
            goods={state.names.goods}
            consumers={state.names.consumers}
            onAdd={(s) => dispatch({
              type: 'SET_CONSTRAINTS',
              payload: { shocks: [...state.constraints.shocks, s] },
            })}
            onRemove={(i) => dispatch({
              type: 'SET_CONSTRAINTS',
              payload: { 
                shocks: state.constraints.shocks.filter((_, idx) => idx !== i) 
              },
            })}
          />
        </div>
      </section>

      {/* Solve & Report Section */}
      <section>
        <div
          className="flex items-center mb-4 cursor-pointer text-[#2F3A4A]"
          onClick={() => dispatch({ type: 'TOGGLE_SECTION', payload: { section: 'solveSectionOpen' } })}
        >
          <span className="mr-2">{state.ui.solveSectionOpen ? '▼' : '►'}</span>
          <h2 className="text-xl font-semibold">6. Solve & Generate Report</h2>
        </div>
        <div
          className={`bg-white rounded-lg shadow-md space-y-6 overflow-hidden transition-all duration-300 ${
            state.ui.solveSectionOpen ? 'max-h-[5000px] p-6' : 'max-h-0 p-0'
          }`}
        >
          <button
            onClick={handleSolve}
            disabled={state.ui.solving}
            className="btn btn-primary flex items-center justify-center"
          >
            {state.ui.solving ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4l3-3-3-3v4a12 12 0 00-12 12h4z"
                  ></path>
                </svg>
                Solving your model...
              </>
            ) : (
              'Solve Model'
            )}
          </button>
          {state.results.professional_reports ? (
            // Professional Reports Display
            <div className="mt-4 space-y-6">
              {/* Summary Report */}
              {state.results.professional_reports.summary && (
                <div>
                  <h4 className="text-lg font-medium mb-4 text-blue-600">Summary Report</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border border-gray-300 rounded-lg">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 border-r border-gray-300">Indicator</th>
                          <th className="px-4 py-2 border-r border-gray-300">Benchmark</th>
                          <th className="px-4 py-2 border-r border-gray-300">After Shock</th>
                          <th className="px-4 py-2">Change (%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(state.results.professional_reports.summary).map(([indicator, data]: [string, any]) => (
                          <tr key={indicator} className="hover:bg-gray-50 border-b border-gray-200">
                            <td className="px-4 py-2 border-r border-gray-300 font-medium">{indicator}</td>
                            <td className="px-4 py-2 border-r border-gray-300 text-right">
                              {typeof data['Benchmark'] === 'number' ? data['Benchmark'].toFixed(4) : 'N/A'}
                            </td>
                            <td className="px-4 py-2 border-r border-gray-300 text-right">
                              {typeof data['After Shock'] === 'number' ? data['After Shock'].toFixed(4) : 'N/A'}
                            </td>
                            <td className="px-4 py-2 text-right">
                              {typeof data['Change (%)'] === 'number' ? data['Change (%)'].toFixed(2) + '%' : 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sector and Household Report */}
              {state.results.professional_reports.sector_household && (
                <div>
                  <h4 className="text-lg font-medium mb-4 text-green-600">Sector & Household Report</h4>
                  {Object.entries(state.results.professional_reports.sector_household).map(([category, categoryData]: [string, any]) => (
                    <div key={category} className="mb-6">
                      <h5 className="text-md font-medium mb-3 text-gray-700">{category}</h5>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border border-gray-300 rounded-lg">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 border-r border-gray-300">Item</th>
                              <th className="px-3 py-2 border-r border-gray-300">Benchmark</th>
                              <th className="px-3 py-2 border-r border-gray-300">After Shock</th>
                              <th className="px-3 py-2">Change (%)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(categoryData).map(([item, itemData]: [string, any]) => (
                              <tr key={item} className="hover:bg-gray-50 border-b border-gray-200">
                                <td className="px-3 py-2 border-r border-gray-300 font-medium">{item}</td>
                                <td className="px-3 py-2 border-r border-gray-300 text-right">
                                  {typeof itemData['Benchmark'] === 'number' ? itemData['Benchmark'].toFixed(4) : 'N/A'}
                                </td>
                                <td className="px-3 py-2 border-r border-gray-300 text-right">
                                  {typeof itemData['After Shock'] === 'number' ? itemData['After Shock'].toFixed(4) : 'N/A'}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {typeof itemData['Change (%)'] === 'number' ? itemData['Change (%)'].toFixed(2) + '%' : 'N/A'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Demand Matrix Report */}
              {state.results.professional_reports.demand_matrix && (
                <div>
                  <h4 className="text-lg font-medium mb-4 text-purple-600">Demand Matrix Report</h4>
                  {Object.entries(state.results.professional_reports.demand_matrix).map(([category, categoryData]: [string, any]) => (
                    <div key={category} className="mb-6">
                      <h5 className="text-md font-medium mb-3 text-gray-700">{category}</h5>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border border-gray-300 rounded-lg">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 border-r border-gray-300">Consumer</th>
                              <th className="px-3 py-2 border-r border-gray-300">Sector</th>
                              <th className="px-3 py-2 border-r border-gray-300">Benchmark</th>
                              <th className="px-3 py-2 border-r border-gray-300">After Shock</th>
                              <th className="px-3 py-2">Change (%)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(categoryData).map(([consumer, consumerData]: [string, any]) =>
                              Object.entries(consumerData).map(([sector, sectorData]: [string, any]) => (
                                <tr key={`${consumer}-${sector}`} className="hover:bg-gray-50 border-b border-gray-200">
                                  <td className="px-3 py-2 border-r border-gray-300 font-medium">{consumer}</td>
                                  <td className="px-3 py-2 border-r border-gray-300 font-medium">{sector}</td>
                                  <td className="px-3 py-2 border-r border-gray-300 text-right">
                                    {typeof sectorData['Benchmark'] === 'number' ? sectorData['Benchmark'].toFixed(4) : 'N/A'}
                                  </td>
                                  <td className="px-3 py-2 border-r border-gray-300 text-right">
                                    {typeof sectorData['After Shock'] === 'number' ? sectorData['After Shock'].toFixed(4) : 'N/A'}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    {typeof sectorData['Change (%)'] === 'number' ? sectorData['Change (%)'].toFixed(2) + '%' : 'N/A'}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleDownloadReportExcel}
                  className="btn bg-white border border-midgray text-darkgray hover:bg-neutral text-sm"
                >
                  Download Excel
                </button>
                <button
                  onClick={handleDownloadReportCsv}
                  className="btn bg-white border border-midgray text-darkgray hover:bg-neutral text-sm"
                >
                  Download CSV
                </button>
              </div>
            </div>
          ) : state.results.report ? (
            // Old Results Table (fallback)
            <div className="mt-4 space-y-4">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="pb-2">Variable</th>
                    <th className="pb-2">Benchmark</th>
                    <th className="pb-2">Solution</th>
                    <th className="pb-2">% Change</th>
                  </tr>
                </thead>
                <tbody>
                  {state.results.report.map((r) => (
                    <tr key={r.name} className="align-top">
                      <td className="py-1 pr-2">{r.name}</td>
                      <td className="py-1">{r.benchmark.toFixed(2)}</td>
                      <td className="py-1">{r.solution.toFixed(2)}</td>
                      <td className="py-1">{r.change.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadReportExcel}
                  className="btn bg-white border border-midgray text-darkgray hover:bg-neutral text-sm"
                >
                  Download Excel
                </button>
                <button
                  onClick={handleDownloadReportCsv}
                  className="btn bg-white border border-midgray text-darkgray hover:bg-neutral text-sm"
                >
                  Download CSV
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
};

export default ModelStudioPage;