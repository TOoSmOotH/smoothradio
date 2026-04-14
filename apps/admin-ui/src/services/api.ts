import axios from 'axios';

const API_BASE = process.env.VITE_API_URL || 'http://localhost:3000';

export const adminApi = {
  async getHealth() {
    const { data } = await axios.get(`${API_BASE}/health`);
    return data;
  },
  async getTracks(limit = 100, offset = 0) {
    const { data } = await axios.get(`${API_BASE}/tracks`, {
      params: { limit, offset },
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    return data;
  },
  async startScan(path: string, options: any) {
    const { data } = await axios.post(`${API_BASE}/scan`, { path, ...options }, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    return data;
  }
};
