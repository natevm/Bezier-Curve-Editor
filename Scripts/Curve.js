class Curve {
    constructor() {
        this.numControlPoints = 5;
        this.numSamples = 100;
        this.thickness = .8;
        this.controlPoints = [
            0.0, 0.0, 0.0,
            0.5, -0.5, 0.0,
            // 1.0, 0.0, 0.0,
            // 1.5, 0.5, 0.0,
            2.0, 0.0, 0.0,
            4.0, -5.0, 0.0,
            -2.0, 3.0, 0.0,
        ];

        this.points = [
            [0.0, 0.0, 0.0],
            [0.5, -0.5, 0.0],
            [1.0, 0.0, 0.0],
            [1.5, 0.5, 0.0],
            [2.0, 0.0, 0.0],
        ];

        /* temporary */
        this.normals = [
            [0.0, 1.0, 0.0],
            [0.0, 1.0, 0.0],
            [0.0, 1.0, 0.0],
            [0.0, 1.0, 0.0],
            [0.0, 1.0, 0.0],
            [0.0, 1.0, 0.0],
            [0.0, 1.0, 0.0],
            [0.0, 1.0, 0.0],
            [0.0, 1.0, 0.0],
            [0.0, 1.0, 0.0],
            [0.0, 1.0, 0.0],
            [0.0, 1.0, 0.0],
            [0.0, 1.0, 0.0],
            [0.0, 1.0, 0.0],
        ];
    }

    nchoosek(n,k){
        var result = 1;
        for(var i=1.0; i <= k; i++){
            result *= (n - (k - i)) / i;
        }
        return result;
    }

    bernstein(n, k, t) {
        var result = 1
        for(var i=1.0; i <= k; i++){
            result *= (n - (k - i)) / i;
        }
        result *= Math.pow(t, k) * Math.pow(1-t, n - k);
        return result
    }

    getBezierPoints() {
        let points = []

        let n = (this.controlPoints.length / 3) - 1; // degree
        for (let pi = 0; pi < this.numSamples; ++pi) {
            let p = vec3.create()
            let t = pi / this.numSamples;
            for (let i = 0; i <= n; ++i) {
                let p_i = vec3.create()
                vec3.set(p_i, this.controlPoints[i * 3], this.controlPoints[i * 3 + 1], this.controlPoints[i * 3 + 2])
                let theta = this.bernstein(n, i, t);
                vec3.scale(p_i, p_i, theta)
                vec3.add(p, p, p_i);
            }
            points.push(p);
        }

        return points;
    }

    getTValues() {
        let ts = []
        for (let i = 0; i < this.numSamples; ++i) {
            ts.push(i / this.numSamples);
        }
        return ts;
    }
}

export {Curve}