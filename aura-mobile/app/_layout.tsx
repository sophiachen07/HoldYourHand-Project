import { Stack } from 'expo-router';

import AlertProvider from '../contexts/AlertContext';
import SensorProvider from '../contexts/SensorContext';
import UserProvider from '../contexts/UserContext';

export default function RootLayout() {
  return (
    <UserProvider>
      <SensorProvider>
        <AlertProvider>
          <Stack
            screenOptions={{
              headerShown: false,
            }}
          />
        </AlertProvider>
      </SensorProvider>
    </UserProvider>
  );
}