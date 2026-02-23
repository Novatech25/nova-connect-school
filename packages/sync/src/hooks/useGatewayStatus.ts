import { useState, useEffect, useCallback, useRef } from "react";
import { GatewayDetector, GatewayInfo, GatewayStatus } from '../gateway/GatewayDetector';
import { createStorageAdapter } from '../storage';

export function useGatewayStatus(schoolId?: string) {
  const [initialized, setInitialized] = useState(false);
  const [isGatewayAvailable, setIsGatewayAvailable] = useState(false);
  const [gatewayUrl, setGatewayUrl] = useState<string | null>(null);
  const [gatewayInfo, setGatewayInfo] = useState<GatewayInfo | null>(null);
  const [gatewayHealth, setGatewayHealth] = useState<'healthy' | 'degraded' | 'down'>('unknown');
  const gatewayDetectorRef = useRef<GatewayDetector | null>(null);
  const initializingRef = useRef(false);

  // Initialize gateway detector
  useEffect(() => {
    if (initialized || initializingRef.current || !schoolId) return;

    initializingRef.current = true;

    const init = async () => {
      try {
        const detector = new GatewayDetector(schoolId);

        // Subscribe to gateway changes
        detector.onGatewayChange((gateway) => {
          if (gateway) {
            setIsGatewayAvailable(true);
            setGatewayUrl(gateway.url);
            setGatewayInfo(gateway);

            // Determine health based on latency
            if (gateway.latency && gateway.latency < 100) {
              setGatewayHealth('healthy');
            } else if (gateway.latency && gateway.latency < 300) {
              setGatewayHealth('degraded');
            } else {
              setGatewayHealth('down');
            }
          } else {
            setIsGatewayAvailable(false);
            setGatewayUrl(null);
            setGatewayInfo(null);
            setGatewayHealth('down');
          }
        });

        // Subscribe to status changes
        detector.onStatusChange((status) => {
          if (status === 'connected') {
            setGatewayHealth('healthy');
          } else {
            setGatewayHealth('down');
          }
        });

        gatewayDetectorRef.current = detector;
        setInitialized(true);
      } catch (error) {
        console.error("Failed to initialize gateway detector:", error);
        initializingRef.current = false;
      }
    };

    init();
  }, [initialized, schoolId]);

  // Rediscover gateway
  const rediscoverGateway = useCallback(async () => {
    if (!gatewayDetectorRef.current) {
      throw new Error("Gateway detector not initialized");
    }

    const gateway = await gatewayDetectorRef.current.rediscoverGateway();

    if (gateway) {
      setIsGatewayAvailable(true);
      setGatewayUrl(gateway.url);
      setGatewayInfo(gateway);
    } else {
      setIsGatewayAvailable(false);
      setGatewayUrl(null);
      setGatewayInfo(null);
    }

    return gateway;
  }, []);

  // Test gateway connectivity
  const testConnectivity = useCallback(async (url: string) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${url}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      return response.ok;
    } catch (error) {
      console.error('Gateway connectivity test failed:', error);
      return false;
    }
  }, []);

  return {
    initialized,
    isGatewayAvailable,
    gatewayUrl,
    gatewayInfo,
    gatewayHealth,
    rediscoverGateway,
    testConnectivity,
  };
}
