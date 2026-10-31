/* click START -> hands touch (0.45s) -> white screen floods (0.5s) -> plane + buttons */
(function () {
  const choose = document.getElementById('choose');
  const btn = document.getElementById('startBtn');
  const figures = document.getElementById('figures');
  const flash = document.getElementById('flash');

  btn.addEventListener('click', () => {
    btn.disabled = true;

    // white screen grows out of the button's position
    const r = btn.getBoundingClientRect();
    flash.style.setProperty('--x', (r.left + r.width / 2) + 'px');
    flash.style.setProperty('--y', (r.top + r.height / 2) + 'px');

    // 1) both figures slide to each other's hand
    figures.classList.add('touch');

    // 2) once they touch, the white screen expands to fill the page
    setTimeout(() => flash.classList.add('go'), 450);

    // 3) screen is fully white -> plane flies in, Learner / Tutor buttons appear
    flash.addEventListener('transitionend', function done(e) {
      if (e.propertyName !== 'clip-path' || !flash.classList.contains('go')) return;
      flash.removeEventListener('transitionend', done);
      // white screen is full -> show the question, flying plane and the two buttons
      document.getElementById('choose').classList.add('show');
      document.body.style.overflow = 'hidden';
    });
  });

  // header "Register" opens the same Learner / Tutor choice
  document.getElementById('registerBtn').addEventListener('click', e => {
    e.preventDefault();
    window.scrollTo(0, 0);
    if (!btn.disabled) btn.click(); else choose.classList.add('show');
  });
  // "Back" returns to the landing screen
  document.getElementById('backBtn').addEventListener('click', () => {
    choose.classList.remove('show'); flash.classList.remove('go');
    figures.classList.remove('touch'); btn.disabled = false;
    document.body.style.overflow = '';
    window.scrollTo(0, 0);
  });
})();
