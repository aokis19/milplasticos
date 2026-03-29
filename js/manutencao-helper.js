// /milplasticos/js/manutencao-helper.js
// Funções auxiliares para manutenção - CORRIGIDAS

// Buscar última troca de óleo do veículo
async function buscarUltimaTrocaOleo(veiculoPlaca) {
    // Tentar Firebase primeiro
    if (window.firebaseDB) {
        try {
            const snapshot = await window.firebaseDB.collection('trocasOleo')
                .where('veiculoPlaca', '==', veiculoPlaca)
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
    
    // Fallback para localStorage
    const trocas = JSON.parse(localStorage.getItem('trocasOleo') || '[]');
    const trocasVeiculo = trocas.filter(t => t.veiculoPlaca === veiculoPlaca);
    trocasVeiculo.sort((a, b) => new Date(b.data) - new Date(a.data));
    return trocasVeiculo[0] || null;
}

// Calcular próximo KM/Hora para troca (KM da troca + intervalo)
function calcularProximaTroca(ultimaTroca) {
    if (!ultimaTroca) return null;
    return ultimaTroca.kmTroca + (ultimaTroca.intervaloProxima || 10000);
}

// Calcular quanto falta para a próxima troca (CORRIGIDO)
function calcularFaltamParaTroca(ultimaTroca, marcacaoAtual) {
    if (!ultimaTroca) return null;
    const proxima = calcularProximaTroca(ultimaTroca);
    // CORREÇÃO: faltam = próxima - atual
    const faltam = proxima - marcacaoAtual;
    return faltam;
}

// Verificar status da troca (CORRIGIDO)
function verificarStatusTroca(faltam) {
    if (faltam === null) return { status: 'sem_dados', mensagem: 'Sem histórico', classe: 'secondary' };
    if (faltam <= 0) return { status: 'vencida', mensagem: `⚠️ VENCIDA há ${Math.abs(faltam).toLocaleString('pt-BR')} KM/Horas`, classe: 'danger' };
    if (faltam <= 50) return { status: 'urgente', mensagem: `⚠️ URGENTE! Faltam ${faltam.toLocaleString('pt-BR')} KM/Horas`, classe: 'warning' };
    if (faltam <= 100) return { status: 'proximo', mensagem: `📢 Próxima troca em ${faltam.toLocaleString('pt-BR')} KM/Horas`, classe: 'info' };
    return { status: 'ok', mensagem: `✅ OK: ${faltam.toLocaleString('pt-BR')} KM/Horas restantes`, classe: 'success' };
}

// Função para atualizar KM do veículo (usada pelo abastecimento)
function atualizarKmVeiculo(placa, novoKm) {
    if (!placa || !novoKm) return;
    
    localStorage.setItem(`km_atual_${placa}`, novoKm.toString());
    console.log(`📊 KM atualizado para ${placa}: ${novoKm}`);
    
    // Disparar evento para atualizar interfaces
    const event = new CustomEvent('kmAtualizado', { detail: { placa, km: novoKm } });
    window.dispatchEvent(event);
}

// Exportar funções
window.buscarUltimaTrocaOleo = buscarUltimaTrocaOleo;
window.calcularProximaTroca = calcularProximaTroca;
window.calcularFaltamParaTroca = calcularFaltamParaTroca;
window.verificarStatusTroca = verificarStatusTroca;
window.atualizarKmVeiculo = atualizarKmVeiculo;