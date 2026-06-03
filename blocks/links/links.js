import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Reads text content from a cell (first child div of a row).
 * @param {Element|null} cell
 * @returns {string}
 */
function cellText(cell) {
  return cell ? (cell.textContent || '').trim() : '';
}

/**
 * Loads and decorates the links block.
 * Block model: child items (links-item) each carrying:
 *   row[0] = icon_class, row[1] = label, row[2] = href, row[3] = target
 * @param {Element} block
 */
export default function decorate(block) {
  // Separate child item rows (data-aue-component) from any future parent prop rows
  const allRows = [...block.children];
  const itemRows = allRows.filter((r) => r.dataset.aueComponent);
  // Fallback: if no data-aue-component rows present (e.g. gallery fixture),
  // treat all rows as items — each row has 4 cells: icon_class | label | href | target
  const rows = itemRows.length > 0 ? itemRows : allRows;

  // Build ul.contact
  const ul = document.createElement('ul');
  ul.className = 'contact';

  rows.forEach((row) => {
    const cells = [...row.children];

    // Per-item model field order: icon_class | label | href | target
    const iconClass = cellText(cells[0]);
    const label = cellText(cells[1]);
    const rawHref = cellText(cells[2]);
    // Resolve href: strip placeholder values
    const href = rawHref && rawHref !== '#' ? rawHref : null;
    const target = cellText(cells[3]);

    const li = document.createElement('li');

    if (href) {
      const a = document.createElement('a');
      if (iconClass) a.classList.add(iconClass);
      a.href = href;
      if (target) {
        a.target = target;
        if (target === '_blank') a.rel = 'noopener noreferrer';
      }
      a.textContent = label;

      // Preserve UE per-property bindings from the source row
      moveInstrumentation(row, li);

      li.appendChild(a);
    } else {
      // No valid href — render plain text (no anchor)
      const span = document.createElement('span');
      if (iconClass) span.classList.add(iconClass);
      span.textContent = label;

      moveInstrumentation(row, li);
      li.appendChild(span);
    }

    ul.appendChild(li);
  });

  block.replaceChildren(ul);
}
