/**
 * Sidebar block — consolidates Aside, ContactHoursAside, ContactInfoSidebar.
 *
 * AEM content model (fields per authored row, all optional):
 *   col[0] section_heading — if non-empty, starts a new contact group
 *   col[1] icon_type       — CSS class suffix (phone | envelope | facebook | …)
 *   col[2] item_label      — visible link text
 *   col[3] item_href       — href value (tel:…, relative path, https://…)
 *   col[4] opening_hours   — plain text with optional \n line breaks
 *   col[5] image           — <picture>/<img> element for decorative image
 *
 * A row is a "heading row" when col[0] is non-empty AND col[1] is empty.
 * A row is a "contact item row" when col[1] or col[2] is non-empty.
 * A row is an "hours row" when col[4] is non-empty.
 * A row is an "image row" when col[5] contains an <img> or <picture>.
 *
 * No module-scope state. All state is local to decorate().
 */

function cellText(cell) {
  return cell ? cell.textContent.trim() : '';
}

function buildContactItem(iconType, label, href) {
  const li = document.createElement('li');
  const a = document.createElement('a');

  // Determine link attributes
  const isExternal = href && (href.startsWith('https://') || href.startsWith('http://'));
  a.href = href || '';
  a.textContent = label;
  if (iconType) {
    a.classList.add(`icon-${iconType}`);
  }
  if (isExternal) {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }

  li.appendChild(a);
  return li;
}

function buildGroup(heading, items) {
  const fragment = document.createDocumentFragment();

  if (heading) {
    const span = document.createElement('span');
    span.className = 'contact-title';
    span.textContent = heading;
    fragment.appendChild(span);
  }

  if (items.length > 0) {
    const ul = document.createElement('ul');
    ul.className = 'contact';
    items.forEach(({ iconType, label, href }) => {
      ul.appendChild(buildContactItem(iconType, label, href));
    });
    fragment.appendChild(ul);
  }

  return fragment;
}

function buildHoursParagraph(text) {
  const p = document.createElement('p');
  p.className = 'contacts-add';
  // Replace \n with <br>
  const lines = text.split('\n');
  lines.forEach((line, idx) => {
    p.appendChild(document.createTextNode(line));
    if (idx < lines.length - 1) {
      p.appendChild(document.createElement('br'));
    }
  });
  return p;
}

function buildImageWrapper(imgEl) {
  const wrapper = document.createElement('div');
  wrapper.className = 'aside-image';
  const figure = document.createElement('figure');
  // Decorative — force empty alt
  const img = imgEl.tagName === 'IMG' ? imgEl : imgEl.querySelector('img');
  if (img) {
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    figure.appendChild(img);
  } else {
    // picture element — move it
    figure.appendChild(imgEl);
    const inner = figure.querySelector('img');
    if (inner) {
      inner.alt = '';
      inner.setAttribute('aria-hidden', 'true');
    }
  }
  wrapper.appendChild(figure);
  return wrapper;
}

/**
 * Loads and decorates the sidebar block.
 * @param {Element} block
 */
export default function decorate(block) {
  const rows = [...block.children];

  // Parse rows into typed entries
  const groups = []; // { heading: string, items: [{iconType, label, href}] }
  let currentGroup = null;
  let hoursText = '';
  let imageEl = null;

  rows.forEach((row) => {
    const cells = [...row.children];
    const heading = cellText(cells[0]);
    const iconType = cellText(cells[1]);
    const label = cellText(cells[2]);
    const href = cellText(cells[3]);
    const hours = cellText(cells[4]);
    const imgCell = cells[5];

    // Heading row — starts a new group
    if (heading && !iconType && !label) {
      currentGroup = { heading, items: [] };
      groups.push(currentGroup);
      return;
    }

    // Contact item row
    if (iconType || label) {
      if (!currentGroup) {
        // Items with no preceding heading — create an anonymous group
        currentGroup = { heading: '', items: [] };
        groups.push(currentGroup);
      }
      currentGroup.items.push({ iconType, label, href });
      return;
    }

    // Opening hours row
    if (hours) {
      hoursText = hours;
      return;
    }

    // Image row
    if (imgCell) {
      const img = imgCell.querySelector('img, picture');
      if (img) {
        imageEl = img;
      }
    }
  });

  // Build the new DOM
  const inner = document.createDocumentFragment();

  groups.forEach((group, idx) => {
    inner.appendChild(buildGroup(group.heading, group.items));
    // Spacer between groups (matches source <br> between groups)
    if (idx < groups.length - 1) {
      inner.appendChild(document.createElement('br'));
    }
  });

  if (hoursText) {
    inner.appendChild(buildHoursParagraph(hoursText));
  }

  if (imageEl) {
    inner.appendChild(buildImageWrapper(imageEl));
  }

  block.replaceChildren(inner);
}
