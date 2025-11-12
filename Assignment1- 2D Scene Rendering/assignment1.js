
var gl;
var color;
var matrixStack = [];
var mMatrix = mat4.create();
var uMMatrixLocation;

var aPositionLocation;
var uColorLoc;

var animation;

// for back and forth motion of the boat
let x_direction_translation = 0.0;

let direction = 1;
let boat_red_x = 0;       // red boat
let red_boat_direction = 1;     // 1 = right, -1 = left

let boat_purple_x = -0.5;    // purple boat (start more left)
let purple_boat_dir = 1;     

let boatSpeed = 0.003;   // tweak speed
let boatRange = 0.9;  
// for rotation of the windmill and sun
let rotationAngle = 0.0;
const rotationSpeed = 0.03;

// for drawing the circle
const numSegments = 100; // Number of segments for the circle
const angleIncrement = (Math.PI * 2) / numSegments;

var mode = 's';  // mode for drawing

const vertexShaderCode = `#version 300 es
in vec2 aPosition;
uniform mat4 uMMatrix;

void main() {
    gl_Position = uMMatrix*vec4(aPosition,0.0,1.0);
    gl_PointSize = 5.0;
}`;

const fragShaderCode = `#version 300 es
precision mediump float;
out vec4 fragColor;
uniform vec4 color;

void main() {
    fragColor = color;
}`;

function pushMatrix(stack, m) {
    //necessary because javascript only does shallow push
    var copy = mat4.create(m);
    stack.push(copy);
}

function popMatrix(stack) {
    if (stack.length > 0) return stack.pop();
    else console.log("stack has no matrix to pop!");
}

function degToRad(degrees) {
    return (degrees * Math.PI) / 180;
}

function vertexShaderSetup(vertexShaderCode) {
    shader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(shader, vertexShaderCode);
    gl.compileShader(shader);
    // Error check whether the shader is compiled correctly
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(shader));
        return null;
    }
    return shader;
}

function fragmentShaderSetup(fragShaderCode) {
    shader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(shader, fragShaderCode);
    gl.compileShader(shader);
    // Error check whether the shader is compiled correctly
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(shader));
        return null;
    }
    return shader;
}

function initShaders() {
    shaderProgram = gl.createProgram();
    var vertexShader = vertexShaderSetup(vertexShaderCode);
    var fragmentShader = fragmentShaderSetup(fragShaderCode);

    // attach the shaders
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    //link the shader program
    gl.linkProgram(shaderProgram);

    // check for compilation and linking status
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.log(gl.getShaderInfoLog(vertexShader));
        console.log(gl.getShaderInfoLog(fragmentShader));
    }

    //finally use the program.
    gl.useProgram(shaderProgram);

    return shaderProgram;
}

function initGL(canvas) {
    try {
        gl = canvas.getContext("webgl2"); // the graphics webgl2 context
        gl.viewportWidth = canvas.width; // the width of the canvas
        gl.viewportHeight = canvas.height; // the height
    } catch (e) {}
    if (!gl) {
        alert("WebGL initialization failed");
    }
}

// drawing a square
function initSquareBuffer() {
    // buffer for point locations
    const sqVertices = new Float32Array([
        0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
    ]);
    sqVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sqVertexPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sqVertices, gl.STATIC_DRAW);
    sqVertexPositionBuffer.itemSize = 2;
    sqVertexPositionBuffer.numItems = 4;

    // buffer for point indices
    const sqIndices = new Uint16Array([0, 1, 2, 0, 2, 3]);
    sqVertexIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sqVertexIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sqIndices, gl.STATIC_DRAW);
    sqVertexIndexBuffer.itemsize = 1;
    sqVertexIndexBuffer.numItems = 6;
}

