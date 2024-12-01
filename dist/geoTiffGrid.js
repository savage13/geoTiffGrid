// src/colormap.js
function interp(x, x0, x1, y0, y1) {
  return y0 + (x - x0) * (y1 - y0) / (x1 - x0);
}
function HSVtoRGB(h, s, v) {
  var r, g, b, i, f, p, q, t;
  if (arguments.length === 1) {
    s = h.s, v = h.v, h = h.h;
  }
  i = Math.floor(h * 6);
  f = h * 6 - i;
  p = v * (1 - s);
  q = v * (1 - f * s);
  t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0:
      r = v, g = t, b = p;
      break;
    case 1:
      r = q, g = v, b = p;
      break;
    case 2:
      r = p, g = v, b = t;
      break;
    case 3:
      r = p, g = q, b = v;
      break;
    case 4:
      r = t, g = p, b = v;
      break;
    case 5:
      r = v, g = p, b = q;
      break;
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}
var Colormap = class _Colormap {
  constructor(colors, options = {}) {
    this.colors = colors;
    this.n = colors.length;
    this.min = 0;
    this.max = 1;
    this.nv = void 0;
    this.nv_color = void 0;
    if (options.min !== void 0)
      this.min = options.min;
    if (options.max !== void 0)
      this.max = options.max;
    if (options.noValue !== void 0)
      this.nv = options.noValue;
    if (options.noValueColor !== void 0)
      this.nv_color = options.noValueColor;
    for (let i = 0; i < this.n; i++) {
      if (this.colors[i].length == 4) {
        this.colors[i].unshift(i / (this.n - 1));
      }
    }
  }
  limits(min, max) {
    this.min = min;
    this.max = max;
  }
  noValue(nv, color) {
    this.nv = nv;
    this.nv_color = color;
  }
  at(x, format = "rgb256") {
    let v = [0, 0, 0, 1];
    if (x == this.nv)
      v = this.nv_color;
    else {
      const x1 = (x - this.min) / (this.max - this.min);
      v = this._at(x1);
    }
    if (format == "rgb256") {
      return v.map((v2) => Math.floor(v2 * 255));
    }
    return v;
  }
  _at(x) {
    const c = this.colors;
    const n = this.n;
    if (x <= c[0][0])
      return c[0].slice(1);
    if (x >= c[n - 1][0])
      return c[n - 1].slice(1);
    for (let i = 0; i < n - 1; i++) {
      if (c[i][0] <= x && x <= c[i + 1][0]) {
        let r = interp(x, c[i][0], c[i + 1][0], c[i][1], c[i + 1][1]);
        let g = interp(x, c[i][0], c[i + 1][0], c[i][2], c[i + 1][2]);
        let b = interp(x, c[i][0], c[i + 1][0], c[i][3], c[i + 1][3]);
        let a = interp(x, c[i][0], c[i + 1][0], c[i][4], c[i + 1][4]);
        return [r, g, b, a];
      }
    }
    return [0, 0, 0, 1];
  }
  rescale(min, max) {
    min = parseFloat(min);
    max = parseFloat(max);
    let vmin = this.colors.at(0)[0];
    let vmax = this.colors.at(-1)[0];
    let zero = false;
    if (vmin < 0 && vmax > 0)
      zero = true;
    let colors = [...this.colors];
    for (let i = 0; i < this.colors.length; i++) {
      let old_value = colors[i][0];
      let new_value = min + (max - min) * (old_value - vmin) / (vmax - vmin);
      if (zero) {
        if (old_value < 0) {
          new_value = min + (0 - min) * (old_value - vmin) / (0 - vmin);
        } else {
          new_value = 0 + (max - 0) * (old_value - 0) / (vmax - 0);
        }
      }
      colors[i][0] = new_value;
    }
    return new _Colormap(colors);
  }
  static async from_cpt(filename) {
    const res = await fetch(filename);
    const txt = await res.text();
    const lines = txt.split("\n");
    let model = "rgb";
    let out = {
      model: "RGB",
      B: [0, 0, 0],
      F: [255, 255, 255],
      N: [128, 128, 128]
    };
    let colors = [];
    for (let line of lines) {
      line = line.trim();
      if (line.length == 0)
        continue;
      if (line[0] == "#") {
        if (line.includes("COLOR_MODEL")) {
          out.model = line.split("=").at(-1).trim();
        }
        continue;
      }
      if (line[0] == "F" || line[0] == "B" || line[0] == "N")
        out[line[0]] = line.split(/\s+/).slice(1).map((x) => parseInt(x));
      else {
        let convert = out.model == "HSV" ? parseFloat : parseInt;
        let v = line.split(/\s+/).map((x) => x.trim());
        let c1 = v.slice(1, 4).map((x) => convert(x));
        c1.unshift(parseFloat(v[0]));
        colors.push(c1);
        c1 = v.slice(5, 8).map((x) => convert(x));
        c1.unshift(parseFloat(v[4]));
        colors.push(c1);
      }
    }
    if (out.model == "HSV") {
      for (let i = 0; i < colors.length; i++) {
        const rgb = HSVtoRGB(colors[i][1] / 360, colors[i][2], colors[i][3]);
        colors[i][1] = rgb.r;
        colors[i][2] = rgb.g;
        colors[i][3] = rgb.b;
      }
    }
    out.B.push(255);
    out.F.push(255);
    out.N.push(255);
    out.B = out.B.map((v) => v / 255);
    out.F = out.F.map((v) => v / 255);
    out.N = out.N.map((v) => v / 255);
    for (let i = 0; i < colors.length; i++) {
      colors[i].push(255);
      colors[i] = colors[i].map((v, k) => k ? v / 255 : v);
    }
    out.colors = colors;
    return new _Colormap(out.colors);
  }
  static gray(min, max) {
    return new _Colormap([[min, 0, 0, 0, 1], [max, 1, 1, 1, 1]]);
  }
};

