// firebase-sync.js
// Sistema de Sincronização Segura Firebase ↔ LocalStorage
// Versão 2.1 - Corrigida e Estável

(function() {
    'use strict';

    // ============ CONFIGURAÇÃO ============
    const CONFIG = {
        STORAGE_KEY: 'controleMotoristas_systemmil_v2',
        BACKUP_KEY: 'controleMotoristas_backup_',
        SYNC_QUEUE_KEY: 'controleMotoristas_sync_queue',
        MAX_BACKUPS: 5,
        SYNC_INTERVAL: 30000,
        RETRY_DELAY: 5000,
    };

    // ============ ESTADO DO SISTEMA ============
    let db = window.firebaseDB || null;
    let isOnline = false;
    let isSyncing = false;
    let dataVersion = 0;
    let syncQueue = [];
    let appData = null;

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

    function garantirAppData() {
        if (!appData) {
            appData = criarDadosVazios();
        }
        if (!appData._metadata) {
            appData._metadata = {
                version: 0,
                lastSync: null,
                lastModified: new Date().toISOString(),
                modifiedBy: 'sistema'
            };
        }
        return appData;
    }

    // ============ INICIALIZAÇÃO ============
    async function init() {
        console.log('🚀 Inicializando Sync System v2.1');
        
        // Verificar Firebase
        if (!db && typeof firebase !== 'undefined' && firebase.firestore) {
            db = firebase.firestore();
            window.firebaseDB = db;
        }

        // Configurar persistência offline
        if (db) {
            try {
                await db.enablePersistence({ synchronizeTabs: true });
                console.log('✅ Persistência offline ativada');
            } catch (err) {
                if (err.code === 'failed-precondition') {
                    console.warn('⚠️ Múltiplas abas abertas - persistência limitada');
                } else if (err.code === 'unimplemented') {
                    console.warn('⚠️ Navegador não suporta persistência offline');
                }
            }

            // Verificar conexão
            try {
                await db.enableNetwork();
                isOnline = true;
                console.log('✅ Firebase conectado');
            } catch (e) {
                isOnline = false;
                console.warn('⚠️ Firebase offline - usando cache local');
            }
        }

        // Garantir dados iniciais
        garantirAppData();
        
        // Carregar dados
        await carregarDadosIniciais();
        
        // Carregar fila de sincronização
        carregarFilaSync();
        
        // Configurar sincronização periódica
        setInterval(sincronizarPeriodicamente, CONFIG.SYNC_INTERVAL);
        
        // Monitorar online/offline
        window.addEventListener('online', () => {
            console.log('🌐 Conexão restaurada');
            isOnline = true;
            if (db) {
                db.enableNetwork().catch(() => {});
            }
            processarFilaSync();
        });
        
        window.addEventListener('offline', () => {
            console.log('📡 Conexão perdida - modo offline');
            isOnline = false;
        });

        // Salvar antes de fechar
        window.addEventListener('beforeunload', () => {
            salvarDadosLocalmente();
        });

        console.log('✅ Sync System inicializado - Versão:', appData._metadata.version);
    }

    // ============ CARREGAMENTO DE DADOS ============
    function carregarDoLocalStorage() {
        try {
            const dataStr = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (dataStr) {
                const data = JSON.parse(dataStr);
                if (data && data._metadata) {
                    console.log('📦 Dados locais carregados - Versão:', data._metadata.version || 0);
                    return data;
                }
            }
        } catch (e) {
            console.error('❌ Erro ao carregar LocalStorage:', e);
        }
        return null;
    }

    async function carregarDoFirebase() {
        const data = criarDadosVazios();
        
        if (!db) return data;
        
        try {
            // Carregar metadados
            const metaDoc = await db.collection('_metadata').doc('appData').get();
            if (metaDoc.exists) {
                data._metadata = metaDoc.data();
            }
            
            // Carregar motoristas
            const motoristasSnap = await db.collection('motoristas')
                .where('ativo', '==', true)
                .get();
            motoristasSnap.forEach(doc => {
                data.motoristas.push({ firebaseId: doc.id, ...doc.data() });
            });
            console.log(`👥 ${data.motoristas.length} motoristas carregados`);
            
            // Carregar pontos
            const pontosSnap = await db.collection('pontos')
                .limit(1000)
                .get();
            pontosSnap.forEach(doc => {
                const pontoData = doc.data();
                delete pontoData._modifiedAt;
                data.ponto[doc.id] = pontoData;
            });
            console.log(`📅 ${pontosSnap.size} registros de ponto carregados`);
            
            // Carregar pagamentos
            const pagSnap = await db.collection('pagamentos')
                .orderBy('data', 'desc')
                .limit(500)
                .get();
            pagSnap.forEach(doc => {
                data.pagamentos.push({ firebaseId: doc.id, ...doc.data() });
            });
            console.log(`💰 ${data.pagamentos.length} pagamentos carregados`);
            
            // Carregar registros KM
            const kmSnap = await db.collection('registrosKM')
                .orderBy('data', 'desc')
                .limit(500)
                .get();
            kmSnap.forEach(doc => {
                data.registrosKM.push({ firebaseId: doc.id, ...doc.data() });
            });
            console.log(`🚛 ${data.registrosKM.length} registros KM carregados`);
            
            return data;
            
        } catch (error) {
            console.error('❌ Erro ao carregar Firebase:', error);
            throw error;
        }
    }

    async function carregarDadosIniciais() {
        console.log('📥 Carregando dados...');
        
        garantirAppData();
        
        // 1. Carregar versão local
        const localData = carregarDoLocalStorage();
        const localVersion = localData?._metadata?.version || 0;
        
        // 2. Tentar carregar do Firebase
        if (db && isOnline) {
            try {
                const firebaseData = await carregarDoFirebase();
                const firebaseVersion = firebaseData?._metadata?.version || 0;
                
                console.log(`📊 Versão Local: ${localVersion} | Firebase: ${firebaseVersion}`);
                
                if (firebaseVersion > localVersion) {
                    console.log('☁️ Firebase mais recente - usando dados da nuvem');
                    appData = firebaseData;
                    dataVersion = firebaseVersion;
                    salvarDadosLocalmente();
                } else if (localVersion > firebaseVersion) {
                    console.log('💾 Local mais recente - enviando para nuvem');
                    appData = localData;
                    dataVersion = localVersion;
                    await salvarNoFirebase();
                } else if (firebaseVersion === localVersion && firebaseVersion > 0) {
                    console.log('✅ Versões sincronizadas');
                    appData = localData;
                    dataVersion = localVersion;
                } else {
                    console.log('🆕 Dados novos - inicializando');
                    appData = localData || criarDadosVazios();
                    dataVersion = appData._metadata.version || 0;
                }
                
                isOnline = true;
                
            } catch (error) {
                console.error('❌ Erro ao carregar Firebase:', error);
                usarDadosLocais(localData, 'Erro de conexão');
            }
        } else {
            usarDadosLocais(localData, 'Firebase offline');
        }
        
        // Garantir que appData existe
        garantirAppData();
        
        // Criar backup automático
        criarBackupAutomatico();
        
        console.log('✅ Dados carregados - Versão:', appData._metadata.version || 0);
        return appData;
    }

    function usarDadosLocais(localData, motivo) {
        console.log(`💾 Usando dados locais (${motivo})`);
        if (localData && localData._metadata) {
            appData = localData;
            dataVersion = localData._metadata.version || 0;
        } else {
            appData = criarDadosVazios();
            dataVersion = 0;
        }
        isOnline = false;
    }

    // ============ SALVAR DADOS ============
    function salvarDadosLocalmente() {
        try {
            garantirAppData();
            
            // Atualizar metadados
            appData._metadata.version = (appData._metadata.version || 0) + 1;
            appData._metadata.lastModified = new Date().toISOString();
            
            // Salvar no localStorage
            const dataStr = JSON.stringify(appData);
            localStorage.setItem(CONFIG.STORAGE_KEY, dataStr);
            
            // Atualizar versão
            dataVersion = appData._metadata.version;
            
            return true;
        } catch (e) {
            console.error('❌ Erro ao salvar LocalStorage:', e);
            
            if (e.name === 'QuotaExceededError') {
                console.warn('⚠️ Armazenamento cheio - limpando backups antigos');
                limparBackupsAntigos(2);
                try {
                    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(appData));
                    return true;
                } catch (e2) {
                    console.error('❌ Falha ao salvar mesmo após limpeza');
                    return false;
                }
            }
            return false;
        }
    }

    async function salvarNoFirebase() {
        if (!db || !isOnline) {
            console.warn('⚠️ Firebase offline - adicionando à fila de sync');
            adicionarAFilaSync();
            return false;
        }

        garantirAppData();

        try {
            const batch = db.batch();
            
            // Salvar metadados
            const metaRef = db.collection('_metadata').doc('appData');
            batch.set(metaRef, appData._metadata, { merge: true });
            
            // Salvar motoristas
            for (const motorista of appData.motoristas) {
                if (!motorista.ativo) continue;
                const motoristaClean = { ...motorista };
                delete motoristaClean.firebaseId;
                motoristaClean._modifiedAt = firebase.firestore.FieldValue.serverTimestamp();
                
                if (motorista.firebaseId) {
                    batch.set(db.collection('motoristas').doc(motorista.firebaseId), motoristaClean, { merge: true });
                } else {
                    const newRef = db.collection('motoristas').doc();
                    batch.set(newRef, motoristaClean);
                    motorista.firebaseId = newRef.id;
                }
            }
            
            // Salvar pontos (em lotes para não estourar o batch)
            const pontoKeys = Object.keys(appData.ponto || {});
            let count = 0;
            
            for (const key of pontoKeys) {
                if (count >= 400) {
                    await batch.commit();
                    count = 0;
                }
                
                const pontoData = { ...appData.ponto[key] };
                pontoData._modifiedAt = firebase.firestore.FieldValue.serverTimestamp();
                batch.set(db.collection('pontos').doc(key), pontoData, { merge: true });
                count++;
            }
            
            // Salvar pagamentos
            for (const pag of (appData.pagamentos || [])) {
                if (count >= 400) {
                    await batch.commit();
                    count = 0;
                }
                
                const pagClean = { ...pag };
                delete pagClean.firebaseId;
                pagClean._modifiedAt = firebase.firestore.FieldValue.serverTimestamp();
                
                if (pag.firebaseId) {
                    batch.set(db.collection('pagamentos').doc(pag.firebaseId), pagClean, { merge: true });
                } else {
                    const newRef = db.collection('pagamentos').doc();
                    batch.set(newRef, pagClean);
                    pag.firebaseId = newRef.id;
                }
                count++;
            }
            
            // Salvar registros KM
            for (const km of (appData.registrosKM || [])) {
                if (count >= 400) {
                    await batch.commit();
                    count = 0;
                }
                
                const kmClean = { ...km };
                delete kmClean.firebaseId;
                kmClean._modifiedAt = firebase.firestore.FieldValue.serverTimestamp();
                
                const docId = km.firebaseId || km.id;
                if (docId) {
                    batch.set(db.collection('registrosKM').doc(docId), kmClean, { merge: true });
                } else {
                    const newRef = db.collection('registrosKM').doc();
                    batch.set(newRef, kmClean);
                    km.id = newRef.id;
                }
                count++;
            }
            
            // Commit final
            await batch.commit();
            
            // Atualizar timestamp de sync
            appData._metadata.lastSync = new Date().toISOString();
            salvarDadosLocalmente();
            
            console.log('☁️ Dados salvos no Firebase');
            return true;
            
        } catch (error) {
            console.error('❌ Erro ao salvar no Firebase:', error);
            adicionarAFilaSync();
            return false;
        }
    }

    // ============ FILA DE SINCRONIZAÇÃO ============
    function carregarFilaSync() {
        try {
            const queueStr = localStorage.getItem(CONFIG.SYNC_QUEUE_KEY);
            if (queueStr) {
                syncQueue = JSON.parse(queueStr);
                console.log(`📋 Fila de sync: ${syncQueue.length} operações pendentes`);
            }
        } catch (e) {
            syncQueue = [];
        }
    }

    function adicionarAFilaSync() {
        garantirAppData();
        
        const operacao = {
            timestamp: new Date().toISOString(),
            tentativas: 0,
            dados: JSON.parse(JSON.stringify(appData))
        };
        
        syncQueue.push(operacao);
        localStorage.setItem(CONFIG.SYNC_QUEUE_KEY, JSON.stringify(syncQueue));
        console.log('📋 Adicionado à fila de sync -', syncQueue.length, 'pendentes');
    }

    async function processarFilaSync() {
        if (!isOnline || !db || syncQueue.length === 0) return;
        
        console.log('🔄 Processando fila de sync...');
        isSyncing = true;
        
        for (let i = syncQueue.length - 1; i >= 0; i--) {
            const op = syncQueue[i];
            
            if (op.tentativas > 10) {
                console.warn('⚠️ Operação descartada após 10 tentativas:', op.timestamp);
                syncQueue.splice(i, 1);
                continue;
            }
            
            try {
                op.tentativas++;
                const tempData = appData;
                appData = op.dados;
                const success = await salvarNoFirebase();
                
                if (success) {
                    syncQueue.splice(i, 1);
                    console.log('✅ Operação sincronizada:', op.timestamp);
                } else {
                    appData = tempData;
                    console.warn('⚠️ Falha na tentativa', op.tentativas);
                }
            } catch (error) {
                console.error('❌ Erro ao processar fila:', error);
                op.tentativas++;
            }
        }
        
        localStorage.setItem(CONFIG.SYNC_QUEUE_KEY, JSON.stringify(syncQueue));
        isSyncing = false;
    }

    // ============ BACKUP AUTOMÁTICO ============
    function criarBackupAutomatico() {
        try {
            const hoje = new Date().toISOString().split('T')[0];
            const backupKey = CONFIG.BACKUP_KEY + hoje;
            
            if (!localStorage.getItem(backupKey) && appData) {
                localStorage.setItem(backupKey, JSON.stringify(appData));
                console.log('📦 Backup diário criado:', hoje);
                limparBackupsAntigos(CONFIG.MAX_BACKUPS);
            }
        } catch (e) {
            console.warn('⚠️ Erro ao criar backup:', e);
        }
    }

    function limparBackupsAntigos(manter = 5) {
        const backups = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(CONFIG.BACKUP_KEY)) {
                backups.push(key);
            }
        }
        
        backups.sort().reverse();
        
        for (let i = manter; i < backups.length; i++) {
            localStorage.removeItem(backups[i]);
        }
    }

    // ============ SINCRONIZAÇÃO PERIÓDICA ============
    async function sincronizarPeriodicamente() {
        if (!isOnline || !db || isSyncing) return;
        
        try {
            // Verificar se há alterações no Firebase
            const metaDoc = await db.collection('_metadata').doc('appData').get();
            if (metaDoc.exists) {
                const firebaseVersion = metaDoc.data().version || 0;
                
                if (firebaseVersion > dataVersion) {
                    console.log('🔄 Versão mais recente no Firebase - recarregando');
                    const firebaseData = await carregarDoFirebase();
                    appData = firebaseData;
                    dataVersion = firebaseData._metadata.version || 0;
                    salvarDadosLocalmente();
                    
                    window.dispatchEvent(new CustomEvent('dataUpdated', { detail: appData }));
                }
            }
            
            if (syncQueue.length > 0) {
                await processarFilaSync();
            }
            
        } catch (error) {
            console.warn('⚠️ Erro na sincronização periódica:', error.message);
        }
    }

    // ============ API PÚBLICA ============
    window.SyncSystem = {
        getData: function() {
            garantirAppData();
            return JSON.parse(JSON.stringify(appData));
        },
        
        updateData: async function(newData, quemModificou = 'usuario') {
            garantirAppData();
            
            appData = {
                ...appData,
                ...newData,
                _metadata: {
                    ...appData._metadata,
                    version: (appData._metadata.version || 0) + 1,
                    lastModified: new Date().toISOString(),
                    modifiedBy: quemModificou
                }
            };
            
            dataVersion = appData._metadata.version;
            salvarDadosLocalmente();
            
            if (isOnline && db) {
                await salvarNoFirebase();
            } else {
                adicionarAFilaSync();
            }
            
            criarBackupAutomatico();
            return true;
        },
        
        forceSync: async function() {
            await processarFilaSync();
        },
        
        getStatus: function() {
            garantirAppData();
            return {
                online: isOnline,
                syncing: isSyncing,
                version: dataVersion,
                queueSize: syncQueue.length,
                lastSync: appData._metadata.lastSync || null,
                lastModified: appData._metadata.lastModified || null
            };
        },
        
        createBackup: function() {
            garantirAppData();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupKey = CONFIG.BACKUP_KEY + 'manual_' + timestamp;
            localStorage.setItem(backupKey, JSON.stringify(appData));
            console.log('📦 Backup manual criado:', backupKey);
            return backupKey;
        },
        
        restoreBackup: function(backupKey) {
            const dataStr = localStorage.getItem(backupKey);
            if (dataStr) {
                try {
                    appData = JSON.parse(dataStr);
                    dataVersion = appData._metadata.version || 0;
                    salvarDadosLocalmente();
                    console.log('🔄 Backup restaurado:', backupKey);
                    return true;
                } catch (e) {
                    console.error('❌ Erro ao restaurar backup:', e);
                    return false;
                }
            }
            return false;
        },
        
        listBackups: function() {
            const backups = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(CONFIG.BACKUP_KEY)) {
                    try {
                        const data = JSON.parse(localStorage.getItem(key));
                        backups.push({
                            key: key,
                            date: key.replace(CONFIG.BACKUP_KEY, ''),
                            version: data?._metadata?.version || 0,
                            modifiedBy: data?._metadata?.modifiedBy || 'desconhecido'
                        });
                    } catch (e) {
                        // Ignorar backups corrompidos
                    }
                }
            }
            return backups.sort((a, b) => b.date.localeCompare(a.date));
        },
        
        exportData: function() {
            garantirAppData();
            const blob = new Blob([JSON.stringify(appData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_motoristas_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        },
        
        importData: async function(jsonData) {
            try {
                const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
                await this.updateData(data, 'importacao');
                return true;
            } catch (e) {
                console.error('Erro ao importar:', e);
                return false;
            }
        }
    };

    // ============ INICIAR ============
    init();

})();
