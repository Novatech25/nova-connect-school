'use client';

import { QueueStats } from '@novaconnect/sync';

interface SyncDashboardProps {
  syncStatus: 'idle' | 'syncing' | 'error';
  syncMode: 'gateway' | 'cloud' | 'offline';
  syncProgress: number;
  lastSyncTime: Date | null;
  queueStats: QueueStats;
  conflictsCount: number;
}

export function SyncDashboard({
  syncStatus,
  syncMode,
  syncProgress,
  lastSyncTime,
  queueStats,
  conflictsCount,
}: SyncDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Sync Progress */}
      {syncStatus === 'syncing' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Sync Progress</h3>
          <div className="relative pt-1">
            <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-100">
              <div
                style={{ width: `${syncProgress}%` }}
                className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-600 transition-all duration-300"
              />
            </div>
            <p className="text-sm text-gray-600 text-center">{syncProgress}% complete</p>
          </div>
        </div>
      )}

      {/* Last Sync Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Last Sync</h3>
        {lastSyncTime ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Time: </span>
              {lastSyncTime.toLocaleString()}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Mode: </span>
              <span className="capitalize">{syncMode}</span>
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Status: </span>
              <span className={`capitalize ${syncStatus === 'idle' ? 'text-green-600' : syncStatus === 'syncing' ? 'text-blue-600' : 'text-red-600'}`}>
                {syncStatus}
              </span>
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No sync has been performed yet</p>
        )}
      </div>

      {/* Queue Statistics by Table */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Queue by Table</h3>
        <div className="space-y-3">
          {Object.keys(queueStats.byTable).length === 0 ? (
            <p className="text-sm text-gray-500">No operations in queue</p>
          ) : (
            Object.entries(queueStats.byTable).map(([table, count]) => (
              <div key={table} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm font-medium text-gray-700">{table}</span>
                <span className="text-sm font-bold text-gray-900">{count}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="text-sm font-medium text-gray-600 mb-2">Total Operations</h4>
          <p className="text-3xl font-bold text-gray-900">{queueStats.total}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="text-sm font-medium text-gray-600 mb-2">Synced Successfully</h4>
          <p className="text-3xl font-bold text-green-600">{queueStats.synced}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="text-sm font-medium text-gray-600 mb-2">Failed</h4>
          <p className="text-3xl font-bold text-red-600">{queueStats.failed}</p>
        </div>
      </div>

      {/* Alerts */}
      {conflictsCount > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-yellow-400 text-xl">⚠️</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                You have <strong>{conflictsCount}</strong> unresolved conflict(s). Go to the Conflicts tab to resolve them.
              </p>
            </div>
          </div>
        </div>
      )}

      {queueStats.failed > 0 && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-red-400 text-xl">✕</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                <strong>{queueStats.failed}</strong> operation(s) have failed. Click "Retry Failed" to attempt again.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
