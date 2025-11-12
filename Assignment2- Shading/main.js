// WebGL 3D Scene Renderer with Three Shading Techniques
// Assignment 2 - CS360 Computer Graphics

class Scene3DRenderer {
    constructor() {
        this.webglContext = null;
        this.renderCanvas = null;
        this.transformationStack = [];
        
        // Geometry storage
        this.geometryData = {
            sphereVertices: [],
            sphereIndices: [],
            sphereNormals: [],
            cubeVertices: [],
            cubeIndices: [],
            cubeNormals: []
        };
        
        // Buffer objects
        this.bufferObjects = {
            sphereVertex: null,
            sphereIndex: null,
            sphereNormal: null,
            cubeVertex: null,
            cubeIndex: null,
            cubeNormal: null
        };
        
        this.renderPrograms = {
            flatShading: null,
            gouraudShading: null,
            phongShading: null
        };
        this.currentAttributes = {
            vertexPosition: null,
            vertexNormal: null
        };
        
        this.currentUniforms = {
            modelMatrix: null,
            viewMatrix: null,
            projectionMatrix: null,
            lightPosition: null,
            ambientColor: null,
            diffuseColor: null,
            specularColor: null
        };
        
        // Scene rotation states
        this.viewportRotations = {
            first: { horizontal: 0.0, vertical: 0.0 },
            second: { horizontal: 0.0, vertical: 0.0 },
            third: { horizontal: 0.0, vertical: 0.0 }
        };
        
        this.interactionState = {
            lastMouseX: 0.0,
            lastMouseY: 0.0,
            selectedViewport: 0
        };
        
        // Transformation matrices
        this.sceneMatrices = {
            view: mat4.create(),
            model: mat4.create(),
            projection: mat4.create(),
            normal: mat3.create()
        };
        
        // Lighting configuration
        this.lightingConfig = {
            position: [5, 4, 4],
            ambientColor: [1, 1, 1],
            diffuseColor: [1.0, 1.0, 1.0],
            specularColor: [1.0, 1.0, 1.0]
        };
        
        // Camera configuration
        this.cameraConfig = {
            eyePosition: [0.0, 0.0, 2.0],
            lookAtPoint: [0.0, 0.0, 0.0],
            upDirection: [0.0, 1.0, 0.0]
        };
        this.boundHandleMouseDrag = this.handleMouseDrag.bind(this);
        this.boundHandleMouseRelease = this.handleMouseRelease.bind(this);
        this.boundHandleMouseExit = this.handleMouseExit.bind(this);
    
    }
    
    // Flat shading vertex shader
    getFlatShadingVertexShader() {
        return `#version 300 es
        in vec3 aPosition;
        in vec3 aNormal;
        uniform mat4 uMMatrix;
        uniform mat4 uPMatrix;
        uniform mat4 uVMatrix;

        out mat4 viewMatrix;
        out vec3 vPosEyeSpace;

        void main() {
            mat4 mvpMatrix = uPMatrix * uVMatrix * uMMatrix;
            gl_Position = mvpMatrix * vec4(aPosition, 1.0);
            viewMatrix = uVMatrix;
            vPosEyeSpace = (uVMatrix * uMMatrix * vec4(aPosition, 1.0)).xyz;
        }`;
    }
    
    // Flat shading fragment shader
    getFlatShadingFragmentShader() {
        return `#version 300 es
        precision mediump float;
        in vec3 vPosEyeSpace;
        uniform vec3 uLightPosition;
        uniform vec3 uAmbientColor;
        uniform vec3 uDiffuseColor;
        uniform vec3 uSpecularColor;
        in mat4 viewMatrix;

        out vec4 fragColor;

        void main() {
            vec3 surfaceNormal = normalize(cross(dFdx(vPosEyeSpace), dFdy(vPosEyeSpace)));
            vec3 lightDirection = normalize(uLightPosition - vPosEyeSpace);
            vec3 reflectedLight = normalize(-reflect(lightDirection, surfaceNormal));
            vec3 viewDirection = normalize(-vPosEyeSpace);

            float ambientTerm = 0.15;
            float diffuseTerm = max(dot(lightDirection, surfaceNormal), 0.0);
            float specularTerm = pow(max(dot(reflectedLight, viewDirection), 0.0), 32.0);

            vec3 finalColor = uAmbientColor * ambientTerm + uDiffuseColor * diffuseTerm + uSpecularColor * specularTerm;
            fragColor = vec4(finalColor, 1.0);
        }`;
    }
    
    // Gouraud shading vertex shader
    getGouraudShadingVertexShader() {
        return `#version 300 es
        in vec3 aPosition;
        in vec3 aNormal;
        uniform mat4 uMMatrix;
        uniform mat4 uPMatrix;
        uniform mat4 uVMatrix;

        out vec3 vertexColor;

        uniform vec3 uLightPosition;
        uniform vec3 uAmbientColor;
        uniform vec3 uDiffuseColor;
        uniform vec3 uSpecularColor;

        void main() {
            vec3 eyeSpacePosition = (uVMatrix * uMMatrix * vec4(aPosition, 1.0)).xyz;
            vec3 eyeSpaceNormal = normalize((transpose(inverse(mat3(uVMatrix * uMMatrix)))) * aNormal);
            vec3 lightVector = normalize(uLightPosition - eyeSpacePosition);
            vec3 viewVector = normalize(-eyeSpacePosition);

            float diffuseComponent = max(dot(eyeSpaceNormal, lightVector), 0.0);
            float specularComponent = pow(max(dot(-reflect(lightVector, eyeSpaceNormal), viewVector), 0.0), 32.0);
            float ambientComponent = 0.15;
            
            vertexColor = uAmbientColor * ambientComponent + uDiffuseColor * diffuseComponent + uSpecularColor * specularComponent;
            gl_Position = uPMatrix * uVMatrix * uMMatrix * vec4(aPosition, 1.0);
        }`;
    }
    
