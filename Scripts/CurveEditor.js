import { Curve } from "./Curve.js"

class CurveEditor {
    constructor() {
        this.pointJustAdded = false;
        this.selectedCurve = 0;
        this.selectedHandle = -1;
        this.showCurves = true;
        this.showControlPolygons = true;
        this.showControlHandles = true;
        this.then = 0.0;
        this.canvas = document.querySelector('#glcanvas');
        this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
        this.position = { x: 0, y: 0 };
        this.zoom = 1.0;

        // If we don't have a GL context, give up now  
        if (!this.gl) {
            alert('Unable to initialize WebGL. Your browser or machine may not support it.');
            return;
        }

        /* Handle canvas resizes */
        this.resize();
        this.canvas.onresize = function () { this.resize(); }

        /* Initialize curve shaders, start off with a random curve */
        Curve.Initialize(this.gl);
        this.curves = [];
        for (let i = 0; i < 1; ++i) {
            this.curves.push(new Curve());
            this.curves[i].controlPoints = []
            for (let j = 0; j < 10; ++j) {
                this.curves[i].addHandle((this.canvas.clientWidth / 4.0) * (2.0 * Math.random() - 1.0), (this.canvas.clientHeight / 4.0) * (2.0 * Math.random() - 1.0))
            }
        }

        /* Setup Hammer Events / */
        var hammer = new Hammer(this.canvas, {
            domEvents: true
        });

        hammer.get('pinch').set({
            enable: true
        });

        hammer.get('pan').set({
            threshold: 0
        });

        /* Pan */
        hammer.on('panstart', (e) => { this.panStart(e.center.x, e.center.y); });
        hammer.on('pan', (e) => { this.pan(e.changedPointers[0].clientX, e.changedPointers[0].clientY, e.deltaX, e.deltaY); });
        hammer.on('panend', (e) => { this.panEnd(); });

        /* Press */
        hammer.on('press', (e) => { this.press(e.center.x, e.center.y); });
        hammer.on('pressup', (e) => { this.pressUp(); });

        /* Pinch */
        hammer.on('pinchstart', (e) =>  { this.panStart(e.center.x, e.center.y); });

        hammer.on('pinch', (e) => { this.pan(e.changedPointers[0].clientX, e.changedPointers[0].clientY, e.deltaX, e.deltaY); });
        hammer.on('pinchend', (e) => { this.panEnd(); });

        /* Double tap */
        hammer.on('doubletap', (e) => { this.doubleTap(); });

        /* Setup keyboard shortcuts */
        document.onkeyup = (e) => {
            console.log("The key code is: " + e.keyCode);
            if (e.keyCode == 67) this.hideCurves();
            if (e.keyCode == 76) this.hideControlPolygons();
            if (e.keyCode == 80) this.hideControlHandles();
            if (e.keyCode == 65) this.addHandle();
            if (e.keyCode == 46) this.deleteLastHandle();
            if (e.keyCode == 78) this.newCurve();
        };

        /* Prevent right clicking the webgl canvas */
        this.canvas.oncontextmenu = function (e) {
            e.preventDefault();
            return false;
        }
    }

    /* Changes the webgl viewport to account for screen resizes */
    resize() {
        // Lookup the size the browser is displaying the canvas.
        var displayWidth = this.canvas.clientWidth;
        var displayHeight = this.canvas.clientHeight;

        // Check if the canvas is not the same size.
        if (this.canvas.width != displayWidth ||
            this.canvas.height != displayHeight) {

            // Make the canvas the same size
            this.canvas.width = displayWidth;
            this.canvas.height = displayHeight;
            this.gl.viewport(-this.canvas.clientWidth / 2, -this.canvas.clientHeight / 2, 2 * this.canvas.clientWidth, 2 * this.canvas.clientHeight);
        }
    }

    panStart(initialX, initialY) {
        // console.log(e)
        /* Check if we're moving a point */
        this.selectedHandle = -1;
        // this.selectedCurve = -1;
        for (var j = 0; j < this.curves.length; ++j) {
            var ctl_idx = this.curves[j].getClickedHandle(
                (initialX - + this.gl.canvas.clientWidth / 2.0) - this.position.x,
                (initialY - this.gl.canvas.clientHeight / 2.0) - this.position.y)
            if (ctl_idx != -1) {
                console.log("Handle " + ctl_idx + " was pressed");
                this.selectedHandle = ctl_idx;
                this.selectedCurve = j;
                break;
            }
        }

        if (this.selectedHandle == -1) {
            this.originalPosition = { x: this.position.x, y: this.position.y };
        }
    }

