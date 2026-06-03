import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Carousel block — EmploymentTopicsList
 *
 * Each carousel-item child stores fields (icon_class, label, href) as direct
 * JCR properties on the item node. aem.live's block/item renderer does not
 * populate these as table cells — the inner <div> is empty. This decorator
 * fetches each item's .json via the same-origin proxy to read the fields.
 *
 * Content model (per carousel-item JCR node):
 *   label      — visible tile label (always present)
 *   icon_class — BPF icon class string (optional)
 *   href       — link URL (optional)
 *
 * BA-spec ACs implemented:
 *   AC-carousel-001: one li per item
 *   AC-carousel-002: first li.active on load
 *   AC-carousel-003/004: next/prev buttons update transform + active dot
 *   AC-carousel-005: paging dot click jumps to page
 *   AC-carousel-006: transition-duration 500ms
 *   AC-carousel-007: all hrefs non-empty
 */

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
 * @param {string} path JCR path
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

/** Number of tiles visible at once depending on viewport width */
function getItemsPerPage() {
  return window.innerWidth >= 769 ? 6 : 2;
}

/**
 * Size each li to fill exactly 1/itemsPerPage of the wrapper width.
 * Sets inline widths and the ul total width.
 * Falls back to a percentage layout if the wrapper has no layout width yet
 * (e.g. at decoration time before images load).
 * @param {HTMLElement} wrapper  .carrousel-wrapper
 * @param {HTMLUListElement} ul  ul.slider-wrapper
 * @returns {number} computed item pixel width (may be 0 if layout not ready)
 */
function sizeItems(wrapper, ul) {
  const ipp = getItemsPerPage();
  const wrapperWidth = wrapper.getBoundingClientRect().width || wrapper.offsetWidth;
  const items = ul.querySelectorAll('li');

  if (wrapperWidth > 0) {
    const itemWidth = wrapperWidth / ipp;
    items.forEach((li) => {
      li.style.width = `${itemWidth}px`;
      li.style.flex = `0 0 ${itemWidth}px`;
    });
    ul.style.width = `${items.length * itemWidth}px`;
    return itemWidth;
  }

  const itemPct = `${100 / ipp}%`;
  items.forEach((li) => {
    li.style.width = itemPct;
    li.style.flex = `0 0 ${itemPct}`;
  });
  ul.style.width = 'max-content';
  return 0;
}

/**
 * Apply the slide transform for the given page index.
 * @param {HTMLElement} block   .carousel.block
 * @param {number} page        target page (0-based)
 * @param {boolean} animate    whether to play the 500ms transition
 */
function setPage(block, page, animate) {
  const ul = block.querySelector('ul.slider-wrapper');
  const wrapper = block.querySelector('.carrousel-wrapper');
  if (!ul || !wrapper) return;

  const ipp = getItemsPerPage();
  const totalItems = ul.querySelectorAll('li').length;
  const totalPages = Math.ceil(totalItems / ipp);
  const safePage = Math.max(0, Math.min(page, totalPages - 1));

  block.dataset.currentPage = String(safePage);

  const itemWidth = sizeItems(wrapper, ul);
  const offset = safePage * ipp * itemWidth;

  if (animate) {
    ul.style.transitionDuration = '500ms';
    ul.style.transitionTimingFunction = 'ease';
    ul.style.transitionProperty = 'transform';
  } else {
    ul.style.transitionDuration = '0ms';
  }

  ul.style.transform = `translate3d(-${offset}px, 0px, 0px)`;

  const dots = block.querySelectorAll('button.carrousel-paging-button');
  dots.forEach((dot) => {
    const dotIndex = parseInt(dot.dataset.index, 10);
    dot.classList.toggle('active', dotIndex === safePage);
    dot.setAttribute('aria-current', dotIndex === safePage ? 'true' : 'false');
  });

  const items = ul.querySelectorAll('li');
  items.forEach((li, i) => {
    li.classList.toggle('active', i === safePage * ipp);
  });
}

/**
 * Map from href path slugs to BPFicons icon class names.
 * Used as a fallback when the JCR item has no icon_class property.
 */
