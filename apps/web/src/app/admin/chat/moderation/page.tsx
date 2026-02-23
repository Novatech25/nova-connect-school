"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getModerationRules, moderateMessage, type ModerateMessage } from "@novaconnect/data";
import { useAuthContext } from "@novaconnect/data";

export default function ChatModerationPage() {
  const queryClient = useQueryClient();
  const [selectedAction, setSelectedAction] = useState<string>("all");
  const { profile } = useAuthContext();
  const schoolId = profile?.schoolId;

  const { data: logs, isLoading } = useQuery({
    queryKey: ['chat-moderation-logs', schoolId],
    queryFn: async () => {
      const { getModerationLogs } = await import("@novaconnect/data");
      return getModerationLogs(await schoolId, {
        action: selectedAction === 'all' ? undefined : selectedAction,
      });
    },
    enabled: !!schoolId,
  });

  const moderateMutation = useMutation({
    mutationFn: async (data: ModerateMessage) => {
      const { moderateMessage } = await import("@novaconnect/data");
      return moderateMessage(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-moderation-logs', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
    },
  });

  const handleAction = (messageId: string, action: 'approved' | 'rejected') => {
    const reason = action === 'approved' ? 'Approved by moderator' : 'Rejected by moderator';
    moderateMutation.mutate({
      messageId,
      action,
      reason,
    });
  };

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'flagged': return 'bg-yellow-100 text-yellow-800';
      case 'user_blocked': return 'bg-orange-100 text-orange-800';
      case 'user_unblocked': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Chat Moderation</h1>
        <p className="text-muted-foreground mt-2">
          Review flagged messages and moderate chat content
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Moderation Logs</CardTitle>
          <CardDescription>History of moderation actions and flagged content</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Select value={selectedAction} onValueChange={setSelectedAction}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="flagged">Flagged</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="user_blocked">User Blocked</SelectItem>
                <SelectItem value="user_unblocked">User Unblocked</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left text-sm font-medium">Timestamp</th>
                  <th className="p-3 text-left text-sm font-medium">Action</th>
                  <th className="p-3 text-left text-sm font-medium">User</th>
                  <th className="p-3 text-left text-sm font-medium">Moderator</th>
                  <th className="p-3 text-left text-sm font-medium">Reason</th>
                  <th className="p-3 text-left text-sm font-medium">Content</th>
                </tr>
              </thead>
              <tbody>
                {logs && logs.length > 0 ? (
                  logs.map((log: any) => (
                    <tr key={log.id} className="border-b hover:bg-muted/50">
                      <td className="p-3 text-sm">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="p-3">
                        <Badge className={getActionBadgeColor(log.action)}>
                          {log.action}
                        </Badge>
                        {log.auto_moderated && (
                          <Badge variant="outline" className="ml-2">
                            Auto
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-sm">
                        {log.user?.first_name} {log.user?.last_name}
                      </td>
                      <td className="p-3 text-sm">
                        {log.moderator?.first_name} {log.moderator?.last_name}
                      </td>
                      <td className="p-3 text-sm max-w-xs truncate">
                        {log.reason}
                      </td>
                      <td className="p-3 text-sm max-w-xs truncate">
                        {log.flagged_content}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No moderation logs found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
