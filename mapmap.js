(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.mapmap = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*! datadata.js © 2014-2015 Florian Ledermann 

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

'use strict';

// test whether in a browser environment
if (typeof window === 'undefined') {
    // node
    var d3dsv = require('d3-dsv');
    var fs = require('fs');
    
    var fileparser = function(func) {
        return function(path, row, callback) {
            if (dd.isUndefined(callback)) {
                callback = row;
                row = null;
            }
            fs.readFile(path, 'utf8', function(error, data) {
                if (error) return callback(error);
                data = func(data, row);
                callback(null,data);
            });
        };
    };
    
    var d3 = {
        csv: fileparser(d3dsv.csv.parse),
        tsv: fileparser(d3dsv.tsv.parse),
        json: fileparser(JSON.parse)
    };

} else {
    // browser
    // we expect global d3 to be available
    var d3 = window.d3;
}


function rowFileHandler(loader) {
    // TODO: file handler API should not need to be passed map, reduce functions but be wrapped externally
    return function(path, map, reduce, options) {
    
        options = dd.merge({
            // default accessor function tries to convert number-like strings to numbers
            accessor: function(d) {
                var keys = Object.keys(d);
                for (var i=0; i<keys.length; i++) {
                    var key = keys[i],
                        val = d[key];
                    // CSV doesn't support specification of null values
                    // interpret empty field values as missing
                    if (val === "") {
                        d[key] = null;
                    }
                    else if (dd.isNumeric(val)) {
                        // unary + converts both ints and floats correctly
                        d[key] = +val;
                    }
                }
                return d;
            }
        }, options);
        
        return new Promise(function(resolve, reject) {
            loader(path, options.accessor,
                function(error, data) {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(dd.mapreduce(data, map, reduce));                    
                }
            );
        }); 
    };
}

function jsonFileHandler(path, map, reduce) {
    return new Promise(function(resolve, reject) {
        d3.json(path, function(error, data) {
            if (error) {
                reject(error);
                return;
            }
                                
            if (dd.isArray(data)) {
                resolve(dd.mapreduce(data, map, reduce));
            }
            else {
                // object - treat entries as keys by default
                var keys = Object.keys(data);
                var map_func;
                if (!map) {
                    // use keys as data to emit key/data pairs in map step!
                    map_func = dd.map.dict(data);
                }
                else {
                    map_func = function(k, emit) {
                        // put original key into object
                        var v = data[k];
                        v.__key__ = k;
                        // call user-provided map funtion with object
                        map(v, emit);
                    };
                }
                resolve(dd.mapreduce(keys, map_func, reduce));
            }                    
        });
    });
}

var fileHandlers = {
    'csv':  rowFileHandler(d3.csv),
    'tsv':  rowFileHandler(d3.tsv),
    'json': jsonFileHandler
};

var getFileHandler = function(pathOrExt) {
    // guess type
    var ext = pathOrExt.split('.').pop().toLowerCase();
    return fileHandlers[ext] || null;
};

var registerFileHandler = function(ext, handler) {
    fileHandlers[ext] = handler;
};

// TODO: register .topojson, .geojson in mapmap.js

/**
Datadata - a module for loading and processing data.
You can call the module as a function to create a promise for data from a URL, Function or Array. 
Returns a promise for data for everything.
@param {(string|function|Array)} spec - A String (URL), Function or Array of data.
@param {(function|string)} [map={@link datadata.map.dict}]  - The map function for map/reduce.
@param {(string)} [reduce=datadata.emit.last] - The reduce function for map/reduce.
@exports module:datadata
*/
var dd = function(spec, map, reduce, options) {

    // options
    // type: override file extension, e.g. for API urls (e.g. 'csv')
    // fileHandler: manually specify file handler to be used to load & parse file
    options = options || {};

    if (spec == null) throw new Error("datadata.js: No data specification.");
        
    if (map && !dd.isFunction(map)) {
        // map is string -> map to attribute value
        map = dd.map.key(map);
    }
    
    if (dd.isString(spec)) {
        // consider spec to be a URL/file to load
        var handler = options.fileHandler || getFileHandler(options.type || spec);
        if (handler) {
            return handler(spec, map, reduce, options);
        }
        else {
            throw new Error("datadata.js: Unknown file type for: " + spec);
        }
    }
    if (dd.isArray(spec)) {
        return new Promise(function(resolve, reject) {
            resolve(dd.mapreduce(spec, map, reduce));
        });
    }
    throw new Error("datadata.js: Unknown data specification.");
};

// expose registration method & rowFileHandler helper
dd.registerFileHandler = registerFileHandler;
dd.rowFileHandler = rowFileHandler;

// simple load function, returns a promise for data without map/reduce-ing
// DO NOT USE - present only for mapmap.js legacy reasons
dd.load = function(spec, key) {
    if (spec.then && typeof spec.then === 'function') {
        // already a thenable / promise
        return spec;
    }
    else if (dd.isString(spec)) {
        // consider spec to be a URL to load
        // guess type
        var ext = spec.split('.').pop();
        if (ext == 'json' || ext == 'topojson' || ext == 'geojson') {
            return new Promise(function(resolve, reject) {
                d3.json(spec, function(error, data) {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(data);
                });
            });
        }
        else {
            console.warn("Unknown extension: " + ext);
        }
    }
};


// Type checking
/**
Return true if argument is a string.
@param {any} val - The value to check.
*/
dd.isString = function (val) {
  return Object.prototype.toString.call(val) == '[object String]';
};
/**
Return true if argument is a function.
@param {any} val - The value to check.
*/
dd.isFunction = function(obj) {
    return (typeof obj === 'function');
};
/**
Return true if argument is an Array.
@param {any} val - The value to check.
*/
dd.isArray = function(obj) {
    return (obj instanceof Array);
};
/**
Return true if argument is an Object, but not an Array, String or anything created with a custom constructor.
@param {any} val - The value to check.
*/
dd.isDictionary = function(obj) {
    return (obj && obj.constructor && obj.constructor === Object);
};
/**
Return true if argument is undefined.
@param {any} val - The value to check.
*/
dd.isUndefined = function(obj) {
    return (typeof obj == 'undefined');
};
/**
Return true if argument is a number or a string that strictly looks like a number.
This method is stricter than +val or parseInt(val) as it doesn't validate the empty
string or strings contining any non-numeric characters. 
@param {any} val - The value to check.
*/
dd.isNumeric = function(val) {
    // check if string looks like a number
    // +"" => 0
    // parseInt("") => NaN
    // parseInt("123OK") => 123
    // +"123OK" => NaN
    // so we need to pass both to be strict
    return !isNaN(+val) && !isNaN(parseFloat(val));
}

// Type conversion / utilities
/**
If the argument is already an Array, return a copy of the Array.
Else, return a single-element Array containing the argument.
*/
dd.toArray = function(val) {
    if (!val) return [];
    // return a copy if aready array, else single-element array
    return dd.isArray(val) ? val.slice() : [val];
};

/**
Shallow object merging, mainly for options. Returns a new object.
*/
dd.merge = function() {
    var obj = {};

    for (var i = 0; i < arguments.length; i++) {
        var src = arguments[i];
        
        for (var key in src) {
            if (src.hasOwnProperty(key)) {
                obj[key] = src[key];
            }
        }
    }

    return obj;
};

/**
Return an {@link module:datadata.OrderedHash|OrderedHash} object.
@exports module:datadata.OrderedHash
*/
dd.OrderedHash = function() {
    // ordered hash implementation
    var keys = [];
    var vals = {};
    
    return {
        /**
        Add a key/value pair to the end of the OrderedHash.
        @param {String} k - Key
        @param v - Value
        */
        push: function(k,v) {
            if (!vals[k]) keys.push(k);
            vals[k] = v;
        },
        /**
        Insert a key/value pair at the specified position.
        @param {Number} i - Index to insert value at
        @param {String} k - Key
        @param v - Value
        */
        insert: function(i,k,v) {
            if (!vals[k]) {
                keys.splice(i,0,k);
                vals[k] = v;
            }
        },
        /**
        Return the value for specified key.
        @param {String} k - Key
        */
        get: function(k) {
            // string -> key
            return vals[k];
        },
        /**
        Return the value at specified index position.
        @param {String} i - Index
        */
        at: function(i) {
            // number -> nth object
            return vals[keys[i]];
        },
        length: function(){return keys.length;},
        keys: function(){return keys;},
        key: function(i) {return keys[i];},
        values: function() {
            return keys.map(function(key){return vals[key];});
        },
        map: function(func) {
            return keys.map(function(k){return func(k, vals[k]);});
        },
        unsorted_dict: function() {
            return vals;
        }
    };
};

// Utility functions for map/reduce
dd.map = {
    key: function(attr, remap) {
        return function(d, emit) {
            var key = d[attr];
            if (remap && remap[key] !== undefined) {
                key = remap[key];
            }
            emit(key, d);
        };
    },
    dict: function(dict) {
        return function(d, emit) {
            emit(d, dict[d]);
        };
    }
};
dd.emit = {
    ident: function() {
        return function(key, values, emit) {
            emit(key, values);
        };
    },
    first: function() {
        return function(key, values, emit) {
            emit(key, values[0]);
        };
    },
    last: function() {
        return function(key, values, emit) {
            emit(key, values[values.length - 1]);
        };
    },
    merge: function() {
        return function(key, values, emit) {
            var obj = values.reduce(function(prev, curr) {
                var keys = Object.keys(curr);
                for (var i=0; i<keys.length; i++) {
                    var k = keys[i];
                    prev[k] = curr[k];
                }
                return prev;
            });
            
            emit(key, obj);
        };
    },
    toAttr: function(attr, func) {
        func = func || dd.emit.last();
        return function(key, values, emit) {
            func(key, values, function(k, v) {
                var obj = {};
                obj[attr] = v;
                emit(k, obj);
            });
        };
    },
    sum: function(include, exclude) {
        include = wildcards(include || '*');
        exclude = wildcards(exclude);       

        return function(key, values, emit) {
            var obj = values.reduce(function(prev, curr) {
                var keys = Object.keys(curr);
                for (var i=0; i<keys.length; i++) {
                    var key = keys[i],
                        doAdd = false,
                        j;
                    
                    for (j=0; j<include.length; j++) {
                        if (key.search(include[i]) > -1) {
                            doAdd = true;
                            break;
                        }
                    }
                    for (j=0; j<exclude.length; j++) {
                        if (key.search(include[j]) > -1) {
                            doAdd = false;
                            break;
                        }
                    }
                    if (doAdd && prev[key] && curr[key] && !isNaN(prev[key]) && !isNaN(curr[key])) {
                        prev[key] = prev[key] + curr[key];
                    }
                    else {
                        prev[key] = curr[key];
                        if (doAdd) {
                            console.warn("datadata.emit.sum(): Cannot add keys " + key + "!");
                        }
                    }
                }
                return prev;
            });
            
            emit(key, obj);
        };
    }
};

dd.map.geo = {
    point: function(latProp, lonProp, keyProp) {
        var id = 0;
        return function(d, emit) {
            var key = keyProp ? d[keyProp] : id++;
            emit(key, dd.geo.Point(d[lonProp], d[latProp], d));
        };
    }
};

dd.emit.geo = {
    segments: function() {
        return function(key, data, emit) {
            var prev = null, cur = null;
            for (var i=0; i<data.length; i++) {
                cur = data[i];
                if (prev) {
                    emit(key + '-' + i, dd.geo.LineString([[prev.lon,prev.lat],[cur.lon,cur.lat]], prev));
                }
                prev = cur;
            }
        };
    }
};

// constructors for GeoJSON objects
dd.geo = {
    Point: function(lon, lat, properties) {
        return {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [lon, lat]
            },
            properties: properties
        };
    },
    LineString: function(coordinates, properties) {
        return {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: coordinates
            },
            properties: properties
        };
    }
};

