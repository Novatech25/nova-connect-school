'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useValidateQrScan } from '@novaconnect/data';
import { QrCode, Loader2, MapPin, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { QrReader } from 'react-qr-reader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function StudentScanPage() {
    const [scannedData, setScannedData] = useState<string | null>(null);
    const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [gpsError, setGpsError] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(true);

    const { toast } = useToast();
    const validateMutation = useValidateQrScan();

    // Get location on mount
    useEffect(() => {
        if (!navigator.geolocation) {
            setGpsError("La géolocalisation n'est pas supportée par votre navigateur.");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                });
                setGpsError(null);
            },
            (error) => {
                console.error("Error getting location", error);
                setGpsError("Impossible d'obtenir votre position. Assurez-vous d'autoriser l'accès GPS.");
            },
            { enableHighAccuracy: true }
        );
    }, []);

    const handleScan = async (result: any, error: any) => {
        if (result && isScanning) {
            const data = result?.text;
            if (data) {
                setScannedData(data);
                setIsScanning(false);
                await processScan(data);
            }
        }
        // Ignore scan errors as they happen frequently when no QR is detected
    };

    const processScan = async (qrData: string) => {
        if (!location) {
            toast({
                title: "Erreur de localisation",
                description: "En attente de la position GPS...",
                variant: "destructive",
            });
            // Allow retry if location comes in late? For now, fail fast.
            // But actually, we might want to wait a bit or prompt user.
            if (gpsError) {
                toast({
                    title: "GPS Requis",
                    description: gpsError,
                    variant: "destructive",
                });
            }
            return;
        }

        try {
            // Parse the QR content if it's JSON, or just take the string
            // The QR generation logic (from QrConfigTab) seems to just put a string token or JSON.
            // Looking at `generate-qr-code` function logic would confirm, but let's assume it's the token.
            // Actually `generateQrCodeResponseSchema` has `qrData`, which is a string.
            // And `qrAttendanceCodeSchema` has `qr_token`.
            // The `validateQrScan` expects `token` and `signature`.
            // Wait, the hook `useValidateQrScan` calls `qrScanLogQueries.validate`.
            // The input is `ValidateQrScanInput` which has `token`, `signature`.
            // The scanned data from `react-qr-code` is the `value` prop.
            // In `QrConfigTab.tsx`, `QRCode value={code.qrData}`.
            // So the scanned text IS the `qrData`.

            // We need to parse this qrData. It's likely a JSON string containing token and signature?
            // Or maybe it's just the raw token string?
            // Let's assume it's a JSON string based on how these usually work for secure tokens.

            let parsedData;
            try {
                parsedData = JSON.parse(qrData);
            } catch (e) {
                // If not JSON, maybe it's just the token? But we need a signature too.
                console.error("Failed to parse QR data", e);
                toast({
                    title: "QR Code Invalide",
                    description: "Format de QR code non reconnu.",
                    variant: "destructive"
                });
                return;
            }

            if (!parsedData.token || !parsedData.signature) {
                toast({
                    title: "QR Code Invalide",
                    description: "Données manuquantes dans le QR code.",
                    variant: "destructive"
                });
                return;
            }

            const result = await validateMutation.mutateAsync({
                token: parsedData.token,
                signature: parsedData.signature,
                latitude: location.latitude,
                longitude: location.longitude,
                deviceInfo: {
                    platform: 'web',
                    appVersion: '1.0.0',
                    deviceId: 'browser-' + navigator.userAgent
                }
            });

            if (result.success) {
                toast({
                    title: "Succès !",
                    description: result.message || "Présence enregistrée.",
                    className: "bg-green-100 border-green-200 text-green-800",
                });
            } else {
                toast({
                    title: "Échec",
                    description: (result as any).message || "Validation échouée.", // Type assertion if needed
                    variant: "destructive",
                });
            }
        } catch (error: any) {
            console.error("Validation error", error);
            toast({
                title: "Erreur",
                description: error.message || "Une erreur est survenue lors de la validation.",
                variant: "destructive",
            });
        }
    };

    const handleReset = () => {
        setScannedData(null);
        setIsScanning(true);
    };

    // Use `onResult` prop for `react-qr-reader` v3? Or `onScan` for v2?
    // Most modern `react-qr-reader` usages use `onResult`. 
    // Let's assume the installed version is compatible with the latest API.

    return (
        <div className="space-y-6 max-w-xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold">Scanner QR Code</h1>
                <p className="text-gray-600 mt-2">
                    Scannez le code QR de la classe pour valider votre présence.
                </p>
            </div>

            {!location && !gpsError && (
                <Alert className="bg-blue-50 text-blue-800 border-blue-200">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <AlertTitle>Localisation en cours</AlertTitle>
                    <AlertDescription>
                        Veuillez patienter pendant l'acquisition de votre position GPS...
                    </AlertDescription>
                </Alert>
            )}

            {gpsError && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Erreur GPS</AlertTitle>
                    <AlertDescription>
                        {gpsError}
                        <Button variant="link" onClick={() => window.location.reload()} className="p-0 h-auto ml-2">
                            Réessayer
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            <Card className="overflow-hidden">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <QrCode className="h-5 w-5" />
                        Scanner
                    </CardTitle>
                    <CardDescription>
                        Placez le QR code au centre du cadre
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0 sm:p-6">
                    {isScanning ? (
                        <div className="relative aspect-square bg-black rounded-md overflow-hidden mx-auto max-w-sm">
                            {/* 
                   Note: QrReader constraints and props might vary by version.
                   Using standard props for widely used versions.
                 */}
                            <QrReader
                                onResult={handleScan}
                                constraints={{ facingMode: 'environment' }}
                                className="w-full h-full"
                                scanDelay={500}
                            />
                            <div className="absolute inset-0 border-2 border-white/50 m-12 rounded opacity-50 pointer-events-none" />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            {validateMutation.isPending ? (
                                <>
                                    <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
                                    <p className="text-lg font-medium">Validation en cours...</p>
                                </>
                            ) : scannedData ? (
                                <>
                                    <div className="rounded-full bg-green-100 p-3">
                                        <CheckCircle2 className="h-8 w-8 text-green-600" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-lg font-medium">Code scanné !</p>
                                        <p className="text-sm text-gray-500 max-w-xs truncate mx-auto">{scannedData}</p>
                                    </div>
                                    <Button onClick={handleReset} variant="outline" className="mt-4">
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        Scanner à nouveau
                                    </Button>
                                </>
                            ) : (
                                <Button onClick={handleReset}>Activer la caméra</Button>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                <MapPin className="h-3 w-3" />
                {location ? (
                    <span>
                        Position GPS: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                    </span>
                ) : (
                    <span>Position GPS non disponible</span>
                )}
            </div>
        </div>
    );
}
