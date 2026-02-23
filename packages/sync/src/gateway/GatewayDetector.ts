import { getBestGateway } from '@novaconnect/data/gateway';

export interface GatewayInfo {
  url: string;
  ip: string;
  port: number;
  schoolId: string;
  lastSeen: Date;
  latency?: number;
}

export type GatewayStatus = 'connected' | 'disconnected' | 'unknown';

export class GatewayDetector {
  private schoolId: string;
  private currentGateway: GatewayInfo | null = null;
  private pollingInterval: number = 30000; // 30 seconds
  private healthCheckInterval: number = 10000; // 10 seconds
  private pollingTimer: any = null;
  private healthCheckTimer: any = null;
  private listeners: Set<(gateway: GatewayInfo | null) => void> = new Set();
  private statusListeners: Set<(status: GatewayStatus) => void> = new Set();

  constructor(schoolId: string) {
    this.schoolId = schoolId;
    this.startPolling();
  }

  /**
   * Detect Gateway LAN using mDNS or cached info
   */
  async detectGateway(): Promise<GatewayInfo | null> {
    try {
      // Use getBestGateway from @novaconnect/data
      const gateway = await getBestGateway(this.schoolId);

      if (gateway && gateway.url) {
        const gatewayInfo: GatewayInfo = {
          url: gateway.url,
          ip: gateway.ip || this.extractIpFromUrl(gateway.url),
          port: gateway.port || this.extractPortFromUrl(gateway.url),
          schoolId: this.schoolId,
          lastSeen: new Date(),
        };

        // Test latency
        gatewayInfo.latency = await this.testLatency(gateway.url);

        this.currentGateway = gatewayInfo;
        this.notifyListeners(gatewayInfo);
        this.notifyStatusListeners('connected');

        console.log(`[GatewayDetector] Gateway detected: ${gateway.url} (${gatewayInfo.latency}ms)`);
        return gatewayInfo;
      }

      this.currentGateway = null;
      this.notifyListeners(null);
      this.notifyStatusListeners('disconnected');
      return null;

    } catch (error) {
      console.error('[GatewayDetector] Failed to detect gateway:', error);
      this.currentGateway = null;
      this.notifyListeners(null);
      this.notifyStatusListeners('disconnected');
      return null;
    }
  }

  /**
   * Start periodic polling for Gateway detection
   */
  private startPolling(): void {
    // Initial detection
    this.detectGateway();

    // Poll every 30 seconds
    this.pollingTimer = setInterval(async () => {
      if (!this.currentGateway) {
        await this.detectGateway();
      }
    }, this.pollingInterval);

    // Health check every 10 seconds if Gateway is connected
    this.healthCheckTimer = setInterval(async () => {
      if (this.currentGateway) {
        const isHealthy = await this.healthCheck(this.currentGateway.url);
        if (!isHealthy) {
          console.warn('[GatewayDetector] Gateway health check failed, redetecting...');
          this.currentGateway = null;
          this.notifyStatusListeners('disconnected');
          await this.detectGateway();
        }
      }
    }, this.healthCheckInterval);
  }

  /**
   * Stop polling
   */
  stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Health check for Gateway
   */
  private async healthCheck(gatewayUrl: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(`${gatewayUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return data.status === 'healthy';
      }

      return false;
    } catch (error) {
      console.warn('[GatewayDetector] Health check failed:', error);
      return false;
    }
  }

  /**
   * Test latency to Gateway
   */
  private async testLatency(gatewayUrl: string): Promise<number> {
    try {
      const start = performance.now();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

      const response = await fetch(`${gatewayUrl}/ping`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const end = performance.now();
        return Math.round(end - start);
      }

      return -1; // Error
    } catch (error) {
      return -1; // Error
    }
  }

  /**
   * Get current Gateway
   */
  getCurrentGateway(): GatewayInfo | null {
    return this.currentGateway;
  }

  /**
   * Get Gateway status
   */
  getGatewayStatus(): GatewayStatus {
    return this.currentGateway ? 'connected' : 'disconnected';
  }

  /**
   * Force rediscovery of Gateway
   */
  async rediscoverGateway(): Promise<GatewayInfo | null> {
    console.log('[GatewayDetector] Forcing Gateway rediscovery...');
    this.currentGateway = null;
    return await this.detectGateway();
  }

  /**
   * Subscribe to Gateway changes
   */
  onGatewayChange(callback: (gateway: GatewayInfo | null) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Subscribe to status changes
   */
  onStatusChange(callback: (status: GatewayStatus) => void): () => void {
    this.statusListeners.add(callback);
    return () => this.statusListeners.delete(callback);
  }

  /**
   * Notify listeners of Gateway change
   */
  private notifyListeners(gateway: GatewayInfo | null): void {
    this.listeners.forEach((listener) => {
      try {
        listener(gateway);
      } catch (error) {
        console.error('[GatewayDetector] Listener error:', error);
      }
    });
  }

  /**
   * Notify status listeners
   */
  private notifyStatusListeners(status: GatewayStatus): void {
    this.statusListeners.forEach((listener) => {
      try {
        listener(status);
      } catch (error) {
        console.error('[GatewayDetector] Status listener error:', error);
      }
    });
  }

  /**
   * Extract IP from URL
   */
  private extractIpFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url;
    }
  }

  /**
   * Extract port from URL
   */
  private extractPortFromUrl(url: string): number {
    try {
      const urlObj = new URL(url);
      return urlObj.port ? parseInt(urlObj.port, 10) : 80;
    } catch {
      return 80;
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopPolling();
    this.listeners.clear();
    this.statusListeners.clear();
  }
}
