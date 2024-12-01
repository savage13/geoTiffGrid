# geoTiffGrid
Leaflet plugin for viewing geoTiffs

![example of geotiffgrid](https://github.com/savage13/geoTiffGrid/blob/main/example.png?raw=true)

## Features
 - Displays large geoTiff files on a Leaflet map
   - [Cloud Optimized GeoTiff](https://cogeo.org/)
   - Data is organized into tiles (256x256) using a canvas backend
 - Applies a colormap to elevation data (DEMs)
   - Colormap scaling (or rescaling) preserving zero
   - Applying a color to noData
 - Hillshading
   - Computed or Downloaded for each tile (optional)
   - Computed hillshade is multidimensional
   - Hillshade is blended using the canvas' `globalCompositeOperation = overlay`
   - Gamma correction for hillshade (optional)
 - Color application and Hillshading use [WebWorkers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)

This has only been tested on Elevation data, single value per pixel.

## Requires 
 - [Leaflet](https://leafletjs.com/)
 - [geotiff.js](https://geotiffjs.github.io/)

## License
BSD 2-Clause
