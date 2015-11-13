# mapmap.js Changelog

## Upcoming (0.2.7) / master branch

- Greatly improved handling of missing, empty or invalid values (#23)
- Internal changes to legend generation code to make it more versatile, improve labeling of ranges on the way (#11, #22)
- Optional generation of histogram in HTML legend
- Remove dead code for SVG legend, should be recreated in the future 
- New metadata fields `valueUnit`, `undefinedLabel` and `undefinedColor` (See [documentation](https://github.com/floledermann/mapmap.js/wiki/API-Documentation#metadata-fields)).
- Improved positioning of hoverInfo (tooltips) when scrolled, fixed obscure Firefox bug for positioning them.
- Warn if mapReduce transformation yielded no results
- Provide `activate` and `deactivate` functions for zoom behavior to style active element
- Fix bug causing zoom behavior to fail if no hoverInfo was active (#18)
- Fix usage of `center` option for zoom behavior
- Output warning message if Promise is missing (e.g. IE) and needs to be polyfilled

## 0.2.6

- Fix bug in hoverInfo introduced in 0.2.5

## 0.2.5

- Browser compatibility fixes for map resizing and hoverInfo positioning (#13)
- Support passing a file handler for customized parsing to `.data()` through the fileHandler option (#15).
- Support passing an accessor/row-conversion function to `.data()` through the `accessor` option (#10).

## 0.2.4

- Do not add inline CSS border to HTML legend color boxes - this can be easily added through CSS
- Upstream syntax fix in datadata library (#9)

## 0.2.3

- extent() now only modifies the projections scale and translation, leaving center alone. This allows using rotated projections.
- Support for TSV files
- Renamed `applyBehaviour()` -> `applyBehavior()`, `applyMapBehaviour()` -> `applyMapBehavior()` for consistent US spelling.
- Improved formatting of ranges for HTML legend

## 0.2.2

- Initial public release