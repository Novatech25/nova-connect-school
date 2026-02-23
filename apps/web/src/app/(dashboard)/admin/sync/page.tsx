'use client';

import { useState, useEffect } from 'react';
import { useOfflineQueue, useSyncStatus, useConflictResolution, useGatewayStatus } from '@novaconnect/sync';
import { SyncDashboard } from './components/SyncDashboard';
import { ConflictResolver as ConflictResolverComponent } from './components/ConflictResolver';
import { QueueViewer } from './components/QueueViewer';

export default function SyncMonitoringPage() {
  const { initialized: queueInitialized, sync, retryFailed, stats: queueStats } = useOfflineQueue();
  const { initialized: statusInitialized, syncStatus, syncMode, gatewayUrl, lastSyncTime, syncProgress } = useSyncStatus();
  const { initialized: conflictsInitialized, conflicts, conflictsCount, resolveConflict, autoResolveConflicts } = useConflictResolution();
  const { initialized: gatewayInitialized, isGatewayAvailable, gatewayInfo, rediscoverGateway } = useGatewayStatus();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'queue' | 'conflicts'>('dashboard');
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await sync();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRetryFailed = async () => {
    await retryFailed();
  };

  const handleAutoResolve = async () => {
    await autoResolveConflicts('last-write-wins');
  };

  if (!queueInitialized || !statusInitialized) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing sync system...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sync Monitoring</h1>
          <p className="text-gray-600 mt-1">Monitor and manage offline synchronization</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSync}
            disabled={isSyncing || syncStatus === 'syncing'}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSyncing || syncStatus === 'syncing' ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Now
              </>
            )}
          </button>

          <button
            onClick={handleRetryFailed}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
          >
            Retry Failed
          </button>

          {gatewayInitialized && (
            <button
              onClick={rediscoverGateway}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Rediscover Gateway
            </button>
          )}
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Sync Status</p>
              <p className="text-2xl font-bold text-gray-900 mt-1 capitalize">{syncStatus}</p>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              syncStatus === 'idle' ? 'bg-green-100' : syncStatus === 'syncing' ? 'bg-blue-100' : 'bg-red-100'
            }`}>
              {syncStatus === 'idle' && <span className="text-green-600 text-2xl">✓</span>}
              {syncStatus === 'syncing' && <span className="text-blue-600 text-2xl">⟳</span>}
              {syncStatus === 'error' && <span className="text-red-600 text-2xl">✕</span>}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Sync Mode</p>
              <p className="text-2xl font-bold text-gray-900 mt-1 capitalize">{syncMode}</p>
              {gatewayUrl && (
                <p className="text-xs text-gray-500 mt-1">{gatewayUrl}</p>
              )}
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              syncMode === 'gateway' ? 'bg-purple-100' : 'bg-blue-100'
            }`}>
              <span className="text-xl">
                {syncMode === 'gateway' ? '📡' : '☁️'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Queue</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{queueStats.unsynced} pending</p>
              <p className="text-xs text-gray-500 mt-1">{queueStats.total} total</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
              <span className="text-yellow-600 text-2xl">⏳</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Conflicts</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{conflictsCount}</p>
              <p className="text-xs text-gray-500 mt-1">require resolution</p>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              conflictsCount > 0 ? 'bg-red-100' : 'bg-green-100'
            }`}>
              <span className={`text-2xl ${conflictsCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {conflictsCount > 0 ? '⚠️' : '✓'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4 -mb-px">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 border-b-2 font-medium text-sm ${
              activeTab === 'dashboard'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-4 py-2 border-b-2 font-medium text-sm ${
              activeTab === 'queue'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Queue ({queueStats.unsynced})
          </button>
          <button
            onClick={() => setActiveTab('conflicts')}
            className={`px-4 py-2 border-b-2 font-medium text-sm ${
              activeTab === 'conflicts'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Conflicts ({conflictsCount})
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'dashboard' && (
          <SyncDashboard
            syncStatus={syncStatus}
            syncMode={syncMode}
            syncProgress={syncProgress}
            lastSyncTime={lastSyncTime}
            queueStats={queueStats}
            conflictsCount={conflictsCount}
          />
        )}

        {activeTab === 'queue' && (
          <QueueViewer />
        )}

        {activeTab === 'conflicts' && (
          <ConflictResolverComponent
            conflicts={conflicts}
            onResolve={resolveConflict}
            onAutoResolve={handleAutoResolve}
          />
        )}
      </div>
    </div>
  );
}
