'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useValidateQrScan } from '@novaconnect/data';
import { QrCode, Loader2, MapPin, CheckCircle2, AlertCircle, RefreshCw, Camera } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function StudentScanPage() {
    const [scannedData, setScannedData] = useState<string | null>(null);
    const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [gpsError, setGpsError] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animFrameRef = useRef<number | null>(null);

    const { toast } = useToast();
    const validateMutation = useValidateQrScan();

    useEffect(() => {
        if (!navigator.geolocation) {
            setGpsError("La géolocalisation n'est pas supportée par votre navigateur.");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
                setGpsError(null);
            },
            () => {
                setGpsError("Impossible d'obtenir votre position GPS.");
            },
            { enableHighAccuracy: true }
        );
    }, []);

    const stopCamera = useCallback(() => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setIsScanning(false);
    }, []);

    useEffect(() => () => stopCamera(), [stopCamera]);

    const processScan = useCallback(async (qrData: string) => {
        if (!location) {
            toast({ title: "GPS Requis", description: "Position GPS non disponible.", variant: "destructive" });
            return;
        }
        try {
            let parsedData: { token: string; signature: string };
            try { parsedData = JSON.parse(qrData); }
            catch {
                toast({ title: "QR Code Invalide", description: "Format non reconnu.", variant: "destructive" });
                return;
            }
            if (!parsedData.token || !parsedData.signature) {
                toast({ title: "QR Code Invalide", description: "Données manquantes.", variant: "destructive" });
                return;
            }
            const result = await validateMutation.mutateAsync({
                token: parsedData.token,
                signature: parsedData.signature,
                latitude: location.latitude,
                longitude: location.longitude,
                deviceInfo: { platform: 'web', appVersion: '1.0.0', deviceId: 'browser-' + navigator.userAgent }
            });
            if (result.success) {
                toast({ title: "Succès !", description: result.message || "Présence enregistrée.", className: "bg-green-100 border-green-200 text-green-800" });
            } else {
                toast({ title: "Échec", description: (result as { message?: string }).message || "Validation échouée.", variant: "destructive" });
            }
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : "Erreur lors de la validation.";
            toast({ title: "Erreur", description: msg, variant: "destructive" });
        }
    }, [location, toast, validateMutation]);

    const startCamera = useCallback(async () => {
        setCameraError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }
            setIsScanning(true);

            if ('BarcodeDetector' in window) {
                const detector = new (window as Window & { BarcodeDetector: new (opts: { formats: string[] }) => { detect: (el: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector({ formats: ['qr_code'] });
                const scan = async () => {
                    if (videoRef.current && videoRef.current.readyState === 4) {
                        try {
                            const codes = await detector.detect(videoRef.current);
                            if (codes.length > 0) {
                                stopCamera();
                                setScannedData(codes[0].rawValue);
                                await processScan(codes[0].rawValue);
                                return;
                            }
                        } catch { /* ignore */ }
                    }
                    animFrameRef.current = requestAnimationFrame(scan);
                };
                animFrameRef.current = requestAnimationFrame(scan);
            }
        } catch {
            setCameraError("Impossible d'accéder à la caméra. Veuillez autoriser l'accès.");
        }
    }, [stopCamera, processScan]);

    const handleReset = () => {
        setScannedData(null);
        startCamera();
    };

    return (
        <div className="space-y-6 max-w-xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold">Scanner QR Code</h1>
                <p className="text-gray-600 mt-2">Scannez le code QR de la classe pour valider votre présence.</p>
            </div>

            {!location && !gpsError && (
                <Alert className="bg-blue-50 text-blue-800 border-blue-200">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <AlertTitle>Localisation en cours</AlertTitle>
                    <AlertDescription>Acquisition de la position GPS...</AlertDescription>
                </Alert>
            )}
            {gpsError && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Erreur GPS</AlertTitle>
                    <AlertDescription>{gpsError}</AlertDescription>
                </Alert>
            )}
            {cameraError && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Erreur caméra</AlertTitle>
                    <AlertDescription>{cameraError}</AlertDescription>
                </Alert>
            )}

            <Card className="overflow-hidden">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <QrCode className="h-5 w-5" />Scanner
                    </CardTitle>
                    <CardDescription>Placez le QR code au centre du cadre</CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                    {!isScanning && !scannedData && (
                        <div className="flex flex-col items-center gap-4 py-8">
                            <Button onClick={startCamera} className="flex items-center gap-2">
                                <Camera className="h-4 w-4" />Activer la caméra
                            </Button>
                        </div>
                    )}
                    {isScanning && (
                        <div className="relative aspect-square bg-black rounded-md overflow-hidden mx-auto max-w-sm">
                            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                            <div className="absolute inset-0 border-2 border-white/50 m-12 rounded opacity-50 pointer-events-none" />
                            <Button variant="outline" size="sm" className="absolute bottom-2 right-2" onClick={stopCamera}>
                                Annuler
                            </Button>
                        </div>
                    )}
                    {!isScanning && scannedData && (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            {validateMutation.isPending ? (
                                <>
                                    <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
                                    <p className="text-lg font-medium">Validation en cours...</p>
                                </>
                            ) : (
                                <>
                                    <div className="rounded-full bg-green-100 p-3">
                                        <CheckCircle2 className="h-8 w-8 text-green-600" />
                                    </div>
                                    <p className="text-lg font-medium">Code scanné !</p>
                                    <Button onClick={handleReset} variant="outline">
                                        <RefreshCw className="mr-2 h-4 w-4" />Scanner à nouveau
                                    </Button>
                                </>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                <MapPin className="h-3 w-3" />
                {location
                    ? <span>GPS: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</span>
                    : <span>Position GPS non disponible</span>
                }
            </div>
        </div>
    );
}
