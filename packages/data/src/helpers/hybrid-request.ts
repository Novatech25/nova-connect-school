import type { SupabaseClient } from '@supabase/supabase-js';

export type SyncStrategy = 'gateway-first' | 'supabase-first';

const DEFAULT_STRATEGY: SyncStrategy = 'gateway-first';

export class GatewayError extends Error {
  status: number;
  payload?: any;

  constructor(message: string, status: number, payload?: any) {
    super(message);
    this.name = 'GatewayError';
    this.status = status;
    this.payload = payload;
  }
}

export function getSyncStrategy(): SyncStrategy {
  const strategy = process.env.NEXT_PUBLIC_SYNC_STRATEGY;
  if (strategy === 'gateway-first' || strategy === 'supabase-first') {
    return strategy;
  }
  return DEFAULT_STRATEGY;
}

export function getGatewayUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_GATEWAY_URL;
  return url && url.trim().length > 0 ? url : null;
}

async function getOfflineAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  const authMode = window.localStorage.getItem('auth_mode');
  if (authMode !== 'offline') {
    return null;
  }

  const raw = window.localStorage.getItem('offline_auth_tokens');
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed?.access_token || null;
  } catch {
    return null;
  }
}

async function getGatewayToken(supabase: SupabaseClient): Promise<string> {
  const offlineToken = await getOfflineAccessToken();
  if (offlineToken) {
    return offlineToken;
  }

  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || '';
}

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function gatewayRequest<T>(
  endpoint: string,
  options: RequestInit,
  supabase: SupabaseClient,
  schoolId?: string
): Promise<T> {
  const gatewayUrl = getGatewayUrl();
  if (!gatewayUrl) {
    throw new GatewayError('Gateway not configured', 0);
  }

  const token = await getGatewayToken(supabase);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (schoolId) {
    headers['X-School-Id'] = schoolId;
  }

  const response = await fetch(`${gatewayUrl}/api${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const payload = await safeJson(response);
    const message =
      payload?.error ||
      payload?.message ||
      `Gateway request failed with status ${response.status}`;
    throw new GatewayError(message, response.status, payload);
  }

  return (await safeJson(response)) as T;
}

export function shouldFallbackFromGateway(error: unknown): boolean {
  if (error instanceof GatewayError) {
    if (error.status === 0) return true;
    if (error.status >= 500) return true;
    if (error.status === 404) return true;
    return false;
  }

  const message = (error as any)?.message || '';
  return message.includes('Failed to fetch') || message.includes('NetworkError');
}

export function shouldFallbackFromSupabase(error: unknown): boolean {
  const message = (error as any)?.message || '';
  const status = (error as any)?.status;

  if (status && status >= 500) {
    return true;
  }

  return message.includes('Failed to fetch') || message.includes('NetworkError');
}

export async function runWithStrategy<T>(params: {
  strategy: SyncStrategy;
  gateway: () => Promise<T>;
  supabase: () => Promise<T>;
}): Promise<T> {
  const { strategy, gateway, supabase } = params;
  const hasGateway = Boolean(getGatewayUrl());

  if (strategy === 'supabase-first') {
    try {
      return await supabase();
    } catch (error) {
      if (!hasGateway || !shouldFallbackFromSupabase(error)) {
        throw error;
      }
      return await gateway();
    }
  }

  if (hasGateway) {
    try {
      return await gateway();
    } catch (error) {
      if (!shouldFallbackFromGateway(error)) {
        throw error;
      }
    }
  }

  return await supabase();
}
