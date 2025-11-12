
const Config = {
  // Camera
  cameraPos: [0.0, 3.0, 9.0],
  lookAt: [0, 0, 0],
  fov: 60,
  near: 0.01,
  far: 1000,
  
  // Lighting
  lightPos: [5.0, 5.0, 5.0],
  
  // Materials
  globe: { specular: 0.46, shininess: 50.0 },
  teapot: { specular: 0.55, shininess: 5.0 },
  
  // Environment
  skyboxScale: 50.0,
  
  // Geometry
  sphereDetail: 50
};

const State = {
  gl: null,
  canvas: null,
  
  // Interaction
  rotation: { h: 0, v: 0 },
  lastMouse: { x: 0, y: 0 },
  
  // Matrices
  model: mat4.create(),
  view: mat4.create(),
  proj: mat4.create(),
  stack: [],
  
  // Assets
  textures: {},
  programs: {},
  geometry: {},
  
  // Flags
  skyboxReady: false,
  teapotLoaded: false,
  envMap: null
};

// ============================================================================
// SHADER SOURCES (Consolidated)
// ============================================================================

const Shaders = {
  // Basic textured shader
  basic: {
    vertex: `#version 300 es
      in vec3 aPos;
      in vec2 aUV;
      uniform mat4 uM, uV, uP;
      out vec2 vUV;
      void main() {
        vUV = aUV;
        gl_Position = uP * uV * uM * vec4(aPos, 1.0);
      }`,
    fragment: `#version 300 es
    precision highp float;
    in vec2 vUV;
    uniform sampler2D uTex;
    uniform vec4 uColor;
    uniform bool uUseTex;
    uniform bool uIsFence;     // toggle
    out vec4 fragColor;

    void main() {
      vec4 texColor = uUseTex ? texture(uTex, vUV) : uColor;

      // For fence only: discard transparent fragments
      if (uIsFence && texColor.a < 0.2) discard;

      vec3 color = texColor.rgb;
      if (uIsFence) {
        // Apply dark tint only to fence
        color *= vec3(0.1, 0.1, 0.1);
      }

      fragColor = vec4(color, 1.0);
    }`
  },
  
  // Earth with Phong shading
  earth: {
    vertex: `#version 300 es
      in vec3 aPos, aNorm;
      in vec2 aUV;
      uniform mat4 uM, uV, uP;
      uniform mat3 uN;
      out vec3 vPos, vNorm;
      out vec2 vUV;
      void main() {
        vec4 worldPos = uM * vec4(aPos, 1.0);
        vPos = worldPos.xyz;
        vNorm = normalize(uN * aNorm);
        vUV = aUV;
        gl_Position = uP * uV * worldPos;
      }`,
    fragment: `#version 300 es
      precision highp float;
      in vec3 vPos, vNorm;
      in vec2 vUV;
      uniform vec3 uLight, uEye;
      uniform sampler2D uTex;
      uniform float uSpec, uShine;
      out vec4 fragColor;
      void main() {
        vec3 color = texture(uTex, vUV).rgb;
        vec3 N = normalize(vNorm);
        vec3 L = normalize(uLight - vPos);
        vec3 V = normalize(uEye - vPos);
        vec3 R = reflect(-L, N);
        float diff = max(dot(N, L), 0.0);
        float spec = diff > 0.0 ? pow(max(dot(R, V), 0.0), 16.0) : 0.0;
        fragColor = vec4(color + uSpec * spec, 1.0);
      }`
  },
  
  // Reflective shader (teapot)
  reflect: {
    vertex: `#version 300 es
      in vec3 aPos, aNorm;
      uniform mat4 uM, uV, uP;
      uniform mat3 uN;
      uniform vec3 uEye;
      out vec3 vRefl, vPos, vNorm;
      void main() {
        vec3 worldPos = (uM * vec4(aPos, 1.0)).xyz;
        vec3 N = normalize(uN * aNorm);
        vec3 I = normalize(worldPos - uEye);
        vRefl = reflect(I, N);
        vPos = worldPos;
        vNorm = N;
        gl_Position = uP * uV * vec4(worldPos, 1.0);
      }`,
    fragment: `#version 300 es
      precision highp float;
      in vec3 vRefl, vPos, vNorm;
      uniform samplerCube uEnv;
      uniform vec3 uLight, uEye;
      uniform float uSpec, uShine;
      out vec4 fragColor;
      void main() {
        vec3 color = texture(uEnv, vRefl).rgb;
        vec3 N = normalize(vNorm);
        vec3 L = normalize(uLight - vPos);
        vec3 V = normalize(uEye - vPos);
        vec3 R = reflect(-L, N);
        float spec = pow(max(dot(R, V), 0.0), 7.8);
        fragColor = vec4(clamp(color + spec, 0.0, 1.0), 1.0);
      }`
  },
  
  // Refractive shader
  refract: {
    vertex: `#version 300 es
      in vec3 aPos, aNorm;
      uniform mat4 uM, uV, uP;
      uniform mat3 uN;
      uniform vec3 uEye;
      out vec3 vRefr;
      void main() {
        vec3 worldPos = (uM * vec4(aPos, 1.0)).xyz;
        vec3 N = normalize(uN * aNorm);
        vec3 I = normalize(worldPos - uEye);
        vRefr = refract(I, N, 0.99);
        gl_Position = uP * uV * vec4(worldPos, 1.0);
      }`,
    fragment: `#version 300 es
      precision highp float;
      in vec3 vRefr;
      uniform samplerCube uEnv;
      out vec4 fragColor;
      void main() {
        fragColor = texture(uEnv, vRefr);
      }`
  },
  
  // Phong with environment reflection
  phong: {
    vertex: `#version 300 es
      in vec3 aPos, aNorm;
      uniform mat4 uM, uV, uP;
      uniform mat3 uN;
      uniform vec3 uEye;
      out vec3 vPosW, vNormW, vRefl;
      void main() {
        vec4 worldPos = uM * vec4(aPos, 1.0);
        vPosW = worldPos.xyz;
        vNormW = normalize(uN * aNorm);
        vec3 I = normalize(vPosW - uEye);
        vRefl = reflect(I, vNormW);
        gl_Position = uP * uV * worldPos;
      }`,
    fragment: `#version 300 es
      precision highp float;
      in vec3 vPosW, vNormW, vRefl;
      uniform vec3 uKa, uKd, uKs;
      uniform vec3 uLight, uEye;
      uniform samplerCube uEnv;
      uniform float uReflMix;
      out vec4 fragColor;
      void main() {
        vec3 N = normalize(vNormW);
        vec3 L = normalize(uLight - vPosW);
        vec3 V = normalize(uEye - vPosW);
        vec3 R = reflect(-L, N);
        float diff = max(dot(N, L), 0.0);
        float spec = pow(max(dot(R, V), 0.0), 15.0);
        vec3 phong = uKa * 0.2 + uKd * diff + uKs * spec;
        vec3 refl = texture(uEnv, vRefl).rgb;
        fragColor = vec4(mix(phong, refl, uReflMix), 1.0);
      }`,
  },
  
  // Skybox shader
  skybox: {
    vertex: `#version 300 es
      in vec3 aPos;
      in vec2 aUV;
      uniform mat4 uM, uV, uP;
      out vec2 vUV;
      void main() {
        vUV = aUV;
        gl_Position = uP * uV * uM * vec4(aPos, 1.0);
      }`,
    fragment: `#version 300 es
      precision mediump float;
      in vec2 vUV;
      uniform sampler2D uTex;
      uniform vec4 uColor;
      uniform bool uUseTex, uFlipY, uFlipX;
      out vec4 fragColor;
      void main() {
        vec2 uv = vUV;
        if (uFlipY) uv.y = 1.0 - uv.y;
        if (uFlipX) uv.x = 1.0 - uv.x;
        fragColor = uUseTex ? texture(uTex, uv) : uColor;
      }`
  }
};

