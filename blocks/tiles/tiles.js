/**
 * Tiles block — decorates InfoTilesWithCtas (default) and
 * PolicyCoverageLoginTeaser (inverted) source components.
 *
 * Content model (child item rows, data-aue-component="tile-item"):
 *   cell 0 — tile_link      (text: URL)
 *   cell 1 — tile_image     (reference: img src, default variant only)
 *   cell 2 — tile_heading   (richtext: card heading or inverted label)
 *   cell 3 — tile_body      (richtext: body paragraph, default variant only)
 *   cell 4 — tile_cta_text  (text: CTA button label, default variant only)
 *   cell 5 — tile_icon      (text: BPFicons class suffix, inverted variant only)
 *
 * Variants:
 *   default  — 3-col white-card grid (InfoTilesWithCtas)
 *   inverted — 2-col full-purple icon grid (PolicyCoverageLoginTeaser)
 *
 * @param {Element} block
 */
export default function decorate(block) {
  const isInverted = block.classList.contains('inverted');

  // Collect all item rows (authored as child items with data-aue-component)
  // In the block gallery static HTML there is no data-aue-component; treat every
  // child row that is a <div> as a tile item row (both UE and gallery paths).
  const rows = [...block.children];

  // Build the tile grid wrapper
  const grid = document.createElement('div');
  grid.className = 'tiles-grid';

  rows.forEach((row) => {
    // Cell extraction handles two content shapes:
    //   1) DA / block-gallery — row has N sibling <div> cells, one per field.
    //   2) AEM franklin.delivery — row has one wrapper <div> containing <p>
    //      elements (one per field). Detect by checking for a single wrapper
    //      whose children are all <p>.
    let cells;
    const onlyChild = row.children.length === 1 ? row.children[0] : null;
    if (
      onlyChild
      && onlyChild.tagName === 'DIV'
      && onlyChild.children.length > 0
      && [...onlyChild.children].every((c) => c.tagName === 'P')
    ) {
      cells = [...onlyChild.children];
    } else {
      cells = [...row.children];
    }

    // Helper: extract text content of a cell (trimmed)
    const text = (cell) => (cell ? cell.textContent.trim() : '');

    // Helper: extract the first href from a cell (anchor or raw text URL)
    const href = (cell) => {
      if (!cell) return '';
      const a = cell.querySelector('a');
      if (a) return a.getAttribute('href') || a.textContent.trim() || '';
      return cell.textContent.trim();
    };

    // Helper: extract inner HTML of a cell for rich-text fields
    const richHtml = (cell) => (cell ? cell.innerHTML : '');

    const tileLink = href(cells[0]);
    // tile_image: prefer a real <img>; fall back to an anchor href (franklin.delivery
    // renders @reference fields as <a href="…">…</a> rather than <img>).
    const tileImage = cells[1] ? cells[1].querySelector('img') : null;
    const tileImageSrc = tileImage
      ? tileImage.getAttribute('src')
      : (cells[1] && cells[1].querySelector('a')
        ? cells[1].querySelector('a').getAttribute('href') || ''
        : '');
    const tileImageAlt = tileImage ? (tileImage.getAttribute('alt') || '') : '';
    const tileHeadingHtml = richHtml(cells[2]);
    const tileBodyHtml = richHtml(cells[3]);
    const tileCtaText = text(cells[4]);
    const tileIcon = text(cells[5]);

    // Skip rows with no navigable link (guard against edge case EC-tiles-003)
    if (!tileLink) return;

    if (isInverted) {
      // ── Inverted variant: entire tile is a single <a> ──────────────────────
      const tileEl = document.createElement('a');
      tileEl.className = 'top-panel';
      tileEl.href = tileLink;

      if (tileIcon) {
        const iconSpan = document.createElement('span');
        iconSpan.className = `icon icon-${tileIcon}`;
        iconSpan.setAttribute('aria-hidden', 'true');
        tileEl.append(iconSpan);
      }

      const labelSpan = document.createElement('span');
      // Strip any trailing underscores (EC-tiles-004) that P1 captured raw
      labelSpan.textContent = tileHeadingHtml.replace(/<[^>]+>/g, '').replace(/_+\s*$/, '').trim();
      tileEl.append(labelSpan);

      // Transfer UE instrumentation from the source row
      if (row.dataset.aueComponent) {
        tileEl.dataset.aueComponent = row.dataset.aueComponent;
        tileEl.dataset.aueBehavior = row.dataset.aueBehavior || '';
        tileEl.dataset.aueResource = row.dataset.aueResource || '';
        tileEl.dataset.aueType = row.dataset.aueType || '';
      }

      grid.append(tileEl);
    } else {
      // ── Default variant: white card with image, heading, body, CTA ─────────
      const card = document.createElement('div');
      card.className = 'panel';

      // Image / figure (optional)
      if (tileImageSrc) {
        const figLink = document.createElement('a');
        figLink.href = tileLink;
        figLink.setAttribute('tabindex', '-1');
        figLink.setAttribute('aria-hidden', 'true');

        const figure = document.createElement('figure');
        figure.className = 'box-image';

        const img = document.createElement('img');
        img.src = tileImageSrc;
        img.alt = tileImageAlt;
        img.loading = 'lazy';
        img.decoding = 'async';

        figure.append(img);
        figLink.append(figure);
        card.append(figLink);
      }

      // Heading — strip raw HTML tags for a clean text heading, but honour
      // the source DOM which used <h2>; we replicate that.
      const heading = document.createElement('h2');
      // tileHeadingHtml may itself contain <p> or inline markup — unwrap to text
      const headingText = tileHeadingHtml.replace(/<[^>]+>/g, '').trim();
      heading.textContent = headingText;
      card.append(heading);

      // Body paragraph (optional)
      if (tileBodyHtml) {
        const bodyDiv = document.createElement('div');
        bodyDiv.className = 'tile-body';
        bodyDiv.innerHTML = tileBodyHtml;
        card.append(bodyDiv);
      }

      // CTA button (only when text AND link are present — guard EC-tiles-003)
      if (tileCtaText && tileLink) {
        const cta = document.createElement('a');
        cta.className = 'button';
        cta.href = tileLink;
        cta.textContent = tileCtaText;
        card.append(cta);
      }

      // Transfer UE instrumentation
      if (row.dataset.aueComponent) {
        card.dataset.aueComponent = row.dataset.aueComponent;
        card.dataset.aueBehavior = row.dataset.aueBehavior || '';
        card.dataset.aueResource = row.dataset.aueResource || '';
        card.dataset.aueType = row.dataset.aueType || '';
      }

      grid.append(card);
    }
  });

  // Replace block children with the constructed grid
  block.replaceChildren(grid);
}
