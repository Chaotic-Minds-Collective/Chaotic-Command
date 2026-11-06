(function () {
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.nav-tab'));
  if (!tabs.length) return;
  function activate(name) {
    tabs.forEach(function (t) {
      var on = t.id === 'tab-' + name;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      var p = document.getElementById('panel-' + t.id.slice(4));
      if (p) p.hidden = !on;
    });
    window.scrollTo({ top: 0 });
  }
  tabs.forEach(function (t, index) {
    t.addEventListener('click', function () { activate(t.id.slice(4)); });
    t.addEventListener('keydown', function (event) {
      var next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      activate(tabs[next].id.slice(4));
      tabs[next].focus();
    });
  });
  document.querySelectorAll('.tab-jump').forEach(function (b) {
    b.addEventListener('click', function () {
      var name = b.getAttribute('data-target');
      activate(name);
      document.getElementById('tab-' + name).focus();
    });
  });
  var y = document.getElementById('year'); if (y) y.textContent = new Date().getFullYear();
})();
