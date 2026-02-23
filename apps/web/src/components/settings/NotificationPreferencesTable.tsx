'use client';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface NotificationType {
  value: string;
  label: string;
  description: string;
}

interface Channel {
  value: string;
  label: string;
  icon: any;
  color: string;
}

interface NotificationPreference {
  id: string;
  user_id: string;
  notification_type: string;
  enabled_channels: string[];
}

interface NotificationPreferencesTableProps {
  notificationTypes: NotificationType[];
  channels: Channel[];
  preferences: NotificationPreference[];
  onUpdatePreference: (notificationType: string, channel: string, enabled: boolean) => void;
}

export function NotificationPreferencesTable({
  notificationTypes,
  channels,
  preferences,
  onUpdatePreference,
}: NotificationPreferencesTableProps) {
  const getPreference = (notificationType: string) => {
    return preferences.find((p) => p.notification_type === notificationType);
  };

  const isChannelEnabled = (notificationType: string, channel: string) => {
    const pref = getPreference(notificationType);
    return pref?.enabled_channels.includes(channel) ?? false;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left p-4 font-semibold text-gray-700 min-w-[250px]">
              Type de notification
            </th>
            {channels.map((channel) => (
              <th key={channel.value} className="text-center p-4 font-semibold text-gray-700 min-w-[120px]">
                <div className="flex flex-col items-center gap-2">
                  <channel.icon className={`h-5 w-5 ${channel.color}`} />
                  <span className="text-sm">{channel.label}</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {notificationTypes.map((type) => (
            <tr key={type.value} className="border-b hover:bg-gray-50">
              <td className="p-4">
                <div>
                  <Label className="font-medium text-gray-900">{type.label}</Label>
                  <p className="text-sm text-gray-500 mt-1">{type.description}</p>
                </div>
              </td>
              {channels.map((channel) => (
                <td key={channel.value} className="p-4 text-center">
                  <Switch
                    checked={isChannelEnabled(type.value, channel.value)}
                    onCheckedChange={(checked) =>
                      onUpdatePreference(type.value, channel.value, checked)
                    }
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
