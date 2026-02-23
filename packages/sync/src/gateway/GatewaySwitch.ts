import { SyncMode } from '../sync/SyncEngine';

export class GatewaySwitch {
  private supabase: any;
  private currentMode: SyncMode = 'cloud';
  private gatewayUrl: string | null = null;
  private gatewayClient: any = null;
  private modeListeners: Set<(mode: SyncMode) => void> = new Set();

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  /**
   * Switch to Gateway mode
   */
  async switchToGateway(gatewayUrl: string): Promise<void> {
    console.log(`[GatewaySwitch] Switching to Gateway mode: ${gatewayUrl}`);

    this.gatewayUrl = gatewayUrl;
    this.currentMode = 'gateway';

    // Create Gateway-specific Supabase client
    this.gatewayClient = this.createGatewayClient(gatewayUrl);

    this.notifyModeListeners('gateway');
  }

  /**
   * Switch to Cloud mode
   */
  async switchToCloud(): Promise<void> {
    console.log('[GatewaySwitch] Switching to Cloud mode');

    this.gatewayUrl = null;
    this.currentMode = 'cloud';
    this.gatewayClient = null;

    this.notifyModeListeners('cloud');
  }

  /**
   * Get current mode
   */
  getCurrentMode(): SyncMode {
    return this.currentMode;
  }

  /**
   * Get current Supabase client (Gateway or Cloud)
   */
  getCurrentClient(): any {
    if (this.currentMode === 'gateway' && this.gatewayClient) {
      return this.gatewayClient;
    }
    return this.supabase;
  }

  /**
   * Get Gateway URL
   */
  getGatewayUrl(): string | null {
    return this.gatewayUrl;
  }

  /**
   * Subscribe to mode changes
   */
  onModeChange(callback: (mode: SyncMode) => void): () => void {
    this.modeListeners.add(callback);
    return () => this.modeListeners.delete(callback);
  }

  /**
   * Notify mode listeners
   */
  private notifyModeListeners(mode: SyncMode): void {
    this.modeListeners.forEach((listener) => {
      try {
        listener(mode);
      } catch (error) {
        console.error('[GatewaySwitch] Mode listener error:', error);
      }
    });
  }

  /**
   * Create Gateway-specific Supabase client
   */
  private createGatewayClient(gatewayUrl: string): any {
    // Create a Supabase client pointing to the Gateway
    // This assumes the Gateway implements the Supabase API
    const { createClient } = require('@supabase/supabase-js');

    const supabaseUrl = gatewayUrl;
    const supabaseKey = ''; // Gateway might not require auth key

    const client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      db: {
        schema: 'public',
      },
    });

    return client;
  }

  /**
   * Test Gateway connectivity
   */
  async testGatewayConnectivity(gatewayUrl: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${gatewayUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      return response.ok;
    } catch (error) {
      console.error('[GatewaySwitch] Gateway connectivity test failed:', error);
      return false;
    }
  }

  /**
   * Auto-detect best mode (Gateway or Cloud)
   */
  async autoDetectMode(gatewayUrl?: string): Promise<SyncMode> {
    if (gatewayUrl) {
      const isGatewayAvailable = await this.testGatewayConnectivity(gatewayUrl);

      if (isGatewayAvailable) {
        await this.switchToGateway(gatewayUrl);
        return 'gateway';
      }
    }

    await this.switchToCloud();
    return 'cloud';
  }

  /**
   * Get client info for debugging
   */
  getClientInfo(): {
    mode: SyncMode;
    gatewayUrl: string | null;
    isGatewayAvailable: boolean;
  } {
    return {
      mode: this.currentMode,
      gatewayUrl: this.gatewayUrl,
      isGatewayAvailable: this.currentMode === 'gateway' && this.gatewayUrl !== null,
    };
  }
}
