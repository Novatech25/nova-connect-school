import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, XCircle, AlertTriangle, MapPin, Bell, Settings2 } from 'lucide-react'

interface RoomAssignmentConfig {
  enabled: boolean
  selectionPriority: 'capacity' | 'size_category'
  capacityMarginPercent: number
  conflictResolution: 'largest_room' | 'split_classes' | 'manual_fallback'
  notificationWindows: {
    firstNotificationMinutes: number
    reminderNotificationMinutes: number
  }
  notificationChannels: {
    inApp: boolean
    push: boolean
    email: boolean
    sms: boolean
  }
  includeFloorPlan: boolean
  autoRecalculateOnChange: boolean
}

const defaultConfig: RoomAssignmentConfig = {
  enabled: false,
  selectionPriority: 'capacity',
  capacityMarginPercent: 10,
  conflictResolution: 'largest_room',
  notificationWindows: {
    firstNotificationMinutes: 60,
    reminderNotificationMinutes: 15,
  },
  notificationChannels: {
    inApp: true,
    push: true,
    email: false,
    sms: false,
  },
  includeFloorPlan: false,
  autoRecalculateOnChange: true,
}

export default function RoomAssignmentSettingsPage() {
  const params = useParams()
  const schoolId = params?.schoolId as string

  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [config, setConfig] = useState<RoomAssignmentConfig>(defaultConfig)

  // Fetch current settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch(`/api/schools/${schoolId}/settings`)
        if (!response.ok) throw new Error('Failed to fetch settings')

        const data = await response.json()
        if (data?.settings?.dynamicRoomAssignment) {
          setConfig(data.settings.dynamicRoomAssignment)
        }
      } catch (error) {
        console.error('Error fetching settings:', error)
        setSaveMessage({ type: 'error', text: 'Failed to load settings' })
      } finally {
        setIsLoading(false)
      }
    }

    fetchSettings()
  }, [schoolId])

  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage(null)

    try {
      const response = await fetch(`/api/schools/${schoolId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dynamicRoomAssignment: config,
        }),
      })

      if (!response.ok) throw new Error('Failed to save settings')

      setSaveMessage({ type: 'success', text: 'Settings saved successfully!' })
    } catch (error) {
      setSaveMessage({ type: 'error', text: error.message || 'Failed to save settings' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleEnableModule = async (enabled: boolean) => {
    setConfig({ ...config, enabled })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MapPin className="h-8 w-8" />
          Dynamic Room Assignment
        </h1>
        <p className="text-muted-foreground mt-2">
          Automatically assign rooms to classes based on enrollment and capacity
        </p>
      </div>

      {/* Module Activation */}
      <Card>
        <CardHeader>
          <CardTitle>Module Activation</CardTitle>
          <CardDescription>Enable or disable the dynamic room assignment module</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enabled">Enable Dynamic Room Assignment</Label>
              <p className="text-sm text-muted-foreground">
                Automatically assign rooms to classes based on intelligent grouping and capacity
              </p>
            </div>
            <Switch
              id="enabled"
              checked={config.enabled}
              onCheckedChange={handleEnableModule}
            />
          </div>
        </CardContent>
      </Card>

      {/* Room Selection Strategy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Room Selection Strategy
          </CardTitle>
          <CardDescription>Configure how rooms are selected for assignments</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="selectionPriority">Selection Priority</Label>
            <Select
              value={config.selectionPriority}
              onValueChange={(value: 'capacity' | 'size_category') =>
                setConfig({ ...config, selectionPriority: value })
              }
              disabled={!config.enabled}
            >
              <SelectTrigger id="selectionPriority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="capacity">By Capacity</SelectItem>
                <SelectItem value="size_category">By Size Category</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {config.selectionPriority === 'capacity'
                ? 'Rooms are selected based on their actual capacity (largest available room)'
                : 'Rooms are selected based on their category (Very Large > Large > Medium > Small)'}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Capacity Margin</Label>
              <span className="text-sm font-medium">{config.capacityMarginPercent}%</span>
            </div>
            <Slider
              value={[config.capacityMarginPercent]}
              onValueChange={([value]) =>
                setConfig({ ...config, capacityMarginPercent: value })
              }
              min={0}
              max={100}
              step={5}
              disabled={!config.enabled}
            />
            <p className="text-xs text-muted-foreground">
              Additional capacity buffer ({config.capacityMarginPercent}%) to ensure comfortable space.
              A room with {config.capacityMarginPercent}% margin will be marked as "optimal".
            </p>
          </div>

          <div className="space-y-3">
            <Label htmlFor="conflictResolution">Conflict Resolution</Label>
            <Select
              value={config.conflictResolution}
              onValueChange={(value: 'largest_room' | 'split_classes' | 'manual_fallback') =>
                setConfig({ ...config, conflictResolution: value })
              }
              disabled={!config.enabled}
            >
              <SelectTrigger id="conflictResolution">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="largest_room">Assign Largest Available Room</SelectItem>
                <SelectItem value="split_classes">Split Classes (Future)</SelectItem>
                <SelectItem value="manual_fallback">Manual Fallback</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Strategy when multiple classes need rooms at the same time or capacity is insufficient
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>Configure when and how notifications are sent</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Label>Notification Windows</Label>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="firstNotification">First Notification (T-60)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="firstNotification"
                    type="number"
                    min={15}
                    max={180}
                    step={15}
                    value={config.notificationWindows.firstNotificationMinutes}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        notificationWindows: {
                          ...config.notificationWindows,
                          firstNotificationMinutes: parseInt(e.target.value) || 60,
                        },
                      })
                    }
                    disabled={!config.enabled}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">minutes</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Send first notification {config.notificationWindows.firstNotificationMinutes} minutes
                before class starts
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="reminderNotification">Reminder (T-15)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="reminderNotification"
                    type="number"
                    min={5}
                    max={60}
                    step={5}
                    value={config.notificationWindows.reminderNotificationMinutes}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        notificationWindows: {
                          ...config.notificationWindows,
                          reminderNotificationMinutes: parseInt(e.target.value) || 15,
                        },
                      })
                    }
                    disabled={!config.enabled}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">minutes</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Send reminder notification {config.notificationWindows.reminderNotificationMinutes}{' '}
                minutes before class starts
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <Label>Notification Channels</Label>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="inApp">In-App Notifications</Label>
                  <p className="text-xs text-muted-foreground">
                    Show notifications in the app
                  </p>
                </div>
                <Switch
                  id="inApp"
                  checked={config.notificationChannels.inApp}
                  onCheckedChange={(checked) =>
                    setConfig({
                      ...config,
                      notificationChannels: { ...config.notificationChannels, inApp: checked },
                    })
                  }
                  disabled={!config.enabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="push">Push Notifications</Label>
                  <p className="text-xs text-muted-foreground">
                    Send push notifications to mobile devices
                  </p>
                </div>
                <Switch
                  id="push"
                  checked={config.notificationChannels.push}
                  onCheckedChange={(checked) =>
                    setConfig({
                      ...config,
                      notificationChannels: { ...config.notificationChannels, push: checked },
                    })
                  }
                  disabled={!config.enabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email">Email Notifications</Label>
                  <p className="text-xs text-muted-foreground">
                    Send email notifications (T-60 only)
                  </p>
                </div>
                <Switch
                  id="email"
                  checked={config.notificationChannels.email}
                  onCheckedChange={(checked) =>
                    setConfig({
                      ...config,
                      notificationChannels: { ...config.notificationChannels, email: checked },
                    })
                  }
                  disabled={!config.enabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="sms">SMS Notifications</Label>
                  <p className="text-xs text-muted-foreground">
                    Send SMS notifications (T-60 only)
                  </p>
                </div>
                <Switch
                  id="sms"
                  checked={config.notificationChannels.sms}
                  onCheckedChange={(checked) =>
                    setConfig({
                      ...config,
                      notificationChannels: { ...config.notificationChannels, sms: checked },
                    })
                  }
                  disabled={!config.enabled}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="includeFloorPlan">Include Floor Plan</Label>
              <p className="text-sm text-muted-foreground">
                Add campus map and directions to notifications
              </p>
            </div>
            <Switch
              id="includeFloorPlan"
              checked={config.includeFloorPlan}
              onCheckedChange={(checked) =>
                setConfig({ ...config, includeFloorPlan: checked })
              }
              disabled={!config.enabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Advanced Options */}
      <Card>
        <CardHeader>
          <CardTitle>Advanced Options</CardTitle>
          <CardDescription>Additional configuration options</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="autoRecalculate">Auto-Recalculate on Schedule Changes</Label>
              <p className="text-sm text-muted-foreground">
                Automatically recalculate room assignments when the schedule is modified
              </p>
            </div>
            <Switch
              id="autoRecalculate"
              checked={config.autoRecalculateOnChange}
              onCheckedChange={(checked) =>
                setConfig({ ...config, autoRecalculateOnChange: checked })
              }
              disabled={!config.enabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center gap-4">
        <Button onClick={handleSave} disabled={isSaving || !config.enabled}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Settings
        </Button>

        {saveMessage && (
          <Alert variant={saveMessage.type === 'success' ? 'default' : 'destructive'}>
            {saveMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <AlertDescription>{saveMessage.text}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  )
}
