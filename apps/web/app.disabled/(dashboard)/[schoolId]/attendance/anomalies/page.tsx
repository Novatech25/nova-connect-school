import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AlertTriangle, CheckCircle, XCircle, Eye } from 'lucide-react'
import { useAnomalies, useAnomalyStatistics, useResolveAnomaly } from '@my-sandbox/data/hooks/useQrPremium'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

export default function AnomaliesPage() {
  const params = useParams()
  const schoolId = params?.schoolId as string

  const [selectedAnomaly, setSelectedAnomaly] = useState<any>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [resolution, setResolution] = useState('')
  const [filters, setFilters] = useState({
    anomalyType: '',
    severity: '',
    status: 'unresolved',
    page: 1,
    pageSize: 20,
  })

  const { data: anomaliesData, isLoading } = useAnomalies(schoolId, filters)
  const { data: statistics } = useAnomalyStatistics(schoolId)

  const resolveAnomaly = useResolveAnomaly()

  const handleResolve = async () => {
    if (!selectedAnomaly || !resolution) return

    try {
      await resolveAnomaly.mutateAsync({
        anomalyId: selectedAnomaly.id,
        resolution,
        reviewedBy: 'current-user-id', // Replace with actual user ID
      })
      setShowDetailModal(false)
      setResolution('')
      setSelectedAnomaly(null)
    } catch (error) {
      console.error('Failed to resolve anomaly:', error)
    }
  }

  const severityColors: Record<string, string> = {
    low: 'bg-blue-500',
    medium: 'bg-yellow-500',
    high: 'bg-orange-500',
    critical: 'bg-red-500',
  }

  const anomalyTypeLabels: Record<string, string> = {
    multiple_devices: 'Appareils Multiples',
    impossible_location: 'Localisation Impossible',
    rapid_scans: 'Scans Rapides',
    signature_mismatch: 'Signature Invalide',
    expired_reuse: 'QR Expiré Réutilisé',
    device_binding_violation: 'Violation Device Binding',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Anomaly Monitoring</h1>
        <p className="text-muted-foreground mt-2">
          Monitor and resolve attendance anomalies and suspicious activities
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Anomalies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics?.total || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {statistics?.bySeverity?.critical || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Unresolved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {statistics?.unresolved || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {statistics?.resolved || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <select
              className="border rounded px-3 py-2"
              value={filters.severity}
              onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
            >
              <option value="">All Severities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>

            <select
              className="border rounded px-3 py-2"
              value={filters.anomalyType}
              onChange={(e) => setFilters({ ...filters, anomalyType: e.target.value })}
            >
              <option value="">All Types</option>
              <option value="multiple_devices">Multiple Devices</option>
              <option value="rapid_scans">Rapid Scans</option>
              <option value="impossible_location">Impossible Location</option>
            </select>

            <select
              className="border rounded px-3 py-2"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
            >
              <option value="unresolved">Unresolved</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Anomalies Table */}
      <Card>
        <CardHeader>
          <CardTitle>Anomalies</CardTitle>
          <CardDescription>
            Showing {anomaliesData?.anomalies.length || 0} of {anomaliesData?.total || 0} anomalies
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : anomaliesData && anomaliesData.anomalies.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Detected</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {anomaliesData.anomalies.map((anomaly) => (
                  <TableRow key={anomaly.id}>
                    <TableCell>
                      {anomalyTypeLabels[anomaly.anomaly_type] || anomaly.anomaly_type}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`${severityColors[anomaly.severity]} text-white`}
                      >
                        {anomaly.severity.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(anomaly.detected_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {anomaly.resolution ? (
                        <Badge variant="default" className="bg-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Resolved
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Unresolved
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedAnomaly(anomaly)
                          setShowDetailModal(true)
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No anomalies found matching the current filters
            </div>
          )}
        </CardContent>
      </Card>

      {/* Anomaly Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anomaly Details</DialogTitle>
          </DialogHeader>

          {selectedAnomaly && (
            <div className="space-y-4">
              <div>
                <Label>Type</Label>
                <p className="text-sm font-medium">
                  {anomalyTypeLabels[selectedAnomaly.anomaly_type] || selectedAnomaly.anomaly_type}
                </p>
              </div>

              <div>
                <Label>Severity</Label>
                <Badge className={`${severityColors[selectedAnomaly.severity]} text-white ml-2`}>
                  {selectedAnomaly.severity.toUpperCase()}
                </Badge>
              </div>

              <div>
                <Label>Detected At</Label>
                <p className="text-sm">{new Date(selectedAnomaly.detected_at).toLocaleString()}</p>
              </div>

              {selectedAnomaly.resolution ? (
                <div>
                  <Label>Resolution</Label>
                  <p className="text-sm bg-muted p-3 rounded">{selectedAnomaly.resolution}</p>
                </div>
              ) : (
                <div>
                  <Label htmlFor="resolution">Resolution</Label>
                  <Textarea
                    id="resolution"
                    placeholder="Describe how you resolved this anomaly..."
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    rows={4}
                  />
                  <Button
                    className="mt-2"
                    onClick={handleResolve}
                    disabled={resolveAnomaly.isPending || !resolution}
                  >
                    {resolveAnomaly.isPending ? 'Resolving...' : 'Mark as Resolved'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
