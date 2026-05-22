<script>
(function() {
    'use strict';
    
    console.log('🚀 Central de Custos v2.0 - Inicializando...');
    
    // ========== CONFIGURAÇÃO FIREBASE ==========
    const firebaseConfig = {
        apiKey: "AIzaSyD4GQv7odzKtxg36f_SSWLbQF-TmYi4xYI",
        authDomain: "system-mil.firebaseapp.com",
        projectId: "system-mil",
        storageBucket: "system-mil.firebasestorage.app",
        messagingSenderId: "138426359863",
        appId: "1:138426359863:web:ab731a7ae1b7e03f7a1fb2"
    };

    // ========== VARIÁVEIS GLOBAIS ==========
    let db = null, usandoFirebase = false;
    let periodos = [], setores = [], categorias = [], itensCusto = [], producoes = [];
    let materiais = [], custosMateriais = [], custosFixos = [];
    let periodoAtual = null, setorAtual = null;
    let pieChart = null, barChart = null;
    let nivelAtual = 'periodos';
    let setoresSelecionadosGerar = new Map();
    let filtroAnoAtual = 'todos';
    let periodoOrigemCopia = null;
    let custoFixoSelecionadoId = null;
    let confirmCallback = null;

    let configCampos = {
        setorNome: 'Nome do Setor',
        setorDesc: 'Descrição',
        custoTotal: 'Custo Total',
        producaoKg: 'Produção (KG)',
        custoPorKg: 'Custo por KG'
    };

    const STORAGE_KEY = 'centralCustos_v11_milplasticos';
    const CONFIG_KEY = 'centralCustos_config_v11';

    // ========== TOAST SYSTEM ==========
    function showToast(type, title, message, duration = 4000) {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
        
        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || '📢'}</div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                ${message ? `<div class="toast-message">${message.replace(/\n/g, '<br>')}</div>` : ''}
            </div>
            <div class="toast-close" onclick="this.parentElement.remove()">✕</div>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // ========== MODAL DE CONFIRMAÇÃO ==========
    function showConfirm(title, message, icon, callback) {
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
        document.getElementById('confirmIcon').textContent = icon || '⚠️';
        document.getElementById('modalConfirm').classList.add('active');
        confirmCallback = callback;
    }

    // Evento do botão confirmar
    document.addEventListener('DOMContentLoaded', function() {
        const confirmBtn = document.getElementById('confirmBtn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', function() {
                if (typeof confirmCallback === 'function') {
                    confirmCallback();
                }
                window.fecharModal('modalConfirm');
                confirmCallback = null;
            });
        }
    });

    // ========== TEMA ESCURO ==========
    window.toggleTheme = function() {
        document.body.classList.toggle('dark-theme');
        const isDark = document.body.classList.contains('dark-theme');
        localStorage.setItem('darkTheme', isDark);
        showToast('info', 'Tema alterado', isDark ? 'Modo escuro ativado 🌙' : 'Modo claro ativado ☀️', 2000);
    };

    // Inicializar tema
    if (localStorage.getItem('darkTheme') === 'true') {
        document.body.classList.add('dark-theme');
    }

    // ========== ARMAZENAMENTO LOCAL ==========
    function loadLocalData() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (data) {
                const p = JSON.parse(data);
                periodos = p.periodos || [];
                setores = p.setores || [];
                categorias = p.categorias || [];
                itensCusto = p.itensCusto || [];
                producoes = p.producoes || [];
                materiais = p.materiais || [];
                custosMateriais = p.custosMateriais || [];
                custosFixos = p.custosFixos || [];
            } else {
                periodos = []; setores = []; materiais = []; custosMateriais = []; custosFixos = [];
                categorias = [
                    { id: 'cat1', nome: 'Energia Elétrica', cor: '#f57c00' },
                    { id: 'cat2', nome: 'Matéria-Prima', cor: '#0d904f' },
                    { id: 'cat3', nome: 'Mão de Obra', cor: '#0277bd' },
                    { id: 'cat4', nome: 'Manutenção', cor: '#6a1b9a' },
                    { id: 'cat5', nome: 'Insumos', cor: '#c62828' }
                ];
                itensCusto = []; producoes = [];
            }
            
            const savedConfig = localStorage.getItem(CONFIG_KEY);
            if (savedConfig) {
                try {
                    configCampos = { ...configCampos, ...JSON.parse(savedConfig) };
                } catch(e) {}
            }
        } catch(e) {
            console.error('Erro ao carregar dados locais:', e);
            periodos = []; setores = []; materiais = []; custosMateriais = []; custosFixos = [];
            categorias = [
                { id: 'cat1', nome: 'Energia Elétrica', cor: '#f57c00' },
                { id: 'cat2', nome: 'Matéria-Prima', cor: '#0d904f' },
                { id: 'cat3', nome: 'Mão de Obra', cor: '#0277bd' },
                { id: 'cat4', nome: 'Manutenção', cor: '#6a1b9a' },
                { id: 'cat5', nome: 'Insumos', cor: '#c62828' }
            ];
            itensCusto = []; producoes = [];
        }
    }

    function saveLocalData() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                periodos, setores, categorias, itensCusto, producoes,
                materiais, custosMateriais, custosFixos
            }));
        } catch(e) {
            console.error('Erro ao salvar dados locais:', e);
        }
    }

    function saveConfig() {
        try {
            localStorage.setItem(CONFIG_KEY, JSON.stringify(configCampos));
        } catch(e) {}
    }

    // ========== INICIALIZAÇÃO ==========
    loadLocalData();

    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        usandoFirebase = true;
        
        const statusEl = document.getElementById('firebaseStatus');
        if (statusEl) {
            statusEl.innerHTML = '<span class="status-dot"></span> 🔥 Firebase';
            statusEl.className = 'firebase-status status-firebase';
        }
        
        carregarDadosFirebase();
    } catch (e) {
        console.log('Firebase não disponível, usando armazenamento local');
        
        const statusEl = document.getElementById('firebaseStatus');
        if (statusEl) {
            statusEl.innerHTML = '<span class="status-dot"></span> 💾 Local';
            statusEl.className = 'firebase-status status-local';
        }
        
        renderizarTela();
        document.getElementById('loadingOverlay').classList.remove('active');
    }

    async function carregarDadosFirebase() {
        if (!usandoFirebase || !db) {
            renderizarTela();
            document.getElementById('loadingOverlay').classList.remove('active');
            return;
        }
        
        try {
            const snaps = await Promise.all([
                db.collection('custos_periodos').get(),
                db.collection('custos_setores').get(),
                db.collection('custos_categorias').get(),
                db.collection('custos_itens').get(),
                db.collection('custos_producoes').get(),
                db.collection('custos_materiais').get(),
                db.collection('custos_materiais_custos').get(),
                db.collection('custos_fixos').get()
            ]);
            
            periodos = snaps[0].docs.map(d => ({ id: d.id, ...d.data() }));
            setores = snaps[1].docs.map(d => ({ id: d.id, ...d.data() }));
            categorias = snaps[2].docs.map(d => ({ id: d.id, ...d.data() }));
            itensCusto = snaps[3].docs.map(d => ({ id: d.id, ...d.data() }));
            producoes = snaps[4].docs.map(d => ({ id: d.id, ...d.data() }));
            materiais = snaps[5].docs.map(d => ({ id: d.id, ...d.data() }));
            custosMateriais = snaps[6].docs.map(d => ({ id: d.id, ...d.data() }));
            custosFixos = snaps[7].docs.map(d => ({ id: d.id, ...d.data() }));
            
            saveLocalData();
            renderizarTela();
            document.getElementById('loadingOverlay').classList.remove('active');
            
            console.log('✅ Dados carregados do Firebase com sucesso!');
        } catch (e) { 
            console.error('Erro ao carregar Firebase:', e);
            renderizarTela();
            document.getElementById('loadingOverlay').classList.remove('active');
        }
    }

    async function salvarFB(col, dados) {
        if (!usandoFirebase || !db) return;
        try {
            if (dados.id) {
                await db.collection(col).doc(dados.id).set(dados);
            } else {
                const ref = await db.collection(col).add(dados);
                dados.id = ref.id;
            }
        } catch (e) { 
            console.error('Erro ao salvar no Firebase:', e); 
        }
    }

    async function excluirFB(col, id) {
        if (!usandoFirebase || !db || !id) return;
        try { 
            await db.collection(col).doc(id).delete(); 
        } catch (e) { 
            console.error('Erro ao excluir:', e); 
        }
    }

    // ========== FUNÇÕES UTILITÁRIAS ==========
    function formatMoney(v) { 
        return 'R$ ' + (parseFloat(v) || 0).toFixed(2).replace('.', ','); 
    }
    
    function formatNumber(n, d) { 
        return (parseFloat(n) || 0).toFixed(d || 2).replace('.', ','); 
    }
    
    function getNomeMes(m) {
        const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                       'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
        return meses[(parseInt(m) || 1) - 1] || '';
    }

    function getSetoresDoPeriodo() {
        if (!periodoAtual) return [];
        return setores.filter(s => s.periodoId === periodoAtual.id).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    }

    function getSetoresFinais(periodoId) {
        return setores.filter(s => s.periodoId === periodoId && s.produtoFinal === true);
    }

    function calcularCustosSetor(setorId) {
        const itens = itensCusto.filter(i => i.setorId === setorId);
        const totalCusto = itens.reduce((s, i) => s + ((parseFloat(i.valorTotal) || 0) * (parseFloat(i.percentual) || 0) / 100), 0);
        const prods = producoes.filter(p => p.setorId === setorId);
        const totalKg = prods.reduce((s, p) => s + (parseFloat(p.kg) || 0), 0);
        const custoPorKg = totalKg > 0 ? totalCusto / totalKg : 0;
        return { totalCusto, totalKg, custoPorKg, qtdItens: itens.length };
    }

    function getCustoPorKgSetor(setorId) {
        const { totalCusto, totalKg } = calcularCustosSetor(setorId);
        return totalKg > 0 ? totalCusto / totalKg : 0;
    }

    function calcularResumoPeriodo() {
        if (!periodoAtual) return { 
            custoTotalGeral: 0, producaoTotalGeral: 0, custoPorKgGeral: 0, 
            qtdSetores: 0, qtdProdutosFinais: 0, setoresFinais: [] 
        };
        
        const sets = getSetoresDoPeriodo();
        let custoTotalGeral = 0, producaoTotalGeral = 0;
        
        sets.forEach(s => { 
            custoTotalGeral += calcularCustosSetor(s.id).totalCusto; 
        });
        
        const setoresFinais = getSetoresFinais(periodoAtual.id);
        const detalhesFinais = [];
        
        setoresFinais.forEach(sf => {
            const { totalCusto, totalKg, custoPorKg } = calcularCustosSetor(sf.id);
            producaoTotalGeral += totalKg;
            detalhesFinais.push({ setor: sf, custo: totalCusto, producao: totalKg, custoPorKg });
        });
        
        return {
            custoTotalGeral, 
            producaoTotalGeral,
            custoPorKgGeral: producaoTotalGeral > 0 ? custoTotalGeral / producaoTotalGeral : 0,
            qtdSetores: sets.length, 
            qtdProdutosFinais: setoresFinais.length, 
            setoresFinais: detalhesFinais
        };
    }

    function getHistoricoMaterial(materialId) {
        return custosMateriais
            .filter(cm => cm.materialId === materialId)
            .sort((a, b) => {
                if (a.ano !== b.ano) return b.ano - a.ano;
                return b.mes - a.mes;
            });
    }

    // ========== RENDERIZAÇÃO PRINCIPAL ==========
    function renderizarTela() {
        try {
            if (nivelAtual === 'periodos') renderizarPeriodos();
            else if (nivelAtual === 'setores') renderizarSetores();
            else if (nivelAtual === 'analise') renderizarAnalise();
            else if (nivelAtual === 'materiais') renderizarMateriais();
            else if (nivelAtual === 'historicoMaterial') renderizarHistoricoMaterial();
            else {
                nivelAtual = 'periodos';
                renderizarPeriodos();
            }
            atualizarBreadcrumb();
        } catch (error) {
            console.error('Erro ao renderizar:', error);
            nivelAtual = 'periodos';
            periodoAtual = null;
            setorAtual = null;
            renderizarPeriodos();
            atualizarBreadcrumb();
        }
    }

    // ========== HOME - PERÍODOS ==========
    function renderizarPeriodos() {
        const container = document.getElementById('conteudoDinamico');
        if (!container) return;
        
        const anosDisponiveis = [...new Set(periodos.map(p => p.ano))].sort((a, b) => b - a);
        
        let periodosFiltrados = [...periodos];
        if (filtroAnoAtual !== 'todos') {
            periodosFiltrados = periodosFiltrados.filter(p => p.ano === parseInt(filtroAnoAtual));
        }
        
        const periodosOrdenados = periodosFiltrados.sort((a, b) => {
            if (a.ano !== b.ano) return b.ano - a.ano;
            return b.mes - a.mes;
        });

        let html = `
            <div class="card">
                <div class="card-header">
                    <span class="card-title"><i class="fas fa-calendar-alt"></i> Períodos de Análise</span>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <div class="filtro-ano">
                            <label style="font-size: 0.8rem; font-weight: 500;">Ano:</label>
                            <select id="filtroAno" onchange="window.mudarFiltroAno(this.value)">
                                <option value="todos" ${filtroAnoAtual === 'todos' ? 'selected' : ''}>Todos</option>
                                ${anosDisponiveis.map(a => `<option value="${a}" ${filtroAnoAtual == a ? 'selected' : ''}>${a}</option>`).join('')}
                            </select>
                        </div>
                        <button class="btn btn-primary btn-sm" onclick="window.abrirModalPeriodo()">
                            <i class="fas fa-plus"></i> Novo
                        </button>
                    </div>
                </div>`;

        if (periodosOrdenados.length === 0) {
            html += '<div style="text-align:center;padding:3rem;"><i class="fas fa-calendar-times" style="font-size:3rem;color:var(--text-light);margin-bottom:1rem;display:block;"></i><p style="color:var(--text-light);">Nenhum período encontrado. Clique em "Novo" para começar!</p></div>';
        } else {
            html += '<div class="periodos-grid" id="periodosGrid"></div>';
        }
        
        html += '</div>';

        // Custos Fixos
        html += `
            <div class="card">
                <div class="card-header">
                    <span class="card-title"><i class="fas fa-thumbtack" style="color:var(--warning);"></i> Custos Fixos</span>
                    <button class="btn btn-warning btn-sm" onclick="window.abrirModalCustoFixo()"><i class="fas fa-plus"></i> Novo</button>
                </div>`;

        if (custosFixos.length === 0) {
            html += '<div style="text-align:center;padding:2rem;"><p style="color:var(--text-light);">Nenhum custo fixo cadastrado.</p></div>';
        } else {
            html += '<div class="custos-fixos-grid" id="custosFixosGrid"></div>';
        }
        
        html += '</div>';

        // Materiais
        html += `
            <div class="card">
                <div class="card-header">
                    <span class="card-title"><i class="fas fa-boxes"></i> Materiais</span>
                    <button class="btn btn-teal" onclick="window.abrirModalMaterial()"><i class="fas fa-plus"></i> Novo</button>
                </div>`;

        if (materiais.length === 0) {
            html += '<div style="text-align:center;padding:2rem;"><p style="color:var(--text-light);">Nenhum material cadastrado.</p></div>';
        } else {
            html += '<div class="materiais-grid" id="materiaisGrid"></div>';
        }
        
        html += '</div>';

        container.innerHTML = html;

        // Popular grids se existirem
        if (periodosOrdenados.length > 0) {
            const grid = document.getElementById('periodosGrid');
            if (grid) {
                periodosOrdenados.forEach(per => {
                    const backup = periodoAtual;
                    periodoAtual = per;
                    const resumo = calcularResumoPeriodo();
                    periodoAtual = backup;
                    
                    const div = document.createElement('div');
                    div.className = 'periodo-card';
                    div.onclick = () => window.selecionarPeriodo(per.id);
                    div.innerHTML = `
                        <div class="acoes">
                            <button class="btn btn-info btn-xs" onclick="event.stopPropagation(); window.abrirCopiarPeriodo('${per.id}')" title="Copiar período completo com todos os dados">
                                <i class="fas fa-copy"></i>
                            </button>
                            <button class="btn btn-outline btn-xs" onclick="event.stopPropagation(); window.editarPeriodo('${per.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-danger btn-xs" onclick="event.stopPropagation(); window.excluirPeriodo('${per.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                        <div class="periodo-titulo">
                            <i class="fas fa-calendar-check"></i> ${getNomeMes(per.mes)}/${per.ano}
                        </div>
                        <div class="periodo-obs">${per.obs || 'Sem descrição'}</div>
                        <div class="periodo-stats">
                            <div class="periodo-stat">
                                <span class="label">Setores</span>
                                <span class="valor">${resumo.qtdSetores}</span>
                            </div>
                            <div class="periodo-stat">
                                <span class="label">Produtos Finais</span>
                                <span class="valor">${resumo.qtdProdutosFinais}</span>
                            </div>
                            <div class="periodo-stat">
                                <span class="label">Custo Total</span>
                                <span class="valor money">${formatMoney(resumo.custoTotalGeral)}</span>
                            </div>
                            <div class="periodo-stat">
                                <span class="label">Produção Total</span>
                                <span class="valor">${formatNumber(resumo.producaoTotalGeral, 0)} kg</span>
                            </div>
                            <div class="periodo-stat">
                                <span class="label">Custo/KG</span>
                                <span class="valor money" style="color:var(--warning);">${formatMoney(resumo.custoPorKgGeral)}/kg</span>
                            </div>
                        </div>
                    `;
                    grid.appendChild(div);
                });
            }
        }

        if (custosFixos.length > 0) {
            const grid = document.getElementById('custosFixosGrid');
            if (grid) {
                custosFixos.forEach(cf => {
                    const cat = categorias.find(c => c.id === cf.categoriaId);
                    const div = document.createElement('div');
                    div.className = 'custo-fixo-item';
                    div.innerHTML = `
                        <div>
                            <div class="cf-nome">
                                <i class="fas fa-thumbtack" style="color:var(--warning);font-size:0.7rem;"></i> ${cf.nome}
                            </div>
                            <div class="cf-categoria">${cat ? cat.nome : 'Sem categoria'}</div>
                        </div>
                        <div class="cf-valor">${formatMoney(cf.valor)}</div>
                        <div>
                            <button class="btn btn-outline btn-xs" onclick="window.editarCustoFixo('${cf.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-danger btn-xs" onclick="window.excluirCustoFixo('${cf.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    `;
                    grid.appendChild(div);
                });
            }
        }

        if (materiais.length > 0) {
            const grid = document.getElementById('materiaisGrid');
            if (grid) {
                materiais.forEach(mat => {
                    const historico = getHistoricoMaterial(mat.id);
                    const ultimo = historico[0];
                    const div = document.createElement('div');
                    div.className = 'material-card';
                    div.onclick = () => window.abrirHistoricoMaterial(mat.id);
                    div.innerHTML = `
                        <div class="acoes">
                            <button class="btn btn-outline btn-xs" onclick="event.stopPropagation(); window.editarMaterial('${mat.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-danger btn-xs" onclick="event.stopPropagation(); window.excluirMaterial('${mat.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                        <div class="material-nome">
                            <i class="fas fa-cube"></i> ${mat.nome}
                        </div>
                        <div class="material-desc">${mat.descricao || ''}</div>
                        ${ultimo ? 
                            `<div class="material-ultimo"><strong>${formatMoney(ultimo.custoKgFinal)}/kg</strong> (${getNomeMes(ultimo.mes)}/${ultimo.ano})</div>` 
                            : '<div class="material-ultimo">Sem custos registrados</div>'}
                        <div style="font-size:0.7rem;margin-top:0.5rem;">${historico.length} registro(s)</div>
                    `;
                    grid.appendChild(div);
                });
            }
        }
    }

    // ========== FILTRO ANO ==========
    window.mudarFiltroAno = function(ano) {
        filtroAnoAtual = ano;
        nivelAtual = 'periodos';
        periodoAtual = null;
        setorAtual = null;
        renderizarTela();
    };

    // ========== COPIAR PERÍODO - VERSÃO COMPLETA ==========
    window.abrirCopiarPeriodo = function(periodoId) {
        periodoOrigemCopia = periodoId;
        const per = periodos.find(p => p.id === periodoId);
        if (!per) {
            showToast('error', 'Erro', 'Período não encontrado!');
            return;
        }
        
        document.getElementById('copiarOrigem').value = `${getNomeMes(per.mes)}/${per.ano} - ${per.obs || 'Sem descrição'}`;
        
        // Sugerir próximo mês
        const proxMes = (per.mes % 12) + 1;
        const proxAno = per.mes === 12 ? per.ano + 1 : per.ano;
        document.getElementById('copiarMes').value = proxMes;
        document.getElementById('copiarAno').value = proxAno;
        
        document.getElementById('modalCopiarPeriodo').classList.add('active');
    };

    window.copiarPeriodo = async function() {
        if (!periodoOrigemCopia) {
            showToast('error', 'Erro', 'Nenhum período de origem selecionado!');
            return;
        }
        
        const perOrigem = periodos.find(p => p.id === periodoOrigemCopia);
        if (!perOrigem) {
            showToast('error', 'Erro', 'Período de origem não encontrado!');
            return;
        }

        const novoMes = parseInt(document.getElementById('copiarMes').value);
        const novoAno = parseInt(document.getElementById('copiarAno').value);
        
        // Verificar se já existe
        const existe = periodos.find(p => p.mes === novoMes && p.ano === novoAno);
        if (existe) {
            showToast('error', 'Erro ao copiar', `Já existe um período em ${getNomeMes(novoMes)}/${novoAno}!`);
            return;
        }
        
        // Loading
        document.getElementById('loadingOverlay').classList.add('active');
        
        try {
            // Criar novo período
            const novoPeriodo = {
                mes: novoMes,
                ano: novoAno,
                obs: `Copiado de ${getNomeMes(perOrigem.mes)}/${perOrigem.ano}`,
                createdAt: new Date().toISOString(),
                id: 'per_' + Date.now()
            };
            
            periodos.push(novoPeriodo);
            await salvarFB('custos_periodos', novoPeriodo);
            
            // Copiar setores e seus dados
            const setoresOrigem = setores.filter(s => s.periodoId === periodoOrigemCopia);
            let setoresCopiados = 0;
            let itensCopiados = 0;
            let producoesCopiadas = 0;
            
            for (const s of setoresOrigem) {
                const novoSetorId = 'set_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
                const novoSetor = {
                    periodoId: novoPeriodo.id,
                    nome: s.nome,
                    descricao: s.descricao || '',
                    ordem: s.ordem || 1,
                    produtoFinal: s.produtoFinal || false,
                    createdAt: new Date().toISOString(),
                    id: novoSetorId
                };
                
                setores.push(novoSetor);
                setoresCopiados++;
                await salvarFB('custos_setores', novoSetor);
                
                // COPIAR ITENS DE CUSTO
                const itensSetor = itensCusto.filter(i => i.setorId === s.id);
                for (const item of itensSetor) {
                    const novoItem = {
                        setorId: novoSetorId,
                        tipo: item.tipo || 'normal',
                        categoriaId: item.categoriaId || null,
                        custoFixoId: item.custoFixoId || null,
                        nome: item.nome,
                        valorTotal: parseFloat(item.valorTotal) || 0,
                        percentual: parseFloat(item.percentual) || 100,
                        obs: item.obs || '',
                        createdAt: new Date().toISOString(),
                        id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)
                    };
                    
                    itensCusto.push(novoItem);
                    itensCopiados++;
                    await salvarFB('custos_itens', novoItem);
                }
                
                // COPIAR PRODUÇÕES
                const prodsSetor = producoes.filter(p => p.setorId === s.id);
                for (const prod of prodsSetor) {
                    const novaProd = {
                        setorId: novoSetorId,
                        produto: prod.produto,
                        kg: parseFloat(prod.kg) || 0,
                        data: prod.data,
                        createdAt: new Date().toISOString(),
                        id: 'prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)
                    };
                    
                    producoes.push(novaProd);
                    producoesCopiadas++;
                    await salvarFB('custos_producoes', novaProd);
                }
            }
            
            saveLocalData();
            window.fecharModal('modalCopiarPeriodo');
            
            showToast('success', 
                '✅ Período copiado com sucesso!',
                `${getNomeMes(novoMes)}/${novoAno} criado com:\n` +
                `📋 ${setoresCopiados} setor(es)\n` +
                `💰 ${itensCopiados} item(ns) de custo\n` +
                `🏭 ${producoesCopiadas} produção(ões)`,
                6000
            );
            
            renderizarTela();
            
        } catch (error) {
            console.error('Erro ao copiar período:', error);
            showToast('error', '❌ Erro ao copiar', 'Ocorreu um erro. Tente novamente.');
        } finally {
            document.getElementById('loadingOverlay').classList.remove('active');
        }
    };

    // ========== RENDERIZAR SETORES ==========
    function renderizarSetores() {
        if (!periodoAtual) { 
            navegarPara('periodos'); 
            return; 
        }
        
        const sets = getSetoresDoPeriodo();
        const resumo = calcularResumoPeriodo();
        const container = document.getElementById('conteudoDinamico');
        if (!container) return;

        container.innerHTML = `
            <div class="resumo-agregado">
                <h3><i class="fas fa-chart-pie"></i> Fechamento: ${getNomeMes(periodoAtual.mes)}/${periodoAtual.ano}</h3>
                <div class="stats-grid">
                    <div style="background:rgba(255,255,255,0.08);border-radius:8px;padding:1rem;text-align:center;">
                        <div style="font-size:1.5rem;font-weight:700;color:#4fc3f7;">${resumo.qtdSetores}</div>
                        <div style="font-size:0.72rem;opacity:0.7;">Setores</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.08);border-radius:8px;padding:1rem;text-align:center;">
                        <div style="font-size:1.5rem;font-weight:700;color:#4fc3f7;">${formatMoney(resumo.custoTotalGeral)}</div>
                        <div style="font-size:0.72rem;opacity:0.7;">Custo Total</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.08);border-radius:8px;padding:1rem;text-align:center;">
                        <div style="font-size:1.5rem;font-weight:700;color:#4fc3f7;">${formatNumber(resumo.producaoTotalGeral,0)} kg</div>
                        <div style="font-size:0.72rem;opacity:0.7;">Produção Total</div>
                    </div>
                    <div style="background:rgba(255,152,0,0.2);border:1px solid rgba(255,152,0,0.3);border-radius:8px;padding:1rem;text-align:center;">
                        <div style="font-size:1.5rem;font-weight:700;color:#ffb74d;">${formatMoney(resumo.custoPorKgGeral)}/kg</div>
                        <div style="font-size:0.72rem;opacity:0.7;">🏁 Custo por KG</div>
                    </div>
                </div>
            </div>
            <div class="card">
                <div class="card-header">
                    <span class="card-title"><i class="fas fa-industry"></i> Setores</span>
                    <div style="display:flex;gap:0.5rem;">
                        <button class="btn btn-primary btn-sm" onclick="window.abrirModalSetor()">
                            <i class="fas fa-plus"></i> Novo
                        </button>
                        <button class="btn btn-purple btn-sm" onclick="window.gerarPDFCentralCustos()">
                            <i class="fas fa-file-pdf"></i> PDF
                        </button>
                        <button class="btn btn-outline btn-sm" onclick="window.navegarPara('periodos')">
                            <i class="fas fa-arrow-left"></i> Voltar
                        </button>
                    </div>
                </div>
                <div class="setores-grid" id="setoresGrid"></div>
            </div>
        `;

        const grid = document.getElementById('setoresGrid');
        if (!grid) return;
        
        if (sets.length === 0) {
            grid.innerHTML = '<div style="text-align:center;padding:2rem;grid-column:1/-1;"><p style="color:var(--text-light);">Nenhum setor cadastrado. Clique em "Novo" para adicionar.</p></div>';
            return;
        }
        
        sets.forEach(setor => {
            const isFinal = setor.produtoFinal === true;
            const { totalCusto, totalKg, custoPorKg } = calcularCustosSetor(setor.id);
            
            const div = document.createElement('div');
            div.className = `setor-card ${isFinal ? 'produto-final' : ''}`;
            div.onclick = () => window.selecionarSetor(setor.id);
            div.innerHTML = `
                <div class="setor-acoes">
                    <button class="btn btn-outline btn-xs" onclick="event.stopPropagation(); window.editarSetor('${setor.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-xs" onclick="event.stopPropagation(); window.excluirSetor('${setor.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="setor-nome">
                    ${setor.nome} 
                    <span class="badge ${isFinal ? 'badge-orange' : 'badge-green'}">
                        ${isFinal ? '🏁 FINAL' : 'Etapa ' + (setor.ordem || 1)}
                    </span>
                </div>
                <div class="setor-desc">${setor.descricao || ''}</div>
                <div class="setor-info">
                    <div>
                        <div class="info-label">Custo</div>
                        <div class="info-valor money">${formatMoney(totalCusto)}</div>
                    </div>
                    <div>
                        <div class="info-label">Produção</div>
                        <div class="info-valor">${formatNumber(totalKg, 0)} kg</div>
                    </div>
                    <div style="grid-column:1/-1;">
                        <div class="info-label">Custo Médio/KG</div>
                        <div class="info-valor" style="color:${totalKg > 0 ? (isFinal ? '#e65100' : 'var(--teal)') : 'var(--text-light)'};">
                            ${totalKg > 0 ? formatMoney(custoPorKg) + '/kg' : 'Sem produção registrada'}
                        </div>
                    </div>
                </div>
            `;
            grid.appendChild(div);
        });
    }

    // ========== RENDERIZAR ANÁLISE ==========
    function renderizarAnalise() {
        if (!setorAtual) { 
            navegarPara('setores'); 
            return; 
        }
        
        const { totalCusto, totalKg, custoPorKg } = calcularCustosSetor(setorAtual.id);
        const container = document.getElementById('conteudoDinamico');
        if (!container) return;

        container.innerHTML = `
            <div class="stats-grid" style="margin-bottom:1.5rem;">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-dollar-sign"></i></div>
                    <div class="stat-value">${formatMoney(totalCusto)}</div>
                    <div class="stat-label">Custo Total</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-weight-hanging"></i></div>
                    <div class="stat-value">${formatNumber(totalKg, 0)} kg</div>
                    <div class="stat-label">Produção</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-chart-line"></i></div>
                    <div class="stat-value">${totalKg > 0 ? formatMoney(custoPorKg) + '/kg' : 'N/A'}</div>
                    <div class="stat-label">Custo Médio/KG</div>
                </div>
            </div>
            <div class="card">
                <div class="card-header">
                    <span class="card-title"><i class="fas fa-chart-pie"></i> Distribuição - ${setorAtual.nome}</span>
                    <button class="btn btn-outline btn-sm" onclick="window.navegarPara('setores')">
                        <i class="fas fa-arrow-left"></i> Voltar
                    </button>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:1rem;">
                    <div style="flex:1;min-width:250px;"><canvas id="pieChart" style="max-height:250px;"></canvas></div>
                    <div style="flex:1;min-width:250px;"><canvas id="barChart" style="max-height:250px;"></canvas></div>
                </div>
            </div>
            <div style="display:grid;gap:1.5rem;grid-template-columns:repeat(auto-fit,minmax(350px,1fr));margin-top:1.5rem;">
                <div class="card">
                    <div class="card-header">
                        <span class="card-title">Categorias</span>
                        <button class="btn btn-success btn-sm" onclick="window.abrirModalCategoria()">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    <div id="categoriasList"></div>
                </div>
                <div class="card">
                    <div class="card-header">
                        <span class="card-title">Itens</span>
                        <button class="btn btn-primary btn-sm" onclick="window.abrirModalItemCusto()">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    <div id="itensCustoList"></div>
                </div>
            </div>
            <div class="card" style="margin-top:1.5rem;">
                <div class="card-header">
                    <span class="card-title">Produção</span>
                    <button class="btn btn-info btn-sm" onclick="window.abrirModalProducao()">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
                <div id="producaoList"></div>
            </div>
            <div class="card" style="margin-top:1.5rem;">
                <div class="card-header">
                    <span class="card-title">Detalhamento</span>
                </div>
                <div class="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Categoria</th>
                                <th>Item</th>
                                <th>Tipo</th>
                                <th>Valor</th>
                                <th>%</th>
                                <th>Aplicado</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody id="tabelaCustos"></tbody>
                    </table>
                </div>
            </div>
        `;

        carregarCategoriasLista();
        carregarItensCustoLista();
        carregarTabelaCustos();
        carregarProducoesLista();
        setTimeout(atualizarGraficos, 150);
    }

    // ========== RENDERIZAR MATERIAIS ==========
    function renderizarMateriais() {
        const container = document.getElementById('conteudoDinamico');
        if (!container) return;
        
        let html = `
            <div class="card">
                <div class="card-header">
                    <span class="card-title"><i class="fas fa-boxes"></i> Materiais</span>
                    <div style="display:flex;gap:0.5rem;">
                        <button class="btn btn-teal" onclick="window.abrirModalMaterial()">
                            <i class="fas fa-plus"></i> Novo
                        </button>
                        <button class="btn btn-outline btn-sm" onclick="window.navegarPara('periodos')">
                            <i class="fas fa-arrow-left"></i> Home
                        </button>
                    </div>
                </div>`;

        if (materiais.length === 0) {
            html += '<div style="text-align:center;padding:2rem;"><p style="color:var(--text-light);">Nenhum material cadastrado.</p></div>';
        } else {
            html += '<div class="materiais-grid" id="materiaisGridFull"></div>';
        }
        
        html += '</div>';
        container.innerHTML = html;

        if (materiais.length > 0) {
            const grid = document.getElementById('materiaisGridFull');
            if (grid) {
                materiais.forEach(mat => {
                    const hist = getHistoricoMaterial(mat.id);
                    const ult = hist[0];
                    const div = document.createElement('div');
                    div.className = 'material-card';
                    div.onclick = () => window.abrirHistoricoMaterial(mat.id);
                    div.innerHTML = `
                        <div class="acoes">
                            <button class="btn btn-outline btn-xs" onclick="event.stopPropagation();window.editarMaterial('${mat.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-danger btn-xs" onclick="event.stopPropagation();window.excluirMaterial('${mat.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                        <div class="material-nome"><i class="fas fa-cube"></i> ${mat.nome}</div>
                        <div class="material-desc">${mat.descricao || ''}</div>
                        ${ult ? 
                            `<div class="material-ultimo"><strong>${formatMoney(ult.custoKgFinal)}/kg</strong> (${getNomeMes(ult.mes)}/${ult.ano})</div>` 
                            : '<div class="material-ultimo">Sem custos registrados</div>'}
                        <div style="font-size:0.7rem;margin-top:0.5rem;">${hist.length} registro(s)</div>
                    `;
                    grid.appendChild(div);
                });
            }
        }
    }

    // ========== RENDERIZAR HISTÓRICO MATERIAL ==========
    function renderizarHistoricoMaterial() {
        const mat = materiais.find(m => m.id === window.historicoMaterialId);
        if (!mat) { 
            navegarPara('periodos'); 
            return; 
        }
        
        const hist = getHistoricoMaterial(mat.id);
        const container = document.getElementById('conteudoDinamico');
        if (!container) return;

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <span class="card-title"><i class="fas fa-history"></i> Histórico: ${mat.nome}</span>
                    <button class="btn btn-outline btn-sm" onclick="window.navegarPara('periodos')">
                        <i class="fas fa-arrow-left"></i> Home
                    </button>
                </div>
                ${hist.length === 0 ? 
                    '<p style="text-align:center;padding:2rem;">Nenhum custo registrado para este material.</p>' 
                    : '<div class="historico-grid" id="historicoGrid"></div>'}
            </div>`;

        if (hist.length > 0) {
            const grid = document.getElementById('historicoGrid');
            if (grid) {
                hist.forEach(h => {
                    const div = document.createElement('div');
                    div.className = 'historico-item';
                    div.onclick = () => window.verDetalheCustoMaterial(h.id);
                    div.innerHTML = `
                        <div class="hi-periodo">
                            <i class="fas fa-calendar"></i> ${getNomeMes(h.mes)}/${h.ano}
                        </div>
                        <div class="hi-custo">
                            <div class="valor">${formatMoney(h.custoKgFinal)}/kg</div>
                            <div class="label">${h.setoresDetalhes?.length || 0} setor(es)</div>
                        </div>`;
                    grid.appendChild(div);
                });
            }
        }
    }

    // ========== DETALHE CUSTO MATERIAL ==========
    window.verDetalheCustoMaterial = function(custoId) {
        const custo = custosMateriais.find(c => c.id === custoId);
        if (!custo) return;
        
        const mat = materiais.find(m => m.id === custo.materialId);
        const container = document.getElementById('historicoDetalheConteudo');
        if (!container) return;

        container.innerHTML = `
            <div style="margin-bottom:1rem;">
                <strong>Material:</strong> ${mat?.nome || 'N/D'}<br>
                <strong>Período:</strong> ${getNomeMes(custo.mes)}/${custo.ano}
            </div>
            <div class="custo-material-resumo" style="border-radius:8px;">
                <h3 style="font-size:0.9rem;">Composição</h3>
                ${custo.setoresDetalhes?.map(s => 
                    `<div class="linha"><span>${s.nome} (${s.modo === 'percentual' ? s.valorConfig + '%' : 'Total'})</span><span class="l-valor">${formatMoney(s.custoKg)}/kg</span></div>`
                ).join('') || ''}
                ${custo.insumos?.map(ins => 
                    `<div class="linha"><span>📦 ${ins.nome}</span><span class="l-valor">${formatMoney(ins.custoKg)}/kg</span></div>`
                ).join('') || ''}
                <div class="linha"><span>Subtotal</span><span class="l-valor">${formatMoney(custo.subtotal)}/kg</span></div>
                ${custo.imposto > 0 ? 
                    `<div class="linha"><span>Imposto (${custo.imposto}%)</span><span class="l-valor">${formatMoney(custo.valorImposto)}/kg</span></div>` 
                    : ''}
                <div class="linha total"><span>🏁 CUSTO FINAL</span><span class="l-valor">${formatMoney(custo.custoKgFinal)}/kg</span></div>
                ${custo.valorAtual > 0 ? `
                    <div class="linha" style="color:#ffb74d;"><span>💰 Valor Praticado</span><span class="l-valor">${formatMoney(custo.valorAtual)}/kg</span></div>
                    <div class="linha" style="color:${custo.custoKgFinal <= custo.valorAtual ? '#4caf50' : '#ef5350'};">
                        <span>${custo.custoKgFinal <= custo.valorAtual ? '✅ Lucro de' : '❌ Prejuízo de'}</span>
                        <span class="l-valor">${formatMoney(Math.abs(custo.valorAtual - custo.custoKgFinal))}/kg (${formatNumber(Math.abs((custo.valorAtual - custo.custoKgFinal) / custo.custoKgFinal * 100), 0)}%)</span>
                    </div>
                ` : ''}
            </div>`;

        document.getElementById('modalHistoricoDetalhe').classList.add('active');
    };

    // ========== GERAR CUSTO MATERIAL ==========
    window.abrirGerarCustoMaterial = function() {
        document.getElementById('modalGerarCusto').classList.add('active');
        
        // Popular período
        const selPeriodo = document.getElementById('gerarCustoPeriodo');
        selPeriodo.innerHTML = '<option value="">Selecione um período...</option>' +
            periodos.sort((a, b) => {
                if (b.ano !== a.ano) return b.ano - a.ano;
                return b.mes - a.mes;
            }).map(p => `<option value="${p.id}">${getNomeMes(p.mes)}/${p.ano}</option>`).join('');
        
        // Popular material
        const selMaterial = document.getElementById('gerarCustoMaterial');
        selMaterial.innerHTML = '<option value="">Selecione um material...</option>' + 
            materiais.map(m => `<option value="${m.id}">${m.nome}</option>`).join('');
        
        document.getElementById('setoresGerarCusto').innerHTML = '<p style="color:var(--text-light);text-align:center;padding:1rem;">Selecione um período primeiro</p>';
        document.getElementById('gerarCustoImposto').value = '0';
        document.getElementById('gerarCustoMargem').value = '0';
        document.getElementById('gerarCustoValorAtual').value = '0';
        document.getElementById('insumosContainer').innerHTML = `
            <div class="insumo-row">
                <input type="text" class="insumo-nome" placeholder="Nome do insumo">
                <input type="number" class="insumo-custo" step="0.01" placeholder="R$/kg">
                <button class="btn btn-danger btn-xs" onclick="this.parentElement.remove();window.atualizarResumoGerarCusto();">
                    <i class="fas fa-times"></i>
                </button>
            </div>`;
        document.getElementById('resumoLinhas').innerHTML = '<p style="opacity:0.7;text-align:center;">Selecione os setores para calcular</p>';
        
        setoresSelecionadosGerar = new Map();
    };

    window.atualizarSetoresGerarCusto = function() {
        const periodoId = document.getElementById('gerarCustoPeriodo').value;
        const container = document.getElementById('setoresGerarCusto');
        setoresSelecionadosGerar = new Map();
        
        if (!periodoId) {
            container.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:1rem;">Selecione um período</p>';
            return;
        }
        
        const sets = setores.filter(s => s.periodoId === periodoId).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
        
        if (sets.length === 0) {
            container.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:1rem;">Nenhum setor neste período</p>';
            return;
        }
        
        container.innerHTML = sets.map(s => {
            const custoKg = getCustoPorKgSetor(s.id);
            return `
                <div class="setor-selecao-item" id="setor_item_${s.id}">
                    <div class="ss-header">
                        <input type="checkbox" id="chk_setor_${s.id}" onchange="window.toggleSetorGerar('${s.id}', this)">
                        <div class="ss-info">
                            <div class="ss-nome">
                                ${s.produtoFinal ? '🏁 ' : ''}${s.nome} 
                                <span class="badge ${s.produtoFinal ? 'badge-orange' : 'badge-green'}">
                                    ${s.produtoFinal ? 'Final' : 'Etapa ' + (s.ordem || 1)}
                                </span>
                            </div>
                            <div class="ss-custo">
                                Custo médio: <strong>${formatMoney(custoKg)}/kg</strong> | 
                                Total: ${formatMoney(calcularCustosSetor(s.id).totalCusto)}
                            </div>
                        </div>
                    </div>
                    <div class="ss-config" id="config_setor_${s.id}" style="display:none;">
                        <select id="modo_setor_${s.id}" onchange="window.mudarModoSetorGerar('${s.id}')">
                            <option value="total">Usar Valor Total (R$/kg)</option>
                            <option value="percentual">Usar % do Rateio</option>
                        </select>
                        <input type="number" id="valor_setor_${s.id}" step="0.01" value="${custoKg.toFixed(2)}" placeholder="0,00" oninput="window.atualizarResumoGerarCusto()">
                        <span id="unidade_setor_${s.id}" style="font-size:0.75rem;">R$/kg</span>
                    </div>
                </div>`;
        }).join('');
        
        window.atualizarResumoGerarCusto();
    };

    window.toggleSetorGerar = function(setorId, checkbox) {
        const configDiv = document.getElementById('config_setor_' + setorId);
        const itemDiv = document.getElementById('setor_item_' + setorId);
        
        if (checkbox.checked) {
            const custoKg = getCustoPorKgSetor(setorId);
            setoresSelecionadosGerar.set(setorId, { modo: 'total', valor: custoKg });
            itemDiv.classList.add('selecionado');
            configDiv.style.display = 'flex';
            document.getElementById('modo_setor_' + setorId).value = 'total';
            document.getElementById('valor_setor_' + setorId).value = custoKg.toFixed(2);
            document.getElementById('unidade_setor_' + setorId).textContent = 'R$/kg';
        } else {
            setoresSelecionadosGerar.delete(setorId);
            itemDiv.classList.remove('selecionado');
            configDiv.style.display = 'none';
        }
        window.atualizarResumoGerarCusto();
    };

    window.mudarModoSetorGerar = function(setorId) {
        const modo = document.getElementById('modo_setor_' + setorId).value;
        const valorInput = document.getElementById('valor_setor_' + setorId);
        const unidadeSpan = document.getElementById('unidade_setor_' + setorId);
        const custoKg = getCustoPorKgSetor(setorId);
        
        if (modo === 'total') {
            valorInput.value = custoKg.toFixed(2);
            unidadeSpan.textContent = 'R$/kg';
        } else {
            valorInput.value = '100';
            unidadeSpan.textContent = '%';
        }
        
        if (setoresSelecionadosGerar.has(setorId)) {
            const config = setoresSelecionadosGerar.get(setorId);
            config.modo = modo;
            config.valor = parseFloat(valorInput.value) || 0;
        }
        window.atualizarResumoGerarCusto();
    };

    window.adicionarInsumo = function() {
        const container = document.getElementById('insumosContainer');
        const div = document.createElement('div');
        div.className = 'insumo-row';
        div.innerHTML = `
            <input type="text" class="insumo-nome" placeholder="Nome do insumo">
            <input type="number" class="insumo-custo" step="0.01" placeholder="R$/kg">
            <button class="btn btn-danger btn-xs" onclick="this.parentElement.remove();window.atualizarResumoGerarCusto();">
                <i class="fas fa-times"></i>
            </button>`;
        container.appendChild(div);
    };

    window.atualizarResumoGerarCusto = function() {
        const resumoLinhas = document.getElementById('resumoLinhas');
        let custoBase = 0;
        let html = '';
        
        // Atualizar valores dos inputs
        setoresSelecionadosGerar.forEach((config, setorId) => {
            const valorInput = document.getElementById('valor_setor_' + setorId);
            if (valorInput) config.valor = parseFloat(valorInput.value) || 0;
        });
        
        setoresSelecionadosGerar.forEach((config, setorId) => {
            const setor = setores.find(s => s.id === setorId);
            const custoKgOriginal = getCustoPorKgSetor(setorId);
            let custoKgAplicado;
            let descricao;
            
            if (config.modo === 'total') {
                custoKgAplicado = config.valor;
                descricao = `Total: ${formatMoney(config.valor)}/kg`;
            } else {
                custoKgAplicado = custoKgOriginal * (config.valor / 100);
                descricao = `${config.valor}% de ${formatMoney(custoKgOriginal)}/kg`;
            }
            
            custoBase += custoKgAplicado;
            html += `<div class="linha"><span>${setor?.nome || 'Setor'} <small style="opacity:0.7;">(${descricao})</small></span><span class="l-valor">${formatMoney(custoKgAplicado)}/kg</span></div>`;
        });
        
        if (setoresSelecionadosGerar.size === 0) {
            resumoLinhas.innerHTML = '<p style="opacity:0.7;text-align:center;">Selecione os setores e configure cada um</p>';
            return;
        }
        
        let custoInsumos = 0;
        document.querySelectorAll('#insumosContainer .insumo-row').forEach(row => {
            const nome = row.querySelector('.insumo-nome').value.trim();
            const custo = parseFloat(row.querySelector('.insumo-custo').value) || 0;
            if (nome && custo > 0) {
                custoInsumos += custo;
                html += `<div class="linha"><span>📦 ${nome}</span><span class="l-valor">${formatMoney(custo)}/kg</span></div>`;
            }
        });
        
        const subtotal = custoBase + custoInsumos;
        const imposto = parseFloat(document.getElementById('gerarCustoImposto').value) || 0;
        const valorImposto = subtotal * (imposto / 100);
        const custoFinal = subtotal + valorImposto;
        const margem = parseFloat(document.getElementById('gerarCustoMargem').value) || 0;
        const precoSugerido = margem > 0 ? custoFinal * (1 + margem / 100) : 0;
        const valorAtual = parseFloat(document.getElementById('gerarCustoValorAtual').value) || 0;

        html += `<div class="linha"><span>Subtotal</span><span class="l-valor">${formatMoney(subtotal)}/kg</span></div>`;
        if (imposto > 0) html += `<div class="linha"><span>Imposto (${imposto}%)</span><span class="l-valor">${formatMoney(valorImposto)}/kg</span></div>`;
        html += `<div class="linha total"><span>🏁 CUSTO FINAL</span><span class="l-valor">${formatMoney(custoFinal)}/kg</span></div>`;
        if (margem > 0) html += `<div class="linha" style="color:#ffb74d;"><span>💰 Preço Sugerido (${margem}%)</span><span class="l-valor">${formatMoney(precoSugerido)}/kg</span></div>`;

        if (valorAtual > 0) {
            const diff = valorAtual - custoFinal;
            const diffPerc = (diff / custoFinal * 100);
            const isLucro = diff >= 0;
            html += `<div class="comparativo-destaque" style="color:#fff;">
                <div style="font-weight:600;margin-bottom:0.5rem;">📊 Análise Comparativa</div>
                <div class="linha"><span>💰 Valor Praticado</span><span class="l-valor">${formatMoney(valorAtual)}/kg</span></div>
                <div class="linha"><span>${isLucro ? '✅ Diferença (Lucro)' : '❌ Diferença (Prejuízo)'}</span><span class="l-valor" style="color:${isLucro ? '#4caf50' : '#ef5350'};">${formatMoney(Math.abs(diff))}/kg (${formatNumber(Math.abs(diffPerc), 1)}%)</span></div>
                <div class="linha" style="color:${isLucro ? '#4caf50' : '#ef5350'};font-weight:700;">${isLucro ? '🟢 Operação Lucrativa' : '🔴 Operação com Prejuízo'}</div>
            </div>`;
        }

        resumoLinhas.innerHTML = html;
    };

    // Listener para inputs do gerar custo
    document.addEventListener('input', function(e) {
        if (['gerarCustoImposto', 'gerarCustoMargem', 'gerarCustoValorAtual'].includes(e.target.id)) {
            window.atualizarResumoGerarCusto();
        }
        if (e.target.id && e.target.id.startsWith('valor_setor_')) {
            window.atualizarResumoGerarCusto();
        }
    });

    window.salvarCustoMaterial = async function() {
        const periodoId = document.getElementById('gerarCustoPeriodo').value;
        const materialId = document.getElementById('gerarCustoMaterial').value;
        
        if (!periodoId || !materialId || setoresSelecionadosGerar.size === 0) {
            showToast('warning', 'Atenção', 'Preencha todos os campos e selecione ao menos um setor!');
            return;
        }
        
        const periodo = periodos.find(p => p.id === periodoId);
        
        let custoBase = 0;
        const setoresDetalhes = [];
        const setoresUtilizados = [];
        
        setoresSelecionadosGerar.forEach((config, setorId) => {
            const setor = setores.find(s => s.id === setorId);
            const custoKgOriginal = getCustoPorKgSetor(setorId);
            let custoKgAplicado;
            
            if (config.modo === 'total') {
                custoKgAplicado = config.valor;
            } else {
                custoKgAplicado = custoKgOriginal * (config.valor / 100);
            }
            
            custoBase += custoKgAplicado;
            setoresUtilizados.push(setorId);
            setoresDetalhes.push({
                id: setorId,
                nome: setor?.nome || '',
                custoKg: custoKgAplicado,
                custoKgOriginal,
                modo: config.modo,
                valorConfig: config.valor
            });
        });
        
        let custoInsumos = 0;
        const insumos = [];
        document.querySelectorAll('#insumosContainer .insumo-row').forEach(row => {
            const nome = row.querySelector('.insumo-nome').value.trim();
            const custo = parseFloat(row.querySelector('.insumo-custo').value) || 0;
            if (nome && custo > 0) {
                custoInsumos += custo;
                insumos.push({ nome, custoKg: custo });
            }
        });
        
        const subtotal = custoBase + custoInsumos;
        const imposto = parseFloat(document.getElementById('gerarCustoImposto').value) || 0;
        const valorImposto = subtotal * (imposto / 100);
        const custoKgFinal = subtotal + valorImposto;
        const margem = parseFloat(document.getElementById('gerarCustoMargem').value) || 0;
        const precoSugerido = margem > 0 ? custoKgFinal * (1 + margem / 100) : 0;
        const valorAtual = parseFloat(document.getElementById('gerarCustoValorAtual').value) || 0;

        const custo = {
            materialId,
            periodoId,
            mes: periodo?.mes,
            ano: periodo?.ano,
            periodoObs: periodo?.obs || '',
            setoresUtilizados,
            setoresDetalhes,
            insumos,
            subtotal,
            imposto,
            valorImposto,
            custoKgFinal,
            margem,
            precoSugerido,
            valorAtual,
            createdAt: new Date().toISOString(),
            id: 'cm_' + Date.now()
        };
        
        custosMateriais.push(custo);
        await salvarFB('custos_materiais_custos', custo);
        saveLocalData();
        window.fecharModal('modalGerarCusto');
        
        showToast('success', '✅ Custo salvo!', `${formatMoney(custoKgFinal)}/kg registrado com sucesso.`);
        renderizarTela();
    };

    // ========== PDFs ==========
    window.gerarPDFCustoMaterial = async function() {
        const { jsPDF } = window.jspdf;
        const materialId = document.getElementById('gerarCustoMaterial').value;
        const mat = materiais.find(m => m.id === materialId);
        const periodoId = document.getElementById('gerarCustoPeriodo').value;
        const per = periodos.find(p => p.id === periodoId);
        
        let custoBase = 0;
        const linhasPDF = [];
        
        setoresSelecionadosGerar.forEach((config, setorId) => {
            const setor = setores.find(s => s.id === setorId);
            const custoKgOriginal = getCustoPorKgSetor(setorId);
            let custoKgAplicado;
            let descricao;
            
            if (config.modo === 'total') {
                custoKgAplicado = config.valor;
                descricao = `Total: ${formatMoney(config.valor)}/kg`;
            } else {
                custoKgAplicado = custoKgOriginal * (config.valor / 100);
                descricao = `${config.valor}% de ${formatMoney(custoKgOriginal)}/kg`;
            }
            
            custoBase += custoKgAplicado;
            linhasPDF.push({ nome: setor?.nome || 'Setor', descricao, valor: custoKgAplicado });
        });
        
        let custoInsumos = 0;
        const insumosPDF = [];
        document.querySelectorAll('#insumosContainer .insumo-row').forEach(row => {
            const nome = row.querySelector('.insumo-nome').value.trim();
            const custo = parseFloat(row.querySelector('.insumo-custo').value) || 0;
            if (nome && custo > 0) {
                custoInsumos += custo;
                insumosPDF.push({ nome, custoKg: custo });
            }
        });
        
        const subtotal = custoBase + custoInsumos;
        const imposto = parseFloat(document.getElementById('gerarCustoImposto').value) || 0;
        const valorImposto = subtotal * (imposto / 100);
        const custoFinal = subtotal + valorImposto;
        const margem = parseFloat(document.getElementById('gerarCustoMargem').value) || 0;
        const precoSugerido = margem > 0 ? custoFinal * (1 + margem / 100) : 0;
        const valorAtual = parseFloat(document.getElementById('gerarCustoValorAtual').value) || 0;

        const pdf = new jsPDF('p', 'mm', 'a4');
        let y = 20;
        
        pdf.setFillColor(0, 77, 64);
        pdf.rect(0, 0, 210, 30, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(16);
        pdf.text('Análise de Custo - Mil Plásticos', 105, 15, { align: 'center' });
        pdf.setFontSize(9);
        pdf.text('Reciclagem de Plásticos', 105, 22, { align: 'center' });
        
        y = 38;
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(13);
        pdf.text(`Material: ${mat?.nome || 'N/D'}`, 20, y);
        y += 7;
        pdf.setFontSize(10);
        pdf.text(`Período: ${per ? getNomeMes(per.mes) + '/' + per.ano : 'N/D'}`, 20, y);
        y += 5;
        pdf.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 20, y);
        y += 10;

        pdf.setFontSize(11);
        pdf.text('Composição do Custo:', 20, y);
        y += 7;
        
        linhasPDF.forEach(l => {
            pdf.setFontSize(9);
            pdf.text(`${l.nome} (${l.descricao}): ${formatMoney(l.valor)}/kg`, 25, y);
            y += 5;
        });
        
        insumosPDF.forEach(ins => {
            pdf.text(`Insumo - ${ins.nome}: ${formatMoney(ins.custoKg)}/kg`, 25, y);
            y += 5;
        });
        
        pdf.text(`Subtotal: ${formatMoney(subtotal)}/kg`, 25, y);
        y += 5;
        
        if (imposto > 0) {
            pdf.text(`Imposto (${imposto}%): ${formatMoney(valorImposto)}/kg`, 25, y);
            y += 5;
        }
        
        pdf.setFontSize(11);
        pdf.setTextColor(0, 77, 64);
        pdf.text(`CUSTO FINAL: ${formatMoney(custoFinal)}/kg`, 25, y);
        y += 7;
        
        if (margem > 0) {
            pdf.setTextColor(245, 124, 0);
            pdf.text(`Preço Sugerido (${margem}%): ${formatMoney(precoSugerido)}/kg`, 25, y);
            y += 7;
        }
        
        if (valorAtual > 0) {
            const diff = valorAtual - custoFinal;
            const diffPerc = (diff / custoFinal * 100);
            pdf.setTextColor(diff >= 0 ? 0 : 200, diff >= 0 ? 150 : 0, diff >= 0 ? 0 : 0);
            pdf.text(`${diff >= 0 ? 'Lucro' : 'Prejuízo'}: ${formatMoney(Math.abs(diff))}/kg (${formatNumber(Math.abs(diffPerc), 1)}%)`, 25, y);
        }
        
        pdf.save(`Custo_${mat?.nome || 'Material'}_${per ? getNomeMes(per.mes) + '_' + per.ano : ''}.pdf`);
        showToast('success', 'PDF gerado!', 'Documento salvo com sucesso.');
    };

    window.gerarPDFCentralCustos = async function() {
        if (!periodoAtual) {
            showToast('warning', 'Atenção', 'Selecione um período primeiro!');
            return;
        }
        
        const { jsPDF } = window.jspdf;
        const sets = getSetoresDoPeriodo();
        const resumo = calcularResumoPeriodo();
        const pdf = new jsPDF('p', 'mm', 'a4');
        let y = 20;
        
        pdf.setFillColor(13, 144, 79);
        pdf.rect(0, 0, 210, 30, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(16);
        pdf.text('Central de Custos - Mil Plásticos', 105, 15, { align: 'center' });
        pdf.setFontSize(9);
        pdf.text('Reciclagem de Plásticos', 105, 22, { align: 'center' });
        
        y = 38;
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(13);
        pdf.text(`Fechamento: ${getNomeMes(periodoAtual.mes)}/${periodoAtual.ano}`, 20, y);
        y += 10;
        pdf.setFontSize(10);
        pdf.text(`Setores: ${resumo.qtdSetores} | Produtos Finais: ${resumo.qtdProdutosFinais}`, 20, y);
        y += 6;
        pdf.text(`Custo Total: ${formatMoney(resumo.custoTotalGeral)} | Produção Total: ${formatNumber(resumo.producaoTotalGeral, 0)} kg`, 20, y);
        y += 6;
        pdf.text(`Custo por KG: ${formatMoney(resumo.custoPorKgGeral)}/kg`, 20, y);
        y += 10;

        sets.forEach(setor => {
            if (y > 260) {
                pdf.addPage();
                y = 20;
            }
            
            const { totalCusto, totalKg, custoPorKg } = calcularCustosSetor(setor.id);
            pdf.setFontSize(11);
            pdf.setFillColor(240, 248, 240);
            pdf.rect(20, y - 4, 170, 7, 'F');
            pdf.text(`${setor.nome} ${setor.produtoFinal ? '(PRODUTO FINAL)' : '(Etapa ' + (setor.ordem || 1) + ')'} - Custo Médio: ${totalKg > 0 ? formatMoney(custoPorKg) + '/kg' : 'N/A'}`, 22, y);
            y += 6;
            
            pdf.setFontSize(9);
            pdf.text(`Custo: ${formatMoney(totalCusto)} | Produção: ${formatNumber(totalKg, 0)} kg`, 25, y);
            y += 8;
            
            const itens = itensCusto.filter(i => i.setorId === setor.id);
            itens.forEach(item => {
                const cat = categorias.find(c => c.id === item.categoriaId);
                const tipo = item.tipo === 'fixo' ? ' [FIXO]' : '';
                pdf.text(`${cat?.nome || 'Sem cat.'} - ${item.nome}${tipo}: ${formatMoney(item.valorTotal)} (${item.percentual}%) = ${formatMoney(item.valorTotal * item.percentual / 100)}`, 30, y);
                y += 4.5;
            });
            y += 3;
        });
        
        pdf.save(`Central_Custos_${getNomeMes(periodoAtual.mes)}_${periodoAtual.ano}.pdf`);
        showToast('success', 'PDF gerado!', 'Relatório da Central de Custos salvo.');
    };

    // ========== CRUDs ==========
    window.abrirModalPeriodo = function(id) {
        document.getElementById('modalPeriodo').classList.add('active');
        
        if (id) {
            const p = periodos.find(x => x.id === id);
            if (p) {
                document.getElementById('modalPeriodoTitulo').innerText = 'Editar Período';
                document.getElementById('periodoEditId').value = p.id;
                document.getElementById('periodoMes').value = p.mes;
                document.getElementById('periodoAno').value = p.ano;
                document.getElementById('periodoObs').value = p.obs || '';
            }
        } else {
            document.getElementById('modalPeriodoTitulo').innerText = 'Novo Período';
            document.getElementById('periodoEditId').value = '';
            document.getElementById('periodoMes').value = new Date().getMonth() + 1;
            document.getElementById('periodoAno').value = new Date().getFullYear();
            document.getElementById('periodoObs').value = '';
        }
    };

    window.salvarPeriodo = async function() {
        const p = {
            mes: parseInt(document.getElementById('periodoMes').value),
            ano: parseInt(document.getElementById('periodoAno').value),
            obs: document.getElementById('periodoObs').value.trim(),
            createdAt: new Date().toISOString()
        };
        
        const editId = document.getElementById('periodoEditId').value;
        
        if (editId) {
            p.id = editId;
            const idx = periodos.findIndex(x => x.id === editId);
            if (idx !== -1) periodos[idx] = p;
        } else {
            p.id = 'per_' + Date.now();
            periodos.push(p);
        }
        
        await salvarFB('custos_periodos', p);
        saveLocalData();
        window.fecharModal('modalPeriodo');
        
        showToast('success', 
            editId ? 'Período atualizado!' : 'Período criado!', 
            `${getNomeMes(p.mes)}/${p.ano} ${editId ? 'atualizado' : 'criado'} com sucesso.`
        );
        
        renderizarTela();
    };

    window.editarPeriodo = (id) => window.abrirModalPeriodo(id);

    window.excluirPeriodo = function(id) {
        const per = periodos.find(p => p.id === id);
        if (!per) return;
        
        showConfirm(
            'Excluir Período',
            `Tem certeza que deseja excluir ${getNomeMes(per.mes)}/${per.ano}?\n\nTODOS os setores, itens de custo e produções serão PERMANENTEMENTE removidos!`,
            '🗑️',
            async () => {
                const sets = setores.filter(s => s.periodoId === id);
                const setsIds = sets.map(s => s.id);
                
                itensCusto = itensCusto.filter(i => !setsIds.includes(i.setorId));
                producoes = producoes.filter(p => !setsIds.includes(p.setorId));
                setores = setores.filter(s => s.periodoId !== id);
                periodos = periodos.filter(p => p.id !== id);
                
                await excluirFB('custos_periodos', id);
                for (const sId of setsIds) {
                    await excluirFB('custos_setores', sId);
                }
                
                saveLocalData();
                
                if (periodoAtual?.id === id) {
                    periodoAtual = null;
                    setorAtual = null;
                    nivelAtual = 'periodos';
                }
                
                renderizarTela();
                showToast('success', 'Excluído!', 'Período e todos os dados vinculados foram removidos.');
            }
        );
    };

    window.abrirModalSetor = function(id) {
        if (!periodoAtual) return;
        document.getElementById('modalSetor').classList.add('active');
        
        if (id) {
            const s = setores.find(x => x.id === id);
            if (s) {
                document.getElementById('modalSetorTitulo').innerHTML = '<i class="fas fa-edit"></i> Editar Setor';
                document.getElementById('setorEditId').value = s.id;
                document.getElementById('setorNome').value = s.nome;
                document.getElementById('setorDescricao').value = s.descricao || '';
                document.getElementById('setorOrdem').value = s.ordem || 1;
                document.getElementById('setorProdutoFinal').checked = s.produtoFinal || false;
            }
        } else {
            document.getElementById('modalSetorTitulo').innerHTML = '<i class="fas fa-plus"></i> Novo Setor';
            document.getElementById('setorEditId').value = '';
            document.getElementById('setorNome').value = '';
            document.getElementById('setorDescricao').value = '';
            document.getElementById('setorOrdem').value = '1';
            document.getElementById('setorProdutoFinal').checked = false;
        }
    };

    window.salvarSetor = async function() {
        const nome = document.getElementById('setorNome').value.trim();
        if (!nome) {
            showToast('warning', 'Atenção', 'Digite o nome do setor!');
            return;
        }
        
        const s = {
            periodoId: periodoAtual.id,
            nome: nome,
            descricao: document.getElementById('setorDescricao').value.trim(),
            ordem: parseInt(document.getElementById('setorOrdem').value) || 1,
            produtoFinal: document.getElementById('setorProdutoFinal').checked,
            createdAt: new Date().toISOString()
        };
        
        const editId = document.getElementById('setorEditId').value;
        
        if (editId) {
            s.id = editId;
            const idx = setores.findIndex(x => x.id === editId);
            if (idx !== -1) setores[idx] = s;
        } else {
            s.id = 'set_' + Date.now();
            setores.push(s);
        }
        
        await salvarFB('custos_setores', s);
        saveLocalData();
        window.fecharModal('modalSetor');
        renderizarTela();
        showToast('success', editId ? 'Setor atualizado!' : 'Setor criado!', `"${s.nome}" salvo com sucesso.`);
    };

    window.editarSetor = (id) => window.abrirModalSetor(id);

    window.excluirSetor = function(id) {
        const setor = setores.find(s => s.id === id);
        if (!setor) return;
        
        showConfirm(
            'Excluir Setor',
            `Deseja excluir "${setor.nome}"? Todos os itens de custo e produções serão perdidos!`,
            '⚠️',
            async () => {
                itensCusto = itensCusto.filter(i => i.setorId !== id);
                producoes = producoes.filter(p => p.setorId !== id);
                setores = setores.filter(s => s.id !== id);
                
                await excluirFB('custos_setores', id);
                saveLocalData();
                
                if (setorAtual?.id === id) setorAtual = null;
                renderizarTela();
                showToast('success', 'Excluído!', 'Setor removido com sucesso.');
            }
        );
    };

    // Categorias
    window.abrirModalCategoria = function(id) {
        document.getElementById('modalCategoria').classList.add('active');
        
        if (id) {
            const c = categorias.find(x => x.id === id);
            if (c) {
                document.getElementById('modalCategoriaTitulo').innerText = 'Editar Categoria';
                document.getElementById('categoriaEditId').value = c.id;
                document.getElementById('categoriaNome').value = c.nome;
                document.getElementById('categoriaCor').value = c.cor;
            }
        } else {
            document.getElementById('modalCategoriaTitulo').innerText = 'Nova Categoria';
            document.getElementById('categoriaEditId').value = '';
            document.getElementById('categoriaNome').value = '';
            document.getElementById('categoriaCor').value = '#0d904f';
        }
    };

    window.salvarCategoria = async function() {
        const nome = document.getElementById('categoriaNome').value.trim();
        if (!nome) {
            showToast('warning', 'Atenção', 'Digite o nome da categoria!');
            return;
        }
        
        const c = {
            nome: nome,
            cor: document.getElementById('categoriaCor').value
        };
        
        const editId = document.getElementById('categoriaEditId').value;
        
        if (editId) {
            c.id = editId;
            const idx = categorias.findIndex(x => x.id === editId);
            if (idx !== -1) categorias[idx] = c;
        } else {
            c.id = 'cat_' + Date.now();
            categorias.push(c);
        }
        
        await salvarFB('custos_categorias', c);
        saveLocalData();
        window.fecharModal('modalCategoria');
        
        if (nivelAtual === 'analise') renderizarAnalise();
        else renderizarTela();
        
        showToast('success', editId ? 'Categoria atualizada!' : 'Categoria criada!', `"${c.nome}" salva.`);
    };

    window.editarCategoria = (id) => window.abrirModalCategoria(id);

    window.excluirCategoria = function(id) {
        const cat = categorias.find(c => c.id === id);
        if (!cat) return;
        
        showConfirm(
            'Excluir Categoria',
            `Itens e custos fixos vinculados a "${cat.nome}" ficarão sem categoria. Continuar?`,
            '⚠️',
            async () => {
                itensCusto.forEach(i => { if (i.categoriaId === id) i.categoriaId = null; });
                custosFixos.forEach(cf => { if (cf.categoriaId === id) cf.categoriaId = null; });
                categorias = categorias.filter(c => c.id !== id);
                
                await excluirFB('custos_categorias', id);
                saveLocalData();
                
                if (nivelAtual === 'analise') renderizarAnalise();
                else renderizarTela();
                showToast('success', 'Excluída!', 'Categoria removida.');
            }
        );
    };

    // Custos Fixos
    window.abrirModalCustoFixo = function(id) {
        const selCat = document.getElementById('custoFixoCategoria');
        selCat.innerHTML = '<option value="">Selecione uma categoria...</option>' + 
            categorias.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
        
        document.getElementById('modalCustoFixo').classList.add('active');
        
        if (id) {
            const cf = custosFixos.find(x => x.id === id);
            if (cf) {
                document.getElementById('custoFixoTituloTexto').innerText = 'Editar Custo Fixo';
                document.getElementById('custoFixoEditId').value = cf.id;
                document.getElementById('custoFixoCategoria').value = cf.categoriaId || '';
                document.getElementById('custoFixoNome').value = cf.nome;
                document.getElementById('custoFixoValor').value = cf.valor;
            }
        } else {
            document.getElementById('custoFixoTituloTexto').innerText = 'Novo Custo Fixo';
            document.getElementById('custoFixoEditId').value = '';
            document.getElementById('custoFixoCategoria').value = '';
            document.getElementById('custoFixoNome').value = '';
            document.getElementById('custoFixoValor').value = '';
        }
    };

    window.salvarCustoFixo = async function() {
        const nome = document.getElementById('custoFixoNome').value.trim();
        const valor = parseFloat(document.getElementById('custoFixoValor').value) || 0;
        
        if (!nome || valor <= 0) {
            showToast('warning', 'Atenção', 'Preencha nome e valor!');
            return;
        }
        
        const cf = {
            nome: nome,
            categoriaId: document.getElementById('custoFixoCategoria').value || null,
            valor: valor,
            createdAt: new Date().toISOString()
        };
        
        const editId = document.getElementById('custoFixoEditId').value;
        
        if (editId) {
            cf.id = editId;
            const idx = custosFixos.findIndex(x => x.id === editId);
            if (idx !== -1) custosFixos[idx] = cf;
        } else {
            cf.id = 'cf_' + Date.now();
            custosFixos.push(cf);
        }
        
        await salvarFB('custos_fixos', cf);
        saveLocalData();
        window.fecharModal('modalCustoFixo');
        renderizarTela();
        showToast('success', editId ? 'Atualizado!' : 'Criado!', `"${cf.nome}" salvo.`);
    };

    window.editarCustoFixo = (id) => window.abrirModalCustoFixo(id);

    window.excluirCustoFixo = function(id) {
        const cf = custosFixos.find(c => c.id === id);
        if (!cf) return;
        
        showConfirm(
            'Excluir Custo Fixo',
            `Deseja excluir "${cf.nome}"? Itens que o utilizam manterão os valores originais.`,
            '⚠️',
            async () => {
                custosFixos = custosFixos.filter(c => c.id !== id);
                await excluirFB('custos_fixos', id);
                saveLocalData();
                renderizarTela();
                showToast('success', 'Excluído!', 'Custo fixo removido.');
            }
        );
    };

    // Itens de Custo
    window.mudarTipoItem = function(tipo) {
        document.getElementById('itemTipo').value = tipo;
        document.getElementById('tabNormal').classList.toggle('active', tipo === 'normal');
        document.getElementById('tabFixo').classList.toggle('active', tipo === 'fixo');
        
        document.getElementById('areaItemNormal').style.display = tipo === 'normal' ? 'block' : 'none';
        document.getElementById('areaItensFixos').style.display = tipo === 'fixo' ? 'block' : 'none';
        document.getElementById('areaItemFixoDetalhe').style.display = 'none';
        
        if (tipo === 'fixo') {
            carregarCustosFixosParaSelecao();
        }
        if (tipo === 'normal') {
            carregarSelectCategorias();
        }
        custoFixoSelecionadoId = null;
    };

    function carregarCustosFixosParaSelecao() {
        const container = document.getElementById('custosFixosSelect');
        if (!container) return;
        
        if (custosFixos.length === 0) {
            container.innerHTML = `
                <p style="text-align:center;padding:1rem;color:var(--text-light);">
                    Nenhum custo fixo cadastrado.<br>
                    <a href="#" onclick="window.fecharModal('modalItemCusto');window.abrirModalCustoFixo();return false;" style="color:var(--warning);">
                        <i class="fas fa-plus"></i> Cadastrar agora
                    </a>
                </p>`;
            return;
        }
        
        container.innerHTML = custosFixos.map(cf => {
            const cat = categorias.find(c => c.id === cf.categoriaId);
            return `
                <div class="custo-fixo-select-item" onclick="window.selecionarCustoFixoParaItem('${cf.id}')">
                    <div>
                        <div class="cfs-nome"><i class="fas fa-thumbtack" style="color:var(--warning);"></i> ${cf.nome}</div>
                        <div class="cfs-categoria">${cat ? cat.nome : 'Sem categoria'}</div>
                    </div>
                    <div class="cfs-valor">${formatMoney(cf.valor)}</div>
                    <button class="btn btn-warning btn-xs"><i class="fas fa-arrow-right"></i> Usar</button>
                </div>`;
        }).join('');
    }

    window.selecionarCustoFixoParaItem = function(cfId) {
        const cf = custosFixos.find(c => c.id === cfId);
        if (!cf) return;
        
        custoFixoSelecionadoId = cfId;
        document.getElementById('areaItemFixoDetalhe').style.display = 'block';
        document.getElementById('itemFixoNomeDisplay').value = cf.nome;
        document.getElementById('itemFixoValorDisplay').value = formatMoney(cf.valor);
        document.getElementById('itemFixoPercentual').value = '100';
        
        document.querySelectorAll('#custosFixosSelect .custo-fixo-select-item').forEach(el => {
            el.style.borderColor = 'var(--border)';
            el.style.background = '#fff';
        });
    };

    function carregarSelectCategorias() {
        const sel = document.getElementById('itemCategoria');
        if (sel) sel.innerHTML = categorias.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
    }

    window.abrirModalItemCusto = function(id) {
        if (!setorAtual) return;
        
        window.mudarTipoItem('normal');
        document.getElementById('modalItemCusto').classList.add('active');
        
        if (id) {
            const item = itensCusto.find(i => i.id === id);
            if (item) {
                document.getElementById('modalItemTitulo').innerText = 'Editar Item';
                document.getElementById('itemEditId').value = item.id;
                
                if (item.tipo === 'fixo') {
                    window.mudarTipoItem('fixo');
                    custoFixoSelecionadoId = item.custoFixoId;
                    document.getElementById('areaItemFixoDetalhe').style.display = 'block';
                    document.getElementById('itemFixoNomeDisplay').value = item.nome;
                    document.getElementById('itemFixoValorDisplay').value = formatMoney(item.valorTotal);
                    document.getElementById('itemFixoPercentual').value = item.percentual;
                } else {
                    window.mudarTipoItem('normal');
                    carregarSelectCategorias();
                    document.getElementById('itemCategoria').value = item.categoriaId || '';
                    document.getElementById('itemNome').value = item.nome;
                    document.getElementById('itemValorTotal').value = item.valorTotal;
                    document.getElementById('itemPercentual').value = item.percentual;
                    document.getElementById('itemObs').value = item.obs || '';
                }
            }
        } else {
            document.getElementById('modalItemTitulo').innerText = 'Novo Item';
            document.getElementById('itemEditId').value = '';
            document.getElementById('itemNome').value = '';
            document.getElementById('itemValorTotal').value = '';
            document.getElementById('itemPercentual').value = '100';
            document.getElementById('itemObs').value = '';
            document.getElementById('itemFixoPercentual').value = '100';
        }
    };

    window.salvarItemCusto = async function() {
        const tipo = document.getElementById('itemTipo').value;
        let item;
        
        if (tipo === 'fixo') {
            if (!custoFixoSelecionadoId) {
                showToast('warning', 'Atenção', 'Selecione um custo fixo!');
                return;
            }
            const cf = custosFixos.find(c => c.id === custoFixoSelecionadoId);
            if (!cf) {
                showToast('error', 'Erro', 'Custo fixo não encontrado!');
                return;
            }
            
            item = {
                setorId: setorAtual.id,
                tipo: 'fixo',
                custoFixoId: cf.id,
                categoriaId: cf.categoriaId,
                nome: cf.nome,
                valorTotal: cf.valor,
                percentual: parseFloat(document.getElementById('itemFixoPercentual').value) || 100,
                obs: '',
                createdAt: new Date().toISOString()
            };
        } else {
            const nome = document.getElementById('itemNome').value.trim();
            if (!nome) {
                showToast('warning', 'Atenção', 'Digite o nome do item!');
                return;
            }
            
            item = {
                setorId: setorAtual.id,
                tipo: 'normal',
                categoriaId: document.getElementById('itemCategoria').value,
                nome: nome,
                valorTotal: parseFloat(document.getElementById('itemValorTotal').value) || 0,
                percentual: parseFloat(document.getElementById('itemPercentual').value) || 100,
                obs: document.getElementById('itemObs').value.trim(),
                createdAt: new Date().toISOString()
            };
        }
        
        const editId = document.getElementById('itemEditId').value;
        
        if (editId) {
            item.id = editId;
            const idx = itensCusto.findIndex(i => i.id === editId);
            if (idx !== -1) itensCusto[idx] = item;
        } else {
            item.id = 'item_' + Date.now();
            itensCusto.push(item);
        }
        
        await salvarFB('custos_itens', item);
        saveLocalData();
        window.fecharModal('modalItemCusto');
        renderizarAnalise();
        showToast('success', editId ? 'Item atualizado!' : 'Item adicionado!', `"${item.nome}" salvo.`);
    };

    window.editarItemCusto = (id) => window.abrirModalItemCusto(id);

    window.excluirItemCusto = function(id) {
        const item = itensCusto.find(i => i.id === id);
        if (!item) return;
        
        showConfirm(
            'Excluir Item',
            `Deseja excluir "${item.nome}"?`,
            '🗑️',
            async () => {
                itensCusto = itensCusto.filter(i => i.id !== id);
                await excluirFB('custos_itens', id);
                saveLocalData();
                renderizarAnalise();
                showToast('success', 'Excluído!', 'Item removido.');
            }
        );
    };

    // Produções
    window.abrirModalProducao = function() {
        if (!setorAtual) return;
        document.getElementById('modalProducao').classList.add('active');
        document.getElementById('producaoProduto').value = '';
        document.getElementById('producaoKg').value = '';
        document.getElementById('producaoData').value = new Date().toISOString().split('T')[0];
    };

    window.salvarProducao = async function() {
        const produto = document.getElementById('producaoProduto').value.trim();
        const kg = parseFloat(document.getElementById('producaoKg').value) || 0;
        
        if (!produto || kg <= 0) {
            showToast('warning', 'Atenção', 'Preencha todos os campos!');
            return;
        }
        
        const prod = {
            setorId: setorAtual.id,
            produto: produto,
            kg: kg,
            data: document.getElementById('producaoData').value,
            createdAt: new Date().toISOString(),
            id: 'prod_' + Date.now()
        };
        
        producoes.push(prod);
        await salvarFB('custos_producoes', prod);
        saveLocalData();
        window.fecharModal('modalProducao');
        renderizarAnalise();
        showToast('success', 'Produção registrada!', `${formatNumber(kg, 0)} kg de "${produto}".`);
    };

    window.excluirProducao = function(id) {
        const prod = producoes.find(p => p.id === id);
        if (!prod) return;
        
        showConfirm(
            'Excluir Produção',
            `Deseja excluir a produção de ${formatNumber(prod.kg, 0)} kg de "${prod.produto}"?`,
            '⚠️',
            async () => {
                producoes = producoes.filter(p => p.id !== id);
                await excluirFB('custos_producoes', id);
                saveLocalData();
                renderizarAnalise();
                showToast('success', 'Excluída!', 'Produção removida.');
            }
        );
    };

    // Materiais
    window.abrirModalMaterial = function(id) {
        document.getElementById('modalMaterial').classList.add('active');
        
        if (id) {
            const m = materiais.find(x => x.id === id);
            if (m) {
                document.getElementById('modalMaterialTitulo').innerHTML = '<i class="fas fa-edit"></i> Editar Material';
                document.getElementById('materialEditId').value = m.id;
                document.getElementById('materialNome').value = m.nome;
                document.getElementById('materialDescricao').value = m.descricao || '';
            }
        } else {
            document.getElementById('modalMaterialTitulo').innerHTML = '<i class="fas fa-plus"></i> Novo Material';
            document.getElementById('materialEditId').value = '';
            document.getElementById('materialNome').value = '';
            document.getElementById('materialDescricao').value = '';
        }
    };

    window.salvarMaterial = async function() {
        const nome = document.getElementById('materialNome').value.trim();
        if (!nome) {
            showToast('warning', 'Atenção', 'Digite o nome do material!');
            return;
        }
        
        const m = {
            nome: nome,
            descricao: document.getElementById('materialDescricao').value.trim(),
            createdAt: new Date().toISOString()
        };
        
        const editId = document.getElementById('materialEditId').value;
        
        if (editId) {
            m.id = editId;
            const idx = materiais.findIndex(x => x.id === editId);
            if (idx !== -1) materiais[idx] = m;
        } else {
            m.id = 'mat_' + Date.now();
            materiais.push(m);
        }
        
        await salvarFB('custos_materiais', m);
        saveLocalData();
        window.fecharModal('modalMaterial');
        renderizarTela();
        showToast('success', editId ? 'Material atualizado!' : 'Material criado!', `"${m.nome}" salvo.`);
    };

    window.editarMaterial = (id) => window.abrirModalMaterial(id);

    window.excluirMaterial = function(id) {
        const mat = materiais.find(m => m.id === id);
        if (!mat) return;
        
        showConfirm(
            'Excluir Material',
            `Todo o histórico de custos de "${mat.nome}" será perdido. Continuar?`,
            '🗑️',
            async () => {
                custosMateriais = custosMateriais.filter(c => c.materialId !== id);
                materiais = materiais.filter(m => m.id !== id);
                await excluirFB('custos_materiais', id);
                saveLocalData();
                renderizarTela();
                showToast('success', 'Excluído!', 'Material e histórico removidos.');
            }
        );
    };

    window.abrirHistoricoMaterial = function(id) {
        window.historicoMaterialId = id;
        nivelAtual = 'historicoMaterial';
        renderizarTela();
    };

    // ========== GRÁFICOS ==========
    function getCustosAgrupados() {
        if (!setorAtual) return { porCategoria: {} };
        
        const itens = itensCusto.filter(i => i.setorId === setorAtual.id);
        const porCategoria = {};
        
        itens.forEach(item => {
            const valor = (parseFloat(item.valorTotal) || 0) * (parseFloat(item.percentual) || 0) / 100;
            const cat = categorias.find(c => c.id === item.categoriaId);
            const catId = cat ? cat.id : 'sem_cat';
            
            if (!porCategoria[catId]) {
                porCategoria[catId] = {
                    nome: cat ? cat.nome : 'Sem categoria',
                    cor: cat ? cat.cor : '#999',
                    total: 0
                };
            }
            porCategoria[catId].total += valor;
        });
        
        return { porCategoria, itens };
    }

    function atualizarGraficos() {
        const { porCategoria } = getCustosAgrupados();
        const cats = Object.values(porCategoria);
        const pieCtx = document.getElementById('pieChart');
        const barCtx = document.getElementById('barChart');
        
        if (!pieCtx || !barCtx) return;
        
        if (pieChart) pieChart.destroy();
        if (barChart) barChart.destroy();
        
        if (cats.length > 0) {
            pieChart = new Chart(pieCtx, {
                type: 'doughnut',
                data: {
                    labels: cats.map(c => c.nome),
                    datasets: [{
                        data: cats.map(c => c.total),
                        backgroundColor: cats.map(c => c.cor || '#0d904f'),
                        borderWidth: 2,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { font: { size: 10 } }
                        }
                    }
                }
            });
            
            barChart = new Chart(barCtx, {
                type: 'bar',
                data: {
                    labels: cats.map(c => c.nome),
                    datasets: [{
                        label: 'Valor (R$)',
                        data: cats.map(c => c.total),
                        backgroundColor: cats.map(c => c.cor || '#0d904f'),
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { callback: v => 'R$ ' + v }
                        }
                    }
                }
            });
        }
    }

    function carregarCategoriasLista() {
        const el = document.getElementById('categoriasList');
        if (!el) return;
        
        el.innerHTML = categorias.length === 0 
            ? '<p style="text-align:center;padding:1rem;color:var(--text-light);">Nenhuma categoria</p>'
            : categorias.map(c => `
                <div class="campo-config-item" style="border-left:4px solid ${c.cor};">
                    <span><i class="fas fa-circle" style="color:${c.cor};font-size:0.6rem;"></i> ${c.nome}</span>
                    <div>
                        <button class="btn btn-outline btn-xs" onclick="window.editarCategoria('${c.id}')"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-danger btn-xs" onclick="window.excluirCategoria('${c.id}')"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`).join('');
    }

    function carregarItensCustoLista() {
        const el = document.getElementById('itensCustoList');
        if (!el || !setorAtual) return;
        
        const itens = itensCusto.filter(i => i.setorId === setorAtual.id);
        
        el.innerHTML = itens.length === 0
            ? '<p style="text-align:center;padding:1rem;color:var(--text-light);">Nenhum item cadastrado</p>'
            : itens.map(item => {
                const cat = categorias.find(c => c.id === item.categoriaId);
                const tipoBadge = item.tipo === 'fixo' ? '<span class="badge badge-orange">Fixo</span>' : '';
                
                return `
                <div class="campo-config-item">
                    <div>
                        <strong>${item.nome}</strong> ${tipoBadge}
                        <br><small>${cat?.nome || 'Sem categoria'}</small>
                    </div>
                    <div style="text-align:right;">
                        <div class="money">${formatMoney(item.valorTotal)}</div>
                        <span class="badge badge-blue">${item.percentual}%</span>
                    </div>
                    <div>
                        <button class="btn btn-outline btn-xs" onclick="window.editarItemCusto('${item.id}')"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-danger btn-xs" onclick="window.excluirItemCusto('${item.id}')"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`;
            }).join('');
    }

    function carregarTabelaCustos() {
        const tbody = document.getElementById('tabelaCustos');
        if (!tbody || !setorAtual) return;
        
        const itens = itensCusto.filter(i => i.setorId === setorAtual.id);
        
        if (itens.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;">Nenhum item cadastrado</td></tr>';
            return;
        }
        
        const grupos = {};
        itens.forEach(item => {
            const cid = item.categoriaId || 'sem_cat';
            if (!grupos[cid]) {
                grupos[cid] = {
                    cat: categorias.find(c => c.id === cid),
                    itens: [],
                    subtotal: 0
                };
            }
            grupos[cid].itens.push(item);
            grupos[cid].subtotal += (parseFloat(item.valorTotal) || 0) * (parseFloat(item.percentual) || 0) / 100;
        });
        
        tbody.innerHTML = Object.values(grupos).map(g => `
            <tr style="background:#f0faf4;">
                <td colspan="7"><strong>${g.cat?.nome || 'Sem categoria'}</strong> - Subtotal: ${formatMoney(g.subtotal)}</td>
            </tr>
            ${g.itens.map(item => `
                <tr>
                    <td></td>
                    <td>${item.nome}</td>
                    <td><span class="badge ${item.tipo === 'fixo' ? 'badge-orange' : 'badge-blue'}">${item.tipo === 'fixo' ? 'Fixo' : 'Normal'}</span></td>
                    <td class="money">${formatMoney(item.valorTotal)}</td>
                    <td>${item.percentual}%</td>
                    <td class="money">${formatMoney((parseFloat(item.valorTotal) || 0) * (parseFloat(item.percentual) || 0) / 100)}</td>
                    <td>
                        <button class="btn btn-outline btn-xs" onclick="window.editarItemCusto('${item.id}')"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-danger btn-xs" onclick="window.excluirItemCusto('${item.id}')"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `).join('')}
        `).join('');
    }

    function carregarProducoesLista() {
        const el = document.getElementById('producaoList');
        if (!el || !setorAtual) return;
        
        const prods = producoes.filter(p => p.setorId === setorAtual.id);
        
        el.innerHTML = prods.length === 0
            ? '<p style="text-align:center;padding:1rem;color:var(--text-light);">Nenhuma produção registrada</p>'
            : `<div class="table-wrap"><table><thead><tr><th>Data</th><th>Material</th><th>KG</th><th></th></tr></thead><tbody>
                ${prods.map(p => `
                    <tr>
                        <td>${new Date(p.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                        <td>${p.produto}</td>
                        <td>${formatNumber(p.kg, 0)} kg</td>
                        <td><button class="btn btn-danger btn-xs" onclick="window.excluirProducao('${p.id}')"><i class="fas fa-trash"></i></button></td>
                    </tr>
                `).join('')}
            </tbody></table></div>`;
    }

    // ========== NAVEGAÇÃO ==========
    window.navegarPara = function(nivel) {
        if (nivel === 'periodos') {
            periodoAtual = null;
            setorAtual = null;
            nivelAtual = 'periodos';
        } else if (nivel === 'setores') {
            setorAtual = null;
            nivelAtual = 'setores';
        } else if (nivel === 'materiais') {
            nivelAtual = 'materiais';
        }
        renderizarTela();
    };

    window.selecionarPeriodo = function(id) {
        periodoAtual = periodos.find(p => p.id === id);
        setorAtual = null;
        nivelAtual = 'setores';
        renderizarTela();
    };

    window.selecionarSetor = function(id) {
        setorAtual = setores.find(s => s.id === id);
        nivelAtual = 'analise';
        renderizarTela();
    };

    function atualizarBreadcrumb() {
        const bc = document.getElementById('breadcrumb');
        if (!bc) return;
        
        let html = `<span class="breadcrumb-item ${nivelAtual === 'periodos' ? 'active' : ''}" onclick="window.navegarPara('periodos')"><i class="fas fa-home"></i> Home</span>`;
        
        if (nivelAtual === 'materiais') {
            html += `<span class="breadcrumb-sep"><i class="fas fa-chevron-right"></i></span><span class="breadcrumb-item active">Materiais</span>`;
        } else if (nivelAtual === 'historicoMaterial') {
            const mat = materiais.find(m => m.id === window.historicoMaterialId);
            html += `<span class="breadcrumb-sep"><i class="fas fa-chevron-right"></i></span><span class="breadcrumb-item active">Histórico: ${mat?.nome || ''}</span>`;
        } else if (periodoAtual) {
            html += `<span class="breadcrumb-sep"><i class="fas fa-chevron-right"></i></span><span class="breadcrumb-item ${nivelAtual === 'setores' ? 'active' : ''}" onclick="window.navegarPara('setores')">${getNomeMes(periodoAtual.mes)}/${periodoAtual.ano}</span>`;
            
            if (setorAtual && nivelAtual === 'analise') {
                html += `<span class="breadcrumb-sep"><i class="fas fa-chevron-right"></i></span><span class="breadcrumb-item active">${setorAtual.nome}</span>`;
            }
        }
        
        bc.innerHTML = html;
    }

    // ========== CONFIGURAÇÕES ==========
    window.abrirConfigCampos = function() {
        document.getElementById('modalConfigCampos').classList.add('active');
        document.getElementById('listaConfigCampos').innerHTML = Object.entries(configCampos)
            .map(([k, v]) => `<div class="form-group"><label>${k}</label><input type="text" id="config_${k}" value="${v}"></div>`)
            .join('');
    };

    window.salvarConfigCampos = function() {
        Object.keys(configCampos).forEach(k => {
            const inp = document.getElementById('config_' + k);
            if (inp) configCampos[k] = inp.value.trim() || configCampos[k];
        });
        saveConfig();
        window.fecharModal('modalConfigCampos');
        renderizarTela();
        showToast('success', 'Configurações salvas!', 'Personalizações aplicadas.');
    };

    // ========== MODAIS ==========
    window.fecharModal = function(id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.remove('active');
    };

    // Fechar modal ao clicar fora
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal-overlay')) {
            e.target.classList.remove('active');
        }
    });

    // ========== INICIALIZAÇÃO FINAL ==========
    function init() {
        console.log('✅ Central de Custos v2.0 inicializada!');
        console.log('📋 Funcionalidades:');
        console.log('  - Cópia completa de períodos (setores + itens + valores + produções)');
        console.log('  - Sistema de notificações Toast');
        console.log('  - Modal de confirmação personalizado');
        console.log('  - Tema escuro/claro');
        console.log('  - Feedback visual em todas as ações');
        
        document.getElementById('loadingOverlay').classList.remove('active');
    }

    // Garantir que o loading seja removido
    setTimeout(() => {
        document.getElementById('loadingOverlay').classList.remove('active');
    }, 3000);

    init();

})();
</script>
