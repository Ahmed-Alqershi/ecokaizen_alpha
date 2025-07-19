import { useEffect, useState, useContext } from 'react';
import { listRuns } from '../utils/api';
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

  if (!username) {
    return <div className="p-4">Please log in to view runs.</div>;
  }

  return (
    <div className="max-w-3xl mx-auto my-8">
      <h2 className="text-2xl font-semibold mb-6">Run History</h2>
      {runs.length === 0 ? (
        <p>No runs recorded.</p>
      ) : (
        <div className="space-y-4">
          {runs.map((run) => (
            <div key={run.id} className="p-4 bg-white rounded shadow-sm flex justify-between items-center">
              <div>
                <p className="font-medium">{run.template_id}</p>
                <p className="text-sm text-darkgray/70">{new Date(run.created_at).toLocaleString()}</p>
              </div>
              <div className="space-x-2">
                <button className="btn" onClick={() => downloadResults(run)}>Download</button>
                <button className="btn btn-primary" onClick={() => startScenario(run)}>Start Scenario</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RunHistoryPage;
