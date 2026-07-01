// firebase-sync.js
// Sistema de Sincronização Segura Firebase ↔ LocalStorage
// Versão 2.0 - Com controle de versão e backup

(function() {
    'use strict';

    // ============ CONFIGURAÇÃO ============
    const CONFIG = {
        STORAGE_KEY: 'controleMotoristas_systemmil_v2',
        BACKUP_KEY: 'controleMotoristas_backup_',
        SYNC_QUEUE_KEY: 'controleMotoristas_sync_queue',
        VERSION_KEY: 'controleMotoristas_data_version',
        MAX_BACKUPS: 5,
        SYNC_INTERVAL: 30000, // 30 segundos
        RETRY_DELAY: 5000,    // 5 segundos entre tentativas
    };

    // ============ ESTADO DO SISTEMA ============
    let db = window.firebaseDB || null;
    let isOnline = false;
    let isSyncing = false;
    let dataVersion = 0;
    let syncQueue = [];
    let appData = {
        motoristas: [],
        ponto: {},
        pagamentos: [],
        registrosKM: [],
        _metadata: {
            version: 0,
            lastSync: null,
            lastModified: null,
            modifiedBy: 'sistema'
        }
    };

    // ============ INICIALIZAÇÃO ============
    function init() {
        console.log('🚀 Inicializando Sync System v2.0');
        
        // Verificar Firebase
        if (!db && typeof firebase !== 'undefined') {
            db = firebase.firestore();
            window.firebaseDB = db;
        }

        // Configurar persistência offline
        if (db) {
            db.enablePersistence({ synchronizeTabs: true })
                .then(() => console.log('✅ Persistência offline ativada'))
                .catch((err) => {
                    if (err.code === 'failed-precondition') {
                        console.warn('⚠️ Múltiplas abas abertas - persistência limitada');
                    } else if (err.code === 'unimplemented') {
                        console.warn('⚠️ Navegador não suporta persistência offline');
                    }
                });

            // Monitorar conexão
            db.enableNetwork()
                .then(() => {
                    isOnline = true;
                    console.log('✅ Firebase conectado');
                    processarFilaSync();
                })
                .catch(() => {
                    isOnline = false;
                    console.warn('⚠️ Firebase offline - usando cache local');
                });
        }

        // Carregar dados
        carregarDadosIniciais();
        
        // Carregar fila de sincronização
        carregarFilaSync();
        
        // Configurar sincronização periódica
        setInterval(sincronizarPeriodicamente, CONFIG.SYNC_INTERVAL);
        
        // Monitorar online/offline
        window.addEventListener('online', () => {
            console.log('🌐 Conexão restaurada');
            isOnline = true;
            if (db) db.enableNetwork();
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

        console.log('✅ Sync System inicializado');
    }

    // ============ CARREGAMENTO DE DADOS ============
    async function carregarDadosIniciais() {
        console.log('📥 Carregando dados...');
        
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
                    // Firebase tem dados mais recentes
                    console.log('☁️ Firebase mais recente - usando dados da nuvem');
                    appData = firebaseData;
                    salvarDadosLocalmente();
                } else if (localVersion > firebaseVersion) {
                    // Local tem dados mais recentes
                    console.log('💾 Local mais recente - enviando para nuvem');
                    appData = localData;
                    await salvarNoFirebase();
                } else if (firebaseVersion === localVersion && firebaseVersion > 0) {
                    // Versões iguais - usar local (mais rápido)
                    console.log('✅ Versões sincronizadas');
                    appData = localData;
                } else {
                    // Ambos vazios - inicializar
                    console.log('🆕 Dados novos - inicializando');
                    appData = localData || criarDadosVazios();
                }
                
                dataVersion = appData._metadata.version;
                isOnline = true;
                
            } catch (error) {
                console.error('❌ Erro ao carregar Firebase:', error);
                usarDadosLocais(localData, 'Erro de conexão');
            }
        } else {
            usarDadosLocais(localData, 'Firebase offline');
        }
        
        // Criar backup automático
        criarBackupAutomatico();
        
        console.log('✅ Dados carregados - Versão:', appData._metadata.version);
        return appData;
    }

    function usarDadosLocais(localData, motivo) {
        console.log(`💾 Usando dados locais (${motivo})`);
        appData = localData || criarDadosVazios();
        isOnline = false;
    }

    function criarDadosVazios() {
        return {
            motoristas: [],
            ponto: {},
            pagamentos: [],
            registrosKM: [],
            _metadata: {
                version: 1,
                lastSync: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                modifiedBy: 'sistema'
            }
        };
    }

    // ============ CARREGAR DO LOCALSTORAGE ============
    function carregarDoLocalStorage() {
        try {
            const dataStr = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (dataStr) {
                const data = JSON.parse(dataStr);
                console.log('📦 Dados locais carregados - Versão:', data?._metadata?.version || 0);
                return data;
            }
        } catch (e) {
            console.error('❌ Erro ao carregar LocalStorage:', e);
        }
        return null;
    }

    // ============ CARREGAR DO FIREBASE ============
    async function carregarDoFirebase() {
        const data = criarDadosVazios();
        
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
            
            // Carregar pontos (apenas os modificados recentemente)
            const pontosSnap = await db.collection('pontos')
                .orderBy('_modifiedAt', 'desc')
                .limit(1000)
                .get();
            pontosSnap.forEach(doc => {
                const pontoData = doc.data();
                delete pontoData._modifiedAt; // Limpar campo interno
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

    // ============ SALVAR DADOS ============
    function salvarDadosLocalmente() {
        try {
            // Atualizar metadados
            appData._metadata.version = (appData._metadata.version || 0) + 1;
            appData._metadata.lastModified = new Date().toISOString();
            
            // Salvar no localStorage
            const dataStr = JSON.stringify(appData);
            localStorage.setItem(CONFIG.STORAGE_KEY, dataStr);
            
            // Atualizar versão
            dataVersion = appData._metadata.version;
            
            console.log('💾 Dados salvos localmente - Versão:', appData._metadata.version);
            return true;
        } catch (e) {
            console.error('❌ Erro ao salvar LocalStorage:', e);
            
            // Se o localStorage estiver cheio, tentar limpar backups antigos
            if (e.name === 'QuotaExceededError') {
                console.warn('⚠️ Armazenamento cheio - limpando backups antigos');
                limparBackupsAntigos(2); // Manter apenas 2 backups
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

        try {
            const batch = db.batch();
            let totalDocs = 0;
            
            // Salvar metadados
            const metaRef = db.collection('_metadata').doc('appData');
            batch.set(metaRef, appData._metadata, { merge: true });
            totalDocs++;
            
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
                totalDocs++;
            }
            
            // Salvar pontos (em lotes para não estourar o batch)
            const pontoKeys = Object.keys(appData.ponto);
            for (let i = 0; i < pontoKeys.length; i++) {
                if (totalDocs >= 400) { // Limite do batch é 500
                    await batch.commit();
                    totalDocs = 0;
                }
                
                const key = pontoKeys[i];
                const pontoData = { ...appData.ponto[key] };
                pontoData._modifiedAt = firebase.firestore.FieldValue.serverTimestamp();
                batch.set(db.collection('pontos').doc(key), pontoData, { merge: true });
                totalDocs++;
            }
            
            // Salvar pagamentos
            for (const pag of appData.pagamentos) {
                if (totalDocs >= 400) {
                    await batch.commit();
                    totalDocs = 0;
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
                totalDocs++;
            }
            
            // Salvar registros KM
            for (const km of appData.registrosKM) {
                if (totalDocs >= 400) {
                    await batch.commit();
                    totalDocs = 0;
                }
                
                const kmClean = { ...km };
                delete kmClean.firebaseId;
                kmClean._modifiedAt = firebase.firestore.FieldValue.serverTimestamp();
                
                if (km.firebaseId) {
                    batch.set(db.collection('registrosKM').doc(km.firebaseId), kmClean, { merge: true });
                } else if (km.id) {
                    batch.set(db.collection('registrosKM').doc(km.id), kmClean, { merge: true });
                } else {
                    const newRef = db.collection('registrosKM').doc();
                    batch.set(newRef, kmClean);
                    km.id = newRef.id;
                }
                totalDocs++;
            }
            
            // Commit final
            await batch.commit();
            
            // Atualizar timestamp de sync
            appData._metadata.lastSync = new Date().toISOString();
            salvarDadosLocalmente();
            
            console.log('☁️ Dados salvos no Firebase -', totalDocs, 'documentos');
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
                appData = op.dados;
                const success = await salvarNoFirebase();
                
                if (success) {
                    syncQueue.splice(i, 1);
                    console.log('✅ Operação sincronizada:', op.timestamp);
                } else {
                    console.warn('⚠️ Falha na tentativa', op.tentativas);
                }
            } catch (error) {
                console.error('❌ Erro ao processar fila:', error);
                op.tentativas++;
            }
        }
        
        localStorage.setItem(CONFIG.SYNC_QUEUE_KEY, JSON.stringify(syncQueue));
        isSyncing = false;
        console.log('✅ Fila processada -', syncQueue.length, 'restantes');
    }

    // ============ BACKUP AUTOMÁTICO ============
    function criarBackupAutomatico() {
        try {
            const hoje = new Date().toISOString().split('T')[0];
            const backupKey = CONFIG.BACKUP_KEY + hoje;
            
            // Verificar se já existe backup de hoje
            if (!localStorage.getItem(backupKey)) {
                const dataStr = JSON.stringify(appData);
                localStorage.setItem(backupKey, dataStr);
                console.log('📦 Backup diário criado:', hoje);
                
                // Limpar backups antigos
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
            if (key.startsWith(CONFIG.BACKUP_KEY)) {
                backups.push(key);
            }
        }
        
        // Ordenar por data (mais recentes primeiro)
        backups.sort().reverse();
        
        // Remover backups excedentes
        for (let i = manter; i < backups.length; i++) {
            localStorage.removeItem(backups[i]);
            console.log('🗑️ Backup removido:', backups[i]);
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
                    dataVersion = firebaseData._metadata.version;
                    salvarDadosLocalmente();
                    
                    // Notificar app sobre atualização
                    window.dispatchEvent(new CustomEvent('dataUpdated', { detail: appData }));
                }
            }
            
            // Processar fila pendente
            if (syncQueue.length > 0) {
                await processarFilaSync();
            }
            
        } catch (error) {
            console.warn('⚠️ Erro na sincronização periódica:', error.message);
        }
    }

    // ============ API PÚBLICA ============
    window.SyncSystem = {
        // Obter dados atuais
        getData: function() {
            return JSON.parse(JSON.stringify(appData));
        },
        
        // Atualizar dados
        updateData: async function(newData, quemModificou = 'usuario') {
            // Mesclar dados
            appData = {
                ...appData,
                ...newData,
                _metadata: {
                    ...appData._metadata,
                    lastModified: new Date().toISOString(),
                    modifiedBy: quemModificou
                }
            };
            
            // Salvar localmente primeiro (sempre)
            salvarDadosLocalmente();
            
            // Tentar salvar no Firebase
            if (isOnline && db) {
                await salvarNoFirebase();
            } else {
                adicionarAFilaSync();
            }
            
            // Criar backup se necessário
            criarBackupAutomatico();
            
            return true;
        },
        
        // Forçar sincronização
        forceSync: async function() {
            await processarFilaSync();
        },
        
        // Verificar status
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
        
        // Criar backup manual
        createBackup: function() {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupKey = CONFIG.BACKUP_KEY + 'manual_' + timestamp;
            localStorage.setItem(backupKey, JSON.stringify(appData));
            console.log('📦 Backup manual criado:', backupKey);
            return backupKey;
        },
        
        // Restaurar backup
        restoreBackup: function(backupKey) {
            const dataStr = localStorage.getItem(backupKey);
            if (dataStr) {
                appData = JSON.parse(dataStr);
                salvarDadosLocalmente();
                console.log('🔄 Backup restaurado:', backupKey);
                return true;
            }
            return false;
        },
        
        // Listar backups
        listBackups: function() {
            const backups = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith(CONFIG.BACKUP_KEY)) {
                    const data = JSON.parse(localStorage.getItem(key));
                    backups.push({
                        key: key,
                        date: key.replace(CONFIG.BACKUP_KEY, ''),
                        version: data._metadata?.version || 0,
                        modifiedBy: data._metadata?.modifiedBy || 'desconhecido'
                    });
                }
            }
            return backups.sort((a, b) => b.date.localeCompare(a.date));
        },
        
        // Exportar dados
        exportData: function() {
            const blob = new Blob([JSON.stringify(appData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_motoristas_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        },
        
        // Importar dados
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
