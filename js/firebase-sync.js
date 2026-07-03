// =============================================
// FIREBASE-SYNC.JS - Versão 3.0 Unificada
// Sincronização Firebase ↔ LocalStorage (Cache)
// Todos os módulos centralizados
// =============================================

(function() {
    'use strict';

    // ============ CONFIGURAÇÃO ============
    const CONFIG = {
        STORAGE_KEY: 'controleMotoristas_systemmil_v2',
        BACKUP_KEY: 'controleMotoristas_backup_',
        SYNC_QUEUE_KEY: 'controleMotoristas_sync_queue',
        MAX_BACKUPS: 5,
        SYNC_INTERVAL: 30000,
    };

    // Mapeamento de chaves localStorage ↔ coleções Firebase
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
        'alertasGlobalConfig': 'configuracoes'
    };

    // ============ ESTADO DO SISTEMA ============
    let db = null;
    let isOnline = false;
    let isSyncing = false;
    let dataVersion = 0;
    let syncQueue = [];
    let appData = criarDadosVazios();

    // ============ FUNÇÕES AUXILIARES ============
    function criarDadosVazios() {
        return {
            motoristas: [],
            ponto: {},
            pagamentos: [],
            registrosKM: [],
            _metadata: {
                version: 0,
                lastSync: null,
                lastModified: new Date().toISOString(),
                modifiedBy: 'sistema'
            }
        };
    }

    // ============ INICIALIZAÇÃO ============
    function init() {
        console.log('🚀 Inicializando Sync System v3.0 - Multi-Módulos');
        
        // Verificar Firebase
        if (typeof firebase !== 'undefined' && firebase.firestore) {
            if (!firebase.apps.length) {
                console.warn('⚠️ Firebase não inicializado - aguardando...');
                setTimeout(init, 1000);
                return;
            } else {
                db = firebase.firestore();
                window.firebaseDB = db;
                console.log('✅ Firestore conectado');
            }
        } else {
            console.warn('⚠️ Firebase SDK não carregado');
        }

        // Configurar persistência offline
        if (db) {
            db.enablePersistence({ synchronizeTabs: true })
                .then(() => console.log('✅ Persistência offline ativada'))
                .catch((err) => {
                    if (err.code === 'failed-precondition') {
                        console.warn('⚠️ Múltiplas abas abertas - persistência limitada');
                    }
                });

            db.enableNetwork()
                .then(() => {
                    isOnline = true;
                    console.log('🌐 Firebase online');
                    processarFilaSync();
                    sincronizarTodosModulos();
                })
                .catch(() => {
                    isOnline = false;
                    console.warn('⚠️ Firebase offline');
                });
        }

        // Carregar dados locais
        carregarDadosLocais();
        carregarFilaSync();
        
        // Sincronizar com Firebase
        if (db && isOnline) {
            sincronizarComFirebase();
        }
        
        // Sincronização periódica
        setInterval(sincronizarPeriodicamente, CONFIG.SYNC_INTERVAL);
        
        // Monitorar online/offline
        window.addEventListener('online', () => {
            console.log('🌐 Conexão restaurada');
            isOnline = true;
            if (db) {
                db.enableNetwork().catch(() => {});
            }
            processarFilaSync();
            sincronizarTodosModulos();
        });
        
        window.addEventListener('offline', () => {
            console.log('📡 Conexão perdida - modo offline');
            isOnline = false;
        });

        // Salvar antes de fechar
        window.addEventListener('beforeunload', () => {
            salvarLocalStorage();
        });

        console.log('✅ Sync System v3.0 inicializado');
        console.log('   Módulos gerenciados:', Object.keys(MODULE_MAPPINGS).length);
    }

    // ============ CARREGAR DADOS LOCAIS ============
    function carregarDadosLocais() {
        try {
            const dataStr = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (dataStr) {
                const data = JSON.parse(dataStr);
                if (data && data._metadata) {
                    appData = data;
                    dataVersion = data._metadata.version || 0;
                    console.log('📦 Dados locais carregados - Versão:', dataVersion);
                    return;
                }
            }
        } catch (e) {
            console.error('❌ Erro ao carregar localStorage:', e);
        }
        
        appData = criarDadosVazios();
        dataVersion = 0;
    }

    // ============ SINCRONIZAR COM FIREBASE (Motoristas) ============
    async function sincronizarComFirebase() {
        if (!db || !isOnline) {
            console.log('💾 Firebase offline - usando cache local');
            return;
        }

        try {
            const metaDoc = await db.collection('_metadata').doc('appData').get();
            
            if (metaDoc.exists) {
                const firebaseVersion = metaDoc.data().version || 0;
                console.log(`📊 Versão Local: ${dataVersion} | Firebase: ${firebaseVersion}`);
                
                if (firebaseVersion > dataVersion) {
                    console.log('☁️ Firebase mais recente - baixando...');
                    await baixarDadosFirebase();
                } else if (dataVersion > firebaseVersion) {
                    console.log('💾 Local mais recente - enviando...');
                    await salvarNoFirebase();
                } else {
                    console.log('✅ Dados já sincronizados');
                }
            } else {
                console.log('☁️ Firebase vazio - enviando dados locais');
                await salvarNoFirebase();
            }
            
        } catch (error) {
            console.error('❌ Erro ao sincronizar:', error.message);
            isOnline = false;
        }
    }

    async function baixarDadosFirebase() {
        if (!db) return;
        
        try {
            const newData = criarDadosVazios();
            
            // Metadados
            const metaDoc = await db.collection('_metadata').doc('appData').get();
            if (metaDoc.exists) {
                newData._metadata = metaDoc.data();
            }
            
            // Motoristas
            const motoristasSnap = await db.collection('motoristas')
                .where('ativo', '==', true)
                .get();
            motoristasSnap.forEach(doc => {
                newData.motoristas.push({ firebaseId: doc.id, ...doc.data() });
            });
            
            // Pontos
            const pontosSnap = await db.collection('pontos').limit(1000).get();
            pontosSnap.forEach(doc => {
                const data = doc.data();
                delete data._modifiedAt;
                newData.ponto[doc.id] = data;
            });
            
            // Pagamentos
            const pagSnap = await db.collection('pagamentos')
                .orderBy('data', 'desc')
                .limit(500)
                .get();
            pagSnap.forEach(doc => {
                newData.pagamentos.push({ firebaseId: doc.id, ...doc.data() });
            });
            
            // KM
            const kmSnap = await db.collection('registrosKM')
                .orderBy('data', 'desc')
                .limit(500)
                .get();
            kmSnap.forEach(doc => {
                newData.registrosKM.push({ firebaseId: doc.id, ...doc.data() });
            });
            
            appData = newData;
            dataVersion = newData._metadata.version || 0;
            salvarLocalStorage();
            
            console.log('✅ Dados do Firebase carregados');
            
        } catch (error) {
            console.error('❌ Erro ao baixar Firebase:', error);
        }
    }

    // ============ SALVAR DADOS (Motoristas) ============
    function salvarLocalStorage() {
        try {
            appData._metadata.version = (appData._metadata.version || 0) + 1;
            appData._metadata.lastModified = new Date().toISOString();
            
            const dataStr = JSON.stringify(appData);
            localStorage.setItem(CONFIG.STORAGE_KEY, dataStr);
            dataVersion = appData._metadata.version;
            
            return true;
        } catch (e) {
            console.error('❌ Erro ao salvar localStorage:', e);
            return false;
        }
    }

    async function salvarNoFirebase() {
        if (!db || !isOnline) {
            adicionarFilaSync();
            return false;
        }

        try {
            const batch = db.batch();
            
            // Metadados
            batch.set(db.collection('_metadata').doc('appData'), appData._metadata, { merge: true });
            
            // Motoristas
            for (const m of appData.motoristas) {
                if (!m.ativo) continue;
                const clean = { ...m };
                delete clean.firebaseId;
                clean._modifiedAt = firebase.firestore.FieldValue.serverTimestamp();
                
                if (m.firebaseId) {
                    batch.set(db.collection('motoristas').doc(m.firebaseId), clean, { merge: true });
                } else {
                    const ref = db.collection('motoristas').doc();
                    batch.set(ref, clean);
                    m.firebaseId = ref.id;
                }
            }
            
            // Pontos
            const keys = Object.keys(appData.ponto || {});
            for (const key of keys) {
                const data = { ...appData.ponto[key] };
                data._modifiedAt = firebase.firestore.FieldValue.serverTimestamp();
                batch.set(db.collection('pontos').doc(key), data, { merge: true });
            }
            
            // Pagamentos
            for (const p of appData.pagamentos || []) {
                const clean = { ...p };
                delete clean.firebaseId;
                clean._modifiedAt = firebase.firestore.FieldValue.serverTimestamp();
                
                if (p.firebaseId) {
                    batch.set(db.collection('pagamentos').doc(p.firebaseId), clean, { merge: true });
                } else {
                    const ref = db.collection('pagamentos').doc();
                    batch.set(ref, clean);
                    p.firebaseId = ref.id;
                }
            }
            
            // KM
            for (const km of appData.registrosKM || []) {
                const clean = { ...km };
                delete clean.firebaseId;
                clean._modifiedAt = firebase.firestore.FieldValue.serverTimestamp();
                
                const docId = km.firebaseId || km.id;
                if (docId) {
                    batch.set(db.collection('registrosKM').doc(docId), clean, { merge: true });
                } else {
                    const ref = db.collection('registrosKM').doc();
                    batch.set(ref, clean);
                    km.id = ref.id;
                }
            }
            
            await batch.commit();
            
            appData._metadata.lastSync = new Date().toISOString();
            salvarLocalStorage();
            
            console.log('☁️ Dados de Motoristas salvos no Firebase');
            return true;
            
        } catch (error) {
            console.error('❌ Erro ao salvar Firebase:', error);
            adicionarFilaSync();
            return false;
        }
    }

    // ============ FILA DE SINCRONIZAÇÃO ============
    function carregarFilaSync() {
        try {
            const str = localStorage.getItem(CONFIG.SYNC_QUEUE_KEY);
            syncQueue = str ? JSON.parse(str) : [];
            if (syncQueue.length > 0) {
                console.log(`📋 ${syncQueue.length} operações na fila de sync`);
            }
        } catch (e) {
            syncQueue = [];
        }
    }

    function adicionarFilaSync() {
        syncQueue.push({
            timestamp: new Date().toISOString(),
            tentativas: 0,
            dados: JSON.parse(JSON.stringify(appData))
        });
        localStorage.setItem(CONFIG.SYNC_QUEUE_KEY, JSON.stringify(syncQueue));
    }

    async function processarFilaSync() {
        if (!isOnline || !db || syncQueue.length === 0) return;
        
        console.log('🔄 Processando fila de sincronização...');
        isSyncing = true;
        
        for (let i = syncQueue.length - 1; i >= 0; i--) {
            const op = syncQueue[i];
            
            if (op.tentativas > 10) {
                syncQueue.splice(i, 1);
                continue;
            }
            
            op.tentativas++;
            const backup = JSON.parse(JSON.stringify(appData));
            
            try {
                appData = op.dados;
                const ok = await salvarNoFirebase();
                
                if (ok) {
                    syncQueue.splice(i, 1);
                    console.log('✅ Item da fila sincronizado');
                } else {
                    appData = backup;
                }
            } catch (e) {
                appData = backup;
                console.error('❌ Erro na fila:', e);
            }
        }
        
        localStorage.setItem(CONFIG.SYNC_QUEUE_KEY, JSON.stringify(syncQueue));
        isSyncing = false;
    }

    // ============ BACKUP ============
    function criarBackupAutomatico() {
        try {
            const hoje = new Date().toISOString().split('T')[0];
            const key = CONFIG.BACKUP_KEY + hoje;
            
            if (!localStorage.getItem(key)) {
                localStorage.setItem(key, JSON.stringify(appData));
                
                // Limpar antigos
                const backups = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith(CONFIG.BACKUP_KEY)) backups.push(k);
                }
                backups.sort().reverse();
                for (let i = CONFIG.MAX_BACKUPS; i < backups.length; i++) {
                    localStorage.removeItem(backups[i]);
                }
            }
        } catch (e) {
            console.warn('⚠️ Erro backup:', e);
        }
    }

    // ============ SINCRONIZAÇÃO PERIÓDICA ============
    async function sincronizarPeriodicamente() {
        if (!isOnline || !db || isSyncing) return;
        
        try {
            const metaDoc = await db.collection('_metadata').doc('appData').get();
            if (metaDoc.exists) {
                const fbVersion = metaDoc.data().version || 0;
                if (fbVersion > dataVersion) {
                    console.log('🔄 Firebase mais recente - atualizando motoristas');
                    await baixarDadosFirebase();
                    window.dispatchEvent(new CustomEvent('dataUpdated', { detail: appData }));
                }
            }
            
            if (syncQueue.length > 0) {
                await processarFilaSync();
            }
        } catch (e) {
            // Silencioso
        }
    }

    // =============================================
    // NOVAS FUNÇÕES - MULTI-MÓDULOS (v3.0)
    // =============================================

    async function sincronizarTodosModulos() {
        if (!db || !isOnline) return;
        
        console.log('🔄 Sincronizando todos os módulos...');
        
        for (const [localKey, collection] of Object.entries(MODULE_MAPPINGS)) {
            try {
                // Verificar se Firebase tem dados
                const snapshot = await db.collection(collection).limit(1).get();
                
                if (!snapshot.empty) {
                    // Firebase tem dados → baixar tudo
                    const fullSnapshot = await db.collection(collection).get();
                    const data = [];
                    fullSnapshot.forEach(doc => {
                        const item = doc.data();
                        delete item._modifiedAt;
                        delete item._createdAt;
                        data.push({ id: doc.id, ...item });
                    });
                    
                    if (data.length > 0) {
                        localStorage.setItem(localKey, JSON.stringify(data));
                        console.log(`  ✅ ${collection}: ${data.length} itens sincronizados`);
                    }
                } else {
                    // Firebase vazio → enviar localStorage
                    const localData = localStorage.getItem(localKey);
                    if (localData) {
                        const parsed = JSON.parse(localData);
                        const items = Array.isArray(parsed) ? parsed : [parsed];
                        
                        if (items.length > 0) {
                            await saveModuleData(collection, items);
                            console.log(`  ⬆️ ${collection}: ${items.length} itens enviados`);
                        }
                    }
                }
            } catch (error) {
                console.log(`  ⚠️ ${collection}: ${error.message}`);
            }
        }
        
        console.log('✅ Sincronização de módulos concluída');
    }

    async function saveModuleData(collectionName, dataArray) {
        if (!db || !isOnline) return false;
        
        try {
            const batch = db.batch();
            let count = 0;
            
            for (const item of dataArray) {
                if (!item || !item.id) continue;
                
                const cleanData = { ...item };
                delete cleanData.firebaseId;
                cleanData._modifiedAt = firebase.firestore.FieldValue.serverTimestamp();
                cleanData._syncedAt = new Date().toISOString();
                
                const docId = String(item.id);
                batch.set(db.collection(collectionName).doc(docId), cleanData, { merge: true });
                count++;
                
                if (count >= 450) {
                    await batch.commit();
                    count = 0;
                }
            }
            
            if (count > 0) {
                await batch.commit();
            }
            
            return true;
        } catch (error) {
            console.error(`❌ Erro ao salvar ${collectionName}:`, error);
            return false;
        }
    }

    async function loadModuleData(collectionName) {
        if (!db || !isOnline) return null;
        
        try {
            const snapshot = await db.collection(collectionName).get();
            const data = [];
            
            snapshot.forEach(doc => {
                const item = doc.data();
                delete item._modifiedAt;
                delete item._createdAt;
                data.push({ id: doc.id, ...item });
            });
            
            return data;
        } catch (error) {
            console.error(`❌ Erro ao carregar ${collectionName}:`, error);
            return null;
        }
    }

    async function deleteModuleItem(collectionName, itemId) {
        if (!db || !isOnline) return false;
        
        try {
            await db.collection(collectionName).doc(String(itemId)).delete();
            return true;
        } catch (error) {
            console.error(`❌ Erro ao excluir ${collectionName}/${itemId}:`, error);
            return false;
        }
    }

    async function addModuleItem(collectionName, item) {
        if (!db || !isOnline) return null;
        
        try {
            const docData = {
                ...item,
                _createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                _modifiedAt: firebase.firestore.FieldValue.serverTimestamp(),
                _syncedAt: new Date().toISOString()
            };
            delete docData.firebaseId;
            delete docData.id;
            
            const docRef = await db.collection(collectionName).add(docData);
            return { id: docRef.id, ...item };
        } catch (error) {
            console.error(`❌ Erro ao adicionar em ${collectionName}:`, error);
            return null;
        }
    }

    async function migrateAllToFirebase() {
        if (!db || !isOnline) {
            console.error('❌ Firebase não disponível');
            alert('Firebase não está conectado! Verifique sua conexão.');
            return;
        }
        
        console.log('🚀 Iniciando migração completa localStorage → Firebase...');
        let totalMigrados = 0;
        const resultados = [];
        
        for (const [localKey, collection] of Object.entries(MODULE_MAPPINGS)) {
            const localData = localStorage.getItem(localKey);
            
            if (localData) {
                try {
                    const parsed = JSON.parse(localData);
                    const items = Array.isArray(parsed) ? parsed : [parsed];
                    
                    if (items.length > 0) {
                        await saveModuleData(collection, items);
                        totalMigrados += items.length;
                        resultados.push(`✅ ${localKey} → ${collection}: ${items.length} itens`);
                        console.log(`  ✅ "${localKey}" → "${collection}": ${items.length} itens`);
                    }
                } catch (error) {
                    resultados.push(`⚠️ ${localKey}: erro - ${error.message}`);
                    console.log(`  ⚠️ "${localKey}": ${error.message}`);
                }
            }
        }
        
        console.log(`✅ Migração concluída! ${totalMigrados} itens migrados.`);
        
        const mensagem = `Migração concluída!\n\n${resultados.join('\n')}\n\nTotal: ${totalMigrados} itens migrados.\n\nDeseja LIMPAR o localStorage? (Recomendado)`;
        
        if (totalMigrados > 0 && confirm(mensagem)) {
            for (const localKey of Object.keys(MODULE_MAPPINGS)) {
                localStorage.removeItem(localKey);
            }
            console.log('🗑️ localStorage limpo!');
            alert('localStorage limpo! Recarregue a página (F5).');
            location.reload();
        }
    }

    // =============================================
    // API PÚBLICA (ESTENDIDA)
    // =============================================
    window.SyncSystem = {
        // Funções originais (Motoristas)
        getData: function() {
            return JSON.parse(JSON.stringify(appData));
        },
        
        updateData: async function(newData, quem = 'usuario') {
            appData = {
                ...appData,
                ...newData,
                _metadata: {
                    ...appData._metadata,
                    version: (appData._metadata.version || 0) + 1,
                    lastModified: new Date().toISOString(),
                    modifiedBy: quem
                }
            };
            
            dataVersion = appData._metadata.version;
            salvarLocalStorage();
            criarBackupAutomatico();
            
            if (isOnline && db) {
                await salvarNoFirebase();
            } else {
                adicionarFilaSync();
            }
            
            return true;
        },
        
        forceSync: async function() {
            await processarFilaSync();
            await sincronizarTodosModulos();
        },
        
        getStatus: function() {
            return {
                online: isOnline,
                syncing: isSyncing,
                version: dataVersion,
                queueSize: syncQueue.length,
                lastSync: appData._metadata.lastSync,
                lastModified: appData._metadata.lastModified,
                firebaseConnected: !!db
            };
        },
        
        createBackup: function() {
            const ts = new Date().toISOString().replace(/[:.]/g, '-');
            const key = CONFIG.BACKUP_KEY + 'manual_' + ts;
            localStorage.setItem(key, JSON.stringify(appData));
            console.log('📦 Backup:', key);
            return key;
        },
        
        restoreBackup: function(key) {
            const str = localStorage.getItem(key);
            if (str) {
                try {
                    appData = JSON.parse(str);
                    dataVersion = appData._metadata.version || 0;
                    salvarLocalStorage();
                    return true;
                } catch (e) {
                    return false;
                }
            }
            return false;
        },
        
        listBackups: function() {
            const backups = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith(CONFIG.BACKUP_KEY)) {
                    try {
                        const d = JSON.parse(localStorage.getItem(k));
                        backups.push({
                            key: k,
                            date: k.replace(CONFIG.BACKUP_KEY, ''),
                            version: d?._metadata?.version || 0
                        });
                    } catch (e) {}
                }
            }
            return backups.sort((a, b) => b.date.localeCompare(a.date));
        },
        
        exportData: function() {
            const blob = new Blob([JSON.stringify(appData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        },
        
        importData: async function(jsonData) {
            try {
                const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
                return await this.updateData(data, 'importacao');
            } catch (e) {
                return false;
            }
        },

        // ========== NOVAS FUNÇÕES MULTI-MÓDULOS ==========
        
        saveModuleData: saveModuleData,
        loadModuleData: loadModuleData,
        deleteModuleItem: deleteModuleItem,
        addModuleItem: addModuleItem,
        migrateAllToFirebase: migrateAllToFirebase,
        syncAllModules: sincronizarTodosModulos,
        
        // Função para salvar dados de qualquer módulo
        salvarModulo: async function(nomeModulo, dados) {
            const collection = MODULE_MAPPINGS[nomeModulo] || nomeModulo;
            
            // Sempre salvar no localStorage como cache
            localStorage.setItem(nomeModulo, JSON.stringify(dados));
            
            // Salvar no Firebase se online
            if (isOnline && db) {
                return await saveModuleData(collection, dados);
            }
            return false;
        },
        
        // Função para carregar dados de qualquer módulo
        carregarModulo: async function(nomeModulo) {
            const collection = MODULE_MAPPINGS[nomeModulo] || nomeModulo;
            
            // Tentar Firebase primeiro
            if (isOnline && db) {
                try {
                    const data = await loadModuleData(collection);
                    if (data && data.length > 0) {
                        // Atualizar cache local
                        localStorage.setItem(nomeModulo, JSON.stringify(data));
                        return data;
                    }
                } catch(e) {
                    console.warn(`⚠️ Firebase indisponível para ${nomeModulo}, usando cache`);
                }
            }
            
            // Fallback para localStorage
            const localData = localStorage.getItem(nomeModulo);
            return localData ? JSON.parse(localData) : [];
        }
    };

    // ========== FUNÇÕES GLOBAIS (CONSOLE) ==========
    window.migrarTudoParaFirebase = () => window.SyncSystem.migrateAllToFirebase();
    window.syncAllModules = () => window.SyncSystem.syncAllModules();
    window.verStatusSync = () => {
        const status = window.SyncSystem.getStatus();
        console.log('📊 Status do Sync System:');
        console.log('   Online:', status.online ? '✅' : '❌');
        console.log('   Firebase:', status.firebaseConnected ? '✅' : '❌');
        console.log('   Sincronizando:', status.syncing ? '🔄' : '⏸️');
        console.log('   Versão:', status.version);
        console.log('   Fila:', status.queueSize);
        console.log('   Último sync:', status.lastSync);
        return status;
    };

    // ============ INICIAR ============
    if (!appData) {
        appData = criarDadosVazios();
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
