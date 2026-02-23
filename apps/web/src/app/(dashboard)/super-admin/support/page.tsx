'use client';
import { useState } from "react";
import { useSupportTickets, useAuthContext } from "@novaconnect/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TicketCard } from "@/components/super-admin/TicketCard";
import { MessageSquare, Filter } from "lucide-react";
import { useRouter } from "next/navigation";

export default function SupportTicketsPage() {
  const router = useRouter();
  const { user } = useAuthContext();
  const currentUserId = user?.id;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [unassigned, setUnassigned] = useState(false);

  const { tickets, isLoading } = useSupportTickets({
    search,
    status: statusFilter === "all" ? undefined : statusFilter,
    priority: priorityFilter === "all" ? undefined : priorityFilter,
    assigned_to_me: assignedToMe,
    currentUserId,
    unassigned,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Support Tickets</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage all support tickets from schools
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <Input
              placeholder="Search tickets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="waiting_response">Waiting Response</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Button
              variant={assignedToMe ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setAssignedToMe(!assignedToMe);
                setUnassigned(false);
              }}
            >
              Assigned to Me
            </Button>
            <Button
              variant={unassigned ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setUnassigned(!unassigned);
                setAssignedToMe(false);
              }}
            >
              Unassigned
            </Button>
          </div>
        </div>
      </div>

      {/* Tickets Grid */}
      {isLoading ? (
        <div className="text-center py-8">
          <p className="text-gray-600 dark:text-gray-400">Loading tickets...</p>
        </div>
      ) : tickets && tickets.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              onView={(id) => router.push(`/super-admin/support/${id}`)}
              showSchool={true}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-lg shadow">
          <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium">No tickets found</h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Try adjusting your filters or search query
          </p>
        </div>
      )}
    </div>
  );
}
