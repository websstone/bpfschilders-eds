/**
 * Accordion Item block — standalone accordion item for EDS / Universal Editor.
 *
 * Handles individual accordion-item blocks that are placed directly in a section
 * (not as children of an accordion container). Each block becomes a self-contained
 * expandable panel with title/body toggle.
 *
 * Content model (from component-models.json "accordion-item"):
 *   item_title — richtext (accordion trigger label)
 *   item_body  — richtext (expandable panel content)
 *
 * The decorator transforms the block into the same accordion-item structure
 * used by the parent accordion block, so it shares the accordion CSS.
 */

/**
 * @param {Element} block
 */
export default function decorate(block) {
  const rows = [...block.children];
  const blockId = `accordion-item-${Math.random().toString(36).slice(2, 8)}`;

  // Extract title and body from the block's row structure
  let titleText = '';
  let bodyHTML = '';

  if (rows.length >= 2) {
    // Two-row model: row[0] = title, row[1] = body
    titleText = (rows[0].textContent || '').trim();
    bodyHTML = rows[1].innerHTML;
  } else if (rows.length === 1) {
    const cells = [...rows[0].children];
    if (cells.length >= 2) {
      titleText = (cells[0].textContent || '').trim();
      bodyHTML = cells[1].innerHTML;
    } else {
      // Single cell: first <p> is title, rest is body
      const cell = cells[0] || rows[0];
      const headings = cell.querySelectorAll('h1, h2, h3, h4, h5, h6');
      if (headings.length > 0) {
        titleText = headings[0].textContent.trim();
        const bodyContainer = document.createElement('div');
        let pastHeading = false;
        [...cell.childNodes].forEach((node) => {
          if (!pastHeading && node === headings[0]) {
            pastHeading = true;
            return;
          }
          if (pastHeading) {
            bodyContainer.appendChild(node.cloneNode(true));
          }
        });
        bodyHTML = bodyContainer.innerHTML;
      } else {
        const paragraphs = cell.querySelectorAll(':scope > p');
        if (paragraphs.length >= 2) {
          titleText = paragraphs[0].textContent.trim();
          const bodyContainer = document.createElement('div');
          let pastFirst = false;
          [...cell.childNodes].forEach((node) => {
            if (!pastFirst && node === paragraphs[0]) {
              pastFirst = true;
              return;
            }
            if (pastFirst) bodyContainer.appendChild(node.cloneNode(true));
          });
          bodyHTML = bodyContainer.innerHTML;
        } else {
          titleText = cell.textContent.trim();
        }
      }
    }
  }

  // Build trigger button
  const btnId = `${blockId}-btn`;
  const panelId = `${blockId}-panel`;

  const trigger = document.createElement('button');
  trigger.className = 'accordion-trigger';
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', panelId);
  trigger.id = btnId;
  trigger.type = 'button';

  const label = document.createElement('span');
  label.className = 'accordion-trigger-label';
  label.textContent = titleText;

  const icon = document.createElement('span');
  icon.className = 'accordion-icon';
  icon.setAttribute('aria-hidden', 'true');

  trigger.append(label, icon);

  // Build panel
  const panel = document.createElement('div');
  panel.className = 'accordion-panel';
  panel.id = panelId;
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-labelledby', btnId);
  panel.hidden = true;

  if (bodyHTML) {
    panel.innerHTML = bodyHTML;
    panel.querySelectorAll('p').forEach((p) => {
      if (!p.textContent.trim() && !p.querySelector('img, a, br')) {
        p.style.display = 'none';
      }
    });
  }

  // Build item wrapper
  const item = document.createElement('div');
  item.className = 'accordion-item';

  // Transfer UE instrumentation attributes
  [...block.attributes].forEach((attr) => {
    if (attr.name.startsWith('data-aue-') || attr.name.startsWith('data-richtext-')) {
      item.setAttribute(attr.name, attr.value);
    }
  });

  item.append(trigger, panel);

  // Toggle
  trigger.addEventListener('click', () => {
    const isOpen = trigger.getAttribute('aria-expanded') === 'true';
    trigger.setAttribute('aria-expanded', String(!isOpen));
    panel.hidden = isOpen;
  });

  // Add accordion class to the block wrapper for shared styling
  block.classList.add('accordion');
  block.replaceChildren(item);
}
