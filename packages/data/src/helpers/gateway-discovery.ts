// Dynamic import with browser fallback
let mdns: any;
try {
  // Try to import multicast-dns (Node.js only)
  mdns = require('multicast-dns');
} catch (error) {
  // Running in browser environment - module not available
  console.warn('multicast-dns not available (browser environment)');
  mdns = null;
}

export interface GatewayInfo {
  url: string;
  schoolId: string;
  version?: string;
  apiPath?: string;
}

/**
 * Discover NovaConnect Gateway on the local network using mDNS
 * @param schoolId - The school ID to search for
 * @param timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns Gateway info if found, null otherwise
 */
export async function discoverGateway(
  schoolId: string,
  timeoutMs = 5000
): Promise<GatewayInfo | null> {
  // Check if multicast-dns is available (Node.js environment)
  if (!mdns) {
    console.warn('Gateway discovery not available in browser environment');
    return null;
  }

  return new Promise((resolve) => {
    const dns = mdns();
    const serviceName = '_novaconnect._tcp.local';

    const timeout = setTimeout(() => {
      dns.destroy();
      resolve(null);
    }, timeoutMs);

    dns.on('response', (response: any) => {
      // Check if this is a NovaConnect Gateway response
      const ptrRecord = response.answers.find((a: any) =>
        a.type === 'PTR' && a.name === serviceName
      );

      if (!ptrRecord) {
        return;
      }

      // Extract TXT records for metadata
      const txtRecord = response.answers.find((a: any) => a.type === 'TXT');

      if (!txtRecord) {
        return;
      }

      // Parse TXT records
      const txtData = txtRecord.data.reduce((acc: any, item: string) => {
        const [key, ...valueParts] = item.split('=');
        const value = valueParts.join('=');
        acc[key] = value;
        return acc;
      }, {});

      // Check if this gateway belongs to the requested school
      if (txtData.schoolId !== schoolId) {
        return;
      }

      // Get SRV record for connection details
      const srvRecord = response.answers.find((a: any) => a.type === 'SRV');

      if (!srvRecord) {
        return;
      }

      // Get A record for IP address
      const aRecord = response.answers.find((a: any) => a.type === 'A');

      clearTimeout(timeout);
      dns.destroy();

      // Build gateway URL
      const host = aRecord?.data || srvRecord.data.target.replace('.local', '');
      const port = srvRecord.data.port;

      resolve({
        url: `http://${host}:${port}`,
        schoolId: txtData.schoolId,
        version: txtData.version,
        apiPath: txtData.api
      });
    });

    // Send mDNS query
    dns.query({
      questions: [{
        name: serviceName,
        type: 'PTR'
      }]
    });
  });
}

/**
 * Discover all NovaConnect Gateways on the local network
 * @param timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns Array of discovered gateways
 */
export async function discoverAllGateways(timeoutMs = 5000): Promise<GatewayInfo[]> {
  // Check if multicast-dns is available (Node.js environment)
  if (!mdns) {
    console.warn('Gateway discovery not available in browser environment');
    return [];
  }

  return new Promise((resolve) => {
    const dns = mdns();
    const serviceName = '_novaconnect._tcp.local';
    const gateways: GatewayInfo[] = [];

    const timeout = setTimeout(() => {
      dns.destroy();
      resolve(gateways);
    }, timeoutMs);

    const seenGateways = new Set<string>();

    dns.on('response', (response: any) => {
      // Check if this is a NovaConnect Gateway response
      const ptrRecord = response.answers.find((a: any) =>
        a.type === 'PTR' && a.name === serviceName
      );

      if (!ptrRecord) {
        return;
      }

      // Extract TXT records
      const txtRecord = response.answers.find((a: any) => a.type === 'TXT');

      if (!txtRecord) {
        return;
      }

      const txtData = txtRecord.data.reduce((acc: any, item: string) => {
        const [key, ...valueParts] = item.split('=');
        const value = valueParts.join('=');
        acc[key] = value;
        return acc;
      }, {});

      // Get SRV record
      const srvRecord = response.answers.find((a: any) => a.type === 'SRV');

      if (!srvRecord) {
        return;
      }

      // Get A record
      const aRecord = response.answers.find((a: any) => a.type === 'A');

      const host = aRecord?.data || srvRecord.data.target.replace('.local', '');
      const port = srvRecord.data.port;
      const gatewayKey = `${host}:${port}`;

      // Avoid duplicates
      if (seenGateways.has(gatewayKey)) {
        return;
      }

      seenGateways.add(gatewayKey);

      gateways.push({
        url: `http://${host}:${port}`,
        schoolId: txtData.schoolId,
        version: txtData.version,
        apiPath: txtData.api
      });
    });

    // Send mDNS query
    dns.query({
      questions: [{
        name: serviceName,
        type: 'PTR'
      }]
    });
  });
}

/**
 * Check if a Gateway is reachable
 * @param url - Gateway URL
 * @returns True if gateway is reachable
 */
export async function checkGatewayHealth(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000) // 3 second timeout
    });

    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Get the best available Gateway for a school
 * Tries to discover via mDNS, falls back to cloud if no gateway found
 * @param schoolId - The school ID
 * @returns Gateway info or null
 */
export async function getBestGateway(schoolId: string): Promise<GatewayInfo | null> {
  // Try to discover gateway on LAN
  const gateway = await discoverGateway(schoolId);

  if (gateway) {
    // Verify gateway is reachable
    const isHealthy = await checkGatewayHealth(gateway.url);

    if (isHealthy) {
      console.log('✅ Using Gateway LAN:', gateway.url);
      return gateway;
    }
  }

  console.log('☁️ No Gateway LAN found, using Cloud mode');
  return null;
}
