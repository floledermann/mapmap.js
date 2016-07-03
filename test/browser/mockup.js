// Some pseudocode sketches for how th new api could work

//-------------------------------------------------------
// ordering is not significant!
mapmap.load("foo.json").render("#mymap");

mapmap.render("#mymap").load("foo.json");
//-------------------------------------------------------

mapmap
    .load("foo.json")
    .merge("data.csv", {key: "iso"})
    .symbolize({
        "stroke-width": d => d.population / 1000000
    })
    .render("#mymap");

//-------------------------------------------------------

var data = mapmap.load("foo.json");

data.render("#mymap");
data
    .filter(d => ("" + d.iso)[0] = "5")
    .symbolize(...)
    .render("#mymap");

//-------------------------------------------------------

var state = mapmap.state({
    dataFile: "foo.json"
});
var data = mapmap.load(state => state.dataFile).render();

button.onclick(() => state({dataFile: "bar.json"}));

//-------------------------------------------------------


//-------------------------------------------------------