const SLUG_TO_ICON = {
  'met-pensioen-gaan': 'icon-bpf-pensioen',
  'trouwen-of-samenwonen': 'icon-bpf-trouwen',
  'trouwen-en-samenwonen': 'icon-bpf-trouwen',
  verhuizen: 'icon-bpf-verhuizen',
  'scheiden-of-uit-elkaar-gaan': 'icon-bpf-scheiden',
  ontslag: 'icon-bpf-ontslag',
  'nieuwe-baan': 'icon-bpf-veranderenvanbaan',
  'veranderen-van-baan': 'icon-bpf-veranderenvanbaan',
  'uitzendkracht-worden': 'icon-bpf-uitzendkracht',
  'voor-uzelf-beginnen': 'icon-bpf-voorjezelfbeginnen',
  arbeidsongeschiktheid: 'icon-bpf-arbeidsongeschikt',
  verlof: 'icon-bpf-verlof',
  overlijden: 'icon-bpf-overlijden',
  kinderen: 'icon-bpf-kinderen',
  samenwonen: 'icon-bpf-samenwonen',
  'klant-worden': 'icon-bpf-klantworden',
  'informeren-werknemers': 'icon-bpf-informatie',
  'nieuwe-werknemer': 'icon-bpf-veranderenvanbaan',
  'langdurig-zieke-werknemer': 'icon-bpf-arbeidsongeschikt',
  'zieke-werknemer': 'icon-bpf-arbeidsongeschikt',
  'aan-of-afmelden': 'icon-bpf-voorjezelfbeginnen',
  'prive-situatie': 'icon-bpf-samenwonen',
  privesituatie: 'icon-bpf-samenwonen',
};

/**
 * Derive icon class from a tile href when the JCR property is absent.
 * Checks each path segment (last non-empty segment first) against SLUG_TO_ICON.
 * @param {string} href
 * @returns {string} icon-bpf-* class or empty string
 */
function iconFromHref(href) {
  if (!href) return '';
  const segments = href.split('/').filter(Boolean);
  const len = segments.length;
  for (let i = len - 1; i >= 0; i -= 1) {
    const slug = segments[i];
    if (SLUG_TO_ICON[slug]) return SLUG_TO_ICON[slug];
  }
  return '';
}

/**
 * Build a tile <li> from fetched JCR data and the source item row element.
 * @param {Element} itemRow  — the source item row (for moveInstrumentation)
 * @param {Object} data      — JCR JSON with label, icon_class, href
 * @returns {HTMLLIElement}
 */
function buildTile(itemRow, data) {
  const label = ((data && data.label) || '').trim();
  const href = ((data && data.href) || '').trim();

  // Resolve specific icon class: prefer explicit JCR value, fall back to href slug map.
  const rawIcon = (data && data.icon_class) ? data.icon_class.trim() : '';
  const specificIcon = rawIcon || iconFromHref(href);

  // Always use the base classes + the specific icon class (if any).
  // base classes provide the purple circle; specific class triggers the BPFicons ::before glyph.
  const iconClasses = specificIcon
    ? ['costumer-journey-icon', 'icon-bpf', specificIcon]
    : ['costumer-journey-icon', 'icon-bpf'];

  const li = document.createElement('li');
  moveInstrumentation(itemRow, li);

  const icon = document.createElement('i');
  iconClasses.forEach((cls) => icon.classList.add(cls));
  icon.setAttribute('aria-hidden', 'true');

  const span = document.createElement('span');
  span.className = 'tile-label';
  span.textContent = label;

  if (href && href !== '#') {
    const a = document.createElement('a');
    a.href = href;
    a.appendChild(icon);
    a.appendChild(span);
    li.appendChild(a);
  } else {
    li.appendChild(icon);
    li.appendChild(span);
  }

  return li;
}

/**
 * Decorate the carousel block.
 * @param {Element} block
 */
