(function () {
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.nav-tab'));
  if (!tabs.length) return;
  function activate(name) {
    tabs.forEach(function (t) {
      var on = t.id === 'tab-' + name;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      var p = document.getElementById('panel-' + t.id.slice(4));
      if (p) p.hidden = !on;
    });
    window.scrollTo({ top: 0 });
  }
  tabs.forEach(function (t) { t.addEventListener('click', function () { activate(t.id.slice(4)); }); });
  document.querySelectorAll('.tab-jump').forEach(function (b) {
    b.addEventListener('click', function () { activate(b.getAttribute('data-target')); });
  });
  var y = document.getElementById('year'); if (y) y.textContent = new Date().getFullYear();
})();
