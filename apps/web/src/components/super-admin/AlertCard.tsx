import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Clock,
  Users,
  Key,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Alert {
  id: string;
  type: "expiring_subscription" | "limit_reached" | "urgent_ticket" | "expired_license";
  title: string;
  description: string;
  severity: "warning" | "error";
  actionLabel?: string;
  action?: () => void;
}

interface AlertsCardProps {
  alerts: Alert[];
  className?: string;
}

export function AlertsCard({ alerts, className }: AlertsCardProps) {
  const getIcon = (type: Alert["type"]) => {
    const icons = {
      expiring_subscription: <Clock className="h-4 w-4" />,
      limit_reached: <Users className="h-4 w-4" />,
      urgent_ticket: <MessageSquare className="h-4 w-4" />,
      expired_license: <Key className="h-4 w-4" />,
    };
    return icons[type];
  };

  const getSeverityColor = (severity: Alert["severity"]) => {
    const colors = {
      warning: "border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20",
      error: "border-red-500/50 bg-red-50 dark:bg-red-950/20",
    };
    return colors[severity];
  };

  if (alerts.length === 0) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          Active Alerts
          <Badge variant="secondary" className="ml-2">
            {alerts.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.map((alert) => (
            <Alert
              key={alert.id}
              className={cn(
                "relative",
                getSeverityColor(alert.severity)
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {getIcon(alert.type)}
                </div>
                <div className="flex-1">
                  <AlertTitle className="text-sm font-medium">
                    {alert.title}
                  </AlertTitle>
                  <AlertDescription className="text-xs mt-1">
                    {alert.description}
                  </AlertDescription>
                </div>
                {alert.action && alert.actionLabel && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={alert.action}
                  >
                    {alert.actionLabel}
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </div>
            </Alert>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
