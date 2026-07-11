(() => {
  const hasSession = () => { try { return Boolean(JSON.parse(sessionStorage.getItem('clareza_supabase_session') || 'null')?.access_token); } catch { return false; } };
  const clearDemoDashboard = () => {
    if (hasSession() || window.financeState?.view !== 'dashboard') return;
    const content = document.getElementById('content');
    if (!content || content.dataset.demoCleared === 'true') return;
    content.dataset.demoCleared = 'true';
    content.innerHTML = '<div class="welcome"><div><h2>Visão geral</h2><p class="muted">Os dados reais aparecerão após a autenticação.</p></div></div><div class="card"><div class="empty-note"><h3>Nenhum dado demonstrativo</h3><p>Conecte-se ao Supabase para carregar seus dados financeiros reais.</p></div></div>';
  };
  clearDemoDashboard();
})();
