import { createClient } from '@supabase/supabase-js';
import { getBestGateway, type GatewayInfo } from '../helpers/gateway-discovery';
export { getBestGateway, type GatewayInfo };

export interface GatewayClientConfig {
  schoolId: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export class GatewayClient {
  private gatewayUrl: string | null = null;
  private gatewayInfo: GatewayInfo | null = null;
  private supabaseClient: ReturnType<typeof createClient>;
  private schoolId: string;
  private initialized: boolean = false;

  constructor(config: GatewayClientConfig) {
    this.schoolId = config.schoolId;
    this.supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey);
  }

  /**
   * Initialize the gateway client
   * Discovers Gateway LAN on startup
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.gatewayInfo = await getBestGateway(this.schoolId);

      if (this.gatewayInfo) {
        this.gatewayUrl = this.gatewayInfo.url;
        console.log('✅ Gateway LAN detected:', this.gatewayUrl);
      } else {
        console.log('☁️ Mode Cloud (pas de Gateway LAN)');
      }
    } catch (error) {
      console.warn('Failed to discover gateway:', error);
      console.log('☁️ Falling back to Cloud mode');
    }

    this.initialized = true;
  }

  /**
   * Make a request with automatic fallback
   * Tries Gateway LAN first, falls back to Supabase Cloud
   */
  async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    if (!this.initialized) {
      await this.init();
    }

