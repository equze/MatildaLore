/*
 * Matilda Lore story text renderer.
 * Истории остаются обычными TXT-файлами; HTML из файлов никогда не исполняется.
 */
(() => {
  const escapeHtml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const allowedTones = new Set(['sand', 'rose', 'blue', 'green', 'violet', 'amber', 'silver', 'teal']);
  const allowedChatStyles = new Set(['classic', 'soft', 'outline', 'note', 'square']);
  const safeMediaPath = (value, extensions) => {
    const path = value.trim();
    if (!path || path.includes('..') || path.startsWith('/') || path.startsWith('\\')) return null;
    if (!/^[\w./ -]+$/.test(path)) return null;
    const ext = path.split('.').pop().toLowerCase();
    return extensions.has(ext) ? path : null;
  };

  function inlineFormat(value) {
    let text = escapeHtml(value);
    // Inline code is temporarily protected from the other formatting rules.
    const codeParts = [];
    text = text.replace(/`([^`\n]+)`/g, (_, code) => {
      const token = `%%CODE${codeParts.length}%%`;
      codeParts.push(`<code>${code}</code>`);
      return token;
    });
    text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    });
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__(.+?)__/g, '<u>$1</u>');
    text = text.replace(/==(.+?)==/g, '<mark>$1</mark>');
    text = text.replace(/~~(.+?)~~/g, '<del>$1</del>');
    text = text.replace(/\+\+(.+?)\+\+/g, '<span class="accent-text">$1</span>');
    text = text.replace(/\?\?(.+?)\?\?/g, '<span class="uncertain-text">$1</span>');
    text = text.replace(/\|\|(.+?)\|\|/g, '<span class="spoiler" tabindex="0" role="button" aria-label="Показать скрытый текст" aria-pressed="false" data-spoiler>$1</span>');
    text = text.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    text = text.replace(/%%CODE(\d+)%%/g, (_, index) => codeParts[Number(index)] || '');
    return text;
  }

  function render(source) {
    const normalized = String(source || '').replace(/^\uFEFF/, '').replace(/\r/g, '');
    const lines = normalized.split('\n');
    const titleLine = lines.find((line) => /^#\s+/.test(line.trim()));
    const title = titleLine ? titleLine.trim().replace(/^#\s+/, '').replace(/\*\*/g, '').replace(/[*_~=|]/g, '') : '';

    const people = Object.create(null);
    let selfName = '';
    for (const rawLine of lines) {
      const line = rawLine.trim();
      let match;
      if ((match = line.match(/^!self:\s*(.+)$/i))) selfName = match[1].trim();
      if ((match = line.match(/^!person:\s*([^|]+)(?:\|\s*([^|]+))?(?:\|\s*([^|]+))?(?:\|\s*([^|]+))?$/i))) {
        const name = match[1].trim();
        const sideValue = (match[2] || '').trim().toLowerCase();
        const toneValue = (match[3] || '').trim().toLowerCase();
        const styleValue = (match[4] || 'classic').trim().toLowerCase();
        people[name.toLowerCase()] = {
          side: ['left', 'right', 'center', 'self'].includes(sideValue) ? (sideValue === 'self' ? 'right' : sideValue) : '',
          tone: allowedTones.has(toneValue) ? toneValue : '',
          style: allowedChatStyles.has(styleValue) ? styleValue : 'classic'
        };
      }
    }

    const output = [];
    let paragraph = [];
    let list = [];
    let listType = '';
    let quote = [];
    let chat = [];
    let chatSpeakerOrder = [];
    let fencedCode = null;
    let multiBlock = null;
    let tableRows = [];
    let timeline = [];
    let autoTone = 0;
    const tones = ['sand', 'rose', 'blue', 'green', 'violet', 'amber', 'teal', 'silver'];

    const flushParagraph = () => {
      if (!paragraph.length) return;
      output.push(`<p>${paragraph.map(inlineFormat).join('<br>')}</p>`);
      paragraph = [];
    };
    const flushList = () => {
      if (!list.length) return;
      const tag = listType === 'ol' ? 'ol' : 'ul';
      output.push(`<${tag}>${list.map((item) => `<li>${item}</li>`).join('')}</${tag}>`);
      list = [];
      listType = '';
    };
    const flushQuote = () => {
      if (!quote.length) return;
      output.push(`<blockquote>${quote.map(inlineFormat).join('<br>')}</blockquote>`);
      quote = [];
    };
    const flushChat = () => {
      if (!chat.length) return;
      output.push(`<div class="chat-thread" aria-label="Фрагмент переписки">${chat.map((message) => {
        const speaker = escapeHtml(message.name);
        const initial = escapeHtml(Array.from(message.name.trim())[0] || '•');
        const time = message.time ? `<time class="chat-time">${escapeHtml(message.time)}</time>` : '';
        const sideClass = `chat-${message.side}`;
        const toneClass = `tone-${message.tone}`;
        const styleClass = `chat-style-${message.style}`;
        const avatar = message.side === 'center' ? '' : `<span class="chat-avatar" aria-hidden="true">${initial}</span>`;
        return `<div class="chat-row ${sideClass} ${toneClass} ${styleClass}">${avatar}<div class="chat-message"><div class="chat-message-top"><span class="chat-speaker">${speaker}</span>${time}</div><p>${message.text}</p></div></div>`;
      }).join('')}</div>`);
      chat = [];
    };
    const flushTable = () => {
      if (!tableRows.length) return;
      const rows = tableRows.filter((row) => !/^\s*\|?\s*:?-{3,}/.test(row));
      if (rows.length) {
        const cells = rows.map((row) => row.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()));
        const first = cells[0] || [];
        const body = cells.slice(1);
        output.push(`<div class="table-wrap"><table><thead><tr>${first.map((cell) => `<th>${inlineFormat(cell)}</th>`).join('')}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${inlineFormat(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      }
      tableRows = [];
    };
    const flushTimeline = () => {
      if (!timeline.length) return;
      output.push(`<div class="story-timeline">${timeline.map((item) => `<div class="timeline-item"><time>${inlineFormat(item.time)}</time><p>${inlineFormat(item.text)}</p></div>`).join('')}</div>`);
      timeline = [];
    };
    const flushAll = () => {
      flushParagraph(); flushList(); flushQuote(); flushChat(); flushTable(); flushTimeline();
    };

    const parseChatLine = (line) => {
      const match = line.match(/^@([^:]{1,48}?)(?:\s+\[([^\]]{1,24})\])?:\s*(.*)$/);
      if (!match) return false;
      const name = match[1].trim();
      const key = name.toLowerCase();
      const definition = people[key] || {};
      if (!chatSpeakerOrder.includes(key)) chatSpeakerOrder.push(key);
      const orderIndex = chatSpeakerOrder.indexOf(key);
      const isSelf = selfName && key === selfName.toLowerCase();
      const side = definition.side || (isSelf ? 'right' : (orderIndex % 2 === 0 ? 'left' : 'right'));
      const tone = definition.tone || (isSelf ? 'sand' : tones[orderIndex % tones.length]);
      const style = definition.style || (side === 'center' ? 'square' : (isSelf ? 'soft' : 'classic'));
      chat.push({ name, time: match[2] || '', text: inlineFormat(match[3]), side, tone, style });
      return true;
    };

    for (let index = 0; index < lines.length; index += 1) {
      const original = lines[index];
      const line = original.trimEnd();
      const trimmed = line.trim();
      let match;

      if (fencedCode !== null) {
        if (trimmed.startsWith('```')) {
          output.push(`<pre class="code-block"><code>${escapeHtml(fencedCode.join('\n'))}</code></pre>`);
          fencedCode = null;
        } else fencedCode.push(original);
        continue;
      }
      if (multiBlock) {
        if (trimmed === ':::') {
          const body = multiBlock.lines.map(inlineFormat).join('<br>');
          if (multiBlock.type === 'poem') output.push(`<div class="poem-block">${body}</div>`);
          else if (multiBlock.type === 'center') output.push(`<div class="center-block">${body}</div>`);
          else if (multiBlock.type === 'quote') output.push(`<blockquote class="quote-card">${body}</blockquote>`);
          else if (multiBlock.type === 'transcript') output.push(`<div class="transcript-block">${body}</div>`);
          else if (multiBlock.type === 'report') output.push(`<article class="report-block">${body}</article>`);
          else if (multiBlock.type === 'signature') output.push(`<div class="signature-block">${body}</div>`);
          else if (multiBlock.type === 'caption') output.push(`<div class="caption-block">${body}</div>`);
          else if (multiBlock.type === 'letter') output.push(`<article class="letter-block">${body}</article>`);
          else if (multiBlock.type === 'document') output.push(`<article class="document-block">${body}</article>`);
          else if (multiBlock.type === 'terminal') output.push(`<pre class="terminal-block"><code>${escapeHtml(multiBlock.lines.join('\n'))}</code></pre>`);
          else if (multiBlock.type === 'spoiler') output.push(`<details class="spoiler-block"><summary>${escapeHtml(multiBlock.title || 'Скрытый фрагмент')}</summary><div>${body}</div></details>`);
          else if (multiBlock.type === 'scene') output.push(`<section class="scene-block"><span class="editorial-kicker">СЦЕНА</span>${multiBlock.title ? `<h3>${inlineFormat(multiBlock.title)}</h3>` : ''}<div>${body}</div></section>`);
          else if (multiBlock.type === 'profile') output.push(`<article class="profile-block"><span class="editorial-kicker">ДОСЬЕ ПЕРСОНАЖА</span>${multiBlock.title ? `<h3>${inlineFormat(multiBlock.title)}</h3>` : ''}<div>${body}</div></article>`);
          else if (multiBlock.type === 'location') output.push(`<article class="location-block"><span class="editorial-kicker">МЕСТО</span>${multiBlock.title ? `<h3>${inlineFormat(multiBlock.title)}</h3>` : ''}<div>${body}</div></article>`);
          else if (multiBlock.type === 'relationship') output.push(`<article class="relationship-block"><span class="editorial-kicker">СВЯЗИ И ОТНОШЕНИЯ</span>${multiBlock.title ? `<h3>${inlineFormat(multiBlock.title)}</h3>` : ''}<div>${body}</div></article>`);
          else if (multiBlock.type === 'evidence') output.push(`<article class="evidence-block"><span class="editorial-kicker">МАТЕРИАЛ / СВИДЕТЕЛЬСТВО</span>${multiBlock.title ? `<h3>${inlineFormat(multiBlock.title)}</h3>` : ''}<div>${body}</div></article>`);
          else if (multiBlock.type === 'sidebar') output.push(`<aside class="sidebar-block"><span class="editorial-kicker">НА ПОЛЯХ</span><div>${body}</div></aside>`);
          else if (multiBlock.type === 'system') output.push(`<aside class="system-block"><span class="editorial-kicker">СИСТЕМНОЕ СООБЩЕНИЕ</span><div>${body}</div></aside>`);
          else {
            const normalizedType = multiBlock.type;
            const labels = { note: 'ПРИМЕЧАНИЕ', matilda: 'МАТИЛЬДА', context: 'КОНТЕКСТ', memory: 'ВОСПОМИНАНИЕ', fact: 'ВАЖНАЯ ДЕТАЛЬ', warning: 'ВНИМАНИЕ', source: 'ИСТОЧНИК' };
            output.push(`<aside class="callout callout-${normalizedType}"><span>${labels[normalizedType] || normalizedType.toUpperCase()}</span><div>${body}</div></aside>`);
          }
          multiBlock = null;
        } else multiBlock.lines.push(original);
        continue;
      }

      if (!trimmed) {
        flushParagraph(); flushList(); flushQuote(); flushTable(); flushTimeline();
        // Несколько реплик с пустыми строками между ними остаются единым фрагментом чата.
        continue;
      }

      if (trimmed.startsWith('```')) {
        flushAll();
        fencedCode = [];
        continue;
      }
      if ((match = trimmed.match(/^:::(note|matilda|context|memory|fact|warning|source|letter|document|terminal|poem|spoiler|center|quote|transcript|report|signature|caption|scene|profile|location|relationship|evidence|sidebar|system)(?:\s+(.+))?$/i))) {
        flushAll();
        multiBlock = { type: match[1].toLowerCase(), title: match[2] || '', lines: [] };
        continue;
      }
      if (trimmed === ':::') {
        flushAll();
        output.push('<hr class="story-divider">');
        continue;
      }
      if (/^!self:/i.test(trimmed) || /^!person:/i.test(trimmed)) continue;
      if ((match = trimmed.match(/^#\s+(.+)$/))) {
        flushAll();
        // Основной заголовок уже показан в шапке читалки.
        continue;
      }
      if ((match = trimmed.match(/^####\s+(.+)$/))) { flushAll(); output.push(`<h4>${inlineFormat(match[1])}</h4>`); continue; }
      if ((match = trimmed.match(/^###\s+(.+)$/))) { flushAll(); output.push(`<h3>${inlineFormat(match[1])}</h3>`); continue; }
      if ((match = trimmed.match(/^##\s+(.+)$/))) { flushAll(); output.push(`<h2>${inlineFormat(match[1])}</h2>`); continue; }
      if (trimmed === '---' || trimmed === '***') { flushAll(); output.push('<hr class="story-divider">'); continue; }

      if ((match = trimmed.match(/^!event:\s*([^|]+)\|\s*(.+)$/i))) {
        flushParagraph(); flushList(); flushQuote(); flushChat(); flushTable();
        timeline.push({ time: match[1].trim(), text: match[2].trim() });
        continue;
      }

      if ((match = trimmed.match(/^!date:\s*(.*)$/i))) { flushAll(); output.push(`<p class="story-date"><span>ДАТА ПЕРЕПИСКИ</span><time>${inlineFormat(match[1])}</time></p>`); continue; }
      if ((match = trimmed.match(/^!time:\s*(.*)$/i))) { flushAll(); output.push(`<p class="story-time">${inlineFormat(match[1])}</p>`); continue; }
      if ((match = trimmed.match(/^!place:\s*(.*)$/i))) { flushAll(); output.push(`<p class="story-place"><span>МЕСТО</span>${inlineFormat(match[1])}</p>`); continue; }
      if ((match = trimmed.match(/^!tag:\s*(.*)$/i))) { flushAll(); output.push(`<p class="story-tags">${match[1].split('|').map((tag) => `<span>${inlineFormat(tag.trim())}</span>`).join('')}</p>`); continue; }
      if ((match = trimmed.match(/^!status:\s*(.*)$/i))) { flushAll(); output.push(`<p class="story-status-line">${inlineFormat(match[1])}</p>`); continue; }
      if ((match = trimmed.match(/^!note:\s*(.*)$/i))) { flushAll(); output.push(`<aside class="callout callout-note"><span>ПРИМЕЧАНИЕ</span><div>${inlineFormat(match[1])}</div></aside>`); continue; }
      if ((match = trimmed.match(/^!matilda:\s*(.*)$/i))) { flushAll(); output.push(`<aside class="callout callout-matilda"><span>МАТИЛЬДА</span><div>${inlineFormat(match[1])}</div></aside>`); continue; }
      if ((match = trimmed.match(/^!context:\s*(.*)$/i))) { flushAll(); output.push(`<aside class="callout callout-context"><span>КОНТЕКСТ</span><div>${inlineFormat(match[1])}</div></aside>`); continue; }
      if ((match = trimmed.match(/^!memory:\s*(.*)$/i))) { flushAll(); output.push(`<aside class="callout callout-memory"><span>ВОСПОМИНАНИЕ</span><div>${inlineFormat(match[1])}</div></aside>`); continue; }
      if ((match = trimmed.match(/^!fact:\s*(.*)$/i))) { flushAll(); output.push(`<aside class="callout callout-fact"><span>ВАЖНАЯ ДЕТАЛЬ</span><div>${inlineFormat(match[1])}</div></aside>`); continue; }
      if ((match = trimmed.match(/^!warning:\s*(.*)$/i))) { flushAll(); output.push(`<aside class="callout callout-warning"><span>ВНИМАНИЕ</span><div>${inlineFormat(match[1])}</div></aside>`); continue; }
      if ((match = trimmed.match(/^!thought:\s*(.*)$/i))) { flushAll(); output.push(`<div class="thought-block"><span>ВНУТРЕННЯЯ МЫСЛЬ</span><p>${inlineFormat(match[1])}</p></div>`); continue; }
      if ((match = trimmed.match(/^!source:\s*(.*)$/i))) { flushAll(); output.push(`<aside class="callout callout-source"><span>ИСТОЧНИК</span><div>${inlineFormat(match[1])}</div></aside>`); continue; }
      if ((match = trimmed.match(/^!summary:\s*(.*)$/i))) { flushAll(); output.push(`<aside class="callout callout-summary"><span>КРАТКИЙ ИТОГ</span><div>${inlineFormat(match[1])}</div></aside>`); continue; }
      if ((match = trimmed.match(/^!decision:\s*(.*)$/i))) { flushAll(); output.push(`<aside class="callout callout-decision"><span>РЕШЕНИЕ</span><div>${inlineFormat(match[1])}</div></aside>`); continue; }
      if ((match = trimmed.match(/^!question:\s*(.*)$/i))) { flushAll(); output.push(`<aside class="callout callout-question"><span>ОТКРЫТЫЙ ВОПРОС</span><div>${inlineFormat(match[1])}</div></aside>`); continue; }
      if ((match = trimmed.match(/^!quote:\s*(.*)$/i))) { flushAll(); output.push(`<blockquote class="quote-card">${inlineFormat(match[1])}</blockquote>`); continue; }
      if ((match = trimmed.match(/^!center:\s*(.*)$/i))) { flushAll(); output.push(`<div class="center-block">${inlineFormat(match[1])}</div>`); continue; }
      if ((match = trimmed.match(/^!caption:\s*(.*)$/i))) { flushAll(); output.push(`<div class="caption-block">${inlineFormat(match[1])}</div>`); continue; }
      if ((match = trimmed.match(/^!emotion:\s*(.*)$/i))) { flushAll(); output.push(`<p class="emotion-line"><span>СОСТОЯНИЕ</span>${inlineFormat(match[1])}</p>`); continue; }
      if ((match = trimmed.match(/^!weather:\s*(.*)$/i))) { flushAll(); output.push(`<p class="weather-line"><span>ОБСТАНОВКА</span>${inlineFormat(match[1])}</p>`); continue; }
      if ((match = trimmed.match(/^!chapter:\s*([^|]+)(?:\|\s*(.*))?$/i))) { flushAll(); output.push(`<div class="chapter-marker"><span>${inlineFormat(match[1].trim())}</span><strong>${inlineFormat(match[2] || '')}</strong></div>`); continue; }
      if ((match = trimmed.match(/^!relation:\s*(.*)$/i))) { flushAll(); output.push(`<aside class="callout callout-relationship"><span>СВЯЗЬ</span><div>${inlineFormat(match[1])}</div></aside>`); continue; }
      if ((match = trimmed.match(/^!entity:\s*([^|]+)\|\s*(.*)$/i))) { flushAll(); output.push(`<div class="entity-line"><span>${inlineFormat(match[1].trim())}</span><strong>${inlineFormat(match[2])}</strong></div>`); continue; }
      if ((match = trimmed.match(/^!meta:\s*([^|]+)\|\s*(.*)$/i))) { flushAll(); output.push(`<div class="meta-line"><span>${inlineFormat(match[1].trim())}</span><strong>${inlineFormat(match[2])}</strong></div>`); continue; }
      if ((match = trimmed.match(/^!letter:\s*(.*)$/i))) { flushAll(); output.push(`<article class="letter-block">${inlineFormat(match[1])}</article>`); continue; }
      if ((match = trimmed.match(/^!redacted:\s*(.*)$/i))) { flushAll(); output.push(`<p class="redacted-line"><span class="redacted-bar" aria-hidden="true"></span>${inlineFormat(match[1])}</p>`); continue; }
      if ((match = trimmed.match(/^!file:\s*([^|]+)\|\s*(.+)$/i))) {
        flushAll();
        const path = safeMediaPath(match[2], new Set(['txt', 'pdf', 'zip', 'docx', 'xlsx', 'png', 'jpg', 'jpeg', 'webp']));
        if (path) output.push(`<a class="attachment-card" href="${escapeHtml(path)}" target="_blank" rel="noopener noreferrer"><span class="attachment-type">ФАЙЛ</span><span>${inlineFormat(match[1].trim())}</span></a>`);
        continue;
      }
      if ((match = trimmed.match(/^!image:\s*([^|]+?)(?:\|\s*(.*))?$/i))) {
        flushAll();
        const path = safeMediaPath(match[1], new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']));
        if (path) output.push(`<figure class="story-image"><img src="${escapeHtml(path)}" alt="${escapeHtml(match[2] || 'Иллюстрация к истории')}" loading="lazy">${match[2] ? `<figcaption>${inlineFormat(match[2])}</figcaption>` : ''}</figure>`);
        continue;
      }
      if ((match = trimmed.match(/^!audio:\s*(.*)$/i))) {
        flushAll();
        const path = safeMediaPath(match[1], new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac']));
        if (path) output.push(`<div class="media-card"><span>АУДИОЗАПИСЬ</span><audio controls preload="none" src="${escapeHtml(path)}"></audio></div>`);
        continue;
      }
      if ((match = trimmed.match(/^!video:\s*(.*)$/i))) {
        flushAll();
        const path = safeMediaPath(match[1], new Set(['mp4', 'webm', 'ogv']));
        if (path) output.push(`<div class="media-card"><span>ВИДЕОЗАПИСЬ</span><video controls preload="metadata" src="${escapeHtml(path)}"></video></div>`);
        continue;
      }

      if (parseChatLine(trimmed)) { flushParagraph(); flushList(); flushQuote(); flushTable(); flushTimeline(); continue; }
      if (/^\|.*\|$/.test(trimmed)) { flushParagraph(); flushList(); flushQuote(); flushChat(); flushTimeline(); tableRows.push(trimmed); continue; }
      if (trimmed.startsWith('> ')) { flushParagraph(); flushList(); flushChat(); flushTable(); flushTimeline(); quote.push(trimmed.slice(2)); continue; }
      if ((match = trimmed.match(/^[-*]\s+(.+)$/))) {
        flushParagraph(); flushQuote(); flushChat(); flushTable(); flushTimeline();
        if (listType && listType !== 'ul') flushList();
        listType = 'ul'; list.push(inlineFormat(match[1])); continue;
      }
      if ((match = trimmed.match(/^\d+[.)]\s+(.+)$/))) {
        flushParagraph(); flushQuote(); flushChat(); flushTable(); flushTimeline();
        if (listType && listType !== 'ol') flushList();
        listType = 'ol'; list.push(inlineFormat(match[1])); continue;
      }
      if ((match = trimmed.match(/^\[([ xX])\]\s+(.+)$/))) {
        flushParagraph(); flushQuote(); flushChat(); flushTable(); flushTimeline();
        const checked = match[1].toLowerCase() === 'x';
        if (listType && listType !== 'ul') flushList();
        listType = 'ul';
        list.push(`<label class="check-item"><input type="checkbox" disabled ${checked ? 'checked' : ''}><span>${inlineFormat(match[2])}</span></label>`);
        continue;
      }

      flushList(); flushQuote(); flushChat(); flushTable(); flushTimeline();
      paragraph.push(trimmed);
    }

    if (fencedCode !== null) output.push(`<pre class="code-block"><code>${escapeHtml(fencedCode.join('\n'))}</code></pre>`);
    if (multiBlock) output.push(`<aside class="callout callout-note"><span>ПРИМЕЧАНИЕ</span><div>${multiBlock.lines.map(inlineFormat).join('<br>')}</div></aside>`);
    flushAll();
    return { title, html: output.join('\n') };
  }

  window.MatildaStory = { render };
})();
