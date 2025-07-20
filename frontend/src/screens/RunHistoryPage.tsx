import { useEffect, useState, useContext } from 'react';
import { listRuns, deleteRun, clearRuns } from '../utils/api';
import { AuthContext } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface RunRecord {
  id: number;
  template_id: string;
  params: any;
  sam: any;
  results: any;
  created_at: string;
}

const RunHistoryPage = () => {
  const { username } = useContext(AuthContext);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRuns = async () => {
      const data = await listRuns(username);
      if (data) setRuns(data);
    };
    fetchRuns();
  }, [username]);

  const downloadResults = (run: RunRecord) => {
    const blob = new Blob([JSON.stringify(run.results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `run-${run.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const startScenario = (run: RunRecord) => {
    navigate('/model-builder', { state: { run } });
  };

  const removeRun = async (id: number) => {
    await deleteRun(id, username);
    setRuns(runs.filter((r) => r.id !== id));
  };

  const clearHistory = async () => {
    if (runs.length === 0) return;
    await clearRuns(username);
    setRuns([]);
  };

  if (!username) {
    return <div className="p-4">Please log in to view runs.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto my-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Run History</h2>
        {runs.length > 0 && (
          <button className="btn btn-secondary" onClick={clearHistory}>
            Clear History
          </button>
        )}
      </div>
      {runs.length === 0 ? (
        <p className="text-center">No runs recorded.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {runs.map((run) => (
            <div
              key={run.id}
              className="rounded-lg shadow-md bg-white overflow-hidden transition-shadow hover:shadow-lg"
            >
              <div className="px-4 py-2 bg-gradient-to-r from-primary to-secondary text-white">
                <p className="font-semibold">{run.template_id}</p>
                <p className="text-xs opacity-90">
                  {new Date(run.created_at).toLocaleString()}
                </p>
              </div>
              <div className="p-4 flex justify-end space-x-2">
                <button className="btn btn-gradient-outline" onClick={() => downloadResults(run)}>
                  Download
                </button>
                <button className="btn" onClick={() => removeRun(run.id)}>
                  Delete
                </button>
                <button className="btn btn-primary" onClick={() => startScenario(run)}>
                  Start Scenario
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RunHistoryPage;
