// manut.js - VERSÃO COMPLETA CORRIGIDA

// ================== VARIÁVEIS GLOBAIS ==================
let trocasOleo = [];
let manutencoes = [];
let abastecimentos = [];
let veiculos = [];
let editingTrocaId = null;
let editingManutencaoId = null;

// ================== INICIALIZAÇÃO ==================
async function inicializar() {
    console.log('🚀 Inicializando sistema de manutenção...');
    
    await aguardarFirebase();
    await carregarTodosDados();
    
    const hoje = new Date().toISOString().split('T')[0];
    const dataTrocaInput = document.getElementById('dataTrocaOleo');
    const dataManutencaoInput = document.getElementById('dataManutencao');
    
    if (dataTrocaInput) dataTrocaInput.value = hoje;
    if (dataManutencaoInput) dataManutencaoInput.value = hoje;
    
    configurarEventos();
    configurarAbas();
    
    // Escutar atualizações de KM do abastecimento
    window.addEventListener('abastecimentoSalvo', async (event) => {
        console.log('📢 Abastecimento salvo, atualizando manutenções...');
        await carregarAbastecimentos(); // Recarrega abastecimentos
        await carregarTabelaOleo();
        await carregarProgramadas();
        verificarAlertas();
    });
    
    window.addEventListener('kmAtualizado', async (event) => {
        console.log('📢 KM atualizado:', event.detail);
        await carregarTabelaOleo();
        await carregarProgramadas();
    });
    
    await carregarTabelaOleo();
    await carregarTabelaManutencoes();
    await carregarProgramadas();
    
    console.log('✅ Sistema de manutenção pronto!');
}

function aguardarFirebase() {
    return new Promise((resolve) => {
        if (window.firebaseDB) {
            console.log('🔥 Firebase disponível');
            resolve();
            return;
        }
        
        const verificar = setInterval(() => {
            if (window.firebaseDB) {
                clearInterval(verificar);
                console.log('🔥 Firebase conectado');
                resolve();
            }
        }, 100);
        
        setTimeout(() => {
            clearInterval(verificar);
            console.log('⚠️ Firebase não disponível, usando localStorage');
            resolve();
        }, 3000);
    });
}

// ================== CARREGAR TODOS OS DADOS ==================
async function carregarTodosDados() {
    // Carregar veículos primeiro (necessário para selects)
    await carregarVeiculos();
    
    // Carregar abastecimentos (necessário para KM atual)
    await carregarAbastecimentos();
    
    // Carregar trocas e manutenções
    await carregarTrocas();
    await carregarManutencoes();
}

// ================== CARREGAR VEÍCULOS ==================
async function carregarVeiculos() {
    try {
        // Tentar Firebase primeiro
        if (window.firebaseDB) {
            const snapshot = await window.firebaseDB.collection('veiculos').get();
            veiculos = [];
            snapshot.forEach(doc => {
                veiculos.push({ firebaseId: doc.id, ...doc.data() });
            });
            if (veiculos.length > 0) {
                console.log(`✅ ${veiculos.length} veículos do Firebase`);
                localStorage.setItem('veiculos', JSON.stringify(veiculos));
                atualizarSelectsVeiculos();
                return;
            }
        }
        
        // Fallback: localStorage
        const veiculosSalvos = localStorage.getItem('veiculos');
        if (veiculosSalvos) {
            veiculos = JSON.parse(veiculosSalvos);
            console.log(`💾 ${veiculos.length} veículos do localStorage`);
        } else {
            // Dados padrão
            veiculos = [
                { id: 1, nome: 'Caminhão Mercedes 1113', placa: 'ABC-1234', tipoMedidor: 'km', combustivel: 'Diesel S10' },
                { id: 2, nome: 'Empilhadeira Toyota', placa: 'EMP-001', tipoMedidor: 'horas', combustivel: 'Gasolina' },
                { id: 3, nome: 'Caminhão VW Constellation', placa: 'XYZ-5678', tipoMedidor: 'km', combustivel: 'Diesel S500' }
            ];
            console.log(`📝 ${veiculos.length} veículos padrão`);
            localStorage.setItem('veiculos', JSON.stringify(veiculos));
        }
        
        atualizarSelectsVeiculos();
        
    } catch (error) {
        console.error('Erro ao carregar veículos:', error);
        veiculos = [];
    }
}

function atualizarSelectsVeiculos() {
    const selectVeiculoOleo = document.getElementById('veiculoOleo');
    const selectVeiculoManutencao = document.getElementById('veiculoManutencao');
    
    const opcoes = '<option value="">Selecione...</option>' + 
        veiculos.map(v => `<option value="${v.placa}">${v.placa} - ${v.nome || v.modelo} (${v.tipoMedidor || 'km'})</option>`).join('');
    
    if (selectVeiculoOleo) selectVeiculoOleo.innerHTML = opcoes;
    if (selectVeiculoManutencao) selectVeiculoManutencao.innerHTML = opcoes;
    
    console.log(`📋 Selects de veículos atualizados com ${veiculos.length} veículos`);
}

// ================== CARREGAR ABASTECIMENTOS ==================
async function carregarAbastecimentos() {
    try {
        if (window.firebaseDB) {
            const snapshot = await window.firebaseDB.collection('abastecimentos').orderBy('data', 'desc').get();
            abastecimentos = [];
            snapshot.forEach(doc => {
                abastecimentos.push({ firebaseId: doc.id, ...doc.data() });
            });
            if (abastecimentos.length > 0) {
                console.log(`✅ ${abastecimentos.length} abastecimentos do Firebase`);
                localStorage.setItem('abastecimentos', JSON.stringify(abastecimentos));
                return;
            }
        }
        
        const abastSalvos = localStorage.getItem('abastecimentos');
        if (abastSalvos) {
            abastecimentos = JSON.parse(abastSalvos);
            console.log(`💾 ${abastecimentos.length} abastecimentos do localStorage`);
        } else {
            abastecimentos = [];
        }
    } catch (error) {
        console.error('Erro ao carregar abastecimentos:', error);
        abastecimentos = [];
    }
}

