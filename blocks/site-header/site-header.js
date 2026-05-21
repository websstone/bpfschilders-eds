/**
 * site-header block — BPF Schilders sticky two-bar header
 * AEM EDS block rendering contract: one row per model field (vertical format)
 * Fields (in model order):
 *   0: brandLink
 *   1: brandLabel
 *   2: primaryNavItems (newline-delimited) → top auxiliary bar (Werknemer, Ondernemer, etc.)
 *   3: secondaryNavItems (newline-delimited) → main nav bar (Het pensioen, Wat doe ik bij..., etc.)
 *   4: searchInputName
 *   5: searchPlaceholder
 *   6: searchSubmitLabel
 *   7: searchActionUrl
 */

function rowCell(row) { return row ? (row.children[0] || row) : null; }
function cellText(cell) { return cell ? (cell.textContent || '').trim() : ''; }
function cellHref(cell) {
  if (!cell) return '/';
  const a = cell.querySelector('a');
  return a ? (a.getAttribute('href') || a.textContent.trim() || '/') : cell.textContent.trim() || '/';
}
function splitLines(cell) {
  const text = cellText(cell);
  return text ? text.split('\n').map((s) => s.trim()).filter(Boolean) : [];
}

export default function decorate(block) {
  const rows = [...block.children];
  const propRows = rows.filter((r) => !r.dataset.aueComponent);

  const brandLink = cellHref(rowCell(propRows[0])) || '/';
  const brandLabel = cellText(rowCell(propRows[1])) || 'BPF Schilders';
  const primaryNavItems = splitLines(rowCell(propRows[2])); // → top bar
  const secondaryNavItems = splitLines(rowCell(propRows[3])); // → main bar
  const searchInputName = cellText(rowCell(propRows[4])) || 'q';
  const searchPlaceholder = cellText(rowCell(propRows[5])) || 'Zoeken...';
  const searchSubmitLabel = cellText(rowCell(propRows[6])) || 'Zoeken';
  const searchActionUrl = cellHref(rowCell(propRows[7])) || '/zoeken';

  // ── Top auxiliary navigation bar (primaryNavItems) ──
  const topNavUl = document.createElement('ul');
  primaryNavItems.forEach((label, i) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = '#';
    a.textContent = label;
    a.setAttribute('aria-label', label);
    if (i === 0) a.classList.add('active'); // Werknemer = active
    li.append(a);
    topNavUl.append(li);
  });

  const topNav = document.createElement('nav');
  topNav.classList.add('top-nav');
  topNav.setAttribute('aria-label', 'Auxiliary navigation');
  topNav.append(topNavUl);

  // ── Main navigation bar ──
  const logoLink = document.createElement('a');
  logoLink.href = brandLink;
  logoLink.classList.add('logo-link');
  logoLink.setAttribute('aria-label', brandLabel || 'BPF Schilders - Home');
  logoLink.textContent = brandLabel || 'BPF Schilders';

  const navList = document.createElement('ul');
  navList.classList.add('nav-list');

  // Use secondary nav items for the main nav bar (these are the "Het pensioen", "Wat doe ik bij..." items)
  const mainNavItems = secondaryNavItems.length > 0 ? secondaryNavItems : primaryNavItems;
  mainNavItems.forEach((label, i) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = '#';
    a.textContent = label;
    if (i === 0) a.classList.add('active');
    li.append(a);
    navList.append(li);
  });

  // Search form
  const searchForm = document.createElement('form');
  searchForm.classList.add('search-form');
  searchForm.setAttribute('action', (searchActionUrl && searchActionUrl !== '#') ? searchActionUrl : '/zoeken');
  searchForm.setAttribute('method', 'get');
  searchForm.setAttribute('role', 'search');

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.name = searchInputName;
  searchInput.placeholder = searchPlaceholder;
  searchInput.classList.add('search-input');
  searchInput.setAttribute('aria-label', searchPlaceholder || 'Zoeken');

  const searchBtn = document.createElement('button');
  searchBtn.type = 'submit';
  searchBtn.classList.add('search-submit');
  searchBtn.textContent = searchSubmitLabel || 'Zoeken';

  searchForm.append(searchInput, searchBtn);

  const mainNav = document.createElement('nav');
  mainNav.classList.add('main-nav');
  mainNav.setAttribute('aria-label', 'Primary navigation');
  mainNav.append(logoLink, navList, searchForm);

  // Replace block content
  block.replaceChildren(topNav, mainNav);
  block.dataset.blockStatus = 'initialized';
}