// ============================================================================
// UTILITIES
// ============================================================================

const Utils = {
  rad: deg => (deg * Math.PI) / 180,
  
  compileShader: (type, source) => {
    const gl = State.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  },
  
  createProgram: (name, vSrc, fSrc) => {
    const gl = State.gl;
    const vShader = Utils.compileShader(gl.VERTEX_SHADER, vSrc);
    const fShader = Utils.compileShader(gl.FRAGMENT_SHADER, fSrc);
    if (!vShader || !fShader) return null;
    
    const program = gl.createProgram();
    gl.attachShader(program, vShader);
    gl.attachShader(program, fShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return null;
    }
    
    // Auto-gather attributes and uniforms
    const info = { program, attr: {}, unif: {} };
    const numAttrs = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < numAttrs; i++) {
      const attr = gl.getActiveAttrib(program, i);
      info.attr[attr.name] = gl.getAttribLocation(program, attr.name);
    }
    const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < numUniforms; i++) {
      const unif = gl.getActiveUniform(program, i);
      info.unif[unif.name] = gl.getUniformLocation(program, unif.name);
    }
    
    State.programs[name] = info;
    return info;
  },
  
  pushMatrix: () => {
    State.stack.push(mat4.create(State.model));
  },
  
  popMatrix: () => {
    if (State.stack.length > 0) {
      State.model = State.stack.pop();
    }
  },
  
  createBuffer: (data, type = 'ARRAY_BUFFER', usage = 'STATIC_DRAW') => {
    const gl = State.gl;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl[type], buffer);
    const TypedArray = type === 'ELEMENT_ARRAY_BUFFER' ? 
      (data.length > 65535 ? Uint32Array : Uint16Array) : Float32Array;
    gl.bufferData(gl[type], new TypedArray(data), gl[usage]);
    return buffer;
  },
  
  getNormalMatrix: () => {
    const nm = mat3.create();
    mat4.toInverseMat3(State.model, nm);
    mat3.transpose(nm);
    return nm;
  }
};

