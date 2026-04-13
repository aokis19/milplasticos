// manut.js - Gerenciador de Manutenção Completo CORRIGIDO

// ================== VARIÁVEIS GLOBAIS ==================
let manutencoes = [];
let manutencoesCorretivas = [];
let veiculos = [];
let tiposManutencao = {};
let editingId = null;
let editingCorretivaId = null;

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
    
    await renderPreventivas();
    await renderProximas();
    await renderVeiculosList();
    await renderCorretivas();
    
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
                console.log(`✅ ${veiculos.length} veículos carregados`);
                localStorage.setItem('veiculos', JSON.stringify(veiculos));
                atualizarSelectsVeiculos();
                return;
            }
        }
        const veiculosSalvos = localStorage.getItem('veiculos');
        veiculos = veiculosSalvos ? JSON.parse(veiculosSalvos) : [];
        console.log(`💾 ${veiculos.length} veículos do localStorage`);
        atualizarSelectsVeiculos();
    } catch (error) {
        console.error('Erro ao carregar veículos:', error);
        veiculos = [];
    }
}

async function carregarManutencoes() {
    if (window.firebaseDB) {
        try {
            const snapshot = await window.firebaseDB.collection('manutencoes')
                .orderBy('data', 'desc')
                .get();
            manutencoes = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                manutencoes.push({ firebaseId: doc.id, ...data });
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
    manutencoes = JSON.parse(localStorage.getItem('manutencoes')) || [];
    console.log(`💾 ${manutencoes.length} manutenções preventivas do localStorage`);
}

async function carregarManutencoesCorretivas() {
    if (window.firebaseDB) {
        try {
            const snapshot = await window.firebaseDB.collection('manutencoesCorretivas')
                .orderBy('data', 'desc')
                .get();
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
    manutencoesCorretivas = JSON.parse(localStorage.getItem('manutencoesCorretivas')) || [];
    console.log(`💾 ${manutencoesCorretivas.length} manutenções corretivas do localStorage`);
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
    tiposManutencao = JSON.parse(localStorage.getItem('tiposManutencao')) || {};
}

// ================== FUNÇÕES AUXILIARES ==================
// Buscar KM atual do veículo (do último abastecimento)
function obterKmAtualVeiculo(placa) {
    // Buscar KM do último abastecimento
    const abastecimentos = JSON.parse(localStorage.getItem('abastecimentos')) || [];
    const abastVeiculo = abastecimentos.filter(a => a.veiculoPlaca === placa);
    if (abastVeiculo.length > 0) {
        abastVeiculo.sort((a, b) => new Date(b.data) - new Date(a.data));
        const km = abastVeiculo[0].odometro || abastVeiculo[0].horimetro || 0;
        if (km > 0) return km;
    }
    
    // Fallback: KM salvo manualmente
    const kmSalvo = localStorage.getItem(`km_atual_${placa}`);
    if (kmSalvo) return parseInt(kmSalvo);
    
    // Buscar na última manutenção preventiva (mais recente)
    const manutVeiculo = manutencoes.filter(m => m.veiculoPlaca === placa);
    if (manutVeiculo.length > 0) {
        manutVeiculo.sort((a, b) => new Date(b.data) - new Date(a.data));
        return manutVeiculo[0].kmAtual || 0;
    }
    
    return 0;
}

// Identificar qual é a última manutenção de cada veículo/tipo
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
                select.innerHTML += `<option value="${v.placa}">${v.placa} - ${v.nome}</option>`;
            });
        }
    });
}