    // Gouraud shading fragment shader
    getGouraudShadingFragmentShader() {
        return `#version 300 es
        precision mediump float;
        in vec3 vertexColor;
        out vec4 fragColor;

        void main() {
            fragColor = vec4(vertexColor, 1.0);
        }`;
    }
    
    // Phong shading vertex shader
    getPhongShadingVertexShader() {
        return `#version 300 es
        in vec3 aPosition;
        in vec3 aNormal;
        uniform mat4 uMMatrix;
        uniform mat4 uPMatrix;
        uniform mat4 uVMatrix;

        out vec3 vPosEyeSpace;
        out vec3 normalEyeSpace;
        out vec3 lightVector;
        out vec3 viewVector;

        uniform vec3 uLightPosition;

        void main() {
            vPosEyeSpace = (uVMatrix * uMMatrix * vec4(aPosition, 1.0)).xyz;
            normalEyeSpace = normalize(mat3(uVMatrix * uMMatrix) * aNormal);
            lightVector = normalize(uLightPosition - vPosEyeSpace);
            viewVector = normalize(-vPosEyeSpace);
            gl_Position = uPMatrix * uVMatrix * uMMatrix * vec4(aPosition, 1.0);
        }`;
    }
    
    // Phong shading fragment shader
    getPhongShadingFragmentShader() {
        return `#version 300 es
        precision mediump float;
        out vec4 fragColor;

        in vec3 normalEyeSpace;
        in vec3 lightVector;
        in vec3 viewVector;
        in vec3 vPosEyeSpace;

        uniform vec3 uAmbientColor;
        uniform vec3 uDiffuseColor;
        uniform vec3 uSpecularColor;

        void main() {
            vec3 normal = normalEyeSpace;
            vec3 light = lightVector;
            vec3 view = viewVector;

            vec3 reflection = normalize(-reflect(light, normal));
            float diffuseStrength = max(dot(normal, light), 0.0);
            float specularStrength = pow(max(dot(reflection, view), 0.0), 32.0);
            float ambientStrength = 0.15;
            
            vec3 computedColor = uAmbientColor * ambientStrength + uDiffuseColor * diffuseStrength + uSpecularColor * specularStrength;
            fragColor = vec4(computedColor, 1.0);
        }`;
    }
    compileVertexShader(sourceCode) {
        const shader = this.webglContext.createShader(this.webglContext.VERTEX_SHADER);
        this.webglContext.shaderSource(shader, sourceCode);
        this.webglContext.compileShader(shader);
        
        if (!this.webglContext.getShaderParameter(shader, this.webglContext.COMPILE_STATUS)) {
            alert(this.webglContext.getShaderInfoLog(shader));
            return null;
        }
        return shader;
    }

    compileFragmentShader(sourceCode) {
        const shader = this.webglContext.createShader(this.webglContext.FRAGMENT_SHADER);
        this.webglContext.shaderSource(shader, sourceCode);
        this.webglContext.compileShader(shader);
        
        if (!this.webglContext.getShaderParameter(shader, this.webglContext.COMPILE_STATUS)) {
            alert(this.webglContext.getShaderInfoLog(shader));
            return null;
        }
        return shader;
    }

    createShaderProgram(vertexShaderSource, fragmentShaderSource) {
        const program = this.webglContext.createProgram();
        const vertexShader = this.compileVertexShader(vertexShaderSource);
        const fragmentShader = this.compileFragmentShader(fragmentShaderSource);

        this.webglContext.attachShader(program, vertexShader);
        this.webglContext.attachShader(program, fragmentShader);
        this.webglContext.linkProgram(program);

        if (!this.webglContext.getProgramParameter(program, this.webglContext.LINK_STATUS)) {
            console.log(this.webglContext.getShaderInfoLog(vertexShader));
            console.log(this.webglContext.getShaderInfoLog(fragmentShader));
        }

        this.webglContext.useProgram(program);
        return program;
    }

    setupWebGLContext(canvasElement) {
        try {
            this.webglContext = canvasElement.getContext("webgl2");
            this.webglContext.viewportWidth = canvasElement.width;
            this.webglContext.viewportHeight = canvasElement.height;
        } catch (error) {
            console.error("WebGL context creation failed", error);
        }
        if (!this.webglContext) {
            alert("WebGL initialization failed");
        }
    }

    convertDegreesToRadians(degrees) {
        return (degrees * Math.PI) / 180;
    }

    saveMatrixToStack(stack, matrix) {
        const matrixCopy = mat4.create(matrix);
        stack.push(matrixCopy);
    }

    restoreMatrixFromStack(stack) {
        if (stack.length > 0) return stack.pop();
        else console.log("Transformation stack is empty!");
    }

