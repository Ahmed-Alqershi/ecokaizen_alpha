import { useState, useEffect, useCallback } from 'react';
import TemplateCard from '../components/TemplateCard';
import SAMTable from '../components/SAMTable';
import ParameterInputs from '../components/ParameterInputs';
import FileUploader from '../components/FileUploader';
import ResultsDisplay from '../components/ResultsDisplay';
import ComparisonDisplay from '../components/ComparisonDisplay';
import { ModelTemplate, SAM, ModelParameters, ModelResults, ScenarioComparison } from '../utils/types';
import templates from '../utils/templateData';
import {
  generateDefaultSam,
  generateEmptySam,
  generateKoreaSam,
  generateSaudiSam,
  validateSam,
  exportSamToCsv,
  exportSamToExcel,
} from '../utils/samUtils';
import { solveModel, compareScenarios } from '../utils/api';

const ModelBuilderPage = () => {
  // Step tracking
  const [currentStep, setCurrentStep] = useState<number>(1);
  
  // Template selection state
  const [selectedTemplate, setSelectedTemplate] = useState<ModelTemplate | null>(null);
  
  // Customization options
  const [useCustomModel, setUseCustomModel] = useState<boolean | null>(null);
  const [sectorCount, setSectorCount] = useState<number>(2);
  const [factorCount, setFactorCount] = useState<number>(2);
  const [householdCount, setHouseholdCount] = useState<number>(1);
  
  // Custom names for sectors, factors, and households
  const [sectorNames, setSectorNames] = useState<string[]>(['SECTOR1', 'SECTOR2']);
  const [factorNames, setFactorNames] = useState<string[]>(['FACTOR1', 'FACTOR2']);
  const [householdNames, setHouseholdNames] = useState<string[]>(['HH1']);
  const [useCustomNames, setUseCustomNames] = useState<boolean>(false);
  const [populateNamesFromFile, setPopulateNamesFromFile] = useState<boolean>(false);
  
  // SAM data
  // Use functional initializer so the default SAM is generated only once
  const [samData, setSamData] = useState<SAM>(() => generateDefaultSam());
  const [isCustomSam, setIsCustomSam] = useState<boolean>(false);
  const [samConfigured, setSamConfigured] = useState<boolean>(false);
  const [samValid, setSamValid] = useState<boolean>(true);
  const [samValidationMessage, setSamValidationMessage] = useState<string | null>(null);
  
  // Parameters
  const [modelParameters, setModelParameters] = useState<ModelParameters>({
    alpha: [0.3, 0.7],
    b: [1.0, 1.0]
  });
  
  // Results
  const [modelResults, setModelResults] = useState<ModelResults | null>(null);
  
  // Scenario
  const [runningScenario, setRunningScenario] = useState<boolean>(false);
  const [scenarioParameters, setScenarioParameters] = useState<ModelParameters | null>(null);
  const [comparisonResults, setComparisonResults] = useState<ScenarioComparison | null>(null);
  
  // Loading states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [detailedError, setDetailedError] = useState<string | null>(null);
  
  // Reset when template changes
  useEffect(() => {
    if (selectedTemplate) {
      // Initialize defaults for known templates
      if (selectedTemplate.id === 'simple-cge') {
        setSamData(generateDefaultSam());
        setModelParameters({
          alpha: [0.3, 0.7],
          b: [1.0, 1.0]
        });
        setSectorCount(2);
        setFactorCount(2);
        setHouseholdCount(1);
        setSectorNames(['SECTOR1', 'SECTOR2']);
        setFactorNames(['FACTOR1', 'FACTOR2']);
        setHouseholdNames(['HH1']);
        setUseCustomNames(false);
      } else if (selectedTemplate.id === 'korea-cge') {
        setSamData(generateKoreaSam());
        setModelParameters({
          alpha: [],
          b: [],
          tariff: [],
          indirectTax: [],
          incomeTax: []
        });
      } else if (selectedTemplate.id === 'saudi-cge') {
        setSamData(generateSaudiSam());
        setModelParameters({
          alpha: [],
          b: [],
          tariff: [],
          indirectTax: [],
          incomeTax: []
        });
      }
      
      setUseCustomModel(null);
      setCurrentStep(2);
      setModelResults(null);
      setComparisonResults(null);
      setRunningScenario(false);
      setScenarioParameters(null);
      setIsCustomSam(false);
      setSamConfigured(false);
      setError(null);
      setDetailedError(null);
    }
  }, [selectedTemplate]);
  
  // Update sector names when count changes
  useEffect(() => {
    if (!useCustomNames) {
      setSectorNames(Array.from({ length: sectorCount }, (_, i) => `SECTOR${i+1}`));
    } else if (sectorNames.length !== sectorCount) {
      // Add new sectors with default names if needed
      if (sectorNames.length < sectorCount) {
        const newNames = [...sectorNames];
        for (let i = sectorNames.length; i < sectorCount; i++) {
          newNames.push(`SECTOR${i+1}`);
        }
        setSectorNames(newNames);
      } else {
        // Reduce to the needed count
        setSectorNames(sectorNames.slice(0, sectorCount));
      }
    }
  }, [sectorCount, useCustomNames]);

  // Update factor names when count changes
  useEffect(() => {
    if (!useCustomNames) {
      setFactorNames(Array.from({ length: factorCount }, (_, i) => `FACTOR${i+1}`));
    } else if (factorNames.length !== factorCount) {
      // Add new factors with default names if needed
      if (factorNames.length < factorCount) {
        const newNames = [...factorNames];
        for (let i = factorNames.length; i < factorCount; i++) {
          newNames.push(`FACTOR${i+1}`);
        }
        setFactorNames(newNames);
      } else {
        // Reduce to the needed count
        setFactorNames(factorNames.slice(0, factorCount));
      }
    }
  }, [factorCount, useCustomNames]);

  // Update household names when count changes
  useEffect(() => {
    if (!useCustomNames) {
      setHouseholdNames(Array.from({ length: householdCount }, (_, i) => `HH${i+1}`));
    } else if (householdNames.length !== householdCount) {
      // Add new households with default names if needed
      if (householdNames.length < householdCount) {
        const newNames = [...householdNames];
        for (let i = householdNames.length; i < householdCount; i++) {
          newNames.push(`HH${i+1}`);
        }
        setHouseholdNames(newNames);
      } else {
        // Reduce to the needed count
        setHouseholdNames(householdNames.slice(0, householdCount));
      }
    }
  }, [householdCount, useCustomNames]);

  // Update the SAM template when dimensions change
  useEffect(() => {
    console.log('Dimensions change effect running', {
      currentStep,
      useCustomModel,
      sectorCount,
      factorCount,
      householdCount,
      samConfigured,
    });

    if (currentStep === 3 && useCustomModel && !samConfigured) {
      console.log('Generating empty SAM for step 3 customization');

      // Generate an empty SAM template with the current dimensions
      const emptySam = generateEmptySam(
        sectorCount,
        factorCount,
        householdCount,
        useCustomNames ? sectorNames : undefined,
        useCustomNames ? factorNames : undefined,
        useCustomNames ? householdNames : undefined
      );

      console.log('Generated empty SAM:', emptySam);

      // Set the SAM data with the empty template
      setSamData(emptySam);
      setIsCustomSam(true);

      // Update model parameters to match the new dimensions
      setModelParameters({
        alpha: Array(sectorCount).fill(1 / sectorCount),
        b: Array(sectorCount).fill(1.0)
      });
    }
  }, [currentStep, useCustomModel, sectorCount, factorCount, householdCount, sectorNames, factorNames, householdNames, useCustomNames, samConfigured]);

  // Validate SAM whenever it changes
  useEffect(() => {
    const validation = validateSam(samData);
    setSamValid(validation.valid);
    setSamValidationMessage(validation.valid ? null : validation.message || 'Invalid SAM');
  }, [samData]);
  
  // Handle template selection
  const handleSelectTemplate = (template: ModelTemplate) => {
    setSelectedTemplate(template);
  };
  
  // Handle customization choice
  const handleCustomizationChoice = (isCustom: boolean) => {
    console.log('Customization choice made:', isCustom);
    if (isCustom && selectedTemplate?.id !== 'simple-cge') {
      setError(
        'Customization for this model is currently unavailable. This feature will be added soon.'
      );
      return;
    }
    setUseCustomModel(isCustom);
    setSamConfigured(false);

    if (!isCustom) {
      // If running as-is, skip to solving
      handleSolveModel();
    } else {
      console.log('Creating empty SAM for customization');

      // Generate an initial empty SAM with the current dimensions
      const emptySam = generateEmptySam(
        sectorCount,
        factorCount,
        householdCount,
        useCustomNames ? sectorNames : undefined,
        useCustomNames ? factorNames : undefined,
        useCustomNames ? householdNames : undefined
      );

      console.log('Generated initial empty SAM:', emptySam);

      // Set SAM data before changing step to ensure it's available when the component renders
      setSamData(emptySam);
      setIsCustomSam(true);

      // Move to customization step
      setCurrentStep(3);
    }
  };

  // Handle sector name change
  const handleSectorNameChange = (index: number, name: string) => {
    const newNames = [...sectorNames];
    newNames[index] = name;
    setSectorNames(newNames);
  };
  
  // Handle factor name change
  const handleFactorNameChange = (index: number, name: string) => {
    const newNames = [...factorNames];
    newNames[index] = name;
    setFactorNames(newNames);
  };
  
  // Handle household name change
  const handleHouseholdNameChange = (index: number, name: string) => {
    const newNames = [...householdNames];
    newNames[index] = name;
    setHouseholdNames(newNames);
  };

  const handleConfigureSam = () => {
    const emptySam = generateEmptySam(
      sectorCount,
      factorCount,
      householdCount,
      useCustomNames ? sectorNames : undefined,
      useCustomNames ? factorNames : undefined,
      useCustomNames ? householdNames : undefined
    );

    setSamData(emptySam);
    setIsCustomSam(true);
    setSamConfigured(true);
  };

  // This function was previously used to generate a random SAM from the backend
  // Now we're creating empty SAM tables automatically when dimensions change
  // The function is removed as it's no longer needed
  
  // Handle SAM upload
  const handleSamUpload = (sam: SAM) => {
    setSamData(sam);
    setIsCustomSam(true);

    // Update parameters to match the new SAM dimensions
    setModelParameters({
      alpha: sam.goods.map((_, index) => 1 / sam.goods.length),
      b: sam.goods.map(() => 1.0)
    });
  };

  const handleNamesLoaded = (goodsFromFile: string[], factorsFromFile: string[], householdsFromFile: string[]) => {
    setSectorNames(goodsFromFile);
    setFactorNames(factorsFromFile);
    setHouseholdNames(householdsFromFile);
  };

  // Download the current SAM as a CSV file
  const handleDownloadCsv = () => {
    const csv = exportSamToCsv(samData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'sam.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Download the current SAM as an Excel file
  const handleDownloadExcel = async () => {
    const blob = await exportSamToExcel(samData);
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'sam.xlsx');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  // Handle parameter changes
  const handleParameterChange = useCallback(
    (params: ModelParameters) => setModelParameters(params),
    []
  );

  // Handle scenario parameter changes
  const handleScenarioParameterChange = useCallback(
    (params: ModelParameters) => setScenarioParameters(params),
    []
  );
  
  // Solve the model
  const handleSolveModel = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setDetailedError(null);
      
      // Check if SAM is valid
      const validation = validateSam(samData);
      if (!validation.valid) {
        setError(validation.message || 'Invalid SAM data');
        setIsLoading(false);
        return;
      }
      
      // Call the API to solve the model
      const templateId = selectedTemplate?.id || 'simple-cge';
      const results = await solveModel(templateId, modelParameters, isCustomSam ? samData : undefined);

      if (results.params) {
        setModelParameters({ ...modelParameters, ...results.params });
      }
      setModelResults(results);
      setCurrentStep(4);
    } catch (err) {
      console.error('Error solving model:', err);
      
      // Handle error message
      let errorMessage = 'An error occurred while solving the model';
      let detailedErrorMessage = null;
      
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'object' && err !== null && 'error' in err) {
        // API error format
        const apiError = err as { error: string; trace?: string };
        errorMessage = apiError.error;
        if (apiError.trace) {
          detailedErrorMessage = apiError.trace;
        }
      }
      
      setError(errorMessage);
      if (detailedErrorMessage) {
        setDetailedError(detailedErrorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Setup scenario comparison
  const handleSetupScenario = () => {
    if (modelParameters) {
      setScenarioParameters({...modelParameters});
    }
    setRunningScenario(true);
    setCurrentStep(5);
  };
  
  // Run and compare scenarios
  const handleCompareScenarios = async () => {
    if (!scenarioParameters || !modelParameters) return;
    
    try {
      setIsLoading(true);
      setError(null);
      setDetailedError(null);
      
      // Call the API to compare scenarios
      const templateId = selectedTemplate?.id || 'simple-cge';
      const results = await compareScenarios(
        templateId,
        modelParameters,
        scenarioParameters,
        isCustomSam ? samData : undefined
      );
      
      setComparisonResults(results);
      setCurrentStep(6);
    } catch (err) {
      console.error('Error comparing scenarios:', err);
      
      // Handle error message
      let errorMessage = 'An error occurred while comparing scenarios';
      let detailedErrorMessage = null;
      
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'object' && err !== null && 'error' in err) {
        // API error format
        const apiError = err as { error: string; trace?: string };
        errorMessage = apiError.error;
        if (apiError.trace) {
          detailedErrorMessage = apiError.trace;
        }
      }
      
      setError(errorMessage);
      if (detailedErrorMessage) {
        setDetailedError(detailedErrorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Reset the entire process
  const handleReset = () => {
    setSelectedTemplate(null);
    setUseCustomModel(null);
    setSamData(generateDefaultSam());
    setIsCustomSam(false);
    setModelParameters({
      alpha: [0.3, 0.7],
      b: [1.0, 1.0]
    });
    setModelResults(null);
    setRunningScenario(false);
    setScenarioParameters(null);
    setComparisonResults(null);
    setCurrentStep(1);
    setError(null);
    setDetailedError(null);
    setSectorCount(2);
    setFactorCount(2);
    setHouseholdCount(1);
    setSectorNames(['SECTOR1', 'SECTOR2']);
    setFactorNames(['FACTOR1', 'FACTOR2']);
    setHouseholdNames(['HH1']);
    setUseCustomNames(false);
    setPopulateNamesFromFile(false);
    setSamConfigured(false);
  };
  
  // Toggle showing detailed error
  const toggleDetailedError = () => {
    if (detailedError && !error) {
      setError(detailedError);
      setDetailedError(null);
    } else if (error && detailedError) {
      setDetailedError(null);
    }
  };
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-8">CGE Model Builder</h1>
      
      {/* Step indicators */}
      <div className="mb-8">
        <div className="flex items-center flex-wrap">
          {[
            'Select Template',
            'Configuration',
            useCustomModel ? 'Customize Model' : '', 
            'Results',
            runningScenario ? 'Scenario Setup' : '',
            comparisonResults ? 'Comparison' : ''
          ].filter(Boolean).map((step, index) => (
            <div key={index} className="flex items-center mb-2 mr-2">
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  index + 1 === currentStep
                    ? 'bg-primary text-white'
                    : index + 1 < currentStep
                      ? 'bg-success text-white'
                      : 'bg-midgray/30 text-darkgray/70'
                }`}
              >
                {index + 1 < currentStep ? '✓' : index + 1}
              </div>
              {step && <span className="ml-2 text-sm mr-4">{step}</span>}
              {index < ([
                'Select Template',
                'Configuration',
                useCustomModel ? 'Customize Model' : '', 
                'Results',
                runningScenario ? 'Scenario Setup' : '',
                comparisonResults ? 'Comparison' : ''
              ].filter(Boolean).length - 1) && (
                <div className={`h-0.5 w-8 mx-2 ${
                  index + 1 < currentStep ? 'bg-success' : 'bg-midgray/30'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 bg-warning/10 border border-warning/50 rounded-md">
          <div className="flex items-start">
            <div className="flex-grow">
              <div className="text-warning font-medium mb-1">Error</div>
              <div className="text-warning/90 whitespace-pre-wrap">{error}</div>
            </div>
            {detailedError && (
              <button
                onClick={toggleDetailedError}
                className="ml-2 text-warning/70 hover:text-warning"
              >
                Hide Details
              </button>
            )}
          </div>
          {!detailedError && (
            <div className="mt-2 text-warning/70 text-sm">
              <button
                onClick={toggleDetailedError}
                className="underline hover:no-underline"
              >
                Show Technical Details
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Step 1: Template Selection */}
      {currentStep === 1 && (
        <div>
          <h2 className="text-2xl font-semibold mb-6">Select a Model Template</h2>
          <p className="mb-6 text-darkgray/70">
            Choose a starting point for your CGE model. For this MVP, only the Simple CGE model is fully functional.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {templates.map((template, index) => (
              <TemplateCard
                key={template.id}
                template={template}
                onSelect={handleSelectTemplate}
                isSelected={selectedTemplate?.id === template.id}
                delay={index * 0.3}
              />
            ))}
          </div>
        </div>
      )}
      
      {/* Step 2: Configuration Options */}
      {currentStep === 2 && selectedTemplate && (
        <div>
          <h2 className="text-2xl font-semibold mb-6">
            {selectedTemplate.name} Configuration
          </h2>
          
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <h3 className="text-xl font-medium mb-4">How would you like to proceed?</h3>
            <p className="mb-6 text-darkgray/70">
              You can either run the model with default parameters or customize it to your needs.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => handleCustomizationChoice(false)}
                className="btn btn-primary flex-1"
              >
                Run with Default Parameters
              </button>
              <button
                onClick={() => handleCustomizationChoice(true)}
                className="btn bg-white border border-primary text-primary hover:bg-primary/5 flex-1"
              >
                Customize Model
              </button>
            </div>
          </div>
          
          <div className="mt-6 flex justify-between">
            <button
              onClick={handleReset}
              className="btn bg-white border border-midgray text-darkgray hover:bg-neutral"
            >
              Back to Templates
            </button>
          </div>
        </div>
      )}
      
      {/* Step 3: Model Customization */}
      {currentStep === 3 && selectedTemplate && useCustomModel && (
        <div>
          <h2 className="text-2xl font-semibold mb-6">
            Customize {selectedTemplate.name}
          </h2>
          
          {/* Model dimensions section */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <h3 className="text-xl font-medium mb-4">Model Dimensions</h3>
            <p className="mb-4 text-darkgray/70">
              Customize the number of sectors, factors, and households in your model.
              The SAM table below will update automatically.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Number of Sectors
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={sectorCount}
                  onChange={(e) => setSectorCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Number of Factors
                </label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={factorCount}
                  onChange={(e) => setFactorCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Number of Households
                </label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={householdCount}
                  onChange={(e) => setHouseholdCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="input w-full"
                />
              </div>
            </div>

            {/* Custom naming toggle and file name loading option */}
            <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={useCustomNames}
                  onChange={(e) => setUseCustomNames(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm font-medium">Use custom names for sectors, factors, and households</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={populateNamesFromFile}
                  onChange={(e) => setPopulateNamesFromFile(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm font-medium">Load names from uploaded SAM</span>
              </label>
            </div>

            {/* Custom naming section */}
            {useCustomNames && (
              <div className="mb-6 space-y-4">
                {/* Sector names */}
                <div>
                  <h4 className="text-md font-medium mb-2">Sector Names</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {sectorNames.map((name, index) => (
                      <div key={`sector-${index}`} className="flex items-center">
                        <span className="mr-2 text-xs text-darkgray/70 w-7">{index + 1}:</span>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => handleSectorNameChange(index, e.target.value)}
                          className="input text-sm py-1 flex-grow"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Factor names */}
                <div>
                  <h4 className="text-md font-medium mb-2">Factor Names</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {factorNames.map((name, index) => (
                      <div key={`factor-${index}`} className="flex items-center">
                        <span className="mr-2 text-xs text-darkgray/70 w-7">{index + 1}:</span>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => handleFactorNameChange(index, e.target.value)}
                          className="input text-sm py-1 flex-grow"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Household names */}
                <div>
                  <h4 className="text-md font-medium mb-2">Household Names</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {householdNames.map((name, index) => (
                      <div key={`household-${index}`} className="flex items-center">
                        <span className="mr-2 text-xs text-darkgray/70 w-7">{index + 1}:</span>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => handleHouseholdNameChange(index, e.target.value)}
                          className="input text-sm py-1 flex-grow"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!samConfigured && (
              <div className="mt-6">
                <button
                  onClick={handleConfigureSam}
                  className="btn btn-primary"
                >
                  Configure SAM
                </button>
              </div>
            )}
          </div>

          {samConfigured && (
            <>
              <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
                <h3 className="text-xl font-medium mb-4">Social Accounting Matrix (SAM)</h3>
                <p className="mb-4 text-darkgray/70">
                  You can upload your own SAM data or use the SAM Editor below.
                </p>

                <div className="mb-6">
                  <h4 className="text-lg font-medium mb-2">Upload SAM</h4>
                  <FileUploader
                    onSamLoaded={handleSamUpload}
                    goods={sectorNames}
                    factors={factorNames}
                    households={householdNames}
                    autoPopulateNames={populateNamesFromFile}
                    onNamesLoaded={handleNamesLoaded}
                  />
                </div>

                <div className="relative flex items-center mb-6">
                  <div className="flex-grow border-t border-midgray" />
                  <span className="flex-shrink mx-4 text-darkgray/60 uppercase text-sm font-medium">
                    Or
                  </span>
                  <div className="flex-grow border-t border-midgray" />
                </div>

                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-lg font-medium">SAM Editor</h4>
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
                  <SAMTable sam={samData} onChange={setSamData} />
                  {!samValid && (
                    <div className="mt-4 p-2 bg-warning/10 border border-warning/50 rounded-md text-warning">
                      {samValidationMessage || 'The SAM matrix is not balanced.'}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
                <h3 className="text-xl font-medium mb-4">Model Parameters</h3>
                <ParameterInputs
                  initialParams={modelParameters}
                  sam={samData}
                  templateId={selectedTemplate?.id || 'simple-cge'}
                  onChange={handleParameterChange}
                />
              </div>
            </>
          )}
          
          <div className="mt-6 flex justify-between">
            <button
              onClick={() => setCurrentStep(2)}
              className="btn bg-white border border-midgray text-darkgray hover:bg-neutral"
            >
              Back
            </button>
            <button
              onClick={handleSolveModel}
              className="btn btn-primary"
              disabled={isLoading || !samConfigured || !samValid}
              title={!samValid ? samValidationMessage || 'The SAM matrix is not balanced' : undefined}
            >
              {isLoading ? 'Solving...' : 'Solve Model'}
            </button>
          </div>
        </div>
      )}
      
      {/* Step 4: Results */}
      {currentStep === 4 && modelResults && (
        <div>
          <h2 className="text-2xl font-semibold mb-6">Model Results</h2>
          
          <ResultsDisplay results={modelResults} templateId={selectedTemplate?.id} />
          
          <div className="bg-white rounded-lg shadow-sm p-6 mt-8">
            <h3 className="text-xl font-medium mb-4">What would you like to do next?</h3>
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleSetupScenario}
                className="btn btn-primary flex-1"
              >
                Compare with Another Scenario
              </button>
              <button
                onClick={handleReset}
                className="btn bg-white border border-primary text-primary hover:bg-primary/5 flex-1"
              >
                Start a New Model
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Step 5: Scenario Setup */}
      {currentStep === 5 && scenarioParameters && (
        <div>
          <h2 className="text-2xl font-semibold mb-6">Scenario Comparison</h2>
          
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <h3 className="text-xl font-medium mb-4">Baseline Scenario (Current)</h3>
            <div className="text-sm text-darkgray/70 mb-4">
              This is your current model configuration. The scenario results will be compared to this baseline.
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {modelParameters.alpha.map((value, index) => (
                <div key={`alpha-${index}`} className="mb-2">
                  <span className="text-sm font-medium block mb-1">
                    Alpha {index + 1} ({samData.goods[index] || `Sector ${index + 1}`}):
                  </span>
                  <span className="text-lg">{value.toFixed(2)}</span>
                </div>
              ))}
              
              {modelParameters.b.map((value, index) => (
                <div key={`b-${index}`} className="mb-2">
                  <span className="text-sm font-medium block mb-1">
                    B {index + 1} ({samData.goods[index] || `Sector ${index + 1}`}):
                  </span>
                  <span className="text-lg">{value.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <h3 className="text-xl font-medium mb-4">Alternative Scenario</h3>
            <p className="mb-4 text-darkgray/70">
              Modify the parameters below to create an alternative scenario for comparison.
            </p>
            
            <ParameterInputs
              initialParams={scenarioParameters}
              sam={samData}
              templateId={selectedTemplate?.id || 'simple-cge'}
              onChange={handleScenarioParameterChange}
            />
          </div>
          
          <div className="mt-6 flex justify-between">
            <button
              onClick={() => setCurrentStep(4)}
              className="btn bg-white border border-midgray text-darkgray hover:bg-neutral"
            >
              Back to Results
            </button>
            <button
              onClick={handleCompareScenarios}
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? 'Comparing...' : 'Run and Compare'}
            </button>
          </div>
        </div>
      )}
      
      {/* Step 6: Comparison Results */}
      {currentStep === 6 && comparisonResults && (
        <div>
          <h2 className="text-2xl font-semibold mb-6">Scenario Comparison Results</h2>

          <div className="mb-6">
            <h3 className="text-lg font-medium mb-2">Parameter Changes</h3>
            <table className="min-w-full divide-y divide-midgray/30">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left text-xs font-medium text-darkgray/70 uppercase tracking-wider">Parameter</th>
                  <th className="px-2 py-1 text-right text-xs font-medium text-darkgray/70 uppercase tracking-wider">Baseline</th>
                  <th className="px-2 py-1 text-right text-xs font-medium text-darkgray/70 uppercase tracking-wider">Scenario</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-midgray/30">
                {(() => {
                  const rows: JSX.Element[] = [];
                  if (modelParameters && scenarioParameters) {
                    const keys = Object.keys(scenarioParameters) as (keyof typeof scenarioParameters)[];
                    keys.forEach(key => {
                      const baseVal: any = (modelParameters as any)[key];
                      const scenVal: any = (scenarioParameters as any)[key];
                      if (Array.isArray(baseVal) && Array.isArray(scenVal)) {
                        baseVal.forEach((b, idx) => {
                          if (scenVal[idx] !== b) {
                            let label = `${String(key)}[${idx}]`;
                            if (selectedTemplate && (selectedTemplate.id === 'korea-cge' || selectedTemplate.id === 'saudi-cge')) {
                              if (key === 'incomeTax' && samData.households[idx]) {
                                label = `${String(key)} (${samData.households[idx]})`;
                              } else if ((key === 'tariff' || key === 'indirectTax') && samData.goods[idx]) {
                                label = `${String(key)} (${samData.goods[idx]})`;
                              }
                            }
                            rows.push(
                              <tr key={`${String(key)}-${idx}`}>
                                <td className="px-2 py-1 whitespace-nowrap text-sm text-darkgray">{label}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-sm text-right text-darkgray">{b}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-sm text-right text-darkgray">{scenVal[idx]}</td>
                              </tr>
                            );
                          }
                        });
                      } else if (scenVal !== baseVal) {
                        rows.push(
                          <tr key={String(key)}>
                            <td className="px-2 py-1 whitespace-nowrap text-sm text-darkgray">{String(key)}</td>
                            <td className="px-2 py-1 whitespace-nowrap text-sm text-right text-darkgray">{baseVal}</td>
                            <td className="px-2 py-1 whitespace-nowrap text-sm text-right text-darkgray">{scenVal}</td>
                          </tr>
                        );
                      }
                    });
                  }
                  return rows.length > 0 ? rows : (
                    <tr><td colSpan={3} className="px-2 py-1 text-sm text-darkgray">No parameter changes</td></tr>
                  );
                })()}
              </tbody>
            </table>
          </div>

          <ComparisonDisplay comparison={comparisonResults} />
          
          <div className="mt-8 flex justify-between">
            <button
              onClick={() => setCurrentStep(5)}
              className="btn bg-white border border-midgray text-darkgray hover:bg-neutral"
            >
              Adjust Scenario
            </button>
            <button
              onClick={handleReset}
              className="btn btn-primary"
            >
              Start a New Model
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelBuilderPage;