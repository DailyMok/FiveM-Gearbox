(function (root) {
  'use strict';
  const dictionaries = root.StandaloneGearboxLocales;
  function get(locale) {
    return dictionaries[locale] || dictionaries.en;
  }
  function text(locale, key, values = {}) {
    const template = get(locale)[key] || dictionaries.en[key] || key;
    return String(template).replace(/\{(\w+)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match);
  }
  root.StandaloneGearboxLocale = { get, text };
})(globalThis);