// src/rasterizer.txt
var rasterizer_default = '\n\nonmessage = async (e) => {\n    const coords = e.data.coords\n    const size = e.data.size\n    const ras = e.data.ras\n    let hill = e.data.hill\n    const hill_auto = e.data.hill_auto\n    const res = e.data.res\n    const scale = e.data.scale\n    const colormap = e.data.colormap\n    const hill_colormap = e.data.hill_colormap\n    const correct_gamma = e.data.correct_gamma\n    const imgData = new ImageData(size.x, size.y)\n\n    const hillData = new ImageData(size.x, size.y)\n    color_image(ras, imgData, colormap)\n    if(!hill && hill_auto) {\n        hill = hillshade(ras, size, res, scale, colormap.nv, hill_colormap.nv, coords)\n    }\n    if(hill) {\n        if(correct_gamma != undefined)\n            gamma_correction(hill, hill_colormap, correct_gamma)\n        color_image(hill, hillData, hill_colormap)\n    }\n    postMessage({imgData: imgData, hillData})\n};\n\nfunction hillshade(z, size, res, scale, noValue, hillNoValue, coords) {\n    let hs = new Float32Array(size.x * size.y)\n    let altitude_deg = 30.0\n    let z_factor = 2.0\n    let alt = altitude_deg * Math.PI / 180.;\n    const azs = [225., 270., 315, 360.]\n    const az_rads = azs.map(v => v * Math.PI / 180.)\n    for(let k = 0; k < size.x; k++) {\n        let i1 = k-1\n        let i2 = k\n        let i3 = k+1\n        if(i1 < 0)\n            i1++;\n        if(i3 >= size.x-1)\n            i3--;\n        for(let j = 0; j < size.y; j++) {\n            let j1 = j-1;\n            let j2 = j\n            let j3 = j+1;\n            if(j1 < 0)\n                j1++;\n            if(j3>=size.y-1)\n                j3--;\n\n            let a = i1 + j1 * size.x\n            let b = i2 + j1 * size.x\n            let c = i3 + j1 * size.x\n            let d = i1 + j2 * size.x\n            let e = i2 + j2 * size.x // Center\n            let f = i3 + j2 * size.x\n            let g = i1 + j3 * size.x\n            let h = i2 + j3 * size.x\n            let i = i3 + j3 * size.x\n\n            if(z[a] == noValue || z[b] == noValue || z[c] == noValue ||\n               z[d] == noValue || z[e] == noValue || z[f] == noValue ||\n               z[g] == noValue || z[h] == noValue || z[i] == noValue) {\n                hs[e] = hillNoValue\n                continue\n            }\n            let dzdx = ( (z[c] + 2*z[f] + z[i]) -\n                         (z[a] + 2*z[d] + z[g]) ) / (8 * res.x * scale.x)\n            let dzdy = ( (z[g] + 2*z[h] + z[i]) -\n                         (z[a] + 2*z[b] + z[c]) ) / (8 * res.y * scale.y)\n            if(k == 0 || k == size.x-1)\n                dzdx *= 2\n            if(j == 0 || j == size.y-1)\n                dzdy *= 2\n\n            const key = dzdx*dzdx + dzdy*dzdy\n            let slope = Math.atan( z_factor * Math.sqrt( key ))\n            let aspect = Math.atan2(dzdy, -dzdx)\n\n            let he = 0.0\n            let we = 0.0\n            for(const az of az_rads) {\n                const w = Math.pow(Math.sin(aspect - az), 2)\n                he += w *\n                    ((Math.sin(alt) * Math.cos(slope)) +\n                     (Math.cos(alt) * Math.sin(slope) *\n                      Math.cos(Math.PI/2 - az - aspect)))\n                we += w\n            }\n            hs[e] = 255 * he / we;\n            hs[e] = Math.min(255, hs[e])\n            hs[e] = Math.max(0, hs[e])\n        }\n    }\n    return hs\n}\n\nfunction gamma_correct(v, gamma = 0.8) {\n    return Math.pow(v/255.0, 1./gamma) * 255\n}\n\nfunction gamma_correction(ras, color, gamma) {\n    for(let i = 0; i < ras.length; i++) {\n        if(ras[i] == color.nv)\n            continue\n        ras[i] = gamma_correct(ras[i], gamma)\n    }\n}\n\nfunction color_image(ras, imgData, color) {\n    let k = 0;\n    for(let i = 0; i < ras.length; i++) {\n        const c = color_at(color, ras[i])\n        imgData.data[k + 0] = c[0]\n        imgData.data[k + 1] = c[1]\n        imgData.data[k + 2] = c[2]\n        imgData.data[k + 3] = c[3]\n        k += 4\n    }\n    return\n}\n\nfunction interp(x,x0,x1,y0,y1) {\n    return y0 + (x-x0) * (y1-y0)/(x1-x0)\n}\n\nfunction color_at(self, x, format="rgb256") {\n    let v = [0,0,0,1]\n    //console.log("at",x)\n    if(x == self.nv)\n        v = self.nv_color\n    else {\n        const x1 = (x-self.min)/(self.max-self.min)\n        //console.log("at,x1", x, x1, self.min, self.max)\n        v = _color_at(self, x1)\n    }\n    if(format == "rgb256") {\n        return v.map(v => Math.floor(v * 255))\n    }\n    return v\n}\n\nfunction _color_at(self, x) {\n    const c = self.colors\n    const n = self.n\n    //console.log(x, c[0][0], c[n-1][0])\n    if(x <= c[0][0])\n        return c[0].slice(1)\n    if(x >= c[n-1][0])\n        return c[n-1].slice(1)\n    for(let i = 0; i < n-1; i++) {\n        if(c[i][0] <= x && x <= c[i+1][0]) {\n            //console.log(c[i], c[i+1])\n            let r = interp(x, c[i][0], c[i+1][0], c[i][1], c[i+1][1])\n            let g = interp(x, c[i][0], c[i+1][0], c[i][2], c[i+1][2])\n            let b = interp(x, c[i][0], c[i+1][0], c[i][3], c[i+1][3])\n            let a = interp(x, c[i][0], c[i+1][0], c[i][4], c[i+1][4])\n            return [r, g, b, a];\n        }\n    }\n    return [0,0,0,1]\n}\n';

