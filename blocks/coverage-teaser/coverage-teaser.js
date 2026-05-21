/**
 * coverage-teaser block — BPF Schilders top-panel teaser
 * Source: horizontal bar, 2 equal panels side-by-side on light gray bg
 *   Left: icon (area-chart) + label + metric value, links to coverage page
 *   Right: icon (user) + INLOGGEN, links to login page
 *
 * Fields (model order):
 *   0: metricValue     (e.g. "140,7%")
 *   1: metricYearLabel (e.g. "Eindstand beleidsdekkingsgraad 2025")
 *   2: loginCtaLabel   (e.g. "INLOGGEN")
 */

function rowCell(row) { return row ? (row.children[0] || row) : null; }
function cellText(cell) { return cell ? (cell.textContent || '').trim().replace(/_{2,}/g, '').trim() : ''; }

export default function decorate(block) {
  const rows = [...block.children];
  const propRows = rows.filter((r) => !r.dataset.aueComponent);

  const metricValue = cellText(rowCell(propRows[0])) || '140,7%';
  const metricYearLabel = cellText(rowCell(propRows[1])) || 'Eindstand beleidsdekkingsgraad 2025';
  const loginCtaLabel = cellText(rowCell(propRows[2])) || 'INLOGGEN';

  // Left panel: metric link (icon-area-chart + label + bold metric)
  const leftLink = document.createElement('a');
  leftLink.href = '/over-ons/dit-presteren-we/dekkingsgraad/';
  leftLink.classList.add('panel-link', 'panel-left');
  leftLink.setAttribute('title', 'Dekkingsgraad');

  const leftIcon = document.createElement('span');
  leftIcon.classList.add('panel-icon', 'icon-area-chart');
  leftIcon.setAttribute('aria-hidden', 'true');

  const leftText = document.createElement('span');
  leftText.classList.add('panel-text');

  const leftLabel = document.createElement('span');
  leftLabel.classList.add('panel-label');
  leftLabel.textContent = metricYearLabel;

  const leftMetric = document.createElement('strong');
  leftMetric.classList.add('panel-metric');
  leftMetric.textContent = metricValue;

  leftText.append(leftLabel, leftMetric);
  leftLink.append(leftIcon, leftText);

  // Right panel: login link (icon-user + INLOGGEN + underline)
  const rightLink = document.createElement('a');
  rightLink.href = '/inloggen/';
  rightLink.classList.add('panel-link', 'panel-right');
  rightLink.setAttribute('title', 'Inloggen');

  const rightIcon = document.createElement('span');
  rightIcon.classList.add('panel-icon', 'icon-user');
  rightIcon.setAttribute('aria-hidden', 'true');

  const rightText = document.createElement('span');
  rightText.classList.add('panel-text');

  const rightLabel = document.createElement('span');
  rightLabel.classList.add('panel-login-label');
  rightLabel.textContent = loginCtaLabel;

  const rightUnderline = document.createElement('span');
  rightUnderline.classList.add('panel-underline');
  rightUnderline.setAttribute('aria-hidden', 'true');

  rightText.append(rightLabel, rightUnderline);
  rightLink.append(rightIcon, rightText);

  block.replaceChildren(leftLink, rightLink);
  block.dataset.blockStatus = 'initialized';
}
