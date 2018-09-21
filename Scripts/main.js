import {CurveEditor} from "./CurveEditor.js"
import {Curve} from "./Curve.js"

/* Is this required? */ 
let curveEditor;

const render = function(time) {
    curveEditor.render(time);
    requestAnimationFrame(render);
};

document.addEventListener('DOMContentLoaded', function () {
    curveEditor = new CurveEditor();
    requestAnimationFrame(render);
});

window.onresize = function() {
    curveEditor.resize()
};
