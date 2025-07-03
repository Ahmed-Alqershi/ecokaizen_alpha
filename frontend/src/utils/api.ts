import axios from 'axios';
import { ModelParameters, ModelResults, SAM, ScenarioComparison } from './types';

const api = axios.create({
  baseURL: 'http://127.0.0.1:5002',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log('API Request:', config.url, config.data);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor for debugging
api.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.config.url, response.data);
    return response;
  },
  (error) => {
    console.error('API Error:', error.config?.url, error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const solveModel = async (
  templateId: string,
  params: ModelParameters,
  sam?: SAM
): Promise<ModelResults> => {
  try {
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

export const compareScenarios = async (
  baselineParams: ModelParameters,
  scenarioParams: ModelParameters,
  sam?: SAM
): Promise<ScenarioComparison> => {
  try {
    const response = await api.post('/compare-scenarios', {
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
      console.error('Invalid SAM data received:', data);
      throw new Error('Received invalid SAM data from server');
    }
    
    return data;
  } catch (error) {
    console.error('Error in generateRandomSam:', error);
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

export const registerUser = async (username: string, password: string) => {
  try {
    const response = await api.post('/register', { username, password });
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
  return response.data;
};

export default api;