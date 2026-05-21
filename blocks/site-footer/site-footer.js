/**
 * site-footer block — BPF Schilders legal footer
 * Source: white background, centered copyright + pipe-separated nav links
 * Fields (model order):
 *   0: navLinks (newline-delimited link labels)
 *   1: navLinkUrls (newline-delimited link hrefs — "null" for button-only)
 *   2: copyrightText
 */

function rowCell(row) { return row ? (row.children[0] || row) : null; }
function cellText(cell) { return cell ? (cell.textContent || '').trim() : ''; }
function splitLines(cell) {
  const text = cellText(cell);
  return text ? text.split('\n').map((s) => s.trim()).filter(Boolean) : [];
}

export default function decorate(block) {
  const rows = [...block.children];
  const propRows = rows.filter((r) => !r.dataset.aueComponent);

  const navLabels = splitLines(rowCell(propRows[0]));
  const navHrefs = splitLines(rowCell(propRows[1]));
  const copyrightText = cellText(rowCell(propRows[2])) || 'Copyright © BPF Schilders';

  // Copyright paragraph
  const copyrightEl = document.createElement('p');
  copyrightEl.classList.add('footer-copyright');
  copyrightEl.textContent = copyrightText;

  // Nav list with pipe separators
  const navEl = document.createElement('nav');
  navEl.classList.add('footer-nav');
  navEl.setAttribute('aria-label', 'Footer navigation');

  const navUl = document.createElement('ul');
  navLabels.forEach((label, i) => {
    const li = document.createElement('li');
    const href = navHrefs[i];

    if (href && href !== 'null') {
      const a = document.createElement('a');
      a.href = href;
      a.textContent = label;
      li.append(a);
    } else {
      const btn = document.createElement('button');
      btn.classList.add('footer-nav-btn');
      btn.type = 'button';
      btn.textContent = label;
      li.append(btn);
    }
    navUl.append(li);
  });
  navEl.append(navUl);

  block.replaceChildren(copyrightEl, navEl);
  block.dataset.blockStatus = 'initialized';
}
