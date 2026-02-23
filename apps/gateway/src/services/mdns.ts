import mdns from 'multicast-dns';
import { hostname } from 'os';
import { loadMdnsConfig } from '../config/mdns.js';

export class MdnsService {
  private mdns: any;
  private config: any;
  private schoolId: string;

  constructor(port: number, schoolId: string) {
    const config = loadMdnsConfig();
    this.config = { ...config, port };
    this.schoolId = schoolId;
    this.mdns = mdns();
  }

  // Start announcing the Gateway service
  start(): void {
    const serviceName = `${this.config.serviceName}-${this.schoolId}.${this.config.serviceType}.${this.config.domain}`;

    this.mdns.on('query', (query: any) => {
      // Check if anyone is looking for our service
      const isQueryingForUs = query.questions.some((q: any) =>
        q.name === `${this.config.serviceType}.${this.config.domain}` ||
        q.name === serviceName
      );

      if (isQueryingForUs) {
        this.mdns.respond({
          answers: [
            {
              name: `${this.config.serviceType}.${this.config.domain}`,
              type: 'PTR',
              data: serviceName
            },
            {
              name: serviceName,
              type: 'SRV',
              data: {
                port: this.config.port,
                target: `${hostname()}.${this.config.domain}`
              }
            },
            {
              name: serviceName,
              type: 'TXT',
              data: Object.entries({
                ...this.config.txtRecords,
                schoolId: this.schoolId
              }).map(([key, value]) => `${key}=${value}`)
            },
            {
              name: serviceName,
              type: 'A',
              data: this.getLocalIP()
            }
          ]
        });
      }
    });

    console.log(`📡 mDNS service started: ${this.config.serviceType}.${this.config.domain}`);
    console.log(`📡 Service name: ${serviceName}`);
  }

  // Stop mDNS service
  stop(): void {
    if (this.mdns) {
      this.mdns.destroy();
      console.log('📡 mDNS service stopped');
    }
  }

  // Get local IP address
  private getLocalIP(): string {
    const interfaces = require('os').networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return '127.0.0.1';
  }

  // Optional: Browse for other gateways (for multi-gateway setups)
  browse(timeoutMs = 5000): Promise<any[]> {
    return new Promise((resolve) => {
      const gateways: any[] = [];
      const timeout = setTimeout(() => {
        this.mdns.destroy();
        resolve(gateways);
      }, timeoutMs);

      this.mdns.on('response', (response: any) => {
        response.answers.forEach((answer: any) => {
          if (answer.type === 'PTR' && answer.name.includes('novaconnect')) {
            gateways.push(answer);
          }
        });
      });

      this.mdns.query({
        questions: [{
          name: `${this.config.serviceType}.${this.config.domain}`,
          type: 'PTR'
        }]
      });
    });
  }
}
