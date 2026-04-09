// manut.js - Gerenciador de Manutenção Completo

// ================== VARIÁVEIS GLOBAIS ==================
let manutencoes = [];
let manutencoesCorretivas = [];
let veiculos = [];
let tiposManutencao = {};
let editingId = null;
let editingCorretivaId = null;
let currentVeiculoPlaca = null;

// ================== INICIALIZAÇÃO ==================
async function inicializar() {
    console.log('🚀 Inicializando sistema de manutenção...');
    
    await aguardarFirebase();
    await carregarVeiculos();
    await carregarManutencoes();
    await carregarTiposConfig();
    await carregarManutencoesCorretivas();
    
    configurarEventos();
    configurarAbas();
    
    await renderHistorico();
    await renderProximas();
    await renderVeiculosList();
    await renderManutencoesCorretivas();
    
    // Atualizar selects
    atualizarSelectsVeiculos();
    atualizarSelectCorretivaVeiculos();
    
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

// ================== CARREGAR DADOS ==================
async function carregarVeiculos() {
    try {
        if (window.firebaseDB) {
            const snapshot = await window.firebaseDB.collection('veiculos').get();
            veiculos = [];
            snapshot.forEach(doc => {
                veiculos.push({ firebaseId: doc.id, ...doc.data() });
            });
            if (veiculos.length > 0) {
                console.log(`✅ ${veiculos.length} veículos do Firebase`);
                localStorage.setItem('veiculos', JSON.stringify(veiculos));
                return;
            }
        }
        
        const veiculosSalvos = localStorage.getItem('veiculos');
        if (veiculosSalvos) {
            veiculos = JSON.parse(veiculosSalvos);
            console.log(`💾 ${veiculos.length} veículos do localStorage`);
        } else {
            veiculos = [];
        }
    } catch (error) {
        console.error('Erro ao carregar veículos:', error);
        veiculos = [];
    }
}

async function carregarManutencoes() {
    if (window.firebaseDB) {
        try {
            const snapshot = await window.firebaseDB.collection('manutencoes').orderBy('data', 'desc').get();
            manutencoes = [];
            snapshot.forEach(doc => {
                manutencoes.push({ firebaseId: doc.id, ...doc.data() });
            });
            console.log(`✅ ${manutencoes.length} manutenções preventivas do Firebase`);
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
        console.log(`💾 ${manutencoes.length} manutenções preventivas do localStorage`);
    } catch (e) {
        manutencoes = [];
    }
}

async function carregarManutencoesCorretivas() {
    if (window.firebaseDB) {
        try {
            const snapshot = await window.firebaseDB.collection('manutencoesCorretivas').orderBy('data', 'desc').get();
            manutencoesCorretivas = [];
            snapshot.forEach(doc => {
                manutencoesCorretivas.push({ firebaseId: doc.id, ...doc.data() });
            });
            console.log(`✅ ${manutencoesCorretivas.length} manutenções corretivas do Firebase`);
            localStorage.setItem('manutencoesCorretivas', JSON.stringify(manutencoesCorretivas));
        } catch (error) {
            console.error('Erro:', error);
            carregarManutencoesCorretivasLocal();
        }
    } else {
        carregarManutencoesCorretivasLocal();
    }
}

function carregarManutencoesCorretivasLocal() {
    try {
        manutencoesCorretivas = JSON.parse(localStorage.getItem('manutencoesCorretivas')) || [];
        console.log(`💾 ${manutencoesCorretivas.length} manutenções corretivas do localStorage`);
    } catch (e) {
        manutencoesCorretivas = [];
    }
}

async function carregarTiposConfig() {
    if (window.firebaseDB) {
        try {
            const snapshot = await window.firebaseDB.collection('tiposManutencao').get();
            tiposManutencao = {};
            snapshot.forEach(doc => {
                tiposManutencao[doc.id] = doc.data();
            });
            console.log(`✅ Tipos de manutenção carregados`);
            localStorage.setItem('tiposManutencao', JSON.stringify(tiposManutencao));
        } catch (error) {
            console.error('Erro:', error);
            carregarTiposLocal();
        }
    } else {
        carregarTiposLocal();
    }
}

function carregarTiposLocal() {
    try {
        tiposManutencao = JSON.parse(localStorage.getItem('tiposManutencao')) || {};
    } catch (e) {
        tiposManutencao = {};
    }
}

// ================== FUNÇÕES AUXILIARES ==================
function obterKmAtualVeiculo(placa) {
    const kmSalvo = localStorage.getItem(`km_atual_${placa}`);
    return kmSalvo ? parseInt(kmSalvo) : 0;
}

function atualizarSelectsVeiculos() {
    const selects = ['veiculoSelect', 'configVeiculoSelect'];
    selects.forEach(id => {
        const select = document.getElementById(id);
        if (select) {
            select.innerHTML = '<option value="">Selecione um veículo...</option>';
            veiculos.forEach(v => {
                select.innerHTML += `<option value="${v.placa}">${v.placa} - ${v.nome}</option>`;
            });
        }
    });
}

function atualizarSelectCorretivaVeiculos() {
    const select = document.getElementById('corretivaVeiculo');
    if (select) {
        select.innerHTML = '<option value="">Selecione um veículo...</option>';
        veiculos.forEach(v => {
            select.innerHTML += `<option value="${v.placa}">${v.placa} - ${v.nome}</option>`;
        });
    }
}

function atualizarSelectTipos() {
    const veiculoPlaca = document.getElementById('veiculoSelect').value;
    const select = document.getElementById('tipoSelect');
    if (!veiculoPlaca) {
        select.innerHTML = '<option value="">Selecione primeiro o veículo</option>';
        return;
    }
    const tipos = tiposManutencao[veiculoPlaca] || [];
    if (tipos.length === 0) {
        select.innerHTML = '<option value="">Nenhum tipo configurado</option>';
    } else {
        select.innerHTML = '<option value="">Selecione...</option>' + tipos.map(t => `<option value="${t.nome}">${t.nome} (intervalo: ${t.intervalo})</option>`).join('');
    }
}

async function salvarNoFirebase(colecao, dados) {
    if (!window.firebaseDB) return null;
    try {
        const { firebaseId, ...dadosSalvar } = dados;
        if (dados.firebaseId) {
            await window.firebaseDB.collection(colecao).doc(dados.firebaseId).update(dadosSalvar);
            return dados.firebaseId;
        } else {
            const docRef = await window.firebaseDB.collection(colecao).add(dadosSalvar);
            return docRef.id;
        }
    } catch (error) {
        console.error('Erro Firebase:', error);
        return null;
    }
}

// ================== MANUTENÇÕES PREVENTIVAS ==================
async function salvarManutencao(e) {
    e.preventDefault();
    
    const veiculoPlaca = document.getElementById('veiculoSelect').value;
    if (!veiculoPlaca) { alert('Selecione um veículo'); return; }
    
    const veiculo = veiculos.find(v => v.placa === veiculoPlaca);
    const tipo = document.getElementById('tipoSelect').value;
    const data = document.getElementById('dataManutencao').value;
    const kmAtual = parseInt(document.getElementById('kmAtual').value);
    const observacoes = document.getElementById('obsManutencao').value;
    
    if (!data || !kmAtual) { alert('Preencha todos os campos obrigatórios'); return; }
    if (!tipo) { alert('Selecione o tipo de manutenção'); return; }
    
    const tipoConfig = (tiposManutencao[veiculoPlaca] || []).find(t => t.nome === tipo);
    const intervaloProximo = tipoConfig?.intervalo || 200;
    const proximaManutencao = kmAtual + intervaloProximo;
    
    const manutencaoData = {
        id: editingId || Date.now(),
        veiculoPlaca,
        veiculoNome: veiculo?.nome,
        tipo,
        data,
        kmAtual,
        proximaManutencao,
        intervaloProximo,
        observacoes,
        dataRegistro: new Date().toISOString(),
        status: "ativo"
    };
    
    if (editingId) {
        const existente = manutencoes.find(m => m.id === editingId);
        if (existente?.firebaseId) manutencaoData.firebaseId = existente.firebaseId;
    }
    
    const firebaseId = await salvarNoFirebase('manutencoes', manutencaoData);
    if (firebaseId) manutencaoData.firebaseId = firebaseId;
    
    if (editingId) {
        const index = manutencoes.findIndex(m => m.id === editingId);
        if (index !== -1) manutencoes[index] = manutencaoData;
    } else {
        manutencoes.push(manutencaoData);
    }
    
    localStorage.setItem('manutencoes', JSON.stringify(manutencoes));
    localStorage.setItem(`km_atual_${veiculoPlaca}`, kmAtual.toString());
    
    alert(editingId ? 'Manutenção atualizada!' : 'Manutenção registrada!');
    
    document.getElementById('formManutencao').reset();
    document.getElementById('modalManutencao').style.display = 'none';
    editingId = null;
    
    await renderHistorico();
    await renderProximas();
}

function editarManutencao(id) {
    const m = manutencoes.find(m => m.id === id);
    if (!m) return;
    editingId = m.id;
    document.getElementById('veiculoSelect').value = m.veiculoPlaca;
    document.getElementById('tipoSelect').value = m.tipo;
    document.getElementById('dataManutencao').value = m.data;
    document.getElementById('kmAtual').value = m.kmAtual;
    document.getElementById('obsManutencao').value = m.observacoes || '';
    document.getElementById('modalManutencao').style.display = 'flex';
    atualizarSelectTipos();
}

async function excluirManutencao(id) {
    if (!confirm('Excluir esta manutenção?')) return;
    const m = manutencoes.find(m => m.id === id);
    if (m?.firebaseId && window.firebaseDB) {
        await window.firebaseDB.collection('manutencoes').doc(m.firebaseId).delete();
    }
    manutencoes = manutencoes.filter(m => m.id !== id);
    localStorage.setItem('manutencoes', JSON.stringify(manutencoes));
    alert('Excluído!');
    await renderHistorico();
    await renderProximas();
}

async function renderHistorico() {
    const tbody = document.getElementById('historicoBody');
    if (!tbody) return;
    if (manutencoes.length === 0) {
        tbody.innerHTML = '发展<td colspan="7" style="text-align:center;">Nenhuma manutenção preventiva registrada.发展</tr>';
        return;
    }
    let html = '';
    for (const m of manutencoes) {
        const kmAtual = obterKmAtualVeiculo(m.veiculoPlaca);
        const restantes = m.proximaManutencao - kmAtual;
        let statusClass = 'status-ok', statusText = 'OK';
        if (restantes <= 0) { statusClass = 'status-urgente'; statusText = 'VENCIDA'; }
        else if (restantes <= 50) { statusClass = 'status-urgente'; statusText = 'URGENTE'; }
        else if (restantes <= 100) { statusClass = 'status-proximo'; statusText = 'PRÓXIMO'; }
        
        html += `<tr>
            <td>${new Date(m.data).toLocaleDateString('pt-BR')}</td>
            <td><strong>${m.veiculoNome}</strong><br><small>${m.veiculoPlaca}</small></td>
            <td>${m.tipo}</td>
            <td>${m.kmAtual.toLocaleString('pt-BR')}</td>
            <td>${m.proximaManutencao.toLocaleString('pt-BR')}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
                <button class="btn-icon" onclick="editarManutencao(${m.id})"><i class="fas fa-edit"></i></button>
                <button class="btn-icon delete" onclick="excluirManutencao(${m.id})"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    }
    tbody.innerHTML = html;
}

async function renderProximas() {
    const container = document.getElementById('proximasBody');
    if (!container) return;
    const programadas = manutencoes.filter(m => m.proximaManutencao > 0).sort((a, b) => a.proximaManutencao - b.proximaManutencao);
    if (programadas.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#999;">Nenhuma manutenção programada</p>';
        document.getElementById('totalProgramadas').textContent = '0';
        return;
    }
    let html = '<div class="programadas-container">';
    for (const m of programadas) {
        const kmAtual = obterKmAtualVeiculo(m.veiculoPlaca);
        const restantes = m.proximaManutencao - kmAtual;
        let classe = '';
        if (restantes <= 0) classe = 'urgente';
        else if (restantes <= 50) classe = 'urgente';
        else if (restantes <= 100) classe = 'proximo';
        
        html += `<div class="programada-card ${classe}">
            <div class="programada-header">
                <div class="programada-veiculo">${m.veiculoPlaca} - ${m.veiculoNome}</div>
                <span class="programada-tipo">${m.tipo}</span>
            </div>
            <div class="programada-detalhes">
                📅 Última: ${new Date(m.data).toLocaleDateString('pt-BR')} (${m.kmAtual.toLocaleString('pt-BR')})
            </div>
            <div class="programada-km">
                ⚠️ Próxima: ${m.proximaManutencao.toLocaleString('pt-BR')} 
                ${restantes <= 0 ? '<span class="text-danger">(VENCIDA!)</span>' : `(em ${restantes.toLocaleString('pt-BR')})`}
            </div>
            <div class="programada-acoes">
                <button class="btn btn-sm btn-primary" onclick="editarManutencao(${m.id})">Registrar Troca</button>
            </div>
        </div>`;
    }
    html += '</div>';
    container.innerHTML = html;
    document.getElementById('totalProgramadas').textContent = programadas.length;
}

// ================== MANUTENÇÕES CORRETIVAS ==================
async function salvarManutencaoCorretiva(e) {
    e.preventDefault();
    
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
    
    if (!data || !descricao) {
        alert('Preencha data e descrição do serviço');
        return;
    }
    if (!tipo) {
        alert('Selecione o tipo de serviço');
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
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        if (file.size > 5 * 1024 * 1024) {
            alert('Arquivo muito grande. Máximo 5MB');
            return;
        }
        anexoData = await anexarArquivo(file);
    }
    
    const manutencaoData = {
        id: editingCorretivaId || Date.now(),
        veiculoPlaca,
        veiculoNome: veiculo?.nome,
        tipo,
        data,
        km,
        descricao,
        valor,
        oficina,
        garantiaMeses,
        garantiaFim,
        anexo: anexoData,
        dataRegistro: new Date().toISOString()
    };
    
    if (editingCorretivaId) {
        const existente = manutencoesCorretivas.find(m => m.id === editingCorretivaId);
        if (existente?.firebaseId) manutencaoData.firebaseId = existente.firebaseId;
    }
    
    const firebaseId = await salvarNoFirebase('manutencoesCorretivas', manutencaoData);
    if (firebaseId) manutencaoData.firebaseId = firebaseId;
    
    if (editingCorretivaId) {
        const index = manutencoesCorretivas.findIndex(m => m.id === editingCorretivaId);
        if (index !== -1) manutencoesCorretivas[index] = manutencaoData;
    } else {
        manutencoesCorretivas.push(manutencaoData);
    }
    
    localStorage.setItem('manutencoesCorretivas', JSON.stringify(manutencoesCorretivas));
    
    alert(editingCorretivaId ? 'Manutenção atualizada!' : 'Manutenção registrada!');
    
    document.getElementById('formCorretiva').reset();
    document.getElementById('corretivaAnexoPreview').style.display = 'none';
    document.getElementById('modalCorretiva').style.display = 'none';
    editingCorretivaId = null;
    
    await renderManutencoesCorretivas();
}

function editarManutencaoCorretiva(id) {
    const m = manutencoesCorretivas.find(m => m.id === id);
    if (!m) return;
    
    editingCorretivaId = m.id;
    document.getElementById('corretivaVeiculo').value = m.veiculoPlaca;
    document.getElementById('corretivaTipo').value = m.tipo;
    document.getElementById('corretivaData').value = m.data;
    document.getElementById('corretivaKm').value = m.km || '';
    document.getElementById('corretivaDescricao').value = m.descricao;
    document.getElementById('corretivaValor').value = m.valor || '';
    document.getElementById('corretivaOficina').value = m.oficina || '';
    document.getElementById('corretivaGarantiaMeses').value = m.garantiaMeses || '';
    
    if (m.garantiaFim) {
        document.getElementById('corretivaGarantiaFim').value = m.garantiaFim;
    }
    
    if (m.anexo) {
        document.getElementById('corretivaAnexoPreview').style.display = 'flex';
        document.getElementById('corretivaAnexoNome').textContent = m.anexo.nome;
    }
    
    document.getElementById('modalCorretiva').style.display = 'flex';
}

async function excluirManutencaoCorretiva(id) {
    if (!confirm('Excluir esta manutenção?')) return;
    const m = manutencoesCorretivas.find(m => m.id === id);
    if (m?.firebaseId && window.firebaseDB) {
        await window.firebaseDB.collection('manutencoesCorretivas').doc(m.firebaseId).delete();
    }
    manutencoesCorretivas = manutencoesCorretivas.filter(m => m.id !== id);
    localStorage.setItem('manutencoesCorretivas', JSON.stringify(manutencoesCorretivas));
    alert('Excluído!');
    await renderManutencoesCorretivas();
}

function verificarGarantia(garantiaFim) {
    if (!garantiaFim) return { status: 'sem', texto: 'Sem garantia', classe: '' };
    const hoje = new Date();
    const dataFim = new Date(garantiaFim);
    if (dataFim < hoje) return { status: 'expirada', texto: 'Garantia expirada', classe: 'status-urgente' };
    const diasRestantes = Math.ceil((dataFim - hoje) / (1000 * 60 * 60 * 24));
    if (diasRestantes <= 30) return { status: 'proximo', texto: `Garantia: ${diasRestantes} dias`, classe: 'status-proximo' };
    return { status: 'ok', texto: `Garantia até ${new Date(garantiaFim).toLocaleDateString('pt-BR')}`, classe: 'status-ok' };
}

async function renderManutencoesCorretivas() {
    const tbody = document.getElementById('corretivaBody');
    if (!tbody) return;
    
    if (manutencoesCorretivas.length === 0) {
        tbody.innerHTML = '发展<td colspan="8" style="text-align:center;">Nenhuma manutenção corretiva registrada.发展</td>';
        return;
    }
    
    let html = '';
    for (const m of manutencoesCorretivas) {
        const garantia = verificarGarantia(m.garantiaFim);
        const anexoHtml = m.anexo ? `<button class="btn-icon" onclick="visualizarAnexo(${m.id})" title="Ver anexo"><i class="fas fa-paperclip"></i></button>` : '-';
        
        html += `<tr>
            <td>${new Date(m.data).toLocaleDateString('pt-BR')}</td>
            <td><strong>${m.veiculoNome}</strong><br><small>${m.veiculoPlaca}</small></td>
            <td>${m.tipo}</td>
            <td>${m.descricao.length > 50 ? m.descricao.substring(0, 50) + '...' : m.descricao}</td>
            <td>${m.valor > 0 ? m.valor.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) : '-'}</td>
            <td class="${garantia.classe}">${garantia.texto}</td>
            <td>${anexoHtml}</td>
            <td>
                <button class="btn-icon" onclick="editarManutencaoCorretiva(${m.id})"><i class="fas fa-edit"></i></button>
                <button class="btn-icon delete" onclick="excluirManutencaoCorretiva(${m.id})"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    }
    tbody.innerHTML = html;
}

function visualizarAnexo(id) {
    const m = manutencoesCorretivas.find(m => m.id === id);
    if (!m || !m.anexo) return;
    
    const iframe = document.getElementById('visualizarAnexoIframe');
    iframe.src = m.anexo.base64;
    document.getElementById('modalVisualizarAnexo').style.display = 'flex';
    
    const baixarBtn = document.getElementById('baixarAnexoBtn');
    baixarBtn.onclick = () => {
        const link = document.createElement('a');
        link.href = m.anexo.base64;
        link.download = m.anexo.nome;
        link.click();
    };
}

function calcularGarantiaFim() {
    const data = document.getElementById('corretivaData').value;
    const meses = parseInt(document.getElementById('corretivaGarantiaMeses').value) || 0;
    if (data && meses > 0) {
        const dataGarantia = new Date(data);
        dataGarantia.setMonth(dataGarantia.getMonth() + meses);
        document.getElementById('corretivaGarantiaFim').value = dataGarantia.toISOString().split('T')[0];
    } else {
        document.getElementById('corretivaGarantiaFim').value = '';
    }
}

async function anexarArquivo(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            resolve({
                nome: file.name,
                tipo: file.type,
                tamanho: file.size,
                base64: e.target.result
            });
        };
        reader.readAsDataURL(file);
    });
}

