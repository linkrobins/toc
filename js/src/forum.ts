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
  // their bodies appearing in the DOM.
  const processedBlogBodies = new WeakSet<Element>();

  function scanForBlogBodies(root: ParentNode): void {
    root.querySelectorAll('.LinkRobinsBlog-post-body').forEach((body) => {
      if (processedBlogBodies.has(body)) return;
      processedBlogBodies.add(body);
      try {
        const entries = processHeadings(body, null);
        renderTocInto(body, entries);
      } catch (err) {
        processedBlogBodies.delete(body);
        console.error('[linkrobins/toc] blog body processing failed:', err);
      }
    });
  }

  function startBlogObserver(): void {
    const target = document.querySelector('#app') || document.body;
    if (!target) return;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          const el = node as Element;
          if (el.classList.contains('LinkRobinsBlog-post-body')) {
            scanForBlogBodies(el.parentNode || el);
          } else if (el.querySelector('.LinkRobinsBlog-post-body')) {
            scanForBlogBodies(el);
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
