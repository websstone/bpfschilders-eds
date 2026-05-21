/**
 * life-event-carousel block — BPF Schilders life-event carousel
 * Fields (model order):
 *   0: sectionHeading
 *   1: itemLabel (newline-delimited)
 *   2: itemLinkUrl (newline-delimited)
 *   3: itemIconClass (newline-delimited BPFicons class names)
 */

function rowCell(row) { return row ? (row.children[0] || row) : null; }
function cellText(cell) { return cell ? (cell.textContent || '').trim() : ''; }
function splitLines(cell) {
  const text = cellText(cell);
  return text ? text.split('\n').map((s) => s.trim()).filter(Boolean) : [];
}

function getItemsPerPage(wrapperEl) {
  const w = wrapperEl.offsetWidth;
  if (w < 480) return 1;
  if (w < 768) return 2;
  if (w < 1024) return 4;
  return 5;
}

function sizeItems(wrapperEl, trackEl) {
  const ipp = getItemsPerPage(wrapperEl);
  const itemWidth = wrapperEl.offsetWidth / ipp;
  trackEl.querySelectorAll('.item-link').forEach((link) => {
    link.style.width = `${itemWidth}px`;
  });
  return itemWidth;
}

export default function decorate(block) {
  const rows = [...block.children];
  const propRows = rows.filter((r) => !r.dataset.aueComponent);

  const sectionHeading = cellText(rowCell(propRows[0])) || 'Wat doe ik bij...';
  const labels = splitLines(rowCell(propRows[1]));
  const hrefs = splitLines(rowCell(propRows[2]));
  const iconClasses = splitLines(rowCell(propRows[3]));

  // Section heading
  const heading = document.createElement('h2');
  heading.classList.add('section-heading');
  heading.textContent = sectionHeading;

  // Build carousel items
  const trackEl = document.createElement('ul');
  trackEl.classList.add('slider-track');

  labels.forEach((label, i) => {
    const li = document.createElement('li');
    li.classList.add('carousel-item');

    const link = document.createElement('a');
    link.classList.add('item-link');
    link.href = hrefs[i] || '#';
    link.setAttribute('aria-label', label);

    const iconEl = document.createElement('span');
    iconEl.classList.add('item-icon');
    if (iconClasses[i]) {
      iconEl.classList.add(iconClasses[i]);
      iconEl.setAttribute('aria-hidden', 'true');
    }

    const labelEl = document.createElement('span');
    labelEl.classList.add('item-label');
    labelEl.textContent = label;

    link.append(iconEl, labelEl);
    li.append(link);
    trackEl.append(li);
  });

  // Prev/next buttons
  const prevBtn = document.createElement('button');
  prevBtn.classList.add('slider-btn', 'btn-prev');
  prevBtn.setAttribute('aria-label', 'Vorige');
  prevBtn.innerHTML = '&#8249;'; // ‹

  const nextBtn = document.createElement('button');
  nextBtn.classList.add('slider-btn', 'btn-next');
  nextBtn.setAttribute('aria-label', 'Volgende');
  nextBtn.innerHTML = '&#8250;'; // ›

  const sliderOuter = document.createElement('div');
  sliderOuter.classList.add('slider-outer');
  sliderOuter.append(prevBtn, trackEl, nextBtn);

  // Pagination dots
  const pagingEl = document.createElement('div');
  pagingEl.classList.add('slider-paging');
  pagingEl.setAttribute('role', 'tablist');
  pagingEl.setAttribute('aria-label', 'Carousel navigatie');

  let currentPage = 0;

  function getTotalPages() {
    const ipp = getItemsPerPage(sliderOuter);
    return Math.ceil(labels.length / ipp);
  }

  function updateDots(page) {
    const totalPages = getTotalPages();
    // Rebuild dots if count changed
    if (pagingEl.children.length !== totalPages) {
      pagingEl.replaceChildren();
      for (let i = 0; i < totalPages; i++) {
        const dot = document.createElement('button');
        dot.classList.add('paging-dot');
        dot.setAttribute('role', 'tab');
        dot.setAttribute('aria-label', `Pagina ${i + 1}`);
        const idx = i;
        dot.addEventListener('click', () => { setPage(idx); });
        pagingEl.append(dot);
      }
    }
    [...pagingEl.children].forEach((dot, i) => {
      dot.classList.toggle('active', i === page);
      dot.setAttribute('aria-selected', i === page ? 'true' : 'false');
    });
    return Math.min(page, totalPages - 1);
  }

  function setPage(page, animate = true) {
    const totalPages = getTotalPages();
    currentPage = Math.max(0, Math.min(page, totalPages - 1));
    const ipp = getItemsPerPage(sliderOuter);
    const itemWidth = sizeItems(sliderOuter, trackEl);
    const translateX = -(currentPage * ipp * itemWidth);
    trackEl.style.transition = animate ? 'transform 0.3s ease' : 'none';
    trackEl.style.transform = `translateX(${translateX}px)`;
    updateDots(currentPage);
  }

  prevBtn.addEventListener('click', () => { setPage(currentPage - 1); });
  nextBtn.addEventListener('click', () => { setPage(currentPage + 1); });

  window.addEventListener('resize', () => {
    currentPage = updateDots(currentPage);
    setPage(currentPage, false);
  });

  block.replaceChildren(heading, sliderOuter, pagingEl);

  // Initialize after render
  requestAnimationFrame(() => {
    setPage(0, false);
    block.dataset.blockStatus = 'initialized';
  });
}
