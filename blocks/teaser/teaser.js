import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Teaser block — image + optional CTA link.
 *
 * AEM vertical field order (component-models.json):
 *   row 0 → image_src  (picture/img element or plain text URL)
 *   row 1 → image_alt  (optional alt text)
 *   row 2 → cta_href   (optional CTA link href)
 *   row 3 → cta_label  (optional CTA visible label)
 *
 * @param {HTMLElement} block
 */
export default function decorate(block) {
  const rows = [...block.children];

  // --- capture source elements for UE instrumentation ---
  const imageRow = rows[0] || null;
  const altRow = rows[1] || null;
  const hrefRow = rows[2] || null;
  const labelRow = rows[3] || null;

  // --- extract field values ---
  const imageCell = imageRow ? imageRow.children[0] || imageRow : null;
  const altCell = altRow ? altRow.children[0] || altRow : null;
  const hrefCell = hrefRow ? hrefRow.children[0] || hrefRow : null;
  const labelCell = labelRow ? labelRow.children[0] || labelRow : null;

  // Resolve image: authored picture/img element OR plain-text src
  const imgEl = imageCell ? imageCell.querySelector('img') : null;
  const picEl = imageCell ? imageCell.querySelector('picture') : null;

  const altText = altCell ? (altCell.textContent || '').trim() : '';
  const ctaHref = hrefCell ? (hrefCell.querySelector('a')?.getAttribute('href') || hrefCell.textContent.trim()) : '';
  const ctaLabel = labelCell ? (labelCell.querySelector('a')?.textContent.trim() || labelCell.textContent.trim()) : '';

  // --- build new DOM ---
  const panel = document.createElement('div');
  panel.className = 'teaser-panel';

  // UE: move block-level instrumentation from the first row to the panel
  if (imageRow) moveInstrumentation(imageRow, panel);

  // --- image wrapper ---
  const imageWrapper = document.createElement('div');
  imageWrapper.className = 'teaser-image';

  if (picEl) {
    // authored <picture> element — move it; ensure img inside has correct alt
    const innerImg = picEl.querySelector('img');
    if (innerImg) innerImg.alt = altText;
    // moveInstrumentation from altRow if present
    if (altRow) moveInstrumentation(altRow, picEl);
    imageWrapper.appendChild(picEl);
  } else if (imgEl) {
    imgEl.alt = altText;
    if (altRow) moveInstrumentation(altRow, imgEl);
    imageWrapper.appendChild(imgEl);
  } else if (imageCell) {
    // plain text src fallback
    const src = imageCell.textContent.trim();
    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = altText;
      img.loading = 'lazy';
      if (altRow) moveInstrumentation(altRow, img);
      imageWrapper.appendChild(img);
    }
  }

  panel.appendChild(imageWrapper);

  // --- optional CTA link ---
  if (ctaHref && ctaHref !== '#') {
    const ctaWrapper = document.createElement('div');
    ctaWrapper.className = 'teaser-cta';

    const a = document.createElement('a');
    a.href = ctaHref;
    a.textContent = ctaLabel || ctaHref;

    // Instrumentation: move from hrefRow and labelRow to anchor
    if (hrefRow) moveInstrumentation(hrefRow, ctaWrapper);
    if (labelRow) moveInstrumentation(labelRow, a);

    ctaWrapper.appendChild(a);
    panel.appendChild(ctaWrapper);
  }

  // --- replace block content ---
  block.replaceChildren(panel);
}
