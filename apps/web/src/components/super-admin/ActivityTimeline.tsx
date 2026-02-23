import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Clock, User, Building2, Key, MessageSquare, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityItem {
  id: string;
  type: "school" | "user" | "license" | "ticket" | "audit";
  title: string;
  description?: string;
  timestamp: string;
  icon?: React.ReactNode;
}

interface ActivityTimelineProps {
  activities: ActivityItem[];
  className?: string;
}

export function ActivityTimeline({ activities, className }: ActivityTimelineProps) {
  const getIcon = (type: ActivityItem["type"]) => {
    const icons = {
      school: <Building2 className="h-4 w-4" />,
      user: <User className="h-4 w-4" />,
      license: <Key className="h-4 w-4" />,
      ticket: <MessageSquare className="h-4 w-4" />,
      audit: <AlertCircle className="h-4 w-4" />,
    };
    return icons[type];
  };

  const getColor = (type: ActivityItem["type"]) => {
    const colors = {
      school: "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400",
      user: "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400",
      license: "bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400",
      ticket: "bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-400",
      audit: "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400",
    };
    return colors[type];
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {activities.map((activity, index) => (
              <div key={activity.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full",
                    getColor(activity.type)
                  )}>
                    {activity.icon || getIcon(activity.type)}
                  </div>
                  {index < activities.length - 1 && (
                    <div className="w-px h-full bg-border mt-2" />
                  )}
                </div>
                <div className="flex-1 pb-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">{activity.title}</p>
                      {activity.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {activity.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{format(new Date(activity.timestamp), "MMM d, HH:mm")}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {activities.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No recent activity
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
