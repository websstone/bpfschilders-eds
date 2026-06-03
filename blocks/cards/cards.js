import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Returns trimmed text content of an element, or empty string.
 * @param {Element|null} el
 * @returns {string}
 */
function text(el) {
  return el ? (el.textContent || '').trim() : '';
}

/**
 * Returns the href from the first anchor child, or the trimmed text, or empty string.
 * @param {Element|null} el
 * @returns {string}
 */
function href(el) {
  if (!el) return '';
  const a = el.querySelector('a');
  if (a) return (a.getAttribute('href') || '').trim();
  return (el.textContent || '').trim();
}

/**
 * Finds a paragraph by data-aue-prop or data-richtext-prop name.
 * @param {Element[]} paragraphs
 * @param {string} prop
 * @returns {Element|null}
 */
function byProp(paragraphs, prop) {
  return paragraphs.find(
    (p) => p.dataset.aueProp === prop || p.dataset.richtextProp === prop,
  ) || null;
}

/**
 * Returns a picture or img element nested inside el, or null.
 * @param {Element|null} el
 * @returns {Element|null}
 */
function pickImage(el) {
  if (!el) return null;
  return el.querySelector('picture') || el.querySelector('img') || null;
}

/**
 * Returns trimmed text from the prop element first, then falls back to cell text.
 * @param {Element|null} propEl
 * @param {Element|null} cellEl
 * @returns {string}
 */
function pickText(propEl, cellEl) {
  if (propEl) return text(propEl);
  if (cellEl) return text(cellEl);
  return '';
}

/**
 * Returns href from the prop element first, then falls back to cell href.
 * @param {Element|null} propEl
 * @param {Element|null} cellEl
 * @returns {string}
 */
function pickHref(propEl, cellEl) {
  if (propEl) return href(propEl);
  if (cellEl) return href(cellEl);
  return '';
}

/**
 * Extracts a /content/dam/ path from a cell that stores the image as a DAM
 * path text-link rather than an embedded <picture>/<img>.
 * Returns null when the cell already contains an actual <picture>/<img>
 * (those are handled by pickImage) or when no DAM path is found.
 * @param {Element|null} cell
 * @returns {string|null}
 */
function extractDamPath(cell) {
  if (!cell) return null;
  // If the cell already has real media, let pickImage handle it.
  if (cell.querySelector('picture, img')) return null;
  // Check anchor href first.
  const a = cell.querySelector('a');
  if (a) {
    const h = (a.getAttribute('href') || '').trim();
    if (h.startsWith('/content/dam/')) return h;
    const t = (a.textContent || '').trim();
    if (t.startsWith('/content/dam/')) return t;
  }
  // Check raw text content (no anchor wrapping).
  const raw = (cell.textContent || '').trim();
  if (raw.startsWith('/content/dam/')) return raw;
  return null;
}

/**
 * Builds an <img> element from a DAM path.
 * The file-name part (without extension) is used as the alt attribute.
 * @param {string} damPath
 * @returns {HTMLImageElement}
 */
function buildImgFromDam(damPath) {
  const img = document.createElement('img');
  img.src = damPath;
  img.loading = 'lazy';
  // Derive a plain alt text from the filename (strip path and extension).
  const filename = damPath.split('/').pop() || '';
  img.alt = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
  return img;
}

/**
 * When cta_url and cta_label are both stored in a single cell as two <p>
 * elements (pattern used by the Sling :operation=import cards), extract both.
 * Returns null when the cell does not match this pattern (so legacy single-cell
 * handling remains the primary path).
 *
 * Expected structure:
 *   <div>
 *     <p><a href="/cta/url">…</a></p>
 *     <p>CTA label text</p>
 *   </div>
 *
 * @param {Element|null} cell
 * @returns {{ ctaUrl: string, ctaLabel: string }|null}
 */
function parseCombinedCtaCell(cell) {
  if (!cell) return null;
  const paras = [...cell.querySelectorAll('p')];
  if (paras.length < 2) return null;
  const ctaUrl = href(paras[0]);
  if (!ctaUrl) return null;
  const ctaLabel = text(paras[1]);
  return { ctaUrl, ctaLabel };
}

/**
 * Parses one card row (a child item row with data-aue-component="card").
 * Field order matches _cards.json model: image, title, description, cta_url, cta_label.
 *
 * Supports two cell layouts emitted by aem.live:
 *
 * 1. Original (over-ons): image cell contains <picture><img>, separate
 *    cta_url (cell3) and cta_label (cell4) cells.
 * 2. Sling-imported (translate, ondernemer): image cell contains a DAM path
 *    as <a> text; cta_url and cta_label are combined in cell3 as two <p>s.
 *
 * @param {Element} row
 * @returns {object} parsed card fields + source element references
 */
