/**
 * BPF Schilders — header block
 *
 * Two-mode block:
 *
 *   (A) Global chrome (loaded via loadHeader on every page). The block
 *       element is empty; we fetch /nav.plain.html and render from the
 *       fragment rows. There are no UE bindings to preserve in this mode.
 *
 *   (B) Authoring on /nav itself (UE opens the nav page; the JCR
 *       Header block renders inline). The block element already carries
 *       the SSR-emitted data-richtext-* / data-aue-* per-field bindings.
 *       We MUST read source rows from `block.children` and call
 *       moveInstrumentation on each source cell so UE retains per-field
 *       editors after the decorate() rebuild.
 *
 * Fragment row order (authored in /nav document):
 *   Row 0 — logo_href                (plain text, e.g. "/")
 *   Row 1 — logo_alt                 (plain text, e.g. "BPF Schilders")
 *   Row 2 — audience_switcher_links  (rich-text <ul>)
 *   Row 3 — main_nav_links           (rich-text <ul> with nested <ul>s)
 *   Row 4 — search_placeholder       (plain text, optional)
 *   Row 5 — login_url                (plain text, optional)
 *
 * No module-scope mutable state — all state lives on DOM elements or
 * inside the decorate() closure.
 */

import { moveInstrumentation } from '../../scripts/scripts.js';

const NAV_FRAGMENT_PATH = '/nav';

const ICON_SEARCH = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>';
const ICON_HOME = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>';
const ICON_HAMBURGER = '<svg class="icon-hamburger" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>';
const ICON_CLOSE = '<svg class="icon-close" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';

/**
 * Sub-navigation links per audience section. On the source site, each audience
 * section (over-ons, ondernemer, werkgever) shows a context-specific second bar
 * with child page links + search box. These match the source site's sub-nav.
 */
const AUDIENCE_SUBNAV = {
  'over-ons': `<ul>
    <li class="home"><a href="/over-ons/">Home</a></li>
    <li><a href="/over-ons/">Dit zijn we</a></li>
    <li><a href="/over-ons/">Dit presteren we</a></li>
    <li><a href="/over-ons/">Downloads</a></li>
  </ul>`,
  ondernemer: `<ul>
    <li class="home"><a href="/ondernemer/">Home</a></li>
  </ul>`,
  werkgever: `<ul>
    <li class="home"><a href="/werkgever/">Home</a></li>
  </ul>`,
};

/**
 * Hardcoded fallback nav HTML, used only when the /nav fragment fetch
 * fails entirely AND the block element is empty (e.g. dev-server first
 * boot before /nav has been authored). Mirrors the source site nav.
 */
const FALLBACK_AUDIENCE_SWITCHER_HTML = `<ul>
  <li class="active"><a href="/werknemer/">Werknemer</a></li>
  <li><a href="/ondernemer/">Ondernemer</a></li>
  <li><a href="/werkgever/">Werkgever</a></li>
  <li><a href="/over-ons/">Over ons</a></li>
  <li><a href="/klacht/">Klacht</a></li>
  <li><a href="/translate/">Translate</a></li>
  <li><a href="/contact/">Contact</a></li>
</ul>`;