// ================== CARREGAR TROCAS ==================
async function carregarTrocas() {
    if (window.firebaseDB) {
        try {
            const snapshot = await window.firebaseDB.collection('trocasOleo').orderBy('data', 'desc').get();
            trocasOleo = [];
            snapshot.forEach(doc => {
                trocasOleo.push({ firebaseId: doc.id, ...doc.data() });
            });
            console.log(`✅ ${trocasOleo.length} trocas do Firebase`);
            localStorage.setItem('trocasOleo', JSON.stringify(trocasOleo));
        } catch (error) {
            console.error('Erro:', error);
            carregarTrocasLocal();
        }
    } else {
        carregarTrocasLocal();
    }
}

function carregarTrocasLocal() {
    try {
        trocasOleo = JSON.parse(localStorage.getItem('trocasOleo')) || [];
        console.log(`💾 ${trocasOleo.length} trocas do localStorage`);
    } catch (e) {
        trocasOleo = [];
    }
}

// ================== CARREGAR MANUTENÇÕES ==================
async function carregarManutencoes() {
    if (window.firebaseDB) {
        try {
            const snapshot = await window.firebaseDB.collection('manutencoes').orderBy('data', 'desc').get();
            manutencoes = [];
            snapshot.forEach(doc => {
                manutencoes.push({ firebaseId: doc.id, ...doc.data() });
            });
            console.log(`✅ ${manutencoes.length} manutenções do Firebase`);
            localStorage.setItem('manutencoes', JSON.stringify(manutencoes));
        } catch (error) {
            console.error('Erro:', error);
            carregarManutencoesLocal();
        }
    } else {
        carregarManutencoesLocal();
    }
}

function carregarManutencoesLocal() {
    try {
        manutencoes = JSON.parse(localStorage.getItem('manutencoes')) || [];
        console.log(`💾 ${manutencoes.length} manutenções do localStorage`);
    } catch (e) {
        manutencoes = [];
    }
}

// ================== FUNÇÃO: OBTER KM ATUAL ==================
function obterKmAtualVeiculo(placaVeiculo) {
    console.log(`🔍 Buscando KM para ${placaVeiculo}`);
    
    // 1. KM salvo manualmente
    const kmSalvo = localStorage.getItem(`km_atual_${placaVeiculo}`);
    if (kmSalvo) {
        console.log(`✅ KM manual: ${kmSalvo}`);
        return parseInt(kmSalvo);
    }
    
    // 2. Último abastecimento por DATA
    if (abastecimentos && abastecimentos.length > 0) {
        const abastVeiculo = abastecimentos.filter(a => a.veiculoPlaca === placaVeiculo);
        
        if (abastVeiculo.length > 0) {
            abastVeiculo.sort((a, b) => new Date(b.data) - new Date(a.data));
            const ultimo = abastVeiculo[0];
            const km = ultimo.odometro || ultimo.horimetro || 0;
            console.log(`✅ KM do último abastecimento (${ultimo.data}): ${km}`);
            return km;
        }
    }
    
    // 3. Última troca de óleo
    const trocasVeiculo = trocasOleo.filter(t => t.veiculoPlaca === placaVeiculo);
    if (trocasVeiculo.length > 0) {
        trocasVeiculo.sort((a, b) => new Date(b.data) - new Date(a.data));
        const km = trocasVeiculo[0].kmTroca || 0;
        console.log(`✅ KM da última troca: ${km}`);
        return km;
    }
    
    console.log(`⚠️ Nenhum KM encontrado para ${placaVeiculo}`);
    return 0;
}

// ================== SALVAR NO FIREBASE ==================
async function salvarNoFirebase(colecao, dados) {
    if (!window.firebaseDB) return null;
    
    try {
        const { firebaseId, ...dadosParaSalvar } = dados;
        
        if (dados.firebaseId) {
            await window.firebaseDB.collection(colecao).doc(dados.firebaseId).update(dadosParaSalvar);
            console.log(`✅ Atualizado no Firebase: ${colecao}`);
            return dados.firebaseId;
        } else {
            const docRef = await window.firebaseDB.collection(colecao).add(dadosParaSalvar);
            console.log(`✅ Salvo no Firebase: ${colecao}/${docRef.id}`);
            return docRef.id;
        }
    } catch (error) {
        console.error('Erro Firebase:', error);
        return null;
    }
}

