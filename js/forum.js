'use strict';

(function () {

    function init() {
        var extendMod = flarum.reg.get('core', 'common/extend');
        var extend = extendMod && extendMod.extend;

        var CommentPost = null;
        try { CommentPost = flarum.reg.get('core', 'forum/components/CommentPost'); } catch (e) {}

        function getForumAttr(key, fallback) {
            try {
                if (app.forum && typeof app.forum.attribute === 'function') {
                    var v = app.forum.attribute(key);
                    if (v === undefined || v === null || v === '') return fallback;
                    return v;
                }
            } catch (e) {}
            return fallback;
        }

        function getMaxDepth() {
            var raw = parseInt(getForumAttr('linkrobinsTocMaxDepth', '3'), 10);
            if (isNaN(raw) || raw < 1) return 1;
            if (raw > 3) return 3;
            return raw;
        }

        function getMinHeadings() {
            var raw = parseInt(getForumAttr('linkrobinsTocMinHeadings', '2'), 10);
            if (isNaN(raw) || raw < 1) return 1;
            return raw;
        }

        function headingSelector() {
            var depth = getMaxDepth();
            var parts = [];
            for (var i = 1; i <= depth; i++) parts.push('h' + i);
            return parts.join(', ');
        }

        function slugify(text) {
            if (typeof text !== 'string') return 'section';
            var s = text.toLowerCase()
                .replace(/[\s_]+/g, '-')
                .replace(/[^a-z0-9\-]+/g, '')
                .replace(/-+/g, '-')
                .replace(/^-+|-+$/g, '');
            return s || 'section';
        }

        function uniqueSlug(base, used) {
            if (!used[base]) {
                used[base] = 1;
                return base;
            }
            used[base] += 1;
            return base + '-' + used[base];
        }


        function findBody(root) {
            if (!root || typeof root.querySelector !== 'function') return null;
            return root.querySelector('.Post-body, .LinkRobinsBlog-post-body');
        }

        function processHeadings(bodyEl, postNumber) {
            var headings = bodyEl.querySelectorAll(headingSelector());
            if (!headings.length) return [];

            var used = {};
            var entries = [];

            for (var i = 0; i < headings.length; i++) {
                var h = headings[i];


                if (h.dataset.linkrobinsTocId) {
                    entries.push({
                        id:    h.dataset.linkrobinsTocId,
                        text:  h.dataset.linkrobinsTocText || (h.textContent || '').trim(),
                        level: parseInt(h.tagName.substring(1), 10) || 1,
                    });
                    continue;
                }

                var text = (h.textContent || '').trim();
                if (!text) continue;

                var baseSlug = slugify(text);
                var prefix   = (postNumber != null ? String(postNumber) + '-' : '');
                var fullId   = uniqueSlug(prefix + baseSlug, used);

                var inner = document.createElement('span');
                inner.className = 'LinkRobinsToc-headingText';
                while (h.firstChild) inner.appendChild(h.firstChild);

                var anchor = document.createElement('span');
                anchor.className = 'LinkRobinsToc-anchor';
                anchor.id        = fullId;

                h.insertBefore(anchor, null);
                h.appendChild(inner);
                h.classList.add('LinkRobinsToc-heading');
                h.dataset.linkrobinsTocId   = fullId;
                h.dataset.linkrobinsTocText = text;

                var icon = document.createElement('i');
                icon.className = 'fas fa-link LinkRobinsToc-linkIcon';
                h.appendChild(icon);

                (function (heading, id) {
                    heading.addEventListener('click', function (ev) {
                        var t = ev.target;
                        while (t && t !== heading) {
                            if (t.tagName === 'A') return;
                            t = t.parentNode;
                        }
                        copyDeepLink(id);
                        ev.preventDefault();
                    });
                })(h, fullId);

                entries.push({
                    id:    fullId,
                    text:  text,
                    level: parseInt(h.tagName.substring(1), 10) || 1,
                });
            }

            return entries;
        }

        function copyDeepLink(id) {
            try {
                var url = window.location.origin + window.location.pathname + '#' + id;
                try { window.history.replaceState(null, '', '#' + id); } catch (e) {}

                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(url).then(showCopiedToast, showCopiedToast);
                } else {
                    var ta = document.createElement('textarea');
                    ta.value = url;
                    ta.setAttribute('readonly', '');
                    ta.style.position = 'absolute';
                    ta.style.left = '-9999px';
                    document.body.appendChild(ta);
                    ta.select();
                    try { document.execCommand('copy'); } catch (e) {}
                    document.body.removeChild(ta);
                    showCopiedToast();
                }
            } catch (e) {}
        }

        var _toastTimer = null;
        function showCopiedToast() {
            var existing = document.querySelector('.LinkRobinsToc-toast');
            if (existing) existing.parentNode.removeChild(existing);

            var label = 'Link copied';
            try {
                var t = app.translator && app.translator.trans('linkrobins-toc.forum.toc.copy_link');
                if (typeof t === 'string' && t) label = t;
            } catch (e) {}

            var el = document.createElement('div');
            el.className = 'LinkRobinsToc-toast';
            el.textContent = label;
            document.body.appendChild(el);

            if (_toastTimer) clearTimeout(_toastTimer);
            _toastTimer = setTimeout(function () {
                try { el.parentNode.removeChild(el); } catch (e) {}
                _toastTimer = null;
            }, 1500);
        }

        function renderTocInto(bodyEl, entries) {
            var existing = bodyEl.querySelector(':scope > .LinkRobinsToc');
            if (existing) existing.parentNode.removeChild(existing);

            var min = getMinHeadings();
            if (entries.length < min) return;

            var nav = document.createElement('nav');
            nav.className = 'LinkRobinsToc';

            var heading = document.createElement('div');
            heading.className = 'LinkRobinsToc-title';
            var headingText = 'Contents';
            try {
                var t = app.translator && app.translator.trans('linkrobins-toc.forum.toc.heading');
                if (typeof t === 'string' && t) headingText = t;
            } catch (e) {}
            heading.textContent = headingText;
            nav.appendChild(heading);

            var list = document.createElement('ol');
            list.className = 'LinkRobinsToc-list';

            var minLevel = Infinity;
            for (var i = 0; i < entries.length; i++) {
                if (entries[i].level < minLevel) minLevel = entries[i].level;
            }
            if (!isFinite(minLevel)) minLevel = 1;

            for (var j = 0; j < entries.length; j++) {
                var e = entries[j];
                var li = document.createElement('li');
                li.className = 'LinkRobinsToc-item LinkRobinsToc-item--level-' + (e.level - minLevel + 1);

                var link = document.createElement('a');
                link.href = '#' + e.id;
                link.textContent = e.text;
                link.className = 'LinkRobinsToc-link';

                (function (id) {
                    link.addEventListener('click', function (ev) {
                        ev.preventDefault();
                        scrollToAnchor(id);
                        try { window.history.replaceState(null, '', '#' + id); } catch (err) {}
                    });
                })(e.id);

                li.appendChild(link);
                list.appendChild(li);
            }

            nav.appendChild(list);
            bodyEl.insertBefore(nav, bodyEl.firstChild);
        }

        function scrollToAnchor(id) {
            if (!id) return;
            var el = document.getElementById(id);
            if (!el) return;
            var rect = el.getBoundingClientRect();
            var offsetY = rect.top + window.pageYOffset;

            var header = document.querySelector('.App-header');
            if (header) {
                var hRect = header.getBoundingClientRect();
                offsetY -= hRect.height;
            }
            offsetY -= 12;

            try {
                window.scrollTo({ top: offsetY, behavior: 'smooth' });
            } catch (e) {
                window.scrollTo(0, offsetY);
            }
        }

        if (CommentPost && CommentPost.prototype && typeof extend === 'function') {
            extend(CommentPost.prototype, 'refreshContent', function () {
                try {
                    if (!this.element) return;
                    var body = findBody(this.element);
                    if (!body) return;

                    var post = this.attrs && this.attrs.post;
                    if (!post) return;

                    var postNumber = null;
                    try {
                        postNumber = (typeof post.number === 'function')
                            ? post.number()
                            : (post.data && post.data.attributes && post.data.attributes.number) || null;
                    } catch (e) {}

                    var entries = processHeadings(body, postNumber);
                    renderTocInto(body, entries);
                } catch (err) {
                    if (window.console && console.error) {
                        console.error('[linkrobins/toc] post processing failed:', err);
                    }
                }
            });
        }

        var processedBlogBodies = new WeakSet();

        function scanForBlogBodies(root) {
            var nodes;
            try {
                nodes = (root || document).querySelectorAll('.LinkRobinsBlog-post-body');
            } catch (e) { return; }
            for (var i = 0; i < nodes.length; i++) {
                var body = nodes[i];
                if (processedBlogBodies.has(body)) continue;
                processedBlogBodies.add(body);
                try {
                    var entries = processHeadings(body, null);
                    renderTocInto(body, entries);
                } catch (err) {
                    processedBlogBodies.delete(body);
                    if (window.console && console.error) {
                        console.error('[linkrobins/toc] blog body processing failed:', err);
                    }
                }
            }
        }

        function startBlogObserver() {
            if (typeof MutationObserver === 'undefined') return;
            var target = document.querySelector('#app') || document.body;
            if (!target) return;
            var observer = new MutationObserver(function (mutations) {
                for (var i = 0; i < mutations.length; i++) {
                    var added = mutations[i].addedNodes;
                    if (!added) continue;
                    for (var j = 0; j < added.length; j++) {
                        var node = added[j];
                        if (node && node.nodeType === 1) {
                            if (node.classList && node.classList.contains('LinkRobinsBlog-post-body')) {
                                scanForBlogBodies(node.parentNode || node);
                            } else if (typeof node.querySelector === 'function'
                                    && node.querySelector('.LinkRobinsBlog-post-body')) {
                                scanForBlogBodies(node);
                            }
                        }
                    }
                }
            });
            observer.observe(target, { childList: true, subtree: true });
        }

        function settleInitialHash() {
            if (!window.location.hash || window.location.hash.length < 2) return;
            var hash = window.location.hash.substring(1);
            var attempts = 0;
            var maxAttempts = 8;
            var interval = setInterval(function () {
                attempts++;
                var el = document.getElementById(hash);
                if (el) {
                    scrollToAnchor(hash);
                    clearInterval(interval);
                } else if (attempts >= maxAttempts) {
                    clearInterval(interval);
                }
            }, 200);
        }

        try {
            scanForBlogBodies(document);
            startBlogObserver();
            settleInitialHash();
        } catch (err) {
            if (window.console && console.error) {
                console.error('[linkrobins/toc] init failed:', err);
            }
        }
    }

    if (typeof app !== 'undefined' && app.initializers && typeof app.initializers.add === 'function') {
        app.initializers.add('linkrobins-toc', init);
    }

})();

