import React from 'react';
import { Dashboard } from './pages/Dashboard';

function AdminApp() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">SmoothRadio Admin</h1>
        <div className="text-sm text-gray-400">System Console</div>
      </header>
      <main className="p-8">
        <Dashboard />
      </main>
    </div>
  );
}

export default AdminApp;
