import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-storage.js';

// Public web configuration. Access is controlled by Firebase security rules.
const firebaseConfig = {
  apiKey: 'AIzaSyDUVCG5IX9nyWRKtbcHWDp5b0c9oJZqHWs',
  authDomain: 'siaa-20635.firebaseapp.com',
  projectId: 'siaa-20635',
  storageBucket: 'siaa-20635.firebasestorage.app',
  messagingSenderId: '500595547305',
  appId: '1:500595547305:web:194941d02712d321f3ddb8',
  measurementId: 'G-4RHRHCCWYS'
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
