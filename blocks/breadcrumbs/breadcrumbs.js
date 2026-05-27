/**
 * Breadcrumbs block — EDS / Universal Editor
 *
 * Content model (two-row vertical AEM format):
 *   Row 0 — breadcrumb_links: one cell that may contain one or more <a> elements,
 *            each being an ancestor-page link (<a href="/path/">Label</a>).
 *            Alternatively authored as newline-separated "href|label" or just labels
 *            when the cell holds plain text lines (no <a> elements present).
 *   Row 1 — current_page_label: plain text cell (no href); the current page.
 *
 * Output DOM:
 *   <nav class="breadcrumbs-nav" role="navigation" aria-label="Breadcrumb">
 *     <ol class="breadcrumbs-trail">
 *       <li class="breadcrumbs-item">
 *         <a class="breadcrumb-rootnode" href="/over-ons/">Over ons</a>
 *       </li>
 *       <li class="breadcrumbs-separator" aria-hidden="true">&gt;</li>
 *       <li class="breadcrumbs-item">
 *         <span class="breadcrumb-currentnode" aria-current="page">Dekkingsgraad</span>
 *       </li>
 *     </ol>
 *   </nav>
 *
 * Rules:
 *   - Separators injected by JS — not stored in content.
 *   - No placeholder <a href="#"> — if a link cell has no valid href, render <span>.
 *   - No module-scope state.
 *   - Empty trail (no links, no current label) renders an empty <nav> (no visible items).
 */

/**
 * Extract all ancestor links from a DOM cell.
 * Returns an array of { href: string, label: string } objects.
 * Only produces a link entry when the href is a non-empty non-hash path.
 *
 * @param {Element|null} cell
 * @returns {{ href: string, label: string }[]}
 */
function extractLinks(cell) {
  if (!cell) return [];

  // Prefer authored <a> elements inside the cell
  const anchors = [...cell.querySelectorAll('a')];
  if (anchors.length > 0) {
    return anchors.reduce((acc, a) => {
      const href = (a.getAttribute('href') || '').trim();
      const label = (a.textContent || '').trim();
      if (label) {
        // Only push as a real link when href is a non-empty root-relative path
        acc.push({ href: href && href !== '#' ? href : '', label });
      }
      return acc;
    }, []);
  }

  // Fallback: plain text lines ("label" or "href|label" pairs)
  const text = (cell.textContent || '').trim();
  if (!text) return [];

  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const pipeIdx = line.indexOf('|');
      if (pipeIdx !== -1) {
        return {
          href: line.slice(0, pipeIdx).trim(),
          label: line.slice(pipeIdx + 1).trim(),
        };
      }
      return { href: '', label: line };
    })
    .filter((entry) => entry.label);
}

/**
 * Retrieve the first child div of a row (the cell).
 *
 * @param {Element|null} row
 * @returns {Element|null}
 */
function rowCell(row) {
  return row ? row.children[0] || null : null;
}

/**
 * Build a single trail item element — either an <a> (ancestor) or <span> (current page).
 *
 * @param {{ href: string, label: string }} entry
 * @param {boolean} isCurrent
 * @returns {Element}
 */
function buildTrailNode(entry, isCurrent) {
  if (isCurrent) {
    const span = document.createElement('span');
    span.className = 'breadcrumb-currentnode';
    span.setAttribute('aria-current', 'page');
    span.textContent = entry.label;
    return span;
  }

  // Ancestor link: only use <a> when href is a valid root-relative path
  if (entry.href && entry.href.startsWith('/')) {
    const a = document.createElement('a');
    a.className = 'breadcrumb-rootnode';
    a.href = entry.href;
    a.textContent = entry.label;
    return a;
  }

  // No valid href — render plain span (hard constraint: no placeholder anchors)
  const span = document.createElement('span');
  span.className = 'breadcrumb-rootnode breadcrumb-rootnode-nohref';
  span.textContent = entry.label;
  return span;
}

/**
 * Loads and decorates the breadcrumbs block.
 *
 * @param {Element} block
 */
export default function decorate(block) {
  const rows = [...block.children];

  // ── Extract field data ────────────────────────────────────────────────────
  const linksCell = rowCell(rows[0]);
  const currentCell = rowCell(rows[1]);

  const ancestorLinks = extractLinks(linksCell);
  const currentLabel = currentCell ? (currentCell.textContent || '').trim() : '';

  // ── Build nav ─────────────────────────────────────────────────────────────
  const nav = document.createElement('nav');
  nav.className = 'breadcrumbs-nav';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'Breadcrumb');

  // Empty trail — render empty nav; nothing visible
  const hasContent = ancestorLinks.length > 0 || currentLabel;
  if (!hasContent) {
    // Preserve UE instrumentation from the block root
    block.replaceChildren(nav);
    return;
  }

  const ol = document.createElement('ol');
  ol.className = 'breadcrumbs-trail';

  // ── Render ancestor links ─────────────────────────────────────────────────
  ancestorLinks.forEach((entry, i) => {
    if (i > 0) {
      // Separator between items
      const sepLi = document.createElement('li');
      sepLi.className = 'breadcrumbs-separator';
      sepLi.setAttribute('aria-hidden', 'true');
      sepLi.textContent = '>';
      ol.appendChild(sepLi);
    }

    const li = document.createElement('li');
    li.className = 'breadcrumbs-item';
    li.appendChild(buildTrailNode(entry, false));
    ol.appendChild(li);
  });

  // ── Render current-page label ─────────────────────────────────────────────
  if (currentLabel) {
    if (ancestorLinks.length > 0) {
      // Separator before current page
      const sepLi = document.createElement('li');
      sepLi.className = 'breadcrumbs-separator';
      sepLi.setAttribute('aria-hidden', 'true');
      sepLi.textContent = '>';
      ol.appendChild(sepLi);
    }

    const li = document.createElement('li');
    li.className = 'breadcrumbs-item breadcrumbs-item--current';
    li.appendChild(buildTrailNode({ href: '', label: currentLabel }, true));
    ol.appendChild(li);
  }

  nav.appendChild(ol);

  // Transfer UE instrumentation from original rows before clearing
  [...block.children].forEach((row) => {
    [...row.attributes].forEach((attr) => {
      if (attr.name.startsWith('data-aue-') || attr.name.startsWith('data-richtext-')) {
        nav.setAttribute(attr.name, attr.value);
      }
    });
  });

  block.replaceChildren(nav);
}
