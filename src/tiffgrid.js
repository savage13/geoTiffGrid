// Must be a Tiff in 4326 (WGS84)
// STATISTICS_MINIMUM
// STATISTICS_MAXIMUM
// Multiple scales

/*
gdalwarp -of COG -r bilinear \
         -t_srs EPSG:4326 \
         input.tif output.tif \
         -co STATISTICS=YES \
         -co COMPRESS=LERC_DEFLATE \
         -co MAX_Z_ERROR=0.1

STATISTICS requires gdal version 3.8

*/

import { Colormap } from './colormap.js'
export { Colormap } from "./colormap.js"
import rasterizer from './rasterizer.txt'


L.GeoTiffGrid = L.GridLayer.extend({
    options: {
        colormap: new Colormap([[0,0,0,1], [1,1,1,1]]),
        scale_color: true,
        noValue: undefined,
        noValueColor: [0,0,0,0],
        hill_auto: false,
        hill_url: undefined,
        hill_colormap: new Colormap([[0,0,0,0,1], [255,1,1,1,1]]),
        hill_scale_color: false,
        hill_noValue: undefined,
        hill_noValueColor: [0,0,0,0],
        hill_gamma_correct: 1.0,
        msg_id: "progress",
    },
    initialize: function(url, options) {
        this.url = url
        this.cog = undefined
        this.hill = undefined
        this.image = undefined
        this.meta = undefined
        this.hill_meta = undefined
        L.setOptions(this, options)
        this.blobURL = undefined
    },
    onAdd: function() {
        this._initContainer();
        this._levels = {};
        this._tiles = {};
        this.msg_id = this.options.msg_id
        // Get Tiff
        //  then get First Image
        //  store metadaa
        //    - requires NoData valus
        //    - Statistics Min/Max (for scaling)
        let p1 = load_geotiff(this.url)
        let p2 = load_geotiff(this.options.hill_url)
        let p3 = load_rasterizer("./rasterizer.js")

        Promise.all([p1,p2,p3]).then(vals => {
            this.cog = vals[0].tiff
            if(!this.cog)
                return
            this.meta = vals[0].meta
            this.hill = vals[1].tiff
            this.hill_meta = vals[1].meta
            this.blobURL = vals[2]

            if(this.options.scale_color)
                this.options.colormap.limits(this.meta.min, this.meta.max)
            if(this.options.hill_scale_color && this.hill_meta)
                this.options.hill_colormap.limits(this.hill_meta.min, this.hill_meta.max)

            if(this.options.noValue === undefined)
                this.options.colormap.noValue(this.meta.noData, this.options.noValueColor)
            if(this.options.hill_noValue == undefined && this.hill_meta)
                this.options.hill_colormap.noValue(this.hill_meta.noData,
                                                   this.options.hill_noValueColor)
            if(this.hill === undefined) {
                this.options.hill_colormap.noValue(-1.0, this.options.hill_noValueColor)
            }
            this._resetView()
        })
        return
    },
    // https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
    xyz2ll: function(p, shift = 0) {
        // Convert tile xyz to (lat, lng)
        const n = Math.pow(2,p.z)
        let lng = (p.x + shift) / n * 360.0 - 180.0
        let lat_rad = Math.atan(Math.sinh(Math.PI * (1 - 2 * (p.y + shift) / n)))
        let lat = lat_rad * 180.0 / Math.PI
        return {lat, lng}
    },
    createTile: function(coords, done) {
        // Create canvas tile and draw on the tile
        const tile = L.DomUtil.create('canvas', 'leaflet-tile');
        const size = this.getTileSize()
        tile.width = size.x
        tile.height = size.y
        return this.load_tile(tile, coords, done)
    },
    elevation: async function(pt) {
        // Read a single pixel of the Tiff
        const fillValue = -9999;
        if(!this.meta.bounds.contains(pt))
            return fillValue
        const r = this.meta.image.getResolution()
        const bbox = [pt.lng, pt.lat, pt.lng + r[0], pt.lat + r[1]]
        const width = 1
        const height = 1
        const ras = await this.cog.readRasters({ bbox, width, height, fillValue })
        return ras[0][0]
    },
    load_tile: function(canvas, coords, done) {
        const error = undefined
        // Determine the Tiles Bounds (in lat, lon)
        const nw = this.xyz2ll(coords)
        const se = this.xyz2ll(coords, 1)
        const box = L.latLngBounds(nw,se)

        // Exit if Tile does not overlap the Tiff Bounds
        if(!box.overlaps(this.meta.bounds)) {
            setTimeout(() => {done(error, canvas)}, 100)
            return canvas
        }
        let bbox = [nw.lng, nw.lat, se.lng, se.lat]

        // Setup worker for drawing on tile
        const size = this.getTileSize()
        const width = size.x
        const height = size.y
        const ctx = canvas.getContext('2d')
        const worker = new Worker(this.blobURL)
        const res = {
            x: (se.lng - nw.lng)/width,
            y: (nw.lat - se.lat)/height,
        }
        const scale = {x: 111120, y: 111120}

        const id = `id_${coords.x}_${coords.y}_${coords.z}`
        const key = bbox.slice(0,2).map(x => x.toFixed(4)).join(", ")
        worker.onmessage = e => {
            // Draw image data (created by worker) onto canvas tile
            // Compositie the HillData and Color Topography
            //   Use overlay (https://en.wikipedia.org/wiki/Blend_modes#Overlay)
            //   Typically we use a gamma correction to increase the "shadow values"
            //   https://gis.stackexchange.com/a/255574
            //   https://stackoverflow.com/a/16521337
            ctx.globalCompositeOperation = "source-over";
            message(`Draw hillshade ${key}`, id, this.msg_id)
            if(e.data.hillData) {
                ctx.putImageData(e.data.hillData, 0, 0);
                ctx.globalCompositeOperation = "overlay";
            }

            createImageBitmap(e.data.imgData)
                .then(img => {
                    message(`Draw topography ${key}`, id, this.msg_id)
                    ctx.drawImage(img, 0, 0)
                    done(error, canvas)
                    message("", id, this.msg_id)
                    worker.terminate()
                })
        }

        setTimeout(() => {
            // Read Tiff within Tile bounds
            let hill = undefined
            const resampleMethod = 'bilinear'
            if(this.hill)
                hill = this.hill.readRasters({ bbox, width, height,
                                               fillValue: this.hill_meta.noData, resampleMethod })
            let topo = this.cog.readRasters({ bbox, width, height,
                                              fillValue: this.meta.noData, resampleMethod })
            //console.log(this.url, bbox, width, height)
            message(`Fetch ${key}`, id, this.msg_id)
            Promise.all([topo, hill]).then((values) => {
                message(`Color and hillshade ${key}`,id, this.msg_id)
                const ras = values[0][0]
                const hill = (values[1]) ? values[1][0] : undefined
                // Draw on Tiff (raster) image data
                worker.postMessage({size, ras, hill, res, scale, coords,
                                    colormap: this.options.colormap,
                                    hill_colormap: this.options.hill_colormap,
                                    correct_gamma: this.options.hill_gamma_correct,
                                    hill_auto: this.options.hill_auto,
                                   })
            })
        }, 100)
        return canvas
    },
    update_tiles: function() {
        // Redraws existing tiles without destroying them (no-flashing)
        for(const tile of Object.values(this._tiles)) {
            const worker = new Worker(this.blobURL)
            this.load_tile(tile.el, tile.coords, () => {})
        }
    },
    // Sets a new colormap from a filename (fetch) or an existing Colormap
    set_colormap: async function(cmap) {
        if(typeof(cmap) == 'string') {
            const cpt = await Colormap.from_cpt(cmap)
            return this.set_colormap(cpt)
        }
        this.options.colormap = cmap
        this.options.colormap.noValue(this.meta.noData, this.options.noValueColor)
        this.update_tiles()
    }
})

