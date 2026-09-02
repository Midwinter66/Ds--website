// ===== Toast: 轻量提示组件 =====
(function() {
  'use strict';
  var root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);
  root.App = root.App || {};

  var container = null;

  function getContainer() {
    if (!container || !document.body.contains(container)) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  root.App.Toast = {
    show: function(message, type) {
      type = type || 'info';
      var toast = document.createElement('div');
      toast.className = 'toast toast-' + type;
      toast.textContent = message;

      getContainer().appendChild(toast);

      setTimeout(function() {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(function() {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 300);
      }, 3000);
    },

    success: function(message) {
      this.show(message, 'success');
    },

    error: function(message) {
      this.show(message, 'error');
    },

    info: function(message) {
      this.show(message, 'info');
    }
  };
})();
