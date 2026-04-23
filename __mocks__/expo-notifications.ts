// Mock expo-notifications — évite les modules natifs en environnement Jest

let _notifCounter = 0;

export const SchedulableTriggerInputTypes = {
  DATE:  'date',
  DAILY: 'daily',
} as const;

export const setNotificationHandler = jest.fn();

export const getPermissionsAsync = jest.fn().mockResolvedValue({ status: 'undetermined' });
export const requestPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });

export const scheduleNotificationAsync = jest.fn().mockImplementation(async () => {
  _notifCounter += 1;
  return `mock-notif-id-${_notifCounter}`;
});

export const cancelScheduledNotificationAsync = jest.fn().mockResolvedValue(undefined);

export const addNotificationResponseReceivedListener = jest.fn().mockReturnValue({
  remove: jest.fn(),
});

export const getLastNotificationResponseAsync = jest.fn().mockResolvedValue(null);

/** Réinitialise les compteurs entre les tests */
export const __resetCounter = () => { _notifCounter = 0; };