function wildcards(spec) {
    spec = dd.toArray(spec);
    for (var i=0; i<spec.length; i++) {
        if (!(spec[i] instanceof RegExp)) {
            spec[i] = new RegExp('^' + spec[i].replace('*','.*').replace('?','.'));
        }
    }
    return spec;
}

// https://code.google.com/p/mapreduce-js/
// Mozilla Public License
dd.mapreduce = function (data, map, reduce) {
	var mapResult = [],
        reduceResult = dd.OrderedHash(),
        reduceKey;
	
    reduce = reduce || dd.emit.last(); // default
    
	var mapEmit = function(key, value) {
        if (key == null) return; // do not emit if key is null or undefined
		if(!mapResult[key]) {
			mapResult[key] = [];
		}
		mapResult[key].push(value);
	};
	
	var reduceEmit = function(key, value) {
		reduceResult.push(key, value);
	};
	
	for(var i = 0; i < data.length; i++) {
		map(data[i], mapEmit);
	}
	
	for(reduceKey in mapResult) {
		reduce(reduceKey, mapResult[reduceKey], reduceEmit);
	}
	
	return reduceResult;
};

dd.mapreducer = function(map, reduce) {
    return function(data) {
        dd.mapreduce(data, map, reduce);
    };
};
// Helper functions for map etc.

// put 'd' in another object using the attribute 'key'
// optional 'pull' is the name of a key to leave on the top level 
dd.envelope = function(key, pull, func) {
    return function(d) {
        if (pull && typeof pull == 'function') {
            // envelope(key, func) case
            func = pull;
            pull = null;
        }
        if (func) d = func(d);
        var val = {};
        val[key] = d;
        if (pull) {
            val[pull] = d[pull];
            delete d[pull];
        }
        return val;
    };
};
dd.prefix = function(prefix, func) {
    return function(d) {
    
        if (func) d = func(d);
    
        var val = {},
            keys = Object.keys(d);
            
        for (var i=0; i<keys.length; i++) {
            val[prefix + keys[i]] = d[keys[i]];
        }
            
        return val;
    };
};
dd.prefix_attr = function(attr, func) {
    return function(d) {
    
        if (func) d = func(d);
    
        var val = {},
            keys = Object.keys(d),
            prefix = d[attr] ? d[attr] + '_' : '';
            
        for (var i=0; i<keys.length; i++) {
            val[prefix + keys[i]] = d[keys[i]];
        }
            
        return val;
    };
};
dd.map_attr = function(map, func) {
    return function(d) {
    
        if (func) d = func(d);
    
        if (typeof map == 'function') {
            d = map(d);
        }
        else {
            var keys = Object.keys(map);
            for (var i=0; i<keys.length; i++) {
                var key = keys[i];
                var val = map[key];
                if (typeof val == 'function') {
                    d[key] = val(d);
                }
                else if (d[val]) {
                    d[key] = d[val];
                    delete d[val];
                }
            }
        }
            
        return d;
    };
};
dd.reverse = function(data) {
    if (data.slice && typeof data.slice == 'function') {
        // slice() = copy
        return data.slice().reverse(); 
    }
    return data;
};

