// =============================================
// DATA-LOADER.JS - Versão 2.0 (100% Firebase)
// Carregamento Centralizado - Cloud Only
// =============================================

(function() {
    'use strict';

    console.log('🔄 Inicializando DataLoader 2.0 (Cloud Mode)...');

    // Mapeamento de módulos para coleções do Firebase
    const COLLECTION_MAP = {
        'veiculos': 'veiculos',
        'abastecimentos': 'abastecimentos',
        'documentos': 'documentos',
        'empresas': 'empresas',
        'empresas_docs': 'empresas',
        'produtos': 'produtos',
        'produtos_cotacao': 'produtos',
        'cotacoes': 'cotacoes',
        'fornecedores': 'fornecedores',
        'manutencoes': 'manutencoes',
        'manutencoesCorretivas': 'manutencoes',
        'tiposManutencao': 'tiposManutencao',
        'historico': 'historico',
        'historico_cotacao': 'historico',
        'alertasGlobalConfig': 'configuracoes'
    };

    /**
     * Obter referência do Firestore
     */
    function getDB() {
        return window.db || window.firebaseDB || null;
    }

    /**
     * Aguardar Firebase estar pronto
     */
    function aguardarFirebase() {
        return new Promise((resolve) => {
            const db = getDB();
            
            if (db) {
                resolve(db);
                return;
            }
            
            let tentativas = 0;
            const maxTentativas = 50;
            
            const check = setInterval(() => {
                tentativas++;
                const db = getDB();
                
                if (db) {
                    clearInterval(check);
                    console.log('✅ Firebase pronto para DataLoader');
                    resolve(db);
                    return;
                }
                
                if (tentativas >= maxTentativas) {
                    clearInterval(check);
                    console.error('❌ Firebase não disponível para DataLoader');
                    resolve(null);
                }
            }, 100);
        });
    }

    /**
     * Obter nome da coleção no Firebase
     */
    function getCollectionName(moduleName) {
        return COLLECTION_MAP[moduleName] || moduleName;
    }

    // ========== API PÚBLICA (100% FIREBASE) ==========
    window.DataLoader = {
        
        /**
         * Carregar TODOS os documentos de uma coleção
         * @param {string} moduleName - Nome do módulo/coleção
         * @returns {Array} - Array com todos os documentos
         */
        load: async function(moduleName) {
            const db = await aguardarFirebase();
            
            if (!db) {
                console.error('❌ Firebase não disponível para carregar:', moduleName);
                return [];
            }
            
            try {
                const collectionName = getCollectionName(moduleName);
                console.log(`🔄 DataLoader: Carregando [${collectionName}]...`);
                
                const snapshot = await db.collection(collectionName)
                    .orderBy('dataCadastro', 'desc')
                    .get();
                
                const items = [];
                snapshot.forEach(doc => {
                    items.push({
                        id: doc.id,
                        firebaseId: doc.id,
                        ...doc.data()
                    });
                });
                
                console.log(`✅ DataLoader: ${items.length} itens em [${collectionName}]`);
                return items;
                
            } catch (error) {
                console.error(`❌ DataLoader: Erro ao carregar [${moduleName}]:`, error);
                return [];
            }
        },

        /**
         * Salvar/Substituir TODOS os dados de uma coleção
         * (Usar com cuidado - substitui o documento 'dados_completos')
         * @param {string} moduleName - Nome do módulo
         * @param {any} data - Dados a serem salvos
         */
        save: async function(moduleName, data) {
            const db = await aguardarFirebase();
            
            if (!db) {
                console.error('❌ Firebase não disponível para salvar:', moduleName);
                return false;
            }
            
            try {
                const collectionName = getCollectionName(moduleName);
                
                const qtd = Array.isArray(data) ? data.length : 
                           (data && typeof data === 'object' ? Object.keys(data).length : 0);
                
                await db.collection(collectionName).doc('dados_completos').set({
                    dados: data,
                    ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp(),
                    quantidadeItens: qtd
                }, { merge: true });
                
                console.log(`✅ DataLoader: Dados salvos em [${collectionName}] (${qtd} itens)`);
                return true;
                
            } catch (error) {
                console.error(`❌ DataLoader: Erro ao salvar [${moduleName}]:`, error);
                return false;
            }
        },

        /**
         * Adicionar UM item à coleção
         * @param {string} moduleName - Nome da coleção
         * @param {object} item - Item a ser adicionado
         * @returns {object} - Item com ID gerado
         */
        add: async function(moduleName, item) {
            const db = await aguardarFirebase();
            
            if (!db) {
                console.error('❌ Firebase não disponível para adicionar');
                return null;
            }
            
            try {
                const collectionName = getCollectionName(moduleName);
                
                // Adicionar timestamp
                const newItem = {
                    ...item,
                    dataCadastro: firebase.firestore.FieldValue.serverTimestamp(),
                    ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                const docRef = await db.collection(collectionName).add(newItem);
                
                console.log(`✅ DataLoader: Item adicionado em [${collectionName}] - ID: ${docRef.id}`);
                
                return {
                    id: docRef.id,
                    firebaseId: docRef.id,
                    ...item
                };
                
            } catch (error) {
                console.error(`❌ DataLoader: Erro ao adicionar em [${moduleName}]:`, error);
                return null;
            }
        },

        /**
         * Atualizar UM item específico
         * @param {string} moduleName - Nome da coleção
         * @param {string} id - ID do documento (firebaseId ou id)
         * @param {object} newData - Novos dados
         */
        update: async function(moduleName, id, newData) {
            const db = await aguardarFirebase();
            
            if (!db) {
                console.error('❌ Firebase não disponível para atualizar');
                return false;
            }
            
            try {
                const collectionName = getCollectionName(moduleName);
                
                // Procurar documento pelo ID
                const docRef = db.collection(collectionName).doc(id);
                const doc = await docRef.get();
                
                if (doc.exists) {
                    await docRef.update({
                        ...newData,
                        ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    console.log(`✅ DataLoader: Item atualizado em [${collectionName}] - ID: ${id}`);
                    return true;
                } else {
                    console.warn(`⚠️ DataLoader: Documento não encontrado [${id}] em [${collectionName}]`);
                    return false;
                }
                
            } catch (error) {
                console.error(`❌ DataLoader: Erro ao atualizar [${moduleName}]:`, error);
                return false;
            }
        },

        /**
         * Excluir UM item específico
         * @param {string} moduleName - Nome da coleção
         * @param {string} id - ID do documento
         */
        delete: async function(moduleName, id) {
            const db = await aguardarFirebase();
            
            if (!db) {
                console.error('❌ Firebase não disponível para excluir');
                return false;
            }
            
            try {
                const collectionName = getCollectionName(moduleName);
                
                await db.collection(collectionName).doc(id).delete();
                
                console.log(`✅ DataLoader: Item excluído de [${collectionName}] - ID: ${id}`);
                return true;
                
            } catch (error) {
                console.error(`❌ DataLoader: Erro ao excluir [${moduleName}]:`, error);
                return false;
            }
        },

        /**
         * Buscar itens com filtro
         * @param {string} moduleName - Nome da coleção
         * @param {string} field - Campo para filtrar
         * @param {string} operator - Operador (==, >, <, etc)
         * @param {any} value - Valor do filtro
         */
        query: async function(moduleName, field, operator, value) {
            const db = await aguardarFirebase();
            
            if (!db) {
                console.error('❌ Firebase não disponível para query');
                return [];
            }
            
            try {
                const collectionName = getCollectionName(moduleName);
                
                const snapshot = await db.collection(collectionName)
                    .where(field, operator, value)
                    .get();
                
                const items = [];
                snapshot.forEach(doc => {
                    items.push({
                        id: doc.id,
                        firebaseId: doc.id,
                        ...doc.data()
                    });
                });
                
                console.log(`✅ DataLoader: ${items.length} itens encontrados com filtro em [${collectionName}]`);
                return items;
                
            } catch (error) {
                console.error(`❌ DataLoader: Erro na query [${moduleName}]:`, error);
                return [];
            }
        },

        /**
         * Verificar status da conexão
         */
        getStatus: function() {
            const db = getDB();
            return {
                firebaseAvailable: !!db,
                online: navigator.onLine,
                mode: 'CLOUD (Firebase Direto)',
                collections: Object.keys(COLLECTION_MAP)
            };
        }
    };

    console.log('✅ DataLoader 2.0 pronto (Cloud Mode - Firebase Direto)');
    console.log('   📚 Coleções mapeadas:', Object.keys(COLLECTION_MAP).length);
    console.log('   🌐 Modo: Multi-usuário (sem localStorage)');

})();
