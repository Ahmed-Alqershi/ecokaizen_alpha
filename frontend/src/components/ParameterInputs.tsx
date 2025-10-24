import { useState, useEffect } from 'react';
import { ModelParameters, SAM } from '../utils/types';

interface ParameterInputsProps {
  initialParams?: Partial<ModelParameters>;
  sam: SAM;
  templateId: string;
  onChange: (params: ModelParameters) => void;
}

const ParameterInputs = ({ initialParams, sam, templateId, onChange }: ParameterInputsProps) => {
  const [alphaValues, setAlphaValues] = useState<number[]>([]);
  const [bValues, setBValues] = useState<number[]>([]);
  const [autoCalibrate, setAutoCalibrate] = useState<boolean>(true);
  const [tariffValues, setTariffValues] = useState<number[]>([]);
  const [indirectValues, setIndirectValues] = useState<number[]>([]);
  const [incomeValues, setIncomeValues] = useState<number[]>([]);
  // Open economy arrays
  const [sigp, setSigp] = useState<number[]>([]); // by sector
  const [sigc, setSigc] = useState<number[]>([]); // by household
  const [sigm, setSigm] = useState<number[]>([]); // by sector
  const [sigx, setSigx] = useState<number[]>([]); // by sector
  
  // Initialize and react to SAM changes
  useEffect(() => {
    // no-op: reserved for future side effects when SAM changes
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
      setAlphaValues(defaultAlpha);

      // Initialize b values (production function scale parameters)
      const defaultB = sam.goods.map((_, index) =>
        initialParams?.b?.[index] !== undefined
          ? initialParams.b[index]
          : 1.0
      );
      setBValues(defaultB);

      // Calibration mode (MN1 only for now)
      if (templateId === 'mn1') {
        setAutoCalibrate((initialParams as any)?.autoCalibrate ?? true);
      }

      if (templateId === 'korea-cge' || templateId === 'saudi-cge') {
        const defTariff = sam.goods.map((_, i) => initialParams?.tariff?.[i] ?? 0);
        const defIndirect = sam.goods.map((_, i) => initialParams?.indirectTax?.[i] ?? 0);
        setTariffValues(defTariff);
        setIndirectValues(defIndirect);
        const defIncome = sam.households.map((_, i) => initialParams?.incomeTax?.[i] ?? 0);
        setIncomeValues(defIncome);
      }

      if (templateId === 'open_economy_static') {
        setSigp(sam.goods.map((_, i) => (initialParams as any)?.SIGP?.[i] ?? 2));
        setSigm(sam.goods.map((_, i) => (initialParams as any)?.SIGM?.[i] ?? 2));
        setSigx(sam.goods.map((_, i) => (initialParams as any)?.SIGX?.[i] ?? 2));
        setSigc(sam.households.map((_, i) => (initialParams as any)?.SIGC?.[i] ?? 1.5));
      }

      // initialized defaults
    }
  // Note: removing `initialParams` from dependencies prevents a reinitialization
  // loop when parent components update the parameters state.
  }, [sam.goods.length, sam.households.length, templateId]);

  // When values change, call the onChange handler
  useEffect(() => {
    if (alphaValues.length > 0 && bValues.length > 0) {
      const params: ModelParameters = {
        alpha: alphaValues,
        b: bValues
      };
      if (templateId === 'open_economy_static') {
        (params as any).SIGP = sigp;
        (params as any).SIGC = sigc;
        (params as any).SIGM = sigm;
        (params as any).SIGX = sigx;
      }
      if (templateId === 'mn1') {
        (params as any).autoCalibrate = autoCalibrate;
      }
      if (templateId === 'korea-cge' || templateId === 'saudi-cge') {
        params.tariff = tariffValues;
        params.indirectTax = indirectValues;
        params.incomeTax = incomeValues;
      }
      onChange(params);
    }
  }, [alphaValues, bValues, tariffValues, indirectValues, incomeValues, templateId, onChange, autoCalibrate, sigp, sigc, sigm, sigx]);

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

      {templateId === 'mn1' && (
      <div className="mb-6">
        <h4 className="text-md font-medium mb-2">Model Calibration</h4>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2">
            <input type="radio" checked={autoCalibrate} onChange={() => setAutoCalibrate(true)} />
            <span>Auto-calibrate</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={!autoCalibrate} onChange={() => setAutoCalibrate(false)} />
            <span>Manual input</span>
          </label>
        </div>
      </div>
      )}

      {templateId !== 'korea-cge' && templateId !== 'saudi-cge' && (!autoCalibrate || templateId !== 'mn1') && (
      <div className="mb-6">
        <h4 className="text-md font-medium mb-2">Utility Function Parameters (Alpha)</h4>
        <p className="text-sm text-darkgray/70 mb-4">
          Alpha values represent consumer preferences for each good in the utility function.
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
      )}

      {templateId !== 'korea-cge' && templateId !== 'saudi-cge' && (!autoCalibrate || templateId !== 'mn1') && (
      <div>
        <h4 className="text-md font-medium mb-2">Production Function Parameters (B)</h4>
        <p className="text-sm text-darkgray/70 mb-4">
          B values are scaling factors in the production functions for each sector.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
      )}

      {templateId === 'open_economy_static' && (
        <div className="mt-6 space-y-6">
          <div>
            <h4 className="text-md font-medium mb-2">Elasticity of substitution in production (SIGP)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {sam.goods.map((good, idx) => (
                <div key={`sigp-${idx}`} className="flex flex-col">
                  <label className="text-sm font-medium mb-1">{good}</label>
                  <input type="number" step="0.1" className="input" value={sigp[idx] ?? 2}
                    onChange={(e)=>{ const v=[...sigp]; v[idx]=parseFloat(e.target.value)||0; setSigp(v); }} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-md font-medium mb-2">Elasticity in household utility (SIGC)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {sam.households.map((hh, idx) => (
                <div key={`sigc-${idx}`} className="flex flex-col">
                  <label className="text-sm font-medium mb-1">{hh}</label>
                  <input type="number" step="0.1" className="input" value={sigc[idx] ?? 1.5}
                    onChange={(e)=>{ const v=[...sigc]; v[idx]=parseFloat(e.target.value)||0; setSigc(v); }} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-md font-medium mb-2">Armington elasticity (SIGM)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {sam.goods.map((good, idx) => (
                <div key={`sigm-${idx}`} className="flex flex-col">
                  <label className="text-sm font-medium mb-1">{good}</label>
                  <input type="number" step="0.1" className="input" value={sigm[idx] ?? 2}
                    onChange={(e)=>{ const v=[...sigm]; v[idx]=parseFloat(e.target.value)||0; setSigm(v); }} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-md font-medium mb-2">CET elasticity of transformation (SIGX)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {sam.goods.map((good, idx) => (
                <div key={`sigx-${idx}`} className="flex flex-col">
                  <label className="text-sm font-medium mb-1">{good}</label>
                  <input type="number" step="0.1" className="input" value={sigx[idx] ?? 2}
                    onChange={(e)=>{ const v=[...sigx]; v[idx]=parseFloat(e.target.value)||0; setSigx(v); }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {(templateId === 'korea-cge' || templateId === 'saudi-cge') && (
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {sam.goods.map((sector, idx) => (
              <div key={`tar-${idx}`} className="flex flex-col">
                <label className="text-sm font-medium mb-1">{sector} Tariff</label>
                <input
                  type="number"
                  step="0.01"
                  value={tariffValues[idx] || 0}
                  onChange={(e) => {
                    const v = [...tariffValues];
                    v[idx] = parseFloat(e.target.value) || 0;
                    setTariffValues(v);
                  }}
                  className="input"
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {sam.goods.map((sector, idx) => (
              <div key={`ind-${idx}`} className="flex flex-col">
                <label className="text-sm font-medium mb-1">{sector} Indirect Tax</label>
                <input
                  type="number"
                  step="0.01"
                  value={indirectValues[idx] || 0}
                  onChange={(e) => {
                    const v = [...indirectValues];
                    v[idx] = parseFloat(e.target.value) || 0;
                    setIndirectValues(v);
                  }}
                  className="input"
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {sam.households.map((hh, idx) => (
              <div key={`inc-${idx}`} className="flex flex-col">
                <label className="text-sm font-medium mb-1">{hh} Income Tax</label>
                <input
                  type="number"
                  step="0.01"
                  value={incomeValues[idx] || 0}
                  onChange={(e) => {
                    const v = [...incomeValues];
                    v[idx] = parseFloat(e.target.value) || 0;
                    setIncomeValues(v);
                  }}
                  className="input"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ParameterInputs;