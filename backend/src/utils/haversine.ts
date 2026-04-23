/**
 * Calcule la distance en km entre deux coordonnées GPS
 * via la formule de Haversine (précision < 0.5 % sur courtes distances).
 */
export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371; // rayon Terre en km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const chord  = sinLat * sinLat +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    sinLng * sinLng;
  return R * 2 * Math.asin(Math.sqrt(chord));
}
