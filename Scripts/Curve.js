class Curve {
    static Initialize(gl) {
        Curve.gl = gl;

        let bfsSource = "";
        let bvsSource = "";
        let lfsSource = "";
        let lvsSource = "";

        let promises = [];
        promises.push($.ajax({
            url: "./Shaders/Bezier.vs",
            success: function (result) {
                bvsSource = result.trim();
            }, error: function (result) {
                console.log("failed to load Bezier.vs with error ");
                console.log(result);
            }
        }));
        promises.push($.ajax({
            url: "./Shaders/Bezier.fs",
            success: function (result) {
                bfsSource = result.trim();
            }, error: function (result) {
                console.log("failed to load Bezier.fs with error ");
                console.log(result);
            }
        }));
        promises.push($.ajax({
            url: "./Shaders/Line.vs",
            success: function (result) {
                lvsSource = result.trim();
            }, error: function (result) {
                console.log("failed to load Line.vs with error ");
                console.log(result);
            }
        }));
        promises.push($.ajax({
            url: "./Shaders/Line.fs",
            success: function (result) {
                lfsSource = result.trim();
            }, error: function (result) {
                console.log("failed to load Line.fs with error ");
                console.log(result);
            }
        }));

        Promise.all(promises).then(() => {
            Curve.BezierShaderProgram = Curve.InitShaderProgram(gl, bvsSource, bfsSource);
            Curve.BezierProgramInfo = {
                program: Curve.BezierShaderProgram,
                attribLocations: {
                    t: gl.getAttribLocation(Curve.BezierShaderProgram, 't'),
                    direction: gl.getAttribLocation(Curve.BezierShaderProgram, 'direction'),
                },
                uniformLocations: {
                    projection: gl.getUniformLocation(Curve.BezierShaderProgram, 'projection'),
                    modelView: gl.getUniformLocation(Curve.BezierShaderProgram, 'modelView'),
                    thickness: gl.getUniformLocation(Curve.BezierShaderProgram, 'thickness'),
                    aspect: gl.getUniformLocation(Curve.BezierShaderProgram, 'aspect'),
                    miter: gl.getUniformLocation(Curve.BezierShaderProgram, 'miter'),
                    numControlPoints: gl.getUniformLocation(Curve.BezierShaderProgram, 'uNumControlPoints'),
                    controlPoints: gl.getUniformLocation(Curve.BezierShaderProgram, 'uControlPoints'),
                },
            };

            Curve.LineShaderProgram = Curve.InitShaderProgram(gl, lvsSource, lfsSource);
            Curve.LineProgramInfo = {
                program: Curve.LineShaderProgram,
                attribLocations: {
                    position: gl.getAttribLocation(Curve.LineShaderProgram, 'position'),
                    next: gl.getAttribLocation(Curve.LineShaderProgram, 'next'),
                    previous: gl.getAttribLocation(Curve.LineShaderProgram, 'previous'),
                    direction: gl.getAttribLocation(Curve.LineShaderProgram, 'direction'),
                },
                uniformLocations: {
                    projection: gl.getUniformLocation(Curve.LineShaderProgram, 'projection'),
                    modelView: gl.getUniformLocation(Curve.LineShaderProgram, 'modelView'),
                    thickness: gl.getUniformLocation(Curve.LineShaderProgram, 'thickness'),
                    aspect: gl.getUniformLocation(Curve.LineShaderProgram, 'aspect'),
                    miter: gl.getUniformLocation(Curve.LineShaderProgram, 'miter')
                },
            };
        });
    }

    // Initialize a shader program, so WebGL knows how to draw our data
    static InitShaderProgram(gl, vsSource, fsSource) {
        const vertexShader = Curve.LoadShader(gl, gl.VERTEX_SHADER, vsSource);
        const fragmentShader = Curve.LoadShader(gl, gl.FRAGMENT_SHADER, fsSource);

        // Create the shader program
        const shaderProgram = gl.createProgram();
        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragmentShader);
        gl.linkProgram(shaderProgram);

        // If creating the shader program failed, alert
        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
            return null;
        }

        return shaderProgram;
    }

    // creates a shader of the given type, uploads the source and
    // compiles it.
    static LoadShader(gl, type, source) {
        const shader = gl.createShader(type);

        // Send the source to the shader object
        gl.shaderSource(shader, source);

        // Compile the shader program
        gl.compileShader(shader);

        // See if it compiled successfully
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    constructor() {
        this.showCurve = true;
        this.showControlPolygon = true;
        this.showControlPoints = true;
        this.numSamples = 200;
        this.thickness = .05;
        this.controlPoints = [
            0.0, 0.0, 0.0,
            0.5, -0.5, 0.0,
            1.0, 0.0, 0.0,
            1.5, 0.5, 0.0,
            2.0, 0.0, 0.0,
        ];

        this.handleRadius = 25;
        this.handleThickness = .025;
        this.handleSamples = 20;

        this.updateBuffers();
    }

    updateBuffers() {
        let gl = Curve.gl;

        if (!this.buffers) {
            this.buffers = {}
            this.buffers.t = gl.createBuffer();
            this.buffers.tDirection = gl.createBuffer();
            this.buffers.controlPointsPosition = gl.createBuffer();
            this.buffers.controlPointsNext = gl.createBuffer();
            this.buffers.controlPointsPrevious = gl.createBuffer();
            this.buffers.controlPointsDirection = gl.createBuffer();

            this.buffers.handlePointsPosition = gl.createBuffer();
            this.buffers.handlePointsNext = gl.createBuffer();
            this.buffers.handlePointsPrevious = gl.createBuffer();
            this.buffers.handlePointsDirection = gl.createBuffer();
            this.buffers.handlePointsIndices = gl.createBuffer();
        }


        let t = this.getTValues();

        /* Double each t, adding a direction */
        let tDirection = [];
        let doubleTs = [];
        for (var i = 0; i < t.length; ++i) {
            tDirection.push(-1, 1)
            doubleTs.push(t[i], t[i])
        }

        let next = [];
        let prev = [];
        let pos = [];
        let ctlDirection = []
        for (var i = 0; i < this.controlPoints.length / 3; ++i) {
            let iprev = Math.max(i - 1, 0);
            let inext = Math.min(i + 1, (this.controlPoints.length / 3) - 1);
            next.push(this.controlPoints[inext * 3 + 0], this.controlPoints[inext * 3 + 1], this.controlPoints[inext * 3 + 2])
            next.push(this.controlPoints[inext * 3 + 0], this.controlPoints[inext * 3 + 1], this.controlPoints[inext * 3 + 2])
            prev.push(this.controlPoints[iprev * 3 + 0], this.controlPoints[iprev * 3 + 1], this.controlPoints[iprev * 3 + 2])
            prev.push(this.controlPoints[iprev * 3 + 0], this.controlPoints[iprev * 3 + 1], this.controlPoints[iprev * 3 + 2])
            pos.push(this.controlPoints[i * 3 + 0], this.controlPoints[i * 3 + 1], this.controlPoints[i * 3 + 2])
            pos.push(this.controlPoints[i * 3 + 0], this.controlPoints[i * 3 + 1], this.controlPoints[i * 3 + 2])
            ctlDirection.push(-1, 1);
        }

        /* Create lines for control point handles */
        // let center = vec3.create();
        // vec3.set(center, this.controlPoints[i * 3 + 0], this.controlPoints[i * 3 + 1], this.controlPoints[i * 3 + 2])
        var i = 0;
        let handlePoints = [];
        let handlePointsPrev = [];
        let handlePointsNext = [];
        let handlePointsDirection = [];
        let handlePointsIndices = [];
        for (var i = 0; i < this.controlPoints.length / 3; ++i) {
            for (var j = 0; j < this.handleSamples + 1; ++j) {
                let jprev = Math.max(j - 1, 0);
                let jnext = Math.min(j + 1, this.handleSamples);
    
                let degreePrev = (jprev / (1.0 * this.handleSamples - 1)) * 2 * Math.PI;
                let degree = (j / (1.0 * this.handleSamples - 1)) * 2 * Math.PI;
                let degreeNext = (jnext / (1.0 * this.handleSamples - 1)) * 2 * Math.PI;
                
                handlePointsPrev.push(this.controlPoints[i * 3 + 0] + Math.cos(degreePrev) * this.handleRadius, this.controlPoints[i * 3 + 1] + Math.sin(degreePrev) * this.handleRadius, 0.0);
                handlePointsPrev.push(this.controlPoints[i * 3 + 0] + Math.cos(degreePrev) * this.handleRadius, this.controlPoints[i * 3 + 1] + Math.sin(degreePrev) * this.handleRadius, 0.0);
    
                handlePoints.push(this.controlPoints[i * 3 + 0] + Math.cos(degree) * this.handleRadius, this.controlPoints[i * 3 + 1] + Math.sin(degree) * this.handleRadius, 0.0);
                handlePoints.push(this.controlPoints[i * 3 + 0] + Math.cos(degree) * this.handleRadius, this.controlPoints[i * 3 + 1] + Math.sin(degree) * this.handleRadius, 0.0);
    
                handlePointsNext.push(this.controlPoints[i * 3 + 0] + Math.cos(degreeNext) * this.handleRadius, this.controlPoints[i * 3 + 1] + Math.sin(degreeNext) * this.handleRadius, 0.0);
                handlePointsNext.push(this.controlPoints[i * 3 + 0] + Math.cos(degreeNext) * this.handleRadius, this.controlPoints[i * 3 + 1] + Math.sin(degreeNext) * this.handleRadius, 0.0);
    
                handlePointsDirection.push(-1, 1);

                if (j != this.handleSamples) {
                    let offset = 2 * (this.handleSamples + 1) * i; // 2 points per point. 6 floats per point. handleSamples + 1 points. 
                    // handlePointsIndices.push((handlePoints.length/3) -  j * 2 + (i * this.handleSamples + 1), j*2+1 + (i * this.handleSamples + 1));
                    /* each two points creates two triangles in our strip. */
                    handlePointsIndices.push(j*2 + offset, j*2+2 + offset, j*2+1 + offset, j*2+2 + offset, j*2+3 + offset, j*2+1 + offset); // first pt, second pt
                }
            }
        }


        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.tDirection);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tDirection), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.t);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(doubleTs), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.controlPointsPrevious);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(prev), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.controlPointsPosition);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.controlPointsNext);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(next), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.controlPointsDirection);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ctlDirection), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.handlePointsPosition);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(handlePoints), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.handlePointsNext);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(handlePointsNext), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.handlePointsPrevious);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(handlePointsPrev), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.handlePointsDirection);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(handlePointsDirection), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.handlePointsIndices);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(handlePointsIndices), gl.STATIC_DRAW);
    }

    getBezierPoints() {
        let tValues = this.getTValues();
        let points = []
        let n = (this.controlPoints.length / 3) - 1; // degree

        /* for each point */
        for (let pi = 0; pi < this.numSamples; ++pi) {
            let p = vec3.create()
            let t = tValues[pi];

            for (let i = 0; i <= 128; ++i) {
                if (i > n) break;
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
            ts.push(i / (this.numSamples - 1));
        }
        return ts;
    }

    getClickedHandle(x, y) {
        for (var i = 0; i < this.controlPoints.length/3; ++i) {
            var deltaX = x - this.controlPoints[3 * i + 0];
            var deltaY = y - this.controlPoints[3 * i + 1];
            var distSqrd = deltaX * deltaX + deltaY + deltaY;
            if (distSqrd < (this.handleRadius * this.handleRadius)) return i;
        }
        return -1;
    }

    moveHandle(handleIdx, x, y) {
        this.controlPoints[3 * handleIdx + 0] = x;
        this.controlPoints[3 * handleIdx + 1] = y;
        console.log("Moving handle " + handleIdx + " to " + x + " " + y)
    }

    bernstein(n, k, t) {
        let result = 1.0;
        for (let i = 1.0; i <= 128; i++) {
            if (i > k) break;
            result *= (n - (k - i)) / i;
        }
        result *= Math.pow(t, k) * Math.pow(1.0 - t, n - k);
        return result;
    }

    drawCurve(projection, modelView, aspect, time) {
        let gl = Curve.gl;
        if (!Curve.BezierShaderProgram) return;

        // t values
        {
            const numComponents = 1;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.t);
            gl.vertexAttribPointer(
                Curve.BezierProgramInfo.attribLocations.t,
                numComponents,
                type,
                normalize,
                stride,
                offset);
            gl.enableVertexAttribArray(
                Curve.BezierProgramInfo.attribLocations.t);
        }

        // direction
        {
            const numComponents = 1;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.tDirection);
            gl.vertexAttribPointer(
                Curve.BezierProgramInfo.attribLocations.direction,
                numComponents,
                type,
                normalize,
                stride,
                offset);
            gl.enableVertexAttribArray(
                Curve.BezierProgramInfo.attribLocations.direction);
        }


        // Tell WebGL to use our program when drawing
        gl.useProgram(Curve.BezierProgramInfo.program);

        // Set the shader uniforms
        gl.uniformMatrix4fv(
            Curve.BezierProgramInfo.uniformLocations.projection,
            false,
            projection);

        gl.uniformMatrix4fv(
            Curve.BezierProgramInfo.uniformLocations.modelView,
            false,
            modelView);

        gl.uniform1f(
            Curve.BezierProgramInfo.uniformLocations.thickness,
            this.thickness);

        gl.uniform1f(
            Curve.BezierProgramInfo.uniformLocations.aspect,
            aspect);

        gl.uniform1i(
            Curve.BezierProgramInfo.uniformLocations.miter,
            0);

        gl.uniform1i(
            Curve.BezierProgramInfo.uniformLocations.numControlPoints,
            this.controlPoints.length / 3);

        gl.uniform3fv(
            Curve.BezierProgramInfo.uniformLocations.controlPoints,
            new Float32Array(this.controlPoints));
        {
            const vertexCount = this.numSamples * 2;
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertexCount);
        }
    }

    drawControlPoints(projection, modelView, aspect, time) {
        let gl = Curve.gl;

        if (!Curve.LineShaderProgram) return;

        // position values
        {
            const numComponents = 3;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.handlePointsPosition);
            gl.vertexAttribPointer(
                Curve.LineProgramInfo.attribLocations.position,
                numComponents,
                type,
                normalize,
                stride,
                offset);
            gl.enableVertexAttribArray(
                Curve.LineProgramInfo.attribLocations.position);
        }

        // previous values
        {
            const numComponents = 3;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.handlePointsPrevious);
            gl.vertexAttribPointer(
                Curve.LineProgramInfo.attribLocations.previous,
                numComponents,
                type,
                normalize,
                stride,
                offset);
            gl.enableVertexAttribArray(
                Curve.LineProgramInfo.attribLocations.previous);
        }

        // next values
        {
            const numComponents = 3;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.handlePointsNext);
            gl.vertexAttribPointer(
                Curve.LineProgramInfo.attribLocations.next,
                numComponents,
                type,
                normalize,
                stride,
                offset);
            gl.enableVertexAttribArray(
                Curve.LineProgramInfo.attribLocations.next);
        }

        // direction
        {
            const numComponents = 1;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.handlePointsDirection);
            gl.vertexAttribPointer(
                Curve.LineProgramInfo.attribLocations.direction,
                numComponents,
                type,
                normalize,
                stride,
                offset);
            gl.enableVertexAttribArray(
                Curve.LineProgramInfo.attribLocations.direction);
        }


        // Tell WebGL to use our program when drawing
        gl.useProgram(Curve.LineProgramInfo.program);

        // Set the shader uniforms
        gl.uniformMatrix4fv(
            Curve.LineProgramInfo.uniformLocations.projection,
            false,
            projection);

        gl.uniformMatrix4fv(
            Curve.LineProgramInfo.uniformLocations.modelView,
            false,
            modelView);

        gl.uniform1f(
            Curve.LineProgramInfo.uniformLocations.thickness,
            this.handleThickness);

        gl.uniform1f(
            Curve.LineProgramInfo.uniformLocations.aspect,
            aspect);

        gl.uniform1i(
            Curve.LineProgramInfo.uniformLocations.miter,
            0);

        {
            const vertexCount = (this.handleSamples * 6) * (this.controlPoints.length / 3);
            const type = gl.UNSIGNED_SHORT;
            const offset = 0;
            // gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertexCount);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.handlePointsIndices);
            gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
        }
    }

    drawControlPolygon(projection, modelView, aspect, time) {
        let gl = Curve.gl;

        if (!Curve.LineShaderProgram) return;

        // position values
        {
            const numComponents = 3;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.controlPointsPosition);
            gl.vertexAttribPointer(
                Curve.LineProgramInfo.attribLocations.position,
                numComponents,
                type,
                normalize,
                stride,
                offset);
            gl.enableVertexAttribArray(
                Curve.LineProgramInfo.attribLocations.position);
        }

        // previous values
        {
            const numComponents = 3;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.controlPointsPrevious);
            gl.vertexAttribPointer(
                Curve.LineProgramInfo.attribLocations.previous,
                numComponents,
                type,
                normalize,
                stride,
                offset);
            gl.enableVertexAttribArray(
                Curve.LineProgramInfo.attribLocations.previous);
        }

        // next values
        {
            const numComponents = 3;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.controlPointsNext);
            gl.vertexAttribPointer(
                Curve.LineProgramInfo.attribLocations.next,
                numComponents,
                type,
                normalize,
                stride,
                offset);
            gl.enableVertexAttribArray(
                Curve.LineProgramInfo.attribLocations.next);
        }

        // direction
        {
            const numComponents = 1;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.controlPointsDirection);
            gl.vertexAttribPointer(
                Curve.LineProgramInfo.attribLocations.direction,
                numComponents,
                type,
                normalize,
                stride,
                offset);
            gl.enableVertexAttribArray(
                Curve.LineProgramInfo.attribLocations.direction);
        }


        // Tell WebGL to use our program when drawing
        gl.useProgram(Curve.LineProgramInfo.program);

        // Set the shader uniforms
        gl.uniformMatrix4fv(
            Curve.LineProgramInfo.uniformLocations.projection,
            false,
            projection);

        gl.uniformMatrix4fv(
            Curve.LineProgramInfo.uniformLocations.modelView,
            false,
            modelView);

        gl.uniform1f(
            Curve.LineProgramInfo.uniformLocations.thickness,
            .01);

        gl.uniform1f(
            Curve.LineProgramInfo.uniformLocations.aspect,
            aspect);

        gl.uniform1i(
            Curve.LineProgramInfo.uniformLocations.miter,
            1);

        {
            const vertexCount = (this.controlPoints.length / 3) * 2;
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertexCount);
        }
    }

    draw(projection, modelView, aspect, time) {
        var gl = Curve.gl;
        // this.controlPoints[0] = gl.canvas.clientWidth * Math.cos(-time * .25) * .5 + gl.canvas.clientWidth * .5;;//this.position.x;
        // this.controlPoints[1] =gl.canvas.clientHeight * Math.sin(time * .5) * .5 + gl.canvas.clientHeight * .5;//this.position.y;

        // this.controlPoints[3] = gl.canvas.clientWidth * Math.cos(-time * .1) * .5 + gl.canvas.clientWidth * .5;
        // this.controlPoints[4] = gl.canvas.clientHeight * Math.sin(-time * .1) * .5 + gl.canvas.clientHeight * .5;

        // this.controlPoints[6] = gl.canvas.clientWidth * Math.cos(-time * .25) * .5 + gl.canvas.clientWidth * .5;
        // this.controlPoints[7] = gl.canvas.clientHeight * Math.sin(-time * .25) * .5 + gl.canvas.clientHeight * .5;

        // this.controlPoints[9] = gl.canvas.clientWidth * Math.cos(time * 1.0) * .5 + gl.canvas.clientWidth * .5;
        // this.controlPoints[10] = gl.canvas.clientHeight * Math.sin(time * .5) * .5 + gl.canvas.clientHeight * .5;

        // this.controlPoints[12] = gl.canvas.clientWidth * Math.cos(-time * .1) * .5 + gl.canvas.clientWidth * .5;//this.position.x;//-300 * Math.cos(time);
        // this.controlPoints[13] = gl.canvas.clientHeight * Math.sin(-time * .25) * .5 + gl.canvas.clientHeight * .5;//this.position.y;//-200 * Math.sin(time * .7);

        this.updateBuffers()
        if (this.showCurve) {
            this.drawCurve(projection, modelView, aspect, time);
        }

        if (this.showControlPoints) {
            this.drawControlPoints(projection, modelView, aspect, time);
        }

        if (this.showControlPolygon) {
            this.drawControlPolygon(projection, modelView, aspect, time);
        }

    }
}

export { Curve }