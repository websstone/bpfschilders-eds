/**
 * BPF Schilders — header block
 *
 * Fetches the shared /nav fragment (plain.html), builds the full header
 * DOM, injects mobile-only toggle buttons at runtime, and wires all
 * interactive behaviours.
 *
 * Fragment row order (authored in /nav document):
 *   Row 0 — logo_href       (plain text, e.g. "/")
 *   Row 1 — logo_alt        (plain text, e.g. "BPF Schilders")
 *   Row 2 — audience_switcher_links  (rich-text <ul>)
 *   Row 3 — main_nav_links           (rich-text <ul> with nested <ul>s)
 *   Row 4 — search_placeholder       (plain text, optional)
 *   Row 5 — login_url                (plain text, optional)
 *
 * No module-scope mutable state — all state lives on DOM elements or
 * inside the decorate() closure.
 */

const NAV_FRAGMENT_PATH = '/nav';

const ICON_SEARCH = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>';
const ICON_HOME = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>';
const ICON_HAMBURGER = '<svg class="icon-hamburger" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>';
const ICON_CLOSE = '<svg class="icon-close" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';

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
 * On the source site, only /werknemer/* pages (and the homepage, which defaults
 * to the werknemer audience) show the main-navigation sub-nav bar. All other
 * audience sections (ondernemer, werkgever, over-ons, etc.) show only the
 * top-navigation audience-switcher bar.
 * @returns {boolean}
 */
function isWerknemerPage() {
  const p = window.location.pathname;
  // Homepage maps to werknemer audience on the source site
  if (p === '/' || p === '/index' || p === '/index.html') return true;
  // Any path starting with /werknemer/ or exactly /werknemer
  return p === '/werknemer' || p.startsWith('/werknemer/');
}
/**
 * Apply aria-current="page" to the audience-switcher link that matches
 * the current page URL. Remove any existing active class / aria-current.
 * @param {HTMLElement} topNav
 */
function applyActiveLinkState(topNav) {
  let currentPath = window.location.pathname;
  // Homepage maps to /werknemer/ (source site default audience)
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
      // Close all open flyouts in this nav
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

  // Close any open flyout on outside click
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

  // Wire search — navigate to /zoeken with query param
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
 * The block element passed in is an empty div; this function fetches the
 * /nav fragment, builds the complete header DOM, and replaces block content.
 *
 * @param {HTMLElement} block
 */
export default async function decorate(block) {
  // ------------------------------------------------------------------
  // 1. Fetch the /nav fragment
  // ------------------------------------------------------------------
  const navDoc = await fetchFragment(NAV_FRAGMENT_PATH);

  let logoHref = '/';
  let logoAlt = 'BPF Schilders';
  let audienceSwitcherHtml = '';
  let mainNavHtml = '';
  let searchPlaceholder = 'Heeft u een vraag?';
  let loginUrl = '/pensioenadministratie/inloggen/#!/login/redirect?';

  let usedFragment = false;
  if (navDoc) {
    // /nav.plain.html renders as a single <div> containing one <div> per row.
    // Each row: <div><div> cell-content </div></div>
    let rows = [...navDoc.body.querySelectorAll(':scope > div')];

    // When the AEM SDK returns a full HTML page instead of a plain fragment,
    // the body contains <header>/<main>/<footer> — no direct <div> children.
    // Try extracting rows from the <main> content area instead.
    if (rows.length === 0) {
      const main = navDoc.querySelector('main');
      if (main) {
        rows = [...main.querySelectorAll(':scope > div > div > div > div')];
      }
    }

    if (rows.length >= 2) {
      usedFragment = true;
      const getCell = (n) => cell(rows[n]);

      if (rows[0]) logoHref = cellText(getCell(0)) || '/';
      if (rows[1]) logoAlt = cellText(getCell(1)) || 'BPF Schilders';
      if (rows[2]) {
        const c = getCell(2);
        audienceSwitcherHtml = c ? c.innerHTML : '';
      }
      if (rows[3]) {
        const c = getCell(3);
        mainNavHtml = c ? c.innerHTML : '';
      }
      if (rows[4]) searchPlaceholder = cellText(getCell(4)) || searchPlaceholder;
      if (rows[5]) loginUrl = cellText(getCell(5)) || loginUrl;
    }
  }

  if (!usedFragment) {
    // Fallback: render source nav structure verbatim so the block is
    // usable even without an authored /nav fragment.
    audienceSwitcherHtml = `<ul>
      <li class="active"><a href="/werknemer/">Werknemer</a></li>
      <li><a href="/ondernemer/">Ondernemer</a></li>
      <li><a href="/werkgever/">Werkgever</a></li>
      <li><a href="/over-ons/">Over ons</a></li>
      <li><a href="/klacht/">Klacht</a></li>
      <li><a href="/translate/">Translate</a></li>
      <li><a href="/contact/">Contact</a></li>
    </ul>`;

    mainNavHtml = `<ul>
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
  }

  // ------------------------------------------------------------------
  // 2. Build DOM
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

  // Nav wrapper (#header-navigation)
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
  topNav.insertAdjacentHTML('beforeend', audienceSwitcherHtml);
  topNav.append(buildLoginState(loginUrl));

  // Main navigation (primary nav)
  const mainNav = document.createElement('nav');
  mainNav.setAttribute('role', 'navigation');
  mainNav.setAttribute('aria-label', 'Navigatie');
  mainNav.className = 'main-navigation';

  const mainNavLabel = document.createElement('span');
  mainNavLabel.textContent = 'Navigatie';
  mainNav.append(mainNavLabel);
  mainNav.insertAdjacentHTML('beforeend', mainNavHtml);

  // On non-werknemer pages, the source site does not show the werknemer
  // sub-navigation bar. Hide it to match source layout and reduce header
  // pixel diff on ~12 non-werknemer pages.
  if (!isWerknemerPage()) {
    mainNav.style.display = 'none';
    mainNav.setAttribute('aria-hidden', 'true');
  }

  headerNav.append(topNav, mainNav);
  container.append(headerNav);

  // Search box
  const searchbox = buildSearchBox(searchPlaceholder);
  container.append(searchbox);

  // ------------------------------------------------------------------
  // 3. Replace block content
  // ------------------------------------------------------------------
  block.textContent = '';
  block.append(container);

  // ------------------------------------------------------------------
  // 4. Decorate interactive behaviours
  // ------------------------------------------------------------------
  applyActiveLinkState(topNav);
  decorateFlyouts(mainNav);
  injectMobileButtons(container, headerNav, searchbox);

  // Add home icon to the "Home" nav item
  const homeLink = mainNav.querySelector('li.home > a');
  if (homeLink) {
    const homeIcon = document.createElement('span');
    homeIcon.className = 'icon-home';
    homeIcon.innerHTML = ICON_HOME;
    homeLink.prepend(homeIcon);
  }

  // ------------------------------------------------------------------
  // 5. Ensure the header <header> element has the right height token
  //    so the sticky chrome doesn't obscure content.
  // ------------------------------------------------------------------
  const headerEl = block.closest('header');
  if (headerEl) {
    // Remove the boilerplate fixed height; actual height driven by content.
    headerEl.style.height = 'auto';
  }
}
