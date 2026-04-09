// manut.js - Gerenciador de Manutenção

let manutencoes = [];
let veiculos = [];
let tiposManutencao = {};
let editingId = null;

async function inicializar() {
    console.log('🚀 Inicializando manutenção...');
    await aguardarFirebase();
    await carregarVeiculos();
    await carregarManutencoes();
    await carregarTiposConfig();
    configurarEventos();
    configurarAbas();
    await renderHistorico();
    await renderProximas();
    await renderVeiculosList();
    console.log('✅ Manutenção pronto!');
}

function aguardarFirebase() {
    return new Promise((resolve) => {
        if (window.firebaseDB) { resolve(); return; }
        const verificar = setInterval(() => {
            if (window.firebaseDB) { clearInterval(verificar); resolve(); }
        }, 100);
        setTimeout(() => { clearInterval(verificar); resolve(); }, 3000);
    });
}

async function carregarVeiculos() {
    try {
        if (window.firebaseDB) {
            const snapshot = await window.firebaseDB.collection('veiculos').get();
            veiculos = [];
            snapshot.forEach(doc => veiculos.push({ firebaseId: doc.id, ...doc.data() }));
            if (veiculos.length > 0) {
                localStorage.setItem('veiculos', JSON.stringify(veiculos));
                atualizarSelectsVeiculos();
                return;
            }
        }
        const salvos = localStorage.getItem('veiculos');
        veiculos = salvos ? JSON.parse(salvos) : [];
        atualizarSelectsVeiculos();
    } catch (error) { console.error('Erro:', error); veiculos = []; }
}

async function carregarManutencoes() {
    if (window.firebaseDB) {
        try {
            const snapshot = await window.firebaseDB.collection('manutencoes').orderBy('data', 'desc').get();
            manutencoes = [];
            snapshot.forEach(doc => manutencoes.push({ firebaseId: doc.id, ...doc.data() }));
            localStorage.setItem('manutencoes', JSON.stringify(manutencoes));
        } catch (error) { carregarManutencoesLocal(); }
    } else { carregarManutencoesLocal(); }
}

function carregarManutencoesLocal() {
    try { manutencoes = JSON.parse(localStorage.getItem('manutencoes')) || []; }
    catch (e) { manutencoes = []; }
}

async function carregarTiposConfig() {
    if (window.firebaseDB) {
        try {
            const snapshot = await window.firebaseDB.collection('tiposManutencao').get();
            tiposManutencao = {};
            snapshot.forEach(doc => { tiposManutencao[doc.id] = doc.data(); });
            localStorage.setItem('tiposManutencao', JSON.stringify(tiposManutencao));
        } catch (error) { carregarTiposLocal(); }
    } else { carregarTiposLocal(); }
}

function carregarTiposLocal() {
    try { tiposManutencao = JSON.parse(localStorage.getItem('tiposManutencao')) || {}; }
    catch (e) { tiposManutencao = {}; }
}

function atualizarSelectsVeiculos() {
    const selects = ['veiculoSelect', 'configVeiculoSelect'];
    selects.forEach(id => {
        const select = document.getElementById(id);
        if (select) {
            select.innerHTML = '<option value="">Selecione...</option>';
            veiculos.forEach(v => {
                select.innerHTML += `<option value="${v.placa}">${v.placa} - ${v.nome}</option>`;
            });
        }
    });
}

function obterKmAtualVeiculo(placa) {
    const kmSalvo = localStorage.getItem(`km_atual_${placa}`);
    return kmSalvo ? parseInt(kmSalvo) : 0;
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
    } catch (error) { console.error('Erro:', error); return null; }
}

