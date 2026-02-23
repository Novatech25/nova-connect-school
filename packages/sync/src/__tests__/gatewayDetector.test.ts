import { GatewayDetector } from '../gateway/GatewayDetector';

describe('GatewayDetector', () => {
  let detector: GatewayDetector;

  beforeEach(() => {
    detector = new GatewayDetector({
      schoolId: 'school-1',
    });
  });

  describe('mDNS discovery', () => {
    it('should discover Gateway on local network', async () => {
      const mockGateway = {
        id: 'gateway-1',
        name: 'NovaConnect Gateway',
        ipAddress: '192.168.1.100',
        port: 8080,
        schoolId: 'school-1',
      };

      jest.spyOn(detector as any, 'scanNetwork').mockResolvedValue([mockGateway]);

      const gateways = await detector.discover();

      expect(gateways).toHaveLength(1);
      expect(gateways[0].ipAddress).toBe('192.168.1.100');
    });

    it('should return empty array when no Gateway found', async () => {
      jest.spyOn(detector as any, 'scanNetwork').mockResolvedValue([]);

      const gateways = await detector.discover();

      expect(gateways).toHaveLength(0);
    });

    it('should filter gateways by school ID', async () => {
      const mockGateways = [
        { id: 'gateway-1', schoolId: 'school-1', ipAddress: '192.168.1.100' },
        { id: 'gateway-2', schoolId: 'school-2', ipAddress: '192.168.1.101' },
      ];

      jest.spyOn(detector as any, 'scanNetwork').mockResolvedValue(mockGateways);

      const gateways = await detector.discover();

      expect(gateways).toHaveLength(1);
      expect(gateways[0].schoolId).toBe('school-1');
    });
  });

  describe('latency check', () => {
    it('should measure Gateway latency', async () => {
      const mockLatency = 50; // 50ms

      jest.spyOn(detector as any, 'pingGateway').mockResolvedValue(mockLatency);

      const latency = await detector.checkLatency({ ipAddress: '192.168.1.100' });

      expect(latency).toBe(50);
    });

    it('should prefer Gateway with lowest latency', async () => {
      const mockGateways = [
        { id: 'gateway-1', ipAddress: '192.168.1.100', latency: 100 },
        { id: 'gateway-2', ipAddress: '192.168.1.101', latency: 50 },
        { id: 'gateway-3', ipAddress: '192.168.1.102', latency: 75 },
      ];

      jest.spyOn(detector, 'checkLatency')
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(75);

      const best = await detector.selectBestGateway(mockGateways as any);

      expect(best.id).toBe('gateway-2');
    });
  });

  describe('failover to cloud', () => {
    it('should failover to cloud when Gateway unavailable', async () => {
      jest.spyOn(detector, 'discover').mockResolvedValue([]);
      jest.spyOn(detector as any, 'isCloudAvailable').mockResolvedValue(true);

      const connection = await detector.establishConnection();

      expect(connection.mode).toBe('cloud');
    });

    it('should failover to cloud when Gateway latency too high', async () => {
      const mockGateways = [
        { id: 'gateway-1', ipAddress: '192.168.1.100' },
      ];

      jest.spyOn(detector, 'discover').mockResolvedValue(mockGateways as any);
      jest.spyOn(detector, 'checkLatency').mockResolvedValue(5000); // 5 seconds
      jest.spyOn(detector as any, 'isCloudAvailable').mockResolvedValue(true);

      const connection = await detector.establishConnection({ maxLatency: 1000 });

      expect(connection.mode).toBe('cloud');
    });

    it('should retry Gateway connection before failing over', async () => {
      let attempts = 0;

      jest.spyOn(detector, 'discover').mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          return [];
        }
        return [{ id: 'gateway-1', ipAddress: '192.168.1.100' }];
      });

      jest.spyOn(detector, 'checkLatency').mockResolvedValue(50);

      const connection = await detector.establishConnection({ retryAttempts: 3 });

      expect(attempts).toBe(3);
      expect(connection.mode).toBe('lan');
    });
  });

  describe('health check', () => {
    it('should monitor Gateway health', async () => {
      jest.spyOn(detector as any, 'pingGateway').mockResolvedValue(50);

      const isHealthy = await detector.healthCheck({ ipAddress: '192.168.1.100' });

      expect(isHealthy).toBe(true);
    });

    it('should detect Gateway failure', async () => {
      jest.spyOn(detector as any, 'pingGateway').mockRejectedValue(new Error('Timeout'));

      const isHealthy = await detector.healthCheck({ ipAddress: '192.168.1.100' });

      expect(isHealthy).toBe(false);
    });
  });

  describe('auto-switch', () => {
    it('should switch to Gateway when detected', async () => {
      const listener = jest.fn();

      detector.on('gatewayDetected', listener);

      jest.spyOn(detector, 'discover').mockResolvedValue([{ id: 'gateway-1', ipAddress: '192.168.1.100' }]);
      jest.spyOn(detector, 'checkLatency').mockResolvedValue(50);

      await detector.startMonitoring();

      // Wait for first discovery cycle
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(listener).toHaveBeenCalled();
    });

    it('should switch to cloud when Gateway lost', async () => {
      const listener = jest.fn();

      detector.on('gatewayLost', listener);

      jest.spyOn(detector, 'discover').mockResolvedValue([]);
      jest.spyOn(detector as any, 'isCloudAvailable').mockResolvedValue(true);

      await detector.startMonitoring();

      // Wait for discovery cycle
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(listener).toHaveBeenCalled();
    });
  });
});
