import { Curve } from "./Curve.js"

class CurveEditor {
    constructor() {
        this.testCurve = new Curve();
        this.cubeRotation = 0.0;
        this.then = 0.0;
        const canvas = document.querySelector('#glcanvas');
        this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        // If we don't have a GL context, give up now  
        if (!this.gl) {
            alert('Unable to initialize WebGL. Your browser or machine may not support it.');
            return;
        }

        this.resize(canvas)
        this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);

        // Fragment shader program

        let fsSource = "";
        let vsSource = "";

        let promises = [];
        promises.push($.ajax({
            url: "./Shaders/Bezier.vs",
            success: function (result) {
                vsSource = result.trim();
            }, error: function (result) {
                console.log("failed to load Bezier.vs with error ");
                console.log(result);
            }
        }));
        promises.push($.ajax({
            url: "./Shaders/Bezier.fs",
            success: function (result) {
                fsSource = result.trim();
            }, error: function (result) {
                console.log("failed to load Bezier.fs with error ");
                console.log(result);
            }
        }));

        Promise.all(promises).then(() => {

            // Initialize a shader program; this is where all the lighting
            // for the vertices and so forth is established.
            this.shaderProgram = this.initShaderProgram(this.gl, vsSource, fsSource);

            // Collect all the info needed to use the shader program.
            // Look up which attributes our shader program is using
            // for aposition, aVevrtexColor and also
            // look up uniform locations.
            this.programInfo = {
                program: this.shaderProgram,
                attribLocations: {
                    t: this.gl.getAttribLocation(this.shaderProgram, 't'),
                    direction: this.gl.getAttribLocation(this.shaderProgram, 'direction'),
                },
                uniformLocations: {
                    projection: this.gl.getUniformLocation(this.shaderProgram, 'projection'),
                    modelView: this.gl.getUniformLocation(this.shaderProgram, 'modelView'),
                    thickness: this.gl.getUniformLocation(this.shaderProgram, 'thickness'),
                    aspect: this.gl.getUniformLocation(this.shaderProgram, 'aspect'),
                    miter: this.gl.getUniformLocation(this.shaderProgram, 'miter'),
                    numControlPoints: this.gl.getUniformLocation(this.shaderProgram, 'uNumControlPoints'),
                    controlPoints: this.gl.getUniformLocation(this.shaderProgram, 'uControlPoints'),
                },
            };
        });


