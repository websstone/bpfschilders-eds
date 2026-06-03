import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Carousel block — EmploymentTopicsList
 *
 * Content model (child-item rows, each has data-aue-component="carousel-item"):
 *   row.children[0] = icon_class   (e.g. "costumer-journey-icon icon-bpf icon-bpf-pensioen")
 *   row.children[1] = label        (e.g. "Met pensioen gaan")
 *   row.children[2] = href         (e.g. "/werknemer/wat-doe-ik-bij/met-pensioen-gaan/")
 *
 * BA-spec ACs implemented:
 *   AC-carousel-001: one li per item
 *   AC-carousel-002: first li.active on load
 *   AC-carousel-003/004: next/prev buttons update transform + active dot
 *   AC-carousel-005: paging dot click jumps to page
 *   AC-carousel-006: transition-duration 500ms
 *   AC-carousel-007: all hrefs non-empty
 */

/** Number of tiles visible at once depending on viewport width */
function getItemsPerPage() {
  return window.innerWidth >= 769 ? 6 : 2;
}

/**
 * Size each li to fill exactly 1/itemsPerPage of the wrapper width.
 * Sets inline widths and the ul total width.
 * @param {HTMLElement} wrapper  .carrousel-wrapper
 * @param {HTMLUListElement} ul  ul.slider-wrapper
 * @returns {number} computed item pixel width
 */
function sizeItems(wrapper, ul) {
  const ipp = getItemsPerPage();
  const itemWidth = wrapper.offsetWidth / ipp;
  const items = ul.querySelectorAll('li');
  items.forEach((li) => {
    li.style.width = `${itemWidth}px`;
    li.style.flex = `0 0 ${itemWidth}px`;
  });
  ul.style.width = `${items.length * itemWidth}px`;
  return itemWidth;
}

/**
 * Apply the slide transform for the given page index.
 * Stores page index on the block element's dataset (avoids module-scope state).
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

  // Update paging dots active state
  const dots = block.querySelectorAll('button.carrousel-paging-button');
  dots.forEach((dot) => {
    const dotIndex = parseInt(dot.dataset.index, 10);
    dot.classList.toggle('active', dotIndex === safePage);
    dot.setAttribute('aria-current', dotIndex === safePage ? 'true' : 'false');
  });

  // Update first li.active
  const items = ul.querySelectorAll('li');
  items.forEach((li, i) => {
    li.classList.toggle('active', i === safePage * ipp);
  });
}

/**
 * Read text from the first cell of a row's div children, or from the row itself.
 */
function cellText(cell) {
  if (!cell) return '';
  return (cell.textContent || '').trim();
}

/**
 * Build a tile <li> from a source item row.
 * Transfers UE instrumentation from source row + each property paragraph.
 */
function buildTile(itemRow) {
  const cells = itemRow.children;
  const iconClassCell = cells[0] || null;
  const labelCell = cells[1] || null;
  const hrefCell = cells[2] || null;

  const iconClasses = cellText(iconClassCell) || 'costumer-journey-icon icon-bpf';
  const label = cellText(labelCell) || '';
  const href = cellText(hrefCell) || '';

  const li = document.createElement('li');
  moveInstrumentation(itemRow, li);

  if (href && href !== '#') {
    const a = document.createElement('a');
    a.href = href;

    // Icon element — compound BPFicons class
    const icon = document.createElement('i');
    iconClasses.split(/\s+/).forEach((cls) => {
      if (cls) icon.classList.add(cls);
    });
    icon.setAttribute('aria-hidden', 'true');
    if (iconClassCell) moveInstrumentation(iconClassCell, icon);
    a.appendChild(icon);

    // Visible label
    const span = document.createElement('span');
    span.className = 'tile-label';
    span.textContent = label;
    if (labelCell) moveInstrumentation(labelCell, span);
    a.appendChild(span);

    li.appendChild(a);
  } else {
    // href missing or "#" — render as plain text tile (no anchor)
    const icon = document.createElement('i');
    iconClasses.split(/\s+/).forEach((cls) => {
      if (cls) icon.classList.add(cls);
    });
    icon.setAttribute('aria-hidden', 'true');
    li.appendChild(icon);

    const span = document.createElement('span');
    span.className = 'tile-label';
    span.textContent = label;
    li.appendChild(span);
  }

  return li;
}

/**
 * Decorate the carousel block.
 * @param {Element} block
 */
export default function decorate(block) {
  // Separate authored item rows (data-aue-component) from any prop rows
  const allRows = [...block.children];
  const itemRows = allRows.filter((r) => r.dataset.aueComponent);

  // If no UE-child rows, treat all rows as item rows
  // (gallery fixture may not have data-aue-component in static HTML)
  const sourceRows = itemRows.length > 0 ? itemRows : allRows;

  if (sourceRows.length === 0) return;

  // ── Build the carousel DOM structure ──────────────────────
  // wrapper (provides overflow-hidden + inset for arrows)
  const wrapper = document.createElement('div');
  wrapper.className = 'carrousel-wrapper';

  // ul.slider-wrapper — the scrollable track
  const ul = document.createElement('ul');
  ul.className = 'slider-wrapper';

  sourceRows.forEach((row) => {
    const li = buildTile(row);
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
  const totalItems = sourceRows.length;
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
      // Recalculate total pages as items-per-page may have changed
      const ipp = getItemsPerPage();
      const newTotalPages = Math.ceil(ul.querySelectorAll('li').length / ipp);

      // Rebuild paging dots if count changed
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

      // Clamp current page and re-apply transform
      const current = parseInt(block.dataset.currentPage || '0', 10);
      const safePage = Math.min(current, newTotalPages - 1);
      setPage(block, safePage, false);
    }, 100);
  });
}
