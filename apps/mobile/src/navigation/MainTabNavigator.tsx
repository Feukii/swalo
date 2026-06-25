import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
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

export default function MainTabNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      id={undefined}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.action,
        tabBarInactiveTintColor: Colors.textColors.tertiary,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          backgroundColor: Colors.surface,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 8,
        },
        tabBarItemStyle: {
          paddingVertical: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 3,
          marginBottom: 2,
        },
        tabBarIconStyle: {
          marginTop: 0,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Accueil',
          tabBarIcon: ({ color, size }) => <House size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Cash"
        component={CashScreen}
        options={{
          tabBarLabel: 'Caisse',
          tabBarIcon: ({ color, size }) => <Wallet size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Sale"
        component={SaleScreen}
        options={{
          tabBarLabel: 'Vente',
          tabBarIcon: ({ color, size }) => <ShoppingCart size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Stock"
        component={StockManagementScreen}
        options={{
          tabBarLabel: 'Stock',
          tabBarIcon: ({ color, size }) => <Package size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{
          tabBarLabel: 'Plus',
          tabBarIcon: ({ color, size }) => <Ellipsis size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}
