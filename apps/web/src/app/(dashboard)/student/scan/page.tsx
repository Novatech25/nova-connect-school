'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useValidateQrScan } from '@novaconnect/data';
import {
    QrCode, Loader2, MapPin, CheckCircle2, AlertCircle,
    RefreshCw, Camera, WifiOff, ScanLine, XCircle
} from 'lucide-react';

export default function StudentScanPage() {
    const [scannedData, setScannedData] = useState<string | null>(null);
    const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [gpsStatus, setGpsStatus] = useState<'loading' | 'ok' | 'error'>('loading');
    const [gpsError, setGpsError] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [scanResult, setScanResult] = useState<'success' | 'error' | null>(null);
    const [resultMessage, setResultMessage] = useState<string>('');
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animFrameRef = useRef<number | null>(null);

    const { toast } = useToast();
    const validateMutation = useValidateQrScan();

    useEffect(() => {
        if (!navigator.geolocation) {
            setGpsStatus('error');
            setGpsError("Géolocalisation non supportée.");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
                setGpsStatus('ok');
            },
            () => {
                setGpsStatus('error');
                setGpsError("Position GPS impossible. Activez la localisation.");
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
            setScanResult('error');
            setResultMessage("Position GPS indisponible. Activez la localisation.");
            return;
        }
        try {
            let parsedData: { token: string; signature: string };
            try { parsedData = JSON.parse(qrData); }
            catch {
                setScanResult('error');
                setResultMessage("QR code non reconnu. Utilisez le QR officiel de la classe.");
                return;
            }
            if (!parsedData.token || !parsedData.signature) {
                setScanResult('error');
                setResultMessage("QR code invalide. Données manquantes.");
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
                setScanResult('success');
                setResultMessage(result.message || "Votre présence a été enregistrée avec succès !");
            } else {
                setScanResult('error');
                setResultMessage((result as { message?: string }).message || "La validation a échoué. Réessayez.");
            }
        } catch (error: unknown) {
            setScanResult('error');
            setResultMessage(error instanceof Error ? error.message : "Erreur lors de la validation.");
        }
    }, [location, validateMutation]);

    const startCamera = useCallback(async () => {
        setCameraError(null);
        setScanResult(null);
        setResultMessage('');
        setScannedData(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }
            setIsScanning(true);

            if ('BarcodeDetector' in window) {
                const detector = new (window as Window & {
                    BarcodeDetector: new (opts: { formats: string[] }) => {
                        detect: (el: HTMLVideoElement) => Promise<{ rawValue: string }[]>
                    }
                }).BarcodeDetector({ formats: ['qr_code'] });

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
            setCameraError("Accès caméra refusé. Autorisez la caméra dans les paramètres du navigateur.");
        }
    }, [stopCamera, processScan]);

    const handleReset = () => {
        setScanResult(null);
        setResultMessage('');
        setScannedData(null);
        startCamera();
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 flex flex-col">

            {/* Header */}
            <div className="flex-shrink-0 px-4 pt-6 pb-4">
                <div className="flex items-center gap-3 mb-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
                        <QrCode className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900">Scanner QR Code</h1>
                        <p className="text-xs text-gray-500">Pointez la caméra vers le QR code de votre salle</p>
                    </div>
                </div>
            </div>

            {/* GPS Status */}
            <div className="flex-shrink-0 px-4 mb-4">
                <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm border transition-all ${
                    gpsStatus === 'ok'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : gpsStatus === 'error'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}>
                    {gpsStatus === 'loading' && <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />}
                    {gpsStatus === 'ok' && <MapPin className="h-4 w-4 flex-shrink-0" />}
                    {gpsStatus === 'error' && <WifiOff className="h-4 w-4 flex-shrink-0" />}
                    <span className="truncate text-xs font-medium">
                        {gpsStatus === 'loading' && "Localisation en cours..."}
                        {gpsStatus === 'ok' && `GPS actif · ${location?.latitude.toFixed(4)}, ${location?.longitude.toFixed(4)}`}
                        {gpsStatus === 'error' && (gpsError || "GPS indisponible")}
                    </span>
                </div>
            </div>

            {/* Main */}
            <div className="flex-1 flex flex-col items-center justify-center px-4 pb-6">

                {/* === Idle === */}
                {!isScanning && !scannedData && !validateMutation.isPending && (
                    <div className="w-full max-w-sm">
                        {/* Camera placeholder */}
                        <div className="relative aspect-square rounded-3xl overflow-hidden bg-white border-2 border-dashed border-gray-200 shadow-sm mb-5 flex flex-col items-center justify-center gap-3">
                            {/* Corner accents */}
                            <div className="absolute top-4 left-4 w-7 h-7 border-t-2 border-l-2 border-primary/40 rounded-tl-lg" />
                            <div className="absolute top-4 right-4 w-7 h-7 border-t-2 border-r-2 border-primary/40 rounded-tr-lg" />
                            <div className="absolute bottom-4 left-4 w-7 h-7 border-b-2 border-l-2 border-primary/40 rounded-bl-lg" />
                            <div className="absolute bottom-4 right-4 w-7 h-7 border-b-2 border-r-2 border-primary/40 rounded-br-lg" />

                            <div className="p-4 rounded-2xl bg-slate-50 border border-gray-100">
                                <Camera className="h-10 w-10 text-gray-400" />
                            </div>
                            <p className="text-gray-400 text-sm text-center px-8 leading-relaxed">
                                Appuyez sur le bouton pour activer la caméra
                            </p>
                        </div>

                        {cameraError && (
                            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4 mb-4">
                                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-red-700 font-semibold text-sm">Caméra indisponible</p>
                                    <p className="text-red-500 text-xs mt-0.5">{cameraError}</p>
                                </div>
                            </div>
                        )}

                        <Button
                            onClick={startCamera}
                            disabled={gpsStatus === 'error'}
                            size="lg"
                            className="w-full font-bold text-base h-14 rounded-2xl shadow-sm gap-2"
                        >
                            <Camera className="h-5 w-5" />
                            Activer la caméra
                        </Button>

                        {gpsStatus === 'error' && (
                            <p className="text-center text-amber-600 text-xs mt-3 bg-amber-50 border border-amber-200 rounded-xl py-2 px-3">
                                ⚠️ Le GPS est requis pour valider votre présence
                            </p>
                        )}
                    </div>
                )}

                {/* === Scanning === */}
                {isScanning && (
                    <div className="w-full max-w-sm">
                        <div className="relative aspect-square rounded-3xl overflow-hidden bg-black shadow-lg mb-4">
                            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />

                            <div className="absolute inset-0 pointer-events-none">
                                {/* Viewfinder */}
                                <div className="absolute inset-10">
                                    {/* Animated line */}
                                    <div className="absolute inset-0 overflow-hidden rounded">
                                        <div className="w-full h-0.5 bg-primary shadow-[0_0_8px_2px_rgba(99,102,241,0.6)]"
                                            style={{animation: 'scanLine 2s ease-in-out infinite'}} />
                                    </div>
                                    <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl" />
                                    <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr" />
                                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl" />
                                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white rounded-br" />
                                </div>
                            </div>

                            {/* Bottom bar */}
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-4 py-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <ScanLine className="h-4 w-4 text-primary animate-pulse" />
                                    <span className="text-white text-sm font-medium">Scan en cours...</span>
                                </div>
                                <Button variant="ghost" size="sm" onClick={stopCamera}
                                    className="text-white/70 hover:text-white hover:bg-white/10 h-7 px-2 text-xs">
                                    Annuler
                                </Button>
                            </div>
                        </div>
                        <p className="text-center text-gray-500 text-sm">Placez le QR code dans le cadre</p>
                    </div>
                )}

                {/* === Validating === */}
                {validateMutation.isPending && (
                    <div className="w-full max-w-sm flex flex-col items-center gap-5 py-8">
                        <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                            <Loader2 className="h-10 w-10 text-primary animate-spin" />
                        </div>
                        <div className="text-center">
                            <p className="text-gray-900 text-xl font-semibold">Validation en cours</p>
                            <p className="text-gray-500 text-sm mt-1">Vérification de votre présence...</p>
                        </div>
                    </div>
                )}

                {/* === Result === */}
                {!validateMutation.isPending && scanResult && (
                    <div className="w-full max-w-sm flex flex-col items-center gap-5 py-4">
                        <div className={`w-24 h-24 rounded-full flex items-center justify-center border-2 shadow-sm ${
                            scanResult === 'success'
                                ? 'bg-emerald-50 border-emerald-200'
                                : 'bg-red-50 border-red-200'
                        }`}>
                            {scanResult === 'success'
                                ? <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                                : <XCircle className="h-12 w-12 text-red-500" />
                            }
                        </div>

                        <div className={`w-full rounded-2xl border p-5 text-center ${
                            scanResult === 'success'
                                ? 'bg-emerald-50 border-emerald-200'
                                : 'bg-red-50 border-red-200'
                        }`}>
                            <p className={`text-lg font-bold mb-1 ${
                                scanResult === 'success' ? 'text-emerald-700' : 'text-red-700'
                            }`}>
                                {scanResult === 'success' ? '✅ Présence enregistrée !' : '❌ Validation échouée'}
                            </p>
                            <p className={`text-sm leading-relaxed ${
                                scanResult === 'success' ? 'text-emerald-600' : 'text-red-600'
                            }`}>{resultMessage}</p>
                        </div>

                        <Button onClick={handleReset} size="lg" variant="outline"
                            className="w-full h-13 rounded-2xl font-semibold gap-2 border-gray-200">
                            <RefreshCw className="h-4 w-4" />
                            Scanner à nouveau
                        </Button>
                    </div>
                )}
            </div>

            {/* Instructions footer */}
            {!isScanning && !scanResult && !validateMutation.isPending && (
                <div className="flex-shrink-0 px-4 pb-8">
                    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Comment ça marche ?</p>
                        <div className="space-y-2.5">
                            {[
                                { num: '1', text: 'Activez la caméra et assurez-vous que le GPS est actif' },
                                { num: '2', text: 'Pointez vers le QR code affiché en classe' },
                                { num: '3', text: 'La présence est automatiquement enregistrée' },
                            ].map(step => (
                                <div key={step.num} className="flex items-start gap-3">
                                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                                        {step.num}
                                    </span>
                                    <span className="text-gray-600 text-sm">{step.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                @keyframes scanLine {
                    0% { transform: translateY(0); opacity: 1; }
                    50% { transform: translateY(180px); opacity: 0.7; }
                    100% { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
