// Ring shader and animation parameters from Aura's Remixed Resonance Hero preview.
const vertexShader = `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
precision highp float;

uniform float uTime, uAttenuation, uLineThickness;
uniform float uBaseRadius, uRadiusStep, uScaleRate;
uniform float uOpacity, uNoiseAmount, uRotation, uRingGap;
uniform float uFadeIn, uFadeOut;
uniform float uMouseInfluence, uHoverAmount, uHoverScale, uParallax, uBurst;
uniform vec2 uResolution, uMouse;
uniform vec3 uColor, uColorTwo;
uniform int uRingCount;

const float HP = 1.5707963;
const float CYCLE = 4.0;

float fade(float t) {
  return t < uFadeIn ? smoothstep(0.0, uFadeIn, t) : 1.0 - smoothstep(uFadeOut, CYCLE - 0.2, t);
}

float ring(vec2 p, float ri, float cut, float t0, float px) {
  float t = mod(uTime + t0, CYCLE);
  float r = ri + t / CYCLE * uScaleRate;
  float d = abs(length(p) - r);
  float a = atan(abs(p.y), abs(p.x)) / HP;
  float th = max(1.0 - a, 0.5) * px * uLineThickness;
  float h = (1.0 - smoothstep(th, th * 1.5, d)) + 1.0;
  d += pow(cut * a, 3.0) * r;
  return h * exp(-uAttenuation * d) * fade(t);
}

void main() {
  float px = 1.0 / min(uResolution.x, uResolution.y);
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution.xy) * px;

  // Asymmetrical offset for the new layout (shift center to right)
  p.x -= 0.15;

  float cr = cos(uRotation), sr = sin(uRotation);
  p = mat2(cr, -sr, sr, cr) * p;
  p -= uMouse * uMouseInfluence;
  float sc = mix(1.0, uHoverScale, uHoverAmount) + uBurst * 0.4;
  p /= sc;
  vec3 c = vec3(0.0);
  float rcf = max(float(uRingCount) - 1.0, 1.0);
  for (int i = 0; i < 10; i++) {
    if (i >= uRingCount) break;
    float fi = float(i);
    vec2 pr = p - fi * uParallax * uMouse;
    vec3 rc = mix(uColor, uColorTwo, fi / rcf);
    c = mix(c, rc, vec3(ring(pr, uBaseRadius + fi * uRadiusStep, pow(uRingGap, fi), i == 0 ? 0.0 : 3.1 * fi, px)));
  }
  c *= 1.0 + uBurst * 2.5;
  float n = fract(sin(dot(gl_FragCoord.xy + uTime * 100.0, vec2(12.9898, 78.233))) * 43758.5453);
  c += (n - 0.5) * uNoiseAmount;
  gl_FragColor = vec4(c, max(c.r, max(c.g, c.b)) * uOpacity);
}
`;

document.addEventListener('DOMContentLoaded', () => {
    const mount = document.getElementById('resonance-webgl');
    if (!mount || !window.THREE) return;

    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
        console.error("WebGL not supported");
        return;
    }

    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);
    mount.previousElementSibling.hidden = true;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10);
    camera.position.z = 1;

    // Updated colors and parameters for the remix
    const props = {
        color: '#10b981',     // Emerald
        colorTwo: '#0ea5e9',  // Sky Blue
        speed: 0.7,
        ringCount: 9,
        attenuation: 20,
        lineThickness: 2.75,
        baseRadius: 0.28,
        radiusStep: 0.16,
        scaleRate: 0.07,
        opacity: 0.85,
        noiseAmount: 0.008,
        rotation: -15, // Slight tilt
        ringGap: 1.8,
        fadeIn: 0.8,
        fadeOut: 0.6,
        followMouse: true,
        mouseInfluence: 0.15,
        hoverScale: 1.03,
        parallax: 0.03,
        clickBurst: true
    };

    const uniforms = {
        uTime: { value: 0 },
        uAttenuation: { value: props.attenuation },
        uResolution: { value: new THREE.Vector2() },
        uColor: { value: new THREE.Color(props.color) },
        uColorTwo: { value: new THREE.Color(props.colorTwo) },
        uLineThickness: { value: props.lineThickness },
        uBaseRadius: { value: props.baseRadius },
        uRadiusStep: { value: props.radiusStep },
        uScaleRate: { value: props.scaleRate },
        uRingCount: { value: props.ringCount },
        uOpacity: { value: props.opacity },
        uNoiseAmount: { value: props.noiseAmount },
        uRotation: { value: (props.rotation * Math.PI) / 180 },
        uRingGap: { value: props.ringGap },
        uFadeIn: { value: props.fadeIn },
        uFadeOut: { value: props.fadeOut },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uMouseInfluence: { value: props.followMouse ? props.mouseInfluence : 0 },
        uHoverAmount: { value: 0 },
        uHoverScale: { value: props.hoverScale },
        uParallax: { value: props.parallax },
        uBurst: { value: 0 },
    };

    const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    scene.add(quad);

    const resize = () => {
        const w = mount.clientWidth;
        const h = mount.clientHeight;
        const dpr = Math.min(window.devicePixelRatio, 2);
        renderer.setSize(w, h);
        renderer.setPixelRatio(dpr);
        uniforms.uResolution.value.set(w * dpr, h * dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    let targetMouse = [0, 0];
    let currentMouse = [0, 0];
    let targetHover = 0;
    let currentHover = 0;
    let currentBurst = 0;

    const onMouseMove = (e) => {
        const rect = mount.getBoundingClientRect();
        targetMouse[0] = (e.clientX - rect.left) / rect.width - 0.5;
        targetMouse[1] = -((e.clientY - rect.top) / rect.height - 0.5);
    };

    // Listen on body so it works behind text
    document.body.addEventListener('mousemove', onMouseMove);

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const animate = (t) => {
        if (!reducedMotion.matches) requestAnimationFrame(animate);

        currentMouse[0] += (targetMouse[0] - currentMouse[0]) * 0.05;
        currentMouse[1] += (targetMouse[1] - currentMouse[1]) * 0.05;
        currentHover += (targetHover - currentHover) * 0.08;
        currentBurst *= 0.93;
        if (currentBurst < 0.001) currentBurst = 0;

        uniforms.uTime.value = t * 0.001 * props.speed;
        uniforms.uMouse.value.set(currentMouse[0], currentMouse[1]);
        uniforms.uHoverAmount.value = currentHover;
        uniforms.uBurst.value = currentBurst;

        renderer.render(scene, camera);
    };
    requestAnimationFrame(animate);
});
