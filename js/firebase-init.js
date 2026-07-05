// firebase-init.js
// Configuração única para todas as páginas
const firebaseConfig = {
  apiKey: "AlzaSyD4GQv7odzKtxg36f_SSWLbQF-TmYi4xYl",
  authDomain: "system-mil.firebaseapp.com",
  projectId: "system-mil", //  Corrigido para o padrão CamelCase
  storageBucket: "system-mil.firebasestorage.app",
  messagingSenderId: "138426359863",
  appId: "1:138426359863:web:ab731a7ae1b7e03f7a1fb2",
  measurementId: "G-DYCDBRZSHZ"
};

// Inicializar Firebase (evita múltiplas inicializações)
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Disponibilizar Firestore globalmente
if (typeof firebase !== 'undefined') {
  window.firebaseDB = firebase.firestore();
  
  // Configurar para melhor performance
  window.firebaseDB.settings({
    cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
    merge: true
  });
  console.log(' Firebase inicializado e configurado');
} else {
  console.error('X Firebase SDK não carregado!');
}
