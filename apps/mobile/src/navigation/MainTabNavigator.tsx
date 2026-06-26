import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { House, Wallet, ShoppingCart, Package, Ellipsis } from '../components/icons/SimpleIcons';
import { Colors } from '../constants/theme-v2';

// Import des écrans
import HomeScreen from '../screens/HomeScreen';
import CashScreen from '../screens/CashScreen';
import SaleScreen from '../screens/SaleScreen';
import StockManagementScreen from '../screens/StockManagementScreen';
import MoreScreen from '../screens/MoreScreen';

const Tab = createBottomTabNavigator();

type IconType = typeof House;

const TAB_META: Record<string, { label: string; Icon: IconType }> = {
  Home: { label: 'Accueil', Icon: House },
  Cash: { label: 'Caisse', Icon: Wallet },
  Sale: { label: 'Vente', Icon: ShoppingCart },
  Stock: { label: 'Stock', Icon: Package },
  More: { label: 'Plus', Icon: Ellipsis },
};

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomPad = insets.bottom > 0 ? insets.bottom : 8;

  return (
    <View style={[styles.bar, { paddingBottom: bottomPad, height: 64 + bottomPad }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const meta = TAB_META[route.name] ?? { label: route.name, Icon: House };
        const Icon = meta.Icon;
        const color = focused ? Colors.action : Colors.textColors.tertiary;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        // Bouton central surélevé (Vente)
        if (route.name === 'Sale') {
          return (
            <Pressable key={route.key} style={styles.item} onPress={onPress}>
              <View style={styles.fab}>
                <Icon size={26} color="#FFFFFF" />
              </View>
              <Text style={[styles.label, { color }]}>{meta.label}</Text>
            </Pressable>
          );
        }

        return (
          <Pressable key={route.key} style={styles.item} onPress={onPress}>
            <Icon size={24} color={color} />
            <Text style={[styles.label, { color }]}>{meta.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      id={undefined}
      screenOptions={{ headerShown: false }}
      tabBar={props => <CustomTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Cash" component={CashScreen} />
      <Tab.Screen name="Sale" component={SaleScreen} />
      <Tab.Screen name="Stock" component={StockManagementScreen} />
      <Tab.Screen name="More" component={MoreScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
    alignItems: 'flex-start',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
  },
  fab: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.action,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
    shadowColor: Colors.action,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
});
