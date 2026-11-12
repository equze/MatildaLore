const passwordDialog = document.querySelector('#password-dialog');
const passwordForm = document.querySelector('#password-form');
const passwordInput = document.querySelector('#password-input');
const passwordError = document.querySelector('#password-error');
const storyButtons = [...document.querySelectorAll('[data-story]')];
const archiveView = document.querySelector('#archive-view');
const readerView = document.querySelector('#reader-view');
const storyContent = document.querySelector('#story-content');
const readerTitle = document.querySelector('#reader-title');
const siteFooter = document.querySelector('#site-footer');
const menuToggle = document.querySelector('#menu-toggle');
const siteMenu = document.querySelector('#site-menu');
const storyList = document.querySelector('#story-list');
const sortSelect = document.querySelector('#sort-stories');

const storyFiles = {
  'exchange-info-08-11-2026': './stories/exchange-info-08-11-2026.txt'
};

let selectedStoryId = null;
let passwordTable = Object.create(null);
let passwordLoadError = false;

async function loadPasswords() {
  try {
    const response = await fetch('./passwords.txt', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Не удалось прочитать passwords.txt (${response.status})`);
    const raw = await response.text();
    passwordTable = Object.create(null);

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const separator = trimmed.indexOf('=');
      if (separator < 1) continue;
      const id = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim();
      if (id && value) passwordTable[id] = value;
    }
    passwordLoadError = false;
  } catch (error) {
    passwordLoadError = true;
    console.error(error);
  } finally {
    storyButtons.forEach((button) => { button.disabled = false; });
  }
}


function sortStories() {
  if (!storyList || !sortSelect) return;
  const cards = [...storyList.querySelectorAll('[data-story]')];
  const count = document.querySelector('#story-count');
  if (count) count.textContent = String(cards.length).padStart(2, '0');
  const mode = sortSelect.value;
  cards.sort((a, b) => {
    const dateA = Date.parse(`${a.dataset.date || '1970-01-01'}T00:00:00`);
    const dateB = Date.parse(`${b.dataset.date || '1970-01-01'}T00:00:00`);
    const orderA = Number(a.dataset.order || 0);
    const orderB = Number(b.dataset.order || 0);
    if (mode === 'date-asc') return dateA - dateB || orderA - orderB;
    if (mode === 'number-asc') return orderA - orderB;
    if (mode === 'number-desc') return orderB - orderA;
    return dateB - dateA || orderB - orderA;
  });
  cards.forEach((card) => storyList.append(card));
}

sortSelect?.addEventListener('change', sortStories);
sortStories();

function closeMenu() {
  siteMenu.hidden = true;
  menuToggle.setAttribute('aria-expanded', 'false');
}

menuToggle.addEventListener('click', () => {
  const opening = siteMenu.hidden;
  siteMenu.hidden = !opening;
  menuToggle.setAttribute('aria-expanded', String(opening));
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.menu-wrap')) closeMenu();
});

document.querySelector('#stories-menu-link').addEventListener('click', () => {
  closeMenu();
  showArchive();
});

document.querySelector('#home-link').addEventListener('click', (event) => {
  event.preventDefault();
  showArchive();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.querySelector('#top-link').addEventListener('click', (event) => {
  event.preventDefault();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.querySelector('.hero-link').addEventListener('click', (event) => {
  event.preventDefault();
  document.querySelector('#stories-section').scrollIntoView({ behavior: 'smooth' });
});

storyButtons.forEach((button) => {
  button.disabled = true;
  button.addEventListener('click', () => {
    selectedStoryId = button.dataset.story;
    passwordError.textContent = '';
    passwordInput.value = '';
    passwordDialog.showModal();
    window.setTimeout(() => passwordInput.focus(), 50);
  });
});

passwordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  passwordError.textContent = '';

  if (passwordLoadError) {
    passwordError.textContent = 'Не удалось загрузить пароль. Запустите сайт через локальный сервер.';
    return;
  }

  const expected = passwordTable[selectedStoryId];
  if (!expected) {
    passwordError.textContent = 'Для этого материала пароль ещё не настроен.';
    return;
  }

  if (passwordInput.value !== expected) {
    passwordError.textContent = 'Пароль не подошёл. Проверьте символы и попробуйте ещё раз.';
    passwordInput.focus();
    passwordInput.select();
    return;
  }

  await openStory(selectedStoryId);
});

// Окно нельзя закрыть кликом по затемнённой области или клавишей Escape.
// Закрытие доступно только по кнопке с крестиком.
passwordDialog.addEventListener('click', (event) => {
  if (event.target === passwordDialog) event.preventDefault();
});
passwordDialog.addEventListener('cancel', (event) => event.preventDefault());

async function openStory(storyId) {
  const path = storyFiles[storyId];
  if (!path) {
    passwordError.textContent = 'Файл этого материала ещё не добавлен в коллекцию.';
    return;
  }

  passwordError.textContent = '';
  const submitButton = passwordForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = 'ЗАГРУЗКА МАТЕРИАЛА';

  try {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Не удалось загрузить материал (${response.status})`);
    const source = await response.text();
    const rendered = window.MatildaStory.render(source);

    const storyCard = storyButtons.find((button) => button.dataset.story === storyId);
    readerTitle.textContent = rendered.title || storyCard?.dataset.title || 'Материал';
    storyContent.innerHTML = rendered.html;
    passwordDialog.close();
    archiveView.hidden = true;
    readerView.hidden = false;
    siteFooter.hidden = true;
    closeMenu();
    window.scrollTo({ top: 0, behavior: 'auto' });
  } catch (error) {
    console.error(error);
    passwordError.textContent = 'Не удалось открыть файл материала. Проверьте его расположение и попробуйте ещё раз.';
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'ПРОВЕРИТЬ ПАРОЛЬ';
  }
}

function showArchive() {
  readerView.hidden = true;
  archiveView.hidden = false;
  siteFooter.hidden = false;
  closeMenu();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

document.querySelector('#back-to-archive').addEventListener('click', showArchive);
document.querySelector('#footer-back-to-archive').addEventListener('click', showArchive);

// Делегированные обработчики интерактивных элементов внутри материалов.
storyContent.addEventListener('click', (event) => {
  const spoiler = event.target.closest('[data-spoiler]');
  if (spoiler) {
    spoiler.classList.toggle('revealed');
    spoiler.setAttribute('aria-pressed', String(spoiler.classList.contains('revealed')));
  }
});
storyContent.addEventListener('keydown', (event) => {
  const spoiler = event.target.closest('[data-spoiler]');
  if (spoiler && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    spoiler.classList.toggle('revealed');
    spoiler.setAttribute('aria-pressed', String(spoiler.classList.contains('revealed')));
  }
});

loadPasswords();
