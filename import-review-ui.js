(() => {
  const enhance = () => {
    const content = document.getElementById('content');
    const tabs = content?.querySelector('.invoice-tabs');
    const workspace = content?.querySelector('#itau-review');
    if (!content || !tabs || !workspace || workspace.dataset.reviewUiEnhanced === 'true') return;
    workspace.dataset.reviewUiEnhanced = 'true';
    const steps = document.createElement('div');
    steps.className = 'import-flow card';
    steps.setAttribute('aria-label', 'Etapas da importação');
    steps.innerHTML = '<span class="done"><b>1</b> Arquivos</span><span class="active"><b>2</b> Conferir</span><span><b>3</b> Corrigir</span><span><b>4</b> Confirmar</span>';
    tabs.before(steps);
    const guide = document.createElement('p');
    guide.className = 'import-guide muted';
    guide.textContent = 'Compare o PDF com os lançamentos ao lado, corrija os valores e salve o rascunho antes de concluir.';
    tabs.before(guide);

    const pdfPane = workspace.querySelector('.pdf-pane');
    const editor = workspace.querySelector('.review-editor');
    if (pdfPane) {
      const label = document.createElement('div');
      label.className = 'review-panel-label';
      label.innerHTML = '<span>Documento original</span><small>Compare datas, descrições e valores</small>';
      pdfPane.prepend(label);
    }
    if (editor) {
      const label = document.createElement('div');
      label.className = 'review-panel-label';
      label.innerHTML = '<span>Dados que serão importados</span><small>Edite qualquer linha antes de confirmar</small>';
      editor.prepend(label);
    }
  };
  const content = document.getElementById('content');
  if (!content) return;
  new MutationObserver(enhance).observe(content, { childList: true });
  enhance();
})();
