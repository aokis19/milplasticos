// firebase-init.js
// Configuração única para todas as páginas

const firebaseConfig = {
  apiKey: "AIzaSyD4GQv7odzKtxg36f_SSWLbQF-TmYi4xYI",
  authDomain: "system-mil.firebaseapp.com",
  projectId: "system-mil",
  storageBucket: "system-mil.appspot.com",
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

  // Configurar cache ilimitado
  window.firebaseDB.settings({
    cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
  });

  console.log('✅ Firebase inicializado e configurado');
} else {
  console.error('❌ Firebase SDK não carregado!');
}
