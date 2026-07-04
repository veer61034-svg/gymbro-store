import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// =========================================================================
// FIREBASE CONFIGURATION
// Replace the placeholder values below with your real Firebase web app config.
// =========================================================================
const firebaseConfig = {
    apiKey: "AIzaSyACoIPYjIPiQ_Hu420lVZlKQCGIEliRIQg",
    authDomain: "gymbro-store.firebaseapp.com",
    projectId: "gymbro-store",
    storageBucket: "gymbro-store.firebasestorage.app",
    messagingSenderId: "112445172077",
    appId: "1:112445172077:web:db3f5753c9b20cadb4d264"
};

let app = null;
let db = null;
let auth = null;
let useMock = false;

// Auto-detect if placeholders are still present
if (!firebaseConfig.projectId || firebaseConfig.projectId.includes("YOUR_PROJECT_ID_HERE")) {
    console.warn("GYMBRO Alert: Firebase projectId is not configured. Falling back to offline local storage simulation.");
    useMock = true;
} else {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        console.log("GYMBRO: Firebase SDK loaded and initialized successfully.");
    } catch (err) {
        console.error("GYMBRO: Firebase initialization failed, falling back to mock database:", err);
        useMock = true;
    }
}

// Expose Auth globally for use in standard scripts
if (useMock) {
    let mockUser = JSON.parse(localStorage.getItem('gymbroMockUser') || 'null');
    const authCallbacks = [];

    window.firebaseAuth = null;
    
    window.firebaseSignIn = async (authInstance, email, password) => {
        // Mock Admin login credentials (matches original password for consistency)
        if (email === 'admin@gymbro.com' && password === 'admin@gymbro@2024') {
            mockUser = { email: email, uid: 'MOCK-ADMIN-UID-12345' };
            localStorage.setItem('gymbroMockUser', JSON.stringify(mockUser));
            authCallbacks.forEach(cb => cb(mockUser));
            return { user: mockUser };
        } else {
            const err = new Error('Firebase: Error (auth/invalid-credential).');
            err.code = 'auth/invalid-credential';
            throw err;
        }
    };

    window.firebaseOnAuthStateChanged = (authInstance, callback) => {
        authCallbacks.push(callback);
        // Trigger initial check asynchronously to match Firebase Auth behavior
        setTimeout(() => callback(mockUser), 0);
        return () => {
            const idx = authCallbacks.indexOf(callback);
            if (idx > -1) authCallbacks.splice(idx, 1);
        };
    };

    window.firebaseSignOut = async (authInstance) => {
        mockUser = null;
        localStorage.removeItem('gymbroMockUser');
        authCallbacks.forEach(cb => cb(null));
    };
} else {
    window.firebaseAuth = auth;
    window.firebaseSignIn = signInWithEmailAndPassword;
    window.firebaseOnAuthStateChanged = onAuthStateChanged;
    window.firebaseSignOut = signOut;
}

window.firebaseApp = app;
window.firebaseDb = db;
window.useFirebaseMock = useMock;
