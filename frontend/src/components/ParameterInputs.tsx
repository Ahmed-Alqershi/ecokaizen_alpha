import { useState, useEffect } from 'react';
import { ModelParameters, SAM } from '../utils/types';

interface ParameterInputsProps {
  initialParams?: Partial<ModelParameters>;
  sam: SAM;
  onChange: (params: ModelParameters) => void;
}

const ParameterInputs = ({ initialParams, sam, onChange }: ParameterInputsProps) => {
  const [alphaValues, setAlphaValues] = useState<number[]>([]);
  const [bValues, setBValues] = useState<number[]>([]);
  
  // For debugging
  useEffect(() => {
    console.log('ParameterInputs - SAM:', {
      goods: sam.goods,
      factors: sam.factors,
      households: sam.households
    });
  }, [sam]);

  // Initialize with default values or provided initialParams
  useEffect(() => {
    if (sam.goods.length > 0) {
      // Initialize alpha values (utility function coefficients for each good)
      const defaultAlpha = sam.goods.map((_, index) =>
        initialParams?.alpha?.[index] !== undefined
          ? initialParams.alpha[index]
          : 1 / sam.goods.length
      );

      // Initialize b values (production function scale parameters)
      const defaultB = sam.goods.map((_, index) =>
        initialParams?.b?.[index] !== undefined
          ? initialParams.b[index]
          : 1.0
      );

      const alphaChanged =
        defaultAlpha.length !== alphaValues.length ||
        defaultAlpha.some((v, i) => v !== alphaValues[i]);
      const bChanged =
        defaultB.length !== bValues.length ||
        defaultB.some((v, i) => v !== bValues[i]);

      if (alphaChanged) setAlphaValues(defaultAlpha);
      if (bChanged) setBValues(defaultB);

      if (alphaChanged || bChanged) {
        console.log('ParameterInputs - Initial values:', {
          alpha: defaultAlpha,
          b: defaultB
        });
      }
    }
  }, [sam.goods.length, initialParams]);

  // When values change, call the onChange handler
  useEffect(() => {
    if (alphaValues.length > 0 && bValues.length > 0) {
      onChange({
        alpha: alphaValues,
        b: bValues
      });
    }
  }, [alphaValues, bValues, onChange]);

  const handleAlphaChange = (index: number, value: number) => {
    const newValues = [...alphaValues];
    newValues[index] = value;
    setAlphaValues(newValues);
  };

  const handleBChange = (index: number, value: number) => {
    const newValues = [...bValues];
    newValues[index] = value;
    setBValues(newValues);
  };

  if (sam.goods.length === 0) {
    return (
      <div className="p-4 bg-warning/10 border border-warning/50 rounded-md text-warning">
        No sectors/goods defined in the SAM. Please generate or upload a valid SAM first.
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm">
      <h3 className="text-lg font-medium mb-4">Model Parameters</h3>
      
      <div className="mb-6">
        <h4 className="text-md font-medium mb-2">Utility Function Parameters (Alpha)</h4>
        <p className="text-sm text-darkgray/70 mb-4">
          Alpha values represent consumer preferences for each good in the utility function.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sam.goods.map((good, index) => (
            <div key={`alpha-${index}`} className="flex flex-col">
              <label className="text-sm font-medium mb-1">
                {good} (Alpha {index + 1})
              </label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={alphaValues[index] || 0}
                onChange={(e) => handleAlphaChange(index, parseFloat(e.target.value) || 0)}
                className="input"
              />
            </div>
          ))}
        </div>
        
        <div className="mt-2 text-xs text-darkgray/70">
          Note: Sum of Alpha values should ideally be 1.0 for proper model behavior.
        </div>
      </div>
      
      <div>
        <h4 className="text-md font-medium mb-2">Production Function Parameters (B)</h4>
        <p className="text-sm text-darkgray/70 mb-4">
          B values are scaling factors in the production functions for each sector.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sam.goods.map((good, index) => (
            <div key={`b-${index}`} className="flex flex-col">
              <label className="text-sm font-medium mb-1">
                {good} (B {index + 1})
              </label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={bValues[index] || 0}
                onChange={(e) => handleBChange(index, parseFloat(e.target.value) || 0)}
                className="input"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ParameterInputs;