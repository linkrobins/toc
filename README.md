# Link Robins Table of Contents

Auto-generated table of contents for Flarum posts. Builds anchors from Markdown headings (`#`, `##`, `###`) and renders an inline TOC at the top of each post that has two or more headings.

Works in two places out of the box:

- Forum discussion posts (anywhere a `.Post-body` is rendered)
- Link Robins Blog articles (`.LinkRobinsBlog-post-body`)

## What it does

For every heading in a post, the extension:

- Generates a stable, readable id from the heading text
- Inserts an invisible scroll anchor above the heading, so a link lands the heading at a comfortable position rather than pinned under the header
- Makes the heading itself click-to-copy: clicking copies a deep link to that section and shows a brief "Link copied" notice. Links inside a heading still work as links.

For each post with enough headings (two by default), it puts a compact "Contents" card at the top of the post listing every heading as a link, indented by depth. Clicking an entry scrolls smoothly to the heading, allowing for your sticky header.

Other behavior:

- **Opening a link to a section works.** If the page address ends in `#some-heading`, the page scrolls to that heading once the post has rendered.
- **Indentation follows what the post actually uses.** A post that starts at `##` is not indented as if it also had a `#`.
- **Skips empty headings** and leaves posts below the minimum untouched, apart from the heading anchors.
- **Needs no migrations or database changes.**

## What it does NOT do

- No BBCode for arbitrary anchors. Headings are anchors. If you want a heading-less anchor, add a heading.
- No floating bottom-right overlay TOC. The inline-at-top-of-post TOC covers the same UX with much less DOM fragility.
- No post-stream scroll synchronization or progress bars.
- No headings deeper than level 3 (`####` and below are never listed).

## Settings

In **Admin → Extensions → Link Robins Table of Contents**:

| Setting | Default | What it does |
|---|---|---|
| Maximum heading depth | 3 | Deepest heading level listed (1 to 3). `1` lists only `#` headings, `3` lists `#`, `##` and `###`. |
| Minimum headings to show | 2 | The Contents card appears only on posts with at least this many headings (1 to 20). |

The card's title and the "Link copied" notice are translatable strings in `locale/en.yml`.

## How heading ids are generated

Within a single post, ids are stable and predictable:

- Heading text is lowercased, spaces and underscores become dashes, other punctuation is dropped, and repeated dashes collapse
- Letters outside plain A to Z (accented or non-Latin) are dropped, and a heading left with nothing gets the fallback id `section`
- Collisions inside the same post get `-2`, `-3` suffixes
- Discussion posts prefix the id with the post number (e.g. `3-introduction`) so two posts on the same page don't fight over `#introduction`; blog articles have no prefix

The result is that linking to a section is just `<page URL>#<id>`. Hovering a heading shows a small link icon; clicking copies the URL.

## Requirements

- Flarum **2.0** or later
- PHP **8.3** or later

## Installation

```sh
composer require linkrobins/toc
```

Then toggle it on in the admin panel's Extensions page.

### Updating

```sh
composer update linkrobins/toc
php flarum cache:clear
```

## License

MIT.
