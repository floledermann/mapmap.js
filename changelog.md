# mapmap.js Changelog

- support passing a file handler for customized parsing to `.data()` through the fileHandler option (#15).
- support passing an accessor/row-conversion function to `.data()` through the `accessor` option (#10).

## 0.2.4

- do not add inline CSS border to HTML legend color boxes - this can be easily added through CSS
- upstream syntax fix in datadata library (#9)

## 0.2.3

- extent() now only modifies the projections scale and translation, leaving center alone. This allows using rotated projections.
- Support for TSV files
- renamed `applyBehaviour()` -> `applyBehavior()`, `applyMapBehaviour()` -> `applyMapBehavior()` for consistent US spelling.
- improved formatting of ranges for HTML legend

## 0.2.2

- Initial public release