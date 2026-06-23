import app from 'flarum/forum/app';
import extractText from 'flarum/common/utils/extractText';

export interface TocEntry {
  id: string;
  text: string;
  level: number;
}

function getForumAttr(key: string, fallback: string): string {
  try {
    if (app.forum && typeof app.forum.attribute === 'function') {
      const v = app.forum.attribute(key);
      if (v === undefined || v === null || v === '') return fallback;
      return String(v);
    }
  } catch (e) {
    // app.forum is not available yet (e.g. during init) — use the fallback.
  }
  return fallback;
}

function getMaxDepth(): number {
  const raw = parseInt(getForumAttr('linkrobinsTocMaxDepth', '3'), 10);
  if (isNaN(raw) || raw < 1) return 1;
  if (raw > 3) return 3;
  return raw;
}

function getMinHeadings(): number {
  const raw = parseInt(getForumAttr('linkrobinsTocMinHeadings', '2'), 10);
  if (isNaN(raw) || raw < 1) return 1;
  return raw;
}

function headingSelector(): string {
  const depth = getMaxDepth();
  const parts: string[] = [];
  for (let i = 1; i <= depth; i++) parts.push(`h${i}`);
  return parts.join(', ');
}

function slugify(text: string): string {
  if (typeof text !== 'string') return 'section';
  const s = text
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9\-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'section';
}

// Return an id not yet in `used`, suffixing `-2`, `-3`, ... on collision. We
// track every assigned id (not just a per-base counter) and loop until the
// candidate is free, so a deduped `intro` -> `intro-2` can't collide with a
// heading whose natural slug is already `intro-2`.
function uniqueSlug(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  const id = `${base}-${n}`;
  used.add(id);
  return id;
}

export function findBody(root: Element | null): Element | null {
  if (!root || typeof root.querySelector !== 'function') return null;
  return root.querySelector('.Post-body, .LinkRobinsBlog-post-body');
}

// Pure read: the heading elements that belong in the TOC — already-instrumented
// ones, or new ones with non-empty text. No DOM mutation, so callers can inspect
// the heading set without side effects.
export function collectHeadings(bodyEl: Element): HTMLElement[] {
  const headings = Array.from(bodyEl.querySelectorAll<HTMLElement>(headingSelector()));
  return headings.filter((h) => !!h.dataset.linkrobinsTocId || (h.textContent || '').trim() !== '');
}

// Mutation: assign ids, inject the anchor / link icon / click handler, and
// return the TOC entries. Reuses ids stored on a previous render.
function instrumentHeadings(headings: HTMLElement[], postNumber: number | null): TocEntry[] {
  const used = new Set<string>();
  const entries: TocEntry[] = [];

  headings.forEach((h) => {
    // Already processed on a previous render — reuse the stored id/text, and
    // reserve the id so later headings can't be slugged onto it.
    if (h.dataset.linkrobinsTocId) {
      used.add(h.dataset.linkrobinsTocId);
      entries.push({
        id: h.dataset.linkrobinsTocId,
        text: h.dataset.linkrobinsTocText || (h.textContent || '').trim(),
        level: parseInt(h.tagName.substring(1), 10) || 1,
      });
      return;
    }

    const text = (h.textContent || '').trim();
    if (!text) return;

    const baseSlug = slugify(text);
    const prefix = postNumber != null ? `${postNumber}-` : '';
    const fullId = uniqueSlug(prefix + baseSlug, used);

    const inner = document.createElement('span');
    inner.className = 'LinkRobinsToc-headingText';
    while (h.firstChild) inner.appendChild(h.firstChild);

    const anchor = document.createElement('span');
    anchor.className = 'LinkRobinsToc-anchor';
    anchor.id = fullId;

    h.appendChild(anchor);
    h.appendChild(inner);
    h.classList.add('LinkRobinsToc-heading');
    h.dataset.linkrobinsTocId = fullId;
    h.dataset.linkrobinsTocText = text;

    const icon = document.createElement('i');
    icon.className = 'fas fa-link LinkRobinsToc-linkIcon';
    h.appendChild(icon);

    h.addEventListener('click', (ev) => {
      let t = ev.target as Node | null;
      while (t && t !== h) {
        if ((t as Element).tagName === 'A') return;
        t = t.parentNode;
      }
      copyDeepLink(fullId);
      ev.preventDefault();
    });

    entries.push({
      id: fullId,
      text,
      level: parseInt(h.tagName.substring(1), 10) || 1,
    });
  });

  return entries;
}

