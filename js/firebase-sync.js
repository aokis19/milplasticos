// firebase-sync.js
// Sistema de Sincronização Segura Firebase ↔ LocalStorage
// Versão 2.2 - Corrigida e Estável

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

    // ============ ESTADO DO SISTEMA ============
    let db = null;
    let isOnline = false;
    let isSyncing = false;
    let dataVersion = 0;
    let syncQueue = [];
    let appData = criarDadosVazios(); // INICIALIZA IMEDIATAMENTE

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
        console.log('🚀 Inicializando Sync System v2.2');
        
        // Verificar Firebase
        if (typeof firebase !== 'undefined' && firebase.firestore) {
            if (!firebase.apps.length) {
                console.warn('⚠️ Firebase não inicializado');
            } else {
                db = firebase.firestore();
                window.firebaseDB = db;
            }
        }

        // Configurar persistência offline
        if (db) {
            db.enablePersistence({ synchronizeTabs: true })
                .then(() => console.log('✅ Persistência offline ativada'))
                .catch((err) => {
                    if (err.code === 'failed-precondition') {
                        console.warn('⚠️ Múltiplas abas abertas');
                    }
                });

            db.enableNetwork()
                .then(() => {
                    isOnline = true;
                    console.log('✅ Firebase conectado');
                    processarFilaSync();
                })
                .catch(() => {
                    isOnline = false;
                    console.warn('⚠️ Firebase offline');
                });
        }

        // Carregar dados salvos
        carregarDadosLocais();
        
        // Carregar fila de sincronização
        carregarFilaSync();
        
        // Sincronizar com Firebase
        sincronizarComFirebase();
        
        // Configurar sincronização periódica
        setInterval(sincronizarPeriodicamente, CONFIG.SYNC_INTERVAL);
        
        // Monitorar online/offline
        window.addEventListener('online', () => {
            console.log('🌐 Conexão restaurada');
            isOnline = true;
            if (db) db.enableNetwork().catch(() => {});
            processarFilaSync();
        });
        
        window.addEventListener('offline', () => {
            console.log('📡 Conexão perdida');
            isOnline = false;
        });

        // Salvar antes de fechar
        window.addEventListener('beforeunload', () => {
            salvarLocalStorage();
        });

        console.log('✅ Sync System inicializado');
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
        
        // Se não encontrou dados, criar vazios
        appData = criarDadosVazios();
        dataVersion = 0;
        console.log('📦 Nenhum dado local - iniciando vazio');
    }

    // ============ SINCRONIZAR COM FIREBASE ============
    async function sincronizarComFirebase() {
        if (!db || !isOnline) {
            console.log('💾 Firebase offline - usando apenas dados locais');
            return;
        }

        try {
            // Buscar versão do Firebase
            const metaDoc = await db.collection('_metadata').doc('appData').get();
            
            if (metaDoc.exists) {
                const firebaseVersion = metaDoc.data().version || 0;
                console.log(`📊 Versão Local: ${dataVersion} | Firebase: ${firebaseVersion}`);
                
                if (firebaseVersion > dataVersion) {
                    // Firebase mais recente - baixar todos os dados
                    console.log('☁️ Baixando dados do Firebase...');
                    await baixarDadosFirebase();
                } else if (dataVersion > firebaseVersion) {
                    // Local mais recente - enviar para Firebase
                    console.log('💾 Enviando dados locais para Firebase...');
                    await salvarNoFirebase();
                } else {
                    console.log('✅ Dados já sincronizados');
                }
            } else {
                // Firebase vazio - enviar dados locais
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
            
            // Atualizar dados locais
            appData = newData;
            dataVersion = newData._metadata.version || 0;
            salvarLocalStorage();
            
            console.log('✅ Dados do Firebase carregados');
            
        } catch (error) {
            console.error('❌ Erro ao baixar Firebase:', error);
        }
    }

    // ============ SALVAR DADOS ============
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
            
            console.log('☁️ Dados salvos no Firebase');
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
                console.log(`📋 ${syncQueue.length} operações na fila`);
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
        console.log('📋 Adicionado à fila -', syncQueue.length, 'pendentes');
    }

    async function processarFilaSync() {
        if (!isOnline || !db || syncQueue.length === 0) return;
        
        console.log('🔄 Processando fila...');
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
                    console.log('✅ Sincronizado com sucesso');
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
                console.log('📦 Backup diário:', hoje);
                
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
                    console.log('🔄 Firebase mais recente - atualizando');
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

    // ============ API PÚBLICA ============
    window.SyncSystem = {
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
        },
        
        getStatus: function() {
            return {
                online: isOnline,
                syncing: isSyncing,
                version: dataVersion,
                queueSize: syncQueue.length,
                lastSync: appData._metadata.lastSync,
                lastModified: appData._metadata.lastModified
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
        }
    };

    // ============ INICIAR ============
    // Garantir que appData existe antes de tudo
    if (!appData) {
        appData = criarDadosVazios();
    }
    
    // Iniciar quando o DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
