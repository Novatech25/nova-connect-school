import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Loader2, RefreshCw, Maximize2, Minimize2, Pause, Play } from 'lucide-react'
import { useClassQrPremium, useGenerateClassQr, useManualRotateQr } from '@my-sandbox/data/hooks/useQrPremium'
import QRCode from 'react-qr-code'
import { useClassAttendanceSubscription } from '@my-sandbox/data/hooks/useQrPremium'

export default function QrDisplayPage() {
  const params = useParams()
  const schoolId = params?.schoolId as string
  const classId = params?.classId as string

  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [presentStudents, setPresentStudents] = useState<string[]>([])

  const { data: activeQr, isLoading } = useClassQrPremium(
    classId,
    true,
    isPaused ? undefined : 1000 // Refetch every second if not paused
  )

  const generateQr = useGenerateClassQr()
  const rotateQr = useManualRotateQr()

  // Subscribe to attendance updates
  useClassAttendanceSubscription(classId, () => {
    // Fetch updated list of present students
    fetchPresentStudents()
  })

  const fetchPresentStudents = async () => {
    // In real app, fetch from API
    // Mock data for now
    setPresentStudents(['Student 1', 'Student 2', 'Student 3'])
  }

  useEffect(() => {
    fetchPresentStudents()
  }, [classId])

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const handleRotate = async () => {
    try {
      await rotateQr.mutateAsync({ qrCodeId: activeQr?.id || '', reason: 'manual' })
    } catch (error) {
      console.error('Failed to rotate QR:', error)
    }
  }

  const handleGenerate = async () => {
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

  const formatTimeRemaining = (seconds: number) => {
    if (seconds <= 0) return 'Expired'
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  // Auto-rotate when expired
  useEffect(() => {
    if (!activeQr || isPaused) return

    if (activeQr.timeRemaining <= 0) {
      handleRotate()
    }
  }, [activeQr?.timeRemaining, isPaused])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">QR Code Display</h1>
            <p className="text-sm text-muted-foreground">
              Class: {classId} | {presentStudents.length} students present
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPaused(!isPaused)}
            >
              {isPaused ? (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleFullscreen}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="h-4 w-4 mr-2" />
                  Exit Fullscreen
                </>
              ) : (
                <>
                  <Maximize2 className="h-4 w-4 mr-2" />
                  Fullscreen
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* QR Code Display */}
          <Card className="p-8">
            {isLoading ? (
              <div className="flex items-center justify-center h-96">
                <Loader2 className="h-16 w-16 animate-spin" />
              </div>
            ) : activeQr ? (
              <div className="space-y-6">
                <div className="flex justify-center bg-white p-8 rounded-lg">
                  <QRCode value={activeQr.qrData} size={400} />
                </div>

                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center gap-4">
                    <div className="text-4xl font-bold">
                      {formatTimeRemaining(activeQr.timeRemaining)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      until expiration
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <span>Generation #{activeQr.generation_count}</span>
                    <span>•</span>
                    <span>Rotates every {activeQr.rotation_interval_seconds}s</span>
                  </div>
                </div>

                <div className="flex justify-center gap-4">
                  <Button onClick={handleRotate} disabled={rotateQr.isPending}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {rotateQr.isPending ? 'Rotating...' : 'Rotate Now'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleGenerate}
                    disabled={generateQr.isPending}
                  >
                    {generateQr.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      'Generate New'
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-lg text-muted-foreground mb-4">
                  No active QR code
                </p>
                <Button onClick={handleGenerate} disabled={generateQr.isPending}>
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
          </Card>

          {/* Real-time Attendance */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Present Students ({presentStudents.length})</h2>

            <div className="space-y-2">
              {presentStudents.length > 0 ? (
                presentStudents.map((student) => (
                  <div
                    key={student}
                    className="flex items-center justify-between p-3 bg-muted rounded"
                  >
                    <span>{student}</span>
                    <span className="text-xs text-muted-foreground">
                      Scanned just now
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No students have scanned yet
                </p>
              )}
            </div>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card mt-8">
        <div className="container mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
          QR Code automatically rotates when expired • Students scan to mark attendance
        </div>
      </footer>
    </div>
  )
}