    generateSphereGeometry(longitudeSegments, latitudeSegments, radius) {
        let phi, theta;
        
        // Bottom pole vertices
        for (let i = 0; i < longitudeSegments; i++) {
            this.geometryData.sphereVertices.push(0, -radius, 0);
            this.geometryData.sphereNormals.push(0, -1.0, 0);
        }
        
        // Middle ring vertices
        for (let lat = 1; lat < latitudeSegments - 1; lat++) {
            phi = (lat * 2 * Math.PI) / longitudeSegments - Math.PI / 2;
            for (let lon = 0; lon < longitudeSegments; lon++) {
                theta = (lon * 2 * Math.PI) / longitudeSegments;
                this.geometryData.sphereVertices.push(
                    radius * Math.cos(phi) * Math.cos(theta),
                    radius * Math.sin(phi),
                    radius * Math.cos(phi) * Math.sin(theta)
                );
                this.geometryData.sphereNormals.push(
                    Math.cos(phi) * Math.cos(theta),
                    Math.sin(phi),
                    Math.cos(phi) * Math.sin(theta)
                );
            }
        }
        
        // Top pole vertices
        for (let i = 0; i < longitudeSegments; i++) {
            this.geometryData.sphereVertices.push(0, radius, 0);
            this.geometryData.sphereNormals.push(0, 1.0, 0);
        }
        
        // Generate triangle indices
        for (let lat = 0; lat < latitudeSegments - 1; lat++) {
            for (let lon = 0; lon <= longitudeSegments; lon++) {
                const currentLon = lon % longitudeSegments;
                const nextLon = (lon + 1) % longitudeSegments;
                const idx1 = (lat + 1) * longitudeSegments + currentLon;
                const idx2 = lat * longitudeSegments + currentLon;
                const idx3 = lat * longitudeSegments + nextLon;
                const idx4 = (lat + 1) * longitudeSegments + currentLon;
                const idx5 = lat * longitudeSegments + nextLon;
                const idx6 = (lat + 1) * longitudeSegments + nextLon;

                this.geometryData.sphereIndices.push(idx1, idx2, idx3, idx4, idx5, idx6);
            }
        }
    }

    createSphereBuffers() {
        this.geometryData.sphereVertices = [];
        this.geometryData.sphereNormals = [];
        this.geometryData.sphereIndices = [];

        const longSegments = 30;
        const latSegments = longSegments / 2 + 1;
        const sphereRadius = 0.5;
        
        this.generateSphereGeometry(longSegments, latSegments, sphereRadius);
        
        this.bufferObjects.sphereVertex = this.webglContext.createBuffer();
        this.webglContext.bindBuffer(this.webglContext.ARRAY_BUFFER, this.bufferObjects.sphereVertex);
        this.webglContext.bufferData(this.webglContext.ARRAY_BUFFER, new Float32Array(this.geometryData.sphereVertices), this.webglContext.STATIC_DRAW);
        this.bufferObjects.sphereVertex.itemSize = 3;
        this.bufferObjects.sphereVertex.numItems = this.geometryData.sphereVertices.length / 3;
        
        this.bufferObjects.sphereNormal = this.webglContext.createBuffer();
        this.webglContext.bindBuffer(this.webglContext.ARRAY_BUFFER, this.bufferObjects.sphereNormal);
        this.webglContext.bufferData(this.webglContext.ARRAY_BUFFER, new Float32Array(this.geometryData.sphereNormals), this.webglContext.STATIC_DRAW);
        this.bufferObjects.sphereNormal.itemSize = 3;
        this.bufferObjects.sphereNormal.numItems = this.geometryData.sphereNormals.length / 3;
        
        this.bufferObjects.sphereIndex = this.webglContext.createBuffer();
        this.webglContext.bindBuffer(this.webglContext.ELEMENT_ARRAY_BUFFER, this.bufferObjects.sphereIndex);
        this.webglContext.bufferData(this.webglContext.ELEMENT_ARRAY_BUFFER, new Uint32Array(this.geometryData.sphereIndices), this.webglContext.STATIC_DRAW);
        this.bufferObjects.sphereIndex.itemSize = 1;
        this.bufferObjects.sphereIndex.numItems = this.geometryData.sphereIndices.length;
    }

    drawSphereGeometry() {
        this.webglContext.bindBuffer(this.webglContext.ARRAY_BUFFER, this.bufferObjects.sphereVertex);
        this.webglContext.vertexAttribPointer(this.currentAttributes.vertexPosition, this.bufferObjects.sphereVertex.itemSize, this.webglContext.FLOAT, false, 0, 0);

        this.webglContext.bindBuffer(this.webglContext.ARRAY_BUFFER, this.bufferObjects.sphereNormal);
        this.webglContext.vertexAttribPointer(this.currentAttributes.vertexNormal, this.bufferObjects.sphereNormal.itemSize, this.webglContext.FLOAT, false, 0, 0);

        this.webglContext.bindBuffer(this.webglContext.ELEMENT_ARRAY_BUFFER, this.bufferObjects.sphereIndex);

        this.setShaderUniforms();
        this.webglContext.drawElements(this.webglContext.TRIANGLES, this.bufferObjects.sphereIndex.numItems, this.webglContext.UNSIGNED_INT, 0);
    }