const FALLBACK_MAIN_NAV_HTML = `<ul>
  <li class="home"><a href="/werknemer/">Home</a></li>
  <li class="has-children">
    <a href="/werknemer/het-pensioen/">Het pensioen</a>
    <div><ul>
      <li><a href="/werknemer/het-pensioen/wat-is-pensioen/">Wat is pensioen?</a></li>
      <li><a href="/werknemer/het-pensioen/pensioenpakket/">Pensioenpakket</a></li>
      <li><a href="/werknemer/het-pensioen/pensioen-1-2-3/">Pensioen 1-2-3</a></li>
      <li><a href="/werknemer/het-pensioen/uw-pensioenoverzicht/">Uw pensioenoverzicht</a></li>
      <li><a href="/werknemer/het-pensioen/beleggen-voor-een-goed-pensioen/">Beleggen voor een goed pensioen</a></li>
      <li><a href="/werknemer/het-pensioen/waardeoverdracht/">Waardeoverdracht</a></li>
    </ul></div>
  </li>
  <li class="has-children">
    <a href="/werknemer/wat-doe-ik-bij/">Wat doe ik bij...</a>
    <div><ul>
      <li><a href="/werknemer/wat-doe-ik-bij/trouwen-of-samenwonen/">Trouwen of samenwonen</a></li>
      <li><a href="/werknemer/wat-doe-ik-bij/kinderen/">Kinderen</a></li>
      <li><a href="/werknemer/wat-doe-ik-bij/nieuwe-baan/">Nieuwe baan</a></li>
      <li><a href="/werknemer/wat-doe-ik-bij/ontslag/">Ontslag</a></li>
      <li><a href="/werknemer/wat-doe-ik-bij/scheiden-of-uit-elkaar-gaan/">Scheiden of uit elkaar gaan</a></li>
      <li><a href="/werknemer/wat-doe-ik-bij/arbeidsongeschiktheid/">Arbeidsongeschiktheid</a></li>
      <li><a href="/werknemer/wat-doe-ik-bij/met-pensioen-gaan/">Met pensioen gaan</a></li>
      <li><a href="/werknemer/wat-doe-ik-bij/verhuizen/">Verhuizen</a></li>
      <li><a href="/werknemer/wat-doe-ik-bij/overlijden/">Overlijden</a></li>
      <li><a href="/werknemer/wat-doe-ik-bij/uitzendkracht-worden/">Uitzendkracht worden</a></li>
      <li><a href="/werknemer/wat-doe-ik-bij/voor-uzelf-beginnen/">Voor uzelf beginnen</a></li>
      <li><a href="/werknemer/wat-doe-ik-bij/verlof/">Verlof</a></li>
    </ul></div>
  </li>
  <li class="has-children">
    <a href="/werknemer/u-bent-met-pensioen/">U bent met pensioen</a>
    <div><ul>
      <li><a href="/werknemer/u-bent-met-pensioen/belangenbehartiging/">Belangenbehartiging</a></li>
      <li><a href="/werknemer/u-bent-met-pensioen/belastingaangifte/">Belastingaangifte</a></li>
      <li><a href="/werknemer/u-bent-met-pensioen/betaling-van-uw-pensioen/">Betaling van uw pensioen</a></li>
      <li><a href="/werknemer/u-bent-met-pensioen/inhoudingen/">Inhoudingen</a></li>
      <li><a href="/werknemer/u-bent-met-pensioen/jaarlijkse-wijziging-van-uw-pensioen/">Jaarlijkse wijziging van uw pensioen</a></li>
      <li><a href="/werknemer/u-bent-met-pensioen/u-woont-in-het-buitenland/">U woont in het buitenland</a></li>
    </ul></div>
  </li>
  <li class="has-children">
    <a href="/werknemer/actueel/">Actueel</a>
    <div><ul>
      <li><a href="/werknemer/actueel/blog/">Blog</a></li>
      <li><a href="/werknemer/actueel/dekkingsgraad/">Dekkingsgraad</a></li>
      <li><a href="/werknemer/actueel/nieuw-pensioenstelsel/">Nieuw pensioenstelsel</a></li>
      <li><a href="/werknemer/actueel/nieuws/">Nieuws</a></li>
      <li><a href="/werknemer/actueel/nieuwsbrieven/">Nieuwsbrieven</a></li>
      <li><a href="/werknemer/actueel/pensioenblad/">Pensioenblad</a></li>
      <li><a href="/werknemer/actueel/klantenpanel/">Klantenpanel</a></li>
      <li><a href="/werknemer/actueel/downloads/">Downloads</a></li>
    </ul></div>
  </li>
  <li><a href="/werknemer/contact/">Contact</a></li>
</ul>`;

/**
 * Fetch the plain HTML for a path.
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
 * Return the first <div> child of a row, or the row itself.
 * @param {Element} row
 * @returns {Element|null}
 */
function cell(row) {
  return row ? (row.children[0] || row) : null;
}

/**
 * Trim text content of a cell element.
 * @param {Element} el
 * @returns {string}
 */
function cellText(el) {
  return el ? (el.textContent || '').trim() : '';
}

/**
 * Check whether the current page belongs to the werknemer audience section.
 * On the source site, werknemer pages (and the homepage, which defaults to
 * the werknemer audience) show the full werknemer sub-navigation bar.
 * @returns {boolean}
 */
