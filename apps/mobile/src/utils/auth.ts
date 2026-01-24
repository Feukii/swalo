import AsyncStorage from '@react-native-async-storage/async-storage';

export async function getUserRole(): Promise<string> {
  try {
    const userStr = await AsyncStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      return user.role || 'EMPLOYEE';
    }
    return 'EMPLOYEE';
  } catch (error) {
    console.error('Erreur lors de la récupération du rôle:', error);
    return 'EMPLOYEE';
  }
}

export function canAccessAdmin(role: string): boolean {
  return ['ADMIN', 'MANAGER', 'OWNER', 'SUPERADMIN'].includes(role);
}

export function canAccessReports(role: string): boolean {
  return ['ADMIN', 'MANAGER', 'OWNER', 'SUPERADMIN'].includes(role);
}
