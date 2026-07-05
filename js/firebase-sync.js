// ==========================================================================
// FIREBASE-SYNC.JS - Versão 4.0 (APENAS FIREBASE - SEM LOCALSTORAGE)
// Sistema Multi-Usuário - Dados sempre atualizados do Firebase
// ==========================================================================

(function() {
  'use strict';

  console.log('🔥 Firebase Sync 4.0 - Modo Cloud (sem localStorage)');

  // Estados do Sistema
  let isOnline = navigator.onLine;
  let db = window.db || window.firebaseDB || null;
  let isSyncing = false;

  // Reconectar db se necessário
  if (!db && window.firebase) {
    try {
      db = window.firebase.firestore();
      window.db = db;
    } catch(e) {
      console.warn("⚠️ Falha ao recuperar Firestore:", e.message);
    }
  }

  // Monitorar conexão
  window.addEventListener('online', () => {
    isOnline = true;
    console.log('📶 Online - Dados serão carregados do Firebase');
  });

  window.addEventListener('offline', () => {
    isOnline = false;
    console.log('📴 Offline - Sistema requer conexão');
  });

  // ============ FUNÇÕES CORE (APENAS FIREBASE) ============

  /**
   * Salvar dados DIRETAMENTE no Firebase
   */
  async function saveToFirebase(collectionName, data) {
    if (!db || !isOnline) {
      console.error('❌ Sem conexão para salvar');
      return false;
    }
    
    try {
      let qtd = Array.isArray(data) ? data.length : 
                (data && typeof data === 'object' ? Object.keys(data).length : 0);

      await db.collection(collectionName).doc('dados_completos').set({
        dados: data,
        ultimaAtualizacao: new Date().toISOString(),
        quantidadeItens: qtd,
        usuario: 'sistema' // Pode adicionar usuário logado aqui
      }, { merge: true });
      
      console.log(`✅ Dados salvos no Firebase [${collectionName}]`);
      return true;
    } catch (e) {
      console.error(`❌ Erro ao salvar [${collectionName}]:`, e);
      return false;
    }
  }

  /**
   * Carregar dados DIRETAMENTE do Firebase
   */
  async function loadFromFirebase(collectionName) {
    if (!db || !isOnline) {
      console.warn('⚠️ Sem conexão com Firebase');
      return null;
    }
    
    try {
      const doc = await db.collection(collectionName).doc('dados_completos').get();
      
      if (doc.exists && doc.data().dados) {
        const data = doc.data();
        console.log(`✅ Dados carregados do Firebase [${collectionName}]:`, 
                    data.quantidadeItens || 0, 'itens');
        return data.dados;
      }
      
      console.log(`ℹ️ Nenhum dado encontrado em [${collectionName}]`);
      return null;
    } catch (e) {
      console.error(`❌ Erro ao carregar [${collectionName}]:`, e);
      return null;
    }
  }

  /**
   * Salvar documento individual (para CRUD)
   */
  async function saveDocument(collection, docId, data) {
    if (!db || !isOnline) return false;
    
    try {
      if (docId) {
        await db.collection(collection).doc(docId).set(data, { merge: true });
      } else {
        await db.collection(collection).add(data);
      }
      console.log(`✅ Documento salvo em [${collection}]`);
      return true;
    } catch (e) {
      console.error(`❌ Erro ao salvar documento:`, e);
      return false;
    }
  }

  /**
   * Buscar todos os documentos de uma coleção
   */
  async function getCollection(collectionName) {
    if (!db || !isOnline) return [];
    
    try {
      const snapshot = await db.collection(collectionName).get();
      const items = [];
      snapshot.forEach(doc => {
        items.push({ id: doc.id, ...doc.data() });
      });
      console.log(`✅ ${items.length} itens carregados de [${collectionName}]`);
      return items;
    } catch (e) {
      console.error(`❌ Erro ao carregar coleção [${collectionName}]:`, e);
      return [];
    }
  }

  /**
   * Deletar documento
   */
  async function deleteDocument(collection, docId) {
    if (!db || !isOnline) return false;
    
    try {
      await db.collection(collection).doc(docId).delete();
      console.log(`✅ Documento deletado de [${collection}]`);
      return true;
    } catch (e) {
      console.error(`❌ Erro ao deletar:`, e);
      return false;
    }
  }

  // ============ INTERFACE GLOBAL (API) ============
  
  window.SyncSystem = {
    // Status do sistema
    getStatus: () => ({
      online: isOnline,
      firebaseConnected: !!db,
      modo: 'CLOUD (sem localStorage)',
      multiUsuario: true
    }),

    // CRUD Básico
    save: saveDocument,
    get: getCollection,
    delete: deleteDocument,
    update: saveDocument,

    // Compatibilidade com versão anterior
    salvarModulo: saveToFirebase,
    carregarModulo: loadFromFirebase,
    
    // Sincronização (agora é direta)
    syncNow: async () => {
      console.log('🔄 Sistema em modo cloud - dados sempre atualizados');
      return true;
    }
  };

  // Funções globais para compatibilidade
  window.salvarNoFirebase = saveToFirebase;
  window.carregarDoFirebase = loadFromFirebase;
  window.getCollection = getCollection;
  window.saveDocument = saveDocument;
  window.deleteDocument = deleteDocument;

  // Limpar localStorage antigo (opcional, execute uma vez)
  window.limparCacheLocal = function() {
    const keysParaRemover = [
      'documentos', 'documentos_meta', 'veiculos', 'empresas',
      'abastecimentos', 'manutencoes', 'produtos', 'fornecedores',
      'centralCustos_v14_milplastics', 'controleMotoristas_systemmil_v2',
      'controleMotoristas_sync_queue', 'historico', 'historico_cotacao'
    ];
    
    keysParaRemover.forEach(key => {
      try {
        localStorage.removeItem(key);
        console.log(`🗑️ Cache removido: ${key}`);
      } catch(e) {}
    });
    
    console.log('✅ Cache local completamente limpo!');
    console.log('🔄 Recarregue a página para usar apenas Firebase.');
  };

  console.log('✅ SyncSystem 4.0 pronto (Cloud Mode)');
  console.log('💡 Dica: Execute window.limparCacheLocal() para limpar cache antigo');

})();
