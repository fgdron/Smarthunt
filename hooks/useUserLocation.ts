import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { Coords, PARIS_CENTER } from '@/engine/netPrice';

export type LocationStatus = 'loading' | 'granted' | 'denied' | 'fallback';

export interface UserLocationResult {
  coords: Coords;
  status: LocationStatus;
}

export function useUserLocation(): UserLocationResult {
  const [coords, setCoords] = useState<Coords>(PARIS_CENTER);
  const [status, setStatus] = useState<LocationStatus>('loading');

  useEffect(() => {
    // Web: use native browser geolocation API
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          pos => {
            setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            setStatus('granted');
          },
          () => setStatus('fallback'),
          { timeout: 8000 },
        );
      } else {
        setStatus('fallback');
      }
      return;
    }

    // Native: dynamic require so a version mismatch (e.g. expo-location v18 on SDK 52)
    // is caught at runtime instead of crashing the module at import time.
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Location = require('expo-location') as typeof import('expo-location');
        const { status: perm } = await Location.requestForegroundPermissionsAsync();
        if (perm !== 'granted') {
          setStatus('denied');
          return;
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        setStatus('granted');
      } catch {
        // expo-location unavailable or permission error — fall back to Paris center
        setStatus('fallback');
      }
    })();
  }, []);

  return { coords, status };
}
