import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Decorates the text block (SupplementaryLinksBlock).
 *
 * AEM vertical-format model fields (in order):
 *   row[0] — title    (plain text heading)
 *   row[1] — description  (richtext body paragraph)
 *   row[2] — ctas     (richtext: one <a> per line / <ul> of links, optional)
 *
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const rows = [...block.children];

  // Capture source row references before any DOM rebuild.
  const titleRow = rows[0] || null;
  const descRow = rows[1] || null;
  const ctasRow = rows[2] || null;

  // Build the replacement container.
  const container = document.createElement('div');
  container.className = 'text-inner';

  // --- Title ---
  if (titleRow) {
    const titleCell = titleRow.children[0] || titleRow;
    const titleText = (titleCell.textContent || '').trim();

    if (titleText) {
      const h2 = document.createElement('h2');
      h2.textContent = titleText;
      moveInstrumentation(titleRow, h2);
      container.appendChild(h2);
    }
  }

  // --- Description (richtext) ---
  if (descRow) {
    const descCell = descRow.children[0] || descRow;
    const descWrapper = document.createElement('div');
    descWrapper.className = 'text-description';
    // Move inner richtext nodes (may include <p>, <a>, etc.) preserving structure.
    while (descCell.firstChild) {
      descWrapper.appendChild(descCell.firstChild);
    }
    if (descWrapper.textContent.trim()) {
      moveInstrumentation(descRow, descWrapper);
      container.appendChild(descWrapper);
    }
  }

  // --- CTAs (richtext list of links, optional) ---
  if (ctasRow) {
    const ctasCell = ctasRow.children[0] || ctasRow;
    const hasContent = ctasCell.textContent.trim().length > 0;

    if (hasContent) {
      const ctasWrapper = document.createElement('div');
      ctasWrapper.className = 'text-ctas';

      // The richtext field may already contain a <ul> with <li><a> children,
      // or bare <p><a> paragraphs — normalise to a <ul>.
      const existingUl = ctasCell.querySelector('ul');
      if (existingUl) {
        // Re-use the <ul> from richtext; clean up empty items.
        const ul = existingUl.cloneNode(true);
        ul.querySelectorAll('li').forEach((li) => {
          if (!li.textContent.trim()) li.remove();
          // Ensure every anchor has a real href.
          li.querySelectorAll('a').forEach((a) => {
            const href = a.getAttribute('href');
            if (!href || href === '#') {
              const span = document.createElement('span');
              span.textContent = a.textContent;
              a.replaceWith(span);
            }
          });
        });
        ctasWrapper.appendChild(ul);
      } else {
        // Build a <ul> from individual <p><a> paragraphs or bare anchor text.
        const ul = document.createElement('ul');
        const anchors = [...ctasCell.querySelectorAll('a')];
        if (anchors.length > 0) {
          anchors.forEach((a) => {
            const href = a.getAttribute('href');
            const label = a.textContent.trim();
            const li = document.createElement('li');
            if (href && href !== '#') {
              const anchor = document.createElement('a');
              anchor.href = href;
              anchor.textContent = label;
              if (a.getAttribute('target')) anchor.target = a.getAttribute('target');
              li.appendChild(anchor);
            } else {
              li.textContent = label;
            }
            ul.appendChild(li);
          });
        } else {
          // Fallback: treat each non-empty text line as a plain list item.
          ctasCell.textContent.split('\n').map((s) => s.trim()).filter(Boolean).forEach((line) => {
            const li = document.createElement('li');
            li.textContent = line;
            ul.appendChild(li);
          });
        }
        if (ul.children.length > 0) {
          ctasWrapper.appendChild(ul);
        }
      }

      if (ctasWrapper.children.length > 0) {
        moveInstrumentation(ctasRow, ctasWrapper);
        container.appendChild(ctasWrapper);
      }
    }
  }

  block.replaceChildren(container);
}