L.geoTiffGrid = function(url, options) {
    return new L.GeoTiffGrid(url, options)
}

function image_metadata(image) {
    const meta = image.getGDALMetadata(0)
    const bbox = image.getBoundingBox()
    const min = (meta.STATISTICS_MINIMUM) ? parseFloat(meta.STATISTICS_MINIMUM) : undefined
    const max = (meta.STATISTICS_MAXIMUM) ? parseFloat(meta.STATISTICS_MAXIMUM) : undefined
    return {
        image: image,
        meta: image.getGDALMetadata(0),
        noData: image.getGDALNoData(),
        min,
        max,
        bounds: L.latLngBounds([bbox[1], bbox[0]], [bbox[3], bbox[2]]),
    }
}

// Transfers raster image to imgData via colormap
function color_image(ras, imgData, color) {
    let k = 0;
    for(let i = 0; i < ras.length; i++) {
        const c = color.at(ras[i])
        imgData.data[k + 0] = c[0]
        imgData.data[k + 1] = c[1]
        imgData.data[k + 2] = c[2]
        imgData.data[k + 3] = c[3]
        k += 4
    }
}

async function load_geotiff(url) {
    if(!url)
        return { tiff: undefined, meta: undefined }
    let tiff
    try {
        tiff = await GeoTIFF.fromUrl(url, {})
    } catch (e) {
        console.log("Error" ,url)
        return {tiff: undefined, meta: undefined}
    }
    let image = await tiff.getImage()
    let meta = image_metadata(image)
    return {tiff, meta}
}
async function load_rasterizer(url) {
    //const res = await fetch(url)
    //const txt = await res.text()
    const txt = rasterizer
    return URL.createObjectURL(new Blob([ txt ], { type: "text/javascript" }))
}

function message(msg, id, parent = "progress") {
    const p = document.getElementById(parent)
    if(!p)
        return
    let el = document.getElementById(id)
    if(!el) {
        el = document.createElement("div")
        el.id = id
        p.appendChild(el)
    }
    if(msg.length == 0)
        return setTimeout(() => { return el.remove() }, 1000);
    el.textContent = msg
}