function isWerknemerPage() {
  const p = window.location.pathname;
  if (p === '/' || p === '/index' || p === '/index.html') return true;
  return p === '/werknemer' || p.startsWith('/werknemer/');
}

/**
 * Determine the current audience section from the URL path.
 * Returns the section key (e.g. 'over-ons', 'ondernemer', 'werkgever')
 * or null for pages that don't belong to a known section (e.g. /klacht).
 * @returns {string|null}
 */
function getAudienceSection() {
  const p = window.location.pathname;
  return Object.keys(AUDIENCE_SUBNAV).find(
    (section) => p === `/${section}`
      || p === `/${section}/`
      || p.startsWith(`/${section}/`),
  ) || null;
}

/**
 * Apply aria-current="page" to the audience-switcher link that matches
 * the current page URL. Remove any existing active class / aria-current.
 * @param {HTMLElement} topNav
 */
function applyActiveLinkState(topNav) {
  let currentPath = window.location.pathname;
  if (currentPath === '/' || currentPath === '/index' || currentPath === '/index.html') {
    currentPath = '/werknemer/';
  }
  topNav.querySelectorAll('a').forEach((a) => {
    a.removeAttribute('aria-current');
    const li = a.closest('li');
    if (li) li.classList.remove('active');
  });
  topNav.querySelectorAll('a').forEach((a) => {
    try {
      const linkPath = new URL(a.href, window.location.href).pathname;
      if (linkPath === currentPath || (linkPath !== '/' && currentPath.startsWith(linkPath))) {
        a.setAttribute('aria-current', 'page');
        const li = a.closest('li');
        if (li) li.classList.add('active');
      }
    } catch {
      // ignore malformed hrefs
    }
  });
}

/**
 * Normalize main-nav <li>s containing a submenu <ul> to the shape the CSS
 * and decorateFlyouts() expect: add the `has-children` class and wrap the
 * submenu <ul> in a <div>. Rich-text editors (UE) strip custom classes
 * and wrapper divs, so the authored main_nav_links property carries only
 * <ul><li><a/><ul>…</ul></li></ul>; this rebuilds the missing structure.
 * Also tags the first top-level <li> with `home` if its href matches the
 * homepage so the home icon decoration runs.
 * @param {HTMLElement} mainNav
 */
function normalizeFlyouts(mainNav) {
  const topUl = mainNav.querySelector(':scope > ul');
  if (!topUl) return;

  [...topUl.children]
    .filter((li) => li.tagName === 'LI')
    .forEach((li, idx) => {
      const submenuUl = [...li.children].find((c) => c.tagName === 'UL');
      if (submenuUl) {
        li.classList.add('has-children');
        const wrapper = document.createElement('div');
        submenuUl.replaceWith(wrapper);
        wrapper.append(submenuUl);
      }
      const a = li.querySelector(':scope > a');
      if (idx === 0 && a && /^\/?(werknemer\/?)?$/i.test(new URL(a.href, window.location.href).pathname.replace(/\/$/, ''))) {
        li.classList.add('home');
      }
    });
}

/**
 * Inject a sub-menu toggle <button> before the child <div> in each
 * li.has-children item. The button toggles aria-expanded and the
 * `is-open` class on the parent <li>.
 * @param {HTMLElement} mainNav
 */
