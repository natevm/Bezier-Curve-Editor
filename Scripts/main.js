import { CurveEditor } from "./CurveEditor.js"
import { Curve } from "./Curve.js"

/* Is this required? */
let curveEditor;

const render = function (time) {
    curveEditor.render(time);
    requestAnimationFrame(render);
};

document.addEventListener('DOMContentLoaded', function () {
    curveEditor = new CurveEditor();
    requestAnimationFrame(render);

    var button = document.getElementById("newCurve");
    button.addEventListener("click", (e) => { curveEditor.newCurve() });

    var deleteButton = document.getElementById("Delete");
    deleteButton.addEventListener("click", (e) => { curveEditor.deleteLastHandle() })

    var hideControlPolygonButton = document.getElementById("HideControlPolygons");
    hideControlPolygonButton.addEventListener("click", (e) => { curveEditor.hideControlPolygons() })

    var hideControlHandlesButton = document.getElementById("HideControlHandles");
    hideControlHandlesButton.addEventListener("click", (e) => { curveEditor.hideControlHandles() })

    var hideCurves = document.getElementById("HideCurves");
    hideCurves.addEventListener("click", (e) => { curveEditor.hideCurves() })

    var UploadFileButton = document.getElementById("UploadFile");
    UploadFileButton.addEventListener("change", (e) => {
        function cleanArray(actual) {
            var newArray = new Array();
            for (var i = 0; i < actual.length; i++) {
                var temp = actual[i].trim()
                if (temp.indexOf('#') != -1) {
                    temp = temp.substring(0, temp.indexOf('#'));
                }
                if (temp && temp.length >= 1) {
                    newArray.push(temp);
                }
            }
            return newArray;
        }

        function assert(condition, message) {
            if (!condition) {
                message = message || "Assertion failed";
                if (typeof Error !== "undefined") {
                    throw new Error(message);
                }
                throw message; // Fallback
            }
        }

        var selectedFile = event.target.files[0];
        var reader = new FileReader();
        reader.onload = (event) => {
            var lines = event.target.result.split("\n");
            lines = cleanArray(lines)
            var numCurves = parseInt(lines[0], 10);
            assert(numCurves >=0, "Number of curves must be greater than or equal to zero! (P >= 0)")
            lines = lines.splice(1)
            
            var curves = [];
            var lineIdx = 0;
            for (var i = 0; i < numCurves; ++i) {
                curves[i] = new Curve();
                var numPoints = -1;
                /* remove the P, get total points in first line */
                lines[lineIdx] = lines[lineIdx].substring(1)
                lines[lineIdx] = lines[lineIdx].trim()
                numPoints = parseInt(lines[lineIdx])
                lines = lines.splice(1)
                
                console.log("new curve")
                curves[i].controlPoints = []
                for (var j = 0; j < numPoints; ++j)  {
                    var separators = [' ', '\t'];
                    var strArray = lines[0].split(new RegExp('[' + separators.join('') + ']', 'g'));
                    strArray = cleanArray(strArray)
                    assert(strArray.length == 2);
                    var x = parseFloat(strArray[0])
                    var y = parseFloat(strArray[1])
                    console.log("x: " + x + " y: " + y); 
                    lines = lines.splice(1)
                    curves[i].controlPoints.push(x * 50.0, -y * 50.0, 0.0)
                }

                curveEditor.curves.push(curves[i])


            }

            console.log(lines);
        }
        reader.readAsText(selectedFile);
    });
});

window.onresize = function () {
    curveEditor.resize()
};
