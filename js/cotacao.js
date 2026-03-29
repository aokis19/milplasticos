// cotacao.js
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
  try {
    const d = new Date(dataStr);
    return d.toLocaleDateString('pt-BR');
  } catch {
    return dataStr;
  }
}

function gerarId() {
  return Date.now();
}

function salvarDados() {
  localStorage.setItem('produtos', JSON.stringify(produtos));
  localStorage.setItem('cotacoes', JSON.stringify(cotacoes));
  localStorage.setItem('historico', JSON.stringify(historico));
  localStorage.setItem('fornecedores', JSON.stringify(fornecedores));
  console.log('Dados salvos:', { produtos: produtos.length, cotacoes: cotacoes.length, historico: historico.length });
}

function carregarDados() {
  produtos = JSON.parse(localStorage.getItem('produtos')) || [];
  cotacoes = JSON.parse(localStorage.getItem('cotacoes')) || [];
  historico = JSON.parse(localStorage.getItem('historico')) || [];
  fornecedores = JSON.parse(localStorage.getItem('fornecedores')) || [];
  
  if (produtos.length === 0) {
    produtos = [
      { id: 1, nome: "GotaLube Sp", codigo: "GL-001", categoria: "Lubrificantes", unidadePadrao: "kg" },
      { id: 2, nome: "Sacaria Plástica", codigo: "SP-100", categoria: "Embalagens", unidadePadrao: "un" }
    ];
    fornecedores = [
      { id: 1, nomeEmpresa: "LMJ Plásticos", produtosIds: [1] },
      { id: 2, nomeEmpresa: "PlastTotal", produtosIds: [1] }
    ];
    salvarDados();
  }
}

function calcularImpostos(qtd, vu, icms, ipi) {
  const bruto = qtd * vu;
  const valorIcms = bruto * (icms / 100);
  const valorIpi = bruto * (ipi / 100);
  return { bruto, valorIcms, valorIpi, total: bruto + valorIcms + valorIpi };
}

