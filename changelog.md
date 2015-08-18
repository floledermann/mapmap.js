# mapmap.js Changelog

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