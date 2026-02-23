'use client';
import { useState } from "react";
import { useAuditLogs } from "@novaconnect/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Download, Search } from "lucide-react";
import { format } from "date-fns";
import { AuditLogDetails } from "@/components/super-admin/AuditLogDetails";

export default function AuditLogsPage() {
  const { auditLogs, isLoading } = useAuditLogs();
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [resourceFilter, setResourceFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Filter audit logs
  const filteredLogs = auditLogs?.filter((log) => {
    const matchesSearch =
      search === "" ||
      log.resource_id?.toLowerCase().includes(search.toLowerCase()) ||
      log.user?.email?.toLowerCase().includes(search.toLowerCase());

    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    const matchesResource =
      resourceFilter === "all" || log.resource_type === resourceFilter;

    return matchesSearch && matchesAction && matchesResource;
  });

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      INSERT: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      UPDATE: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      DELETE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      LOGIN: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      LOGOUT: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
      EXPORT: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      VALIDATE: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
    };
    return colors[action] || "bg-gray-100 text-gray-800";
  };

  const handleExport = () => {
    // TODO: Implement CSV export
    console.log("Exporting audit logs...");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Audit Logs
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Track all actions across the platform
          </p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by resource ID or user email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="INSERT">INSERT</SelectItem>
            <SelectItem value="UPDATE">UPDATE</SelectItem>
            <SelectItem value="DELETE">DELETE</SelectItem>
            <SelectItem value="LOGIN">LOGIN</SelectItem>
            <SelectItem value="LOGOUT">LOGOUT</SelectItem>
            <SelectItem value="EXPORT">EXPORT</SelectItem>
            <SelectItem value="VALIDATE">VALIDATE</SelectItem>
          </SelectContent>
        </Select>
        <Select value={resourceFilter} onValueChange={setResourceFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by resource" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Resources</SelectItem>
            <SelectItem value="schools">Schools</SelectItem>
            <SelectItem value="users">Users</SelectItem>
            <SelectItem value="licenses">Licenses</SelectItem>
            <SelectItem value="support_tickets">Support Tickets</SelectItem>
            <SelectItem value="license_activations">License Activations</SelectItem>
            <SelectItem value="support_ticket_messages">Ticket Messages</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Resource Type</TableHead>
              <TableHead>Resource ID</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Loading audit logs...
                </TableCell>
              </TableRow>
            ) : filteredLogs && filteredLogs.length > 0 ? (
              filteredLogs.map((log) => (
                <TableRow
                  key={log.id}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={() => {
                    setSelectedLog(log);
                    setIsDetailsOpen(true);
                  }}
                >
                  <TableCell className="font-mono text-sm">
                    {format(new Date(log.created_at), "PPp")}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">
                        {log.user?.first_name} {log.user?.last_name}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {log.user?.email}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getActionColor(log.action)}>{log.action}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {log.resource_type}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {log.resource_id?.slice(0, 8)}...
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {log.ip_address || "-"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLog(log);
                        setIsDetailsOpen(true);
                      }}
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  No audit logs found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Details Dialog */}
      <AuditLogDetails
        log={selectedLog}
        open={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedLog(null);
        }}
      />
    </div>
  );
}