// ================== SALVAR TROCA DE ÓLEO ==================
async function salvarTrocaOleo(e) {
    e.preventDefault();
    console.log('Salvando troca de óleo...');
    
    const trocaId = document.getElementById('trocaId').value;
    const isEdicao = trocaId !== '';
    
    const veiculoPlaca = document.getElementById('veiculoOleo').value;
    if (!veiculoPlaca) {
        alert('Selecione um veículo');
        return;
    }
    
    const veiculo = veiculos.find(v => v.placa === veiculoPlaca);
    if (!veiculo) {
        alert('Veículo não encontrado');
        return;
    }
    
    const kmTroca = parseInt(document.getElementById('kmTrocaOleo').value);
    if (!kmTroca || kmTroca <= 0) {
        alert('Informe o KM/Hora da troca');
        return;
    }
    
    const intervaloProxima = parseInt(document.getElementById('intervaloProximaOleo').value);
    if (!intervaloProxima || intervaloProxima <= 0) {
        alert('Informe o intervalo para próxima troca');
        return;
    }
    
    const troca = {
        id: isEdicao ? parseInt(trocaId) : Date.now(),
        veiculoPlaca: veiculoPlaca,
        veiculoNome: veiculo.nome || veiculo.modelo,
        data: document.getElementById('dataTrocaOleo').value,
        kmTroca: kmTroca,
        tipoOleo: document.getElementById('tipoOleo').value,
        marcaOleo: document.getElementById('marcaOleo').value.trim(),
        viscosidadeOleo: document.getElementById('viscosidadeOleo').value.trim(),
        quantidadeOleo: parseFloat(document.getElementById('quantidadeOleo').value) || 0,
        intervaloProxima: intervaloProxima,
        observacoes: document.getElementById('observacoesOleo').value.trim(),
        dataRegistro: new Date().toISOString(),
        filtros: []
    };
    
    // Coletar filtros
    const filtrosConfig = [
        { id: 'filtroOleo', modeloId: 'modeloFiltroOleo', nome: 'filtro_oleo' },
        { id: 'filtroAr', modeloId: 'modeloFiltroAr', nome: 'filtro_ar' },
        { id: 'filtroCombustivel', modeloId: 'modeloFiltroCombustivel', nome: 'filtro_combustivel' },
        { id: 'filtroArCondicionado', modeloId: 'modeloFiltroArCondicionado', nome: 'filtro_ar_condicionado' },
        { id: 'filtroHidraulico', modeloId: 'modeloFiltroHidraulico', nome: 'filtro_hidraulico' }
    ];
    
    filtrosConfig.forEach(f => {
        if (document.getElementById(f.id)?.checked) {
            troca.filtros.push({
                tipo: f.nome,
                modelo: document.getElementById(f.modeloId).value.trim()
            });
        }
    });
    
    // Se for edição, manter firebaseId
    if (isEdicao) {
        const existente = trocasOleo.find(t => t.id === troca.id);
        if (existente?.firebaseId) troca.firebaseId = existente.firebaseId;
    }
    
    // Salvar no Firebase
    const firebaseId = await salvarNoFirebase('trocasOleo', troca);
    if (firebaseId) troca.firebaseId = firebaseId;
    
    // Atualizar array local
    if (isEdicao) {
        const index = trocasOleo.findIndex(t => t.id === troca.id);
        if (index !== -1) trocasOleo[index] = troca;
    } else {
        trocasOleo.push(troca);
    }
    
    localStorage.setItem('trocasOleo', JSON.stringify(trocasOleo));
    
    alert(isEdicao ? 'Troca atualizada!' : 'Troca registrada!');
    
    // Limpar e fechar
    document.getElementById('formTrocaOleo').reset();
    document.getElementById('trocaId').value = '';
    document.getElementById('modalTrocaOleo').style.display = 'none';
    
    // Atualizar interfaces
    await carregarTabelaOleo();
    await carregarProgramadas();
}

// ================== SALVAR MANUTENÇÃO GERAL ==================
async function salvarManutencaoGeral(e) {
    e.preventDefault();
    console.log('Salvando manutenção...');
    
    const manutencaoId = document.getElementById('manutencaoId').value;
    const isEdicao = manutencaoId !== '';
    
    const veiculoPlaca = document.getElementById('veiculoManutencao').value;
    if (!veiculoPlaca) {
        alert('Selecione um veículo');
        return;
    }
    
    const veiculo = veiculos.find(v => v.placa === veiculoPlaca);
    
    const manutencao = {
        id: isEdicao ? parseInt(manutencaoId) : Date.now(),
        veiculoPlaca: veiculoPlaca,
        veiculoNome: veiculo?.nome || veiculo?.modelo || 'Veículo',
        tipo: document.getElementById('tipoManutencao').value,
        data: document.getElementById('dataManutencao').value,
        km: parseInt(document.getElementById('kmManutencao').value) || 0,
        descricao: document.getElementById('descricaoManutencao').value.trim(),
        custo: parseFloat(document.getElementById('custoManutencao').value) || 0,
        fornecedor: document.getElementById('fornecedorManutencao').value.trim(),
        observacoes: document.getElementById('observacoesManutencao').value.trim(),
        dataRegistro: new Date().toISOString()
    };
    
    if (!manutencao.tipo) { alert('Selecione o tipo de manutenção'); return; }
    if (!manutencao.descricao) { alert('Informe a descrição'); return; }
    
    if (isEdicao) {
        const existente = manutencoes.find(m => m.id === manutencao.id);
        if (existente?.firebaseId) manutencao.firebaseId = existente.firebaseId;
    }
    
    const firebaseId = await salvarNoFirebase('manutencoes', manutencao);
    if (firebaseId) manutencao.firebaseId = firebaseId;
    
    if (isEdicao) {
        const index = manutencoes.findIndex(m => m.id === manutencao.id);
        if (index !== -1) manutencoes[index] = manutencao;
    } else {
        manutencoes.push(manutencao);
    }
    
    localStorage.setItem('manutencoes', JSON.stringify(manutencoes));
    
    alert(isEdicao ? 'Manutenção atualizada!' : 'Manutenção registrada!');
    
    document.getElementById('formManutencaoGeral').reset();
    document.getElementById('manutencaoId').value = '';
    document.getElementById('modalManutencaoGeral').style.display = 'none';
    
    await carregarTabelaManutencoes();
}

