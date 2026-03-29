// manut.js - VERSÃO COMPLETA COM CÁLCULO CORRIGIDO

// 1. VARIÁVEIS GLOBAIS
let trocasOleo = [];
let manutencoes = [];
let abastecimentos = [];

// 2. INICIALIZACAO 
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

async function carregarTodosDados() {
    // Carregar trocas de óleo
    if (window.firebaseDB) {
        try {
            const snapshot = await window.firebaseDB.collection('trocasOleo').orderBy('data', 'desc').get();
            trocasOleo = [];
            snapshot.forEach(doc => {
                trocasOleo.push({ firebaseId: doc.id, ...doc.data() });
            });
            console.log(`✅ ${trocasOleo.length} trocas do Firebase`);
        } catch (error) {
            console.error('Erro:', error);
            carregarTrocasLocal();
        }
    } else {
        carregarTrocasLocal();
    }
    
    // Carregar manutenções
    if (window.firebaseDB) {
        try {
            const snapshot = await window.firebaseDB.collection('manutencoes').orderBy('data', 'desc').get();
            manutencoes = [];
            snapshot.forEach(doc => {
                manutencoes.push({ firebaseId: doc.id, ...doc.data() });
            });
            console.log(`✅ ${manutencoes.length} manutenções do Firebase`);
        } catch (error) {
            console.error('Erro:', error);
            carregarManutencoesLocal();
        }
    } else {
        carregarManutencoesLocal();
    }
    
    // Carregar abastecimentos
    try {
        abastecimentos = JSON.parse(localStorage.getItem('abastecimentos')) || [];
    } catch (e) {
        abastecimentos = [];
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

function carregarManutencoesLocal() {
    try {
        manutencoes = JSON.parse(localStorage.getItem('manutencoes')) || [];
        console.log(`💾 ${manutencoes.length} manutenções do localStorage`);
    } catch (e) {
        manutencoes = [];
    }
}

async function salvarNoFirebase(colecao, dados) {
    if (!window.firebaseDB) return null;
    
    try {
        const { firebaseId, ...dadosParaSalvar } = dados;
        
        if (dados.firebaseId) {
            await window.firebaseDB.collection(colecao).doc(dados.firebaseId).update(dadosParaSalvar);
            console.log(`✅ Atualizado no Firebase: ${colecao}/${dados.firebaseId}`);
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

// ========== FUNÇÃO CORRIGIDA ==========
// Busca o KM/Hora do ÚLTIMO ABASTECIMENTO por DATA
function obterKmAtualVeiculo(placaVeiculo) {
    console.log(`🔍 Buscando KM atual para veículo: ${placaVeiculo}`);
    
    // 1. Buscar no localStorage de KM salvo manualmente
    const kmSalvo = localStorage.getItem(`km_atual_${placaVeiculo}`);
    if (kmSalvo) {
        console.log(`✅ KM manual encontrado: ${kmSalvo}`);
        return parseInt(kmSalvo);
    }
    
    // 2. Buscar no ÚLTIMO ABASTECIMENTO por DATA (CORRETO)
    if (abastecimentos && abastecimentos.length > 0) {
        // Filtrar abastecimentos do veículo
        const abastVeiculo = abastecimentos.filter(a => a.veiculoPlaca === placaVeiculo);
        
        console.log(`📊 Abastecimentos encontrados para ${placaVeiculo}: ${abastVeiculo.length}`);
        
        if (abastVeiculo.length > 0) {
            // ORDENAR POR DATA (mais recente primeiro)
            abastVeiculo.sort((a, b) => new Date(b.data) - new Date(a.data));
            const ultimo = abastVeiculo[0];
            
            // Buscar o KM/Hora (odometro para KM, horimetro para Horas)
            const km = ultimo.odometro || ultimo.horimetro || ultimo.kmAtual || 0;
            
            console.log(`✅ KM do último abastecimento (${ultimo.data}): ${km}`);
            console.log(`   Detalhes:`, { odometro: ultimo.odometro, horimetro: ultimo.horimetro });
            
            return km;
        }
    }
    
    // 3. Buscar na última troca de óleo
    const trocasVeiculo = trocasOleo.filter(t => t.veiculoPlaca === placaVeiculo);
    if (trocasVeiculo.length > 0) {
        trocasVeiculo.sort((a, b) => new Date(b.data) - new Date(a.data));
        const km = trocasVeiculo[0].kmTroca || 0;
        console.log(`✅ KM da última troca de óleo: ${km}`);
        return km;
    }
    
    console.log(`⚠️ Nenhum KM encontrado para ${placaVeiculo}, retornando 0`);
    return 0;
}

// 3. SALVAR TROCA DE ÓLEO
async function salvarTrocaOleo(e) {
    e.preventDefault();
    console.log('Salvando troca de óleo...');
    
    const trocaId = document.getElementById('trocaId').value;
    const isEdicao = trocaId !== '';
    
    const troca = {
        id: isEdicao ? parseInt(trocaId) : Date.now(),
        veiculoPlaca: document.getElementById('veiculoOleo').value,
        data: document.getElementById('dataTrocaOleo').value,
        kmTroca: parseInt(document.getElementById('kmTrocaOleo').value) || 0,
        tipoOleo: document.getElementById('tipoOleo').value,
        marcaOleo: document.getElementById('marcaOleo').value.trim(),
        viscosidadeOleo: document.getElementById('viscosidadeOleo').value.trim(),
        quantidadeOleo: parseFloat(document.getElementById('quantidadeOleo').value) || 0,
        intervaloProxima: parseInt(document.getElementById('intervaloProximaOleo').value) || 10000,
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
        if (document.getElementById(f.id).checked) {
            troca.filtros.push({
                tipo: f.nome,
                modelo: document.getElementById(f.modeloId).value.trim()
            });
        }
    });
    
    // Validações
    if (!troca.veiculoPlaca) { alert('Selecione um veículo'); return; }
    if (troca.kmTroca <= 0) { alert('Informe o KM/Hora da troca'); return; }
    if (!troca.tipoOleo) { alert('Selecione o tipo de óleo'); return; }
    if (troca.intervaloProxima <= 0) { alert('Informe o intervalo para próxima troca'); return; }
    
    // Se for edição, manter o firebaseId existente
    if (isEdicao) {
        const trocaExistente = trocasOleo.find(t => t.id === troca.id);
        if (trocaExistente && trocaExistente.firebaseId) {
            troca.firebaseId = trocaExistente.firebaseId;
        }
    }
    
    // Salvar no Firebase
    const firebaseId = await salvarNoFirebase('trocasOleo', troca);
    if (firebaseId) troca.firebaseId = firebaseId;
    
    // Atualizar array local
    if (isEdicao) {
        const index = trocasOleo.findIndex(t => t.id === troca.id);
        if (index !== -1) {
            trocasOleo[index] = troca;
        }
    } else {
        trocasOleo.push(troca);
    }
    
    localStorage.setItem('trocasOleo', JSON.stringify(trocasOleo));
    
    console.log(isEdicao ? 'Troca atualizada:' : 'Troca salva:', troca);
    alert(isEdicao ? 'Troca de óleo atualizada com sucesso!' : 'Troca de óleo registrada com sucesso!');
    
    limparFormTrocaOleo();
    fecharModais();
    
    await carregarTabelaOleo();
    await carregarProgramadas();
}

function limparFormTrocaOleo() {
    document.getElementById('formTrocaOleo').reset();
    document.getElementById('trocaId').value = '';
    document.getElementById('dataTrocaOleo').value = new Date().toISOString().split('T')[0];
    document.getElementById('intervaloProximaOleo').value = 10000;
    document.getElementById('modalTrocaTitulo').innerHTML = '<i class="fas fa-oil-can"></i> Nova Troca de Óleo';
}

function abrirEdicaoTroca(troca) {
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
    
    const filtrosIds = ['filtroOleo', 'filtroAr', 'filtroCombustivel', 'filtroArCondicionado', 'filtroHidraulico'];
    filtrosIds.forEach(id => {
        document.getElementById(id).checked = false;
        const modeloInput = document.getElementById(`modelo${id.charAt(0).toUpperCase() + id.slice(1)}`);
        if (modeloInput) modeloInput.value = '';
    });
    
    if (troca.filtros) {
        troca.filtros.forEach(filtro => {
            let checkboxId = '';
            let modeloId = '';
            
            switch(filtro.tipo) {
                case 'filtro_oleo': checkboxId = 'filtroOleo'; modeloId = 'modeloFiltroOleo'; break;
                case 'filtro_ar': checkboxId = 'filtroAr'; modeloId = 'modeloFiltroAr'; break;
                case 'filtro_combustivel': checkboxId = 'filtroCombustivel'; modeloId = 'modeloFiltroCombustivel'; break;
                case 'filtro_ar_condicionado': checkboxId = 'filtroArCondicionado'; modeloId = 'modeloFiltroArCondicionado'; break;
                case 'filtro_hidraulico': checkboxId = 'filtroHidraulico'; modeloId = 'modeloFiltroHidraulico'; break;
            }
            
            if (checkboxId) {
                document.getElementById(checkboxId).checked = true;
                if (filtro.modelo) {
                    document.getElementById(modeloId).value = filtro.modelo;
                }
            }
        });
    }
    
    document.getElementById('modalTrocaTitulo').innerHTML = '<i class="fas fa-edit"></i> Editar Troca de Óleo';
    abrirModal('modalTrocaOleo');
}

// 4. SALVAR MANUTENÇÃO GERAL
async function salvarManutencaoGeral(e) {
    e.preventDefault();
    console.log('Salvando manutenção...');
    
    const manutencaoId = document.getElementById('manutencaoId').value;
    const isEdicao = manutencaoId !== '';
    
    const manutencao = {
        id: isEdicao ? parseInt(manutencaoId) : Date.now(),
        veiculoPlaca: document.getElementById('veiculoManutencao').value,
        tipo: document.getElementById('tipoManutencao').value,
        data: document.getElementById('dataManutencao').value,
        km: parseInt(document.getElementById('kmManutencao').value) || 0,
        descricao: document.getElementById('descricaoManutencao').value.trim(),
        custo: parseFloat(document.getElementById('custoManutencao').value) || 0,
        fornecedor: document.getElementById('fornecedorManutencao').value.trim(),
        observacoes: document.getElementById('observacoesManutencao').value.trim(),
        dataRegistro: new Date().toISOString()
    };
    
    if (!manutencao.veiculoPlaca) { alert('Selecione um veículo'); return; }
    if (!manutencao.tipo) { alert('Selecione o tipo de manutenção'); return; }
    if (!manutencao.descricao) { alert('Informe a descrição da manutenção'); return; }
    
    if (isEdicao) {
        const manutExistente = manutencoes.find(m => m.id === manutencao.id);
        if (manutExistente && manutExistente.firebaseId) {
            manutencao.firebaseId = manutExistente.firebaseId;
        }
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
    
    console.log(isEdicao ? 'Manutenção atualizada:' : 'Manutenção salva:', manutencao);
    alert(isEdicao ? 'Manutenção atualizada com sucesso!' : 'Manutenção registrada com sucesso!');
    
    limparFormManutencao();
    fecharModais();
    await carregarTabelaManutencoes();
}

function limparFormManutencao() {
    document.getElementById('formManutencaoGeral').reset();
    document.getElementById('manutencaoId').value = '';
    document.getElementById('dataManutencao').value = new Date().toISOString().split('T')[0];
    document.getElementById('modalManutencaoTitulo').innerHTML = '<i class="fas fa-tools"></i> Nova Manutenção';
}

function abrirEdicaoManutencao(manutencao) {
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
    abrirModal('modalManutencaoGeral');
}

// 5. CARREGAR TABELA DE ÓLEO (COM CÁLCULO CORRIGIDO)
async function carregarTabelaOleo() {
    const tbody = document.getElementById('tabelaOleoBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (trocasOleo.length === 0) {
        tbody.innerHTML = `发展<td colspan="7" class="text-center">Nenhuma troca de óleo registrada.发展</td></tr>`;
        document.getElementById('totalTrocasOleo').textContent = '0 trocas';
        return;
    }
    
    trocasOleo.sort((a, b) => new Date(b.data) - new Date(a.data));
    
    let veiculos = [];
    try {
        veiculos = JSON.parse(localStorage.getItem('veiculos')) || [];
    } catch (e) {}
    
    for (const troca of trocasOleo) {
        const veiculo = veiculos.find(v => v.placa === troca.veiculoPlaca);
        const nomeVeiculo = veiculo ? `${troca.veiculoPlaca} - ${veiculo.nome || veiculo.modelo}` : troca.veiculoPlaca;
        const dataFormatada = new Date(troca.data).toLocaleDateString('pt-BR');
        
        const kmAtual = obterKmAtualVeiculo(troca.veiculoPlaca);
        const proximaKm = troca.kmTroca + troca.intervaloProxima;
        const kmRestantes = proximaKm - kmAtual; // CORRETO: subtrai atual do próximo
        
        console.log(`🔧 ${troca.veiculoPlaca}: Troca=${troca.kmTroca}, Atual=${kmAtual}, Próx=${proximaKm}, Restam=${kmRestantes}`);
        
        let proximaInfo = '-';
        let statusClass = '';
        
        if (kmRestantes <= 0) {
            proximaInfo = `<span class="text-danger">⚠️ VENCIDA há ${Math.abs(kmRestantes).toLocaleString('pt-BR')} KM</span>`;
            statusClass = 'status-atrasada';
        } else if (kmRestantes <= 50) {
            proximaInfo = `<span class="text-warning">⚠️ URGENTE! ${kmRestantes.toLocaleString('pt-BR')} KM</span>`;
            statusClass = 'status-urgente';
        } else if (kmRestantes <= 100) {
            proximaInfo = `<span class="text-info">📢 Próxima em ${kmRestantes.toLocaleString('pt-BR')} KM</span>`;
            statusClass = 'status-proximo';
        } else {
            proximaInfo = `<span class="text-success">✅ ${kmRestantes.toLocaleString('pt-BR')} KM</span>`;
            statusClass = 'status-ok';
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
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${dataFormatada}</td>
            <td><strong>${nomeVeiculo}</strong></td>
            <td>${troca.kmTroca.toLocaleString('pt-BR')}</td>
            <td>${troca.tipoOleo}${troca.marcaOleo ? ` - ${troca.marcaOleo}` : ''}</td>
            <td>${filtrosInfo}</td>
            <td class="${statusClass}">${proximaInfo}</td>
            <td class="actions">
                <button class="btn-icon btn-edit" onclick="abrirEdicaoTroca(${JSON.stringify(troca).replace(/"/g, '&quot;')})" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon btn-info" onclick="verDetalhesTroca(${troca.id})" title="Ver detalhes">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn-icon btn-delete" onclick="excluirTrocaOleo(${troca.id})" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    }
    
    document.getElementById('totalTrocasOleo').textContent = `${trocasOleo.length} troca${trocasOleo.length !== 1 ? 's' : ''}`;
}

// 6. CARREGAR TABELA DE MANUTENÇÕES
async function carregarTabelaManutencoes() {
    const tbody = document.getElementById('tabelaManutencoesBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (manutencoes.length === 0) {
        tbody.innerHTML = `发展<td colspan="6" class="text-center">Nenhuma manutenção registrada.</td></tr>`;
        document.getElementById('totalManutencoes').textContent = '0 manutenções';
        return;
    }
    
    manutencoes.sort((a, b) => new Date(b.data) - new Date(a.data));
    const veiculos = JSON.parse(localStorage.getItem('veiculos')) || [];
    
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
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${dataFormatada}</td>
            <td><strong>${nomeVeiculo}</strong></td>
            <td>${tipoTraduzido}</td>
            <td>${manutencao.descricao.length > 50 ? manutencao.descricao.substring(0, 50) + '...' : manutencao.descricao}</td>
            <td>${manutencao.custo > 0 ? manutencao.custo.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) : '-'}</td>
            <td class="actions">
                <button class="btn-icon btn-edit" onclick="abrirEdicaoManutencao(${JSON.stringify(manutencao).replace(/"/g, '&quot;')})" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon btn-info" onclick="verDetalhesManutencao(${manutencao.id})" title="Ver detalhes">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn-icon btn-delete" onclick="excluirManutencao(${manutencao.id})" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    }
    
    document.getElementById('totalManutencoes').textContent = `${manutencoes.length} manutenção${manutencoes.length !== 1 ? 'ões' : ''}`;
}

