// ==========================================================================
// manut.js - Gerenciador de Manutenção (Versão 100% Firebase)
// Sem localStorage - Dados sempre do Firebase
// ==========================================================================

// ================== VARIÁVEIS GLOBAIS ==================
let manutencoes = [];
let manutencoesCorretivas = [];
let veiculos = [];
let tiposManutencao = {};
let editingId = null;
let editingCorretivaId = null;

// ================== REFERÊNCIA DO FIREBASE ==================
function getDB() {
    return window.db || window.firebaseDB || null;
}

// ================== INICIALIZAÇÃO ==================
async function inicializar() {
    console.log('🚀 Inicializando sistema de manutenção (Cloud Mode)...');
    
    const db = getDB();
    if (!db) {
        console.error('❌ Firebase não disponível');
        alert('Sistema requer Firebase. Verifique sua conexão.');
        return;
    }
    
    await carregarVeiculos();
    await carregarManutencoes();
    await carregarTiposConfig();
    await carregarManutencoesCorretivas();
    
    configurarEventos();
    configurarAbas();
    
    await renderPreventivas();
    await renderProximas();
    await renderVeiculosList();
    await renderCorretivas();
    
    console.log('✅ Sistema de manutenção pronto!');
    console.log('   🚗 ' + veiculos.length + ' veículos');
    console.log('   🔧 ' + manutencoes.length + ' preventivas');
    console.log('   🛠️ ' + manutencoesCorretivas.length + ' corretivas');
}

// ================== CARREGAR DADOS (APENAS FIREBASE) ==================
async function carregarVeiculos() {
    const db = getDB();
    if (!db) {
        veiculos = [];
        return;
    }
    
    try {
        const snapshot = await db.collection('veiculos').get();
        veiculos = [];
        snapshot.forEach(doc => {
            veiculos.push({ firebaseId: doc.id, id: doc.id, ...doc.data() });
        });
        console.log(`✅ ${veiculos.length} veículos carregados do Firebase`);
        atualizarSelectsVeiculos();
    } catch (error) {
        console.error('❌ Erro ao carregar veículos:', error);
        veiculos = [];
    }
}

async function carregarManutencoes() {
    const db = getDB();
    if (!db) {
        manutencoes = [];
        return;
    }
    
    try {
        const snapshot = await db.collection('manutencoes')
            .orderBy('data', 'desc')
            .get();
        manutencoes = [];
        snapshot.forEach(doc => {
            manutencoes.push({ firebaseId: doc.id, id: doc.id, ...doc.data() });
        });
        console.log(`✅ ${manutencoes.length} manutenções preventivas do Firebase`);
    } catch (error) {
        console.error('❌ Erro ao carregar manutenções:', error);
        manutencoes = [];
    }
}

async function carregarManutencoesCorretivas() {
    const db = getDB();
    if (!db) {
        manutencoesCorretivas = [];
        return;
    }
    
    try {
        const snapshot = await db.collection('manutencoesCorretivas')
            .orderBy('data', 'desc')
            .get();
        manutencoesCorretivas = [];
        snapshot.forEach(doc => {
            manutencoesCorretivas.push({ firebaseId: doc.id, id: doc.id, ...doc.data() });
        });
        console.log(`✅ ${manutencoesCorretivas.length} manutenções corretivas do Firebase`);
    } catch (error) {
        console.error('❌ Erro ao carregar corretivas:', error);
        manutencoesCorretivas = [];
    }
}

async function carregarTiposConfig() {
    const db = getDB();
    if (!db) {
        tiposManutencao = {};
        return;
    }
    
    try {
        const snapshot = await db.collection('tiposManutencao').get();
        tiposManutencao = {};
        snapshot.forEach(doc => {
            tiposManutencao[doc.id] = doc.data().tipos || doc.data();
        });
        console.log(`✅ Tipos de manutenção carregados do Firebase`);
    } catch (error) {
        console.error('❌ Erro ao carregar tipos:', error);
        tiposManutencao = {};
    }
}

