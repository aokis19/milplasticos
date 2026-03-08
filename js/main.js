// assets/js/main.js - Sistema Principal

document.addEventListener('DOMContentLoaded', function() {
  
  // ============================================
  // 1. CARREGAR COMPONENTES DINAMICAMENTE
  // ============================================
  
  function loadComponents() {
    // Carregar topbar
    fetch('components/topbar.html')
      .then(response => response.text())
      .then(html => {
        // Inserir no início do body
        document.body.insertAdjacentHTML('afterbegin', html);
        
        // Inicializar após carregar
        initializeSidebar();
        initializeTopbar();
      })
      .catch(error => console.error('Erro ao carregar topbar:', error));
    
    // Carregar sidebar
    fetch('components/sidebar.html')
      .then(response => response.text())
      .then(html => {
        // Inserir após o container
        const container = document.querySelector('.container');
        if (container) {
          container.insertAdjacentHTML('afterbegin', html);
        }
        
        // Marcar página ativa
        highlightActivePage();
      })
      .catch(error => console.error('Erro ao carregar sidebar:', error));
  }
  
  // ============================================
  // 2. INICIALIZAR SIDEBAR
  // ============================================
  
  function initializeSidebar() {
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const mainContent = document.querySelector('.main-content');
    
    if (!toggleBtn || !sidebar) return;
    
    // Verificar se é desktop
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
    toggleBtn.addEventListener('click', function() {
      sidebar.classList.toggle('active');
      overlay.classList.toggle('active');
      
      // Em mobile, impedir scroll do body
      if (!isDesktop()) {
        document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : '';
      }
      
      // Ajustar conteúdo
      if (mainContent) {
        if (sidebar.classList.contains('active')) {
          mainContent.style.marginLeft = '250px';
          mainContent.style.width = 'calc(100% - 250px)';
        } else {
          mainContent.style.marginLeft = '0';
          mainContent.style.width = '100%';
        }
      }
    });
    
    // Fechar sidebar no mobile (clique no overlay)
    if (overlay) {
      overlay.addEventListener('click', function() {
        sidebar.classList.remove('active');
        this.classList.remove('active');
        document.body.style.overflow = '';
        
        if (mainContent) {
          mainContent.style.marginLeft = '0';
          mainContent.style.width = '100%';
        }
      });
    }
    
    // Fechar sidebar ao clicar em link (mobile)
    document.addEventListener('click', function(e) {
      if (e.target.closest('.sidebar-menu a') && !isDesktop()) {
        sidebar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = '';
        
        if (mainContent) {
          mainContent.style.marginLeft = '0';
          mainContent.style.width = '100%';
        }
      }
    });
    
    // Ajustar no redimensionamento
    window.addEventListener('resize', function() {
      if (isDesktop()) {
        sidebar.classList.add('active');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = '';
        
        if (mainContent) {
          mainContent.style.marginLeft = '250px';
          mainContent.style.width = 'calc(100% - 250px)';
        }
      } else {
        sidebar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        
        if (mainContent) {
          mainContent.style.marginLeft = '0';
          mainContent.style.width = '100%';
        }
      }
    });
  }
  
  // ============================================
  // 3. INICIALIZAR TOPBAR
  // ============================================
  
  function initializeTopbar() {
    // Busca na topbar
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
      searchInput.addEventListener('input', function(e) {
        // Implementar busca aqui
        console.log('Buscar:', e.target.value);
      });
    }
    
    // Botões de ação
    document.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        console.log('Botão clicado:', this.title || this.textContent);
      });
    });
  }
  
  // ============================================
  // 4. MARCAR PÁGINA ATIVA
  // ============================================
  
  function highlightActivePage() {
    const currentPage = getCurrentPageName();
    const menuItems = document.querySelectorAll('.sidebar-menu a');
    
    menuItems.forEach(item => {
      item.classList.remove('active');
      const page = item.getAttribute('data-page');
      if (page === currentPage) {
        item.classList.add('active');
      }
    });
  }
  
  function getCurrentPageName() {
    const path = window.location.pathname;
    const page = path.split('/').pop().replace('.html', '');
    return page || 'dashboard';
  }
  
  // ============================================
  // 5. CARREGAR CSS/JS DA PÁGINA ATUAL
  // ============================================
  
  function loadPageAssets() {
    const currentPage = getCurrentPageName();
    
    // Mapeamento de páginas para CSS/JS
    const pageAssets = {
      'veiculos': { css: 'veiculos.css', js: 'veiculos.js' },
      'abastecimento': { css: 'abastecimento.css', js: 'abastecimento.js' },
      'financeiro': { css: 'financeiro.css', js: 'financeiro.js' },
      // Adicione outras páginas aqui
    };
    
    const assets = pageAssets[currentPage];
    
    if (assets) {
      // Carregar CSS específico
      if (assets.css) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `assets/css/pages/${assets.css}`;
        document.head.appendChild(link);
      }
      
      // Carregar JS específico
      if (assets.js) {
        const script = document.createElement('script');
        script.src = `assets/js/pages/${assets.js}`;
        script.defer = true;
        document.body.appendChild(script);
      }
    }
  }
  
  // ============================================
  // INICIALIZAR SISTEMA
  // ============================================
  
  // Verificar se já está em uma página com estrutura
  const hasContainer = document.querySelector('.container');
  const hasMainContent = document.querySelector('.main-content');
  
  if (!hasContainer || !hasMainContent) {
    // Criar estrutura básica se não existir
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
  
  // Carregar assets da página
  loadPageAssets();
  
  // Adicionar classe para animações suaves após carregar
  setTimeout(() => {
    document.body.classList.add('loaded');
  }, 100);
});

// Função auxiliar para navegação
function navigateTo(page) {
  window.location.href = `${page}.html`;
}