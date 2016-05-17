var tape = require("tape"),
    mapmap = require("../");

tape("version matches package.json", function(test) {
  test.equal(mapmap.version, require("../package.json").version);
  test.end();
});

tape("legend present", function(test) {
  test.ok(mapmap.legend);
  test.ok(mapmap.legend.html);
  test.ok(mapmap.legend.html());
  test.notOk(mapmap.legend.svg);
  test.end();
});

