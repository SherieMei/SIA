import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-storage.js';

// Public web configuration. Access is controlled by Firebase security rules.
const firebaseConfig = {
  apiKey: 'AIzaSyBEOaMaMs0QieDsruAVpfZxzl6GEFykH6Y',
  authDomain: 'bee-production-e1058.firebaseapp.com',
  projectId: 'bee-production-e1058',
  storageBucket: 'bee-production-e1058.firebasestorage.app',
  messagingSenderId: '665768064835',
  appId: '1:665768064835:web:cb917399f7e5c8737aa1f6',
  measurementId: 'G-45JE4J2028'
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