async function salvarManutencao(e) {
    e.preventDefault();
    const veiculoPlaca = document.getElementById('veiculoSelect').value;
    if (!veiculoPlaca) { alert('Selecione um veículo'); return; }
    
    const veiculo = veiculos.find(v => v.placa === veiculoPlaca);
    const tipo = document.getElementById('tipoSelect').value;
    const data = document.getElementById('dataManutencao').value;
    const kmAtual = parseInt(document.getElementById('kmAtual').value);
    const observacoes = document.getElementById('obsManutencao').value;
    
    if (!data || !kmAtual) { alert('Preencha todos os campos'); return; }
    
    const tipoConfig = (tiposManutencao[veiculoPlaca] || []).find(t => t.nome === tipo);
    const intervaloProximo = tipoConfig?.intervalo || 200;
    const proximaManutencao = kmAtual + intervaloProximo;
    
    const manutencaoData = {
        id: editingId || Date.now(),
        veiculoPlaca, veiculoNome: veiculo?.nome,
        tipo, data, kmAtual, proximaManutencao, intervaloProximo, observacoes,
        dataRegistro: new Date().toISOString(), status: "ativo"
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
        tbody.innerHTML = '发展<td colspan="7" style="text-align:center;">Nenhuma manutenção registrada</td></tr>';
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
            <td><button class="btn-icon" onclick="editarManutencao(${m.id})"><i class="fas fa-edit"></i></button>
                <button class="btn-icon" onclick="excluirManutencao(${m.id})"><i class="fas fa-trash"></i></button></td>
        </tr>`;
    }
    tbody.innerHTML = html;
}

async function renderProximas() {
    const container = document.getElementById('proximasBody');
    if (!container) return;
    const agora = Date.now();
    const programadas = manutencoes.filter(m => m.proximaManutencao > 0).sort((a,b) => a.proximaManutencao - b.proximaManutencao);
    if (programadas.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#999;">Nenhuma manutenção programada</p>';
        document.getElementById('totalProgramadas').textContent = '0';
        return;
    }
    let html = '';
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
            <div>📅 Última: ${new Date(m.data).toLocaleDateString('pt-BR')} (${m.kmAtual.toLocaleString('pt-BR')})</div>
            <div>⚠️ Próxima: ${m.proximaManutencao.toLocaleString('pt-BR')} (${restantes <= 0 ? 'VENCIDA' : `em ${restantes.toLocaleString('pt-BR')}`})</div>
            <div style="margin-top:10px;"><button class="btn btn-sm btn-primary" onclick="editarManutencao(${m.id})">Registrar Troca</button></div>
        </div>`;
    }
    container.innerHTML = html;
    document.getElementById('totalProgramadas').textContent = programadas.length;
}

async function renderVeiculosList() {
    const container = document.getElementById('veiculosList');
    if (!container) return;
    if (veiculos.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#999;">Nenhum veículo cadastrado</p>';
        return;
    }
    let html = '';
    for (const v of veiculos) {
        const kmAtual = obterKmAtualVeiculo(v.placa);
        html += `<div class="veiculo-card">
            <div><h4>${v.nome}</h4><div>Placa: ${v.placa} | Unidade: ${v.tipoMedidor || 'KM'} | KM Atual: ${kmAtual.toLocaleString('pt-BR')}</div></div>
            <button class="btn btn-sm btn-primary" onclick="configurarTiposVeiculo('${v.placa}')"><i class="fas fa-cog"></i> Tipos</button>
        </div>`;
    }
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
    let html = '<div style="display:flex;flex-direction:column;gap:10px;">';
    tipos.forEach((t, idx) => {
        html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:#f9f9f9;border-radius:6px;">
            <div><strong>${t.nome}</strong><br><small>Intervalo: ${t.intervalo} ${unidade}</small></div>
            <button class="btn-icon" onclick="removerTipoManutencao('${placa}', ${idx})"><i class="fas fa-trash text-danger"></i></button>
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

function configurarEventos() {
    document.getElementById('btnNovaManutencao')?.addEventListener('click', () => {
        document.getElementById('formManutencao').reset();
        editingId = null;
        document.getElementById('modalManutencao').style.display = 'flex';
    });
    document.getElementById('btnConfigurarTipos')?.addEventListener('click', () => {
        document.getElementById('modalConfigTipos').style.display = 'flex';
    });
    document.getElementById('btnCheckAlertas')?.addEventListener('click', verificarAlertas);
    document.getElementById('btnNovoVeiculo')?.addEventListener('click', () => {
        document.getElementById('modalNovoVeiculo').style.display = 'flex';
    });
    document.getElementById('salvarNovoVeiculo')?.addEventListener('click', salvarNovoVeiculo);
    document.getElementById('btnAddTipo')?.addEventListener('click', abrirModalAddTipo);
    document.getElementById('formManutencao')?.addEventListener('submit', salvarManutencao);
    document.getElementById('veiculoSelect')?.addEventListener('change', atualizarSelectTipos);
    document.getElementById('configVeiculoSelect')?.addEventListener('change', (e) => {
        if (e.target.value) carregarTiposVeiculo(e.target.value);
    });
    
    document.querySelectorAll('.modal-close, .modal-overlay').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target === el || e.target.classList.contains('modal-close')) {
                el.closest('.modal-overlay').style.display = 'none';
            }
        });
    });
}

function configurarAbas() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
        });
    });
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

window.editarManutencao = editarManutencao;
window.excluirManutencao = excluirManutencao;
window.configurarTiposVeiculo = configurarTiposVeiculo;
window.removerTipoManutencao = removerTipoManutencao;

document.addEventListener('DOMContentLoaded', inicializar);
