'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuthContext } from '@novaconnect/data';

type VerificationResult = {
    valid: boolean;
    message: string;
    data?: {
        type: string;
        studentName?: string;
        matricule?: string;
        periodName?: string;
        timestamp: number;
        verifiedAt: string;
        schoolName?: string;
        amount?: number;
        paymentDate?: string;
    };
};

// Hook for native QR scanning using getUserMedia + BarcodeDetector / jsQR fallback
function useQrScanner(
    videoRef: React.RefObject<HTMLVideoElement | null>,
    enabled: boolean,
    onScan: (text: string) => void,
) {
    const streamRef = useRef<MediaStream | null>(null);
    const animFrameRef = useRef<number>(0);
    const scannedRef = useRef(false);

    const stopCamera = useCallback(() => {
        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = 0;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (!enabled) {
            stopCamera();
            scannedRef.current = false;
            return;
        }

        let cancelled = false;

        const startScanning = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' },
                });
                if (cancelled) {
                    stream.getTracks().forEach((t) => t.stop());
                    return;
                }
                streamRef.current = stream;
                const video = videoRef.current;
                if (!video) return;
                video.srcObject = stream;
                await video.play();

                // Try BarcodeDetector first (Chrome/Edge)
                const hasBarcodeDetector =
                    typeof window !== 'undefined' && 'BarcodeDetector' in window;

                if (hasBarcodeDetector) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const detector = new (window as any).BarcodeDetector({
                        formats: ['qr_code'],
                    });
                    const tick = async () => {
                        if (cancelled || scannedRef.current) return;
                        try {
                            const barcodes = await detector.detect(video);
                            if (barcodes.length > 0 && !scannedRef.current) {
                                scannedRef.current = true;
                                onScan(barcodes[0].rawValue);
                                return;
                            }
                        } catch {
                            // ignore detection errors on individual frames
                        }
                        animFrameRef.current = requestAnimationFrame(tick);
                    };
                    animFrameRef.current = requestAnimationFrame(tick);
                } else {
                    // Fallback: use jsQR via dynamic import from CDN
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    let jsQR: any = (window as any).jsQR;
                    if (!jsQR) {
                        await new Promise<void>((resolve, reject) => {
                            const script = document.createElement('script');
                            script.src =
                                'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
                            script.onload = () => resolve();
                            script.onerror = () =>
                                reject(new Error('Impossible de charger le décodeur QR'));
                            document.head.appendChild(script);
                        });
                        jsQR = (window as any).jsQR;
                    }

                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });

                    const tick = () => {
                        if (cancelled || scannedRef.current || !ctx) return;
                        if (video.readyState === video.HAVE_ENOUGH_DATA) {
                            canvas.width = video.videoWidth;
                            canvas.height = video.videoHeight;
                            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                            const imageData = ctx.getImageData(
                                0,
                                0,
                                canvas.width,
                                canvas.height,
                            );
                            const code = jsQR(
                                imageData.data,
                                imageData.width,
                                imageData.height,
                            );
                            if (code && !scannedRef.current) {
                                scannedRef.current = true;
                                onScan(code.data);
                                return;
                            }
                        }
                        animFrameRef.current = requestAnimationFrame(tick);
                    };
                    animFrameRef.current = requestAnimationFrame(tick);
                }
            } catch (err) {
                console.error('Camera error:', err);
            }
        };

        startScanning();

        return () => {
            cancelled = true;
            stopCamera();
        };
    }, [enabled, onScan, stopCamera, videoRef]);

    return { stopCamera };
}

