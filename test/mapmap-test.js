var tape = require("tape"),
  mapmap = require("../");

tape("version matches package.json", function(test) {
  test.equal(mapmap.version, require("../package.json").version, "Version in build equals version in package.json");
  test.end();
});

tape("legends present", function(test) {
  test.ok(mapmap.legendHTML, "HTML legend is present");
  test.ok(typeof mapmap.legendHTML == "function", "HTML legend is a function");
  test.ok(mapmap.legendSVG, "SVG legend is present");
  test.ok(typeof mapmap.legendSVG == "function", "SVG legend is a function");
  test.end();
});

tape("core", function(test) {
  var l = mapmap.entities("test.geojson");
  
  //l.join("test.csv");
  //l.render();

  test.ok(l instanceof mapmap.Layer, "Layer constructed from global function");
  
  var l2 = l.entities("test.geojson");
  
  test.ok(l instanceof mapmap.Layer, "Layer entity method");
  test.ok(l === l2, "Method chaining on Layer");
  
  test.end();
});

/*
tape("context", function(test) {

  var l1 = mapmap.entities({
    fromContext: function(ctx){return ctx;}
  });
  l1.context("test.geojson");
  l1("test.geojson");
  
  test.end();
});
*/