// ============================================================================
// GEOMETRY GENERATION
// ============================================================================

const Geometry = {
  sphere: (slices, stacks, radius) => {
    const pos = [], norm = [], uv = [], idx = [];
    
    for (let i = 0; i <= slices; i++) {
      const theta = (i * Math.PI) / slices;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      
      for (let j = 0; j <= stacks; j++) {
        const phi = (j * 2 * Math.PI) / stacks;
        const nx = Math.cos(phi) * sinTheta;
        const ny = cosTheta;
        const nz = Math.sin(phi) * sinTheta;
        
        pos.push(radius * nx, radius * ny, radius * nz);
        norm.push(nx, ny, nz);
        uv.push(1 - j / stacks, 1 - i / slices);
      }
    }
    
    for (let i = 0; i < slices; i++) {
      for (let j = 0; j < stacks; j++) {
        const first = i * (stacks + 1) + j;
        const second = first + stacks + 1;
        idx.push(first, second, first + 1, second, second + 1, first + 1);
      }
    }
    
    return { pos, norm, uv, idx };
  },
  
  cube: () => {
    const pos = [
      -0.5,-0.5,0.5, 0.5,-0.5,0.5, 0.5,0.5,0.5, -0.5,0.5,0.5,
      -0.5,-0.5,-0.5, 0.5,-0.5,-0.5, 0.5,0.5,-0.5, -0.5,0.5,-0.5,
      -0.5,0.5,-0.5, 0.5,0.5,-0.5, 0.5,0.5,0.5, -0.5,0.5,0.5,
      -0.5,-0.5,-0.5, 0.5,-0.5,-0.5, 0.5,-0.5,0.5, -0.5,-0.5,0.5,
      0.5,-0.5,-0.5, 0.5,0.5,-0.5, 0.5,0.5,0.5, 0.5,-0.5,0.5,
      -0.5,-0.5,-0.5, -0.5,0.5,-0.5, -0.5,0.5,0.5, -0.5,-0.5,0.5
    ];
    const norm = [
      0,0,1, 0,0,1, 0,0,1, 0,0,1,
      0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1,
      0,1,0, 0,1,0, 0,1,0, 0,1,0,
      0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0,
      1,0,0, 1,0,0, 1,0,0, 1,0,0,
      -1,0,0, -1,0,0, -1,0,0, -1,0,0
    ];
    const uv = Array(6).fill([0,0, 1,0, 1,1, 0,1]).flat();
    const idx = [
      0,1,2, 0,2,3, 4,5,6, 4,6,7, 8,9,10, 8,10,11,
      12,13,14, 12,14,15, 16,17,18, 16,18,19, 20,21,22, 20,22,23
    ];
    return { pos, norm, uv, idx };
  },
  
  plane: () => {
    const pos = [-1,0,-1, 1,0,-1, 1,0,1, -1,0,1];
    const uv = [0,0, 1,0, 1,1, 0,1];
    const idx = [0,1,2, 0,2,3];
    return { pos, uv, idx };
  }
};

