class CurveEditor {
    constructor() {
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

        // Vertex shader program
        const vsSource = `
            attribute vec4 aCurrentPosition;
            attribute vec4 aNextPosition;
            attribute float aDirection;
            attribute vec4 aColor;
            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;
            uniform float uThickness;
            uniform float uAspect;
            varying lowp vec4 vColor;

            uniform int uNumControlPoints;
            uniform vec4 uControlPoints[128];

            void main(void) {
            mat4 projViewModel = uProjectionMatrix * uModelViewMatrix;

            //into clip space
            vec4 currentProjected = projViewModel * aCurrentPosition;
            vec4 nextProjected = projViewModel * aNextPosition;

            //into NDC space [-1 .. 1]
            vec2 currentScreen = currentProjected.xy / currentProjected.w;
            vec2 nextScreen = nextProjected.xy / nextProjected.w;

            //correct for aspect ratio (screenWidth / screenHeight)
            currentScreen.x *= uAspect;
            nextScreen.x *= uAspect;

            //normal of line (B - A)
            vec2 dir = normalize(nextScreen - currentScreen);
            vec2 normal = vec2(-dir.y, dir.x);

            //extrude from center & correct aspect ratio
            normal *= uThickness/2.0;
            normal.x /= uAspect;

            //offset by the direction of this point in the pair (-1 or 1)
            vec4 offset = vec4(normal * aDirection, 0.0, 1.0);
            gl_Position = currentProjected + offset;
            vColor = aColor;
            }
        `;

        // Fragment shader program

        const fsSource = `
            varying lowp vec4 vColor;
            void main(void) {
            gl_FragColor = vColor;
            }
        `;

        // Initialize a shader program; this is where all the lighting
        // for the vertices and so forth is established.
        this.shaderProgram = this.initShaderProgram(this.gl, vsSource, fsSource);

        // Collect all the info needed to use the shader program.
        // Look up which attributes our shader program is using
        // for aCurrentPosition, aVevrtexColor and also
        // look up uniform locations.
        this.programInfo = {
            program: this.shaderProgram,
            attribLocations: {
                currentPosition: this.gl.getAttribLocation(this.shaderProgram, 'aCurrentPosition'),
                nextPosition: this.gl.getAttribLocation(this.shaderProgram, 'aNextPosition'),
                direction: this.gl.getAttribLocation(this.shaderProgram, 'aDirection'),
                vertexColor: this.gl.getAttribLocation(this.shaderProgram, 'aColor'),
            },
            uniformLocations: {
                projectionMatrix: this.gl.getUniformLocation(this.shaderProgram, 'uProjectionMatrix'),
                modelViewMatrix: this.gl.getUniformLocation(this.shaderProgram, 'uModelViewMatrix'),
                thickness: this.gl.getUniformLocation(this.shaderProgram, 'uThickness'),
                aspect: this.gl.getUniformLocation(this.shaderProgram, 'uAspect'),

                numControlPoints: this.gl.getUniformLocation(this.shaderProgram, 'uNumControlPoints'),
                controlPoints: this.gl.getUniformLocation(this.shaderProgram, 'uControlPoints'),
            },
        };

        this.buffers = this.initBuffers(this.gl);
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

    initBuffers(gl) {
        const currentPositionBuffer = gl.createBuffer();
        const nextPositionBuffer = gl.createBuffer();
        const directionBuffer = gl.createBuffer();
        const colorBuffer = gl.createBuffer();


        // Now create an array of positions for the cube.
        const currentPositions = [
            // Front face
            -1.0, -1.0, 1.0,
            -1.0, -1.0, 1.0,
            1.0, -1.0, 1.0,
            1.0, -1.0, 1.0,
            1.0, 1.0, 1.0,
            1.0, 1.0, 1.0,
            -1.0, 1.0, 1.0,
            -1.0, 1.0, 1.0,

            // Back face
            -1.0, -1.0, -1.0,
            -1.0, -1.0, -1.0,
            -1.0, 1.0, -1.0,
            -1.0, 1.0, -1.0,
            1.0, 1.0, -1.0,
            1.0, 1.0, -1.0,
            1.0, -1.0, -1.0,
            1.0, -1.0, -1.0,

            // Top face
            -1.0, 1.0, -1.0,
            -1.0, 1.0, -1.0,
            -1.0, 1.0, 1.0,
            -1.0, 1.0, 1.0,
            1.0, 1.0, 1.0,
            1.0, 1.0, 1.0,
            1.0, 1.0, -1.0,
            1.0, 1.0, -1.0,

            // Bottom face
            -1.0, -1.0, -1.0,
            -1.0, -1.0, -1.0,
            1.0, -1.0, -1.0,
            1.0, -1.0, -1.0,
            1.0, -1.0, 1.0,
            1.0, -1.0, 1.0,
            -1.0, -1.0, 1.0,
            -1.0, -1.0, 1.0,

            // Right face
            1.0, -1.0, -1.0,
            1.0, -1.0, -1.0,
            1.0, 1.0, -1.0,
            1.0, 1.0, -1.0,
            1.0, 1.0, 1.0,
            1.0, 1.0, 1.0,
            1.0, -1.0, 1.0,
            1.0, -1.0, 1.0,

            // Left face
            -1.0, -1.0, -1.0,
            -1.0, -1.0, -1.0,
            -1.0, -1.0, 1.0,
            -1.0, -1.0, 1.0,
            -1.0, 1.0, 1.0,
            -1.0, 1.0, 1.0,
            -1.0, 1.0, -1.0,
            -1.0, 1.0, -1.0,
        ];

        const nextPositions = [
            // Front face
            1.0, -1.0, 1.0,
            1.0, -1.0, 1.0,
            1.0, 1.0, 1.0,
            1.0, 1.0, 1.0,
            -1.0, 1.0, 1.0,
            -1.0, 1.0, 1.0,

            // Back face
            -1.0, -1.0, -1.0,
            -1.0, -1.0, -1.0,
            -1.0, 1.0, -1.0,
            -1.0, 1.0, -1.0,
            1.0, 1.0, -1.0,
            1.0, 1.0, -1.0,
            1.0, -1.0, -1.0,
            1.0, -1.0, -1.0,

            // Top face
            -1.0, 1.0, -1.0,
            -1.0, 1.0, -1.0,
            -1.0, 1.0, 1.0,
            -1.0, 1.0, 1.0,
            1.0, 1.0, 1.0,
            1.0, 1.0, 1.0,
            1.0, 1.0, -1.0,
            1.0, 1.0, -1.0,

            // Bottom face
            -1.0, -1.0, -1.0,
            -1.0, -1.0, -1.0,
            1.0, -1.0, -1.0,
            1.0, -1.0, -1.0,
            1.0, -1.0, 1.0,
            1.0, -1.0, 1.0,
            -1.0, -1.0, 1.0,
            -1.0, -1.0, 1.0,

            // Right face
            1.0, -1.0, -1.0,
            1.0, -1.0, -1.0,
            1.0, 1.0, -1.0,
            1.0, 1.0, -1.0,
            1.0, 1.0, 1.0,
            1.0, 1.0, 1.0,
            1.0, -1.0, 1.0,
            1.0, -1.0, 1.0,

            // Left face
            -1.0, -1.0, -1.0,
            -1.0, -1.0, -1.0,
            -1.0, -1.0, 1.0,
            -1.0, -1.0, 1.0,
            -1.0, 1.0, 1.0,
            -1.0, 1.0, 1.0,
            -1.0, 1.0, -1.0,
            -1.0, 1.0, -1.0,
        ];

        const directions = [
            // Front face
            -1.0,
            1.0,
            -1.0,
            1.0,
            -1.0,
            1.0,

            // Back face
            -1.0,
            1.0,
            -1.0,
            1.0,
            -1.0,
            1.0,

            // Top face
            -1.0,
            1.0,
            -1.0,
            1.0,
            -1.0,
            1.0,

            // Bottom face
            -1.0,
            1.0,
            -1.0,
            1.0,
            -1.0,
            1.0,

            // Right face
            -1.0,
            1.0,
            -1.0,
            1.0,
            -1.0,
            1.0,

            // Left face
            -1.0,
            1.0,
            -1.0,
            1.0,
            -1.0,
            1.0,
        ];

        gl.bindBuffer(gl.ARRAY_BUFFER, currentPositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(currentPositions), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, nextPositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nextPositions), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, directionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(directions), gl.STATIC_DRAW);

        // Now set up the colors for the faces. We'll use solid colors
        // for each face.

        const faceColors = [
            [1.0, 1.0, 1.0, 1.0],    // Front face: white
            [1.0, 0.0, 0.0, 1.0],    // Back face: red
            [0.0, 1.0, 0.0, 1.0],    // Top face: green
            [0.0, 0.0, 1.0, 1.0],    // Bottom face: blue
            [1.0, 1.0, 0.0, 1.0],    // Right face: yellow
            [1.0, 0.0, 1.0, 1.0],    // Left face: purple
        ];

        // Convert the array of colors into a table for all the vertices.

        var colors = [];

        for (var j = 0; j < faceColors.length; ++j) {
            const c = faceColors[j];

            // Repeat each color four times for the four vertices of the face
            colors = colors.concat(c, c, c, c);
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

        // // Build the element array buffer; this specifies the indices
        // // into the vertex arrays for each face's vertices.

        // const indexBuffer = gl.createBuffer();
        // gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

        // // This array defines each face as two triangles, using the
        // // indices into the vertex array to specify each triangle's
        // // position.

        // const indices = [
        //   0,  1,  2,      0,  2,  3,    // front
        //   4,  5,  6,      4,  6,  7,    // back
        //   8,  9,  10,     8,  10, 11,   // top
        //   12, 13, 14,     12, 14, 15,   // bottom
        //   16, 17, 18,     16, 18, 19,   // right
        //   20, 21, 22,     20, 22, 23,   // left
        // ];

        // Now send the element array to GL

        // gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,
        // new Uint16Array(indices), gl.STATIC_DRAW);

        return {
            currentPosition: currentPositionBuffer,
            nextPosition: nextPositionBuffer,
            direction: directionBuffer,
            color: colorBuffer
        };
    }

    // Draw the scene.
    drawScene(self, gl, programInfo, buffers, deltaTime) {
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
        mat4.rotate(modelViewMatrix,  // destination matrix
            modelViewMatrix,  // matrix to rotate
            self.cubeRotation * .7,// amount to rotate in radians
            [0, 1, 0]);       // axis to rotate around (X)

        // Current position
        {
            const numComponents = 3;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.currentPosition);
            gl.vertexAttribPointer(
                programInfo.attribLocations.currentPosition,
                numComponents,
                type,
                normalize,
                stride,
                offset);
            gl.enableVertexAttribArray(
                programInfo.attribLocations.currentPosition);
        }

        // Next position
        {
            const numComponents = 3;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.nextPosition);
            gl.vertexAttribPointer(
                programInfo.attribLocations.nextPosition,
                numComponents,
                type,
                normalize,
                stride,
                offset);
            gl.enableVertexAttribArray(
                programInfo.attribLocations.nextPosition);
        }

        // Direction
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

        // Colors
        {
            const numComponents = 4;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
            gl.vertexAttribPointer(
                programInfo.attribLocations.vertexColor,
                numComponents,
                type,
                normalize,
                stride,
                offset);
            gl.enableVertexAttribArray(
                programInfo.attribLocations.vertexColor);
        }

        // Tell WebGL which indices to use to index the vertices
        //gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);

        // Tell WebGL to use our program when drawing

        gl.useProgram(programInfo.program);

        // Set the shader uniforms

        gl.uniformMatrix4fv(
            programInfo.uniformLocations.projectionMatrix,
            false,
            projectionMatrix);
        gl.uniformMatrix4fv(
            programInfo.uniformLocations.modelViewMatrix,
            false,
            modelViewMatrix);

        gl.uniform1f(
            programInfo.uniformLocations.thickness,
            1.0);

        gl.uniform1f(
            programInfo.uniformLocations.aspect,
            aspect);

        {
            const vertexCount = 16;
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertexCount);
        }

        // Update the rotation for the next draw

        self.cubeRotation += deltaTime * .1;
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






