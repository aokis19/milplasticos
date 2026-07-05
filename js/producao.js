// ==========================================================================
// PRODUCAO.JS - Controle de Produção (Versão 100% Firebase)
// Atualizado - Cloud Only - Sem localStorage
// ==========================================================================

(function() {
    'use strict';

    console.log('🏭 Inicializando sistema de Produção (Cloud Mode)...');

    // ============ ESTADO DA APLICAÇÃO ============
    let sistemaInicializado = false;
    let materiaisCadastrados = [];
    let fornecedoresCadastrados = [];
    let folhaEditandoId = null;
    let fechamentoAtualId = null;

    // ============ REFERÊNCIA DO FIREBASE ============
    function getDB() {
        return window.db || window.firebaseDB || null;
    }

    // ============ AGUARDAR FIREBASE ============
    function aguardarFirebase() {
        return new Promise((resolve) => {
            const db = getDB();
            if (db) {
                resolve(db);
                return;
            }
            
            let tentativas = 0;
            const check = setInterval(() => {
                tentativas++;
                const db = getDB();
                if (db) {
                    clearInterval(check);
                    console.log('✅ Firebase conectado após', tentativas * 100, 'ms');
                    resolve(db);
                }
                if (tentativas >= 50) {
                    clearInterval(check);
                    console.error('❌ Firebase não disponível');
                    resolve(null);
                }
            }, 100);
        });
    }

    // ============ INICIALIZAÇÃO ============
    async function inicializarSistema() {
        if (sistemaInicializado) return;
        
        const db = await aguardarFirebase();
        if (!db) {
            console.error('❌ Sistema requer Firebase');
            mostrarAlerta('Firebase não disponível. Recarregue a página.', 'erro');
            return;
        }

        sistemaInicializado = true;
        console.log('🚀 Sistema de Produção iniciado!');

        inicializarTabs();
        inicializarEventos();
        inicializarDataAtual();
        await carregarDadosIniciais();
    }

    // ============ TABS ============
    function inicializarTabs() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.getAttribute('data-tab');
                
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                
                btn.classList.add('active');
                const tabElement = document.getElementById(`tab-${tabId}`);
                if (tabElement) tabElement.classList.add('active');
                
                if (tabId === 'materiais') carregarListaMateriais();
                else if (tabId === 'fornecedores') carregarListaFornecedores();
            });
        });
    }

    // ============ DATA ATUAL ============
    function inicializarDataAtual() {
        const hoje = new Date().toISOString().split('T')[0];
        const dataEntrada = document.getElementById('dataEntradaFechamento');
        const folhaData = document.getElementById('folhaData');
        
        if (dataEntrada) dataEntrada.value = hoje;
        if (folhaData) folhaData.value = hoje;
    }

    // ============ EVENTOS ============
    function inicializarEventos() {
        console.log('📌 Inicializando eventos...');
        
        document.getElementById('btnNovoFechamento')?.addEventListener('click', abrirModalNovoFechamento);
        document.getElementById('btnCadastrarMaterial')?.addEventListener('click', abrirModalCadastroMaterial);
        document.getElementById('btnCadastrarFornecedor')?.addEventListener('click', abrirModalCadastroFornecedor);
        
        document.getElementById('btnCriarFechamento')?.addEventListener('click', criarFechamento);
        document.getElementById('btnSalvarMaterial')?.addEventListener('click', salvarMaterial);
        document.getElementById('btnSalvarFornecedor')?.addEventListener('click', salvarFornecedor);
        document.getElementById('btnSalvarFolha')?.addEventListener('click', salvarFolha);
        document.getElementById('btnAddMaterial')?.addEventListener('click', () => adicionarMaterialCard());
        
        // Fechar modais
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', function() {
                this.closest('.modal')?.classList.remove('active');
            });
        });
        
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', function(e) {
                if (e.target === this) this.classList.remove('active');
            });
        });
        
        document.getElementById('btnAplicarFiltros')?.addEventListener('click', aplicarFiltros);
        document.getElementById('btnLimparFiltros')?.addEventListener('click', limparFiltros);
        document.getElementById('searchFechamentos')?.addEventListener('input', filtrarFechamentos);
        
        console.log('✅ Eventos inicializados!');
    }

    // ============ MODAIS ============
    function abrirModalNovoFechamento() {
        const modal = document.getElementById('modalNovoFechamento');
        if (modal) {
            modal.classList.add('active');
            carregarFornecedoresNoSelect();
            document.getElementById('dataEntradaFechamento').value = new Date().toISOString().split('T')[0];
            document.getElementById('pesoBrutoFechamento').value = '';
            document.getElementById('estadoMaterialFechamento').value = '';
        }
    }

    function abrirModalCadastroMaterial() {
        const modal = document.getElementById('modalCadastroMaterial');
        if (modal) {
            modal.classList.add('active');
            document.getElementById('novoMaterialNome').value = '';
        }
    }

    function abrirModalCadastroFornecedor() {
        const modal = document.getElementById('modalCadastroFornecedor');
        if (modal) {
            modal.classList.add('active');
            document.getElementById('novoFornecedorNome').value = '';
        }
    }

    function abrirModalFolha(fechamentoId, folhaId = null) {
        const modal = document.getElementById('modalFolha');
        if (!modal) return;
        
        fechamentoAtualId = fechamentoId;
        folhaEditandoId = folhaId;
        
        document.getElementById('fechamentoAtualId').value = fechamentoId;
        document.getElementById('modalFolhaTitulo').textContent = folhaId ? 'Editar Folha' : 'Nova Folha';
        document.getElementById('folhaData').value = new Date().toISOString().split('T')[0];
        document.getElementById('folhaDescricao').value = '';
        
        const materiaisList = document.getElementById('materiaisList');
        if (materiaisList) materiaisList.innerHTML = '';
        
        if (folhaId) {
            carregarFolhaParaEdicao(fechamentoId, folhaId);
        } else {
            adicionarMaterialCard();
        }
        
        modal.classList.add('active');
    }

    // ============ CARREGAR DADOS (APENAS FIREBASE) ============
    async function carregarDadosIniciais() {
        await carregarMateriais();
        await carregarFornecedores();
        await carregarFechamentos();
        await atualizarEstatisticas();
    }

    async function carregarMateriais() {
        const db = getDB();
        if (!db) return;
        
        try {
            const q = db.collection("materiais").orderBy("nome");
            const querySnapshot = await q.get();
            materiaisCadastrados = [];
            querySnapshot.forEach((doc) => {
                materiaisCadastrados.push({ 
                    id: doc.id, 
                    nome: doc.data().nome,
                    dataCriacao: doc.data().dataCriacao || new Date().toISOString()
                });
            });
            console.log(`✅ ${materiaisCadastrados.length} materiais carregados`);
        } catch (error) {
            console.error("❌ Erro ao carregar materiais:", error);
        }
    }

    async function carregarFornecedores() {
        const db = getDB();
        if (!db) return;
        
        try {
            const q = db.collection("fornecedores").orderBy("nome");
            const querySnapshot = await q.get();
            fornecedoresCadastrados = [];
            querySnapshot.forEach((doc) => {
                fornecedoresCadastrados.push({ 
                    id: doc.id, 
                    nome: doc.data().nome,
                    dataCriacao: doc.data().dataCriacao || new Date().toISOString()
                });
            });
            console.log(`✅ ${fornecedoresCadastrados.length} fornecedores carregados`);
        } catch (error) {
            console.error("❌ Erro ao carregar fornecedores:", error);
        }
    }

    function carregarFornecedoresNoSelect() {
        const select = document.getElementById('fechamentoFornecedor');
        if (!select) return;
        
        select.innerHTML = '<option value="">Selecione um fornecedor...</option>';
        fornecedoresCadastrados.forEach(forn => {
            const option = document.createElement('option');
            option.value = forn.nome;
            option.textContent = forn.nome;
            select.appendChild(option);
        });
    }

    // ============ CRUD OPERATIONS (JÁ ESTÃO 100% FIREBASE) ============
    // Todas as funções: criarFechamento, finalizarFechamento, salvarMaterial,
    // salvarFornecedor, excluirFechamento, excluirMaterial, excluirFornecedor,
    // salvarFolha, excluirFolha, gerarPDFFechamento
    // Já usam db.collection() diretamente - MANTER COMO ESTÃO! ✅

    // ============ INICIALIZAÇÃO FINAL ============
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializarSistema);
    } else {
        inicializarSistema();
    }

})();