// ============================================================================
// INITIALIZATION
// ============================================================================

function initGeometry() {
  const gl = State.gl;
  
  // Sphere
  const sphere = Geometry.sphere(Config.sphereDetail, Config.sphereDetail, 1.0);
  State.geometry.sphere = {
    pos: Utils.createBuffer(sphere.pos),
    norm: Utils.createBuffer(sphere.norm),
    uv: Utils.createBuffer(sphere.uv),
    idx: Utils.createBuffer(sphere.idx, 'ELEMENT_ARRAY_BUFFER'),
    count: sphere.idx.length
  };
  
  // Cube
  const cube = Geometry.cube();
  State.geometry.cube = {
    pos: Utils.createBuffer(cube.pos),
    norm: Utils.createBuffer(cube.norm),
    uv: Utils.createBuffer(cube.uv),
    idx: Utils.createBuffer(cube.idx, 'ELEMENT_ARRAY_BUFFER'),
    count: cube.idx.length
  };
  
  // Plane
  const plane = Geometry.plane();
  State.geometry.plane = {
    pos: Utils.createBuffer(plane.pos),
    uv: Utils.createBuffer(plane.uv),
    idx: Utils.createBuffer(plane.idx, 'ELEMENT_ARRAY_BUFFER'),
    count: plane.idx.length
  };
}

function initShaders() {
  for (const [name, src] of Object.entries(Shaders)) {
    Utils.createProgram(name, src.vertex, src.fragment);
  }
}

function loadTexture(path, onLoad) {
  const gl = State.gl;
  const tex = gl.createTexture();
  const img = new Image();
  
  img.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    const fmt = path.endsWith('.png') ? gl.RGBA : gl.RGB;
    gl.texImage2D(gl.TEXTURE_2D, 0, fmt, fmt, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    if (onLoad) onLoad();
    render();
  };
  
  img.src = path;
  return tex;
}

function loadSkybox() {
  const gl = State.gl;
  const faces = ['posx', 'negx', 'posy', 'negy', 'posz', 'negz'];
  const skyboxTextures = {};
  let loaded = 0;
  
  const checkComplete = () => {
    if (++loaded === 6) {
      State.envMap = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, State.envMap);
      
      const targets = [
        gl.TEXTURE_CUBE_MAP_POSITIVE_X, gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
        gl.TEXTURE_CUBE_MAP_POSITIVE_Y, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
        gl.TEXTURE_CUBE_MAP_POSITIVE_Z, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z
      ];
      
      faces.forEach((face, i) => {
        gl.texImage2D(targets[i], 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, skyboxTextures[face].image);
      });
      
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
      
      State.skyboxReady = true;
      render();
    }
  };
  
  faces.forEach(face => {
    const tex = gl.createTexture();
    const img = new Image();
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      skyboxTextures[face] = { tex, image: img };
      State.textures[face] = tex; // Store in main textures object
      checkComplete();
    };
    img.src = `texture_and_other_files/Field/${face}.jpg`;
  });
}

