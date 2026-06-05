import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Extract the JCR path from a data-aue-resource URN.
 * "urn:aemconnection:/content/foo/bar" -> "/content/foo/bar"
 * @param {Element} el
 * @returns {string|null}
 */
function jcrPath(el) {
  const resource = el && el.dataset && el.dataset.aueResource;
  if (!resource) return null;
  const prefix = 'urn:aemconnection:';
  return resource.startsWith(prefix) ? resource.slice(prefix.length) : null;
}

/**
 * Fetch JCR node properties as JSON via the dev-server same-origin proxy.
 * @param {string} path JCR path (e.g. "/content/bpfschilders-eds/…/node")
 * @returns {Promise<Object|null>}
 */
async function fetchJcr(path) {
  if (!path) return null;
  try {
    const resp = await fetch(`${path}.json`);
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
}

/**
 * Infers the contact icon class from a link's href/label when the authored
 * icon_class property is empty (the migration did not carry it across).
 * Mirrors the source markup: tel: → phone, mail/contact → envelope,
 * social domains / "Volg ons" → facebook.
 * @param {string} href
 * @param {string} label
 * @returns {string} icon class or ''
 */
function inferIconClass(href, label) {
  const h = (href || '').toLowerCase();
  const l = (label || '').toLowerCase();
  if (h.startsWith('tel:')) return 'icon-phone';
  if (h.startsWith('mailto:') || /stel-uw-vraag|\/contact/.test(h) || /\bmail\b|e-?mail/.test(l)) return 'icon-envelope';
  if (/facebook|twitter|linkedin|instagram|youtube/.test(h) || /\bvolg\b/.test(l)) return 'icon-facebook';
  return '';
}

/**
 * Read a links item's fields from the delivered block cells.
 * franklin.delivery serializes each item as four cells in model order:
 * icon_class, label, href, target. This is the data source on the published
 * site; the JCR .json fetch only works in the author/UE context.
 * @param {Element} row
 * @returns {{icon_class: string, label: string, href: string, target: string}}
 */
function readFromCells(row) {
  const cells = [...row.children];
  const cellText = (el) => (el ? (el.textContent || '').trim() : '');
  const hrefCell = cells[2];
  const anchor = hrefCell ? hrefCell.querySelector('a') : null;
  const href = anchor ? (anchor.getAttribute('href') || '').trim() : cellText(hrefCell);
  return {
    icon_class: cellText(cells[0]),
    label: cellText(cells[1]),
    href,
    target: cellText(cells[3]),
  };
}

/**
 * Loads and decorates the links block.
 *
 * Each links item delivers four cells (icon_class, label, href, target). This
 * decorator reads them from the DOM (works on the published site), falling back
 * to the item's JCR .json for the author/UE context, where the cells are empty.
 *
 * @param {Element} block
 */
export default async function decorate(block) {
  const allRows = [...block.children];

  const itemData = await Promise.all(
    allRows.map(async (row) => {
      const fromCells = readFromCells(row);
      if (fromCells.label || fromCells.href) return { row, data: fromCells };
      const data = await fetchJcr(jcrPath(row));
      return { row, data };
    }),
  );

  // Build ul.contact
  const ul = document.createElement('ul');
  ul.className = 'contact';

  // Icon circles are only inferred for the contact quick-links sidebar; main-column
  // links (e.g. klachtnummers, contactformulier) are plain in the source.
  const inSidebar = !!block.closest('.two-col-sidebar');

  itemData.forEach(({ row, data }) => {
    if (!data) return;

    const label = (data.label || '').trim();
    const rawHref = (data.href || '').trim();
    const iconClass = (data.icon_class || '').trim() || (inSidebar ? inferIconClass(rawHref, label) : '');
    const href = rawHref && rawHref !== '#' ? rawHref : null;
    const target = (data.target || '').trim();

    const li = document.createElement('li');
    moveInstrumentation(row, li);

    if (href) {
      const a = document.createElement('a');
      if (iconClass) a.classList.add(iconClass);
      a.href = href;
      if (target) {
        a.target = target;
        if (target === '_blank') a.rel = 'noopener noreferrer';
      }
      a.textContent = label;
      li.appendChild(a);
    } else {
      // No valid href — render plain text (no anchor).
      const span = document.createElement('span');
      if (iconClass) span.classList.add(iconClass);
      span.textContent = label;
      li.appendChild(span);
    }

    ul.appendChild(li);
  });

  block.replaceChildren(ul);
}