    createCubeBuffers() {
        const cubeVertexData = [
            // Front face
            -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
            // Back face  
            -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
            // Top face
            -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
            // Bottom face
            -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
            // Right face
            0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
            // Left face
            -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5,
        ];
        
        this.bufferObjects.cubeVertex = this.webglContext.createBuffer();
        this.webglContext.bindBuffer(this.webglContext.ARRAY_BUFFER, this.bufferObjects.cubeVertex);
        this.webglContext.bufferData(this.webglContext.ARRAY_BUFFER, new Float32Array(cubeVertexData), this.webglContext.STATIC_DRAW);
        this.bufferObjects.cubeVertex.itemSize = 3;
        this.bufferObjects.cubeVertex.numItems = cubeVertexData.length / 3;
        
        const cubeNormalData = [
            // Front face normals
            0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0,
            // Back face normals
            0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0,
            // Top face normals
            0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0,
            // Bottom face normals
            0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0,
            // Right face normals
            1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0,
            // Left face normals
            -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0,
        ];
        
        this.bufferObjects.cubeNormal = this.webglContext.createBuffer();
        this.webglContext.bindBuffer(this.webglContext.ARRAY_BUFFER, this.bufferObjects.cubeNormal);
        this.webglContext.bufferData(this.webglContext.ARRAY_BUFFER, new Float32Array(cubeNormalData), this.webglContext.STATIC_DRAW);
        this.bufferObjects.cubeNormal.itemSize = 3;
        this.bufferObjects.cubeNormal.numItems = cubeNormalData.length / 3;
        
        const cubeIndexData = [
            0, 1, 2, 0, 2, 3,         // Front face
            4, 5, 6, 4, 6, 7,         // Back face
            8, 9, 10, 8, 10, 11,      // Top face
            12, 13, 14, 12, 14, 15,   // Bottom face
            16, 17, 18, 16, 18, 19,   // Right face
            20, 21, 22, 20, 22, 23,   // Left face
        ];
        
        this.bufferObjects.cubeIndex = this.webglContext.createBuffer();
        this.webglContext.bindBuffer(this.webglContext.ELEMENT_ARRAY_BUFFER, this.bufferObjects.cubeIndex);
        this.webglContext.bufferData(this.webglContext.ELEMENT_ARRAY_BUFFER, new Uint16Array(cubeIndexData), this.webglContext.STATIC_DRAW);
        this.bufferObjects.cubeIndex.itemSize = 1;
        this.bufferObjects.cubeIndex.numItems = cubeIndexData.length;
    }

    drawCubeGeometry() {
        this.webglContext.bindBuffer(this.webglContext.ARRAY_BUFFER, this.bufferObjects.cubeVertex);
        this.webglContext.vertexAttribPointer(this.currentAttributes.vertexPosition, this.bufferObjects.cubeVertex.itemSize, this.webglContext.FLOAT, false, 0, 0);
            
        this.webglContext.bindBuffer(this.webglContext.ARRAY_BUFFER, this.bufferObjects.cubeNormal);
        this.webglContext.vertexAttribPointer(this.currentAttributes.vertexNormal, this.bufferObjects.cubeNormal.itemSize, this.webglContext.FLOAT, false, 0, 0);

        this.webglContext.bindBuffer(this.webglContext.ELEMENT_ARRAY_BUFFER, this.bufferObjects.cubeIndex);
        
        this.setShaderUniforms();
        this.webglContext.drawElements(this.webglContext.TRIANGLES, this.bufferObjects.cubeIndex.numItems, this.webglContext.UNSIGNED_SHORT, 0);
    }

    setShaderUniforms() {
        this.webglContext.uniformMatrix4fv(this.currentUniforms.modelMatrix, false, this.sceneMatrices.model);
        this.webglContext.uniformMatrix4fv(this.currentUniforms.viewMatrix, false, this.sceneMatrices.view);
        this.webglContext.uniformMatrix4fv(this.currentUniforms.projectionMatrix, false, this.sceneMatrices.projection);
        this.webglContext.uniform3fv(this.currentUniforms.lightPosition, this.lightingConfig.position);
        this.webglContext.uniform3fv(this.currentUniforms.ambientColor, this.lightingConfig.ambientColor);
        this.webglContext.uniform3fv(this.currentUniforms.diffuseColor, this.lightingConfig.diffuseColor);
        this.webglContext.uniform3fv(this.currentUniforms.specularColor, this.lightingConfig.specularColor);
    }

    // First viewport rendering - Flat Shading
    renderFirstViewportScene() {
        mat4.identity(this.sceneMatrices.view);
        this.sceneMatrices.view = mat4.lookAt(this.cameraConfig.eyePosition, this.cameraConfig.lookAtPoint, this.cameraConfig.upDirection, this.sceneMatrices.view);

        mat4.identity(this.sceneMatrices.projection);
        mat4.perspective(50, 1.0, 0.1, 1000, this.sceneMatrices.projection);

        mat4.identity(this.sceneMatrices.model);

        this.sceneMatrices.model = mat4.rotate(this.sceneMatrices.model, this.convertDegreesToRadians(this.viewportRotations.first.horizontal), [0, 1, 0]);
        this.sceneMatrices.model = mat4.rotate(this.sceneMatrices.model, this.convertDegreesToRadians(this.viewportRotations.first.vertical), [1, 0, 0]);

        this.sceneMatrices.model = mat4.rotate(this.sceneMatrices.model, 0.5, [0, 1, 0]);
        this.sceneMatrices.model = mat4.rotate(this.sceneMatrices.model, 0.2, [1, 0, 0]);
        this.sceneMatrices.model = mat4.rotate(this.sceneMatrices.model, 0.1, [0, 0, 1]);

        this.sceneMatrices.model = mat4.scale(this.sceneMatrices.model, [1.1, 1.1, 1.1]);
        this.sceneMatrices.model = mat4.translate(this.sceneMatrices.model, [0, -0.1, 0]);

        this.saveMatrixToStack(this.transformationStack, this.sceneMatrices.model);
        this.sceneMatrices.model = mat4.translate(this.sceneMatrices.model, [0, 0.5, 0]);
        this.sceneMatrices.model = mat4.scale(this.sceneMatrices.model, [0.5, 0.5, 0.5]);

        this.lightingConfig.diffuseColor = [0.2, 0.8, 0.6];
        this.drawSphereGeometry();
        this.sceneMatrices.model = this.restoreMatrixFromStack(this.transformationStack);

        this.saveMatrixToStack(this.transformationStack, this.sceneMatrices.model);
        this.sceneMatrices.model = mat4.translate(this.sceneMatrices.model, [0.0, -0.125, 0]);
        this.sceneMatrices.model = mat4.scale(this.sceneMatrices.model, [0.45, 0.76, 0.5]);

        this.lightingConfig.diffuseColor = [0.9, 0.5, 0.2];
        this.drawCubeGeometry();
        this.sceneMatrices.model = this.restoreMatrixFromStack(this.transformationStack);
    }

