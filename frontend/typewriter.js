/* Types "What brings you here today?" word by word each time the choose screen opens. */
(function () {
  const choose = document.getElementById('choose');
  const ask = choose.querySelector('.ask');
  const textNode = [...ask.childNodes].find(n => n.nodeType === 3 && n.nodeValue.trim());
  if (!textNode) return;

  // split the sentence into word spans (the <small> line is left alone)
  const words = textNode.nodeValue.trim().split(/\s+/).map(t => {
    const s = document.createElement('span'); s.className = 'w'; s.textContent = t; return s;
  });
  const frag = document.createDocumentFragment();
  words.forEach((s, i) => { if (i) frag.appendChild(document.createTextNode(' ')); frag.appendChild(s); });
  ask.replaceChild(frag, textNode);
  ask.classList.add('tw');

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let timers = [];
  const clear = () => { timers.forEach(clearTimeout); timers = []; };

  function reset() {
    clear(); ask.classList.remove('done');
    words.forEach(w => w.classList.remove('on', 'cur'));
  }
  function type() {
    reset();
    if (reduce) { words.forEach(w => w.classList.add('on')); ask.classList.add('done'); return; }
    words.forEach((w, i) => timers.push(setTimeout(() => {
      words.forEach(x => x.classList.remove('cur'));
      w.classList.add('on', 'cur');
    }, 350 + i * 330)));
    timers.push(setTimeout(() => ask.classList.add('done'), 350 + words.length * 330));
    timers.push(setTimeout(() => words.forEach(x => x.classList.remove('cur')), 350 + words.length * 330 + 1600));
  }

  new MutationObserver(() => choose.classList.contains('show') ? type() : reset())
    .observe(choose, { attributes: true, attributeFilter: ['class'] });
})();
