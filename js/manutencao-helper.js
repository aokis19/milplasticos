// /assets/js/manutencao-helper.js
const firebaseConfig = {
    apiKey: "AIzaSyD4GQv7odzKtxg36f_SSWLbQF-TmYi4xYI",
    authDomain: "system-mil.firebaseapp.com",
    projectId: "system-mil",
    storageBucket: "system-mil.firebasestorage.app",
    messagingSenderId: "138426359863",
    appId: "1:138426359863:web:ab731a7ae1b7e03f7a1fb2"
};

// Inicializar Firebase se não foi inicializado
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
