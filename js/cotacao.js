// cotacao.js - Versão Melhorada com ICMS, Comparativo e PDF
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

function formatarNumero(valor, casas = 2) {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(valor || 0);
}

function formatarData(dataStr) {
  if (!dataStr) return '';
  try { const d = new Date(dataStr + 'T00:00:00'); return d.toLocaleDateString('pt-BR'); } catch { return dataStr; }
}

function formatarDataHora(dataStr) {
  if (!dataStr) return '';
  try { const d = new Date(dataStr); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR'); } catch { return dataStr; }
}

function gerarId() { return Date.now() + Math.random() * 1000; }

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
      { id: 1, nome: "GotaLube SP", codigo: "GL-001", categoria: "Lubrificantes", unidadePadrao: "kg", ncm: "2710.19.90" },
      { id: 2, nome: "Sacaria Plástica", codigo: "SP-100", categoria: "Embalagens", unidadePadrao: "un", ncm: "3923.21.90" }
    ];
  }
  if (fornecedores.length === 0) {
    fornecedores = [
      { id: '1', nomeEmpresa: "LMJ Plásticos", cnpj: "12.345.678/0001-99", ie: "123.456.789", telefone: "(11) 99999-9999", email: "contato@lmjplasticos.com.br", uf: "SP", produtosIds: [1] },
      { id: '2', nomeEmpresa: "PlastTotal", cnpj: "98.765.432/0001-11", ie: "987.654.321", telefone: "(11) 88888-8888", email: "vendas@plasttotal.com", uf: "SP", produtosIds: [1] }
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
    const totalComImpostos = total + (cot.valorFrete || 0) + (cot.valorIPI || 0) + (cot.valorICMS || 0);
    
    return `<div class="table-row" data-id="${cot.id}">
      <div class="checkbox-column"><input type="checkbox" class="select-cotacao" value="${cot.id}"></div>
      <div><strong>${prod.nome}</strong></div>
      <div>${cot.fornecedor || '-'}</div>
      <div>${cot.uf || '-'}</div>
      <div>${cot.quantidade || 0}</div>
      <div>${formatarMoeda(cot.valorUnitario)}</div>
      <div><strong>${formatarMoeda(total)}</strong></div>
      <div>${formatarMoeda(totalComImpostos)}</div>
      <div>${cot.dataEntrega ? formatarData(cot.dataEntrega) : '-'}</div>
      <div>
        <span class="status-badge ${cot.status === 'ativo' ? 'status-ativo' : 'status-pendente'}">${cot.status || 'Ativo'}</span>
      </div>
      <div class="actions">
        <button class="btn-icon edit-cotacao" data-id="${cot.id}" title="Editar"><i class="fas fa-edit"></i></button>
        <button class="btn-icon delete delete-cotacao" data-id="${cot.id}" title="Excluir"><i class="fas fa-trash"></i></button>
        <button class="btn-icon view-cotacao" data-id="${cot.id}" title="Ver detalhes"><i class="fas fa-eye"></i></button>
      </div>
    </div>`;
  }).join('');
}

