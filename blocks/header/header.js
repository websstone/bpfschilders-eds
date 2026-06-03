import { moveInstrumentation } from '../../scripts/scripts.js';

// ─── field helpers ─────────────────────────────────────────────────────────
function rowCell(row) {
  return row ? (row.children[0] || row) : null;
}

function cellText(cell) {
  return cell ? (cell.textContent || '').trim() : '';
}

function splitLines(cell) {
  return cellText(cell)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

// ─── mobile toggle (nav only) ──────────────────────────────────────────────
function setupMobileToggle(toggleBtn, targetEl) {
  toggleBtn.addEventListener('click', () => {
    const expanded = targetEl.classList.toggle('is-open');
    toggleBtn.setAttribute('aria-expanded', String(expanded));
  });
}

// ─── active top-nav detection ───────────────────────────────────────────────
function getActiveIndex(items) {
  const path = window.location.pathname;
  // Try to match current path segment to item text (lowercase slug)
  for (let i = 0; i < items.length; i += 1) {
    const slug = items[i].toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (slug && path.includes(`/${slug}`)) return i;
  }
  return 0; // default first item active (Werknemer)
}

// ─── parse nav cell with nested ul support ──────────────────────────────────
function parseNavCell(cell) {
  if (!cell) return [];
  const links = [...cell.querySelectorAll('a')];
  if (links.length) {
    return links.map((a) => ({
      href: a.getAttribute('href') || '',
      text: a.textContent.trim(),
      el: a,
      hasChildren: !!a.closest('li')?.querySelector('ul'),
    }));
  }
  return splitLines(cell).map((t) => ({
    href: '', text: t, el: null, hasChildren: false,
  }));
}

// ─── decorate ───────────────────────────────────────────────────────────────
export default function decorate(block) {
  // 1. Capture source rows for UE instrumentation before DOM rebuild
  const sourceRows = [...block.children];
  const rowLogoHref = sourceRows[0];
  const rowLogoAlt = sourceRows[1];
  const rowPrimaryMenu = sourceRows[2];
  const rowSecondaryMenu = sourceRows[3];
  const rowSearchPlaceholder = sourceRows[4];
  const rowLoginUrl = sourceRows[5];

  // 2. Extract field values
  const logoHref = cellText(rowCell(rowLogoHref)) || '/';
  const logoAlt = cellText(rowCell(rowLogoAlt)) || 'BPF Schilders';

  // Primary menu: try links first, fall back to plain text lines
  let primaryItems = parseNavCell(rowCell(rowPrimaryMenu));
  if (!primaryItems.length) {
    primaryItems = [
      {
        href: '/werknemer/', text: 'Werknemer', el: null, hasChildren: false,
      },
      {
        href: '/ondernemer/', text: 'Ondernemer', el: null, hasChildren: false,
      },
      {
        href: '/werkgever/', text: 'Werkgever', el: null, hasChildren: false,
      },
      {
        href: '/over-ons/', text: 'Over ons', el: null, hasChildren: false,
      },
      {
        href: '/klacht/', text: 'Klacht', el: null, hasChildren: false,
      },
      {
        href: '/translate/', text: 'Translate', el: null, hasChildren: false,
      },
      {
        href: '/contact/', text: 'Contact', el: null, hasChildren: false,
      },
    ];
  }

  // Secondary menu: try links first, fall back to text lines
  let secondaryItems = parseNavCell(rowCell(rowSecondaryMenu));
  if (!secondaryItems.length) {
    secondaryItems = [
      {
        href: '/', text: 'Home', el: null, hasChildren: false,
      },
      {
        href: '/het-pensioen/', text: 'Het pensioen', el: null, hasChildren: false,
      },
      {
        href: '/wat-doe-ik-bij/', text: 'Wat doe ik bij...', el: null, hasChildren: false,
      },
      {
        href: '/u-bent-met-pensioen/', text: 'U bent met pensioen', el: null, hasChildren: false,
      },
      {
        href: '/actueel/', text: 'Actueel', el: null, hasChildren: false,
      },
      {
        href: '/contact/', text: 'Contact', el: null, hasChildren: false,
      },
    ];
  }

  const searchPlaceholder = cellText(rowCell(rowSearchPlaceholder)) || 'Heeft u een vraag?';
  const loginUrl = cellText(rowCell(rowLoginUrl)) || '/pensioenadministratie/inloggen/#!/login/redirect?';

  // 3. Build the header DOM
  const headerEl = document.createElement('header');
  headerEl.className = 'main-header';

  const container = document.createElement('div');
  container.className = 'container';

  // Logo
  const logoA = document.createElement('a');
  logoA.className = 'logo';
  logoA.href = logoHref;
  logoA.title = logoAlt;
  moveInstrumentation(rowLogoHref || block, logoA);

  // ── Search box — always visible on mobile (inline), also on desktop ──
  // RT-header-002: search field is always visible; no toggle needed for it
  const searchbox = document.createElement('div');
  searchbox.id = 'searchbox';
  searchbox.className = 'searchbox';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.name = 'k';
  searchInput.placeholder = searchPlaceholder;
  searchInput.maxLength = 100;
  searchInput.setAttribute('aria-label', searchPlaceholder);

  const searchBtn = document.createElement('button');
  searchBtn.type = 'button';
  searchBtn.className = 'search-btn';
  searchBtn.setAttribute('aria-label', 'Zoeken');
  searchBtn.addEventListener('click', () => {
    const q = searchInput.value.trim();
    if (q) window.location.href = `/zoeken?q=${encodeURIComponent(q)}`;
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchBtn.click();
  });

  searchbox.appendChild(searchInput);
  searchbox.appendChild(searchBtn);

  // Header navigation wrapper
  const headerNav = document.createElement('div');
  headerNav.id = 'header-navigation';
  headerNav.className = 'header-navigation';

  // ── Top navigation (audience switcher) ──
  const topNav = document.createElement('nav');
  topNav.className = 'top-navigation';
  topNav.setAttribute('role', 'navigation');
  topNav.setAttribute('aria-label', 'Doelgroep navigatie');

  const topUl = document.createElement('ul');
  const activeIdx = getActiveIndex(primaryItems.map((i) => i.text));

  primaryItems.forEach((item, idx) => {
    const li = document.createElement('li');
    if (idx === activeIdx) li.classList.add('active');
    if (item.hasChildren) li.classList.add('has-children');

    if (item.href && item.href !== '#') {
      const a = document.createElement('a');
      a.href = item.href;
      a.textContent = item.text;
      if (item.el) moveInstrumentation(item.el, a);
      li.appendChild(a);
    } else {
      const span = document.createElement('span');
      span.textContent = item.text;
      li.appendChild(span);
    }
    topUl.appendChild(li);
  });

  // Login state web component
  const loginState = document.createElement('p-login-state');
  loginState.className = 'login-state';
  loginState.setAttribute('login-url', loginUrl);
  loginState.setAttribute('dashboard-title', 'Uw pensioenadministratie');
  loginState.setAttribute('logout-url', 'https://www.bpfschilders.nl/');
  loginState.setAttribute('logged-in', 'false');
  if (rowLoginUrl) moveInstrumentation(rowLoginUrl, loginState);

  topNav.appendChild(topUl);
  topNav.appendChild(loginState);

  // ── Main navigation (primary category links) ──
  const mainNav = document.createElement('nav');
  mainNav.className = 'main-navigation';
  mainNav.setAttribute('role', 'navigation');
  mainNav.setAttribute('aria-label', 'Hoofdnavigatie');

  const mainUl = document.createElement('ul');

  // First item is the home icon link
  secondaryItems.forEach((item, idx) => {
    const li = document.createElement('li');
    if (idx === 0) {
      li.classList.add('home');
    }
    // RT-header-003: mark items with nested sub-lists
    if (item.hasChildren) li.classList.add('has-children');

    if (item.href && item.href !== '#') {
      const a = document.createElement('a');
      a.href = item.href;
      a.textContent = idx === 0 ? '' : item.text;
      if (idx === 0) a.setAttribute('aria-label', 'Home');
      if (item.el) moveInstrumentation(item.el, a);
      li.appendChild(a);
    } else {
      const span = document.createElement('span');
      span.textContent = idx === 0 ? '' : item.text;
      li.appendChild(span);
    }
    mainUl.appendChild(li);
  });

  mainNav.appendChild(mainUl);

  headerNav.appendChild(topNav);
  headerNav.appendChild(mainNav);

  // ── Mobile nav toggle button (hamburger) — nav only, no search toggle ──
  const navToggleBtn = document.createElement('button');
  navToggleBtn.id = 'pageNavToggleButton';
  navToggleBtn.className = 'pagenav-toggle-button';
  navToggleBtn.type = 'button';
  navToggleBtn.title = 'Menu';
  navToggleBtn.setAttribute('aria-label', 'Menu');
  navToggleBtn.setAttribute('aria-expanded', 'false');
  navToggleBtn.setAttribute('aria-controls', 'header-navigation');

  // 4. Assemble: logo | searchbox | nav-toggle (mobile) / full nav (desktop)
  // Mobile layout: [logo] [searchbox] [hamburger]
  // Desktop layout: [logo] [header-navigation (top-nav + main-nav + searchbox)]
  container.appendChild(logoA);
  container.appendChild(searchbox);
  container.appendChild(headerNav);
  container.appendChild(navToggleBtn);
  headerEl.appendChild(container);

  // Transfer block-level UE instrumentation to headerEl
  moveInstrumentation(block, headerEl);

  // Decorate in place — keep block element in DOM so the EDS harness can
  // read block.dataset after decorate() returns. Never call block.replaceWith().
  block.textContent = '';
  block.append(headerEl);

  // 5. Mobile nav toggle interaction
  setupMobileToggle(navToggleBtn, headerNav);

  // Close nav when clicking outside on mobile
  document.addEventListener('click', (e) => {
    if (!block.contains(e.target)) {
      headerNav.classList.remove('is-open');
      navToggleBtn.setAttribute('aria-expanded', 'false');
    }
  });
}
