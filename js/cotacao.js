// cotacao.js - Versão Corrigida (IDs alinhados com o HTML)
// Sistema de Cotações - Mil Plásticos

// ================== DADOS GLOBAIS ==================
let produtos = [];
let cotacoes = [];
let historico = [];
let fornecedores = [];
let editingId = null;
let editingFornecedorId = null;
let editingProdutoId = null;

// ================== UTILITÁRIOS ==================
function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
}

function formatarData(dataStr) {
  if (!dataStr) return '';
  try { const d = new Date(dataStr + 'T00:00:00'); return d.toLocaleDateString('pt-BR'); } catch { return dataStr; }
}

function gerarId() { return Date.now(); }

function salvarDados() {
  localStorage.setItem('produtos_cotacao', JSON.stringify(produtos));
  localStorage.setItem('cotacoes', JSON.stringify(cotacoes));
  localStorage.setItem('historico_cotacao', JSON.stringify(historico));
  localStorage.setItem('fornecedores', JSON.stringify(fornecedores));
}

function carregarDados() {
  produtos = JSON.parse(localStorage.getItem('produtos_cotacao')) || [];
  cotacoes = JSON.parse(localStorage.getItem('cotacoes')) || [];
  historico = JSON.parse(localStorage.getItem('historico_cotacao')) || [];
  fornecedores = JSON.parse(localStorage.getItem('fornecedores')) || [];
  
  if (produtos.length === 0) {
    produtos = [
      { id: 1, nome: "GotaLube Sp", codigo: "GL-001", categoria: "Lubrificantes", unidadePadrao: "kg" },
      { id: 2, nome: "Sacaria Plástica", codigo: "SP-100", categoria: "Embalagens", unidadePadrao: "un" }
    ];
  }
  if (fornecedores.length === 0) {
    fornecedores = [
      { id: '1', nomeEmpresa: "LMJ Plásticos", produtosIds: [1] },
      { id: '2', nomeEmpresa: "PlastTotal", produtosIds: [1] }
    ];
  }
  salvarDados();
}