    // Second viewport rendering - Gouraud Shading
    renderSecondViewportScene() {
        mat4.identity(this.sceneMatrices.view);
        this.sceneMatrices.view = mat4.lookAt(this.cameraConfig.eyePosition, this.cameraConfig.lookAtPoint, this.cameraConfig.upDirection, this.sceneMatrices.view);

        mat4.identity(this.sceneMatrices.projection);
        mat4.perspective(50, 1.0, 0.1, 1000, this.sceneMatrices.projection);

        mat4.identity(this.sceneMatrices.model);

        this.sceneMatrices.model = mat4.rotate(this.sceneMatrices.model, this.convertDegreesToRadians(this.viewportRotations.second.horizontal), [0, 1, 0]);
        this.sceneMatrices.model = mat4.rotate(this.sceneMatrices.model, this.convertDegreesToRadians(this.viewportRotations.second.vertical), [1, 0, 0]);

        this.sceneMatrices.model = mat4.rotate(this.sceneMatrices.model, 0.05, [0, 1, 0]);
        this.sceneMatrices.model = mat4.scale(this.sceneMatrices.model, [0.95, 0.95, 0.95]);

        this.saveMatrixToStack(this.transformationStack, this.sceneMatrices.model);
        this.sceneMatrices.model = mat4.translate(this.sceneMatrices.model, [0, -0.45, 0.1]);
        this.sceneMatrices.model = mat4.scale(this.sceneMatrices.model, [0.7, 0.7, 0.7]);

        this.lightingConfig.diffuseColor = [0.85, 0.85, 0.85];
        this.drawSphereGeometry();
        this.sceneMatrices.model = this.restoreMatrixFromStack(this.transformationStack);

        this.saveMatrixToStack(this.transformationStack, this.sceneMatrices.model);
        this.sceneMatrices.model = mat4.translate(this.sceneMatrices.model, [-0.36, -0.05, 0.1]);
        this.sceneMatrices.model = mat4.scale(this.sceneMatrices.model, [0.4, 0.4, 0.4]);
        this.sceneMatrices.model = mat4.rotate(this.sceneMatrices.model, 0.5, [1, 0, 0]);
        this.sceneMatrices.model = mat4.rotate(this.sceneMatrices.model, -0.45, [0, 0, 1]);
        this.sceneMatrices.model = mat4.rotate(this.sceneMatrices.model, -0.5, [0, 1, 0]);

        this.lightingConfig.diffuseColor = [0.1, 0.7, 0.2];
        this.drawCubeGeometry();
        this.sceneMatrices.model = this.restoreMatrixFromStack(this.transformationStack);

        this.saveMatrixToStack(this.transformationStack, this.sceneMatrices.model);
        this.sceneMatrices.model = mat4.translate(this.sceneMatrices.model, [-0.18, 0.24, 0.25]);
        this.sceneMatrices.model = mat4.scale(this.sceneMatrices.model, [0.4, 0.4, 0.4]);

        this.lightingConfig.diffuseColor = [0.85, 0.85, 0.85];
        this.drawSphereGeometry();
        this.sceneMatrices.model = this.restoreMatrixFromStack(this.transformationStack);

        this.saveMatrixToStack(this.transformationStack, this.sceneMatrices.model);
        this.sceneMatrices.model = mat4.translate(this.sceneMatrices.model, [0.095, 0.41, 0.3]);
        this.sceneMatrices.model = mat4.scale(this.sceneMatrices.model, [0.25, 0.25, 0.25]);
        this.sceneMatrices.model = mat4.rotate(this.sceneMatrices.model, 0.5, [1, 0, 0]);
        this.sceneMatrices.model = mat4.rotate(this.sceneMatrices.model, 0.5, [0, 0, 1]);
        this.sceneMatrices.model = mat4.rotate(this.sceneMatrices.model, 0.2, [0, 1, 0]);

        this.lightingConfig.diffuseColor = [0.1, 0.7, 0.2];
        this.drawCubeGeometry();
        this.sceneMatrices.model = this.restoreMatrixFromStack(this.transformationStack);

        this.saveMatrixToStack(this.transformationStack, this.sceneMatrices.model);
        this.sceneMatrices.model = mat4.translate(this.sceneMatrices.model, [-0.02, 0.6, 0.4]);
        this.sceneMatrices.model = mat4.scale(this.sceneMatrices.model, [0.25, 0.25, 0.25]);

        this.lightingConfig.diffuseColor = [0.85, 0.85, 0.85];
        this.drawSphereGeometry();
        this.sceneMatrices.model = this.restoreMatrixFromStack(this.transformationStack);
    }