// ================== FUNÇÕES AUXILIARES ==================
// Buscar KM atual do veículo DIRETO do Firebase
async function obterKmAtualVeiculo(placa) {
    const db = getDB();
    if (!db) return 0;
    
    try {
        // 1. Buscar do último abastecimento no Firebase
        const snapshot = await db.collection('abastecimentos')
            .where('veiculoPlaca', '==', placa)
            .orderBy('data', 'desc')
            .limit(1)
            .get();
        
        if (!snapshot.empty) {
            const ultimoAbast = snapshot.docs[0].data();
            const km = ultimoAbast.odometro || ultimoAbast.horimetro || 0;
            if (km > 0) return km;
        }
        
        // 2. Buscar da última manutenção preventiva
        const manutVeiculo = manutencoes
            .filter(m => m.veiculoPlaca === placa)
            .sort((a, b) => new Date(b.data) - new Date(a.data));
        
        if (manutVeiculo.length > 0) {
            return manutVeiculo[0].kmAtual || 0;
        }
        
        return 0;
    } catch (error) {
        console.error('❌ Erro ao buscar KM:', error);
        return 0;
    }
}

// Versão síncrona para renderização (usa cache da memória)
function obterKmAtualVeiculoCache(placa) {
    // Buscar no array de manutenções (já carregado em memória)
    const manutVeiculo = manutencoes
        .filter(m => m.veiculoPlaca === placa)
        .sort((a, b) => new Date(b.data) - new Date(a.data));
    
    if (manutVeiculo.length > 0) {
        return manutVeiculo[0].kmAtual || 0;
    }
    
    return 0;
}

function getUltimaManutencaoPorVeiculoTipo() {
    const ultimas = {};
    for (const m of manutencoes) {
        const key = `${m.veiculoPlaca}_${m.tipo}`;
        if (!ultimas[key] || new Date(m.data) > new Date(ultimas[key].data)) {
            ultimas[key] = m;
        }
    }
    return ultimas;
}

function atualizarSelectsVeiculos() {
    const selects = ['preventivaVeiculo', 'corretivaVeiculo', 'configVeiculoSelect'];
    selects.forEach(id => {
        const select = document.getElementById(id);
        if (select) {
            select.innerHTML = '<option value="">Selecione um veículo...</option>';
            veiculos.forEach(v => {
                const nome = v.nome || v.modelo || 'Sem nome';
                select.innerHTML += `<option value="${v.placa}">${v.placa} - ${nome}</option>`;
            });
        }
    });
}

function atualizarSelectTiposPreventiva() {
    const veiculoPlaca = document.getElementById('preventivaVeiculo')?.value;
    const select = document.getElementById('preventivaTipo');
    if (!select) return;
    
    if (!veiculoPlaca) {
        select.innerHTML = '<option value="">Selecione primeiro o veículo</option>';
        return;
    }
    
    const tipos = tiposManutencao[veiculoPlaca] || [];
    if (tipos.length === 0) {
        select.innerHTML = '<option value="">Nenhum tipo configurado</option>';
    } else {
        select.innerHTML = '<option value="">Selecione...</option>' + 
            tipos.map(t => `<option value="${t.nome}">${t.nome} (${t.intervalo})</option>`).join('');
    }
}

// ================== SALVAR NO FIREBASE ==================
async function salvarNoFirebase(colecao, dados) {
    const db = getDB();
    if (!db) {
        console.error('❌ Firebase não disponível');
        return null;
    }
    
    try {
        const { firebaseId, id, ...dadosSalvar } = dados;
        
        // Adicionar timestamp
        dadosSalvar.ultimaAtualizacao = firebase.firestore.FieldValue.serverTimestamp();
        
        if (firebaseId) {
            // Atualizar existente
            await db.collection(colecao).doc(firebaseId).update(dadosSalvar);
            console.log(`✅ Atualizado em ${colecao}: ${firebaseId}`);
            return firebaseId;
        } else {
            // Criar novo
            dadosSalvar.dataRegistro = firebase.firestore.FieldValue.serverTimestamp();
            const docRef = await db.collection(colecao).add(dadosSalvar);
            console.log(`✅ Criado em ${colecao}: ${docRef.id}`);
            return docRef.id;
        }
    } catch (error) {
        console.error(`❌ Erro ao salvar em ${colecao}:`, error);
        return null;
    }
}

async function excluirDoFirebase(colecao, firebaseId) {
    const db = getDB();
    if (!db || !firebaseId) return false;
    
    try {
        await db.collection(colecao).doc(firebaseId).delete();
        console.log(`✅ Excluído de ${colecao}: ${firebaseId}`);
        return true;
    } catch (error) {
        console.error(`❌ Erro ao excluir de ${colecao}:`, error);
        return false;
    }
}

