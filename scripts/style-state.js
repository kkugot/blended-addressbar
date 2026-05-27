var BlendedAddressbarModule = (() => {
  'use strict';

  function setStylePropertyIfChanged(style, name, value, priority = '') {
    if (!style || !name) return false;

    const nextValue = String(value ?? '');
    const nextPriority = String(priority || '');
    if (style.getPropertyValue(name) === nextValue && style.getPropertyPriority(name) === nextPriority) {
      return false;
    }

    style.setProperty(name, nextValue, nextPriority);
    return true;
  }

  function removeStylePropertyIfChanged(style, name) {
    if (!style || !name || !style.getPropertyValue(name)) return false;

    style.removeProperty(name);
    return true;
  }

  return Object.freeze({
    removeStylePropertyIfChanged,
    setStylePropertyIfChanged
  });
})();
