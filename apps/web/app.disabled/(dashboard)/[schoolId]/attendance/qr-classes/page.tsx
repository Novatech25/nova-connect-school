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
import { Loader2, RefreshCw, QrCode, Clock, Download } from 'lucide-react'
import {
  useClassQrPremium,
  useClassQrHistory,
  useGenerateClassQr,
  useManualRotateQr,
  useDeactivateQr,
} from '@my-sandbox/data/hooks/useQrPremium'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import QRCode from 'react-qr-code'
import { useEffect } from 'react'

export default function QrClassesPage() {
  const params = useParams()
  const schoolId = params?.schoolId as string

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const [showQrModal, setShowQrModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)

  // Mock classes data - in real app, fetch from API
  const classes = [
    { id: 'class-1', name: 'Mathematics 101', teacher: 'John Doe', studentCount: 25 },
    { id: 'class-2', name: 'Physics 201', teacher: 'Jane Smith', studentCount: 20 },
    { id: 'class-3', name: 'Chemistry 101', teacher: 'Bob Johnson', studentCount: 22 },
  ]

  // Get active QR for selected class
  const { data: activeQr, isLoading: isLoadingQr } = useClassQrPremium(
    selectedClassId || '',
    !!selectedClassId,
    1000 // Refetch every second
  )

  // Get QR history for selected class
  const { data: qrHistory } = useClassQrHistory(selectedClassId || '', 10)

  const generateQr = useGenerateClassQr()
  const rotateQr = useManualRotateQr()
  const deactivateQr = useDeactivateQr()

  const handleGenerateQr = async (classId: string) => {
    try {
      await generateQr.mutateAsync({
        schoolId,
        classId,
        rotationIntervalSeconds: 60,
      })
    } catch (error) {
      console.error('Failed to generate QR:', error)
    }
  }

  const handleRotateQr = async () => {
    if (!activeQr) return
    try {
      await rotateQr.mutateAsync({ qrCodeId: activeQr.id, reason: 'manual' })
    } catch (error) {
      console.error('Failed to rotate QR:', error)
    }
  }

  const handleDeactivateQr = async () => {
    if (!activeQr) return
    try {
      await deactivateQr.mutateAsync(activeQr.id)
      setShowQrModal(false)
    } catch (error) {
      console.error('Failed to deactivate QR:', error)
    }
  }

  const formatTimeRemaining = (seconds: number) => {
    if (seconds <= 0) return 'Expired'
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Class QR Management</h1>
        <p className="text-muted-foreground mt-2">
          Generate and manage QR codes for individual classes
        </p>
      </div>

      {/* Classes Table */}
      <Card>
        <CardHeader>
          <CardTitle>Classes</CardTitle>
          <CardDescription>Select a class to manage its QR code</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class Name</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>QR Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.map((classItem) => (
                <TableRow key={classItem.id}>
                  <TableCell className="font-medium">{classItem.name}</TableCell>
                  <TableCell>{classItem.teacher}</TableCell>
                  <TableCell>{classItem.studentCount}</TableCell>
                  <TableCell>
                    <Badge variant="outline">Active QR Available</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedClassId(classItem.id)
                          setShowQrModal(true)
                        }}
                      >
                        <QrCode className="h-4 w-4 mr-1" />
                        View QR
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedClassId(classItem.id)
                          handleGenerateQr(classItem.id)
                        }}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Generate
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* QR Display Modal */}
      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Class QR Code</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {isLoadingQr ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : activeQr ? (
              <>
                <div className="flex justify-center bg-white p-8 rounded-lg">
                  <QRCode value={activeQr.qrData} size={300} />
                </div>

                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <span className="text-lg font-semibold">
                      Expires in: {formatTimeRemaining(activeQr.timeRemaining)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Generation #{activeQr.generation_count}
                  </p>
                </div>

                <div className="flex justify-center gap-4">
                  <Button onClick={handleRotateQr} disabled={rotateQr.isPending}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {rotateQr.isPending ? 'Rotating...' : 'Rotate Now'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowHistoryModal(true)
                    }}
                  >
                    View History
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const svg = document.getElementById('qr-code-svg')
                      if (svg) {
                        const svgData = new XMLSerializer().serializeToString(svg)
                        const canvas = document.createElement('canvas')
                        const ctx = canvas.getContext('2d')
                        const img = new Image()
                        img.onload = () => {
                          canvas.width = 300
                          canvas.height = 300
                          ctx?.drawImage(img, 0, 0)
                          const png = canvas.toDataURL('image/png')
                          const link = document.createElement('a')
                          link.download = `qr-code-${selectedClassId}.png`
                          link.href = png
                          link.click()
                        }
                        img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
                      }
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  <Button variant="destructive" onClick={handleDeactivateQr}>
                    Deactivate
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No active QR code for this class</p>
                <Button
                  className="mt-4"
                  onClick={() => {
                    if (selectedClassId) handleGenerateQr(selectedClassId)
                  }}
                  disabled={generateQr.isPending}
                >
                  {generateQr.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    'Generate QR Code'
                  )}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* QR History Modal */}
      <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QR Code History</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {qrHistory && qrHistory.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Generation</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Expired</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {qrHistory.map((qr) => (
                    <TableRow key={qr.id}>
                      <TableCell>#{qr.generation_count}</TableCell>
                      <TableCell>
                        {new Date(qr.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {new Date(qr.expires_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={qr.is_active ? 'default' : 'secondary'}>
                          {qr.is_active ? 'Active' : 'Expired'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-4">No history available</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
