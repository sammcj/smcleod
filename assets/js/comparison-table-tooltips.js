// Comparison table tooltips: one popover per table showing a cell's data-tooltip, with its URLs as links.
// - Mouse: hover a cell, then move into the tooltip to use a link.
// - Touch and pen: tap a cell to show it. A link cell shows its tooltip on the first tap and follows the link on
//   the second. Tapping elsewhere or scrolling closes it.
// - Keyboard: cells with tooltips are focusable; Escape closes.
// The deskbar shell re-runs content scripts each time the page enters a window, so this is an IIFE (no global
// bindings to collide) and binds each table once, marked with an expando that the shell's cloned copies lack.
(function () {
  var URL_RE = /https?:\/\/[^\s<>"']+/g;
  var TRAILING = /[.,;:!?)\]]+$/;

  function fill(tip, text) {
    var last = 0;
    tip.replaceChildren();
    text.replace(URL_RE, function (match, at) {
      var url = match.replace(TRAILING, '');
      var a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = url;
      tip.append(text.slice(last, at), a);
      last = at + url.length;
      return match;
    });
    tip.append(text.slice(last));
  }

  function bind(wrap) {
    if (wrap.__ctTips) return;
    wrap.__ctTips = true;

    var tip = document.createElement('div');
    var popover = typeof tip.showPopover === 'function';
    var cur = null, timer = 0, pointer = 'mouse', viaKey = false;
    tip.className = 'ct-tip';
    tip.id = 'ct-tip-' + Math.random().toString(36).slice(2, 9);
    tip.setAttribute('role', 'tooltip');
    // the top layer escapes the scrolling wrapper and the window, so nothing clips the tooltip
    if (popover) tip.popover = 'manual'; else tip.hidden = true;
    // a copy of a page that was live when the shell cached it still holds the old, unbound tooltip
    var stale = wrap.nextElementSibling;
    if (stale && stale.classList.contains('ct-tip')) stale.remove();
    wrap.after(tip);

    wrap.querySelectorAll('td[data-tooltip]').forEach(function (td) {
      td.removeAttribute('title'); // the no-JS fallback; the popover replaces it
      if (!td.querySelector('a')) td.tabIndex = 0;
    });

    function place(td) {
      var r = td.getBoundingClientRect(), t = tip.getBoundingClientRect();
      var vw = document.documentElement.clientWidth;
      var top = r.top - t.height - 8;
      if (top < 8) top = r.bottom + 8;
      tip.style.left = Math.max(8, Math.min(r.left + r.width / 2 - t.width / 2, vw - t.width - 8)) + 'px';
      tip.style.top = top + 'px';
    }

    function show(td) {
      clearTimeout(timer);
      if (cur === td) return;
      if (cur) cur.removeAttribute('aria-describedby');
      cur = td;
      fill(tip, td.getAttribute('data-tooltip'));
      td.setAttribute('aria-describedby', tip.id);
      if (popover) { if (!tip.matches(':popover-open')) tip.showPopover(); } else tip.hidden = false;
      place(td);
    }

    function hide() {
      clearTimeout(timer);
      if (!cur) return;
      cur.removeAttribute('aria-describedby');
      cur = null;
      viaKey = false;
      if (popover) { if (tip.matches(':popover-open')) tip.hidePopover(); } else tip.hidden = true;
    }

    function hideSoon() {
      clearTimeout(timer);
      timer = setTimeout(hide, 150);
    }

    wrap.addEventListener('pointerover', function (e) {
      if (e.pointerType !== 'mouse') return;
      var td = e.target.closest('td[data-tooltip]');
      if (td) show(td); else if (cur) hideSoon();
    });
    wrap.addEventListener('pointerout', function (e) {
      if (e.pointerType === 'mouse' && cur && !(e.relatedTarget && cur.contains(e.relatedTarget))) hideSoon();
    });
    tip.addEventListener('pointerenter', function () { clearTimeout(timer); });
    tip.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') hideSoon(); });

    wrap.addEventListener('click', function (e) {
      var type = e.pointerType || pointer;
      // keyboard activation (detail 0) and mouse clicks keep their normal behaviour
      if (type === 'mouse' || e.detail === 0) return;
      var td = e.target.closest('td[data-tooltip]');
      if (!td) return hide();
      var onLink = e.target.closest('a');
      if (cur !== td) {
        show(td);
        if (onLink) e.preventDefault();
      } else if (!onLink) {
        hide();
      }
    });

    wrap.addEventListener('focusin', function (e) {
      var td = e.target.closest('td[data-tooltip]');
      if (td && e.target.matches(':focus-visible')) { show(td); viaKey = true; }
    });
    wrap.addEventListener('focusout', function (e) {
      if (viaKey && !(e.relatedTarget && tip.contains(e.relatedTarget))) hideSoon();
    });

    function teardown() {
      hide();
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('keydown', onKey);
      tip.remove();
    }
    // Document listeners outlive the table when its window closes; the first event after that cleans up
    function onDown(e) {
      if (!wrap.isConnected) return teardown();
      pointer = e.pointerType || 'mouse';
      if (cur && !wrap.contains(e.target) && !tip.contains(e.target)) hide();
    }
    function onScroll(e) {
      if (!wrap.isConnected) return teardown();
      if (cur && !tip.contains(e.target)) hide();
    }
    function onKey(e) {
      if (!wrap.isConnected) return teardown();
      if (e.key === 'Escape') hide();
    }
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('scroll', onScroll, true);
    document.addEventListener('keydown', onKey);
  }

  document.querySelectorAll('.comparison-table-wrapper').forEach(bind);
})();
