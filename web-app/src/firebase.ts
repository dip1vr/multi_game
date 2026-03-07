import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyAwJhixn8SfKRNKaJaoWyTASuOANjpWYHM",
    authDomain: "customer-77ee4.firebaseapp.com",
    projectId: "customer-77ee4",
    storageBucket: "customer-77ee4.firebasestorage.app",
    messagingSenderId: "1002736823428",
    appId: "1:1002736823428:web:c983e0cb5a70e4bdf6a6d1",
    measurementId: "G-T244788Q8B"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { app, analytics, db, auth, googleProvider, signInAnonymously };

// Allow bfcache by disabling Firestore network when hidden
if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        import('firebase/firestore').then(({ enableNetwork, disableNetwork }) => {
            if (document.visibilityState === 'hidden') {
                disableNetwork(db).catch(console.error);
            } else {
                enableNetwork(db).catch(console.error);
            }
        });
    });
}
