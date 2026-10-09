const EARTH_RADIUS_KM = 6371;

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Shortest distance from a point to the segment between A and B.
 *
 * Projects onto a flat plane centred on the point (equirectangular), which
 * is accurate to well under 1% at the distances where being near a segment
 * matters; it degrades only for segments far away, which are never nearest.
 */
export function distanceToSegmentKm(
  lat: number,
  lng: number,
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const kmPerDegLat = (EARTH_RADIUS_KM * Math.PI) / 180;
  const kmPerDegLng = kmPerDegLat * Math.cos(toRad(lat));

  // A and B relative to the point, in km; the point is the origin.
  const ax = (aLng - lng) * kmPerDegLng;
  const ay = (aLat - lat) * kmPerDegLat;
  const dx = (bLng - lng) * kmPerDegLng - ax;
  const dy = (bLat - lat) * kmPerDegLat - ay;

  const lengthSq = dx * dx + dy * dy;
  // Fraction along A→B of the closest point, clamped to the segment.
  const t =
    lengthSq === 0
      ? 0
      : Math.min(1, Math.max(0, -(ax * dx + ay * dy) / lengthSq));

  return Math.hypot(ax + t * dx, ay + t * dy);
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
