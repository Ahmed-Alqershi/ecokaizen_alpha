import { useParams } from 'react-router-dom';
import { useReducer, useEffect, useCallback, useState, useMemo } from 'react';
import FileUploader from '../components/FileUploader';
import SAMTable from '../components/SAMTable';
import ClosureRuleBuilder from '../components/ClosureRuleBuilder';
import ShockBuilder from '../components/ShockBuilder';
import HouseholdAnalyticsMatrix from '../components/HouseholdAnalyticsMatrix';
import SectorAnalyticsMatrix from '../components/SectorAnalyticsMatrix';
import { exportSamToCsv, exportSamToExcel } from '../utils/samUtils';
import { SAM, ClosureRule, Shock, ModelParameters } from '../utils/types';
import { solveModel } from '../utils/api';
import ExcelJS from 'exceljs';

const FACTOR_NAMES = ['LAB', 'CAP'];

// State interface for better type safety
interface ModelStudioState {
  // Project information
  project: {
    name: string;
  };
  
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
    solveError?: string;
    uploadedFileInfo?: {
      name: string;
      size: number;
      type: string;
      uploadedAt: string;
      dimensions: string;
      fileData?: string; // Base64 encoded file content
    };
  };
  
  // Results and validation
  results: {
    report: { name: string; benchmark: number; solution: number; change: number }[] | null;
    professional_reports?: any; // Added for new professional reports
    scenario1?: {
      report: { name: string; benchmark: number; solution: number; change: number }[] | null;
      professional_reports?: any;
      name: string;
    };
    scenario2?: {
      report: { name: string; benchmark: number; solution: number; change: number }[] | null;
      professional_reports?: any;
      name: string;
    };
    comparisonMode: boolean;
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
  | { type: 'SET_PROJECT'; payload: { name?: string } }
  | { type: 'SET_DIMENSIONS'; payload: { industries?: number; consumers?: number } }
  | { type: 'SET_NAMES'; payload: { goods?: string[]; consumers?: string[]; useSamNames?: boolean } }
  | { type: 'SET_PARAMETERS'; payload: Partial<ModelStudioState['parameters']> }
  | { type: 'SET_CONSTRAINTS'; payload: Partial<ModelStudioState['constraints']> }
  | { type: 'SET_SAM'; payload: SAM }
  | { type: 'TOGGLE_SECTION'; payload: { section: keyof ModelStudioState['ui'] } }
  | { type: 'SET_UI_STATE'; payload: Partial<ModelStudioState['ui']> }
  | { type: 'SET_RESULTS'; payload: Partial<ModelStudioState['results']> }
  | { type: 'SET_ERRORS'; payload: Partial<ModelStudioState['errors']> }
  | { type: 'SAVE_SCENARIO'; payload: { scenarioNumber: 1 | 2; name: string } }
  | { type: 'TOGGLE_COMPARISON_MODE' }
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
  project: {
    name: '',
  },
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
    solveError: undefined,
    uploadedFileInfo: undefined,
  },
  results: {
    report: null,
    comparisonMode: false,
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
    case 'SET_PROJECT':
      return {
        ...state,
        project: { ...state.project, ...action.payload },
      };
    
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
    
    case 'SAVE_SCENARIO':
      const scenarioData = {
        report: state.results.report,
        professional_reports: state.results.professional_reports,
        name: action.payload.name,
      };
      return {
        ...state,
        results: {
          ...state.results,
          [`scenario${action.payload.scenarioNumber}`]: scenarioData,
        },
      };
    
    case 'TOGGLE_COMPARISON_MODE':
      return {
        ...state,
        results: {
          ...state.results,
          comparisonMode: !state.results.comparisonMode,
        },
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
  const { projectName } = useParams<{ projectName: string }>();
  const [state, dispatch] = useReducer(modelStudioReducer, getInitialState());
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | null>(null);

  // Load project data on mount
  useEffect(() => {
    if (!projectName) return;
    const decodedName = decodeURIComponent(projectName);
    
    const loadProjectData = () => {
      try {
        const savedData = localStorage.getItem(`model-studio-${decodedName}`);
        if (savedData) {
          const parsedData = JSON.parse(savedData);
          // Restore state from saved data
          Object.keys(parsedData).forEach(key => {
            if (key === 'project') {
              dispatch({ type: 'SET_PROJECT', payload: parsedData[key] });
            } else if (key === 'dimensions') {
              dispatch({ type: 'SET_DIMENSIONS', payload: parsedData[key] });
            } else if (key === 'names') {
              dispatch({ type: 'SET_NAMES', payload: parsedData[key] });
            } else if (key === 'parameters') {
              dispatch({ type: 'SET_PARAMETERS', payload: parsedData[key] });
            } else if (key === 'constraints') {
              dispatch({ type: 'SET_CONSTRAINTS', payload: parsedData[key] });
            } else if (key === 'sam') {
              dispatch({ type: 'SET_SAM', payload: parsedData[key] });
            } else if (key === 'results') {
              dispatch({ type: 'SET_RESULTS', payload: parsedData[key] });
            } else if (key === 'ui') {
              dispatch({ type: 'SET_UI_STATE', payload: parsedData[key] });
            }
          });
          setLastSaved(new Date(parsedData.lastSaved || Date.now()));
          setSaveStatus('saved');
          
          // Update last opened timestamp
          const currentTime = new Date().toISOString();
          const existingProjects = JSON.parse(localStorage.getItem('workspace-projects') || '[]');
          const projectIndex = existingProjects.findIndex((p: any) => p.name === decodedName);
          
          if (projectIndex >= 0) {
            existingProjects[projectIndex] = {
              ...existingProjects[projectIndex],
              lastOpened: currentTime
            };
            localStorage.setItem('workspace-projects', JSON.stringify(existingProjects));
          }
        } else {
          // If no saved data, set project name from URL
          dispatch({ type: 'SET_PROJECT', payload: { name: decodedName } });
        }
      } catch (error) {
        setSaveStatus('error');
      }
    };
    
    loadProjectData();
  }, [projectName]);

  // Save project data function
  const saveProjectData = useCallback(async () => {
    if (!projectName) return;
    const decodedName = decodeURIComponent(projectName);
    
    setSaveStatus('saving');
    try {
      const currentTime = new Date().toISOString();
      const dataToSave = {
        project: state.project,
        dimensions: state.dimensions,
        names: state.names,
        parameters: state.parameters,
        constraints: state.constraints,
        sam: state.sam,
        results: state.results,
        ui: state.ui,
        lastSaved: currentTime,
      };
      
      // Update project metadata in localStorage for workspace display
      const existingProjects = JSON.parse(localStorage.getItem('workspace-projects') || '[]');
      const projectIndex = existingProjects.findIndex((p: any) => p.name === (state.project.name || decodedName));
      
      if (projectIndex >= 0) {
        existingProjects[projectIndex] = {
          ...existingProjects[projectIndex],
          lastSaved: currentTime,
          updated_at: currentTime
        };
      } else {
        // Create new project entry if it doesn't exist
        existingProjects.push({
          id: Date.now(),
          name: state.project.name || decodedName,
          description: (state.project as any).description || '',
          template: 'A',
          status: 'open',
          created_at: currentTime,
          updated_at: currentTime,
          lastSaved: currentTime
        });
      }
      
      localStorage.setItem('workspace-projects', JSON.stringify(existingProjects));
      
      localStorage.setItem(`model-studio-${decodedName}`, JSON.stringify(dataToSave));
      setLastSaved(new Date());
      setSaveStatus('saved');
      
      // Optional: Also save to backend API
      // await fetch(`/api/projects/${decodedName}/save`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(dataToSave)
      // });
    } catch (error) {
      setSaveStatus('error');
    }
  }, [projectName, state]);

  // Auto-save functionality
  useEffect(() => {
    if (!projectName) return;
    
    const saveTimer = setTimeout(() => {
      saveProjectData();
    }, 30000); // Auto-save every 30 seconds

    return () => clearTimeout(saveTimer);
  }, [projectName, saveProjectData]);

  // Save on significant state changes
  useEffect(() => {
    if (!projectName) return;
    
    const debouncedSave = setTimeout(() => {
      saveProjectData();
    }, 2000); // Save 2 seconds after state change

    return () => clearTimeout(debouncedSave);
  }, [state.constraints, state.sam, state.results, saveProjectData]);

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
    dispatch({ type: 'SET_UI_STATE', payload: { solving: true, solveError: undefined } });
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
            const change = (bench && typeof bench === 'number' && bench !== 0) ? ((v - bench) / bench) * 100 : 0;
            table.push({ name: `XS[${k}]`, benchmark: bench, solution: v, change });
          });
        }
        
        if (res.prices) {
          Object.entries(res.prices).forEach(([k, v]) => {
            // Use benchmark values from backend if available, otherwise use user input prices
            const bench = res.benchmark?.prices?.[k] ?? state.parameters.goodsPrices[state.names.goods.indexOf(k)] ?? 1;
            const change = (bench && typeof bench === 'number' && bench !== 0) ? ((v - bench) / bench) * 100 : 0;
            table.push({ name: `P[${k}]`, benchmark: bench, solution: v, change });
          });
        }
        
        if (typeof res.utility === 'number') {
          const benchNum: number = 1; // Utility benchmark is always 1 for MN1
          const v = res.utility;
          const change = benchNum !== 0 ? ((v - benchNum) / benchNum) * 100 : 0;
          table.push({ name: 'U', benchmark: benchNum, solution: v, change });
        }
        
        dispatch({ type: 'SET_RESULTS', payload: { report: table } });
      }
    } catch (err) {
      let errorMessage = 'Failed to solve the model. Please check your parameters and try again.';
      
      if (err instanceof Error) {
        // Check for specific error types
        if (err.message.includes('InfeasibleLocal')) {
          errorMessage = 'Model did not solve optimally. The problem may be infeasible with the current parameters. Try adjusting your shocks or closure rules.';
        } else if (err.message.includes('Unbounded')) {
          errorMessage = 'Model is unbounded. Please check your constraints and parameter values.';
        } else if (err.message.includes('Optimal')) {
          errorMessage = 'Model failed to find an optimal solution. Consider revising your model parameters.';
        } else if (err.message.includes('timeout') || err.message.includes('Timeout')) {
          errorMessage = 'Model solving timed out. Try simplifying your model or reducing the complexity.';
        } else {
          errorMessage = `Model solving failed: ${err.message}`;
        }
      }
      
      dispatch({ type: 'SET_UI_STATE', payload: { solveError: errorMessage } });
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
    const filename = state.project.name ? `${state.project.name.replace(/[^a-zA-Z0-9]/g, '_')}_sam.csv` : 'sam.csv';
    link.setAttribute('download', filename);
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
    // Handle professional reports format
    if (state.results.professional_reports) {
      const csvData = [];
      
      // Summary Report
      if (state.results.professional_reports.summary) {
        csvData.push('Summary Report');
        csvData.push('Indicator,Benchmark,After Shock,Change (%)');
        Object.entries(state.results.professional_reports.summary).forEach(([indicator, data]: [string, any]) => {
          const changePercent = typeof data['Change (%)'] === 'number' && !isNaN(data['Change (%)']) ? (data['Change (%)'] * 100).toFixed(2) : 'N/A';
          csvData.push(`${indicator},${data['Benchmark'] || 'N/A'},${data['After Shock'] || 'N/A'},${changePercent}`);
        });
        csvData.push(''); // Empty line
      }
      
      // Sector & Household Report
      if (state.results.professional_reports.sector_household) {
        csvData.push('Sector & Household Report');
        Object.entries(state.results.professional_reports.sector_household).forEach(([category, categoryData]: [string, any]) => {
          csvData.push(`${category}`);
          csvData.push('Item,Benchmark,After Shock,Change (%)');
          Object.entries(categoryData).forEach(([item, itemData]: [string, any]) => {
            const changePercent = typeof itemData['Change (%)'] === 'number' && !isNaN(itemData['Change (%)']) ? (itemData['Change (%)'] * 100).toFixed(2) : 'N/A';
            csvData.push(`${item},${itemData['Benchmark'] || 'N/A'},${itemData['After Shock'] || 'N/A'},${changePercent}`);
          });
          csvData.push(''); // Empty line
        });
      }
      
      const csv = csvData.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filename = state.project.name ? `${state.project.name.replace(/[^a-zA-Z0-9]/g, '_')}_report.csv` : 'professional_report.csv';
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return;
    }
    
    // Fallback to old format
    if (!state.results.report) return;
    const header = 'Variable,Benchmark,Solution,% Change';
    const rows = state.results.report.map(
      (r) => `${r.name},${r.benchmark},${r.solution},${typeof r.change === 'number' && !isNaN(r.change) ? r.change.toFixed(2) : 'N/A'}`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filename = state.project.name ? `${state.project.name.replace(/[^a-zA-Z0-9]/g, '_')}_report.csv` : 'report.csv';
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [state.results.report, state.results.professional_reports]);

  const handleDownloadReportExcel = useCallback(async () => {
    const wb = new ExcelJS.Workbook();
    
    // Handle professional reports format
    if (state.results.professional_reports) {
      // Summary Report Sheet
      if (state.results.professional_reports.summary) {
        const summaryWs = wb.addWorksheet('Summary Report');
        summaryWs.addRow(['Indicator', 'Benchmark', 'After Shock', 'Change (%)']);
        Object.entries(state.results.professional_reports.summary).forEach(([indicator, data]: [string, any]) => {
          const changePercent = (() => {
            const benchmark = data['Benchmark'];
            const afterShock = data['After Shock'];
            const changeValue = data['Change (%)'];
            
            if (typeof changeValue === 'number' && !isNaN(changeValue)) {
              return (changeValue * 100).toFixed(2) + '%';
            }
            
            if (typeof benchmark === 'number' && typeof afterShock === 'number' && benchmark !== 0) {
              const calculatedChange = ((afterShock - benchmark) / benchmark) * 100;
              return calculatedChange.toFixed(2) + '%';
            }
            
            if (typeof benchmark === 'number' && typeof afterShock === 'number' && benchmark === afterShock) {
              return '0.00%';
            }
            
            return 'N/A';
          })();
          summaryWs.addRow([indicator, data['Benchmark'] || 'N/A', data['After Shock'] || 'N/A', changePercent]);
        });
      }
      
      // Sector & Household Report Sheets
      if (state.results.professional_reports.sector_household) {
        Object.entries(state.results.professional_reports.sector_household).forEach(([category, categoryData]: [string, any]) => {
          const categoryWs = wb.addWorksheet(category.substring(0, 31)); // Excel sheet name limit
          categoryWs.addRow(['Item', 'Benchmark', 'After Shock', 'Change (%)']);
          Object.entries(categoryData).forEach(([item, itemData]: [string, any]) => {
            const changePercent = (() => {
              const benchmark = itemData['Benchmark'];
              const afterShock = itemData['After Shock'];
              const changeValue = itemData['Change (%)'];
              
              if (typeof changeValue === 'number' && !isNaN(changeValue)) {
                return (changeValue * 100).toFixed(2) + '%';
              }
              
              if (typeof benchmark === 'number' && typeof afterShock === 'number' && benchmark !== 0) {
                const calculatedChange = ((afterShock - benchmark) / benchmark) * 100;
                return calculatedChange.toFixed(2) + '%';
              }
              
              if (typeof benchmark === 'number' && typeof afterShock === 'number' && benchmark === afterShock) {
                return '0.00%';
              }
              
              return 'N/A';
            })();
            categoryWs.addRow([item, itemData['Benchmark'] || 'N/A', itemData['After Shock'] || 'N/A', changePercent]);
          });
        });
      }
      
      // Demand Matrix Report Sheets
      if (state.results.professional_reports.demand_matrix) {
        Object.entries(state.results.professional_reports.demand_matrix).forEach(([category, categoryData]: [string, any]) => {
          const demandWs = wb.addWorksheet(`Demand_${category}`.substring(0, 31));
          demandWs.addRow(['Consumer', 'Sector', 'Benchmark', 'After Shock', 'Change (%)']);
          Object.entries(categoryData).forEach(([consumer, consumerData]: [string, any]) => {
            Object.entries(consumerData).forEach(([sector, sectorData]: [string, any]) => {
              const changePercent = (() => {
                const benchmark = sectorData['Benchmark'];
                const afterShock = sectorData['After Shock'];
                const changeValue = sectorData['Change (%)'];
                
                if (typeof changeValue === 'number' && !isNaN(changeValue)) {
                  return (changeValue * 100).toFixed(2) + '%';
                }
                
                if (typeof benchmark === 'number' && typeof afterShock === 'number' && benchmark !== 0) {
                  const calculatedChange = ((afterShock - benchmark) / benchmark) * 100;
                  return calculatedChange.toFixed(2) + '%';
                }
                
                if (typeof benchmark === 'number' && typeof afterShock === 'number' && benchmark === afterShock) {
                  return '0.00%';
                }
                
                return 'N/A';
              })();
              demandWs.addRow([consumer, sector, sectorData['Benchmark'] || 'N/A', sectorData['After Shock'] || 'N/A', changePercent]);
            });
          });
        });
      }
      
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filename = state.project.name ? `${state.project.name.replace(/[^a-zA-Z0-9]/g, '_')}_report.xlsx` : 'professional_report.xlsx';
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return;
    }
    
    // Fallback to old format
    if (!state.results.report) return;
    const ws = wb.addWorksheet('Report');
    ws.addRow(['Variable', 'Benchmark', 'Solution', '% Change']);
    state.results.report.forEach((r) => ws.addRow([r.name, r.benchmark, r.solution, r.change]));
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filename = state.project.name ? `${state.project.name.replace(/[^a-zA-Z0-9]/g, '_')}_report.xlsx` : 'report.xlsx';
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [state.results.report, state.results.professional_reports]);

  // ===== Enhanced Summary KPIs and Insights =====
  const summaryKpis = useMemo(() => {
    const pr: any = (state.results as any)?.professional_reports;
    if (!pr || !pr.summary) return [] as Array<{ key: string; benchmark: number; after: number; pct: number }>;
    const toPct = (b: any, a: any, c: any): number => {
      if (typeof c === 'number' && !isNaN(c)) return c * 100;
      if (typeof b === 'number' && typeof a === 'number' && b !== 0) return ((a - b) / b) * 100;
      return 0;
    };
    return Object.entries(pr.summary).map(([key, data]: [string, any]) => ({
      key,
      benchmark: data?.['Benchmark'],
      after: data?.['After Shock'],
      pct: toPct(data?.['Benchmark'], data?.['After Shock'], data?.['Change (%)'])
    }));
  }, [state.results?.professional_reports]);

  const scenarioKpis = useMemo(() => {
    const scen: any = (state.results as any)?.scenario1?.professional_reports;
    if (!scen || !scen.summary) return [] as Array<{ key: string; benchmark: number; after: number; pct: number }>;
    const toPct = (b: any, a: any, c: any): number => {
      if (typeof c === 'number' && !isNaN(c)) return c * 100;
      if (typeof b === 'number' && typeof a === 'number' && b !== 0) return ((a - b) / b) * 100;
      return 0;
    };
    return Object.entries(scen.summary).map(([key, data]: [string, any]) => ({
      key,
      benchmark: data?.['Benchmark'],
      after: data?.['After Shock'],
      pct: toPct(data?.['Benchmark'], data?.['After Shock'], data?.['Change (%)'])
    }));
  }, [state.results?.scenario1]);

  const scenarioKpiMap = useMemo(() => {
    const map: Record<string, { benchmark: number; after: number; pct: number }> = {};
    scenarioKpis.forEach((k) => (map[k.key] = { benchmark: k.benchmark, after: k.after, pct: k.pct }));
    return map;
  }, [scenarioKpis]);

  const generatedInsights = useMemo(() => {
    const pr: any = (state.results as any)?.professional_reports;
    if (!pr) return [] as string[];
    const insights: string[] = [];
    // KPI movements
    summaryKpis.forEach((k) => {
      if (typeof k.after === 'number' && Math.abs(k.pct) >= 0.01) {
        insights.push(`${k.key} ${k.pct >= 0 ? 'increased' : 'decreased'} by ${Math.abs(k.pct).toFixed(2)}% to ${k.after.toFixed(4)}.`);
      }
    });
    const sh = pr.sector_household || {};
    const findCat = (name: string) => {
      const key = Object.keys(sh).find((k) => k.toLowerCase() === name.toLowerCase());
      return key ? sh[key] : undefined;
    };
    const pctFrom = (b: any, a: any, c: any) => (typeof c === 'number' && !isNaN(c) ? c * 100 : typeof b === 'number' && typeof a === 'number' && b !== 0 ? ((a - b) / b) * 100 : 0);

    // Price movers
    const priceCat = findCat('Price');
    if (priceCat) {
      const movers = Object.entries(priceCat)
        .map(([item, d]: [string, any]) => ({ item, pct: pctFrom(d['Benchmark'], d['After Shock'], d['Change (%)']) }))
        .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
        .slice(0, 2)
        .filter((m) => Math.abs(m.pct) > 0.001);
      if (movers.length) insights.push(`Biggest price movers: ${movers.map((m) => `${m.item} ${m.pct >= 0 ? '+' : ''}${m.pct.toFixed(2)}%`).join(', ')}.`);
    }

    // Labor demand breadth
    const laborDemand = findCat('Labor Demand');
    if (laborDemand) {
      let up = 0,
        down = 0;
      Object.values(laborDemand).forEach((d: any) => {
        const pct = pctFrom((d as any)['Benchmark'], (d as any)['After Shock'], (d as any)['Change (%)']);
        if (pct > 0) up++;
        else if (pct < 0) down++;
      });
      if (up || down) insights.push(`Labor demand increased in ${up} sector(s) and decreased in ${down}.`);
    }

    // Supply breadth
    const supply = findCat('Supply');
    if (supply) {
      let up = 0,
        down = 0;
      Object.values(supply).forEach((d: any) => {
        const pct = pctFrom((d as any)['Benchmark'], (d as any)['After Shock'], (d as any)['Change (%)']);
        if (pct > 0) up++;
        else if (pct < 0) down++;
      });
      if (up || down) insights.push(`Supply rose in ${up} sector(s) and fell in ${down}.`);
    }
    return insights.slice(0, 5);
  }, [state.results?.professional_reports, summaryKpis]);

  // Visibility controls for tables
  const [showSummaryTable, setShowSummaryTable] = useState(true);
  const [showSectorHousehold, setShowSectorHousehold] = useState(true);
  const [showDemandMatrix, setShowDemandMatrix] = useState(true);
  const [demandMatrixMode, setDemandMatrixMode] = useState<'table' | 'matrix'>('table');

  // Download SAM file handler
  const handleDownloadSamFile = useCallback(() => {
    if (!state.ui.uploadedFileInfo?.fileData) return;
    
    try {
      // Decode base64 file data
      const binaryString = atob(state.ui.uploadedFileInfo.fileData);
      
      // Convert binary string to Uint8Array for proper binary handling
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const blob = new Blob([bytes], { type: state.ui.uploadedFileInfo.type });
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', state.ui.uploadedFileInfo.name);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      
    }
  }, [state.ui.uploadedFileInfo]);

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200"
      data-project-name={projectName}
    >
      <div className="w-full max-w-7xl mx-auto p-6 space-y-8">
        {/* Modern Header */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white rounded-2xl p-8 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-3 tracking-tight">
                Model Studio
              </h1>
              <p className="text-slate-200 text-lg">
                Advanced CGE modeling platform for economic analysis
              </p>
            </div>
            <div className="hidden md:flex items-center space-x-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <div className="text-sm text-slate-200">Project</div>
                <div className="font-medium text-white">{state.project.name || 'Untitled Project'}</div>
              </div>
              
              {/* File Upload Status */}
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <div className="text-sm text-slate-200">SAM File</div>
                <div className="flex items-center gap-2">
                  {state.ui.uploadedFileInfo ? (
                    <>
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <button
                        onClick={handleDownloadSamFile}
                        className="text-green-300 hover:text-green-100 text-sm font-medium underline cursor-pointer"
                        title="Download uploaded SAM file"
                      >
                        {state.ui.uploadedFileInfo.name}
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                      <span className="text-red-300 text-sm">Not uploaded</span>
                    </>
                  )}
                </div>
              </div>
              
              {/* Save Status Indicator */}
              {projectName && (
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <div className="text-sm text-slate-200">Status</div>
                  <div className="flex items-center gap-2">
                    {saveStatus === 'saving' && (
                      <>
                        <svg className="animate-spin h-4 w-4 text-yellow-300" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a12 12 0 00-12 12h4z"></path>
                        </svg>
                        <span className="text-yellow-300 text-sm">Saving...</span>
                      </>
                    )}
                    {saveStatus === 'saved' && (
                      <>
                        <svg className="h-4 w-4 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-green-300 text-sm">Saved</span>
                      </>
                    )}
                    {saveStatus === 'error' && (
                      <>
                        <svg className="h-4 w-4 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span className="text-red-300 text-sm">Error</span>
                      </>
                    )}
                    {lastSaved && saveStatus === 'saved' && (
                      <span className="text-slate-200 text-xs ml-2">
                        {lastSaved.toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SAM Setup Section */}
        <section className={`transition-all duration-300 ${state.ui.solving ? 'opacity-50 pointer-events-none' : ''}`}>
          <div
            className="flex items-center mb-6 cursor-pointer group"
            onClick={() => dispatch({ type: 'TOGGLE_SECTION', payload: { section: 'samSectionOpen' } })}
          >
            <div className="flex items-center justify-center w-10 h-10 bg-slate-100 text-slate-700 rounded-full mr-4 group-hover:bg-slate-200 transition-colors">
              <span className="text-lg font-bold">1</span>
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-800 group-hover:text-slate-600 transition-colors">SAM Setup</h2>
              <p className="text-slate-500 text-sm">Configure your Social Accounting Matrix</p>
            </div>
            <div className={`transform transition-transform duration-200 ${state.ui.samSectionOpen ? 'rotate-90' : ''}`}>
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
          <div
            className={`bg-white rounded-2xl shadow-lg border border-gray-100 space-y-8 overflow-hidden transition-all duration-500 ${
              state.ui.samSectionOpen ? 'max-h-[5000px] p-8' : 'max-h-0 p-0'
            }`}
          >
          {/* Dimension Configuration */}
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

          <div>
            <label className="block mb-2 font-medium">Upload SAM</label>
            <FileUploader
              onSamLoaded={(sam) => dispatch({ type: 'SET_SAM', payload: sam })}
              goods={state.names.goods}
              factors={FACTOR_NAMES}
              households={state.names.consumers}
              autoPopulateNames={state.names.useSamNames}
              onNamesLoaded={(goods, _factors, households) => {
                dispatch({ type: 'SET_NAMES', payload: { goods, consumers: households } });
              }}
              onFileUploaded={(fileInfo) => {
                dispatch({ type: 'SET_UI_STATE', payload: { uploadedFileInfo: fileInfo } });
              }}
              uploadedFileInfo={state.ui.uploadedFileInfo}
            />
            {state.errors.sam && (
              <p className="mt-2 text-sm text-danger">{state.errors.sam}</p>
            )}
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
                      className="bg-slate-600 hover:bg-slate-700 text-white font-medium px-4 py-2 text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
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
                        className="bg-slate-700 hover:bg-slate-800 text-white font-medium px-4 py-2 text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
                      >
                        Apply Changes
                      </button>
                      <button
                        onClick={handleCancelGoodsEdit}
                        className="bg-slate-500 hover:bg-slate-600 text-white font-medium px-4 py-2 text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
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
                      className="bg-slate-600 hover:bg-slate-700 text-white font-medium px-4 py-2 text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
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
                        className="bg-slate-700 hover:bg-slate-800 text-white font-medium px-4 py-2 text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
                      >
                        Apply Changes
                      </button>
                      <button
                        onClick={handleCancelConsumersEdit}
                        className="bg-slate-500 hover:bg-slate-600 text-white font-medium px-4 py-2 text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
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
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download CSV
                </button>
                <button
                  onClick={handleDownloadExcel}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-medium py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
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
        <section className={`transition-all duration-300 ${state.ui.solving ? 'opacity-50 pointer-events-none' : ''}`}>
          <div
            className="flex items-center mb-6 cursor-pointer group"
            onClick={() => dispatch({ type: 'TOGGLE_SECTION', payload: { section: 'benchmarkSectionOpen' } })}
          >
            <div className="flex items-center justify-center w-10 h-10 bg-slate-200 text-slate-700 rounded-full mr-4 group-hover:bg-slate-300 transition-colors">
              <span className="text-lg font-bold">2</span>
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-800 group-hover:text-slate-600 transition-colors">Benchmark Prices</h2>
              <p className="text-slate-500 text-sm">Set baseline prices for goods and labor</p>
            </div>
            <div className={`transform transition-transform duration-200 ${state.ui.benchmarkSectionOpen ? 'rotate-90' : ''}`}>
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
          <div
            className={`bg-white rounded-2xl shadow-lg border border-gray-100 space-y-8 overflow-hidden transition-all duration-500 ${
              state.ui.benchmarkSectionOpen ? 'max-h-[5000px] p-8' : 'max-h-0 p-0'
            }`}
          >
            {/* Warning Notice */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-400 rounded-r-lg p-4 mb-6 shadow-sm">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-amber-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-amber-800 font-medium text-sm mb-1">
                    ⚠️ Important: Benchmark Price Calibration
                  </h4>
                  <p className="text-amber-700 text-sm leading-relaxed">
                    These prices are typically calibrated to <strong>1.0</strong> for normalization. 
                    Changing these values is <strong>not recommended</strong> unless you have specific requirements. 
                    If you need different relative prices, consider updating your <strong>SAM matrix</strong> instead 
                    to reflect the desired economic structure.
                  </p>
                  <div className="mt-2 flex items-center space-x-1 text-xs text-amber-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Default values (1.0) ensure proper model calibration</span>
                  </div>
                </div>
              </div>
            </div>
          
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
        <section className={`transition-all duration-300 ${state.ui.solving ? 'opacity-50 pointer-events-none' : ''}`}>
          <div
            className="flex items-center mb-6 cursor-pointer group"
            onClick={() => dispatch({ type: 'TOGGLE_SECTION', payload: { section: 'calibrationSectionOpen' } })}
          >
            <div className="flex items-center justify-center w-10 h-10 bg-slate-300 text-slate-700 rounded-full mr-4 group-hover:bg-slate-400 transition-colors">
              <span className="text-lg font-bold">3</span>
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-800 group-hover:text-slate-600 transition-colors">Model Calibration</h2>
              <p className="text-slate-500 text-sm">Configure model parameters and coefficients</p>
            </div>
            <div className={`transform transition-transform duration-200 ${state.ui.calibrationSectionOpen ? 'rotate-90' : ''}`}>
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
          <div
            className={`bg-white rounded-2xl shadow-lg border border-gray-100 space-y-8 overflow-hidden transition-all duration-500 ${
              state.ui.calibrationSectionOpen ? 'max-h-[5000px] p-8' : 'max-h-0 p-0'
            }`}
          >
            <div>
              <label className="block mb-4 font-medium text-gray-800">Calibration Mode:</label>
              
              {/* Modern Radio Button Options */}
              <div className="space-y-3 mb-6">
                <label className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 hover:bg-gray-50 ${
                    state.parameters.calibrationMode === 'auto' 
                      ? 'border-blue-300 bg-blue-50 shadow-md' 
                      : 'border-gray-200 bg-white'
                  }`}>
                  <input
                    type="radio"
                    checked={state.parameters.calibrationMode === 'auto'}
                    onChange={() => dispatch({ 
                      type: 'SET_PARAMETERS', 
                      payload: { calibrationMode: 'auto' } 
                    })}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 focus:ring-2"
                  />
                  <div className="ml-3">
                    <span className="font-medium text-gray-900">Auto-calibrate</span>
                    <span className="ml-2 text-sm italic text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 shadow-sm">
                      ✨ recommended
                    </span>
                    <p className="text-sm text-gray-600 mt-1">
                      Automatically calibrates parameters from SAM data using established econometric methods
                    </p>
                  </div>
                </label>
                
                <label className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 hover:bg-gray-50 ${
                    state.parameters.calibrationMode === 'manual' 
                      ? 'border-blue-300 bg-blue-50 shadow-md' 
                      : 'border-gray-200 bg-white'
                  }`}>
                  <input
                    type="radio"
                    checked={state.parameters.calibrationMode === 'manual'}
                    onChange={() => dispatch({ 
                      type: 'SET_PARAMETERS', 
                      payload: { calibrationMode: 'manual' } 
                    })}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 focus:ring-2"
                  />
                  <div className="ml-3">
                    <span className="font-medium text-gray-900">Manual input</span>
                    <p className="text-sm text-gray-600 mt-1">
                      Manually specify calibration parameters based on your research
                    </p>
                  </div>
                </label>
              </div>

              {/* Warning Notice for Manual Mode */}
              {state.parameters.calibrationMode === 'manual' && (
                <div className="bg-gradient-to-r from-red-50 to-pink-50 border-l-4 border-red-400 rounded-r-lg p-4 mb-6 shadow-sm">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <svg className="w-5 h-5 text-red-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-red-800 font-medium text-sm mb-1">
                        🔬 Advanced Users Only: Manual Calibration
                      </h4>
                      <p className="text-red-700 text-sm leading-relaxed">
                        Manual calibration should <strong>only be used after deep econometric analysis</strong> and 
                        thorough understanding of your model's parameters. Incorrect values can lead to 
                        unrealistic or unstable model behavior.
                      </p>
                      <div className="mt-2 flex items-center space-x-1 text-xs text-red-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <span>Ensure parameters are econometrically validated before use</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
                  className="bg-violet-600 hover:bg-violet-700 text-white font-medium py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 text-sm mt-2"
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
        <section className={`transition-all duration-300 ${state.ui.solving ? 'opacity-50 pointer-events-none' : ''}`}>
          <div
            className="flex items-center mb-6 cursor-pointer group"
            onClick={() => dispatch({ type: 'TOGGLE_SECTION', payload: { section: 'closureSectionOpen' } })}
          >
            <div className="flex items-center justify-center w-10 h-10 bg-slate-400 text-white rounded-full mr-4 group-hover:bg-slate-500 transition-colors">
              <span className="text-lg font-bold">4</span>
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-800 group-hover:text-slate-600 transition-colors">Define Closure Rules</h2>
              <p className="text-slate-500 text-sm">Set model constraints and equilibrium conditions</p>
            </div>
            <div className={`transform transition-transform duration-200 ${state.ui.closureSectionOpen ? 'rotate-90' : ''}`}>
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
          <div
            className={`bg-white rounded-2xl shadow-lg border border-gray-100 space-y-8 overflow-hidden transition-all duration-500 ${
              state.ui.closureSectionOpen ? 'max-h-[5000px] p-8' : 'max-h-0 p-0'
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
        <section className={`transition-all duration-300 ${state.ui.solving ? 'opacity-50 pointer-events-none' : ''}`}>
          <div
            className="flex items-center mb-6 cursor-pointer group"
            onClick={() => dispatch({ type: 'TOGGLE_SECTION', payload: { section: 'shockSectionOpen' } })}
          >
            <div className="flex items-center justify-center w-10 h-10 bg-slate-500 text-white rounded-full mr-4 group-hover:bg-slate-600 transition-colors">
              <span className="text-lg font-bold">5</span>
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-800 group-hover:text-slate-600 transition-colors">Apply Economic Shocks</h2>
              <p className="text-slate-500 text-sm">Define external economic disturbances</p>
            </div>
            <div className={`transform transition-transform duration-200 ${state.ui.shockSectionOpen ? 'rotate-90' : ''}`}>
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
          <div
            className={`bg-white rounded-2xl shadow-lg border border-gray-100 space-y-8 overflow-hidden transition-all duration-500 ${
              state.ui.shockSectionOpen ? 'max-h-[5000px] p-8' : 'max-h-0 p-0'
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
            className="flex items-center mb-6 cursor-pointer group"
            onClick={() => dispatch({ type: 'TOGGLE_SECTION', payload: { section: 'solveSectionOpen' } })}
          >
            <div className="flex items-center justify-center w-10 h-10 bg-slate-600 text-white rounded-full mr-4 group-hover:bg-slate-700 transition-colors">
              <span className="text-lg font-bold">6</span>
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-800 group-hover:text-slate-600 transition-colors">Solve & Generate Report</h2>
              <p className="text-slate-500 text-sm">Run the model and analyze results</p>
            </div>
            <div className={`transform transition-transform duration-200 ${state.ui.solveSectionOpen ? 'rotate-90' : ''}`}>
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
          <div
            className={`bg-white rounded-2xl shadow-lg border border-gray-100 space-y-8 overflow-hidden transition-all duration-500 ${
              state.ui.solveSectionOpen ? 'max-h-[5000px] p-8' : 'max-h-0 p-0'
            }`}
          >
          
          {/* Scenario Management Controls */}
          {(state.results.report || state.results.professional_reports) && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-6">
              <h4 className="text-lg font-semibold text-gray-800 mb-4">Scenario Management</h4>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    const scenarioName = prompt('Enter a name for Scenario 1:', 'Baseline Scenario');
                    if (scenarioName) {
                      dispatch({ type: 'SAVE_SCENARIO', payload: { scenarioNumber: 1, name: scenarioName } });
                    }
                  }}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white font-medium py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Save as Scenario 1
                </button>
                
                {state.results.scenario1 && (
                  <button
                    onClick={() => {
                      const scenarioName = prompt('Enter a name for Scenario 2:', 'Alternative Scenario');
                      if (scenarioName) {
                        dispatch({ type: 'SAVE_SCENARIO', payload: { scenarioNumber: 2, name: scenarioName } });
                      }
                    }}
                    className="bg-sky-600 hover:bg-sky-700 text-white font-medium py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Save as Scenario 2
                  </button>
                )}
                
                {state.results.scenario1 && state.results.scenario2 && (
                  <button
                    onClick={() => dispatch({ type: 'TOGGLE_COMPARISON_MODE' })}
                    className={`font-medium py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2 ${
                      state.results.comparisonMode 
                        ? 'bg-orange-600 hover:bg-orange-700 text-white' 
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    {state.results.comparisonMode ? 'Exit Comparison' : 'Compare Scenarios'}
                  </button>
                )}
              </div>
              
              {state.results.scenario1 && (
                <div className="mt-4 text-sm text-gray-600">
                  <span className="font-medium">Saved Scenarios:</span>
                  <span className="ml-2 bg-cyan-100 text-cyan-800 px-2 py-1 rounded">{state.results.scenario1.name}</span>
                  {state.results.scenario2 && (
                    <span className="ml-2 bg-sky-100 text-sky-800 px-2 py-1 rounded">{state.results.scenario2.name}</span>
                  )}
                </div>
              )}
            </div>
          )}
          
          <button
            onClick={handleSolve}
            disabled={state.ui.solving}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center text-lg"
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
          
          {/* Error Message */}
          {state.ui.solveError && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-red-800 mb-1">Model Solving Failed</h4>
                  <p className="text-sm text-red-700">{state.ui.solveError}</p>
                  <button
                    onClick={() => dispatch({ type: 'SET_UI_STATE', payload: { solveError: undefined } })}
                    className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {state.results.professional_reports ? (
            // Professional Reports Display
            <div className="mt-6 space-y-6">
              {/* Hero Analytics Dashboard */}
              {summaryKpis.length > 0 && (
                <div className="relative mb-8">
                  {/* Animated gradient background */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-800 rounded-3xl opacity-[0.07] animate-pulse"></div>
                  <div className="absolute inset-0 bg-gradient-to-tl from-emerald-500 via-cyan-500 to-blue-500 rounded-3xl opacity-[0.05]"></div>
                  
                  <div className="relative bg-white/70 backdrop-blur-xl border border-white/30 rounded-3xl p-8 shadow-2xl">
                    {/* Header Section */}
                    <div className="mb-8 text-center">
                      <div className="inline-flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                          <span className="text-white text-2xl">📈</span>
                        </div>
                        <div>
                          <h3 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                            Economic Impact Analytics
                          </h3>
                          <p className="text-gray-600 text-sm mt-1">Real-time insights from your policy simulation</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* KPI Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      {summaryKpis.slice(0, 8).map((kpi, index) => {
                        const gradients = [
                          'from-blue-500 to-cyan-500',
                          'from-purple-500 to-pink-500', 
                          'from-emerald-500 to-teal-500',
                          'from-orange-500 to-red-500',
                          'from-indigo-500 to-purple-500',
                          'from-green-500 to-emerald-500',
                          'from-rose-500 to-pink-500',
                          'from-yellow-500 to-orange-500'
                        ];
                        const gradient = gradients[index % gradients.length];
                        const icons = ['💰', '📊', '📈', '🎯', '⚡', '🚀', '💎', '🔥'];
                        const icon = icons[index % icons.length];
                        
                        return (
                          <div key={kpi.key} className="group relative">
                            {/* Glow effect */}
                            <div className={`absolute -inset-0.5 bg-gradient-to-r ${gradient} rounded-2xl opacity-20 group-hover:opacity-40 transition-all duration-500 blur-sm group-hover:blur-none`}></div>
                            
                            {/* Main card */}
                            <div className="relative bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-white/50 hover:shadow-2xl transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1">
                              
                              {/* Header with icon */}
                              <div className="flex items-center justify-between mb-4">
                                <div className="text-xs uppercase tracking-widest text-gray-500 font-bold">
                                  {kpi.key.length > 12 ? kpi.key.substring(0, 12) + '...' : kpi.key}
                                </div>
                                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg transform group-hover:rotate-12 transition-transform duration-300`}>
                                  <span className="text-white text-lg">{icon}</span>
                                </div>
                              </div>
                              
                              {/* Main metric */}
                              <div className="mb-3">
                                <div className="text-2xl font-bold text-gray-800 mb-1">
                                  {typeof kpi.after === 'number' ? kpi.after.toFixed(4) : 'N/A'}
                                </div>
                                <div className="text-xs text-gray-500">
                                  Baseline: {typeof kpi.benchmark === 'number' ? kpi.benchmark.toFixed(4) : 'N/A'}
                                </div>
                              </div>
                              
                              {/* Change indicator */}
                              <div className="flex items-center justify-between">
                                <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold ${
                                  kpi.pct >= 0 
                                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                                    : 'bg-red-100 text-red-700 border border-red-200'
                                }`}>
                                  <span className="mr-1.5 text-sm">
                                    {kpi.pct >= 0 ? '↗️' : '↘️'}
                                  </span>
                                  {kpi.pct >= 0 ? '+' : ''}{kpi.pct.toFixed(2)}%
                                </div>
                                
                                {/* Scenario comparison badge */}
                                {state.results?.comparisonMode && (state.results as any)?.scenario1 && scenarioKpiMap[kpi.key] && (
                                  <div className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium border ${
                                    scenarioKpiMap[kpi.key].pct >= 0 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-orange-50 text-orange-700 border-orange-200'
                                  }`}>
                                    <span className="mr-1">📊</span>
                                    {scenarioKpiMap[kpi.key].pct >= 0 ? '+' : ''}{scenarioKpiMap[kpi.key].pct.toFixed(1)}%
                                  </div>
                                )}
                              </div>
                              
                              {/* Percentage change indicator */}
                              <div className="mt-4">
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                  <div 
                                    className={`${
                                      kpi.pct >= 0 
                                        ? 'bg-gradient-to-r from-emerald-400 to-green-500' 
                                        : 'bg-gradient-to-r from-red-400 to-red-500'
                                    } h-1.5 rounded-full transition-all duration-1000 ease-out`}
                                    style={{ width: `${Math.min(Math.abs(kpi.pct), 100)}%` }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Key Insights */}
              {generatedInsights.length > 0 && (
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl opacity-10"></div>
                  <div className="relative bg-white/80 backdrop-blur-sm border border-white/40 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                        <span className="text-white text-lg">💡</span>
                      </div>
                      <div>
                        <h4 className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                          Key Insights
                        </h4>
                        <p className="text-xs text-gray-500">Important findings from your simulation results</p>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {generatedInsights.map((i, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-r from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-white text-xs font-bold">{idx + 1}</span>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed">{i}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {/* Summary Report */}
              {state.results.professional_reports.summary && summaryKpis.length === 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-lg font-medium text-blue-600">Detailed Summary</h4>
                    <button
                      className="text-sm text-blue-700 hover:text-blue-900 underline"
                      onClick={() => setShowSummaryTable((v) => !v)}
                    >
                      {showSummaryTable ? 'Hide' : 'Show'} Table
                    </button>
                  </div>
                  {showSummaryTable && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border border-gray-300 rounded-lg">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 border-r border-gray-300">Indicator</th>
                          <th className="px-4 py-2 border-r border-gray-300">Benchmark</th>
                          <th className="px-4 py-2 border-r border-gray-300">After Shock</th>
                          <th className="px-4 py-2 border-r border-gray-300">Change (%)</th>
                          {state.results.comparisonMode && state.results.scenario1 && (
                            <th className="px-4 py-2 bg-cyan-50 text-cyan-700">{state.results.scenario1.name}</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(state.results.professional_reports.summary).map(([indicator, data]: [string, any]) => {
                          const scenario1Data = state.results.comparisonMode && state.results.scenario1?.professional_reports?.summary?.[indicator];
                          return (
                            <tr key={indicator} className="hover:bg-gray-50 border-b border-gray-200">
                              <td className="px-4 py-2 border-r border-gray-300 font-medium">{indicator}</td>
                              <td className="px-4 py-2 border-r border-gray-300 text-right">
                                {typeof data['Benchmark'] === 'number' ? data['Benchmark'].toFixed(4) : 'N/A'}
                              </td>
                              <td className="px-4 py-2 border-r border-gray-300 text-right">
                                {typeof data['After Shock'] === 'number' ? data['After Shock'].toFixed(4) : 'N/A'}
                              </td>
                              <td className="px-4 py-2 border-r border-gray-300 text-right">
                                {(() => {
                                  const benchmark = data['Benchmark'];
                                  const afterShock = data['After Shock'];
                                  const changePercent = data['Change (%)'];
                                  
                                  if (typeof changePercent === 'number' && !isNaN(changePercent)) {
                                    return (changePercent * 100).toFixed(2) + '%';
                                  }
                                  
                                  // Calculate manually if change percent is missing but we have benchmark and after shock
                                  if (typeof benchmark === 'number' && typeof afterShock === 'number' && benchmark !== 0) {
                                    const calculatedChange = ((afterShock - benchmark) / benchmark) * 100;
                                    return calculatedChange.toFixed(2) + '%';
                                  }
                                  
                                  // If benchmark and after shock are the same, it's 0% change
                                  if (typeof benchmark === 'number' && typeof afterShock === 'number' && benchmark === afterShock) {
                                    return '0.00%';
                                  }
                                  
                                  return 'N/A';
                                })()}
                              </td>
                              {state.results.comparisonMode && state.results.scenario1 && (
                                <td className="px-4 py-2 bg-cyan-50 text-right">
                                  {scenario1Data && typeof scenario1Data['After Shock'] === 'number' 
                                    ? scenario1Data['After Shock'].toFixed(4) 
                                    : 'N/A'
                                  }
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  )}
                </div>
              )}

              {/* Household Analytics Matrix */}
              {state.results.professional_reports.sector_household && (
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-2xl opacity-8"></div>
                  <div className="relative bg-white/75 backdrop-blur-sm border border-white/40 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                          <span className="text-white text-lg">🏠</span>
                        </div>
                <div>
                          <h4 className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                            Household Analytics
                          </h4>
                          <p className="text-xs text-gray-500">Income and labor supply by household</p>
                      </div>
                    </div>
                      <button
                        className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-xl hover:bg-emerald-200 transition-colors duration-300 text-sm font-medium border border-emerald-200"
                        onClick={() => setShowSectorHousehold((v) => !v)}
                      >
                        {showSectorHousehold ? '🙈 Hide' : '👁️ Show'}
                      </button>
                    </div>
                    {showSectorHousehold && (
                      <HouseholdAnalyticsMatrix 
                        householdData={state.results.professional_reports.sector_household}
                        comparisonMode={state.results.comparisonMode}
                        scenario1={state.results.scenario1}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Sector Analytics - Independent Section */}
              {state.results.professional_reports.sector_household && (
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 rounded-2xl opacity-8"></div>
                  <div className="relative bg-white/75 backdrop-blur-sm border border-white/40 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 flex items-center justify-center shadow-lg">
                          <span className="text-white text-lg">🏭</span>
                        </div>
                        <div>
                          <h4 className="text-xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                            Sector Analytics
                          </h4>
                          <p className="text-xs text-gray-500">Economic indicators by sector</p>
                        </div>
                      </div>
                      <button
                        className="px-4 py-2 bg-orange-100 text-orange-700 rounded-xl hover:bg-orange-200 transition-colors duration-300 text-sm font-medium border border-orange-200"
                        onClick={() => setShowSectorHousehold((v) => !v)}
                      >
                        {showSectorHousehold ? '🙈 Hide' : '👁️ Show'}
                      </button>
                    </div>
                    {showSectorHousehold && (
                      <SectorAnalyticsMatrix 
                        sectorData={state.results.professional_reports.sector_household}
                        comparisonMode={state.results.comparisonMode}
                        scenario1={state.results.scenario1}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Demand Matrix Report */}
              {state.results.professional_reports.demand_matrix && (
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-400 via-blue-400 to-slate-500 rounded-2xl opacity-8"></div>
                  <div className="relative bg-white/75 backdrop-blur-sm border border-white/40 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-slate-500 to-blue-600 flex items-center justify-center shadow-lg">
                          <span className="text-white text-lg">📊</span>
                        </div>
                <div>
                          <h4 className="text-xl font-bold bg-gradient-to-r from-slate-600 to-blue-600 bg-clip-text text-transparent">
                            Demand Matrix Report
                          </h4>
                          <p className="text-xs text-gray-500">Consumer-sector demand relationships</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors duration-300 text-sm font-medium border border-slate-200"
                          onClick={() => setDemandMatrixMode((m) => (m === 'table' ? 'matrix' : 'table'))}
                          title="Switch between table and matrix cards view"
                        >
                          {demandMatrixMode === 'table' ? '🔲 Matrix' : '📊 Table'}
                        </button>
                        <button
                          className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors duration-300 text-sm font-medium border border-slate-200"
                          onClick={() => setShowDemandMatrix((v) => !v)}
                        >
                          {showDemandMatrix ? '🙈 Hide' : '👁️ Show'}
                        </button>
                      </div>
                    </div>
                  {showDemandMatrix && (
                    <>
                  {Object.entries(state.results.professional_reports.demand_matrix).map(([category, categoryData]: [string, any]) => (
                    <div key={category} className="mb-6">
                      <h5 className="text-md font-medium mb-3 text-gray-700">{category}</h5>
                      {demandMatrixMode === 'table' ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border border-gray-300 rounded-lg">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 border-r border-gray-300">Consumer</th>
                              <th className="px-3 py-2 border-r border-gray-300">Sector</th>
                              <th className="px-3 py-2 border-r border-gray-300">Benchmark</th>
                              <th className="px-3 py-2 border-r border-gray-300">After Shock</th>
                              <th className="px-3 py-2 border-r border-gray-300">Change (%)</th>
                              {state.results.comparisonMode && state.results.scenario1 && (
                                <th className="px-3 py-2 bg-cyan-50 text-cyan-700">{state.results.scenario1.name}</th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(categoryData).map(([consumer, consumerData]: [string, any]) =>
                              Object.entries(consumerData).map(([sector, sectorData]: [string, any]) => {
                                const scenario1Data = state.results.comparisonMode && state.results.scenario1?.professional_reports?.demand_matrix?.[category]?.[consumer]?.[sector];
                                return (
                                  <tr key={`${consumer}-${sector}`} className="hover:bg-gray-50 border-b border-gray-200">
                                    <td className="px-3 py-2 border-r border-gray-300 font-medium">{consumer}</td>
                                    <td className="px-3 py-2 border-r border-gray-300 font-medium">{sector}</td>
                                    <td className="px-3 py-2 border-r border-gray-300 text-right">
                                      {typeof sectorData['Benchmark'] === 'number' ? sectorData['Benchmark'].toFixed(4) : 'N/A'}
                                    </td>
                                    <td className="px-3 py-2 border-r border-gray-300 text-right">
                                      {typeof sectorData['After Shock'] === 'number' ? sectorData['After Shock'].toFixed(4) : 'N/A'}
                                    </td>
                                    <td className="px-3 py-2 border-r border-gray-300 text-right">
                                      {(() => {
                                        const benchmark = sectorData['Benchmark'];
                                        const afterShock = sectorData['After Shock'];
                                        const changePercent = sectorData['Change (%)'];
                                          if (typeof changePercent === 'number' && !isNaN(changePercent)) return (changePercent * 100).toFixed(2) + '%';
                                          if (typeof benchmark === 'number' && typeof afterShock === 'number' && benchmark !== 0) return (((afterShock - benchmark) / benchmark) * 100).toFixed(2) + '%';
                                          if (typeof benchmark === 'number' && typeof afterShock === 'number' && benchmark === afterShock) return '0.00%';
                                        return 'N/A';
                                      })()}
                                    </td>
                                    {state.results.comparisonMode && state.results.scenario1 && (
                                      <td className="px-3 py-2 bg-cyan-50 text-right">
                                          {scenario1Data && typeof scenario1Data['After Shock'] === 'number' ? scenario1Data['After Shock'].toFixed(4) : 'N/A'}
                                      </td>
                                    )}
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                        </div>
                      ) : (
                        // Matrix KPI Cards view
                        <div className="overflow-x-auto">
                          {(() => {
                            const consumers = Object.keys(categoryData || {});
                            const allSectorsSet: Record<string, boolean> = {};
                            consumers.forEach((c) => {
                              Object.keys((categoryData as any)[c] || {}).forEach((s) => (allSectorsSet[s] = true));
                            });
                            const sectors = Object.keys(allSectorsSet);
                            const header = (
                              <div className="grid sticky top-0 z-10 bg-gradient-to-r from-slate-50 to-blue-50 backdrop-blur-sm rounded-t-xl border-b border-slate-200" style={{ gridTemplateColumns: `200px repeat(${sectors.length}, minmax(160px, 1fr))` }}>
                                <div className="px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest">Consumer / Sector</div>
                                {sectors.map((s, idx) => (
                                  <div key={s} className="px-2 py-3 text-xs uppercase tracking-widest text-slate-600 font-bold text-center">
                                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r ${
                                      idx % 2 === 0 ? 'from-slate-100 to-blue-100' : 'from-blue-100 to-slate-100'
                                    } border border-slate-200`}>
                                      <span>🏭</span>
                                      {s}
                      </div>
                    </div>
                  ))}
                              </div>
                            );
                            const rows = consumers.map((consumer, consumerIdx) => (
                              <div key={consumer} className="grid items-stretch hover:bg-slate-50/30 transition-colors duration-200" style={{ gridTemplateColumns: `200px repeat(${sectors.length}, minmax(160px, 1fr))` }}>
                                <div className="pr-3 py-4 flex items-center">
                                  <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-slate-100 to-blue-100 border border-slate-200 rounded-xl">
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-slate-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                                      {consumerIdx + 1}
                                    </div>
                                    <span className="text-sm font-bold text-slate-700">{consumer}</span>
                                  </div>
                                </div>
                                {sectors.map((sector) => {
                                  const cell: any = (categoryData as any)?.[consumer]?.[sector] || {};
                                  const bench = cell['Benchmark'];
                                  const after = cell['After Shock'];
                                  const pct = (() => {
                                    const changePercent = cell['Change (%)'];
                                    if (typeof changePercent === 'number' && !isNaN(changePercent)) return changePercent * 100;
                                    if (typeof bench === 'number' && typeof after === 'number' && bench !== 0) return ((after - bench) / bench) * 100;
                                    return 0;
                                  })();
                                  const scenarioCell: any = state.results.comparisonMode && state.results.scenario1?.professional_reports?.demand_matrix?.[category]?.[consumer]?.[sector];
                                  const scenarioAfter = typeof scenarioCell?.['After Shock'] === 'number' ? scenarioCell['After Shock'] : null;
                                  return (
                                    <div key={`${consumer}-${sector}`} className="group m-1 relative">
                                      {/* Gradient glow */}
                                      <div className={`absolute -inset-0.5 rounded-xl opacity-20 group-hover:opacity-40 transition-all duration-300 ${
                                        pct >= 0 
                                          ? 'bg-gradient-to-r from-emerald-400 to-teal-500' 
                                          : 'bg-gradient-to-r from-red-400 to-pink-500'
                                      }`}></div>
                                      
                                      {/* Main card */}
                                      <div className="relative bg-white/90 backdrop-blur-sm border border-white/50 rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                                        {/* Header with direction indicator */}
                                        <div className="flex items-center justify-end mb-3">
                                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs ${
                                            pct >= 0 ? 'bg-gradient-to-r from-emerald-400 to-green-500' : 'bg-gradient-to-r from-red-400 to-red-500'
                                          }`}>
                                            {pct >= 0 ? '↗' : '↘'}
                                          </div>
                                        </div>
                                        
                                        {/* Main value */}
                                        <div className="mb-2">
                                          <div className="text-lg font-bold text-gray-800">
                                            {typeof after === 'number' ? after.toFixed(4) : 'N/A'}
                                          </div>
                                        </div>
                                        
                                        {/* Change badge */}
                                        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold mb-2 ${
                                          pct >= 0 
                                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                                            : 'bg-red-100 text-red-700 border border-red-200'
                                        }`}>
                                          {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                                        </div>
                                        
                                        {/* Benchmark */}
                                        <div className="text-[10px] text-gray-500 mb-1">
                                          Base: {typeof bench === 'number' ? bench.toFixed(4) : 'N/A'}
                                        </div>
                                        
                                        {/* Scenario comparison */}
                                        {scenarioAfter !== null && (
                                          <div className="text-[10px] text-blue-600 font-medium">
                                            📊 {scenarioAfter.toFixed(4)}
                                          </div>
                                        )}
                                        
                                        {/* Percentage change indicator */}
                                        <div className="mt-3">
                                          <div className="w-full bg-gray-200 rounded-full h-1">
                                            <div 
                                              className={`h-1 rounded-full transition-all duration-1000 ${
                                                pct >= 0 
                                                  ? 'bg-gradient-to-r from-emerald-400 to-green-500' 
                                                  : 'bg-gradient-to-r from-red-400 to-red-500'
                                              }`}
                                              style={{ width: `${Math.min(Math.abs(pct), 100)}%` }}
                                            ></div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ));
                            return (
                              <div className="relative">
                                <div className="absolute inset-0 bg-gradient-to-br from-slate-200 via-blue-200 to-slate-300 rounded-2xl opacity-20"></div>
                                <div className="relative bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl shadow-2xl overflow-hidden">
                                  {header}
                                  <div className="divide-y divide-slate-100">
                                    {rows}
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  ))}
                    </>
                  )}
                  </div>
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
              <table className="w-full text-left border border-gray-300 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 border-r border-gray-300">Variable</th>
                    <th className="px-4 py-2 border-r border-gray-300">Benchmark</th>
                    <th className="px-4 py-2 border-r border-gray-300">Solution</th>
                    <th className="px-4 py-2 border-r border-gray-300">% Change</th>
                    {state.results.comparisonMode && state.results.scenario1 && (
                      <th className="px-4 py-2 bg-blue-50 text-blue-700">{state.results.scenario1.name}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {state.results.report.map((r) => {
                    const scenario1Item = state.results.comparisonMode && state.results.scenario1?.report?.find(item => item.name === r.name);
                    return (
                      <tr key={r.name} className="hover:bg-gray-50 border-b border-gray-200">
                        <td className="px-4 py-2 border-r border-gray-300 font-medium">{r.name}</td>
                        <td className="px-4 py-2 border-r border-gray-300 text-right">{r.benchmark.toFixed(2)}</td>
                        <td className="px-4 py-2 border-r border-gray-300 text-right">{r.solution.toFixed(2)}</td>
                        <td className="px-4 py-2 border-r border-gray-300 text-right">
                          {typeof r.change === 'number' && !isNaN(r.change) ? r.change.toFixed(2) + '%' : 'N/A'}
                        </td>
                        {state.results.comparisonMode && state.results.scenario1 && (
                          <td className="px-4 py-2 bg-blue-50 text-right">
                            {scenario1Item ? scenario1Item.solution.toFixed(2) : 'N/A'}
                          </td>
                        )}
                      </tr>
                    );
                  })}
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
    </div>
  );
};

export default ModelStudioPage;