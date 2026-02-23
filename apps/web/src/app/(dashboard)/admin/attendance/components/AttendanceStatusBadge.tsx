'use client';

import React from 'react';
import type { AttendanceSessionStatus, AttendanceStatus } from '@core/schemas/attendance';

interface AttendanceStatusBadgeProps {
  status: AttendanceSessionStatus | AttendanceStatus;
}

export function AttendanceStatusBadge({ status }: AttendanceStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'present':
        return {
          backgroundColor: '#d1fae5',
          textColor: '#065f46',
          borderColor: '#10b981',
          label: 'Présent',
        };
      case 'absent':
        return {
          backgroundColor: '#fee2e2',
          textColor: '#991b1b',
          borderColor: '#ef4444',
          label: 'Absent',
        };
      case 'late':
        return {
          backgroundColor: '#fef3c7',
          textColor: '#92400e',
          borderColor: '#f59e0b',
          label: 'Retard',
        };
      case 'excused':
        return {
          backgroundColor: '#dbeafe',
          textColor: '#1e40af',
          borderColor: '#3b82f6',
          label: 'Excusé',
        };
      case 'draft':
        return {
          backgroundColor: '#fef3c7',
          textColor: '#92400e',
          borderColor: '#f59e0b',
          label: 'Brouillon',
        };
      case 'submitted':
        return {
          backgroundColor: '#dbeafe',
          textColor: '#1e40af',
          borderColor: '#3b82f6',
          label: 'Soumis',
        };
      case 'validated':
        return {
          backgroundColor: '#d1fae5',
          textColor: '#065f46',
          borderColor: '#10b981',
          label: 'Validé',
        };
      default:
        return {
          backgroundColor: '#f3f4f6',
          textColor: '#6b7280',
          borderColor: '#d1d5db',
          label: 'Inconnu',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border"
      style={{
        backgroundColor: config.backgroundColor,
        color: config.textColor,
        borderColor: config.borderColor,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full mr-1.5"
        style={{ backgroundColor: config.borderColor }}
      />
      {config.label}
    </span>
  );
}
