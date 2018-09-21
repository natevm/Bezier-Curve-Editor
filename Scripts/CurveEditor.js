import { Curve } from "./Curve.js"

class CurveEditor {
    constructor() {
        this.then = 0.0;
        this.canvas = document.querySelector('#glcanvas');
        this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
        
        // If we don't have a GL context, give up now  
        if (!this.gl) {
            alert('Unable to initialize WebGL. Your browser or machine may not support it.');
            return;
        }

        this.resize();

        this.canvas.onresize = function () {
            console.log("RESIZING");
            this.resize();
        }

        this.position = { x: 0, y: 0 };
        this.zoom = 1.0;
        
        var hammer = new Hammer(this.canvas, {
            domEvents: true
        });

        hammer.get('pinch').set({
            enable: true
        });

        hammer.get('pan').set({
            threshold: 0
        });

        hammer.on('panstart', (e) => {
            console.log(e)
            /* Check if we're moving a point */
            this.handleToMove = -1;
            this.selectedCurve = -1;
            for (var j = 0; j < this.curves.length; ++j ) {
                var ctl_idx = this.curves[j].getClickedHandle(e.center.x - this.position.x, (e.center.y - this.position.y))
                if (ctl_idx != -1) {
                    console.log("Handle " + ctl_idx + " was pressed");
                    this.handleToMove = ctl_idx;
                    this.selectedCurve = j;
                    break;
                }
            }
            
            if (this.handleToMove == -1) {
                this.originalPosition = {x: this.position.x, y: this.position.y};
            }
        });

        hammer.on('pan', (e) => {
            if (this.handleToMove == -1) {
                this.position.x = this.originalPosition.x + e.deltaX;
                this.position.y = this.originalPosition.y + e.deltaY;
            } else {
                this.curves[this.selectedCurve].moveHandle(this.handleToMove, e.changedPointers[0].clientX - this.position.x, (e.changedPointers[0].clientY - this.position.y));
            }
        });

        hammer.on('panend', (e) => {
            if (this.handleToMove == -1) {
                this.originalPosition = this.position;
            } else {
                this.handleToMove = -1;
                this.selectedCurve = -1;
            }
        });

        // hammer.on('pinch', function (e) {
        //     // We only calculate the pinch center on the first pinch event as we want the center to
        //     // stay consistent during the entire pinch
        //     if (pinchCenter === null) {
        //         pinchCenter = rawCenter(e);
        //         var offsetX = pinchCenter.x * scale - (-x * scale + Math.min(viewportWidth, curWidth) / 2);
        //         var offsetY = pinchCenter.y * scale - (-y * scale + Math.min(viewportHeight, curHeight) / 2);
        //         pinchCenterOffset = { x: offsetX, y: offsetY };
        //     }

        //     // When the user pinch zooms, she/he expects the pinch center to remain in the same
        //     // relative location of the screen. To achieve this, the raw zoom center is calculated by
        //     // first storing the pinch center and the scaled offset to the current center of the
        //     // image. The new scale is then used to calculate the zoom center. This has the effect of
        //     // actually translating the zoom center on each pinch zoom event.
        //     var newScale = restrictScale(scale * e.scale);
        //     var zoomX = pinchCenter.x * newScale - pinchCenterOffset.x;
        //     var zoomY = pinchCenter.y * newScale - pinchCenterOffset.y;
        //     var zoomCenter = { x: zoomX / newScale, y: zoomY / newScale };

        //     zoomAround(e.scale, zoomCenter.x, zoomCenter.y, true);
        // });

        // hammer.on('pinchend', function (e) {
        //     updateLastScale();
        //     updateLastPos();
        //     pinchCenter = null;
        // });

        // hammer.on('doubletap', function (e) {
        //     var c = rawCenter(e);
        //     zoomAround(2, c.x, c.y);
        // });

        
        
        Curve.Initialize(this.gl);
        this.curves = [];
        for (let i = 0; i < 3; ++i) {
            this.curves.push(new Curve());
        }
        
        document.onkeyup = (e) => {
            console.log("The key code is: " + e.keyCode);
            if (e.keyCode == 67) {
                for (var j = 0; j < this.curves.length; ++j ) {
                    this.curves[j].showCurve = !this.curves[j].showCurve;
                }
            }

            if (e.keyCode == 76) {
                for (var j = 0; j < this.curves.length; ++j ) {
                    this.curves[j].showControlPolygon = !this.curves[j].showControlPolygon;
                }
            }

            if (e.keyCode == 80) {
                for (var j = 0; j < this.curves.length; ++j ) {
                    this.curves[j].showControlPoints = !this.curves[j].showControlPoints;
                }
            }
            
        };
    }

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

    render(now) {
        now *= 0.001;  // convert to seconds
        const deltaTime = now - this.then;
        this.then = now;
        let gl = this.gl;
        
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clearDepth(1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        const fieldOfView = 45 * Math.PI / 180;   // in radians
        const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
        const zNear = 0.1;
        const zFar = 100.0;
        const projectionMatrix = mat4.create();

        // // note: glmatrix.js always has the first argument
        // // as the destination to receive the result.
        // mat4.perspective(projectionMatrix,
        //     fieldOfView,
        //     aspect,
        //     zNear,
        //     zFar);

        mat4.ortho(projectionMatrix, 0.0, gl.canvas.clientWidth, gl.canvas.clientHeight, 0.0, -1.0, 1.0)
        let zoom = vec3.create();
        vec3.set(zoom, this.zoom, this.zoom, 1.0);
        mat4.scale(projectionMatrix, projectionMatrix, zoom);

        const modelViewMatrix = mat4.create();
        mat4.translate(modelViewMatrix, modelViewMatrix, [this.position.x, this.position.y, -1.0]);

        /* Now draw our curves */
        for (let i = 0; i < this.curves.length; ++i) {
            this.curves[i].draw(projectionMatrix, modelViewMatrix, aspect, 1000); //this.then * .2 * (i+1)
        }
    }
}

export { CurveEditor };