    // Try Gateway LAN first
    if (this.gatewayUrl) {
      try {
        const response = await fetch(`${this.gatewayUrl}/api${endpoint}`, {
          ...options,
          headers: {
            ...options.headers,
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await this.getToken()}`,
            'X-School-Id': this.schoolId
          }
        });

        if (response.ok) {
          const data = await response.json();
          return data;
        }

        // If gateway returns an error, log but don't fail over yet
        console.warn(`Gateway LAN returned error: ${response.status}`);

      } catch (error) {
        console.warn('Gateway LAN inaccessible, falling back to Cloud', error);
        // Disable gateway for this session
        this.gatewayUrl = null;
      }
    }

    // Fallback to Supabase Cloud
    return this.supabaseRequest(endpoint, options);
  }

  /**
   * Make a Supabase request
   * Used as fallback when Gateway is unavailable
   */
  private async supabaseRequest(endpoint: string, options: RequestInit): Promise<any> {
    // Map Gateway endpoints to Supabase table operations
    const method = options.method || 'GET';
    const mapping = this.mapEndpointToSupabase(endpoint, method);

    if (!mapping) {
      throw new Error(`Unsupported endpoint: ${endpoint}`);
    }

    const { table, operation, filters } = mapping;
    const body = options.body ? JSON.parse(options.body) : {};

    switch (operation) {
      case 'select':
        let query = this.supabaseClient.from(table).select('*');
        for (const [key, value] of Object.entries(filters || {})) {
          query = query.eq(key, value);
        }
        const { data, error } = await query;
        if (error) throw error;
        return data;

      case 'insert':
        const insertResult = await this.supabaseClient.from(table).insert(body);
        if (insertResult.error) throw insertResult.error;
        return insertResult.data;

      case 'update':
        const updateResult = await this.supabaseClient
          .from(table)
          .update(body)
          .eq('id', filters?.id);
        if (updateResult.error) throw updateResult.error;
        return updateResult.data;

      case 'delete':
        const deleteResult = await this.supabaseClient
          .from(table)
          .delete()
          .eq('id', filters?.id);
        if (deleteResult.error) throw deleteResult.error;
        return deleteResult.data;

      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  }

  /**
   * Map Gateway endpoint to Supabase table operation
   * Determines operation based on HTTP method
   */
  private mapEndpointToSupabase(endpoint: string, method: string): any {
    // Parse endpoint to extract resource IDs
    const parts = endpoint.split('/').filter(Boolean);
    const resource = parts[0]; // e.g., 'attendance', 'grades', etc.
    const subResource = parts[1]; // e.g., 'sessions', 'records', 'student/123', etc.
    const resourceId = parts[2]; // e.g., specific ID if present

    // Helper to extract ID from path pattern like /resource/:id
    const getIdFromPath = (idx: number): string | undefined => {
      return parts[idx];
    };

    // Determine filters based on path pattern
    const getFilters = (): any => {
      // Pattern: /resource/:id
      if (resourceId && resourceId.length > 0 && !subResource?.includes('/')) {
        return { id: resourceId };
      }

      // Pattern: /resource/subresource/:id
      if (parts[3]) {
        return { id: parts[3] };
      }

      // Pattern: /resource/student/:id, /resource/class/:id
      if (subResource?.includes('/')) {
        const [_, id] = subResource.split('/');
        const filterKey = resource === 'grades' || resource === 'lesson-logs' || resource === 'schedule'
          ? resource.slice(0, -1) // Remove 's' from plural
          : subResource; // e.g., 'student', 'class'
        return { [filterKey + (filterKey !== subResource ? '_id' : '_id')]: id };
      }

      return {};
    };

    // Determine operation based on HTTP method
    const getOperation = (): string => {
      switch (method.toUpperCase()) {
        case 'POST':
          return 'insert';
        case 'PUT':
        case 'PATCH':
          return 'update';
        case 'DELETE':
          return 'delete';
        case 'GET':
        default:
          return 'select';
      }
    };

    // Map endpoints to tables
    const tableMap: Record<string, string> = {
      'attendance': subResource === 'sessions' ? 'attendance_sessions' : 'attendance_records',
      'grades': 'grades',
      'lesson-logs': 'lesson_logs',
      'payments': 'payments',
      'schedule': 'schedules'
    };

    const table = tableMap[resource];
    if (!table) {
      return null;
    }

    return {
      table,
      operation: getOperation(),
      filters: getFilters()
    };
  }

  /**
   * Get current auth token
   */
  private async getToken(): Promise<string> {
    const { data } = await this.supabaseClient.auth.getSession();
    return data.session?.access_token || '';
  }

  /**
   * Check if Gateway LAN is available
   */
  isGatewayAvailable(): boolean {
    return this.gatewayUrl !== null;
  }

  /**
   * Get Gateway URL
   */
  getGatewayUrl(): string | null {
    return this.gatewayUrl;
  }

  /**
   * Refresh gateway discovery
   */
  async rediscoverGateway(): Promise<void> {
    this.initialized = false;
    await this.init();
  }

  /**
   * Attendance operations
   */
  async createAttendanceSession(data: any): Promise<any> {
    return this.request('/attendance/sessions', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async markAttendance(data: any): Promise<any> {
    return this.request('/attendance/records', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async bulkMarkAttendance(data: any): Promise<any> {
    return this.request('/attendance/records/bulk', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * Grades operations
   */
  async createGrade(data: any): Promise<any> {
    return this.request('/grades', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getStudentGrades(studentId: string, filters?: any): Promise<any> {
    let endpoint = `/grades/student/${studentId}`;
    if (filters) {
      const params = new URLSearchParams(filters).toString();
      endpoint += `?${params}`;
    }
    return this.request(endpoint);
  }

  /**
   * Lesson logs operations
   */
  async createLessonLog(data: any): Promise<any> {
    return this.request('/lesson-logs', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getClassLessonLogs(classId: string, filters?: any): Promise<any> {
    let endpoint = `/lesson-logs/class/${classId}`;
    if (filters) {
      const params = new URLSearchParams(filters).toString();
      endpoint += `?${params}`;
    }
    return this.request(endpoint);
  }

  /**
   * Payments operations
   */
  async createPayment(data: any): Promise<any> {
    return this.request('/payments', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getStudentPayments(studentId: string, filters?: any): Promise<any> {
    let endpoint = `/payments/student/${studentId}`;
    if (filters) {
      const params = new URLSearchParams(filters).toString();
      endpoint += `?${params}`;
    }
    return this.request(endpoint);
  }

  /**
   * Schedule operations
   */
  async getClassSchedule(classId: string, filters?: any): Promise<any> {
    let endpoint = `/schedule/class/${classId}`;
    if (filters) {
      const params = new URLSearchParams(filters).toString();
      endpoint += `?${params}`;
    }
    return this.request(endpoint);
  }
}
