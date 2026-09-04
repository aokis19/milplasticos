// cotacao.js - Sistema de Cotações (VERSÃO COMPLETAMENTE REFEITA)
// Mil Plásticos

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

function formatarDataHora(dataStr) {
  if (!dataStr) return '';
  try { const d = new Date(dataStr); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR'); } catch { return dataStr; }
}

function gerarId() {
  return 'cot_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 4);
}

function salvarDados() {
  localStorage.setItem('produtos_cotacao', JSON.stringify(produtos));
  localStorage.setItem('cotacoes', JSON.stringify(cotacoes));
  localStorage.setItem('historico_cotacao', JSON.stringify(historico));
  localStorage.setItem('fornecedores', JSON.stringify(fornecedores));
}

function carregarDados() {
  try {
    produtos = JSON.parse(localStorage.getItem('produtos_cotacao')) || [];
    cotacoes = JSON.parse(localStorage.getItem('cotacoes')) || [];
    historico = JSON.parse(localStorage.getItem('historico_cotacao')) || [];
    fornecedores = JSON.parse(localStorage.getItem('fornecedores')) || [];
  } catch (e) {
    console.error('Erro ao carregar dados:', e);
    produtos = [];
    cotacoes = [];
    historico = [];
    fornecedores = [];
  }
  
  // Garantir que os IDs sejam strings
  cotacoes = cotacoes.filter(c => c.id).map(c => ({ ...c, id: String(c.id) }));
  historico = historico.filter(h => h.id).map(h => ({ ...h, id: String(h.id) }));
  produtos = produtos.filter(p => p.id).map(p => ({ ...p, id: String(p.id) }));
  fornecedores = fornecedores.filter(f => f.id).map(f => ({ ...f, id: String(f.id) }));
  
  // Dados iniciais se estiver vazio
  if (produtos.length === 0) {
    produtos = [
      { id: 'prod_1', nome: "GotaLube SP", codigo: "GL-001", categoria: "Lubrificantes", unidadePadrao: "kg", ncm: "2710.19.90" },
      { id: 'prod_2', nome: "Sacaria Plástica", codigo: "SP-100", categoria: "Embalagens", unidadePadrao: "un", ncm: "3923.21.90" },
      { id: 'prod_3', nome: "Polietileno PEAD", codigo: "PE-001", categoria: "Matéria Prima", unidadePadrao: "kg", ncm: "3901.20.90" }
    ];
  }
  if (fornecedores.length === 0) {
    fornecedores = [
      { id: 'forn_1', nomeEmpresa: "LMJ Plásticos", cnpj: "12.345.678/0001-99", ie: "123.456.789", telefone: "(11) 99999-9999", email: "contato@lmjplasticos.com.br", uf: "SP" },
      { id: 'forn_2', nomeEmpresa: "PlastTotal", cnpj: "98.765.432/0001-11", ie: "987.654.321", telefone: "(11) 88888-8888", email: "vendas@plasttotal.com", uf: "SP" },
      { id: 'forn_3', nomeEmpresa: "PolyPlast", cnpj: "11.222.333/0001-44", ie: "111.222.333", telefone: "(11) 77777-7777", email: "vendas@polyplast.com", uf: "SP" }
    ];
  }
  
  // Cotações de exemplo se estiver vazio
  if (cotacoes.length === 0 && historico.length === 0) {
    const hoje = new Date().toISOString().split('T')[0];
    cotacoes = [
      {
        id: 'cot_1',
        produto: "GotaLube SP",
        fornecedor: "LMJ Plásticos",
        uf: "SP",
        quantidade: 10,
        valorUnitario: 15.50,
        dataCotacao: hoje,
        dataEntrega: '2026-09-15',
        observacoes: "",
        aliquotaICMS: 18,
        valorICMS: 27.90,
        aliquotaIPI: 5,
        valorIPI: 7.75,
        valorFrete: 15.00,
        prazoPagamento: "30 dias",
        condicaoPagamento: "Boleto",
        status: "ativo",
        dataCadastro: new Date().toISOString()
      },
      {
        id: 'cot_2',
        produto: "GotaLube SP",
        fornecedor: "PlastTotal",
        uf: "SP",
        quantidade: 10,
        valorUnitario: 14.80,
        dataCotacao: hoje,
        dataEntrega: '2026-09-20',
        observacoes: "",
        aliquotaICMS: 18,
        valorICMS: 26.64,
        aliquotaIPI: 5,
        valorIPI: 7.40,
        valorFrete: 20.00,
        prazoPagamento: "15 dias",
        condicaoPagamento: "Cartão",
        status: "ativo",
        dataCadastro: new Date().toISOString()
      },
      {
        id: 'cot_3',
        produto: "Sacaria Plástica",
        fornecedor: "PolyPlast",
        uf: "SP",
        quantidade: 100,
        valorUnitario: 2.50,
        dataCotacao: hoje,
        dataEntrega: '2026-09-10',
        observacoes: "",
        aliquotaICMS: 18,
        valorICMS: 45.00,
        aliquotaIPI: 5,
        valorIPI: 12.50,
        valorFrete: 30.00,
        prazoPagamento: "45 dias",
        condicaoPagamento: "Boleto",
        status: "ativo",
        dataCadastro: new Date().toISOString()
      }
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
  
  console.log('📊 Renderizando cotações ativas:', ativas.length);
  
  if (ativas.length === 0) {
    container.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  
  container.innerHTML = ativas.map(cot => {
    const total = (cot.quantidade || 0) * (cot.valorUnitario || 0);
    const totalComImpostos = total + (cot.valorFrete || 0) + (cot.valorIPI || 0) + (cot.valorICMS || 0);
    
    return `<div class="table-row" data-id="${cot.id}">
      <div class="checkbox-column"><input type="checkbox" class="select-cotacao" value="${cot.id}"></div>
      <div><strong>${cot.produto || '-'}</strong></div>
      <div>${cot.fornecedor || '-'}</div>
      <div>${cot.uf || '-'}</div>
      <div>${cot.quantidade || 0}</div>
      <div>${formatarMoeda(cot.valorUnitario)}</div>
      <div>${formatarMoeda(total)}</div>
      <div><strong>${formatarMoeda(totalComImpostos)}</strong></div>
      <div>${cot.dataEntrega ? formatarData(cot.dataEntrega) : '-'}</div>
      <div>
        <span class="status-badge status-ativo">Ativo</span>
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
    container.innerHTML = '<div class="empty-state" style="display:block;"><i class="fas fa-history"></i><h3>Nenhum histórico encontrado</h3></div>';
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
  
  console.log('📋 Selecionados:', selecionados.length);
  
  if (selecionados.length < 2) {
    alert('Selecione pelo menos 2 cotações para comparar');
    return;
  }
  
  const ids = Array.from(selecionados).map(cb => String(cb.value));
  
  console.log('📋 IDs selecionados:', ids);
  console.log('📋 Cotações disponíveis:', cotacoes.map(c => ({ id: String(c.id), produto: c.produto, status: c.status })));
  
  const itens = cotacoes.filter(c => ids.includes(String(c.id)) && c.status !== "finalizado");
  
  console.log('📋 Itens encontrados:', itens.length);
  
  if (itens.length < 2) {
    alert('Selecione pelo menos 2 cotações ativas');
    return;
  }
  
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
              <th>Qtd</th>
              <th>Valor Unit.</th>
              <th>Subtotal</th>
              <th>ICMS</th>
              <th>IPI</th>
              <th>Frete</th>
              <th>Total c/ Imp.</th>
              <th>Entrega</th>
              <th>Finalizar</th>
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
      menorId = String(item.id);
    }
  });
  
  itens.forEach((item, idx) => {
    const total = (item.quantidade || 0) * (item.valorUnitario || 0);
    const totalComImpostos = total + (item.valorFrete || 0) + (item.valorIPI || 0) + (item.valorICMS || 0);
    const isMelhor = String(item.id) === String(menorId);
    
    html += `
      <tr class="${isMelhor ? 'melhor-preco' : ''}" data-id="${item.id}">
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
        <td>
          <input type="checkbox" class="finalizar-cotacao" value="${item.id}" ${isMelhor ? 'checked' : ''}>
        </td>
      </tr>
    `;
  });
  
  html += `
          </tbody>
        </table>
      </div>
      
      <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap;">
        <button class="btn btn-success" onclick="gerarPDFComparativo()">
          <i class="fas fa-file-pdf"></i> Gerar PDF
        </button>
        <button class="btn btn-primary" onclick="finalizarCotacoesSelecionadas()">
          <i class="fas fa-check-circle"></i> Finalizar Selecionadas
        </button>
        <button class="btn btn-secondary" onclick="document.getElementById('modalComparativo').style.display='none'">
          <i class="fas fa-times"></i> Fechar
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
      
      const table = document.querySelector('.comparativo-tabela table');
      if (table) {
        const rows = table.querySelectorAll('tbody tr');
        const headers = table.querySelectorAll('thead th');
        
        const colWidths = [8, 28, 25, 15, 15, 20, 22, 20, 20, 20, 28, 25, 15];
        let x = margin;
        
        doc.setFillColor(44, 62, 80);
        doc.rect(margin, y - 4, pageWidth - (margin * 2), 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        
        headers.forEach((th, i) => {
          if (i < colWidths.length && th.textContent.trim() !== 'Finalizar') {
            doc.text(th.textContent.trim(), x + 1, y + 3);
            x += colWidths[i];
          }
        });
        
        y += 8;
        doc.setTextColor(50, 50, 50);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        
        rows.forEach((row, rowIdx) => {
          const cells = row.querySelectorAll('td');
          x = margin;
          
          if (rowIdx % 2 === 0) {
            doc.setFillColor(245, 245, 245);
            doc.rect(margin, y - 3, pageWidth - (margin * 2), 6, 'F');
          }
          
          const isMelhor = row.classList.contains('melhor-preco');
          if (isMelhor) {
            doc.setFillColor(212, 237, 218);
            doc.rect(margin, y - 3, pageWidth - (margin * 2), 6, 'F');
          }
          
          cells.forEach((cell, i) => {
            if (i < colWidths.length && i !== 12) {
              const text = cell.textContent.trim().replace(/\s+/g, ' ');
              doc.setTextColor(isMelhor ? 0 : 50, isMelhor ? 100 : 50, isMelhor ? 0 : 50);
              doc.text(text, x + 1, y + 3);
              x += colWidths[i];
            }
          });
          
          y += 7;
          
          if (y > 190) {
            doc.addPage();
            y = margin + 10;
          }
        });
      }
      
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

// ================== FINALIZAR COTAÇÕES ==================
function finalizarCotacoesSelecionadas() {
  const checkboxes = document.querySelectorAll('.finalizar-cotacao:checked');
  if (checkboxes.length === 0) {
    alert('Selecione pelo menos uma cotação para finalizar');
    return;
  }
  
  const ids = Array.from(checkboxes).map(cb => String(cb.value));
  const itensParaFinalizar = cotacoes.filter(c => ids.includes(String(c.id)));
  
  if (itensParaFinalizar.length === 0) {
    alert('Nenhuma cotação encontrada para finalizar');
    return;
  }
  
  const nomes = itensParaFinalizar.map(item => `${item.produto} - ${item.fornecedor}`).join('\n');
  
  if (confirm(`Deseja finalizar as seguintes cotações?\n\n${nomes}`)) {
    itensParaFinalizar.forEach(item => {
      const itemFinalizado = {
        ...item,
        status: 'finalizado',
        dataFinalizacao: new Date().toISOString()
      };
      historico.push(itemFinalizado);
    });
    
    const idsFinalizados = itensParaFinalizar.map(item => String(item.id));
    cotacoes = cotacoes.filter(c => !idsFinalizados.includes(String(c.id)));
    
    salvarDados();
    renderCotacoes();
    renderHistorico();
    document.getElementById('modalComparativo').style.display = 'none';
    alert(`${itensParaFinalizar.length} cotação(ões) finalizada(s) com sucesso!`);
  }
}

function finalizarSelecionadosDireto() {
  const selecionados = document.querySelectorAll('.select-cotacao:checked');
  if (selecionados.length === 0) {
    alert('Selecione pelo menos uma cotação para finalizar');
    return;
  }
  
  const ids = Array.from(selecionados).map(cb => String(cb.value));
  const itensParaFinalizar = cotacoes.filter(c => ids.includes(String(c.id)) && c.status !== "finalizado");
  
  if (itensParaFinalizar.length === 0) {
    alert('Nenhuma cotação ativa selecionada');
    return;
  }
  
  const nomes = itensParaFinalizar.map(item => `${item.produto} - ${item.fornecedor}`).join('\n');
  
  if (confirm(`Deseja finalizar as seguintes cotações?\n\n${nomes}`)) {
    itensParaFinalizar.forEach(item => {
      const itemFinalizado = {
        ...item,
        status: 'finalizado',
        dataFinalizacao: new Date().toISOString()
      };
      historico.push(itemFinalizado);
    });
    
    const idsFinalizados = itensParaFinalizar.map(item => String(item.id));
    cotacoes = cotacoes.filter(c => !idsFinalizados.includes(String(c.id)));
    
    salvarDados();
    renderCotacoes();
    renderHistorico();
    alert(`${itensParaFinalizar.length} cotação(ões) finalizada(s) com sucesso!`);
  }
}

// ================== MODAIS (CORRIGIDO - NÃO FECHA ACIDENTALMENTE) ==================
function abrirModalCotacao(id = null) {
  editingId = id;
  const modal = document.getElementById('modalCotacao');
  const form = document.getElementById('formCotacao');
  form.reset();
  
  const hoje = new Date().toISOString().split('T')[0];
  document.getElementById('cotacaoData').value = hoje;
  
  if (id) {
    const cot = cotacoes.find(c => String(c.id) === String(id));
    if (cot) {
      document.getElementById('cotacaoProduto').value = cot.produto || '';
      document.getElementById('cotacaoFornecedor').value = cot.fornecedor || '';
      document.getElementById('cotacaoUF').value = cot.uf || '';
      document.getElementById('cotacaoQuantidade').value = cot.quantidade || '';
      document.getElementById('cotacaoValorUnitario').value = cot.valorUnitario || '';
      document.getElementById('cotacaoData').value = cot.dataCotacao || '';
      document.getElementById('cotacaoDataEntrega').value = cot.dataEntrega || '';
      document.getElementById('cotacaoObservacoes').value = cot.observacoes || '';
      document.getElementById('cotacaoAliquotaICMS').value = cot.aliquotaICMS || 18;
      document.getElementById('cotacaoAliquotaIPI').value = cot.aliquotaIPI || 5;
      document.getElementById('cotacaoValorFrete').value = cot.valorFrete || 0;
      document.getElementById('cotacaoPrazoPagamento').value = cot.prazoPagamento || '';
      document.getElementById('cotacaoCondicaoPagamento').value = cot.condicaoPagamento || '';
    }
  }
  
  modal.style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function fecharModalCotacao() {
  document.getElementById('modalCotacao').style.display = 'none';
  document.body.style.overflow = 'auto';
}

// ================== COTAÇÕES CRUD ==================
function salvarCotacao(event) {
  if (event) event.preventDefault();
  
  const produto = document.getElementById('cotacaoProduto')?.value?.trim();
  if (!produto) { alert('Digite o nome do produto'); return; }
  
  const fornecedor = document.getElementById('cotacaoFornecedor')?.value?.trim();
  if (!fornecedor) { alert('Digite o nome do fornecedor'); return; }
  
  const qtd = parseFloat(document.getElementById('cotacaoQuantidade')?.value) || 0;
  if (qtd <= 0) { alert('Digite uma quantidade válida'); return; }
  
  const vu = parseFloat(document.getElementById('cotacaoValorUnitario')?.value) || 0;
  if (vu <= 0) { alert('Digite um valor unitário válido'); return; }
  
  const aliquotaICMS = parseFloat(document.getElementById('cotacaoAliquotaICMS')?.value) || 0;
  const aliquotaIPI = parseFloat(document.getElementById('cotacaoAliquotaIPI')?.value) || 0;
  const valorFrete = parseFloat(document.getElementById('cotacaoValorFrete')?.value) || 0;
  
  const subtotal = qtd * vu;
  const valorICMS = subtotal * (aliquotaICMS / 100);
  const valorIPI = subtotal * (aliquotaIPI / 100);
  
  const cotacaoData = {
    id: editingId || gerarId(),
    produto: produto,
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
  
  console.log('💾 Salvando cotação:', cotacaoData);
  
  if (editingId) {
    const idx = cotacoes.findIndex(c => String(c.id) === String(editingId));
    if (idx !== -1) cotacoes[idx] = cotacaoData;
  } else {
    cotacoes.push(cotacaoData);
  }
  
  salvarDados();
  fecharModalCotacao();
  renderCotacoes();
  alert('Cotação salva com sucesso!');
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
    const idx = produtos.findIndex(p => String(p.id) === String(editingProdutoId));
    if (idx !== -1) produtos[idx] = prodData;
  } else {
    produtos.push(prodData);
  }
  
  salvarDados();
  document.getElementById('modalProduto').style.display = 'none';
  renderProdutos();
  alert('Produto salvo com sucesso!');
}

function editarProduto(id) {
  const prod = produtos.find(p => String(p.id) === String(id));
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
    id: editingFornecedorId || gerarId(),
    nomeEmpresa: nome,
    cnpj: document.getElementById('fornecedorCNPJ')?.value || '',
    ie: document.getElementById('fornecedorIE')?.value || '',
    telefone: document.getElementById('fornecedorTelefone')?.value || '',
    email: document.getElementById('fornecedorEmail')?.value || '',
    uf: document.getElementById('fornecedorUF')?.value || ''
  };
  
  if (editingFornecedorId) {
    const idx = fornecedores.findIndex(f => String(f.id) === String(editingFornecedorId));
    if (idx !== -1) fornecedores[idx] = fornData;
  } else {
    fornecedores.push(fornData);
  }
  
  salvarDados();
  document.getElementById('modalFornecedor').style.display = 'none';
  renderFornecedores();
  alert('Fornecedor salvo com sucesso!');
}

function editarFornecedor(id) {
  const forn = fornecedores.find(f => String(f.id) === String(id));
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
  
  console.log('📦 Dados carregados:');
  console.log('  - Produtos:', produtos.length);
  console.log('  - Cotações:', cotacoes.length);
  console.log('  - Histórico:', historico.length);
  console.log('  - Fornecedores:', fornecedores.length);
  
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
  
  // Botões de ação
  document.getElementById('compararSelecionadosBtn')?.addEventListener('click', compararSelecionados);
  document.getElementById('finalizarSelecionadosBtn')?.addEventListener('click', finalizarSelecionadosDireto);
  
  // Forms
  document.getElementById('formCotacao')?.addEventListener('submit', salvarCotacao);
  document.getElementById('formProduto')?.addEventListener('submit', salvarProduto);
  document.getElementById('formFornecedor')?.addEventListener('submit', salvarFornecedor);
  
  // Eventos de clique para editar/excluir (delegação)
  document.addEventListener('click', function(e) {
    const editCot = e.target.closest('.edit-cotacao');
    if (editCot) {
      abrirModalCotacao(editCot.dataset.id);
    }
    
    const viewCot = e.target.closest('.view-cotacao');
    if (viewCot) {
      const id = viewCot.dataset.id;
      const cot = cotacoes.find(c => String(c.id) === String(id));
      if (cot) {
        const total = (cot.quantidade || 0) * (cot.valorUnitario || 0);
        const totalComImpostos = total + (cot.valorFrete || 0) + (cot.valorIPI || 0) + (cot.valorICMS || 0);
        alert(
          `📋 DETALHES DA COTAÇÃO\n\n` +
          `Produto: ${cot.produto}\n` +
          `Fornecedor: ${cot.fornecedor}\n` +
          `UF: ${cot.uf || '-'}\n` +
          `Quantidade: ${cot.quantidade}\n` +
          `Valor Unitário: ${formatarMoeda(cot.valorUnitario)}\n` +
          `Subtotal: ${formatarMoeda(total)}\n` +
          `ICMS: ${cot.aliquotaICMS || 0}% (${formatarMoeda(cot.valorICMS || 0)})\n` +
          `IPI: ${cot.aliquotaIPI || 0}% (${formatarMoeda(cot.valorIPI || 0)})\n` +
          `Frete: ${formatarMoeda(cot.valorFrete || 0)}\n` +
          `TOTAL COM IMPOSTOS: ${formatarMoeda(totalComImpostos)}\n` +
          `Prazo Pagamento: ${cot.prazoPagamento || '-'}\n` +
          `Condição Pagamento: ${cot.condicaoPagamento || '-'}\n` +
          `Data Entrega: ${cot.dataEntrega ? formatarData(cot.dataEntrega) : '-'}\n` +
          `Status: ${cot.status || 'Ativo'}`
        );
      }
    }
    
    const delCot = e.target.closest('.delete-cotacao');
    if (delCot) {
      if (confirm('Excluir esta cotação permanentemente?')) {
        cotacoes = cotacoes.filter(c => String(c.id) !== String(delCot.dataset.id));
        salvarDados();
        renderCotacoes();
        alert('Cotação excluída com sucesso!');
      }
    }
    
    const editProd = e.target.closest('.btn-editar-produto');
    if (editProd) {
      editarProduto(editProd.dataset.id);
    }
    
    const delProd = e.target.closest('.btn-excluir-produto');
    if (delProd) {
      if (confirm('Excluir este produto?')) {
        produtos = produtos.filter(p => String(p.id) !== String(delProd.dataset.id));
        salvarDados();
        renderProdutos();
        alert('Produto excluído com sucesso!');
      }
    }
    
    const editForn = e.target.closest('.btn-editar-fornecedor');
    if (editForn) {
      editarFornecedor(editForn.dataset.id);
    }
    
    const delForn = e.target.closest('.btn-excluir-fornecedor');
    if (delForn) {
      if (confirm('Excluir este fornecedor?')) {
        fornecedores = fornecedores.filter(f => String(f.id) !== String(delForn.dataset.id));
        salvarDados();
        renderFornecedores();
        alert('Fornecedor excluído com sucesso!');
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
      alert('Histórico limpo com sucesso!');
    }
  });
  
  console.log('✅ Sistema de cotações pronto!');
}

// Inicializar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', init);