// 7. CARREGAR PROGRAMADAS (COM CÁLCULO CORRIGIDO)
async function carregarProgramadas() {
    const container = document.getElementById('programadasContainer');
    if (!container) return;
    
    container.innerHTML = "";
    
    if (trocasOleo.length === 0) {
        container.innerHTML = '<div class="text-center">Nenhuma manutenção programada</div>';
        document.getElementById('totalProgramadas').textContent = '0 programadas';
        return;
    }
    
    const trocasPorVeiculo = {};
    trocasOleo.forEach(troca => {
        if (!trocasPorVeiculo[troca.veiculoPlaca] || 
            new Date(troca.data) > new Date(trocasPorVeiculo[troca.veiculoPlaca].data)) {
            trocasPorVeiculo[troca.veiculoPlaca] = troca;
        }
    });
    
    const ultimasTrocas = Object.values(trocasPorVeiculo);
    const veiculos = JSON.parse(localStorage.getItem('veiculos')) || [];
    const programadas = [];
    
    for (const troca of ultimasTrocas) {
        const kmAtual = obterKmAtualVeiculo(troca.veiculoPlaca);
        const proximaKm = troca.kmTroca + troca.intervaloProxima;
        const kmRestantes = proximaKm - kmAtual; // CORRETO
        
        console.log(`📅 Programada: ${troca.veiculoPlaca} - Atual=${kmAtual}, Próx=${proximaKm}, Restam=${kmRestantes}`);
        
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
                <button class="btn btn-sm btn-primary" onclick="verDetalhesTroca(${troca.id})">
                    <i class="fas fa-eye"></i> Detalhes
                </button>
                <button class="btn btn-sm btn-warning" onclick="abrirEdicaoTroca(${JSON.stringify(troca).replace(/"/g, '&quot;')})">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="btn btn-sm btn-success" onclick="abrirModal('modalTrocaOleo'); document.getElementById('veiculoOleo').value='${troca.veiculoPlaca}';">
                    <i class="fas fa-check"></i> Registrar Nova
                </button>
            </div>
        `;
        container.appendChild(card);
    }
    
    document.getElementById('totalProgramadas').textContent = `${programadas.length} programada${programadas.length !== 1 ? 's' : ''}`;
}

// 8. EXCLUIR TROCA
window.excluirTrocaOleo = async function(id) {
    if (!confirm('Tem certeza que deseja excluir esta troca de óleo?')) return;
    
    const troca = trocasOleo.find(t => t.id === id);
    if (!troca) return;
    
    if (window.firebaseDB && troca.firebaseId) {
        try {
            await window.firebaseDB.collection('trocasOleo').doc(troca.firebaseId).delete();
            console.log('🗑️ Excluído do Firebase');
        } catch (error) {
            console.error('Erro:', error);
        }
    }
    
    trocasOleo = trocasOleo.filter(t => t.id !== id);
    localStorage.setItem('trocasOleo', JSON.stringify(trocasOleo));
    
    alert('Troca de óleo excluída!');
    await carregarTabelaOleo();
    await carregarProgramadas();
};

// 9. EXCLUIR MANUTENÇÃO
window.excluirManutencao = async function(id) {
    if (!confirm('Tem certeza que deseja excluir esta manutenção?')) return;
    
    const manutencao = manutencoes.find(m => m.id === id);
    if (!manutencao) return;
    
    if (window.firebaseDB && manutencao.firebaseId) {
        try {
            await window.firebaseDB.collection('manutencoes').doc(manutencao.firebaseId).delete();
            console.log('🗑️ Excluído do Firebase');
        } catch (error) {
            console.error('Erro:', error);
        }
    }
    
    manutencoes = manutencoes.filter(m => m.id !== id);
    localStorage.setItem('manutencoes', JSON.stringify(manutencoes));
    
    alert('Manutenção excluída!');
    await carregarTabelaManutencoes();
};

// 10. VERIFICAR ALERTAS (COM CÁLCULO CORRIGIDO)
async function verificarAlertas() {
    const alertas = [];
    
    const trocasPorVeiculo = {};
    trocasOleo.forEach(troca => {
        if (!trocasPorVeiculo[troca.veiculoPlaca] || 
            new Date(troca.data) > new Date(trocasPorVeiculo[troca.veiculoPlaca].data)) {
            trocasPorVeiculo[troca.veiculoPlaca] = troca;
        }
    });
    
    const veiculos = JSON.parse(localStorage.getItem('veiculos')) || [];
    
    for (const [placa, troca] of Object.entries(trocasPorVeiculo)) {
        const kmAtual = obterKmAtualVeiculo(placa);
        const proximaKm = troca.kmTroca + troca.intervaloProxima;
        const kmRestantes = proximaKm - kmAtual; // CORRETO
        
        console.log(`🔔 Alerta ${placa}: Atual=${kmAtual}, Próx=${proximaKm}, Restam=${kmRestantes}`);
        
        const veiculo = veiculos.find(v => v.placa === placa);
        const nomeVeiculo = veiculo ? `${placa} - ${veiculo.nome || veiculo.modelo}` : placa;
        
        if (kmRestantes <= 0) {
            alertas.push({
                tipo: 'urgente',
                texto: `${nomeVeiculo} - ⚠️ Troca de óleo VENCIDA há ${Math.abs(kmRestantes).toLocaleString('pt-BR')} KM/Horas`,
                id: troca.id
            });
        } else if (kmRestantes <= 50) {
            alertas.push({
                tipo: 'warning',
                texto: `${nomeVeiculo} - ⚠️ URGENTE! Troca em ${kmRestantes.toLocaleString('pt-BR')} KM/Horas`,
                id: troca.id
            });
        } else if (kmRestantes <= 100) {
            alertas.push({
                tipo: 'info',
                texto: `${nomeVeiculo} - 📢 Próxima troca em ${kmRestantes.toLocaleString('pt-BR')} KM/Horas`,
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
                <button class="btn-icon btn-sm btn-primary" onclick="verDetalhesTroca(${alerta.id})" title="Ver detalhes">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn-icon btn-sm btn-warning" onclick="abrirEdicaoTroca(${JSON.stringify(trocasOleo.find(t => t.id === alerta.id)).replace(/"/g, '&quot;')})" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
            </div>
        `;
        container.appendChild(div);
    });
    
    card.style.display = 'block';
}

