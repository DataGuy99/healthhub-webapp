import { useEffect, useRef } from 'react';

export function FluidBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
      console.warn('WebGL not supported');
      return;
    }

    // Pastel color palette for ambient flow
    const ambientColors = [
      [0.95, 0.85, 0.95], // Lavender
      [0.85, 0.95, 0.95], // Mint
      [0.95, 0.90, 0.85], // Peach
      [0.85, 0.90, 0.95], // Sky blue
      [0.95, 0.85, 0.90], // Rose
    ];

    // Light blue for touch ripples
    const touchColor = [0.7, 0.85, 0.95]; // Light blue

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const config = {
      SIM_RESOLUTION: 128,
      DYE_RESOLUTION: 1024,
      DENSITY_DISSIPATION: 0.98,
      VELOCITY_DISSIPATION: 0.99,
      PRESSURE: 0.6,
      CURL: 40,
      SPLAT_RADIUS: 0.3,
      AMBIENT_SPLAT_RADIUS: 0.4,
      TOUCH_SPLAT_RADIUS: 0.15,
      TOUCH_FORCE: 2000,
      SHADING: true,
    };

    // Shader sources
    const baseVertexShader = `
      precision highp float;
      attribute vec2 aPosition;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform vec2 texelSize;
      void main () {
        vUv = aPosition * 0.5 + 0.5;
        vL = vUv - vec2(texelSize.x, 0.0);
        vR = vUv + vec2(texelSize.x, 0.0);
        vT = vUv + vec2(0.0, texelSize.y);
        vB = vUv - vec2(0.0, texelSize.y);
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    const displayShader = `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D uTexture;
      uniform float brightness;
      void main () {
        vec3 C = texture2D(uTexture, vUv).rgb;
        float a = max(C.r, max(C.g, C.b));
        gl_FragColor = vec4(C * brightness, a);
      }
    `;

    const splatShader = `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D uTarget;
      uniform float aspectRatio;
      uniform vec3 color;
      uniform vec2 point;
      uniform float radius;
      void main () {
        vec2 p = vUv - point.xy;
        p.x *= aspectRatio;
        vec3 splat = exp(-dot(p, p) / radius) * color;
        vec3 base = texture2D(uTarget, vUv).xyz;
        gl_FragColor = vec4(base + splat, 1.0);
      }
    `;

    const advectionShader = `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D uVelocity;
      uniform sampler2D uSource;
      uniform vec2 texelSize;
      uniform float dt;
      uniform float dissipation;
      void main () {
        vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
        gl_FragColor = dissipation * texture2D(uSource, coord);
      }
    `;

    const divergenceShader = `
      precision highp float;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform sampler2D uVelocity;
      void main () {
        float L = texture2D(uVelocity, vL).x;
        float R = texture2D(uVelocity, vR).x;
        float T = texture2D(uVelocity, vT).y;
        float B = texture2D(uVelocity, vB).y;
        float div = 0.5 * (R - L + T - B);
        gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
      }
    `;

    const curlShader = `
      precision highp float;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform sampler2D uVelocity;
      void main () {
        float L = texture2D(uVelocity, vL).y;
        float R = texture2D(uVelocity, vR).y;
        float T = texture2D(uVelocity, vT).x;
        float B = texture2D(uVelocity, vB).x;
        float vorticity = R - L - T + B;
        gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
      }
    `;

    const vorticityShader = `
      precision highp float;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform sampler2D uVelocity;
      uniform sampler2D uCurl;
      uniform float curl;
      uniform float dt;
      void main () {
        float L = texture2D(uCurl, vL).x;
        float R = texture2D(uCurl, vR).x;
        float T = texture2D(uCurl, vT).x;
        float B = texture2D(uCurl, vB).x;
        float C = texture2D(uCurl, vUv).x;
        vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
        force /= length(force) + 0.0001;
        force *= curl * C;
        force.y *= -1.0;
        vec2 vel = texture2D(uVelocity, vUv).xy;
        gl_FragColor = vec4(vel + force * dt, 0.0, 1.0);
      }
    `;

    const pressureShader = `
      precision highp float;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform sampler2D uPressure;
      uniform sampler2D uDivergence;
      void main () {
        float L = texture2D(uPressure, vL).x;
        float R = texture2D(uPressure, vR).x;
        float T = texture2D(uPressure, vT).x;
        float B = texture2D(uPressure, vB).x;
        float C = texture2D(uPressure, vUv).x;
        float divergence = texture2D(uDivergence, vUv).x;
        float pressure = (L + R + B + T - divergence) * 0.25;
        gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
      }
    `;

    const gradientSubtractShader = `
      precision highp float;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform sampler2D uPressure;
      uniform sampler2D uVelocity;
      void main () {
        float L = texture2D(uPressure, vL).x;
        float R = texture2D(uPressure, vR).x;
        float T = texture2D(uPressure, vT).x;
        float B = texture2D(uPressure, vB).x;
        vec2 velocity = texture2D(uVelocity, vUv).xy;
        velocity.xy -= vec2(R - L, T - B);
        gl_FragColor = vec4(velocity, 0.0, 1.0);
      }
    `;

    function compileShader(type: number, source: string) {
      const shader = gl.createShader(type);
      if (!shader) {
        throw new Error('Failed to create shader');
      }
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compilation failed:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        throw new Error('Shader compilation failed');
      }
      return shader;
    }

    function createProgram(vertexShader: string, fragmentShader: string) {
      const program = gl.createProgram();
      if (!program) {
        throw new Error('Failed to create program');
      }
      gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexShader));
      gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentShader));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program linking failed:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        throw new Error('Program linking failed');
      }
      return program;
    }

    const programs: any = {
      display: createProgram(baseVertexShader, displayShader),
      splat: createProgram(baseVertexShader, splatShader),
      advection: createProgram(baseVertexShader, advectionShader),
      divergence: createProgram(baseVertexShader, divergenceShader),
      curl: createProgram(baseVertexShader, curlShader),
      vorticity: createProgram(baseVertexShader, vorticityShader),
      pressure: createProgram(baseVertexShader, pressureShader),
      gradientSubtract: createProgram(baseVertexShader, gradientSubtractShader),
    };

    function createFBO(w: number, h: number, type: number) {
      const texture = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, type, null);

      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT);

      return { texture, fbo, width: w, height: h };
    }

    function createDoubleFBO(w: number, h: number, type: number) {
      let fbo1 = createFBO(w, h, type);
      let fbo2 = createFBO(w, h, type);
      return {
        get read() { return fbo1; },
        get write() { return fbo2; },
        swap() { const temp = fbo1; fbo1 = fbo2; fbo2 = temp; }
      };
    }

    // Check for float texture support
    const floatExtension = gl.getExtension('OES_texture_float');
    const floatType = floatExtension ? gl.FLOAT : gl.UNSIGNED_BYTE;

    const simRes = config.SIM_RESOLUTION;
    const dyeRes = config.DYE_RESOLUTION;

    const velocity = createDoubleFBO(simRes, simRes, floatType);
    const density = createDoubleFBO(dyeRes, dyeRes, floatType);
    const pressure = createDoubleFBO(simRes, simRes, floatType);
    const divergence = createFBO(simRes, simRes, floatType);
    const curl = createFBO(simRes, simRes, floatType);

    const blit = (() => {
      const buffer = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      return (destination: any) => {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);
        if (destination == null) {
          gl.viewport(0, 0, width, height);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        } else {
          gl.viewport(0, 0, destination.width, destination.height);
          gl.bindFramebuffer(gl.FRAMEBUFFER, destination.fbo);
        }
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
      };
    })();

    let lastTime = Date.now();
    const pointers: any[] = [];
    pointers.push({ id: -1, x: 0, y: 0, dx: 0, dy: 0, down: false, moved: false, color: [1, 1, 1] });

    function splat(x: number, y: number, dx: number, dy: number, color: number[]) {
      gl.useProgram(programs.splat);
      gl.uniform1i(gl.getUniformLocation(programs.splat, 'uTarget'), density.read.texture);
      gl.uniform1f(gl.getUniformLocation(programs.splat, 'aspectRatio'), width / height);
      gl.uniform2f(gl.getUniformLocation(programs.splat, 'point'), x / width, 1.0 - y / height);
      gl.uniform3f(gl.getUniformLocation(programs.splat, 'color'), color[0], color[1], color[2]);
      gl.uniform1f(gl.getUniformLocation(programs.splat, 'radius'), config.SPLAT_RADIUS / 100.0);
      blit(density.write);
      density.swap();

      gl.uniform1i(gl.getUniformLocation(programs.splat, 'uTarget'), velocity.read.texture);
      gl.uniform3f(gl.getUniformLocation(programs.splat, 'color'), dx, -dy, 1.0);
      blit(velocity.write);
      velocity.swap();
    }

    let animationId: number;

    function update() {
      const dt = Math.min((Date.now() - lastTime) / 1000, 0.016);
      lastTime = Date.now();

      gl.useProgram(programs.curl);
      gl.uniform2f(gl.getUniformLocation(programs.curl, 'texelSize'), 1.0 / simRes, 1.0 / simRes);
      gl.uniform1i(gl.getUniformLocation(programs.curl, 'uVelocity'), velocity.read.texture);
      blit(curl);

      gl.useProgram(programs.vorticity);
      gl.uniform2f(gl.getUniformLocation(programs.vorticity, 'texelSize'), 1.0 / simRes, 1.0 / simRes);
      gl.uniform1i(gl.getUniformLocation(programs.vorticity, 'uVelocity'), velocity.read.texture);
      gl.uniform1i(gl.getUniformLocation(programs.vorticity, 'uCurl'), curl.texture);
      gl.uniform1f(gl.getUniformLocation(programs.vorticity, 'curl'), config.CURL);
      gl.uniform1f(gl.getUniformLocation(programs.vorticity, 'dt'), dt);
      blit(velocity.write);
      velocity.swap();

      gl.useProgram(programs.divergence);
      gl.uniform2f(gl.getUniformLocation(programs.divergence, 'texelSize'), 1.0 / simRes, 1.0 / simRes);
      gl.uniform1i(gl.getUniformLocation(programs.divergence, 'uVelocity'), velocity.read.texture);
      blit(divergence);

      gl.useProgram(programs.pressure);
      gl.uniform2f(gl.getUniformLocation(programs.pressure, 'texelSize'), 1.0 / simRes, 1.0 / simRes);
      gl.uniform1i(gl.getUniformLocation(programs.pressure, 'uDivergence'), divergence.texture);
      for (let i = 0; i < 20; i++) {
        gl.uniform1i(gl.getUniformLocation(programs.pressure, 'uPressure'), pressure.read.texture);
        blit(pressure.write);
        pressure.swap();
      }

      gl.useProgram(programs.gradientSubtract);
      gl.uniform2f(gl.getUniformLocation(programs.gradientSubtract, 'texelSize'), 1.0 / simRes, 1.0 / simRes);
      gl.uniform1i(gl.getUniformLocation(programs.gradientSubtract, 'uPressure'), pressure.read.texture);
      gl.uniform1i(gl.getUniformLocation(programs.gradientSubtract, 'uVelocity'), velocity.read.texture);
      blit(velocity.write);
      velocity.swap();

      gl.useProgram(programs.advection);
      gl.uniform2f(gl.getUniformLocation(programs.advection, 'texelSize'), 1.0 / simRes, 1.0 / simRes);
      gl.uniform1i(gl.getUniformLocation(programs.advection, 'uVelocity'), velocity.read.texture);
      gl.uniform1i(gl.getUniformLocation(programs.advection, 'uSource'), velocity.read.texture);
      gl.uniform1f(gl.getUniformLocation(programs.advection, 'dt'), dt);
      gl.uniform1f(gl.getUniformLocation(programs.advection, 'dissipation'), config.VELOCITY_DISSIPATION);
      blit(velocity.write);
      velocity.swap();

      gl.uniform2f(gl.getUniformLocation(programs.advection, 'texelSize'), 1.0 / dyeRes, 1.0 / dyeRes);
      gl.uniform1i(gl.getUniformLocation(programs.advection, 'uVelocity'), velocity.read.texture);
      gl.uniform1i(gl.getUniformLocation(programs.advection, 'uSource'), density.read.texture);
      gl.uniform1f(gl.getUniformLocation(programs.advection, 'dissipation'), config.DENSITY_DISSIPATION);
      blit(density.write);
      density.swap();

      gl.useProgram(programs.display);
      gl.uniform1i(gl.getUniformLocation(programs.display, 'uTexture'), density.read.texture);
      gl.uniform1f(gl.getUniformLocation(programs.display, 'brightness'), 1.2);
      blit(null);

      animationId = requestAnimationFrame(update);
    }

    // Ambient flow - slower, more graceful splats
    const ambientInterval = setInterval(() => {
      const color = ambientColors[Math.floor(Math.random() * ambientColors.length)];
      const x = Math.random() * width;
      const y = Math.random() * height;
      const dx = (Math.random() - 0.5) * 15;
      const dy = (Math.random() - 0.5) * 15;

      gl.useProgram(programs.splat);
      gl.uniform1i(gl.getUniformLocation(programs.splat, 'uTarget'), density.read.texture);
      gl.uniform1f(gl.getUniformLocation(programs.splat, 'aspectRatio'), width / height);
      gl.uniform2f(gl.getUniformLocation(programs.splat, 'point'), x / width, 1.0 - y / height);
      gl.uniform3f(gl.getUniformLocation(programs.splat, 'color'), color[0], color[1], color[2]);
      gl.uniform1f(gl.getUniformLocation(programs.splat, 'radius'), config.AMBIENT_SPLAT_RADIUS);
      blit(density.write);
      density.swap();

      gl.uniform1i(gl.getUniformLocation(programs.splat, 'uTarget'), velocity.read.texture);
      gl.uniform3f(gl.getUniformLocation(programs.splat, 'color'), dx, -dy, 1.0);
      blit(velocity.write);
      velocity.swap();
    }, 400);

    // Touch/Click handler - light blue ripples
    const handlePointer = (e: MouseEvent | TouchEvent) => {
      let x: number, y: number;
      if (e instanceof MouseEvent) {
        x = e.clientX;
        y = e.clientY;
      } else {
        if (e.touches.length === 0) return;
        x = e.touches[0].clientX;
        y = e.touches[0].clientY;
      }

      gl.useProgram(programs.splat);
      gl.uniform1i(gl.getUniformLocation(programs.splat, 'uTarget'), density.read.texture);
      gl.uniform1f(gl.getUniformLocation(programs.splat, 'aspectRatio'), width / height);
      gl.uniform2f(gl.getUniformLocation(programs.splat, 'point'), x / width, 1.0 - y / height);
      gl.uniform3f(gl.getUniformLocation(programs.splat, 'color'), touchColor[0], touchColor[1], touchColor[2]);
      gl.uniform1f(gl.getUniformLocation(programs.splat, 'radius'), config.TOUCH_SPLAT_RADIUS);
      blit(density.write);
      density.swap();

      // Small velocity for subtle ripple
      gl.uniform1i(gl.getUniformLocation(programs.splat, 'uTarget'), velocity.read.texture);
      gl.uniform3f(gl.getUniformLocation(programs.splat, 'color'), 0, 0, 1.0);
      blit(velocity.write);
      velocity.swap();
    };

    canvas.addEventListener('click', handlePointer);
    canvas.addEventListener('touchstart', handlePointer);

    update();

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      clearInterval(ambientInterval);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('click', handlePointer);
      canvas.removeEventListener('touchstart', handlePointer);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full -z-10"
      style={{ background: '#fafafa' }}
    />
  );
}
