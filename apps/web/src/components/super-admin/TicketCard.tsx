import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatTicketId, getPriorityColor, getPriorityLabel, getStatusColor, getStatusLabel } from "@/lib/ticket-utils";
import { format } from "date-fns";
import { MoreHorizontal, MessageSquare, Clock } from "lucide-react";
import type { SupportTicket } from "@novaconnect/data";

interface TicketCardProps {
  ticket: SupportTicket;
  onView: (id: string) => void;
  onAssign?: (id: string) => void;
  onClose?: (id: string) => void;
  showSchool?: boolean;
}

export function TicketCard({
  ticket,
  onView,
  onAssign,
  onClose,
  showSchool = false,
}: TicketCardProps) {
  const priorityColor = getPriorityColor(ticket.priority);
  const statusColor = getStatusColor(ticket.status);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-mono text-muted-foreground">
                {formatTicketId(ticket.id)}
              </span>
              <Badge className={priorityColor}>
                {getPriorityIcon(ticket.priority)} {getPriorityLabel(ticket.priority)}
              </Badge>
              <Badge className={statusColor}>
                {getStatusLabel(ticket.status)}
              </Badge>
            </div>
            <h3 className="font-semibold text-lg leading-tight">{ticket.title}</h3>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(ticket.id)}>
                View Details
              </DropdownMenuItem>
              {onAssign && ticket.status !== "closed" && (
                <DropdownMenuItem onClick={() => onAssign(ticket.id)}>
                  Assign to Me
                </DropdownMenuItem>
              )}
              {onClose && ticket.status !== "closed" && (
                <DropdownMenuItem onClick={() => onClose(ticket.id)}>
                  Close Ticket
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {ticket.description}
        </p>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            {ticket.assignee && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Assigned to:</span>
                <span className="font-medium">
                  {ticket.assignee.first_name} {ticket.assignee.last_name}
                </span>
              </div>
            )}
            {ticket.category && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Category:</span>
                <span className="font-medium capitalize">{ticket.category}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            {ticket.messages && ticket.messages > 0 && (
              <div className="flex items-center gap-1">
                <MessageSquare className="h-4 w-4" />
                <span>{ticket.messages}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{format(new Date(ticket.created_at), "MMM d")}</span>
            </div>
          </div>
        </div>

        {showSchool && ticket.school && (
          <div className="mt-3 pt-3 border-t">
            <div className="text-sm">
              <span className="text-muted-foreground">School: </span>
              <span className="font-medium">{ticket.school.name}</span>
              <span className="text-muted-foreground ml-2">({ticket.school.code})</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getPriorityIcon(priority: string): string {
  const icons = {
    low: "↓",
    medium: "→",
    high: "↑",
    urgent: "⚡",
  };
  return icons[priority as keyof typeof icons] || "→";
}
