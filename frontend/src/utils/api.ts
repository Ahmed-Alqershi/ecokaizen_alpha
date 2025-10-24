import axios from 'axios';
import { ModelParameters, ModelResults, SAM, ScenarioComparison, Project } from './types';

const api = axios.create({
  baseURL: 'http://127.0.0.1:5002',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Production: no debug interceptors
api.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
);
api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);

export const solveModel = async (
  templateId: string,
  params: ModelParameters,
  sam?: SAM
): Promise<ModelResults> => {
  try {
    // Route MN1 through the new workspace template endpoint
    if (templateId === 'mn1') {
      const payloadParams: any = { ...params };
      // If auto-calibration is enabled or beta is a flat array, drop beta to avoid validation errors
      const isFlatBeta = Array.isArray((payloadParams as any).beta) &&
        ((payloadParams as any).beta.length === 0 || typeof (payloadParams as any).beta[0] === 'number');
      if (payloadParams.autoCalibrate !== false || isFlatBeta) {
        delete payloadParams.beta;
      }
      const response = await api.post(`/templates/workspace/${templateId}/run`, {
        params: payloadParams,
        sam,
      });
      return response.data;
    }

    if (templateId === 'open_economy_static') {
      const response = await api.post(`/templates/workspace/${templateId}/run`, {
        params,
        sam,
      });
      return response.data;
    }

    const response = await api.post('/solve-model', {
      templateId,
      params,
      sam,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw error.response.data;
    }
    throw error;
  }
};

// Workspace Template Helpers (for future UI usage)
export const listWorkspaceTemplates = async () => {
  const response = await api.get('/templates/workspace');
  return response.data as Array<{ id: string; name: string; version: string; description?: string }>;
};

export const getWorkspaceTemplateSchema = async (templateId: string) => {
  const response = await api.get(`/templates/workspace/${templateId}/schema`);
  return response.data as { descriptor: any; inputSchema: any; outputSchema: any };
};

export const getWorkspaceSamLayout = async (templateId: string, sectors: number, households: number) => {
  const response = await api.post(`/templates/workspace/${templateId}/sam/layout`, { sectors, households });
  if (!response.data || !Array.isArray(response.data.rows) || response.data.rows.length === 0) {
    // Fallback: construct client-side entries to avoid blocking
    const goods = Array.from({ length: sectors }, (_, i) => `IND${i+1}`);
    const factors = ['LAB','CAP'];
    const householdsList = Array.from({ length: households }, (_, i) => `HH${i+1}`);
    const tail = ['FIRMS','DIRECT_TX','INDIR_TX','IMP_TX','GOVMT','ROW','ACCUM'];
    return { rows: [...goods, ...factors, ...householdsList, ...tail], cols: [...goods, ...factors, ...householdsList, ...tail], blocks: [] };
  }
  return response.data as { rows: string[]; cols: string[]; blocks: any[] };
};

export const compareScenarios = async (
  templateId: string,
  baselineParams: ModelParameters,
  scenarioParams: ModelParameters,
  sam?: SAM
): Promise<ScenarioComparison> => {
  try {
    const response = await api.post('/compare-scenarios', {
      templateId,
      baselineParams,
      scenarioParams,
      sam,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw error.response.data;
    }
    throw error;
  }
};

export const generateRandomSam = async (
  sectors: number,
  factors: number,
  households: number,
  sectorNames?: string[],
  factorNames?: string[],
  householdNames?: string[]
): Promise<SAM> => {
  try {
    const response = await api.post('/generate-random-sam', {
      dimensions: {
        sectors,
        factors,
        households,
        sectorNames,
        factorNames,
        householdNames
      },
    });
    
    // Verify we got a valid SAM structure back
    const data = response.data;
    if (!data.entries || !data.goods || !data.factors || !data.households || !data.data) {
      throw new Error('Received invalid SAM data from server');
    }
    
    return data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw error.response.data;
    }
    throw error;
  }
};

export const sendContactMessage = async (
  name: string,
  email: string,
  message: string
) => {
  const response = await api.post('/contact', { name, email, message });
  return response.data;
};

export const saveRun = async (
  username: string | undefined,
  templateId: string,
  params: any,
  sam: SAM | undefined,
  results: any
) => {
  if (!username) return;
  await api.post('/runs', {
    username,
    templateId,
    params,
    sam,
    results,
  });
};

export const listRuns = async (username: string | undefined) => {
  if (!username) return [] as any[];
  const response = await api.get('/runs', { params: { username } });
  const runs = response.data as any[];
  return runs.map((run) => ({
    ...run,
    params: run.params ? JSON.parse(run.params) : null,
    sam: run.sam ? JSON.parse(run.sam) : null,
    results: run.results ? JSON.parse(run.results) : null,
  }));
};

export const deleteRun = async (id: number, username: string | undefined) => {
  if (!username) return;
  await api.delete(`/runs/${id}`, { params: { username } });
};

export const clearRuns = async (username: string | undefined) => {
  if (!username) return;
  await api.delete('/runs', { params: { username } });
};

export const getRun = async (id: number) => {
  const response = await api.get(`/runs/${id}`);
  const run = response.data as any;
  return {
    ...run,
    params: run.params ? JSON.parse(run.params) : null,
    sam: run.sam ? JSON.parse(run.sam) : null,
    results: run.results ? JSON.parse(run.results) : null,
  };
};

// avatar format "<LETTER>|<COLOR>"
export const registerUser = async (
  username: string,
  password: string,
  avatar: string
) => {
  try {
    const response = await api.post('/register', { username, password, avatar });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw error.response.data;
    }
    throw error;
  }
};

export const loginUser = async (username: string, password: string) => {
  const response = await api.post('/login', { username, password });
  return response.data as { message: string; username: string; avatar: string };
};

export const createProject = async (
  username: string | undefined,
  name: string,
  description?: string,
  template?: string
): Promise<Project | undefined> => {
  if (!username) return;
  const response = await api.post('/projects', {
    username,
    name,
    description,
    template,
  });
  return response.data as Project;
};

export const listProjects = async (
  username: string | undefined
): Promise<Project[]> => {
  if (!username) return [] as Project[];
  const response = await api.get('/projects', { params: { username } });
  return response.data as Project[];
};

export const updateProjectStatus = async (
  username: string | undefined,
  projectId: number,
  status: 'open' | 'archived'
): Promise<Project | undefined> => {
  if (!username) return;
  const response = await api.patch(`/projects/${projectId}`, {
    username,
    status,
  });
  return response.data as Project;
};

export const deleteProject = async (
  username: string | undefined,
  projectId: number
): Promise<void> => {
  if (!username) return;
  await api.delete(`/projects/${projectId}`, { params: { username } });
};

export default api;