    // Third viewport rendering - Phong Shading
    renderThirdViewportScene() {
        mat4.identity(this.sceneMatrices.view);
        this.sceneMatrices.view = mat4.lookAt(this.cameraConfig.eyePosition, this.cameraConfig.lookAtPoint, this.cameraConfig.upDirection, this.sceneMatrices.view);

        mat4.identity(this.sceneMatrices.projection);
        mat4.perspective(50, 1.0, 0.1, 1000, this.sceneMatrices.projection);

        mat4.identity(this.sceneMatrices.model);

        this.sceneMatrices.model = mat4.rotate(this.sceneMatrices.model, this.convertDegreesToRadians(this.viewportRotations.third.horizontal), [0, 1, 0]);
        this.sceneMatrices.model = mat4.rotate(this.sceneMatrices.model, this.convertDegreesToRadians(this.viewportRotations.third.vertical), [1, 0, 0]);

        this.saveMatrixToStack(this.transformationStack, this.sceneMatrices.model);
        this.sceneMatrices.model = mat4.translate(this.sceneMatrices.model, [0, -0.6, 0.1]);
        this.sceneMatrices.model = mat4.scale(this.sceneMatrices.model, [0.4, 0.4, 0.4]);

        this.lightingConfig.diffuseColor = [0.2, 0.8, 0.3];
        this.drawSphereGeometry();
        this.sceneMatrices.model = this.restoreMatrixFromStack(this.transformationStack);

        this.saveMatrixToStack(this.transformationStack, this.sceneMatrices.model);
        this.sceneMatrices.model = mat4.translate(this.sceneMatrices.model, [0.01, -0.38, 0.1]);
        this.sceneMatrices.model = mat4.rotate(this.sceneMatrices.model, Math.PI / 4, [1, 1, 1]);
        this.sceneMatrices.model = mat4.rotate(this.sceneMatrices.model, -0.6, [0, 0, 1]);
        this.sceneMatrices.model = mat4.rotate(this.sceneMatrices.model, 0.1, [0, 1, 0]);
        this.sceneMatrices.model = mat4.rotate(this.sceneMatrices.model, -0.1, [1, 0, 0]);
        this.sceneMatrices.model = mat4.scale(this.sceneMatrices.model, [1.35, 0.03, 0.25]);

        this.lightingConfig.diffuseColor = [0.9, 0.2, 0.2];
        this.drawCubeGeometry();
        this.sceneMatrices.model = this.restoreMatrixFromStack(this.transformationStack);

        this.saveMatrixToStack(this.transformationStack, this.sceneMatrices.model);
        this.sceneMatrices.model = mat4.translate(this.sceneMatrices.model, [-0.35, -0.21, 0.4]);
        this.sceneMatrices.model = mat4.scale(this.sceneMatrices.model, [0.3, 0.3, 0.3]);

        this.lightingConfig.diffuseColor = [0.2, 0.3, 0.8];
        this.drawSphereGeometry();
        this.sceneMatrices.model = this.restoreMatrixFromStack(this.transformationStack);

        this.saveMatrixToStack(this.transformationStack, this.sceneMatrices.model);
        this.sceneMatrices.model = mat4.translate(this.sceneMatrices.model, [0.35, -0.21, -0.2]);
        this.sceneMatrices.model = mat4.scale(this.sceneMatrices.model, [0.3, 0.3, 0.3]);

        this.lightingConfig.diffuseColor = [0.2, 0.6, 0.5];
        this.drawSphereGeometry();
        this.sceneMatrices.model = this.restoreMatrixFromStack(this.transformationStack);

        this.saveMatrixToStack(this.transformationStack, this.sceneMatrices.model);
        this.sceneMatrices.model = mat4.translate(this.sceneMatrices.model, [-0.35, -0.07, 0.45]);
        this.sceneMatrices.model = mat4.rotate(this.sceneMatrices.model, 3 * Math.PI / 4, [1, 1, 1]);
        this.sceneMatrices.model = mat4.rotate(this.sceneMatrices.model, -1.45, [0, 0, 1]);
        this.sceneMatrices.model = mat4.rotate(this.sceneMatrices.model, 0.6, [0, 1, 0]);
        this.sceneMatrices.model = mat4.rotate(this.sceneMatrices.model, 0.1, [1, 0, 0]);
        this.sceneMatrices.model = mat4.scale(this.sceneMatrices.model, [0.6, 0.03, 0.3]);

        this.lightingConfig.diffuseColor = [0.9, 0.8, 0.1];
        this.drawCubeGeometry();
        this.sceneMatrices.model = this.restoreMatrixFromStack(this.transformationStack);

        this.saveMatrixToStack(this.transformationStack, this.sceneMatrices.model);
        this.sceneMatrices.model = mat4.translate(this.sceneMatrices.model, [0.35, -0.07, -0.2]);
        this.sceneMatrices.model = mat4.rotate(this.sceneMatrices.model, 3 * Math.PI / 4, [1, 1, 1]);
        this.sceneMatrices.model = mat4.rotate(this.sceneMatrices.model, -1.45, [0, 0, 1]);
        this.sceneMatrices.model = mat4.rotate(this.sceneMatrices.model, 0.6, [0, 1, 0]);
        this.sceneMatrices.model = mat4.rotate(this.sceneMatrices.model, 0.1, [1, 0, 0]);
        this.sceneMatrices.model = mat4.scale(this.sceneMatrices.model, [0.6, 0.03, 0.3]);

        this.lightingConfig.diffuseColor = [0.4, 0.9, 0.1];
        this.drawCubeGeometry();
        this.sceneMatrices.model = this.restoreMatrixFromStack(this.transformationStack);

        this.saveMatrixToStack(this.transformationStack, this.sceneMatrices.model);
        this.sceneMatrices.model = mat4.translate(this.sceneMatrices.model, [-0.35, 0.1, 0.4]);
        this.sceneMatrices.model = mat4.scale(this.sceneMatrices.model, [0.3, 0.3, 0.3]);

        this.lightingConfig.diffuseColor = [0.9, 0.2, 0.8];
        this.drawSphereGeometry();
        this.sceneMatrices.model = this.restoreMatrixFromStack(this.transformationStack);

        this.saveMatrixToStack(this.transformationStack, this.sceneMatrices.model);
        this.sceneMatrices.model = mat4.translate(this.sceneMatrices.model, [0.35, 0.1, -0.2]);
        this.sceneMatrices.model = mat4.scale(this.sceneMatrices.model, [0.3, 0.3, 0.3]);

        this.lightingConfig.diffuseColor = [0.8, 0.4, 0.2];
        this.drawSphereGeometry();
        this.sceneMatrices.model = this.restoreMatrixFromStack(this.transformationStack);

        this.saveMatrixToStack(this.transformationStack, this.sceneMatrices.model);
        this.sceneMatrices.model = mat4.translate(this.sceneMatrices.model, [0.01, 0.265, 0.1]);
        this.sceneMatrices.model = mat4.rotate(this.sceneMatrices.model, Math.PI / 4, [1, 1, 1]);
        this.sceneMatrices.model = mat4.rotate(this.sceneMatrices.model, -0.6, [0, 0, 1]);
        this.sceneMatrices.model = mat4.rotate(this.sceneMatrices.model, 0.12, [0, 1, 0]);
        this.sceneMatrices.model = mat4.rotate(this.sceneMatrices.model, -0.25, [1, 0, 0]);
        this.sceneMatrices.model = mat4.scale(this.sceneMatrices.model, [1.35, 0.03, 0.25]);

        this.lightingConfig.diffuseColor = [0.9, 0.2, 0.2];
        this.drawCubeGeometry();
        this.sceneMatrices.model = this.restoreMatrixFromStack(this.transformationStack);

        this.saveMatrixToStack(this.transformationStack, this.sceneMatrices.model);
        this.sceneMatrices.model = mat4.translate(this.sceneMatrices.model, [0, 0.48, 0.1]);
        this.sceneMatrices.model = mat4.scale(this.sceneMatrices.model, [0.4, 0.4, 0.4]);

        this.lightingConfig.diffuseColor = [0.7, 0.6, 0.9];
        this.drawSphereGeometry();
        this.sceneMatrices.model = this.restoreMatrixFromStack(this.transformationStack);
    }

