/* 作品库筛选与搜索：纯前端，无外部依赖。
   卡片上的 data-* 由构建脚本写入，这里只负责显隐与计数。 */
(function () {
  var root = document.getElementById('works');
  if (!root) return;

  var cards = Array.prototype.slice.call(root.querySelectorAll('.work'));
  var chips = Array.prototype.slice.call(document.querySelectorAll('.chip[data-filter]'));
  var search = document.getElementById('q');
  var count = document.getElementById('count');
  var empty = document.getElementById('empty');
  var state = { cat: 'all', form: 'all' };
  var q = '';

  function norm(s) {
    return (s || '').toLowerCase().replace(/\s+/g, '');
  }

  function match(card) {
    if (state.cat !== 'all' && card.dataset.cat !== state.cat) return false;
    if (state.form !== 'all' && card.dataset.form !== state.form) return false;
    if (q && norm(card.dataset.search).indexOf(q) === -1) return false;
    return true;
  }

  function apply() {
    var n = 0;
    cards.forEach(function (c) {
      var ok = match(c);
      c.style.display = ok ? '' : 'none';
      if (ok) n++;
    });
    if (count) count.textContent = n;
    if (empty) empty.style.display = n ? 'none' : '';
  }

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var kind = chip.dataset.kind;
      state[kind] = chip.dataset.filter;
      chips.forEach(function (c) {
        if (c.dataset.kind === kind) c.classList.toggle('on', c === chip);
      });
      apply();
    });
  });

  if (search) {
    search.addEventListener('input', function () {
      q = norm(search.value);
      apply();
    });
  }

  apply();
})();
