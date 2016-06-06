export default Layer;

import dd from "datadata";

function Layer() {
};

Layer.prototype.entities = function(spec, options) {
  var promise = dd(spec);
  return this;
}