    renderAllViewports() {
        this.webglContext.enable(this.webglContext.SCISSOR_TEST);

        // Left viewport - Flat Shading
        this.currentProgram = this.renderPrograms.flatShading;
        this.webglContext.useProgram(this.currentProgram);
        this.webglContext.viewport(0, 0, 400, 400);
        this.webglContext.scissor(0, 0, 400, 400);
        this.webglContext.clearColor(0.92, 0.92, 0.98, 1.0);
        this.webglContext.clear(this.webglContext.COLOR_BUFFER_BIT | this.webglContext.DEPTH_BUFFER_BIT);
        this.bindShaderAttributes();
        this.webglContext.enable(this.webglContext.DEPTH_TEST);
        this.renderFirstViewportScene();

        // Middle viewport - Gouraud Shading
        this.currentProgram = this.renderPrograms.gouraudShading;
        this.webglContext.useProgram(this.currentProgram);
        this.webglContext.viewport(400, 0, 400, 400);
        this.webglContext.scissor(400, 0, 400, 400);
        this.webglContext.clearColor(0.98, 0.92, 0.92, 1.0);
        this.webglContext.clear(this.webglContext.COLOR_BUFFER_BIT | this.webglContext.DEPTH_BUFFER_BIT);
        this.bindShaderAttributes();
        this.webglContext.enable(this.webglContext.DEPTH_TEST);
        this.renderSecondViewportScene();

        // Right viewport - Phong Shading
        this.currentProgram = this.renderPrograms.phongShading;
        this.webglContext.useProgram(this.currentProgram);
        this.webglContext.viewport(800, 0, 400, 400);
        this.webglContext.scissor(800, 0, 400, 400);
        this.webglContext.clearColor(0.92, 0.98, 0.92, 1.0);
        this.webglContext.clear(this.webglContext.COLOR_BUFFER_BIT | this.webglContext.DEPTH_BUFFER_BIT);
        this.bindShaderAttributes();
        this.webglContext.enable(this.webglContext.DEPTH_TEST);
        this.renderThirdViewportScene();
    }