function loadTeapot() {
  fetch('texture_and_other_files/teapot.json')
    .then(r => r.json())
    .then(data => {
      const gl = State.gl;
      State.geometry.teapot = {
        pos: Utils.createBuffer(data.vertexPositions),
        norm: Utils.createBuffer(data.vertexNormals),
        idx: Utils.createBuffer(data.indices, 'ELEMENT_ARRAY_BUFFER'),
        count: data.indices.length
      };
      State.teapotLoaded = true;
      render();
    })
    .catch(err => console.error('Teapot load error:', err));
}

// ============================================================================
// RENDERING
// ============================================================================

function drawMesh(geom, prog, uniforms = {}) {
  const gl = State.gl;
  const p = State.programs[prog];
  
  gl.useProgram(p.program);
  
  // Bind attributes
  if (p.attr.aPos !== undefined && geom.pos) {
    gl.bindBuffer(gl.ARRAY_BUFFER, geom.pos);
    gl.enableVertexAttribArray(p.attr.aPos);
    gl.vertexAttribPointer(p.attr.aPos, 3, gl.FLOAT, false, 0, 0);
  }
  
  if (p.attr.aNorm !== undefined && geom.norm) {
    gl.bindBuffer(gl.ARRAY_BUFFER, geom.norm);
    gl.enableVertexAttribArray(p.attr.aNorm);
    gl.vertexAttribPointer(p.attr.aNorm, 3, gl.FLOAT, false, 0, 0);
  }
  
  if (p.attr.aUV !== undefined && geom.uv) {
    gl.bindBuffer(gl.ARRAY_BUFFER, geom.uv);
    gl.enableVertexAttribArray(p.attr.aUV);
    gl.vertexAttribPointer(p.attr.aUV, 2, gl.FLOAT, false, 0, 0);
  }
  
  // Set uniforms
  if (p.unif.uM) gl.uniformMatrix4fv(p.unif.uM, false, State.model);
  if (p.unif.uV) gl.uniformMatrix4fv(p.unif.uV, false, State.view);
  if (p.unif.uP) gl.uniformMatrix4fv(p.unif.uP, false, State.proj);
  if (p.unif.uN) gl.uniformMatrix3fv(p.unif.uN, false, Utils.getNormalMatrix());
  
  // Custom uniforms
  for (const [key, val] of Object.entries(uniforms)) {
    const loc = p.unif[key];
    if (loc === undefined) continue;
    
    if (typeof val === 'number') gl.uniform1f(loc, val);
    else if (val.length === 3) gl.uniform3fv(loc, val);
    else if (val.length === 4) gl.uniform4fv(loc, val);
    else if (typeof val === 'boolean') gl.uniform1i(loc, val ? 1 : 0);
    else if (val.texture) {
      gl.activeTexture(gl.TEXTURE0 + (val.unit || 0));
      gl.bindTexture(val.cube ? gl.TEXTURE_CUBE_MAP : gl.TEXTURE_2D, val.texture);
      gl.uniform1i(loc, val.unit || 0);
    }
  }
  
  // Draw
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geom.idx);
  const type = geom.count > 65535 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
  gl.drawElements(gl.TRIANGLES, geom.count, type, 0);
}

