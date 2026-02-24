'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useValidateQrScan } from '@novaconnect/data';
import {
    QrCode, Loader2, MapPin, CheckCircle2, AlertCircle,
    RefreshCw, Camera, Wifi, WifiOff, ScanLine, XCircle
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

    // GPS
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
                setGpsError(null);
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
        <div className="min-h-screen bg-gradient-to-b from-indigo-950 via-indigo-900 to-blue-900 flex flex-col">

            {/* Header */}
            <div className="flex-shrink-0 px-4 pt-6 pb-4 text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur mb-3">
                    <QrCode className="h-7 w-7 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white">Scanner QR Code</h1>
                <p className="text-indigo-200 text-sm mt-1">Pointez la caméra vers le QR code de votre salle de classe</p>
            </div>

            {/* GPS Status Bar */}
            <div className="flex-shrink-0 px-4 mb-4">
                <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                    gpsStatus === 'ok'
                        ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'
                        : gpsStatus === 'error'
                        ? 'bg-red-500/20 text-red-200 border border-red-400/30'
                        : 'bg-blue-500/20 text-blue-200 border border-blue-400/30'
                }`}>
                    {gpsStatus === 'loading' && <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />}
                    {gpsStatus === 'ok' && <MapPin className="h-4 w-4 flex-shrink-0" />}
                    {gpsStatus === 'error' && <WifiOff className="h-4 w-4 flex-shrink-0" />}
                    <span className="truncate">
                        {gpsStatus === 'loading' && "Localisation en cours..."}
                        {gpsStatus === 'ok' && `GPS actif · ${location?.latitude.toFixed(4)}, ${location?.longitude.toFixed(4)}`}
                        {gpsStatus === 'error' && (gpsError || "GPS indisponible")}
                    </span>
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex flex-col items-center justify-center px-4 pb-6">

                {/* === STATE: Idle (not scanning, no result) === */}
                {!isScanning && !scannedData && !validateMutation.isPending && (
                    <div className="w-full max-w-sm">
                        {/* Scanner placeholder */}
                        <div className="relative aspect-square rounded-3xl overflow-hidden bg-black/30 border-2 border-dashed border-white/20 mb-6 flex flex-col items-center justify-center gap-4">
                            {/* Corner decorations */}
                            <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-white/60 rounded-tl-lg" />
                            <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-white/60 rounded-tr-lg" />
                            <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-white/60 rounded-bl-lg" />
                            <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-white/60 rounded-br-lg" />

                            <div className="p-5 rounded-2xl bg-white/10">
                                <Camera className="h-12 w-12 text-white/60" />
                            </div>
                            <p className="text-white/50 text-sm text-center px-6">
                                Appuyez sur le bouton ci-dessous pour activer la caméra
                            </p>
                        </div>

                        {cameraError && (
                            <div className="flex items-start gap-3 bg-red-500/20 border border-red-400/30 rounded-2xl p-4 mb-4">
                                <AlertCircle className="h-5 w-5 text-red-300 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-red-200 font-semibold text-sm">Caméra indisponible</p>
                                    <p className="text-red-300/80 text-xs mt-0.5">{cameraError}</p>
                                </div>
                            </div>
                        )}

                        <Button
                            onClick={startCamera}
                            disabled={gpsStatus === 'error'}
                            size="lg"
                            className="w-full bg-white text-indigo-900 hover:bg-indigo-50 font-bold text-base h-14 rounded-2xl shadow-lg shadow-black/30 gap-2 disabled:opacity-50"
                        >
                            <Camera className="h-5 w-5" />
                            Activer la caméra
                        </Button>

                        {gpsStatus === 'error' && (
                            <p className="text-center text-amber-300 text-xs mt-3">
                                ⚠️ Le GPS est requis pour valider votre présence
                            </p>
                        )}
                    </div>
                )}

                {/* === STATE: Scanning === */}
                {isScanning && (
                    <div className="w-full max-w-sm">
                        <div className="relative aspect-square rounded-3xl overflow-hidden bg-black shadow-2xl mb-5">
                            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />

                            {/* Scan overlay */}
                            <div className="absolute inset-0 pointer-events-none">
                                {/* Dark border */}
                                <div className="absolute inset-0 bg-black/30" />

                                {/* Viewfinder square */}
                                <div className="absolute inset-12 bg-transparent">
                                    {/* Animated scan line */}
                                    <div className="absolute inset-0 overflow-hidden">
                                        <div className="w-full h-0.5 bg-indigo-400 shadow-[0_0_8px_2px_rgba(99,102,241,0.8)] animate-[scanLine_2s_ease-in-out_infinite]" />
                                    </div>
                                    {/* Corners */}
                                    <div className="absolute top-0 left-0 w-7 h-7 border-t-3 border-l-3 border-white rounded-tl-md" style={{borderTopWidth:3, borderLeftWidth:3}} />
                                    <div className="absolute top-0 right-0 w-7 h-7 border-t-3 border-r-3 border-white rounded-tr-md" style={{borderTopWidth:3, borderRightWidth:3}} />
                                    <div className="absolute bottom-0 left-0 w-7 h-7 border-b-3 border-l-3 border-white rounded-bl-md" style={{borderBottomWidth:3, borderLeftWidth:3}} />
                                    <div className="absolute bottom-0 right-0 w-7 h-7 border-b-3 border-r-3 border-white rounded-br-md" style={{borderBottomWidth:3, borderRightWidth:3}} />
                                </div>
                            </div>

                            {/* Instruction label */}
                            <div className="absolute bottom-0 left-0 right-0 backdrop-blur-sm bg-black/50 px-4 py-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <ScanLine className="h-4 w-4 text-indigo-300 animate-pulse" />
                                    <span className="text-white text-sm font-medium">Scan en cours...</span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={stopCamera}
                                    className="text-white/70 hover:text-white hover:bg-white/10 h-8 px-3 text-xs"
                                >
                                    Annuler
                                </Button>
                            </div>
                        </div>

                        <p className="text-center text-indigo-200 text-sm">
                            Placez le QR code à l'intérieur du cadre blanc
                        </p>
                    </div>
                )}

                {/* === STATE: Validating === */}
                {validateMutation.isPending && (
                    <div className="w-full max-w-sm flex flex-col items-center gap-6 py-8">
                        <div className="relative">
                            <div className="w-24 h-24 rounded-full bg-indigo-500/20 flex items-center justify-center">
                                <Loader2 className="h-12 w-12 text-indigo-300 animate-spin" />
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="text-white text-xl font-bold">Validation en cours</p>
                            <p className="text-indigo-200 text-sm mt-1">Vérification de votre présence...</p>
                        </div>
                    </div>
                )}

                {/* === STATE: Result === */}
                {!validateMutation.isPending && scanResult && (
                    <div className="w-full max-w-sm flex flex-col items-center gap-5 py-4">
                        {/* Icon */}
                        <div className={`w-28 h-28 rounded-full flex items-center justify-center shadow-2xl ${
                            scanResult === 'success'
                                ? 'bg-emerald-400/20 border-2 border-emerald-400/40'
                                : 'bg-red-400/20 border-2 border-red-400/40'
                        }`}>
                            {scanResult === 'success'
                                ? <CheckCircle2 className="h-14 w-14 text-emerald-300" />
                                : <XCircle className="h-14 w-14 text-red-300" />
                            }
                        </div>

                        {/* Message */}
                        <div className="text-center px-4">
                            <p className={`text-2xl font-bold ${
                                scanResult === 'success' ? 'text-emerald-300' : 'text-red-300'
                            }`}>
                                {scanResult === 'success' ? 'Présence enregistrée !' : 'Échec de la validation'}
                            </p>
                            <p className="text-indigo-200 text-sm mt-2 leading-relaxed">{resultMessage}</p>
                        </div>

                        {/* Actions */}
                        <div className="w-full flex flex-col gap-3 mt-2">
                            <Button
                                onClick={handleReset}
                                size="lg"
                                className="w-full bg-white text-indigo-900 hover:bg-indigo-50 font-bold text-base h-14 rounded-2xl gap-2"
                            >
                                <RefreshCw className="h-5 w-5" />
                                Scanner à nouveau
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Instructions footer */}
            {!isScanning && !scanResult && !validateMutation.isPending && (
                <div className="flex-shrink-0 px-4 pb-8">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                        <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-2.5">Comment ça marche ?</p>
                        <div className="space-y-2">
                            {[
                                { num: '1', text: 'Activez la caméra et le GPS' },
                                { num: '2', text: 'Pointez vers le QR code affiché en classe' },
                                { num: '3', text: 'La présence est automatiquement enregistrée' },
                            ].map(step => (
                                <div key={step.num} className="flex items-center gap-3">
                                    <span className="w-5 h-5 rounded-full bg-indigo-400/30 text-indigo-200 text-xs font-bold flex items-center justify-center flex-shrink-0">
                                        {step.num}
                                    </span>
                                    <span className="text-indigo-200 text-sm">{step.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                @keyframes scanLine {
                    0% { transform: translateY(0); opacity: 1; }
                    50% { transform: translateY(calc(100% - 2px)); opacity: 0.8; }
                    100% { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
