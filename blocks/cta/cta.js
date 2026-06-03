import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Strips trailing underscore CMS artifacts from a label string.
 * e.g. "INLOGGEN_______" → "Inloggen"
 * @param {string} raw
 * @returns {string}
 */
function cleanLabel(raw) {
  if (!raw) return '';
  // Remove trailing underscores, then trim
  const stripped = raw.replace(/_+$/, '').trim();
  // Normalize all-caps source artifacts to title-case
  if (stripped === stripped.toUpperCase() && stripped.length > 0) {
    return stripped.charAt(0).toUpperCase() + stripped.slice(1).toLowerCase();
  }
  return stripped;
}

/**
 * Returns the text content of a cell element.
 * @param {Element|null} cell
 * @returns {string}
 */
function cellText(cell) {
  if (!cell) return '';
  return (cell.textContent || '').trim();
}

/**
 * Returns the href from the first anchor in a cell, or the cell's text content.
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
 * Loads and decorates the CTA block.
 * DOM model (vertical, one field per row):
 *   row 0 — cta_label
 *   row 1 — cta_href
 *
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const rows = [...block.children];

  // Extract source rows / cells (before DOM rebuild)
  const labelRow = rows[0] || null;
  const hrefRow = rows[1] || null;

  const labelCell = labelRow ? labelRow.children[0] || labelRow : null;
  const hrefCell = hrefRow ? hrefRow.children[0] || hrefRow : null;

  const rawLabel = cellText(labelCell);
  const label = cleanLabel(rawLabel) || 'Inloggen';
  const href = cellHref(hrefCell);

  // Build the CTA link element
  const ctaEl = document.createElement('div');
  ctaEl.className = 'cta-inner';

  if (href && href !== '#') {
    const anchor = document.createElement('a');
    anchor.className = 'cta-link button';
    anchor.href = href;

    // Icon span (BPFicons user glyph)
    const iconSpan = document.createElement('span');
    iconSpan.className = 'icon icon-user';
    iconSpan.setAttribute('aria-hidden', 'true');

    // Label span
    const labelSpan = document.createElement('span');
    labelSpan.className = 'cta-label';
    labelSpan.textContent = label;

    anchor.append(iconSpan, labelSpan);

    // Move UE instrumentation from source rows to rebuilt elements
    if (labelRow) moveInstrumentation(labelRow, anchor);
    if (hrefRow) moveInstrumentation(hrefRow, anchor);

    ctaEl.append(anchor);
  } else {
    // No valid href — render as plain text (no placeholder anchor)
    const iconSpan = document.createElement('span');
    iconSpan.className = 'icon icon-user';
    iconSpan.setAttribute('aria-hidden', 'true');

    const labelSpan = document.createElement('span');
    labelSpan.className = 'cta-label';
    labelSpan.textContent = label;

    ctaEl.append(iconSpan, labelSpan);

    if (labelRow) moveInstrumentation(labelRow, ctaEl);
  }

  // Move block-level instrumentation
  moveInstrumentation(block, block);

  block.replaceChildren(ctaEl);
}
