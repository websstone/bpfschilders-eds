import {
  loadHeader,
  loadFooter,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
} from './aem.js';

/**
 * Two-column layout configuration.
 *
 * sidebar_requires_class: block container class that must be present for a section
 *   to qualify for the sidebar column (shared heuristic used by pages WITHOUT an
 *   explicit sidebar section list).
 *
 * sidebar_excludes_classes: if any of these container classes are present, the
 *   section stays in the main column regardless (shared heuristic).
 *
 * sidebar_max_links_blocks: sidebar sections must contain at most this many
 *   links blocks (guards against FAQ/videogesprek sections that also have links).
 *
 * pages: path patterns (prefix match) where the two-column layout applies.
 *
 * page_sidebar_sections: optional per-path map of explicit JCR section node-name
 *   suffixes that must be placed in the sidebar.  When a path has an entry here the
 *   shared heuristic is NOT used for that path — only sections whose data-aue-resource
 *   ends with one of the listed node names are assigned to the sidebar column.
 *   This prevents false-positive sidebar assignment for pages that also have
 *   links-only procedure-step sections that must stay in the main column.
 */
const TWO_COLUMN_CONFIG = {
  sidebar_requires_class: 'links-container',
  sidebar_excludes_classes: [
    'teaser-container',
    'accordion-container',
    'cards-container',
    'hero-container',
    'carousel-container',
  ],
  sidebar_max_links_blocks: 1,
  // Only /klacht has genuine sidebar content migrated (the contact quick-links
  // sections). /contact was removed: its content was authored as main-column
  // sections (section_0–2), and the shared heuristic mis-assigned them to the
  // sidebar — scrambling the page. With no real sidebar section, /contact
  // renders correctly as a single column.
  pages: ['/klacht'],
  page_sidebar_sections: {
    '/klacht': ['section_sidebar_werknemer', 'section_sidebar_ondernemer'],
  },
};

/**
 * Determines whether the current page should receive the two-column layout.
 * @returns {boolean}
 */
function isTwoColumnPage() {
  const { pathname } = window.location;
  return TWO_COLUMN_CONFIG.pages.some((p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}.`));
}

/**
 * Returns the per-path explicit sidebar section node-name list for the current
 * pathname, or null when the path should use the shared heuristic.
 * @param {string} pathname
 * @returns {string[]|null}
 */
function getExplicitSidebarSections(pathname) {
  const map = TWO_COLUMN_CONFIG.page_sidebar_sections;
  if (!map) return null;
  const match = Object.keys(map).find(
    (p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}.`),
  );
  return match ? map[match] : null;
}

/**
 * Determines whether a decorated .section element belongs in the sidebar.
 *
 * For paths that have an explicit sidebar section list (page_sidebar_sections),
 * the section qualifies only if its data-aue-resource attribute ends with one of
 * the configured JCR node-name suffixes.  This guarantees that procedure-step
 * sections which also carry links-container (but are NOT pure sidebar sections)
 * remain in the main column.
 *
 * For all other paths the shared heuristic applies:
 *   1. It has the required sidebar block class (links-container).
 *   2. It has NO excluded block classes (teaser, accordion, cards, hero, carousel).
 *   3. It contains at most sidebar_max_links_blocks links blocks.
 * @param {Element} section
 * @param {string[]} [explicitList] - per-path explicit node-name list, if any
 * @returns {boolean}
 */
function isSidebarSection(section, explicitList) {
  if (explicitList) {
    const resource = section.dataset.aueResource || '';
    if (resource) return explicitList.some((name) => resource.endsWith(`/${name}`));
    // Delivery fallback (no data-aue-resource): the contact quick-links sidebar
    // sections are the only ones carrying a phone (tel:) link.
    return !!section.querySelector('a[href^="tel:"]');
  }
  const has = (cls) => section.classList.contains(cls);
  if (!has(TWO_COLUMN_CONFIG.sidebar_requires_class)) return false;
  if (TWO_COLUMN_CONFIG.sidebar_excludes_classes.some(has)) return false;
  const linksCount = section.querySelectorAll('[data-block-name="links"]').length;
  return linksCount <= TWO_COLUMN_CONFIG.sidebar_max_links_blocks;
}

