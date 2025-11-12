var gl;
var canvas;
var matrixStack = [];

var zAngle = 0.0;
var prevMouseX = 0.0;
var prevMouseY = 0.0;

// Main shader
var shaderProgram;
var aPositionLocation;
var aNormalLocation;
var uMMatrixLocation;
var uVMatrixLocation;
var uPMatrixLocation;
var uNormalMatrixLocation;
var uDiffuseTermLocation;
var uLightPosLocation;
var uEyePosLocation;
var uLightColorLocation;
var uAmbientStrengthLocation;
var uSpecularStrengthLocation;
var uShininessLocation;
var uShadowMapLocation;
var uLightViewMatrixLocation;
var uLightProjectionMatrixLocation;

// Shadow shader
var shadowShaderProgram;
var sShadowPositionLocation;
var sShadowMMatrixLocation;
var sShadowVMatrixLocation;
var sShadowPMatrixLocation;

var vMatrix = mat4.create();
var mMatrix = mat4.create();
var pMatrix = mat4.create();
var lightViewMatrix = mat4.create();
var lightProjectionMatrix = mat4.create();

// Teapot buffers
var teapotVertexPositionBuffer;
var teapotVertexNormalBuffer;
var teapotVertexIndexBuffer;
var teapotLoaded = false;

var spherePositionBuffer;
var sphereNormalBuffer;
var sphereIndexBuffer;


// Plane buffers
var planePositionBuffer;
var planeNormalBuffer;
var planeIndexBuffer;

// Shadow mapping
var shadowFramebuffer;
var shadowDepthTexture;
var shadowMapSize = 8192;

// Scene parameters
var eyePos = [20.0, 12.0, 12.0];
var lightPos = [5, 12, 5];
var lightColor = [1, 1, 1];
var ambientStrength = 0.3;
var specularStrength = 0.8;
var shininess = 32.0;

var isAnimating = false;
var animationId = null;

// Shadow pass shaders
const shadowVertexShaderCode = `#version 300 es
in vec3 aPosition;

uniform mat4 uMMatrix;
uniform mat4 uVMatrix;
uniform mat4 uPMatrix;

void main() {
  gl_Position = uPMatrix * uVMatrix * uMMatrix * vec4(aPosition, 1.0);
}`;

const shadowFragShaderCode = `#version 300 es
precision highp float;
out vec4 fragColor;

void main() {
  fragColor = vec4(1.0);
}`;

// Main render pass shaders
const vertexShaderCode = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;

uniform mat4 uMMatrix;
uniform mat4 uPMatrix;
uniform mat4 uVMatrix;
uniform mat3 uNormalMatrix;
uniform mat4 uLightViewMatrix;
uniform mat4 uLightProjectionMatrix;

out vec3 fragNormal;
out vec3 fragWorldPos;
out vec4 fragPosLightSpace;

void main() {
  // Transform normal to world space
  fragNormal = normalize(uNormalMatrix * aNormal);
  
  // World position
  vec4 worldPos = uMMatrix * vec4(aPosition, 1.0);
  fragWorldPos = worldPos.xyz;
  
  // Position in light space for shadow mapping
  fragPosLightSpace = uLightProjectionMatrix * uLightViewMatrix * worldPos;
  
  // Clip space position
  gl_Position = uPMatrix * uVMatrix * uMMatrix * vec4(aPosition, 1.0);
}`;

const fragShaderCode = `#version 300 es
precision highp float;

in vec3 fragNormal;
in vec3 fragWorldPos;
in vec4 fragPosLightSpace;

uniform vec4 diffuseTerm;
uniform vec3 uLightPos;
uniform vec3 uEyePos;
uniform vec3 uLightColor;
uniform float uAmbientStrength;
uniform float uSpecularStrength;
uniform float uShininess;
uniform sampler2D uShadowMap;

out vec4 fragColor;

