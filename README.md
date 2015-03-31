# mapmap.js

***An API for interactive thematic maps***

*We are currently in the process of licensing the mapmap.js source code under an open source license. This process should hopefully be completed in the next few days - stay tuned...*

mapmap.js is an API to simplify the creation of interactive thematic vector maps in the browser. It simplifies the processes of loading and processing data and geometry, joining data to geometry, and applying symbolization and interaction techniques to the map.

Mapmap is built on top of [D3](https://github.com/mbostock/d3) and outputs maps in SVG. Support for pluggable renderer modules, creating maps using other technologies (Canvas, WebGL) is currently planned but not yet implemented.

Mapmap is intended to work with heterogeneous, messy and real-world datasets and offers simple yet powerful methods to filter, process and aggregate data.

A basic interactive statistical map can be created using mapmap.js like this:

```js
var map = mapmap(document.getElementById('mapEl'))
	.geometry('admin.topojson', 'iso') // use the "iso" attribute as primary key
	.data('unemployment.csv', 'code')  // use the field "code" to map data to geometries' keys
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

## Using mapmap.js

To use mapmap.js in the browser, download mapmap.js and include it in a script tag.

```html
<script src="mapmap.js"></script>
``` 

Furthermore, you will need to load D3.js and jQuery before loading mapmap.js.

For special file formats like TopoJSON, you may need to include the appropriate libraries.

For production use in older browsers, you may need to load some polyfills.


## More information

For more information and the API documentation, please [see the wiki.](https://github.com/floledermann/mapmap.js/wiki)