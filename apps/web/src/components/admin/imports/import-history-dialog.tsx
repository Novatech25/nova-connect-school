"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useImportHistory } from "@novaconnect/data";
import { History } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ImportHistoryDialogProps {
  importJobId: string;
}

export function ImportHistoryDialog({ importJobId }: ImportHistoryDialogProps) {
  const { data: history, isLoading } = useImportHistory(importJobId);

  const getStatusColor = (action: string) => {
    switch (action) {
      case "created":
        return "bg-green-500";
      case "updated":
        return "bg-blue-500";
      case "deleted":
        return "bg-red-500";
      case "failed":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getActionLabel = (action: string) => {
    return action.charAt(0).toUpperCase() + action.slice(1);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <History className="mr-2 h-4 w-4" />
          View History
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Import History</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : history && history.length > 0 ? (
          <ScrollArea className="h-[60vh]">
            <div className="space-y-4 pr-4">
              {history.map((entry: any, index: number) => (
                <div
                  key={entry.id || index}
                  className="border rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(entry.action)}>
                        {getActionLabel(entry.action)}
                      </Badge>
                      <span className="text-sm font-medium">
                        {entry.entity_type}
                      </span>
                    </div>
                    {entry.created_at && (
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(entry.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                    )}
                  </div>

                  <div className="text-sm space-y-1">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="font-medium">Row:</span> {entry.row_number || "N/A"}
                      </div>
                      <div>
                        <span className="font-medium">Status:</span>{" "}
                        {entry.status || "completed"}
                      </div>
                    </div>

                    {entry.error_message && (
                      <div className="text-red-600 text-xs mt-1 p-2 bg-red-50 rounded">
                        <strong>Error:</strong> {entry.error_message}
                      </div>
                    )}

                    {entry.original_data && Object.keys(entry.original_data).length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                          Original Data
                        </summary>
                        <pre className="text-xs bg-gray-50 p-2 rounded mt-1 overflow-x-auto">
                          {JSON.stringify(entry.original_data, null, 2)}
                        </pre>
                      </details>
                    )}

                    {entry.new_data && Object.keys(entry.new_data).length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                          New Data
                        </summary>
                        <pre className="text-xs bg-gray-50 p-2 rounded mt-1 overflow-x-auto">
                          {JSON.stringify(entry.new_data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No history available for this import.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