// ================== CARREGAR TABELA DE ÓLEO ==================
async function carregarTabelaOleo() {
    const tbody = document.getElementById('tabelaOleoBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (trocasOleo.length === 0) {
        tbody.innerHTML = `发展<td colspan="7" class="text-center">Nenhuma troca de óleo registrada.发展</table></tr>`;
        document.getElementById('totalTrocasOleo').textContent = '0 trocas';
        return;
    }
    
    // Ordenar por data (mais recente primeiro)
    trocasOleo.sort((a, b) => new Date(b.data) - new Date(a.data));
    
    let veiculos = [];
    try {
        veiculos = JSON.parse(localStorage.getItem('veiculos')) || [];
    } catch (e) {}
    
    // IDENTIFICAR A ÚLTIMA TROCA DE CADA VEÍCULO
    const ultimaTrocaPorVeiculo = {};
    for (const troca of trocasOleo) {
        if (!ultimaTrocaPorVeiculo[troca.veiculoPlaca] || 
            new Date(troca.data) > new Date(ultimaTrocaPorVeiculo[troca.veiculoPlaca].data)) {
            ultimaTrocaPorVeiculo[troca.veiculoPlaca] = troca;
        }
    }
    
    for (const troca of trocasOleo) {
        const veiculo = veiculos.find(v => v.placa === troca.veiculoPlaca);
        const nomeVeiculo = veiculo ? `${troca.veiculoPlaca} - ${veiculo.nome || veiculo.modelo}` : troca.veiculoPlaca;
        const dataFormatada = new Date(troca.data).toLocaleDateString('pt-BR');
        
        // VERIFICAR SE É A ÚLTIMA TROCA DESTE VEÍCULO
        const isUltimaTroca = ultimaTrocaPorVeiculo[troca.veiculoPlaca]?.id === troca.id;
        
        let kmAtual = 0;
        let proximaKm = 0;
        let kmRestantes = 0;
        let proximaInfo = '-';
        let statusClass = '';
        let statusTexto = '';
        
        if (isUltimaTroca) {
            // É a última troca - calcular status atual
            kmAtual = obterKmAtualVeiculo(troca.veiculoPlaca);
            proximaKm = troca.kmTroca + troca.intervaloProxima;
            kmRestantes = proximaKm - kmAtual;
            
            console.log(`🔧 ${troca.veiculoPlaca} (Última): Troca=${troca.kmTroca}, Atual=${kmAtual}, Próx=${proximaKm}, Restam=${kmRestantes}`);
            
            if (kmRestantes <= 0) {
                proximaInfo = `<span class="text-danger">⚠️ VENCIDA há ${Math.abs(kmRestantes).toLocaleString('pt-BR')} KM</span>`;
                statusClass = 'status-atrasada';
                statusTexto = 'Vencida';
            } else if (kmRestantes <= 50) {
                proximaInfo = `<span class="text-warning">⚠️ URGENTE! ${kmRestantes.toLocaleString('pt-BR')} KM</span>`;
                statusClass = 'status-urgente';
                statusTexto = 'Urgente';
            } else if (kmRestantes <= 100) {
                proximaInfo = `<span class="text-info">📢 Próxima em ${kmRestantes.toLocaleString('pt-BR')} KM</span>`;
                statusClass = 'status-proximo';
                statusTexto = 'Próximo';
            } else {
                proximaInfo = `<span class="text-success">✅ ${kmRestantes.toLocaleString('pt-BR')} KM</span>`;
                statusClass = 'status-ok';
                statusTexto = 'OK';
            }
        } else {
            // É uma troca antiga (histórico) - mostrar como CONCLUÍDA
            proximaInfo = `<span class="text-success" style="background-color: #d4edda; padding: 4px 8px; border-radius: 4px;">
                              <i class="fas fa-check-circle"></i> Troca Realizada
                           </span>`;
            statusClass = 'status-concluida';
            statusTexto = 'Concluída';
        }
        
        const filtrosInfo = troca.filtros?.length > 0 
            ? troca.filtros.map(f => {
                const tipos = {
                    'filtro_oleo': 'Óleo', 'filtro_ar': 'Ar', 'filtro_combustivel': 'Comb.',
                    'filtro_ar_condicionado': 'Ar Cond.', 'filtro_hidraulico': 'Hidráulico'
                };
                return `${tipos[f.tipo] || f.tipo}${f.modelo ? ` (${f.modelo})` : ''}`;
            }).join(', ')
            : '-';
        
        // Adicionar badge de "Última Troca" se for a mais recente
        const ultimaBadge = isUltimaTroca ? '<span style="background-color: #28a745; color: white; padding: 2px 8px; border-radius: 12px; font-size: 10px; margin-left: 8px;">ATUAL</span>' : '';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${dataFormatada}${ultimaBadge}</td>
            <td><strong>${nomeVeiculo}</strong></td>
            <td>${troca.kmTroca.toLocaleString('pt-BR')}</td>
            <td>${troca.tipoOleo}${troca.marcaOleo ? ` - ${troca.marcaOleo}` : ''}</td>
            <td>${filtrosInfo}</td>
            <td class="${statusClass}">${proximaInfo}</td>
            <td class="actions">
                <button class="btn-icon btn-info" onclick="verDetalhesTroca(${troca.id})" title="Ver detalhes">
                    <i class="fas fa-eye"></i>
                </button>
                ${!isUltimaTroca ? `
                <button class="btn-icon btn-success" onclick="copiarTrocaComoNova(${troca.id})" title="Usar como base para nova troca">
                    <i class="fas fa-copy"></i>
                </button>
                ` : `
                <button class="btn-icon btn-edit" onclick="abrirEdicaoTroca(${JSON.stringify(troca).replace(/"/g, '&quot;')})" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                `}
                <button class="btn-icon btn-delete" onclick="excluirTrocaOleo(${troca.id})" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    }
    
    document.getElementById('totalTrocasOleo').textContent = `${trocasOleo.length} troca${trocasOleo.length !== 1 ? 's' : ''}`;
}