function drawSquare(color, mMatrix) {
    gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);

    // buffer for point locations
    gl.bindBuffer(gl.ARRAY_BUFFER, sqVertexPositionBuffer);
    gl.vertexAttribPointer(aPositionLocation, sqVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

    // buffer for point indices
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sqVertexIndexBuffer);
    gl.uniform4fv(uColorLoc, color);

    // now draw the square
    // show the solid view
    if (mode === 's') {
        gl.drawElements(gl.TRIANGLES, sqVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
    }
    // show the wireframe view
    else if (mode === 'w') {
        gl.drawElements(gl.LINE_LOOP, sqVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
    }
    // show the point view
    else if (mode === 'p') {
        gl.drawElements(gl.POINTS, sqVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
    }    
}

// drawing a triangle
function initTriangleBuffer() {
    // buffer for point locations
    const triangleVertices = new Float32Array([0.0, 0.5, -0.5, -0.5, 0.5, -0.5]);
    triangleBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, triangleBuf);
    gl.bufferData(gl.ARRAY_BUFFER, triangleVertices, gl.STATIC_DRAW);
    triangleBuf.itemSize = 2;
    triangleBuf.numItems = 3;

    // buffer for point indices
    const triangleIndices = new Uint16Array([0, 1, 2]);
    triangleIndexBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleIndexBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, triangleIndices, gl.STATIC_DRAW);
    triangleIndexBuf.itemsize = 1;
    triangleIndexBuf.numItems = 3;
}

function drawTriangle(color, mMatrix) {
    gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);

    // buffer for point locations
    gl.bindBuffer(gl.ARRAY_BUFFER, triangleBuf);
    gl.vertexAttribPointer(aPositionLocation, triangleBuf.itemSize, gl.FLOAT, false, 0, 0);

    // buffer for point indices
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleIndexBuf);
    gl.uniform4fv(uColorLoc, color);

    // now draw the triangle
    if (mode === 's') {
        gl.drawElements(gl.TRIANGLES, triangleIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);
    }
    else if (mode === 'w') {
        gl.drawElements(gl.LINE_LOOP, triangleIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);
    }
    else if (mode === 'p') {
        gl.drawElements(gl.POINTS, triangleIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);
    }
}

// drawing a circle
function initCircleBuffer() {
    // buffer for point locations
    const positions = [0, 0]; // take the center of the circle
    
    for (let i = 0; i < numSegments; i++) {
      const angle = angleIncrement * i;
      const x = Math.cos(angle);
      const y = Math.sin(angle);
      positions.push(x, y);
    }

    const circleVertices = new Float32Array(positions);
    circleBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, circleBuf);
    gl.bufferData(gl.ARRAY_BUFFER, circleVertices, gl.STATIC_DRAW);
    circleBuf.itemSize = 2;
    circleBuf.numItems = numSegments + 1;

    // Create index buffer
    const indices = [0, 1, numSegments];
    for (let i = 0; i < numSegments; i++) {
      indices.push(0, i, i + 1);
    }

    // buffer for point indices
    const circleIndices = new Uint16Array(indices);
    circleIndexBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, circleIndexBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, circleIndices, gl.STATIC_DRAW);
    circleIndexBuf.itemsize = 1;
    circleIndexBuf.numItems = indices.length;
}

function drawCircle(color, mMatrix) {
    gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);

    // buffer for point locations
    gl.bindBuffer(gl.ARRAY_BUFFER, circleBuf);
    gl.vertexAttribPointer(aPositionLocation, circleBuf.itemSize, gl.FLOAT, false, 0, 0);

    // buffer for point indices
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, circleIndexBuf);
    gl.uniform4fv(uColorLoc, color);

    // now draw the circle
    if (mode === 's') {
        gl.drawElements(gl.TRIANGLES, circleIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);
    }
    else if (mode === 'w') {
        gl.drawElements(gl.LINE_LOOP, circleIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);
    }
    else if (mode === 'p') {
        gl.drawElements(gl.POINTS, circleIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);
    }
}

// OBJECT 1: SKY 