function renderHistorico() {
  const container = document.getElementById('historicoContainer');
  if (!container) return;
  
  const filtroProd = document.getElementById('filtroProduto')?.value?.toLowerCase() || '';
  const filtroForn = document.getElementById('filtroFornecedor')?.value?.toLowerCase() || '';
  const periodo = document.getElementById('filtroPeriodo')?.value || 'todos';
  
  let lista = [...historico];
  if (filtroProd) lista = lista.filter(i => (i.produto || '').toLowerCase().includes(filtroProd));
  if (filtroForn) lista = lista.filter(i => (i.fornecedor || '').toLowerCase().includes(filtroForn));
  
  if (periodo !== 'todos') {
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - parseInt(periodo));
    lista = lista.filter(i => new Date(i.dataFinalizacao || i.dataCotacao) >= dataLimite);
  }
  
  if (lista.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-history"></i><h3>Nenhum histórico encontrado</h3></div>';
    return;
  }
  
  container.innerHTML = lista.map(item => {
    const total = (item.quantidade || 0) * (item.valorUnitario || 0);
    const totalComImpostos = total + (item.valorFrete || 0) + (item.valorIPI || 0) + (item.valorICMS || 0);
    
    return `<div class="historico-item">
      <div class="historico-item-header">
        <div class="historico-produto"><i class="fas fa-box"></i> ${item.produto || '-'}</div>
        <div class="historico-data">${formatarDataHora(item.dataFinalizacao || item.dataCotacao)}</div>
      </div>
      <div class="historico-detalhes">
        <div><strong>Fornecedor:</strong> ${item.fornecedor || '-'}</div>
        <div><strong>Qtd:</strong> ${item.quantidade || 0}</div>
        <div><strong>Valor Unit.:</strong> ${formatarMoeda(item.valorUnitario)}</div>
        <div><strong>Subtotal:</strong> ${formatarMoeda(total)}</div>
        <div><strong>ICMS:</strong> ${item.aliquotaICMS || 0}% (${formatarMoeda(item.valorICMS || 0)})</div>
        <div><strong>IPI:</strong> ${item.aliquotaIPI || 0}% (${formatarMoeda(item.valorIPI || 0)})</div>
        <div><strong>Frete:</strong> ${formatarMoeda(item.valorFrete || 0)}</div>
        <div><strong>Total c/ Impostos:</strong> ${formatarMoeda(totalComImpostos)}</div>
      </div>
    </div>`;
  }).join('');
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
      <p><i class="fas fa-file-invoice"></i> NCM: ${p.ncm || '-'}</p>
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
      <p><i class="fas fa-id-card"></i> CNPJ: ${f.cnpj || '-'}</p>
      <p><i class="fas fa-id-card"></i> IE: ${f.ie || '-'}</p>
      <p><i class="fas fa-phone"></i> ${f.telefone || '-'}</p>
      <p><i class="fas fa-envelope"></i> ${f.email || '-'}</p>
      <p><i class="fas fa-map-marker-alt"></i> UF: ${f.uf || '-'}</p>
      <div class="fornecedor-actions">
        <button class="btn-icon btn-editar-fornecedor" data-id="${f.id}"><i class="fas fa-edit"></i></button>
        <button class="btn-icon delete btn-excluir-fornecedor" data-id="${f.id}"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}

// ================== COMPARATIVO ==================
function compararSelecionados() {
  const selecionados = document.querySelectorAll('.select-cotacao:checked');
  if (selecionados.length < 2) {
    alert('Selecione pelo menos 2 cotações para comparar');
    return;
  }
  
  const ids = Array.from(selecionados).map(cb => parseInt(cb.value));
  const itens = cotacoes.filter(c => ids.includes(c.id) && c.status !== "finalizado");
  
  if (itens.length < 2) {
    alert('Selecione pelo menos 2 cotações ativas');
    return;
  }
  
  // Abrir modal de comparativo
  const modal = document.getElementById('modalComparativo');
  const body = document.getElementById('comparativoBody');
  
  let html = `
    <div class="comparativo-container">
      <div class="resumo-cards">
        <div class="resumo-card total">
          <div class="resumo-icon total"><i class="fas fa-file-invoice"></i></div>
          <div>
            <div class="resumo-label">Cotações Comparadas</div>
            <div class="resumo-value">${itens.length}</div>
          </div>
        </div>
        <div class="resumo-card total">
          <div class="resumo-icon total"><i class="fas fa-boxes"></i></div>
          <div>
            <div class="resumo-label">Produtos</div>
            <div class="resumo-value">${new Set(itens.map(i => i.produto)).size}</div>
          </div>
        </div>
        <div class="resumo-card total">
          <div class="resumo-icon total"><i class="fas fa-truck"></i></div>
          <div>
            <div class="resumo-label">Fornecedores</div>
            <div class="resumo-value">${new Set(itens.map(i => i.fornecedor)).size}</div>
          </div>
        </div>
      </div>
      
      <div class="comparativo-tabela">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Produto</th>
              <th>Fornecedor</th>
              <th>UF</th>
              <th>Quantidade</th>
              <th>Valor Unit.</th>
              <th>Subtotal</th>
              <th>ICMS</th>
              <th>IPI</th>
              <th>Frete</th>
              <th>Total c/ Impostos</th>
              <th>Entrega</th>
            </tr>
          </thead>
          <tbody>
  `;
  
  let menorTotal = Infinity;
  let menorId = null;
  
  itens.forEach(item => {
    const total = (item.quantidade || 0) * (item.valorUnitario || 0);
    const totalComImpostos = total + (item.valorFrete || 0) + (item.valorIPI || 0) + (item.valorICMS || 0);
    if (totalComImpostos < menorTotal) {
      menorTotal = totalComImpostos;
      menorId = item.id;
    }
  });
  
  itens.forEach((item, idx) => {
    const total = (item.quantidade || 0) * (item.valorUnitario || 0);
    const totalComImpostos = total + (item.valorFrete || 0) + (item.valorIPI || 0) + (item.valorICMS || 0);
    const isMelhor = item.id === menorId;
    
    html += `
      <tr class="${isMelhor ? 'melhor-preco' : ''}">
        <td>${idx + 1}</td>
        <td><strong>${item.produto || '-'}</strong></td>
        <td>${item.fornecedor || '-'}</td>
        <td>${item.uf || '-'}</td>
        <td>${item.quantidade || 0}</td>
        <td>${formatarMoeda(item.valorUnitario)}</td>
        <td>${formatarMoeda(total)}</td>
        <td>${item.aliquotaICMS || 0}%<br><small>${formatarMoeda(item.valorICMS || 0)}</small></td>
        <td>${item.aliquotaIPI || 0}%<br><small>${formatarMoeda(item.valorIPI || 0)}</small></td>
        <td>${formatarMoeda(item.valorFrete || 0)}</td>
        <td><strong>${formatarMoeda(totalComImpostos)}</strong> ${isMelhor ? '🏆' : ''}</td>
        <td>${item.dataEntrega ? formatarData(item.dataEntrega) : '-'}</td>
      </tr>
    `;
  });
  
  html += `
          </tbody>
        </table>
      </div>
      
      <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
        <button class="btn btn-success" onclick="gerarPDFComparativo()">
          <i class="fas fa-file-pdf"></i> Gerar PDF
        </button>
        <button class="btn btn-primary" onclick="finalizarMelhorCotacao()">
          <i class="fas fa-check-circle"></i> Finalizar Melhor Cotação
        </button>
      </div>
    </div>
  `;
  
  body.innerHTML = html;
  modal.style.display = 'block';
}

