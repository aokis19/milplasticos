// ==========================================================================
// firebase-init.js - Versão 2.0 (Compatibilidade Total)
// Configuração única para todas as páginas
// 100% Firebase - Sem localStorage
// ==========================================================================

const firebaseConfig = {
  apiKey: "AlzaSyD4GQv7odzKtxg36f_SSWLbQF-TmYi4xYl",
  authDomain: "system-mil.firebaseapp.com",
  projectId: "system-mil",
  storageBucket: "system-mil.firebasestorage.app",
  messagingSenderId: "138426359863",
  appId: "1:138426359863:web:ab731a7ae1b7e03f7a1fb2",
  measurementId: "G-DYCDBRZSHZ"
};

// ========== INICIALIZAÇÃO DO FIREBASE ==========
(function() {
  'use strict';

  // Verificar se Firebase SDK foi carregado
  if (typeof firebase === 'undefined') {
    console.error('❌ Firebase SDK não carregado! Verifique a conexão com a internet.');
    return;
  }

  // Inicializar Firebase (evita múltiplas inicializações)
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log('✅ Firebase inicializado');
  } else {
    console.log('⚠️ Firebase já estava inicializado');
  }

  // Disponibilizar Firestore globalmente
  try {
    window.firebaseDB = firebase.firestore();
    
    // Configurar para melhor performance
    window.firebaseDB.settings({
      cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
      merge: true
    });

    // Habilitar persistência offline (modo multi-aba seguro)
    window.firebaseDB.enablePersistence({ synchronizeTabs: true })
      .then(() => console.log('✅ Persistência offline habilitada'))
      .catch((err) => {
        if (err.code === 'failed-precondition') {
          console.warn('⚠️ Múltiplas abas abertas - persistência em modo reduzido');
        } else if (err.code === 'unimplemented') {
          console.warn('⚠️ Navegador não suporta persistência offline');
        }
      });

    console.log('✅ Firestore configurado e disponível');

  } catch (error) {
    console.error('❌ Erro ao configurar Firestore:', error);
  }

  // ========== ALIAS PARA COMPATIBILIDADE ==========
  if (window.firebaseDB) {
    window.db = window.firebaseDB;
    console.log('✅ Alias window.db criado para compatibilidade');
    console.log('   📌 Use window.db ou window.firebaseDB');
    console.log('   🌐 Modo: Cloud (Firebase Direto)');
  }

  // ========== VERIFICAÇÃO DE SEGURANÇA ==========
  console.log('🔒 Lembre-se de configurar as Regras de Segurança no Firebase:');
  console.log('   https://console.firebase.google.com/project/system-mil/firestore/rules');

})();
