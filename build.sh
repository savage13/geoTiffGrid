#!/bin/bash

cp src/rasterizer.js ./src/rasterizer.txt
npx esbuild --outfile=dist/geoTiffGrid.js \
    ./src/tiffgrid.js \
    --bundle \
    --format=esm