// ================== PDF DO COMPARATIVO ==================
function gerarPDFComparativo() {
  const loading = document.getElementById('pdfLoading');
  loading.style.display = 'flex';
  
  setTimeout(() => {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = 297;
      const margin = 15;
      let y = margin;
      
      // Cabeçalho
      doc.setFillColor(52, 152, 219);
      doc.rect(0, 0, pageWidth, 30, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('📊 Comparativo de Cotações', pageWidth / 2, 18, { align: 'center' });
      
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, margin, 38);
      
      y = 45;
      
      // Dados do comparativo
      const body = document.querySelector('.comparativo-tabela table');
      if (body) {
        // Capturar dados da tabela
        const rows = body.querySelectorAll('tbody tr');
        const headers = body.querySelectorAll('thead th');
        
        // Configurar colunas
        const colWidths = [8, 30, 25, 15, 18, 20, 25, 22, 22, 22, 30, 25];
        let x = margin;
        
        // Cabeçalho
        doc.setFillColor(44, 62, 80);
        doc.rect(margin, y - 4, pageWidth - (margin * 2), 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        
        headers.forEach((th, i) => {
          if (i < colWidths.length) {
            doc.text(th.textContent.trim(), x + 1, y + 3);
            x += colWidths[i];
          }
        });
        
        y += 8;
        doc.setTextColor(50, 50, 50);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        
        // Dados
        rows.forEach((row, rowIdx) => {
          const cells = row.querySelectorAll('td');
          x = margin;
          
          // Alternar cores
          if (rowIdx % 2 === 0) {
            doc.setFillColor(245, 245, 245);
            doc.rect(margin, y - 3, pageWidth - (margin * 2), 6, 'F');
          }
          
          // Verificar se é o melhor preço
          const isMelhor = row.classList.contains('melhor-preco');
          if (isMelhor) {
            doc.setFillColor(212, 237, 218);
            doc.rect(margin, y - 3, pageWidth - (margin * 2), 6, 'F');
          }
          
          cells.forEach((cell, i) => {
            if (i < colWidths.length) {
              const text = cell.textContent.trim();
              doc.setTextColor(isMelhor ? 0 : 50, isMelhor ? 100 : 50, isMelhor ? 0 : 50);
              doc.text(text, x + 1, y + 3);
              x += colWidths[i];
            }
          });
          
          y += 7;
          
          // Nova página se necessário
          if (y > 190) {
            doc.addPage();
            y = margin + 10;
          }
        });
      }
      
      // Rodapé
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, 190, pageWidth - margin, 190);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('Mil Plásticos - Sistema de Cotações', margin, 197);
      doc.text(`Página ${doc.internal.getCurrentPageInfo().pageNumber}`, pageWidth - margin, 197, { align: 'right' });
      
      doc.save('comparativo_cotacoes.pdf');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF. Tente novamente.');
    }
    
    loading.style.display = 'none';
  }, 500);
}

