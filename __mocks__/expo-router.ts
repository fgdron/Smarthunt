// Mock expo-router — évite les imports de navigation en environnement Jest

export const useRouter = jest.fn().mockReturnValue({
  push:    jest.fn(),
  replace: jest.fn(),
  back:    jest.fn(),
  navigate: jest.fn(),
});

export const useLocalSearchParams = jest.fn().mockReturnValue({});
export const useSegments           = jest.fn().mockReturnValue([]);
export const usePathname           = jest.fn().mockReturnValue('/');
export const Link                  = 'Link';
export const router = {
  push:    jest.fn(),
  replace: jest.fn(),
  back:    jest.fn(),
};
