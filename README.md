# mapmap.js

***A data-driven API for interactive thematic maps***

mapmap.js is an API to simplify the creation of interactive thematic vector maps in the browser. It simplifies the processes of loading, processing and joining data and geometry, and applying symbolization and interaction techniques to the map. mapmap.js is built on top of [D3](https://github.com/mbostock/d3) and outputs maps in SVG.

A basic interactive statistical map can be created using mapmap.js like this:

```js
var map = mapmap(document.getElementById('mapEl'))
	.geometry('admin.topojson', 'iso') // use the "iso" attribute as primary key to identify geometries
	.data('unemployment.csv', 'code')  // use the "code" field to map data to geometries' keys
	.meta({
		'unemploym':  {
            domain: [0,0.15],
            colors: colorbrewer.YlOrRd[5],
            numberFormat:'%',
            label: "Unemployment Rate"
        }
	})
	.choropleth('unemploym')
	.hoverInfo(['name','unemploym'])
	.on('click', mapmap.zoom());
```

![mapmap.js screenshot](https://raw.githubusercontent.com/floledermann/mapmap.js/master/mapmap.png)

## Highlights

#### Transparent Asynchronous Resource Loading

mapmap.js handles the loading of geometry and data internally and exposes a pseudo-synchronous API for primary functionality that ensures all resources have been loaded before any operations are performed on them.

```js
// The map will be drawn and the interaction handler installed
// *after* the geometry file has loaded
map.geometry('districts.geojson', 'iso')
   .choropleth('pop_count')
   .on('click', mapmap.zoom());
```

#### Data Joining and Processing

Data from CSV or JSON files can be joined with features specified in GeoJSON even if the structure or field names do not match. Simple joins can be performed by specifying the field names that should be used as primary keys to identify matching entities; more comple tranformations can be accomplished in a modular fashion by providing functions for the [MapReduce](https://en.wikipedia.org/wiki/MapReduce) programming model.

```js
// Join geometry identified by the key 'iso' with
// data from a CSV where the key field is called 'code'
map.geometry('districts.geojson', 'iso')
   .data('population.csv', 'code')
   .choropleth('pop_count');
```

```js
// Join geometry identified by the key 'iso' with
// data from a CSV where the key field is called 'code'
map.geometry('districts.geojson', 'iso')
	.data('population.csv', {
        map: function(d, emit) {
            // only emit units on municipality level
            if (d.code.length == 5) {
                emit(d.code.substring(0,3), d);
            }
        },
        reduce: function(key, values, emit) {
            // sum up population count from municipalities
            var result = {
                pop_count: 0
            };
            for (var i=0; i<values.length; i++) {
                result.pop_count += values[i].pop_count;
            }
            emit(key, result);
        }
    });
```

#### Metadata Specification

Metadata descriptors can be used to define the properties of your data and in many cases help create decent human readable output.

```js
map.geometry('districts.geojson', 'iso')
	.data('population.csv', 'code')
	.meta({
		'pop_count': {
            label: "Population Count, 2014",
            valueLabel: "Population",
            domain: [0,2000000],
            colors: colorbrewer.YlOrRd[5], 
            numberFormat: ',d' // integer with thousands separator
        }
	})
   .choropleth('pop_count');
```

(requires [colorbrewer.js](https://github.com/mbostock/d3/tree/master/lib/colorbrewer))

Read more in the [Programming Guide...](https://github.com/floledermann/mapmap.js/wiki/Programming-Guide)

## Using mapmap.js

To use mapmap.js in the browser, download mapmap.js and include it in a script tag.

```html
<script src="mapmap.js"></script>
``` 

Furthermore, you will need to load D3.js and jQuery *before* loading mapmap.js.

```html
<script src="http://d3js.org/d3.v3.min.js" charset="utf-8"></script>
<script src="//code.jquery.com/jquery-1.11.3.min.js"></script>
``` 

For special file formats like [TopoJSON](https://github.com/mbostock/topojson), you may need to include the appropriate libraries.

For production use in older browsers, you may need to load some polyfills.


## More information

For more information and the API documentation, please [see the wiki.](https://github.com/floledermann/mapmap.js/wiki)