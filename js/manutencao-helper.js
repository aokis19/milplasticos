// manutencao-helper.js
// Funções auxiliares para manutenção

// Buscar último registro de manutenção preventiva
async function buscarUltimoRegistro(veiculoPlaca, tipoManutencao) {
    if (window.firebaseDB) {
        try {
            const snapshot = await window.firebaseDB.collection('manutencoes')
                .where('veiculoPlaca', '==', veiculoPlaca)
                .where('tipo', '==', tipoManutencao)
                .orderBy('data', 'desc')
                .limit(1)
                .get();
            
            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                return { id: doc.id, ...doc.data() };
            }
        } catch (error) {
            console.error('Erro Firebase:', error);
        }
    }
    
    const manutencoes = JSON.parse(localStorage.getItem('manutencoes') || '[]');
    const filtradas = manutencoes.filter(m => m.veiculoPlaca === veiculoPlaca && m.tipo === tipoManutencao);
    filtradas.sort((a, b) => new Date(b.data) - new Date(a.data));
    return filtradas[0] || null;
}

// Calcular próxima manutenção
function calcularProximaManutencao(ultimoRegistro) {
    if (!ultimoRegistro) return null;
    const intervalo = ultimoRegistro.intervaloProximo || 200;
    return (ultimoRegistro.kmAtual || ultimoRegistro.km || 0) + intervalo;
}

// Calcular quanto falta para a próxima manutenção
function calcularFaltamParaManutencao(ultimoRegistro, kmAtual) {
    if (!ultimoRegistro) return null;
    const proxima = calcularProximaManutencao(ultimoRegistro);
    return proxima - kmAtual;
}

// Verificar status da manutenção
function verificarStatusManutencao(faltam) {
    if (faltam === null) return { status: 'sem_dados', mensagem: 'Sem histórico', classe: 'secondary' };
    if (faltam <= 0) return { status: 'vencida', mensagem: '⚠️ VENCIDA', classe: 'danger' };
    if (faltam <= 50) return { status: 'urgente', mensagem: '⚠️ URGENTE', classe: 'warning' };
    if (faltam <= 100) return { status: 'proximo', mensagem: '📢 Próxima', classe: 'info' };
    return { status: 'ok', mensagem: '✅ OK', classe: 'success' };
}

// Atualizar KM do veículo
function atualizarKmVeiculo(placa, novoKm) {
    if (!placa || !novoKm) return;
    localStorage.setItem(`km_atual_${placa}`, novoKm.toString());
    console.log(`📊 KM atualizado para ${placa}: ${novoKm}`);
    
    const event = new CustomEvent('kmAtualizado', { detail: { placa, km: novoKm } });
    window.dispatchEvent(event);
}

// Exportar funções
window.buscarUltimoRegistro = buscarUltimoRegistro;
window.calcularProximaManutencao = calcularProximaManutencao;
window.calcularFaltamParaManutencao = calcularFaltamParaManutencao;
window.verificarStatusManutencao = verificarStatusManutencao;
window.atualizarKmVeiculo = atualizarKmVeiculo;