function decorateFlyouts(mainNav) {
  mainNav.querySelectorAll('li.has-children').forEach((li) => {
    const submenuDiv = li.querySelector(':scope > div');
    if (!submenuDiv) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', li.querySelector(':scope > a')?.textContent.trim() || 'Submenu');
    btn.className = 'flyout-toggle';

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = li.classList.contains('is-open');
      mainNav.querySelectorAll('li.has-children.is-open').forEach((openLi) => {
        openLi.classList.remove('is-open');
        const openBtn = openLi.querySelector(':scope > .flyout-toggle');
        if (openBtn) openBtn.setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        li.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });

    li.insertBefore(btn, submenuDiv);
  });

  document.addEventListener('click', () => {
    mainNav.querySelectorAll('li.has-children.is-open').forEach((li) => {
      li.classList.remove('is-open');
      const btn = li.querySelector(':scope > .flyout-toggle');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  });
}

/**
 * Wire a mobile toggle button to show/hide its target element.
 * @param {HTMLButtonElement} btn
 * @param {HTMLElement} target
 * @param {boolean} focusInput  when true, focus first input after reveal
 */
function wireToggle(btn, target, focusInput = false) {
  btn.addEventListener('click', () => {
    const isVisible = target.classList.contains('is-visible');
    target.classList.toggle('is-visible', !isVisible);
    btn.classList.toggle('is-active', !isVisible);
    if (!isVisible && focusInput) {
      const input = target.querySelector('input');
      if (input) input.focus();
    }
  });
}

/**
 * Build and inject the two mobile-only toggle buttons into the container.
 * Buttons are injected after searchbox so they sit at the right of the
 * header container. IDs match source: #pageNavToggleButton, #searchToggleButton.
 * @param {HTMLElement} container
 * @param {HTMLElement} headerNav
 * @param {HTMLElement} searchbox
 */
function injectMobileButtons(container, headerNav, searchbox) {
  const navBtn = document.createElement('button');
  navBtn.id = 'pageNavToggleButton';
  navBtn.className = 'pagenav-toggle-button';
  navBtn.type = 'button';
  navBtn.title = 'Menu';
  navBtn.setAttribute('aria-label', 'Menu');
  navBtn.setAttribute('aria-expanded', 'false');
  navBtn.innerHTML = ICON_HAMBURGER + ICON_CLOSE;

  const searchBtn = document.createElement('button');
  searchBtn.id = 'searchToggleButton';
  searchBtn.className = 'search-toggle-button';
  searchBtn.type = 'button';
  searchBtn.title = 'Zoek';
  searchBtn.setAttribute('aria-label', 'Zoeken');
  searchBtn.innerHTML = ICON_SEARCH;

  container.append(navBtn, searchBtn);

  wireToggle(searchBtn, searchbox, true);

  navBtn.addEventListener('click', () => {
    const isVisible = headerNav.classList.contains('is-visible');
    headerNav.classList.toggle('is-visible', !isVisible);
    navBtn.classList.toggle('is-active', !isVisible);
    navBtn.setAttribute('aria-expanded', String(!isVisible));
  });
}

/**
 * Build the search box element from authored placeholder text.
 * @param {string} placeholder
 * @returns {HTMLElement}
 */
function buildSearchBox(placeholder) {
  const div = document.createElement('div');
  div.className = 'searchbox';
  div.id = 'searchbox';

  const input = document.createElement('input');
  input.type = 'text';
  input.name = 'k';
  input.placeholder = placeholder || 'Heeft u een vraag?';
  input.maxLength = 100;
  input.setAttribute('aria-label', placeholder || 'Heeft u een vraag?');

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'search-btn';
  btn.setAttribute('aria-label', 'Zoeken');
  btn.innerHTML = ICON_SEARCH;

  div.append(input, btn);

  const doSearch = () => {
    const q = input.value.trim();
    if (q) window.location.href = `/zoeken?k=${encodeURIComponent(q)}`;
  };
  btn.addEventListener('click', doSearch);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch();
  });

  return div;
}

/**
 * Build the p-login-state web component.
 * @param {string} loginUrl
 * @returns {HTMLElement}
 */
function buildLoginState(loginUrl) {
  const el = document.createElement('p-login-state');
  el.className = 'login-state';
  el.setAttribute('login-url', loginUrl || '/pensioenadministratie/inloggen/#!/login/redirect?');
  el.setAttribute('dashboard-title', 'Uw pensioenadministratie');
  el.setAttribute('logout-url', window.location.origin || 'https://www.bpfschilders.nl/');
  el.setAttribute('logged-in', 'false');
  return el;
}

/**
 * Main decorate function — called by the AEM runtime for the header block.
 *
 * @param {HTMLElement} block
 */
