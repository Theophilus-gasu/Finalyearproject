import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyB6UqaKHXLnarvtNt3AZw-Te9sTPbB0zfw",
  authDomain: "smart-iot-workstation.firebaseapp.com",
  databaseURL: "https://smart-iot-workstation-default-rtdb.firebaseio.com",
  projectId: "smart-iot-workstation",
  storageBucket: "smart-iot-workstation.firebasestorage.app",
  messagingSenderId: "66571009517",
  appId: "1:66571009517:web:0f69eb34c73168c15fbbe4"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
export const db = database;
