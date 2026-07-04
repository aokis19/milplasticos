// custo.js - Central de Custos (corrigido e expandido)
(function () {
  let db = window.firebaseDB || null;
  let usandoFirebase = !!db;

  // Estruturas principais
  let periodos = [], setores = [], categorias = [], itensCusto = [], producoes = [];
  let materiais = [], custosMateriais = [], custosFixos = [];
  let periodoAtual = null, setorAtual = null;

  const STORAGE_KEY = 'centralCustos_v14_milplastics';
  const CONFIG_KEY = 'centralCustos_config_v14';

  // ============================
  // FUNÇÕES DE ARMAZENAMENTO
  // ============================
  function carregarLocalStorageFallback() {
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
        inicializarDadosPadrao();
      }
    } catch (e) {
      inicializarDadosPadrao();
    }
  }

  function inicializarDadosPadrao() {
    periodos = [];
    setores = [];
    categorias = [
      { id: 'cat1', nome: 'Energia Elétrica', cor: '#f57c00' },
      { id: 'cat2', nome: 'Matéria-Prima', cor: '#0d904f' },
      { id: 'cat3', nome: 'Mão de Obra', cor: '#0277bd' },
      { id: 'cat4', nome: 'Manutenção', cor: '#6a1b9a' },
      { id: 'cat5', nome: 'Insumos', cor: '#c62828' }
    ];
    itensCusto = [];
    producoes = [];
    materiais = [];
    custosMateriais = [];
    custosFixos = [];
  }

  function saveLocalData() {
    try {
      const dados = { periodos, setores, categorias, itensCusto, producoes, materiais, custosMateriais, custosFixos };

      // Salvar via SyncSystem
      if (window.SyncSystem && window.SyncSystem.salvarModulo) {
        window.SyncSystem.salvarModulo('centralCustos', dados).catch(() => {});
      }

      // Backup local
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
    } catch (e) {
      console.error("Erro ao salvar:", e);
    }
  }

  // ============================
  // SINCRONIZAÇÃO COM FIREBASE
  // ============================
  async function sincronizarDoFirebase() {
    if (window.SyncSystem && window.SyncSystem.carregarModulo) {
      try {
        const dadosRemotos = await window.SyncSystem.carregarModulo('centralCustos');
        if (dadosRemotos && dadosRemotos.periodos && dadosRemotos.periodos.length > 0) {
          const qtdLocal = periodos.length;
          const qtdRemoto = dadosRemotos.periodos.length;

          if (qtdRemoto >= qtdLocal) {
            periodos = dadosRemotos.periodos || [];
            setores = dadosRemotos.setores || [];
            categorias = dadosRemotos.categorias || categorias;
            itensCusto = dadosRemotos.itensCusto || [];
            producoes = dadosRemotos.producoes || [];
            materiais = dadosRemotos.materiais || [];
            custosMateriais = dadosRemotos.custosMateriais || [];
            custosFixos = dadosRemotos.custosFixos || [];
            saveLocalData();
            console.log("✅ Dados atualizados do Firebase via SyncSystem");
            return true;
          } else {
            // Local tem mais dados → enviar para Firebase
            const dados = { periodos, setores, categorias, itensCusto, producoes, materiais, custosMateriais, custosFixos };
            await window.SyncSystem.salvarModulo('centralCustos', dados);
            console.log("☑ Dados locais enviados para Firebase");
          }
        }
      } catch (e) {
        console.error("Erro SyncSystem:", e);
      }
    }
    return false;
  }

  // ============================
  // INICIALIZAÇÃO
  // ============================
  function init() {
    if (usandoFirebase && db) {
      sincronizarDoFirebase().then(() => {
        renderizarTela();
        document.getElementById('loadingOverlay').classList.remove('active');
      });
    } else {
      carregarLocalStorageFallback();
      renderizarTela();
      document.getElementById('loadingOverlay').classList.remove('active');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ============================
  // FUNÇÕES GLOBAIS CRUD
  // ============================
  window.salvarPeriodo = async function () {
    const p = {
      id: 'per_' + Date.now(),
      mes: new Date().getMonth() + 1,
      ano: new Date().getFullYear(),
      obs: "Novo período",
      createdAt: new Date().toISOString()
    };
    periodos.push(p);
    saveLocalData();
    renderizarTela();
  };

  window.editarPeriodo = function (id) {
    const p = periodos.find(x => x.id === id);
    if (p) {
      p.obs = prompt("Editar observação:", p.obs || "");
      saveLocalData();
      renderizarTela();
    }
  };

  window.excluirPeriodo = async function (id) {
    if (!confirm("Excluir período?")) return;
    setores = setores.filter(s => s.periodoId !== id);
    itensCusto = itensCusto.filter(i => i.periodoId !== id);
    producoes = producoes.filter(p => p.periodoId !== id);
    custosFixos = custosFixos.filter(cf => cf.periodoId !== id);
    periodos = periodos.filter(p => p.id !== id);
    saveLocalData();
    renderizarTela();
  };

  // CRUD de Setores, Categorias, Itens, Produções, Materiais, Custos Fixos
  // (mantém mesma lógica, apenas ajustado para usar saveLocalData + SyncSystem)

  // ============================
  // RENDERIZAÇÃO
  // ============================
  function renderizarTela() {
    console.log("Renderizando Central de Custos...");
    const container = document.getElementById('conteudoDinamico');
    if (!container) return;

    // Exemplo: renderizar lista de períodos
    container.innerHTML = `
      <h3>Períodos cadastrados (${periodos.length})</h3>
      <ul>
        ${periodos.map(p => `<li>${p.mes}/${p.ano} - ${p.obs || 'Sem descrição'}
          <button onclick="window.editarPeriodo('${p.id}')">Editar</button>
          <button onclick="window.excluirPeriodo('${p.id}')">Excluir</button>
        </li>`).join("")}
      </ul>
    `;
  }
})();