// ================== FINALIZAR COTAÇÃO ==================
function finalizarMelhorCotacao() {
  const body = document.getElementById('comparativoBody');
  const rows = body.querySelectorAll('.comparativo-tabela tbody tr');
  
  let melhorRow = null;
  let melhorTotal = Infinity;
  
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length >= 11) {
      const totalText = cells[10].textContent.trim();
      const total = parseFloat(totalText.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
      if (total < melhorTotal) {
        melhorTotal = total;
        melhorRow = row;
      }
    }
  });
  
  if (!melhorRow) {
    alert('Não foi possível identificar a melhor cotação');
    return;
  }
  
  const cells = melhorRow.querySelectorAll('td');
  const produto = cells[1]?.textContent.trim() || '';
  const fornecedor = cells[2]?.textContent.trim() || '';
  const quantidade = parseInt(cells[4]?.textContent.trim()) || 0;
  const valorUnitario = parseFloat(cells[5]?.textContent.trim().replace(/[^\d,]/g, '').replace(',', '.')) || 0;
  const total = melhorTotal;
  
  if (confirm(`Deseja finalizar a cotação com o melhor preço?\n\nProduto: ${produto}\nFornecedor: ${fornecedor}\nTotal: ${formatarMoeda(total)}`)) {
    // Mover para histórico
    const cotacao = cotacoes.find(c => 
      c.produto === produto && 
      c.fornecedor === fornecedor && 
      c.quantidade === quantidade && 
      c.valorUnitario === valorUnitario
    );
    
    if (cotacao) {
      cotacao.status = 'finalizado';
      cotacao.dataFinalizacao = new Date().toISOString();
      
      historico.push({ ...cotacao });
      cotacoes = cotacoes.filter(c => c.id !== cotacao.id);
      
      salvarDados();
      renderCotacoes();
      renderHistorico();
      document.getElementById('modalComparativo').style.display = 'none';
      alert('Cotação finalizada com sucesso!');
    }
  }
}