export default async function decorate(block) {
  const allRows = [...block.children];

  // Fetch all item JCR data in parallel.
  const itemData = await Promise.all(
    allRows.map(async (row) => {
      const path = jcrPath(row);
      const data = await fetchJcr(path);
      return { row, data };
    }),
  );

  // Filter to rows that have at least a label (skip rows with no data).
  const sourceItems = itemData.filter(({ data }) => data && (data.label || data.href));

  if (sourceItems.length === 0) return;

  // ── Build the carousel DOM structure ──────────────────────
  const wrapper = document.createElement('div');
  wrapper.className = 'carrousel-wrapper';

  const ul = document.createElement('ul');
  ul.className = 'slider-wrapper';

  sourceItems.forEach(({ row, data }) => {
    const li = buildTile(row, data);
    ul.appendChild(li);
  });

  wrapper.appendChild(ul);

  // ── Previous button ───────────────────────────────────────
  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'carrousel-button carrousel-button-previous';
  prevBtn.setAttribute('aria-label', 'Vorige');

  // ── Next button ───────────────────────────────────────────
  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'carrousel-button carrousel-button-next';
  nextBtn.setAttribute('aria-label', 'Volgende');

  // ── Paging nav ────────────────────────────────────────────
  const totalItems = sourceItems.length;
  const totalPages = Math.ceil(totalItems / getItemsPerPage());

  const pagingNav = document.createElement('nav');
  pagingNav.id = 'carrousel-paging-nav';
  pagingNav.className = 'carrousel-paging';
  pagingNav.setAttribute('aria-label', 'Carrousel paginering');

  for (let i = 0; i < totalPages; i += 1) {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'carrousel-paging-button';
    if (i === 0) dot.classList.add('active');
    dot.dataset.index = String(i);
    dot.setAttribute('aria-label', `Ga naar pagina ${i + 1}`);
    dot.setAttribute('aria-current', i === 0 ? 'true' : 'false');
    pagingNav.appendChild(dot);
  }

  // ── Rebuild block DOM ─────────────────────────────────────
  block.replaceChildren(wrapper, prevBtn, nextBtn, pagingNav);

  // ── Initial sizing + layout ───────────────────────────────
  block.dataset.currentPage = '0';
  setPage(block, 0, false);

  // ── Robust re-layout after wrapper gains width ────────────
  function relayout() {
    const current = parseInt(block.dataset.currentPage || '0', 10);
    setPage(block, current, false);
  }

  if (typeof ResizeObserver !== 'undefined') {
    let initialised = false;
    const ro = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.contentRect.width > 0) {
          relayout();
          if (!initialised) {
            initialised = true;
            ro.disconnect();
          }
        }
      });
    });
    ro.observe(wrapper);
  }

  // Fallback: re-layout when any slide image fires its load event.
  ul.querySelectorAll('img').forEach((img) => {
    if (!img.complete) {
      img.addEventListener('load', relayout, { once: true });
    }
  });

  // ── Event: next button ────────────────────────────────────
  nextBtn.addEventListener('click', () => {
    const current = parseInt(block.dataset.currentPage || '0', 10);
    const ipp = getItemsPerPage();
    const pages = Math.ceil(ul.querySelectorAll('li').length / ipp);
    const next = (current + 1) % pages;
    setPage(block, next, true);
  });

  // ── Event: previous button ────────────────────────────────
  prevBtn.addEventListener('click', () => {
    const current = parseInt(block.dataset.currentPage || '0', 10);
    const ipp = getItemsPerPage();
    const pages = Math.ceil(ul.querySelectorAll('li').length / ipp);
    const prev = (current - 1 + pages) % pages;
    setPage(block, prev, true);
  });

  // ── Event: paging dot clicks ──────────────────────────────
  pagingNav.addEventListener('click', (e) => {
    const dot = e.target.closest('button.carrousel-paging-button');
    if (!dot) return;
    const target = parseInt(dot.dataset.index, 10);
    setPage(block, target, true);
  });

  // ── Resize handler — recalculate layout ──────────────────
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const ipp = getItemsPerPage();
      const newTotalPages = Math.ceil(ul.querySelectorAll('li').length / ipp);

      const existingDots = pagingNav.querySelectorAll('button.carrousel-paging-button');
      if (existingDots.length !== newTotalPages) {
        pagingNav.innerHTML = '';
        for (let i = 0; i < newTotalPages; i += 1) {
          const dot = document.createElement('button');
          dot.type = 'button';
          dot.className = 'carrousel-paging-button';
          dot.dataset.index = String(i);
          dot.setAttribute('aria-label', `Ga naar pagina ${i + 1}`);
          dot.setAttribute('aria-current', 'false');
          pagingNav.appendChild(dot);
        }
      }

      const current = parseInt(block.dataset.currentPage || '0', 10);
      const safePage = Math.min(current, newTotalPages - 1);
      setPage(block, safePage, false);
    }, 100);
  });
}
