// Unit Tests for Geolocation Utilities
// Testing GPS distance calculations and validation functions

import {
  calculateDistance,
  isWithinRadius,
  calculateBearing,
  calculateDestination,
  isValidCoordinates,
  formatDistance,
  calculateBoundingBox,
  isWithinBoundingBox,
  estimateAccuracy,
  clampCoordinates,
} from '../geolocation';

describe('calculateDistance', () => {
  test('should calculate distance between two points correctly', () => {
    // Distance from Eiffel Tower to Louvre Museum (~4 km)
    const eiffelTower = { lat: 48.8584, lon: 2.2945 };
    const louvre = { lat: 48.8606, lon: 2.3376 };

    const distance = calculateDistance(
      eiffelTower.lat,
      eiffelTower.lon,
      louvre.lat,
      louvre.lon
    );

    // Should be approximately 4 km (4000 m)
    expect(distance).toBeGreaterThan(3000);
    expect(distance).toBeLessThan(5000);
  });

  test('should return 0 for same coordinates', () => {
    const lat = 48.8566;
    const lon = 2.3522;

    const distance = calculateDistance(lat, lon, lat, lon);

    expect(distance).toBe(0);
  });

  test('should handle antipodal points correctly', () => {
    // North Pole to South Pole
    const northPole = { lat: 90, lon: 0 };
    const southPole = { lat: -90, lon: 0 };

    const distance = calculateDistance(
      northPole.lat,
      northPole.lon,
      southPole.lat,
      southPole.lon
    );

    // Should be approximately half Earth's circumference (~20,000 km)
    expect(distance).toBeGreaterThan(19000000);
    expect(distance).toBeLessThan(21000000);
  });
});

describe('isWithinRadius', () => {
  test('should return true when point is within radius', () => {
    const campus = { lat: 48.8566, lon: 2.3522 };
    const student = { lat: 48.8567, lon: 2.3523 }; // Very close (~15 m)
    const radius = 200; // 200 meters

    const within = isWithinRadius(
      student.lat,
      student.lon,
      campus.lat,
      campus.lon,
      radius
    );

    expect(within).toBe(true);
  });

  test('should return false when point is outside radius', () => {
    const campus = { lat: 48.8566, lon: 2.3522 };
    const student = { lat: 48.8606, lon: 2.3376 }; // ~4 km away
    const radius = 200; // 200 meters

    const within = isWithinRadius(
      student.lat,
      student.lon,
      campus.lat,
      campus.lon,
      radius
    );

    expect(within).toBe(false);
  });

  test('should return true when point is exactly at boundary', () => {
    const campus = { lat: 48.8566, lon: 2.3522 };
    const student = { lat: 48.8566, lon: 2.3522 };
    const radius = 0;

    const within = isWithinRadius(
      student.lat,
      student.lon,
      campus.lat,
      campus.lon,
      radius
    );

    expect(within).toBe(true);
  });
});

describe('calculateBearing', () => {
  test('should calculate bearing correctly', () => {
    const point1 = { lat: 48.8566, lon: 2.3522 };
    const point2 = { lat: 48.8606, lon: 2.3376 };

    const bearing = calculateBearing(
      point1.lat,
      point1.lon,
      point2.lat,
      point2.lon
    );

    // Bearing should be between 0 and 360
    expect(bearing).toBeGreaterThanOrEqual(0);
    expect(bearing).toBeLessThan(360);
  });

  test('should calculate east bearing (90°) correctly', () => {
    const point1 = { lat: 0, lon: 0 };
    const point2 = { lat: 0, lon: 1 }; // Due east

    const bearing = calculateBearing(
      point1.lat,
      point1.lon,
      point2.lat,
      point2.lon
    );

    expect(bearing).toBeCloseTo(90, 1);
  });
});

describe('calculateDestination', () => {
  test('should calculate destination point correctly', () => {
    const start = { lat: 48.8566, lon: 2.3522 };
    const bearing = 45; // Northeast
    const distance = 1000; // 1 km

    const dest = calculateDestination(
      start.lat,
      start.lon,
      bearing,
      distance
    );

    // Destination should be within 1 km
    const actualDistance = calculateDistance(
      start.lat,
      start.lon,
      dest.lat,
      dest.lon
    );

    expect(actualDistance).toBeCloseTo(distance, 2);
  });
});

describe('isValidCoordinates', () => {
  test('should return true for valid coordinates', () => {
    expect(isValidCoordinates(48.8566, 2.3522)).toBe(true);
    expect(isValidCoordinates(0, 0)).toBe(true);
    expect(isValidCoordinates(-90, -180)).toBe(true);
    expect(isValidCoordinates(90, 180)).toBe(true);
  });

  test('should return false for invalid coordinates', () => {
    expect(isValidCoordinates(NaN, 2.3522)).toBe(false);
    expect(isValidCoordinates(48.8566, NaN)).toBe(false);
    expect(isValidCoordinates(91, 2.3522)).toBe(false); // Latitude > 90
    expect(isValidCoordinates(48.8566, 181)).toBe(false); // Longitude > 180
    expect(isValidCoordinates(-91, 2.3522)).toBe(false); // Latitude < -90
    expect(isValidCoordinates(48.8566, -181)).toBe(false); // Longitude < -180
  });
});