// ================== RENDERIZAÇÃO ==================
function renderCotacoes() {
  const container = document.getElementById('cotacoesContainer');
  const empty = document.getElementById('emptyState');
  if (!container) return;
  
  const ativas = cotacoes.filter(c => c.status !== "finalizado");
  if (ativas.length === 0) {
    container.innerHTML = '';
    if (empty) empty.style.display = 'flex';
    return;
  }
  if (empty) empty.style.display = 'none';
  
  container.innerHTML = ativas.map(cot => {
    const prod = produtos.find(p => p.id === cot.produtoId) || { nome: 'Produto' };
    const { total } = calcularImpostos(cot.quantidade, cot.valorUnitario, cot.icms, cot.ipi || 0);
    return `<div class="table-row" data-id="${cot.id}">
      <div class="checkbox-column"><input type="checkbox" class="select-cotacao" value="${cot.id}"></div>
      <div><strong>${prod.nome}</strong></div>
      <div>${cot.fornecedor}</div>
      <div>${cot.uf || '-'}</div>
      <div>${cot.quantidade} ${cot.unidade}</div>
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
  
  const filtroProd = document.getElementById('filtroProduto')?.value.toLowerCase() || '';
  const filtroForn = document.getElementById('filtroFornecedor')?.value.toLowerCase() || '';
  const periodo = document.getElementById('filtroPeriodo')?.value || 'todos';
  
  let lista = [...historico];
  if (filtroProd) lista = lista.filter(i => i.produto?.toLowerCase().includes(filtroProd));
  if (filtroForn) lista = lista.filter(i => i.fornecedor?.toLowerCase().includes(filtroForn));
  if (periodo !== 'todos') {
    const dias = parseInt(periodo);
    const limite = new Date();
    limite.setDate(limite.getDate() - dias);
    lista = lista.filter(i => new Date(i.dataFinalizacao || i.dataCotacao) >= limite);
  }
  
  if (lista.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-history"></i><h3>Nenhum histórico</h3></div>';
    return;
  }
  
  container.innerHTML = lista.map(item => {
    const { total } = calcularImpostos(item.quantidade, item.valorUnitario, item.icms, item.ipi || 0);
    return `<div class="historico-item">
      <div class="historico-item-header">
        <div class="historico-produto"><i class="fas fa-box"></i> ${item.produto}</div>
        <div class="historico-data">${formatarData(item.dataFinalizacao || item.dataCotacao)}</div>
      </div>
      <div class="historico-detalhes">
        <div><strong>Fornecedor:</strong> ${item.fornecedor}</div>
        <div><strong>UF:</strong> ${item.uf || '-'}</div>
        <div><strong>Qtd:</strong> ${item.quantidade} ${item.unidade}</div>
        <div><strong>Valor Unit.:</strong> ${formatarMoeda(item.valorUnitario)}</div>
        <div><strong>Valor Total:</strong> ${formatarMoeda(total)}</div>
        <div><strong>Prazo:</strong> ${item.prazoPagamento || '-'}</div>
        <div><strong>Entrega:</strong> ${item.dataEntrega ? formatarData(item.dataEntrega) : '-'}</div>
      </div>
      <div class="historico-actions">
        <button class="btn-small btn-pdf-historico" data-id="${item.id}"><i class="fas fa-file-pdf"></i> PDF</button>
        <button class="btn-small btn-delete-historico" style="background:#e74c3c" data-id="${item.id}"><i class="fas fa-trash"></i> Excluir</button>
      </div>
    </div>`;
  }).join('');
  
  // Reatribuir eventos após renderizar
  document.querySelectorAll('.btn-pdf-historico').forEach(btn => {
    btn.onclick = () => gerarPdfHistoricoItem(parseInt(btn.dataset.id));
  });
  document.querySelectorAll('.btn-delete-historico').forEach(btn => {
    btn.onclick = () => excluirItemHistorico(parseInt(btn.dataset.id));
  });
}

function renderProdutos() {
  const container = document.getElementById('produtosContainer');
  const empty = document.getElementById('emptyProdutos');
  if (!container) return;
  
  if (produtos.length === 0) {
    container.innerHTML = '';
    if (empty) empty.style.display = 'flex';
    return;
  }
  if (empty) empty.style.display = 'none';
  
  container.innerHTML = produtos.map(p => `<div class="produto-card">
    <h3>${p.nome}</h3>
    <p><i class="fas fa-barcode"></i> Código: ${p.codigo || '-'}</p>
    <p><i class="fas fa-tag"></i> Categoria: ${p.categoria || '-'}</p>
    <p><i class="fas fa-ruler"></i> Unidade: ${p.unidadePadrao}</p>
    <div class="produto-actions">
      <button class="btn-icon btn-editar-produto" data-id="${p.id}"><i class="fas fa-edit"></i></button>
      <button class="btn-icon delete btn-excluir-produto" data-id="${p.id}"><i class="fas fa-trash"></i></button>
    </div>
  </div>`).join('');
  
  document.querySelectorAll('.btn-editar-produto').forEach(btn => {
    btn.onclick = () => editarProduto(parseInt(btn.dataset.id));
  });
  document.querySelectorAll('.btn-excluir-produto').forEach(btn => {
    btn.onclick = () => excluirProduto(parseInt(btn.dataset.id));
  });
}

function renderFornecedores() {
  const container = document.getElementById('fornecedoresContainer');
  const empty = document.getElementById('emptyFornecedores');
  if (!container) return;
  
  if (fornecedores.length === 0) {
    container.innerHTML = '';
    if (empty) empty.style.display = 'flex';
    return;
  }
  if (empty) empty.style.display = 'none';
  
  container.innerHTML = fornecedores.map(f => `<div class="fornecedor-card">
    <h3>${f.nomeEmpresa}</h3>
    <p><i class="fas fa-id-card"></i> ${f.cnpj || '-'}</p>
    <p><i class="fas fa-map-marker-alt"></i> ${f.endereco || '-'}</p>
    <p><i class="fas fa-user"></i> ${f.vendedor || '-'}</p>
    <p><i class="fas fa-phone"></i> ${f.telefone || '-'}</p>
    <p><i class="fas fa-envelope"></i> ${f.email || '-'}</p>
    <div class="produtos-list"><strong>Produtos:</strong> ${(f.produtosIds || []).map(id => produtos.find(p => p.id == id)?.nome).filter(n => n).join(', ') || '-'}</div>
    <div class="fornecedor-actions">
      <button class="btn-icon btn-editar-fornecedor" data-id="${f.id}"><i class="fas fa-edit"></i></button>
      <button class="btn-icon delete btn-excluir-fornecedor" data-id="${f.id}"><i class="fas fa-trash"></i></button>
    </div>
  </div>`).join('');
  
  document.querySelectorAll('.btn-editar-fornecedor').forEach(btn => {
    btn.onclick = () => editarFornecedor(btn.dataset.id);
  });
  document.querySelectorAll('.btn-excluir-fornecedor').forEach(btn => {
    btn.onclick = () => excluirFornecedor(btn.dataset.id);
  });
}

// ================== COTAÇÕES CRUD ==================
function abrirModalCotacao(cotacao = null) {
  editingId = cotacao?.id || null;
  document.getElementById('modalTitle').textContent = cotacao ? 'Editar Cotação' : 'Nova Cotação';
  const hoje = new Date().toISOString().split('T')[0];
  document.getElementById('dataCotacao').value = cotacao?.dataCotacao || hoje;
  document.getElementById('dataEntrega').value = cotacao?.dataEntrega || hoje;
  document.getElementById('produtoSelect').value = cotacao?.produtoId || '';
  document.getElementById('fornecedorSelect').value = cotacao?.fornecedor || '';
  document.getElementById('uf').value = cotacao?.uf || '';
  document.getElementById('quantidade').value = cotacao?.quantidade || '';
  document.getElementById('unidade').value = cotacao?.unidade || '';
  document.getElementById('valorUnitario').value = cotacao?.valorUnitario || '';
  document.getElementById('icms').value = cotacao?.icms || 18;
  document.getElementById('bicms').value = cotacao?.bicms || 100;
  document.getElementById('ipi').value = cotacao?.ipi || 0;
  document.getElementById('prazoPagamento').value = cotacao?.prazoPagamento || '';
  document.getElementById('frete').value = cotacao?.frete || '';
  document.getElementById('regimeTributario').value = cotacao?.regimeTributario || '';
  document.getElementById('ncm').value = cotacao?.ncm || '';
  document.getElementById('observacoes').value = cotacao?.observacoes || '';
  document.getElementById('salvarHistorico').checked = cotacao?.salvarHistorico !== false;
  
  atualizarSelectProdutos();
  atualizarSelectFornecedores();
  atualizarPreview();
  document.getElementById('cotacaoModal').style.display = 'flex';
}

function fecharModalCotacao() {
  document.getElementById('cotacaoModal').style.display = 'none';
  editingId = null;
}

function salvarCotacao() {
  console.log('salvarCotacao chamado');
  
  const produtoId = document.getElementById('produtoSelect').value;
  if (!produtoId) { alert('Selecione um produto'); return; }
  
  const fornecedor = document.getElementById('fornecedorSelect').value;
  if (!fornecedor) { alert('Selecione um fornecedor'); return; }
  
  const produto = produtos.find(p => p.id == produtoId);
  if (!produto) { alert('Produto não encontrado'); return; }
  
  const qtd = parseFloat(document.getElementById('quantidade').value) || 0;
  const vu = parseFloat(document.getElementById('valorUnitario').value) || 0;
  const icms = parseFloat(document.getElementById('icms').value) || 0;
  const ipi = parseFloat(document.getElementById('ipi').value) || 0;
  const { bruto, valorIcms, valorIpi, total } = calcularImpostos(qtd, vu, icms, ipi);
  
  const cotacaoData = {
    id: editingId || gerarId(),
    produtoId: parseInt(produtoId),
    produto: produto.nome,
    fornecedor: fornecedor,
    uf: document.getElementById('uf').value,
    dataCotacao: document.getElementById('dataCotacao').value,
    quantidade: qtd,
    unidade: document.getElementById('unidade').value,
    valorUnitario: vu,
    icms: icms,
    bicms: document.getElementById('bicms').value,
    ipi: ipi,
    prazoPagamento: document.getElementById('prazoPagamento').value,
    frete: document.getElementById('frete').value,
    dataEntrega: document.getElementById('dataEntrega').value,
    regimeTributario: document.getElementById('regimeTributario').value,
    ncm: document.getElementById('ncm').value,
    observacoes: document.getElementById('observacoes').value,
    valorBruto: bruto,
    valorIcms: valorIcms,
    valorIpi: valorIpi,
    valorTotal: total,
    status: "ativo",
    salvarHistorico: document.getElementById('salvarHistorico').checked,
    dataCadastro: new Date().toISOString()
  };
  
  console.log('Salvando cotação:', cotacaoData);
  
  if (editingId) {
    const idx = cotacoes.findIndex(c => c.id === editingId);
    if (idx !== -1) cotacoes[idx] = cotacaoData;
  } else {
    cotacoes.push(cotacaoData);
  }
  
  salvarDados();
  fecharModalCotacao();
  renderCotacoes();
  
  if (cotacaoData.salvarHistorico) {
    historico.push({ ...cotacaoData, dataFinalizacao: new Date().toISOString().split('T')[0] });
    salvarDados();
    renderHistorico();
  }
  
  alert('Cotação salva com sucesso!');
}

function editarCotacao(id) {
  console.log('editarCotacao chamado para id:', id);
  const cot = cotacoes.find(c => c.id == id);
  if (cot) {
    abrirModalCotacao(cot);
  } else {
    alert('Cotação não encontrada');
  }
}

function excluirCotacao(id) {
  console.log('excluirCotacao chamado para id:', id);
  if (confirm('Excluir esta cotação?')) {
    cotacoes = cotacoes.filter(c => c.id != id);
    salvarDados();
    renderCotacoes();
    alert('Cotação excluída!');
  }
}

function finalizarSelecionados() {
  const selecionadas = Array.from(document.querySelectorAll('.select-cotacao:checked')).map(cb => parseInt(cb.value));
  console.log('Finalizar selecionados:', selecionadas);
  
  if (selecionadas.length === 0) { 
    alert('Selecione pelo menos uma cotação'); 
    return; 
  }
  
  if (!confirm(`Finalizar ${selecionadas.length} orçamento(s)?`)) return;
  
  selecionadas.forEach(id => {
    const cot = cotacoes.find(c => c.id === id);
    if (cot) {
      historico.push({ ...cot, dataFinalizacao: new Date().toISOString().split('T')[0], status: 'finalizado' });
      cotacoes = cotacoes.filter(c => c.id !== id);
    }
  });
  salvarDados();
  renderCotacoes();
  renderHistorico();
  alert('Orçamentos finalizados!');
}

function abrirComparativo() {
  const selecionadas = Array.from(document.querySelectorAll('.select-cotacao:checked')).map(cb => parseInt(cb.value));
  console.log('Abrir comparativo com:', selecionadas);
  
  if (selecionadas.length < 2) { 
    alert('Selecione pelo menos 2 cotações'); 
    return; 
  }
  
  const cotSelecionadas = cotacoes.filter(c => selecionadas.includes(c.id));
  const ordenadas = [...cotSelecionadas].sort((a, b) => 
    calcularImpostos(a.quantidade, a.valorUnitario, a.icms, a.ipi || 0).total - 
    calcularImpostos(b.quantidade, b.valorUnitario, b.icms, b.ipi || 0).total
  );
  const melhorTotal = calcularImpostos(ordenadas[0].quantidade, ordenadas[0].valorUnitario, ordenadas[0].icms, ordenadas[0].ipi || 0).total;
  
  let html = `<div class="comparativo-container">
    <div class="comparativo-header-principal">
      <div class="produto-info">
        <div class="produto-nome"><i class="fas fa-box"></i> ${ordenadas[0].produto}</div>
        <div class="produto-detalhes">
          <div><small>Unidade</small><div><strong>${ordenadas[0].unidade}</strong></div></div>
          <div><small>Quantidade</small><div><strong>${ordenadas[0].quantidade}</strong></div></div>
        </div>
      </div>
    </div>
    <div class="resumo-cards">
      <div class="resumo-card total"><div class="resumo-icon total"><i class="fas fa-file-invoice"></i></div><div><div class="resumo-label">Total</div><div class="resumo-value">${ordenadas.length}</div></div></div>
      <div class="resumo-card menor"><div class="resumo-icon menor"><i class="fas fa-trophy"></i></div><div><div class="resumo-label">Menor Preço</div><div class="resumo-value">${formatarMoeda(melhorTotal)}</div></div></div>
      <div class="resumo-card media"><div class="resumo-icon media"><i class="fas fa-chart-line"></i></div><div><div class="resumo-label">Média</div><div class="resumo-value">${formatarMoeda(ordenadas.reduce((a,c)=> a + calcularImpostos(c.quantidade, c.valorUnitario, c.icms, c.ipi||0).total,0)/ordenadas.length)}</div></div></div>
    </div>
    <div class="comparativo-tabela">
      <table>
        <thead><tr><th><input type="checkbox" id="selecionarTodosComparativo" checked></th><th>Fornecedor</th><th>UF</th><th>Valor Unit.</th><th>ICMS</th><th>IPI</th><th>Valor Total</th><th>Prazo</th><th>Entrega</th></tr></thead>
        <tbody>`;
  
  ordenadas.forEach(cot => {
    const { total } = calcularImpostos(cot.quantidade, cot.valorUnitario, cot.icms, cot.ipi || 0);
    html += `<tr class="${total === melhorTotal ? 'melhor-preco' : ''}" data-id="${cot.id}">
      <td><input type="checkbox" class="select-comparativo" checked></td>
      <td><strong>${cot.fornecedor}</strong>${total === melhorTotal ? ' 🏆' : ''}</td>
      <td>${cot.uf || '-'}</td>
      <td>${formatarMoeda(cot.valorUnitario)}</td>
      <td>${cot.icms}%</td>
      <td>${cot.ipi || 0}%</td>
      <td><strong>${formatarMoeda(total)}</strong></td>
      <td>${cot.prazoPagamento || '-'}</td>
      <td>${cot.dataEntrega ? formatarData(cot.dataEntrega) : '-'}</td>
    </tr>`;
  });
  
  html += `</tbody></table></div><div class="observacao-rodape"><i class="fas fa-info-circle"></i> Linhas em verde indicam menor preço</div></div>`;
  
  document.getElementById('comparisonForPdf').innerHTML = html;
  document.getElementById('comparisonModal').style.display = 'flex';
  
  setTimeout(() => {
    const sel = document.getElementById('selecionarTodosComparativo');
    if (sel) sel.onchange = (e) => document.querySelectorAll('.select-comparativo').forEach(cb => cb.checked = e.target.checked);
  }, 100);
}

function finalizarComparados() {
  const selecionadas = Array.from(document.querySelectorAll('.select-comparativo:checked')).map(cb => cb.closest('tr')?.dataset.id).filter(id => id);
  console.log('Finalizar comparados:', selecionadas);
  
  if (selecionadas.length === 0) { 
    alert('Selecione pelo menos um orçamento'); 
    return; 
  }
  
  if (!confirm(`Finalizar ${selecionadas.length} orçamento(s)?`)) return;
  
  selecionadas.forEach(id => {
    const cot = cotacoes.find(c => c.id == id);
    if (cot) {
      historico.push({ ...cot, dataFinalizacao: new Date().toISOString().split('T')[0], status: 'finalizado' });
      cotacoes = cotacoes.filter(c => c.id != id);
    }
  });
  salvarDados();
  renderCotacoes();
  renderHistorico();
  document.getElementById('comparisonModal').style.display = 'none';
  alert('Orçamentos finalizados!');
}

function atualizarPreview() {
  const qtd = parseFloat(document.getElementById('quantidade').value) || 0;
  const vu = parseFloat(document.getElementById('valorUnitario').value) || 0;
  const icms = parseFloat(document.getElementById('icms').value) || 0;
  const ipi = parseFloat(document.getElementById('ipi').value) || 0;
  const { bruto, valorIcms, valorIpi, total } = calcularImpostos(qtd, vu, icms, ipi);
  document.getElementById('valorBrutoPreview').textContent = formatarMoeda(bruto);
  document.getElementById('icmsPercentPreview').textContent = icms;
  document.getElementById('icmsValuePreview').textContent = formatarMoeda(valorIcms);
  document.getElementById('ipiPercentPreview').textContent = ipi;
  document.getElementById('ipiValuePreview').textContent = formatarMoeda(valorIpi);
  document.getElementById('valorTotalPreview').textContent = formatarMoeda(total);
}

function atualizarSelectProdutos() {
  const sel = document.getElementById('produtoSelect');
  if (!sel) return;
  const atual = sel.value;
  sel.innerHTML = '<option value="">Selecione</option>';
  produtos.forEach(p => sel.innerHTML += `<option value="${p.id}" ${atual == p.id ? 'selected' : ''}>${p.nome}</option>`);
}

function atualizarSelectFornecedores() {
  const sel = document.getElementById('fornecedorSelect');
  if (!sel) return;
  const atual = sel.value;
  sel.innerHTML = '<option value="">Selecione</option>';
  fornecedores.forEach(f => sel.innerHTML += `<option value="${f.nomeEmpresa}" ${atual === f.nomeEmpresa ? 'selected' : ''}>${f.nomeEmpresa}</option>`);
}

// ================== PRODUTOS CRUD ==================
function salvarProduto() {
  const nome = document.getElementById('nomeProduto').value.trim();
  if (!nome) { alert('Nome do produto é obrigatório'); return; }
  
  const prodData = {
    id: editingProdutoId || gerarId(),
    nome: nome,
    codigo: document.getElementById('codigoProduto').value,
    categoria: document.getElementById('categoriaProduto').value,
    descricao: document.getElementById('descricaoProduto').value,
    unidadePadrao: document.getElementById('unidadePadrao').value,
    ncm: document.getElementById('ncmProduto').value
  };
  
  if (editingProdutoId) {
    const idx = produtos.findIndex(p => p.id === editingProdutoId);
    if (idx !== -1) produtos[idx] = prodData;
  } else {
    produtos.push(prodData);
  }
  
  salvarDados();
  fecharModalProduto();
  renderProdutos();
  atualizarSelectProdutos();
  alert('Produto salvo!');
}

function excluirProduto(id) {
  if (confirm('Excluir produto?')) {
    produtos = produtos.filter(p => p.id != id);
    salvarDados();
    renderProdutos();
    atualizarSelectProdutos();
    alert('Produto excluído!');
  }
}

function editarProduto(id) {
  const prod = produtos.find(p => p.id == id);
  if (!prod) return;
  editingProdutoId = prod.id;
  document.getElementById('produtoModalTitle').textContent = 'Editar Produto';
  document.getElementById('nomeProduto').value = prod.nome;
  document.getElementById('codigoProduto').value = prod.codigo || '';
  document.getElementById('categoriaProduto').value = prod.categoria || '';
  document.getElementById('descricaoProduto').value = prod.descricao || '';
  document.getElementById('unidadePadrao').value = prod.unidadePadrao || '';
  document.getElementById('ncmProduto').value = prod.ncm || '';
  document.getElementById('produtoModal').style.display = 'flex';
}

function fecharModalProduto() {
  document.getElementById('produtoModal').style.display = 'none';
  document.getElementById('produtoForm').reset();
  editingProdutoId = null;
}

// ================== FORNECEDORES CRUD ==================
function salvarFornecedor() {
  const nome = document.getElementById('nomeEmpresa').value.trim();
  if (!nome) { alert('Nome da empresa é obrigatório'); return; }
  
  const produtosSelecionados = Array.from(document.querySelectorAll('input[name="produtoFornecedor"]:checked')).map(cb => parseInt(cb.value));
  const fornData = {
    id: editingFornecedorId || gerarId(),
    nomeEmpresa: nome,
    cnpj: document.getElementById('cnpj').value,
    endereco: document.getElementById('endereco').value,
    vendedor: document.getElementById('vendedor').value,
    telefone: document.getElementById('telefone').value,
    email: document.getElementById('email').value,
    produtosIds: produtosSelecionados
  };
  
  if (editingFornecedorId) {
    const idx = fornecedores.findIndex(f => f.id === editingFornecedorId);
    if (idx !== -1) fornecedores[idx] = fornData;
  } else {
    fornecedores.push(fornData);
  }
  
  salvarDados();
  fecharModalFornecedor();
  renderFornecedores();
  atualizarSelectFornecedores();
  alert('Fornecedor salvo!');
}

function excluirFornecedor(id) {
  if (confirm('Excluir fornecedor?')) {
    fornecedores = fornecedores.filter(f => f.id != id);
    salvarDados();
    renderFornecedores();
    atualizarSelectFornecedores();
    alert('Fornecedor excluído!');
  }
}

function editarFornecedor(id) {
  const forn = fornecedores.find(f => f.id == id);
  if (!forn) return;
  editingFornecedorId = forn.id;
  document.getElementById('fornecedorModalTitle').textContent = 'Editar Fornecedor';
  document.getElementById('nomeEmpresa').value = forn.nomeEmpresa;
  document.getElementById('cnpj').value = forn.cnpj || '';
  document.getElementById('endereco').value = forn.endereco || '';
  document.getElementById('vendedor').value = forn.vendedor || '';
  document.getElementById('telefone').value = forn.telefone || '';
  document.getElementById('email').value = forn.email || '';
  
  const container = document.getElementById('produtosFornecedorContainer');
  container.innerHTML = produtos.map(p => `<label><input type="checkbox" name="produtoFornecedor" value="${p.id}" ${forn.produtosIds?.includes(p.id) ? 'checked' : ''}> ${p.nome}</label>`).join('');
  document.getElementById('fornecedorModal').style.display = 'flex';
}

function fecharModalFornecedor() {
  document.getElementById('fornecedorModal').style.display = 'none';
  document.getElementById('fornecedorForm').reset();
  editingFornecedorId = null;
}

// ================== PDF ==================
async function exportarParaPDF(elementoId, nomeArquivo) {
  const loading = document.createElement('div');
  loading.className = 'pdf-loading';
  loading.innerHTML = '<div class="pdf-loading-spinner"></div><div>Gerando PDF...</div>';
  document.body.appendChild(loading);
  try {
    const elem = document.getElementById(elementoId);
    const clone = elem.cloneNode(true);
    clone.querySelectorAll('.edit-info-btn, .btn-icon, .actions, .select-comparativo, #selecionarTodosComparativo').forEach(el => el.remove());
    clone.style.width = '1200px';
    clone.style.padding = '20px';
    clone.style.background = 'white';
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:20px;border-bottom:2px solid #3498db;padding-bottom:10px';
    header.innerHTML = '<div style="font-size:24px;font-weight:bold;color:#2c3e50;">Mil Plásticos</div><div>Relatório de Cotações</div>';
    clone.insertBefore(header, clone.firstChild);
    clone.style.position = 'absolute';
    clone.style.left = '-9999px';
    clone.style.top = '0';
    document.body.appendChild(clone);
    const canvas = await html2canvas(clone, { scale: 2, backgroundColor: '#ffffff' });
    document.body.removeChild(clone);
    const pdf = new jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const imgData = canvas.toDataURL('image/png');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(nomeArquivo);
  } catch (error) {
    console.error('Erro PDF:', error);
    alert('Erro ao gerar PDF');
  } finally {
    loading.remove();
  }
}

function gerarPdfHistoricoItem(id) {
  const item = historico.find(h => h.id == id);
  if (!item) return;
  const { total } = calcularImpostos(item.quantidade, item.valorUnitario, item.icms, item.ipi || 0);
  const html = `<div style="padding:20px;font-family:Arial">
    <div style="border-bottom:2px solid #3498db;margin-bottom:20px"><h2>Mil Plásticos</h2><p>Comprovante de Compra</p></div>
    <h3>${item.produto}</h3>
    <p><strong>Fornecedor:</strong> ${item.fornecedor}</p>
    <p><strong>Data Compra:</strong> ${formatarData(item.dataFinalizacao || item.dataCotacao)}</p>
    <p><strong>Quantidade:</strong> ${item.quantidade} ${item.unidade}</p>
    <p><strong>Valor Unitário:</strong> ${formatarMoeda(item.valorUnitario)}</p>
    <p><strong>ICMS (${item.icms}%):</strong> ${formatarMoeda(item.valorIcms)}</p>
    <p><strong>IPI (${item.ipi || 0}%):</strong> ${formatarMoeda(item.valorIpi)}</p>
    <p><strong>Valor Total:</strong> ${formatarMoeda(total)}</p>
    <p><strong>Prazo Pagamento:</strong> ${item.prazoPagamento || '-'}</p>
    <p><strong>Previsão Entrega:</strong> ${item.dataEntrega ? formatarData(item.dataEntrega) : '-'}</p>
    ${item.observacoes ? `<p><strong>Observações:</strong> ${item.observacoes}</p>` : ''}
    <div style="margin-top:30px;text-align:center;color:#999;font-size:10px">Mil Plásticos - Sistema de Cotações</div>
  </div>`;
  const win = window.open();
  win.document.write(html);
  win.document.close();
  win.print();
}

function excluirItemHistorico(id) {
  if (confirm('Excluir item do histórico?')) {
    historico = historico.filter(h => h.id != id);
    salvarDados();
    renderHistorico();
    alert('Item excluído do histórico!');
  }
}

function limparHistorico() {
  if (confirm('Limpar todo o histórico?')) {
    historico = [];
    salvarDados();
    renderHistorico();
    alert('Histórico limpo!');
  }
}

// ================== INICIALIZAÇÃO ==================
function init() {
  console.log('Inicializando sistema de cotações...');
  carregarDados();
  
  renderCotacoes();
  renderHistorico();
  renderProdutos();
  renderFornecedores();
  
  // Eventos das tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab + 'Tab').classList.add('active');
      if (btn.dataset.tab === 'historico') renderHistorico();
      if (btn.dataset.tab === 'produtos') renderProdutos();
      if (btn.dataset.tab === 'fornecedores') renderFornecedores();
    });
  });
  
  // Botão Nova Cotação
  const addBtn = document.getElementById('addCotacaoBtn');
  if (addBtn) {
    addBtn.onclick = () => abrirModalCotacao();
  }
  
  // Botão Comparar Selecionados
  const compararBtn = document.getElementById('compararSelecionadosBtn');
  if (compararBtn) {
    compararBtn.onclick = () => abrirComparativo();
  }
  
  // Botão Finalizar Selecionados
  const finalizarBtn = document.getElementById('finalizarSelecionadosBtn');
  if (finalizarBtn) {
    finalizarBtn.onclick = () => finalizarSelecionados();
  }
  
  // Botão Finalizar Comparados
  const finalizarComparadosBtn = document.getElementById('finalizarComparadosBtn');
  if (finalizarComparadosBtn) {
    finalizarComparadosBtn.onclick = () => finalizarComparados();
  }
  
  // Botão Exportar PDF
  const exportPdfBtn = document.getElementById('exportComparisonPdf');
  if (exportPdfBtn) {
    exportPdfBtn.onclick = () => exportarParaPDF('comparisonForPdf', 'comparativo.pdf');
  }
  
  // Botão Limpar Histórico
  const limparHistoricoBtn = document.getElementById('limparHistoricoBtn');
  if (limparHistoricoBtn) {
    limparHistoricoBtn.onclick = () => limparHistorico();
  }
  
  // Botão Novo Produto
  const addProdutoBtn = document.getElementById('addProdutoBtn');
  if (addProdutoBtn) {
    addProdutoBtn.onclick = () => {
      editingProdutoId = null;
      document.getElementById('produtoModalTitle').textContent = 'Cadastrar Produto';
      document.getElementById('produtoForm').reset();
      document.getElementById('produtoModal').style.display = 'flex';
    };
  }
  
  // Botão Salvar Produto
  const saveProdutoBtn = document.getElementById('saveProdutoBtn');
  if (saveProdutoBtn) {
    saveProdutoBtn.onclick = () => salvarProduto();
  }
  
  // Botões fechar modal produto
  const closeProdutoModal = document.getElementById('closeProdutoModal');
  if (closeProdutoModal) closeProdutoModal.onclick = () => fecharModalProduto();
  const cancelProdutoBtn = document.getElementById('cancelProdutoBtn');
  if (cancelProdutoBtn) cancelProdutoBtn.onclick = () => fecharModalProduto();
  
  // Botão Novo Fornecedor
  const addFornecedorBtn = document.getElementById('addFornecedorBtn');
  if (addFornecedorBtn) {
    addFornecedorBtn.onclick = () => {
      editingFornecedorId = null;
      document.getElementById('fornecedorModalTitle').textContent = 'Cadastrar Fornecedor';
      document.getElementById('fornecedorForm').reset();
      const container = document.getElementById('produtosFornecedorContainer');
      container.innerHTML = produtos.map(p => `<label><input type="checkbox" name="produtoFornecedor" value="${p.id}"> ${p.nome}</label>`).join('');
      document.getElementById('fornecedorModal').style.display = 'flex';
    };
  }
  
  // Botão Salvar Fornecedor
  const saveFornecedorBtn = document.getElementById('saveFornecedorBtn');
  if (saveFornecedorBtn) {
    saveFornecedorBtn.onclick = () => salvarFornecedor();
  }
  
  // Botões fechar modal fornecedor
  const closeFornecedorModal = document.getElementById('closeFornecedorModal');
  if (closeFornecedorModal) closeFornecedorModal.onclick = () => fecharModalFornecedor();
  const cancelFornecedorBtn = document.getElementById('cancelFornecedorBtn');
  if (cancelFornecedorBtn) cancelFornecedorBtn.onclick = () => fecharModalFornecedor();
  
  // Botão Salvar Cotação
  const saveCotacaoBtn = document.getElementById('saveCotacaoBtn');
  if (saveCotacaoBtn) {
    saveCotacaoBtn.onclick = () => salvarCotacao();
  }
  
  // Botões fechar modal cotação
  const cancelBtn = document.getElementById('cancelBtn');
  if (cancelBtn) cancelBtn.onclick = () => fecharModalCotacao();
  const closeModal = document.getElementById('closeModal');
  if (closeModal) closeModal.onclick = () => fecharModalCotacao();
  
  // Botões fechar modal comparativo
  const closeComparisonModal = document.getElementById('closeComparisonModal');
  if (closeComparisonModal) closeComparisonModal.onclick = () => document.getElementById('comparisonModal').style.display = 'none';
  const closeComparisonBtn = document.getElementById('closeComparisonBtn');
  if (closeComparisonBtn) closeComparisonBtn.onclick = () => document.getElementById('comparisonModal').style.display = 'none';
  
  // Botões Novo Produto/Fornecedor nos modais
  const novoProdutoModalBtn = document.getElementById('novoProdutoModalBtn');
  if (novoProdutoModalBtn) {
    novoProdutoModalBtn.onclick = () => {
      document.getElementById('cotacaoModal').style.display = 'none';
      editingProdutoId = null;
      document.getElementById('produtoModalTitle').textContent = 'Cadastrar Produto';
      document.getElementById('produtoForm').reset();
      document.getElementById('produtoModal').style.display = 'flex';
    };
  }
  
  const novoFornecedorModalBtn = document.getElementById('novoFornecedorModalBtn');
  if (novoFornecedorModalBtn) {
    novoFornecedorModalBtn.onclick = () => {
      document.getElementById('cotacaoModal').style.display = 'none';
      editingFornecedorId = null;
      document.getElementById('fornecedorModalTitle').textContent = 'Cadastrar Fornecedor';
      document.getElementById('fornecedorForm').reset();
      const container = document.getElementById('produtosFornecedorContainer');
      container.innerHTML = produtos.map(p => `<label><input type="checkbox" name="produtoFornecedor" value="${p.id}"> ${p.nome}</label>`).join('');
      document.getElementById('fornecedorModal').style.display = 'flex';
    };
  }
  
  // Filtros do histórico
  const filtroProduto = document.getElementById('filtroProduto');
  if (filtroProduto) filtroProduto.addEventListener('input', () => renderHistorico());
  const filtroFornecedor = document.getElementById('filtroFornecedor');
  if (filtroFornecedor) filtroFornecedor.addEventListener('input', () => renderHistorico());
  const filtroPeriodo = document.getElementById('filtroPeriodo');
  if (filtroPeriodo) filtroPeriodo.addEventListener('change', () => renderHistorico());
  
  // Preview em tempo real
  const quantidadeInput = document.getElementById('quantidade');
  if (quantidadeInput) quantidadeInput.addEventListener('input', () => atualizarPreview());
  const valorUnitarioInput = document.getElementById('valorUnitario');
  if (valorUnitarioInput) valorUnitarioInput.addEventListener('input', () => atualizarPreview());
  const icmsInput = document.getElementById('icms');
  if (icmsInput) icmsInput.addEventListener('input', () => atualizarPreview());
  const ipiInput = document.getElementById('ipi');
  if (ipiInput) ipiInput.addEventListener('input', () => atualizarPreview());
  
  // Selecionar todos
  const selecionarTodos = document.getElementById('selecionarTodos');
  if (selecionarTodos) {
    selecionarTodos.onchange = (e) => {
      document.querySelectorAll('.select-cotacao').forEach(cb => cb.checked = e.target.checked);
    };
  }
  
  // Eventos de editar/excluir cotação (delegation)
  document.addEventListener('click', function(e) {
    const editBtn = e.target.closest('.edit-cotacao');
    if (editBtn) {
      const id = parseInt(editBtn.dataset.id);
      editarCotacao(id);
    }
    
    const deleteBtn = e.target.closest('.delete-cotacao');
    if (deleteBtn) {
      const id = parseInt(deleteBtn.dataset.id);
      excluirCotacao(id);
    }
  });
  
  console.log('Sistema inicializado com sucesso!');
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', init);