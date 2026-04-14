import React, { useState, useEffect } from 'react';
import { adminApi } from '../services/api';
import { ScanControls } from '../components/ScanControls';
import { ModelConfig } from '../components/ModelConfig';

export function Dashboard() {
  const [health, setHealth] = useState<any>(null);
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [healthData, tracksData] = await Promise.all([
          adminApi.getHealth(),
          adminApi.getTracks()
        ]);
        setHealth(healthData);
        setTracks(tracksData.items || []);
      } catch (e) {
        console.error('Failed to load dashboard', e);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) return <div className="p-8 text-white">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <div className="text-gray-400 text-sm">Server Status</div>
          <div className="text-2xl font-bold text-green-400">{health?.status || 'Unknown'}</div>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <div className="text-gray-400 text-sm">Total Tracks</div>
          <div className="text-2xl font-bold">{tracks.length}</div>
        </div>
      </div>

      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h2 className="text-xl font-bold mb-4">Recent Tracks</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="pb-2">Title</th>
                <th className="pb-2">Artist</th>
                <th className="pb-2">Album</th>
              </tr>
            </thead>
            <tbody>
              {tracks.slice(0, 10).map((t, i) => (
                <tr key={i} className="border-b border-gray-700 last:border-0">
                  <td className="py-2">{t.title || 'Unknown'}</td>
                  <td className="py-2">{t.artist || 'Unknown'}</td>
                  <td className="py-2">{t.album || 'Unknown'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ScanControls />
        <ModelConfig />
      </div>
    </div>
  );
}