// ================== MANUTENÇÕES PREVENTIVAS ==================
async function salvarPreventiva(e) {
    e.preventDefault();
    
    const db = getDB();
    if (!db) {
        alert('Sistema offline. Tente novamente.');
        return;
    }
    
    const veiculoPlaca = document.getElementById('preventivaVeiculo').value;
    if (!veiculoPlaca) { alert('Selecione um veículo'); return; }
    
    const veiculo = veiculos.find(v => v.placa === veiculoPlaca);
    const tipo = document.getElementById('preventivaTipo').value;
    const data = document.getElementById('preventivaData').value;
    const kmAtual = parseInt(document.getElementById('preventivaKm').value);
    const observacoes = document.getElementById('preventivaObs').value;
    
    if (!data || !kmAtual || !tipo) {
        alert('Preencha todos os campos');
        return;
    }
    
    const tipoConfig = (tiposManutencao[veiculoPlaca] || []).find(t => t.nome === tipo);
    const intervaloProximo = tipoConfig?.intervalo || 200;
    const proximaManutencao = kmAtual + intervaloProximo;
    
    const manutencaoData = {
        veiculoPlaca,
        veiculoNome: veiculo?.nome || veiculo?.modelo || '',
        tipo,
        data,
        kmAtual,
        proximaManutencao,
        intervaloProximo,
        observacoes: observacoes || '',
        dataManutencao: data
    };
    
    // Manter firebaseId se estiver editando
    if (editingId) {
        const existente = manutencoes.find(m => (m.firebaseId === editingId) || (m.id === editingId));
        if (existente?.firebaseId) {
            manutencaoData.firebaseId = existente.firebaseId;
        }
    }
    
    // Salvar no Firebase
    const firebaseId = await salvarNoFirebase('manutencoes', manutencaoData);
    
    if (firebaseId) {
        // Recarregar do Firebase para ter dados atualizados
        await carregarManutencoes();
        
        document.getElementById('formPreventiva')?.reset();
        document.getElementById('modalPreventiva').style.display = 'none';
        editingId = null;
        
        await renderPreventivas();
        await renderProximas();
        
        alert(editingId ? '✅ Manutenção atualizada!' : '✅ Manutenção registrada!');
    } else {
        alert('❌ Erro ao salvar. Tente novamente.');
    }
}

function editarPreventiva(id) {
    const m = manutencoes.find(m => (m.firebaseId === id) || (m.id === id));
    if (!m) return;
    
    editingId = m.firebaseId || m.id;
    document.getElementById('preventivaVeiculo').value = m.veiculoPlaca;
    document.getElementById('preventivaData').value = m.data;
    document.getElementById('preventivaKm').value = m.kmAtual;
    document.getElementById('preventivaObs').value = m.observacoes || '';
    
    setTimeout(() => {
        document.getElementById('preventivaTipo').value = m.tipo;
    }, 100);
    
    document.getElementById('modalPreventiva').style.display = 'flex';
    atualizarSelectTiposPreventiva();
}

async function excluirPreventiva(id) {
    if (!confirm('Excluir esta manutenção?')) return;
    
    const m = manutencoes.find(m => (m.firebaseId === id) || (m.id === id));
    
    if (m?.firebaseId) {
        await excluirDoFirebase('manutencoes', m.firebaseId);
    }
    
    // Recarregar do Firebase
    await carregarManutencoes();
    
    await renderPreventivas();
    await renderProximas();
    alert('✅ Excluído!');
}

