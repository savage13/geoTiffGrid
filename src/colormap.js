

function interp(x,x0,x1,y0,y1) {
    return y0 + (x-x0) * (y1-y0)/(x1-x0)
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
    case 0: r = v, g = t, b = p; break;
    case 1: r = q, g = v, b = p; break;
    case 2: r = p, g = v, b = t; break;
    case 3: r = p, g = q, b = v; break;
    case 4: r = t, g = p, b = v; break;
    case 5: r = v, g = p, b = q; break;
    }
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}

// If the colormap is specified with
//   values, keep the min/max as 0/1
// If the colormap is NOT specified with
//   values, it is best to set the min/max values to that of the data

export class Colormap {
    constructor(colors, options = {}) {
        this.colors = colors
        this.n = colors.length
        this.min = 0
        this.max = 1
        this.nv = undefined
        this.nv_color = undefined
        if(options.min !== undefined)
            this.min = options.min
        if(options.max !== undefined)
            this.max = options.max
        if(options.noValue !== undefined)
            this.nv = options.noValue
        if(options.noValueColor !== undefined)
            this.nv_color = options.noValueColor

        for(let i = 0; i < this.n; i++) {
            if(this.colors[i].length == 4) { // [red, green, blue, alpha]
                this.colors[i].unshift(i / (this.n-1))
            }
        }
    }
    limits(min, max) {
        this.min = min
        this.max = max
    }
    noValue(nv, color) {
        this.nv = nv
        this.nv_color = color
    }
    at(x, format="rgb256") {
        let v = [0,0,0,1]
        if(x == this.nv)
            v = this.nv_color
        else {
            const x1 = (x-this.min)/(this.max-this.min)
            //console.log("at,x1", x, x1, this.min, this.max)
            v = this._at(x1)
        }
        if(format == "rgb256") {
            return v.map(v => Math.floor(v * 255))
        }
        return v
    }
    _at(x) {
        const c = this.colors
        const n = this.n
        if(x <= c[0][0])
            return c[0].slice(1)
        if(x >= c[n-1][0])
            return c[n-1].slice(1)
        for(let i = 0; i < n-1; i++) {
            if(c[i][0] <= x && x <= c[i+1][0]) {
                let r = interp(x, c[i][0], c[i+1][0], c[i][1], c[i+1][1])
                let g = interp(x, c[i][0], c[i+1][0], c[i][2], c[i+1][2])
                let b = interp(x, c[i][0], c[i+1][0], c[i][3], c[i+1][3])
                let a = interp(x, c[i][0], c[i+1][0], c[i][4], c[i+1][4])
                return [r, g, b, a];
            }
        }
        return [0,0,0,1]
    }
    rescale(min, max) {
        min = parseFloat(min)
        max = parseFloat(max)
        let vmin = this.colors.at(0)[0]
        let vmax = this.colors.at(-1)[0]
        let zero = false
        if(vmin < 0 && vmax > 0)
            zero = true
        let colors = [ ... this.colors ]
        for(let i = 0; i < this.colors.length; i++) {
            let old_value = colors[i][0]
            let new_value = min + (max - min) * (old_value - vmin)/(vmax - vmin)
            if(zero) {
                if(old_value < 0) {
                    new_value = min + (0 - min) * (old_value - vmin)/(0 - vmin)
                } else {
                    new_value = 0 + (max - 0) * (old_value - 0)/(vmax - 0)
                }
            }
            colors[i][0] = new_value
        }
        return new Colormap(colors)
    }
    static async from_cpt(filename) {
        const res = await fetch(filename)

        const txt = await res.text()
        const lines = txt.split("\n")
        let model = "rgb"
        let out = {
            model: "RGB",
            B: [0,0,0],
            F: [255,255,255],
            N: [128,128,128],
        }
        let colors = []
        for(let line of lines) {
            line = line.trim()
            if(line.length == 0)
                continue
            if(line[0] == "#") { // comment
                if(line.includes("COLOR_MODEL")) {
                    out.model = line.split("=").at(-1).trim()
                }
                continue
            }
            if(line[0] == "F" || line[0] == "B" || line[0] == "N")
                out[line[0]] = line.split(/\s+/).slice(1).map(x => parseInt(x))
            else {
                let convert = (out.model == "HSV") ? parseFloat : parseInt;
                let v = line.split(/\s+/).map(x => x.trim())
                let c1 = v.slice(1,4).map(x => convert(x))
                c1.unshift(parseFloat(v[0]))
                colors.push(c1)
                c1 = v.slice(5,8).map(x => convert(x))
                c1.unshift(parseFloat(v[4]))
                colors.push(c1)
            }
        }
        if(out.model == "HSV") {
            for(let i = 0; i < colors.length; i++) {
                const rgb = HSVtoRGB(colors[i][1]/360, colors[i][2], colors[i][3])
                colors[i][1] = rgb.r
                colors[i][2] = rgb.g
                colors[i][3] = rgb.b
            }
        }

        out.B.push(255)
        out.F.push(255)
        out.N.push(255)
        out.B = out.B.map(v => v / 255)
        out.F = out.F.map(v => v / 255)
        out.N = out.N.map(v => v / 255)
        for(let i = 0; i < colors.length; i++) {
            colors[i].push(255)
            colors[i] = colors[i].map((v,k) => (k ) ? v/255 : v)
        }
        out.colors = colors
        return new Colormap(out.colors)
    }
    static gray(min, max) {
        return new Colormap([[min, 0,0,0,1], [max,1,1,1,1]])
    }
}

//const gray = new Colormap([ [0,0,0,1], [1,1,1,1] ])