function drawSky() {
    mat4.identity(mMatrix);
    pushMatrix(matrixStack, mMatrix);
    color = [0, 0, 0, 1];  
    mMatrix = mat4.translate(mMatrix, [0.0, 0.6, 0]);
    mMatrix = mat4.scale(mMatrix, [3.0, 1.2, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
}

// OBJECT 2: MOON 

const NUM_RAYS = 8;

// Buffers
let rayVertexBuffer = null;
let rayIndexBuffer = null;


function initRayBuffer() {
    // Generating positions: center at (0,0), then rays at angles
    const positions = [0, 0];
    for (let i = 0; i < NUM_RAYS; i++) {
        const angle = (2 * Math.PI * i) / NUM_RAYS;
        positions.push(Math.cos(angle), Math.sin(angle));
    }

    // Creating vertex buffer
    const rayVertices = new Float32Array(positions);
    rayVertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, rayVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, rayVertices, gl.STATIC_DRAW);
    rayVertexBuffer.itemSize = 2;
    rayVertexBuffer.numItems = NUM_RAYS + 1; 

    // Creating index buffer
    const indices = [];
    for (let i = 0; i < NUM_RAYS; i++) {
        indices.push(0, i + 1);
    }

    const rayIndices = new Uint16Array(indices);
    rayIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, rayIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, rayIndices, gl.STATIC_DRAW);
    rayIndexBuffer.itemSize = 1;
    rayIndexBuffer.numItems = indices.length;
}

function drawRays(color, modelMatrix) {
    gl.uniformMatrix4fv(uMMatrixLocation, false, modelMatrix);

    // Bind vertex data
    gl.bindBuffer(gl.ARRAY_BUFFER, rayVertexBuffer);
    gl.vertexAttribPointer(aPositionLocation, rayVertexBuffer.itemSize, gl.FLOAT, false, 0, 0);

    // Bind index data
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, rayIndexBuffer);
    gl.uniform4fv(uColorLoc, color);

    const drawMode = (mode === 'p') ? gl.POINTS : gl.LINES;
    gl.drawElements(drawMode, rayIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
}

function drawMoon(rotationAngle) {
    const moonColor = [1, 1, 1, 1];

    // Draw Moon 
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.7, 0.84, 0]);
    mMatrix = mat4.scale(mMatrix, [0.11, 0.11, 1.0]);
    drawCircle(moonColor, mMatrix);
    mMatrix = popMatrix(matrixStack);

    // Draw Rays
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.7, 0.84, 0]);
    mMatrix = mat4.scale(mMatrix, [0.15, 0.15, 1.0]);
    mMatrix = mat4.rotate(mMatrix, rotationAngle, [0, 0, 1]);
    drawRays(moonColor, mMatrix);
    mMatrix = popMatrix(matrixStack);
}

// OBJECT 3: CLOUDS

function drawCloud() {
    mat4.identity(mMatrix);
    pushMatrix(matrixStack, mMatrix);
    let color = [0.7, 0.7, 0.7, 1.0];   // grey
    //grey cloud
    mMatrix = mat4.translate(mMatrix, [-0.8, 0.55, 0]);
    mMatrix = mat4.scale(mMatrix, [0.25, 0.13, 1.0]);
    drawCircle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    // white cloud
    pushMatrix(matrixStack, mMatrix);
    color = [1.0, 1.0, 1.0, 1.0];
    mMatrix = mat4.translate(mMatrix, [-0.55, 0.52, 0]);
    mMatrix = mat4.scale(mMatrix, [0.2, 0.09, 1.0]);
    drawCircle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    //grey cloud
    pushMatrix(matrixStack, mMatrix);
    color = [0.7, 0.7, 0.7, 1.0];
    mMatrix = mat4.translate(mMatrix, [-0.3, 0.52, 0]);
    mMatrix = mat4.scale(mMatrix, [0.1, 0.05, 1.0]);
    drawCircle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
}


// OBJECT 4: STARS