// 11. FUNÇÕES AUXILIARES
function preencherVeiculos(idSelect) {
    const select = document.getElementById(idSelect);
    if (!select) return;
    
    try {
        const veiculos = JSON.parse(localStorage.getItem('veiculos')) || [];
        select.innerHTML = '<option value="">Selecione um veículo...</option>';
        
        veiculos.forEach(veiculo => {
            const option = document.createElement('option');
            option.value = veiculo.placa;
            option.textContent = `${veiculo.placa} - ${veiculo.nome || veiculo.modelo}`;
            select.appendChild(option);
        });
    } catch (e) {
        console.error('Erro:', e);
    }
}

function configurarEventos() {
    const btnTrocaOleo = document.getElementById('btnNovaTrocaOleo');
    if (btnTrocaOleo) {
        btnTrocaOleo.addEventListener('click', function() {
            limparFormTrocaOleo();
            preencherVeiculos('veiculoOleo');
            abrirModal('modalTrocaOleo');
        });
    }
    
    const btnManutencao = document.getElementById('btnNovaManutencao');
    if (btnManutencao) {
        btnManutencao.addEventListener('click', function() {
            limparFormManutencao();
            preencherVeiculos('veiculoManutencao');
            abrirModal('modalManutencaoGeral');
        });
    }
    
    const btnCheckAlertas = document.getElementById('btnCheckAlertas');
    if (btnCheckAlertas) btnCheckAlertas.addEventListener('click', verificarAlertas);
    
    const btnFecharAlertas = document.getElementById('btnFecharAlertas');
    if (btnFecharAlertas) {
        btnFecharAlertas.addEventListener('click', function() {
            document.getElementById('cardAlertas').style.display = 'none';
        });
    }
    
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', fecharModais);
    });
    
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) fecharModais();
        });
    });
    
    const formTrocaOleo = document.getElementById('formTrocaOleo');
    if (formTrocaOleo) formTrocaOleo.addEventListener('submit', salvarTrocaOleo);
    
    const formManutencao = document.getElementById('formManutencaoGeral');
    if (formManutencao) formManutencao.addEventListener('submit', salvarManutencaoGeral);
    
    const filterOleo = document.getElementById('filterOleo');
    if (filterOleo) filterOleo.addEventListener('input', filtrarTabelaOleo);
    
    const filterManutencoes = document.getElementById('filterManutencoes');
    if (filterManutencoes) filterManutencoes.addEventListener('input', filtrarTabelaManutencoes);
}

