/**
 * Content Block — EDS / Universal Editor
 *
 * Fallback bucket consolidating BenefitsArticleTeaser and RelatedArticlesTeaser
 * sources into a static two-column editorial section.
 *
 * Content model field order (component-models.json → _content-block.json):
 *   rows[0] — section_heading  (optional plain text)
 *   rows[1] — left_heading     (richtext — contains h2)
 *   rows[2] — left_body        (richtext — paragraphs, inline links)
 *   rows[3] — left_cta_text    (plain text, optional)
 *   rows[4] — left_cta_url     (plain text / link, optional)
 *   rows[5] — right_heading    (richtext — contains h2, optional)
 *   rows[6] — right_body       (richtext — paragraphs or ul, optional)
 *   rows[7] — right_cta_text   (plain text, optional)
 *   rows[8] — right_cta_url    (plain text / link, optional)
 *
 * DOM output (after decoration):
 *   <div class="content-block block [content-block-with-link-list]">
 *     [<h2 class="content-block-section-heading">…</h2>]
 *     <div class="content-block-columns">
 *       <div class="content-block-col content-block-col--left">
 *         <h2>…left_heading…</h2>
 *         …left_body HTML…
 *         [<a class="content-block-cta" href="…">…left_cta_text…</a>]
 *       </div>
 *       <div class="content-block-col content-block-col-right">
 *         [<h2>…right_heading…</h2>]
 *         …right_body HTML…
 *         [<a class="content-block-cta" href="…">…right_cta_text…</a>]
 *       </div>
 *     </div>
 *   </div>
 *
 * Variant trigger: block classList contains "with-link-list"
 * (EDS appends modifier class names from the block header cell, e.g.
 * "Content Block (with link list)" → class="content-block with-link-list block")
 *
 * No interactive states — pure static decoration.
 */

/**
 * Extract the trimmed text content of a cell element.
 * @param {Element|null} cell
 * @returns {string}
 */
function cellText(cell) {
  return cell ? (cell.textContent || '').trim() : '';
}

/**
 * Extract the href from a cell. Prefers an <a> child, falls back to textContent.
 * @param {Element|null} cell
 * @returns {string}
 */
function cellHref(cell) {
  if (!cell) return '';
  const a = cell.querySelector('a');
  if (a) return a.getAttribute('href') || a.textContent.trim() || '';
  return cell.textContent.trim();
}

/**
 * Build a column div from heading, body, CTA text, and CTA URL.
 * @param {string} side - 'left' | 'right'
 * @param {object} opts
 * @param {string} opts.headingHtml
 * @param {string} opts.bodyHtml
 * @param {string} opts.ctaText
 * @param {string} opts.ctaHref
 * @returns {HTMLElement}
 */
function buildColumn(side, {
  headingHtml, bodyHtml, ctaText, ctaHref,
}) {
  const col = document.createElement('div');
  col.className = `content-block-col content-block-col--${side}`;

  // Heading — render whatever richtext the cell contains
  // (authors write h2 in the richtext cell; preserve it verbatim)
  if (headingHtml) {
    const headingWrap = document.createElement('div');
    headingWrap.className = 'content-block-col-heading';
    headingWrap.innerHTML = headingHtml;
    col.appendChild(headingWrap);
  }

  // Body — richtext (paragraphs, ul, inline links)
  if (bodyHtml) {
    const bodyWrap = document.createElement('div');
    bodyWrap.className = 'content-block-col-body';
    bodyWrap.innerHTML = bodyHtml;
    col.appendChild(bodyWrap);
  }

  // Standalone CTA link (below body text)
  if (ctaText && ctaHref) {
    const cta = document.createElement('a');
    cta.className = 'content-block-cta';
    cta.href = ctaHref;
    cta.textContent = ctaText;
    col.appendChild(cta);
  } else if (ctaText && !ctaHref) {
    // EC-content-block-001: CTA text without URL — render as span with warning
    // eslint-disable-next-line no-console
    console.warn('[content-block] CTA text without URL:', ctaText);
    const cta = document.createElement('span');
    cta.className = 'content-block-cta content-block-cta-no-href';
    cta.textContent = ctaText;
    col.appendChild(cta);
  }

  return col;
}

/**
 * @param {Element} block
 */
export default function decorate(block) {
  const rows = [...block.children];

  // Detect variant — EDS appends modifier class from block header cell
  const isWithLinkList = block.classList.contains('with-link-list');
  if (isWithLinkList) {
    block.classList.add('content-block-with-link-list');
  }

  // ── Read model fields in declaration order ───────────────────────────────
  // Helper: safe access to row's first cell innerHTML / text
  function rowCellHtml(index) {
    const row = rows[index];
    if (!row) return '';
    const cell = row.children[0] || row;
    return (cell.innerHTML || '').trim();
  }
  function rowCellText(index) {
    const row = rows[index];
    if (!row) return '';
    const cell = row.children[0] || row;
    return cellText(cell);
  }
  function rowCellHref(index) {
    const row = rows[index];
    if (!row) return '';
    const cell = row.children[0] || row;
    return cellHref(cell);
  }

  const sectionHeadingText = rowCellText(0);
  const leftHeadingHtml = rowCellHtml(1);
  const leftBodyHtml = rowCellHtml(2);
  const leftCtaText = rowCellText(3);
  const leftCtaHref = rowCellHref(4);
  const rightHeadingHtml = rowCellHtml(5);
  const rightBodyHtml = rowCellHtml(6);
  const rightCtaText = rowCellText(7);
  const rightCtaHref = rowCellHref(8);

  // ── Build new DOM structure ──────────────────────────────────────────────
  const fragment = document.createDocumentFragment();

  // Optional full-width section heading (B-content-block-006)
  if (sectionHeadingText) {
    const sectionH2 = document.createElement('h2');
    sectionH2.className = 'content-block-section-heading';
    sectionH2.textContent = sectionHeadingText;
    fragment.appendChild(sectionH2);
  }

  // Two-column wrapper
  const columns = document.createElement('div');
  columns.className = 'content-block-columns';

  // Left column (required)
  const leftCol = buildColumn('left', {
    headingHtml: leftHeadingHtml,
    bodyHtml: leftBodyHtml,
    ctaText: leftCtaText,
    ctaHref: leftCtaHref,
  });
  columns.appendChild(leftCol);

  // Right column — render only when at least one field is populated (B-content-block-007)
  const hasRight = rightHeadingHtml || rightBodyHtml || rightCtaText;
  if (hasRight) {
    const rightCol = buildColumn('right', {
      headingHtml: rightHeadingHtml,
      bodyHtml: rightBodyHtml,
      ctaText: rightCtaText,
      ctaHref: rightCtaHref,
    });
    columns.appendChild(rightCol);
  }

  fragment.appendChild(columns);

  // ── Replace block content preserving UE instrumentation on the block root ─
  block.replaceChildren(fragment);
}