function drawStar(x, y, size = 1.0) {
  const STAR_Colour = [1.0, 1.0, 1.0, 1.0]; // white
  const numPoints = 4;

  for (let k = 0; k < numPoints; k++) {
    mat4.identity(mMatrix);
    mMatrix = mat4.translate(mMatrix, [x, y, 0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(k * 90), [0, 0, 1]);
    mMatrix = mat4.translate(mMatrix, [0, 0.04 * size, 0]);
    mMatrix = mat4.scale(mMatrix, [0.04 * size, 0.12 * size, 1.0]);
    drawTriangle(STAR_Colour, mMatrix);
  }
}

// OBJECT 5 : MOUNTAINS

function drawMountain(x_translation1, y_translation_1, 
                        scale_x, scale_y,
                        x_translation2 = 0, y_translation2 = 0, 
                        one_triangle = false) {
    /*
    x_translation1, x_translation2 : Horizontal translation (X-axis shift) for the first and second triangles. 
                                     x_translation1 moves the base triangle, x_translation2 moves the overlay triangle.

    y_translation1, y_translation2 : Vertical translation (Y-axis shift) for the first and second triangles. 
                                     y_translation1 moves the base triangle, y_translation2 moves the overlay triangle.

    scale_x : Scaling factor along the X-axis, applied equally to both triangles to control mountain width.

    scale_y : Scaling factor along the Y-axis, applied equally to both triangles to control mountain height.

    one_triangle : Boolean flag that specifies whether the mountain consists of only a single triangle 
                   (true = single triangle mountain, false = mountain with overlay triangle).
*/

    mat4.identity(mMatrix);
    pushMatrix(matrixStack, mMatrix);
    color = [0.57, 0.36, 0.15, 1.0];
    if (one_triangle) color = [0.65, 0.46, 0.16, 1.0];

    mMatrix = mat4.translate(mMatrix, [x_translation1, y_translation_1, 0]);
    mMatrix = mat4.scale(mMatrix, [scale_x, scale_y, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    // ignore darker part if there is one triangle present 
    if (!one_triangle) {
        pushMatrix(matrixStack, mMatrix);
        color = [0.65, 0.46, 0.16, 1.0];
        mMatrix = mat4.translate(mMatrix, [x_translation2, y_translation2, 0]);
        mMatrix = mat4.rotate(mMatrix, 6.5, [0, 0, 1]);
        mMatrix = mat4.scale(mMatrix, [scale_x, scale_y, 1.0]);
        drawTriangle(color, mMatrix);
        mMatrix = popMatrix(matrixStack);
    }
}


//OBEJCT 6: TREES 

function drawTrees(move = false, 
                x_translation = 0,
                y_translation= 0, 
                scale_x = 0, 
                scale_y = 0) {
    
    // initialize the model matrix to identity matrix
    mat4.identity(mMatrix);
    if (move) {
        // applying global translation and scaling
        mMatrix = mat4.translate(mMatrix, [x_translation, y_translation, 0]);
        mMatrix = mat4.scale(mMatrix, [scale_x, scale_y, 0]);
    }
    // stem of the tree
    pushMatrix(matrixStack, mMatrix);
    color = [0.502, 0.302, 0.302, 1.0];
    mMatrix = mat4.translate(mMatrix, [0.55, 0.14, 0]);
    mMatrix = mat4.scale(mMatrix, [0.04, 0.33, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    
    pushMatrix(matrixStack, mMatrix);
    color = [0.0, 0.600, 0.302, 1.0];
    mMatrix = mat4.translate(mMatrix, [0.55, 0.45, 0]);
    mMatrix = mat4.scale(mMatrix, [0.35, 0.3, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    color = [0.306, 0.698, 0.306, 1.0];
    mMatrix = mat4.translate(mMatrix, [0.55, 0.5, 0]);
    mMatrix = mat4.scale(mMatrix, [0.375, 0.3, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    color = [0.396, 0.800, 0.302, 1.0];
    mMatrix = mat4.translate(mMatrix, [0.55, 0.55, 0]);
    mMatrix = mat4.scale(mMatrix, [0.4, 0.3, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    
}


//OBJECT 7 : WINDMILL

// this function is for creating the blades of the windmill (easier to rotate)
function init_Windmill_bladesBuffer() {
    // buffer for point locations
    const positions = [0, 0];
    
    // based on manual calculations
    for (let i = 0; i < 16; i++) {
      const angle = (Math.PI * 2) * i / 16;
      const x = Math.cos(angle);
      const y = Math.sin(angle);
      positions.push(x, y);
    }
    const bladeVertices = new Float32Array(positions);
    bladeBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bladeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, bladeVertices, gl.STATIC_DRAW);
    bladeBuf.itemSize = 2;
    bladeBuf.numItems = 9;

    // Create index buffer
    const indices = [];
    for (let i = 1; i < 16; i=i+4) {
      indices.push(0, i, i+1);
    }

    // buffer for point indices
    const bladeIndices = new Uint16Array(indices);
    bladeIndexBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bladeIndexBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, bladeIndices, gl.STATIC_DRAW);
    bladeIndexBuf.itemsize = 1;
    bladeIndexBuf.numItems = indices.length;
}

function draw_Windmill_fans(color, mMatrix) {
    gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);

    // buffer for point locations
    gl.bindBuffer(gl.ARRAY_BUFFER, bladeBuf);
    gl.vertexAttribPointer(aPositionLocation, bladeBuf.itemSize, gl.FLOAT, false, 0, 0);

    // buffer for point indices
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bladeIndexBuf);
    gl.uniform4fv(uColorLoc, color);

    // drawing the circle now 
    if (mode === 's') {
        gl.drawElements(gl.TRIANGLE_FAN, bladeIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);
    }
    else if (mode === 'w') {
        gl.drawElements(gl.LINE_LOOP, bladeIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);
    }
    else if (mode === 'p') {
        gl.drawElements(gl.POINTS, bladeIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);
    }
}

// rotationAngle animates the blades
function drawWindmill(rotationAngle, x = 0.7, y = -0.25, s = 1.0) {
    // Windmill pole
    mat4.identity(mMatrix);
    pushMatrix(matrixStack, mMatrix);
    color = [0, 0, 0, 1.0];
    mMatrix = mat4.translate(mMatrix, [x, y, 0]);
    mMatrix = mat4.scale(mMatrix, [0.03 * s, 0.55 * s, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    // Windmill fans
    pushMatrix(matrixStack, mMatrix);
    color = [0.8, 0.75, 0, 1];
    mMatrix = mat4.translate(mMatrix, [x, y + 0.31 * s, 0]); 
    mMatrix = mat4.scale(mMatrix, [0.2 * s, 0.2 * s, 1.0]);
    mMatrix = mat4.rotate(mMatrix, rotationAngle, [0, 0, 1]);
    draw_Windmill_fans(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    // Windmill hub 
    pushMatrix(matrixStack, mMatrix);
    color = [0, 0, 0, 1];
    mMatrix = mat4.translate(mMatrix, [x, y + 0.303 * s, 0]);
    mMatrix = mat4.scale(mMatrix, [0.03 * s, 0.03 * s, 1.0]);
    drawCircle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
}


// OBJECT 8: GROUND

function drawGround() {
    mat4.identity(mMatrix);
    pushMatrix(matrixStack, mMatrix);
    color = [0.0, 0.898, 0.502, 1.0];
    mMatrix = mat4.translate(mMatrix, [0.0, -0.6, 0]);
    mMatrix = mat4.scale(mMatrix, [3.0, 1.2, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
}

// OBJECT 9: RIVER 

// for drawing lines on the river
function draw_WaterLines(move = false, x = 0, y = 0) {
    /*
    move : this is for global translation of the lines along the river
    x : translation along X axis
    y : translation along Y axis
    */
    mat4.identity(mMatrix);
    if (move) {
        mMatrix = mat4.translate(mMatrix, [x, y, 0]);
    }
    pushMatrix(matrixStack, mMatrix);
    color = [0.9, 0.9, 0.9, 0.8];
    mMatrix = mat4.translate(mMatrix, [-0.7, -0.19, 0]);
    mMatrix = mat4.rotate(mMatrix, 4.71, [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [0.003, 0.4, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
}

function drawRiver() {
    mat4.identity(mMatrix);
    pushMatrix(matrixStack, mMatrix);
    color = [0, 0, 0.8, 0.8];
    mMatrix = mat4.translate(mMatrix, [0.0, -0.17, 0]);
    mMatrix = mat4.scale(mMatrix, [3.0, 0.25, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    draw_WaterLines();
    draw_WaterLines(true, 0.85, 0.1);
    draw_WaterLines(true, 1.5, -0.06);
}


//OBJECT 10: BOAT 
function draw_PurpleBoat(x_direction_translation) {
    mat4.identity(mMatrix);

    // apply global translation
    mMatrix = mat4.translate(mMatrix, [x_direction_translation, 0.08, 0]);  
    // to scale down the entire boat
    const scaleFactor = 0.6;  

    // sail of the boat
    pushMatrix(matrixStack, mMatrix);
    color = [0.6, 0.0, 0.6, 0.9]; 
    mMatrix = mat4.translate(mMatrix, [0.115 * scaleFactor, -0.05, 0]);
    mMatrix = mat4.rotate(mMatrix, 4.72, [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [0.2 * scaleFactor, 0.2 * scaleFactor, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    // mast (center pole)
    pushMatrix(matrixStack, mMatrix);
    color = [0, 0, 0, 1.0];
    mMatrix = mat4.translate(mMatrix, [0.01, -0.05, 0]);
    mMatrix = mat4.scale(mMatrix, [0.01, 0.15, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    // boat body (rectangle)
    pushMatrix(matrixStack, mMatrix);
    color = [0.800, 0.800, 0.800, 1.0];
    mMatrix = mat4.translate(mMatrix, [0, -0.15, 0]);
    mMatrix = mat4.scale(mMatrix, [0.18 * scaleFactor, 0.06 * scaleFactor, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    // left triangle end
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.09 * scaleFactor, -0.15, 0]);
    mMatrix = mat4.rotate(mMatrix, -3.15, [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [0.1 * scaleFactor, 0.06 * scaleFactor, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    // right triangle end
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.09 * scaleFactor, -0.15, 0]);
    mMatrix = mat4.rotate(mMatrix, -3.15, [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [0.1 * scaleFactor, 0.06 * scaleFactor, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    // support rope/pole
    pushMatrix(matrixStack, mMatrix);
    color = [0, 0, 0, 1.0];
    mMatrix = mat4.translate(mMatrix, [-0.02, -0.065, 0]);
    mMatrix = mat4.rotate(mMatrix, 5.9, [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [0.005, 0.23 * scaleFactor, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

   
}
// x_direction_translation is taken as argument for the animation
function draw_RedBoat(x_direction_translation) {
    mat4.identity(mMatrix);

    // applying global translation
    mMatrix = mat4.translate(mMatrix, [x_direction_translation, 0., 0]);

    pushMatrix(matrixStack, mMatrix);
    color = [0.800, 0.800, 0.800, 1.0];
    mMatrix = mat4.translate(mMatrix, [0, -0.15, 0]);
    mMatrix = mat4.scale(mMatrix, [0.18, 0.06, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.09, -0.15, 0]);
    mMatrix = mat4.rotate(mMatrix, -3.15, [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [0.1, 0.06, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.09, -0.15, 0]);
    mMatrix = mat4.rotate(mMatrix, -3.15, [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [0.1, 0.06, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    color = [0, 0, 0, 1.0];
    mMatrix = mat4.translate(mMatrix, [0.01, 0.006, 0]);
    mMatrix = mat4.scale(mMatrix, [0.01, 0.25, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    color = [0, 0, 0, 1.0];
    mMatrix = mat4.translate(mMatrix, [-0.03, -0.01, 0]);
    mMatrix = mat4.rotate(mMatrix, 5.9, [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [0.005, 0.23, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    color = [1, 0, 0, 0.9];
    mMatrix = mat4.translate(mMatrix, [0.115, 0.006, 0]);
    mMatrix = mat4.rotate(mMatrix, 4.72, [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [0.2, 0.2, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
}

// OBJECT 11: ROAD 

function drawRoad() {
    mat4.identity(mMatrix);
    pushMatrix(matrixStack, mMatrix);
    color = [0.400, 0.698, 0.200, 1.0];
    mMatrix = mat4.translate(mMatrix, [0.6, -0.8, 0]);
    mMatrix = mat4.rotate(mMatrix, 7.2, [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [1.6, 2, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
}

//OBJECT 12 : BUSHES 

function drawBush(move=false, x_translation=0, y_translation=0, s=0) {
    // initialize the model matrix to identity matrix
    mat4.identity(mMatrix);
    if (move) {
        mMatrix = mat4.translate(mMatrix, [x_translation, y_translation, 0]);
        mMatrix = mat4.scale(mMatrix, [s, s, 0]);
    }
    pushMatrix(matrixStack, mMatrix);
    color = [0, 0.7, 0, 0.9];
    mMatrix = mat4.translate(mMatrix, [-1, -0.55, 0]);
    mMatrix = mat4.scale(mMatrix, [0.075, 0.055, 1.0]);
    drawCircle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    color = [0, 0.4, 0, 0.9];
    mMatrix = mat4.translate(mMatrix, [-0.72, -0.55, 0]);
    mMatrix = mat4.scale(mMatrix, [0.07, 0.05, 1.0]);
    drawCircle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    color = [0.0, 0.600, 0.0, 1.0];
    mMatrix = mat4.translate(mMatrix, [-0.86, -0.53, 0]);
    mMatrix = mat4.scale(mMatrix, [0.13, 0.09, 1.0]);
    drawCircle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
}

// OBJECT 13: HOUSE

function drawHouse() {
    mat4.identity(mMatrix);

    // roof of the house
    pushMatrix(matrixStack, mMatrix);
    color = [1.0, 0.302, 0.0, 1.0];
    mMatrix = mat4.translate(mMatrix, [-0.55, -0.3, 0]);
    mMatrix = mat4.scale(mMatrix, [0.4, 0.2, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.75, -0.3, 0]);
    mMatrix = mat4.rotate(mMatrix, 6.285, [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [0.25, 0.2, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.35, -0.3, 0]);
    mMatrix = mat4.rotate(mMatrix, 6.285, [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [0.25, 0.2, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    // base of the house
    pushMatrix(matrixStack, mMatrix);
    color = [0.898, 0.898, 0.898, 1.0];
    mMatrix = mat4.translate(mMatrix, [-0.55, -0.525, 0]);
    mMatrix = mat4.scale(mMatrix, [0.5, 0.25, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    // windows
    pushMatrix(matrixStack, mMatrix);
    color = [0.898, 0.698, 0.0, 1.0];
    mMatrix = mat4.translate(mMatrix, [-0.7, -0.47, 0]);
    mMatrix = mat4.scale(mMatrix, [0.08, 0.08, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.4, -0.47, 0]);
    mMatrix = mat4.scale(mMatrix, [0.08, 0.08, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    // door of the house
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.55, -0.56, 0]);
    mMatrix = mat4.scale(mMatrix, [0.08, 0.18, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
}

// OBJECT 14 : CAR 

// wheels for the car
function drawWheel(move = false, x_translation = 0) {
    mat4.identity(mMatrix);
    if (move) {
        mMatrix = mat4.translate(mMatrix, [x_translation, 0, 0]);
    }
    pushMatrix(matrixStack, mMatrix);
    color = [0, 0, 0, 1];
    mMatrix = mat4.translate(mMatrix, [-0.63, -0.9, 0]);
    mMatrix = mat4.scale(mMatrix, [0.04, 0.04, 1.0]);
    drawCircle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    color = [0.51, 0.51, 0.51, 1];
    mMatrix = mat4.translate(mMatrix, [-0.63, -0.9, 0]);
    mMatrix = mat4.scale(mMatrix, [0.03, 0.03, 1.0]);
    drawCircle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
}

function drawCar() {
  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  let color = [0.0, 0.302, 0.698, 1.0]; 
  mMatrix = mat4.translate(mMatrix, [-0.5, -0.75, 0]);
  mMatrix = mat4.scale(mMatrix, [0.15, 0.11, 1.0]);
  drawCircle(color, mMatrix);
  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  color = [0.8, 0.8, 0.9, 1.0]; // light gray
  mMatrix = mat4.translate(mMatrix, [-0.5, -0.76, 0]);
  mMatrix = mat4.scale(mMatrix, [0.17, 0.12, 1.0]);
  drawSquare(color, mMatrix);
  mMatrix = popMatrix(matrixStack);

  drawWheel(false);       // left wheel
  drawWheel(true, 0.27);  // right wheel

  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  color = [0.0, 0.502, 0.898, 1.0];
  mMatrix = mat4.translate(mMatrix, [-0.5, -0.82, 0]);
  mMatrix = mat4.scale(mMatrix, [0.35, 0.12, 1.0]);
  drawSquare(color, mMatrix);
  mMatrix = popMatrix(matrixStack);

  // Left triangle
  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [-0.675, -0.82, 0]); 
  mMatrix = mat4.scale(mMatrix, [0.18, 0.12, 1.0]);
  drawTriangle(color, mMatrix);
  mMatrix = popMatrix(matrixStack);

  // Right triangle
  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [-0.325, -0.82, 0]); 
  mMatrix = mat4.scale(mMatrix, [0.18, 0.12, 1.0]);
  drawTriangle(color, mMatrix);
  mMatrix = popMatrix(matrixStack);
}

//PUTTING IT ALL TOGETHER IN A SCENE

function drawScene() {
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clearColor(0.95, 0.95, 0.95, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // stop the current loop of animation
    if (animation) {
        window.cancelAnimationFrame(animation);
    }

    function animate() {
        // Update the rotation angle
        rotationAngle += rotationSpeed;
        // for red boat
        boat_red_x += boatSpeed * red_boat_direction;
        if (Math.abs(boat_red_x) > boatRange) {
            red_boat_direction *= -1; // reverse direction
        }

        //Purple boat
        boat_purple_x += boatSpeed * purple_boat_dir;
        if (Math.abs(boat_purple_x) > boatRange) {
            purple_boat_dir *= -1;  // reverse direction
        }

        drawSky();
        drawMoon(rotationAngle);

        drawCloud();

      // Stars
        drawStar(-0.2, 0.78, 0.3);
        drawStar(-0.1, 0.7, 0.25);
        drawStar(-0.15, 0.6, 0.15);
        drawStar(0.2, 0.85, 0.35);
        drawStar(0.4, 0.95, 0.2);

        // draw the 3 mountains
        drawMountain(-0.6, 0.09, 1.2, 0.4, -0.555, 0.095);
        drawMountain(-0.076, 0.09, 1.8, 0.55, -0.014, 0.096);
        drawMountain(0.7, 0.12, 1.0, 0.3, -0.545, -0.005, true);

        drawGround();
        drawRoad();
        drawRiver();

        // draw the trees
        drawTrees(true, 0.35, 0, 0.85, 0.85)
        drawTrees();
        drawTrees(true, -0.2, 0, 0.8, 0.8)

        // applying back and forth motion to the boat
        draw_PurpleBoat(boat_purple_x); // purple boat moving opposite
        draw_RedBoat(boat_red_x);

        // draw the windmills
        drawWindmill(rotationAngle, 0.4, -0.14, 0.7);
        drawWindmill(rotationAngle, 0.6, -0.2, 1.0);

        // draw the bushes
        drawBush();
        drawBush(true, 0.7, 0, 1.02);
        drawBush(true, 1.48, -0.13, 1.6);
        drawBush(true, 2.15, 0.25, 1.3);

        drawHouse();
        drawCar();

        // Request the next animation frame
        animation = window.requestAnimationFrame(animate);
    }
    animate();
}


function webGLStart() {
    var canvas = document.getElementById("scenery");
    initGL(canvas);
    shaderProgram = initShaders();
    const aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");

    uMMatrixLocation = gl.getUniformLocation(shaderProgram, "uMMatrix");
    gl.enableVertexAttribArray(aPositionLocation);

    uColorLoc = gl.getUniformLocation(shaderProgram, "color");

    initSquareBuffer();
    initTriangleBuffer();
    initCircleBuffer();
    initRayBuffer();
    init_Windmill_bladesBuffer
();

    drawScene();
}

// changing the view
function changeView(m) {
    mode = m;
    drawScene();
}
