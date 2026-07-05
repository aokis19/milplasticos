// ==========================================================================
// FIREBASE-SYNC.JS - Versão 3.3 (Módulo Central de Custos Totalmente Corrigido)
// Sincronização Inteligente LocalStorage (Cache) <-> Firebase Firestore
// ==========================================================================

(function() {
  'use strict';

  // ============ CONFIGURAÇÃO DO SISTEMA ============
  const CONFIG = {
    STORAGE_KEY: 'controleMotoristas_systemmil_v2',
    BACKUP_KEY: 'controleMotoristas_backup_',
    SYNC_QUEUE_KEY: 'controleMotoristas_sync_queue',
    MAX_BACKUPS: 5,
    SYNC_INTERVAL: 30000,         // Tenta sincronizar a cada 30 segundos
    MAX_LOCAL_STORAGE_MB: 2,       // Limite máximo recomendado por módulo
  };

  // Mapeamento de chaves do localStorage para Coleções do Firebase
  const MODULE_MAPPINGS = {
    'abastecimentos': 'abastecimentos',
    'documentos': 'documentos',
    'empresas': 'empresas',
    'empresas_docs': 'empresas',
    'produtos': 'produtos',
    'produtos_cotacao': 'produtos',
    'cotacoes': 'cotacoes',
    'historico': 'historico',
    'historico_cotacao': 'historico',
    'fornecedores': 'fornecedores',
    'manutencoes': 'manutencoes',
    'manutencoesCorretivas': 'manutencoes',
    'veiculos': 'veiculos',
    'tiposManutencao': 'tiposManutencao',
    'alertasGlobalConfig': 'configuracoes',
    
    // CORRIGIDO: Mapeando a chave exata utilizada no custo.js para puxar o cache antigo
    'centralCustos_v14_milplastics': 'centralCustos' 
  };

  // Campos pesados (ex: imagens em Base64) que devem ser removidos do localStorage se estourarem o limite
  const CAMPOS_PESADOS = ['foto', 'comprovante', 'anexo', 'pdf', 'imagem'];

  // Estados do Sistema de Sincronização
  let isOnline = navigator.onLine;
  let db = window.firebaseDB || null;
  let syncIntervalId = null;
  let isSyncing = false;

  // Ouvir alterações na conexão de rede do usuário
  window.addEventListener('online', () => {
    isOnline = true;
    console.log('📶 Conexão restabelecida! Tentando processar fila de sincronização...');
    processSyncQueue();
  });

  window.addEventListener('offline', () => {
    isOnline = false;
    console.log('📴 Modo offline ativado. O sistema continuará salvando localmente.');
  });

  // Tentar redefinir o banco se o inicializador demorar um pouco
  if (!db && window.firebase) {
    try {
      db = window.firebase.firestore();
    } catch(e) {
      console.warn("Aviso: Falha ao recuperar firestore em tempo de execução imediato:", e.message);
    }
  }

  // ============ FUNÇÕES AUXILIARES DE ARMAZENAMENTO LOCAL ============
  
  function getStorageSizeMB() {
    let total = 0;
    for (let x in localStorage) {
      if (localStorage.hasOwnProperty(x)) {
        total += ((localStorage[x].length * 2) / 1024 / 1024);
      }
    }
    return total;
  }

  function otimizarDadosPesados(dados) {
    if (!Array.isArray(dados)) return dados;
    return dados.map(item => {
      const novoItem = { ...item };
      CAMPOS_PESADOS.forEach(campo => {
        if (novoItem[campo] && novoItem[campo].length > 1000) {
          novoItem[campo] = "[Removido localmente por tamanho - salvo no Firebase]";
        }
      });
      return novoItem;
    });
  }

  function safeSetItem(chave, dados) {
    try {
      const stringData = JSON.stringify(dados);
      localStorage.setItem(chave, stringData);
      return true;
    } catch (e) {
      console.warn(`⚠️ Limite de localStorage atingido para a chave: ${chave}. Otimizando...`);
      try {
        const dadosOtimizados = otimizarDadosPesados(dados);
        localStorage.setItem(chave, JSON.stringify(dadosOtimizados));
        return true;
      } catch (err) {
        console.error(`❌ Erro fatal ao salvar localmente mesmo após otimização:`, err);
        return false;
      }
    }
  }

  // ============ FUNÇÕES CORE DE INTEGRAÇÃO COM FIREBASE ============

  async function saveModuleData(collectionName, data) {
    if (!db) return false;
    try {
      // CORREÇÃO: Garante que o campo quantidadeItens nunca seja 'undefined'
      let qtd = 0;
      if (data) {
        if (Array.isArray(data)) {
          qtd = data.length;
        } else if (typeof data === 'object') {
          // Se for o objeto estruturado da Central de Custos, prioriza a contagem de períodos cadastrados
          qtd = data.periodos ? data.periodos.length : Object.keys(data).length;
        }
      }

      // Cria um documento agregador ou salva em lote dependendo da estrutura
      await db.collection(collectionName).doc('dados_completos').set({
        dados: data,
        ultimaAtualizacao: new Date().toISOString(),
        quantidadeItens: qtd
      }, { merge: true });
      return true;
    } catch (e) {
      console.error(`❌ Erro ao enviar dados para coleção Firebase [${collectionName}]:`, e);
      addToSyncQueue(collectionName, data);
      return false;
    }
  }

  async function loadModuleData(collectionName) {
    if (!db) return null;
    try {
      const doc = await db.collection(collectionName).doc('dados_completos').get();
      if (doc.exists && doc.data().dados) {
        return doc.data().dados;
      }
      return null;
    } catch (e) {
      console.error(`❌ Erro ao puxar dados da coleção Firebase [${collectionName}]:`, e);
      return null;
    }
  }

  // Fila Offline para itens modificados sem internet
  function addToSyncQueue(modulo, dados) {
    try {
      let queue = localStorage.getItem(CONFIG.SYNC_QUEUE_KEY);
      queue = queue ? JSON.parse(queue) : {};
      queue[modulo] = {
        dados: dados,
        timestamp: Date.now()
      };
      localStorage.setItem(CONFIG.SYNC_QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.error("Erro ao gerenciar fila de sincronização offline:", e);
    }
  }

  async function processSyncQueue() {
    if (!isOnline || !db || isSyncing) return;
    isSyncing = true;

    try {
      let queueStr = localStorage.getItem(CONFIG.SYNC_QUEUE_KEY);
      if (!queueStr) { isSyncing = false; return; }

      let queue = JSON.parse(queueStr);
      const modulosNaFila = Object.keys(queue);

      if (modulosNaFila.length === 0) { isSyncing = false; return; }

      console.log(`⏳ Processando fila de sincronização para ${modulosNaFila.length} módulos...`);

      for (const modulo of modulosNaFila) {
        const collection = MODULE_MAPPINGS[modulo] || modulo;
        const sucesso = await saveModuleData(collection, queue[modulo].dados);
        
        if (sucesso) {
          delete queue[modulo];
          console.log(`✅ Sincronização pendente concluída com sucesso para o módulo: ${modulo}`);
        }
      }

      localStorage.setItem(CONFIG.SYNC_QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.error("Erro no processamento da fila de sync:", e);
    } finally {
      isSyncing = false;
    }
  }

  // Sincronizar todos os módulos cadastrados ativos
  async function sincronizarTodosModulos() {
    if (!isOnline || !db) {
      console.warn("⚠️ Não é possível sincronizar todos os módulos: Dispositivo está em modo Offline.");
      return false;
    }

    console.log("🔄 Iniciando varredura geral e sincronização completa com Firebase...");
    let logsSucesso = [];

    for (const modulo in MODULE_MAPPINGS) {
      const localData = localStorage.getItem(modulo);
      if (localData) {
        try {
          const dadosParsed = JSON.parse(localData);
          const col = MODULE_MAPPINGS[modulo];
          const ok = await saveModuleData(col, dadosParsed);
          if (ok) logsSucesso.push(modulo);
        } catch(e) {
          console.error(`Falha ao sincronizar o módulo [${modulo}]:`, e.message);
        }
      }
    }
    console.log(` Sincronização em lote finalizada. Módulos atualizados na nuvem:`, logsSucesso);
    return true;
  }

  // ============ INICIALIZAÇÃO AUTOMÁTICA E LOOP DE TIMER ============
  function init() {
    // Processamento imediato inicial se estiver conectado
    setTimeout(() => {
      processSyncQueue();
    }, 2000);

    // Configura o intervalo cíclico em background
    if (syncIntervalId) clearInterval(syncIntervalId);
    syncIntervalId = setInterval(() => {
      processSyncQueue();
    }, CONFIG.SYNC_INTERVAL);
  }

  init();

  // ============ INTERFACE GLOBAL EXPOSTA (API WINDOW) ============
  window.SyncSystem = {
    getStatus: () => ({
      online: isOnline,
      firebaseConnected: !!db,
      totalStorageMB: getStorageSizeMB().toFixed(2),
      limiteMaximoMB: CONFIG.MAX_LOCAL_STORAGE_MB
    }),

    // Salvar Módulo inteligente (Local + Nuvem)
    salvarModulo: async (nomeModulo, dados) => {
      const collection = MODULE_MAPPINGS[nomeModulo] || nomeModulo;
      
      // Salva localmente primeiro por segurança
      const localOk = safeSetItem(nomeModulo, dados);
      
      // Se estiver online e Firebase configurado, joga na nuvem
      if (isOnline && db) {
        return await saveModuleData(collection, dados);
      } else {
        // Se estiver offline, adiciona na fila de pendências
        addToSyncQueue(nomeModulo, dados);
        return localOk;
      }
    },

    // Carregar Módulo inteligente (Nuvem com Fallback Local)
    carregarModulo: async (nomeModulo) => {
      const collection = MODULE_MAPPINGS[nomeModulo] || nomeModulo;
      
      if (isOnline && db) {
        try {
          const remoteData = await loadModuleData(collection);
          if (remoteData) {
            safeSetItem(nomeModulo, remoteData); // atualiza cache local
            return remoteData;
          }
        } catch(e) {
          console.warn(`Aviso ao ler nuvem do módulo ${nomeModulo}, usando cache local.`, e.message);
        }
      }
      
      // Fallback: Retorna o cache se estiver offline ou se a nuvem falhar/estiver vazia
      const localData = localStorage.getItem(nomeModulo);
      return localData ? JSON.parse(localData) : [];
    },

    // Migrar dados locais antigos brutos para o padrão Firebase
    migrateAllToFirebase: async () => {
      return await sincronizarTodosModulos();
    }
  };

  // Funções legadas ou chamadas diretas por botões no HTML global
  window.migrarTudoParaFirebase = () => window.SyncSystem.migrateAllToFirebase();
  window.syncAllModules = () => window.SyncSystem.migrateAllToFirebase();
  window.verStatusSync = () => {
    const s = window.SyncSystem.getStatus();
    console.log(`📊 Status Sistema: ${s.online ? '🟢 Online' : '🔴 Offline'} | Firebase: ${s.firebaseConnected ? '⚙️ Ativo' : '❌ Desconectado'} | Cache: ${s.totalStorageMB}MB / ${s.limiteMaximoMB}MB`);
    return s;
  };

})();