/**
 * Sub-navigation bar configuration.
 *
 * pages: path patterns (prefix match) where the sub-nav bar applies.
 *
 * page_subnav_block: per-path JCR block node name whose parent section
 *   should be promoted to the top of <main> and styled as a horizontal
 *   sub-nav bar.  The section receives the class "subnav-bar" which
 *   activates the horizontal layout in links.css.
 */
const SUBNAV_CONFIG = {
  pages: ['/over-ons'],
  page_subnav_block: {
    '/over-ons': 'links_subnavigatie',
  },
};

/**
 * Promotes the sub-navigation links section to the top of <main> and marks
 * it with the "subnav-bar" class so links.css can style it as a horizontal
 * tab bar.  Must be called after decorateSections + decorateBlocks.
 *
 * On the /over-ons page the section containing links_subnavigatie is authored
 * AFTER the cards section (section_1 after section_0) but must appear visually
 * BEFORE the cards, directly below the header — matching the source site's
 * Bootstrap secondary navigation row.
 *
 * @param {Element} main
 */
export function applySubNavBar(main) {
  const { pathname } = window.location;
  const pageMatch = SUBNAV_CONFIG.pages.find(
    (p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}.`),
  );
  if (!pageMatch) return;

  const blockNodeName = SUBNAV_CONFIG.page_subnav_block[pageMatch];
  if (!blockNodeName) return;

  // The section itself has resource ending in section_N; the block inside has
  // resource ending in section_N/<blockNodeName>.  Locate via the block resource.
  const targetSection = [...main.querySelectorAll(':scope > .section')].find((section) => {
    const block = section.querySelector(`[data-aue-resource*="/${blockNodeName}"]`);
    return !!block;
  });
  if (!targetSection) return;

  targetSection.classList.add('subnav-bar');
  main.insertBefore(targetSection, main.firstChild);
}

/**
 * Prepends the home (house) icon link that the source renders before the
 * sub-nav items. Must run after the links block JS has built its <ul>, so it
 * is called from loadEager once the first section has loaded. Idempotent.
 * @param {Element} main
 */
export function applySubNavHome(main) {
  const bar = main.querySelector('.subnav-bar');
  if (!bar) return;
  const list = bar.querySelector('ul');
  if (!list || list.querySelector('.subnav-home')) return;

  const li = document.createElement('li');
  li.className = 'subnav-home-item';
  const a = document.createElement('a');
  a.className = 'subnav-home';
  a.href = '/';
  a.setAttribute('aria-label', 'Home');
  const icon = document.createElement('span');
  icon.className = 'icon icon-home';
  icon.setAttribute('aria-hidden', 'true');
  a.append(icon);
  li.append(a);
  list.insertBefore(li, list.firstChild);
}

/**
 * On the audience landing pages the source renders the dekkingsgraad indicator
 * and the INLOGGEN call-to-action side-by-side as a two-column info strip.
 * Our migration authors them as two separate blocks (text + cta) in one section,
 * which stack vertically by default. Tag that section so CSS can lay it out as a
 * 2-column strip matching the source.
 * @param {Element} main
 */
// '/' is the homepage, which mirrors the /werknemer audience-page layout.
const INFO_STRIP_PAGES = ['/', '/werknemer', '/werkgever', '/ondernemer'];

/**
 * Wraps the dekkingsgraad indicator and the INLOGGEN call-to-action into a
 * full-bleed info strip (matching the source top-panel band).
 *
 * Identification is RESOURCE-based, not text-based, so it works during the eager
 * decorateMain pass — before custom block JS has injected text content. The
 * dekkingsgraad block is authored as a text block on /werknemer and as a cta
 * block on /ondernemer + /werkgever; both carry a JCR node name containing
 * "dekkingsgraad" on their data-aue-resource. The INLOGGEN cta is the sibling
 * cta block whose (already-inline) content matches /inloggen/.
 *
 * Resulting DOM:
 *   <div class="info-strip">          ← full-bleed grey band
 *     <div class="info-strip-inner">  ← centred to the 1000px container, 2 cells
 *       <div class="…-wrapper dekkingsgraad-cell">…</div>
 *       <div class="cta-wrapper inloggen-cell">…</div>
 *     </div>
 *   </div>
 *
 * The dekkingsgraad cell content is rebuilt later by normalizeDekkingsgraad once
 * block JS has run and the percentage text is available.
 * @param {Element} main
 */
export function applyInfoStrip(main) {
  const { pathname } = window.location;
  const match = INFO_STRIP_PAGES.find(
    (p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}.`),
  );
  if (!match) return;
  if (main.querySelector('.info-strip')) return; // already built

  // Identify the dekkingsgraad block by its content (its title and href both
  // contain "dekkingsgraad"). Runs after decorateBlocks but before block JS, so
  // the raw delivered cells still carry the text. Content-based so it works on
  // the published site, where data-aue-resource attributes are absent.
  const dekBlock = [...main.querySelectorAll(
    '.section [data-block-name="text"], .section [data-block-name="cta"]',
  )].find((b) => /dekkingsgraad/i.test(b.textContent));
  const dekWrapper = dekBlock && dekBlock.closest('.text-wrapper, .cta-wrapper');
  if (!dekWrapper) return;

  const section = dekWrapper.closest('.section');
  const inloggenWrapper = [...section.children].find(
    (c) => c !== dekWrapper && c.querySelector(':scope .cta.block') && /inloggen/i.test(c.textContent),
  );
  if (!inloggenWrapper) return;

  dekWrapper.classList.add('dekkingsgraad-cell');
  inloggenWrapper.classList.add('inloggen-cell');

  const band = document.createElement('div');
  band.className = 'info-strip';
  const inner = document.createElement('div');
  inner.className = 'info-strip-inner';
  section.insertBefore(band, dekWrapper);
  band.append(inner);
  inner.append(dekWrapper, inloggenWrapper);
}