function drawSkybox() {
  if (!State.skyboxReady) return;
  
  const gl = State.gl;
  const sz = Config.skyboxScale;
  const faces = [
    { pos: [sz,0,0], rot: [[0,1,0,90], [1,0,0,90]], tex: 'posx', flip: false },
    { pos: [-sz,0,0], rot: [[0,1,0,-90], [1,0,0,90]], tex: 'negx', flip: false },
    { pos: [0,0,sz], rot: [[0,1,0,180], [1,0,0,90], [0,1,0,180]], tex: 'posz', flip: true },
    { pos: [0,0,-sz], rot: [[0,1,0,-180], [1,0,0,90]], tex: 'negz', flip: false },
    { pos: [0,sz,0], rot: [[0,1,0,90], [1,0,0,180]], tex: 'posy', flip: false },
    { pos: [0,-sz,0], rot: [[0,1,0,90]], tex: 'negy', flip: false }
  ];
  
  gl.depthMask(false);
  
  faces.forEach(f => {
    Utils.pushMatrix();
    mat4.translate(State.model, f.pos);
    f.rot.forEach(r => mat4.rotate(State.model, Utils.rad(r[3]), r.slice(0,3)));
    mat4.scale(State.model, [sz, 1, sz]);
    
    drawMesh(State.geometry.plane, 'skybox', {
      uTex: { texture: State.textures[f.tex] },
      uUseTex: true,
      uFlipY: f.flip,
      uFlipX: false,
      uColor: [1,1,1,1]
    });
    
    Utils.popMatrix();
  });
  
  gl.depthMask(true);
}

