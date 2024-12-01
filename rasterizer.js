

onmessage = async (e) => {
    const coords = e.data.coords
    const size = e.data.size
    const ras = e.data.ras
    let hill = e.data.hill
    const hill_auto = e.data.hill_auto
    const res = e.data.res
    const scale = e.data.scale
    const colormap = e.data.colormap
    const hill_colormap = e.data.hill_colormap
    const correct_gamma = e.data.correct_gamma
    const imgData = new ImageData(size.x, size.y)

    const hillData = new ImageData(size.x, size.y)
    color_image(ras, imgData, colormap)
    if(!hill && hill_auto) {
        hill = hillshade(ras, size, res, scale, colormap.nv, hill_colormap.nv, coords)
    }
    if(hill) {
        if(correct_gamma != undefined)
            gamma_correction(hill, hill_colormap, correct_gamma)
        color_image(hill, hillData, hill_colormap)
    }
    postMessage({imgData: imgData, hillData})
};

function hillshade(z, size, res, scale, noValue, hillNoValue, coords) {
    let hs = new Float32Array(size.x * size.y)
    let altitude_deg = 30.0
    let z_factor = 2.0
    let alt = altitude_deg * Math.PI / 180.;
    const azs = [225., 270., 315, 360.]
    const az_rads = azs.map(v => v * Math.PI / 180.)
    for(let k = 0; k < size.x; k++) {
        let i1 = k-1
        let i2 = k
        let i3 = k+1
        if(i1 < 0)
            i1++;
        if(i3 >= size.x-1)
            i3--;
        for(let j = 0; j < size.y; j++) {
            let j1 = j-1;
            let j2 = j
            let j3 = j+1;
            if(j1 < 0)
                j1++;
            if(j3>=size.y-1)
                j3--;

            let a = i1 + j1 * size.x
            let b = i2 + j1 * size.x
            let c = i3 + j1 * size.x
            let d = i1 + j2 * size.x
            let e = i2 + j2 * size.x // Center
            let f = i3 + j2 * size.x
            let g = i1 + j3 * size.x
            let h = i2 + j3 * size.x
            let i = i3 + j3 * size.x

            if(z[a] == noValue || z[b] == noValue || z[c] == noValue ||
               z[d] == noValue || z[e] == noValue || z[f] == noValue ||
               z[g] == noValue || z[h] == noValue || z[i] == noValue) {
                hs[e] = hillNoValue
                continue
            }
            let dzdx = ( (z[c] + 2*z[f] + z[i]) -
                         (z[a] + 2*z[d] + z[g]) ) / (8 * res.x * scale.x)
            let dzdy = ( (z[g] + 2*z[h] + z[i]) -
                         (z[a] + 2*z[b] + z[c]) ) / (8 * res.y * scale.y)
            if(k == 0 || k == size.x-1)
                dzdx *= 2
            if(j == 0 || j == size.y-1)
                dzdy *= 2

            const key = dzdx*dzdx + dzdy*dzdy
            let slope = Math.atan( z_factor * Math.sqrt( key ))
            let aspect = Math.atan2(dzdy, -dzdx)

            let he = 0.0
            let we = 0.0
            for(const az of az_rads) {
                const w = Math.pow(Math.sin(aspect - az), 2)
                he += w *
                    ((Math.sin(alt) * Math.cos(slope)) +
                     (Math.cos(alt) * Math.sin(slope) *
                      Math.cos(Math.PI/2 - az - aspect)))
                we += w
            }
            hs[e] = 255 * he / we;
            hs[e] = Math.min(255, hs[e])
            hs[e] = Math.max(0, hs[e])
        }
    }
    return hs
}

function gamma_correct(v, gamma = 0.8) {
    return Math.pow(v/255.0, 1./gamma) * 255
}

function gamma_correction(ras, color, gamma) {
    for(let i = 0; i < ras.length; i++) {
        if(ras[i] == color.nv)
            continue
        ras[i] = gamma_correct(ras[i], gamma)
    }
}

function color_image(ras, imgData, color) {
    let k = 0;
    for(let i = 0; i < ras.length; i++) {
        const c = color_at(color, ras[i])
        imgData.data[k + 0] = c[0]
        imgData.data[k + 1] = c[1]
        imgData.data[k + 2] = c[2]
        imgData.data[k + 3] = c[3]
        k += 4
    }
    return
}

function interp(x,x0,x1,y0,y1) {
    return y0 + (x-x0) * (y1-y0)/(x1-x0)
}

function color_at(self, x, format="rgb256") {
    let v = [0,0,0,1]
    //console.log("at",x)
    if(x == self.nv)
        v = self.nv_color
    else {
        const x1 = (x-self.min)/(self.max-self.min)
        //console.log("at,x1", x, x1, self.min, self.max)
        v = _color_at(self, x1)
    }
    if(format == "rgb256") {
        return v.map(v => Math.floor(v * 255))
    }
    return v
}

function _color_at(self, x) {
    const c = self.colors
    const n = self.n
    //console.log(x, c[0][0], c[n-1][0])
    if(x <= c[0][0])
        return c[0].slice(1)
    if(x >= c[n-1][0])
        return c[n-1].slice(1)
    for(let i = 0; i < n-1; i++) {
        if(c[i][0] <= x && x <= c[i+1][0]) {
            //console.log(c[i], c[i+1])
            let r = interp(x, c[i][0], c[i+1][0], c[i][1], c[i+1][1])
            let g = interp(x, c[i][0], c[i+1][0], c[i][2], c[i+1][2])
            let b = interp(x, c[i][0], c[i+1][0], c[i][3], c[i+1][3])
            let a = interp(x, c[i][0], c[i+1][0], c[i][4], c[i+1][4])
            return [r, g, b, a];
        }
    }
    return [0,0,0,1]
}
