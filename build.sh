#!/bin/bash

cp rasterizer.js rasterizer.txt
npx esbuild --outfile=geoTiffGrid.js ./tiffgrid.js --bundle --format=esm
