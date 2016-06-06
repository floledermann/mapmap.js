export { version } from "./build/package";

// makes a named method of the context's prototype available as an
// auto-constructing global
function globalize(name, context) {
  return function() {
    return context.prototype[name].apply(new context(), arguments);
  }
}

import Layer from "./src/layer.js";

export { Layer };

export let entities = globalize("entities", Layer);

export { default as legendHTML } from "./src/legend-html.js";
export { default as legendSVG } from "./src/legend-svg.js";