    bindShaderAttributes() {
        this.currentAttributes.vertexPosition = this.webglContext.getAttribLocation(this.currentProgram, "aPosition");
        this.currentAttributes.vertexNormal = this.webglContext.getAttribLocation(this.currentProgram, "aNormal"); 
        this.currentUniforms.modelMatrix = this.webglContext.getUniformLocation(this.currentProgram, "uMMatrix");
        this.currentUniforms.viewMatrix = this.webglContext.getUniformLocation(this.currentProgram, "uVMatrix");
        this.currentUniforms.projectionMatrix = this.webglContext.getUniformLocation(this.currentProgram, "uPMatrix");
        this.currentUniforms.lightPosition = this.webglContext.getUniformLocation(this.currentProgram, 'uLightPosition');
        this.currentUniforms.ambientColor = this.webglContext.getUniformLocation(this.currentProgram, 'uAmbientColor');
        this.currentUniforms.diffuseColor = this.webglContext.getUniformLocation(this.currentProgram, 'uDiffuseColor');
        this.currentUniforms.specularColor = this.webglContext.getUniformLocation(this.currentProgram, 'uSpecularColor');

        this.webglContext.enableVertexAttribArray(this.currentAttributes.vertexPosition);
        this.webglContext.enableVertexAttribArray(this.currentAttributes.vertexNormal);
    }

    handleMousePress(event) {
         document.addEventListener("mousemove", this.boundHandleMouseDrag, false);
         document.addEventListener("mouseup", this.boundHandleMouseRelease, false);
         document.addEventListener("mouseout", this.boundHandleMouseExit, false);
        if (event.layerX <= this.renderCanvas.width && event.layerX >= 0 &&
            event.layerY <= this.renderCanvas.height && event.layerY >= 0) {
            
            this.interactionState.lastMouseX = event.clientX;
            this.interactionState.lastMouseY = this.renderCanvas.height - event.clientY;
            
            const verticalBounds = this.interactionState.lastMouseY <= 300 && this.interactionState.lastMouseY >= -100;
            if (this.interactionState.lastMouseX >= 50 && this.interactionState.lastMouseX <= 450 && verticalBounds) 
                this.interactionState.selectedViewport = 1;
            else if (this.interactionState.lastMouseX >= 450 && this.interactionState.lastMouseX <= 850 && verticalBounds) 
                this.interactionState.selectedViewport = 2;
            else if (this.interactionState.lastMouseX >= 850 && this.interactionState.lastMouseX <= 1250 && verticalBounds) 
                this.interactionState.selectedViewport = 3;
        }
    }

    handleMouseDrag(event) {
        const currentMouseX = event.clientX;
        const deltaX = currentMouseX - this.interactionState.lastMouseX;
        this.interactionState.lastMouseX = currentMouseX;

        const currentMouseY = this.renderCanvas.height - event.clientY;
        const deltaY = currentMouseY - this.interactionState.lastMouseY;
        this.interactionState.lastMouseY = currentMouseY;

        const verticalBounds = currentMouseY <= 300 && currentMouseY >= -100;
        
        if (currentMouseX >= 50 && currentMouseX <= 450 && verticalBounds && this.interactionState.selectedViewport === 1) {
            this.viewportRotations.first.horizontal += deltaX / 5;
            this.viewportRotations.first.vertical -= deltaY / 5;
        } else if (currentMouseX >= 450 && currentMouseX <= 850 && verticalBounds && this.interactionState.selectedViewport === 2) {
            this.viewportRotations.second.horizontal += deltaX / 5;
            this.viewportRotations.second.vertical -= deltaY / 5;
        } else if (currentMouseX >= 850 && currentMouseX <= 1250 && verticalBounds && this.interactionState.selectedViewport === 3) {
            this.viewportRotations.third.horizontal += deltaX / 5;
            this.viewportRotations.third.vertical -= deltaY / 5;
        }
        //this.renderAllViewports();
        requestAnimationFrame(() => this.renderAllViewports());

    }

    
    handleMouseRelease(event) {
        document.removeEventListener("mousemove", this.boundHandleMouseDrag, false);
        document.removeEventListener("mouseup", this.boundHandleMouseRelease, false);
        document.removeEventListener("mouseout", this.boundHandleMouseExit, false);
    }

    handleMouseExit(event) {
        document.removeEventListener("mousemove", this.boundHandleMouseDrag, false);
        document.removeEventListener("mouseup", this.boundHandleMouseRelease, false);
        document.removeEventListener("mouseout", this.boundHandleMouseExit, false);
    }

    initializeRenderer() {
        this.renderCanvas = document.getElementById("assn2");
        document.addEventListener("mousedown", this.handleMousePress.bind(this), false);

        const lightControl = document.getElementById('light-slider');
        let lightXPosition = parseFloat(lightControl.value);

        lightControl.addEventListener('input', (event) => {
            lightXPosition = parseFloat(event.target.value);
            this.lightingConfig.position = [lightXPosition, 3.0, 4.0];
            this.renderAllViewports();
        });

        const cameraControl = document.getElementById('camera-slider');
        let cameraZPosition = parseFloat(cameraControl.value);

        cameraControl.addEventListener('input', (event) => {
            cameraZPosition = parseFloat(event.target.value);
            this.cameraConfig.eyePosition = [0.0, 0.0, cameraZPosition];
            this.renderAllViewports();
        });

        this.setupWebGLContext(this.renderCanvas);

        this.renderPrograms.flatShading = this.createShaderProgram(this.getFlatShadingVertexShader(), this.getFlatShadingFragmentShader());
        this.renderPrograms.gouraudShading = this.createShaderProgram(this.getGouraudShadingVertexShader(), this.getGouraudShadingFragmentShader());
        this.renderPrograms.phongShading = this.createShaderProgram(this.getPhongShadingVertexShader(), this.getPhongShadingFragmentShader());
        this.createSphereBuffers();
        this.createCubeBuffers();
        this.renderAllViewports();
    }
}

// Initialize the application
let sceneRenderer;

function webGLStart() {
    sceneRenderer = new Scene3DRenderer();
    sceneRenderer.initializeRenderer();
}