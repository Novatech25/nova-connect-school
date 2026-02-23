'use client';

import { useState, useEffect } from 'react';
import { useOfflineQueue } from '@novaconnect/sync';
import { OfflineOperation } from '@novaconnect/sync';

export function QueueViewer() {
  const { initialized, queue, refreshStats, clearSynced } = useOfflineQueue();
  const [operations, setOperations] = useState<OfflineOperation[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'synced' | 'failed'>('all');
  const [selectedTable, setSelectedTable] = useState<string>('all');
  const [selectedOperation, setSelectedOperation] = useState<OfflineOperation | null>(null);

  useEffect(() => {
    if (!initialized) return;

    const loadOperations = async () => {
      if (!queue) return;
      const allOps = await queue.getAll();
      setOperations(allOps);
    };

    loadOperations();
  }, [initialized, queue]);

  const handleClearSynced = async () => {
    if (!queue) return;
    await clearSynced();
    const allOps = await queue.getAll();
    setOperations(allOps);
  };

  const handleRefresh = async () => {
    if (!queue) return;
    await refreshStats();
    const allOps = await queue.getAll();
    setOperations(allOps);
  };

  const filteredOperations = operations.filter(op => {
    // Filter by status
    if (filter === 'pending' && op.synced) return false;
    if (filter === 'synced' && !op.synced) return false;
    if (filter === 'failed' && (op.synced || op.retryCount < 3)) return false;

    // Filter by table
    if (selectedTable !== 'all' && op.table !== selectedTable) return false;

    return true;
  });

  const tables = Array.from(new Set(operations.map(op => op.table)));

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          {/* Status Filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="synced">Synced</option>
            <option value="failed">Failed</option>
          </select>

          {/* Table Filter */}
          <select
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Tables</option>
            {tables.map(table => (
              <option key={table} value={table}>{table}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
          >
            Refresh
          </button>
          <button
            onClick={handleClearSynced}
            className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 text-sm"
          >
            Clear Synced
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Operations List */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h4 className="font-medium text-gray-900">
              Operations ({filteredOperations.length})
            </h4>
          </div>
          <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
            {filteredOperations.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p className="text-sm">No operations match the current filters</p>
              </div>
            ) : (
              filteredOperations.map((operation) => (
                <button
                  key={operation.id}
                  onClick={() => setSelectedOperation(operation)}
                  className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                    selectedOperation?.id === operation.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          operation.synced
                            ? 'bg-green-100 text-green-800'
                            : operation.retryCount >= 3
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {operation.synced ? 'Synced' : operation.retryCount >= 3 ? 'Failed' : 'Pending'}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          {operation.table}
                        </span>
                        {operation.priority && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            operation.priority === 'high'
                              ? 'bg-red-100 text-red-800'
                              : operation.priority === 'low'
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {operation.priority}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {operation.type.toUpperCase()} • {new Date(operation.timestamp).toLocaleString()}
                      </p>
                      {operation.error && (
                        <p className="text-xs text-red-600 mt-1">{operation.error}</p>
                      )}
                    </div>
                    <div className="ml-4 text-right">
                      <p className="text-xs text-gray-500">
                        Retry: {operation.retryCount}/3
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Operation Details */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h4 className="font-medium text-gray-900">
              {selectedOperation ? 'Operation Details' : 'Select an operation'}
            </h4>
          </div>
          <div className="p-4">
            {!selectedOperation ? (
              <div className="text-center text-gray-500 py-8">
                <p className="text-sm">Select an operation from the list to view details</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Operation Info */}
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-gray-600">ID</p>
                    <p className="text-sm font-mono text-gray-900 break-all">{selectedOperation.id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Type</p>
                    <p className="text-sm font-medium text-gray-900 capitalize">{selectedOperation.type}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Table</p>
                    <p className="text-sm font-medium text-gray-900">{selectedOperation.table}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Timestamp</p>
                    <p className="text-sm text-gray-900">{new Date(selectedOperation.timestamp).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Status</p>
                    <p className={`text-sm font-medium ${
                      selectedOperation.synced
                        ? 'text-green-600'
                        : selectedOperation.retryCount >= 3
                        ? 'text-red-600'
                        : 'text-yellow-600'
                    }`}>
                      {selectedOperation.synced ? 'Synced' : selectedOperation.retryCount >= 3 ? 'Failed' : 'Pending'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Retry Count</p>
                    <p className="text-sm text-gray-900">{selectedOperation.retryCount}/3</p>
                  </div>
                  {selectedOperation.priority && (
                    <div>
                      <p className="text-xs text-gray-600">Priority</p>
                      <p className="text-sm text-gray-900 capitalize">{selectedOperation.priority}</p>
                    </div>
                  )}
                  {selectedOperation.error && (
                    <div>
                      <p className="text-xs text-gray-600">Error</p>
                      <p className="text-sm text-red-600">{selectedOperation.error}</p>
                    </div>
                  )}
                </div>

                {/* Operation Data */}
                <div>
                  <p className="text-xs text-gray-600 mb-2">Data</p>
                  <pre className="bg-gray-50 rounded p-3 text-xs overflow-auto max-h-64">
                    {JSON.stringify(selectedOperation.data, null, 2)}
                  </pre>
                </div>

                {/* Metadata */}
                {selectedOperation.metadata && (
                  <div>
                    <p className="text-xs text-gray-600 mb-2">Metadata</p>
                    <pre className="bg-gray-50 rounded p-3 text-xs overflow-auto max-h-32">
                      {JSON.stringify(selectedOperation.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
