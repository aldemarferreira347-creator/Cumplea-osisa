export function splitChars(element, mode = 'chars') {
  const text = element.textContent || '';
  element.textContent = '';

  if (mode === 'words') {
    const words = text.split(/(\s+)/);
    const spans = [];
    for (const part of words) {
      if (/^\s+$/.test(part)) {
        element.appendChild(document.createTextNode(part));
      } else if (part.length > 0) {
        const span = document.createElement('span');
        span.className = 'split-unit';
        span.textContent = part;
        element.appendChild(span);
        spans.push(span);
      }
    }
    return spans;
  }

  // mode === 'chars'
  const spans = [];
  for (const char of text) {
    if (char === ' ') {
      element.appendChild(document.createTextNode(' '));
    } else {
      const span = document.createElement('span');
      span.className = 'split-unit';
      span.textContent = char;
      element.appendChild(span);
      spans.push(span);
    }
  }
  return spans;
}
