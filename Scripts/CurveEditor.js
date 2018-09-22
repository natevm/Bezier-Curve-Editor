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
            // console.log(e)
            /* Check if we're moving a point */
            this.selectedHandle = -1;
            // this.selectedCurve = -1;
            for (var j = 0; j < this.curves.length; ++j ) {
                var ctl_idx = this.curves[j].getClickedHandle(
                    (e.center.x - + this.gl.canvas.clientWidth/2.0) - this.position.x, 
                    (e.center.y - this.gl.canvas.clientHeight/2.0) - this.position.y)
                if (ctl_idx != -1) {
                    console.log("Handle " + ctl_idx + " was pressed");
                    this.selectedHandle = ctl_idx;
                    this.selectedCurve = j;
                    break;
                }
            }
            
            if (this.selectedHandle == -1) {
                this.originalPosition = {x: this.position.x, y: this.position.y};
            }
        });

        hammer.on('pan', (e) => {
            if (this.selectedHandle == -1) {
                this.position.x = this.originalPosition.x + e.deltaX;
                this.position.y = this.originalPosition.y + e.deltaY;
            } else {
                this.pointJustAdded = false;
                this.curves[this.selectedCurve].moveHandle(this.selectedHandle, 
                    (e.changedPointers[0].clientX - this.gl.canvas.clientWidth/2.0) - this.position.x, 
                    (e.changedPointers[0].clientY - this.gl.canvas.clientHeight/2.0) - this.position.y);
            }
        });

        hammer.on('panend', (e) => {
            if (this.selectedHandle == -1) {
                this.originalPosition = this.position;
            } else {
                // this.selectedHandle = -1;
            }
        });

        hammer.on('press', (e) => {
            if (this.selectedCurve != -1) {
                if (this.curves[this.selectedCurve].getClickedHandle(
                    (e.center.x - + this.gl.canvas.clientWidth/2.0) - this.position.x, 
                    (e.center.y - this.gl.canvas.clientHeight/2.0) - this.position.y) == -1)
                    {
                        if (this.pointJustAdded == false ){
                            this.curves[this.selectedCurve].addHandle(
                                (e.center.x - + this.gl.canvas.clientWidth/2.0) - this.position.x, 
                                (e.center.y - this.gl.canvas.clientHeight/2.0) - this.position.y);
                            this.selectedHandle = (this.curves[this.selectedCurve].controlPoints.length / 3) - 1;
                        } else {
                            this.curves[this.selectedCurve].moveHandle(this.selectedHandle,
                                (e.center.x - + this.gl.canvas.clientWidth/2.0) - this.position.x, 
                                (e.center.y - this.gl.canvas.clientHeight/2.0) - this.position.y);
                        }                
                        this.pointJustAdded = true;
                    }
                }
        });

        hammer.on('pressup', (e) => {
            this.pointJustAdded = false;
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
        // for (let i = 0; i < 1; ++i) {
        //     this.curves.push(new Curve());
        // }
        
        document.onkeyup = (e) => {
            console.log("The key code is: " + e.keyCode);
            if (e.keyCode == 67) {
                this.hideCurves();
            }

            if (e.keyCode == 76) {
                this.hideControlPolygons();
            }

            if (e.keyCode == 80) {
                this.hideControlHandles();
            }

            if (e.keyCode == 65) {
                if (this.selectedCurve != -1) {
                    console.log("Adding new point");
                    this.curves[this.selectedCurve].addHandle(-this.position.x, -this.position.y);
                }
            }

            if (e.keyCode == 46) {
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

            if (e.keyCode == 78) {
                this.curves.push(new Curve(-this.position.x, -this.position.y))
            }

            this.canvas.oncontextmenu=function(e){
                e.preventDefault();
                return false;
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

        mat4.ortho(projectionMatrix, -gl.canvas.clientWidth, gl.canvas.clientWidth, gl.canvas.clientHeight, -gl.canvas.clientHeight, -1.0, 1.0)
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

    newCurve() {
        this.curves.push(new Curve(-this.position.x, -this.position.y))
    }

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

    hideControlPolygons() {
        this.showControlPolygons = !this.showControlPolygons;
        for (var j = 0; j < this.curves.length; ++j ) {
            this.curves[j].showControlPolygon = this.showControlPolygons;
        }
    }
    
    hideControlHandles() {
        this.showControlHandles = !this.showControlHandles;
        for (var j = 0; j < this.curves.length; ++j ) {
            this.curves[j].showControlPoints = this.showControlHandles;
        }
    }
    
    hideCurves() {
        this.showCurves = !this.showCurves;
        for (var j = 0; j < this.curves.length; ++j ) {
            this.curves[j].showCurve = this.showCurves;
        }
    }
}

export { CurveEditor };