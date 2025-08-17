import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import FileUploader from '../components/FileUploader';
import SAMTable from '../components/SAMTable';
import ClosureRuleBuilder from '../components/ClosureRuleBuilder';
import ShockBuilder from '../components/ShockBuilder';
import { exportSamToCsv, exportSamToExcel } from '../utils/samUtils';
import { SAM, ClosureRule, Shock, ModelParameters } from '../utils/types';
import { solveModel } from '../utils/api';
import ExcelJS from 'exceljs';

const factorNames = ['LAB', 'CAP'];

const ProjectBuilderPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [industries, setIndustries] = useState(2);
  const [consumers, setConsumers] = useState(1);
  const [goodsNames, setGoodsNames] = useState<string[]>(['IND1', 'IND2']);
  const [consumerNames, setConsumerNames] = useState<string[]>(['HH1']);
  const [goodsPrices, setGoodsPrices] = useState<number[]>([1, 1]);
  const [wageRate, setWageRate] = useState(1);
  const [useSamNames, setUseSamNames] = useState(true);
  const [samSectionOpen, setSamSectionOpen] = useState(true);
  const [benchmarkSectionOpen, setBenchmarkSectionOpen] = useState(true);
  const [calibrationSectionOpen, setCalibrationSectionOpen] = useState(true);
  const [closureSectionOpen, setClosureSectionOpen] = useState(true);
  const [shockSectionOpen, setShockSectionOpen] = useState(true);
  const [solveSectionOpen, setSolveSectionOpen] = useState(true);
  const [calibrationMode, setCalibrationMode] = useState<'auto' | 'manual'>('auto');
  const [betaMatrix, setBetaMatrix] = useState<number[][]>([]);
  const [alphaParams, setAlphaParams] = useState<number[]>([]);
  const [techParams, setTechParams] = useState<number[]>([]);
  const [closureRules, setClosureRules] = useState<ClosureRule[]>([]);
  const [shocks, setShocks] = useState<Shock[]>([]);
  const [report, setReport] = useState<
    { name: string; benchmark: number; solution: number; change: number }[] | null
  >(null);
  const [solving, setSolving] = useState(false);
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
  const [sam, setSam] = useState<SAM>(() => createEmptySam(goodsNames, factorNames, consumerNames));
  const [samError, setSamError] = useState('');
  const [goodsError, setGoodsError] = useState('');
  const [consumerError, setConsumerError] = useState('');

  const adjustLength = (arr: string[], len: number, prefix: string) => {
    const copy = [...arr];
    if (copy.length < len) {
      for (let i = copy.length; i < len; i++) copy.push(`${prefix}${i + 1}`);
    } else if (copy.length > len) {
      copy.length = len;
    }
    return copy;
  };

  useEffect(() => {
    setGoodsNames((prev) => adjustLength(prev, industries, 'IND'));
  }, [industries]);

  useEffect(() => {
    setConsumerNames((prev) => adjustLength(prev, consumers, 'HH'));
  }, [consumers]);

  useEffect(() => {
    const expected = industries + factorNames.length + consumers;
    if (
      sam.data.length !== expected ||
      sam.data.some((row) => row.length !== expected)
    ) {
      setSamError(
        `SAM dimensions (${sam.data.length}x${sam.data.length}) do not match m=${industries} and n=${consumers}.`
      );
    } else {
      setSamError('');
    }
  }, [sam, industries, consumers]);

  useEffect(() => {
    setSam((prev) => {
      const entries = [...goodsNames, ...factorNames, ...consumerNames];
      const size = entries.length;
      const data = Array.from({ length: size }, (_, i) =>
        Array.from({ length: size }, (_, j) => prev.data?.[i]?.[j] ?? 0)
      );
      return {
        entries,
        goods: goodsNames,
        factors: factorNames,
        households: consumerNames,
        data,
      };
    });
  }, [goodsNames, consumerNames]);

  const handleGoodsInput = (value: string) => {
    const names = value.split(',').map((n) => n.trim()).filter(Boolean);
    setGoodsNames(adjustLength(names, industries, 'IND'));
    setGoodsError(
      names.length === industries ? '' : `Enter ${industries} names`
    );
  };

  const handleConsumersInput = (value: string) => {
    const names = value.split(',').map((n) => n.trim()).filter(Boolean);
    setConsumerNames(adjustLength(names, consumers, 'HH'));
    setConsumerError(
      names.length === consumers ? '' : `Enter ${consumers} names`
    );
  };

  const adjustPriceLength = (arr: number[], len: number) => {
    const copy = [...arr];
    if (copy.length < len) {
      for (let i = copy.length; i < len; i++) copy.push(1);
    } else if (copy.length > len) {
      copy.length = len;
    }
    return copy;
  };

  useEffect(() => {
    setGoodsPrices((prev) => adjustPriceLength(prev, industries));
  }, [industries]);

  const adjustParamArray = (arr: number[], len: number, def: number) => {
    const copy = [...arr];
    if (copy.length < len) {
      for (let i = copy.length; i < len; i++) copy.push(def);
    } else if (copy.length > len) {
      copy.length = len;
    }
    return copy;
  };

  useEffect(() => {
    setAlphaParams((prev) => adjustParamArray(prev, industries, 1));
    setTechParams((prev) => adjustParamArray(prev, industries, 1));
    setBetaMatrix((prev) =>
      Array.from({ length: consumers }, (_, i) =>
        Array.from({ length: industries }, (_, j) => prev[i]?.[j] ?? 0.5)
      )
    );
  }, [industries, consumers]);

  const handleDownloadCsv = () => {
    const csv = exportSamToCsv(sam);
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

  const handleDownloadExcel = async () => {
    const blob = await exportSamToExcel(sam);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'sam.xlsx');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const normalizeBetaRows = () => {
    setBetaMatrix((prev) =>
      prev.map((row) => {
        const sum = row.reduce((a, b) => a + b, 0);
        return sum ? row.map((v) => v / sum) : row;
      })
    );
  };

  const handleSolve = async () => {
    setSolving(true);
    setReport(null);
    const params: ModelParameters = {
      prices: goodsPrices,
      wage: wageRate,
      beta: betaMatrix.flat(),
      A: techParams,
      closureRules,
      shocks,
      calibration: calibrationMode,
    };
    try {
      const res = await solveModel('mn1', params, sam);
      const table: { name: string; benchmark: number; solution: number; change: number }[] = [];
      if (res.production) {
        Object.entries(res.production).forEach(([k, v]) => {
          const bench = 1;
          const change = bench ? ((v - bench) / bench) * 100 : 0;
          table.push({ name: `XS[${k}]`, benchmark: bench, solution: v, change });
        });
      }
      if (res.prices) {
        Object.entries(res.prices).forEach(([k, v]) => {
          const idx = goodsNames.indexOf(k);
          const bench = goodsPrices[idx] ?? 0;
          const change = bench ? ((v - bench) / bench) * 100 : 0;
          table.push({ name: `P[${k}]`, benchmark: bench, solution: v, change });
        });
      }
      if (typeof res.utility === 'number') {
        const bench = 1;
        const v = res.utility;
        const change = ((v - bench) / bench) * 100;
        table.push({ name: 'U', benchmark: bench, solution: v, change });
      }
      setReport(table);
    } catch (err) {
      console.error(err);
    }
    setSolving(false);
  };

  const handleDownloadReportCsv = () => {
    if (!report) return;
    const header = 'Variable,Benchmark,Solution,% Change';
    const rows = report.map(
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
  };

  const handleDownloadReportExcel = async () => {
    if (!report) return;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Report');
    ws.addRow(['Variable', 'Benchmark', 'Solution', '% Change']);
    report.forEach((r) => ws.addRow([r.name, r.benchmark, r.solution, r.change]));
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
  };

  return (
    <div
      className="max-w-2xl mx-auto my-12 p-4 space-y-8"
      data-project-id={projectId}
    >
      <div className="bg-[#2F3A4A] text-white rounded-lg p-6 text-center shadow-lg">
        <h1 className="text-2xl font-bold mb-2">
          Welcome to your Model Builder!
        </h1>
        <p>
          Let's help you set up and run your CGE model step-by-step.
        </p>
      </div>

      <section className={solving ? 'opacity-50 pointer-events-none' : ''}>
        <div
          className="flex items-center mb-4 cursor-pointer text-[#2F3A4A]"
          onClick={() => setSamSectionOpen(!samSectionOpen)}
        >
          <span className="mr-2">{samSectionOpen ? '▼' : '►'}</span>
          <h2 className="text-xl font-semibold">1. SAM Setup</h2>
        </div>
        <div
          className={`bg-white rounded-lg shadow-md space-y-6 overflow-hidden transition-all duration-300 ${samSectionOpen ? 'max-h-[5000px] p-6' : 'max-h-0 p-0'}`}
        >
          <div>
            <label className="block mb-2 font-medium">Upload SAM</label>
            <FileUploader
              onSamLoaded={setSam}
              goods={goodsNames}
              factors={factorNames}
              households={consumerNames}
              autoPopulateNames={useSamNames}
              onNamesLoaded={(g, _f, h) => {
                setGoodsNames(g);
                setConsumerNames(h);
              }}
            />
            {samError && (
              <p className="mt-2 text-sm text-danger">{samError}</p>
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
                value={industries}
                onChange={(e) => setIndustries(parseInt(e.target.value) || 0)}
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
                value={consumers}
                onChange={(e) => setConsumers(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                className="mr-2"
                checked={useSamNames}
                onChange={(e) => setUseSamNames(e.target.checked)}
              />
              <span className="text-sm">Load names from uploaded SAM</span>
            </label>
          </div>

          {!useSamNames && (
            <div className="space-y-4">
              <div>
                <label className="block mb-1 font-medium">
                  Industry Names (comma separated)
                </label>
                <input
                  type="text"
                  className={`input w-full ${
                    goodsError ? 'border-danger focus:ring-danger' : ''
                  }`}
                  value={goodsNames.join(', ')}
                  onChange={(e) => handleGoodsInput(e.target.value)}
                />
                {goodsError && (
                  <p className="mt-1 text-xs text-danger">{goodsError}</p>
                )}
              </div>
              <div>
                <label className="block mb-1 font-medium">
                  Consumer Names (comma separated)
                </label>
                <input
                  type="text"
                  className={`input w-full ${
                    consumerError ? 'border-danger focus:ring-danger' : ''
                  }`}
                  value={consumerNames.join(', ')}
                  onChange={(e) => handleConsumersInput(e.target.value)}
                />
                {consumerError && (
                  <p className="mt-1 text-xs text-danger">{consumerError}</p>
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
            <SAMTable sam={sam} onChange={setSam} />
          </div>
        </div>
      </section>

      <section className={solving ? 'opacity-50 pointer-events-none' : ''}>
        <div
          className="flex items-center mb-4 cursor-pointer text-[#2F3A4A]"
          onClick={() => setBenchmarkSectionOpen(!benchmarkSectionOpen)}
        >
          <span className="mr-2">{benchmarkSectionOpen ? '▼' : '►'}</span>
          <h2 className="text-xl font-semibold">2. Benchmark Prices</h2>
        </div>
        <div
          className={`bg-white rounded-lg shadow-md space-y-6 overflow-hidden transition-all duration-300 ${benchmarkSectionOpen ? 'max-h-[5000px] p-6' : 'max-h-0 p-0'}`}
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
                {goodsNames.map((name, idx) => (
                  <tr key={name} className="align-top">
                    <td className="py-2 pr-4">{name}</td>
                    <td className="py-2">
                      <input
                        type="number"
                        step="any"
                        className={`input w-full ${
                          goodsPrices[idx] > 0
                            ? ''
                            : 'border-danger focus:ring-danger'
                        }`}
                        value={goodsPrices[idx]}
                        placeholder="Enter price (PO)"
                        onChange={(e) => {
                          const arr = [...goodsPrices];
                          arr[idx] = parseFloat(e.target.value);
                          setGoodsPrices(arr);
                        }}
                      />
                      {goodsPrices[idx] > 0 ? null : (
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
                wageRate > 0 ? '' : 'border-danger focus:ring-danger'
              }`}
              value={wageRate}
              placeholder="Enter wage rate (WO)"
              onChange={(e) => setWageRate(parseFloat(e.target.value))}
            />
            {wageRate > 0 ? null : (
              <p className="mt-1 text-xs text-danger">Enter a positive number</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              The wage rate represents the price of labor. Default = 1.0
            </p>
          </div>
        </div>
      </section>

      <section className={solving ? 'opacity-50 pointer-events-none' : ''}>
        <div
          className="flex items-center mb-4 cursor-pointer text-[#2F3A4A]"
          onClick={() => setCalibrationSectionOpen(!calibrationSectionOpen)}
        >
          <span className="mr-2">{calibrationSectionOpen ? '▼' : '►'}</span>
          <h2 className="text-xl font-semibold">4. Auto-Calibration Option</h2>
        </div>
        <div
          className={`bg-white rounded-lg shadow-md space-y-6 overflow-hidden transition-all duration-300 ${calibrationSectionOpen ? 'max-h-[5000px] p-6' : 'max-h-0 p-0'}`}
        >
          <div>
            <label className="block mb-2 font-medium">Calibration Mode:</label>
            <div className="flex gap-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  checked={calibrationMode === 'auto'}
                  onChange={() => setCalibrationMode('auto')}
                  className="mr-2"
                />
                <span>Auto-calibrate (recommended)</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  checked={calibrationMode === 'manual'}
                  onChange={() => setCalibrationMode('manual')}
                  className="mr-2"
                />
                <span>Manual input</span>
              </label>
            </div>
          </div>
          {calibrationMode === 'manual' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-medium mb-2">A. Utility Parameters (BETA)</h3>
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      <th className="pb-2">Consumer \ Industry</th>
                      {goodsNames.map((g) => (
                        <th key={g} className="pb-2">
                          {g}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {consumerNames.map((c, i) => (
                      <tr key={c} className="align-top">
                        <td className="py-2 pr-4">{c}</td>
                        {goodsNames.map((g, j) => (
                          <td key={g} className="py-2">
                            <input
                              type="number"
                              step="any"
                              className="input w-full"
                              value={betaMatrix[i]?.[j] ?? 0}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setBetaMatrix((prev) => {
                                  const copy = prev.map((row) => [...row]);
                                  copy[i][j] = isNaN(val) ? 0 : val;
                                  return copy;
                                });
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
                  {goodsNames.map((name, idx) => (
                    <div key={`alpha-${name}`}> 
                      <label className="block mb-1 font-medium">{name}</label>
                      <input
                        type="number"
                        step="any"
                        className="input w-full"
                        value={alphaParams[idx] ?? 1}
                        onChange={(e) => {
                          const arr = [...alphaParams];
                          arr[idx] = parseFloat(e.target.value);
                          setAlphaParams(arr);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-medium mb-2">C. Technology coefficient per industry (A)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {goodsNames.map((name, idx) => (
                    <div key={`tech-${name}`}>
                      <label className="block mb-1 font-medium">{name}</label>
                      <input
                        type="number"
                        step="any"
                        className="input w-full"
                        value={techParams[idx] ?? 1}
                        onChange={(e) => {
                          const arr = [...techParams];
                          arr[idx] = parseFloat(e.target.value);
                          setTechParams(arr);
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

      <section className={solving ? 'opacity-50 pointer-events-none' : ''}>
        <div
          className="flex items-center mb-4 cursor-pointer text-[#2F3A4A]"
          onClick={() => setClosureSectionOpen(!closureSectionOpen)}
        >
          <span className="mr-2">{closureSectionOpen ? '▼' : '►'}</span>
          <h2 className="text-xl font-semibold">5. Define Closure Rules</h2>
        </div>
        <div
          className={`bg-white rounded-lg shadow-md space-y-6 overflow-hidden transition-all duration-300 ${closureSectionOpen ? 'max-h-[5000px] p-6' : 'max-h-0 p-0'}`}
        >
          <ClosureRuleBuilder
            rules={closureRules}
            goods={goodsNames}
            consumers={consumerNames}
            onAdd={(r) => setClosureRules([...closureRules, r])}
            onRemove={(i) =>
              setClosureRules(closureRules.filter((_, idx) => idx !== i))
            }
          />
        </div>
      </section>

      <section className={solving ? 'opacity-50 pointer-events-none' : ''}>
        <div
          className="flex items-center mb-4 cursor-pointer text-[#2F3A4A]"
          onClick={() => setShockSectionOpen(!shockSectionOpen)}
        >
          <span className="mr-2">{shockSectionOpen ? '▼' : '►'}</span>
          <h2 className="text-xl font-semibold">6. Apply Shocks</h2>
        </div>
        <div
          className={`bg-white rounded-lg shadow-md space-y-6 overflow-hidden transition-all duration-300 ${shockSectionOpen ? 'max-h-[5000px] p-6' : 'max-h-0 p-0'}`}
        >
          <ShockBuilder
            shocks={shocks}
            goods={goodsNames}
            consumers={consumerNames}
            onAdd={(s) => setShocks([...shocks, s])}
            onRemove={(i) => setShocks(shocks.filter((_, idx) => idx !== i))}
          />
        </div>
      </section>

      <section>
        <div
          className="flex items-center mb-4 cursor-pointer text-[#2F3A4A]"
          onClick={() => setSolveSectionOpen(!solveSectionOpen)}
        >
          <span className="mr-2">{solveSectionOpen ? '▼' : '►'}</span>
          <h2 className="text-xl font-semibold">7. Solve & Report</h2>
        </div>
        <div
          className={`bg-white rounded-lg shadow-md space-y-6 overflow-hidden transition-all duration-300 ${solveSectionOpen ? 'max-h-[5000px] p-6' : 'max-h-0 p-0'}`}
        >
          <button
            onClick={handleSolve}
            disabled={solving}
            className="btn bg-primary text-white"
          >
            {solving ? 'Solving your model...' : 'Solve Model'}
          </button>
          {report && (
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
                  {report.map((r) => (
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
          )}
        </div>
      </section>
    </div>
  );
};

export default ProjectBuilderPage;

