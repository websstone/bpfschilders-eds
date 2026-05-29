/**
 * carousel.js — BPF Schilders "Wat doe ik bij..." horizontal carousel block.
 *
 * UE-aware decorate() calls moveInstrumentation() so that data-aue-* attributes
 * on the source rows/cells survive into the final DOM. Without this, Universal
 * Editor sees no editable bindings post-decoration.
 */

import { moveInstrumentation } from '../../scripts/scripts.js';

/** Extract trimmed text from a cell element (first child div of a row). */
function cellText(cell) {
  return cell ? (cell.textContent || '').trim() : '';
}

/** Split a multi-line cell text into a non-empty-filtered array. */
function splitLines(cell) {
  return cellText(cell)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Build a single slide <li> element. */
function buildSlide(slideData, isFirst) {
  const {
    sourceRow, iconCell, labelEl, iconClass, label, href,
  } = slideData;
  const li = document.createElement('li');
  if (isFirst) li.classList.add('active');
  // Preserve UE row-level bindings (data-aue-resource, data-aue-model="carousel-slide").
  if (sourceRow) moveInstrumentation(sourceRow, li);

  const a = document.createElement('a');
  a.href = href;

  if (iconClass) {
    const i = document.createElement('i');
    i.className = `costumer-journey-icon icon-bpf icon-bpf-${iconClass}`;
    i.setAttribute('aria-hidden', 'true');
    // Preserve UE per-property binding for icon_class.
    if (iconCell) moveInstrumentation(iconCell, i);
    a.append(i);
  }

  const span = document.createElement('span');
  span.className = 'carousel-slide-label';
  span.textContent = label;
  // Preserve UE per-property binding for slide_label.
  if (labelEl) moveInstrumentation(labelEl, span);
  a.append(span);

  li.append(a);
  return li;
}

/**
 * Compute how many whole slides fit in the visible wrapper width.
 * Mirrors the CSS breakpoint at 1024px (visual-spec.yaml breakpoints).
 */
function getItemsPerPage(wrapperEl) {
  const w = wrapperEl.offsetWidth;
  // Based on visual-spec: 5–6 on desktop, 2–3 on mobile (<1024px).
  // Use floor(available / min-slide-width) to be precise; fall back to 2.
  if (w <= 0) return window.innerWidth >= 1024 ? 6 : 2;
  // Minimum slide width we'll accept (mirrors 180px source but scales).
  const MIN_SLIDE = 140;
  return Math.max(1, Math.floor(w / MIN_SLIDE));
}

/**
 * Calculate the pixel width each slide should occupy so that exactly
 * `itemsPerPage` slides fill the wrapper.
 */
function slideWidth(wrapperEl, itemsPerPage) {
  return wrapperEl.offsetWidth / itemsPerPage;
}

/** Apply slide widths to all <li> elements in the track. */
function sizeSlides(track, wrapperEl, itemsPerPage) {
  const w = slideWidth(wrapperEl, itemsPerPage);
  track.querySelectorAll(':scope > li').forEach((li) => {
    li.style.flex = `0 0 ${w}px`;
    li.style.width = `${w}px`;
  });
  return w;
}

/** Move the track to the given page index (0-based) using translate3d. */
function setPage(track, wrapperEl, pageDots, page, slideCount, animate) {
  const perPage = getItemsPerPage(wrapperEl);
  const maxPage = Math.ceil(slideCount / perPage) - 1;
  const safePage = Math.max(0, Math.min(page, maxPage));

  const w = sizeSlides(track, wrapperEl, perPage);
  const offset = -(safePage * perPage * w);

  track.style.transitionDuration = animate ? '500ms' : '0ms';
  track.style.transform = `translate3d(${offset}px, 0, 0)`;

  // Update first-slide active class (first visible slide on the page).
  const items = track.querySelectorAll(':scope > li');
  items.forEach((li, idx) => {
    li.classList.toggle('active', idx === safePage * perPage);
  });

  // Update paging dots.
  pageDots.forEach((dot, idx) => {
    dot.classList.toggle('active', idx === safePage);
    dot.setAttribute('aria-current', idx === safePage ? 'true' : 'false');
  });

  return safePage;
}

export default function decorate(block) {
  // ── 1. Read model rows ────────────────────────────────────────────────────
  const allRows = [...block.children];

  // Separate parent-model rows (block properties) from child-item rows (slides).
  // Child items have data-aue-model="carousel-slide" or data-aue-component attributes.
  const parentRows = [];
  const childRows = [];
  allRows.forEach((row) => {
    if (row.dataset.aueModel === 'carousel-slide' || row.dataset.aueComponent) {
      childRows.push(row);
    } else {
      parentRows.push(row);
    }
  });

  let headingText = '';
  let headingEl = null;
  let slides = [];

  if (childRows.length > 0) {
    // Container format: parent row has heading, each child row is a slide.
    // Capture the actual binding-bearing cell so its data-aue-prop="section_heading"
    // can survive into the rebuilt <h2>.
    headingEl = parentRows[0] ? (parentRows[0].children[0] || null) : null;
    headingText = cellText(headingEl);
    slides = childRows.map((row) => {
      const cells = [...row.children];
      const iconCell = cells[0] || null;
      const iconClass = cellText(iconCell);
      const labelCell = cells[1] || cells[0];
      // Capture the actual label-bearing <p> element so its data-aue-prop binding can survive.
      const labelEl = labelCell ? (labelCell.querySelector('p[data-aue-prop="slide_label"]') || labelCell.querySelector('p')) : null;
      const label = labelEl ? (labelEl.textContent || '').trim() : cellText(labelCell);
      const linkEl = labelCell ? labelCell.querySelector('a') : null;
      const href = linkEl ? linkEl.getAttribute('href') : '';
      return {
        sourceRow: row, iconCell, labelEl, label, iconClass, href,
      };
    }).filter((s) => s.href && s.label);
  } else if (parentRows.length >= 3) {
    // Multi-row flat format: row 0=heading, 1=icons, 2=labels, 3=links
    headingText = cellText(parentRows[0] ? parentRows[0].children[0] : null);
    const iconClasses = splitLines(parentRows[1] ? parentRows[1].children[0] : null);
    const labels = splitLines(parentRows[2] ? parentRows[2].children[0] : null);
    const hrefs = splitLines(parentRows[3] ? parentRows[3].children[0] : null);
    slides = labels.reduce((acc, label, idx) => {
      const href = hrefs[idx] || '';
      if (!href) return acc;
      acc.push({
        sourceRow: null, iconCell: null, labelEl: null, label, iconClass: iconClasses[idx] || '', href,
      });
      return acc;
    }, []);
  } else {
    // AEM EDS vertical format: all fields as siblings in one cell.
    const firstRow = parentRows[0];
    const cell0 = firstRow ? (firstRow.children[0] || firstRow) : null;
    if (cell0) {
      const children = [...cell0.children];
      headingText = children.length > 0 ? cellText(children[0]) : cellText(cell0);
      const iconClasses = splitLines(children[1] || null);
      const labels = splitLines(children[2] || null);
      const hrefs = splitLines(children[3] || null);
      slides = labels.reduce((acc, label, idx) => {
        const href = hrefs[idx] || '';
        if (!href) return acc;
        acc.push({
          sourceRow: null, iconCell: null, labelEl: null, label, iconClass: iconClasses[idx] || '', href,
        });
        return acc;
      }, []);
    }
  }

  if (slides.length === 0) return; // nothing to render

  // Compute paging groups (6 is the source dot count, dynamic based on slides).
  // We recompute when the wrapper is sized; stash as mutable within closure.
  let currentPage = 0;

  // ── 2. Build DOM ─────────────────────────────────────────────────────────
  block.innerHTML = '';

  // Section heading (optional).
  if (headingText) {
    const h2 = document.createElement('h2');
    h2.className = 'carousel-heading';
    h2.textContent = headingText;
    // Preserve UE per-property binding for section_heading.
    if (headingEl) moveInstrumentation(headingEl, h2);
    block.append(h2);
  }

  // Outer wrapper (provides overflow:hidden + padding inset for arrows).
  const wrapper = document.createElement('div');
  wrapper.className = 'carrousel-wrapper';

  // Slider track.
  const track = document.createElement('ul');
  track.className = 'slider-wrapper';

  slides.forEach((slideData, idx) => {
    track.append(buildSlide(slideData, idx === 0));
  });

  wrapper.append(track);

  // Prev button — appended to wrapper so position:absolute is relative to wrapper.
  const btnPrev = document.createElement('button');
  btnPrev.type = 'button';
  btnPrev.className = 'carrousel-button carrousel-button-previous';
  btnPrev.setAttribute('aria-label', 'Vorige');

  // Next button.
  const btnNext = document.createElement('button');
  btnNext.type = 'button';
  btnNext.className = 'carrousel-button carrousel-button-next';
  btnNext.setAttribute('aria-label', 'Volgende');

  wrapper.append(btnPrev, btnNext);
  block.append(wrapper);

  // Paging nav — dot count = ceil(slideCount / itemsPerPage), recalculated on resize.
  // Build an initial set; we'll rebuild if viewport changes drastically enough that
  // pageCount changes. For simplicity we build once with 6 dots (source reference)
  // and clamp navigation; dots are hidden beyond maxPage via CSS .active visibility.
  const pagingNav = document.createElement('nav');
  pagingNav.id = `carrousel-paging-nav-${crypto.randomUUID()}`;
  pagingNav.className = 'carrousel-paging';
  pagingNav.setAttribute('aria-label', 'Dianavigatie');

  // Initial dot count based on source (6 dots for 11 slides, 6 items visible ≈ 2 pages).
  // We'll dynamically manage how many dots are shown.
  const MAX_DOTS = 10; // upper bound; actual visible count depends on slides / perPage
  const dotEls = Array.from({ length: MAX_DOTS }, (_, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'carrousel-paging-button';
    btn.dataset.index = String(i);
    btn.setAttribute('aria-label', `Pagina ${i + 1}`);
    btn.textContent = String(i); // hidden via text-indent in CSS
    return btn;
  });
  dotEls.forEach((btn) => pagingNav.append(btn));
  block.append(pagingNav);

  // ── 3. Helpers that depend on live layout ────────────────────────────────
  let pageDots = [];

  function updateDotVisibility() {
    const perPage = getItemsPerPage(wrapper);
    const pageCount = Math.ceil(slides.length / perPage);
    dotEls.forEach((dot, i) => {
      dot.style.display = i < pageCount ? '' : 'none';
    });
    pageDots = dotEls.slice(0, pageCount);
    return pageCount;
  }

  function applyPage(page, animate) {
    const pageCount = updateDotVisibility();
    currentPage = setPage(track, wrapper, pageDots, page, slides.length, animate);
    // Clamp if pageCount shrank.
    if (currentPage >= pageCount) {
      currentPage = setPage(track, wrapper, pageDots, pageCount - 1, slides.length, false);
    }
  }

  // ── 4. Initial render (no animation) ────────────────────────────────────
  // CSS may not be parsed yet when decorate() runs; wait for the wrapper to
  // acquire a non-zero width before sizing slides.
  const ro = new ResizeObserver((entries) => {
    if (entries.some((entry) => entry.contentRect.width > 0)) {
      ro.disconnect();
      applyPage(0, false);
    }
  });
  ro.observe(wrapper);
  // Fallback: if ResizeObserver never fires (already laid out), kick once.
  requestAnimationFrame(() => {
    if (wrapper.offsetWidth > 0) {
      ro.disconnect();
      applyPage(0, false);
    }
  });

  // ── 5. Event listeners ───────────────────────────────────────────────────
  btnNext.addEventListener('click', () => {
    const perPage = getItemsPerPage(wrapper);
    const maxPage = Math.ceil(slides.length / perPage) - 1;
    if (currentPage < maxPage) {
      applyPage(currentPage + 1, true);
    }
  });

  btnPrev.addEventListener('click', () => {
    if (currentPage > 0) {
      applyPage(currentPage - 1, true);
    }
  });

  pagingNav.addEventListener('click', (e) => {
    const dot = e.target.closest('.carrousel-paging-button');
    if (!dot) return;
    e.preventDefault();
    const idx = parseInt(dot.dataset.index, 10);
    if (!Number.isNaN(idx)) {
      applyPage(idx, true);
    }
  });

  // Touch/swipe support (mobile).
  let touchStartX = 0;
  let touchStartY = 0;
  const SWIPE_THRESHOLD = 40;

  wrapper.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  wrapper.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
    const perPage = getItemsPerPage(wrapper);
    const maxPage = Math.ceil(slides.length / perPage) - 1;
    if (dx < 0 && currentPage < maxPage) {
      applyPage(currentPage + 1, true);
    } else if (dx > 0 && currentPage > 0) {
      applyPage(currentPage - 1, true);
    }
  }, { passive: true });

  // Resize handler — recalculate all transforms and dot visibility.
  window.addEventListener('resize', () => {
    applyPage(currentPage, false);
  });
}
