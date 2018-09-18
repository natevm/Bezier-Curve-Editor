class Curve {
    constructor() {
        this.numControlPoints = 4;
        this.points = [
            0, .5, 0.0,
            .25, 1.0, 0.0,
            .75, 0.0, 0.0,
            1.0, .5, 0.0
        ];
    }
}

export {Curve}