export default function VerificationPage() {
    const [status, setStatus] = useState<'idle' | 'scanning' | 'verifying' | 'success' | 'error'>('idle');
    const [result, setResult] = useState<VerificationResult | null>(null);
    const { toast } = useToast();
    const { session } = useAuthContext();
    const videoRef = useRef<HTMLVideoElement | null>(null);

    const handleScan = useCallback(
        (text: string) => {
            setStatus('verifying');
            verifyQrCode(text);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [session],
    );

    const { stopCamera } = useQrScanner(videoRef, status === 'scanning', handleScan);

    const verifyQrCode = async (qrContent: string) => {
        try {
            let parsedContent;
            try {
                parsedContent = JSON.parse(qrContent);
            } catch {
                throw new Error('Format QR invalide. Ce n\'est pas un code NovaConnect valide.');
            }

            if (!parsedContent.data || !parsedContent.sig) {
                throw new Error('Données incomplètes dans le QR Code.');
            }

            const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/validate-document-qr`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    qrData: parsedContent.data,
                    signature: parsedContent.sig
                })
            });

            const resultData = await response.json();

            if (!response.ok) {
                throw new Error(resultData.message || 'Erreur lors de la vérification.');
            }

            if (resultData.valid) {
                setStatus('success');
                setResult({
                    valid: true,
                    message: resultData.message,
                    data: resultData.data
                });
                toast({
                    title: 'Document Authentique',
                    description: `Vérifié pour ${resultData.data.studentName}`,
                    variant: 'default',
                    className: 'bg-green-600 text-white'
                });
            } else {
                setStatus('error');
                setResult({
                    valid: false,
                    message: resultData.message
                });
                toast({
                    title: 'Authentification Échouée',
                    description: resultData.message,
                    variant: 'destructive',
                });
            }

        } catch (error: any) {
            setStatus('error');
            setResult({
                valid: false,
                message: error.message
            });
            toast({
                title: 'Erreur',
                description: error.message,
                variant: 'destructive',
            });
        }
    };

    const resetScan = () => {
        stopCamera();
        setResult(null);
        setStatus('idle');
    };

    const startScan = () => {
        setStatus('scanning');
    };

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Vérification de Documents</h1>
                    <p className="text-muted-foreground">Scannez un QR code sur un bulletin ou une carte pour vérifier son authenticité.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Scanner Section */}
                <Card className="border-indigo-100 shadow-sm overflow-hidden">
                    <CardHeader className="bg-slate-50 border-b border-slate-100">
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-indigo-600" />
                                Scanner
                            </CardTitle>
                            {status === 'scanning' && <Badge variant="secondary" className="animate-pulse">Caméra active</Badge>}
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 min-h-[300px] flex items-center justify-center bg-black relative">
                        {status === 'idle' && (
                            <div className="text-center p-8 bg-white w-full h-full flex flex-col items-center justify-center gap-4">
                                <ShieldCheck className="h-16 w-16 text-slate-300" />
                                <p className="text-slate-500">Prêt à scanner</p>
                                <Button onClick={startScan}>Activer la caméra</Button>
                            </div>
                        )}

                        {status === 'scanning' && (
                            <div className="w-full h-full relative" style={{ paddingTop: '100%' }}>
                                <video
                                    ref={videoRef}
                                    className="absolute inset-0 w-full h-full object-cover"
                                    playsInline
                                    muted
                                />
                                <div className="absolute inset-0 border-2 border-white/30 pointer-events-none">
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-indigo-500 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"></div>
                                </div>
                            </div>
                        )}

                        {(status === 'verifying' || status === 'success' || status === 'error') && (
                            <div className="w-full h-full bg-slate-50 flex flex-col items-center justify-center p-8">
                                {status === 'verifying' && (
                                    <>
                                        <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mb-4" />
                                        <p className="text-lg font-medium text-indigo-900">Vérification en cours...</p>
                                    </>
                                )}
                                {status === 'success' && (
                                    <>
                                        <CheckCircle className="h-16 w-16 text-emerald-500 mb-4" />
                                        <p className="text-lg font-bold text-emerald-700">Document Authentique</p>
                                    </>
                                )}
                                {status === 'error' && (
                                    <>
                                        <XCircle className="h-16 w-16 text-red-500 mb-4" />
                                        <p className="text-lg font-bold text-red-700">Non Valide</p>
                                    </>
                                )}
                                <Button variant="outline" className="mt-6" onClick={resetScan}>
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Nouveau scan
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Results Section */}
                <Card className="border-indigo-100 shadow-sm h-full">
                    <CardHeader className="bg-slate-50 border-b border-slate-100">
                        <CardTitle>Résultats de l&apos;analyse</CardTitle>
                        <CardDescription>Les détails du document scanné apparaîtront ici.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                        {!result && (
                            <div className="text-center py-12 text-slate-400">
                                <p>Aucune donnée disponible.</p>
                                <p className="text-sm">Scannez un QR code pour voir les détails.</p>
                            </div>
                        )}

                        {result && result.valid && result.data && (
                            <div className="space-y-6">
                                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start gap-3">
                                    <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5" />
                                    <div>
                                        <h3 className="font-semibold text-emerald-800">Signature Vérifiée</h3>
                                        <p className="text-emerald-700 text-sm">{result.message}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                    <div className="p-3 bg-slate-50 rounded-md border border-slate-100">
                                        <p className="text-xs font-medium text-slate-500 uppercase">Étudiant</p>
                                        <p className="text-lg font-semibold text-slate-900">{result.data.studentName}</p>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-md border border-slate-100">
                                        <p className="text-xs font-medium text-slate-500 uppercase">Matricule</p>
                                        <p className="font-medium text-slate-700">{result.data.matricule || '-'}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-3 bg-slate-50 rounded-md border border-slate-100">
                                            <p className="text-xs font-medium text-slate-500 uppercase">Type</p>
                                            <Badge variant="outline" className="mt-1">{result.data.type === 'report_card' ? 'Bulletin' : result.data.type}</Badge>
                                        </div>
                                        <div className="p-3 bg-slate-50 rounded-md border border-slate-100">
                                            <p className="text-xs font-medium text-slate-500 uppercase">Période</p>
                                            <p className="font-medium text-slate-700">{result.data.periodName || '-'}</p>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-md border border-slate-100">
                                        <p className="text-xs font-medium text-slate-500 uppercase">Généré le</p>
                                        <p className="font-medium text-slate-700">
                                            {new Date(result.data.timestamp).toLocaleDateString()} à {new Date(result.data.timestamp).toLocaleTimeString()}
                                        </p>
                                    </div>

                                    {result.data.schoolName && (
                                        <div className="p-3 bg-slate-50 rounded-md border border-slate-100">
                                            <p className="text-xs font-medium text-slate-500 uppercase">École</p>
                                            <p className="font-medium text-slate-700">{result.data.schoolName}</p>
                                        </div>
                                    )}

                                    {result.data.amount !== undefined && (
                                        <div className="p-3 bg-indigo-50 rounded-md border border-indigo-100">
                                            <p className="text-xs font-medium text-indigo-500 uppercase">Montant Payé</p>
                                            <p className="text-xl font-bold text-indigo-700">{Math.round(result.data.amount).toLocaleString('fr-FR')} FCFA</p>
                                        </div>
                                    )}

                                    {result.data.paymentDate && (
                                        <div className="p-3 bg-slate-50 rounded-md border border-slate-100">
                                            <p className="text-xs font-medium text-slate-500 uppercase">Date du Paiement</p>
                                            <p className="font-medium text-slate-700">{new Date(result.data.paymentDate).toLocaleDateString()}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {result && !result.valid && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                                <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                                <div>
                                    <h3 className="font-semibold text-red-800">Document Non Valide</h3>
                                    <p className="text-red-700 text-sm">{result.message}</p>
                                    <p className="text-red-600 text-xs mt-2">La signature numérique ne correspond pas ou le code a été altéré.</p>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

