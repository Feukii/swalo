import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import ErrorBoundary from './src/components/ErrorBoundary';
import { OfflineBanner } from './src/components/OfflineBanner';
import { initDatabase } from './src/db/schema';
import { syncEngine } from './src/db/sync';
import TestScreen from './src/screens/TestScreen';
import LoginPinScreen from './src/screens/LoginPinScreen';
import POSScreen from './src/screens/POSScreen';
import SuppliersScreen from './src/screens/SuppliersScreen';
import SupplierDetailsScreen from './src/screens/SupplierDetailsScreen';
import CustomersScreen from './src/screens/CustomersScreen';
import CustomerDetailsScreen from './src/screens/CustomerDetailsScreen';
import ProductDetailsScreen from './src/screens/ProductDetailsScreen';
import UserManagementScreen from './src/screens/UserManagementScreen';
import ShopAdminScreen from './src/screens/ShopAdminScreen';
import BusinessReportsScreen from './src/screens/BusinessReportsScreen';
import TransactionHistoryScreen from './src/screens/TransactionHistoryScreen';
import DesignSystemTestScreen from './src/screens/DesignSystemTestScreen';
import ShopSettingsScreen from './src/screens/ShopSettingsScreen';
import ProductCatalogScreen from './src/screens/ProductCatalogScreen';
import CatalogHierarchyScreen from './src/screens/CatalogHierarchyScreen';
import StockManagementScreen from './src/screens/StockManagementScreen';
import CustomerBalancesSummaryScreen from './src/screens/CustomerBalancesSummaryScreen';
import SupplierBalancesSummaryScreen from './src/screens/SupplierBalancesSummaryScreen';
import PackagingTypesScreen from './src/screens/settings/PackagingTypesScreen';
import InvoiceListScreen from './src/screens/invoices/InvoiceListScreen';
import ProductBatchesScreen from './src/screens/products/ProductBatchesScreen';
import SyncStatusScreen from './src/screens/SyncStatusScreen';
import SyncConflictsScreen from './src/screens/SyncConflictsScreen';
import TransfersScreen from './src/screens/TransfersScreen';
import ShopSwitcherScreen from './src/screens/ShopSwitcherScreen';
import MainTabNavigator from './src/navigation/MainTabNavigator';

console.log('📱 APP STARTING - Version 1.0.0');
console.log('🔧 Expo Config:', Constants.expoConfig?.extra);

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync()
  .then(() => console.log('✅ Splash screen prevented from auto-hiding'))
  .catch(e => console.error('❌ Error preventing splash screen:', e));