float calculateShadow(vec4 fragPosLightSpace, vec3 normal, vec3 lightDir) {
  vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
  projCoords = projCoords * 0.5 + 0.5;
  
  if(projCoords.z > 1.0 || projCoords.x < 0.0 || projCoords.x > 1.0 || 
     projCoords.y < 0.0 || projCoords.y > 1.0) {
    return 0.0;
  }
  
  float closestDepth = texture(uShadowMap, projCoords.xy).r;
  float currentDepth = projCoords.z;
  float bias = max(0.002 * (1.0 - dot(normal, lightDir)), 0.0005);
  
  // Distance-based PCF
  float shadow = 0.0;
  vec2 texelSize = 1.0 / vec2(textureSize(uShadowMap, 0));
  float searchWidth = 1.0;  
  
  for(int x = -1; x <= 1; ++x) {
    for(int y = -1; y <= 1; ++y) {
      float pcfDepth = texture(uShadowMap, projCoords.xy + vec2(x, y) * texelSize * searchWidth).r;
      shadow += currentDepth - bias > pcfDepth ? 1.0 : 0.0;
    }
  }
  shadow /= 9.0;
  
  return shadow;
}

void main() {
  vec3 baseColor = diffuseTerm.rgb;
  
  // Normalize vectors
  vec3 N = normalize(fragNormal);
  vec3 L = normalize(uLightPos - fragWorldPos);
  vec3 V = normalize(uEyePos - fragWorldPos);
  vec3 R = reflect(-L, N);
  
  // Ambient
  vec3 ambient = uAmbientStrength * uLightColor * baseColor;
  
  // Diffuse
  float diff = max(dot(N, L), 0.0);
  vec3 diffuse = diff * uLightColor * baseColor;
  
  // Specular
  float spec = pow(max(dot(R, V), 0.0), uShininess);
  vec3 specular = uSpecularStrength * spec * uLightColor;
  
  // Calculate shadow
  float shadow = calculateShadow(fragPosLightSpace, N, L);
  
  // Combine lighting
  vec3 finalColor = ambient + (1.0 - shadow) * (diffuse + specular);
  fragColor = vec4(finalColor, 1.0);
}`;

function pushMatrix(stack, m) {
  var copy = mat4.create(m);
  stack.push(copy);
}

function popMatrix(stack) {
  if (stack.length > 0) return stack.pop();
  else console.log("stack has no matrix to pop!");
}

function computeNormalMatrix(modelMatrix) {
  var normalMatrix = mat3.create();
  mat4.toInverseMat3(modelMatrix, normalMatrix);
  mat3.transpose(normalMatrix);
  return normalMatrix;
}

function vertexShaderSetup(vertexShaderCode) {
  var shader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(shader, vertexShaderCode);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Vertex shader error:", gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function fragmentShaderSetup(fragShaderCode) {
  var shader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(shader, fragShaderCode);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Fragment shader error:", gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function initShaders() {
  shaderProgram = gl.createProgram();
  var vertexShader = vertexShaderSetup(vertexShaderCode);
  var fragmentShader = fragmentShaderSetup(fragShaderCode);
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);
  
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.error("Shader program linking error:", gl.getProgramInfoLog(shaderProgram));
  }
  
  return shaderProgram;
}

function initShadowShaders() {
  shadowShaderProgram = gl.createProgram();
  var vertexShader = vertexShaderSetup(shadowVertexShaderCode);
  var fragmentShader = fragmentShaderSetup(shadowFragShaderCode);
  gl.attachShader(shadowShaderProgram, vertexShader);
  gl.attachShader(shadowShaderProgram, fragmentShader);
  gl.linkProgram(shadowShaderProgram);
  
  if (!gl.getProgramParameter(shadowShaderProgram, gl.LINK_STATUS)) {
    console.error("Shadow shader linking error:", gl.getProgramInfoLog(shadowShaderProgram));
  }
  
  sShadowPositionLocation = gl.getAttribLocation(shadowShaderProgram, "aPosition");
  sShadowMMatrixLocation = gl.getUniformLocation(shadowShaderProgram, "uMMatrix");
  sShadowVMatrixLocation = gl.getUniformLocation(shadowShaderProgram, "uVMatrix");
  sShadowPMatrixLocation = gl.getUniformLocation(shadowShaderProgram, "uPMatrix");
  
  return shadowShaderProgram;
}

function initShadowFramebuffer() {
  shadowFramebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFramebuffer);
  
  shadowDepthTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, shadowDepthTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT32F, shadowMapSize, shadowMapSize, 
                0, gl.DEPTH_COMPONENT, gl.FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, 
                          gl.TEXTURE_2D, shadowDepthTexture, 0);
  
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    console.error("Shadow framebuffer is not complete!");
  }
  
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function initGL(canvas) {
  try {
    gl = canvas.getContext("webgl2");
    gl.viewportWidth = canvas.width;
    gl.viewportHeight = canvas.height;
  } catch (e) {
    console.error("WebGL2 initialization error:", e);
  }
  if (!gl) {
    alert("WebGL2 initialization failed");
  }
}

function degToRad(degrees) {
  return (degrees * Math.PI) / 180;
}

function initPlaneBuffer() {
  var positions = [
    -1.0, 0.0, -1.0,
     1.0, 0.0, -1.0,
     1.0, 0.0,  1.0,
    -1.0, 0.0,  1.0
  ];
  
  var normals = [
    0.0, 1.0, 0.0,
    0.0, 1.0, 0.0,
    0.0, 1.0, 0.0,
    0.0, 1.0, 0.0
  ];
  
  var indices = [0, 1, 2, 0, 2, 3];
  
  planePositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, planePositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
  planePositionBuffer.itemSize = 3;
  planePositionBuffer.numItems = positions.length / 3;
  
  planeNormalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, planeNormalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
  planeNormalBuffer.itemSize = 3;
  planeNormalBuffer.numItems = normals.length / 3;
  
  planeIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, planeIndexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
  planeIndexBuffer.itemSize = 1;
  planeIndexBuffer.numItems = indices.length;
}

function initTeapot() {
  var request = new XMLHttpRequest();
  request.open("GET", "teapot.json");
  request.overrideMimeType("application/json");
  request.onreadystatechange = function () {
    if (request.readyState === 4) {
      if (request.status === 200 || request.status === 0) {
        try {
          processTeapot(JSON.parse(request.responseText));
        } catch (e) {
          console.error("Failed parsing teapot JSON", e);
        }
      }
    }
  };
  request.send();
}

function processTeapot(objData) {
  teapotVertexPositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, teapotVertexPositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(objData.vertexPositions), gl.STATIC_DRAW);
  teapotVertexPositionBuffer.itemSize = 3;
  teapotVertexPositionBuffer.numItems = objData.vertexPositions.length / 3;
  
  teapotVertexNormalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, teapotVertexNormalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(objData.vertexNormals), gl.STATIC_DRAW);
  teapotVertexNormalBuffer.itemSize = 3;
  teapotVertexNormalBuffer.numItems = objData.vertexNormals.length / 3;
  
  teapotVertexIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, teapotVertexIndexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(objData.indices), gl.STATIC_DRAW);
  teapotVertexIndexBuffer.itemSize = 1;
  teapotVertexIndexBuffer.numItems = objData.indices.length;
  
  teapotLoaded = true;
  drawScene();
}

function drawPlane() {
  gl.drawElements(gl.TRIANGLES, planeIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
}

function drawTeapot() {
  gl.drawElements(gl.TRIANGLES, teapotVertexIndexBuffer.numItems, gl.UNSIGNED_INT, 0);
}
// Function to generate sphere geometry
function initSphereBuffer() {
  var latitudeBands = 30;
  var longitudeBands = 30;
  var radius = 1.0;
  
  var vertexPositions = [];
  var vertexNormals = [];
  var indices = [];
  
  // Generate vertices
  for (var latNumber = 0; latNumber <= latitudeBands; latNumber++) {
    var theta = latNumber * Math.PI / latitudeBands;
    var sinTheta = Math.sin(theta);
    var cosTheta = Math.cos(theta);
    
    for (var longNumber = 0; longNumber <= longitudeBands; longNumber++) {
      var phi = longNumber * 2 * Math.PI / longitudeBands;
      var sinPhi = Math.sin(phi);
      var cosPhi = Math.cos(phi);
      
      var x = cosPhi * sinTheta;
      var y = cosTheta;
      var z = sinPhi * sinTheta;
      
      // Position
      vertexPositions.push(radius * x);
      vertexPositions.push(radius * y);
      vertexPositions.push(radius * z);
      
      // Normal 
      vertexNormals.push(x);
      vertexNormals.push(y);
      vertexNormals.push(z);
    }
  }
  
  // Generate indices
  for (var latNumber = 0; latNumber < latitudeBands; latNumber++) {
    for (var longNumber = 0; longNumber < longitudeBands; longNumber++) {
      var first = (latNumber * (longitudeBands + 1)) + longNumber;
      var second = first + longitudeBands + 1;
      
      indices.push(first);
      indices.push(second);
      indices.push(first + 1);
      
      indices.push(second);
      indices.push(second + 1);
      indices.push(first + 1);
    }
  }
  
  // Create position buffer
  spherePositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, spherePositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexPositions), gl.STATIC_DRAW);
  spherePositionBuffer.itemSize = 3;
  spherePositionBuffer.numItems = vertexPositions.length / 3;
  
  // Create normal buffer
  sphereNormalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sphereNormalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexNormals), gl.STATIC_DRAW);
  sphereNormalBuffer.itemSize = 3;
  sphereNormalBuffer.numItems = vertexNormals.length / 3;
  
  // Create index buffer
  sphereIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIndexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
  sphereIndexBuffer.itemSize = 1;
  sphereIndexBuffer.numItems = indices.length;
}

// Function to draw sphere
function drawSphere() {
  gl.drawElements(gl.TRIANGLES, sphereIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
}
// PASS 1: Render shadow map from light's perspective
function renderShadowMap() {
  // Set up light view matrix
  mat4.identity(lightViewMatrix);
  lightViewMatrix = mat4.lookAt(lightPos, [1.5, 0.0, 0], [0, 1, 0], lightViewMatrix);
  
  // Set up light projection matrix (orthographic for directional light)
  mat4.identity(lightProjectionMatrix);
  mat4.ortho(-10, 10, -10, 10, 1.0, 50, lightProjectionMatrix);
  
  // Bind shadow framebuffer
  gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFramebuffer);
  gl.viewport(0, 0, shadowMapSize, shadowMapSize);
  gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  
  gl.useProgram(shadowShaderProgram);
  
  var savedMMatrix = mat4.create(mMatrix);
  mat4.identity(mMatrix);
  
  // Draw teapot
  if (teapotLoaded) {
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-4.0, 1.0, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.5, 0.5, 0.5]);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, teapotVertexPositionBuffer);
    gl.vertexAttribPointer(sShadowPositionLocation, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(sShadowPositionLocation);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, teapotVertexIndexBuffer);
    
    gl.uniformMatrix4fv(sShadowMMatrixLocation, false, mMatrix);
    gl.uniformMatrix4fv(sShadowVMatrixLocation, false, lightViewMatrix);
    gl.uniformMatrix4fv(sShadowPMatrixLocation, false, lightProjectionMatrix);
    
    drawTeapot();
    mMatrix = popMatrix(matrixStack);
  }
  
  // Draw plane
  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [0.0, -2.0, 0.0]);
  mMatrix = mat4.scale(mMatrix, [10.0, 1.0, 10.0]);
  
  gl.bindBuffer(gl.ARRAY_BUFFER, planePositionBuffer);
  gl.vertexAttribPointer(sShadowPositionLocation, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(sShadowPositionLocation);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, planeIndexBuffer);
  
  gl.uniformMatrix4fv(sShadowMMatrixLocation, false, mMatrix);
  gl.uniformMatrix4fv(sShadowVMatrixLocation, false, lightViewMatrix);
  gl.uniformMatrix4fv(sShadowPMatrixLocation, false, lightProjectionMatrix);
  
  drawPlane();
  mMatrix = popMatrix(matrixStack);
  
  // Draw sphere
  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [5.0, -0.3, 0.0]); 
  mMatrix = mat4.scale(mMatrix, [2, 2, 2]); 
  
  gl.bindBuffer(gl.ARRAY_BUFFER, spherePositionBuffer);
  gl.vertexAttribPointer(sShadowPositionLocation, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(sShadowPositionLocation);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIndexBuffer);
  
  gl.uniformMatrix4fv(sShadowMMatrixLocation, false, mMatrix);
  gl.uniformMatrix4fv(sShadowVMatrixLocation, false, lightViewMatrix);
  gl.uniformMatrix4fv(sShadowPMatrixLocation, false, lightProjectionMatrix);
  
  drawSphere();
  mMatrix = popMatrix(matrixStack);

  mMatrix = mat4.create(savedMMatrix);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

// PASS 2: Render scene with shadows
function drawScene() {
  // First pass: render shadow map
  renderShadowMap();
  
  // Second pass: render scene with shadows
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  
  mat4.identity(mMatrix);
  mat4.identity(vMatrix);
  
  // Set up camera rotation
  var rotationMatrix = mat4.create();
  mat4.identity(rotationMatrix);
  mat4.rotate(rotationMatrix, degToRad(zAngle), [0, 1, 0], rotationMatrix);
  
  var currentEyePos = [
    rotationMatrix[0] * eyePos[0] + rotationMatrix[4] * eyePos[1] + rotationMatrix[8] * eyePos[2],
    rotationMatrix[1] * eyePos[0] + rotationMatrix[5] * eyePos[1] + rotationMatrix[9] * eyePos[2],
    rotationMatrix[2] * eyePos[0] + rotationMatrix[6] * eyePos[1] + rotationMatrix[10] * eyePos[2]
  ];
  
  vMatrix = mat4.lookAt(currentEyePos, [0, 0, 0], [0, 1, 0], vMatrix);
  
  mat4.identity(pMatrix);
  mat4.perspective(45, 1.0, 0.1, 100, pMatrix);
  
  gl.useProgram(shaderProgram);
  
  // Set lighting uniforms
  gl.uniform3fv(uLightPosLocation, lightPos);
  gl.uniform3fv(uEyePosLocation, currentEyePos);
  gl.uniform3fv(uLightColorLocation, lightColor);
  gl.uniform1f(uAmbientStrengthLocation, ambientStrength);
  gl.uniform1f(uSpecularStrengthLocation, specularStrength);
  gl.uniform1f(uShininessLocation, shininess);
  
  // Bind shadow map
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, shadowDepthTexture);
  gl.uniform1i(uShadowMapLocation, 0);
  gl.uniformMatrix4fv(uLightViewMatrixLocation, false, lightViewMatrix);
  gl.uniformMatrix4fv(uLightProjectionMatrixLocation, false, lightProjectionMatrix);
  
  // Draw teapot (green/teal)
  if (teapotLoaded) {
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-4.0, 1.0, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.5, 0.5, 0.5]);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, teapotVertexPositionBuffer);
    gl.vertexAttribPointer(aPositionLocation, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aPositionLocation);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, teapotVertexNormalBuffer);
    gl.vertexAttribPointer(aNormalLocation, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aNormalLocation);
    
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, teapotVertexIndexBuffer);
    
    gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
    gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
    gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);
    
    var normalMatrix = computeNormalMatrix(mMatrix);
    gl.uniformMatrix3fv(uNormalMatrixLocation, false, normalMatrix);
    gl.uniform4fv(uDiffuseTermLocation, [0.2, 0.7, 0.5, 1.0]);
    
    drawTeapot();
    mMatrix = popMatrix(matrixStack);
  }
  
  // Draw plane 
  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [0.0, -2.0, 0.0]);
  mMatrix = mat4.scale(mMatrix, [10.0, 1.0, 10.0]);
  
  gl.bindBuffer(gl.ARRAY_BUFFER, planePositionBuffer);
  gl.vertexAttribPointer(aPositionLocation, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPositionLocation);
  
  gl.bindBuffer(gl.ARRAY_BUFFER, planeNormalBuffer);
  gl.vertexAttribPointer(aNormalLocation, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aNormalLocation);
  
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, planeIndexBuffer);
  
  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
  gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
  gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);
  
  var normalMatrix = computeNormalMatrix(mMatrix);
  gl.uniformMatrix3fv(uNormalMatrixLocation, false, normalMatrix);
  gl.uniform4fv(uDiffuseTermLocation, [0.5, 0.5, 0.5, 1.0]); 

  drawPlane();
  mMatrix = popMatrix(matrixStack);

  // Draw sphere (blue)
  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [5.0, -0.3, 0.0]); // Position the sphere
  mMatrix = mat4.scale(mMatrix, [2, 2, 2]); // Scale the sphere
  
  gl.bindBuffer(gl.ARRAY_BUFFER, spherePositionBuffer);
  gl.vertexAttribPointer(aPositionLocation, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPositionLocation);
  
  gl.bindBuffer(gl.ARRAY_BUFFER, sphereNormalBuffer);
  gl.vertexAttribPointer(aNormalLocation, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aNormalLocation);
  
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIndexBuffer);
  
  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
  gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
  gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);
  
  var normalMatrix = computeNormalMatrix(mMatrix);
  gl.uniformMatrix3fv(uNormalMatrixLocation, false, normalMatrix);
  gl.uniform4fv(uDiffuseTermLocation, [0.2, 0.4, 0.9, 1.0]); // Blue color
  
  drawSphere();
  mMatrix = popMatrix(matrixStack);
}

function onMouseDown(event) {
  document.addEventListener("mousemove", onMouseMove, false);
  document.addEventListener("mouseup", onMouseUp, false);
  document.addEventListener("mouseout", onMouseOut, false);
  
  if (event.layerX <= canvas.width && event.layerX >= 0 &&
      event.layerY <= canvas.height && event.layerY >= 0) {
    prevMouseX = event.clientX;
    prevMouseY = canvas.height - event.clientY;
  }
}

function onMouseMove(event) {
  if (event.layerX <= canvas.width && event.layerX >= 0 &&
      event.layerY <= canvas.height && event.layerY >= 0) {
    var mouseX = event.clientX;
    var diffX = mouseX - prevMouseX;
    zAngle = zAngle + diffX / 5;
    prevMouseX = mouseX;
    
    drawScene();
  }
}

function onMouseUp(event) {
  document.removeEventListener("mousemove", onMouseMove, false);
  document.removeEventListener("mouseup", onMouseUp, false);
  document.removeEventListener("mouseout", onMouseOut, false);
}

function onMouseOut(event) {
  document.removeEventListener("mousemove", onMouseMove, false);
  document.removeEventListener("mouseup", onMouseUp, false);
  document.removeEventListener("mouseout", onMouseOut, false);
}

function setLightPosition(value) {
  lightPos[0] = parseFloat(value);
  drawScene();
}

function toggleAnimation(enabled) {
  isAnimating = enabled;
  if (enabled) {
    animate();
  } else {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }
}

function animate() {
  if (!isAnimating) return;
  zAngle += 0.5;
  drawScene();
  animationId = requestAnimationFrame(animate);
}

function webGLStart() {
  canvas = document.getElementById("3DTextureMapExample");
  document.addEventListener("mousedown", onMouseDown, false);
  
  initGL(canvas);
  
  // Initialize shaders
  shaderProgram = initShaders();
  initShadowShaders();
  initShadowFramebuffer();
  
  // Get attribute and uniform locations
  aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");
  aNormalLocation = gl.getAttribLocation(shaderProgram, "aNormal");
  
  uMMatrixLocation = gl.getUniformLocation(shaderProgram, "uMMatrix");
  uPMatrixLocation = gl.getUniformLocation(shaderProgram, "uPMatrix");
  uVMatrixLocation = gl.getUniformLocation(shaderProgram, "uVMatrix");
  uNormalMatrixLocation = gl.getUniformLocation(shaderProgram, "uNormalMatrix");
  uDiffuseTermLocation = gl.getUniformLocation(shaderProgram, "diffuseTerm");
  
  uLightPosLocation = gl.getUniformLocation(shaderProgram, "uLightPos");
  uEyePosLocation = gl.getUniformLocation(shaderProgram, "uEyePos");
  uLightColorLocation = gl.getUniformLocation(shaderProgram, "uLightColor");
  uAmbientStrengthLocation = gl.getUniformLocation(shaderProgram, "uAmbientStrength");
  uSpecularStrengthLocation = gl.getUniformLocation(shaderProgram, "uSpecularStrength");
  uShininessLocation = gl.getUniformLocation(shaderProgram, "uShininess");
  
  uShadowMapLocation = gl.getUniformLocation(shaderProgram, "uShadowMap");
  uLightViewMatrixLocation = gl.getUniformLocation(shaderProgram, "uLightViewMatrix");
  uLightProjectionMatrixLocation = gl.getUniformLocation(shaderProgram, "uLightProjectionMatrix");
  
  // Initialize geometry buffers
  initPlaneBuffer();
  initSphereBuffer();
  initTeapot();
  
  drawScene();
}