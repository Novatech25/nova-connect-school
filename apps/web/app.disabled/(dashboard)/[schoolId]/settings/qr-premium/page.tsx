import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { usePremiumQrSettings, useUpdatePremiumQrSettings } from '@my-sandbox/data/hooks/useQrPremium'
import {
  getLicenseStatus,
  formatPremiumFeatureError,
  validatePremiumFeature,
} from '@my-sandbox/data/helpers/premiumFeatures'

export default function PremiumQrSettingsPage() {
  const params = useParams()
  const schoolId = params?.schoolId as string

  const [licenseStatus, setLicenseStatus] = useState<any>(null)
  const [validationResult, setValidationResult] = useState<any>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  )

  const { data: settings, isLoading: isLoadingSettings } = usePremiumQrSettings(schoolId)
  const updateSettings = useUpdatePremiumQrSettings()

  // Local state for form
  const [formValues, setFormValues] = useState({
    enabled: false,
    classQrEnabled: false,
    cardQrEnabled: false,
    rotationIntervalSeconds: 60,
    deviceBindingEnabled: false,
    anomalyDetectionEnabled: true,
    maxDevicesPerStudent: 2,
  })

  // Fetch license status on mount
  useEffect(() => {
    getLicenseStatus(schoolId).then(setLicenseStatus)
    validatePremiumFeature(schoolId, 'qr_advanced').then(setValidationResult)
  }, [schoolId])

  // Update form values when settings are loaded
  useEffect(() => {
    if (settings) {
      setFormValues({
        enabled: settings.enabled || false,
        classQrEnabled: settings.classQrEnabled || false,
        cardQrEnabled: settings.cardQrEnabled || false,
        rotationIntervalSeconds: settings.rotationIntervalSeconds || 60,
        deviceBindingEnabled: settings.deviceBindingEnabled || false,
        anomalyDetectionEnabled: settings.anomalyDetectionEnabled !== false,
        maxDevicesPerStudent: settings.maxDevicesPerStudent || 2,
      })
    }
  }, [settings])

  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage(null)

    try {
      await updateSettings.mutateAsync({
        schoolId,
        settings: formValues,
      })

      setSaveMessage({ type: 'success', text: 'Settings saved successfully!' })
    } catch (error) {
      setSaveMessage({ type: 'error', text: error.message || 'Failed to save settings' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleEnableModule = async (enabled: boolean) => {
    if (enabled) {
      // Check if we can enable the module
      const validation = await validatePremiumFeature(schoolId, 'qr_advanced')
      if (!validation.valid) {
        setSaveMessage({ type: 'error', text: formatPremiumFeatureError(validation) })
        return
      }
    }

    setFormValues({ ...formValues, enabled })
  }

  if (isLoadingSettings || !licenseStatus) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">QR Premium Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure advanced QR attendance features for your school
        </p>
      </div>

      {/* License Status Card */}
      <Card>
        <CardHeader>
          <CardTitle>License Status</CardTitle>
          <CardDescription>Your current license information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {licenseStatus.isActive ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <span className="font-medium">Status</span>
            </div>
            <Badge variant={licenseStatus.isActive ? 'default' : 'destructive'}>
              {licenseStatus.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-medium">License Type</span>
            <Badge variant="outline">{licenseStatus.licenseType || 'None'}</Badge>
          </div>

          {licenseStatus.expiresAt && (
            <div className="flex items-center justify-between">
              <span className="font-medium">Expires</span>
              <span className="text-sm text-muted-foreground">
                {new Date(licenseStatus.expiresAt).toLocaleDateString()}
                {licenseStatus.daysRemaining > 0 && ` (${licenseStatus.daysRemaining} days remaining)`}
              </span>
            </div>
          )}

          {!licenseStatus.isActive && licenseStatus.licenseType && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>License Issue</AlertTitle>
              <AlertDescription>
                {licenseStatus.daysRemaining <= 0
                  ? 'Your license has expired. Please renew to continue using premium features.'
                  : 'Your license is inactive. Please activate it to use premium features.'}
              </AlertDescription>
            </Alert>
          )}

          {!licenseStatus.hasLicense && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>No License Found</AlertTitle>
              <AlertDescription>
                You don't have a license. Please contact support to obtain a Premium or Enterprise
                license.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Module Activation */}
      <Card>
        <CardHeader>
          <CardTitle>Module Activation</CardTitle>
          <CardDescription>Enable or disable the premium QR module</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enabled">Enable Premium QR Module</Label>
              <p className="text-sm text-muted-foreground">
                Allow access to advanced QR features
              </p>
            </div>
            <Switch
              id="enabled"
              checked={formValues.enabled}
              onCheckedChange={handleEnableModule}
              disabled={!licenseStatus.isActive}
            />
          </div>

          {!validationResult?.valid && validationResult?.error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Cannot Enable Module</AlertTitle>
              <AlertDescription>{validationResult.error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Class QR Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Class QR Codes</CardTitle>
          <CardDescription>
            Configure QR codes for individual classes with rapid rotation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="classQrEnabled">Enable Class QR Codes</Label>
              <p className="text-sm text-muted-foreground">
                Generate unique QR codes for each class
              </p>
            </div>
            <Switch
              id="classQrEnabled"
              checked={formValues.classQrEnabled}
              onCheckedChange={(checked) =>
                setFormValues({ ...formValues, classQrEnabled: checked })
              }
              disabled={!formValues.enabled}
            />
          </div>

          {formValues.classQrEnabled && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Rotation Interval</Label>
                  <span className="text-sm font-medium">{formValues.rotationIntervalSeconds}s</span>
                </div>
                <Slider
                  value={[formValues.rotationIntervalSeconds]}
                  onValueChange={([value]) =>
                    setFormValues({ ...formValues, rotationIntervalSeconds: value })
                  }
                  min={30}
                  max={600}
                  step={30}
                  disabled={!formValues.enabled}
                />
                <p className="text-xs text-muted-foreground">
                  QR codes will automatically rotate every {formValues.rotationIntervalSeconds}{' '}
                  seconds
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card QR Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Student Card QR Codes</CardTitle>
          <CardDescription>
            Configure QR codes on student identification cards
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="cardQrEnabled">Enable Card QR Codes</Label>
              <p className="text-sm text-muted-foreground">
                Use QR codes on student cards for attendance
              </p>
            </div>
            <Switch
              id="cardQrEnabled"
              checked={formValues.cardQrEnabled}
              onCheckedChange={(checked) =>
                setFormValues({ ...formValues, cardQrEnabled: checked })
              }
              disabled={!formValues.enabled}
            />
          </div>

          {formValues.cardQrEnabled && (
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="deviceBinding">Device Binding</Label>
                <p className="text-sm text-muted-foreground">
                  Limit card usage to a single device
                </p>
              </div>
              <Switch
                id="deviceBinding"
                checked={formValues.deviceBindingEnabled}
                onCheckedChange={(checked) =>
                  setFormValues({ ...formValues, deviceBindingEnabled: checked })
                }
                disabled={!formValues.enabled}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Anomaly Detection */}
      <Card>
        <CardHeader>
          <CardTitle>Anomaly Detection</CardTitle>
          <CardDescription>Configure fraud detection and security settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="anomalyDetectionEnabled">Enable Anomaly Detection</Label>
              <p className="text-sm text-muted-foreground">
                Automatically detect suspicious activity
              </p>
            </div>
            <Switch
              id="anomalyDetectionEnabled"
              checked={formValues.anomalyDetectionEnabled}
              onCheckedChange={(checked) =>
                setFormValues({ ...formValues, anomalyDetectionEnabled: checked })
              }
              disabled={!formValues.enabled}
            />
          </div>

          {formValues.anomalyDetectionEnabled && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Max Devices per Student</Label>
                <span className="text-sm font-medium">{formValues.maxDevicesPerStudent}</span>
              </div>
              <Slider
                value={[formValues.maxDevicesPerStudent]}
                onValueChange={([value]) =>
                  setFormValues({ ...formValues, maxDevicesPerStudent: value })
                }
                min={1}
                max={5}
                step={1}
                disabled={!formValues.enabled}
              />
              <p className="text-xs text-muted-foreground">
                Maximum number of devices a student can use before triggering an alert
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center gap-4">
        <Button
          onClick={handleSave}
          disabled={isSaving || !formValues.enabled || !licenseStatus.isActive}
        >
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
