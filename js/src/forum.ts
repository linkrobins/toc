import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';

import { findBody, processHeadings, renderTocInto, scrollToAnchor } from './forum/toc';

app.initializers.add('linkrobins-toc', () => {
  // String-path form so the extension applies whether CommentPost is in an
  // eager or lazy-loaded chunk.
  extend('flarum/forum/components/CommentPost', 'refreshContent', function (this: any) {
    if (!this.element) return;

    const body = findBody(this.element);
    if (!body) return;

    const post = this.attrs?.post;
    if (!post) return;

    const entries = processHeadings(body, post.number() ?? null);
    renderTocInto(body, entries);
  });

  // Blog posts (linkrobins/blog) render outside the PostStream, so watch for
  // their bodies appearing in the DOM. A body can be inserted EMPTY and
  // filled via innerHTML afterwards (that's how the blog renders
  // contentHtml), so a body is only marked processed once it actually
  // yielded headings — and mutations *inside* a body re-trigger its scan.
  const processedBlogBodies = new WeakSet<Element>();

  function processBlogBody(body: Element): void {
    if (processedBlogBodies.has(body)) {
      // Recover if the rendered TOC was wiped after processing (e.g. the
      // body's innerHTML was reset by a re-render) — the heading markers go
      // with it, so a full reprocess is safe.
      if (body.querySelector(':scope > .LinkRobinsToc')) return;
      processedBlogBodies.delete(body);
    }
    try {
      const entries = processHeadings(body, null);
      renderTocInto(body, entries);
      if (entries.length) processedBlogBodies.add(body);
    } catch (err) {
      console.error('[linkrobins/toc] blog body processing failed:', err);
    }
  }

  function scanForBlogBodies(root: ParentNode): void {
    root.querySelectorAll('.LinkRobinsBlog-post-body').forEach(processBlogBody);
  }

  function startBlogObserver(): void {
    // Observe the content container, not #app: blog post bodies render inside
    // #content, so watching the whole app woke this callback on every unrelated
    // mutation (header, composer, dropdowns, alerts) for the entire session.
    // #content persists across SPA navigations while its children swap, so
    // late-inserted blog bodies are still caught. Fall back if it's absent.
    const target = document.querySelector('#content') || document.querySelector('#app') || document.body;
    if (!target) return;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          const el = node as Element;
          if (el.classList.contains('LinkRobinsBlog-post-body')) {
            processBlogBody(el);
          } else if (el.querySelector('.LinkRobinsBlog-post-body')) {
            scanForBlogBodies(el);
          } else {
            // Content added inside an already-present body (e.g. the blog
            // filling contentHtml after insertion).
            const owner = el.closest && el.closest('.LinkRobinsBlog-post-body');
            if (owner) processBlogBody(owner);
          }
        }
      }
    });
    observer.observe(target, { childList: true, subtree: true });
  }

  // Scroll to a #heading anchor present in the URL once the post stream has
  // rendered it (bounded retry, then give up).
  function settleInitialHash(): void {
    if (!window.location.hash || window.location.hash.length < 2) return;
    const hash = window.location.hash.substring(1);
    let attempts = 0;
    const maxAttempts = 8;
    const interval = setInterval(() => {
      attempts++;
      if (document.getElementById(hash)) {
        scrollToAnchor(hash);
        clearInterval(interval);
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 200);
  }

  scanForBlogBodies(document);
  startBlogObserver();
  settleInitialHash();
});