describe('formatDistance', () => {
  test('should format meters correctly', () => {
    expect(formatDistance(150)).toBe('150m');
    expect(formatDistance(999)).toBe('999m');
  });

  test('should format kilometers correctly', () => {
    expect(formatDistance(1000)).toBe('1.0km');
    expect(formatDistance(1500)).toBe('1.5km');
    expect(formatDistance(5000)).toBe('5.0km');
  });

  test('should round distances correctly', () => {
    expect(formatDistance(1234)).toBe('1.2km');
    expect(formatDistance(1567)).toBe('1.6km');
  });
});

describe('calculateBoundingBox', () => {
  test('should calculate bounding box around a point', () => {
    const center = { lat: 48.8566, lon: 2.3522 };
    const radius = 1000; // 1 km

    const bounds = calculateBoundingBox(
      center.lat,
      center.lon,
      radius
    );

    expect(bounds.minLat).toBeLessThan(center.lat);
    expect(bounds.maxLat).toBeGreaterThan(center.lat);
    expect(bounds.minLon).toBeLessThan(center.lon);
    expect(bounds.maxLon).toBeGreaterThan(center.lon);
  });

  test('should create symmetric bounding box', () => {
    const center = { lat: 48.8566, lon: 2.3522 };
    const radius = 1000;

    const bounds = calculateBoundingBox(
      center.lat,
      center.lon,
      radius
    );

    const latRange = bounds.maxLat - bounds.minLat;
    const lonRange = bounds.maxLon - bounds.minLon;

    expect(latRange).toBeGreaterThan(0);
    expect(lonRange).toBeGreaterThan(0);
  });
});

describe('isWithinBoundingBox', () => {
  test('should return true when point is within bounds', () => {
    const bounds = {
      minLat: 48.0,
      maxLat: 49.0,
      minLon: 2.0,
      maxLon: 3.0,
    };

    const point = { lat: 48.5, lon: 2.5 };

    expect(isWithinBoundingBox(point.lat, point.lon, bounds)).toBe(true);
  });

  test('should return false when point is outside bounds', () => {
    const bounds = {
      minLat: 48.0,
      maxLat: 49.0,
      minLon: 2.0,
      maxLon: 3.0,
    };

    const pointOutside = { lat: 50.0, lon: 2.5 };
    expect(isWithinBoundingBox(pointOutside.lat, pointOutside.lon, bounds)).toBe(false);

    const pointOutside2 = { lat: 48.5, lon: 4.0 };
    expect(isWithinBoundingBox(pointOutside2.lat, pointOutside2.lon, bounds)).toBe(false);
  });

  test('should return true for boundary points', () => {
    const bounds = {
      minLat: 48.0,
      maxLat: 49.0,
      minLon: 2.0,
      maxLon: 3.0,
    };

    expect(isWithinBoundingBox(48.0, 2.5, bounds)).toBe(true);
    expect(isWithinBoundingBox(49.0, 2.5, bounds)).toBe(true);
    expect(isWithinBoundingBox(48.5, 2.0, bounds)).toBe(true);
    expect(isWithinBoundingBox(48.5, 3.0, bounds)).toBe(true);
  });
});

describe('estimateAccuracy', () => {
  test('should estimate accuracy based on decimal places', () => {
    expect(estimateAccuracy(0)).toBe(111000);
    expect(estimateAccuracy(1)).toBe(11100);
    expect(estimateAccuracy(2)).toBe(1110);
    expect(estimateAccuracy(3)).toBe(111);
    expect(estimateAccuracy(4)).toBeCloseTo(11.1, 1);
    expect(estimateAccuracy(5)).toBeCloseTo(1.11, 2);
    expect(estimateAccuracy(6)).toBeCloseTo(0.111, 3);
  });

  test('should return high accuracy for many decimal places', () => {
    expect(estimateAccuracy(7)).toBeCloseTo(0.0111, 4);
    expect(estimateAccuracy(10)).toBeCloseTo(0.0111, 4); // Should cap at 7 decimals
  });
});

describe('clampCoordinates', () => {
  test('should clamp invalid latitude', () => {
    const result = clampCoordinates(100, 2.3522);
    expect(result.lat).toBe(90);
    expect(result.lon).toBe(2.3522);
  });

  test('should clamp invalid longitude', () => {
    const result = clampCoordinates(48.8566, 200);
    expect(result.lat).toBe(48.8566);
    expect(result.lon).toBe(180);
  });

  test('should clamp both latitude and longitude', () => {
    const result = clampCoordinates(-100, -200);
    expect(result.lat).toBe(-90);
    expect(result.lon).toBe(-180);
  });

  test('should not modify valid coordinates', () => {
    const result = clampCoordinates(48.8566, 2.3522);
    expect(result.lat).toBe(48.8566);
    expect(result.lon).toBe(2.3522);
  });
});
