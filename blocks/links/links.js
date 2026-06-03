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
 * Loads and decorates the links block.
 *
 * Each links-item child stores its fields (icon_class, label, href, target) as
 * direct JCR properties on the item node. aem.live's block/item renderer does
 * not populate these as table cells — the inner <div> is empty. This decorator
 * fetches each item's .json via the same-origin proxy to read the fields.
 *
 * Block model (per links-item JCR node):
 *   label      — visible link text (always present)
 *   icon_class — BPF icon class string (optional)
 *   href       — link target URL (optional)
 *   target     — anchor target attribute (optional)
 *
 * @param {Element} block
 */
export default async function decorate(block) {
  const allRows = [...block.children];

  // Collect all item fetch promises in parallel for performance.
  const itemData = await Promise.all(
    allRows.map(async (row) => {
      const path = jcrPath(row);
      const data = await fetchJcr(path);
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