// src/tiffgrid.js
L.GeoTiffGrid = L.GridLayer.extend({
  options: {
    colormap: new Colormap([[0, 0, 0, 1], [1, 1, 1, 1]]),
    scale_color: true,
    noValue: void 0,
    noValueColor: [0, 0, 0, 0],
    hill_auto: false,
    hill_url: void 0,
    hill_colormap: new Colormap([[0, 0, 0, 0, 1], [255, 1, 1, 1, 1]]),
    hill_scale_color: false,
    hill_noValue: void 0,
    hill_noValueColor: [0, 0, 0, 0],
    hill_gamma_correct: 1,
    msg_id: "progress"
  },
  initialize: function(url, options) {
    this.url = url;
    this.cog = void 0;
    this.hill = void 0;
    this.image = void 0;
    this.meta = void 0;
    this.hill_meta = void 0;
    L.setOptions(this, options);
    this.blobURL = void 0;
  },
  onAdd: function() {
    this._initContainer();
    this._levels = {};
    this._tiles = {};
    this.msg_id = this.options.msg_id;
    let p1 = load_geotiff(this.url);
    let p2 = load_geotiff(this.options.hill_url);
    let p3 = load_rasterizer("./rasterizer.js");
    Promise.all([p1, p2, p3]).then((vals) => {
      this.cog = vals[0].tiff;
      if (!this.cog)
        return;
      this.meta = vals[0].meta;
      this.hill = vals[1].tiff;
      this.hill_meta = vals[1].meta;
      this.blobURL = vals[2];
      if (this.options.scale_color)
        this.options.colormap.limits(this.meta.min, this.meta.max);
      if (this.options.hill_scale_color && this.hill_meta)
        this.options.hill_colormap.limits(this.hill_meta.min, this.hill_meta.max);
      if (this.options.noValue === void 0)
        this.options.colormap.noValue(this.meta.noData, this.options.noValueColor);
      if (this.options.hill_noValue == void 0 && this.hill_meta)
        this.options.hill_colormap.noValue(
          this.hill_meta.noData,
          this.options.hill_noValueColor
        );
      if (this.hill === void 0) {
        this.options.hill_colormap.noValue(-1, this.options.hill_noValueColor);
      }
      this._resetView();
    });
    return;
  },
  // https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
  xyz2ll: function(p, shift = 0) {
    const n = Math.pow(2, p.z);
    let lng = (p.x + shift) / n * 360 - 180;
    let lat_rad = Math.atan(Math.sinh(Math.PI * (1 - 2 * (p.y + shift) / n)));
    let lat = lat_rad * 180 / Math.PI;
    return { lat, lng };
  },
  createTile: function(coords, done) {
    const tile = L.DomUtil.create("canvas", "leaflet-tile");
    const size = this.getTileSize();
    tile.width = size.x;
    tile.height = size.y;
    return this.load_tile(tile, coords, done);
  },
  elevation: async function(pt) {
    const fillValue = -9999;
    if (!this.meta.bounds.contains(pt))
      return fillValue;
    const r = this.meta.image.getResolution();
    const bbox = [pt.lng, pt.lat, pt.lng + r[0], pt.lat + r[1]];
    const width = 1;
    const height = 1;
    const ras = await this.cog.readRasters({ bbox, width, height, fillValue });
    return ras[0][0];
  },
  load_tile: function(canvas, coords, done) {
    const error = void 0;
    const nw = this.xyz2ll(coords);
    const se = this.xyz2ll(coords, 1);
    const box = L.latLngBounds(nw, se);
    if (!box.overlaps(this.meta.bounds)) {
      setTimeout(() => {
        done(error, canvas);
      }, 100);
      return canvas;
    }
    let bbox = [nw.lng, nw.lat, se.lng, se.lat];
    const size = this.getTileSize();
    const width = size.x;
    const height = size.y;
    const ctx = canvas.getContext("2d");
    const worker = new Worker(this.blobURL);
    const res = {
      x: (se.lng - nw.lng) / width,
      y: (nw.lat - se.lat) / height
    };
    const scale = { x: 111120, y: 111120 };
    const id = `id_${coords.x}_${coords.y}_${coords.z}`;
    const key = bbox.slice(0, 2).map((x) => x.toFixed(4)).join(", ");
    worker.onmessage = (e) => {
      ctx.globalCompositeOperation = "source-over";
      message(`Draw hillshade ${key}`, id, this.msg_id);
      if (e.data.hillData) {
        ctx.putImageData(e.data.hillData, 0, 0);
        ctx.globalCompositeOperation = "overlay";
      }
      createImageBitmap(e.data.imgData).then((img) => {
        message(`Draw topography ${key}`, id, this.msg_id);
        ctx.drawImage(img, 0, 0);
        done(error, canvas);
        message("", id, this.msg_id);
        worker.terminate();
      });
    };
    setTimeout(() => {
      let hill = void 0;
      const resampleMethod = "bilinear";
      if (this.hill)
        hill = this.hill.readRasters({
          bbox,
          width,
          height,
          fillValue: this.hill_meta.noData,
          resampleMethod
        });
      let topo = this.cog.readRasters({
        bbox,
        width,
        height,
        fillValue: this.meta.noData,
        resampleMethod
      });
      message(`Fetch ${key}`, id, this.msg_id);
      Promise.all([topo, hill]).then((values) => {
        message(`Color and hillshade ${key}`, id, this.msg_id);
        const ras = values[0][0];
        const hill2 = values[1] ? values[1][0] : void 0;
        worker.postMessage({
          size,
          ras,
          hill: hill2,
          res,
          scale,
          coords,
          colormap: this.options.colormap,
          hill_colormap: this.options.hill_colormap,
          correct_gamma: this.options.hill_gamma_correct,
          hill_auto: this.options.hill_auto
        });
      });
    }, 100);
    return canvas;
  },
  update_tiles: function() {
    for (const tile of Object.values(this._tiles)) {
      const worker = new Worker(this.blobURL);
      this.load_tile(tile.el, tile.coords, () => {
      });
    }
  },
  // Sets a new colormap from a filename (fetch) or an existing Colormap
  set_colormap: async function(cmap) {
    if (typeof cmap == "string") {
      const cpt = await Colormap.from_cpt(cmap);
      return this.set_colormap(cpt);
    }
    this.options.colormap = cmap;
    this.options.colormap.noValue(this.meta.noData, this.options.noValueColor);
    this.update_tiles();
  }
});
L.geoTiffGrid = function(url, options) {
  return new L.GeoTiffGrid(url, options);
};
function image_metadata(image) {
  const meta = image.getGDALMetadata(0);
  const bbox = image.getBoundingBox();
  const min = meta.STATISTICS_MINIMUM ? parseFloat(meta.STATISTICS_MINIMUM) : void 0;
  const max = meta.STATISTICS_MAXIMUM ? parseFloat(meta.STATISTICS_MAXIMUM) : void 0;
  return {
    image,
    meta: image.getGDALMetadata(0),
    noData: image.getGDALNoData(),
    min,
    max,
    bounds: L.latLngBounds([bbox[1], bbox[0]], [bbox[3], bbox[2]])
  };
}
async function load_geotiff(url) {
  if (!url)
    return { tiff: void 0, meta: void 0 };
  let tiff;
  try {
    tiff = await GeoTIFF.fromUrl(url, {});
  } catch (e) {
    console.log("Error", url);
    return { tiff: void 0, meta: void 0 };
  }
  let image = await tiff.getImage();
  let meta = image_metadata(image);
  return { tiff, meta };
}
async function load_rasterizer(url) {
  const txt = rasterizer_default;
  return URL.createObjectURL(new Blob([txt], { type: "text/javascript" }));
}
function message(msg, id, parent = "progress") {
  const p = document.getElementById(parent);
  if (!p)
    return;
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("div");
    el.id = id;
    p.appendChild(el);
  }
  if (msg.length == 0)
    return setTimeout(() => {
      return el.remove();
    }, 1e3);
  el.textContent = msg;
}
export {
  Colormap
};
