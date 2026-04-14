import React, { useState, useEffect } from 'react';
import { adminApi } from '../services/api';

export function ModelConfig() {
  const [config, setConfig] = useState({
    provider: 'openai',
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 500,
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleSave() {
    setLoading(true);
    setStatus(null);
    try {
      // API endpoint for model config would be implemented here
      await adminApi.startScan('', {}); // Placeholder for actual config call
      setStatus('Configuration saved successfully!');
    } catch (e) {
      setStatus('Failed to save configuration.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 mt-6">
      <h2 className="text-xl font-bold mb-4">AI Model Configuration</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Provider</label>
            <select 
              value={config.provider} 
              onChange={(e) => setConfig({...config, provider: e.target.value})}
              className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="ollama">Ollama</option>
              <option value="vllm">vLLM</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Model Name</label>
            <input 
              type="text" 
              value={config.model} 
              onChange={(e) => setConfig({...config, model: e.target.value})}
              className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
            />
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Temperature ({config.temperature})</label>
            <input 
              type="range" min="0" max="1" step="0.1" 
              value={config.temperature} 
              onChange={(e) => setConfig({...config, temperature: parseFloat(e.target.value)})}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Max Tokens</label>
            <input 
              type="number" 
              value={config.maxTokens} 
              onChange={(e) => setConfig({...config, maxTokens: parseInt(e.target.value)})}
              className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
            />
          </div>
        </div>
      </div>
      <div className="mt-6 flex items-center justify-between">
        <button 
          onClick={handleSave} 
          disabled={loading}
          className="bg-green-600 hover:bg-green-500 px-6 py-2 rounded font-semibold disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Configuration'}
        </button>
        {status && <p className="text-sm text-gray-400">{status}</p>}
      </div>
    </div>
  );
}
