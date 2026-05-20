# Link Robins Table of Contents

Auto-generated table of contents for Flarum posts. Builds anchors from Markdown headings (`#`, `##`, `###`) and renders an inline TOC at the top of each post that has two or more headings.

Works in two places out of the box:

- Forum discussion posts (anywhere a `.Post-body` is rendered)
- Link Robins Blog articles (`.LinkRobinsBlog-post-body`)

## What it does

For every heading in a post, the extension:

- Generates a stable, slugified id from the heading text
- Inserts an invisible scroll anchor above the heading, so clicking a TOC link lands the heading at a comfortable position rather than pinned to the viewport top
- Adds a click-to-copy affordance on the heading itself — clicking copies a deep link to the section

For each post with two or more headings, the extension prepends a compact "Contents" card listing every heading as a navigable link, indented by heading depth.

## What it does NOT do

- No BBCode for arbitrary anchors. Headings are anchors. If you want a heading-less anchor, add a heading.
- No floating bottom-right overlay TOC. The inline-at-top-of-post TOC covers the same UX with much less DOM fragility.
- No post-stream scroll synchronization or progress bars.

## Installation

```sh
composer require linkrobins/toc
php flarum cache:clear
```

Enable from the admin extensions panel. No migrations.

## Configuration

Two settings, both with sensible defaults:

| Setting | Default | What |
|---|---|---|
| `linkrobins-toc.max_depth` | `3` | Highest heading level included in the TOC (`1`, `2`, or `3`) |
| `linkrobins-toc.min_headings` | `2` | TOC is hidden unless the post has at least this many headings |

These currently have no admin UI — set them via the Flarum settings API or directly in the `settings` table. An admin panel can be added later if needed.

## How heading ids are generated

Within a single post, ids are stable and predictable:

- Heading text is lowercased, non-alphanumeric characters become dashes, repeating dashes collapse
- Empty headings get a `section` fallback
- Collisions inside the same post get `-2`, `-3`, suffixes
- Discussion posts prefix the id with the post number (e.g. `3-introduction`) so two posts on the same page don't fight over `#introduction`

The result is that linking to a section is just `<post URL>#<id>`. Hovering a heading shows a small link icon; clicking copies the URL.

## License

MIT.
