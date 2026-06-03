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
 * Parses one card row (a child item row with data-aue-component="card").
 * Field order matches _cards.json model: image, title, description, cta_url, cta_label.
 * @param {Element} row
 * @returns {{ imageEl: Element|null, title: string, description: string, ctaUrl: string, ctaLabel: string, imageSource: Element|null }}
 */
function parseCardRow(row) {
  const cells = [...row.children];
  // Each cell is a <div>; fields are in model order: image, title, description, cta_url, cta_label
  const paragraphs = [...row.querySelectorAll('p')];

  const imageProp = byProp(paragraphs, 'image');
  const titleProp = byProp(paragraphs, 'title');
  const descProp = byProp(paragraphs, 'description');
  const ctaUrlProp = byProp(paragraphs, 'cta_url');
  const ctaLabelProp = byProp(paragraphs, 'cta_label');

  // Fallback to positional cells when UE prop attributes are absent (gallery/static HTML)
  const cell0 = cells[0] || null;
  const cell1 = cells[1] || null;
  const cell2 = cells[2] || null;
  const cell3 = cells[3] || null;
  const cell4 = cells[4] || null;

  // Image: look for <picture> or <img> in image cell
  const imageEl = imageProp
    ? (imageProp.querySelector('picture') || imageProp.querySelector('img') || null)
    : (cell0 ? (cell0.querySelector('picture') || cell0.querySelector('img') || null) : null);

  const imageSource = imageProp || cell0;

  const titleText = titleProp ? text(titleProp) : (cell1 ? text(cell1) : '');
  const descText = descProp ? text(descProp) : (cell2 ? text(cell2) : '');
  const ctaUrl = ctaUrlProp ? href(ctaUrlProp) : (cell3 ? href(cell3) : '');
  const ctaLabelText = ctaLabelProp ? text(ctaLabelProp) : (cell4 ? text(cell4) : '');

  return {
    imageEl,
    imageSource,
    title: titleText,
    description: descText,
    ctaUrl,
    ctaLabel: ctaLabelText,
    // Keep references for moveInstrumentation
    titleSource: titleProp || cell1,
    descSource: descProp || cell2,
    ctaUrlSource: ctaUrlProp || cell3,
    ctaLabelSource: ctaLabelProp || cell4,
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
      // Clone image/picture so we can move instrumentation
      const imgClone = card.imageEl.cloneNode(true);
      figure.appendChild(imgClone);
      // Transfer image instrumentation
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

    // --- Heading ---
    const h2 = document.createElement('h2');
    h2.className = 'cards-panel-heading';
    h2.textContent = card.title;
    if (card.titleSource) moveInstrumentation(card.titleSource, h2);
    panel.appendChild(h2);

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
