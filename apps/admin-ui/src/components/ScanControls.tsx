import React, { useState } from 'react';
import { adminApi } from '../services/api';

export function ScanControls() {
  const [path, setPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleScan() {
    if (!path) return;
    setLoading(true);
    setStatus(null);
    try {
      await adminApi.startScan(path, { recursive: true });
      setStatus('Scan queued successfully!');
    } catch (e) {
      setStatus('Failed to start scan.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 mt-6">
      <h2 className="text-xl font-bold mb-4">Library Scanner</h2>
      <div className="flex gap-4">
        <input 
          type="text" 
          value={path} 
          onChange={(e) => setPath(e.target.value)} 
          placeholder="/path/to/music" 
          className="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
        />
        <button 
          onClick={handleScan} 
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded font-semibold disabled:opacity-50"
        >
          {loading ? 'Queueing...' : 'Start Scan'}
        </button>
      </div>
      {status && <p className="mt-2 text-sm text-gray-400">{status}</p>}
    </div>
  );
}