/**
 * Rebuilds the dekkingsgraad cell into the source-matching indicator markup:
 *   <a class="dekkingsgraad-indicator" href="…/dekkingsgraad/">
 *     <span class="icon icon-area-chart"></span>
 *     <span class="dekkingsgraad-text">Eindstand beleidsdekkingsgraad 2025
 *       <strong>140,7%</strong></span>
 *   </a>
 * Normalizes BOTH the text-block form (/werknemer) and the cta-block form
 * (/ondernemer, /werkgever) into identical output. Must run AFTER the first
 * section has loaded so the percentage text is present. Idempotent.
 * @param {Element} main
 */
export function normalizeDekkingsgraad(main) {
  const cell = main.querySelector('.dekkingsgraad-cell');
  if (!cell || cell.querySelector('.dekkingsgraad-indicator')) return;

  const anchor = cell.querySelector('a[href]');
  const href = (anchor && anchor.getAttribute('href')) || '/over-ons/dit-presteren-we/dekkingsgraad/';

  // Text-block form (/werknemer): label = <h2>, percentage = .text-description.
  // CTA form (/ondernemer, /werkgever): a single "label: percentage" string,
  // sometimes followed by the href URL rendered as text — strip that first.
  const heading = cell.querySelector('h2');
  let label;
  let pct;
  if (heading) {
    label = heading.textContent.trim();
    const desc = cell.querySelector('.text-description');
    pct = (desc ? desc.textContent : '').replace(/\s+/g, ' ').trim();
  } else {
    let text = cell.textContent.replace(/\s+/g, ' ').trim();
    const anchorTxt = anchor ? anchor.textContent.replace(/\s+/g, ' ').trim() : '';
    if (anchorTxt && text.includes(anchorTxt)) text = text.replace(anchorTxt, '').trim();
    const pctMatch = text.match(/([\d.,]+\s*%)/);
    pct = pctMatch ? pctMatch[1].trim() : '';
    label = (pct ? text.slice(0, text.lastIndexOf(pct)) : text).replace(/[:\s]+$/, '').trim();
  }

  const link = document.createElement('a');
  link.className = 'dekkingsgraad-indicator';
  link.href = href;

  const icon = document.createElement('span');
  icon.className = 'icon icon-area-chart';
  icon.setAttribute('aria-hidden', 'true');

  const span = document.createElement('span');
  span.className = 'dekkingsgraad-text';
  span.textContent = label;
  if (pct) {
    const strong = document.createElement('strong');
    strong.textContent = pct;
    span.append(strong);
  }

  link.append(icon, span);

  // Preserve UE instrumentation from the authored block.
  const instr = cell.querySelector('[data-aue-resource]');
  // eslint-disable-next-line no-use-before-define
  if (instr) moveInstrumentation(instr, link);

  cell.replaceChildren(link);
}

