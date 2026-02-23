'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wifi, WifiOff, Server, Cloud } from 'lucide-react';

export function GenerationModeIndicator() {
  const [gatewayStatus, setGatewayStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [gatewayUrl, setGatewayUrl] = useState<string | null>(null);

  useEffect(() => {
    const checkGateway = async () => {
      const url = process.env.NEXT_PUBLIC_GATEWAY_URL;
      setGatewayUrl(url || null);

      if (!url) {
        setGatewayStatus('offline');
        return;
      }

      try {
        const response = await fetch(`${url}/health`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (response.ok) {
          setGatewayStatus('online');
        } else {
          setGatewayStatus('offline');
        }
      } catch (error) {
        // Gateway not available - this is expected in supabase-first mode
        setGatewayStatus('offline');
      }
    };

    checkGateway();
    const interval = setInterval(checkGateway, 10000); // Vérifier toutes les 10s

    return () => clearInterval(interval);
  }, []);

  if (gatewayStatus === 'checking') {
    return (
      <Badge variant="outline" className="animate-pulse">
        Vérification du mode de génération...
      </Badge>
    );
  }

  if (gatewayStatus === 'online') {
    return (
      <div className="flex items-center gap-2">
        <Badge className="bg-green-100 text-green-800 border-green-300">
          <Server className="w-3 h-3 mr-1" />
          Gateway LAN (Nouveau Design)
        </Badge>
        <span className="text-xs text-muted-foreground">{gatewayUrl}</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="border-amber-300 text-amber-700">
          <Cloud className="w-3 h-3 mr-1" />
          Supabase Cloud (Mode Fallback)
        </Badge>
      </div>
      <Alert className="border-amber-200 bg-amber-50">
        <WifiOff className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 text-sm">
          <p className="font-medium">Gateway non disponible</p>
          <p>Pour utiliser le nouveau design de bulletin :</p>
          <ol className="list-decimal ml-4 mt-1 text-xs">
            <li>Ouvrez un terminal</li>
            <li>Exécutez : <code className="bg-amber-100 px-1 rounded">cd apps/gateway && bun dev</code></li>
            <li>Rechargez cette page</li>
          </ol>
        </AlertDescription>
      </Alert>
    </div>
  );
}
