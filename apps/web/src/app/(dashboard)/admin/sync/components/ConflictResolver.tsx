'use client';

import { useState } from 'react';
import { ConflictRecord } from '@novaconnect/sync';

interface ConflictResolverProps {
  conflicts: ConflictRecord[];
  onResolve: (conflictId: string, resolution: 'local' | 'server' | 'merge', resolvedBy: string, mergedData?: any) => Promise<void>;
  onAutoResolve: () => Promise<void>;
}

export function ConflictResolver({ conflicts, onResolve, onAutoResolve }: ConflictResolverProps) {
  const [selectedConflict, setSelectedConflict] = useState<ConflictRecord | null>(null);
  const [resolving, setResolving] = useState(false);

  const handleResolve = async (resolution: 'local' | 'server' | 'merge') => {
    if (!selectedConflict) return;

    setResolving(true);
    try {
      await onResolve(selectedConflict.id, resolution, 'admin_user');
      setSelectedConflict(null);
    } finally {
      setResolving(false);
    }
  };

  const unresolvedConflicts = conflicts.filter(c => !c.resolvedAt);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Conflicts</h3>
          <p className="text-sm text-gray-600 mt-1">
            {unresolvedConflicts.length} conflict(s) require resolution
          </p>
        </div>
        {unresolvedConflicts.length > 0 && (
          <button
            onClick={onAutoResolve}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            Auto-Resolve All
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conflict List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h4 className="font-medium text-gray-900">Conflict List</h4>
          </div>
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {unresolvedConflicts.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <span className="text-4xl">✓</span>
                <p className="mt-2 text-sm">No unresolved conflicts</p>
              </div>
            ) : (
              unresolvedConflicts.map((conflict) => (
                <button
                  key={conflict.id}
                  onClick={() => setSelectedConflict(conflict)}
                  className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                    selectedConflict?.id === conflict.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{conflict.table}</p>
                      <p className="text-xs text-gray-500 mt-1">Record: {conflict.recordId}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(conflict.detectedAt).toLocaleString()}
                      </p>
                    </div>
                    <span className="text-yellow-600 text-xl">⚠️</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Conflict Detail */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h4 className="font-medium text-gray-900">
              {selectedConflict ? 'Conflict Details' : 'Select a conflict'}
            </h4>
          </div>
          <div className="p-4">
            {!selectedConflict ? (
              <div className="text-center text-gray-500 py-8">
                <p className="text-sm">Select a conflict from the list to view details</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Conflict Info */}
                <div className="bg-gray-50 rounded p-3">
                  <p className="text-xs text-gray-600">Table</p>
                  <p className="text-sm font-medium text-gray-900">{selectedConflict.table}</p>
                  <p className="text-xs text-gray-600 mt-2">Record ID</p>
                  <p className="text-sm font-mono text-gray-900">{selectedConflict.recordId}</p>
                  <p className="text-xs text-gray-600 mt-2">Detected</p>
                  <p className="text-sm text-gray-900">
                    {new Date(selectedConflict.detectedAt).toLocaleString()}
                  </p>
                </div>

                {/* Local vs Server */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h5 className="text-sm font-medium text-gray-900 mb-2">Local Version</h5>
                    <pre className="bg-gray-50 rounded p-3 text-xs overflow-auto max-h-64">
                      {JSON.stringify(selectedConflict.localData, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <h5 className="text-sm font-medium text-gray-900 mb-2">Server Version</h5>
                    <pre className="bg-gray-50 rounded p-3 text-xs overflow-auto max-h-64">
                      {JSON.stringify(selectedConflict.serverData, null, 2)}
                    </pre>
                  </div>
                </div>

                {/* Resolution Actions */}
                <div className="border-t border-gray-200 pt-4">
                  <h5 className="text-sm font-medium text-gray-900 mb-3">Resolution</h5>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleResolve('local')}
                      disabled={resolving}
                      className="flex-1 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm"
                    >
                      Keep Local
                    </button>
                    <button
                      onClick={() => handleResolve('server')}
                      disabled={resolving}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
                    >
                      Keep Server
                    </button>
                    <button
                      onClick={() => handleResolve('merge')}
                      disabled={resolving}
                      className="flex-1 px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 text-sm"
                    >
                      Merge
                    </button>
                  </div>
                  {resolving && (
                    <p className="text-xs text-gray-500 text-center mt-2">Resolving conflict...</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