/**
 * Source contact quick-link sidebar sections carry a heading ("Bent u
 * werknemer?" / "Bent u ondernemer of werkgever?") that the migration did not
 * carry across as content. Re-add it, keyed off the JCR section node name.
 * @param {Element} section
 */
const SIDEBAR_TITLES = {
  section_sidebar_werknemer: 'Bent u werknemer?',
  section_sidebar_ondernemer: 'Bent u ondernemer of werkgever?',
};
function addSidebarTitle(section) {
  if (section.querySelector('.sidebar-title')) return;
  const resource = section.dataset.aueResource
    || (section.querySelector('[data-aue-resource]') || {}).dataset?.aueResource
    || '';
  const node = resource.split('/').pop();
  let title = SIDEBAR_TITLES[node];
  if (!title) {
    // Delivery fallback (no data-aue-resource): identify by the contact target.
    if (section.querySelector('a[href*="/ondernemer/"]')) title = 'Bent u ondernemer of werkgever?';
    else if (section.querySelector('a[href*="/werknemer/"]')) title = 'Bent u werknemer?';
  }
  if (!title) return;
  const heading = document.createElement('p');
  heading.className = 'sidebar-title';
  heading.textContent = title;
  section.insertBefore(heading, section.firstChild);
}

/**
 * On the audience landing pages the "Wat doe ik bij..." heading + carousel sit
 * on a full-width WHITE band with a soft shadow (source: section.full-width
 * .costumer-journey), distinct from the grey bands above/below. The migration
 * authored them as plain wrappers in the same grey section. Wrap the heading +
 * carousel in a `.customer-journey` band so CSS can render the white card.
 * @param {Element} main
 */