// ================== MODAIS ==================
function abrirModalCotacao(id = null) {
  editingId = id;
  const modal = document.getElementById('modalCotacao');
  const form = document.getElementById('formCotacao');
  form.reset();
  
  // Preencher data atual
  const hoje = new Date().toISOString().split('T')[0];
  document.getElementById('cotacaoData').value = hoje;
  
  if (id) {
    const cot = cotacoes.find(c => c.id === id);
    if (cot) {
      document.getElementById('cotacaoProduto').value = cot.produtoId || '';
      document.getElementById('cotacaoFornecedor').value = cot.fornecedor || '';
      document.getElementById('cotacaoQuantidade').value = cot.quantidade || '';
      document.getElementById('cotacaoValorUnitario').value = cot.valorUnitario || '';
      document.getElementById('cotacaoData').value = cot.dataCotacao || '';
      document.getElementById('cotacaoDataEntrega').value = cot.dataEntrega || '';
      document.getElementById('cotacaoObservacoes').value = cot.observacoes || '';
      document.getElementById('cotacaoAliquotaICMS').value = cot.aliquotaICMS || 0;
      document.getElementById('cotacaoAliquotaIPI').value = cot.aliquotaIPI || 0;
      document.getElementById('cotacaoValorFrete').value = cot.valorFrete || 0;
      document.getElementById('cotacaoPrazoPagamento').value = cot.prazoPagamento || '';
      document.getElementById('cotacaoCondicaoPagamento').value = cot.condicaoPagamento || '';
    }
  }
  
  atualizarSelectsCotacao();
  modal.style.display = 'block';
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
  const aliquotaICMS = parseFloat(document.getElementById('cotacaoAliquotaICMS')?.value) || 0;
  const aliquotaIPI = parseFloat(document.getElementById('cotacaoAliquotaIPI')?.value) || 0;
  const valorFrete = parseFloat(document.getElementById('cotacaoValorFrete')?.value) || 0;
  
  const subtotal = qtd * vu;
  const valorICMS = subtotal * (aliquotaICMS / 100);
  const valorIPI = subtotal * (aliquotaIPI / 100);
  
  const cotacaoData = {
    id: editingId || gerarId(),
    produtoId: parseInt(produtoId),
    produto: produto?.nome || '',
    fornecedor: fornecedor,
    uf: document.getElementById('cotacaoUF')?.value || '',
    dataCotacao: document.getElementById('cotacaoData')?.value || '',
    quantidade: qtd,
    valorUnitario: vu,
    dataEntrega: document.getElementById('cotacaoDataEntrega')?.value || '',
    observacoes: document.getElementById('cotacaoObservacoes')?.value || '',
    aliquotaICMS: aliquotaICMS,
    valorICMS: valorICMS,
    aliquotaIPI: aliquotaIPI,
    valorIPI: valorIPI,
    valorFrete: valorFrete,
    prazoPagamento: document.getElementById('cotacaoPrazoPagamento')?.value || '',
    condicaoPagamento: document.getElementById('cotacaoCondicaoPagamento')?.value || '',
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
  alert('Cotação salva com sucesso!');
}

function atualizarSelectsCotacao() {
  const selProd = document.getElementById('cotacaoProduto');
  const selForn = document.getElementById('cotacaoFornecedor');
  const selUF = document.getElementById('cotacaoUF');
  
  if (selProd) {
    selProd.innerHTML = '<option value="">Selecione o produto...</option>';
    produtos.forEach(p => selProd.innerHTML += `<option value="${p.id}">${p.nome}</option>`);
  }
  if (selForn) {
    selForn.innerHTML = '<option value="">Selecione o fornecedor...</option>';
    fornecedores.forEach(f => selForn.innerHTML += `<option value="${f.nomeEmpresa}">${f.nomeEmpresa}</option>`);
  }
  if (selUF) {
    selUF.innerHTML = '<option value="">Selecione...</option>';
    const ufs = ['SP', 'RJ', 'MG', 'PR', 'SC', 'RS', 'BA', 'PE', 'CE', 'DF', 'GO', 'ES', 'MT', 'MS', 'PA', 'AM', 'AC', 'RO', 'TO', 'MA', 'PI', 'RN', 'PB', 'SE', 'AL', 'AP', 'RR'];
    ufs.forEach(uf => selUF.innerHTML += `<option value="${uf}">${uf}</option>`);
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
    codigo: document.getElementById('produtoCodigo')?.value || '',
    categoria: document.getElementById('produtoCategoria')?.value || '',
    unidadePadrao: document.getElementById('produtoUnidade')?.value || 'un',
    ncm: document.getElementById('produtoNCM')?.value || '',
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
  alert('Produto salvo com sucesso!');
}

function editarProduto(id) {
  const prod = produtos.find(p => p.id === id);
  if (!prod) return;
  
  editingProdutoId = id;
  document.getElementById('produtoNome').value = prod.nome || '';
  document.getElementById('produtoCodigo').value = prod.codigo || '';
  document.getElementById('produtoCategoria').value = prod.categoria || '';
  document.getElementById('produtoUnidade').value = prod.unidadePadrao || 'un';
  document.getElementById('produtoNCM').value = prod.ncm || '';
  document.getElementById('produtoDescricao').value = prod.descricao || '';
  document.getElementById('modalProduto').style.display = 'block';
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
    ie: document.getElementById('fornecedorIE')?.value || '',
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
  alert('Fornecedor salvo com sucesso!');
}

function editarFornecedor(id) {
  const forn = fornecedores.find(f => f.id === id);
  if (!forn) return;
  
  editingFornecedorId = id;
  document.getElementById('fornecedorNome').value = forn.nomeEmpresa || '';
  document.getElementById('fornecedorCNPJ').value = forn.cnpj || '';
  document.getElementById('fornecedorIE').value = forn.ie || '';
  document.getElementById('fornecedorTelefone').value = forn.telefone || '';
  document.getElementById('fornecedorEmail').value = forn.email || '';
  document.getElementById('fornecedorUF').value = forn.uf || '';
  document.getElementById('modalFornecedor').style.display = 'block';
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
  document.getElementById('addCotacaoBtn')?.addEventListener('click', () => abrirModalCotacao());
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
  document.getElementById('compararSelecionadosBtn')?.addEventListener('click', compararSelecionados);
  
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
      abrirModalCotacao(parseInt(editCot.dataset.id));
    }
    
    const viewCot = e.target.closest('.view-cotacao');
    if (viewCot) {
      const id = parseInt(viewCot.dataset.id);
      const cot = cotacoes.find(c => c.id === id);
      if (cot) {
        alert(
          `📋 Detalhes da Cotação\n\n` +
          `Produto: ${cot.produto}\n` +
          `Fornecedor: ${cot.fornecedor}\n` +
          `Quantidade: ${cot.quantidade}\n` +
          `Valor Unitário: ${formatarMoeda(cot.valorUnitario)}\n` +
          `ICMS: ${cot.aliquotaICMS || 0}% (${formatarMoeda(cot.valorICMS || 0)})\n` +
          `IPI: ${cot.aliquotaIPI || 0}% (${formatarMoeda(cot.valorIPI || 0)})\n` +
          `Frete: ${formatarMoeda(cot.valorFrete || 0)}\n` +
          `Total c/ Impostos: ${formatarMoeda((cot.quantidade * cot.valorUnitario) + (cot.valorFrete || 0) + (cot.valorIPI || 0) + (cot.valorICMS || 0))}\n` +
          `Prazo Pagamento: ${cot.prazoPagamento || '-'}\n` +
          `Condição Pagamento: ${cot.condicaoPagamento || '-'}\n` +
          `Data Entrega: ${cot.dataEntrega ? formatarData(cot.dataEntrega) : '-'}`
        );
      }
    }
    
    const delCot = e.target.closest('.delete-cotacao');
    if (delCot) {
      if (confirm('Excluir esta cotação permanentemente?')) {
        cotacoes = cotacoes.filter(c => c.id != delCot.dataset.id);
        salvarDados();
        renderCotacoes();
      }
    }
    
    const editProd = e.target.closest('.btn-editar-produto');
    if (editProd) {
      editarProduto(parseInt(editProd.dataset.id));
    }
    
    const delProd = e.target.closest('.btn-excluir-produto');
    if (delProd) {
      if (confirm('Excluir este produto?')) {
        produtos = produtos.filter(p => p.id != delProd.dataset.id);
        salvarDados();
        renderProdutos();
        atualizarSelectsCotacao();
      }
    }
    
    const editForn = e.target.closest('.btn-editar-fornecedor');
    if (editForn) {
      editarFornecedor(editForn.dataset.id);
    }
    
    const delForn = e.target.closest('.btn-excluir-fornecedor');
    if (delForn) {
      if (confirm('Excluir este fornecedor?')) {
        fornecedores = fornecedores.filter(f => f.id != delForn.dataset.id);
        salvarDados();
        renderFornecedores();
        atualizarSelectsCotacao();
      }
    }
  });
  
  // Selecionar todos
  document.getElementById('selecionarTodos')?.addEventListener('change', function() {
    document.querySelectorAll('.select-cotacao').forEach(cb => cb.checked = this.checked);
  });
  
  // Filtros do histórico
  document.getElementById('filtroProduto')?.addEventListener('input', renderHistorico);
  document.getElementById('filtroFornecedor')?.addEventListener('input', renderHistorico);
  document.getElementById('filtroPeriodo')?.addEventListener('change', renderHistorico);
  
  // Limpar histórico
  document.getElementById('limparHistoricoBtn')?.addEventListener('click', () => {
    if (confirm('Deseja realmente limpar todo o histórico de compras?')) {
      historico = [];
      salvarDados();
      renderHistorico();
    }
  });
  
  // Fechar modal comparativo
  document.querySelector('#modalComparativo .close-modal')?.addEventListener('click', () => {
    document.getElementById('modalComparativo').style.display = 'none';
  });
  
  console.log('✅ Sistema de cotações pronto!');
}

document.addEventListener('DOMContentLoaded', init);
