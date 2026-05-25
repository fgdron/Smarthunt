import { Tabs } from 'expo-router';
import { ShoppingCart, Wallet, Store } from 'lucide-react-native';
import { Colors } from '@/constants/theme';
import { useSmartHuntStore } from '@/store/useSmartHuntStore';

export default function TabLayout() {
  const urgentODR = useSmartHuntStore(s =>
    s.huntList.filter(i => {
      if (!i.optimization.odr?.expiresAt || i.cashbackClaimed) return false;
      const daysLeft = (new Date(i.optimization.odr.expiresAt).getTime() - Date.now()) / (24 * 3600 * 1000);
      return daysLeft < 2;
    }).length
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor:  Colors.cardBorder,
          borderTopWidth:  1,
          height:          84,
          paddingBottom:   24,
          paddingTop:      10,
        },
        tabBarActiveTintColor:   Colors.neonGreen,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: {
          fontSize:      10,
          fontWeight:    '600',
          letterSpacing: 0.3,
        },
      }}
    >
      {/* Panier — écran principal */}
      <Tabs.Screen
        name="basket"
        options={{
          title: 'Panier',
          tabBarIcon: ({ color, size }) => (
            <ShoppingCart size={size} color={color} strokeWidth={2} />
          ),
        }}
      />

      {/* Magasins proches */}
      <Tabs.Screen
        name="catalogue"
        options={{
          title: 'Magasins',
          tabBarIcon: ({ color, size }) => (
            <Store size={size} color={color} strokeWidth={2} />
          ),
        }}
      />

      {/* Cagnotte ODR */}
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Cagnotte',
          tabBarBadge:      urgentODR > 0 ? urgentODR : undefined,
          tabBarBadgeStyle: urgentODR > 0 ? { backgroundColor: Colors.danger ?? '#FF3B30' } : undefined,
          tabBarIcon: ({ color, size }) => (
            <Wallet size={size} color={color} strokeWidth={2} />
          ),
        }}
      />

      {/* Écrans masqués — encore accessibles comme routes */}
      <Tabs.Screen name="index"  options={{ href: null }} />
      <Tabs.Screen name="hunt"   options={{ href: null }} />
      <Tabs.Screen name="scan"   options={{ href: null }} />
    </Tabs>
  );
}
