export interface MdnsConfig {
  serviceName: string;
  serviceType: string;
  domain: string;
  port: number;
  txtRecords?: Record<string, string>;
}

export function loadMdnsConfig(): MdnsConfig {
  return {
    serviceName: process.env.MDNS_SERVICE_NAME || 'NovaConnect-Gateway',
    serviceType: process.env.MDNS_SERVICE_TYPE || '_novaconnect._tcp',
    domain: process.env.MDNS_DOMAIN || 'local',
    port: parseInt(process.env.PORT || '3001', 10),
    txtRecords: {
      version: process.env.npm_package_version || '1.0.0',
      api: '/api/v1'
    }
  };
}