export default async function decorate(block) {
  // ------------------------------------------------------------------
  // 1. Resolve source rows.
  //    Authoring context: block element already holds the SSR-emitted
  //    Header block rows (with UE bindings). Global chrome: empty block,
  //    fall back to fetching /nav.plain.html.
  // ------------------------------------------------------------------
  const blockRows = [...block.children].filter((el) => el.tagName === 'DIV');
  const isAuthoringContext = blockRows.length >= 2;

  let sourceRows = [];
  if (isAuthoringContext) {
    sourceRows = blockRows;
  } else {
    const navDoc = await fetchFragment(NAV_FRAGMENT_PATH);
    if (navDoc) {
      // Preferred shape (post-JCR-repair): the fetched plain.html contains an
      // explicit `<div class="header">` block whose direct <div> children are
      // the rows. Use that when present.
      const fetchedHeaderEl = navDoc.querySelector('.header');
      if (fetchedHeaderEl) {
        sourceRows = [...fetchedHeaderEl.children].filter((c) => c.tagName === 'DIV');
      }
      // Legacy shape: rows directly under body (Google-Docs-style export).
      if (sourceRows.length === 0) {
        sourceRows = [...navDoc.body.querySelectorAll(':scope > div')];
      }
    }
  }
  const usedFragment = sourceRows.length >= 2;

  // ------------------------------------------------------------------
  // 2. Capture source cell references AND extracted values for each of
  //    the six Header model fields.
  //
  //    Row layout caveat: AEM SSR collapses adjacent text fields into a
  //    single row's cell when they appear consecutively in the model. For
  //    the Header model this happens to logo_href + logo_alt, producing
  //    a row 0 whose cell contains TWO <p> siblings (one per field)
  //    instead of two separate rows. The shape is identical in nav.html
  //    (authoring) and nav.plain.html (runtime), so we detect it once.
  //
  //    Subsequent rows (rich-text + the trailing single text fields) are
  //    each rendered in their own row. The cell references carry the
  //    per-field data-richtext-* / data-aue-* UE bindings that must be
  //    moved onto the rebuilt elements before block.textContent='' wipes
  //    them — see step 4.
  // ------------------------------------------------------------------
  let logoHrefCell = null;
  let logoAltCell = null;
  let nextRowIdx = 1;
  if (sourceRows[0]) {
    const row0Cell = cell(sourceRows[0]);
    const row0Paragraphs = row0Cell ? [...row0Cell.children].filter((c) => c.tagName === 'P') : [];
    if (row0Paragraphs.length >= 2) {
      // Collapsed shape: row 0 cell holds both logo_href and logo_alt as <p>s.
      [logoHrefCell, logoAltCell] = row0Paragraphs;
      // Remaining fields start at row 1.
      nextRowIdx = 1;
    } else {
      // Separate-row shape: row 0 = logo_href only, row 1 = logo_alt.
      logoHrefCell = row0Cell;
      if (sourceRows[1]) logoAltCell = cell(sourceRows[1]);
      nextRowIdx = 2;
    }
  }
  const cellAt = (offset) => {
    const row = sourceRows[nextRowIdx + offset];
    return row ? cell(row) : null;
  };
  const audienceSwitcherCell = cellAt(0);
  const mainNavCell = cellAt(1);
  const searchPlaceholderCell = cellAt(2);
  const loginUrlCell = cellAt(3);

  const logoHref = cellText(logoHrefCell) || '/';
  const logoAlt = cellText(logoAltCell) || 'BPF Schilders';
  const searchPlaceholder = cellText(searchPlaceholderCell) || 'Heeft u een vraag?';
  const loginUrl = cellText(loginUrlCell) || '/pensioenadministratie/inloggen/#!/login/redirect?';

  // ------------------------------------------------------------------
  // 3. Build DOM (do not touch `block` until step 5).
  // ------------------------------------------------------------------
  const container = document.createElement('div');
  container.className = 'container';

  // Logo
  const logoLink = document.createElement('a');
  logoLink.href = logoHref || '/';
  logoLink.className = 'logo';
  logoLink.title = logoAlt;
  logoLink.setAttribute('aria-label', logoAlt);
  const logoImg = document.createElement('img');
  logoImg.src = '/icons/logo.png';
  logoImg.alt = logoAlt;
  logoImg.loading = 'eager';
  logoLink.append(logoImg);
  container.append(logoLink);

  // Nav wrapper
  const headerNav = document.createElement('div');
  headerNav.id = 'header-navigation';
  headerNav.className = 'header-navigation';

  // Top navigation (audience switcher)
  const topNav = document.createElement('nav');
  topNav.setAttribute('role', 'navigation');
  topNav.setAttribute('aria-label', 'Doelgroepnavigatie');
  topNav.className = 'top-navigation';

  const topNavLabel = document.createElement('span');
  topNavLabel.textContent = 'Kies een ingang';
  topNav.append(topNavLabel);

  // Move the audience-switcher's rich-text children into topNav so the
  // source <ul> (and any nested <a> instrumentation) is preserved.
  if (audienceSwitcherCell) {
    while (audienceSwitcherCell.firstChild) {
      topNav.append(audienceSwitcherCell.firstChild);
    }
  } else if (!usedFragment) {
    topNav.insertAdjacentHTML('beforeend', FALLBACK_AUDIENCE_SWITCHER_HTML);
  }

  const loginState = buildLoginState(loginUrl);
  topNav.append(loginState);

  // Main navigation
  const mainNav = document.createElement('nav');
  mainNav.setAttribute('role', 'navigation');
  mainNav.setAttribute('aria-label', 'Navigatie');
  mainNav.className = 'main-navigation';

  const mainNavLabel = document.createElement('span');
  mainNavLabel.textContent = 'Navigatie';
  mainNav.append(mainNavLabel);

  // Section-specific nav swap is a RUNTIME behaviour. In UE authoring we
  // want the editor to see the full authored main_nav_links so they can
  // edit them — never substitute AUDIENCE_SUBNAV here.
  if (isAuthoringContext) {
    if (mainNavCell) {
      while (mainNavCell.firstChild) mainNav.append(mainNavCell.firstChild);
    }
  } else if (!isWerknemerPage()) {
    const section = getAudienceSection();
    if (section && AUDIENCE_SUBNAV[section]) {
      mainNav.insertAdjacentHTML('beforeend', AUDIENCE_SUBNAV[section]);
    } else {
      mainNav.insertAdjacentHTML('beforeend', '<ul></ul>');
    }
  } else if (mainNavCell) {
    while (mainNavCell.firstChild) mainNav.append(mainNavCell.firstChild);
  } else if (!usedFragment) {
    mainNav.insertAdjacentHTML('beforeend', FALLBACK_MAIN_NAV_HTML);
  }

  const searchbox = buildSearchBox(searchPlaceholder);
  const searchInput = searchbox.querySelector('input');

  // ------------------------------------------------------------------
  // 4. Move UE instrumentation from source cells onto rebuilt targets.
  //    Skipped in runtime context — fragment cells have no bindings.
  // ------------------------------------------------------------------
  if (isAuthoringContext) {
    if (logoHrefCell) moveInstrumentation(logoHrefCell, logoLink);
    if (logoAltCell) moveInstrumentation(logoAltCell, logoImg);
    if (audienceSwitcherCell) moveInstrumentation(audienceSwitcherCell, topNav);
    if (mainNavCell) moveInstrumentation(mainNavCell, mainNav);
    if (searchPlaceholderCell && searchInput) {
      moveInstrumentation(searchPlaceholderCell, searchInput);
    }
    if (loginUrlCell) moveInstrumentation(loginUrlCell, loginState);
  }

  headerNav.append(topNav, mainNav);
  container.append(headerNav);
  container.append(searchbox);

  // ------------------------------------------------------------------
  // 5. Replace block content. Safe to clear now — all source-cell refs
  //    have been read and instrumentation has been moved off them.
  // ------------------------------------------------------------------
  block.textContent = '';
  block.append(container);

  // ------------------------------------------------------------------
  // 6. Decorate interactive behaviours.
  // ------------------------------------------------------------------
  applyActiveLinkState(topNav);
  normalizeFlyouts(mainNav);
  decorateFlyouts(mainNav);
  injectMobileButtons(container, headerNav, searchbox);

  const homeLink = mainNav.querySelector('li.home > a');
  if (homeLink) {
    const homeIcon = document.createElement('span');
    homeIcon.className = 'icon-home';
    homeIcon.innerHTML = ICON_HOME;
    homeLink.prepend(homeIcon);
  }

  const headerEl = block.closest('header');
  if (headerEl) {
    headerEl.style.height = 'auto';
  }
}
