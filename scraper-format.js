// Format tokens without parsing or executing the returned HTML. Preserve raw-text blocks.
export function formatHTML(source) {
  if (source.length > 512000) return source;
  const tokens = /<!--[\s\S]*?-->|<![^>]*>|<\/?[a-zA-Z][\w:-]*(?:\s+(?:[^>"']|"[^"]*"|'[^']*')*)?\s*\/?>/g;
  const voidTags = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
  const rawTags = new Set(['script','style','pre','textarea']);
  let depth = 0, last = 0, result = [];
  const line = text => { if (text.trim()) result.push('  '.repeat(Math.min(depth, 40)) + text.trim()); };
  for (let match; (match = tokens.exec(source));) {
    line(source.slice(last, match.index));
    const tag = match[0];
    const name = /^<\/?([\w:-]+)/.exec(tag)?.[1]?.toLowerCase();
    const closing = tag.startsWith('</');
    if (closing) depth = Math.max(0, depth - 1);
    if (name && rawTags.has(name) && !closing && !tag.endsWith('/>')) {
      const end = new RegExp('</' + name + '\\s*>', 'ig');
      end.lastIndex = tokens.lastIndex;
      const close = end.exec(source);
      if (close) {
        line(tag + source.slice(tokens.lastIndex, close.index) + close[0]);
        tokens.lastIndex = end.lastIndex; last = end.lastIndex; continue;
      }
    }
    line(tag);
    if (name && !closing && !voidTags.has(name) && !tag.endsWith('/>')) depth++;
    last = tokens.lastIndex;
  }
  line(source.slice(last));
  return result.join('\n');
}

export function renderHTML(element, source) {
  element.replaceChildren();
  // Large snapshots stay plain text to avoid creating thousands of DOM nodes.
  if (source.length > 512000) { element.textContent = source; return; }
  const pattern = /<!--[\s\S]*?-->|<\/?[a-zA-Z!][^>]*>/g;
  let last = 0;
  const fragment = document.createDocumentFragment();
  for (let match; (match = pattern.exec(source));) {
    fragment.append(document.createTextNode(source.slice(last, match.index)));
    const span = document.createElement('span');
    span.className = match[0].startsWith('<!--') ? 'comment' : 'tag';
    span.textContent = match[0];
    fragment.append(span); last = pattern.lastIndex;
  }
  fragment.append(document.createTextNode(source.slice(last)));
  element.append(fragment);
}