// ================== RENDERIZAÇÃO ==================
function renderCotacoes() {
  const container = document.getElementById('cotacoesContainer');
  const empty = document.getElementById('emptyState');
  if (!container) return;
  
  const ativas = cotacoes.filter(c => c.status !== "finalizado");
  if (ativas.length === 0) {
    container.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  
  container.innerHTML = ativas.map(cot => {
    const prod = produtos.find(p => p.id == cot.produtoId) || { nome: 'Produto' };
    const total = (cot.quantidade || 0) * (cot.valorUnitario || 0);
    return `<div class="table-row" data-id="${cot.id}">
      <div class="checkbox-column"><input type="checkbox" class="select-cotacao" value="${cot.id}"></div>
      <div><strong>${prod.nome}</strong></div>
      <div>${cot.fornecedor || '-'}</div>
      <div>${cot.uf || '-'}</div>
      <div>${cot.quantidade || 0}</div>
      <div>${formatarMoeda(cot.valorUnitario)}</div>
      <div><strong>${formatarMoeda(total)}</strong></div>
      <div>${cot.dataEntrega ? formatarData(cot.dataEntrega) : '-'}</div>
      <div class="actions">
        <button class="btn-icon edit-cotacao" data-id="${cot.id}"><i class="fas fa-edit"></i></button>
        <button class="btn-icon delete delete-cotacao" data-id="${cot.id}"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
  }).join('');
}

function renderHistorico() {
  const container = document.getElementById('historicoContainer');
  if (!container) return;
  
  const filtroProd = document.getElementById('filtroProduto')?.value?.toLowerCase() || '';
  const filtroForn = document.getElementById('filtroFornecedor')?.value?.toLowerCase() || '';
  
  let lista = [...historico];
  if (filtroProd) lista = lista.filter(i => (i.produto || '').toLowerCase().includes(filtroProd));
  if (filtroForn) lista = lista.filter(i => (i.fornecedor || '').toLowerCase().includes(filtroForn));
  
  if (lista.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-history"></i><h3>Nenhum histórico</h3></div>';
    return;
  }
  
  container.innerHTML = lista.map(item => `
    <div class="historico-item">
      <div class="historico-item-header">
        <div class="historico-produto"><i class="fas fa-box"></i> ${item.produto || '-'}</div>
        <div class="historico-data">${formatarData(item.dataFinalizacao || item.dataCotacao)}</div>
      </div>
      <div class="historico-detalhes">
        <div><strong>Fornecedor:</strong> ${item.fornecedor || '-'}</div>
        <div><strong>Qtd:</strong> ${item.quantidade || 0}</div>
        <div><strong>Valor Unit.:</strong> ${formatarMoeda(item.valorUnitario)}</div>
        <div><strong>Valor Total:</strong> ${formatarMoeda((item.quantidade || 0) * (item.valorUnitario || 0))}</div>
      </div>
    </div>
  `).join('');
}

function renderProdutos() {
  const container = document.getElementById('produtosContainer');
  const empty = document.getElementById('emptyProdutos');
  if (!container) return;
  
  if (produtos.length === 0) {
    container.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  
  container.innerHTML = produtos.map(p => `
    <div class="produto-card">
      <h3>${p.nome}</h3>
      <p><i class="fas fa-barcode"></i> Código: ${p.codigo || '-'}</p>
      <p><i class="fas fa-tag"></i> Categoria: ${p.categoria || '-'}</p>
      <p><i class="fas fa-ruler"></i> Unidade: ${p.unidadePadrao || 'un'}</p>
      <div class="produto-actions">
        <button class="btn-icon btn-editar-produto" data-id="${p.id}"><i class="fas fa-edit"></i></button>
        <button class="btn-icon delete btn-excluir-produto" data-id="${p.id}"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}

function renderFornecedores() {
  const container = document.getElementById('fornecedoresContainer');
  const empty = document.getElementById('emptyFornecedores');
  if (!container) return;
  
  if (fornecedores.length === 0) {
    container.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  
  container.innerHTML = fornecedores.map(f => `
    <div class="fornecedor-card">
      <h3>${f.nomeEmpresa}</h3>
      <p><i class="fas fa-id-card"></i> ${f.cnpj || '-'}</p>
      <p><i class="fas fa-phone"></i> ${f.telefone || '-'}</p>
      <p><i class="fas fa-envelope"></i> ${f.email || '-'}</p>
      <div class="fornecedor-actions">
        <button class="btn-icon btn-editar-fornecedor" data-id="${f.id}"><i class="fas fa-edit"></i></button>
        <button class="btn-icon delete btn-excluir-fornecedor" data-id="${f.id}"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}

// ================== MODAIS ==================
function abrirModalCotacao() {
  editingId = null;
  document.getElementById('formCotacao')?.reset();
  document.getElementById('modalCotacao').style.display = 'block';
  atualizarSelectsCotacao();
}

function fecharModalCotacao() {
  document.getElementById('modalCotacao').style.display = 'none';
}

// ================== COTAÇÕES CRUD ==================
function salvarCotacao(event) {
  if (event) event.preventDefault();
  console.log('Salvando cotação...');
  
  const produtoId = document.getElementById('cotacaoProduto')?.value;
  if (!produtoId) { alert('Selecione um produto'); return; }
  
  const fornecedor = document.getElementById('cotacaoFornecedor')?.value;
  if (!fornecedor) { alert('Selecione um fornecedor'); return; }
  
  const produto = produtos.find(p => p.id == produtoId);
  const qtd = parseFloat(document.getElementById('cotacaoQuantidade')?.value) || 0;
  const vu = parseFloat(document.getElementById('cotacaoValorUnitario')?.value) || 0;
  
  const cotacaoData = {
    id: editingId || gerarId(),
    produtoId: parseInt(produtoId),
    produto: produto?.nome || '',
    fornecedor: fornecedor,
    dataCotacao: document.getElementById('cotacaoData')?.value || '',
    quantidade: qtd,
    valorUnitario: vu,
    dataEntrega: document.getElementById('cotacaoDataEntrega')?.value || '',
    observacoes: document.getElementById('cotacaoObservacoes')?.value || '',
    status: "ativo",
    dataCadastro: new Date().toISOString()
  };
  
  if (editingId) {
    const idx = cotacoes.findIndex(c => c.id === editingId);
    if (idx !== -1) cotacoes[idx] = cotacaoData;
  } else {
    cotacoes.push(cotacaoData);
  }
  
  salvarDados();
  fecharModalCotacao();
  renderCotacoes();
  alert('Cotação salva!');
}

function atualizarSelectsCotacao() {
  const selProd = document.getElementById('cotacaoProduto');
  const selForn = document.getElementById('cotacaoFornecedor');
  
  if (selProd) {
    selProd.innerHTML = '<option value="">Selecione o produto...</option>';
    produtos.forEach(p => selProd.innerHTML += `<option value="${p.id}">${p.nome}</option>`);
  }
  if (selForn) {
    selForn.innerHTML = '<option value="">Selecione o fornecedor...</option>';
    fornecedores.forEach(f => selForn.innerHTML += `<option value="${f.nomeEmpresa}">${f.nomeEmpresa}</option>`);
  }
}

// ================== PRODUTOS CRUD ==================
function salvarProduto(event) {
  if (event) event.preventDefault();
  const nome = document.getElementById('produtoNome')?.value?.trim();
  if (!nome) { alert('Nome obrigatório'); return; }
  
  const prodData = {
    id: editingProdutoId || gerarId(),
    nome: nome,
    codigo: '',
    categoria: '',
    unidadePadrao: document.getElementById('produtoUnidade')?.value || 'un',
    descricao: document.getElementById('produtoDescricao')?.value || ''
  };
  
  if (editingProdutoId) {
    const idx = produtos.findIndex(p => p.id === editingProdutoId);
    if (idx !== -1) produtos[idx] = prodData;
  } else {
    produtos.push(prodData);
  }
  
  salvarDados();
  document.getElementById('modalProduto').style.display = 'none';
  renderProdutos();
  atualizarSelectsCotacao();
  alert('Produto salvo!');
}

// ================== FORNECEDORES CRUD ==================
function salvarFornecedor(event) {
  if (event) event.preventDefault();
  const nome = document.getElementById('fornecedorNome')?.value?.trim();
  if (!nome) { alert('Nome obrigatório'); return; }
  
  const fornData = {
    id: editingFornecedorId || gerarId().toString(),
    nomeEmpresa: nome,
    cnpj: document.getElementById('fornecedorCNPJ')?.value || '',
    telefone: document.getElementById('fornecedorTelefone')?.value || '',
    email: document.getElementById('fornecedorEmail')?.value || '',
    uf: document.getElementById('fornecedorUF')?.value || '',
    produtosIds: []
  };
  
  if (editingFornecedorId) {
    const idx = fornecedores.findIndex(f => f.id === editingFornecedorId);
    if (idx !== -1) fornecedores[idx] = fornData;
  } else {
    fornecedores.push(fornData);
  }
  
  salvarDados();
  document.getElementById('modalFornecedor').style.display = 'none';
  renderFornecedores();
  atualizarSelectsCotacao();
  alert('Fornecedor salvo!');
}

// ================== INICIALIZAÇÃO ==================
function init() {
  console.log('🚀 Inicializando sistema de cotações...');
  carregarDados();
  
  renderCotacoes();
  renderHistorico();
  renderProdutos();
  renderFornecedores();
  
  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const tabId = btn.dataset.tab + 'Tab';
      const tab = document.getElementById(tabId);
      if (tab) tab.classList.add('active');
    });
  });
  
  // Eventos dos botões principais
  document.getElementById('addCotacaoBtn')?.addEventListener('click', abrirModalCotacao);
  document.getElementById('addProdutoBtn')?.addEventListener('click', () => {
    editingProdutoId = null;
    document.getElementById('formProduto')?.reset();
    document.getElementById('modalProduto').style.display = 'block';
  });
  document.getElementById('addFornecedorBtn')?.addEventListener('click', () => {
    editingFornecedorId = null;
    document.getElementById('formFornecedor')?.reset();
    document.getElementById('modalFornecedor').style.display = 'block';
  });
  
  // Forms
  document.getElementById('formCotacao')?.addEventListener('submit', salvarCotacao);
  document.getElementById('formProduto')?.addEventListener('submit', salvarProduto);
  document.getElementById('formFornecedor')?.addEventListener('submit', salvarFornecedor);
  
  // Fechar modais ao clicar fora
  window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
      event.target.style.display = 'none';
    }
  };
  
  // Eventos de clique para editar/excluir (delegação)
  document.addEventListener('click', function(e) {
    const editCot = e.target.closest('.edit-cotacao');
    if (editCot) {
      alert('Editar cotação ID: ' + editCot.dataset.id);
    }
    
    const delCot = e.target.closest('.delete-cotacao');
    if (delCot) {
      if (confirm('Excluir esta cotação?')) {
        cotacoes = cotacoes.filter(c => c.id != delCot.dataset.id);
        salvarDados();
        renderCotacoes();
      }
    }
    
    const editProd = e.target.closest('.btn-editar-produto');
    if (editProd) {
      alert('Editar produto ID: ' + editProd.dataset.id);
    }
    
    const delProd = e.target.closest('.btn-excluir-produto');
    if (delProd) {
      if (confirm('Excluir este produto?')) {
        produtos = produtos.filter(p => p.id != delProd.dataset.id);
        salvarDados();
        renderProdutos();
      }
    }
    
    const editForn = e.target.closest('.btn-editar-fornecedor');
    if (editForn) {
      alert('Editar fornecedor ID: ' + editForn.dataset.id);
    }
    
    const delForn = e.target.closest('.btn-excluir-fornecedor');
    if (delForn) {
      if (confirm('Excluir este fornecedor?')) {
        fornecedores = fornecedores.filter(f => f.id != delForn.dataset.id);
        salvarDados();
        renderFornecedores();
      }
    }
  });
  
  // Selecionar todos
  document.getElementById('selecionarTodos')?.addEventListener('change', function() {
    document.querySelectorAll('.select-cotacao').forEach(cb => cb.checked = this.checked);
  });
  
  console.log('✅ Sistema de cotações pronto!');
}

document.addEventListener('DOMContentLoaded', init);