    pan(x, y, deltax, deltay) {
        if (this.selectedHandle == -1) {
            this.position.x = this.originalPosition.x + deltax;
            this.position.y = this.originalPosition.y + deltay;
        } else {
            this.pointJustAdded = false;
            this.curves[this.selectedCurve].moveHandle(this.selectedHandle,
                (x - this.gl.canvas.clientWidth / 2.0) - this.position.x,
                (y - this.gl.canvas.clientHeight / 2.0) - this.position.y);
        }
    }

    panEnd() {
        if (this.selectedHandle == -1) {
            this.originalPosition = this.position;
        }
    }

    press(x, y) {
        if (this.selectedCurve != -1) {
            if (this.curves[this.selectedCurve].getClickedHandle(
                (x - + this.gl.canvas.clientWidth / 2.0) - this.position.x,
                (y - this.gl.canvas.clientHeight / 2.0) - this.position.y) == -1) {
                if (this.pointJustAdded == false) {
                    this.curves[this.selectedCurve].addHandle(
                        (x - + this.gl.canvas.clientWidth / 2.0) - this.position.x,
                        (y - this.gl.canvas.clientHeight / 2.0) - this.position.y);
                    this.selectedHandle = (this.curves[this.selectedCurve].controlPoints.length / 3) - 1;
                } else {
                    this.curves[this.selectedCurve].moveHandle(this.selectedHandle,
                        (x - + this.gl.canvas.clientWidth / 2.0) - this.position.x,
                        (y - this.gl.canvas.clientHeight / 2.0) - this.position.y);
                }
                this.pointJustAdded = true;
            }
        }
    }

    pressUp() {
        this.pointJustAdded = false;
    }

    doubleTap() {
        this.position.x = 0;
        this.position.y = 0;
    }

    /* Draws the curves to the screen */
    render(now) {
        now *= 0.001;  // convert to seconds
        const deltaTime = now - this.then;
        this.then = now;
        let gl = this.gl;

        /* Set OpenGL state */
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clearDepth(1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        /* Setup the projection */
        const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
        const orthoMatrix = mat4.create();
        mat4.ortho(orthoMatrix, -gl.canvas.clientWidth, gl.canvas.clientWidth, gl.canvas.clientHeight, -gl.canvas.clientHeight, -1.0, 1.0)
        let zoom = vec3.create();
        vec3.set(zoom, this.zoom, this.zoom, 1.0);
        mat4.scale(orthoMatrix, orthoMatrix, zoom);

        /* Move the camera */
        const modelViewMatrix = mat4.create();
        mat4.translate(modelViewMatrix, modelViewMatrix, [this.position.x, this.position.y, -1.0]);

        /* Now draw our curves */
        for (let i = 0; i < this.curves.length; ++i) {
            this.curves[i].draw(orthoMatrix, modelViewMatrix, aspect, now);
        }
    }

    /* Adds a new curve to the scene */
    newCurve() {
        this.curves.push(new Curve(-this.position.x, -this.position.y))
    }

    /* Deletes the last clicked handle */
    deleteLastHandle() {
        if (this.selectedCurve != -1 && this.selectedHandle != -1) {
            if (this.curves[this.selectedCurve].controlPoints.length <= 3) {
                this.curves.splice(this.selectedCurve, 1);
                this.selectedCurve = -1;
                this.selectedHandle = -1;
            } else {
                console.log("Deleting point");
                this.curves[this.selectedCurve].removeHandle(this.selectedHandle);
                this.selectedHandle = -1;
            }
        }
    }

    addHandle() {
        if (this.selectedCurve != -1) {
            this.curves[this.selectedCurve].addHandle(-this.position.x, -this.position.y);
        }
    }

    /* Deletes the last modified curve */
    deleteLastCurve() {
        if (this.selectedCurve != -1) {
            this.curves.splice(this.selectedCurve, 1);
            this.selectedCurve = -1;
            this.selectedHandle = -1;
        }
    }

    /* Hides the control polygon connecting the curve handles */
    hideControlPolygons() {
        this.showControlPolygons = !this.showControlPolygons;
        for (var j = 0; j < this.curves.length; ++j) {
            this.curves[j].showControlPolygon = this.showControlPolygons;
        }
    }

    /* Hides the handles which deform the curves */
    hideControlHandles() {
        this.showControlHandles = !this.showControlHandles;
        for (var j = 0; j < this.curves.length; ++j) {
            this.curves[j].showControlPoints = this.showControlHandles;
        }
    }

    /* Hide the generated curves */
    hideCurves() {
        this.showCurves = !this.showCurves;
        for (var j = 0; j < this.curves.length; ++j) {
            this.curves[j].showCurve = this.showCurves;
        }
    }
}

export { CurveEditor };