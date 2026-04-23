import { Tabs } from 'expo-router';
import { Home, LayoutGrid, ScanLine, Wallet } from 'lucide-react-native';
import { Colors } from '@/constants/theme';
import { useSmartHuntStore } from '@/store/useSmartHuntStore';

const DAY_MS = 24 * 60 * 60 * 1000;

export default function TabLayout() {
  const huntList  = useSmartHuntStore(s => s.huntList);
  const lastScanAt = useSmartHuntStore(s => s.lastScanAt);
  const userBasket = useSmartHuntStore(s => s.userBasket);

  // Badge rouge sur Cagnotte : ODR expirant dans < 48h
  const urgentODR = huntList.filter(i => {
    if (!i.optimization.odr?.expiresAt || i.cashbackClaimed) return false;
    const daysLeft = (new Date(i.optimization.odr.expiresAt).getTime() - Date.now()) / DAY_MS;
    return daysLeft < 2;
  }).length;

  // Badge orange sur Scanner : panier non-vide ET aucun scan depuis 7 jours
  const needsScan = userBasket.length > 0 &&
    (lastScanAt === null || Date.now() - lastScanAt > 7 * DAY_MS);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.cardBorder,
          borderTopWidth: 1,
          height: 84,
          paddingBottom: 24,
          paddingTop: 10,
        },
        tabBarActiveTintColor: Colors.neonGreen,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.3,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color, size }) => (
            <Home size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="catalogue"
        options={{
          title: 'Courses',
          tabBarIcon: ({ color, size }) => (
            <LayoutGrid size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scanner',
          tabBarBadge: needsScan ? '!' : undefined,
          tabBarBadgeStyle: needsScan ? { backgroundColor: Colors.gold } : undefined,
          tabBarIcon: ({ color, size }) => (
            <ScanLine size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Cagnotte',
          tabBarBadge: urgentODR > 0 ? urgentODR : undefined,
          tabBarIcon: ({ color, size }) => (
            <Wallet size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
      {/* hunt masqué de la barre — reste accessible comme route */}
      <Tabs.Screen
        name="hunt"
        options={{ href: null }}
      />
    </Tabs>
  );
}
