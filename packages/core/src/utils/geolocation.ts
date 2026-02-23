// Geolocation Utilities
// GPS distance calculations and validation for QR attendance system

/**
 * Calculate distance between two GPS coordinates using the Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Check if a user is within a specified radius of a location
 * @param userLat User's latitude
 * @param userLon User's longitude
 * @param targetLat Target latitude (e.g., campus)
 * @param targetLon Target longitude (e.g., campus)
 * @param radiusMeters Maximum allowed distance in meters
 * @returns true if user is within the radius
 */
export function isWithinRadius(
  userLat: number,
  userLon: number,
  targetLat: number,
  targetLon: number,
  radiusMeters: number
): boolean {
  const distance = calculateDistance(
    userLat,
    userLon,
    targetLat,
    targetLon
  );
  return distance <= radiusMeters;
}

/**
 * Calculate the bearing between two points
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Bearing in degrees (0-360)
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);

  const bearing = ((θ * 180) / Math.PI + 360) % 360;
  return bearing;
}

/**
 * Calculate a destination point given a start point, bearing and distance
 * @param lat Start latitude
 * @param lon Start longitude
 * @param bearing Bearing in degrees
 * @param distance Distance in meters
 * @returns Destination coordinates {lat, lon}
 */
export function calculateDestination(
  lat: number,
  lon: number,
  bearing: number,
  distance: number
): { lat: number; lon: number } {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lon * Math.PI) / 180;
  const θ = (bearing * Math.PI) / 180;
  const d = distance / R;

  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(d) + Math.cos(φ1) * Math.sin(d) * Math.cos(θ)
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(d) * Math.cos(φ1),
      Math.cos(d) - Math.sin(φ1) * Math.sin(φ2)
    );

  return {
    lat: (φ2 * 180) / Math.PI,
    lon: ((λ2 * 180) / Math.PI + 540) % 360 - 180,
  };
}

/**
 * Validate GPS coordinates
 * @param lat Latitude
 * @param lon Longitude
 * @returns true if coordinates are valid
 */
export function isValidCoordinates(lat: number, lon: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    !isNaN(lat) &&
    !isNaN(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/**
 * Format distance for display
 * @param distanceInMeters Distance in meters
 * @returns Formatted string (e.g., "150m" or "1.2km")
 */
export function formatDistance(distanceInMeters: number): string {
  if (distanceInMeters < 1000) {
    return `${Math.round(distanceInMeters)}m`;
  } else {
    return `${(distanceInMeters / 1000).toFixed(1)}km`;
  }
}

/**
 * Calculate the bounding box around a center point
 * @param lat Center latitude
 * @param lon Center longitude
 * @param radiusMeters Radius in meters
 * @returns Bounding box {minLat, maxLat, minLon, maxLon}
 */
export function calculateBoundingBox(
  lat: number,
  lon: number,
  radiusMeters: number
): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
  // 1 degree of latitude ≈ 111,111 meters
  const latDelta = (radiusMeters / 111111) * (180 / Math.PI);

  // 1 degree of longitude ≈ 111,111 * cos(latitude) meters
  const lonDelta =
    (radiusMeters / (111111 * Math.cos((lat * Math.PI) / 180))) *
    (180 / Math.PI);

  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLon: lon - lonDelta,
    maxLon: lon + lonDelta,
  };
}

/**
 * Check if a point is within a bounding box
 * @param lat Point latitude
 * @param lon Point longitude
 * @param bounds Bounding box
 * @returns true if point is within bounds
 */
export function isWithinBoundingBox(
  lat: number,
  lon: number,
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number }
): boolean {
  return (
    lat >= bounds.minLat &&
    lat <= bounds.maxLat &&
    lon >= bounds.minLon &&
    lon <= bounds.maxLon
  );
}

/**
 * Estimate GPS accuracy based on the number of decimal places
 * @param decimalPlaces Number of decimal places in coordinates
 * @returns Estimated accuracy in meters
 */
export function estimateAccuracy(decimalPlaces: number): number {
  const accuracies: Record<number, number> = {
    0: 111000, // 111 km
    1: 11100, // 11.1 km
    2: 1110, // 1.11 km
    3: 111, // 111 m
    4: 11.1, // 11.1 m
    5: 1.11, // 1.11 m
    6: 0.111, // 11 cm
    7: 0.0111, // 1.1 cm
  };

  return accuracies[Math.min(decimalPlaces, 7)] || 0.0111;
}

/**
 * Clamp coordinates to valid ranges
 * @param lat Latitude
 * @param lon Longitude
 * @returns Clamped coordinates {lat, lon}
 */
export function clampCoordinates(
  lat: number,
  lon: number
): { lat: number; lon: number } {
  return {
    lat: Math.max(-90, Math.min(90, lat)),
    lon: Math.max(-180, Math.min(180, lon)),
  };
}
