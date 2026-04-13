import { initializeApp } from 'firebase/app';
// @ts-expect-error — getReactNativePersistence exists at runtime in firebase/auth but types are not exported
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const firebaseConfig = {
  apiKey: 'AIzaSyDjeczZNfb7XiR3Lu6_gpZRaexZ6Y6ApNY',
  authDomain: 'generichomecare.firebaseapp.com',
  projectId: 'generichomecare',
  storageBucket: 'generichomecare.firebasestorage.app',
  messagingSenderId: '641513010479',
  appId: '1:641513010479:web:073f978b40801bd7e91dda',
  measurementId: 'G-WG8MFKNJW7',
};

const app = initializeApp(firebaseConfig);

// Auth com persistência via AsyncStorage (mantém login entre sessões)
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// Firestore
export const db = getFirestore(app);

export default app;