function abrirModal(idModal) {
    const modal = document.getElementById(idModal);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function fecharModais() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
    document.body.style.overflow = 'auto';
}

function configurarAbas() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            const tabId = this.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });
}

function filtrarTabelaOleo() {
    const filtro = document.getElementById('filterOleo').value.toLowerCase();
    const linhas = document.querySelectorAll('#tabelaOleoBody tr');
    linhas.forEach(linha => {
        const texto = linha.textContent.toLowerCase();
        linha.style.display = texto.includes(filtro) ? '' : 'none';
    });
}

function filtrarTabelaManutencoes() {
    const filtro = document.getElementById('filterManutencoes').value.toLowerCase();
    const linhas = document.querySelectorAll('#tabelaManutencoesBody tr');
    linhas.forEach(linha => {
        const texto = linha.textContent.toLowerCase();
        linha.style.display = texto.includes(filtro) ? '' : 'none';
    });
}

// 12. FUNÇÕES DE DETALHES
window.verDetalhesTroca = function(id) {
    const troca = trocasOleo.find(t => t.id === id);
    if (!troca) return;
    
    const veiculos = JSON.parse(localStorage.getItem('veiculos')) || [];
    const veiculo = veiculos.find(v => v.placa === troca.veiculoPlaca);
    const dataFormatada = new Date(troca.data).toLocaleDateString('pt-BR');
    const kmAtual = obterKmAtualVeiculo(troca.veiculoPlaca);
    const proximaKm = troca.kmTroca + troca.intervaloProxima;
    const kmRestantes = proximaKm - kmAtual; // CORRETO
    
    let statusHtml = '';
    if (kmRestantes <= 0) {
        statusHtml = `<span class="text-danger">⚠️ VENCIDA há ${Math.abs(kmRestantes).toLocaleString('pt-BR')} KM</span>`;
    } else if (kmRestantes <= 50) {
        statusHtml = `<span class="text-warning">⚠️ URGENTE - ${kmRestantes.toLocaleString('pt-BR')} KM</span>`;
    } else if (kmRestantes <= 100) {
        statusHtml = `<span class="text-info">📢 Próxima em ${kmRestantes.toLocaleString('pt-BR')} KM</span>`;
    } else {
        statusHtml = `<span class="text-success">✅ ${kmRestantes.toLocaleString('pt-BR')} KM restantes</span>`;
    }
    
    let html = `
        <h4><i class="fas fa-oil-can"></i> Detalhes da Troca de Óleo</h4>
        <div class="detalhes-grid">
            <div class="detalhe-item"><label>Veículo:</label><div><strong>${veiculo ? `${troca.veiculoPlaca} - ${veiculo.nome || veiculo.modelo}` : troca.veiculoPlaca}</strong></div></div>
            <div class="detalhe-item"><label>Data:</label><div>${dataFormatada}</div></div>
            <div class="detalhe-item"><label>KM da Troca:</label><div>${troca.kmTroca.toLocaleString('pt-BR')}</div></div>
            <div class="detalhe-item"><label>KM Atual:</label><div>${kmAtual.toLocaleString('pt-BR')}</div></div>
            <div class="detalhe-item"><label>Tipo de Óleo:</label><div>${troca.tipoOleo}</div></div>
            ${troca.marcaOleo ? `<div class="detalhe-item"><label>Marca:</label><div>${troca.marcaOleo}</div></div>` : ''}
            ${troca.viscosidadeOleo ? `<div class="detalhe-item"><label>Viscosidade:</label><div>${troca.viscosidadeOleo}</div></div>` : ''}
            ${troca.quantidadeOleo > 0 ? `<div class="detalhe-item"><label>Quantidade:</label><div>${troca.quantidadeOleo}L</div></div>` : ''}
            <div class="detalhe-item"><label>Intervalo:</label><div>${troca.intervaloProxima.toLocaleString('pt-BR')} KM/Horas</div></div>
            <div class="detalhe-item"><label>Próxima Troca:</label><div>${proximaKm.toLocaleString('pt-BR')} KM/Horas</div></div>
            <div class="detalhe-item"><label>Status:</label><div>${statusHtml}</div></div>
        </div>
    `;
    
    if (troca.filtros?.length > 0) {
        html += `<div class="detalhe-item"><label>Filtros Trocados:</label><div>`;
        troca.filtros.forEach(filtro => {
            const tipos = {
                'filtro_oleo': 'Filtro de Óleo', 'filtro_ar': 'Filtro de Ar',
                'filtro_combustivel': 'Filtro de Combustível',
                'filtro_ar_condicionado': 'Filtro de Ar Condicionado',
                'filtro_hidraulico': 'Filtro Hidráulico'
            };
            html += `${tipos[filtro.tipo] || filtro.tipo}${filtro.modelo ? ` (${filtro.modelo})` : ''}<br>`;
        });
        html += `</div></div>`;
    }
    
    if (troca.observacoes) {
        html += `<div class="detalhe-item"><label>Observações:</label><div>${troca.observacoes}</div></div>`;
    }
    
    html += `
        <div class="form-actions" style="margin-top: 20px;">
            <button class="btn btn-warning" onclick="abrirEdicaoTroca(${JSON.stringify(troca).replace(/"/g, '&quot;')}); fecharModais();">
                <i class="fas fa-edit"></i> Editar
            </button>
            <button class="btn btn-danger" onclick="excluirTrocaOleo(${troca.id}); fecharModais();">
                <i class="fas fa-trash"></i> Excluir
            </button>
            <button class="btn btn-secondary" onclick="fecharModais()">
                <i class="fas fa-times"></i> Fechar
            </button>
        </div>
    `;
    
    document.getElementById('modalDetalhesBody').innerHTML = html;
    document.getElementById('modalDetalhes').style.display = 'flex';
};