// Composed entry point: collect (read) then instrument (mutate). Callers use
// this; the two halves are separable for testing and clarity.
export function processHeadings(bodyEl: Element, postNumber: number | null): TocEntry[] {
  return instrumentHeadings(collectHeadings(bodyEl), postNumber);
}

function copyDeepLink(id: string): void {
  try {
    const url = `${window.location.origin}${window.location.pathname}#${id}`;
    try {
      window.history.replaceState(null, '', `#${id}`);
    } catch (e) {
      // history API unavailable — non-fatal.
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(showCopiedToast, showCopiedToast);
    } else {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.setAttribute('readonly', '');
      ta.style.position = 'absolute';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch (e) {
        // execCommand fallback failed — toast still shows the link is in the URL bar.
      }
      document.body.removeChild(ta);
      showCopiedToast();
    }
  } catch (e) {
    // Clipboard access denied — the hash is still set, so the link is shareable.
  }
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

function showCopiedToast(): void {
  const existing = document.querySelector('.LinkRobinsToc-toast');
  if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

  const el = document.createElement('div');
  el.className = 'LinkRobinsToc-toast';
  el.textContent = extractText(app.translator.trans('linkrobins-toc.forum.toc.copy_link'));
  document.body.appendChild(el);

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
    toastTimer = null;
  }, 1500);
}

export function renderTocInto(bodyEl: Element, entries: TocEntry[]): void {
  const existing = bodyEl.querySelector(':scope > .LinkRobinsToc');
  if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

  if (entries.length < getMinHeadings()) return;

  const nav = document.createElement('nav');
  nav.className = 'LinkRobinsToc';

  const heading = document.createElement('div');
  heading.className = 'LinkRobinsToc-title';
  heading.textContent = extractText(app.translator.trans('linkrobins-toc.forum.toc.heading'));
  nav.appendChild(heading);

  const list = document.createElement('ol');
  list.className = 'LinkRobinsToc-list';

  let minLevel = Infinity;
  for (const e of entries) {
    if (e.level < minLevel) minLevel = e.level;
  }
  if (!isFinite(minLevel)) minLevel = 1;

  for (const e of entries) {
    const li = document.createElement('li');
    li.className = `LinkRobinsToc-item LinkRobinsToc-item--level-${e.level - minLevel + 1}`;

    const link = document.createElement('a');
    link.href = `#${e.id}`;
    link.textContent = e.text;
    link.className = 'LinkRobinsToc-link';

    link.addEventListener('click', (ev) => {
      ev.preventDefault();
      scrollToAnchor(e.id);
      try {
        window.history.replaceState(null, '', `#${e.id}`);
      } catch (err) {
        // history API unavailable — non-fatal.
      }
    });

    li.appendChild(link);
    list.appendChild(li);
  }

  nav.appendChild(list);
  bodyEl.insertBefore(nav, bodyEl.firstChild);
}

export function scrollToAnchor(id: string): void {
  if (!id) return;
  const el = document.getElementById(id);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  let offsetY = rect.top + window.scrollY;

  const header = document.querySelector('.App-header');
  if (header) {
    offsetY -= header.getBoundingClientRect().height;
  }
  offsetY -= 12;

  try {
    window.scrollTo({ top: offsetY, behavior: 'smooth' });
  } catch (e) {
    window.scrollTo(0, offsetY);
  }
}