function atualizarSelectTiposPreventiva() {
    const veiculoPlaca = document.getElementById('preventivaVeiculo').value;
    const select = document.getElementById('preventivaTipo');
    if (!veiculoPlaca) {
        select.innerHTML = '<option value="">Selecione primeiro o veículo</option>';
        return;
    }
    const tipos = tiposManutencao[veiculoPlaca] || [];
    if (tipos.length === 0) {
        select.innerHTML = '<option value="">Nenhum tipo configurado</option>';
    } else {
        select.innerHTML = '<option value="">Selecione...</option>' + tipos.map(t => `<option value="${t.nome}">${t.nome} (${t.intervalo})</option>`).join('');
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
async function salvarPreventiva(e) {
    e.preventDefault();
    
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
        id: editingId || Date.now(),
        veiculoPlaca,
        veiculoNome: veiculo?.nome,
        tipo,
        data,
        kmAtual,
        proximaManutencao,
        intervaloProximo,
        observacoes,
        dataRegistro: new Date().toISOString()
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
    localStorage.setItem(`km_atual_${veiculoPlaca}`, kmAtual);
    
    alert(editingId ? 'Manutenção atualizada!' : 'Manutenção registrada!');
    
    document.getElementById('formPreventiva').reset();
    document.getElementById('modalPreventiva').style.display = 'none';
    editingId = null;
    
    await renderPreventivas();
    await renderProximas();
}

function editarPreventiva(id) {
    const m = manutencoes.find(m => m.id === id);
    if (!m) return;
    editingId = m.id;
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
    const m = manutencoes.find(m => m.id === id);
    if (m?.firebaseId && window.firebaseDB) {
        await window.firebaseDB.collection('manutencoes').doc(m.firebaseId).delete();
    }
    manutencoes = manutencoes.filter(m => m.id !== id);
    localStorage.setItem('manutencoes', JSON.stringify(manutencoes));
    alert('Excluído!');
    await renderPreventivas();
    await renderProximas();
}

// RENDERIZAÇÃO DO HISTÓRICO PREVENTIVO (SEM STATUS PARA REGISTROS ANTIGOS)
async function renderPreventivas() {
    const tbody = document.getElementById('preventivaBody');
    if (!tbody) return;
    
    if (manutencoes.length === 0) {
        tbody.innerHTML = '发展<td colspan="7" style="text-align:center;">Nenhuma manutenção preventiva registrada.发展</td>';
        return;
    }
    
    // Identificar a última manutenção de cada veículo/tipo
    const ultimas = getUltimaManutencaoPorVeiculoTipo();
    
    let html = '';
    for (const m of manutencoes) {
        const key = `${m.veiculoPlaca}_${m.tipo}`;
        const isUltima = ultimas[key]?.id === m.id;
        
        let statusHtml = '';
        if (isUltima) {
            // Só calcular status para a última manutenção
            const kmAtual = obterKmAtualVeiculo(m.veiculoPlaca);
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
            // Registros antigos - apenas "Concluída" sem status de alerta
            statusHtml = '<span class="status-badge status-ok" style="background:#d4edda; color:#155724;">✅ CONCLUÍDA</span>';
        }
        
        html += `<tr>
            <td>${new Date(m.data).toLocaleDateString('pt-BR')}</td>
            <td><strong>${m.veiculoNome}</strong><br><small>${m.veiculoPlaca}</small></td>
            <td>${m.tipo}</td>
            <td>${m.kmAtual.toLocaleString('pt-BR')}</td>
            <td>${m.proximaManutencao.toLocaleString('pt-BR')}</td>
            <td>${statusHtml}</td>
            <td>
                <button class="btn-icon" onclick="editarPreventiva(${m.id})"><i class="fas fa-edit"></i></button>
                <button class="btn-icon delete" onclick="excluirPreventiva(${m.id})"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    }
    tbody.innerHTML = html;
    console.log(`📊 Renderizadas ${manutencoes.length} preventivas`);
}

// RENDERIZAÇÃO DAS PRÓXIMAS (APENAS ÚLTIMA DE CADA VEÍCULO/TIPO)
async function renderProximas() {
    const container = document.getElementById('proximasBody');
    if (!container) return;
    
    // Pegar apenas a última manutenção de cada veículo/tipo
    const ultimas = getUltimaManutencaoPorVeiculoTipo();
    const ultimasArray = Object.values(ultimas);
    
    const programadas = [];
    for (const m of ultimasArray) {
        const kmAtual = obterKmAtualVeiculo(m.veiculoPlaca);
        const restantes = m.proximaManutencao - kmAtual;
        
        console.log(`🔍 ${m.veiculoPlaca} - ${m.tipo}: Atual=${kmAtual}, Próxima=${m.proximaManutencao}, Restam=${restantes}`);
        
        // Mostrar todas (não só as próximas) para debug
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
        
        html += `<div class="programada-card ${classe}">
            <div class="programada-header">
                <div class="programada-veiculo">${m.veiculoPlaca} - ${m.veiculoNome}</div>
                <span class="programada-tipo">${m.tipo}</span>
            </div>
            <div class="programada-detalhes">📅 Última troca: ${new Date(m.data).toLocaleDateString('pt-BR')} (${m.kmAtual.toLocaleString('pt-BR')})</div>
            <div class="programada-km">⚠️ Próxima troca: ${m.proximaManutencao.toLocaleString('pt-BR')} - ${statusText}</div>
            <div class="programada-acoes">
                <button class="btn btn-sm btn-primary" onclick="editarPreventiva(${m.id})">Registrar Troca</button>
            </div>
        </div>`;
    }
    html += '</div>';
    container.innerHTML = html;
    document.getElementById('totalProgramadas').textContent = programadas.length;
    console.log(`📊 ${programadas.length} programadas encontradas`);
}

// ================== MANUTENÇÕES CORRETIVAS ==================
async function salvarCorretiva(e) {
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
    if (fileInput.files.length > 0) {
        anexoData = await anexarArquivo(fileInput.files[0]);
    }
    
    const manutencaoData = {
        id: editingCorretivaId || Date.now(),
        veiculoPlaca,
        veiculoNome: veiculo?.nome,
        tipo: tipo,
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
    
    await renderCorretivas();
}

function editarCorretiva(id) {
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
    if (m.garantiaFim) document.getElementById('corretivaGarantiaFim').value = m.garantiaFim;
    if (m.anexo) {
        document.getElementById('corretivaAnexoPreview').style.display = 'flex';
        document.getElementById('corretivaAnexoNome').textContent = m.anexo.nome;
    }
    document.getElementById('modalCorretiva').style.display = 'flex';
}

async function excluirCorretiva(id) {
    if (!confirm('Excluir esta manutenção?')) return;
    const m = manutencoesCorretivas.find(m => m.id === id);
    if (m?.firebaseId && window.firebaseDB) {
        await window.firebaseDB.collection('manutencoesCorretivas').doc(m.firebaseId).delete();
    }
    manutencoesCorretivas = manutencoesCorretivas.filter(m => m.id !== id);
    localStorage.setItem('manutencoesCorretivas', JSON.stringify(manutencoesCorretivas));
    alert('Excluído!');
    await renderCorretivas();
}

function verificarGarantia(garantiaFim) {
    if (!garantiaFim) return { texto: 'Sem garantia', classe: '' };
    const hoje = new Date();
    const dataFim = new Date(garantiaFim);
    if (dataFim < hoje) return { texto: 'Garantia expirada', classe: 'status-urgente' };
    const diasRestantes = Math.ceil((dataFim - hoje) / (1000 * 60 * 60 * 24));
    if (diasRestantes <= 30) return { texto: `Garantia: ${diasRestantes} dias`, classe: 'status-proximo' };
    return { texto: `Garantia até ${new Date(garantiaFim).toLocaleDateString('pt-BR')}`, classe: 'status-ok' };
}

async function renderCorretivas() {
    const tbody = document.getElementById('corretivaBody');
    if (!tbody) {
        console.log('⚠️ Elemento corretivaBody não encontrado');
        return;
    }
    
    if (manutencoesCorretivas.length === 0) {
        tbody.innerHTML = '发展<td colspan="8" style="text-align:center;">Nenhuma manutenção corretiva registrada.发展</tr>';
        return;
    }
    
    let html = '';
    for (const m of manutencoesCorretivas) {
        const garantia = verificarGarantia(m.garantiaFim);
        const anexoHtml = m.anexo ? `<button class="btn-icon" onclick="visualizarAnexo(${m.id})"><i class="fas fa-paperclip"></i></button>` : '-';
        
        html += `<tr>
            <td>${new Date(m.data).toLocaleDateString('pt-BR')}</td>
            <td><strong>${m.veiculoNome}</strong><br><small>${m.veiculoPlaca}</small></td>
            <td>${m.tipo}</td>
            <td>${m.descricao.length > 50 ? m.descricao.substring(0, 50) + '...' : m.descricao}</td>
            <td>${m.valor > 0 ? m.valor.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) : '-'}</td>
            <td class="${garantia.classe}">${garantia.texto}</td>
            <td>${anexoHtml}</td>
            <td>
                <button class="btn-icon" onclick="editarCorretiva(${m.id})"><i class="fas fa-edit"></i></button>
                <button class="btn-icon delete" onclick="excluirCorretiva(${m.id})"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    }
    tbody.innerHTML = html;
    console.log(`📊 Renderizadas ${manutencoesCorretivas.length} corretivas`);
}

function visualizarAnexo(id) {
    const m = manutencoesCorretivas.find(m => m.id === id);
    if (!m || !m.anexo) return;
    document.getElementById('visualizarAnexoIframe').src = m.anexo.base64;
    document.getElementById('modalVisualizarAnexo').style.display = 'flex';
    document.getElementById('baixarAnexoBtn').onclick = () => {
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
        reader.onload = (e) => resolve({ nome: file.name, base64: e.target.result });
        reader.readAsDataURL(file);
    });
}

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
        const kmAtual = obterKmAtualVeiculo(v.placa);
        html += `<div class="veiculo-card">
            <div><h4>${v.nome}</h4><p>Placa: ${v.placa} | Unidade: ${v.tipoMedidor || 'KM'} | KM Atual: ${kmAtual.toLocaleString('pt-BR')}</p></div>
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

function abrirModalAddTipo() {
    const nome = prompt('Nome do tipo de manutenção:');
    if (!nome) return;
    const intervalo = prompt('Intervalo (KM/Horas):');
    if (!intervalo) return;
    const placa = document.getElementById('configVeiculoSelect').value;
    if (!placa) { alert('Selecione um veículo'); return; }
    
    if (!tiposManutencao[placa]) tiposManutencao[placa] = [];
    tiposManutencao[placa].push({ nome, intervalo: parseInt(intervalo) });
    localStorage.setItem('tiposManutencao', JSON.stringify(tiposManutencao));
    if (window.firebaseDB) {
        window.firebaseDB.collection('tiposManutencao').doc(placa).set(tiposManutencao[placa]);
    }
    carregarTiposVeiculo(placa);
    atualizarSelectTiposPreventiva();
}

function removerTipoManutencao(placa, idx) {
    if (!confirm('Remover este tipo?')) return;
    tiposManutencao[placa].splice(idx, 1);
    if (tiposManutencao[placa].length === 0) delete tiposManutencao[placa];
    localStorage.setItem('tiposManutencao', JSON.stringify(tiposManutencao));
    if (window.firebaseDB && tiposManutencao[placa]) {
        window.firebaseDB.collection('tiposManutencao').doc(placa).set(tiposManutencao[placa]);
    } else if (window.firebaseDB) {
        window.firebaseDB.collection('tiposManutencao').doc(placa).delete();
    }
    carregarTiposVeiculo(placa);
    atualizarSelectTiposPreventiva();
}

async function salvarNovoVeiculo() {
    const nome = document.getElementById('novoVeiculoNome').value.trim();
    if (!nome) { alert('Informe o nome do veículo'); return; }
    const unidade = document.getElementById('novoVeiculoUnidade').value;
    const novoVeiculo = {
        id: Date.now(),
        nome,
        placa: nome.substring(0, 8).toUpperCase().replace(/\s/g, ''),
        tipoMedidor: unidade === 'KM' ? 'km' : 'horas',
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
    const ultimas = getUltimaManutencaoPorVeiculoTipo();
    const alertas = [];
    
    for (const m of Object.values(ultimas)) {
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
    // Preventiva
    document.getElementById('btnNovaPreventiva')?.addEventListener('click', () => {
        document.getElementById('formPreventiva').reset();
        editingId = null;
        document.getElementById('modalPreventiva').style.display = 'flex';
    });
    document.getElementById('formPreventiva')?.addEventListener('submit', salvarPreventiva);
    document.getElementById('preventivaVeiculo')?.addEventListener('change', atualizarSelectTiposPreventiva);
    
    // Corretiva
    document.getElementById('btnNovaCorretiva')?.addEventListener('click', () => {
        document.getElementById('formCorretiva').reset();
        document.getElementById('corretivaAnexoPreview').style.display = 'none';
        editingCorretivaId = null;
        document.getElementById('modalCorretiva').style.display = 'flex';
    });
    document.getElementById('formCorretiva')?.addEventListener('submit', salvarCorretiva);
    document.getElementById('corretivaGarantiaMeses')?.addEventListener('input', calcularGarantiaFim);
    document.getElementById('corretivaData')?.addEventListener('change', calcularGarantiaFim);
    
    // Anexo
    document.getElementById('corretivaAnexo')?.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            document.getElementById('corretivaAnexoPreview').style.display = 'flex';
            document.getElementById('corretivaAnexoNome').textContent = e.target.files[0].name;
        }
    });
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
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
            
            if (btn.dataset.tab === 'preventiva') renderPreventivas();
            if (btn.dataset.tab === 'proximas') renderProximas();
            if (btn.dataset.tab === 'config') renderVeiculosList();
            if (btn.dataset.tab === 'corretiva') renderCorretivas();
        });
    });
}

// Exportar funções globais
window.editarPreventiva = editarPreventiva;
window.excluirPreventiva = excluirPreventiva;
window.editarCorretiva = editarCorretiva;
window.excluirCorretiva = excluirCorretiva;
window.visualizarAnexo = visualizarAnexo;
window.configurarTiposVeiculo = configurarTiposVeiculo;
window.removerTipoManutencao = removerTipoManutencao;

// Inicializar
document.addEventListener('DOMContentLoaded', inicializar);