window.verDetalhesManutencao = function(id) {
    const manutencao = manutencoes.find(m => m.id === id);
    if (!manutencao) return;
    
    const veiculos = JSON.parse(localStorage.getItem('veiculos')) || [];
    const veiculo = veiculos.find(v => v.placa === manutencao.veiculoPlaca);
    const dataFormatada = new Date(manutencao.data).toLocaleDateString('pt-BR');
    
    const tipoTraduzido = {
        'pneus': 'Pneus', 'freios': 'Freios', 'suspensao': 'Suspensão',
        'motor': 'Motor', 'bateria': 'Bateria', 'eletrica': 'Elétrica',
        'ar_condicionado': 'Ar Condicionado', 'corpo': 'Funilaria/Pintura',
        'preventiva': 'Preventiva', 'corretiva': 'Corretiva',
        'hidraulica': 'Hidráulica', 'outros': 'Outros'
    }[manutencao.tipo] || manutencao.tipo;
    
    let html = `
        <h4><i class="fas fa-tools"></i> Detalhes da Manutenção</h4>
        <div class="detalhes-grid">
            <div class="detalhe-item"><label>Veículo:</label><div><strong>${veiculo ? `${manutencao.veiculoPlaca} - ${veiculo.nome || veiculo.modelo}` : manutencao.veiculoPlaca}</strong></div></div>
            <div class="detalhe-item"><label>Tipo:</label><div>${tipoTraduzido}</div></div>
            <div class="detalhe-item"><label>Data:</label><div>${dataFormatada}</div></div>
            ${manutencao.km > 0 ? `<div class="detalhe-item"><label>KM/Hora:</label><div>${manutencao.km.toLocaleString('pt-BR')}</div></div>` : ''}
            ${manutencao.custo > 0 ? `<div class="detalhe-item"><label>Custo:</label><div>${manutencao.custo.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</div></div>` : ''}
            ${manutencao.fornecedor ? `<div class="detalhe-item"><label>Fornecedor:</label><div>${manutencao.fornecedor}</div></div>` : ''}
        </div>
        <div class="detalhe-item"><label>Descrição:</label><div>${manutencao.descricao}</div></div>
    `;
    
    if (manutencao.observacoes) {
        html += `<div class="detalhe-item"><label>Observações:</label><div>${manutencao.observacoes}</div></div>`;
    }
    
    html += `
        <div class="form-actions" style="margin-top: 20px;">
            <button class="btn btn-warning" onclick="abrirEdicaoManutencao(${JSON.stringify(manutencao).replace(/"/g, '&quot;')}); fecharModais();">
                <i class="fas fa-edit"></i> Editar
            </button>
            <button class="btn btn-danger" onclick="excluirManutencao(${manutencao.id}); fecharModais();">
                <i class="fas fa-trash"></i> Excluir
            </button>
            <button class="btn btn-secondary" onclick="fecharModais()">
                <i class="fas fa-times"></i> Fechar
            </button>
        </div>
    `;
    
    document.getElementById('modalDetalhesBody').innerHTML = html;
    document.getElementById('modalDetalhes').style.display = 'flex';
};

// Exportar funções para uso global
window.abrirEdicaoTroca = abrirEdicaoTroca;
window.abrirEdicaoManutencao = abrirEdicaoManutencao;
window.fecharModais = fecharModais;
window.abrirModal = abrirModal;
window.obterKmAtualVeiculo = obterKmAtualVeiculo;

// Inicializar
document.addEventListener('DOMContentLoaded', inicializar);