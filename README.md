# CS360 – Computer Graphics (IIT Kanpur)

This repository contains my submissions for **CS360: Computer Graphics** course at IIT Kanpur (Semester: 2025-26), taught by **Prof. Soumya Dutta**,  Department of Computer Science and Engineering, IIT Kanpur.

Each assignment progressively builds upon fundamental concepts of computer graphics — from 2D rendering to advanced shading, texture mapping, shadow mapping, and ray tracing — implemented using WebGL and GLSL.

## Assignment Overviews

### **Assignment 1 – 2D Scene Rendering and Animation**
**Goal:** Recreate and animate a 2D scene using basic primitives — square, triangle, and circle.  
**Concepts:**
- 2D transformations (translation, rotation, scaling)  
- Matrix operations using `glMatrix.js`  
- Hierarchical modeling and object layering  
- Animation of multiple objects (e.g., windmill blades, moving boats)  
- Rendering modes toggle: `POINTS`, `LINE_LOOP`, `TRIANGLES`
  
### **Assignment 2 – Shading (Flat, Gouraud, Phong)**
**Goal:** Implement and compare three shading models in three separate viewports.  
**Concepts:**
- Flat, Gouraud, and Phong shading models  
- Multiple shader programs and switching  
- Mouse interaction for viewport-specific control  
- Light movement and zoom control using sliders

### **Assignment 3 – Reflection and Texture Mapping**
**Goal:** Build a 3D scene demonstrating texture mapping, environment reflection, and refraction.  
**Concepts:**
- Cubemap reflections on a teapot and sphere  
- Texture mapping on objects and transparent cubes  
- Skybox creation using six cubemap faces  
- Refraction using GLSL’s `refract()` function  
- Blended reflection + Phong illumination

### **Assignment 4 – Shadow Mapping with Rasterization**
**Goal:** Implement real-time shadows using two-pass shadow mapping.  
**Concepts:**
- Shadow map generation and depth comparison  
- Scene rendering with dynamic shadows  
- Interactive control: light position slider, animation checkbox  
- Camera orbit animation around the scene
  
### **Assignment 5 – Ray Tracing**
**Goal:** Implement a fragment-shader–based ray tracer for spheres with lighting, shadows, and reflections.  
**Concepts:**
- Ray-sphere intersection  
- Phong illumination model  
- Shadow and reflection rays  
- Recursive reflection using `reflect()` in GLSL  
- Multiple rendering modes:
  1. Phong only  
  2. Phong + Reflection  
  3. Phong + Shadow  
  4. Phong + Shadow + Reflection 
