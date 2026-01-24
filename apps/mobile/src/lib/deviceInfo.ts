import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';

const DEVICE_ID_KEY = 'device_id';

/**
 * Get or generate a unique device ID for this mobile device
 * Stored securely in the device's secure storage
 */
export async function getDeviceId(): Promise<string> {
  try {
    // Try to retrieve existing device ID
    let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);

    if (!deviceId) {
      // Generate a new UUID
      deviceId = generateUUID();
      // Store it securely
      await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
    }

    return deviceId;
  } catch (error) {
    console.error('Error getting device ID:', error);
    // Fallback to a generated UUID (won't persist across reinstalls)
    return generateUUID();
  }
}

/**
 * Get device information for API calls
 */
export async function getDeviceInfo(): Promise<{
  device_id: string;
  device_name: string;
  device_type: string;
}> {
  const deviceId = await getDeviceId();

  const deviceName = [
    Device.modelName || Device.deviceName || 'Unknown Device',
    Device.osName || '',
    Device.osVersion || '',
  ]
    .filter(Boolean)
    .join(' ');

  const deviceType = Device.deviceType === Device.DeviceType.TABLET ? 'tablet' : 'mobile';

  return {
    device_id: deviceId,
    device_name: deviceName,
    device_type: deviceType,
  };
}

/**
 * Simple UUID v4 generator
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