export type RootStackParamList = {
  Test: undefined;
  LoginPin: undefined;
  Main: undefined;
  POS: undefined;
  Suppliers: undefined;
  SupplierDetails: { id: string };
  SupplierBalancesSummary: undefined;
  Customers: undefined;
  CustomerDetails: { id: string };
  CustomerBalancesSummary: undefined;
  ProductDetails: { id: string };
  ProductBatches: { productId: string; productName: string };
  ProductCatalog: undefined;
  CatalogHierarchy: undefined;
  StockManagement: undefined;
  UserManagement: undefined;
  ShopAdmin: undefined;
  ShopSettings: undefined;
  BusinessReports: undefined;
  TransactionHistory: undefined;
  PackagingTypes: undefined;
  InvoiceList: undefined;
  DesignTest: undefined;
  SyncStatus: undefined;
  SyncConflicts: undefined;
  Transfers: undefined;
  ShopSwitcher: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    console.log('🚀 useEffect triggered - Starting app initialization');

    // Hide the splash screen once the app is ready
    const prepare = async () => {
      try {
        console.log('📋 Step 0: Initializing local database');
        await initDatabase();
        console.log('✅ Local database initialized');

        console.log('📋 Step 1: Getting API URL from config');
        // Récupérer l'URL de l'API depuis la configuration Expo (fonctionne dans APK)
        const API_URL = Constants.expoConfig?.extra?.apiUrl;
        console.log('🌐 API URL:', API_URL);

        // Uniquement si on est en production (API distante)
        if (API_URL && !API_URL.includes('localhost')) {
          console.log('🔥 Step 2: Waking up production API');
          fetch(`${API_URL.replace('/api', '')}/health`, {
            method: 'GET',
          })
            .then(() => console.log('✅ API ready'))
            .catch(err => console.log('⏳ API starting up:', err.message));
        } else {
          console.log('🏠 Using localhost API or no API configured');
        }

        console.log('📋 Step 3: Checking for existing auth token');
        const token = await AsyncStorage.getItem('access_token');
        console.log('🔑 Token exists:', !!token);

        // Start sync engine if authenticated
        if (token) {
          syncEngine.start().catch(e => console.log('⚠️ Sync engine start error:', e.message));
        }

        // Navigation vers l'app principale avec tabs ou login
        const route = token ? 'Main' : 'LoginPin';
        console.log('📍 Initial route determined:', route);
        setInitialRoute(route);
        setAppReady(true);

        console.log('✅ Step 4: App preparation completed successfully');
      } catch (e: unknown) {
        const err = e instanceof Error ? e : undefined;
        console.error('❌ ERROR during app preparation:', {
          message: err?.message,
          stack: err?.stack,
          name: err?.name,
        });
        console.log('🔄 Falling back to LoginPin screen');
        setInitialRoute('LoginPin');
        setAppReady(true);
      } finally {
        try {
          console.log('🎬 Step 5: Hiding splash screen');
          await SplashScreen.hideAsync();
          console.log('✅ Splash screen hidden successfully');
        } catch (splashError: unknown) {
          const err = splashError instanceof Error ? splashError : undefined;
          console.error('❌ Error hiding splash screen:', err?.message);
        }
      }
    };

    prepare();
  }, []);

  console.log('🔍 Render check - appReady:', appReady, 'initialRoute:', initialRoute);

  if (!appReady || !initialRoute) {
    console.log('⏳ App not ready yet, showing nothing');
    return null;
  }

  console.log('✅ App ready, rendering navigation');

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <OfflineBanner />
        <NavigationContainer
          onReady={() => console.log('✅ Navigation ready')}
          onStateChange={state =>
            console.log('📍 Navigation state changed:', state?.routes?.[state?.index]?.name)
          }
        >
          <Stack.Navigator
            id={undefined}
            initialRouteName={initialRoute}
            screenOptions={{
              headerShown: false,
            }}
          >
            {/* Auth screens */}
            <Stack.Screen name="LoginPin" component={LoginPinScreen} />

            {/* Main app avec bottom tabs (nouvelle navigation v2) */}
            <Stack.Screen name="Main" component={MainTabNavigator} />

            {/* Écrans de détail (en dehors des tabs) */}
            <Stack.Screen name="Suppliers" component={SuppliersScreen} />
            <Stack.Screen name="SupplierDetails" component={SupplierDetailsScreen} />
            <Stack.Screen
              name="SupplierBalancesSummary"
              component={SupplierBalancesSummaryScreen}
            />
            <Stack.Screen name="Customers" component={CustomersScreen} />
            <Stack.Screen name="CustomerDetails" component={CustomerDetailsScreen} />
            <Stack.Screen
              name="CustomerBalancesSummary"
              component={CustomerBalancesSummaryScreen}
            />
            <Stack.Screen name="ProductDetails" component={ProductDetailsScreen} />
            <Stack.Screen
              name="ProductBatches"
              component={ProductBatchesScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen name="ProductCatalog" component={ProductCatalogScreen} />
            <Stack.Screen name="CatalogHierarchy" component={CatalogHierarchyScreen} />
            <Stack.Screen name="StockManagement" component={StockManagementScreen} />
            <Stack.Screen name="UserManagement" component={UserManagementScreen} />
            <Stack.Screen name="ShopAdmin" component={ShopAdminScreen} />
            <Stack.Screen name="ShopSettings" component={ShopSettingsScreen} />
            <Stack.Screen name="BusinessReports" component={BusinessReportsScreen} />
            <Stack.Screen name="TransactionHistory" component={TransactionHistoryScreen} />
            <Stack.Screen name="PackagingTypes" component={PackagingTypesScreen} />
            <Stack.Screen name="InvoiceList" component={InvoiceListScreen} />

            {/* Sync screens */}
            <Stack.Screen name="SyncStatus" component={SyncStatusScreen} />
            <Stack.Screen name="SyncConflicts" component={SyncConflictsScreen} />

            {/* Enterprise & Multi-shop screens */}
            <Stack.Screen name="Transfers" component={TransfersScreen} />
            <Stack.Screen name="ShopSwitcher" component={ShopSwitcherScreen} />

            {/* Anciens écrans (pour compatibilité temporaire) */}
            <Stack.Screen name="POS" component={POSScreen} />
            <Stack.Screen name="Test" component={TestScreen} />
            <Stack.Screen name="DesignTest" component={DesignSystemTestScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
