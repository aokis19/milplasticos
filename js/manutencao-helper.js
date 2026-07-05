// ==========================================================================
// manutencao-helper.js - Funções Auxiliares (Versão 100% Firebase)
// Sem localStorage - Dados sempre do Firebase
// ==========================================================================

(function() {
    'use strict';

    console.log('🔧 Manutencao Helper carregado (Cloud Mode)');

    // ================== REFERÊNCIA DO FIREBASE ==================
    function getDB() {
        return window.db || window.firebaseDB || null;
    }

    // ================== FUNÇÕES AUXILIARES ==================

    /**
     * Buscar último registro de manutenção preventiva
     * @param {string} veiculoPlaca - Placa do veículo
     * @param {string} tipoManutencao - Tipo de manutenção
     * @returns {object|null} - Último registro ou null
     */
    async function buscarUltimoRegistro(veiculoPlaca, tipoManutencao) {
        const db = getDB();
        
        if (db) {
            try {
                const snapshot = await db.collection('manutencoes')
                    .where('veiculoPlaca', '==', veiculoPlaca)
                    .where('tipo', '==', tipoManutencao)
                    .orderBy('data', 'desc')
                    .limit(1)
                    .get();
                
                if (!snapshot.empty) {
                    const doc = snapshot.docs[0];
                    console.log(`✅ Último registro encontrado para ${veiculoPlaca} - ${tipoManutencao}`);
                    return { id: doc.id, firebaseId: doc.id, ...doc.data() };
                }
                
                console.log(`ℹ️ Nenhum registro para ${veiculoPlaca} - ${tipoManutencao}`);
                return null;
                
            } catch (error) {
                console.error('❌ Erro ao buscar último registro:', error);
                return null;
            }
        }
        
        console.warn('⚠️ Firebase não disponível para buscar registros');
        return null;
    }

    /**
     * Buscar KM atual do veículo (do último abastecimento ou manutenção)
     * @param {string} placa - Placa do veículo
     * @returns {number} - KM atual
     */
    async function buscarKmAtualVeiculo(placa) {
        const db = getDB();
        if (!db) return 0;
        
        try {
            // 1. Buscar do último abastecimento
            const snapshotAbast = await db.collection('abastecimentos')
                .where('veiculoPlaca', '==', placa)
                .orderBy('data', 'desc')
                .limit(1)
                .get();
            
            if (!snapshotAbast.empty) {
                const data = snapshotAbast.docs[0].data();
                const km = data.odometro || data.horimetro || 0;
                if (km > 0) return km;
            }
            
            // 2. Buscar da última manutenção
            const snapshotManut = await db.collection('manutencoes')
                .where('veiculoPlaca', '==', placa)
                .orderBy('data', 'desc')
                .limit(1)
                .get();
            
            if (!snapshotManut.empty) {
                const data = snapshotManut.docs[0].data();
                return data.kmAtual || 0;
            }
            
            return 0;
        } catch (error) {
            console.error('❌ Erro ao buscar KM:', error);
            return 0;
        }
    }

    /**
     * Calcular próxima manutenção
     * @param {object} ultimoRegistro - Último registro de manutenção
     * @returns {number|null} - KM da próxima manutenção
     */
    function calcularProximaManutencao(ultimoRegistro) {
        if (!ultimoRegistro) return null;
        const intervalo = ultimoRegistro.intervaloProximo || 200;
        return (ultimoRegistro.kmAtual || ultimoRegistro.km || 0) + intervalo;
    }

    /**
     * Calcular quanto falta para a próxima manutenção
     * @param {object} ultimoRegistro - Último registro
     * @param {number} kmAtual - KM atual do veículo
     * @returns {number|null} - KM restantes
     */
    function calcularFaltamParaManutencao(ultimoRegistro, kmAtual) {
        if (!ultimoRegistro || kmAtual === undefined || kmAtual === null) return null;
        const proxima = calcularProximaManutencao(ultimoRegistro);
        if (proxima === null) return null;
        return proxima - kmAtual;
    }

    /**
     * Verificar status da manutenção
     * @param {number|null} faltam - KM restantes
     * @returns {object} - Status da manutenção
     */
    function verificarStatusManutencao(faltam) {
        if (faltam === null || faltam === undefined) {
            return { 
                status: 'sem_dados', 
                mensagem: 'Sem histórico', 
                classe: 'secondary',
                icone: '⚪'
            };
        }
        if (faltam <= 0) {
            return { 
                status: 'vencida', 
                mensagem: '⚠️ VENCIDA', 
                classe: 'danger',
                icone: '🔴'
            };
        }
        if (faltam <= 50) {
            return { 
                status: 'urgente', 
                mensagem: '⚠️ URGENTE', 
                classe: 'warning',
                icone: '🟡'
            };
        }
        if (faltam <= 100) {
            return { 
                status: 'proximo', 
                mensagem: '📢 Próxima', 
                classe: 'info',
                icone: '🔵'
            };
        }
        return { 
            status: 'ok', 
            mensagem: '✅ OK', 
            classe: 'success',
            icone: '🟢'
        };
    }

    /**
     * Atualizar KM do veículo no Firebase
     * @param {string} placa - Placa do veículo
     * @param {number} novoKm - Novo KM
     */
    async function atualizarKmVeiculo(placa, novoKm) {
        if (!placa || !novoKm) {
            console.warn('⚠️ Placa ou KM inválidos');
            return false;
        }
        
        const db = getDB();
        
        if (db) {
            try {
                // Buscar veículo pela placa
                const snapshot = await db.collection('veiculos')
                    .where('placa', '==', placa)
                    .limit(1)
                    .get();
                
                if (!snapshot.empty) {
                    const doc = snapshot.docs[0];
                    await db.collection('veiculos').doc(doc.id).update({
                        kmAtual: novoKm,
                        ultimaAtualizacaoKm: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    console.log(`✅ KM atualizado no Firebase para ${placa}: ${novoKm}`);
                } else {
                    console.warn(`⚠️ Veículo ${placa} não encontrado no Firebase`);
                }
                
                // Disparar evento para outros componentes
                const event = new CustomEvent('kmAtualizado', { 
                    detail: { placa, km: novoKm } 
                });
                window.dispatchEvent(event);
                
                return true;
            } catch (error) {
                console.error('❌ Erro ao atualizar KM:', error);
                return false;
            }
        }
        
        console.warn('⚠️ Firebase não disponível - KM não atualizado');
        return false;
    }

    /**
     * Verificar todas as manutenções de um veículo
     * @param {string} placa - Placa do veículo
     * @returns {Array} - Lista de status de manutenções
     */
    async function verificarTodasManutencoesVeiculo(placa) {
        const db = getDB();
        if (!db) return [];
        
        try {
            // Buscar tipos configurados
            const docTipos = await db.collection('tiposManutencao').doc(placa).get();
            const tipos = docTipos.exists ? (docTipos.data().tipos || []) : [];
            
            const kmAtual = await buscarKmAtualVeiculo(placa);
            const resultados = [];
            
            for (const tipo of tipos) {
                const ultimo = await buscarUltimoRegistro(placa, tipo.nome);
                const faltam = ultimo ? calcularFaltamParaManutencao(ultimo, kmAtual) : null;
                const status = verificarStatusManutencao(faltam);
                
                resultados.push({
                    tipo: tipo.nome,
                    intervalo: tipo.intervalo,
                    ultimoRegistro: ultimo,
                    kmAtual,
                    proximaManutencao: ultimo ? calcularProximaManutencao(ultimo) : tipo.intervalo,
                    faltam,
                    status
                });
            }
            
            return resultados;
        } catch (error) {
            console.error('❌ Erro ao verificar manutenções:', error);
            return [];
        }
    }

    // ================== EXPORTAR FUNÇÕES GLOBALMENTE ==================
    window.buscarUltimoRegistro = buscarUltimoRegistro;
    window.calcularProximaManutencao = calcularProximaManutencao;
    window.calcularFaltamParaManutencao = calcularFaltamParaManutencao;
    window.verificarStatusManutencao = verificarStatusManutencao;
    window.atualizarKmVeiculo = atualizarKmVeiculo;
    window.buscarKmAtualVeiculo = buscarKmAtualVeiculo;
    window.verificarTodasManutencoesVeiculo = verificarTodasManutencoesVeiculo;

    console.log('✅ Manutencao Helper pronto (Cloud Mode)');

})();