// FUNÇÃO PARA COPIAR TROCA ANTIGA COMO NOVA (opcional)
function copiarTrocaComoNova(id) {
    const trocaAntiga = trocasOleo.find(t => t.id === id);
    if (!trocaAntiga) return;
    
    if (confirm(`Deseja usar a troca de ${trocaAntiga.veiculoPlaca} de ${new Date(trocaAntiga.data).toLocaleDateString('pt-BR')} como base para uma nova troca?`)) {
        // Preencher o formulário com os dados da troca antiga
        document.getElementById('veiculoOleo').value = trocaAntiga.veiculoPlaca;
        document.getElementById('tipoOleo').value = trocaAntiga.tipoOleo;
        document.getElementById('marcaOleo').value = trocaAntiga.marcaOleo || '';
        document.getElementById('viscosidadeOleo').value = trocaAntiga.viscosidadeOleo || '';
        document.getElementById('intervaloProximaOleo').value = trocaAntiga.intervaloProxima;
        
        // Data atual para a nova troca
        const hoje = new Date().toISOString().split('T')[0];
        document.getElementById('dataTrocaOleo').value = hoje;
        
        // KM atual do veículo (último abastecimento)
        const kmAtual = obterKmAtualVeiculo(trocaAntiga.veiculoPlaca);
        document.getElementById('kmTrocaOleo').value = kmAtual;
        
        // Abrir modal
        document.getElementById('modalTrocaTitulo').innerHTML = '<i class="fas fa-oil-can"></i> Nova Troca de Óleo (baseada em histórico)';
        abrirModal('modalTrocaOleo');
        
        alert(`Campos preenchidos com base na troca anterior. Verifique o KM atual (${kmAtual}) e ajuste se necessário.`);
    }
}
// ================== CARREGAR TABELA DE MANUTENÇÕES ==================
async function carregarTabelaManutencoes() {
    const tbody = document.getElementById('tabelaManutencoesBody');
    if (!tbody) return;
    
    if (manutencoes.length === 0) {
        tbody.innerHTML = '发展<td colspan="6" class="text-center">Nenhuma manutenção registrada.发展</td></tr>';
        document.getElementById('totalManutencoes').textContent = '0 manutenções';
        return;
    }
    
    manutencoes.sort((a, b) => new Date(b.data) - new Date(a.data));
    
    let html = '';
    for (const manutencao of manutencoes) {
        const veiculo = veiculos.find(v => v.placa === manutencao.veiculoPlaca);
        const nomeVeiculo = veiculo ? `${manutencao.veiculoPlaca} - ${veiculo.nome || veiculo.modelo}` : manutencao.veiculoPlaca;
        const dataFormatada = new Date(manutencao.data).toLocaleDateString('pt-BR');
        
        const tipoTraduzido = {
            'pneus': 'Pneus', 'freios': 'Freios', 'suspensao': 'Suspensão',
            'motor': 'Motor', 'bateria': 'Bateria', 'eletrica': 'Elétrica',
            'ar_condicionado': 'Ar Condicionado', 'corpo': 'Funilaria/Pintura',
            'preventiva': 'Preventiva', 'corretiva': 'Corretiva',
            'hidraulica': 'Hidráulica', 'outros': 'Outros'
        }[manutencao.tipo] || manutencao.tipo;
        
        html += `
            <tr>
                <td>${dataFormatada}</td>
                <td><strong>${nomeVeiculo}</strong></td>
                <td>${tipoTraduzido}</td>
                <td>${manutencao.descricao.length > 50 ? manutencao.descricao.substring(0, 50) + '...' : manutencao.descricao}</td>
                <td>${manutencao.custo > 0 ? manutencao.custo.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) : '-'}</td>
                <td class="actions">
                    <button class="btn-icon btn-edit" onclick="editarManutencao(${manutencao.id})" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon btn-delete" onclick="excluirManutencao(${manutencao.id})" title="Excluir"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }
    
    tbody.innerHTML = html;
    document.getElementById('totalManutencoes').textContent = `${manutencoes.length} manutenção${manutencoes.length !== 1 ? 'ões' : ''}`;
}

// ================== CARREGAR PROGRAMADAS ==================
async function carregarProgramadas() {
    const container = document.getElementById('programadasContainer');
    if (!container) return;
    
    container.innerHTML = "";
    
    if (trocasOleo.length === 0) {
        container.innerHTML = '<div class="text-center">Nenhuma manutenção programada</div>';
        document.getElementById('totalProgramadas').textContent = '0 programadas';
        return;
    }
    
    // Última troca por veículo
    const trocasPorVeiculo = {};
    trocasOleo.forEach(troca => {
        if (!trocasPorVeiculo[troca.veiculoPlaca] || 
            new Date(troca.data) > new Date(trocasPorVeiculo[troca.veiculoPlaca].data)) {
            trocasPorVeiculo[troca.veiculoPlaca] = troca;
        }
    });
    
    const ultimasTrocas = Object.values(trocasPorVeiculo);
    const programadas = [];
    
    for (const troca of ultimasTrocas) {
        const kmAtual = obterKmAtualVeiculo(troca.veiculoPlaca);
        const proximaKm = troca.kmTroca + troca.intervaloProxima;
        const kmRestantes = proximaKm - kmAtual;
        
        if (kmRestantes <= 2000) {
            const veiculo = veiculos.find(v => v.placa === troca.veiculoPlaca);
            programadas.push({
                ...troca,
                kmAtual,
                kmRestantes,
                proximaKm,
                veiculoNome: veiculo ? `${troca.veiculoPlaca} - ${veiculo.nome || veiculo.modelo}` : troca.veiculoPlaca
            });
        }
    }
    
    programadas.sort((a, b) => a.kmRestantes - b.kmRestantes);
    
    for (const troca of programadas) {
        let classe = 'normal';
        if (troca.kmRestantes <= 0) classe = 'urgente';
        else if (troca.kmRestantes <= 50) classe = 'urgente';
        else if (troca.kmRestantes <= 100) classe = 'proximo';
        
        const card = document.createElement('div');
        card.className = `programada-card ${classe}`;
        card.innerHTML = `
            <div class="programada-header">
                <div class="programada-veiculo">${troca.veiculoNome}</div>
                <span class="programada-tipo">Troca de Óleo</span>
            </div>
            <div class="programada-detalhes">
                ${troca.kmRestantes <= 0 
                    ? `⚠️ VENCIDA há ${Math.abs(troca.kmRestantes).toLocaleString('pt-BR')} KM` 
                    : `📢 ${troca.kmRestantes.toLocaleString('pt-BR')} KM restantes`}
            </div>
            <div class="programada-km">
                <span>Última: ${troca.kmTroca.toLocaleString('pt-BR')} KM</span><br>
                <span>Próxima: ${troca.proximaKm.toLocaleString('pt-BR')} KM</span><br>
                <span>KM Atual: ${troca.kmAtual.toLocaleString('pt-BR')} KM</span>
            </div>
            <div class="programada-acoes">
                <button class="btn-sm btn-primary" onclick="verDetalhesTroca(${troca.id})">Detalhes</button>
                <button class="btn-sm btn-warning" onclick="abrirEdicaoTroca(${troca.id})">Editar</button>
                <button class="btn-sm btn-success" onclick="abrirNovaTroca('${troca.veiculoPlaca}')">Nova Troca</button>
            </div>
        `;
        container.appendChild(card);
    }
    
    document.getElementById('totalProgramadas').textContent = `${programadas.length} programada${programadas.length !== 1 ? 's' : ''}`;
}

// ================== FUNÇÕES DE EDIÇÃO E EXCLUSÃO ==================
function editarTrocaOleo(id) {
    const troca = trocasOleo.find(t => t.id === id);
    if (!troca) return;
    
    document.getElementById('trocaId').value = troca.id;
    document.getElementById('veiculoOleo').value = troca.veiculoPlaca;
    document.getElementById('dataTrocaOleo').value = troca.data;
    document.getElementById('kmTrocaOleo').value = troca.kmTroca;
    document.getElementById('tipoOleo').value = troca.tipoOleo;
    document.getElementById('marcaOleo').value = troca.marcaOleo || '';
    document.getElementById('viscosidadeOleo').value = troca.viscosidadeOleo || '';
    document.getElementById('quantidadeOleo').value = troca.quantidadeOleo || '';
    document.getElementById('intervaloProximaOleo').value = troca.intervaloProxima;
    document.getElementById('observacoesOleo').value = troca.observacoes || '';
    
    // Limpar e marcar filtros
    ['filtroOleo', 'filtroAr', 'filtroCombustivel', 'filtroArCondicionado', 'filtroHidraulico'].forEach(id => {
        document.getElementById(id).checked = false;
    });
    
    if (troca.filtros) {
        troca.filtros.forEach(f => {
            const map = {
                'filtro_oleo': 'filtroOleo',
                'filtro_ar': 'filtroAr',
                'filtro_combustivel': 'filtroCombustivel',
                'filtro_ar_condicionado': 'filtroArCondicionado',
                'filtro_hidraulico': 'filtroHidraulico'
            };
            if (map[f.tipo]) document.getElementById(map[f.tipo]).checked = true;
        });
    }
    
    document.getElementById('modalTrocaTitulo').innerHTML = '<i class="fas fa-edit"></i> Editar Troca de Óleo';
    document.getElementById('modalTrocaOleo').style.display = 'flex';
}

function editarManutencao(id) {
    const manutencao = manutencoes.find(m => m.id === id);
    if (!manutencao) return;
    
    document.getElementById('manutencaoId').value = manutencao.id;
    document.getElementById('veiculoManutencao').value = manutencao.veiculoPlaca;
    document.getElementById('tipoManutencao').value = manutencao.tipo;
    document.getElementById('dataManutencao').value = manutencao.data;
    document.getElementById('kmManutencao').value = manutencao.km || '';
    document.getElementById('descricaoManutencao').value = manutencao.descricao;
    document.getElementById('custoManutencao').value = manutencao.custo || '';
    document.getElementById('fornecedorManutencao').value = manutencao.fornecedor || '';
    document.getElementById('observacoesManutencao').value = manutencao.observacoes || '';
    
    document.getElementById('modalManutencaoTitulo').innerHTML = '<i class="fas fa-edit"></i> Editar Manutenção';
    document.getElementById('modalManutencaoGeral').style.display = 'flex';
}

async function excluirTrocaOleo(id) {
    if (!confirm('Excluir esta troca de óleo?')) return;
    
    const troca = trocasOleo.find(t => t.id === id);
    if (!troca) return;
    
    if (window.firebaseDB && troca.firebaseId) {
        await window.firebaseDB.collection('trocasOleo').doc(troca.firebaseId).delete();
    }
    
    trocasOleo = trocasOleo.filter(t => t.id !== id);
    localStorage.setItem('trocasOleo', JSON.stringify(trocasOleo));
    
    alert('Troca excluída!');
    await carregarTabelaOleo();
    await carregarProgramadas();
}

async function excluirManutencao(id) {
    if (!confirm('Excluir esta manutenção?')) return;
    
    const manutencao = manutencoes.find(m => m.id === id);
    if (!manutencao) return;
    
    if (window.firebaseDB && manutencao.firebaseId) {
        await window.firebaseDB.collection('manutencoes').doc(manutencao.firebaseId).delete();
    }
    
    manutencoes = manutencoes.filter(m => m.id !== id);
    localStorage.setItem('manutencoes', JSON.stringify(manutencoes));
    
    alert('Manutenção excluída!');
    await carregarTabelaManutencoes();
}

function abrirNovaTroca(placa) {
    document.getElementById('veiculoOleo').value = placa;
    document.getElementById('modalTrocaOleo').style.display = 'flex';
}

// ================== VERIFICAR ALERTAS ==================
async function verificarAlertas() {
    const alertas = [];
    
    const trocasPorVeiculo = {};
    trocasOleo.forEach(troca => {
        if (!trocasPorVeiculo[troca.veiculoPlaca] || 
            new Date(troca.data) > new Date(trocasPorVeiculo[troca.veiculoPlaca].data)) {
            trocasPorVeiculo[troca.veiculoPlaca] = troca;
        }
    });
    
    for (const [placa, troca] of Object.entries(trocasPorVeiculo)) {
        const kmAtual = obterKmAtualVeiculo(placa);
        const proximaKm = troca.kmTroca + troca.intervaloProxima;
        const kmRestantes = proximaKm - kmAtual;
        
        const veiculo = veiculos.find(v => v.placa === placa);
        const nomeVeiculo = veiculo ? `${placa} - ${veiculo.nome || veiculo.modelo}` : placa;
        
        if (kmRestantes <= 0) {
            alertas.push({
                tipo: 'urgente',
                texto: `${nomeVeiculo} - ⚠️ Troca VENCIDA há ${Math.abs(kmRestantes).toLocaleString('pt-BR')} KM`,
                id: troca.id
            });
        } else if (kmRestantes <= 50) {
            alertas.push({
                tipo: 'warning',
                texto: `${nomeVeiculo} - ⚠️ URGENTE! Troca em ${kmRestantes.toLocaleString('pt-BR')} KM`,
                id: troca.id
            });
        } else if (kmRestantes <= 100) {
            alertas.push({
                tipo: 'info',
                texto: `${nomeVeiculo} - 📢 Próxima troca em ${kmRestantes.toLocaleString('pt-BR')} KM`,
                id: troca.id
            });
        }
    }
    
    exibirAlertas(alertas);
}

function exibirAlertas(alertas) {
    const container = document.getElementById('alertasContainer');
    const card = document.getElementById('cardAlertas');
    if (!container || !card) return;
    
    container.innerHTML = '';
    
    if (alertas.length === 0) {
        container.innerHTML = '<div class="alerta-item info">✅ Nenhum alerta no momento</div>';
        card.style.display = 'block';
        return;
    }
    
    alertas.forEach(alerta => {
        const div = document.createElement('div');
        div.className = `alerta-item ${alerta.tipo}`;
        div.innerHTML = `
            <div class="alerta-info">
                <div class="alerta-descricao">${alerta.texto}</div>
            </div>
            <div class="alerta-acoes">
                <button class="btn-icon btn-sm" onclick="verDetalhesTroca(${alerta.id})"><i class="fas fa-eye"></i></button>
                <button class="btn-icon btn-sm" onclick="editarTrocaOleo(${alerta.id})"><i class="fas fa-edit"></i></button>
            </div>
        `;
        container.appendChild(div);
    });
    
    card.style.display = 'block';
}

// ================== FUNÇÕES DE DETALHES ==================
function verDetalhesTroca(id) {
    const troca = trocasOleo.find(t => t.id === id);
    if (!troca) return;
    
    const veiculo = veiculos.find(v => v.placa === troca.veiculoPlaca);
    const kmAtual = obterKmAtualVeiculo(troca.veiculoPlaca);
    const proximaKm = troca.kmTroca + troca.intervaloProxima;
    const kmRestantes = proximaKm - kmAtual;
    
    let statusHtml = '';
    if (kmRestantes <= 0) {
        statusHtml = `<span class="text-danger">VENCIDA há ${Math.abs(kmRestantes)} KM</span>`;
    } else if (kmRestantes <= 50) {
        statusHtml = `<span class="text-warning">URGENTE - ${kmRestantes} KM</span>`;
    } else {
        statusHtml = `<span class="text-success">${kmRestantes} KM restantes</span>`;
    }
    
    const html = `
        <h4>Detalhes da Troca de Óleo</h4>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">
            <div><strong>Veículo:</strong><br>${veiculo?.nome} (${troca.veiculoPlaca})</div>
            <div><strong>Data:</strong><br>${new Date(troca.data).toLocaleDateString('pt-BR')}</div>
            <div><strong>KM da Troca:</strong><br>${troca.kmTroca.toLocaleString('pt-BR')}</div>
            <div><strong>KM Atual:</strong><br>${kmAtual.toLocaleString('pt-BR')}</div>
            <div><strong>Tipo de Óleo:</strong><br>${troca.tipoOleo}</div>
            <div><strong>Marca:</strong><br>${troca.marcaOleo || '-'}</div>
            <div><strong>Intervalo:</strong><br>${troca.intervaloProxima.toLocaleString('pt-BR')} KM</div>
            <div><strong>Próxima Troca:</strong><br>${proximaKm.toLocaleString('pt-BR')} KM</div>
            <div><strong>Status:</strong><br>${statusHtml}</div>
        </div>
        <div class="form-actions" style="margin-top:20px;">
            <button class="btn btn-warning" onclick="editarTrocaOleo(${troca.id}); fecharModais();">Editar</button>
            <button class="btn btn-danger" onclick="excluirTrocaOleo(${troca.id}); fecharModais();">Excluir</button>
            <button class="btn btn-secondary" onclick="fecharModais()">Fechar</button>
        </div>
    `;
    
    document.getElementById('modalDetalhesBody').innerHTML = html;
    document.getElementById('modalDetalhes').style.display = 'flex';
}

function verDetalhesManutencao(id) {
    const manutencao = manutencoes.find(m => m.id === id);
    if (!manutencao) return;
    
    const veiculo = veiculos.find(v => v.placa === manutencao.veiculoPlaca);
    const tipoTraduzido = {
        'pneus': 'Pneus', 'freios': 'Freios', 'suspensao': 'Suspensão',
        'motor': 'Motor', 'bateria': 'Bateria', 'eletrica': 'Elétrica',
        'ar_condicionado': 'Ar Condicionado', 'corpo': 'Funilaria/Pintura',
        'preventiva': 'Preventiva', 'corretiva': 'Corretiva',
        'hidraulica': 'Hidráulica', 'outros': 'Outros'
    }[manutencao.tipo] || manutencao.tipo;
    
    const html = `
        <h4>Detalhes da Manutenção</h4>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">
            <div><strong>Veículo:</strong><br>${veiculo?.nome} (${manutencao.veiculoPlaca})</div>
            <div><strong>Tipo:</strong><br>${tipoTraduzido}</div>
            <div><strong>Data:</strong><br>${new Date(manutencao.data).toLocaleDateString('pt-BR')}</div>
            ${manutencao.km > 0 ? `<div><strong>KM/Hora:</strong><br>${manutencao.km.toLocaleString('pt-BR')}</div>` : ''}
            ${manutencao.custo > 0 ? `<div><strong>Custo:</strong><br>${manutencao.custo.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</div>` : ''}
            ${manutencao.fornecedor ? `<div><strong>Fornecedor:</strong><br>${manutencao.fornecedor}</div>` : ''}
        </div>
        <div><strong>Descrição:</strong><br>${manutencao.descricao}</div>
        <div class="form-actions" style="margin-top:20px;">
            <button class="btn btn-warning" onclick="editarManutencao(${manutencao.id}); fecharModais();">Editar</button>
            <button class="btn btn-danger" onclick="excluirManutencao(${manutencao.id}); fecharModais();">Excluir</button>
            <button class="btn btn-secondary" onclick="fecharModais()">Fechar</button>
        </div>
    `;
    
    document.getElementById('modalDetalhesBody').innerHTML = html;
    document.getElementById('modalDetalhes').style.display = 'flex';
}

// ================== EVENTOS ==================
function configurarEventos() {
    document.getElementById('btnNovaTrocaOleo')?.addEventListener('click', () => {
        document.getElementById('formTrocaOleo').reset();
        document.getElementById('trocaId').value = '';
        document.getElementById('modalTrocaTitulo').innerHTML = '<i class="fas fa-oil-can"></i> Nova Troca de Óleo';
        document.getElementById('modalTrocaOleo').style.display = 'flex';
    });
    
    document.getElementById('btnNovaManutencao')?.addEventListener('click', () => {
        document.getElementById('formManutencaoGeral').reset();
        document.getElementById('manutencaoId').value = '';
        document.getElementById('modalManutencaoTitulo').innerHTML = '<i class="fas fa-tools"></i> Nova Manutenção';
        document.getElementById('modalManutencaoGeral').style.display = 'flex';
    });
    
    document.getElementById('btnCheckAlertas')?.addEventListener('click', verificarAlertas);
    document.getElementById('btnFecharAlertas')?.addEventListener('click', () => {
        document.getElementById('cardAlertas').style.display = 'none';
    });
    
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', fecharModais);
    });
    
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) fecharModais();
        });
    });
    
    document.getElementById('formTrocaOleo')?.addEventListener('submit', salvarTrocaOleo);
    document.getElementById('formManutencaoGeral')?.addEventListener('submit', salvarManutencaoGeral);
    
    document.getElementById('filterOleo')?.addEventListener('input', filtrarTabelaOleo);
    document.getElementById('filterManutencoes')?.addEventListener('input', filtrarTabelaManutencoes);
}

function configurarAbas() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            document.getElementById(this.dataset.tab).classList.add('active');
        });
    });
}

function fecharModais() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
    document.body.style.overflow = 'auto';
}

function filtrarTabelaOleo() {
    const filtro = document.getElementById('filterOleo')?.value.toLowerCase() || '';
    const linhas = document.querySelectorAll('#tabelaOleoBody tr');
    linhas.forEach(linha => {
        const texto = linha.textContent.toLowerCase();
        linha.style.display = texto.includes(filtro) ? '' : 'none';
    });
}

function filtrarTabelaManutencoes() {
    const filtro = document.getElementById('filterManutencoes')?.value.toLowerCase() || '';
    const linhas = document.querySelectorAll('#tabelaManutencoesBody tr');
    linhas.forEach(linha => {
        const texto = linha.textContent.toLowerCase();
        linha.style.display = texto.includes(filtro) ? '' : 'none';
    });
}

// Exportar funções globais
window.editarTrocaOleo = editarTrocaOleo;
window.editarManutencao = editarManutencao;
window.excluirTrocaOleo = excluirTrocaOleo;
window.excluirManutencao = excluirManutencao;
window.verDetalhesTroca = verDetalhesTroca;
window.verDetalhesManutencao = verDetalhesManutencao;
window.fecharModais = fecharModais;
window.abrirNovaTroca = abrirNovaTroca;

// Inicializar
document.addEventListener('DOMContentLoaded', inicializar);
