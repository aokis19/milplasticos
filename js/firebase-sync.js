// ============ API PÚBLICA (CORRIGIDA) ============
window.SyncSystem = {
    // Obter dados atuais
    getData: function() {
        return appData ? JSON.parse(JSON.stringify(appData)) : criarDadosVazios();
    },
    
    // Atualizar dados
    updateData: async function(newData, quemModificou = 'usuario') {
        // Garantir que appData existe
        if (!appData) {
            appData = criarDadosVazios();
        }
        
        // Mesclar dados
        appData = {
            ...appData,
            ...newData,
            _metadata: {
                ...(appData._metadata || {}),
                version: (appData._metadata?.version || 0) + 1,
                lastModified: new Date().toISOString(),
                modifiedBy: quemModificou
            }
        };
        
        // Salvar localmente primeiro (sempre)
        salvarDadosLocalmente();
        
        // Tentar salvar no Firebase
        if (isOnline && db) {
            await salvarNoFirebase();
        } else {
            adicionarAFilaSync();
        }
        
        // Criar backup se necessário
        criarBackupAutomatico();
        
        return true;
    },
    
    // Forçar sincronização
    forceSync: async function() {
        await processarFilaSync();
    },
    
    // Verificar status (CORRIGIDO)
    getStatus: function() {
        return {
            online: isOnline,
            syncing: isSyncing,
            version: dataVersion || (appData?._metadata?.version || 0),
            queueSize: syncQueue ? syncQueue.length : 0,
            lastSync: appData?._metadata?.lastSync || null,
            lastModified: appData?._metadata?.lastModified || null
        };
    },
    
    // Criar backup manual
    createBackup: function() {
        if (!appData) {
            console.warn('⚠️ Nenhum dado para backup');
            return null;
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupKey = CONFIG.BACKUP_KEY + 'manual_' + timestamp;
        localStorage.setItem(backupKey, JSON.stringify(appData));
        console.log('📦 Backup manual criado:', backupKey);
        return backupKey;
    },
    
    // Restaurar backup
    restoreBackup: function(backupKey) {
        const dataStr = localStorage.getItem(backupKey);
        if (dataStr) {
            try {
                appData = JSON.parse(dataStr);
                dataVersion = appData?._metadata?.version || 0;
                salvarDadosLocalmente();
                console.log('🔄 Backup restaurado:', backupKey);
                return true;
            } catch (e) {
                console.error('❌ Erro ao restaurar backup:', e);
                return false;
            }
        }
        return false;
    },
    
    // Listar backups
    listBackups: function() {
        const backups = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(CONFIG.BACKUP_KEY)) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    backups.push({
                        key: key,
                        date: key.replace(CONFIG.BACKUP_KEY, ''),
                        version: data?._metadata?.version || 0,
                        modifiedBy: data?._metadata?.modifiedBy || 'desconhecido'
                    });
                } catch (e) {
                    // Ignorar backups corrompidos
                }
            }
        }
        return backups.sort((a, b) => b.date.localeCompare(a.date));
    },
    
    // Exportar dados
    exportData: function() {
        if (!appData) {
            console.warn('⚠️ Nenhum dado para exportar');
            return;
        }
        const blob = new Blob([JSON.stringify(appData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_motoristas_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },
    
    // Importar dados
    importData: async function(jsonData) {
        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            await this.updateData(data, 'importacao');
            return true;
        } catch (e) {
            console.error('Erro ao importar:', e);
            return false;
        }
    }
};