function render() {
  const gl = State.gl;
  
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.clearColor(0.8, 0.8, 0.8, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  
  // Setup matrices
  mat4.identity(State.model);
  mat4.identity(State.view);
  mat4.identity(State.proj);
  
  mat4.lookAt(Config.cameraPos, Config.lookAt, [0,1,0], State.view);
  mat4.perspective(Config.fov, 1.0, Config.near, Config.far, State.proj);
  
  mat4.rotate(State.model, Utils.rad(State.rotation.h), [0,1,0]);
  mat4.rotate(State.model, Utils.rad(State.rotation.v), [1,0,0]);
  
  // Skybox
  drawSkybox();
  
  // Globe
  Utils.pushMatrix();
  mat4.translate(State.model, [2.2, -0.2, 2]);
  mat4.scale(State.model, [1, 1, 1]);
  if (State.textures.earth) {
    drawMesh(State.geometry.sphere, 'earth', {
      uTex: { texture: State.textures.earth },
      uLight: Config.lightPos,
      uEye: Config.cameraPos,
      uSpec: Config.globe.specular,
      uShine: Config.globe.shininess
    });
  }
  Utils.popMatrix();
  
  // Teapot
  if (State.teapotLoaded && State.envMap) {
    Utils.pushMatrix();
    mat4.translate(State.model, [-1.5, 0.3, 0]);
    mat4.scale(State.model, [0.2, 0.2, 0.2]);
    drawMesh(State.geometry.teapot, 'reflect', {
      uEnv: { texture: State.envMap, cube: true },
      uEye: Config.cameraPos,
      uLight: Config.lightPos,
      uSpec: Config.teapot.specular,
      uShine: Config.teapot.shininess
    });
    Utils.popMatrix();
  }
  // Fence cube (blackish mesh)
  if (State.textures.fence) {
    Utils.pushMatrix();
    mat4.translate(State.model, [2.5, -0.2, -0.5]);
    mat4.scale(State.model, [1.7, 1.7, 1.7]);
    drawMesh(State.geometry.cube, 'basic', {
      uTex: { texture: State.textures.fence },
      uUseTex: true,
      uColor: [1.0, 1.0, 1.0, 1.0],
      uIsFence: true
    });
    Utils.popMatrix();
  }
  
  // Phong sphere with reflection
  if (State.envMap) {
    Utils.pushMatrix();
    mat4.translate(State.model, [2.6, -0.5, -0.5]);
    mat4.scale(State.model, [0.6, 0.6, 0.6]);
    drawMesh(State.geometry.sphere, 'phong', {
      uEnv: { texture: State.envMap, cube: true },
      uEye: Config.cameraPos,
      uLight: Config.lightPos,
      uKa: [0.0, 0.0, 0.5],
      uKd: [0.0, 0.0, 0.5],
      uKs: [1.0, 1.0, 1.0],
      uReflMix: 0.5
    });
    Utils.popMatrix();
  }
  
  // Refractive cube
  if (State.envMap) {
    Utils.pushMatrix();
    mat4.translate(State.model, [-1.2, 0, 3.2]);
    mat4.scale(State.model, [1, 2.5, 0.1]);
    drawMesh(State.geometry.cube, 'refract', {
      uEnv: { texture: State.envMap, cube: true },
      uEye: Config.cameraPos
    });
    Utils.popMatrix();
  }
  
  // Table top
  if (State.textures.wood) {
    Utils.pushMatrix();
    mat4.translate(State.model, [0, -1.2, 0]);
    mat4.scale(State.model, [7, 0.1, 4]);
    drawMesh(State.geometry.sphere, 'basic', {
      uTex: { texture: State.textures.wood },
      uUseTex: true,
      uColor: [1,1,1,1],
      uIsFence: false
    });
    Utils.popMatrix();
  }

  // Table legs
  if (State.textures.wood) {
    Utils.pushMatrix();
    mat4.translate(State.model, [0, -1.2, 0]);
    mat4.scale(State.model, [0.51, 5.1, 0.51]);
    for (let i = 0; i < 4; i++) {
      Utils.pushMatrix();
      const ang = Utils.rad(i * 90 + 45);
      const rad = 8.0;
      mat4.translate(State.model, [rad * Math.cos(ang), -0.5, rad * Math.sin(ang)]);
      drawMesh(State.geometry.cube, 'basic', {
        uTex: { texture: State.textures.wood },
        uUseTex: true,
        uColor: [1,1,1,1],
        uIsFence: false
      });
      Utils.popMatrix();
    }
    Utils.popMatrix();
  }
}

// ============================================================================
// INPUT HANDLING
// ============================================================================

function setupInput() {
  let dragging = false;
  
  const onDown = (e) => {
    dragging = true;
    State.lastMouse.x = e.clientX;
    State.lastMouse.y = e.clientY;
  };
  
  const onMove = (e) => {
    if (!dragging) return;
    
    const dx = e.clientX - State.lastMouse.x;
    const dy = e.clientY - State.lastMouse.y;
    
    State.rotation.h += dx / 5;
    State.rotation.v -= dy / 5;
    
    State.lastMouse.x = e.clientX;
    State.lastMouse.y = e.clientY;
    
    render();
  };
  
  const onUp = () => {
    dragging = false;
  };
  
  State.canvas.addEventListener('mousedown', onDown);
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  document.addEventListener('mouseout', onUp);
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

// ============================================================================
// AUTO ROTATION FEATURE (fixed version)
// ============================================================================
let autoRotate = false;
let lastTime = 0;

function toggleAutoRotate() {
  autoRotate = !autoRotate;
  const btn = document.getElementById('rotateBtn');
  if (btn) btn.textContent = autoRotate ? 'Stop Auto Rotate' : 'Start Auto Rotate';
  if (autoRotate) {
    lastTime = performance.now();
    requestAnimationFrame(animateRotation);
  }
}

function animateRotation(now) {
  if (!autoRotate) return;
  const deltaTime = (now - lastTime) / 1000.0; // seconds since last frame
  lastTime = now;

  // rotate at ~20 degrees per second
  State.rotation.h += 15.0 * deltaTime;
  render();

  requestAnimationFrame(animateRotation);
}

function webGLStart() {
  State.canvas = document.getElementById('Assn3-canvas');
  
  try {
    State.gl = State.canvas.getContext('webgl2');
    if (!State.gl) {
      alert('WebGL2 not supported');
      return;
    }
  } catch (e) {
    console.error('WebGL2 initialization failed:', e);
    return;
  }
  
  // Initialize everything
  initShaders();
  initGeometry();
  setupInput();
  
  // Load assets
  State.textures.earth = loadTexture('texture_and_other_files/earthmap.jpg');
  State.textures.wood = loadTexture('texture_and_other_files/wood_texture.jpg');
  State.textures.fence = loadTexture('texture_and_other_files/fence_alpha.png');

  loadSkybox();
  loadTeapot();
  
  // Initial render
  render();
  const btn = document.getElementById('rotateBtn');
  if (btn) btn.addEventListener('click', toggleAutoRotate);
}