// ==========================================================================
// /js/main.js - Sistema Principal (Versão Unificada 3.0)
// Compatível com Firebase - Sem localStorage
// ==========================================================================

(function() {
  'use strict';

  console.log('🚀 Inicializando sistema principal...');

  // ============================================
  // 1. CONFIGURAÇÃO DE CAMINHOS
  // ============================================
  const BASE_PATH = window.location.pathname.includes('/pages/') ? '../' : '';
  const COMPONENTS_PATH = BASE_PATH + 'components/';

  // ============================================
  // 2. CARREGAR COMPONENTES DINAMICAMENTE
  // ============================================
  async function loadComponent(componentName, targetId, insertMethod = 'afterbegin') {
    try {
      const url = COMPONENTS_PATH + componentName + '.html';
      console.log(`🔄 Carregando: ${url}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      const target = document.getElementById(targetId);
      
      if (!target) {
        // Se não encontrar pelo ID, tenta inserir no body
        if (insertMethod === 'afterbegin') {
          document.body.insertAdjacentHTML('afterbegin', html);
        }
        console.warn(`⚠️ Target #${targetId} não encontrado, inserido no body`);
        return;
      }
      
      target.insertAdjacentHTML(insertMethod, html);
      console.log(`✅ Componente "${componentName}" carregado`);
      
    } catch (error) {
      console.error(`❌ Erro ao carregar ${componentName}:`, error.message);
      
      // Fallback: criar estrutura básica se falhar
      if (componentName === 'sidebar') {
        criarSidebarFallback();
      }
    }
  }

  function criarSidebarFallback() {
    console.warn('⚠️ Criando sidebar fallback...');
    const sidebarHTML = `
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
          <h3>Mil Plásticos</h3>
        </div>
        <ul class="sidebar-menu">
          <li><a href="home.html" data-page="home"><i class="fas fa-home"></i> Home</a></li>
          <li><a href="abastecimento.html" data-page="abastecimento"><i class="fas fa-gas-pump"></i> Abastecimento</a></li>
          <li><a href="veiculos.html" data-page="veiculos"><i class="fas fa-truck"></i> Veículos</a></li>
          <li><a href="documentos.html" data-page="documentos"><i class="fas fa-file-alt"></i> Documentos</a></li>
        </ul>
      </aside>
    `;
    
    const container = document.querySelector('.container');
    if (container) {
      container.insertAdjacentHTML('afterbegin', sidebarHTML);
    }
  }

  async function loadComponents() {
    console.log('📦 Carregando componentes...');
    
    // Carregar sidebar primeiro
    await loadComponent('sidebar', 'sidebar-container', 'afterbegin');
    
    // Depois topbar
    await loadComponent('topbar', 'topbar-container', 'afterbegin');
    
    // Inicializar funcionalidades
    initializeSidebar();
    initializeTopbar();
    highlightActivePage();
  }

  // ============================================
  // 3. INICIALIZAR SIDEBAR
  // ============================================
  function initializeSidebar() {
    // Aguardar sidebar ser carregada
    const checkSidebar = setInterval(() => {
      const toggleBtn = document.getElementById('sidebar-toggle');
      const sidebar = document.getElementById('sidebar');
      
      if (toggleBtn && sidebar) {
        clearInterval(checkSidebar);
        setupSidebarEvents(toggleBtn, sidebar);
      }
    }, 100);
    
    // Timeout de segurança
    setTimeout(() => clearInterval(checkSidebar), 5000);
  }

  function setupSidebarEvents(toggleBtn, sidebar) {
    const overlay = document.getElementById('overlay');
    const mainContent = document.querySelector('.main-content');

    function isDesktop() {
      return window.innerWidth >= 992;
    }

    // Estado inicial
    if (isDesktop()) {
      sidebar.classList.add('active');
      if (mainContent) {
        mainContent.style.marginLeft = '250px';
        mainContent.style.width = 'calc(100% - 250px)';
      }
    }

    // Toggle sidebar
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('active');
      
      if (overlay) {
        overlay.classList.toggle('active');
      }

      if (!isDesktop()) {
        document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : '';
      }

      updateMainContent(mainContent, sidebar.classList.contains('active'));
    });

    // Fechar sidebar ao clicar no overlay
    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
        updateMainContent(mainContent, false);
      });
    }

    // Fechar sidebar ao clicar em link (mobile)
    document.addEventListener('click', (e) => {
      if (e.target.closest('.sidebar-menu a') && !isDesktop()) {
        sidebar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = '';
        updateMainContent(mainContent, false);
      }
    });

    // Responsividade
    window.addEventListener('resize', () => {
      if (isDesktop()) {
        sidebar.classList.add('active');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = '';
        updateMainContent(mainContent, true);
      } else {
        sidebar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        updateMainContent(mainContent, false);
      }
    });
  }

  function updateMainContent(mainContent, sidebarActive) {
    if (!mainContent) return;
    
    if (sidebarActive) {
      mainContent.style.marginLeft = '250px';
      mainContent.style.width = 'calc(100% - 250px)';
    } else {
      mainContent.style.marginLeft = '0';
      mainContent.style.width = '100%';
    }
  }

  // ============================================
  // 4. INICIALIZAR TOPBAR
  // ============================================
  function initializeTopbar() {
    // Aguardar topbar ser carregada
    const checkTopbar = setInterval(() => {
      const searchInput = document.querySelector('.search-input');
      const actionBtns = document.querySelectorAll('.action-btn');
      
      if (searchInput || actionBtns.length > 0) {
        clearInterval(checkTopbar);
        
        // Search
        if (searchInput) {
          searchInput.addEventListener('input', (e) => {
            console.log('🔍 Buscar:', e.target.value);
          });
        }

        // Action buttons
        actionBtns.forEach(btn => {
          btn.addEventListener('click', () => {
            console.log('🖱️ Botão clicado:', btn.title || btn.textContent);
          });
        });
      }
    }, 100);

    setTimeout(() => clearInterval(checkTopbar), 5000);
  }

  // ============================================
  // 5. MARCAR PÁGINA ATIVA
  // ============================================
  function highlightActivePage() {
    const currentPage = getCurrentPageName();
    
    // Aguardar menu ser carregado
    const checkMenu = setInterval(() => {
      const menuItems = document.querySelectorAll('.sidebar-menu a');
      
      if (menuItems.length > 0) {
        clearInterval(checkMenu);
        
        menuItems.forEach(item => {
          item.classList.remove('active');
          const page = item.getAttribute('data-page');
          
          if (page === currentPage) {
            item.classList.add('active');
            console.log('📍 Página ativa:', currentPage);
          }
        });
      }
    }, 100);

    setTimeout(() => clearInterval(checkMenu), 5000);
  }

  function getCurrentPageName() {
    const path = window.location.pathname;
    const page = path.split('/').pop().replace('.html', '');
    return page || 'home';
  }

  // ============================================
  // 6. NAVEGAÇÃO
  // ============================================
  function navigateTo(page) {
    console.log('🧭 Navegando para:', page);
    
    // Verificar se a página existe antes de navegar
    const url = page.includes('.html') ? page : `${page}.html`;
    
    // Adicionar efeito de transição
    document.body.style.opacity = '0.5';
    document.body.style.transition = 'opacity 0.2s';
    
    setTimeout(() => {
      window.location.href = url;
    }, 200);
  }

  // ============================================
  // 7. INICIALIZAÇÃO
  // ============================================
  function init() {
    console.log('📄 Página atual:', getCurrentPageName());
    console.log('   CSS e JS carregados diretamente no HTML');

    // Verificar estrutura da página
    const hasContainer = document.querySelector('.container');
    const hasMainContent = document.querySelector('.main-content');

    if (!hasContainer || !hasMainContent) {
      console.warn('⚠️ Estrutura HTML incompleta, ajustando...');
      document.body.innerHTML = `
        <div class="container">
          <main class="main-content">
            ${document.body.innerHTML}
          </main>
        </div>
      `;
    }

    // Carregar componentes
    loadComponents();

    // Marcar como carregado
    setTimeout(() => {
      document.body.classList.add('loaded');
      document.body.style.opacity = '1';
      console.log('✅ Sistema principal carregado!');
    }, 300);
  }

  // ============================================
  // 8. EXPOR FUNÇÕES GLOBALMENTE
  // ============================================
  window.navigateTo = navigateTo;
  window.getCurrentPageName = getCurrentPageName;

  // ============================================
  // 9. INICIAR QUANDO DOM PRONTO
  // ============================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('📋 Main.js carregado - aguardando DOM...');

})();
