// firebase-sync.js - v3.2 (corrigido)
(function() {
    'use strict';

    const CONFIG = {
        STORAGE_KEY: 'controleMotoristas_systemmil_v2',
        BACKUP_KEY: 'controleMotoristas_backup_',
        SYNC_QUEUE_KEY: 'controleMotoristas_sync_queue',
        MAX_BACKUPS: 5,
        SYNC_INTERVAL: 30000,
        MAX_LOCAL_STORAGE_MB: 2
    };

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

    const CAMPOS_PESADOS = ['anexo', 'pdfGerado', 'base64', 'fileData', 'arquivo', 'imagem'];

    let db = null;
    let isOnline = false;
    let isSyncing = false;
    let dataVersion = 0;
    let syncQueue = [];
    let appData = criarDadosVazios();

    // ---------- auxiliares ----------
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

    function removerCamposPesados(item) {
        const clean = { ...item };
        CAMPOS_PESADOS.forEach(campo => delete clean[campo]);
        return clean;
    }

    function safeSetItem(key, data) {
        try {
            const dataStr = JSON.stringify(data);
            const sizeMB = new Blob([dataStr]).size / (1024 * 1024);
            if (sizeMB > CONFIG.MAX_LOCAL_STORAGE_MB) {
                console.warn(`⚠️ ${key}: ${sizeMB.toFixed(1)}MB - removendo campos pesados...`);
                const dataLimpa = Array.isArray(data) ? data.map(removerCamposPesados) : removerCamposPesados(data);
                const newSize = new Blob([JSON.stringify(dataLimpa)]).size / (1024 * 1024);
                try {
                    localStorage.setItem(key, JSON.stringify(dataLimpa));
                    return { success: true, reduced: true, size: newSize };
                } catch(e) {
                    console.warn(`⚠️ ${key}: ainda muito grande (${newSize.toFixed(1)}MB) - pulando localStorage`);
                    return { success: false, reduced: true };
                }
            }
            localStorage.setItem(key, dataStr);
            return { success: true, reduced: false, size: sizeMB };
        } catch(e) {
            console.warn(`❌ ${key}: erro ao salvar - ${e.message}`);
            return { success: false };
        }
    }

    // ---------- inicialização ----------
    function init() {
        console.log('🚀 Inicializando Sync System v3.2');

        if (typeof firebase !== 'undefined' && firebase.firestore) {
            if (!firebase.apps.length) {
                console.warn('⏳ Firebase não inicializado - aguardando...');
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

        if (db) {
            // persistência offline
            try {
                db.enablePersistence({ cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED })
                    .then(() => console.log('✅ Persistência offline ativada'))
                    .catch((err) => {
                        if (err.code === 'failed-precondition') {
                            console.warn('⚠️ Múltiplas abas abertas');
                        }
                    });
            } catch(e) {
                console.warn('⚠️ Erro persistência:', e.message);
            }

            db.enableNetwork()
                .then(() => {
                    isOnline = true;
                    console.log('✅ Firebase online');
                    processarFilaSync();
                    sincronizarTodosModulos();
                })
                .catch(() => {
                    isOnline = false;
                    console.warn('⚠️ Firebase offline');
                });

            carregarDadosLocais();
            carregarFilaSync();

            if (db && isOnline) {
                sincronizarComFirebase();
            }

            setInterval(sincronizarPeriodicamente, CONFIG.SYNC_INTERVAL);

            window.addEventListener('online', () => {
                console.log('✅ Conexão restaurada');
                isOnline = true;
                if (db) db.enableNetwork().catch(() => {});
                processarFilaSync();
                sincronizarTodosModulos();
            });

            window.addEventListener('offline', () => {
                console.log('📴 Conexão perdida - modo offline');
                isOnline = false;
            });

            window.addEventListener('beforeunload', () => {
                salvarLocalStorage();
            });

            console.log('✅ Sync System v3.2 inicializado');
        }
    }

    // ---------- dados locais ----------
    function carregarDadosLocais() {
        try {
            const dataStr = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (dataStr) {
                const data = JSON.parse(dataStr);
                if (data && data._metadata) {
                    appData = data;
                    dataVersion = data._metadata.version || 0;
                    console.log('📂 Dados locais carregados - Versão:', dataVersion);
                    return;
                }
            }
        } catch (e) {
            console.error('❌ Erro ao carregar localStorage:', e);
        }
        appData = criarDadosVazios();
        dataVersion = 0;
    }

    function salvarLocalStorage() {
        try {
            appData._metadata.version = (appData._metadata.version || 0) + 1;
            appData._metadata.lastModified = new Date().toISOString();
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(appData));
            dataVersion = appData._metadata.version;
            return true;
        } catch (e) {
            console.error('❌ Erro ao salvar localStorage:', e);
            return false;
        }
    }

    // ---------- sincronização principal ----------
    async function sincronizarComFirebase() {
        if (!db || !isOnline) return;
        try {
            const metaDoc = await db.collection('_metadata').doc('appData').get();
            const firebaseVersion = metaDoc.exists ? (metaDoc.data().version || 0) : 0;

            if (firebaseVersion > dataVersion) {
                console.log('📥 Firebase mais recente - baixando...');
                await baixarDadosFirebase();
            } else if (dataVersion > firebaseVersion) {
                console.log('📤 Local mais recente - enviando...');
                await salvarNoFirebase();
            } else {
                console.log('✅ Dados já sincronizados');
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
            const metaDoc = await db.collection('_metadata').doc('appData').get();
            if (metaDoc.exists) newData._metadata = metaDoc.data();

            const motoristasSnap = await db.collection('motoristas').where('ativo', '==', true).get();
            motoristasSnap.forEach(doc => {
                newData.motoristas.push({ firebaseId: doc.id, ...doc.data() });
            });

            const pontosSnap = await db.collection('pontos').limit(1000).get();
            pontosSnap.forEach(doc => {
                const data = doc.data();
                delete data._modifiedAt;
                newData.ponto[doc.id] = data;
            });

            const pagSnap = await db.collection('pagamentos').orderBy('data', 'desc').limit(500).get();
            pagSnap.forEach(doc => {
                newData.pagamentos.push({ firebaseId: doc.id, ...doc.data() });
            });

            const kmSnap = await db.collection('registrosKM').orderBy('data', 'desc').limit(500).get();
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

    async function salvarNoFirebase() {
        if (!db || !isOnline) {
            adicionarFilaSync();
            return false;
        }
        try {
            const batch = db.batch();
            batch.set(db.collection('_metadata').doc('appData'), appData._metadata, { merge: true });

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

            for (const key of Object.keys(appData.ponto || {})) {
                const data = { ...appData.ponto[key] };
                data._modifiedAt = firebase.firestore.FieldValue.serverTimestamp();
                batch.set(db.collection('pontos').doc(key), data, { merge: true });
            }

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
            console.log('✅ Dados de Motoristas salvos no Firebase');
            return true;
        } catch (error) {
            console.error('❌ Erro ao salvar Firebase:', error);
            adicionarFilaSync();
            return false;
        }
    }

    // ---------- fila de sincronização ----------
    function carregarFilaSync() {
        try {
            const str = localStorage.getItem(CONFIG.SYNC_QUEUE_KEY);
            syncQueue = str ? JSON.parse(str) : [];
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
        if (syncQueue.length > 20) syncQueue.shift();
        safeSetItem(CONFIG.SYNC_QUEUE_KEY, syncQueue);
    }

    async function processarFilaSync() {
        if (!isOnline || !db || syncQueue.length === 0) return;
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
                if (await salvarNoFirebase()) {
                    syncQueue.splice(i, 1);
                } else {
                    appData = backup;
                }
            } catch (e) {
                appData = backup;
            }
        }
        safeSetItem(CONFIG.SYNC_QUEUE_KEY, syncQueue);
        isSyncing = false;
    }

    // ---------- backups ----------
    function criarBackupAutomatico() {
        try {
            const hoje = new Date().toISOString().split('T')[0];
            const key = CONFIG.BACKUP_KEY + hoje;
            if (!localStorage.getItem(key)) {
                localStorage.setItem(key, JSON.stringify(appData));
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
        } catch(e) {}
    }

    // ---------- sincronização periódica ----------
    async function sincronizarPeriodicamente() {
        if (!isOnline || !db || isSyncing) return;
        try {
            const metaDoc = await db.collection('_metadata').doc('appData').get();
            if (metaDoc.exists && (metaDoc.data().version || 0) > dataVersion) {
                await baixarDadosFirebase();
                window.dispatchEvent(new CustomEvent('dataUpdated', { detail: appData }));
            }
            if (syncQueue.length > 0) await processarFilaSync();
        } catch(e) {}
    }

    // ---------- módulos (multi) ----------
    async function sincronizarTodosModulos() {
        if (!db || !isOnline) return;
        console.log('🔄 Sincronizando todos os módulos...');
        for (const [localKey, collection] of Object.entries(MODULE_MAPPINGS)) {
            try {
                const snapshot = await db.collection(collection).limit(1).get();
                if (!snapshot.empty) {
                    // Firebase tem dados → baixar
                    const fullSnapshot = await db.collection(collection).get();
                    const data = [];
                    fullSnapshot.forEach(doc => {
                        const item = doc.data();
                        delete item._modifiedAt;
                        delete item._createdAt;
                        data.push({ id: doc.id, ...item });
                    });
                    if (data.length > 0) {
                        const result = safeSetItem(localKey, data);
                        if (result.success && !result.reduced) {
                            console.log(`📥 ${collection}: ${data.length} itens (${result.size.toFixed(1)}MB)`);
                        } else if (result.success && result.reduced) {
                            console.log(`📥 ${collection}: ${data.length} itens (${result.size.toFixed(1)}MB - sem anexos)`);
                        } else {
                            console.log(`📥 ${collection}: ${data.length} itens - apenas Firebase (muito grande)`);
                        }
                    }
                } else {
                    // Firebase vazio → enviar localStorage
                    const localData = localStorage.getItem(localKey);
                    if (localData) {
                        try {
                            const parsed = JSON.parse(localData);
                            const items = Array.isArray(parsed) ? parsed : [parsed];
                            if (items.length > 0) {
                                await saveModuleData(collection, items);
                                console.log(`📤 ${collection}: ${items.length} itens enviados`);
                            }
                        } catch(e) {
                            console.log(`⚠️ ${collection}: erro ao ler localStorage`);
                        }
                    }
                }
            } catch (error) {
                console.log(`⚠️ ${collection}: ${error.message}`);
            }
        }
        console.log('✅ Sincronização de módulos concluída');
    }

    async function saveModuleData(collectionName, dataArray) {
        if (!db || !isOnline) return false;
        try {
            for (let i = 0; i < dataArray.length; i += 400) {
                const lote = dataArray.slice(i, i + 400);
                const batch = db.batch();
                for (const item of lote) {
                    if (!item || !item.id) continue;
                    const cleanData = { ...item };
                    delete cleanData.firebaseId;
                    cleanData._modifiedAt = firebase.firestore.FieldValue.serverTimestamp();
                    cleanData._syncedAt = new Date().toISOString();
                    batch.set(db.collection(collectionName).doc(String(item.id)), cleanData, { merge: true });
                }
                await batch.commit();
            }
            return true;
        } catch(error) {
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
        } catch(error) {
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
            return null;
        }
    }

    async function migrateAllToFirebase() {
        if (!db || !isOnline) {
            alert('Firebase não está conectado!');
            return;
        }
        console.log('🔄 Migrando localStorage → Firebase...');
        let total = 0;
        const resultados = [];
        for (const [localKey, collection] of Object.entries(MODULE_MAPPINGS)) {
            const localData = localStorage.getItem(localKey);
            if (localData) {
                try {
                    const items = JSON.parse(localData);
                    const arr = Array.isArray(items) ? items : [items];
                    if (arr.length > 0) {
                        await saveModuleData(collection, arr);
                        total += arr.length;
                        resultados.push(`✅ ${localKey}: ${arr.length} itens`);
                    }
                } catch (e) {
                    resultados.push(`❌ ${localKey}: erro`);
                }
            }
        }
        if (total > 0 && confirm(`${resultados.join('\n')}\n\nTotal: ${total} itens.\nLimpar localStorage?`)) {
            Object.keys(MODULE_MAPPINGS).forEach(k => localStorage.removeItem(k));
            location.reload();
        }
    }

    // ---------- API pública ----------
    window.SyncSystem = {
        getData: () => JSON.parse(JSON.stringify(appData)),
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
            if (isOnline && db) await salvarNoFirebase();
            else adicionarFilaSync();
            return true;
        },
        forceSync: async () => {
            await processarFilaSync();
            await sincronizarTodosModulos();
        },
        getStatus: () => ({
            online: isOnline,
            syncing: isSyncing,
            version: dataVersion,
            queueSize: syncQueue.length,
            lastSync: appData._metadata.lastSync,
            lastModified: appData._metadata.lastModified,
            firebaseConnected: !!db
        }),
        createBackup: function() {
            const ts = new Date().toISOString().replace(/[.:]/g, '-');
            const key = CONFIG.BACKUP_KEY + 'manual_' + ts;
            localStorage.setItem(key, JSON.stringify(appData));
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
                } catch (e) { return false; }
            }
            return false;
        },
        listBackups: () => {
            const backups = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith(CONFIG.BACKUP_KEY)) {
                    try {
                        backups.push({
                            key: k,
                            date: k.replace(CONFIG.BACKUP_KEY, ''),
                            version: JSON.parse(localStorage.getItem(k))?._metadata?.version || 0
                        });
                    } catch(e) {}
                }
            }
            return backups.sort((a, b) => b.date.localeCompare(a.date));
        },
        exportData: () => {
            const blob = new Blob([JSON.stringify(appData, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
        },
        importData: async (jsonData) => {
            try {
                return await this.updateData(typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData, 'importacao');
            } catch(e) { return false; }
        },
        saveModuleData,
        loadModuleData,
        deleteModuleItem,
        addModuleItem,
        migrateAllToFirebase,
        syncAllModules: sincronizarTodosModulos,
        salvarModulo: async (nomeModulo, dados) => {
            const collection = MODULE_MAPPINGS[nomeModulo] || nomeModulo;
            safeSetItem(nomeModulo, dados);
            if (isOnline && db) return await saveModuleData(collection, dados);
            return false;
        },
        carregarModulo: async (nomeModulo) => {
            const collection = MODULE_MAPPINGS[nomeModulo] || nomeModulo;
            if (isOnline && db) {
                try {
                    const data = await loadModuleData(collection);
                    if (data && data.length > 0) {
                        safeSetItem(nomeModulo, data);
                        return data;
                    }
                } catch(e) {}
            }
            const localData = localStorage.getItem(nomeModulo);
            return localData ? JSON.parse(localData) : [];
        }
    };

    // funções globais para console
    window.migrarTudoParaFirebase = () => window.SyncSystem.migrateAllToFirebase();
    window.syncAllModules = () => window.SyncSystem.syncAllModules();
    window.verStatusSync = () => {
        const s = window.SyncSystem.getStatus();
        console.log(`📊 Status: ${s.online ? '🟢 Online' : '🔴 Offline'} | Firebase: ${s.firebaseConnected ? '✅' : '❌'} | Versão: ${s.version} | Fila: ${s.queueSize}`);
        return s;
    };

    // ---------- iniciar ----------
    if (!appData) appData = criarDadosVazios();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
