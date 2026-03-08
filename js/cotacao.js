// Sistema Completo de Cotações com Histórico e PDF

// Aguardar o carregamento completo da página
document.addEventListener('DOMContentLoaded', function() {
    // Aguardar um pouco para garantir que os componentes foram carregados
    setTimeout(initializeCotacaoSystem, 100);
});

function initializeCotacaoSystem() {
    // Sistema de persistência
    const STORAGE_KEY = 'milplasticos_cotacoes';
    const PRODUTOS_KEY = 'milplasticos_produtos';
    const HISTORICO_KEY = 'milplasticos_historico';
    
    // Carregar dados do localStorage
    let cotacoes = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [
        {
            id: 1,
            produto: "GotaLube Sp",
            produtoId: 1,
            fornecedor: "LMJ Plásticos",
            uf: "SP",
            quantidade: 500,
            unidade: "kg",
            valorUnitario: 17.00,
            icms: 18,
            ipi: 0,
            prazoPagamento: "28 ddl",
            regimeTributario: "Lucro Presumido",
            ncm: "15161000",
            observacoes: "Avista Mil Plasticos",
            valorBruto: 8500.00,
            valorIcms: 1530.00,
            valorIpi: 0.00,
            valorTotal: 8500.00,
            dataCotacao: new Date().toISOString().split('T')[0],
            status: "ativo",
            salvarHistorico: true
        },
        {
            id: 2,
            produto: "GotaLube Sp",
            produtoId: 1,
            fornecedor: "PlastTotal",
            uf: "RJ",
            quantidade: 500,
            unidade: "kg",
            valorUnitario: 18.40,
            icms: 17,
            ipi: 5,
            prazoPagamento: "45 ddl",
            regimeTributario: "Lucro Real",
            ncm: "15161000",
            observacoes: "Com frete incluso",
            valorBruto: 9200.00,
            valorIcms: 1564.00,
            valorIpi: 460.00,
            valorTotal: 9660.00,
            dataCotacao: new Date().toISOString().split('T')[0],
            status: "ativo",
            salvarHistorico: true
        },
        {
            id: 3,
            produto: "GotaLube Sp",
            produtoId: 1,
            fornecedor: "QuímicaBras",
            uf: "MG",
            quantidade: 500,
            unidade: "kg",
            valorUnitario: 16.20,
            icms: 18,
            ipi: 0,
            prazoPagamento: "30 dias",
            regimeTributario: "Simples Nacional",
            ncm: "15161000",
            observacoes: "Preço especial para compra mínima",
            valorBruto: 8100.00,
            valorIcms: 1458.00,
            valorIpi: 0.00,
            valorTotal: 8100.00,
            dataCotacao: new Date().toISOString().split('T')[0],
            status: "ativo",
            salvarHistorico: true
        }
    ];
    
    let produtos = JSON.parse(localStorage.getItem(PRODUTOS_KEY)) || [
        {
            id: 1,
            nome: "GotaLube Sp",
            codigo: "GL-001",
            categoria: "Lubrificantes",
            descricao: "Lubrificante especial para plásticos",
            unidadePadrao: "kg",
            ncm: "15161000",
            dataCadastro: new Date().toISOString().split('T')[0],
            cotaçõesCount: 3
        },
        {
            id: 2,
            nome: "Sacaria Plástica",
            codigo: "SP-100",
            categoria: "Embalagens",
            descricao: "Sacos plásticos para embalagem",
            unidadePadrao: "un",
            ncm: "39232100",
            dataCadastro: new Date().toISOString().split('T')[0],
            cotaçõesCount: 0
        }
    ];
    
    let historico = JSON.parse(localStorage.getItem(HISTORICO_KEY)) || [];
    
    let editingId = null;
    let currentComparisonData = null;
    let currentProdutoId = null;
    
    // Elementos DOM
    const cotacoesContainer = document.getElementById('cotacoesContainer');
    const emptyState = document.getElementById('emptyState');
    const historicoContainer = document.getElementById('historicoContainer');
    const produtosContainer = document.getElementById('produtosContainer');
    const emptyProdutos = document.getElementById('emptyProdutos');
    
    // Modais
    const cotacaoModal = document.getElementById('cotacaoModal');
    const produtoModal = document.getElementById('produtoModal');
    const comparisonModal = document.getElementById('comparisonModal');
    const historicoProdutoModal = document.getElementById('historicoProdutoModal');
    
    // Botões
    const addCotacaoBtn = document.getElementById('addCotacaoBtn');
    const addProdutoBtn = document.getElementById('addProdutoBtn');
    const novoProdutoModalBtn = document.getElementById('novoProdutoModalBtn');
    const exportAllPdfBtn = document.getElementById('exportAllPdfBtn');
    const limparHistoricoBtn = document.getElementById('limparHistoricoBtn');
    const generatePdfBtn = document.getElementById('generatePdfBtn');
    const exportComparisonPdf = document.getElementById('exportComparisonPdf');
    const salvarComparacaoBtn = document.getElementById('salvarComparacaoBtn');
    const exportHistoricoPdfBtn = document.getElementById('exportHistoricoPdfBtn');
    
    // Fechar modais
    const closeModalBtn = document.getElementById('closeModal');
    const closeProdutoModal = document.getElementById('closeProdutoModal');
    const closeComparisonModal = document.getElementById('closeComparisonModal');
    const closeHistoricoModal = document.getElementById('closeHistoricoModal');
    
    // Cancelar
    const cancelBtn = document.getElementById('cancelBtn');
    const cancelProdutoBtn = document.getElementById('cancelProdutoBtn');
    const closeComparisonBtn = document.getElementById('closeComparisonBtn');
    const closeHistoricoBtn = document.getElementById('closeHistoricoBtn');
    
    // Salvar
    const saveCotacaoBtn = document.getElementById('saveCotacaoBtn');
    const saveProdutoBtn = document.getElementById('saveProdutoBtn');
    
    // Formulários
    const cotacaoForm = document.getElementById('cotacaoForm');
    const produtoForm = document.getElementById('produtoForm');
    const modalTitle = document.getElementById('modalTitle');
    
    // Filtros
    const filtroProduto = document.getElementById('filtroProduto');
    const filtroFornecedor = document.getElementById('filtroFornecedor');
    const filtroPeriodo = document.getElementById('filtroPeriodo');
    
    // Elementos para preview
    const valorBrutoPreview = document.getElementById('valorBrutoPreview');
    const icmsPercentPreview = document.getElementById('icmsPercentPreview');
    const icmsValuePreview = document.getElementById('icmsValuePreview');
    const ipiPercentPreview = document.getElementById('ipiPercentPreview');
    const ipiValuePreview = document.getElementById('ipiValuePreview');
    const valorTotalPreview = document.getElementById('valorTotalPreview');
    const produtoSelect = document.getElementById('produtoSelect');
    const dataCotacaoInput = document.getElementById('dataCotacao');
    
    // Elementos do formulário para cálculo
    const quantidadeInput = document.getElementById('quantidade');
    const valorUnitarioInput = document.getElementById('valorUnitario');
    const icmsInput = document.getElementById('icms');
    const ipiInput = document.getElementById('ipi');
    
    // Tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Verificar se todos os elementos existem
    if (!addCotacaoBtn) {
        console.error('Botão de adicionar cotação não encontrado!');
        return;
    }
    
    // Inicializar o sistema
    init();
    
    function init() {
        // Configurar data atual no formulário
        if (dataCotacaoInput) {
            const hoje = new Date().toISOString().split('T')[0];
            dataCotacaoInput.value = hoje;
            dataCotacaoInput.max = hoje;
        }
        
        // Carregar produtos no select
        loadProdutosSelect();
        
        // Renderizar tudo
        renderCotacoes();
        renderHistorico();
        renderProdutos();
        
        // Configurar eventos
        setupEventListeners();
        setupCalculations();
        setupTabs();
    }
    
    // Carregar produtos no select
    function loadProdutosSelect() {
        if (!produtoSelect) return;
        
        produtoSelect.innerHTML = '<option value="">Selecione um produto</option>';
        
        produtos.forEach(produto => {
            const option = document.createElement('option');
            option.value = produto.id;
            option.textContent = `${produto.nome} (${produto.codigo})`;
            option.dataset.unidade = produto.unidadePadrao;
            produtoSelect.appendChild(option);
        });
        
        // Quando selecionar um produto, preencher a unidade
        produtoSelect.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            const unidadeInput = document.getElementById('unidade');
            if (selectedOption.value && unidadeInput) {
                unidadeInput.value = selectedOption.dataset.unidade || '';
            }
        });
    }
    
    // Configurar cálculos em tempo real
    function setupCalculations() {
        const inputsCalculo = [quantidadeInput, valorUnitarioInput, icmsInput, ipiInput];
        
        inputsCalculo.forEach(input => {
            if (input) {
                input.addEventListener('input', updatePreview);
            }
        });
    }
    
    // Atualizar preview dos cálculos
    function updatePreview() {
        const quantidade = parseFloat(quantidadeInput.value) || 0;
        const valorUnitario = parseFloat(valorUnitarioInput.value) || 0;
        const icmsPercent = parseFloat(icmsInput.value) || 0;
        const ipiPercent = parseFloat(ipiInput.value) || 0;
        
        // Cálculos
        const valorBruto = quantidade * valorUnitario;
        const valorIcms = valorBruto * (icmsPercent / 100);
        const valorIpi = valorBruto * (ipiPercent / 100);
        const valorTotal = valorBruto + valorIpi;
        
        // Atualizar preview
        if (valorBrutoPreview) valorBrutoPreview.textContent = formatCurrency(valorBruto);
        if (icmsPercentPreview) icmsPercentPreview.textContent = icmsPercent;
        if (icmsValuePreview) icmsValuePreview.textContent = formatCurrency(valorIcms);
        if (ipiPercentPreview) ipiPercentPreview.textContent = ipiPercent;
        if (ipiValuePreview) ipiValuePreview.textContent = formatCurrency(valorIpi);
        if (valorTotalPreview) valorTotalPreview.textContent = formatCurrency(valorTotal);
    }
    
    // Configurar event listeners
    function setupEventListeners() {
        // Tabs
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;
                openTab(tabId);
            });
        });
        
        // Botões principais
        addCotacaoBtn.addEventListener('click', () => openModal());
        addProdutoBtn.addEventListener('click', () => openProdutoModal());
        if (novoProdutoModalBtn) {
            novoProdutoModalBtn.addEventListener('click', () => {
                closeModal();
                setTimeout(() => openProdutoModal(), 300);
            });
        }
        
        // Fechar modais
        closeModalBtn.addEventListener('click', () => closeModal());
        closeProdutoModal.addEventListener('click', () => closeProdutoModalFunc());
        closeComparisonModal.addEventListener('click', () => comparisonModal.style.display = 'none');
        closeHistoricoModal.addEventListener('click', () => historicoProdutoModal.style.display = 'none');
        
        // Cancelar
        cancelBtn.addEventListener('click', () => closeModal());
        cancelProdutoBtn.addEventListener('click', () => closeProdutoModalFunc());
        closeComparisonBtn.addEventListener('click', () => comparisonModal.style.display = 'none');
        closeHistoricoBtn.addEventListener('click', () => historicoProdutoModal.style.display = 'none');
        
        // Salvar
        saveCotacaoBtn.addEventListener('click', saveCotacao);
        saveProdutoBtn.addEventListener('click', saveProduto);
        
        // PDF e Exportação
        if (exportAllPdfBtn) exportAllPdfBtn.addEventListener('click', exportAllToPdf);
        if (generatePdfBtn) generatePdfBtn.addEventListener('click', generateComparisonPdf);
        if (exportComparisonPdf) exportComparisonPdf.addEventListener('click', generateComparisonPdf);
        if (salvarComparacaoBtn) salvarComparacaoBtn.addEventListener('click', salvarComparacaoNoHistorico);
        if (exportHistoricoPdfBtn) exportHistoricoPdfBtn.addEventListener('click', exportHistoricoPdf);
        if (limparHistoricoBtn) limparHistoricoBtn.addEventListener('click', limparHistorico);
        
        // Filtros
        if (filtroProduto) filtroProduto.addEventListener('input', renderHistorico);
        if (filtroFornecedor) filtroFornecedor.addEventListener('input', renderHistorico);
        if (filtroPeriodo) filtroPeriodo.addEventListener('change', renderHistorico);
        
        // Fechar modal ao clicar fora
        window.addEventListener('click', (event) => {
            if (event.target === cotacaoModal) closeModal();
            if (event.target === produtoModal) closeProdutoModalFunc();
            if (event.target === comparisonModal) comparisonModal.style.display = 'none';
            if (event.target === historicoProdutoModal) historicoProdutoModal.style.display = 'none';
        });
        
        // Fechar modal com ESC
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                if (cotacaoModal.style.display === 'flex') closeModal();
                if (produtoModal.style.display === 'flex') closeProdutoModalFunc();
                if (comparisonModal.style.display === 'flex') comparisonModal.style.display = 'none';
                if (historicoProdutoModal.style.display === 'flex') historicoProdutoModal.style.display = 'none';
            }
        });
    }
    
    // Configurar tabs
    function setupTabs() {
        tabBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const tabId = this.dataset.tab;
                
                // Remover active de todos
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                
                // Adicionar active ao selecionado
                this.classList.add('active');
                document.getElementById(`${tabId}Tab`).classList.add('active');
            });
        });
    }
    
    function openTab(tabId) {
        tabBtns.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        const tabBtn = document.querySelector(`[data-tab="${tabId}"]`);
        const tabContent = document.getElementById(`${tabId}Tab`);
        
        if (tabBtn) tabBtn.classList.add('active');
        if (tabContent) tabContent.classList.add('active');
        
        // Atualizar renderização se necessário
        if (tabId === 'historico') {
            renderHistorico();
        } else if (tabId === 'produtos') {
            renderProdutos();
        }
    }
    
    // Formatar moeda
    function formatCurrency(value) {
        if (isNaN(value)) value = 0;
        return 'R$ ' + value.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }
    
    // Formatar data
    function formatDate(dateString) {
        if (!dateString) return 'Sem data';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return 'Data inválida';
            return date.toLocaleDateString('pt-BR');
        } catch {
            return 'Data inválida';
        }
    }
    
    // Calcular dias de prazo
    function calcularDiasPrazo(prazoString) {
        if (!prazoString) return 0;
        
        // Extrair número do prazo
        const match = prazoString.match(/(\d+)/);
        return match ? parseInt(match[1]) : 0;
    }
    
    // SALVAR DADOS NO LOCALSTORAGE
    function saveToLocalStorage() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cotacoes));
        localStorage.setItem(PRODUTOS_KEY, JSON.stringify(produtos));
        localStorage.setItem(HISTORICO_KEY, JSON.stringify(historico));
    }
    
    // RENDERIZAR COTAÇÕES ATIVAS
    function renderCotacoes() {
        if (!cotacoesContainer || !emptyState) return;
        
        const cotacoesAtivas = cotacoes.filter(c => c.status === "ativo");
        
        if (cotacoesAtivas.length === 0) {
            emptyState.style.display = 'block';
            if (exportAllPdfBtn) exportAllPdfBtn.style.display = 'none';
            cotacoesContainer.innerHTML = '';
            return;
        }
        
        emptyState.style.display = 'none';
        if (exportAllPdfBtn) exportAllPdfBtn.style.display = 'flex';
        
        // Agrupar cotações por produto
        const produtosAgrupados = {};
        cotacoesAtivas.forEach(cotacao => {
            if (!produtosAgrupados[cotacao.produto]) {
                produtosAgrupados[cotacao.produto] = [];
            }
            produtosAgrupados[cotacao.produto].push(cotacao);
        });
        
        let html = '';
        
        // Para cada produto, exibir suas cotações
        Object.keys(produtosAgrupados).forEach(produto => {
            const cotsProduto = produtosAgrupados[produto];
            
            // Adicionar cabeçalho do produto
            html += `
                <div class="cotacao-item" style="background-color: #e8f4fc; font-weight: 600;">
                    <div>${produto}</div>
                    <div colspan="6" style="grid-column: span 6;">
                        ${cotsProduto.length} cotação(ões) disponível(is)
                        ${cotsProduto.length > 1 ? 
                            `<button class="btn-compare btn-action" onclick="openComparisonModalForProduct('${produto.replace(/'/g, "\\'")}')">
                                <i class="fas fa-balance-scale"></i> Comparar
                            </button>
                            <button class="btn-pdf btn-action" onclick="generatePdfForProduct('${produto.replace(/'/g, "\\'")}')">
                                <i class="fas fa-file-pdf"></i> PDF
                            </button>` : 
                            ''}
                        <button class="btn-history btn-action" onclick="verHistoricoProduto('${produto.replace(/'/g, "\\'")}')">
                            <i class="fas fa-history"></i> Histórico
                        </button>
                    </div>
                </div>
            `;
            
            // Adicionar cada cotação deste produto
            cotsProduto.forEach(cotacao => {
                html += `
                    <div class="cotacao-item" data-id="${cotacao.id}">
                        <div>
                            <strong>${cotacao.produto}</strong>
                            ${cotacao.observacoes ? `<br><small class="text-muted">${cotacao.observacoes}</small>` : ''}
                        </div>
                        <div>${cotacao.fornecedor}</div>
                        <div>${cotacao.uf}</div>
                        <div>${cotacao.quantidade} ${cotacao.unidade}</div>
                        <div>${formatCurrency(cotacao.valorUnitario)}</div>
                        <div>
                            <strong>${formatCurrency(cotacao.valorTotal)}</strong><br>
                            <small class="text-muted">ICMS: ${cotacao.icms}% | IPI: ${cotacao.ipi}%</small>
                        </div>
                        <div class="actions">
                            <button class="btn-action btn-edit" onclick="editCotacao(${cotacao.id})">
                                <i class="fas fa-edit"></i> Editar
                            </button>
                            <button class="btn-action btn-delete" onclick="deleteCotacao(${cotacao.id})">
                                <i class="fas fa-trash"></i> Excluir
                            </button>
                            <button class="btn-action btn-pdf" onclick="generateSinglePdf(${cotacao.id})" style="margin-top: 5px;">
                                <i class="fas fa-file-pdf"></i> PDF
                            </button>
                        </div>
                    </div>
                `;
            });
        });
        
        cotacoesContainer.innerHTML = html;
    }
    
    // RENDERIZAR HISTÓRICO
    function renderHistorico() {
        if (!historicoContainer) return;
        
        // Aplicar filtros
        let historicoFiltrado = [...historico];
        
        const filtroProdutoVal = filtroProduto ? filtroProduto.value.toLowerCase() : '';
        const filtroFornecedorVal = filtroFornecedor ? filtroFornecedor.value.toLowerCase() : '';
        const filtroPeriodoVal = filtroPeriodo ? filtroPeriodo.value : 'todos';
        
        if (filtroProdutoVal) {
            historicoFiltrado = historicoFiltrado.filter(item => 
                item.produto && item.produto.toLowerCase().includes(filtroProdutoVal)
            );
        }
        
        if (filtroFornecedorVal) {
            historicoFiltrado = historicoFiltrado.filter(item => 
                item.cotacoes && item.cotacoes.some(c => c.fornecedor && c.fornecedor.toLowerCase().includes(filtroFornecedorVal))
            );
        }
        
        if (filtroPeriodoVal !== 'todos') {
            const dias = parseInt(filtroPeriodoVal);
            const dataLimite = new Date();
            dataLimite.setDate(dataLimite.getDate() - dias);
            
            historicoFiltrado = historicoFiltrado.filter(item => {
                try {
                    const dataItem = new Date(item.data);
                    return dataItem >= dataLimite;
                } catch {
                    return false;
                }
            });
        }
        
        if (historicoFiltrado.length === 0) {
            historicoContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <h3>Nenhum histórico encontrado</h3>
                    <p>${historico.length === 0 ? 
                        'O histórico de cotações ainda está vazio.' : 
                        'Nenhum item corresponde aos filtros aplicados.'}
                    </p>
                </div>
            `;
            return;
        }
        
        let html = '';
        
        // Ordenar por data (mais recente primeiro)
        historicoFiltrado.sort((a, b) => {
            try {
                return new Date(b.data) - new Date(a.data);
            } catch {
                return 0;
            }
        });
        
        historicoFiltrado.forEach(item => {
            if (!item.cotacoes || item.cotacoes.length === 0) return;
            
            // Encontrar melhor preço neste comparativo
            const melhorPreco = Math.min(...item.cotacoes.map(c => c.valorTotal || 0));
            const melhorPrazo = item.cotacoes.reduce((prev, curr) => {
                const diasPrev = calcularDiasPrazo(prev.prazoPagamento);
                const diasCurr = calcularDiasPrazo(curr.prazoPagamento);
                return diasCurr > diasPrev ? curr : prev; // MAIOR prazo é melhor
            });
            
            html += `
                <div class="historico-item">
                    <div class="historico-item-header">
                        <div class="historico-produto">
                            <i class="fas fa-box"></i>
                            ${item.produto || 'Produto não informado'}
                        </div>
                        <div class="historico-data">
                            ${formatDate(item.data)} - ${item.cotacoes.length} cotações
                        </div>
                    </div>
                    
                    <div class="historico-cotacoes">
                        ${item.cotacoes.map(cotacao => {
                            const isMelhorPreco = cotacao.valorTotal === melhorPreco;
                            const isMelhorPrazo = cotacao.id === melhorPrazo.id;
                            
                            return `
                                <div class="historico-cotacao">
                                    <div class="fornecedor">
                                        ${cotacao.fornecedor || 'Fornecedor não informado'}
                                        ${isMelhorPreco ? '<span class="badge badge-success">Melhor Preço</span>' : ''}
                                        ${isMelhorPrazo ? '<span class="badge badge-info melhor-prazo">Melhor Prazo</span>' : ''}
                                    </div>
                                    <div class="valor">${formatCurrency(cotacao.valorTotal)}</div>
                                    <div class="info">
                                        <span>${cotacao.quantidade || 0} ${cotacao.unidade || ''}</span>
                                        <span>${cotacao.prazoPagamento || 'Sem prazo'}</span>
                                        <span>ICMS: ${cotacao.icms || 0}%</span>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    
                    <div class="historico-actions" style="margin-top: 15px; display: flex; gap: 10px;">
                        <button class="btn-action" onclick="verComparativoHistorico(${item.id})">
                            <i class="fas fa-eye"></i> Ver Detalhes
                        </button>
                        <button class="btn-action btn-pdf" onclick="exportHistoricoItemPdf(${item.id})">
                            <i class="fas fa-file-pdf"></i> PDF
                        </button>
                        <button class="btn-action btn-delete" onclick="excluirItemHistorico(${item.id})" style="margin-left: auto;">
                            <i class="fas fa-trash"></i> Excluir
                        </button>
                    </div>
                </div>
            `;
        });
        
        historicoContainer.innerHTML = html;
    }
    
    // RENDERIZAR PRODUTOS
    function renderProdutos() {
        if (!produtosContainer || !emptyProdutos) return;
        
        if (produtos.length === 0) {
            emptyProdutos.style.display = 'block';
            produtosContainer.innerHTML = '';
            return;
        }
        
        emptyProdutos.style.display = 'none';
        
        let html = '';
        
        produtos.forEach(produto => {
            // Contar cotações ativas para este produto
            const cotacoesProduto = cotacoes.filter(c => 
                c.produtoId === produto.id && c.status === "ativo"
            ).length;
            
            // Última cotação
            const ultimaCotacao = cotacoes
                .filter(c => c.produtoId === produto.id)
                .sort((a, b) => new Date(b.dataCotacao) - new Date(a.dataCotacao))[0];
            
            html += `
                <div class="produto-card">
                    <div class="produto-header">
                        <h3 class="produto-nome">${produto.nome || 'Sem nome'}</h3>
                        ${produto.codigo ? `<span class="produto-codigo">${produto.codigo}</span>` : ''}
                    </div>
                    
                    <div class="produto-info">
                        ${produto.categoria ? `
                            <span class="produto-categoria">${produto.categoria}</span>
                        ` : ''}
                        
                        ${produto.descricao ? `
                            <p class="produto-descricao">${produto.descricao}</p>
                        ` : ''}
                        
                        <div style="display: flex; gap: 15px; margin-top: 10px;">
                            <div>
                                <strong>Unidade:</strong>
                                <div>${produto.unidadePadrao || 'Não informada'}</div>
                            </div>
                            ${produto.ncm ? `
                                <div>
                                    <strong>NCM:</strong>
                                    <div>${produto.ncm}</div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="produto-stats">
                        <div>
                            <strong>Cotações Ativas:</strong>
                            <div>${cotacoesProduto}</div>
                        </div>
                        ${ultimaCotacao ? `
                            <div>
                                <strong>Última Cotação:</strong>
                                <div>${formatDate(ultimaCotacao.dataCotacao)}</div>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="produto-actions">
                        <button class="btn-action" onclick="criarCotacaoParaProduto(${produto.id})">
                            <i class="fas fa-plus-circle"></i> Nova Cotação
                        </button>
                        <button class="btn-action btn-history" onclick="verHistoricoProdutoPorId(${produto.id})">
                            <i class="fas fa-history"></i> Histórico
                        </button>
                        <button class="btn-action btn-edit" onclick="editarProduto(${produto.id})">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                    </div>
                </div>
            `;
        });
        
        produtosContainer.innerHTML = html;
    }
    
    // ABRIR MODAL PARA ADICIONAR/EDITAR COTAÇÃO
    function openModal(id = null) {
        editingId = id;
        
        if (id) {
            modalTitle.textContent = 'Editar Cotação';
            const cotacao = cotacoes.find(c => c.id === id);
            
            if (cotacao) {
                // Preencher formulário
                if (produtoSelect) {
                    produtoSelect.value = cotacao.produtoId || '';
                }
                document.getElementById('fornecedor').value = cotacao.fornecedor || '';
                document.getElementById('uf').value = cotacao.uf || '';
                document.getElementById('dataCotacao').value = cotacao.dataCotacao || '';
                document.getElementById('quantidade').value = cotacao.quantidade || '';
                document.getElementById('unidade').value = cotacao.unidade || '';
                document.getElementById('valorUnitario').value = cotacao.valorUnitario || '';
                document.getElementById('icms').value = cotacao.icms || 18;
                document.getElementById('ipi').value = cotacao.ipi || 0;
                document.getElementById('prazoPagamento').value = cotacao.prazoPagamento || '';
                document.getElementById('regimeTributario').value = cotacao.regimeTributario || '';
                document.getElementById('ncm').value = cotacao.ncm || '';
                document.getElementById('observacoes').value = cotacao.observacoes || '';
                document.getElementById('salvarHistorico').checked = cotacao.salvarHistorico !== false;
            }
        } else {
            modalTitle.textContent = 'Nova Cotação';
            if (cotacaoForm) cotacaoForm.reset();
            
            // Resetar valores padrão
            if (dataCotacaoInput) {
                const hoje = new Date().toISOString().split('T')[0];
                dataCotacaoInput.value = hoje;
            }
            document.getElementById('icms').value = 18;
            document.getElementById('ipi').value = 0;
            document.getElementById('salvarHistorico').checked = true;
        }
        
        // Atualizar preview
        updatePreview();
        if (cotacaoModal) cotacaoModal.style.display = 'flex';
    }
    
    // FECHAR MODAL COTAÇÃO
    function closeModal() {
        if (cotacaoModal) cotacaoModal.style.display = 'none';
        if (cotacaoForm) cotacaoForm.reset();
        editingId = null;
    }
    
    // ABRIR MODAL PRODUTO
    function openProdutoModal(id = null) {
        currentProdutoId = id;
        
        const titulo = document.querySelector('#produtoModal h2');
        if (id) {
            if (titulo) titulo.textContent = 'Editar Produto';
            const produto = produtos.find(p => p.id === id);
            
            if (produto) {
                document.getElementById('nomeProduto').value = produto.nome || '';
                document.getElementById('codigoProduto').value = produto.codigo || '';
                document.getElementById('categoriaProduto').value = produto.categoria || '';
                document.getElementById('descricaoProduto').value = produto.descricao || '';
                document.getElementById('unidadePadrao').value = produto.unidadePadrao || '';
                document.getElementById('ncmProduto').value = produto.ncm || '';
            }
        } else {
            if (titulo) titulo.textContent = 'Cadastrar Novo Produto';
            if (produtoForm) produtoForm.reset();
        }
        
        if (produtoModal) produtoModal.style.display = 'flex';
    }
    
    // FECHAR MODAL PRODUTO
    function closeProdutoModalFunc() {
        if (produtoModal) produtoModal.style.display = 'none';
        if (produtoForm) produtoForm.reset();
        currentProdutoId = null;
    }
    
    // SALVAR COTAÇÃO
    function saveCotacao() {
        if (!cotacaoForm || !cotacaoForm.checkValidity()) {
            if (cotacaoForm) cotacaoForm.reportValidity();
            return;
        }
        
        // Validar produto selecionado
        const produtoSelectVal = document.getElementById('produtoSelect').value;
        if (!produtoSelectVal) {
            alert('Por favor, selecione um produto!');
            return;
        }
        
        // Encontrar produto
        const produto = produtos.find(p => p.id == produtoSelectVal);
        if (!produto) {
            alert('Produto não encontrado!');
            return;
        }
        
        // Coletar dados
        const quantidade = parseFloat(document.getElementById('quantidade').value) || 0;
        const valorUnitario = parseFloat(document.getElementById('valorUnitario').value) || 0;
        const icmsPercent = parseFloat(document.getElementById('icms').value) || 0;
        const ipiPercent = parseFloat(document.getElementById('ipi').value) || 0;
        const salvarHistorico = document.getElementById('salvarHistorico').checked;
        
        // Cálculos
        const valorBruto = quantidade * valorUnitario;
        const valorIcms = valorBruto * (icmsPercent / 100);
        const valorIpi = valorBruto * (ipiPercent / 100);
        const valorTotal = valorBruto + valorIpi;
        
        const cotacaoData = {
            id: editingId || generateId(),
            produto: produto.nome,
            produtoId: produto.id,
            fornecedor: document.getElementById('fornecedor').value,
            uf: document.getElementById('uf').value,
            dataCotacao: document.getElementById('dataCotacao').value,
            quantidade: quantidade,
            unidade: document.getElementById('unidade').value,
            valorUnitario: valorUnitario,
            icms: icmsPercent,
            ipi: ipiPercent,
            prazoPagamento: document.getElementById('prazoPagamento').value,
            regimeTributario: document.getElementById('regimeTributario').value,
            ncm: document.getElementById('ncm').value,
            observacoes: document.getElementById('observacoes').value,
            valorBruto: valorBruto,
            valorIcms: valorIcms,
            valorIpi: valorIpi,
            valorTotal: valorTotal,
            status: "ativo",
            salvarHistorico: salvarHistorico
        };
        
        if (editingId) {
            // Atualizar
            const index = cotacoes.findIndex(c => c.id === editingId);
            if (index !== -1) {
                cotacoes[index] = cotacaoData;
            }
        } else {
            // Adicionar
            cotacoes.push(cotacaoData);
        }
        
        // Atualizar contador no produto
        const produtoIndex = produtos.findIndex(p => p.id == produto.id);
        if (produtoIndex !== -1) {
            const cotacoesCount = cotacoes.filter(c => 
                c.produtoId === produto.id && c.status === "ativo"
            ).length;
            produtos[produtoIndex].cotaçõesCount = cotacoesCount;
        }
        
        saveToLocalStorage();
        closeModal();
        renderCotacoes();
        renderProdutos();
        
        if (salvarHistorico) {
            adicionarAoHistorico(cotacaoData);
        }
    }
    
    // SALVAR PRODUTO
    function saveProduto() {
        if (!produtoForm || !produtoForm.checkValidity()) {
            if (produtoForm) produtoForm.reportValidity();
            return;
        }
        
        const produtoData = {
            id: currentProdutoId || generateProdutoId(),
            nome: document.getElementById('nomeProduto').value,
            codigo: document.getElementById('codigoProduto').value,
            categoria: document.getElementById('categoriaProduto').value,
            descricao: document.getElementById('descricaoProduto').value,
            unidadePadrao: document.getElementById('unidadePadrao').value,
            ncm: document.getElementById('ncmProduto').value,
            dataCadastro: currentProdutoId ? 
                (produtos.find(p => p.id === currentProdutoId)?.dataCadastro || new Date().toISOString().split('T')[0]) : 
                new Date().toISOString().split('T')[0],
            cotaçõesCount: currentProdutoId ? 
                (produtos.find(p => p.id === currentProdutoId)?.cotaçõesCount || 0) : 0
        };
        
        if (currentProdutoId) {
            // Atualizar
            const index = produtos.findIndex(p => p.id === currentProdutoId);
            if (index !== -1) {
                produtos[index] = produtoData;
            }
        } else {
            // Adicionar
            produtos.push(produtoData);
        }
        
        saveToLocalStorage();
        closeProdutoModalFunc();
        renderProdutos();
        loadProdutosSelect();
    }
    
    // GERAR IDS
    function generateId() {
        if (cotacoes.length === 0) return 1;
        const maxId = Math.max(...cotacoes.map(c => c.id || 0));
        return maxId + 1;
    }
    
    function generateProdutoId() {
        if (produtos.length === 0) return 1;
        const maxId = Math.max(...produtos.map(p => p.id || 0));
        return maxId + 1;
    }
    
    // ADICIONAR AO HISTÓRICO
    function adicionarAoHistorico(cotacao) {
        // Criar ou atualizar histórico por data e produto
        const hoje = new Date().toISOString().split('T')[0];
        let historicoItem = historico.find(item => 
            item.data === hoje && item.produto === cotacao.produto
        );
        
        if (!historicoItem) {
            historicoItem = {
                id: historico.length > 0 ? Math.max(...historico.map(h => h.id || 0)) + 1 : 1,
                data: hoje,
                produto: cotacao.produto,
                produtoId: cotacao.produtoId,
                cotacoes: []
            };
            historico.push(historicoItem);
        }
        
        // Adicionar cotação ao histórico (se não existir)
        if (!historicoItem.cotacoes.some(c => c.id === cotacao.id)) {
            historicoItem.cotacoes.push({...cotacao});
        }
        
        saveToLocalStorage();
        renderHistorico();
    }
    
    // SALVAR COMPARAÇÃO NO HISTÓRICO
    function salvarComparacaoNoHistorico() {
        if (!currentComparisonData) {
            alert('Nenhum comparativo disponível para salvar!');
            return;
        }
        
        const hoje = new Date().toISOString().split('T')[0];
        
        // Verificar se já existe histórico para hoje
        const historicoExistente = historico.find(item => 
            item.data === hoje && item.produto === currentComparisonData.produto
        );
        
        if (historicoExistente) {
            if (!confirm('Já existe um comparativo salvo para este produto hoje. Deseja substituir?')) {
                return;
            }
            // Remover o existente
            historico = historico.filter(item => item !== historicoExistente);
        }
        
        // Criar novo item de histórico
        const novoHistorico = {
            id: historico.length > 0 ? Math.max(...historico.map(h => h.id || 0)) + 1 : 1,
            data: hoje,
            produto: currentComparisonData.produto,
            produtoId: produtos.find(p => p.nome === currentComparisonData.produto)?.id,
            cotacoes: currentComparisonData.cotacoes.map(c => ({
                ...c,
                dataCotacao: c.dataCotacao || hoje
            }))
        };
        
        historico.push(novoHistorico);
        saveToLocalStorage();
        renderHistorico();
        
        alert('Comparativo salvo no histórico com sucesso!');
    }
    
    // FUNÇÕES GLOBAIS - PDF
    
    // GERAR PDF DO COMPARATIVO - VERSÃO CORRIGIDA
    function generateComparisonPdf() {
        console.log('Iniciando geração de PDF...');
        
        if (!currentComparisonData) {
            alert('Nenhum comparativo disponível para gerar PDF.');
            return;
        }
        
        // Mostrar loading
        const originalText = generatePdfBtn ? generatePdfBtn.innerHTML : '';
        if (generatePdfBtn) {
            generatePdfBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando PDF...';
            generatePdfBtn.disabled = true;
        }
        
        try {
            // Verificar se jsPDF está disponível
            if (typeof jspdf === 'undefined' && typeof window.jspdf === 'undefined') {
                console.error('jsPDF não está disponível');
                // Tentar carregar dinamicamente
                loadJSPDF().then(() => {
                    generateComparisonPdf();
                }).catch(error => {
                    alert('Erro ao carregar biblioteca PDF. Verifique sua conexão com a internet.');
                    console.error('Erro ao carregar jsPDF:', error);
                });
                return;
            }
            
            // Usar a biblioteca jsPDF disponível
            const jsPDF = window.jspdf ? window.jspdf.jsPDF : jspdf.jsPDF;
            
            // Criar documento
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });
            
            // Título
            doc.setFontSize(18);
            doc.setTextColor(44, 62, 80);
            doc.setFont('helvetica', 'bold');
            doc.text('COMPARATIVO DE COTAÇÕES', 148.5, 15, { align: 'center' });
            
            // Informações
            doc.setFontSize(11);
            doc.setTextColor(127, 140, 141);
            doc.setFont('helvetica', 'normal');
            doc.text('Mil Plásticos - Sistema de Cotações', 148.5, 22, { align: 'center' });
            
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
            doc.text(`Produto: ${currentComparisonData.produto}`, 15, 32);
            doc.text(`Data: ${currentComparisonData.data}`, 15, 38);
            doc.text(`Total de Cotações: ${currentComparisonData.cotacoes.length}`, 275, 32, { align: 'right' });
            
            // Calcular melhor preço e melhor prazo
            const melhorPreco = Math.min(...currentComparisonData.cotacoes.map(c => c.valorTotal || 0));
            const melhorPrazo = currentComparisonData.cotacoes.reduce((prev, curr) => {
                const diasPrev = calcularDiasPrazo(prev.prazoPagamento);
                const diasCurr = calcularDiasPrazo(curr.prazoPagamento);
                return diasCurr > diasPrev ? curr : prev;
            });
            
            // Preparar dados da tabela
            const headers = [
                ['Fornecedor', 'UF', 'Qtd/Unid', 'Vl. Unitário', 'Vl. Bruto', 'ICMS%', 'IPI%', 'Prazo', 'Valor Total']
            ];
            
            const tableData = currentComparisonData.cotacoes.map(cotacao => {
                const isMelhorPreco = cotacao.valorTotal === melhorPreco;
                const isMelhorPrazo = cotacao.id === melhorPrazo.id;
                
                return [
                    cotacao.fornecedor + (isMelhorPreco ? ' *' : '') + (isMelhorPrazo ? ' **' : ''),
                    cotacao.uf || '',
                    `${cotacao.quantidade || 0} ${cotacao.unidade || ''}`,
                    formatCurrency(cotacao.valorUnitario || 0),
                    formatCurrency(cotacao.valorBruto || 0),
                    `${cotacao.icms || 0}%`,
                    `${cotacao.ipi || 0}%`,
                    cotacao.prazoPagamento || '',
                    formatCurrency(cotacao.valorTotal || 0)
                ];
            });
            
            // Adicionar tabela usando autoTable se disponível
            if (typeof doc.autoTable !== 'undefined') {
                doc.autoTable({
                    startY: 45,
                    head: headers,
                    body: tableData,
                    theme: 'grid',
                    headStyles: {
                        fillColor: [52, 73, 94],
                        textColor: 255,
                        fontStyle: 'bold',
                        fontSize: 9
                    },
                    bodyStyles: {
                        fontSize: 8,
                        cellPadding: 2
                    },
                    alternateRowStyles: {
                        fillColor: [249, 249, 249]
                    },
                    margin: { left: 10, right: 10 },
                    styles: {
                        overflow: 'linebreak'
                    },
                    columnStyles: {
                        0: { cellWidth: 35 },
                        1: { cellWidth: 15 },
                        2: { cellWidth: 25 },
                        3: { cellWidth: 25 },
                        4: { cellWidth: 25 },
                        5: { cellWidth: 20 },
                        6: { cellWidth: 20 },
                        7: { cellWidth: 25 },
                        8: { cellWidth: 30 }
                    }
                });
            } else {
                // Fallback: tabela manual simples
                let y = 45;
                const colWidths = [35, 15, 25, 25, 25, 20, 20, 25, 30];
                let x = 10;
                
                // Cabeçalhos
                headers[0].forEach((header, i) => {
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(9);
                    doc.text(header, x + (colWidths[i] / 2), y, { align: 'center' });
                    x += colWidths[i];
                });
                
                // Dados
                y += 6;
                tableData.forEach(row => {
                    x = 10;
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(8);
                    
                    row.forEach((cell, i) => {
                        doc.text(cell, x + 2, y);
                        x += colWidths[i];
                    });
                    
                    y += 5;
                });
            }
            
            const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 45 + (tableData.length * 5) + 15;
            
            // Adicionar resumo
            doc.setFontSize(12);
            doc.setTextColor(44, 62, 80);
            doc.setFont('helvetica', 'bold');
            doc.text('RESUMO DA COMPARAÇÃO', 15, finalY);
            
            // Calcular estatísticas
            const valores = currentComparisonData.cotacoes.map(c => c.valorTotal || 0);
            const piorPreco = Math.max(...valores);
            const mediaPreco = valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;
            const economia = piorPreco - melhorPreco;
            
            const melhorPrecoCotacao = currentComparisonData.cotacoes.find(c => c.valorTotal === melhorPreco);
            
            // Adicionar estatísticas
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'normal');
            
            let yPos = finalY + 8;
            doc.text(`Melhor Preço (*): ${formatCurrency(melhorPreco)} (${melhorPrecoCotacao?.fornecedor || 'N/A'})`, 15, yPos);
            yPos += 6;
            doc.text(`Melhor Prazo (**): ${melhorPrazo.prazoPagamento || 'N/A'} (${melhorPrazo.fornecedor || 'N/A'})`, 15, yPos);
            yPos += 6;
            doc.text(`Economia Máxima: ${formatCurrency(economia)}`, 120, finalY + 8);
            doc.text(`Média de Preços: ${formatCurrency(mediaPreco)}`, 120, finalY + 14);
            
            // Observações
            yPos += 10;
            const observacoes = currentComparisonData.cotacoes
                .filter(c => c.observacoes && c.observacoes.trim() !== '')
                .map(c => `${c.fornecedor}: ${c.observacoes}`)
                .join(' | ');
            
            if (observacoes) {
                doc.setFontSize(9);
                doc.setTextColor(127, 140, 141);
                doc.text('Observações:', 15, yPos);
                
                yPos += 5;
                const splitObs = doc.splitTextToSize(observacoes, 270);
                doc.setFontSize(8);
                doc.setTextColor(0, 0, 0);
                doc.text(splitObs, 15, yPos);
            }
            
            // Rodapé
            const pageHeight = doc.internal.pageSize.getHeight();
            doc.setDrawColor(200, 200, 200);
            doc.line(15, pageHeight - 20, 285, pageHeight - 20);
            
            doc.setFontSize(8);
            doc.setTextColor(149, 165, 166);
            doc.text('Documento gerado automaticamente pelo Sistema de Cotações - Mil Plásticos', 
                     148.5, pageHeight - 15, { align: 'center' });
            doc.text('* Melhor preço | ** Melhor prazo (mais longo)', 
                     148.5, pageHeight - 10, { align: 'center' });
            
            // Nome do arquivo
            const fileName = `Comparativo_${currentComparisonData.produto.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
            
            // Salvar PDF
            doc.save(fileName);
            
            console.log('PDF gerado com sucesso:', fileName);
            
        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            alert('Erro ao gerar PDF. Verifique o console para detalhes.');
            
            // Tentar método alternativo
            try {
                generateSimplePdf();
            } catch (error2) {
                console.error('Erro no método alternativo:', error2);
                alert('Não foi possível gerar o PDF. Verifique se a biblioteca jsPDF está carregada corretamente.');
            }
        } finally {
            // Restaurar botão
            if (generatePdfBtn) {
                setTimeout(() => {
                    generatePdfBtn.innerHTML = originalText;
                    generatePdfBtn.disabled = false;
                }, 1000);
            }
        }
    }
    
    // FUNÇÃO PARA CARREGAR JSPDF DINAMICAMENTE
    function loadJSPDF() {
        return new Promise((resolve, reject) => {
            if (typeof window.jspdf !== 'undefined') {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = () => {
                console.log('jsPDF carregado dinamicamente');
                resolve();
            };
            script.onerror = () => {
                console.error('Falha ao carregar jsPDF');
                reject(new Error('Falha ao carregar jsPDF'));
            };
            document.head.appendChild(script);
        });
    }
    
    // MÉTODO ALTERNATIVO SIMPLES
    function generateSimplePdf() {
        if (!currentComparisonData) {
            alert('Nenhum comparativo disponível para gerar PDF.');
            return;
        }
        
        try {
            const jsPDF = window.jspdf ? window.jspdf.jsPDF : jspdf.jsPDF;
            const doc = new jsPDF();
            
            // Título
            doc.setFontSize(16);
            doc.text('COMPARATIVO DE COTAÇÕES', 20, 20);
            
            // Informações básicas
            doc.setFontSize(12);
            doc.text(`Produto: ${currentComparisonData.produto}`, 20, 30);
            doc.text(`Data: ${currentComparisonData.data}`, 20, 37);
            doc.text(`Total: ${currentComparisonData.cotacoes.length} cotações`, 20, 44);
            
            // Dados em formato de lista
            let y = 60;
            doc.setFontSize(10);
            
            currentComparisonData.cotacoes.forEach(cotacao => {
                doc.text(`${cotacao.fornecedor}: ${formatCurrency(cotacao.valorTotal)} - ${cotacao.prazoPagamento}`, 20, y);
                y += 7;
                
                if (y > 280) {
                    doc.addPage();
                    y = 20;
                }
            });
            
            // Resumo
            y += 10;
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text('RESUMO:', 20, y);
            
            const melhorPreco = Math.min(...currentComparisonData.cotacoes.map(c => c.valorTotal || 0));
            const melhorPrazo = currentComparisonData.cotacoes.reduce((prev, curr) => {
                const diasPrev = calcularDiasPrazo(prev.prazoPagamento);
                const diasCurr = calcularDiasPrazo(curr.prazoPagamento);
                return diasCurr > diasPrev ? curr : prev;
            });
            
            y += 8;
            doc.setFont('helvetica', 'normal');
            doc.text(`Melhor Preço: ${formatCurrency(melhorPreco)}`, 20, y);
            y += 7;
            doc.text(`Melhor Prazo: ${melhorPrazo.prazoPagamento}`, 20, y);
            
            // Rodapé
            doc.setFontSize(8);
            doc.text('Mil Plásticos - Sistema de Cotações', 20, 280);
            doc.text(new Date().toLocaleDateString('pt-BR'), 190, 280, { align: 'right' });
            
            // Salvar
            const fileName = `Comparativo_Simples_${currentComparisonData.produto.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
            doc.save(fileName);
            
        } catch (error) {
            console.error('Erro no PDF simples:', error);
            alert('Não foi possível gerar nenhum tipo de PDF.');
        }
    }
    
    // FUNÇÕES GLOBAIS
    window.editCotacao = function(id) {
        openModal(id);
    };
    
    window.deleteCotacao = function(id) {
        if (confirm('Tem certeza que deseja excluir esta cotação?')) {
            const index = cotacoes.findIndex(c => c.id === id);
            if (index !== -1) {
                cotacoes[index].status = "inativo";
                saveToLocalStorage();
                renderCotacoes();
                renderProdutos();
            }
        }
    };
    
    window.openComparisonModalForProduct = function(produtoNome) {
        const cotacoesProduto = cotacoes.filter(c => 
            c.produto === produtoNome && c.status === "ativo"
        );
        
        if (cotacoesProduto.length > 0) {
            openComparisonModal(cotacoesProduto);
        }
    };
    
    window.verHistoricoProduto = function(produtoNome) {
        const produto = produtos.find(p => p.nome === produtoNome);
        if (produto) {
            verHistoricoProdutoPorId(produto.id);
        }
    };
    
    window.verHistoricoProdutoPorId = function(produtoId) {
        const produto = produtos.find(p => p.id == produtoId);
        if (!produto) return;
        
        // Encontrar histórico do produto
        const historicoProduto = historico.filter(item => item.produtoId == produtoId);
        
        // Informações do produto
        const infoProdutoContainer = document.getElementById('infoProdutoContainer');
        if (infoProdutoContainer) {
            infoProdutoContainer.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <h3 style="margin: 0 0 10px 0; color: #2c3e50;">${produto.nome}</h3>
                        <p style="margin: 0; color: #7f8c8d;">
                            <strong>Código:</strong> ${produto.codigo} | 
                            <strong>Categoria:</strong> ${produto.categoria || 'Não informada'} | 
                            <strong>Unidade:</strong> ${produto.unidadePadrao}
                        </p>
                        ${produto.descricao ? `
                            <p style="margin: 10px 0 0 0; color: #95a5a6;">${produto.descricao}</p>
                        ` : ''}
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 24px; font-weight: bold; color: #3498db;">
                            ${historicoProduto.length}
                        </div>
                        <div style="color: #7f8c8d; font-size: 14px;">Comparativos salvos</div>
                    </div>
                </div>
            `;
        }
        
        // Linha do tempo
        const linhaTempoContainer = document.getElementById('linhaTempoContainer');
        if (linhaTempoContainer) {
            if (historicoProduto.length === 0) {
                linhaTempoContainer.innerHTML = `
                    <div class="empty-state" style="padding: 40px;">
                        <i class="fas fa-history"></i>
                        <h3>Nenhum histórico encontrado</h3>
                        <p>Este produto ainda não tem comparativos salvos no histórico.</p>
                    </div>
                `;
            } else {
                historicoProduto.sort((a, b) => new Date(b.data) - new Date(a.data));
                
                let html = '';
                
                historicoProduto.forEach(item => {
                    if (!item.cotacoes || item.cotacoes.length === 0) return;
                    
                    const melhorPreco = Math.min(...item.cotacoes.map(c => c.valorTotal || 0));
                    const melhorPrazo = item.cotacoes.reduce((prev, curr) => {
                        const diasPrev = calcularDiasPrazo(prev.prazoPagamento);
                        const diasCurr = calcularDiasPrazo(curr.prazoPagamento);
                        return diasCurr > diasPrev ? curr : prev;
                    });
                    
                    html += `
                        <div class="linha-tempo-item">
                            <div class="linha-tempo-header">
                                <div class="linha-tempo-data">${formatDate(item.data)}</div>
                                <div class="linha-tempo-fornecedor">${item.cotacoes.length} Fornecedores</div>
                            </div>
                            
                            ${item.cotacoes.map(cotacao => {
                                const isMelhorPreco = cotacao.valorTotal === melhorPreco;
                                const isMelhorPrazo = cotacao.id === melhorPrazo.id;
                                
                                return `
                                    <div style="margin-bottom: 10px; padding: 10px; background-color: ${isMelhorPreco || isMelhorPrazo ? '#f8f9fa' : 'white'}; border-radius: 4px; border-left: 3px solid ${isMelhorPreco ? '#27ae60' : (isMelhorPrazo ? '#9b59b6' : '#3498db')};">
                                        <div style="display: flex; justify-content: space-between;">
                                            <strong>${cotacao.fornecedor}</strong>
                                            <div>
                                                ${isMelhorPreco ? '<span class="badge badge-success">Melhor Preço</span>' : ''}
                                                ${isMelhorPrazo ? '<span class="badge badge-info">Melhor Prazo</span>' : ''}
                                            </div>
                                        </div>
                                        <div class="linha-tempo-valor">${formatCurrency(cotacao.valorTotal)}</div>
                                        <div class="linha-tempo-info">
                                            <span>${cotacao.quantidade} ${cotacao.unidade}</span>
                                            <span>Prazo: ${cotacao.prazoPagamento}</span>
                                            <span>ICMS: ${cotacao.icms}%</span>
                                            <span>IPI: ${cotacao.ipi}%</span>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `;
                });
                
                linhaTempoContainer.innerHTML = html;
            }
        }
        
        // Atualizar título
        const titulo = document.getElementById('historicoProdutoTitulo');
        if (titulo) {
            titulo.textContent = `Histórico - ${produto.nome}`;
        }
        
        if (historicoProdutoModal) historicoProdutoModal.style.display = 'flex';
    };
    
    // ABRIR MODAL DE COMPARAÇÃO
    function openComparisonModal(cotacoesFiltradas = null) {
        const cotacoesParaComparar = cotacoesFiltradas || 
            cotacoes.filter(c => c.status === "ativo");
        
        if (cotacoesParaComparar.length < 2) {
            alert('É necessário pelo menos 2 cotações ativas para comparar!');
            return;
        }
        
        // Armazenar dados para PDF
        currentComparisonData = {
            cotacoes: [...cotacoesParaComparar],
            produto: cotacoesParaComparar[0].produto,
            data: new Date().toLocaleDateString('pt-BR')
        };
        
        // Atualizar data no PDF
        const pdfDateElement = document.getElementById('pdfDate');
        if (pdfDateElement) {
            pdfDateElement.textContent = currentComparisonData.data;
        }
        
        // Ordenar por valor total (menor para maior)
        const cotacoesOrdenadas = [...cotacoesParaComparar].sort((a, b) => (a.valorTotal || 0) - (b.valorTotal || 0));
        
        // Encontrar melhor preço (menor valor)
        const melhorPreco = Math.min(...cotacoesOrdenadas.map(c => c.valorTotal || 0));
        
        // Encontrar MELHOR PRAZO (MAIOR número de dias)
        const melhorPrazo = cotacoesOrdenadas.reduce((prev, curr) => {
            const diasPrev = calcularDiasPrazo(prev.prazoPagamento);
            const diasCurr = calcularDiasPrazo(curr.prazoPagamento);
            return diasCurr > diasPrev ? curr : prev;
        });
        
        let html = `
            <div class="comparison-container">
                <h3 style="color: #2c3e50; margin-bottom: 10px;">${cotacoesOrdenadas[0].produto}</h3>
                <p style="color: #7f8c8d; margin-bottom: 20px;">
                    Comparando ${cotacoesOrdenadas.length} cotações | Data: ${currentComparisonData.data}
                </p>
                
                <table class="pdf-table">
                    <thead>
                        <tr>
                            <th>Fornecedor</th>
                            <th>UF</th>
                            <th>Quantidade</th>
                            <th>Valor Unitário</th>
                            <th>Valor Bruto</th>
                            <th>ICMS (%)</th>
                            <th>IPI (%)</th>
                            <th>Prazo</th>
                            <th>Valor Total</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Adicionar cada cotação na tabela
        cotacoesOrdenadas.forEach(cotacao => {
            const isMelhorPreco = cotacao.valorTotal === melhorPreco;
            const isMelhorPrazo = cotacao.id === melhorPrazo.id;
            
            html += `
                <tr ${isMelhorPreco ? 'class="pdf-highlight"' : ''}>
                    <td><strong>${cotacao.fornecedor}</strong></td>
                    <td>${cotacao.uf}</td>
                    <td>${cotacao.quantidade} ${cotacao.unidade}</td>
                    <td>${formatCurrency(cotacao.valorUnitario)}</td>
                    <td>${formatCurrency(cotacao.valorBruto)}</td>
                    <td>${cotacao.icms}%<br><small>${formatCurrency(cotacao.valorIcms)}</small></td>
                    <td>${cotacao.ipi}%<br><small>${formatCurrency(cotacao.valorIpi)}</small></td>
                    <td>
                        ${cotacao.prazoPagamento}
                        ${isMelhorPrazo ? '<span class="pdf-indicator best-prazo">Melhor</span>' : ''}
                    </td>
                    <td>
                        <strong>${formatCurrency(cotacao.valorTotal)}</strong>
                        ${isMelhorPreco ? '<span class="pdf-indicator best-price">Melhor</span>' : ''}
                    </td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
                
                <div class="pdf-summary">
                    <h4 style="color: #2c3e50; margin-bottom: 15px;">Resumo da Comparação</h4>
                    <div class="pdf-summary-grid">
                        <div class="pdf-summary-card">
                            <h5>Melhor Preço</h5>
                            <div class="value best">${formatCurrency(melhorPreco)}</div>
                            <p style="font-size: 12px; margin: 5px 0 0 0;">
                                ${cotacoesOrdenadas.find(c => c.valorTotal === melhorPreco).fornecedor}
                            </p>
                        </div>
                        
                        <div class="pdf-summary-card">
                            <h5>Melhor Prazo</h5>
                            <div class="value">${melhorPrazo.prazoPagamento}</div>
                            <p style="font-size: 12px; margin: 5px 0 0 0;">
                                ${melhorPrazo.fornecedor}<br>
                                <small>Total: ${formatCurrency(melhorPrazo.valorTotal)}</small>
                            </p>
                        </div>
                        
                        <div class="pdf-summary-card">
                            <h5>Economia Máxima</h5>
                            <div class="value">${formatCurrency(
                                Math.max(...cotacoesOrdenadas.map(c => c.valorTotal)) - melhorPreco
                            )}</div>
                            <p style="font-size: 12px; margin: 5px 0 0 0;">
                                Diferença maior/menor
                            </p>
                        </div>
                        
                        <div class="pdf-summary-card">
                            <h5>Média de Preços</h5>
                            <div class="value">${formatCurrency(
                                cotacoesOrdenadas.reduce((sum, c) => sum + (c.valorTotal || 0), 0) / cotacoesOrdenadas.length
                            )}</div>
                            <p style="font-size: 12px; margin: 5px 0 0 0;">
                                Média entre ${cotacoesOrdenadas.length} fornecedores
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const comparisonContainer = document.getElementById('comparisonContainer');
        if (comparisonContainer) {
            comparisonContainer.innerHTML = html;
        }
        
        if (comparisonModal) comparisonModal.style.display = 'flex';
    }
    
    // FUNÇÕES ADICIONAIS
    window.generatePdfForProduct = function(produto) {
        const cotacoesProduto = cotacoes.filter(c => 
            c.produto === produto && c.status === "ativo"
        );
        if (cotacoesProduto.length > 0) {
            openComparisonModal(cotacoesProduto);
            setTimeout(() => generateComparisonPdf(), 500);
        }
    };
    
    window.generateSinglePdf = function(id) {
        const cotacao = cotacoes.find(c => c.id === id);
        if (!cotacao) return;
        
        try {
            const jsPDF = window.jspdf ? window.jspdf.jsPDF : jspdf.jsPDF;
            const doc = new jsPDF();
            
            // Título
            doc.setFontSize(16);
            doc.text('COTAÇÃO DETALHADA', 105, 20, { align: 'center' });
            
            // Informações
            let y = 35;
            doc.setFontSize(12);
            doc.text(`Produto: ${cotacao.produto}`, 20, y);
            y += 8;
            doc.text(`Fornecedor: ${cotacao.fornecedor}`, 20, y);
            y += 8;
            doc.text(`Quantidade: ${cotacao.quantidade} ${cotacao.unidade}`, 20, y);
            y += 8;
            doc.text(`Valor Unitário: ${formatCurrency(cotacao.valorUnitario)}`, 20, y);
            y += 8;
            doc.text(`ICMS: ${cotacao.icms}%`, 20, y);
            y += 8;
            doc.text(`IPI: ${cotacao.ipi}%`, 20, y);
            y += 8;
            doc.text(`Prazo: ${cotacao.prazoPagamento}`, 20, y);
            y += 8;
            doc.text(`Valor Total: ${formatCurrency(cotacao.valorTotal)}`, 20, y);
            
            if (cotacao.observacoes) {
                y += 12;
                doc.text('Observações:', 20, y);
                y += 6;
                const splitObs = doc.splitTextToSize(cotacao.observacoes, 170);
                doc.text(splitObs, 20, y);
            }
            
            // Rodapé
            doc.setFontSize(8);
            doc.text('Mil Plásticos - Sistema de Cotações', 105, 280, { align: 'center' });
            
            const fileName = `Cotacao_${cotacao.produto.replace(/\s+/g, '_')}_${cotacao.fornecedor.replace(/\s+/g, '_')}.pdf`;
            doc.save(fileName);
            
        } catch (error) {
            console.error('Erro ao gerar PDF individual:', error);
            alert('Erro ao gerar PDF individual.');
        }
    };
    
    window.criarCotacaoParaProduto = function(produtoId) {
        const produto = produtos.find(p => p.id == produtoId);
        if (!produto) return;
        
        openModal();
        
        setTimeout(() => {
            if (produtoSelect) {
                produtoSelect.value = produtoId;
                const event = new Event('change');
                produtoSelect.dispatchEvent(event);
            }
        }, 100);
    };
    
    window.editarProduto = function(produtoId) {
        openProdutoModal(produtoId);
    };
    
    window.verComparativoHistorico = function(historicoId) {
        const historicoItem = historico.find(h => h.id == historicoId);
        if (historicoItem) {
            openComparisonModal(historicoItem.cotacoes);
        }
    };
    
    window.exportHistoricoItemPdf = function(historicoId) {
        const historicoItem = historico.find(h => h.id == historicoId);
        if (historicoItem) {
            currentComparisonData = {
                cotacoes: historicoItem.cotacoes,
                produto: historicoItem.produto,
                data: historicoItem.data
            };
            generateComparisonPdf();
        }
    };
    
    window.excluirItemHistorico = function(historicoId) {
        if (confirm('Tem certeza que deseja excluir este item do histórico?')) {
            historico = historico.filter(h => h.id != historicoId);
            saveToLocalStorage();
            renderHistorico();
        }
    };
    
    function exportAllToPdf() {
        const cotacoesAtivas = cotacoes.filter(c => c.status === "ativo");
        if (cotacoesAtivas.length === 0) {
            alert('Não há cotações ativas para exportar!');
            return;
        }
        
        try {
            const jsPDF = window.jspdf ? window.jspdf.jsPDF : jspdf.jsPDF;
            const doc = new jsPDF();
            
            doc.setFontSize(16);
            doc.text('RELATÓRIO COMPLETO DE COTAÇÕES', 105, 20, { align: 'center' });
            
            let y = 35;
            doc.setFontSize(10);
            
            // Agrupar por produto
            const produtosAgrupados = {};
            cotacoesAtivas.forEach(cotacao => {
                if (!produtosAgrupados[cotacao.produto]) {
                    produtosAgrupados[cotacao.produto] = [];
                }
                produtosAgrupados[cotacao.produto].push(cotacao);
            });
            
            Object.keys(produtosAgrupados).forEach((produto, index) => {
                if (y > 250) {
                    doc.addPage();
                    y = 20;
                }
                
                doc.setFontSize(12);
                doc.text(`${produto} (${produtosAgrupados[produto].length} cotações)`, 20, y);
                y += 8;
                
                produtosAgrupados[produto].forEach(cotacao => {
                    if (y > 270) {
                        doc.addPage();
                        y = 20;
                    }
                    
                    doc.setFontSize(10);
                    doc.text(`${cotacao.fornecedor}: ${formatCurrency(cotacao.valorTotal)} - ${cotacao.prazoPagamento}`, 25, y);
                    y += 6;
                });
                
                y += 10;
            });
            
            doc.save(`Relatorio_Completo_${new Date().toISOString().split('T')[0]}.pdf`);
            
        } catch (error) {
            console.error('Erro ao exportar tudo:', error);
            alert('Erro ao gerar relatório completo.');
        }
    }
    
    function exportHistoricoPdf() {
        if (historico.length === 0) {
            alert('Não há histórico para exportar!');
            return;
        }
        
        try {
            const jsPDF = window.jspdf ? window.jspdf.jsPDF : jspdf.jsPDF;
            const doc = new jsPDF();
            
            doc.setFontSize(16);
            doc.text('HISTÓRICO DE COMPARATIVOS', 105, 20, { align: 'center' });
            
            let y = 35;
            doc.setFontSize(10);
            
            historico.sort((a, b) => new Date(b.data) - new Date(a.data));
            
            historico.forEach((item, index) => {
                if (y > 250) {
                    doc.addPage();
                    y = 20;
                }
                
                doc.setFontSize(11);
                doc.text(`${item.produto} - ${formatDate(item.data)}`, 20, y);
                y += 7;
                
                doc.setFontSize(10);
                doc.text(`${item.cotacoes.length} fornecedores`, 25, y);
                y += 7;
                
                if (y > 270) {
                    doc.addPage();
                    y = 20;
                }
            });
            
            doc.save(`Historico_Completo_${new Date().toISOString().split('T')[0]}.pdf`);
            
        } catch (error) {
            console.error('Erro ao exportar histórico:', error);
            alert('Erro ao gerar PDF do histórico.');
        }
    }
    
    function limparHistorico() {
        if (confirm('Tem certeza que deseja limpar todo o histórico? Esta ação não pode ser desfeita.')) {
            historico = [];
            saveToLocalStorage();
            renderHistorico();
            alert('Histórico limpo com sucesso!');
        }
    }
    
    // Testar se o PDF está funcionando
    console.log('Sistema de cotações iniciado. jsPDF disponível:', typeof window.jspdf !== 'undefined');
}