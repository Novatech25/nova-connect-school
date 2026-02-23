import {
  type TicketPriority,
  type TicketStatus,
} from "@novaconnect/core";

/**
 * Returns badge color for ticket priority
 */
export function getPriorityColor(priority: TicketPriority): string {
  const colors = {
    low: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    medium: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    urgent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };
  return colors[priority];
}

/**
 * Returns icon for ticket priority
 */
export function getPriorityIcon(priority: TicketPriority): string {
  const icons = {
    low: "↓",
    medium: "→",
    high: "↑",
    urgent: "⚡",
  };
  return icons[priority];
}

/**
 * Returns human-readable label for ticket priority
 */
export function getPriorityLabel(priority: TicketPriority): string {
  const labels = {
    low: "Low",
    medium: "Medium",
    high: "High",
    urgent: "Urgent",
  };
  return labels[priority];
}

/**
 * Returns badge color for ticket status
 */
export function getStatusColor(status: TicketStatus): string {
  const colors = {
    open: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    in_progress: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    waiting_response: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    resolved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    closed: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  };
  return colors[status];
}

/**
 * Returns human-readable label for ticket status
 */
export function getStatusLabel(status: TicketStatus): string {
  const labels = {
    open: "Open",
    in_progress: "In Progress",
    waiting_response: "Waiting Response",
    resolved: "Resolved",
    closed: "Closed",
  };
  return labels[status];
}

/**
 * Formats ticket ID as #TICKET-XXXX
 */
export function formatTicketId(id: string): string {
  const shortId = id.slice(0, 8).toUpperCase();
  return `#${shortId}`;
}

/**
 * Calculates average response time in hours
 */
export function calculateResponseTime(
  createdAt: Date | string,
  firstResponseAt: Date | string
): number {
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const response = typeof firstResponseAt === 'string' ? new Date(firstResponseAt) : firstResponseAt;
  const diffMs = response.getTime() - created.getTime();
  return Math.round(diffMs / (1000 * 60 * 60));
}

/**
 * Calculates resolution time in hours
 */
export function calculateResolutionTime(
  createdAt: Date | string,
  resolvedAt: Date | string
): number {
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const resolved = typeof resolvedAt === 'string' ? new Date(resolvedAt) : resolvedAt;
  const diffMs = resolved.getTime() - created.getTime();
  return Math.round(diffMs / (1000 * 60 * 60));
}

/**
 * Formats time duration in human-readable format
 */
export function formatDuration(hours: number): string {
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes}m`;
  } else if (hours < 24) {
    return `${hours}h`;
  } else {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }
}

/**
 * Gets SLA status based on priority and age
 * Returns "within_sla", "approaching", or "breached"
 */
export function getSLAStatus(
  priority: TicketPriority,
  createdAt: Date | string
): "within_sla" | "approaching" | "breached" {
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const hoursSinceCreation = (Date.now() - created.getTime()) / (1000 * 60 * 60);

  const slaHours = {
    urgent: 4,
    high: 8,
    medium: 24,
    low: 72,
  };

  const sla = slaHours[priority];
  const slaThreshold = sla * 0.8; // 80% of SLA time

  if (hoursSinceCreation > sla) {
    return "breached";
  } else if (hoursSinceCreation > slaThreshold) {
    return "approaching";
  }
  return "within_sla";
}

/**
 * Returns SLA color
 */
export function getSLAColor(status: "within_sla" | "approaching" | "breached"): string {
  const colors = {
    within_sla: "text-green-600 dark:text-green-400",
    approaching: "text-yellow-600 dark:text-yellow-400",
    breached: "text-red-600 dark:text-red-400",
  };
  return colors[status];
}

/**
 * Sorts tickets by priority (urgent first)
 */
export function sortTicketsByPriority<T extends { priority: TicketPriority }>(
  tickets: T[]
): T[] {
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  return [...tickets].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}
