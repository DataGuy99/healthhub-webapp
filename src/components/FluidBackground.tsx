import { useEffect, useRef } from 'react';

export function FluidBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl');
    if (!gl) {
      console.warn('WebGL not supported');
      return;
    }

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    // Pastel colors
    const colors = [
      [0.95, 0.85, 0.95], // Lavender
      [0.85, 0.95, 0.95], // Mint
      [0.95, 0.90, 0.85], // Peach
      [0.85, 0.90, 0.95], // Sky blue
      [0.95, 0.85, 0.90], // Rose
    ];

    // Simple vertex shader
    const vsSource = `
      attribute vec4 aVertexPosition;
      void main() {
        gl_Position = aVertexPosition;
      }
    `;

    // Simple fragment shader for colored quads
    const fsSource = `
      precision mediump float;
      uniform vec3 uColor;
      uniform vec2 uResolution;
      void main() {
        vec2 uv = gl_FragCoord.xy / uResolution;
        float gradient = smoothstep(0.0, 1.0, length(uv - 0.5));
        gl_FragColor = vec4(uColor * (1.0 - gradient * 0.3), 0.8);
      }
    `;

    // Compile shader
    function createShader(type: number, source: string) {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vertexShader = createShader(gl.VERTEX_SHADER, vsSource);
    const fragmentShader = createShader(gl.FRAGMENT_SHADER, fsSource);

    if (!vertexShader || !fragmentShader) {
      console.error('Failed to create shaders');
      return;
    }

    // Create program
    const program = gl.createProgram();
    if (!program) return;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    // Create buffer
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = new Float32Array([
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
       1.0,  1.0,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const aVertexPosition = gl.getAttribLocation(program, 'aVertexPosition');
    gl.enableVertexAttribArray(aVertexPosition);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(aVertexPosition, 2, gl.FLOAT, false, 0, 0);

    const uColor = gl.getUniformLocation(program, 'uColor');
    const uResolution = gl.getUniformLocation(program, 'uResolution');

    // Animation
    let time = 0;
    let animationId = 0;

    function render() {
      time += 0.01;

      gl.viewport(0, 0, width, height);
      gl.clearColor(0.05, 0.05, 0.1, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.uniform2f(uResolution, width, height);

      // Draw multiple blobs
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      for (let i = 0; i < colors.length; i++) {
        const color = colors[i];
        gl.uniform3f(uColor, color[0], color[1], color[2]);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }

      animationId = requestAnimationFrame(render);
    }

    render();

    // Handle resize
    function handleResize() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }

    window.addEventListener('resize', handleResize);

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteBuffer(positionBuffer);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 w-full h-full -z-10" />;
}