function parseCardRow(row) {
  const cells = [...row.children];
  const paragraphs = [...row.querySelectorAll('p')];

  const imageProp = byProp(paragraphs, 'image');
  const titleProp = byProp(paragraphs, 'title');
  const descProp = byProp(paragraphs, 'description');
  const ctaUrlProp = byProp(paragraphs, 'cta_url');
  const ctaLabelProp = byProp(paragraphs, 'cta_label');

  // Positional cells (model order: image, title, description, cta_url, cta_label)
  const cell0 = cells[0] || null;
  const cell1 = cells[1] || null;
  const cell2 = cells[2] || null;
  const cell3 = cells[3] || null;
  const cell4 = cells[4] || null;

  // ── Image ─────────────────────────────────────────────────────────────────
  const imageSource = imageProp || cell0;
  let imageEl = pickImage(imageSource);
  if (!imageEl) {
    // Sling-imported cards store the image as a DAM path text-link in cell0.
    const damPath = extractDamPath(cell0);
    if (damPath) {
      imageEl = buildImgFromDam(damPath);
    }
  }

  // ── Title / description ───────────────────────────────────────────────────
  const titleText = pickText(titleProp, cell1);
  const descText = pickText(descProp, cell2);

  // ── CTA — handle both one-cell-per-field and combined-cell layouts ────────
  let ctaUrl = '';
  let ctaLabelText = '';
  let ctaUrlSource = ctaUrlProp || cell3;
  let ctaLabelSource = ctaLabelProp || cell4;

  if (ctaUrlProp || ctaLabelProp) {
    // UE prop attributes present — trust them.
    ctaUrl = pickHref(ctaUrlProp, cell3);
    ctaLabelText = pickText(ctaLabelProp, cell4);
  } else if (cell4) {
    // Original layout: separate cells for cta_url (cell3) and cta_label (cell4).
    ctaUrl = href(cell3);
    ctaLabelText = text(cell4);
  } else {
    // Sling-imported layout: cta_url + cta_label combined in cell3.
    const combined = parseCombinedCtaCell(cell3);
    if (combined) {
      ctaUrl = combined.ctaUrl;
      ctaLabelText = combined.ctaLabel;
      ctaUrlSource = cell3;
      ctaLabelSource = cell3;
    } else {
      ctaUrl = href(cell3);
      ctaLabelText = '';
    }
  }

  return {
    imageEl,
    imageSource,
    title: titleText,
    description: descText,
    ctaUrl,
    ctaLabel: ctaLabelText,
    titleSource: titleProp || cell1,
    descSource: descProp || cell2,
    ctaUrlSource,
    ctaLabelSource,
  };
}

/**
 * Loads and decorates the cards block.
 * Renders a 3-column CSS grid of feature cards matching TeaserCardGrid source design.
 * Each card: clickable image (via anchor), heading, body text, CTA button.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const rows = [...block.children];

  const grid = document.createElement('div');
  grid.className = 'cards-grid';

  rows.forEach((row) => {
    const card = parseCardRow(row);

    // Build card panel
    const panel = document.createElement('div');
    panel.className = 'cards-panel';
    // Transfer row-level UE instrumentation (data-aue-resource, data-aue-model, data-aue-component)
    moveInstrumentation(row, panel);

    // --- Image anchor wrapper ---
    const validHref = card.ctaUrl && card.ctaUrl !== '#' ? card.ctaUrl : null;

    const figure = document.createElement('figure');
    figure.className = 'cards-panel-image';

    if (card.imageEl) {
      // Clone image/picture so we can move instrumentation from the source cell.
      const imgClone = card.imageEl.cloneNode(true);
      figure.appendChild(imgClone);
      // Transfer image instrumentation from the source cell to the figure.
      if (card.imageSource) moveInstrumentation(card.imageSource, figure);
    }

    if (validHref) {
      const imgAnchor = document.createElement('a');
      imgAnchor.href = validHref;
      imgAnchor.setAttribute('tabindex', '-1');
      imgAnchor.setAttribute('aria-hidden', 'true');
      imgAnchor.appendChild(figure);
      panel.appendChild(imgAnchor);
    } else {
      panel.appendChild(figure);
    }

    // --- Heading (only render when title is non-empty) ---
    if (card.title) {
      const h2 = document.createElement('h2');
      h2.className = 'cards-panel-heading';
      h2.textContent = card.title;
      if (card.titleSource) moveInstrumentation(card.titleSource, h2);
      panel.appendChild(h2);
    }

    // --- Description ---
    if (card.description) {
      const p = document.createElement('p');
      p.className = 'cards-panel-description';
      p.textContent = card.description;
      if (card.descSource) moveInstrumentation(card.descSource, p);
      panel.appendChild(p);
    }

    // --- CTA button ---
    if (validHref && card.ctaLabel) {
      const cta = document.createElement('a');
      cta.href = validHref;
      cta.className = 'button';
      cta.textContent = card.ctaLabel;
      if (card.ctaLabelSource) moveInstrumentation(card.ctaLabelSource, cta);
      panel.appendChild(cta);
    } else if (card.ctaLabel) {
      // href is empty — render plain text per hard constraint (no href="#")
      const span = document.createElement('span');
      span.className = 'button';
      span.textContent = card.ctaLabel;
      panel.appendChild(span);
    }

    grid.appendChild(panel);
  });

  block.replaceChildren(grid);
}