// ================== CONFIGURAÇÕES ==================
async function renderVeiculosList() {
    const container = document.getElementById('veiculosList');
    if (!container) return;
    if (veiculos.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#999;">Nenhum veículo cadastrado</p>';
        return;
    }
    let html = '<div class="veiculos-list">';
    for (const v of veiculos) {
        const kmAtual = obterKmAtualVeiculo(v.placa);
        html += `<div class="veiculo-card">
            <div>
                <h4>${v.nome}</h4>
                <p>Placa: ${v.placa} | Unidade: ${v.tipoMedidor || 'KM'} | KM Atual: ${kmAtual.toLocaleString('pt-BR')}</p>
            </div>
            <button class="btn btn-sm btn-primary" onclick="configurarTiposVeiculo('${v.placa}')"><i class="fas fa-cog"></i> Tipos</button>
        </div>`;
    }
    html += '</div>';
    container.innerHTML = html;
}

async function configurarTiposVeiculo(placa) {
    currentVeiculoPlaca = placa;
    document.getElementById('configVeiculoSelect').value = placa;
    await carregarTiposVeiculo(placa);
    document.getElementById('modalConfigTipos').style.display = 'flex';
}

async function carregarTiposVeiculo(placa) {
    const container = document.getElementById('tiposList');
    const tipos = tiposManutencao[placa] || [];
    if (tipos.length === 0) {
        container.innerHTML = '<p class="text-muted" style="text-align:center;">Nenhum tipo cadastrado. Clique em "Adicionar".</p>';
        return;
    }
    let html = '<div class="tipos-list">';
    tipos.forEach((t, idx) => {
        html += `<div class="tipo-item">
            <div class="tipo-info">
                <strong>${t.nome}</strong>
                <small>Intervalo: ${t.intervalo} ${veiculos.find(v => v.placa === placa)?.tipoMedidor || 'KM'}</small>
            </div>
            <button class="btn-icon delete" onclick="removerTipoManutencao('${placa}', ${idx})"><i class="fas fa-trash"></i></button>
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
}

function abrirModalAddTipo() {
    const nome = prompt('Nome do tipo de manutenção (ex: Troca de Óleo Motor, Filtro de Ar):');
    if (!nome) return;
    const intervalo = prompt('Intervalo para próxima manutenção (em KM ou Horas):');
    if (!intervalo) return;
    const placa = document.getElementById('configVeiculoSelect').value;
    if (!placa) { alert('Selecione um veículo primeiro'); return; }
    
    if (!tiposManutencao[placa]) tiposManutencao[placa] = [];
    tiposManutencao[placa].push({ nome, intervalo: parseInt(intervalo) });
    localStorage.setItem('tiposManutencao', JSON.stringify(tiposManutencao));
    if (window.firebaseDB) {
        window.firebaseDB.collection('tiposManutencao').doc(placa).set(tiposManutencao[placa]);
    }
    carregarTiposVeiculo(placa);
    atualizarSelectTipos();
}

function removerTipoManutencao(placa, idx) {
    if (!confirm('Remover este tipo de manutenção?')) return;
    tiposManutencao[placa].splice(idx, 1);
    if (tiposManutencao[placa].length === 0) delete tiposManutencao[placa];
    localStorage.setItem('tiposManutencao', JSON.stringify(tiposManutencao));
    if (window.firebaseDB && tiposManutencao[placa]) {
        window.firebaseDB.collection('tiposManutencao').doc(placa).set(tiposManutencao[placa]);
    } else if (window.firebaseDB) {
        window.firebaseDB.collection('tiposManutencao').doc(placa).delete();
    }
    carregarTiposVeiculo(placa);
    atualizarSelectTipos();
}

async function salvarNovoVeiculo() {
    const nome = document.getElementById('novoVeiculoNome').value.trim();
    if (!nome) { alert('Informe o nome do veículo'); return; }
    const unidade = document.getElementById('novoVeiculoUnidade').value;
    const novoVeiculo = {
        id: Date.now(),
        nome: nome,
        placa: nome.substring(0, 8).toUpperCase().replace(/\s/g, ''),
        tipoMedidor: unidade === 'KM' ? 'km' : 'horas',
        combustivel: 'Não definido',
        status: 'Ativo'
    };
    
    const firebaseId = await salvarNoFirebase('veiculos', novoVeiculo);
    if (firebaseId) novoVeiculo.firebaseId = firebaseId;
    veiculos.push(novoVeiculo);
    localStorage.setItem('veiculos', JSON.stringify(veiculos));
    
    document.getElementById('modalNovoVeiculo').style.display = 'none';
    document.getElementById('novoVeiculoNome').value = '';
    await carregarVeiculos();
    await renderVeiculosList();
    alert('Veículo cadastrado!');
}

async function verificarAlertas() {
    const alertas = [];
    for (const m of manutencoes) {
        const kmAtual = obterKmAtualVeiculo(m.veiculoPlaca);
        const restantes = m.proximaManutencao - kmAtual;
        if (restantes <= 100) {
            alertas.push({ veiculo: m.veiculoPlaca, tipo: m.tipo, restantes });
        }
    }
    if (alertas.length === 0) {
        alert('✅ Nenhum alerta de manutenção pendente!');
    } else {
        let msg = '⚠️ ALERTAS DE MANUTENÇÃO:\n\n';
        alertas.forEach(a => {
            msg += `📌 ${a.veiculo} - ${a.tipo}\n   ${a.restantes <= 0 ? 'VENCIDA!' : `Próxima em ${a.restantes} KM/Horas`}\n\n`;
        });
        alert(msg);
    }
}

// ================== EVENTOS ==================
function configurarEventos() {
    // Preventivas
    document.getElementById('btnNovaManutencao')?.addEventListener('click', () => {
        document.getElementById('formManutencao').reset();
        editingId = null;
        document.getElementById('modalManutencao').style.display = 'flex';
    });
    document.getElementById('formManutencao')?.addEventListener('submit', salvarManutencao);
    document.getElementById('veiculoSelect')?.addEventListener('change', atualizarSelectTipos);
    
    // Corretivas
    document.getElementById('btnNovaCorretiva')?.addEventListener('click', () => {
        document.getElementById('formCorretiva').reset();
        document.getElementById('corretivaAnexoPreview').style.display = 'none';
        editingCorretivaId = null;
        document.getElementById('modalCorretiva').style.display = 'flex';
    });
    document.getElementById('formCorretiva')?.addEventListener('submit', salvarManutencaoCorretiva);
    document.getElementById('corretivaGarantiaMeses')?.addEventListener('input', calcularGarantiaFim);
    document.getElementById('corretivaData')?.addEventListener('change', calcularGarantiaFim);
    
    // Preview do anexo
    const anexoInput = document.getElementById('corretivaAnexo');
    if (anexoInput) {
        anexoInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                document.getElementById('corretivaAnexoPreview').style.display = 'flex';
                document.getElementById('corretivaAnexoNome').textContent = file.name;
            }
        });
    }
    document.getElementById('corretivaRemoverAnexo')?.addEventListener('click', () => {
        document.getElementById('corretivaAnexo').value = '';
        document.getElementById('corretivaAnexoPreview').style.display = 'none';
    });
    
    // Configurações
    document.getElementById('btnConfigurarTipos')?.addEventListener('click', () => {
        document.getElementById('modalConfigTipos').style.display = 'flex';
    });
    document.getElementById('btnCheckAlertas')?.addEventListener('click', verificarAlertas);
    document.getElementById('btnNovoVeiculo')?.addEventListener('click', () => {
        document.getElementById('modalNovoVeiculo').style.display = 'flex';
    });
    document.getElementById('salvarNovoVeiculo')?.addEventListener('click', salvarNovoVeiculo);
    document.getElementById('btnAddTipo')?.addEventListener('click', abrirModalAddTipo);
    document.getElementById('configVeiculoSelect')?.addEventListener('change', (e) => {
        if (e.target.value) carregarTiposVeiculo(e.target.value);
    });
    
    // Fechar modais
    document.querySelectorAll('.modal-close, .modal-overlay').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target === el || e.target.classList.contains('modal-close')) {
                el.closest('.modal-overlay').style.display = 'none';
            }
        });
    });
}

function configurarAbas() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            tabs.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
            
            // Recarregar dados específicos da aba
            if (btn.dataset.tab === 'historico') renderHistorico();
            if (btn.dataset.tab === 'proximas') renderProximas();
            if (btn.dataset.tab === 'config') renderVeiculosList();
            if (btn.dataset.tab === 'corretiva') renderManutencoesCorretivas();
        });
    });
}

// Exportar funções globais
window.editarManutencao = editarManutencao;
window.excluirManutencao = excluirManutencao;
window.editarManutencaoCorretiva = editarManutencaoCorretiva;
window.excluirManutencaoCorretiva = excluirManutencaoCorretiva;
window.visualizarAnexo = visualizarAnexo;
window.configurarTiposVeiculo = configurarTiposVeiculo;
window.removerTipoManutencao = removerTipoManutencao;

// Inicializar
document.addEventListener('DOMContentLoaded', inicializar);
