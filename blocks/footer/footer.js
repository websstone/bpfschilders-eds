/**
 * BPF Schilders — footer block
 *
 * Fetches the shared /footer fragment (plain.html), builds the full footer
 * DOM (copyright + legal link list), then injects a runtime-only OneTrust
 * cookie-preference button placeholder between the Cookiebeleid and Contact
 * link items.
 *
 * Fragment row order (authored in /footer document):
 *   Row 0 — copyright_text  (plain text, e.g. "Copyright © BPF Schilders 2026")
 *   Row 1 — footer_links    (rich-text <ul> with <li><a> items)
 *
 * OneTrust placeholder: <li id="ot-sdk-btn-container"> is injected by this
 * module — it MUST NOT be authored in the fragment document.
 * When the OneTrust SDK loads it will insert a <button id="ot-sdk-btn"> inside
 * that container. When the SDK is absent the empty container is hidden by CSS.
 *
 * No module-scope mutable state — all state lives inside the decorate() closure.
 */

const FOOTER_FRAGMENT_PATH = '/footer';

/**
 * Fetch and parse the plain HTML for a path.
 * @param {string} path
 * @returns {Promise<Document|null>}
 */
async function fetchFragment(path) {
  const resp = await fetch(`${path}.plain.html`);
  if (!resp.ok) return null;
  const html = await resp.text();
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

/**
 * Return the first child <div> of a row element, or the row itself.
 * @param {Element|null} row
 * @returns {Element|null}
 */
function cell(row) {
  return row ? (row.children[0] || row) : null;
}

/**
 * Return trimmed text content of an element.
 * @param {Element|null} el
 * @returns {string}
 */
function cellText(el) {
  return el ? (el.textContent || '').trim() : '';
}

/**
 * Inject the OneTrust button placeholder <li> after the Cookiebeleid item.
 * Matches on a case-insensitive "cookiebeleid" substring in the link text.
 * Falls back to appending before the last item if no Cookiebeleid item is found.
 * @param {HTMLUListElement} ul
 */
function injectOneTrustPlaceholder(ul) {
  // Avoid double injection (idempotent)
  if (ul.querySelector('#ot-sdk-btn-container')) return;

  const placeholder = document.createElement('li');
  placeholder.id = 'ot-sdk-btn-container';

  const items = [...ul.querySelectorAll('li')];
  const cookieLi = items.find((li) => /cookiebeleid/i.test(li.textContent));

  if (cookieLi && cookieLi.nextSibling) {
    ul.insertBefore(placeholder, cookieLi.nextSibling);
  } else if (cookieLi) {
    ul.append(placeholder);
  } else if (items.length > 0) {
    // Fallback: insert before last item
    ul.insertBefore(placeholder, items[items.length - 1]);
  } else {
    ul.append(placeholder);
  }
}

/**
 * Build the inner nav container with copyright paragraph and link list.
 * @param {string} copyrightText
 * @param {string} linksHtml  innerHTML of the authored <ul> (or empty)
 * @returns {HTMLElement}
 */
function buildFooterNav(copyrightText, linksHtml) {
  const nav = document.createElement('nav');
  nav.className = 'footer-nav';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'Footer navigatie');

  // Copyright paragraph
  const p = document.createElement('p');
  p.className = 'footer-copyright';
  p.textContent = copyrightText || 'Copyright © BPF Schilders 2026';
  nav.append(p);

  // Link list — extract <ul> from authored richtext or create fallback
  let ul = null;

  if (linksHtml) {
    const tmp = document.createElement('div');
    tmp.innerHTML = linksHtml;
    ul = tmp.querySelector('ul');
  }

  if (!ul) {
    // Fallback: source links from dom-snapshot.json verbatim
    ul = document.createElement('ul');
    const fallbackLinks = [
      { href: '/disclaimer/', label: 'Disclaimer' },
      { href: '/privacy-statement-bpf-schilders/', label: 'Privacy' },
      { href: '/cookiebeleid/', label: 'Cookiebeleid' },
      { href: '/contact/', label: 'Contact' },
    ];
    fallbackLinks.forEach(({ href, label }) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = href;
      a.textContent = label;
      li.append(a);
      ul.append(li);
    });
  }

  ul.className = 'footer-links';

  // Inject OneTrust placeholder between Cookiebeleid and Contact
  injectOneTrustPlaceholder(ul);

  nav.append(ul);
  return nav;
}

/**
 * Main decorate function — called by the AEM runtime for the footer block.
 * The block element is empty; this function fetches /footer.plain.html,
 * builds the complete footer DOM, and replaces block content.
 *
 * @param {HTMLElement} block
 */
export default async function decorate(block) {
  // ------------------------------------------------------------------
  // 1. Fetch the /footer fragment
  // ------------------------------------------------------------------
  const footerDoc = await fetchFragment(FOOTER_FRAGMENT_PATH);

  let copyrightText = 'Copyright © BPF Schilders 2026';
  let linksHtml = '';

  if (footerDoc) {
    // /footer.plain.html renders as a single root <div> containing one
    // <div> per authored row.
    const rows = [...footerDoc.body.querySelectorAll(':scope > div')];

    if (rows[0]) {
      copyrightText = cellText(cell(rows[0])) || copyrightText;
    }
    if (rows[1]) {
      const c = cell(rows[1]);
      linksHtml = c ? c.innerHTML : '';
    }
  }

  // ------------------------------------------------------------------
  // 2. Build DOM
  // ------------------------------------------------------------------
  const nav = buildFooterNav(copyrightText, linksHtml);

  // ------------------------------------------------------------------
  // 3. Replace block content
  // ------------------------------------------------------------------
  block.textContent = '';
  block.append(nav);
}
