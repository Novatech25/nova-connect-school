import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AuditLogDetailsProps {
  log: {
    id: string;
    action: string;
    resource_type: string;
    resource_id?: string;
    old_data?: Record<string, unknown>;
    new_data?: Record<string, unknown>;
    ip_address?: string;
    user_agent?: string;
    created_at: string;
    user?: {
      first_name: string;
      last_name: string;
      email: string;
    };
    school?: {
      name: string;
      code: string;
    };
  } | null;
  open: boolean;
  onClose: () => void;
}

export function AuditLogDetails({ log, open, onClose }: AuditLogDetailsProps) {
  if (!log) return null;

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

  const formatJSON = (obj: Record<string, unknown>) => {
    return JSON.stringify(obj, null, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Audit Log Details</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 pr-4">
            {/* Header Info */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge className={getActionColor(log.action)}>
                  {log.action}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  on {log.resource_type}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Timestamp: </span>
                  <span className="text-muted-foreground">
                    {format(new Date(log.created_at), "PPpp")}
                  </span>
                </div>
                <div>
                  <span className="font-medium">IP Address: </span>
                  <span className="text-muted-foreground">{log.ip_address || "N/A"}</span>
                </div>
              </div>

              {log.user && (
                <div className="text-sm">
                  <span className="font-medium">User: </span>
                  <span className="text-muted-foreground">
                    {log.user.first_name} {log.user.last_name} ({log.user.email})
                  </span>
                </div>
              )}

              {log.school && (
                <div className="text-sm">
                  <span className="font-medium">School: </span>
                  <span className="text-muted-foreground">
                    {log.school.name} ({log.school.code})
                  </span>
                </div>
              )}

              {log.resource_id && (
                <div className="text-sm">
                  <span className="font-medium">Resource ID: </span>
                  <span className="font-mono text-muted-foreground">{log.resource_id}</span>
                </div>
              )}

              {log.user_agent && (
                <div className="text-sm">
                  <span className="font-medium">User Agent: </span>
                  <span className="text-muted-foreground break-all">{log.user_agent}</span>
                </div>
              )}
            </div>

            <Separator />

            {/* Data Changes */}
            {(log.old_data || log.new_data) && (
              <div className="space-y-4">
                {log.old_data && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Before (old_data):</h4>
                    <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
                      {formatJSON(log.old_data)}
                    </pre>
                  </div>
                )}

                {log.new_data && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">After (new_data):</h4>
                    <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
                      {formatJSON(log.new_data)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
