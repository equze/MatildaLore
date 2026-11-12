(() => {
  const source = window.nicknameData.map((name, id) => ({ name, id }));
  const list = document.querySelector('#nicknameList');
  const feedback = document.querySelector('#feedback');
  const overlay = document.querySelector('#resultOverlay');
  let dragged = null;
  let lastTarget = null;

  document.querySelector('#countLabel').textContent = `${source.length} карточек`;
  function shuffle(items) {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    if (out.every((item, i) => item.id === i)) [out[0], out[1]] = [out[1], out[0]];
    return out;
  }
  function renumber() { [...list.children].forEach((row, i) => { row.querySelector('.card-index').textContent = String(i + 1).padStart(2, '0'); }); }
  function render(items) {
    list.replaceChildren();
    items.forEach((item, index) => {
      const row = document.createElement('li'); row.className = 'nickname-card'; row.draggable = true; row.dataset.id = item.id;
      row.innerHTML = `<span class="card-index">${String(index + 1).padStart(2, '0')}</span><span class="handle" aria-hidden="true">⠿</span><span class="nickname"></span><span class="card-spark" aria-hidden="true">✳</span>`;
      row.querySelector('.nickname').textContent = item.name;
      row.addEventListener('dragstart', event => {
        dragged = row;
        lastTarget = null;
        row.classList.add('dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(item.id));
      });
      row.addEventListener('dragend', () => {
        row.classList.remove('dragging');
        list.querySelectorAll('.near-drop').forEach(el => el.classList.remove('near-drop'));
        dragged = null;
        lastTarget = null;
        renumber();
      });
      row.addEventListener('dragover', event => {
        event.preventDefault();
        if (!dragged || dragged === row) return;
        const rect = row.getBoundingClientRect();
        const before = event.clientY < rect.top + rect.height / 2;
        const position = `${row.dataset.id}:${before ? 'before' : 'after'}`;
        list.querySelectorAll('.near-drop').forEach(el => el.classList.remove('near-drop'));
        row.classList.add('near-drop');
        if (position === lastTarget) return;
        lastTarget = position;
        const destination = before ? row : row.nextSibling;
        if (dragged.nextSibling !== destination) list.insertBefore(dragged, destination);
      });
      row.addEventListener('dragleave', event => {
        if (!row.contains(event.relatedTarget)) row.classList.remove('near-drop');
      });
      row.addEventListener('drop', event => {
        event.preventDefault();
        row.classList.remove('near-drop');
        renumber();
        feedback.textContent = 'Карточки перестроились. Продолжай собирать хронологию.';
      });
      list.append(row);
    });
  }
  function newRound() { render(shuffle(source)); feedback.textContent = 'Выстрой от раннего ника к позднему.'; feedback.classList.remove('success'); overlay.classList.remove('visible'); overlay.setAttribute('aria-hidden', 'true'); }

  document.querySelector('#shuffleBtn').addEventListener('click', newRound);
  document.querySelector('#restartBtn').addEventListener('click', newRound);
  document.querySelector('#checkBtn').addEventListener('click', () => {
    const rows = [...list.children];
    const correct = rows.reduce((sum, row, i) => sum + (Number(row.dataset.id) === i ? 1 : 0), 0);
    rows.forEach((row, i) => row.classList.toggle('correct', Number(row.dataset.id) === i));
    document.querySelector('#resultScore').textContent = `${correct} / ${source.length}`;
    document.querySelector('#resultCopy').textContent = correct === source.length ? 'Безупречно. Ты восстановил всю историю имён.' : `Верных позиций: ${correct}. Можно попробовать ещё раз и собрать всю цепочку.`;
    overlay.classList.add('visible'); overlay.setAttribute('aria-hidden', 'false'); document.querySelector('#restartBtn').focus();
  });
  overlay.addEventListener('click', event => { if (event.target === overlay) { overlay.classList.remove('visible'); overlay.setAttribute('aria-hidden', 'true'); } });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && overlay.classList.contains('visible')) { overlay.classList.remove('visible'); overlay.setAttribute('aria-hidden', 'true'); } });
  render(shuffle(source));
})();
