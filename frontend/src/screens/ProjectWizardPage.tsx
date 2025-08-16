import { useState } from 'react';
import FileUploader from '../components/FileUploader';
import SAMTable from '../components/SAMTable';
import ClosureRuleBuilder from '../components/ClosureRuleBuilder';
import ShockBuilder from '../components/ShockBuilder';
import ResultsDisplay from '../components/ResultsDisplay';
import {
  SAM,
  ModelParameters,
  ClosureRule,
  Shock,
  ModelResults,
} from '../utils/types';
import { solveModel } from '../utils/api';

const ProjectWizardPage = () => {
  const [step, setStep] = useState(1);
  const [sam, setSam] = useState<SAM | null>(null);
  const [prices, setPrices] = useState<string[]>([]);
  const [wage, setWage] = useState('');
  const [calibration, setCalibration] = useState<'auto' | 'manual'>('auto');
  const [beta, setBeta] = useState('');
  const [alpha, setAlpha] = useState('');
  const [A, setA] = useState('');
  const [rules, setRules] = useState<ClosureRule[]>([]);
  const [shocks, setShocks] = useState<Shock[]>([]);
  const [results, setResults] = useState<ModelResults | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSamLoaded = (data: SAM) => {
    setSam(data);
    setPrices(Array(data.goods.length).fill(''));
  };

  const handleAddRule = (rule: ClosureRule) => setRules([...rules, rule]);
  const handleRemoveRule = (i: number) =>
    setRules(rules.filter((_, idx) => idx !== i));

  const handleAddShock = (shock: Shock) => setShocks([...shocks, shock]);
  const handleRemoveShock = (i: number) =>
    setShocks(shocks.filter((_, idx) => idx !== i));

  const runModel = async () => {
    setLoading(true);
    try {
      const params: ModelParameters = {
        alpha: [],
        b: [],
        prices: prices.map((p) => Number(p)),
        wage: wage ? Number(wage) : undefined,
        beta: beta ? beta.split(',').map(Number) : undefined,
        A: A ? A.split(',').map(Number) : undefined,
        closureRules: rules,
        shocks: shocks,
        calibration,
      };
      const res = await solveModel('mn1-cge', params, sam || undefined);
      setResults(res);
      setStep(4);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <FileUploader
        onSamLoaded={handleSamLoaded}
        goods={sam ? sam.goods : []}
        factors={sam ? sam.factors : []}
        households={sam ? sam.households : []}
        autoPopulateNames
        onNamesLoaded={(g, f, h) => {
          setSam({
            entries: [...g, ...f, ...h],
            goods: g,
            factors: f,
            households: h,
            data: sam ? sam.data : [],
          });
          setPrices(Array(g.length).fill(''));
        }}
      />
      {sam && <SAMTable sam={sam} readOnly />}
      {sam && (
        <button
          className="bg-blue-500 text-white px-4 py-2"
          onClick={() => setStep(2)}
        >
          Next
        </button>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      {sam && (
        <div className="space-y-2">
          {sam.goods.map((g, i) => (
            <div key={g} className="flex items-center gap-2">
              <label className="w-32">Price of {g}</label>
              <input
                type="number"
                value={prices[i]}
                onChange={(e) => {
                  const arr = [...prices];
                  arr[i] = e.target.value;
                  setPrices(arr);
                }}
                className="border p-1 flex-1"
              />
            </div>
          ))}
          <div className="flex items-center gap-2">
            <label className="w-32">Wage rate</label>
            <input
              type="number"
              value={wage}
              onChange={(e) => setWage(e.target.value)}
              className="border p-1 flex-1"
            />
          </div>
        </div>
      )}
      <div className="space-y-2">
        <div>
          <label className="mr-4">Calibration:</label>
          <label className="mr-2">
            <input
              type="radio"
              value="auto"
              checked={calibration === 'auto'}
              onChange={() => setCalibration('auto')}
            />
            Auto
          </label>
          <label>
            <input
              type="radio"
              value="manual"
              checked={calibration === 'manual'}
              onChange={() => setCalibration('manual')}
            />
            Manual
          </label>
        </div>
        {calibration === 'manual' && (
          <div className="space-y-2">
            <input
              type="text"
              value={beta}
              onChange={(e) => setBeta(e.target.value)}
              placeholder="BETA values comma separated"
              className="border p-1 w-full"
            />
            <input
              type="text"
              value={alpha}
              onChange={(e) => setAlpha(e.target.value)}
              placeholder="ALPHA values comma separated"
              className="border p-1 w-full"
            />
            <input
              type="text"
              value={A}
              onChange={(e) => setA(e.target.value)}
              placeholder="A values comma separated"
              className="border p-1 w-full"
            />
          </div>
        )}
      </div>
      <div className="flex justify-between">
        <button
          className="px-4 py-2 border"
          onClick={() => setStep(1)}
        >
          Back
        </button>
        <button
          className="bg-blue-500 text-white px-4 py-2"
          onClick={() => setStep(3)}
        >
          Next
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold mb-2">Closure Rules</h3>
        <ClosureRuleBuilder
          rules={rules}
          onAdd={handleAddRule}
          onRemove={handleRemoveRule}
        />
      </div>
      <div>
        <h3 className="font-semibold mb-2">Shocks</h3>
        <ShockBuilder
          shocks={shocks}
          onAdd={handleAddShock}
          onRemove={handleRemoveShock}
        />
      </div>
      <div className="flex justify-between">
        <button
          className="px-4 py-2 border"
          onClick={() => setStep(2)}
        >
          Back
        </button>
        <button
          className="bg-blue-500 text-white px-4 py-2"
          onClick={runModel}
          disabled={loading}
        >
          {loading ? 'Running...' : 'Run Model'}
        </button>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-4">
      {results && <ResultsDisplay results={results} />}
      <button className="px-4 py-2 border" onClick={() => setStep(1)}>
        Start Over
      </button>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">New Project Wizard</h1>
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderStep4()}
    </div>
  );
};

export default ProjectWizardPage;