        this.buffers = this.initBuffers(this.gl, this.testCurve);
    }

    resize(canvas) {
        // Lookup the size the browser is displaying the canvas.
        var displayWidth = canvas.clientWidth;
        var displayHeight = canvas.clientHeight;

        // Check if the canvas is not the same size.
        if (canvas.width != displayWidth ||
            canvas.height != displayHeight) {

            // Make the canvas the same size
            canvas.width = displayWidth;
            canvas.height = displayHeight;
        }
    }

    // Initialize a shader program, so WebGL knows how to draw our data
    initShaderProgram(gl, vsSource, fsSource) {
        const vertexShader = this.loadShader(gl, gl.VERTEX_SHADER, vsSource);
        const fragmentShader = this.loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

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
    loadShader(gl, type, source) {
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

    initBuffers(gl, curve) {
        const tBuffer = gl.createBuffer();
        const directionBuffer = gl.createBuffer();
        
        let t = curve.getTValues();

        /* Double each t, adding a direction */
        let direction = [];
        let doubleTs = [];
        for (var i = 0; i < t.length; ++i) {
            direction.push(-1, 1)
            doubleTs.push(t[i], t[i])
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, directionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(direction), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, tBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(doubleTs), gl.STATIC_DRAW);

        return {
            direction: directionBuffer,
            t: tBuffer,
        };
    }

    // Draw the scene.
    drawScene(self, gl, programInfo, buffers, deltaTime) {
        if (!self.shaderProgram) return;
        gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
        gl.clearDepth(1.0);                 // Clear everything
        gl.enable(gl.DEPTH_TEST);           // Enable depth testing
        gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

        // Clear the canvas before we start drawing on it.
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Create a perspective matrix, a special matrix that is
        // used to simulate the distortion of perspective in a camera.
        // Our field of view is 45 degrees, with a width/height
        // ratio that matches the display size of the canvas
        // and we only want to see objects between 0.1 units
        // and 100 units away from the camera.

        const fieldOfView = 45 * Math.PI / 180;   // in radians
        const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
        const zNear = 0.1;
        const zFar = 100.0;
        const projectionMatrix = mat4.create();

        // note: glmatrix.js always has the first argument
        // as the destination to receive the result.
        mat4.perspective(projectionMatrix,
            fieldOfView,
            aspect,
            zNear,
            zFar);

        // Set the drawing position to the "identity" point, which is
        // the center of the scene.
        const modelViewMatrix = mat4.create();

        // Now move the drawing position a bit to where we want to
        // start drawing the square.

        mat4.translate(modelViewMatrix,     // destination matrix
            modelViewMatrix,     // matrix to translate
            [-0.0, 0.0, -6.0]);  // amount to translate
        mat4.rotate(modelViewMatrix,  // destination matrix
            modelViewMatrix,  // matrix to rotate
            self.cubeRotation,     // amount to rotate in radians
            [0, 0, 1]);       // axis to rotate around (Z)
        // mat4.rotate(modelViewMatrix,  // destination matrix
        //     modelViewMatrix,  // matrix to rotate
        //     self.cubeRotation * .7,// amount to rotate in radians
        //     [0, 1, 0]);       // axis to rotate around (X)


        // t values
        {
            const numComponents = 1;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.t);
            gl.vertexAttribPointer(
                programInfo.attribLocations.t,
                numComponents,
                type,
                normalize,
                stride,
                offset);
            gl.enableVertexAttribArray(
                programInfo.attribLocations.t);
        }

        // direction
        {
            const numComponents = 1;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.direction);
            gl.vertexAttribPointer(
                programInfo.attribLocations.direction,
                numComponents,
                type,
                normalize,
                stride,
                offset);
            gl.enableVertexAttribArray(
                programInfo.attribLocations.direction);
        }

        
        // Tell WebGL to use our program when drawing
        gl.useProgram(programInfo.program);

        // Set the shader uniforms
        gl.uniformMatrix4fv(
            programInfo.uniformLocations.projection,
            false,
            projectionMatrix);

            gl.uniformMatrix4fv(
            programInfo.uniformLocations.modelView,
            false,
            modelViewMatrix);

        gl.uniform1f(
            programInfo.uniformLocations.thickness,
            this.testCurve.thickness);

        gl.uniform1f(
            programInfo.uniformLocations.aspect,
            aspect);
        
        gl.uniform1i(
            programInfo.uniformLocations.miter,
            0);

        gl.uniform1i(
            programInfo.uniformLocations.numControlPoints,
            self.testCurve.controlPoints.length / 3);
        
        gl.uniform3fv(
            programInfo.uniformLocations.controlPoints,
            new Float32Array(self.testCurve.controlPoints));

            self.testCurve.controlPoints[0] = 3 * Math.cos(self.then);
            self.testCurve.controlPoints[1] = 3 * Math.sin(self.then);

            self.testCurve.controlPoints[3] = 2 * Math.cos(self.then * .5);
            self.testCurve.controlPoints[4] = 2 * Math.sin(self.then * .5);

            self.testCurve.controlPoints[6] = Math.cos(self.then * .25);
            self.testCurve.controlPoints[7] = Math.sin(self.then * .25);

            self.testCurve.controlPoints[9] = -1 * Math.cos(self.then * .5);
            self.testCurve.controlPoints[10] = -2 * Math.sin(self.then * .5);

            self.testCurve.controlPoints[12] = -3 * Math.cos(self.then);
            self.testCurve.controlPoints[13] = -2 * Math.sin(self.then * .7);



        {
            const vertexCount = self.testCurve.numSamples * 2;
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertexCount);
        }

        // Update the rotation for the next draw
        // self.cubeRotation += deltaTime * .5;
    }



    render(now) {
        now *= 0.001;  // convert to seconds
        const deltaTime = now - this.then;
        this.then = now;

        this.drawScene(this, this.gl, this.programInfo, this.buffers, deltaTime);
    }
}

export { CurveEditor };








// import {Curve} from './Curve.js'
// let testCurve = new Curve()
// 






