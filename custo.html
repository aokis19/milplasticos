// ====================================================
// CUSTO.JS - Central de Custos (Corrigido)
// Usa Firebase centralizado + SyncSystem
// ====================================================

(function() {
    'use strict';

    // Usar Firebase já inicializado pelo Firebase-init.js
    let db = window.firebaseDB || null;
    let usandoFirebase = !!db;

    let periodos = [],
        setores = [],
        categorias = [],
        itensCusto = [],
        producoes = [];
    let materiais = [],
        custosMateriais = [],
        custosFixos = [];
    let periodoAtual = null,
        setorAtual = null;
    let pieChart = null,
        barChart = null;
    let nivelAtual = 'periodos';
    let setoresSelecionadosGerar = new Map();
    let filtroAnoAtual = 'todos';
    let periodoOrigemCopia = null;
    let custoFixoSelecionadoId = null;
    let periodosSelecionadosResumo = new Set();
    let setoresExcluidosResumo = new Set();
    let graficoMensalChart = null;
    let graficoConsolidadoChart = null;
    let configCampos = {
        setorNome: 'Nome do Setor',
        setorDesc: 'Descrição',
        custoTotal: 'Custo Total',
        producaoKg: 'Produção (KG)',
        custoPorKg: 'Custo por KG'
    };

    const STORAGE_KEY = 'centralCustos_v14_milplastics';
    const CONFIG_KEY = 'centralCustos_config_v14';

    // ======== UTILITÁRIOS ========
    function formatMoney(v) {
        return 'R$ ' + (v || 0).toFixed(2).replace('.', ',');
    }
    function formatMoneySimples(v) {
        return (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function formatNumber(n, d) {
        d = d || 2;
        return (n || 0).toFixed(d).replace('.', ',');
    }
    function getNomeMes(m) {
        return ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][m - 1] || '';
    }
    function getSetoresDoPeriodo(periodoid) {
        var pid = periodoid || (periodoAtual ? periodoAtual.id : null);
        if (!pid) return [];
        return setores.filter(function(s) { return s.periodold === pid; }).sort(function(a, b) { return a.ordem - b.ordem; });
    }
    function getCustosFixosDoPeriodo(periodoid) {
        var pid = periodoid || (periodoAtual ? periodoAtual.id : null);
        if (!pid) return [];
        return custosFixos.filter(function(cf) { return cf.periodold === pid; });
    }
    function calcularCustosSetor(setorld) {
        var itens = itensCusto.filter(function(i) { return i.setorld === setorld; });
        var totalCusto = itens.reduce(function(s, i) { return s + (i.valorTotal * (i.percentual || 100) / 100); }, 0);
        var prods = producoes.filter(function(p) { return p.setorld === setorld; });
        var totalKg = prods.reduce(function(s, p) { return s + p.kg; }, 0);
        var custoPorKg = totalKg > 0 ? totalCusto / totalKg : 0;
        return { totalCusto: totalCusto, totalKg: totalKg, custoPorKg: custoPorKg, qtdItens: itens.length };
    }
    function getCustoPorKgSetor(setorld) {
        var custos = calcularCustosSetor(setorld);
        return custos.totalKg > 0 ? custos.totalCusto / custos.totalKg : 0;
    }
    function calcularResumoPeriodo(periodoidParam, excluirSetores) {
        var pid = periodoidParam || (periodoAtual ? periodoAtual.id : null);
        var excluir = excluirSetores || setoresExcluidosResumo;
        if (!pid) return { custoTotalGeral: 0, producaoTotalGeral: 0, custoPorKgGeral: 0, qtdSetores: 0, setoresFinais: [], qtdProdutosFinais: 0 };

        var sets = getSetoresDoPeriodo(pid);
        var setsAtivos = sets.filter(function(s) { return !excluir.has(s.id); });

        var custoTotalGeral = 0;
        setsAtivos.forEach(function(s) {
            var custos = calcularCustosSetor(s.id);
            custoTotalGeral += custos.totalCusto;
        });

        var setsFinais = setsAtivos.filter(function(s) { return s.produtoFinal === true; });
        var producaoTotalGeral = 0;
        var detalhesFinais = [];
        setsFinais.forEach(function(sf) {
            var custos = calcularCustosSetor(sf.id);
            producaoTotalGeral += custos.totalKg;
            detalhesFinais.push({ setor: sf, custo: custos.totalCusto, producao: custos.totalKg, custoPorKg: custos.custoPorKg });
        });

        return {
            custoTotalGeral: custoTotalGeral,
            producaoTotalGeral: producaoTotalGeral,
            custoPorKgGeral: producaoTotalGeral > 0 ? custoTotalGeral / producaoTotalGeral : 0,
            qtdSetores: setsAtivos.length,
            qtdProdutosFinais: setsFinais.length,
            setoresFinais: detalhesFinais
        };
    }
    function calcularResumoConsolidado() {
        if (periodosSelecionadosResumo.size === 0) return null;
        var custoTotal = 0,
            producaoTotal = 0,
            qtdSetores = 0;
        var emptySet = new Set();
        periodosSelecionadosResumo.forEach(function(pid) {
            var resumo = calcularResumoPeriodo(pid, emptySet);
            custoTotal += resumo.custoTotalGeral;
            producaoTotal += resumo.producaoTotalGeral;
            qtdSetores += resumo.qtdSetores;
        });
        return {
            custoTotal: custoTotal,
            producaoTotal: producaoTotal,
            custoPorKg: producaoTotal > 0 ? custoTotal / producaoTotal : 0,
            qtdSetores: qtdSetores,
            qtdPeriodos: periodosSelecionadosResumo.size
        };
    }

    // ======== FUNÇÕES DE ARMAZENAMENTO ========
    function loadLocalData() {
        // Tentar Firebase primeiro via SyncSystem
        if (usandoFirebase && db) {
            carregarDadosFirebase().then(function() {
                document.getElementById('loadingOverlay').classList.remove('active');
            }).catch(function() {
                carregarLocalStorageFallback();
                document.getElementById('loadingOverlay').classList.remove('active');
            });
        } else {
            carregarLocalStorageFallback();
            document.getElementById('loadingOverlay').classList.remove('active');
        }

        var savedConfig = localStorage.getItem(CONFIG_KEY);
        if (savedConfig) configCampos = Object.assign({}, configCampos, JSON.parse(savedConfig));
    }

    function carregarLocalStorageFallback() {
        try {
            var data = localStorage.getItem(STORAGE_KEY);
            if (data) {
                var p = JSON.parse(data);
                periodos = p.periodos || [];
                setores = p.setores || [];
                categorias = p.categorias || [];
                itensCusto = p.itensCusto || [];
                producoes = p.producoes || [];
                materiais = p.materiais || [];
                custosMateriais = p.custosMateriais || [];
                custosFixos = p.custosFixos || [];
            } else {
                inicializarDadosPadrao();
            }
        } catch (e) {
            inicializarDadosPadrao();
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

    function saveLocalData() {
        try {
            var dados = {
                periodos: periodos,
                setores: setores,
                categorias: categorias,
                itensCusto: itensCusto,
                producoes: producoes,
                materiais: materiais,
                custosMateriais: custosMateriais,
                custosFixos: custosFixos
            };

            // Salvar no SyncSystem (que salva no Firebase)
            if (window.SyncSystem && window.SyncSystem.salvarModulo) {
                window.SyncSystem.salvarModulo('centralCustos', dados).catch(function() {});
            }

            // Backup local
            var json = JSON.stringify(dados);
            var tamanhoEmMB = new Blob([json]).size / (1024 * 1024);

            if (tamanhoEmMB > 4) {
                var compactado = compactarDados(dados);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(compactado));
            } else {
                localStorage.setItem(STORAGE_KEY, json);
            }
        } catch (e) {
            console.error('Erro ao salvar:', e);
        }
    }

    function compactarDados(dados) {
        return {
            periodos: dados.periodos.map(function(p) { return { id: p.id, mes: p.mes, ano: p.ano, obs: p.obs || '' }; }),
            setores: dados.setores.map(function(s) { return { id: s.id, periodold: s.periodold, nome: s.nome, descricao: s.descricao || '', ordem: s.ordem, produtoFinal: s.produtoFinal || false, tipo: s.tipo || 'custo' }; }),
            categorias: dados.categorias.map(function(c) { return { id: c.id, nome: c.nome, cor: c.cor }; }),
            itensCusto: dados.itensCusto.map(function(i) { return { id: i.id, setorld: i.setorld, categoriald: i.categoriald, nome: i.nome, valorTotal: i.valorTotal, percentual: i.percentual, tipo: i.tipo || 'normal', custoFixold: i.custoFixold || null, obs: i.obs || '' }; }),
            producoes: dados.producoes.map(function(p) { return { id: p.id, setorld: p.setorld, produto: p.produto, kg: p.kg, data: p.data }; }),
            materiais: dados.materiais.map(function(m) { return { id: m.id, nome: m.nome, descricao: m.descricao || '' }; }),
            custosMateriais: dados.custosMateriais.map(function(c) { return { id: c.id, materialld: c.materialld, periodold: c.periodold, mes: c.mes, ano: c.ano, custoKgFinal: c.custoKgFinal, subtotal: c.subtotal, imposto: c.imposto, valorImposto: c.valorImposto, margem: c.margem, precoSugerido: c.precoSugerido, valorAtual: c.valorAtual, setoresDetalhes: c.setoresDetalhes, insumos: c.insumos, setoresUtilizados: c.setoresUtilizados }; }),
            custosFixos: dados.custosFixos.map(function(c) { return { id: c.id, periodold: c.periodold, categoriald: c.categoriald, nome: c.nome, valor: c.valor }; })
        };
    }

    function saveConfig() {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(configCampos));
    }

    // ======== CARREGAR DO FIREBASE (VIA SYNC SYSTEM) ========
    async function carregarDadosFirebase() {
        if (!usandoFirebase || !db) return;
        try {
            // Usar SyncSystem para carregar os dados
            if (window.SyncSystem && window.SyncSystem.carregarModulo) {
                var dados = await window.SyncSystem.carregarModulo('centralCustos');
                if (dados && dados.periodos && dados.periodos.length > 0) {
                    // Aplicar dados
                    periodos = dados.periodos || [];
                    setores = dados.setores || [];
                    categorias = dados.categorias || [];
                    itensCusto = dados.itensCusto || [];
                    producoes = dados.producoes || [];
                    materiais = dados.materiais || [];
                    custosMateriais = dados.custosMateriais || [];
                    custosFixos = dados.custosFixos || [];
                    if (categorias.length === 0) {
                        categorias = [
                            { id: 'cat1', nome: 'Energia Elétrica', cor: '#f57c00' },
                            { id: 'cat2', nome: 'Matéria-Prima', cor: '#0d904f' },
                            { id: 'cat3', nome: 'Mão de Obra', cor: '#0277bd' },
                            { id: 'cat4', nome: 'Manutenção', cor: '#6a1b9a' },
                            { id: 'cat5', nome: 'Insumos', cor: '#c62828' }
                        ];
                    }
                    saveLocalData();
                    console.log('✅ Dados carregados do Firebase via SyncSystem');
                    renderizarTela();
                    atualizarStatusFirebase();
                    return;
                }
            }
            // Fallback: tentar Firebase direto (coleções específicas)
            var snaps = await Promise.all([
                db.collection('custos_periodos').get(),
                db.collection('custos_setores').get(),
                db.collection('custos_categorias').get(),
                db.collection('custos_itens').get(),
                db.collection('custos_producoes').get(),
                db.collection('custos_materiais').get(),
                db.collection('custos_materiais_custos').get(),
                db.collection('custos_fixos').get()
            ]);

            var fbPeriodos = snaps[0].docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
            var fbSetores = snaps[1].docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
            var fbCategorias = snaps[2].docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
            var fbItens = snaps[3].docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
            var fbProducoes = snaps[4].docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
            var fbMateriais = snaps[5].docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
            var fbCustosMat = snaps[6].docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
            var fbCustosFixos = snaps[7].docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });

            // Se Firebase tem mais dados, usar Firebase
            if (fbPeriodos.length >= periodos.length) {
                periodos = fbPeriodos;
                setores = fbSetores;
                if (fbCategorias.length > 0) categorias = fbCategorias;
                itensCusto = fbItens;
                producoes = fbProducoes;
                materiais = fbMateriais;
                custosMateriais = fbCustosMat;
                custosFixos = fbCustosFixos;
                console.log('✅ Dados carregados do Firebase (direto)');
            }

            saveLocalData();
            renderizarTela();
            atualizarStatusFirebase();
        } catch (e) {
            console.error('Erro ao carregar Firebase:', e);
            renderizarTela();
        }
    }

    // ======== SALVAR/EXCLUIR NO FIREBASE (para CRUD individual) ========
    async function salvarFB(col, dados) {
        if (!usandoFirebase || !db) return;
        try {
            if (dados.id) {
                await db.collection(col).doc(dados.id).set(dados, { merge: true });
            } else {
                var ref = await db.collection(col).add(dados);
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
        } catch (e) {}
    }

    // ======== RENDERIZAÇÃO PRINCIPAL ========
    function renderizarTela() {
        if (nivelAtual === 'periodos') renderizarPeriodos();
        else if (nivelAtual === 'setores') renderizarSetores();
        else if (nivelAtual === 'analise') renderizarAnalise();
        else if (nivelAtual === 'materiais') renderizarMateriais();
        else if (nivelAtual === 'historicoMaterial') renderizarHistoricoMaterial();
        atualizarBreadcrumb();
    }

    // ======== RENDERIZAR PERÍODOS ========
    function renderizarPeriodos() {
        var container = document.getElementById('conteudoDinamico');
        var anosDisponiveis = [];
        var anosSet = new Set();
        periodos.forEach(function(p) { anosSet.add(p.ano); });
        anosDisponiveis = Array.from(anosSet).sort(function(a, b) { return b - a; });

        var periodosFiltrados = periodos.slice();
        if (filtroAnoAtual !== 'todos') {
            periodosFiltrados = periodosFiltrados.filter(function(p) { return p.ano === parseInt(filtroAnoAtual); });
        }
        periodosFiltrados.sort(function(a, b) {
            if (a.ano !== b.ano) return b.ano - a.ano;
            return b.mes - a.mes;
        });

        var resumoConsolidado = calcularResumoConsolidado();

        var html = '';
        if (resumoConsolidado) {
            html += '<div class="resumo-consolidado">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">';
            html += '<h3 style="margin:0;"><i class="fas fa-layer-group"></i> Resumo Consolidado</h3>';
            html += '<button class="btn btn-purple btn-sm" onclick="window.abrirGraficoConsolidado()"><i class="fas fa-chart-bar"></i> Ver Gráfico</button>';
            html += '</div>';
            html += '<div class="periodos-selecionados-tags">';
            var tagsHtml = '';
            periodosSelecionadosResumo.forEach(function(pid) {
                var per = periodos.find(function(p) { return p.id === pid; });
                if (per) {
                    tagsHtml += '<span class="periodo-tag">' + getNomeMes(per.mes) + '/' + per.ano + ' <span class="remover-tag" onclick="window.removePeriodoResumo(\'' + pid + '\')">x</span></span>';
                }
            });
            html += tagsHtml;
            html += '<span class="btn-selecionar-todos" onclick="window.limparSelecaoResumo()">Limpar</span>';
            html += '</div>';
            html += '<div class="stats-grid-resumo">';
            html += '<div class="stat-resumo"><div class="sr-valor">' + resumoConsolidado.qtdPeriodos + '</div><div class="sr-label">Períodos</div></div>';
            html += '<div class="stat-resumo"><div class="sr-valor">' + resumoConsolidado.qtdSetores + '</div><div class="sr-label">Setores</div></div>';
            html += '<div class="stat-resumo"><div class="sr-valor">' + formatMoney(resumoConsolidado.custoTotal) + '</div><div class="sr-label">Custo Total</div></div>';
            html += '<div class="stat-resumo"><div class="sr-valor">' + formatNumber(resumoConsolidado.producaoTotal, 0) + ' kg</div><div class="sr-label">Produção Total</div></div>';
            html += '<div class="stat-resumo destaque"><div class="sr-valor">' + formatMoney(resumoConsolidado.custoPorKg) + '/kg</div><div class="sr-label">Custo Médio/KG</div></div>';
            html += '</div>';
            html += '</div>';
        }

        html += '<div class="card">';
        html += '<div class="card-header">';
        html += '<span class="card-title"><i class="fas fa-calendar-alt"></i> Períodos</span>';
        html += '<div style="display:flex;gap:0.5rem;align-items:center;">';
        html += '<select id="filtroAno" onchange="window.mudarFiltroAno(this.value)" style="padding:0.3rem 0.5rem;border-radius:6px;border:1px solid #ddd;font-size:0.8rem;">';
        html += '<option value="todos" ' + (filtroAnoAtual === 'todos' ? 'selected' : '') + '>Todos</option>';
        anosDisponiveis.forEach(function(a) {
            html += '<option value="' + a + '" ' + (filtroAnoAtual == a ? 'selected' : '') + '>' + a + '</option>';
        });
        html += '</select>';
        html += '<button class="btn btn-primary btn-sm" onclick="window.abrirModalPeriodo()"><i class="fas fa-plus"></i> Novo</button>';
        html += '</div>';
        html += '</div>';

        if (periodosFiltrados.length === 0) {
            html += '<div style="text-align:center;padding:2rem;"><p>Nenhum período cadastrado.</p></div>';
        } else {
            html += '<div class="periodos-grid" id="periodosGrid"></div>';
        }
        html += '</div>';

        container.innerHTML = html;

        if (periodosFiltrados.length > 0) {
            var grid = document.getElementById('periodosGrid');
            periodosFiltrados.forEach(function(per) {
                var resumo = calcularResumoPeriodo(per.id, new Set());
                var isSelecionado = periodosSelecionadosResumo.has(per.id);
                var div = document.createElement('div');
                div.className = 'periodo-card' + (isSelecionado ? ' selecionado-resumo' : '');
                div.innerHTML =
                    '<div class="periodo-check"><input type="checkbox" ' + (isSelecionado ? 'checked' : '') + ' onchange="window.togglePeriodoResumo(\'' + per.id + '\', this.checked)"></div>' +
                    '<div class="acoes">' +
                    '<button class="btn btn-purple btn-xs" onclick="event.stopPropagation();window.abrirGraficoMensal(\'' + per.id + '\')"><i class="fas fa-chart-bar"></i></button>' +
                    '<button class="btn btn-info btn-xs" onclick="event.stopPropagation();window.abrirCopiarPeriodo(\'' + per.id + '\')"><i class="fas fa-copy"></i></button>' +
                    '<button class="btn btn-outline btn-xs" onclick="event.stopPropagation();window.editarPeriodo(\'' + per.id + '\')"><i class="fas fa-edit"></i></button>' +
                    '<button class="btn btn-danger btn-xs" onclick="event.stopPropagation();window.excluirPeriodo(\'' + per.id + '\')"><i class="fas fa-trash"></i></button>' +
                    '</div>' +
                    '<div class="periodo-titulo" onclick="window.selecionarPeriodo(\'' + per.id + '\')"><i class="fas fa-calendar-check"></i> ' + getNomeMes(per.mes) + '/' + per.ano + '</div>' +
                    '<div class="periodo-obs">' + (per.obs || 'Sem descrição') + '</div>' +
                    '<div class="periodo-stats">' +
                    '<div class="periodo-stat"><span class="label">Setores</span><span class="valor">' + resumo.qtdSetores + '</span></div>' +
                    '<div class="periodo-stat"><span class="label">Custo Total</span><span class="valor money">' + formatMoney(resumo.custoTotalGeral) + '</span></div>' +
                    '<div class="periodo-stat"><span class="label">Produção</span><span class="valor">' + formatNumber(resumo.producaoTotalGeral, 0) + ' kg</span></div>' +
                    '<div class="periodo-stat"><span class="label">Custo/KG</span><span class="valor money">' + formatMoney(resumo.custoPorKgGeral) + '/kg</span></div>' +
                    '</div>';
                grid.appendChild(div);
            });
        }
    }

    // ======== RENDERIZAR SETORES ========
    function renderizarSetores() {
        var container = document.getElementById('conteudoDinamico');
        if (!periodoAtual) {
            container.innerHTML = '<div class="card"><p style="text-align:center;padding:2rem;">Selecione um período primeiro.</p></div>';
            return;
        }
        var sets = getSetoresDoPeriodo(periodoAtual.id);
        var resumo = calcularResumoPeriodo(periodoAtual.id);

        var html = '<div class="card">';
        html += '<div class="card-header">';
        html += '<span class="card-title"><i class="fas fa-industry"></i> Setores - ' + getNomeMes(periodoAtual.mes) + '/' + periodoAtual.ano + '</span>';
        html += '<div style="display:flex;gap:0.5rem;align-items:center;">';
        html += '<button class="btn btn-primary btn-sm" onclick="window.abrirModalSetor()"><i class="fas fa-plus"></i> Novo Setor</button>';
        html += '<button class="btn btn-outline btn-sm" onclick="window.navegarPara(\'periodos\')"><i class="fas fa-arrow-left"></i> Voltar</button>';
        html += '</div>';
        html += '</div>';
        html += '<div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;background:#f9f9f9;padding:0.75rem;border-radius:8px;">';
        html += '<span><strong>Setores:</strong> ' + resumo.qtdSetores + '</span>';
        html += '<span><strong>Custo Total:</strong> ' + formatMoney(resumo.custoTotalGeral) + '</span>';
        html += '<span><strong>Produção:</strong> ' + formatNumber(resumo.producaoTotalGeral, 0) + ' kg</span>';
        html += '<span><strong>Custo/KG Médio:</strong> ' + formatMoney(resumo.custoPorKgGeral) + '/kg</span>';
        html += '</div>';

        if (sets.length === 0) {
            html += '<p style="text-align:center;padding:1rem;">Nenhum setor cadastrado.</p>';
        } else {
            html += '<div class="setores-grid" id="setoresGrid"></div>';
        }
        html += '<div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap;">';
        html += '<button class="btn btn-warning btn-sm" onclick="window.abrirModalCustoFixo()"><i class="fas fa-thumbtack"></i> Novo Custo Fixo</button>';
        html += '<button class="btn btn-outline btn-sm" onclick="window.abrirModalCategoria()"><i class="fas fa-tag"></i> Nova Categoria</button>';
        html += '</div>';
        html += '</div>';

        container.innerHTML = html;

        if (sets.length > 0) {
            var grid = document.getElementById('setoresGrid');
            sets.forEach(function(s) {
                var custos = calcularCustosSetor(s.id);
                var isExcluido = setoresExcluidosResumo.has(s.id);
                var div = document.createElement('div');
                div.className = 'setor-card' + (isExcluido ? ' excluido' : '');
                div.innerHTML =
                    '<div class="setor-check"><input type="checkbox" ' + (!isExcluido ? 'checked' : '') + ' onchange="window.toggleSetorResumo(\'' + s.id + '\', this.checked)"></div>' +
                    '<div class="setor-info" onclick="window.selecionarSetor(\'' + s.id + '\')">' +
                    '<div class="setor-nome">' + s.nome + '</div>' +
                    '<div class="setor-desc">' + (s.descricao || '') + '</div>' +
                    (s.produtoFinal ? '<span class="badge produto-final">Produto Final</span>' : '') +
                    '</div>' +
                    '<div class="setor-stats">' +
                    '<div><span class="label">Custo</span><span class="valor money">' + formatMoney(custos.totalCusto) + '</span></div>' +
                    '<div><span class="label">Produção</span><span class="valor">' + formatNumber(custos.totalKg, 0) + ' kg</span></div>' +
                    '<div><span class="label">Custo/KG</span><span class="valor money">' + formatMoney(custos.custoPorKg) + '/kg</span></div>' +
                    '<div><span class="label">Itens</span><span class="valor">' + custos.qtdItens + '</span></div>' +
                    '</div>' +
                    '<div class="setor-acoes">' +
                    '<button class="btn btn-outline btn-xs" onclick="event.stopPropagation();window.editarSetor(\'' + s.id + '\')"><i class="fas fa-edit"></i></button>' +
                    '<button class="btn btn-danger btn-xs" onclick="event.stopPropagation();window.excluirSetor(\'' + s.id + '\')"><i class="fas fa-trash"></i></button>' +
                    '</div>';
                grid.appendChild(div);
            });
        }
    }

    // ======== RENDERIZAR ANÁLISE ========
    function renderizarAnalise() {
        var container = document.getElementById('conteudoDinamico');
        if (!setorAtual) {
            container.innerHTML = '<div class="card"><p style="text-align:center;padding:2rem;">Selecione um setor.</p></div>';
            return;
        }
        var setor = setorAtual;
        var custos = calcularCustosSetor(setor.id);
        var itens = itensCusto.filter(function(i) { return i.setorld === setor.id; });
        var prods = producoes.filter(function(p) { return p.setorld === setor.id; });

        var html = '<div class="card">';
        html += '<div class="card-header">';
        html += '<span class="card-title"><i class="fas fa-chart-pie"></i> Análise - ' + setor.nome + '</span>';
        html += '<button class="btn btn-outline btn-sm" onclick="window.navegarPara(\'setores\')"><i class="fas fa-arrow-left"></i> Voltar</button>';
        html += '</div>';
        html += '<div style="display:flex;gap:2rem;flex-wrap:wrap;margin-bottom:1.5rem;">';
        html += '<div><strong>Custo Total:</strong> ' + formatMoney(custos.totalCusto) + '</div>';
        html += '<div><strong>Produção:</strong> ' + formatNumber(custos.totalKg, 0) + ' kg</div>';
        html += '<div><strong>Custo/KG:</strong> ' + formatMoney(custos.custoPorKg) + '/kg</div>';
        html += '<div><strong>Itens:</strong> ' + custos.qtdItens + '</div>';
        html += '</div>';

        html += '<h4>Itens de Custo</h4>';
        if (itens.length === 0) {
            html += '<p>Nenhum item cadastrado.</p>';
        } else {
            html += '<table class="table"><thead><tr><th>Item</th><th>Categoria</th><th>Valor Total</th><th>% Rateio</th><th>Valor Rateado</th><th>Ações</th></tr></thead><tbody>';
            itens.forEach(function(i) {
                var cat = categorias.find(function(c) { return c.id === i.categoriald; });
                var valorRateado = i.valorTotal * (i.percentual || 100) / 100;
                html += '<tr><td>' + i.nome + '</td><td>' + (cat ? cat.nome : '') + '</td><td>' + formatMoney(i.valorTotal) + '</td><td>' + (i.percentual || 100) + '%</td><td>' + formatMoney(valorRateado) + '</td><td><button class="btn btn-outline btn-xs" onclick="window.editarItemCusto(\'' + i.id + '\')"><i class="fas fa-edit"></i></button> <button class="btn btn-danger btn-xs" onclick="window.excluirItemCusto(\'' + i.id + '\')"><i class="fas fa-trash"></i></button></td></tr>';
            });
            html += '</tbody></table>';
        }
        html += '<div style="margin-top:1rem;"><button class="btn btn-primary btn-sm" onclick="window.abrirModalItemCusto()"><i class="fas fa-plus"></i> Adicionar Item</button></div>';

        html += '<h4 style="margin-top:2rem;">Produção</h4>';
        if (prods.length === 0) {
            html += '<p>Nenhuma produção registrada.</p>';
        } else {
            html += '<table class="table"><thead><tr><th>Produto</th><th>KG</th><th>Data</th><th>Ações</th></tr></thead><tbody>';
            prods.forEach(function(p) {
                html += '<tr><td>' + p.produto + '</td><td>' + formatNumber(p.kg, 0) + '</td><td>' + (p.data || '') + '</td><td><button class="btn btn-danger btn-xs" onclick="window.excluirProducao(\'' + p.id + '\')"><i class="fas fa-trash"></i></button></td></tr>';
            });
            html += '</tbody></table>';
        }
        html += '<div style="margin-top:1rem;"><button class="btn btn-teal btn-sm" onclick="window.abrirModalProducao()"><i class="fas fa-plus"></i> Registrar Produção</button></div>';

        html += '</div>';
        container.innerHTML = html;
    }

    // ======== RENDERIZAR MATERIAIS ========
    function renderizarMateriais() {
        var container = document.getElementById('conteudoDinamico');
        var html = '<div class="card">';
        html += '<div class="card-header">';
        html += '<span class="card-title"><i class="fas fa-box"></i> Materiais</span>';
        html += '<button class="btn btn-primary btn-sm" onclick="window.abrirModalMaterial()"><i class="fas fa-plus"></i> Novo Material</button>';
        html += '</div>';
        if (materiais.length === 0) {
            html += '<p style="text-align:center;padding:1rem;">Nenhum material cadastrado.</p>';
        } else {
            html += '<table class="table"><thead><tr><th>Nome</th><th>Descrição</th><th>Ações</th></tr></thead><tbody>';
            materiais.forEach(function(m) {
                html += '<tr><td>' + m.nome + '</td><td>' + (m.descricao || '') + '</td><td><button class="btn btn-outline btn-xs" onclick="window.editarMaterial(\'' + m.id + '\')"><i class="fas fa-edit"></i></button> <button class="btn btn-danger btn-xs" onclick="window.excluirMaterial(\'' + m.id + '\')"><i class="fas fa-trash"></i></button> <button class="btn btn-info btn-xs" onclick="window.verHistoricoMaterial(\'' + m.id + '\')"><i class="fas fa-history"></i></button></td></tr>';
            });
            html += '</tbody></table>';
        }
        html += '</div>';
        container.innerHTML = html;
    }

    function renderizarHistoricoMaterial() {
        var container = document.getElementById('conteudoDinamico');
        container.innerHTML = '<div class="card"><p>Histórico de materiais (em desenvolvimento)</p><button class="btn btn-outline btn-sm" onclick="window.navegarPara(\'materiais\')">Voltar</button></div>';
    }

    // ======== BREADCRUMB ========
    function atualizarBreadcrumb() {
        var bc = document.getElementById('breadcrumb');
        var html = '<span class="breadcrumb-item ' + (nivelAtual === 'periodos' ? 'active' : '') + '" onclick="window.navegarPara(\'periodos\')"><i class="fas fa-home"></i> Home</span>';
        if (periodoAtual) {
            html += '<span class="breadcrumb-sep"><i class="fas fa-chevron-right"></i></span><span class="breadcrumb-item ' + (nivelAtual === 'setores' ? 'active' : '') + '" onclick="window.navegarPara(\'setores\')">' + getNomeMes(periodoAtual.mes) + '/' + periodoAtual.ano + '</span>';
        }
        if (setorAtual) {
            html += '<span class="breadcrumb-sep"><i class="fas fa-chevron-right"></i></span><span class="breadcrumb-item active">' + setorAtual.nome + '</span>';
        }
        bc.innerHTML = html;
    }

    // ======== NAVEGAÇÃO ========
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
        } else if (nivel === 'analise') {
            // já está
        }
        renderizarTela();
    };

    window.selecionarPeriodo = function(id) {
        periodoAtual = periodos.find(function(p) { return p.id === id; });
        setorAtual = null;
        nivelAtual = 'setores';
        setoresExcluidosResumo.clear();
        renderizarTela();
    };

    window.selecionarSetor = function(id) {
        setorAtual = setores.find(function(s) { return s.id === id; });
        nivelAtual = 'analise';
        renderizarTela();
    };

    // ======== CRUD PERÍODOS ========
    window.abrirModalPeriodo = function(id) {
        id = id || null;
        document.getElementById('modalPeriodo').classList.add('active');
        if (id) {
            var p = periodos.find(function(x) { return x.id === id; });
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
        var p = {
            mes: parseInt(document.getElementById('periodoMes').value),
            ano: parseInt(document.getElementById('periodoAno').value),
            obs: document.getElementById('periodoObs').value.trim(),
            createdAt: new Date().toISOString()
        };
        var editId = document.getElementById('periodoEditId').value;
        if (editId) {
            p.id = editId;
            var idx = periodos.findIndex(function(x) { return x.id === editId; });
            if (idx !== -1) periodos[idx] = p;
        } else {
            p.id = 'per_' + Date.now();
            periodos.push(p);
        }
        await salvarFB('custos_periodos', p);
        saveLocalData();
        window.fecharModal('modalPeriodo');
        renderizarTela();
    };

    window.editarPeriodo = function(id) {
        window.abrirModalPeriodo(id);
    };

    window.excluirPeriodo = async function(id) {
        if (confirm('Excluir período?')) {
            setores.filter(function(s) { return s.periodold === id; }).forEach(function(s) {
                itensCusto = itensCusto.filter(function(i) { return i.setorld !== s.id; });
                producoes = producoes.filter(function(p) { return p.setorld !== s.id; });
            });
            setores = setores.filter(function(s) { return s.periodold !== id; });
            custosFixos = custosFixos.filter(function(cf) { return cf.periodold !== id; });
            periodos = periodos.filter(function(p) { return p.id !== id; });
            periodosSelecionadosResumo.delete(id);
            await excluirFB('custos_periodos', id);
            saveLocalData();
            if (periodoAtual && periodoAtual.id === id) {
                periodoAtual = null;
                nivelAtual = 'periodos';
            }
            renderizarTela();
        }
    };

    // ======== CRUD SETORES ========
    window.abrirModalSetor = function(id) {
        id = id || null;
        if (!periodoAtual) {
            alert('Selecione um período!');
            return;
        }
        document.getElementById('modalSetor').classList.add('active');
        if (id) {
            var s = setores.find(function(x) { return x.id === id; });
            if (s) {
                document.getElementById('modalSetorTitulo').innerHTML = '<i class="fas fa-edit"></i> Editar Setor';
                document.getElementById('setorEditId').value = s.id;
                document.getElementById('setorNome').value = s.nome || '';
                document.getElementById('setorDescricao').value = s.descricao || '';
                document.getElementById('setorOrdem').value = s.ordem || 1;
                document.getElementById('setorProdutoFinal').checked = s.produtoFinal || false;
                document.getElementById('setorTipo').value = s.tipo || 'custo';
            }
        } else {
            document.getElementById('modalSetorTitulo').innerHTML = '<i class="fas fa-plus"></i> Novo Setor';
            document.getElementById('setorEditId').value = '';
            document.getElementById('setorNome').value = '';
            document.getElementById('setorDescricao').value = '';
            document.getElementById('setorOrdem').value = '1';
            document.getElementById('setorProdutoFinal').checked = false;
            document.getElementById('setorTipo').value = 'custo';
        }
    };

    window.salvarSetor = async function() {
        if (!periodoAtual) {
            alert('Nenhum período selecionado!');
            return;
        }
        var nome = document.getElementById('setorNome').value.trim();
        if (!nome) {
            alert('Digite o nome!');
            return;
        }
        var s = {
            periodold: periodoAtual.id,
            nome: nome,
            descricao: document.getElementById('setorDescricao').value.trim() || '',
            ordem: parseInt(document.getElementById('setorOrdem').value) || 1,
            produtoFinal: document.getElementById('setorProdutoFinal').checked || false,
            tipo: document.getElementById('setorTipo').value || 'custo',
            createdAt: new Date().toISOString()
        };
        var editId = document.getElementById('setorEditId').value;
        if (editId) {
            s.id = editId;
            var idx = setores.findIndex(function(x) { return x.id === editId; });
            if (idx !== -1) setores[idx] = Object.assign({}, setores[idx], s);
        } else {
            s.id = 'set_' + Date.now();
            setores.push(s);
        }
        await salvarFB('custos_setores', s);
        saveLocalData();
        window.fecharModal('modalSetor');
        renderizarTela();
    };

    window.editarSetor = function(id) {
        window.abrirModalSetor(id);
    };

    window.excluirSetor = async function(id) {
        if (!confirm('Excluir setor?')) return;
        itensCusto = itensCusto.filter(function(i) { return i.setorld !== id; });
        producoes = producoes.filter(function(p) { return p.setorld !== id; });
        setores = setores.filter(function(s) { return s.id !== id; });
        setoresExcluidosResumo.delete(id);
        await excluirFB('custos_setores', id);
        saveLocalData();
        if (setorAtual && setorAtual.id === id) setorAtual = null;
        renderizarTela();
    };

    // ======== CRUD CATEGORIAS ========
    window.abrirModalCategoria = function(id) {
        id = id || null;
        var modal = document.getElementById('modalCategoria');
        modal.classList.add('active');
        if (id) {
            var cat = categorias.find(function(c) { return c.id === id; });
            if (cat) {
                document.getElementById('modalCategoriaTitulo').innerText = 'Editar Categoria';
                document.getElementById('categoriaEditId').value = cat.id;
                document.getElementById('categoriaNome').value = cat.nome;
                document.getElementById('categoriaCor').value = cat.cor;
            }
        } else {
            document.getElementById('modalCategoriaTitulo').innerText = 'Nova Categoria';
            document.getElementById('categoriaEditId').value = '';
            document.getElementById('categoriaNome').value = '';
            document.getElementById('categoriaCor').value = '#0d904f';
        }
    };

    window.salvarCategoria = function() {
        var nome = document.getElementById('categoriaNome').value.trim();
        if (!nome) {
            alert('Digite o nome da categoria.');
            return;
        }
        var cor = document.getElementById('categoriaCor').value;
        var editId = document.getElementById('categoriaEditId').value;
        if (editId) {
            var idx = categorias.findIndex(function(c) { return c.id === editId; });
            if (idx !== -1) categorias[idx] = Object.assign({}, categorias[idx], { nome: nome, cor: cor });
        } else {
            categorias.push({ id: 'cat_' + Date.now(), nome: nome, cor: cor });
        }
        salvarFB('custos_categorias', categorias[categorias.length - 1] || categorias[idx]);
        saveLocalData();
        window.fecharModal('modalCategoria');
        renderizarTela();
    };

    window.editarCategoria = function(id) {
        window.abrirModalCategoria(id);
    };

    window.excluirCategoria = function(id) {
        if (!confirm('Excluir categoria?')) return;
        categorias = categorias.filter(function(c) { return c.id !== id; });
        excluirFB('custos_categorias', id);
        saveLocalData();
        renderizarTela();
    };

    // ======== CRUD CUSTO FIXO ========
    window.abrirModalCustoFixo = function(id) {
        id = id || null;
        var modal = document.getElementById('modalCustoFixo');
        modal.classList.add('active');
        // Preencher períodos
        var selPeriodo = document.getElementById('custoFixoPeriodo');
        selPeriodo.innerHTML = '';
        periodos.forEach(function(p) {
            selPeriodo.innerHTML += '<option value="' + p.id + '">' + getNomeMes(p.mes) + '/' + p.ano + '</option>';
        });
        // Preencher categorias
        var selCat = document.getElementById('custoFixoCategoria');
        selCat.innerHTML = '';
        categorias.forEach(function(c) {
            selCat.innerHTML += '<option value="' + c.id + '">' + c.nome + '</option>';
        });

        if (id) {
            var cf = custosFixos.find(function(x) { return x.id === id; });
            if (cf) {
                document.getElementById('custoFixoTituloTexto').innerText = 'Editar Custo Fixo';
                document.getElementById('custoFixoEditId').value = cf.id;
                document.getElementById('custoFixoPeriodo').value = cf.periodold || '';
                document.getElementById('custoFixoCategoria').value = cf.categoriald || '';
                document.getElementById('custoFixoNome').value = cf.nome || '';
                document.getElementById('custoFixoValor').value = cf.valor || 0;
            }
        } else {
            document.getElementById('custoFixoTituloTexto').innerText = 'Novo Custo Fixo';
            document.getElementById('custoFixoEditId').value = '';
            document.getElementById('custoFixoPeriodo').value = periodoAtual ? periodoAtual.id : '';
            document.getElementById('custoFixoCategoria').value = categorias[0] ? categorias[0].id : '';
            document.getElementById('custoFixoNome').value = '';
            document.getElementById('custoFixoValor').value = '';
        }
    };

    window.salvarCustoFixo = function() {
        var periodoId = document.getElementById('custoFixoPeriodo').value;
        var categoriaId = document.getElementById('custoFixoCategoria').value;
        var nome = document.getElementById('custoFixoNome').value.trim();
        var valor = parseFloat(document.getElementById('custoFixoValor').value);
        if (!periodoId) { alert('Selecione um período.'); return; }
        if (!categoriaId) { alert('Selecione uma categoria.'); return; }
        if (!nome) { alert('Digite o nome do custo fixo.'); return; }
        if (isNaN(valor) || valor <= 0) { alert('Digite um valor válido.'); return; }

        var editId = document.getElementById('custoFixoEditId').value;
        var cf = { periodold: periodoId, categoriald: categoriaId, nome: nome, valor: valor };
        if (editId) {
            cf.id = editId;
            var idx = custosFixos.findIndex(function(x) { return x.id === editId; });
            if (idx !== -1) custosFixos[idx] = Object.assign({}, custosFixos[idx], cf);
        } else {
            cf.id = 'cf_' + Date.now();
            custosFixos.push(cf);
        }
        salvarFB('custos_fixos', cf);
        saveLocalData();
        window.fecharModal('modalCustoFixo');
        renderizarTela();
    };

    window.editarCustoFixo = function(id) {
        window.abrirModalCustoFixo(id);
    };

    window.excluirCustoFixo = function(id) {
        if (!confirm('Excluir custo fixo?')) return;
        custosFixos = custosFixos.filter(function(c) { return c.id !== id; });
        excluirFB('custos_fixos', id);
        saveLocalData();
        renderizarTela();
    };

    // ======== CRUD ITENS DE CUSTO ========
    window.abrirModalItemCusto = function(id) {
        id = id || null;
        var modal = document.getElementById('modalItemCusto');
        modal.classList.add('active');
        var tipo = 'normal';
        if (id) {
            var item = itensCusto.find(function(i) { return i.id === id; });
            if (item) tipo = item.tipo || 'normal';
        }
        window.mudarTipoItem(tipo);

        // Preencher categorias
        var selCat = document.getElementById('itemCategoria');
        selCat.innerHTML = '';
        categorias.forEach(function(c) {
            selCat.innerHTML += '<option value="' + c.id + '">' + c.nome + '</option>';
        });

        if (id) {
            var item = itensCusto.find(function(i) { return i.id === id; });
            if (item) {
                document.getElementById('modalItemTitulo').innerText = 'Editar Item';
                document.getElementById('itemEditId').value = item.id;
                document.getElementById('itemTipo').value = item.tipo || 'normal';
                document.getElementById('itemCategoria').value = item.categoriald || '';
                document.getElementById('itemNome').value = item.nome || '';
                document.getElementById('itemValorTotal').value = item.valorTotal || 0;
                document.getElementById('itemPercentual').value = item.percentual || 100;
                document.getElementById('itemObs').value = item.obs || '';
                if (item.tipo === 'fixo' && item.custoFixold) {
                    custoFixoSelecionadoId = item.custoFixold;
                    var cf = custosFixos.find(function(c) { return c.id === item.custoFixold; });
                    if (cf) {
                        document.getElementById('itemFixoNomeDisplay').value = cf.nome;
                        document.getElementById('itemFixoValorDisplay').value = formatMoney(cf.valor);
                        document.getElementById('itemFixoPercentual').value = item.percentual || 100;
                    }
                }
                window.mudarTipoItem(item.tipo || 'normal');
            }
        } else {
            document.getElementById('modalItemTitulo').innerText = 'Novo Item';
            document.getElementById('itemEditId').value = '';
            document.getElementById('itemTipo').value = 'normal';
            document.getElementById('itemCategoria').value = categorias[0] ? categorias[0].id : '';
            document.getElementById('itemNome').value = '';
            document.getElementById('itemValorTotal').value = '';
            document.getElementById('itemPercentual').value = 100;
            document.getElementById('itemObs').value = '';
            document.getElementById('itemFixoNomeDisplay').value = '';
            document.getElementById('itemFixoValorDisplay').value = '';
            document.getElementById('itemFixoPercentual').value = 100;
            custoFixoSelecionadoId = null;
            window.mudarTipoItem('normal');
        }
        // Atualizar lista de custos fixos
        atualizarListaCustosFixos();
    };

    function atualizarListaCustosFixos() {
        var container = document.getElementById('custosFixosSelect');
        if (!container) return;
        var fixos = getCustosFixosDoPeriodo(periodoAtual ? periodoAtual.id : null);
        container.innerHTML = '';
        fixos.forEach(function(cf) {
            var sel = custoFixoSelecionadoId === cf.id ? 'selected' : '';
            container.innerHTML += '<div class="fixo-item ' + sel + '" onclick="window.selecionarCustoFixo(\'' + cf.id + '\')"><span><strong>' + cf.nome + '</strong> - ' + formatMoney(cf.valor) + '</span></div>';
        });
        if (fixos.length === 0) {
            container.innerHTML = '<p style="opacity:0.7;padding:0.5rem;">Nenhum custo fixo cadastrado neste período.</p>';
        }
    }

    window.selecionarCustoFixo = function(id) {
        custoFixoSelecionadoId = id;
        var cf = custosFixos.find(function(c) { return c.id === id; });
        if (cf) {
            document.getElementById('itemFixoNomeDisplay').value = cf.nome;
            document.getElementById('itemFixoValorDisplay').value = formatMoney(cf.valor);
        }
        atualizarListaCustosFixos();
    };

    window.mudarTipoItem = function(tipo) {
        document.getElementById('itemTipo').value = tipo;
        document.getElementById('areaItemNormal').style.display = tipo === 'normal' ? 'block' : 'none';
        document.getElementById('areaItensFixos').style.display = tipo === 'fixo' ? 'block' : 'none';
        document.getElementById('areaItemFixoDetalhe').style.display = tipo === 'fixo' ? 'block' : 'none';
        document.getElementById('tabNormal').classList.toggle('active', tipo === 'normal');
        document.getElementById('tabFixo').classList.toggle('active', tipo === 'fixo');
    };

    window.salvarItemCusto = function() {
        var tipo = document.getElementById('itemTipo').value;
        var editId = document.getElementById('itemEditId').value;
        var item = {
            setorld: setorAtual ? setorAtual.id : null,
            nome: document.getElementById('itemNome').value.trim(),
            obs: document.getElementById('itemObs').value.trim() || '',
            tipo: tipo
        };

        if (tipo === 'normal') {
            item.categoriald = document.getElementById('itemCategoria').value;
            item.valorTotal = parseFloat(document.getElementById('itemValorTotal').value) || 0;
            item.percentual = parseFloat(document.getElementById('itemPercentual').value) || 100;
            item.custoFixold = null;
        } else {
            if (!custoFixoSelecionadoId) {
                alert('Selecione um custo fixo.');
                return;
            }
            var cf = custosFixos.find(function(c) { return c.id === custoFixoSelecionadoId; });
            if (!cf) { alert('Custo fixo não encontrado.'); return; }
            item.categoriald = cf.categoriald;
            item.valorTotal = cf.valor;
            item.percentual = parseFloat(document.getElementById('itemFixoPercentual').value) || 100;
            item.custoFixold = custoFixoSelecionadoId;
            item.nome = cf.nome;
        }

        if (!item.setorld) { alert('Selecione um setor primeiro.'); return; }
        if (!item.nome) { alert('Digite o nome do item.'); return; }
        if (item.valorTotal <= 0) { alert('Valor total deve ser maior que zero.'); return; }

        if (editId) {
            item.id = editId;
            var idx = itensCusto.findIndex(function(x) { return x.id === editId; });
            if (idx !== -1) itensCusto[idx] = Object.assign({}, itensCusto[idx], item);
        } else {
            item.id = 'item_' + Date.now();
            itensCusto.push(item);
        }
        salvarFB('custos_itens', item);
        saveLocalData();
        window.fecharModal('modalItemCusto');
        renderizarTela();
    };

    window.editarItemCusto = function(id) {
        window.abrirModalItemCusto(id);
    };

    window.excluirItemCusto = function(id) {
        if (!confirm('Excluir item?')) return;
        itensCusto = itensCusto.filter(function(i) { return i.id !== id; });
        excluirFB('custos_itens', id);
        saveLocalData();
        renderizarTela();
    };

    // ======== CRUD PRODUÇÃO ========
    window.abrirModalProducao = function() {
        if (!setorAtual) { alert('Selecione um setor primeiro.'); return; }
        document.getElementById('modalProducao').classList.add('active');
        document.getElementById('producaoProduto').value = '';
        document.getElementById('producaoKg').value = '';
        document.getElementById('producaoData').value = new Date().toISOString().split('T')[0];
    };

    window.salvarProducao = function() {
        if (!setorAtual) { alert('Selecione um setor.'); return; }
        var produto = document.getElementById('producaoProduto').value.trim();
        var kg = parseFloat(document.getElementById('producaoKg').value);
        var data = document.getElementById('producaoData').value;
        if (!produto) { alert('Digite o produto.'); return; }
        if (!kg || kg <= 0) { alert('Digite uma quantidade válida.'); return; }
        var p = {
            setorld: setorAtual.id,
            produto: produto,
            kg: kg,
            data: data,
            id: 'prod_' + Date.now()
        };
        producoes.push(p);
        salvarFB('custos_producoes', p);
        saveLocalData();
        window.fecharModal('modalProducao');
        renderizarTela();
    };

    window.excluirProducao = function(id) {
        if (!confirm('Excluir produção?')) return;
        producoes = producoes.filter(function(p) { return p.id !== id; });
        excluirFB('custos_producoes', id);
        saveLocalData();
        renderizarTela();
    };

    // ======== CRUD MATERIAL ========
    window.abrirModalMaterial = function(id) {
        id = id || null;
        var modal = document.getElementById('modalMaterial');
        modal.classList.add('active');
        if (id) {
            var m = materiais.find(function(x) { return x.id === id; });
            if (m) {
                document.getElementById('modalMaterialTitulo').innerHTML = '<i class="fas fa-edit"></i> Editar Material';
                document.getElementById('materialEditId').value = m.id;
                document.getElementById('materialNome').value = m.nome;
                document.getElementById('materialDescricao').value = m.descricao || '';
            }
        } else {
            document.getElementById('modalMaterialTitulo').innerHTML = '<i class="fas fa-box"></i> Novo Material';
            document.getElementById('materialEditId').value = '';
            document.getElementById('materialNome').value = '';
            document.getElementById('materialDescricao').value = '';
        }
    };

    window.salvarMaterial = function() {
        var nome = document.getElementById('materialNome').value.trim();
        if (!nome) { alert('Digite o nome do material.'); return; }
        var m = {
            nome: nome,
            descricao: document.getElementById('materialDescricao').value.trim() || ''
        };
        var editId = document.getElementById('materialEditId').value;
        if (editId) {
            m.id = editId;
            var idx = materiais.findIndex(function(x) { return x.id === editId; });
            if (idx !== -1) materiais[idx] = Object.assign({}, materiais[idx], m);
        } else {
            m.id = 'mat_' + Date.now();
            materiais.push(m);
        }
        salvarFB('custos_materiais', m);
        saveLocalData();
        window.fecharModal('modalMaterial');
        renderizarTela();
    };

    window.editarMaterial = function(id) {
        window.abrirModalMaterial(id);
    };

    window.excluirMaterial = function(id) {
        if (!confirm('Excluir material?')) return;
        materiais = materiais.filter(function(m) { return m.id !== id; });
        excluirFB('custos_materiais', id);
        saveLocalData();
        renderizarTela();
    };

    window.verHistoricoMaterial = function(id) {
        alert('Histórico do material em desenvolvimento.');
    };

    // ======== GERAR CUSTO MATERIAL ========
    window.abrirGerarCustoMaterial = function() {
        var modal = document.getElementById('modalGerarCusto');
        modal.classList.add('active');
        var selPeriodo = document.getElementById('gerarCustoPeriodo');
        selPeriodo.innerHTML = '';
        periodos.forEach(function(p) {
            selPeriodo.innerHTML += '<option value="' + p.id + '">' + getNomeMes(p.mes) + '/' + p.ano + '</option>';
        });
        var selMat = document.getElementById('gerarCustoMaterial');
        selMat.innerHTML = '';
        materiais.forEach(function(m) {
            selMat.innerHTML += '<option value="' + m.id + '">' + m.nome + '</option>';
        });
        document.getElementById('insumosContainer').innerHTML =
            '<div class="insumo-row"><input type="text" class="insumo-nome" placeholder="Nome do insumo"><input type="number" class="insumo-custo" step="0.01" placeholder="R$/kg"><button class="btn btn-danger btn-xs" onclick="this.parentElement.remove();window.atualizarResumoGerarCusto();"><i class="fas fa-times"></i></button></div>';
        document.getElementById('gerarCustoImposto').value = 0;
        document.getElementById('gerarCustoMargem').value = 0;
        document.getElementById('gerarCustoValorAtual').value = 0;
        document.getElementById('resumoLinhas').innerHTML = '<p style="opacity:0.7;text-align:center;">Selecione os setores para calcular</p>';
        setoresSelecionadosGerar = new Map();
        window.atualizarSetoresGerarCusto();
    };

    window.atualizarSetoresGerarCusto = function() {
        var periodoId = document.getElementById('gerarCustoPeriodo').value;
        var container = document.getElementById('setoresGerarCusto');
        if (!periodoId) {
            container.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:1rem;">Selecione um período primeiro</p>';
            return;
        }
        var sets = setores.filter(function(s) { return s.periodold === periodoId; });
        container.innerHTML = '';
        sets.forEach(function(s) {
            container.innerHTML += '<label style="display:block;padding:0.25rem 0;"><input type="checkbox" value="' + s.id + '" onchange="window.toggleSetorGerarCusto(\'' + s.id + '\', this.checked)"> ' + s.nome + (s.produtoFinal ? ' ⭐' : '') + '</label>';
        });
        if (sets.length === 0) {
            container.innerHTML = '<p style="opacity:0.7;padding:1rem;">Nenhum setor neste período.</p>';
        }
    };

    window.toggleSetorGerarCusto = function(setorId, checked) {
        if (checked) setoresSelecionadosGerar.set(setorId, true);
        else setoresSelecionadosGerar.delete(setorId);
        window.atualizarResumoGerarCusto();
    };

    window.atualizarResumoGerarCusto = function() {
        var container = document.getElementById('resumoLinhas');
        var setorIds = Array.from(setoresSelecionadosGerar.keys());
        if (setorIds.length === 0) {
            container.innerHTML = '<p style="opacity:0.7;text-align:center;">Selecione os setores para calcular</p>';
            return;
        }
        var custoTotal = 0,
            producaoTotal = 0;
        setorIds.forEach(function(id) {
            var custos = calcularCustosSetor(id);
            custoTotal += custos.totalCusto;
            producaoTotal += custos.totalKg;
        });
        var custoKg = producaoTotal > 0 ? custoTotal / producaoTotal : 0;

        var custoInsumos = 0;
        document.querySelectorAll('.insumo-row').forEach(function(row) {
            custoInsumos += parseFloat(row.querySelector('.insumo-custo').value) || 0;
        });

        var imposto = parseFloat(document.getElementById('gerarCustoImposto').value) || 0;
        var margem = parseFloat(document.getElementById('gerarCustoMargem').value) || 0;
        var valorAtual = parseFloat(document.getElementById('gerarCustoValorAtual').value) || 0;

        var custoFinal = custoKg + custoInsumos;
        var precoSugerido = custoFinal * (1 + imposto / 100) * (1 + margem / 100);

        container.innerHTML =
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-top:0.5rem;">' +
            '<div><strong>Custo dos Setores:</strong> ' + formatMoney(custoKg) + '/kg</div>' +
            '<div><strong>Insumos Adicionais:</strong> ' + formatMoney(custoInsumos) + '/kg</div>' +
            '<div><strong>Custo Final:</strong> ' + formatMoney(custoFinal) + '/kg</div>' +
            '<div><strong>Imposto (' + imposto + '%):</strong> ' + formatMoney(custoFinal * imposto / 100) + '/kg</div>' +
            '<div><strong>Margem (' + margem + '%):</strong> ' + formatMoney(custoFinal * (1 + imposto / 100) * margem / 100) + '/kg</div>' +
            '<div><strong>Preço Sugerido:</strong> ' + formatMoney(precoSugerido) + '/kg</div>' +
            (valorAtual > 0 ? '<div><strong>Valor Atual:</strong> ' + formatMoney(valorAtual) + '/kg</div><div><strong>Diferença:</strong> ' + formatMoney(precoSugerido - valorAtual) + '/kg</div>' : '') +
            '</div>';
    };

    window.adicionarInsumo = function() {
        var container = document.getElementById('insumosContainer');
        var div = document.createElement('div');
        div.className = 'insumo-row';
        div.innerHTML = '<input type="text" class="insumo-nome" placeholder="Nome do insumo"><input type="number" class="insumo-custo" step="0.01" placeholder="R$/kg"><button class="btn btn-danger btn-xs" onclick="this.parentElement.remove();window.atualizarResumoGerarCusto();"><i class="fas fa-times"></i></button>';
        container.appendChild(div);
    };

    window.salvarCustoMaterial = function() {
        var periodoId = document.getElementById('gerarCustoPeriodo').value;
        var materialId = document.getElementById('gerarCustoMaterial').value;
        if (!periodoId || !materialId) {
            alert('Selecione período e material.');
            return;
        }
        var setorIds = Array.from(setoresSelecionadosGerar.keys());
        if (setorIds.length === 0) {
            alert('Selecione pelo menos um setor.');
            return;
        }
        var custoTotal = 0,
            producaoTotal = 0;
        setorIds.forEach(function(id) {
            var custos = calcularCustosSetor(id);
            custoTotal += custos.totalCusto;
            producaoTotal += custos.totalKg;
        });
        var custoKg = producaoTotal > 0 ? custoTotal / producaoTotal : 0;
        var custoInsumos = 0;
        document.querySelectorAll('.insumo-row').forEach(function(row) {
            custoInsumos += parseFloat(row.querySelector('.insumo-custo').value) || 0;
        });
        var imposto = parseFloat(document.getElementById('gerarCustoImposto').value) || 0;
        var margem = parseFloat(document.getElementById('gerarCustoMargem').value) || 0;
        var valorAtual = parseFloat(document.getElementById('gerarCustoValorAtual').value) || 0;
        var custoFinal = custoKg + custoInsumos;
        var precoSugerido = custoFinal * (1 + imposto / 100) * (1 + margem / 100);

        var registro = {
            id: 'cm_' + Date.now(),
            materialld: materialId,
            periodold: periodoId,
            mes: periodos.find(function(p) { return p.id === periodoId; })?.mes || 0,
            ano: periodos.find(function(p) { return p.id === periodoId; })?.ano || 0,
            custoKgFinal: custoFinal,
            subtotal: custoKg,
            imposto: imposto,
            valorImposto: custoFinal * imposto / 100,
            margem: margem,
            precoSugerido: precoSugerido,
            valorAtual: valorAtual,
            setoresDetalhes: setorIds.map(function(id) {
                var s = setores.find(function(x) { return x.id === id; });
                return { id: id, nome: s ? s.nome : '', custo: calcularCustosSetor(id).totalCusto, producao: calcularCustosSetor(id).totalKg };
            }),
            insumos: [],
            setoresUtilizados: setorIds
        };
        document.querySelectorAll('.insumo-row').forEach(function(row) {
            var nome = row.querySelector('.insumo-nome').value.trim();
            var custo = parseFloat(row.querySelector('.insumo-custo').value) || 0;
            if (nome) registro.insumos.push({ nome: nome, custo: custo });
        });

        custosMateriais.push(registro);
        salvarFB('custos_materiais_custos', registro);
        saveLocalData();
        alert('Custo de material salvo com sucesso!');
        window.fecharModal('modalGerarCusto');
        renderizarTela();
    };

    window.gerarPDFCustoMaterial = function() {
        alert('Função PDF em desenvolvimento.');
    };

    // ======== GRÁFICOS ========
    window.abrirGraficoMensal = function(periodoId) {
        var modal = document.getElementById('modalGraficoMensal');
        modal.classList.add('active');
        var per = periodos.find(function(p) { return p.id === periodoId; });
        if (!per) return;
        document.getElementById('graficoMensalTitulo').innerText = getNomeMes(per.mes) + '/' + per.ano;

        var sets = getSetoresDoPeriodo(periodoId);
        var cats = categorias.map(function(c) { return Object.assign({}, c, { total: 0 }); });
        sets.forEach(function(s) {
            var itens = itensCusto.filter(function(i) { return i.setorld === s.id; });
            itens.forEach(function(i) {
                var cat = cats.find(function(c) { return c.id === i.categoriald; });
                if (cat) cat.total += i.valorTotal * (i.percentual || 100) / 100;
            });
        });

        var labels = cats.map(function(c) { return c.nome; });
        var values = cats.map(function(c) { return c.total; });
        var colors = cats.map(function(c) { return c.cor; });

        if (graficoMensalChart) graficoMensalChart.destroy();
        var ctx = document.getElementById('graficoMensalCanvas').getContext('2d');
        graficoMensalChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Custo por Categoria',
                    data: values,
                    backgroundColor: colors,
                    borderColor: colors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: function(context) { return formatMoney(context.raw); } } }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { callback: function(value) { return formatMoney(value); } } }
                }
            }
        });

        var total = values.reduce(function(a, b) { return a + b; }, 0);
        var resumoHtml = '<div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:1rem;">';
        cats.forEach(function(c) {
            resumoHtml += '<span style="background:' + c.cor + ';color:white;padding:0.2rem 0.6rem;border-radius:12px;">' + c.nome + ': ' + formatMoney(c.total) + '</span>';
        });
        resumoHtml += '<span><strong>Total: ' + formatMoney(total) + '</strong></span></div>';
        document.getElementById('graficoMensalResumo').innerHTML = resumoHtml;
    };

    window.abrirGraficoConsolidado = function() {
        if (periodosSelecionadosResumo.size === 0) {
            alert('Selecione pelo menos um período para consolidar.');
            return;
        }
        var modal = document.getElementById('modalGraficoConsolidado');
        modal.classList.add('active');

        var tagsHtml = '';
        periodosSelecionadosResumo.forEach(function(pid) {
            var per = periodos.find(function(p) { return p.id === pid; });
            if (per) tagsHtml += '<span class="periodo-tag">' + getNomeMes(per.mes) + '/' + per.ano + '</span>';
        });
        document.getElementById('graficoConsolidadoTags').innerHTML = tagsHtml;

        var cats = categorias.map(function(c) { return Object.assign({}, c, { total: 0 }); });
        periodosSelecionadosResumo.forEach(function(pid) {
            var sets = getSetoresDoPeriodo(pid);
            sets.forEach(function(s) {
                var itens = itensCusto.filter(function(i) { return i.setorld === s.id; });
                itens.forEach(function(i) {
                    var cat = cats.find(function(c) { return c.id === i.categoriald; });
                    if (cat) cat.total += i.valorTotal * (i.percentual || 100) / 100;
                });
            });
        });

        var labels = cats.map(function(c) { return c.nome; });
        var values = cats.map(function(c) { return c.total; });
        var colors = cats.map(function(c) { return c.cor; });

        if (graficoConsolidadoChart) graficoConsolidadoChart.destroy();
        var ctx = document.getElementById('graficoConsolidadoCanvas').getContext('2d');
        graficoConsolidadoChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Custo por Categoria (Consolidado)',
                    data: values,
                    backgroundColor: colors,
                    borderColor: colors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: function(context) { return formatMoney(context.raw); } } }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { callback: function(value) { return formatMoney(value); } } }
                }
            }
        });
    };

    window.exportarGraficoMensal = function() {
        alert('Exportar gráfico mensal (em desenvolvimento)');
    };
    window.exportarGraficoConsolidado = function() {
        alert('Exportar gráfico consolidado (em desenvolvimento)');
    };
    window.ajustarGrafico = function(tipo, tamanho) {
        var container = document.getElementById(tipo === 'mensal' ? 'graficoMensalContainer' : 'graficoConsolidadoContainer');
        var info = document.getElementById(tipo === 'mensal' ? 'graficoMensalTamanho' : 'graficoConsolidadoTamanho');
        var alturas = { pequeno: 300, medio: 500, grande: 700 };
        if (container) container.style.height = alturas[tamanho] + 'px';
        if (info) info.innerText = alturas[tamanho] + 'px';
    };

    // ======== CONFIGURAÇÕES ========
    window.abrirConfigCampos = function() {
        var modal = document.getElementById('modalConfigCampos');
        modal.classList.add('active');
        var container = document.getElementById('listaConfigCampos');
        var html = '';
        Object.keys(configCampos).forEach(function(key) {
            html += '<div style="display:flex;gap:0.5rem;align-items:center;margin:0.5rem 0;">';
            html += '<label style="min-width:120px;font-weight:500;">' + key + ':</label>';
            html += '<input type="text" id="cfg_' + key + '" value="' + configCampos[key] + '" style="flex:1;">';
            html += '</div>';
        });
        container.innerHTML = html;
    };

    window.salvarConfigCampos = function() {
        Object.keys(configCampos).forEach(function(key) {
            var val = document.getElementById('cfg_' + key) ? document.getElementById('cfg_' + key).value : null;
            if (val) configCampos[key] = val;
        });
        localStorage.setItem(CONFIG_KEY, JSON.stringify(configCampos));
        window.fecharModal('modalConfigCampos');
        renderizarTela();
    };

    // ======== FILTROS E RESUMO ========
    window.mudarFiltroAno = function(v) {
        filtroAnoAtual = v;
        renderizarTela();
    };

    window.togglePeriodoResumo = function(pid, checked) {
        if (checked) periodosSelecionadosResumo.add(pid);
        else periodosSelecionadosResumo.delete(pid);
        renderizarTela();
    };

    window.removePeriodoResumo = function(pid) {
        periodosSelecionadosResumo.delete(pid);
        renderizarTela();
    };

    window.limparSelecaoResumo = function() {
        periodosSelecionadosResumo.clear();
        renderizarTela();
    };

    window.toggleSetorResumo = function(sid, checked) {
        if (checked) setoresExcluidosResumo.delete(sid);
        else setoresExcluidosResumo.add(sid);
        renderizarTela();
    };

    window.limparSetoresExcluidos = function() {
        setoresExcluidosResumo.clear();
        renderizarTela();
    };

    // ======== COPIAR PERÍODO ========
    window.abrirCopiarPeriodo = function(id) {
        var p = periodos.find(function(x) { return x.id === id; });
        if (!p) return;
        periodoOrigemCopia = p;
        document.getElementById('copiarOrigem').value = getNomeMes(p.mes) + '/' + p.ano;
        document.getElementById('modalCopiarPeriodo').classList.add('active');
    };

    window.copiarPeriodo = function() {
        if (!periodoOrigemCopia) return;
        var novoMes = parseInt(document.getElementById('copiarMes').value);
        var novoAno = parseInt(document.getElementById('copiarAno').value);
        if (!novoMes || !novoAno) { alert('Selecione mês e ano válidos.'); return; }

        var novoPeriodo = {
            id: 'per_' + Date.now(),
            mes: novoMes,
            ano: novoAno,
            obs: 'Cópia de ' + getNomeMes(periodoOrigemCopia.mes) + '/' + periodoOrigemCopia.ano,
            createdAt: new Date().toISOString()
        };
        periodos.push(novoPeriodo);

        var setoresOrigem = setores.filter(function(s) { return s.periodold === periodoOrigemCopia.id; });
        var mapaSetores = {};
        setoresOrigem.forEach(function(s) {
            var novo = Object.assign({}, s);
            novo.id = 'set_' + Date.now() + Math.random().toString(36).substr(2, 4);
            novo.periodold = novoPeriodo.id;
            delete novo._id;
            setores.push(novo);
            mapaSetores[s.id] = novo.id;
        });

        setoresOrigem.forEach(function(s) {
            var itensOrigem = itensCusto.filter(function(i) { return i.setorld === s.id; });
            itensOrigem.forEach(function(i) {
                var novo = Object.assign({}, i);
                novo.id = 'item_' + Date.now() + Math.random().toString(36).substr(2, 4);
                novo.setorld = mapaSetores[s.id];
                delete novo._id;
                itensCusto.push(novo);
            });
        });

        setoresOrigem.forEach(function(s) {
            var prodsOrigem = producoes.filter(function(p) { return p.setorld === s.id; });
            prodsOrigem.forEach(function(p) {
                var novo = Object.assign({}, p);
                novo.id = 'prod_' + Date.now() + Math.random().toString(36).substr(2, 4);
                novo.setorld = mapaSetores[s.id];
                delete novo._id;
                producoes.push(novo);
            });
        });

        var fixosOrigem = custosFixos.filter(function(cf) { return cf.periodold === periodoOrigemCopia.id; });
        fixosOrigem.forEach(function(cf) {
            var novo = Object.assign({}, cf);
            novo.id = 'cf_' + Date.now() + Math.random().toString(36).substr(2, 4);
            novo.periodold = novoPeriodo.id;
            delete novo._id;
            custosFixos.push(novo);
        });

        saveLocalData();
        window.fecharModal('modalCopiarPeriodo');
        periodoOrigemCopia = null;
        renderizarTela();
    };

    // ======== STATUS FIREBASE ========
    function atualizarStatusFirebase() {
        var statusEl = document.getElementById('firebaseStatus');
        if (!statusEl) return;
        if (usandoFirebase && db) {
            statusEl.innerHTML = '<span class="status-dot"></span> Firebase';
            statusEl.className = 'firebase-status status-firebase';
        } else {
            statusEl.innerHTML = '<span class="status-dot"></span> Local';
            statusEl.className = 'firebase-status status-local';
        }
    }

    // ======== FECHAR MODAL (CORRIGIDO) ========
    window.fecharModal = function(id) {
        var modal = document.getElementById(id);
        if (modal) modal.classList.remove('active');
        if (id === 'modalGraficoMensal' && graficoMensalChart) {
            graficoMensalChart.destroy();
            graficoMensalChart = null;
        }
        if (id === 'modalGraficoConsolidado' && graficoConsolidadoChart) {
            graficoConsolidadoChart.destroy();
            graficoConsolidadoChart = null;
        }
    };

    // Fechar modal APENAS ao clicar no overlay (fundo escuro) - NÃO ao passar o mouse
    document.addEventListener('click', function(e) {
        // Verifica se o clique foi diretamente no overlay (e não em um filho)
        if (e.target.classList.contains('modal-overlay')) {
            // Fecha apenas se o overlay estiver visível (active)
            if (e.target.classList.contains('active')) {
                e.target.classList.remove('active');
                // Limpa gráficos se houver
                if (e.target.id === 'modalGraficoMensal' && graficoMensalChart) {
                    graficoMensalChart.destroy();
                    graficoMensalChart = null;
                }
                if (e.target.id === 'modalGraficoConsolidado' && graficoConsolidadoChart) {
                    graficoConsolidadoChart.destroy();
                    graficoConsolidadoChart = null;
                }
            }
        }
    });

    // Fechar com tecla ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            var modals = document.querySelectorAll('.modal-overlay.active');
            modals.forEach(function(modal) {
                modal.classList.remove('active');
                // Limpa gráficos se houver
                if (modal.id === 'modalGraficoMensal' && graficoMensalChart) {
                    graficoMensalChart.destroy();
                    graficoMensalChart = null;
                }
                if (modal.id === 'modalGraficoConsolidado' && graficoConsolidadoChart) {
                    graficoConsolidadoChart.destroy();
                    graficoConsolidadoChart = null;
                }
            });
        }
    });

    // ======== INICIALIZAÇÃO ========
    function init() {
        atualizarStatusFirebase();
        renderizarTela();
        document.getElementById('loadingOverlay').classList.remove('active');
    }

    // Aguardar Firebase estar pronto
    if (window.firebaseDB) {
        db = window.firebaseDB;
        usandoFirebase = true;
        // Carregar dados (via SyncSystem ou Firebase)
        loadLocalData();
        // Iniciar após carregar
        setTimeout(function() {
            init();
        }, 500);
    } else {
        // Tentar novamente
        var tentativas = 0;
        var check = setInterval(function() {
            tentativas++;
            if (window.firebaseDB) {
                db = window.firebaseDB;
                usandoFirebase = true;
                clearInterval(check);
                loadLocalData();
                setTimeout(function() {
                    init();
                }, 500);
            } else if (tentativas > 30) {
                clearInterval(check);
                loadLocalData();
                init();
            }
        }, 200);
    }

    // Expor funções globais que podem faltar
    window.mudarFiltroAno = function(v) { filtroAnoAtual = v;
        renderizarTela(); };
    window.togglePeriodoResumo = function(pid, checked) { if (checked) periodosSelecionadosResumo.add(pid);
        else periodosSelecionadosResumo.delete(pid);
        renderizarTela(); };
    window.removePeriodoResumo = function(pid) { periodosSelecionadosResumo.delete(pid);
        renderizarTela(); };
    window.limparSelecaoResumo = function() { periodosSelecionadosResumo.clear();
        renderizarTela(); };
    window.toggleSetorResumo = function(sid, checked) { if (checked) setoresExcluidosResumo.delete(sid);
        else setoresExcluidosResumo.add(sid);
        renderizarTela(); };
    window.limparSetoresExcluidos = function() { setoresExcluidosResumo.clear();
        renderizarTela(); };

})();
