// firebase-init.js
// Configuração única para todas as páginas

// Seus dados do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD4GQv7odzKtxg36f_SSWLbQF-TmYi4xYI",
  authDomain: "system-mil.firebaseapp.com",
  projectId: "system-mil",
  storageBucket: "system-mil.firebasestorage.app",
  messagingSenderId: "138426359863",
  appId: "1:138426359863:web:ab731a7ae1b7e03f7a1fb2",
  measurementId: "G-DYCDBRZSHZ"
};

// Inicializar (evita inicializar múltiplas vezes)
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Disponibilizar globalmente
if (typeof firebase !== 'undefined') {
    window.firebaseDB = firebase.firestore();
    console.log('🔥 Firebase inicializado');
}