const CUSTOMER_JOURNEY_PAGES = ['/', '/werknemer', '/werkgever', '/ondernemer'];
export function applyCustomerJourney(main) {
  const { pathname } = window.location;
  const match = CUSTOMER_JOURNEY_PAGES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}.`),
  );
  if (!match) return;

  const carousel = main.querySelector('.carousel-wrapper');
  if (!carousel || carousel.closest('.customer-journey')) return;
  const section = carousel.closest('.section');
  if (!section) return;

  const prev = carousel.previousElementSibling;
  const heading = prev && prev.classList.contains('text-wrapper') ? prev : null;

  const band = document.createElement('div');
  band.className = 'customer-journey';
  const inner = document.createElement('div');
  inner.className = 'customer-journey-inner';

  section.insertBefore(band, heading || carousel);
  if (heading) inner.append(heading);
  inner.append(carousel);
  band.append(inner);
}

/**
 * Applies a two-column (main + right sidebar) layout to pages listed in
 * TWO_COLUMN_CONFIG.pages.  Must be called after decorateSections + decorateBlocks
 * so that section container classes are already set.
 *
 * DOM result:
 *   <main>
 *     <div class="two-col-layout">
 *       <div class="two-col-main">  ← left column (main content)
 *         ...section divs...
 *       </div>
 *       <aside class="two-col-sidebar">  ← right column (contact quick-links etc.)
 *         ...section divs...
 *       </aside>
 *     </div>
 *   </main>
 *
 * UE instrumentation (data-aue-*) is preserved: section divs retain all their
 * attributes; only their parent in the DOM tree changes.
 *
 * @param {Element} main
 */
export function applyTwoColumnLayout(main) {
  if (!isTwoColumnPage()) return;

  const explicitList = getExplicitSidebarSections(window.location.pathname);
  const sections = [...main.querySelectorAll(':scope > .section')];
  const sidebarSections = sections.filter((s) => isSidebarSection(s, explicitList));
  const mainSections = sections.filter((s) => !isSidebarSection(s, explicitList));

  if (sidebarSections.length === 0) return; // nothing to sidebar — skip

  const layout = document.createElement('div');
  layout.className = 'two-col-layout';

  const mainCol = document.createElement('div');
  mainCol.className = 'two-col-main';

  const aside = document.createElement('aside');
  aside.className = 'two-col-sidebar';
  aside.setAttribute('aria-label', 'Contactgegevens');

  mainSections.forEach((s) => mainCol.appendChild(s));
  sidebarSections.forEach((s) => {
    addSidebarTitle(s);
    aside.appendChild(s);
  });

  layout.appendChild(mainCol);
  layout.appendChild(aside);
  main.appendChild(layout);
}

/**
 * Markup for the contact quick-links sidebar. This is standard site chrome
 * (identical to the /klacht sidebar) that the migration did NOT carry across
 * for /contact. Reconstructed so the page can render the source two-column
 * layout. Structure mirrors a decorated links block so links.css styles the
 * icon circles and styles.css the .sidebar-title.
 */
const CONTACT_SIDEBAR_HTML = `
  <div class="section links-container">
    <p class="sidebar-title">Bent u werknemer?</p>
    <div class="links-wrapper"><div class="links"><ul class="contact">
      <li><a class="icon-phone" href="tel:030-2775600">030-277 56 00</a></li>
      <li><a class="icon-envelope" href="/werknemer/contact/stel-uw-vraag/">Mail ons</a></li>
      <li><a class="icon-facebook" href="https://www.facebook.com/bpfschilders" target="_blank" rel="noopener noreferrer">Volg ons</a></li>
    </ul></div></div>
    <p class="sidebar-title">Bent u ondernemer of werkgever?</p>
    <div class="links-wrapper"><div class="links"><ul class="contact">
      <li><a class="icon-phone" href="tel:030-2775610">030-277 56 10</a></li>
      <li><a class="icon-envelope" href="/ondernemer/contact/stel-uw-vraag/">Mail ons</a></li>
      <li><a class="icon-facebook" href="https://www.facebook.com/bpfschilders" target="_blank" rel="noopener noreferrer">Volg ons</a></li>
    </ul></div></div>
    <p class="contacts-add">Openingstijden:<br>maandag tot en met vrijdag van 08:30 tot 17:00 uur</p>
  </div>`;

/**
 * Wraps two sibling sections into a side-by-side bottom-duo row (source: the
 * "Veelgestelde vragen | Ook interessant" / FAQ + "Looking for something else"
 * blocks shown as two equal columns at the foot of contact & translate).
 * @param {Element} left
 * @param {Element} right
 * @returns {Element} the duo wrapper (already replaces left in the DOM)
 */
function wrapBottomDuo(left, right) {
  const duo = document.createElement('div');
  duo.className = 'bottom-duo';
  left.parentElement.insertBefore(duo, left);
  duo.append(left, right);
  return duo;
}

/**
 * Builds the /contact two-column layout. The migration authored every section
 * in the main column and dropped the source's contact quick-links sidebar, so
 * the shared heuristic mis-sorted content. Here we explicitly place the textual
 * content in the main column, reconstruct the quick-links sidebar, and lay the
 * FAQ + "Ook interessant" sections out as a bottom two-column row.
 * @param {Element} main
 */
export function applyContactLayout(main) {
  if (window.location.pathname.replace(/\/$/, '') !== '/contact') return;
  if (main.querySelector('.two-col-layout')) return;

  const sections = [...main.querySelectorAll(':scope > .section')];
  if (!sections.length) return;

  const isBottom = (s) => s.classList.contains('accordion-container') || s.classList.contains('cards-container');
  const mainSections = sections.filter((s) => !isBottom(s));
  const bottomSections = sections.filter(isBottom);

  const layout = document.createElement('div');
  layout.className = 'two-col-layout';
  const mainCol = document.createElement('div');
  mainCol.className = 'two-col-main contact-main';
  const aside = document.createElement('aside');
  aside.className = 'two-col-sidebar';
  aside.setAttribute('aria-label', 'Contactgegevens');
  aside.innerHTML = CONTACT_SIDEBAR_HTML;

  mainSections.forEach((s) => mainCol.appendChild(s));
  layout.append(mainCol, aside);
  main.appendChild(layout);

  // FAQ + Ook interessant → bottom two-column row (matches source).
  bottomSections.forEach((s) => main.appendChild(s));
  if (bottomSections.length === 2) wrapBottomDuo(bottomSections[0], bottomSections[1]);
}

/**
 * On /klacht the migration merged the "Veelgestelde vragen" FAQ accordion into
 * the top intro section, so the 8-item accordion dominates the top of the page.
 * The source renders it at the FOOT of the main column, beside the "Ook
 * interessant" links (two columns). Move the accordion down, give it its source
 * heading, and pair it with the last section as a bottom-duo.
 * @param {Element} main
 */
export function restructureKlachtFaq(main) {
  if (window.location.pathname.replace(/\/$/, '') !== '/klacht') return;
  const col = main.querySelector('.two-col-main') || main;
  // Select the FAQ accordion specifically — the page may also contain the
  // "Stap 1/2/3" procedure accordion, which must stay in place. The FAQ items
  // are questions; the Stap accordion's raw cells contain "Stap N".
  const accWrappers = [...col.querySelectorAll('.accordion-wrapper')];
  const accWrapper = accWrappers.find((w) => !/Stap\s*\d/i.test(w.textContent))
    || accWrappers[0];
  if (!accWrapper || accWrapper.closest('.klacht-faq')) return;

  const sections = [...col.querySelectorAll(':scope > .section')];
  const ookInteressant = sections[sections.length - 1] || null;

  const faqSec = document.createElement('div');
  faqSec.className = 'section klacht-faq';
  const heading = document.createElement('h3');
  heading.textContent = 'Veelgestelde vragen over de klachtenprocedure';
  faqSec.append(heading, accWrapper);

  col.appendChild(faqSec);
  if (ookInteressant && ookInteressant !== faqSec) wrapBottomDuo(faqSec, ookInteressant);
}

/**
 * On /translate the FAQ accordion and the "Looking for something else" text
 * block are the last two wrappers in the single page section; the source shows
 * them as two equal columns. Wrap them in a bottom-duo row.
 * @param {Element} main
 */
export function applyTranslateBottomDuo(main) {
  if (window.location.pathname.replace(/\/$/, '') !== '/translate') return;
  const accordion = main.querySelector('.accordion-wrapper');
  if (!accordion || accordion.closest('.bottom-duo')) return;
  const next = accordion.nextElementSibling;
  if (!next || !next.classList.contains('text-wrapper')) return;
  wrapBottomDuo(accordion, next);
}

/**
 * Moves all the attributes from a given elmenet to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveAttributes(from, to, attributes) {
  if (!attributes) {
    // eslint-disable-next-line no-param-reassign
    attributes = [...from.attributes].map(({ nodeName }) => nodeName);
  }
  attributes.forEach((attr) => {
    const value = from.getAttribute(attr);
    if (value) {
      to?.setAttribute(attr, value);
      from.removeAttribute(attr);
    }
  });
}

/**
 * Move instrumentation attributes from a given element to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveInstrumentation(from, to) {
  moveAttributes(
    from,
    to,
    [...from.attributes]
      .map(({ nodeName }) => nodeName)
      .filter((attr) => attr.startsWith('data-aue-') || attr.startsWith('data-richtext-')),
  );
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks() {
  try {
    // TODO: add auto block, if needed
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates formatted links to style them as buttons.
 * @param {HTMLElement} main The main container element
 */
export function decorateButtons(main) {
  main.querySelectorAll('p a[href]').forEach((a) => {
    a.title = a.title || a.textContent;
    const p = a.closest('p');
    const text = a.textContent.trim();

    // quick structural checks
    if (a.querySelector('img') || p.textContent.trim() !== text) return;

    // skip URL display links
    try {
      if (new URL(a.href).href === new URL(text, window.location).href) return;
    } catch { /* continue */ }

    // require authored formatting for buttonization
    const strong = a.closest('strong');
    const em = a.closest('em');
    if (!strong && !em) return;

    p.className = 'button-wrapper';
    a.className = 'button';
    if (strong && em) { // high-impact call-to-action
      a.classList.add('accent');
      const outer = strong.contains(em) ? strong : em;
      outer.replaceWith(a);
    } else if (strong) {
      a.classList.add('primary');
      strong.replaceWith(a);
    } else {
      a.classList.add('secondary');
      em.replaceWith(a);
    }
  });
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
  decorateButtons(main);
  applySubNavBar(main);
  applyInfoStrip(main);
  applyCustomerJourney(main);
  applyTwoColumnLayout(main);
  restructureKlachtFaq(main);
  applyContactLayout(main);
  applyTranslateBottomDuo(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
    // The dekkingsgraad percentage text is only present after block JS has run,
    // so rebuild the indicator now that the first section is loaded.
    normalizeDekkingsgraad(main);
    applySubNavHome(main);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  loadHeader(doc.querySelector('header'));

  const main = doc.querySelector('main');
  await loadSections(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();
