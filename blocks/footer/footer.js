import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Link href → label mapping from the source dom-snapshot (authoritative hrefs).
 * Used as a fallback when authored content only has label text with no href.
 */
const LINK_HREFS = {
  disclaimer: '/disclaimer/',
  privacy: '/privacy-statement-bpf-schilders/',
  cookiebeleid: '/cookiebeleid/',
  contact: '/contact/',
};

/**
 * Resolve a href for a link label.
 * If the cell already contains an <a>, use its href.
 * Otherwise attempt a lookup from the static map.
 * @param {Element|null} cell
 * @param {string} label
 * @returns {string}
 */
function resolveHref(cell, label) {
  if (cell) {
    const a = cell.querySelector('a');
    if (a && a.href && !a.href.endsWith('#')) return a.getAttribute('href') || a.href;
  }
  const key = label.toLowerCase().replace(/\s+/g, '-');
  return LINK_HREFS[key] || null;
}

/**
 * Return the trimmed text content of a cell element (first child of a row).
 * @param {Element|null} row
 * @returns {string}
 */
function cellText(row) {
  const cell = row ? row.children[0] || row : null;
  return cell ? (cell.textContent || '').trim() : '';
}

/**
 * Return the first child element of a row (the cell).
 * @param {Element|null} row
 * @returns {Element|null}
 */
function rowCell(row) {
  return row ? row.children[0] || null : null;
}

/**
 * Loads and decorates the footer block.
 *
 * Expected AEM authored table (3 rows, vertical format):
 *   Row 0 → copyright_text   e.g. "Copyright © BPF Schilders 2026"
 *   Row 1 → links            <ul> or newline-separated link labels/hrefs
 *   Row 2 → cookie_label  e.g. "Mijn cookievoorkeur wijzigen"
 *
 * @param {Element} block The footer block element
 */
export default function decorate(block) {
  const rows = [...block.children];

  // --- Capture source rows for UE instrumentation before rebuilding DOM ---
  const copyrightRow = rows[0] || null;
  const linksRow = rows[1] || null;
  const cookieRow = rows[2] || null;

  const copyrightCell = rowCell(copyrightRow);
  const linksCell = rowCell(linksRow);
  const cookieCell = rowCell(cookieRow);

  // --- Extract field values ---
  const copyrightText = cellText(copyrightRow) || 'Copyright © BPF Schilders 2026';

  // Parse links: authored as <ul><li><a href>Label</a></li>…</ul> or newline text
  const linkItems = [];
  if (linksCell) {
    const anchors = linksCell.querySelectorAll('a');
    if (anchors.length > 0) {
      anchors.forEach((a) => {
        const label = a.textContent.trim();
        const href = a.getAttribute('href') && a.getAttribute('href') !== '#'
          ? a.getAttribute('href')
          : resolveHref(null, label);
        linkItems.push({ label, href, sourceEl: a });
      });
    } else {
      // Fallback: newline-separated labels
      const labels = linksCell.textContent.split('\n').map((s) => s.trim()).filter(Boolean);
      labels.forEach((label) => {
        linkItems.push({ label, href: resolveHref(null, label), sourceEl: null });
      });
    }
  }

  // Default links if none authored
  if (linkItems.length === 0) {
    [
      { label: 'Disclaimer', href: '/disclaimer/' },
      { label: 'Privacy', href: '/privacy-statement-bpf-schilders/' },
      { label: 'Cookiebeleid', href: '/cookiebeleid/' },
      { label: 'Contact', href: '/contact/' },
    ].forEach((item) => linkItems.push({ ...item, sourceEl: null }));
  }

  const cookieLabel = cellText(cookieRow) || 'Mijn cookievoorkeur wijzigen';

  // --- Build new DOM ---
  const nav = document.createElement('nav');
  nav.className = 'container';
  nav.setAttribute('role', 'navigation');

  // Copyright paragraph
  const copyP = document.createElement('p');
  copyP.textContent = copyrightText;
  if (copyrightCell) moveInstrumentation(copyrightCell, copyP);
  nav.append(copyP);

  // Links list — source order: Disclaimer, Privacy, Cookiebeleid, [cookie-pref], Contact
  // Insert cookie-pref item before "Contact" (last item) to match source ordering.
  const ul = document.createElement('ul');

  // Find the index of "Contact" to insert cookie-pref before it
  const contactIdx = linkItems.findIndex(({ label }) => label.toLowerCase() === 'contact');
  const insertBeforeIdx = contactIdx >= 0 ? contactIdx : linkItems.length;

  linkItems.forEach(({ label, href, sourceEl }, idx) => {
    // Insert cookie-pref li before Contact
    if (idx === insertBeforeIdx && cookieLabel) {
      const cookieLi = document.createElement('li');
      cookieLi.className = 'cookie-pref';
      // Render as a button with OneTrust class so OneTrust SDK can activate it
      const cookieBtn = document.createElement('button');
      cookieBtn.type = 'button';
      cookieBtn.id = 'ot-sdk-btn';
      cookieBtn.className = 'ot-sdk-show-settings';
      cookieBtn.textContent = cookieLabel;
      if (cookieCell) moveInstrumentation(cookieCell, cookieBtn);
      cookieLi.append(cookieBtn);
      ul.append(cookieLi);
    }

    const li = document.createElement('li');
    if (href && href !== '#') {
      const a = document.createElement('a');
      a.href = href;
      a.textContent = label;
      if (sourceEl) moveInstrumentation(sourceEl, a);
      li.append(a);
    } else {
      li.textContent = label;
    }
    ul.append(li);
  });

  // If Contact was not found (or list was empty), append cookie-pref at end
  if (insertBeforeIdx === linkItems.length && cookieLabel) {
    const cookieLi = document.createElement('li');
    cookieLi.className = 'cookie-pref';
    const cookieBtn = document.createElement('button');
    cookieBtn.type = 'button';
    cookieBtn.id = 'ot-sdk-btn';
    cookieBtn.className = 'ot-sdk-show-settings';
    cookieBtn.textContent = cookieLabel;
    if (cookieCell) moveInstrumentation(cookieCell, cookieBtn);
    cookieLi.append(cookieBtn);
    ul.append(cookieLi);
  }

  if (linksCell) moveInstrumentation(linksCell, ul);
  nav.append(ul);

  // Move instrumentation from source rows to rebuilt nav
  if (linksRow) moveInstrumentation(linksRow, nav);

  // Replace block content
  block.textContent = '';
  block.append(nav);
}
