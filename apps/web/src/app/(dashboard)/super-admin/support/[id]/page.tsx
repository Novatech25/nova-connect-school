'use client';
import React, { useState } from "react";
import { useSupportTicket, useAuthContext } from "@novaconnect/data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Paperclip } from "lucide-react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getPriorityColor,
  getPriorityLabel,
  getStatusColor,
  getStatusLabel,
} from "@/lib/ticket-utils";

export default function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { user } = useAuthContext();
  const { id } = React.use(params);
  const { ticket, messages, isLoading } = useSupportTicket(id);
  const [reply, setReply] = useState("");
  const [isInternal, setIsInternal] = useState(false);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!ticket) {
    return <div>Ticket not found</div>;
  }

  const handleSendReply = async () => {
    // TODO: Implement reply sending
    console.log("Sending reply:", { message: reply, isInternal });
    setReply("");
  };

  const handleAssignToMe = async () => {
    // TODO: Implement assignment
    console.log("Assigning to current user");
  };

  const handleChangeStatus = async (status: string) => {
    // TODO: Implement status change
    console.log("Changing status to:", status);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-4">
          <Link href="/super-admin/support">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{ticket.title}</h1>
              <Badge className={getPriorityColor(ticket.priority)}>
                {getPriorityLabel(ticket.priority)}
              </Badge>
              <Badge className={getStatusColor(ticket.status)}>
                {getStatusLabel(ticket.status)}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              From: {ticket.school?.name} • Created:{" "}
              {format(new Date(ticket.created_at), "PPp")}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleAssignToMe}>
            Assign to Me
          </Button>
          <Button
            variant="outline"
            onClick={() => handleChangeStatus("resolved")}
          >
            Mark Resolved
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 grid grid-cols-3 gap-6 mt-6 overflow-hidden">
        {/* Messages Thread */}
        <div className="col-span-2 flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow">
          <CardHeader className="border-b">
            <CardTitle>Conversation</CardTitle>
          </CardHeader>
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {/* Initial description */}
              <div className="flex gap-3">
                <Avatar>
                  <AvatarImage src={ticket.creator?.avatar_url} />
                  <AvatarFallback>
                    {ticket.creator?.first_name?.[0]}
                    {ticket.creator?.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {ticket.creator?.first_name} {ticket.creator?.last_name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {format(new Date(ticket.created_at), "PPp")}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{ticket.description}</p>
                </div>
              </div>

              {/* Messages */}
              {messages?.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.is_internal ? "bg-yellow-50 dark:bg-yellow-900/20 -mx-4 px-4 py-3" : ""
                    }`}
                >
                  <Avatar>
                    <AvatarImage src={message.user?.avatar_url} />
                    <AvatarFallback>
                      {message.user?.first_name?.[0]}
                      {message.user?.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {message.user?.first_name} {message.user?.last_name}
                      </span>
                      {message.is_internal && (
                        <Badge variant="outline" className="text-xs">
                          Internal
                        </Badge>
                      )}
                      <span className="text-xs text-gray-500">
                        {format(new Date(message.created_at), "PPp")}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">{message.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Reply Box */}
          <div className="border-t p-4">
            <div className="flex flex-col gap-3">
              <Textarea
                placeholder="Type your reply..."
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={3}
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={(e) => setIsInternal(e.target.checked)}
                    className="rounded"
                  />
                  Internal note (only visible to super admins)
                </label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Paperclip className="h-4 w-4 mr-2" />
                    Attach
                  </Button>
                  <Button size="sm" onClick={handleSendReply} disabled={!reply.trim()}>
                    <Send className="h-4 w-4 mr-2" />
                    Send
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium">School</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {ticket.school?.name}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Category</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                  {ticket.category || "-"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Priority</p>
                <Badge className={getPriorityColor(ticket.priority)}>
                  {getPriorityLabel(ticket.priority)}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium">Status</p>
                <Badge className={getStatusColor(ticket.status)}>
                  {getStatusLabel(ticket.status)}
                </Badge>
              </div>
              {ticket.assignee && (
                <div>
                  <p className="text-sm font-medium">Assigned To</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {ticket.assignee.first_name} {ticket.assignee.last_name}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium">Created</p>
                  <p className="text-gray-600 dark:text-gray-400">
                    {format(new Date(ticket.created_at), "PPp")}
                  </p>
                </div>
                {ticket.resolved_at && (
                  <div>
                    <p className="font-medium">Resolved</p>
                    <p className="text-gray-600 dark:text-gray-400">
                      {format(new Date(ticket.resolved_at), "PPp")}
                    </p>
                  </div>
                )}
                {ticket.closed_at && (
                  <div>
                    <p className="font-medium">Closed</p>
                    <p className="text-gray-600 dark:text-gray-400">
                      {format(new Date(ticket.closed_at), "PPp")}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
