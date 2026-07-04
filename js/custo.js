// custo.js - v2.0 (centralizado no SyncSystem)
(function() {
    'use strict';

    let db = window.firebaseDB || null;
    let usandoFirebase = !!db;

    // ---------- dados ----------
    let periodos = [],
        setores = [],
        categorias = [],
        itensCusto = [],
        producoes = [],
        materiais = [],
        custosMateriais = [],
        custosFixos = [];
    let periodoAtual = null,
        setorAtual = null;
    let nivelAtual = 'periodos';
    let filtroAnoAtual = 'todos';
    let periodosSelecionadosResumo = new Set();
    let setoresExcluidosResumo = new Set();

    const STORAGE_KEY = 'centralCustos_v14_milplastics';

    // ---------- carregar dados (prioriza SyncSystem) ----------
    async function carregarDados() {
        document.getElementById('loadingOverlay').classList.add('active');
        try {
            // 1. Tenta via SyncSystem (que já faz merge com Firebase)
            if (window.SyncSystem && window.SyncSystem.carregarModulo) {
                const dados = await window.SyncSystem.carregarModulo('centralCustos');
                if (dados && dados.periodos && dados.periodos.length > 0) {
                    aplicarDados(dados);
                    console.log('✅ Dados carregados via SyncSystem');
                    document.getElementById('loadingOverlay').classList.remove('active');
                    renderizarTela();
                    atualizarStatusFirebase();
                    return;
                }
            }

            // 2. Fallback: localStorage
            const fallback = localStorage.getItem(STORAGE_KEY);
            if (fallback) {
                const parsed = JSON.parse(fallback);
                if (parsed.periodos) {
                    aplicarDados(parsed);
                    console.log('📂 Dados carregados do localStorage (fallback)');
                    document.getElementById('loadingOverlay').classList.remove('active');
                    renderizarTela();
                    atualizarStatusFirebase();
                    return;
                }
            }

            // 3. Nenhum dado → inicializar padrão
            inicializarDadosPadrao();
            salvarDados();
            document.getElementById('loadingOverlay').classList.remove('active');
            renderizarTela();
            atualizarStatusFirebase();
        } catch (e) {
            console.error('❌ Erro ao carregar dados:', e);
            inicializarDadosPadrao();
            salvarDados();
            document.getElementById('loadingOverlay').classList.remove('active');
            renderizarTela();
        }
    }

    function aplicarDados(dados) {
        periodos = dados.periodos || [];
        setores = dados.setores || [];
        categorias = dados.categorias || [];
        itensCusto = dados.itensCusto || [];
        producoes = dados.producoes || [];
        materiais = dados.materiais || [];
        custosMateriais = dados.custosMateriais || [];
        custosFixos = dados.custosFixos || [];
        // se não houver categorias, coloca as padrão
        if (categorias.length === 0) {
            categorias = [
                { id: 'cat1', nome: 'Energia Elétrica', cor: '#f57c00' },
                { id: 'cat2', nome: 'Matéria-Prima', cor: '#0d904f' },
                { id: 'cat3', nome: 'Mão de Obra', cor: '#0277bd' },
                { id: 'cat4', nome: 'Manutenção', cor: '#6a1b9a' },
                { id: 'cat5', nome: 'Insumos', cor: '#c62828' }
            ];
        }
    }

    function inicializarDadosPadrao() {
        periodos = [];
        setores = [];
        materiais = [];
        custosMateriais = [];
        custosFixos = [];
        categorias = [
            { id: 'cat1', nome: 'Energia Elétrica', cor: '#f57c00' },
            { id: 'cat2', nome: 'Matéria-Prima', cor: '#0d904f' },
            { id: 'cat3', nome: 'Mão de Obra', cor: '#0277bd' },
            { id: 'cat4', nome: 'Manutenção', cor: '#6a1b9a' },
            { id: 'cat5', nome: 'Insumos', cor: '#c62828' }
        ];
        itensCusto = [];
        producoes = [];
    }

    // ---------- salvar dados (usa SyncSystem) ----------
    function salvarDados() {
        const dados = {
            periodos, setores, categorias, itensCusto, producoes,
            materiais, custosMateriais, custosFixos
        };
        // Salva local (SyncSystem cuida do Firebase)
        try {
            const json = JSON.stringify(dados);
            if (new Blob([json]).size / (1024 * 1024) > 4) {
                // compacta se muito grande
                const compactado = compactarDados(dados);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(compactado));
            } else {
                localStorage.setItem(STORAGE_KEY, json);
            }
        } catch (e) { console.error('Erro ao salvar localStorage:', e); }

        // Salva via SyncSystem (que envia para Firebase)
        if (window.SyncSystem && window.SyncSystem.salvarModulo) {
            window.SyncSystem.salvarModulo('centralCustos', dados).catch(() => {});
        }
    }

    function compactarDados(dados) {
        return {
            periodos: dados.periodos.map(p => ({ id: p.id, mes: p.mes, ano: p.ano, obs: p.obs || '' })),
            setores: dados.setores.map(s => ({ id: s.id, periodoId: s.periodoId, nome: s.nome, descricao: s.descricao || '', ordem: s.ordem, produtoFinal: s.produtoFinal || false, tipo: s.tipo || 'custo' })),
            categorias: dados.categorias.map(c => ({ id: c.id, nome: c.nome, cor: c.cor })),
            itensCusto: dados.itensCusto.map(i => ({ id: i.id, setorId: i.setorId, categoriaId: i.categoriaId, nome: i.nome, valorTotal: i.valorTotal, percentual: i.percentual, tipo: i.tipo || 'normal', custoFixoId: i.custoFixoId || null, obs: i.obs || '' })),
            producoes: dados.producoes.map(p => ({ id: p.id, setorId: p.setorId, produto: p.produto, kg: p.kg, data: p.data })),
            materiais: dados.materiais.map(m => ({ id: m.id, nome: m.nome, descricao: m.descricao || '' })),
            custosMateriais: dados.custosMateriais.map(c => ({ id: c.id, materialId: c.materialId, periodoId: c.periodoId, mes: c.mes, ano: c.ano, custoKgFinal: c.custoKgFinal, subtotal: c.subtotal, imposto: c.imposto, valorImposto: c.valorImposto, margem: c.margem, precoSugerido: c.precoSugerido, valorAtual: c.valorAtual, setoresDetalhes: c.setoresDetalhes, insumos: c.insumos, setoresUtilizados: c.setoresUtilizados })),
            custosFixos: dados.custosFixos.map(c => ({ id: c.id, periodoId: c.periodoId, categoriaId: c.categoriaId, nome: c.nome, valor: c.valor }))
        };
    }

    // ---------- utilitários (mantidos) ----------
    function formatMoney(v) { return 'R$ ' + (v || 0).toFixed(2).replace('.', ','); }
    function formatNumber(n, d = 2) { return (n || 0).toFixed(d).replace('.', ','); }
    function getNomeMes(m) { return ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][m-1] || ''; }
    function getSetoresDoPeriodo(periodoId) {
        const pid = periodoId || (periodoAtual ? periodoAtual.id : null);
        if (!pid) return [];
        return setores.filter(s => s.periodoId === pid).sort((a,b) => a.ordem - b.ordem);
    }
    function getCustosFixosDoPeriodo(periodoId) {
        const pid = periodoId || (periodoAtual ? periodoAtual.id : null);
        if (!pid) return [];
        return custosFixos.filter(cf => cf.periodoId === pid);
    }
    function calcularCustosSetor(setorId) {
        const itens = itensCusto.filter(i => i.setorId === setorId);
        const totalCusto = itens.reduce((s, i) => s + (i.valorTotal * (i.percentual || 100) / 100), 0);
        const prods = producoes.filter(p => p.setorId === setorId);
        const totalKg = prods.reduce((s, p) => s + p.kg, 0);
        const custoPorKg = totalKg > 0 ? totalCusto / totalKg : 0;
        return { totalCusto, totalKg, custoPorKg, qtdItens: itens.length };
    }
    function calcularResumoPeriodo(periodoIdParam, excluirSetores = null) {
        const pid = periodoIdParam || (periodoAtual ? periodoAtual.id : null);
        const excluir = excluirSetores || setoresExcluidosResumo;
        if (!pid) return { custoTotalGeral:0, producaoTotalGeral:0, custoPorKgGeral:0, qtdSetores:0, setoresFinais:[], qtdProdutosFinais:0 };
        const sets = getSetoresDoPeriodo(pid);
        const setsAtivos = sets.filter(s => !excluir.has(s.id));
        let custoTotalGeral = 0;
        setsAtivos.forEach(s => { const { totalCusto } = calcularCustosSetor(s.id); custoTotalGeral += totalCusto; });
        const setsFinais = setsAtivos.filter(s => s.produtoFinal === true);
        let producaoTotalGeral = 0;
        const detalhesFinais = [];
        setsFinais.forEach(sf => {
            const { totalCusto, totalKg, custoPorKg } = calcularCustosSetor(sf.id);
            producaoTotalGeral += totalKg;
            detalhesFinais.push({ setor: sf, custo: totalCusto, producao: totalKg, custoPorKg });
        });
        return {
            custoTotalGeral,
            producaoTotalGeral,
            custoPorKgGeral: producaoTotalGeral > 0 ? custoTotalGeral / producaoTotalGeral : 0,
            qtdSetores: setsAtivos.length,
            qtdProdutosFinais: setsFinais.length,
            setoresFinais: detalhesFinais
        };
    }

    // ---------- renderização (resumida, pois o foco é a correção) ----------
    function renderizarTela() {
        // Este método deve ser mantido igual ao seu, apenas substitua 'periodoId' e 'setorId'
        // onde estiver usando 'periodold' ou 'setorld' – ajuste os nomes dos campos.
        // Para não alongar, mantenha seu código de renderização, apenas substitua:
        //   - periodold → periodoId
        //   - setorld → setorId
        //   - categoriald → categoriaId
        //   - custoFixold → custoFixoId
        //   - materialld → materialId
        // Exemplo: itensCusto.filter(i => i.setorId === setorId)
        // ...
        // (O restante do seu código de renderização permanece igual)
    }

    // ---------- funções globais (exemplo) ----------
    window.navegarPara = function(nivel) {
        if (nivel === 'periodos') { periodoAtual = null; setorAtual = null; nivelAtual = 'periodos'; }
        else if (nivel === 'setores') { setorAtual = null; nivelAtual = 'setores'; }
        else if (nivel === 'materiais') { nivelAtual = 'materiais'; }
        renderizarTela();
    };

    window.selecionarPeriodo = function(id) {
        periodoAtual = periodos.find(p => p.id === id);
        setorAtual = null;
        nivelAtual = 'setores';
        setoresExcluidosResumo.clear();
        renderizarTela();
    };

    // ---------- inicialização ----------
    function init() {
        carregarDados();
        // Atualiza status Firebase
        atualizarStatusFirebase();
        // Escuta eventos de atualização do SyncSystem
        document.addEventListener('dataUpdated', function(e) {
            if (e.detail && e.detail.periodos) {
                aplicarDados(e.detail);
                renderizarTela();
                console.log('🔄 Dados atualizados por evento');
            }
        });
    }

    function atualizarStatusFirebase() {
        const statusEl = document.getElementById('firebaseStatus');
        if (!statusEl) return;
        const syncStatus = window.SyncSystem ? window.SyncSystem.getStatus() : null;
        if (syncStatus && syncStatus.firebaseConnected && syncStatus.online) {
            statusEl.innerHTML = '<span class="status-dot"></span> Firebase';
            statusEl.className = 'firebase-status status-firebase';
        } else {
            statusEl.innerHTML = '<span class="status-dot"></span> Local';
            statusEl.className = 'firebase-status status-local';
        }
    }

    // Aguarda Firebase e SyncSystem
    let tentativas = 0;
    const checkReady = setInterval(() => {
        tentativas++;
        if (window.SyncSystem && window.firebaseDB) {
            clearInterval(checkReady);
            db = window.firebaseDB;
            usandoFirebase = true;
            init();
        } else if (tentativas > 30) {
            clearInterval(checkReady);
            init(); // inicia mesmo sem Firebase (modo local)
        }
    }, 200);

    // Expõe funções para os botões (exemplo)
    window.abrirModalPeriodo = function(id) { /* ... */ };
    window.salvarPeriodo = function() { /* ... */ };
    // ... mantenha todas as suas funções de CRUD, apenas ajustando os nomes dos campos.

})();
