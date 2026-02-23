import * as React from 'react';
import { getSupabaseClient } from '../client';

interface OfflineAuthTokens {
  access_token: string;
  refresh_token: string;
  user: any;
}

/**
 * Hybrid Auth Service
 * Automatically switches between Supabase Cloud (online) and Gateway LAN (offline)
 */
class HybridAuthService {
  private gatewayUrl: string;
  private supabaseClient: any;
  private isOnline: boolean = true;
  private offlineTokens: OfflineAuthTokens | null = null;

  constructor(gatewayUrl: string = 'http://localhost:3001') {
    this.gatewayUrl = gatewayUrl;
    this.supabaseClient = getSupabaseClient();
    this.detectOnlineStatus();
  }

  /**
   * Detect if we're online (can reach Supabase)
   */
  private async detectOnlineStatus(): Promise<boolean> {
    try {
      const response = await fetch(`${this.supabaseClient.supabaseUrl}/rest/v1/`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000), // 3 second timeout
      });
      this.isOnline = response.ok;
    } catch {
      this.isOnline = false;
    }
    return this.isOnline;
  }

  /**
   * Register user (tries Supabase first, falls back to Gateway)
   */
  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: string;
    schoolCode: string;
  }): Promise<any> {
    // Try Supabase first
    if (this.isOnline) {
      try {
        const result = await this.supabaseClient.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            data: {
              first_name: data.firstName,
              last_name: data.lastName,
              role: data.role,
              school_code: data.schoolCode,
            },
          },
        });

        if (result.error) {
          // If it's a network error, fall back to offline mode
          if (result.error.message?.includes('Failed to fetch') || result.error.status === 0) {
            console.warn('Supabase unreachable, falling back to offline mode');
            this.isOnline = false;
            return await this.registerOffline(data);
          }
          throw result.error;
        }

        return result;
      } catch (error: any) {
        if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
          console.warn('Supabase unreachable, falling back to offline mode');
          this.isOnline = false;
          return await this.registerOffline(data);
        }
        throw error;
      }
    }

    // Offline mode - use Gateway
    return await this.registerOffline(data);
  }

  /**
   * Register offline (via Gateway)
   */
  private async registerOffline(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: string;
    schoolCode: string;
  }): Promise<any> {
    const response = await fetch(`${this.gatewayUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Offline registration failed');
    }

    const result = await response.json();

    // Store tokens locally for offline use
    this.offlineTokens = result;
    localStorage.setItem('offline_auth_tokens', JSON.stringify(result));
    localStorage.setItem('auth_mode', 'offline');

    return result;
  }

  /**
   * Login user (tries Supabase first, falls back to Gateway)
   */
  async login(email: string, password: string): Promise<any> {
    // Try Supabase first
    if (this.isOnline) {
      try {
        const result = await this.supabaseClient.auth.signInWithPassword({
          email,
          password,
        });

        if (result.error) {
          // If it's a network error, fall back to offline mode
          if (result.error.message?.includes('Failed to fetch') || result.error.status === 0) {
            console.warn('Supabase unreachable, falling back to offline mode');
            this.isOnline = false;
            return await this.loginOffline(email, password);
          }
          throw result.error;
        }

        return result;
      } catch (error: any) {
        if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
          console.warn('Supabase unreachable, falling back to offline mode');
          this.isOnline = false;
          return await this.loginOffline(email, password);
        }
        throw error;
      }
    }

    // Offline mode - use Gateway
    return await this.loginOffline(email, password);
  }

  /**
   * Login offline (via Gateway)
   */
  private async loginOffline(email: string, password: string): Promise<any> {
    const response = await fetch(`${this.gatewayUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Offline login failed');
    }

    const result = await response.json();

    // Store tokens locally
    this.offlineTokens = result;
    localStorage.setItem('offline_auth_tokens', JSON.stringify(result));
    localStorage.setItem('auth_mode', 'offline');

    return result;
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    const authMode = localStorage.getItem('auth_mode');

    if (authMode === 'offline' && this.offlineTokens) {
      // Logout from Gateway
      await fetch(`${this.gatewayUrl}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: this.offlineTokens.refresh_token }),
      });

      // Clear offline tokens
      this.offlineTokens = null;
      localStorage.removeItem('offline_auth_tokens');
      localStorage.removeItem('auth_mode');
    } else {
      // Logout from Supabase
      await this.supabaseClient.auth.signOut();
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<any> {
    const authMode = localStorage.getItem('auth_mode');

    if (authMode === 'offline') {
      // Try to load from localStorage
      const tokens = localStorage.getItem('offline_auth_tokens');
      if (tokens) {
        this.offlineTokens = JSON.parse(tokens);
        return this.offlineTokens?.user;
      }
      return null;
    }

    // Supabase user
    const { data } = await this.supabaseClient.auth.getUser();
    return data.user;
  }

  /**
   * Refresh token
   */
  async refreshSession(): Promise<any> {
    const authMode = localStorage.getItem('auth_mode');

    if (authMode === 'offline') {
      if (!this.offlineTokens?.refresh_token) {
        throw new Error('No refresh token available');
      }

      // Refresh via Gateway
      const response = await fetch(`${this.gatewayUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: this.offlineTokens.refresh_token }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const result = await response.json();

      // Update tokens
      this.offlineTokens = {
        ...this.offlineTokens,
        access_token: result.access_token,
      };
      localStorage.setItem('offline_auth_tokens', JSON.stringify(this.offlineTokens));

      return result;
    }

    // Supabase refresh
    return await this.supabaseClient.auth.refreshSession();
  }

  /**
   * Check if online
   */
  async checkOnline(): Promise<boolean> {
    const wasOnline = this.isOnline;
    const isNowOnline = await this.detectOnlineStatus();

    // If we just came online, sync pending data
    if (!wasOnline && isNowOnline && this.offlineTokens) {
      console.log('🌐 Back online! Syncing pending data...');
      await this.syncPendingData();
    }

    return isNowOnline;
  }

  /**
   * Sync pending offline data to cloud when back online
   */
  private async syncPendingData(): Promise<void> {
    // Trigger sync in Gateway
    try {
      await fetch(`${this.gatewayUrl}/api/sync/now`, {
        method: 'POST',
      });
      console.log('✅ Sync triggered');
    } catch (error) {
      console.error('❌ Sync failed:', error);
    }
  }

  /**
   * Get data (tries Supabase first, falls back to Gateway)
   */
  async getData(table: string, query?: any): Promise<any> {
    const isOnline = await this.checkOnline();

    if (isOnline) {
      // Try Supabase
      try {
        let supabaseQuery = this.supabaseClient.from(table);

        if (query?.select) {
          supabaseQuery = supabaseQuery.select(query.select);
        } else {
          supabaseQuery = supabaseQuery.select('*');
        }

        if (query?.eq) {
          Object.entries(query.eq).forEach(([key, value]) => {
            supabaseQuery = supabaseQuery.eq(key, value);
          });
        }

        if (query?.order) {
          supabaseQuery = supabaseQuery.order(query.order.column, {
            ascending: query.order.ascending ?? false
          });
        }

        const { data, error } = await supabaseQuery;

        if (!error) return data;

        // If network error, fall back to Gateway
        if (error.message?.includes('Failed to fetch')) {
          console.warn('Supabase unreachable, falling back to Gateway');
          return await this.getDataFromGateway(table, query);
        }
      } catch (error: any) {
        if (error.message?.includes('Failed to fetch')) {
          console.warn('Supabase unreachable, falling back to Gateway');
          return await this.getDataFromGateway(table, query);
        }
        throw error;
      }
    }

    // Offline mode - use Gateway
    return await this.getDataFromGateway(table, query);
  }

  /**
   * Get data from Gateway
   */
  private async getDataFromGateway(table: string, query?: any): Promise<any> {
    const authMode = localStorage.getItem('auth_mode');
    const tokens = authMode === 'offline' ? this.offlineTokens : null;

    if (!tokens) {
      throw new Error('Not authenticated in offline mode');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokens.access_token}`,
    };

    // Build query string
    const params = new URLSearchParams();
    if (query?.select) params.set('select', query.select);
    if (query?.eq) {
      Object.entries(query.eq).forEach(([key, value]) => {
        params.set(`eq.${key}`, String(value));
      });
    }

    const queryString = params.toString();
    const url = `${this.gatewayUrl}/api/${table}${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Gateway request failed: ${response.statusText}`);
    }

    return await response.json();
  }
}

// Singleton instance
let hybridAuthService: HybridAuthService | null = null;

/**
 * Get hybrid auth service instance
 */
export function getHybridAuthService(): HybridAuthService {
  if (!hybridAuthService) {
    hybridAuthService = new HybridAuthService(
      process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001'
    );
  }
  return hybridAuthService;
}

/**
 * Hook for hybrid auth (online/offline)
 */
export function useHybridAuth() {
  const [isOnline, setIsOnline] = React.useState(true);

  // Check online status periodically
  React.useEffect(() => {
    const service = getHybridAuthService();
    let mounted = true;

    const checkStatus = async () => {
      if (mounted) {
        const online = await service.checkOnline();
        setIsOnline(online);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000); // Check every 30s

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return {
    isOnline,
    authMode: localStorage.getItem('auth_mode') || 'online',
    hybridService: getHybridAuthService(),
  };
}