// ================== RENDERIZAÇÃO ==================
async function renderPreventivas() {
    const tbody = document.getElementById('preventivaBody');
    if (!tbody) return;
    
    if (manutencoes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Nenhuma manutenção preventiva registrada.</td></tr>';
        return;
    }
    
    const ultimas = getUltimaManutencaoPorVeiculoTipo();
    
    let html = '';
    for (const m of manutencoes) {
        const key = `${m.veiculoPlaca}_${m.tipo}`;
        const isUltima = ultimas[key]?.id === m.id || ultimas[key]?.firebaseId === m.firebaseId;
        
        let statusHtml = '';
        if (isUltima) {
            const kmAtual = obterKmAtualVeiculoCache(m.veiculoPlaca);
            const restantes = m.proximaManutencao - kmAtual;
            
            if (restantes <= 0) {
                statusHtml = '<span class="status-badge status-urgente">VENCIDA</span>';
            } else if (restantes <= 50) {
                statusHtml = '<span class="status-badge status-urgente">URGENTE</span>';
            } else if (restantes <= 100) {
                statusHtml = '<span class="status-badge status-proximo">PRÓXIMO</span>';
            } else {
                statusHtml = '<span class="status-badge status-ok">OK</span>';
            }
        } else {
            statusHtml = '<span class="status-badge status-ok" style="background:#d4edda; color:#155724;">✅ CONCLUÍDA</span>';
        }
        
        const id = m.firebaseId || m.id;
        const veiculoNome = m.veiculoNome || 'Sem nome';
        
        html += `<tr>
            <td>${new Date(m.data).toLocaleDateString('pt-BR')}</td>
            <td><strong>${veiculoNome}</strong><br><small>${m.veiculoPlaca}</small></td>
            <td>${m.tipo}</td>
            <td>${(m.kmAtual || 0).toLocaleString('pt-BR')}</td>
            <td>${(m.proximaManutencao || 0).toLocaleString('pt-BR')}</td>
            <td>${statusHtml}</td>
            <td>
                <button class="btn-icon" onclick="editarPreventiva('${id}')"><i class="fas fa-edit"></i></button>
                <button class="btn-icon delete" onclick="excluirPreventiva('${id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    }
    tbody.innerHTML = html;
}

async function renderProximas() {
    const container = document.getElementById('proximasBody');
    if (!container) return;
    
    const ultimas = getUltimaManutencaoPorVeiculoTipo();
    const ultimasArray = Object.values(ultimas);
    
    const programadas = [];
    for (const m of ultimasArray) {
        const kmAtual = obterKmAtualVeiculoCache(m.veiculoPlaca);
        const restantes = m.proximaManutencao - kmAtual;
        programadas.push({ ...m, kmAtual, restantes });
    }
    
    programadas.sort((a, b) => a.restantes - b.restantes);
    
    if (programadas.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#999;">Nenhuma manutenção programada</p>';
        document.getElementById('totalProgramadas').textContent = '0';
        return;
    }
    
    let html = '<div class="programadas-container">';
    for (const m of programadas) {
        let classe = '';
        let statusText = '';
        if (m.restantes <= 0) {
            classe = 'urgente';
            statusText = `<span class="text-danger">VENCIDA! (há ${Math.abs(m.restantes)} unidades)</span>`;
        } else if (m.restantes <= 50) {
            classe = 'urgente';
            statusText = `<span class="text-warning">URGENTE! em ${m.restantes} unidades</span>`;
        } else if (m.restantes <= 100) {
            classe = 'proximo';
            statusText = `<span class="text-info">Próxima em ${m.restantes} unidades</span>`;
        } else {
            statusText = `<span class="text-success">OK - ${m.restantes} unidades restantes</span>`;
        }
        
        const id = m.firebaseId || m.id;
        const veiculoNome = m.veiculoNome || 'Sem nome';
        
        html += `<div class="programada-card ${classe}">
            <div class="programada-header">
                <div class="programada-veiculo">${m.veiculoPlaca} - ${veiculoNome}</div>
                <span class="programada-tipo">${m.tipo}</span>
            </div>
            <div class="programada-detalhes">📅 Última troca: ${new Date(m.data).toLocaleDateString('pt-BR')} (${(m.kmAtual || 0).toLocaleString('pt-BR')})</div>
            <div class="programada-km">⚠️ Próxima troca: ${(m.proximaManutencao || 0).toLocaleString('pt-BR')} - ${statusText}</div>
            <div class="programada-acoes">
                <button class="btn btn-sm btn-primary" onclick="editarPreventiva('${id}')">Registrar Troca</button>
            </div>
        </div>`;
    }
    html += '</div>';
    container.innerHTML = html;
    document.getElementById('totalProgramadas').textContent = programadas.length;
}

// ================== MANUTENÇÕES CORRETIVAS ==================
async function salvarCorretiva(e) {
    e.preventDefault();
    
    const db = getDB();
    if (!db) {
        alert('Sistema offline.');
        return;
    }
    
    const veiculoPlaca = document.getElementById('corretivaVeiculo').value;
    if (!veiculoPlaca) { alert('Selecione um veículo'); return; }
    
    const veiculo = veiculos.find(v => v.placa === veiculoPlaca);
    const tipo = document.getElementById('corretivaTipo').value;
    const data = document.getElementById('corretivaData').value;
    const km = parseInt(document.getElementById('corretivaKm').value) || 0;
    const descricao = document.getElementById('corretivaDescricao').value;
    const valor = parseFloat(document.getElementById('corretivaValor').value) || 0;
    const oficina = document.getElementById('corretivaOficina').value;
    const garantiaMeses = parseInt(document.getElementById('corretivaGarantiaMeses').value) || 0;
    
    if (!data || !descricao || !tipo) {
        alert('Preencha data, tipo e descrição');
        return;
    }
    
    let garantiaFim = null;
    if (garantiaMeses > 0) {
        const dataGarantia = new Date(data);
        dataGarantia.setMonth(dataGarantia.getMonth() + garantiaMeses);
        garantiaFim = dataGarantia.toISOString().split('T')[0];
    }
    
    let anexoData = null;
    const fileInput = document.getElementById('corretivaAnexo');
    if (fileInput && fileInput.files.length > 0) {
        anexoData = await anexarArquivo(fileInput.files[0]);
    }
    
    const manutencaoData = {
        veiculoPlaca,
        veiculoNome: veiculo?.nome || veiculo?.modelo || '',
        tipo,
        data,
        km,
        descricao,
        valor,
        oficina: oficina || '',
        garantiaMeses,
        garantiaFim,
        anexo: anexoData
    };
    
    if (editingCorretivaId) {
        const existente = manutencoesCorretivas.find(m => (m.firebaseId === editingCorretivaId) || (m.id === editingCorretivaId));
        if (existente?.firebaseId) {
            manutencaoData.firebaseId = existente.firebaseId;
        }
    }
    
    const firebaseId = await salvarNoFirebase('manutencoesCorretivas', manutencaoData);
    
    if (firebaseId) {
        await carregarManutencoesCorretivas();
        
        document.getElementById('formCorretiva')?.reset();
        const preview = document.getElementById('corretivaAnexoPreview');
        if (preview) preview.style.display = 'none';
        document.getElementById('modalCorretiva').style.display = 'none';
        editingCorretivaId = null;
        
        await renderCorretivas();
        alert(editingCorretivaId ? '✅ Manutenção atualizada!' : '✅ Manutenção registrada!');
    } else {
        alert('❌ Erro ao salvar.');
    }
}

function editarCorretiva(id) {
    const m = manutencoesCorretivas.find(m => (m.firebaseId === id) || (m.id === id));
    if (!m) return;
    
    editingCorretivaId = m.firebaseId || m.id;
    document.getElementById('corretivaVeiculo').value = m.veiculoPlaca;
    document.getElementById('corretivaTipo').value = m.tipo;
    document.getElementById('corretivaData').value = m.data;
    document.getElementById('corretivaKm').value = m.km || '';
    document.getElementById('corretivaDescricao').value = m.descricao;
    document.getElementById('corretivaValor').value = m.valor || '';
    document.getElementById('corretivaOficina').value = m.oficina || '';
    document.getElementById('corretivaGarantiaMeses').value = m.garantiaMeses || '';
    if (m.garantiaFim) document.getElementById('corretivaGarantiaFim').value = m.garantiaFim;
    if (m.anexo) {
        document.getElementById('corretivaAnexoPreview').style.display = 'flex';
        document.getElementById('corretivaAnexoNome').textContent = m.anexo.nome;
    }
    document.getElementById('modalCorretiva').style.display = 'flex';
}

async function excluirCorretiva(id) {
    if (!confirm('Excluir esta manutenção?')) return;
    
    const m = manutencoesCorretivas.find(m => (m.firebaseId === id) || (m.id === id));
    
    if (m?.firebaseId) {
        await excluirDoFirebase('manutencoesCorretivas', m.firebaseId);
    }
    
    await carregarManutencoesCorretivas();
    await renderCorretivas();
    alert('✅ Excluído!');
}

// ... (manter funções: verificarGarantia, renderCorretivas, visualizarAnexo, 
//      calcularGarantiaFim, anexarArquivo IGUAIS - elas não usam localStorage)

// ================== CONFIGURAÇÕES ==================
async function renderVeiculosList() {
    const container = document.getElementById('veiculosList');
    if (!container) return;
    
    if (veiculos.length === 0) {
        container.innerHTML = '<p style="text-align:center;">Nenhum veículo cadastrado</p>';
        return;
    }
    
    let html = '<div class="veiculos-list">';
    for (const v of veiculos) {
        const kmAtual = obterKmAtualVeiculoCache(v.placa);
        const nome = v.nome || v.modelo || 'Sem nome';
        const tipoMedidor = v.tipoMedidor || v.medidor || 'KM';
        
        html += `<div class="veiculo-card">
            <div><h4>${nome}</h4><p>Placa: ${v.placa} | Unidade: ${tipoMedidor} | KM Atual: ${kmAtual.toLocaleString('pt-BR')}</p></div>
            <button class="btn btn-sm btn-primary" onclick="configurarTiposVeiculo('${v.placa}')"><i class="fas fa-cog"></i> Tipos</button>
        </div>`;
    }
    html += '</div>';
    container.innerHTML = html;
}

async function configurarTiposVeiculo(placa) {
    document.getElementById('configVeiculoSelect').value = placa;
    await carregarTiposVeiculo(placa);
    document.getElementById('modalConfigTipos').style.display = 'flex';
}

async function carregarTiposVeiculo(placa) {
    const container = document.getElementById('tiposList');
    const tipos = tiposManutencao[placa] || [];
    
    if (tipos.length === 0) {
        container.innerHTML = '<p class="text-muted">Nenhum tipo cadastrado. Clique em "Adicionar".</p>';
        return;
    }
    
    let html = '<div class="tipos-list">';
    tipos.forEach((t, idx) => {
        html += `<div class="tipo-item">
            <div><strong>${t.nome}</strong><br><small>Intervalo: ${t.intervalo}</small></div>
            <button class="btn-icon delete" onclick="removerTipoManutencao('${placa}', ${idx})"><i class="fas fa-trash"></i></button>
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
}

async function adicionarTipoManutencao() {
    const nome = prompt('Nome do tipo de manutenção:');
    if (!nome) return;
    
    const intervalo = prompt('Intervalo (KM/Horas):');
    if (!intervalo) return;
    
    const placa = document.getElementById('configVeiculoSelect').value;
    if (!placa) { alert('Selecione um veículo'); return; }
    
    if (!tiposManutencao[placa]) {
        tiposManutencao[placa] = [];
    }
    
    tiposManutencao[placa].push({ nome, intervalo: parseInt(intervalo) });
    
    // ✅ Salvar no Firebase
    const db = getDB();
    if (db) {
        try {
            await db.collection('tiposManutencao').doc(placa).set({
                tipos: tiposManutencao[placa],
                ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            console.log('✅ Tipos salvos no Firebase');
        } catch (error) {
            console.error('❌ Erro ao salvar tipos:', error);
        }
    }
    
    await carregarTiposVeiculo(placa);
    atualizarSelectTiposPreventiva();
}

async function removerTipoManutencao(placa, idx) {
    if (!confirm('Remover este tipo?')) return;
    
    tiposManutencao[placa].splice(idx, 1);
    
    const db = getDB();
    if (db) {
        try {
            if (tiposManutencao[placa] && tiposManutencao[placa].length > 0) {
                await db.collection('tiposManutencao').doc(placa).set({
                    tipos: tiposManutencao[placa],
                    ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            } else {
                delete tiposManutencao[placa];
                await db.collection('tiposManutencao').doc(placa).delete();
            }
            console.log('✅ Tipo removido do Firebase');
        } catch (error) {
            console.error('❌ Erro ao remover tipo:', error);
        }
    }
    
    await carregarTiposVeiculo(placa);
    atualizarSelectTiposPreventiva();
}

// ... (manter funções: salvarNovoVeiculo, verificarAlertas, configurarEventos, configurarAbas)

// ================== EXPORTAR FUNÇÕES GLOBAIS ==================
window.editarPreventiva = editarPreventiva;
window.excluirPreventiva = excluirPreventiva;
window.editarCorretiva = editarCorretiva;
window.excluirCorretiva = excluirCorretiva;
window.visualizarAnexo = visualizarAnexo;
window.configurarTiposVeiculo = configurarTiposVeiculo;
window.removerTipoManutencao = removerTipoManutencao;
window.adicionarTipoManutencao = adicionarTipoManutencao;

// ================== INICIALIZAR ==================
document.addEventListener('DOMContentLoaded', inicializar);