module.exports = dd;

},{"d3-dsv":2,"fs":2}],2:[function(require,module,exports){

},{}],3:[function(require,module,exports){
/*! mapmap.js 0.2.8-dev.0 © Florian Ledermann 

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

var dd = require('datadata');

var version = '0.2.8-dev.0';

function assert(test, message) { if (test) return; throw new Error("[mapmap] " + message);}
assert(window.d3, "d3.js is required!");
assert(window.Promise, "Promises not available in your browser - please add the necessary polyfill, as detailed in https://github.com/floledermann/mapmap.js#using-mapmapjs");

var default_settings = {
    locale: 'en',
    keepAspectRatio: true,
    placeholderClassName: 'placeholder',
    svgAttributes: {
        'overflow': 'hidden' // needed for IE
    },
    pathAttributes: {
        'fill': 'none',
        'stroke': '#000',
        'stroke-width': '0.2',
        'stroke-linejoin': 'bevel',
        'pointer-events': 'none'
    },
    backgroundAttributes: {
        'width': '300%',
        'height': '300%',
        'fill': 'none',
        'stroke': 'none',
        'transform': 'translate(-800,-400)',
        'pointer-events': 'all'
    },
    overlayAttributes: {
        'fill': '#ffffff',
        'fill-opacity': '0.2',
        'stroke-width': '0.8',
        'stroke': '#333',
        'pointer-events': 'none'
    },
    defaultMetadata: {
        // domain:  is determined by data analysis
        scale: 'quantize',
        colors: ["#ffffcc","#c7e9b4","#7fcdbb","#41b6c4","#2c7fb8","#253494"], // Colorbrewer YlGnBu[6] 
        undefinedValue: "", //"undefined"
        //undefinedLabel: -> from locale
        undefinedColor: 'transparent'
    }
};

var mapmap = function(element, options) {
    // ensure constructor invocation
    if (!(this instanceof mapmap)) return new mapmap(element, options);

    this.settings = {};    
    this.options(mapmap.extend({}, default_settings, options));
    
    // promises
    this._promise = {
        geometry: null,
        data: null
    };

    this.selected = null;
    
    this.layers = new dd.OrderedHash();
    //this.identify_func = identify_layer;
    this.identify_func = identify_by_properties();
    
    this.metadata_specs = [];

    // convert seletor expression to node
    element = d3.select(element).node();
 
    // defaults
    this.projection(d3.geo.mercator().scale(1));
    
    this.initEngine(element);
    this.initEvents(element);
    
    this.dispatcher = d3.dispatch('choropleth','view','click','mousedown','mouseup','mousemove');
    
    return this;    
};

// expose datadata library in case we are bundled for browser
// (browserify doesn't support mutliple global exports)
mapmap.datadata = dd;

mapmap.prototype = {
	version: version
};

mapmap.extend = function extend(){
    for(var i=1; i<arguments.length; i++)
        for(var key in arguments[i])
            if(arguments[i].hasOwnProperty(key))
                arguments[0][key] = arguments[i][key];
    return arguments[0];
}

mapmap.prototype.initEngine = function(element) {
    // SVG specific initialization, for now we have no engine switching functionality
    
    // HTML elements, stored as d3 selections    
    var mainEl = d3.select(element).classed('mapmap', true),
        mapEl = mainEl.append('g').attr('class', 'map');
    
    mainEl.attr(this.settings.svgAttributes);
    
    this._elements = {
        main: mainEl,
        map: mapEl,
        parent: d3.select(mainEl.node().parentNode),
        // child elements
        defs: mainEl.insert('defs', '.map'),
        backgroundGeometry: mapEl.append('g').attr('class', 'background-geometry'),
        background: mapEl.append('rect').attr('class', 'background').attr(this.settings.backgroundAttributes),
        shadowGroup: mapEl.append('g'),
        geometry: mapEl.append('g').attr('class', 'geometry'),
        overlay: mapEl.append('g').attr('class', 'overlays'),
        fixed: mainEl.append('g').attr('class', 'fixed'),
        placeholder: mainEl.select('.' + this.settings.placeholderClassName)
    };
    
    // set up width/height
    this.width = null;
    this.height = null;
    
    // TODO: use options.width || options.defaultWidth etc.
    if (!this.width) {
        this.width = parseInt(mainEl.attr('width')) || 800;
    }
    if (!this.height) {
        this.height = parseInt(mainEl.attr('height')) || 400;
    }
    var viewBox = mainEl.attr('viewBox');
    if (!viewBox) {
        mainEl.attr('viewBox', '0 0 ' + this.width + ' ' + this.height);
    }
    
    this._elements.defs.append('filter')
        .attr('id', 'shadow-glow')
        .append('feGaussianBlur')
        .attr('stdDeviation', 5);

    this._elements.defs.append('filter')
        .attr('id', 'light-glow')
        .append('feGaussianBlur')
        .attr('stdDeviation', 1);
    
    this._elements.shadowEl = this._elements.shadowGroup
        .append('g')
        .attr('class', 'shadow')
        .attr('filter', 'url(#shadow-glow)');
        
    this._elements.shadowCropEl = this._elements.shadowGroup
        .append('g')
        .attr('class', 'shadow-crop');
       
    this.supports = {};
    
    // feature detection
    var el = this._elements.main.append('path').attr({
        'paint-order': 'stroke',
        'vector-effect': 'non-scaling-stroke'
    });  
    
    var val = getComputedStyle(el.node()).getPropertyValue('paint-order');
    this.supports.paintOrder = val && val.indexOf('stroke') == 0;
    
    val = getComputedStyle(el.node()).getPropertyValue('vector-effect');
    this.supports.nonScalingStroke = val && val.indexOf('non-scaling-stroke') == 0;
    this._elements.main.classed('supports-non-scaling-stroke', this.supports.nonScalingStroke);
        
    el.remove();
    
    // compatibility settings
    if (navigator.userAgent.indexOf('MSIE') !== -1 || navigator.appVersion.indexOf('Trident/') > 0) {
        this.supports.hoverDomModification = false;
    }
    else {
        this.supports.hoverDomModification = true;
    }
    
    // Firefox < 35 will report wrong BoundingClientRect (adding clipped background),
    // https://bugzilla.mozilla.org/show_bug.cgi?id=530985
    var match = /Firefox\/(\d+)/.exec(navigator.userAgent);
    if (match && parseInt(match[1]) < 35) {
        this.supports.svgGetBoundingClientRect = false;
    }
    else {
        this.supports.svgGetBoundingClientRect = true;
    }
    
    var map = this;
    // save viewport state separately, as zoom may not have exact values (due to animation interpolation)
    this.current_scale = 1;
    this.current_translate = [0,0];
    
    this.zoom = d3.behavior.zoom()
        .translate([0, 0])
        .scale(1)
        .scaleExtent([1, 8])
        .on('zoom', function () {
            map.current_scale = d3.event.scale;
            map.current_translate = d3.event.translate;
            mapEl.attr('transform', 'translate(' + d3.event.translate + ')scale(' + d3.event.scale + ')');
            if (!map.supports.nonScalingStroke) {
                //map._elements.geometry.selectAll("path").style("stroke-width", 1.5 / d3.event.scale + "px");
            }
        });

    mapEl
        //.call(this.zoom) // free mousewheel zooming
        .call(this.zoom.event);
      /*  
    var drag = d3.behavior.drag()
        .origin(function() {return {x:map.current_translate[0],y:map.current_translate[1]};})
        .on('dragstart', function() {
            d3.event.sourceEvent.stopPropagation(); 
        })
        .on('dragend', function() {
            d3.event.sourceEvent.stopPropagation(); 
        })
        .on('drag', function() {
            map.current_translate = [d3.event.x, d3.event.y];
            mapEl.attr('transform', 'translate(' + d3.event.x + ',' + d3.event.y + ')scale(' + map.current_scale + ')');
        })
    ;*/
        
    //mapEl.call(drag);
    
    
    var map = this;
    
    function constructEvent(event) {
        // TODO: maybe this should be offsetX/Y, but then we need to change
        // zoomToViewportPosition to support click-to-zoom
        var pos = [event.clientX, event.clientY]
        return {
            position: pos,
            location: map._projection.invert(pos),
            event: event
        }
    };

    mapEl.on('click', function() {
        // TODO: check if anyone is listening, else return immediately
        map.dispatcher.click.call(map, constructEvent(d3.event));
    });

    mapEl.on('mousedown', function() {
        // TODO: check if anyone is listening, else return immediately
        map.dispatcher.mousedown.call(map, constructEvent(d3.event));
    });

    mapEl.on('mouseup', function() {
        // TODO: check if anyone is listening, else return immediately
        map.dispatcher.mousedown.call(map, constructEvent(d3.event));
    });

    mapEl.on('mousemove', function() {
        // TODO: check if anyone is listening, else return immediately
        map.dispatcher.mousedown.call(map, constructEvent(d3.event));
    });

};

mapmap.prototype.getGeometryPane = function() {
    return this._elements.geometry;
}

mapmap.prototype.getOverlayPane = function() {
    return this._elements.overlay;
}

mapmap.prototype.getFixedPane = function() {
    return this._elements.fixed;
}

mapmap.prototype.initEvents = function(element) {
    var map = this;
    // keep aspect ratio on resize
    function resize() {
    
        map.bounds = map.getBoundingClientRect();
        
        if (map.settings.keepAspectRatio) {
            var width = element.getAttribute('width'),
                height = element.getAttribute('height');
            if (width && height && map.bounds.width) {
                var ratio = width / height;
                element.style.height = (map.bounds.width / ratio) + 'px';
            }
        }
    }
    
    window.onresize = resize;
    
    resize();
};

var domain = [0,1];

var layer_counter = 0;

// TODO: think about caching loaded resources (#8)
mapmap.prototype.geometry = function(spec, keyOrOptions) {

    // key is default option
    var options = dd.isString(keyOrOptions) ? {key: keyOrOptions} : keyOrOptions;

    options = dd.merge({
        key: 'id',
        setExtent: true
        // layers: taken from input or auto-generated layer name
    }, options);

    var map = this;
    
    if (dd.isFunction(spec)) {
        this._promise.geometry.then(function(topo){
            var new_topo = spec(topo);
            if (typeof new_topo.length == 'undefined') {
                new_topo = [new_topo];
            }
            new_topo.map(function(t) {
                if (typeof t.geometry.length == 'undefined') {
                    t.geometry = [t.geometry];
                }
                if (typeof t.index == 'undefined') {
                    map.layers.push(t.name, t.geometry);
                }
                else {
                    map.layers.insert(t.index, t.name, t.geometry);
                }
            });
            if (options.setExtent) {
                if (!map.selected_extent) {
                    map._extent(spec);           
                }
                map.draw();
                if (options.ondraw) options.ondraw();
            }
        });
        return this;
    }

    if (dd.isDictionary(spec)) {
        if (!options.layers) {
            options.layers = 'layer-' + layer_counter++;
        }
        
        spec = [{type:'Feature',geometry:spec}];

        map.layers.push(options.layers, spec);
        // add dummy promise, we are not loading anything
        var promise = new Promise(function(resolve, reject) {
            resolve(spec);
        });
        this.promise_data(promise);
        // set up projection first to avoid reprojecting geometry
        // TODO: setExtent options should be decoupled from drawing,
        // we need a way to defer both until drawing on last geom promise works
        if (options.setExtent) {
            if (!map.selected_extent) {
                map._extent(spec);           
            }
            map.draw();
            if (options.ondraw) options.ondraw();
        }
        return this;
    }

    if (dd.isArray(spec)) {
        // Array case
        var new_topo = dd.mapreduce(spec, options.map, options.reduce);
        if (!options.layers) {
            options.layers = 'layer-' + layer_counter++;
        }
        map.layers.push(options.layers, new_topo.values());
        // add dummy promise, we are not loading anything
        var promise = new Promise(function(resolve, reject) {
            resolve(new_topo);
        });
        this.promise_data(promise);
        // set up projection first to avoid reprojecting geometry
        if (options.setExtent) {
            if (!map.selected_extent) {
                map._extent(new_topo.values());           
            }
            // TODO: we need a smarter way of setting up projection/bounding box initially
            // if extent() was called, this should have set up bounds, else we need to do it here
            // however, extent() currently operates on the rendered <path>s generated by draw()
            // Also: draw should be called only at end of promise chain, not inbetween!
            //this._promise.geometry.then(draw);
            map.draw();
            if (options.ondraw) options.ondraw();
        }
        return this;
    }

    var promise = dd.load(spec);

    // chain to existing geometry promise
    if (this._promise.geometry) {
        var parent = this._promise.geometry;
        this._promise.geometry = new Promise(function(resolve, reject) {
            parent.then(function(_) {
                promise.then(function(data) {
                    resolve(data);
                });
            });
        });
    }
    else {
        this._promise.geometry = promise;
    }
    
    this._promise.geometry.then(function(geom) {
        if (geom.type && geom.type == 'Topology') {
            // TopoJSON
            var keys = options.layers || Object.keys(geom.objects);
            keys.map(function(k) {
                if (geom.objects[k]) {
                    var objs = topojson.feature(geom, geom.objects[k]).features;
                    map.layers.push(k, objs);
					// TODO: support functions for map as well as strings
                    if (options.key) {
                        for (var i=0; i<objs.length; i++) {
                            var obj = objs[i];
                            if (obj.properties && obj.properties[options.key]) {
                                objs[i].properties.__key__ = obj.properties[options.key];
                            }
                        }
                    }
                }
            });
        }
        else {
            // GeoJSON
            if (!options.layers) {
                options.layers = 'layer-' + layer_counter++;
            }
            if (geom.features) {
                map.layers.push(options.layers, geom.features);
            }
            else {
                map.layers.push(options.layers, [geom]);
            }
        }
        // set up projection first to avoid reprojecting geometry
        if (options.setExtent) {
            if (!map.selected_extent) {
                map._extent(geom);           
            }
        }
        // TODO: we need a smarter way of setting up projection/bounding box initially
        // if extent() was called, this should have set up bounds, else we need to do it here
        // however, extent() currently operates on the rendered <path>s generated by draw()
        //this._promise.geometry.then(draw);
        map.draw();
        if (options.ondraw) options.ondraw();
    });
    
    // put into chained data promise to make sure is loaded before later data
    // note this has to happen after merging into this._promise.geometry to make
    // sure layers are created first (e.g. for highlighting)
    this.promise_data(promise);
 
    return this;
};

var identify_by_properties = function(properties){
    // TODO: calling this without properties should use primary key as property
    // however, this is not stored in the object's properties currently
    // so there is no easy way to access it
    if (!properties) {
        properties = '__key__';
    }
    // single string case
    if (properties.substr) {
        properties = [properties];
    }
    return function(layers, name){
        name = name.toString().toLowerCase();
        // layers have priority, so iterate them first
        var lyr = layers.get(name);
        if (lyr) return lyr;
        var result = [];
        // properties are ordered by relevance, so iterate these first
        for (var k=0; k<properties.length; k++) {
            var property = properties[k];
            for (var i=0; i<layers.length(); i++) {
                var key = layers.keys()[i],
                    geoms = layers.get(key);
                for (var j=0; j<geoms.length; j++) {
                    var geom = geoms[j];
                    if (geom.properties && geom.properties[property] !== undefined && geom.properties[property].toString().toLowerCase() == name) {
                        result.push(geom);
                    }
                }
            }
        }
        return result;
    };
};

var identify_layer = function(layers, name) {
    name = name.toLowerCase();
    return layers.get(name);
};

// TODO: use all arguments to identify - can be used to provide multiple properties or functions
mapmap.prototype.identify = function(spec) {
    if (typeof spec == 'function') {
        this.identify_func = spec;
        return this;
    }
    // cast to array
    if (!spec.slice) {
        spec = [spec];
    }
    this.identify_func = identify_by_properties(spec);
    return this;
};

mapmap.prototype.searchAdapter = function(selection, propName) {
    var map = this;
    return function(query, callback) {
        map.promise_data().then(function() {
            var sel = map.getRepresentations(selection),
                results = [];
            sel = sel[0];
            for (var i=0; i<sel.length; i++) {
                var d = sel[i].__data__.properties;
                if (d[propName] && d[propName].toLowerCase().indexOf(query.toLowerCase()) == 0) {
                    results.push(sel[i].__data__);
                }
            }
            callback(results);
        });
    };
};

// TODO: this is needed for search functionality (see tools.js) - generalize and integrate
// into identify() etc.
mapmap.prototype.search = function(value, key) {
    key = key || '__key__';
    return identify_by_properties([key])(this.layers, value);
};

// return the representation (= SVG element) of a given object
mapmap.prototype.repr = function(d) {
    return d.__repr__;
};


mapmap.prototype.draw = function() {

    var groupSel = this._elements.geometry
        .selectAll('g')
        .data(this.layers.keys(), function(d,i) { return d; });
    
    var map = this;
    
    if (this._elements.placeholder) {
        this._elements.placeholder.remove();
        this._elements.placeholder = null;
    }
    
    groupSel.enter()
        .append('g')
        .attr('class', function(d){
            return d;
        })
        .each(function(d) {
            // d is name of topology object
            var geom = map.layers.get(d);
            var geomSel = d3.select(this)
                .selectAll('path')
                .data(geom);
                        
            geomSel
                .enter()
                .append('path')
                .attr('d', map.getPathGenerator())
                .attr(map.settings.pathAttributes)
                .each(function(d) {
                    // link data object to its representation
                    d.__repr__ = this;
                });
        });
    
    groupSel.order();
};

mapmap.prototype.anchorFunction = function(f) {
    this.anchorF = f;
    return this;
};

mapmap.prototype.anchor = function(d) {
    if (this.anchorF) {
        return this.anchorF(d);
    }
};

mapmap.prototype.size = function() {
    // bounds are re-calculate by initEvents on every resize
    return {
        width: this.width,
        height: this.height
    };
};


mapmap.prototype.getBoundingClientRect = function() {

    var el = this._elements.main.node(),
        bounds = el.getBoundingClientRect();
    
    if (this.supports.svgGetBoundingClientRect) {
        return bounds;
    }
        
    // Fix getBoundingClientRect() for Firefox < 35
    // https://bugzilla.mozilla.org/show_bug.cgi?id=530985
    // http://stackoverflow.com/questions/23684821/calculate-size-of-svg-element-in-html-page
    var cs = getComputedStyle(el),
        parentOffset = el.parentNode.getBoundingClientRect(),
        left = parentOffset.left,
        scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0,
        scrollLeft = window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft || 0
    ;
    // TODO: take into account margins etc.
    if (cs.left.indexOf('px') > -1) {
        left += parseInt(cs.left.slice(0,-2));
    }
    // this tests getBoundingClientRect() to be non-buggy
    if (bounds.left == left - scrollLeft) {
        return bounds;
    }
    // construct synthetic boundingbox from computed style
    var top = parentOffset.top,
        width = parseInt(cs.width.slice(0,-2)),
        height = parseInt(cs.height.slice(0,-2));
    return {
        left: left - scrollLeft,
        top: top - scrollTop,
        width: width,
        height: height,
        right: left + width - scrollLeft,
        bottom: top + height - scrollTop
    };
};

// TODO: disable pointer-events for not selected paths
mapmap.prototype.select = function(selection) {

    var map = this;
    
    function getName(sel) {
        return (typeof sel == 'string') ? sel : (sel.selectionName || 'function');
    }
    var oldSel = this.selected;
    if (this.selected) {
        this._elements.main.classed('selected-' + getName(this.selected), false);
    }
    this.selected = selection;
    if (this.selected) {
        this._elements.main.classed('selected-' + getName(this.selected), true);
    }
    this.promise_data().then(function(){
        if (oldSel) {
            map.getRepresentations(oldSel).classed('selected',false);
        }
        if (selection) {
            map.getRepresentations(selection).classed('selected',true);
        }
    });
    return this;
};

mapmap.prototype.highlight = function(selection) {

    var map = this;
       
    if (selection === null) {
        map._elements.shadowEl.selectAll('path').remove();
        map._elements.shadowCropEl.selectAll('path').remove();
    }
    else {
        this.promise_data().then(function(data) {      
            var obj = map.getRepresentations(selection);
            map._elements.shadowEl.selectAll('path').remove();
            map._elements.shadowCropEl.selectAll('path').remove();
            obj.each(function() {
                map._elements.shadowEl.append('path')
                    .attr({
                        d: this.attributes.d.value,
                        fill: 'rgba(0,0,0,0.5)' //'#999'
                    });
                map._elements.shadowCropEl.append('path')
                    .attr({
                        d: this.attributes.d.value,
                        fill: '#fff'
                    });
            });
        });
    }
    return this;
};

/*
Call without parameters to get current selection.
Call with null to get all topology objects.
Call with function to filter geometries.
Call with string to filter geometries/layers based on identify().
Call with geometry to convert into d3 selection.

Returns a D3 selection.
*/
mapmap.prototype.getRepresentations = function(selection) {
    if (typeof selection == 'undefined') {
        selection = this.selected;
    }
    if (selection) {
        if (typeof selection == 'function') {
            return this._elements.geometry.selectAll('path').filter(function(d,i){
                return selection(d.properties);
            });
        }
        if (selection.__data__) {
            // is a geometry generated by d3 -> return selection
            return d3.select(selection);
        }
        // TODO: this should have a nicer API
        var obj = this.identify_func(this.layers, selection);
        if (!obj) return d3.select(null);
        // layer case
        if (obj.length) {
            return d3.selectAll(obj.map(function(d){return d.__repr__;}));
        }
        // object case
        return d3.select(obj.__repr__);
    }
    return this._elements.geometry.selectAll('path');
};

// TODO: this is an ugly hack for now, until we properly keep track of current merged data!
mapmap.prototype.getData = function(key, selection) {

    var map = this;
    
    return new Promise(function(resolve, reject) {
        map._promise.data.then(function(data) {
        
            data = dd.OrderedHash();
            
            map.getRepresentations(selection)[0].forEach(function(d){
                if (typeof d.__data__.properties[key] != 'undefined') {
                    data.push(d.__data__.properties[key], d.__data__.properties);
                }
            });
            
            resolve(data);
        });
    });
};

mapmap.prototype.promise_data = function(promise) {
    // chain a new promise to the data promise
    // this allows a more elegant API than Promise.all([promises])
    // since we use only a single promise the "encapsulates" the
    // previous ones
    
    // TODO: hide this._promise.data through a closure?
    
    // TODO: we only fulfill with most recent data - should
    // we not *always* fulfill with canonical data i.e. the
    // underlying selection, or keep canonical data and refresh
    // selection always?
    // Also, we need to keep data that has no entities in the geometry
    // e.g. for loading stats of aggregated entities. We could
    // use a global array of GeoJSON features, as this allows
    // either geometry or properties to be null -- fl 2015-11-21

    var map = this;
    
    if (promise) {
        if (this._promise.data) {
            this._promise.data = new Promise(function(resolve, reject) {
                map._promise.data.then(function(_) {
                    promise.then(function(data) {
                        resolve(data);
                    });
                });
            });
        }
        else {
            this._promise.data = promise;
        }
    }
    return this._promise.data;   
};

mapmap.prototype.then = function(callback) {
    this.promise_data().then(callback);
    return this;
};

// TODO: think about caching loaded resources (#8)
mapmap.prototype.data = function(spec, keyOrOptions) {

    var options = dd.isDictionary(keyOrOptions) ? keyOrOptions : {map: keyOrOptions};
    
    options = dd.merge({
        geometryKey: '__key__' // natural key
        // map: datdata default
        // reduce: datdata default
    }, options);
        
    var map = this;
    
    if (typeof spec == 'function') {
        this.promise_data().then(function(data){
            // TODO: this is a mess, see above - data
            // doesn't contain the actual canonical data, but 
            // only the most recently requested one, which doesn't
            // help us for transformations
            map._elements.geometry.selectAll('path')
            .each(function(geom) {
                if (geom.properties) {
                    var val = spec(geom.properties);
                    if (val) {
                        mapmap.extend(geom.properties, val);
                    }
                }
            });
        });
    }
    else {
        this.promise_data(dd(spec, options.map, options.reduce, options))
        .then(function(data) {
            if (data.length() == 0) {
                console.warn("Data for key '" + options.map + "' yielded no results!");
            }
            map._elements.geometry.selectAll('path')
                .each(function(d) {
                    if (d.properties) {
                        var k = d.properties[options.geometryKey];
                        if (k) {
                            mapmap.extend(d.properties, data.get(k));
                        }
                        else {
                            //console.warn("Key '" + options.geometryKey + "' not found in " + this + "!");
                        }    
                    }
                });
        });
    }
    return this;
};

var MetaDataSpec = function(key, fields) {
    // ensure constructor invocation
    if (!(this instanceof MetaDataSpec)) return new MetaDataSpec(key, fields);
    mapmap.extend(this, fields);
    this.key = key;
    return this;
};
MetaDataSpec.prototype.specificity = function() {
    // regex case. use length of string representation without enclosing /.../
    if (this.key instanceof RegExp) return this.key.toString()-2;
    // return number of significant letters
    return this.key.length - (this.key.match(/[\*\?]/g) || []).length;
};
MetaDataSpec.prototype.match = function(str) {
    if (this.key instanceof RegExp) return (str.search(this.key) == 0);
    var rex = new RegExp('^' + this.key.replace('*','.*').replace('?','.'));
    return (str.search(rex) == 0);
};
var MetaData = function(fields, localeProvider) {
    // ensure constructor invocation
    if (!(this instanceof MetaData)) return new MetaData(fields, localeProvider);
    mapmap.extend(this, fields);
    // take default from locale
    if (this.undefinedLabel === undefined) this.undefinedLabel = localeProvider.locale.undefinedLabel;
    
    this.format = function(val) {
        if (!this._format) {
            this._format = this.getFormatter();
        }
        // return undefined if undefined or if not a number but number formatting explicitly requested
        if (val === undefined || val === null || (this.numberFormat && (isNaN(val)))) {
            return this.undefinedValue;
        }
        return this._format(val);
    };
    this.getFormatter = function() {
        if (this.scale == 'ordinal' && this.valueLabels) {
            var scale = d3.scale.ordinal().domain(this.domain).range(this.valueLabels);
            return scale;
        }
        if (this.numberFormat && typeof this.numberFormat == 'function') {
            return this.numberFormat;
        }
        if (localeProvider.locale) {
            return localeProvider.locale.numberFormat(this.numberFormat || '.01f');
        }
        return d3.format(this.numberFormat || '.01f');
    };
    this.getRangeFormatter = function() {
        var fmt = this.format.bind(this);
        return function(lower, upper, excludeLower, excludeUpper) {
            if (localeProvider.locale && localeProvider.locale.rangeLabel) {
                return localeProvider.locale.rangeLabel(lower, upper, fmt, excludeLower, excludeUpper);
            }
            return defaultRangeLabel(lower, upper, fmt, excludeLower, excludeUpper);
        }
    };
    return this;
};

mapmap.prototype.meta = function(metadata){
    var keys = Object.keys(metadata);
    for (var i=0; i<keys.length; i++) {
        this.metadata_specs.push(MetaDataSpec(keys[i], metadata[keys[i]]));
    }
    this.metadata_specs.sort(function(a,b) {
        return a.specificity()-b.specificity();
    });
    return this;
};

mapmap.prototype.getMetadata = function(key) {
    if (!this.metadata) {
        this.metadata = {};
    }
    if (!this.metadata[key]) {
        var fields = mapmap.extend({}, this.settings.defaultMetadata);
        for (var i=0; i<this.metadata_specs.length; i++) {
            if (this.metadata_specs[i].match(key)) {
                mapmap.extend(fields, this.metadata_specs[i]);
            }
        }
        this.metadata[key] = MetaData(fields, this);
    }
    return this.metadata[key];
};

function getStats(data, valueFunc) {
    var stats = {
        count: 0,
        countNumbers: 0,
        anyNegative: false,
        anyPositive: false,
        anyStrings: false,
        min: undefined,
        max: undefined
    };
    function datumFunc(d) {
        var val = valueFunc(d);
        if (val !== undefined) {
            stats.count += 1;
            if (dd.isNumeric(val)) {
                val = +val;
                stats.countNumbers += 1;
                if (stats.min === undefined) stats.min = val;
                if (stats.max === undefined) stats.max = val;
                if (val < stats.min) stats.min = val;
                if (val > stats.max) stats.max = val;
                if (val > 0) stats.anyPositive = true;
                if (val < 0) stats.anyNegative = true;
            }
            else if (val) {
                stats.anyString = true;
            }
        }
    }
    if (data.each && typeof data.each == 'function') {
        data.each(datumFunc);
    }
    else {
        for (var i=0; i<data.length; i++) {
            datumFunc(data[i]);
        }
    }
    return stats;
}

function properties_accessor(func) {
    // converts a data callback function to access data's .properties entry
    // useful for processing geojson objects
    return function(data) {
        if (data.properties) return func(data.properties);
    };
}

mapmap.prototype.autoColorScale = function(value, metadata, selection) {
    
    if (!metadata) {
        metadata = this.getMetadata(value);
    }
    else {
        metadata = dd.merge(this.settings.defaultMetadata, metadata);
    }
    
    if (!metadata.domain) {
        var stats = getStats(this.getRepresentations(selection), properties_accessor(keyOrCallback(value)));
        
        if (stats.anyNegative && stats.anyPositive) {
            // make symmetrical
            metadata.domain = [Math.min(stats.min, -stats.max), Math.max(stats.max, -stats.min)];
        }
        else {
            metadata.domain = [stats.min,stats.max];
        }
    }
    // support d3 scales out of the box
    var scale = d3.scale[metadata.scale]();
    scale.domain(metadata.domain).range(metadata.color || metadata.colors)
    
    if (metadata.scale == 'ordinal' && !scale.invert) {
        // d3 ordinal scales don't provide invert method, so patch one here
        // https://github.com/mbostock/d3/pull/598
        scale.invert = function(x) {
            var i = scale.range().indexOf(x);
            return (i > -1) ? metadata.domain[i] : null;
        }
    }
    
    return scale;    
};

mapmap.prototype.autoLinearScale = function(valueFunc) {    
    var stats = getStats(this._elements.geometry.selectAll('path'), properties_accessor(valueFunc));    
    return d3.scale.linear()
        .domain([0,stats.max]);    
};
mapmap.prototype.autoSqrtScale = function(valueFunc) {    
    var stats = getStats(this._elements.geometry.selectAll('path'), properties_accessor(valueFunc));    
    return d3.scale.sqrt()
        .domain([0,stats.max]);    
};

mapmap.prototype.attr = function(name, value, selection) {
    if (dd.isDictionary(name) && value) {
        selection = value;
        value = undefined;
    }
    this.symbolize(function(repr) {
        // d3 checks for arguments.length, so we need to explicitly distinguish 
        // dictionary and name/value cases
        if (value === undefined) {
            repr.attr(name);
        }
        else {
            repr.attr(name, value);
        }
    }, selection);
    return this;
};

mapmap.prototype.zOrder = function(comparator, options) {
    
    options = dd.merge({
        undefinedValue: Infinity
    }, options);

    if (dd.isString(comparator)) {
        var fieldName = comparator;
        var reverse = false;
        if (fieldName[0] == "-") {
            reverse = true;
            fieldName = fieldName.substring(1);
        }
        comparator = function(a,b) {
            var valA = a.properties[fieldName],
                valB = b.properties[fieldName];
                
            if (!dd.isNumeric(valA)) {
                valA = options.undefinedValue;
            }
            if (!dd.isNumeric(valB)) {
                valB = options.undefinedValue;
            }
            var result = valA - valB;
            if (reverse) result *= -1;
            return result;
        }
    }
    
    var map = this;
    this.promise_data().then(function(data) {      
        map.getRepresentations()
            .sort(comparator);
    });
    return this;
};

mapmap.prototype.symbolize = function(callback, selection, finalize) {

    var map = this;
    
    // store in closure for later access
    selection = selection || this.selected;
    this.promise_data().then(function(data) {      
        map.getRepresentations(selection)
            .each(function(geom) {
                callback.call(map, d3.select(this), geom, geom.properties);
            });
        if (finalize) finalize.call(map);
    });
    return this;
};

mapmap.prototype.symbolizeAttribute = function(property, reprAttribute, options) {

    options = dd.merge({
        //metadata: null, // taken from map metadata
        metaAttribute: reprAttribute,
        selection: this.selected,
        legend: true
    }, options);

    var defaultUndefinedAttributes = {
        'stroke': 'transparent'  
    };
    
    var valueFunc = keyOrCallback(property);

    var map = this;
    
    this.promise_data().then(function(data) {      

        var metadata = options.metadata;
        
        if (dd.isString(metadata)) {
            metadata = map.getMetadata(metadata);
        }
        if (!metadata) {
            metadata = options.metadata || map.getMetadata(property);
        }

        var scale = d3.scale[metadata.scale]();
        scale.domain(metadata.domain).range(metadata[reprAttribute]);

        map.symbolize(function(el, geom, data) {
            el.attr(reprAttribute, function(geom) {
                var val = valueFunc(geom.properties);
                if (val == null || (metadata.scale != 'ordinal' && isNaN(val))) {
                    return (metadata.undefinedSymbols && metadata.undefinedSymbols[reprAttribute]) || defaultUndefinedAttributes[reprAttribute];
                }
                return scale(val);
            });
        }, options.selection);

        if (options.legend) {
            map.updateLegend(property, reprAttribute, metadata, scale, options.selection);
        }
    });
    
    return this;
    
}

// legacy method - this has moved to the mapmap.symbolize namespace
mapmap.prototype.choropleth = function(spec, metadata, selection) {

    this.symbolize(mapmap.symbolize.choropleth(spec, metadata, selection), selection, function(){
        this.dispatcher.choropleth.call(this, spec);
    });
    
    return this;
}

mapmap.symbolize = {};

// TODO: improve handling of using a function here vs. using a named property
// probably needs a unified mechanism to deal with property/func to be used elsewhere
mapmap.symbolize.choropleth = function(spec, metadata, selection) {    
    // we have to remember the scale for legend()
    var colorScale = null,
        valueFunc = keyOrCallback(spec),
        map = this;
        
    function color(el, geom, data) {
        if (spec === null) {
            // clear
            el.attr('fill', this.settings.pathAttributes.fill);
            return;
        }
        // on first call, set up scale & legend
        if (!colorScale) {
            // TODO: improve handling of things that need the data, but should be performed
            // only once. Should we provide a separate callback for this, or use the 
            // promise_data().then() for setup? As this could be considered a public API usecase,
            // maybe using promises is a bit steep for outside users?
            if (typeof metadata == 'string') {
                metadata = this.getMetadata(metadata);
            }
            if (!metadata) {
                metadata = this.getMetadata(spec);
            }
            colorScale = this.autoColorScale(spec, metadata, selection);
            this.updateLegend(spec, 'fill', metadata, colorScale, selection);
        }
        if (el.attr('fill') != 'none') {
            // transition if color already set
            el = el.transition();
        }
        el.attr('fill', function(geom) {           
            var val = valueFunc(geom.properties);
            // check if value is undefined or null
            if (val == null || (metadata.scale != 'ordinal' && isNaN(val))) {
                return metadata.undefinedColor || map.settings.pathAttributes.fill;
            }
            return colorScale(val) || map.settings.pathAttributes.fill;
        });
    }

    return color;
};


mapmap.symbolize.addLabel = function(spec, textAttributes) {
    
    textAttributes = dd.merge({
        stroke: '#ffffff',
        fill: '#000000',
        'font-size': 9,
        'paint-order': 'stroke fill',
        'alignment-baseline': 'middle',
        'text-anchor': 'middle',
        dx: 0,
        dy: 1
    }, textAttributes);


    var valueFunc = keyOrCallback(spec);
        
    return function(el, geom, data) {

        if (spec === null) {
            this.getOverlayPane().select('text').remove();
            return;
        }
        
        if (geom.properties && typeof valueFunc(geom.properties) != 'undefined') {
            var centroid = this.getPathGenerator().centroid(geom);
            this.getOverlayPane().append('text')
                .text(valueFunc(geom.properties))
                .attr(textAttributes)
                .attr({                    
                    x: centroid[0],
                    y: centroid[1]
                })
            ;
        }
    }
}

mapmap.symbolize.addTitle = addOptionalElement('title');
mapmap.symbolize.addDesc = addOptionalElement('desc');

function addOptionalElement(elementName) {
    return function(value) {
        var valueFunc = keyOrCallback(value);
        return function(el, d) {  
            if (value === null) {
                el.select(elementName).remove();
                return;
            }
            el.append(elementName)
                .text(valueFunc(d.properties));
        };
    };
}


var center = {
    x: 0.5,
    y: 0.5
};

mapmap.prototype.center = function(center_x, center_y) {
    center.x = center_x;
    if (typeof center_y != 'undefined') {
        center.y = center_y;
    }
    return this;
};
// store all hover out callbacks here, this will be called on zoom
var hoverOutCallbacks = [];

function callHoverOut() {
    for (var i=0; i<hoverOutCallbacks.length; i++) {
        hoverOutCallbacks[i]();
    }
}

var mouseover = null;

mapmap.showHover = function(el) {
    if (mouseover) {
        mouseover.call(el, el.__data__);
    }
};

mapmap.prototype.getAnchorForRepr = function(event, repr, options) {

    options = dd.merge({
        clipToViewport: true,
        clipMargins: {top: 40, left: 40, bottom: 0, right: 40}
    }, options);
    
    var bounds = repr.getBoundingClientRect();
    var pt = this._elements.main.node().createSVGPoint();
    
    pt.x = (bounds.left + bounds.right) / 2;
    pt.y = bounds.top;
    
    var mapBounds = this.getBoundingClientRect();
    
    if (options.clipToViewport) {  
        if (pt.x < mapBounds.left + options.clipMargins.left) pt.x = mapBounds.left + options.clipMargins.left;
        if (pt.x > mapBounds.right - options.clipMargins.right) pt.x = mapBounds.right - options.clipMargins.right;
        if (pt.y < mapBounds.top + options.clipMargins.top) pt.y = mapBounds.top + options.clipMargins.top;
        if (pt.y > mapBounds.bottom - options.clipMargins.bottom) pt.y = mapBounds.bottom - options.clipMargins.bottom;
    }
    pt.x -= mapBounds.left;
    pt.y -= mapBounds.top;

    return pt;
}

mapmap.prototype.getAnchorForMousePosition = function(event, repr, options) {
     
    options = dd.merge({
        anchorOffset: [0,-20]
     }, options);

     // http://www.jacklmoore.com/notes/mouse-position/
     var offsetX = event.layerX || event.offsetX,
         offsetY = event.layerY || event.offsetY;
    
    return {
        x: offsetX + options.anchorOffset[0],
        y: offsetY + options.anchorOffset[1]
    }
}


mapmap.prototype.hover = function(overCB, outCB, options) {

    options = dd.merge({
        moveToFront: true,
        clipToViewport: true,
        clipMargins: {top: 40, left: 40, bottom: 0, right: 40},
        selection: null,
        anchorPosition: this.getAnchorForRepr,
        hoverRepresentationStyle: {
            'pointer-events': 'visiblePainted'
        }
     }, options);
    
    var map = this;
    
    if (!this._oldPointerEvents) {
        this._oldPointerEvents = [];
    }
    
    this.promise_data().then(function() {
        var obj = map.getRepresentations(options.selection);
        mouseover = function(d) {
            // "this" is the SVG element, not the map!
            // move to top = end of parent node
            // this screws up IE event handling!
            if (options.moveToFront && map.supports.hoverDomModification) {
                // TODO: this should be solved via a second element to be placed in front!
                this.__hoverinsertposition__ = this.nextSibling;
                this.parentNode.appendChild(this);
            }
            
            var el = this,
                event = d3.event;
            
            var sel = d3.select(this);
            this._oldstyle = sel.attr('style');
            sel.style(options.hoverRepresentationStyle);
            
            // In Firefox the event positions are not populated properly in some cases
            // Defer call to allow browser to populate the event
            window.setTimeout(function(){
                var anchor = options.anchorPosition.call(map, event, el, options);           
                overCB.call(map, d.properties, anchor, el);   
            }, 10);
        };
        // reset previously overridden pointer events
        for (var i=0; i<map._oldPointerEvents.length; i++) {
            var pair = map._oldPointerEvents[i];
            pair[0].style('pointer-events', pair[1]);
        }
        map._oldPointerEvents = [];
        if (overCB) {
            obj
                .on('mouseenter', mouseover)
                .each(function(){
                    // TODO: not sure if this is the best idea, but we need to make sure
                    // to receive pointer events even if css disables them. This has to work
                    // even for complex (function-based) selections, so we cannot use containment
                    // selectors (e.g. .selected-foo .foo) for this...
                    // https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/pointer-events
                    var sel = d3.select(this);
                    map._oldPointerEvents.push([sel, sel.style('pointer-events')]);
                    // TODO: this should be configurable via options
                    //sel.style('pointer-events','all');
                    sel.style('pointer-events','visiblePainted');
                })
            ;
        }
        else {
            obj.on('mouseenter', function() {
                var sel = d3.select(this);
                this._oldstyle = sel.attr('style');
                sel.style(options.hoverRepresentationStyle);
            });
        }
        if (outCB) {
            obj.on('mouseleave', function() {
                if (this.__hoverinsertposition__) {
                    this.parentNode.insertBefore(this, this.__hoverinsertposition__);
                }
                d3.select(this).attr('style', this._oldstyle || '');
                // we need to defer this call as well to make sure it is
                // always called after overCB (see above Ffx workaround)
                window.setTimeout(function(){
                    outCB.call(map);   
                }, 10);
            });
            hoverOutCallbacks.push(outCB);
        }
        else {
            obj.on('mouseleave', function() {
                d3.select(this).attr('style', this._oldstyle || '');            
            });
        }          
    });
    return this;
};

mapmap.prototype.formatValue = function(d, attr) {
    var meta = this.getMetadata(attr),
        val = meta.format(d[attr]);
    if (val == 'NaN') val = d[attr];
    return val;
};

mapmap.prototype.buildHTMLFunc = function(spec) {
    // function case
    if (typeof spec == 'function') return spec;
    // string case
    if (spec.substr) spec = [spec];
    
    var map = this;
    
    var func = function(d) {
        var html = "",
            pre, post;
        for (var i=0; i<spec.length; i++) {
            var part = spec[i];
            if (part) {
                pre = (i==0) ? '<b>' : '';
                post = (i==0) ? '</b><br>' : '<br>';
                if (typeof part == 'function') {
                    var str = part.call(map, d);
                    if (str) {
                        html += pre + str + post;
                    }
                    continue;
                }
                var meta = map.getMetadata(part);
                var prefix = meta.hoverLabel || meta.valueLabel || meta.label || '';
                if (prefix) prefix += ": ";
                var val = meta.format(d[part]);
                if (val == 'NaN') val = d[part];
                // TODO: make option "ignoreUndefined" etc.
                if (val !== undefined && val !== meta.undefinedValue) {
                    html += pre + prefix + val + ( meta.valueUnit ? '&nbsp;' + meta.valueUnit : '') + post;
                }
                else if (meta.undefinedLabel) {
                    html += pre + prefix + meta.undefinedLabel + post;
                }
            }
        }
        return html;
    };
    
    return func;
};

mapmap.prototype.hoverInfo = function(spec, options) {

    options = dd.merge({
        selection: null,
        hoverClassName: 'hoverInfo',
        hoverStyle: {
            position: 'absolute',
            padding: '0.5em 0.7em',
            'background-color': 'rgba(255,255,255,0.85)',
            // avoid clipping DIV to right edge of map 
            'white-space': 'nowrap',
            'z-index': '2'
        },
        hoverEnterStyle: {
            display: 'block'
        },
        hoverLeaveStyle: {
            display: 'none'
        }
    }, options);
    
    var hoverEl = this._elements.parent.select('.' + options.hoverClassName);

    if (!spec) {
        return this.hover(null, null, options);
    }

    var htmlFunc = this.buildHTMLFunc(spec);
    if (hoverEl.empty()) {
        hoverEl = this._elements.parent.append('div').attr('class',options.hoverClassName);
    }
    hoverEl.style(options.hoverStyle);
    if (!hoverEl.mapmap_eventHandlerInstalled) {
        hoverEl.on('mouseenter', function() {
            hoverEl.style(options.hoverEnterStyle);
        }).on('mouseleave', function() {
            hoverEl.style(options.hoverLeaveStyle);
        });
        hoverEl.mapmap_eventHandlerInstalled = true;
    }
    
    function show(d, point){
    
        var html = htmlFunc(d);
        
        if (html) {
            // offsetParent only works for rendered objects, so place object first!
            // https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement.offsetParent
            hoverEl.style(options.hoverEnterStyle);  
            
            var offsetEl = hoverEl.node().offsetParent || hoverEl,
                mainEl = this._elements.main.node(),
                bounds = this.getBoundingClientRect(),
                offsetBounds = offsetEl.getBoundingClientRect(),
                scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0,
                scrollLeft = window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft || 0,
                top = bounds.top - offsetBounds.top,
                left = bounds.left - offsetBounds.left;

            if (getComputedStyle(offsetEl).getPropertyValue('position') == 'static') {
                console.warn("mapmap.js Warning: hoverInfo parent element needs to be positioned (relative or absolute) for positioning to work properly!");
            }
                
            hoverEl
                .style({
                    bottom: (offsetBounds.height - top - point.y) + 'px',
                    //top: point.y + 'px',
                    left: (left + point.x) + 'px'
                })
                .html(html);
        }
    }
    function hide() {
        hoverEl.style(options.hoverLeaveStyle);
    }
    
    return this.hover(show, hide, options);
};

// remove all symbology
// TODO: symbolizers should be registered somehow and iterated over here
mapmap.prototype.clear = function() {
    this.choropleth(null);
    this.proportional_circles(null);
    this.title(null);
    this.desc(null);
    return this;
};

// namespace for re-usable behaviors
mapmap.behavior = {};

mapmap.behavior.zoom = function(options) {

    options = dd.merge({
        event: 'click',
        cursor: 'pointer',
        fitScale: 0.7,
        animationDuration: 750,
        maxZoom: 8,
        hierarchical: false,
        showRing: true,
        ringRadius: 1.1, // relative to height/2
        zoomstart: null,
        zoomend: null,
        center: [center.x, center.y],
        ringAttributes: {
            stroke: '#000',
            'stroke-width': 6,
            'stroke-opacity': 0.3,
            'pointer-events': 'none',
            fill: 'none'
        },
        closeButton: function(parent) {
            parent.append('circle')
                .attr({
                    r: 10,
                    fill: '#fff',
                    stroke: '#000',
                    'stroke-width': 2.5,
                    'stroke-opacity': 0.9,
                    'fill-opacity': 0.9,
                    cursor: 'pointer'
                });
                
            parent.append('text')
                .attr({
                    'text-anchor':'middle',
                    cursor: 'pointer',
                    'font-weight': 'bold',
                    'font-size': '18',
                    y: 6
                })
                .text('×');
        },
        // TODO: how should highlighting work on the map generally?
        // maybe more like setState('highlight') and options.activestyle = 'highlight' ?
        activate: function(el) {
            d3.select(el).classed('active', true);
        },
        deactivate: function(el) {
            if (el) d3.select(el).classed('active', false);
        }        
    }, options);
    
    var ring = null,
        map = null,
        r, r0,
        zoomed = null;
    
    var z = function(selection) {
            
        map = this;

        var size = this.size();
        
        r = Math.min(size.height, size.width) / 2.0 * options.ringRadius;
        r0 = Math.sqrt(size.width*size.width + size.height*size.height) / 1.5;
            
        if (options.cursor) {
            selection.attr({
                cursor: options.cursor
            });
        }
        
        if (options.showRing && !ring) {
            ring = map.getFixedPane().selectAll('g.zoomRing')
                .data([1]);
            
            var newring = ring.enter()
                .append('g')
                .attr('class','zoomRing')
                .attr('transform','translate(' + size.width * options.center[0] + ',' + size.height * options.center[1] + ')');
                       
            newring.append('circle')
                .attr('class', 'main')
                .attr('r', r0)
                .attr(options.ringAttributes);
                
            var close = newring.append('g')
                .attr('class','zoomOut')
                .attr('transform','translate(' + (r0 * 0.707) + ',-' + (r0 * 0.707) + ')');
                        
            if (options.closeButton) {
                options.closeButton(close);
            }
            
        }

        // this is currently needed if e.g. search zooms to somewhere else,
        // but map is still zoomed in through this behavior
        // do a reset(), but without modifying the map view (=zooming out)
        map.on('view', function(translate, scale) {
            if (zoomed && scale == 1) {
                zoomed = null;
                animateRing(null);
                map._elements.map.select('.background').on(options.event + '.zoom', null);
                options.zoomstart && options.zoomstart.call(map, null);
                options.zoomend && options.zoomend.call(map, null);
            }
        });
                
        selection.on(options.event, function(d) {
            callHoverOut();
            if (zoomed == this) {
                reset();
            }
            else {
                options.deactivate(zoomed);
                var el = this;
                options.zoomstart && options.zoomstart.call(map, el);
                map.zoomToSelection(this, {
                    callback: function() {
                        options.zoomend && options.zoomend.call(map, el);
                    },
                    maxZoom: options.maxZoom,
                    center: options.center
                });
                animateRing(this);
                options.activate(this);
                zoomed = this;
                map._elements.map.select('.background').on(options.event + '.zoom', reset);
            }
        });

        if (zoomed) {
            options.zoomstart && options.zoomstart.call(map, zoomed);
            options.zoomend && options.zoomend.call(map, zoomed);
        }

    };
    
    function zoomTo(selection) {
        options.zoomstart && options.zoomstart.call(map, selection);
        map.zoomToSelection(selection, {
            callback: function() {
                options.zoomend && options.zoomend.call(map, selection);
            },
            maxZoom: options.maxZoom,
            center: options.center
        });
        animateRing(selection);
        zoomed = selection;
        map._elements.map.select('.background').on(options.event + '.zoom', reset);
    }

    function animateRing(selection) {
        if (ring) {
            var new_r = (selection) ? r : r0;
            
            ring.select('circle.main').transition().duration(options.animationDuration)
                .attr({
                    r: new_r
                })
            ;
            ring.select('g.zoomOut').transition().duration(options.animationDuration)
                .attr('transform', 'translate(' + (new_r * 0.707) + ',-' + (new_r * 0.707) + ')'); // sqrt(2) / 2

            // caveat: make sure to assign this every time to apply correct closure if we have multiple zoom behaviors!!
            ring.select('g.zoomOut').on('click', reset);
        }
    }
        
    function reset() {
        if (map) {
            options.deactivate(zoomed);
            zoomed = null;
            map.resetZoom();
            animateRing(null);
            map._elements.map.select('.background').on(options.event + '.zoom', null);
            if (options.zoomstart) {
                options.zoomstart.call(map, null);
            }
            if (options.zoomend) {
                options.zoomend.call(map, null);
            }
        }
    }
    
    z.reset = reset;
    
    z.active = function() {
        return zoomed;
    };   

    z.remove = function() {
        reset();
    };
        
    z.from = function(other){
        if (other && other.active) {
            zoomed = other.active();
            /*
            if (zoomed) {
                zoomTo(zoomed);
            }
            */
            // TODO: make up our mind whether this should remove the other behavior
            // in burgenland_demographie.html, we need to keep it as it would otherwise zoom out
            // but if we mix different behaviors, we may want to remove the other one automatically
            // (or maybe require it to be done manually)
            // in pendeln.js, we remove the other behavior here, which is inconsistent!
            
            //other.remove();
        }
        return z;
    };
    
    return z;
};

mapmap.prototype.animateView = function(translate, scale, callback, duration) {

    duration = duration || 750;
    
    if (translate[0] == this.current_translate[0] && translate[1] == this.current_translate[1] && scale == this.current_scale) {
        // nothing to do
        // yield to simulate async callback
        if (callback) {
            window.setTimeout(callback, 10);
        }
        return this;
    }
    this.current_translate = translate;
    this.current_scale = scale;
    callHoverOut();
    var map = this;
    this._elements.map.transition()
        .duration(duration)
        .call(map.zoom.translate(translate).scale(scale).event)
        .each('start', function() {
            map._elements.shadowGroup.attr('display','none');
        })
        .each('end', function() {
            map._elements.shadowGroup.attr('display','block');
            if (callback) {
                callback();
            }
        })
        .each('interrupt', function() {
            map._elements.shadowGroup.attr('display','block');
            // not sure if we should call callback here, but it may be non-intuitive
            // for callback to never be called if zoom is cancelled
            if (callback) {
                callback();
            }
        });        
    this.dispatcher.view.call(this, translate, scale);
    return this;
};

mapmap.prototype.setView = function(translate, scale) {

    translate = translate || this.current_translate;
    scale = scale || this.current_scale;
    
    this.current_translate = translate;
    this.current_scale = scale;
      
    // do we need this?
    //callHoverOut();

    this.zoom.translate(translate).scale(scale).event(this._elements.map);

    this.dispatcher.view.call(this, translate, scale);
    return this;
};

mapmap.prototype.getView = function() {
    return {
        translate: this.current_translate,
        scale: this.current_scale
    }
};

mapmap.prototype.zoomToSelection = function(selection, options) {
    
    options = dd.merge({
        fitScale: 0.7,
        animationDuration: 750,
        maxZoom: 8,
        center: [center.x, center.y]
    }, options);

    var sel = this.getRepresentations(selection),
        bounds = [[Infinity,Infinity],[-Infinity, -Infinity]],
        pathGenerator = this.getPathGenerator();
    
    sel.each(function(el){
        var b = pathGenerator.bounds(el);
        bounds[0][0] = Math.min(bounds[0][0], b[0][0]);
        bounds[0][1] = Math.min(bounds[0][1], b[0][1]);
        bounds[1][0] = Math.max(bounds[1][0], b[1][0]);
        bounds[1][1] = Math.max(bounds[1][1], b[1][1]);
    });
    
    var dx = bounds[1][0] - bounds[0][0],
        dy = bounds[1][1] - bounds[0][1],
        x = (bounds[0][0] + bounds[1][0]) / 2,
        y = (bounds[0][1] + bounds[1][1]) / 2,
        size = this.size(),
        scale = Math.min(options.maxZoom, options.fitScale / Math.max(dx / size.width, dy / size.height)),
        translate = [size.width * options.center[0] - scale * x, size.height * options.center[1] - scale * y];
    this.animateView(translate, scale, options.callback, options.animationDuration);
    return this;
};

mapmap.prototype.zoomToBounds = function(bounds, callback, duration) {
    var w = bounds[1][0]-bounds[0][0],
        h = bounds[1][1]-bounds[0][1],
        cx = (bounds[1][0]+bounds[0][0]) / 2,
        cy = (bounds[1][1]+bounds[0][1]) / 2,
        size = this.size(),
        scale = Math.min(2, 0.9 / Math.max(w / size.width, h / size.height)),
        translate = [size.width * 0.5 - scale * cx, size.height * 0.5 - scale * cy];
    
    return this.animateView(translate, scale, callback, duration);
};

mapmap.prototype.zoomToCenter = function(center, scale, callback, duration) {

    scale = scale || 1;
    
    var size = this.size(),
        translate = [size.width * 0.5 - scale * center[0], size.height * 0.5 - scale * center[1]];

    return this.animateView(translate, scale, callback, duration);
};

mapmap.prototype.zoomToViewportPosition = function(center, scale, callback, duration) {

    var point = this._elements.main.node().createSVGPoint();

    point.x = center[0];
    point.y = center[1];

    var ctm = this._elements.geometry.node().getScreenCTM().inverse();
    point = point.matrixTransform(ctm);

    point = [point.x, point.y];
    
    scale = scale || 1;
    
    //var point = [(center[0]-this.current_translate[0])/this.current_scale, (center[1]-this.current_translate[1])/this.current_scale];
    
    return this.zoomToCenter(point, scale, callback, duration);
};

mapmap.prototype.resetZoom = function(callback, duration) {
    return this.animateView([0,0],1, callback, duration);
    // TODO take center into account zoomed-out, we may not always want this?
    //doZoom([width * (center.x-0.5),height * (center.y-0.5)],1);
};


// Manipulate representation geometry. This can be used e.g. to register event handlers.
// spec is a function to be called with selection to set up event handler
mapmap.prototype.applyBehavior = function(spec, selection) {

    assert(dd.isFunction(spec), "Behavior must be a function");
    
    var map = this;
    this._promise.geometry.then(function(topo) {
        var sel = map.getRepresentations(selection);
        // TODO: this should be configurable via options
        // and needs to integrate with managing pointer events (see hoverInfo)
        sel.style('pointer-events','visiblePainted');
        spec.call(map, sel);
    });
    return this;
};


// apply a behavior on the whole map pane (e.g. drag/zoom etc.)
mapmap.prototype.applyMapBehavior = function(spec) {
    spec.call(this, this._elements.map);
    return this;
};


// deprecated methods using UK-spelling
mapmap.prototype.applyBehaviour = function(spec, selection) {
    console && console.log && console.log("Deprecation warning: applyBehaviour() is deprecated, use applyBehavior() (US spelling) instead!");
    return this.applyBehavior(spec, selection);
}
mapmap.prototype.applyMapBehaviour = function(spec, selection) {
    console && console.log && console.log("Deprecation warning: applyMapBehaviour() is deprecated, use applyMapBehavior() (US spelling) instead!");
    return this.applyMapBehavior(spec, selection);
}

// handler for high-level events on the map object
mapmap.prototype.on = function(eventName, handler) {
    this.dispatcher.on(eventName, handler);
    return this;
};

function defaultRangeLabel(lower, upper, format, excludeLower, excludeUpper) {
    var f = format || function(lower){return lower};
        
    if (isNaN(lower)) {
        if (isNaN(upper)) {
            console.warn("rangeLabel: neither lower nor upper value specified!");
            return "";
        }
        else {
            return (excludeUpper ? "under " : "up to ") + f(upper);
        }
    }
    if (isNaN(upper)) {
        return excludeLower ? ("more than " + f(lower)) : (f(lower) + " and more");
    }
    return (excludeLower ? '> ' : '') + f(lower) + " to " + (excludeUpper ? '<' : '') + f(upper);
}

var d3_locales = {
    'en': {
        decimal: ".",
        thousands: ",",
        grouping: [ 3 ],
        currency: [ "$", "" ],
        dateTime: "%a %b %e %X %Y",
        date: "%m/%d/%Y",
        time: "%H:%M:%S",
        periods: [ "AM", "PM" ],
        days: [ "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday" ],
        shortDays: [ "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" ],
        months: [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ],
        shortMonths: [ "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" ],
        rangeLabel: defaultRangeLabel,
        undefinedLabel: "no data"
    },
    'de': {
        decimal: ",",
        thousands: ".",
        grouping: [3],
        currency: ["€", ""],
        dateTime: "%a %b %e %X %Y",
        date: "%d.%m.%Y",
        time: "%H:%M:%S",
        periods: ["AM", "PM"],
        days: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
        shortDays: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
        months: ["Jänner", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
        shortMonths: ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sep.", "Okt.", "Nov.", "Dez."],
        rangeLabel: function(lower, upper, format, excludeLower, excludeUpper) {
            var f = format || function(lower){return lower};
                
            if (isNaN(lower)) {
                if (isNaN(upper)) {
                    console.warn("rangeLabel: neither lower nor upper value specified!");
                    return "";
                }
                else {
                    return (excludeUpper ? "unter " : "bis ") + f(upper);
                }
            }
            if (isNaN(upper)) {
                return (excludeLower ? "mehr als " + f(lower) : f(lower) + " und mehr");
            }
            return (excludeLower ? '> ' : '') + f(lower) + " bis " + (excludeUpper ? '<' : '') + f(upper);
        },
        undefinedLabel: "keine Daten"
    }
};


mapmap.prototype.setLocale = function(lang){
    var locale;
    if (dd.isString(lang) && d3_locales[lang]) {
        locale = d3_locales[lang];
    }
    else {
        locale = lang;
    }
    this.locale = d3.locale(locale);
    
    // D3's locale doesn't support extended attributes,
    // so copy them over manually
    var keys = Object.keys(locale);
    for (var i=0; i<keys.length; i++) {
        var key = keys[i];
        if (!this.locale[key]) {
            this.locale[key] = locale[key];
        }
    }

    return this;
}

mapmap.prototype.options = function(spec, value) {

    // locale can be set through options but needs to be set up, so keep track of this here
    var oldLocale = this.settings.locale;

    mapmap.extend(this.settings, spec);
    
    if (this.settings.locale != oldLocale) {
        this.setLocale(this.settings.locale);
    }

    return this;
};

mapmap.prototype.legend = function(legend_func) {
    this.legend_func = legend_func;
    return this;
}
mapmap.prototype.updateLegend = function(attribute, reprAttribute, metadata, scale, selection) {

    if (!this.legend_func || !scale) {
        return this;
    }
    
    if (typeof metadata == 'string') {
        metadata = mapmap.getMetadata(metadata);
    }
    
    var range = scale.range(),
        classes,
        map = this; 

    var histogram = (function() {
        var data = null;
        return function(value) {
            // lazy initialization of histogram
            if (data == null) {
                data = {};
                var reprs = map.getRepresentations(selection)[0];
                reprs.forEach(function(repr) {
                    var val = repr.__data__.properties[attribute];
                    // make a separate bin for null/undefined values
                    // values are also invalid if numeric scale and non-numeric value
                    if (val == null || (metadata.scale != 'ordinal' && isNaN(val))) {
                        val = null;
                    }
                    else {
                        val = scale(val);
                    }
                    if (!data[val]) {
                        data[val] = [repr];
                    }
                    else {
                        data[val].push(repr);
                    }
                });
            }
            return data[value] || [];
        }
    })();
    
    function counter(r) {
        return function() {
            return histogram(r).length;
        }
    }   
    
    function objects(r) {
        return function() {
            return histogram(r);
        }
    }   
    
    // the main distinction is:
    // whether we have an output range divided into classes, or a continuous range
    // in the d3 API, numeric scales with a discrete range have an invertExtent method
    if (scale.invertExtent) {
        //classes = [scale.invertExtent(range[0])[0]];
        classes = range.map(function(r, i) {
            var extent = scale.invertExtent(r);
            // if we have too many items in range, both entries in extent will be undefined - ignore
            if (extent[0] == null && extent[1] == null) {
                console.warn("range for " + metadata.key + " contains superfluous value '" + r + "' - ignoring!");
                return null;
            }
            return {
                representation: r,
                valueRange: extent,
                includeLower: false,
                includeUpper: i<range.length-1,
                // lazy accessors - processing intensive
                count: counter(r),
                objects: objects(r)
                //TODO: other / more general aggregations?
            };
        })
        .filter(function(d){return d;});
    }
    else {
        // ordinal and continuous-range scales
        classes = range.map(function(r, i) {
            var value = undefined;
            if (scale.invert) {
                value = scale.invert(r);
            }
            return({
                representation: r,
                value: value,
                // lazy accessors - processing intensive
                count: counter(r),  
                objects: objects(r)
            });
        });
    }
    
    var undefinedClass = null;
    // TODO: hack to get undefined color box
    if (reprAttribute == 'fill' && (metadata.undefinedColor != 'transparent' || (metadata.undefinedSymbols && metadata.undefinedSymbols.fill != 'transparent'))) {
        undefinedClass = {
            representation: metadata.undefinedColor || metadata.undefinedSymbols.fill,
            'class': 'undefined',
            count: counter(null),
            objects: objects(null)
        };
    }
    else if (metadata.undefinedSymbols && metadata.undefinedSymbols[reprAttribute]) {
        undefinedClass = {
            representation: metadata.undefinedSymbols[reprAttribute],
            'class': 'undefined',
            count: counter(null),
            objects: objects(null)
        };
    }
    
    this.legend_func.call(this, attribute, reprAttribute, metadata, classes, undefinedClass);
                    
    return this;

};

function valueOrCall(spec) {
    if (typeof spec == 'function') {
        return spec.apply(this, Array.prototype.slice.call(arguments, 1));
    }
    return spec;
}

// namespace for legend generation functions
mapmap.legend = {};

mapmap.legend.html = function(options) {

    var DEFAULTS = {
        legendClassName: 'mapLegend',
        legendStyle: {},
        cellStyle: {},
        colorBoxStyle: {
            overflow: 'hidden',
            display: 'inline-block',
            width: '3em',
            height: '1.5em',
            'vertical-align': '-0.5em',
            //border: '1px solid #444444',
            margin: '0 0.5em 0.2em 0'
        },
        colorFillStyle: {
            width: '0',
            height: '0',
            'border-width': '100px',
            'border-style': 'solid',
            'border-color': '#ffffff'
        },
        labelStyle: {},
        histogramBarStyle: {
            'display': 'inline-block',
            height: '1.1em',
            'font-size': '0.8em',
            'vertical-align': '0.1em',
            color: '#999999',
            'background-color': '#dddddd'
        },
        histogramBarWidth: 1,
        reverse: false,
        order: null
    };
    
    options = mapmap.extend(DEFAULTS, options);
    
    function parameterFunction(param, func) {
        if (dd.isFunction(param)) return param;
        return func(param);
    }
    
    options.histogramBarWidth = parameterFunction(options.histogramBarWidth, function(param) {
        return function(count) {
            var width = count * param;
            // always round up small values to make sure at least 1px wide
            if (width > 0 && width < 1) width = 1;
            return width;
        };
    });
    
    var legend_func = function(attribute, reprAttribute, metadata, classes, undefinedClass) {
    
        var legend = this._elements.parent.select('.' + options.legendClassName);
        if (legend.empty()) {
            legend = this._elements.parent.append('div')
                .attr('class',options.legendClassName);
        }
        
        legend.style(options.legendStyle);
        
        // TODO: attribute may be a function, so we cannot easily generate a label for it
        var title = legend.selectAll('h3')
            .data([valueOrCall(metadata.label, attribute) || (dd.isString(attribute) ? attribute : '')]);
            
        title.enter().append('h3');
        
        title.html(function(d){return d;});
        
        // we need highest values first for numeric scales
        if (metadata.scale != 'ordinal') {
            classes.reverse();
        }
        if (options.reverse) {
            classes.reverse();
        }
        if (undefinedClass) {
            classes.push(undefinedClass);
        }
        
        if (options.order) {
            assert(dd.isFunction(options.order), "LegendOptions.order must be a comparator function!");
            classes.sort(options.order);       
        }
        
        var cells = legend.selectAll('div.legendCell')
            .data(classes);
        
        cells.exit().remove();
        
        var newcells = cells.enter()
            .append('div')
            .style(options.cellStyle);
        
        cells
            .attr('class', 'legendCell')
            .each(function(d) {
                if (d.class) {
                    d3.select(this).classed(d.class, true);
                }
            });
        
        function updateRepresentations(newcells, cells, options) {
        
            newcells = newcells.append('svg')
                .attr('class', 'legendColor')
                .style(options.colorBoxStyle);
                
            if (reprAttribute == 'fill') {
                newcells.append('rect')
                    .attr({
                        width: 100,
                        height: 100
                    })
                    .attr({
                        'fill': function(d) {return d.representation;}
                    });
                    
                cells.select('.legendColor rect')
                    .transition()
                    .attr({
                        'fill': function(d) {return d.representation;}
                    });
            }
            else if (reprAttribute == 'stroke') {
            
                // construct attributes object from reprAttribute variable
                var strokeAttrs = {};
                strokeAttrs[reprAttribute] = function(d) {return d.representation;};
                
                newcells.append('line')
                    .attr({
                        y1: 10,
                        y2: 10,
                        x1: 5,
                        x2: 100,
                        stroke: '#000000',
                        'stroke-width': 3
                    })
                    .attr(strokeAttrs);
                    
                cells.select('.legendColor rect')
                    .transition()
                    .attr(strokeAttrs);

            }
        }
        
        updateRepresentations(newcells, cells, options);
        
        newcells.append('span')
            .attr('class','legendLabel')
            .style(options.labelStyle);

        cells.attr('data-count',function(d) {return d.count();});
        
        cells.select('.legendLabel')
            .text(function(d) {
                var formatter;
                // TODO: we need some way of finding out whether we have intervals or values from the metadata
                // to cache the label formatter
                if (d.valueRange) {
                    formatter = metadata.getRangeFormatter();
                    return formatter(d.valueRange[0], d.valueRange[1], d.includeLower, d.includeUpper);
                }
                if (d.value) {
                    formatter = metadata.getFormatter();
                    return formatter(d.value);
                }
                return metadata.undefinedLabel;
            });
            
        if (options.histogram) {

            newcells.append('span')
                .attr('class', 'legendHistogramBar')
                .style(options.histogramBarStyle);

            cells.select('.legendHistogramBar').transition()
                .style('width', function(d){
                    var width = options.histogramBarWidth(d.count());
                    // string returned? -> use unchanged
                    if (width.length && width.indexOf('px') == width.lenght - 2) {
                        return width;
                    }
                    return Math.round(width) + 'px';
                })
                .text(function(d) { return ' ' + d.count(); });
        }
        
        if (options.callback) options.callback();
    }
    
    legend_func.clear = function() {
        this._elements.parent.select('.' + options.legendClassName).remove();
    }
    
    return legend_func;
}

mapmap.prototype.projection = function(projection) {
    if (projection === undefined) return this._projection;
    this._projection = projection;
    this._pathGenerator = d3.geo.path().projection(projection);
    return this;
}

mapmap.prototype.project = function(point) {
    return this._projection(point);
};

mapmap.prototype.getPathGenerator = function() {
    return this._pathGenerator;
}

mapmap.prototype.extent = function(selection, options) {

    var map = this;
    
    this.selected_extent = selection || this.selected;
    
    this._promise.geometry.then(function(topo) {
        // TODO: getRepresentations() depends on <path>s being drawn, but we want to 
        // be able to call extent() before draw() to set up projection
        // solution: manage merged geometry + data independent from SVG representation
        var geom = map.getRepresentations(map.selected_extent);
        var all = {
            'type': 'FeatureCollection',
            'features': []
        };
        geom.each(function(d){
            all.features.push(d);
        });

        map._extent(all, options);
    });
    return this;
};

mapmap.prototype._extent = function(geom, options) {

    options = dd.merge({
        fillFactor: 0.9
    }, options);
    
    // convert/merge topoJSON
    if (geom.type && geom.type == 'Topology') {
        // we need to merge all named features
        var names = Object.keys(geom.objects);
        var all = [];
        for (var i=0; i<names.length; i++) {
            all = all.concat(topojson.feature(geom, geom.objects[names[i]]).features);
        }
        geom = all;
    }
    if (dd.isArray(geom)) {
        var all = {
            'type': 'FeatureCollection',
            'features': geom
        };
        geom = all;
    }
    
    // reset scale to be able to calculate extents of geometry
    this._projection.scale(1).translate([0, 0]);
    var pathGenerator = this.getPathGenerator();
    var bounds = pathGenerator.bounds(geom);
    // use absolute values, as east does not always have to be right of west!
    bounds.height = Math.abs(bounds[1][1] - bounds[0][1]);
    bounds.width = Math.abs(bounds[1][0] - bounds[0][0]);
    
    // if we are not centered in midpoint, calculate "padding factor"
    var fac_x = 1 - Math.abs(0.5 - center.x) * 2,
        fac_y = 1 - Math.abs(0.5 - center.y) * 2;
        
    var size = this.size();
    var scale = options.fillFactor / Math.max(bounds.width / size.width / fac_x, bounds.height / size.height / fac_y);
    
    this._projection
        .scale(scale)
        .translate([(size.width - scale * (bounds[1][0] + bounds[0][0]))/ 2, (size.height - scale * (bounds[1][1] + bounds[0][1]))/ 2]);  
    
    // apply new projection to existing paths
    this._elements.map.selectAll("path")
        .attr("d", pathGenerator);        
    
};

function keyOrCallback(val) {
    if (typeof val != 'function') {
        return function(d){
            return d[val];
        };
    }
    return val;
}

module.exports = mapmap;
},{"datadata":1}]},{},[3])(3)
});