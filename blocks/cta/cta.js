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
 * Extract href from a <p> element: prefer the href of a child <a>, then fall
 * back to trimmed text content.  Returns '' for a falsy element.
 * @param {Element|null} p
 * @returns {string}
 */
function extractHref(p) {
  if (!p) return '';
  const anchor = p.querySelector('a');
  if (anchor) return anchor.getAttribute('href') || anchor.textContent.trim();
  return p.textContent.trim();
}

/**
 * Loads and decorates the CTA block.
 *
 * aem.live renders both JCR properties (cta_label, cta_href) as consecutive
 * <p> elements inside a single row <div>, NOT as two separate rows.  The DOM
 * therefore looks like:
 *
 *   <div class="cta">           ← block
 *     <div>                     ← outer row wrapper
 *       <div>                   ← single cell
 *         <p>INLOGGEN_______</p>  ← cta_label
 *         <p><a href="/inloggen/">/inloggen/</a></p>  ← cta_href
 *       </div>
 *     </div>
 *   </div>
 *
 * Strategy:
 *   1. Locate the cell (first child of first row).
 *   2. Collect all <p> children of the cell.
 *   3. The href paragraph is the last <p> whose text starts with "/" or "http",
 *      or the last <p> that contains an <a> with an href attribute.
 *   4. The label paragraph is the first <p> that is NOT the href paragraph.
 *
 * @param {Element} block The block element
 */
export default function decorate(block) {
  // The dekkingsgraad indicator is authored as a cta block on some audience
  // pages. It is rebuilt into a chart indicator by normalizeDekkingsgraad
  // (scripts.js); leave its authored content untouched so it is not rendered
  // as a login button.
  if (/dekkingsgraad/i.test(block.textContent)) return;

  // Capture block-level source reference for UE instrumentation.
  const sourceBlock = block;

  // --- Parse label + href from the aem.live-rendered DOM ---
  const outerRow = block.children[0] || null;
  const cell = outerRow ? outerRow.children[0] || outerRow : null;
  const paragraphs = cell ? [...cell.querySelectorAll('p')] : [];

  // Find href paragraph: last <p> that holds a link or looks like a path/URL.
  let hrefPara = null;
  let labelPara = null;

  // Iterate in reverse to find the href paragraph first.
  for (let i = paragraphs.length - 1; i >= 0; i -= 1) {
    const p = paragraphs[i];
    const hasAnchor = !!p.querySelector('a[href]');
    const text = p.textContent.trim();
    const looksLikeUrl = /^(\/|https?:\/\/)/.test(text);
    if (hasAnchor || looksLikeUrl) {
      hrefPara = p;
      break;
    }
  }

  // Label is the first paragraph that is not the href paragraph.
  labelPara = paragraphs.find((p) => p !== hrefPara) || null;

  const rawLabel = labelPara ? labelPara.textContent.trim() : '';
  const label = cleanLabel(rawLabel) || 'Inloggen';
  const href = extractHref(hrefPara);

  // --- Build the CTA element ---
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

    // Label span — only the clean label text, never the href string.
    const labelSpan = document.createElement('span');
    labelSpan.className = 'cta-label';
    labelSpan.textContent = label;

    anchor.append(iconSpan, labelSpan);

    // Move UE instrumentation from the source row to the rebuilt anchor.
    if (outerRow) moveInstrumentation(outerRow, anchor);

    ctaEl.append(anchor);
  } else {
    // No valid href — render as plain labelled span (no clickable anchor).
    const iconSpan = document.createElement('span');
    iconSpan.className = 'icon icon-user';
    iconSpan.setAttribute('aria-hidden', 'true');

    const labelSpan = document.createElement('span');
    labelSpan.className = 'cta-label';
    labelSpan.textContent = label;

    ctaEl.append(iconSpan, labelSpan);

    if (outerRow) moveInstrumentation(outerRow, ctaEl);
  }

  // Move block-level instrumentation to the new inner container.
  moveInstrumentation(sourceBlock, ctaEl);

  block.replaceChildren(ctaEl);
}
