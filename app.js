/* ==========================================================================
   NEXUS // QUANTUM COSMIC CUBE ENGINE - CORE JAVASCRIPT
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------------------------------
    // 1. GLOBAL STATE & THEME PRESETS
    // ----------------------------------------------------------------------
    const state = {
        theme: 'blue',
        rotationSpeed: 1.0,
        turbulence: 1.5,
        bloomStrength: 1.8,
        coreBrightness: 2.0,
        wireframe: false,
        particles: true,
        autoRotate: false,
        audioActive: false,
        pulseActive: false,
        pulseProgress: 0.0
    };

    const themes = {
        blue: {
            primary: new THREE.Color(0x00d2ff),
            secondary: new THREE.Color(0x0055ff),
            core: new THREE.Color(0xffffff),
            deep: new THREE.Color(0x001133),
            glowHex: '#00d2ff'
        },
        purple: {
            primary: new THREE.Color(0xa855f7),
            secondary: new THREE.Color(0x6366f1),
            core: new THREE.Color(0xfff0ff),
            deep: new THREE.Color(0x2e0854),
            glowHex: '#a855f7'
        },
        neon: {
            primary: new THREE.Color(0x00ffaa),
            secondary: new THREE.Color(0x0088ff),
            core: new THREE.Color(0xe0ffff),
            deep: new THREE.Color(0x003322),
            glowHex: '#00ffaa'
        },
        gold: {
            primary: new THREE.Color(0xffaa00),
            secondary: new THREE.Color(0xff3300),
            core: new THREE.Color(0xffffff),
            deep: new THREE.Color(0x441100),
            glowHex: '#ffaa00'
        }
    };

    // ----------------------------------------------------------------------
    // 2. THREE.JS SCENE SETUP & ENGINE INITIALIZATION
    // ----------------------------------------------------------------------
    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030611, 0.08);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 8.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    // Controls
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    controls.maxDistance = 15;
    controls.minDistance = 3.5;
    controls.autoRotate = false;
    controls.autoRotateSpeed = 1.5;

    // Post-Processing (UnrealBloomPass)
    const renderScene = new THREE.RenderPass(scene, camera);
    const bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.5,
        0.5,
        0.12
    );

    const composer = new THREE.EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // ----------------------------------------------------------------------
    // 3. STAGE 1: GLSL SHADER MATERIAL FOR COSMIC ENERGY CUBE
    // ----------------------------------------------------------------------
    const vertexShader = `
        varying vec3 vNormal;
        varying vec3 vLocalPosition;
        varying vec3 vWorldPosition;
        varying vec2 vUv;
        varying vec3 vViewPosition;

        void main() {
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);
            vLocalPosition = position;
            
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPos.xyz;
            
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vViewPosition = -mvPosition.xyz;

            gl_Position = projectionMatrix * mvPosition;
        }
    `;

    const fragmentShader = `
        uniform float uTime;
        uniform vec3 uColorPrimary;
        uniform vec3 uColorSecondary;
        uniform vec3 uColorCore;
        uniform vec3 uColorDeep;
        uniform float uTurbulence;
        uniform float uCoreBrightness;
        uniform float uPulseProgress;

        varying vec3 vNormal;
        varying vec3 vLocalPosition;
        varying vec3 vWorldPosition;
        varying vec2 vUv;
        varying vec3 vViewPosition;

        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

        float snoise(vec3 v) {
            const vec2 C = vec2(1.0/6.0, 1.0/3.0);
            const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

            vec3 i  = floor(v + dot(v, C.yyy) );
            vec3 x0 = v - i + dot(i, C.xxx) ;

            vec3 g = step(x0.yzx, x0.xyz);
            vec3 l = 1.0 - g;
            vec3 i1 = min( g.xyz, l.zxy );
            vec3 i2 = max( g.xyz, l.zxy );

            vec3 x1 = x0 - i1 + C.xxx;
            vec3 x2 = x0 - i2 + C.yyy;
            vec3 x3 = x0 - D.yyy;

            i = mod289(i); 
            vec4 p = permute( permute( permute( 
                        i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                    + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
                    + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

            float n_ = 0.142857142857;
            vec3  ns = n_ * D.wyz - D.xzx;

            vec4 j = p - 49.0 * floor(p * ns.z);

            vec4 x_ = floor(j * ns.z);
            vec4 y_ = floor(j - 7.0 * x_ );

            vec4 x = x_ *ns.x + ns.yyyy;
            vec4 y = y_ *ns.x + ns.yyyy;
            vec4 h = 1.0 - abs(x) - abs(y);

            vec4 b0 = vec4( x.xy, y.xy );
            vec4 b1 = vec4( x.zw, y.zw );

            vec4 s0 = floor(b0)*2.0 + 1.0;
            vec4 s1 = floor(b1)*2.0 + 1.0;
            vec4 sh = -step(h, vec4(0.0));

            vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
            vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

            vec3 p0 = vec3(a0.xy,h.x);
            vec3 p1 = vec3(a0.zw,h.y);
            vec3 p2 = vec3(a1.xy,h.z);
            vec3 p3 = vec3(a1.zw,h.w);

            vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
            p0 *= norm.x;
            p1 *= norm.y;
            p2 *= norm.z;
            p3 *= norm.w;

            vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
            m = m * m;
            return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
        }

        void main() {
            vec3 norm = normalize(vNormal);
            vec3 viewDir = normalize(vViewPosition);

            float fresnel = pow(1.0 - clamp(dot(norm, viewDir), 0.0, 1.0), 2.5);
            float distFromCenter = length(vLocalPosition);
            float coreGradient = smoothstep(1.5, 0.0, distFromCenter);

            vec3 noisePos1 = vLocalPosition * (2.2 * uTurbulence) + vec3(uTime * 0.4, uTime * 0.3, uTime * 0.5);
            float n1 = snoise(noisePos1);

            vec3 noisePos2 = vLocalPosition * (4.5 * uTurbulence) - vec3(uTime * 0.6, uTime * 0.2, uTime * 0.7);
            float n2 = snoise(noisePos2);

            float combinedNoise = (n1 * 0.65 + n2 * 0.35);
            float plasmaIntensity = clamp(combinedNoise * 0.5 + 0.5, 0.0, 1.0);

            float pulseWave = 0.0;
            if (uPulseProgress > 0.0) {
                float waveDist = abs(distFromCenter - (uPulseProgress * 2.2));
                pulseWave = smoothstep(0.35, 0.0, waveDist) * (1.0 - uPulseProgress);
            }

            vec3 baseColor = mix(uColorDeep, uColorSecondary, plasmaIntensity);
            vec3 plasmaColor = mix(baseColor, uColorPrimary, pow(plasmaIntensity, 1.8));

            float coreIntensity = pow(coreGradient, 3.0) * uCoreBrightness;
            vec3 finalCoreColor = mix(plasmaColor, uColorCore, coreIntensity);

            vec3 finalColor = finalCoreColor + (uColorPrimary * fresnel * 2.2) + (uColorCore * pulseWave * 3.5);
            float alpha = clamp(0.7 + fresnel * 0.3 + coreIntensity * 0.2, 0.8, 0.98);

            gl_FragColor = vec4(finalColor, alpha);
        }
    `;

    const uniforms = {
        uTime: { value: 0 },
        uColorPrimary: { value: themes.blue.primary },
        uColorSecondary: { value: themes.blue.secondary },
        uColorCore: { value: themes.blue.core },
        uColorDeep: { value: themes.blue.deep },
        uTurbulence: { value: state.turbulence },
        uCoreBrightness: { value: state.coreBrightness },
        uPulseProgress: { value: 0.0 }
    };

    const cubeGeometry = new THREE.BoxGeometry(1.8, 1.8, 1.8, 48, 48, 48);
    const cubeMaterial = new THREE.ShaderMaterial({
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        uniforms: uniforms,
        transparent: true,
        side: THREE.DoubleSide
    });

    const initialX = 0;
    const energyCube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    energyCube.position.set(0, 0, 0);
    scene.add(energyCube);

    const coreGeometry = new THREE.SphereGeometry(0.55, 32, 32);
    const coreMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95
    });
    const innerCore = new THREE.Mesh(coreGeometry, coreMaterial);
    energyCube.add(innerCore);

    const coreLight = new THREE.PointLight(0x00d2ff, 6.0, 12);
    energyCube.add(coreLight);

    const wireframeGeometry = new THREE.BoxGeometry(1.84, 1.84, 1.84, 12, 12, 12);
    const wireframeMaterial = new THREE.MeshBasicMaterial({
        color: 0x00d2ff,
        wireframe: true,
        transparent: true,
        opacity: 0.15
    });
    const wireframeCube = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
    wireframeCube.visible = false;
    energyCube.add(wireframeCube);

    // ----------------------------------------------------------------------
    // 3B. STAGE 2: CYBER QUANTUM GEODESIC LATTICE SPHERE & CONNECTOR HUBS
    // ----------------------------------------------------------------------
    const latticeSphereGroup = new THREE.Group();
    latticeSphereGroup.position.set(0, 0, 0);
    latticeSphereGroup.visible = false;
    scene.add(latticeSphereGroup);

    const geoIcoGeometry = new THREE.IcosahedronGeometry(1.5, 3);
    const wireframeLinesGeo = new THREE.WireframeGeometry(geoIcoGeometry);
    const lineMat = new THREE.LineBasicMaterial({
        color: 0x00d2ff,
        transparent: true,
        opacity: 0.75,
        linewidth: 1.5
    });
    const geodesicWireframe = new THREE.LineSegments(wireframeLinesGeo, lineMat);
    latticeSphereGroup.add(geodesicWireframe);

    const icoVertices = geoIcoGeometry.attributes.position.array;
    const vertexNodeGeo = new THREE.BufferGeometry();
    vertexNodeGeo.setAttribute('position', new THREE.BufferAttribute(icoVertices, 3));
    
    const vertexNodeMat = new THREE.PointsMaterial({
        color: 0x00ffff,
        size: 0.14,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending
    });
    const vertexNodes = new THREE.Points(vertexNodeGeo, vertexNodeMat);
    latticeSphereGroup.add(vertexNodes);

    const cyanCoreGeo = new THREE.SphereGeometry(0.55, 32, 32);
    const cyanCoreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95
    });
    const cyanCore = new THREE.Mesh(cyanCoreGeo, cyanCoreMat);
    latticeSphereGroup.add(cyanCore);

    const cyanCoreLight = new THREE.PointLight(0x00d2ff, 8.0, 15);
    latticeSphereGroup.add(cyanCoreLight);

    const netPartCount = 350;
    const netPartGeo = new THREE.BufferGeometry();
    const netPartPos = new Float32Array(netPartCount * 3);
    for(let i = 0; i < netPartCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 2.2 + Math.random() * 1.5;
        netPartPos[i * 3] = Math.cos(angle) * radius;
        netPartPos[i * 3 + 1] = (Math.random() - 0.5) * 1.0;
        netPartPos[i * 3 + 2] = Math.sin(angle) * radius;
    }
    netPartGeo.setAttribute('position', new THREE.BufferAttribute(netPartPos, 3));
    const netPartMat = new THREE.PointsMaterial({
        color: 0x00ffff,
        size: 0.07,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });
    const netParticleRing = new THREE.Points(netPartGeo, netPartMat);
    latticeSphereGroup.add(netParticleRing);

    // ----------------------------------------------------------------------
    // 3B-2. 3D VOLUMETRIC ELECTRIC PLASMA LIGHTNING AURA VORTEX (FINALE EFFECT)
    // (Inspired by Pinterest Lightning Plasma Aura Supernova)
    // ----------------------------------------------------------------------
    const electricAuraGroup = new THREE.Group();
    electricAuraGroup.position.set(0, 0, 0);
    scene.add(electricAuraGroup);

    // 1. Central Hyper-Luminous Singularity Core
    const auraCoreGeo = new THREE.SphereGeometry(0.7, 32, 32);
    const auraCoreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95
    });
    const auraCore = new THREE.Mesh(auraCoreGeo, auraCoreMat);
    electricAuraGroup.add(auraCore);

    const auraInnerGlowGeo = new THREE.SphereGeometry(1.2, 32, 32);
    const auraInnerGlowMat = new THREE.MeshBasicMaterial({
        color: 0x00d2ff,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending
    });
    const auraInnerGlow = new THREE.Mesh(auraInnerGlowGeo, auraInnerGlowMat);
    electricAuraGroup.add(auraInnerGlow);

    // 2. Procedural Electric Lightning Tendrils
    const lightningCount = 20;
    const lightningLines = [];

    for (let i = 0; i < lightningCount; i++) {
        const points = [];
        const numSegments = 14;
        const baseRadius = 0.8;
        const maxRadius = 3.2 + Math.random() * 1.5;
        const theta = (i / lightningCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
        const phi = (Math.random() - 0.5) * Math.PI * 0.8;

        for (let j = 0; j <= numSegments; j++) {
            const frac = j / numSegments;
            const r = baseRadius + frac * (maxRadius - baseRadius);
            // Add jagged electrical displacement
            const jitter = frac > 0 && frac < 1 ? (Math.random() - 0.5) * 0.45 : 0;
            const px = Math.cos(theta) * Math.cos(phi) * r + jitter;
            const py = Math.sin(phi) * r + jitter;
            const pz = Math.sin(theta) * Math.cos(phi) * r + jitter;
            points.push(new THREE.Vector3(px, py, pz));
        }

        const lGeo = new THREE.BufferGeometry().setFromPoints(points);
        const lMat = new THREE.LineBasicMaterial({
            color: (i % 2 === 0) ? 0x00ffff : 0x70f0ff,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending
        });
        const lLine = new THREE.Line(lGeo, lMat);
        electricAuraGroup.add(lLine);
        lightningLines.push({
            mesh: lLine,
            basePoints: points,
            speed: 0.8 + Math.random() * 1.2
        });
    }

    // 3. Shockwave Plasma Rings
    const auraRingGeo1 = new THREE.RingGeometry(1.5, 1.8, 64);
    const auraRingMat1 = new THREE.MeshBasicMaterial({
        color: 0x00d2ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending
    });
    const auraRing1 = new THREE.Mesh(auraRingGeo1, auraRingMat1);
    electricAuraGroup.add(auraRing1);

    const auraRingGeo2 = new THREE.RingGeometry(2.4, 2.7, 64);
    const auraRingMat2 = new THREE.MeshBasicMaterial({
        color: 0x00ffaa,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending
    });
    const auraRing2 = new THREE.Mesh(auraRingGeo2, auraRingMat2);
    electricAuraGroup.add(auraRing2);

    // 4. Electric Swirling Embers
    const emberCount = 350;
    const emberGeo = new THREE.BufferGeometry();
    const emberPos = new Float32Array(emberCount * 3);
    const emberAngles = [];

    for (let i = 0; i < emberCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const rad = 1.0 + Math.random() * 3.5;
        const h = (Math.random() - 0.5) * 3.0;
        emberPos[i * 3] = Math.cos(angle) * rad;
        emberPos[i * 3 + 1] = h;
        emberPos[i * 3 + 2] = Math.sin(angle) * rad;
        emberAngles.push({ angle: angle, rad: rad, speed: 0.5 + Math.random() * 1.5, vy: (Math.random() - 0.5) * 0.4 });
    }

    emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
    const emberMat = new THREE.PointsMaterial({
        color: 0x70f0ff,
        size: 0.09,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending
    });
    const emberParticles = new THREE.Points(emberGeo, emberMat);
    electricAuraGroup.add(emberParticles);

    // ----------------------------------------------------------------------
    // 3C. INTERACTIVE 3D ORBIT CONNECTOR HUBS (SELECTABLE NAVIGATION NODES)
    // ----------------------------------------------------------------------
    const connectorOverlay = document.getElementById('orbit-connector-overlay');
    const connectorNodesData = [
        {
            id: 'node-home',
            code: 'PAGE 01',
            title: 'HOME',
            desc: '3D Cosmic Energy Core',
            target: 'home',
            color: '#00d2ff',
            settledX: 0.18,
            settledY: 0.30,
            vec: new THREE.Vector3(-1.1, 0.65, 0.9).normalize().multiplyScalar(1.55)
        },
        {
            id: 'node-about',
            code: 'PAGE 02',
            title: 'ABOUT US',
            desc: 'Quantum Neural Geodesic',
            target: 'about',
            color: '#00ffaa',
            settledX: 0.50,
            settledY: 0.20,
            vec: new THREE.Vector3(0.0, 1.35, 0.95).normalize().multiplyScalar(1.55)
        },
        {
            id: 'node-work',
            code: 'PAGE 03',
            title: 'OUR WORK',
            desc: 'Selected 3D Productions',
            target: 'work',
            color: '#38bdf8',
            settledX: 0.82,
            settledY: 0.30,
            vec: new THREE.Vector3(1.1, 0.65, 0.9).normalize().multiplyScalar(1.55)
        },
        {
            id: 'node-pricing',
            code: 'PAGE 04',
            title: 'PRICING',
            desc: 'Transparent Scale Tiers',
            target: 'pricing',
            color: '#fbbf24',
            settledX: 0.22,
            settledY: 0.72,
            vec: new THREE.Vector3(-1.05, -0.75, 0.95).normalize().multiplyScalar(1.55)
        },
        {
            id: 'node-contact',
            code: 'PAGE 05',
            title: 'CONTACT US',
            desc: 'Direct Quantum Portal',
            target: 'contact',
            color: '#c084fc',
            settledX: 0.78,
            settledY: 0.72,
            vec: new THREE.Vector3(1.05, -0.75, 0.95).normalize().multiplyScalar(1.55)
        }
    ];

    const interactiveNodeMeshes = [];
    const interactivePins = [];

    connectorNodesData.forEach((item) => {
        const nodeColorHex = parseInt(item.color.replace('#', '0x'), 16);

        // 3D Anchor Orb
        const nodeOrbGeo = new THREE.SphereGeometry(0.1, 16, 16);
        const nodeOrbMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.95
        });
        const nodeOrb = new THREE.Mesh(nodeOrbGeo, nodeOrbMat);
        nodeOrb.position.copy(item.vec);
        latticeSphereGroup.add(nodeOrb);

        // Outer Radar Ring
        const ringGeo = new THREE.RingGeometry(0.14, 0.2, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: nodeColorHex,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.position.copy(item.vec);
        ringMesh.lookAt(0, 0, 0);
        latticeSphereGroup.add(ringMesh);

        // Laser Beacon line to core (0,0,0)
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            item.vec
        ]);
        const lineBeamMat = new THREE.LineBasicMaterial({
            color: nodeColorHex,
            transparent: true,
            opacity: 0.45
        });
        const beamLine = new THREE.Line(lineGeo, lineBeamMat);
        latticeSphereGroup.add(beamLine);

        // Create HTML Pin Element in Overlay
        const pinEl = document.createElement('div');
        pinEl.className = 'connector-pin';
        pinEl.dataset.target = item.target;
        pinEl.style.setProperty('--node-color', item.color);
        pinEl.innerHTML = `
            <div class="pin-anchor-ring"></div>
            <div class="pin-card">
                <div class="pin-header">
                    <span class="pin-code">${item.code}</span>
                    <span class="pin-status">ONLINE</span>
                </div>
                <div class="pin-title">${item.title}</div>
                <div class="pin-desc">${item.desc}</div>
                <div class="pin-action">
                    <span>OPEN PAGE</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
            </div>
        `;

        if (connectorOverlay) {
            connectorOverlay.appendChild(pinEl);
        }

        // Click Handler for Pin -> Opens respective page
        pinEl.addEventListener('click', () => {
            openPage(item.target);
        });

        // Hover animations
        pinEl.addEventListener('mouseenter', () => {
            nodeOrb.scale.setScalar(1.5);
            ringMesh.scale.setScalar(1.4);
            lineBeamMat.opacity = 0.9;
        });
        pinEl.addEventListener('mouseleave', () => {
            nodeOrb.scale.setScalar(1.0);
            ringMesh.scale.setScalar(1.0);
            lineBeamMat.opacity = 0.45;
        });

        interactiveNodeMeshes.push({
            data: item,
            orb: nodeOrb,
            ring: ringMesh,
            beam: lineBeamMat,
            pinEl: pinEl
        });
        interactivePins.push(pinEl);
    });

    // ----------------------------------------------------------------------
    // 3D. HOLOGRAPHIC FULL-SCREEN PAGE SYSTEM
    // ----------------------------------------------------------------------
    function openPage(pageKey) {
        document.querySelectorAll('.nav-stone-item').forEach(item => {
            if (item.getAttribute('href') === `#${pageKey}`) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        if (pageKey === 'home') {
            closeAllPages();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        const pageEl = document.getElementById(`page-${pageKey}`);
        if (!pageEl) return;

        closeAllPages();
        triggerSoundPulse();
        state.pulseActive = true;
        state.pulseProgress = 0.0;

        const warpNotif = document.getElementById('warp-notification');
        const warpDest = document.getElementById('warp-dest-name');
        if (warpNotif && warpDest) {
            warpDest.textContent = `PAGE: ${pageKey.toUpperCase().replace('-', ' ')}`;
            warpNotif.classList.add('active');
            setTimeout(() => warpNotif.classList.remove('active'), 2000);
        }

        setTimeout(() => {
            pageEl.classList.add('active');
            if (window.lucide) lucide.createIcons();
        }, 120);
        
        logConsole("WARP", `Quantum holographic portal opened for: ${pageKey.toUpperCase()}`, "success");
    }

    function closeAllPages() {
        document.querySelectorAll('.quantum-page-overlay').forEach(el => {
            el.classList.remove('active');
        });
    }

    // Attach click handlers to close buttons and open-page buttons
    document.querySelectorAll('[data-close-page]').forEach(btn => {
        btn.addEventListener('click', closeAllPages);
    });

    // Delegated click handler for all [data-open-page] elements (desktop & mobile carousel)
    document.addEventListener('click', (e) => {
        const targetBtn = e.target.closest('[data-open-page]');
        if (targetBtn) {
            e.preventDefault();
            const target = targetBtn.getAttribute('data-open-page');
            if (target) openPage(target);
        }
    });

    // Close on ESC key
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAllPages();
    });

    // Close on background overlay click
    document.querySelectorAll('.quantum-page-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeAllPages();
        });
    });

    // Navigation links routing
    document.querySelectorAll('.nav-links a, #cta-connect').forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href && href.startsWith('#')) {
                e.preventDefault();
                const targetKey = href.replace('#', '');
                openPage(targetKey);
            }
        });
    });

    // ----------------------------------------------------------------------
    // 3E. REAL 3D WEBGL COSMIC INFINITY STONES GENERATOR (FOR NAVBAR MENU)
    // ----------------------------------------------------------------------
    const stoneConfigs = [
        { id: 'canvas-stone-home', color: 0x00d2ff, emissive: 0x0044cc, speedX: 0.012, speedY: 0.018, seed: 1 },
        { id: 'canvas-stone-about', color: 0x00ff88, emissive: 0x007722, speedX: -0.015, speedY: 0.014, seed: 2 },
        { id: 'canvas-stone-work', color: 0xc084fc, emissive: 0x6d28d9, speedX: 0.013, speedY: -0.016, seed: 3 },
        { id: 'canvas-stone-pricing', color: 0xfbbf24, emissive: 0xb45309, speedX: -0.014, speedY: 0.019, seed: 4 },
        { id: 'canvas-stone-contact', color: 0xff3b69, emissive: 0xbe123c, speedX: 0.016, speedY: 0.015, seed: 5 }
    ];

    const stoneInstances = [];

    stoneConfigs.forEach(cfg => {
        const canvas = document.getElementById(cfg.id);
        if (!canvas) return;

        const sRenderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        sRenderer.setSize(70, 70);
        sRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        const sScene = new THREE.Scene();
        const sCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 10);
        sCamera.position.z = 2.8;

        // Custom Irregular 3D Mineral Stone Geometry (Randomized Crystal Facets)
        const sGeo = new THREE.DodecahedronGeometry(0.58, 1);
        const pos = sGeo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const vx = pos.getX(i);
            const vy = pos.getY(i);
            const vz = pos.getZ(i);
            const noise = Math.sin(vx * 3.0 + vy * 4.0 + cfg.seed * 5.0) * 0.18 + 
                          Math.cos(vy * 3.0 + vz * 2.0 + cfg.seed) * 0.15;
            pos.setXYZ(i, vx * (1.0 + noise), vy * (1.0 + noise), vz * (1.0 + noise));
        }
        sGeo.computeVertexNormals();

        // Faceted Gem Material with Glass Refraction & Specular Highlights
        const sMat = new THREE.MeshStandardMaterial({
            color: cfg.color,
            emissive: cfg.emissive,
            emissiveIntensity: 0.65,
            roughness: 0.15,
            metalness: 0.25,
            flatShading: true
        });

        const stoneMesh = new THREE.Mesh(sGeo, sMat);
        sScene.add(stoneMesh);

        // Inner glowing white core
        const coreGeo = new THREE.IcosahedronGeometry(0.32, 0);
        const coreMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.95
        });
        const coreMesh = new THREE.Mesh(coreGeo, coreMat);
        stoneMesh.add(coreMesh);

        // Lighting for dramatic crystal specular glints
        const ambLight = new THREE.AmbientLight(0xffffff, 0.9);
        sScene.add(ambLight);

        const pLight1 = new THREE.PointLight(cfg.color, 3.0, 6);
        pLight1.position.set(1.5, 2.0, 2.0);
        sScene.add(pLight1);

        const pLight2 = new THREE.PointLight(0xffffff, 2.2, 6);
        pLight2.position.set(-2.0, -1.5, 1.5);
        sScene.add(pLight2);

        stoneInstances.push({
            renderer: sRenderer,
            scene: sScene,
            camera: sCamera,
            mesh: stoneMesh,
            core: coreMesh,
            speedX: cfg.speedX,
            speedY: cfg.speedY,
            canvas: canvas
        });
    });

    // ----------------------------------------------------------------------
    // 4. QUANTUM FIELD AMBIENT PARTICLES
    // ----------------------------------------------------------------------
    const particleCount = 250;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
        particlePositions[i * 3] = (Math.random() - 0.5) * 14;
        particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 14;
        particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 14;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleMaterial = new THREE.PointsMaterial({
        color: 0x00d2ff,
        size: 0.08,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending
    });

    const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particleSystem);

    // Ambient Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    // ----------------------------------------------------------------------
    // 5. BACKGROUND AUDIO ENGINE (ALWAYS ENABLED WITH MULTI-GESTURE AUTO-RESUME)
    // ----------------------------------------------------------------------
    const bgAudio = new Audio('public/The_Bohemian_Rhapsody_s_-_Another_One_Bites_the_Dust_From_Iron_Man_2_(mp3.pm).mp3');
    bgAudio.loop = true;
    bgAudio.volume = 0.55;
    bgAudio.preload = 'auto';

    let isAudioExplicitlyMuted = false;

    function updateAudioUI(playing) {
        state.audioActive = playing;
        const icon = document.getElementById('audio-icon');
        const audioBtn = document.getElementById('audio-toggle');
        
        if (icon) {
            icon.setAttribute('data-lucide', playing ? 'volume-2' : 'volume-x');
            if (window.lucide) lucide.createIcons();
        }
        if (audioBtn) {
            audioBtn.classList.toggle('playing', playing);
            audioBtn.title = playing ? "Mute Background Soundtrack" : "Play Background Soundtrack";
        }
    }

    function playBackgroundAudio() {
        if (isAudioExplicitlyMuted) return;
        bgAudio.play().then(() => {
            updateAudioUI(true);
            logConsole("AUDIO", "Background Soundtrack ('Another One Bites the Dust') engaged.", "pulse");
        }).catch(err => {
            // Autoplay policy may require initial gesture
            console.log("Autoplay waiting for user gesture:", err.message);
        });
    }

    function pauseBackgroundAudio() {
        isAudioExplicitlyMuted = true;
        bgAudio.pause();
        updateAudioUI(false);
        logConsole("AUDIO", "Background soundtrack paused.", "info");
    }

    function toggleAudio() {
        if (bgAudio.paused) {
            isAudioExplicitlyMuted = false;
            playBackgroundAudio();
        } else {
            pauseBackgroundAudio();
        }
    }

    // Ensure audio loops and stays playing
    bgAudio.addEventListener('ended', () => {
        if (!isAudioExplicitlyMuted) {
            bgAudio.currentTime = 0;
            bgAudio.play().catch(() => {});
        }
    });

    // Auto-resume when tab becomes visible again
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && !isAudioExplicitlyMuted && bgAudio.paused) {
            playBackgroundAudio();
        }
    });

    // Auto-play when website opens + multi-event instant gesture trigger
    function initBackgroundMusicAutoplay() {
        playBackgroundAudio();

        const unlockAutoplay = () => {
            if (!isAudioExplicitlyMuted && bgAudio.paused) {
                playBackgroundAudio();
            }
        };

        ['click', 'touchstart', 'touchend', 'pointerdown', 'keydown', 'scroll', 'wheel'].forEach(evt => {
            window.addEventListener(evt, unlockAutoplay, { passive: true });
        });
    }

    initBackgroundMusicAutoplay();

    let audioCtx = null;
    function triggerSoundPulse() {
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            const pingOsc = audioCtx.createOscillator();
            const pingGain = audioCtx.createGain();
            pingOsc.type = 'sine';
            pingOsc.frequency.setValueAtTime(432, audioCtx.currentTime);
            pingOsc.frequency.exponentialRampToValueAtTime(108, audioCtx.currentTime + 0.8);

            pingGain.gain.setValueAtTime(0.2, audioCtx.currentTime);
            pingGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);

            pingOsc.connect(pingGain);
            pingGain.connect(audioCtx.destination);
            pingOsc.start();
            pingOsc.stop(audioCtx.currentTime + 0.8);
        } catch (e) {}
    }

    // ----------------------------------------------------------------------
    // 6. UI & HUD MATRIX BINDINGS
    // ----------------------------------------------------------------------
    document.getElementById('btn-pulse-core').addEventListener('click', () => {
        state.pulseActive = true;
        state.pulseProgress = 0.0;
        triggerSoundPulse();
        logConsole("PULSE", "High-voltage zero-point pulse shockwave discharged!", "pulse");
    });

    document.getElementById('btn-reset-view').addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        camera.position.set(0, 0, 7.5);
        controls.target.set(0, 0, 0);
        controls.reset();
        logConsole("CAMERA", "Viewport perspective camera reset to default (0, 0, 7.5).", "info");
    });

    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const targetTheme = btn.getAttribute('data-preset');
            applyTheme(targetTheme);
        });
    });

    function applyTheme(themeKey) {
        if (!themes[themeKey]) return;
        state.theme = themeKey;
        const t = themes[themeKey];

        uniforms.uColorPrimary.value = t.primary;
        uniforms.uColorSecondary.value = t.secondary;
        uniforms.uColorCore.value = t.core;
        uniforms.uColorDeep.value = t.deep;

        coreLight.color = t.primary;
        wireframeMaterial.color = t.primary;
        particleMaterial.color = t.primary;
        lineMat.color = t.primary;
        vertexNodeMat.color = t.primary;
        cyanCoreLight.color = t.primary;

        logConsole("THEME", `Matrix theme switched to preset: ${themeKey.toUpperCase()}`, "success");
    }

    const sliderRot = document.getElementById('slider-rotation');
    if (sliderRot) {
        sliderRot.addEventListener('input', (e) => {
            state.rotationSpeed = parseFloat(e.target.value);
            controls.autoRotateSpeed = state.rotationSpeed * 1.5;
            const val = document.getElementById('val-rotation');
            if (val) val.textContent = `${state.rotationSpeed.toFixed(1)}x`;
        });
    }

    const sliderTurb = document.getElementById('slider-turbulence');
    if (sliderTurb) {
        sliderTurb.addEventListener('input', (e) => {
            state.turbulence = parseFloat(e.target.value);
            uniforms.uTurbulence.value = state.turbulence;
            const val = document.getElementById('val-turbulence');
            if (val) val.textContent = `${state.turbulence.toFixed(1)}x`;
        });
    }

    const sliderBloom = document.getElementById('slider-bloom');
    if (sliderBloom) {
        sliderBloom.addEventListener('input', (e) => {
            state.bloomStrength = parseFloat(e.target.value);
            bloomPass.strength = state.bloomStrength;
            const val = document.getElementById('val-bloom');
            if (val) val.textContent = `${state.bloomStrength.toFixed(1)}`;
        });
    }

    const sliderCore = document.getElementById('slider-core');
    if (sliderCore) {
        sliderCore.addEventListener('input', (e) => {
            state.coreBrightness = parseFloat(e.target.value);
            uniforms.uCoreBrightness.value = state.coreBrightness;
            const val = document.getElementById('val-core');
            if (val) val.textContent = `${state.coreBrightness.toFixed(1)}`;
        });
    }

    const toggleWireframe = document.getElementById('toggle-wireframe');
    if (toggleWireframe) {
        toggleWireframe.addEventListener('change', (e) => {
            state.wireframe = e.target.checked;
            wireframeCube.visible = state.wireframe;
            logConsole("MESH", `Wireframe overlay ${state.wireframe ? 'enabled' : 'disabled'}.`, "info");
        });
    }

    const toggleParticles = document.getElementById('toggle-particles');
    if (toggleParticles) {
        toggleParticles.addEventListener('change', (e) => {
            state.particles = e.target.checked;
            particleSystem.visible = state.particles;
            netParticleRing.visible = state.particles;
        });
    }

    const toggleAutorotate = document.getElementById('toggle-autorotate');
    if (toggleAutorotate) {
        toggleAutorotate.addEventListener('change', (e) => {
            state.autoRotate = e.target.checked;
            controls.autoRotate = state.autoRotate;
        });
    }

    const audioToggle = document.getElementById('audio-toggle');
    if (audioToggle) {
        audioToggle.addEventListener('click', toggleAudio);
    }

    const btnPulseNet = document.getElementById('btn-pulse-network');
    if (btnPulseNet) {
        btnPulseNet.addEventListener('click', () => {
            triggerSoundPulse();
            logConsole("NETWORK", "Geodesic lattice quantum sync wave transmitted across 642 nodes!", "pulse");
        });
    }

    const btnFocusNet = document.getElementById('btn-focus-network');
    if (btnFocusNet) {
        btnFocusNet.addEventListener('click', () => {
            const netSec = document.getElementById('network');
            if (netSec) netSec.scrollIntoView({ behavior: 'smooth' });
        });
    }

    const hudPanel = document.getElementById('hud-panel');
    const hudToggleBtn = document.getElementById('hud-toggle-btn');
    if (hudToggleBtn && hudPanel) {
        hudToggleBtn.addEventListener('click', () => {
            hudPanel.classList.toggle('collapsed');
            const icon = document.getElementById('hud-toggle-icon');
            if (icon) {
                icon.setAttribute('data-lucide', hudPanel.classList.contains('collapsed') ? 'chevron-up' : 'chevron-down');
                if (window.lucide) lucide.createIcons();
            }
        });
    }

    function logConsole(prefix, message, type = "info") {
        const consoleOutput = document.getElementById('console-output');
        if (!consoleOutput) return;

        const time = new Date().toTimeString().split(' ')[0];
        const line = document.createElement('div');
        line.className = `log-line ${type}`;
        line.innerHTML = `<span class="timestamp">[${time}]</span> <span class="prefix">${prefix}:</span> ${message}`;
        
        consoleOutput.appendChild(line);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }

    const clearLogBtn = document.getElementById('btn-clear-log');
    if (clearLogBtn) {
        clearLogBtn.addEventListener('click', () => {
            const consoleOutput = document.getElementById('console-output');
            if (consoleOutput) consoleOutput.innerHTML = '';
        });
    }

    // Mouse Parallax Effect
    let mouseX = 0, mouseY = 0;
    window.addEventListener('mousemove', (e) => {
        mouseX = (e.clientX / window.innerWidth - 0.5) * 0.4;
        mouseY = (e.clientY / window.innerHeight - 0.5) * 0.4;
    });

    // ----------------------------------------------------------------------
    // 7. ANIMATION RENDER LOOP & SCROLL DEPTH ZOOM PIPELINE
    // ----------------------------------------------------------------------
    const clock = new THREE.Clock();
    let frameCount = 0;
    let lastFpsTime = performance.now();
    const fpsVal = document.getElementById('val-fps');

    function animate() {
        requestAnimationFrame(animate);

        const delta = clock.getDelta();
        const elapsedTime = clock.getElapsedTime();

        // Shader time uniform
        uniforms.uTime.value = elapsedTime;

        // Section Offset Targets for Depth Zoom Transitions
        const scrollY = window.scrollY;
        const orbitHub = document.getElementById('orbit-hub');
        const finaleSection = document.getElementById('finale-section');

        const hubTop = orbitHub ? orbitHub.offsetTop : 650;
        const finaleTop = finaleSection ? finaleSection.offsetTop : 1600;

        // Dynamic Camera Transition Pipeline
        let targetCamZ = 7.5;
        let targetCamY = 0.0;

        if (scrollY < hubTop) {
            const p = scrollY / hubTop;
            targetCamZ = 7.5 - p * 1.5;
        } else if (scrollY < finaleTop) {
            const p = (scrollY - hubTop) / (finaleTop - hubTop);
            targetCamZ = 6.0 + p * 2.0;
        } else {
            targetCamZ = 8.0;
        }

        camera.position.z += (targetCamZ - camera.position.z) * 0.05;

        // Stage 1: Cosmic Energy Plasma Cube Transitions
        let cubeScale = 1.0;
        let cubeZ = 0;
        if (scrollY < hubTop * 0.75) {
            const p = scrollY / (hubTop * 0.75);
            cubeScale = Math.max(0.0, 1.0 - p);
            cubeZ = -p * 15.0;
        } else {
            cubeScale = 0.0;
        }

        energyCube.scale.setScalar(Math.max(0.0001, cubeScale));
        energyCube.position.set(0, 0, cubeZ);
        energyCube.visible = cubeScale > 0.01;

        if (energyCube.visible) {
            energyCube.rotation.y = Math.sin(elapsedTime * 0.8 * state.rotationSpeed) * 0.35;
            energyCube.rotation.x = Math.cos(elapsedTime * 0.6 * state.rotationSpeed) * 0.15;
            energyCube.rotation.z = Math.sin(elapsedTime * 0.4 * state.rotationSpeed) * 0.08;
        }

        // Stage 2: Cyber Quantum Geodesic Network Sphere & Orbit Connector Hubs
        let netScale = 0.0;
        let netZ = -15.0;

        if (scrollY > hubTop * 0.1 && scrollY < finaleTop * 0.95) {
            if (scrollY < hubTop * 0.65) {
                const p = (scrollY - hubTop * 0.1) / (hubTop * 0.55);
                netScale = Math.min(1.0, Math.max(0.0, p));
                netZ = (1.0 - netScale) * -15.0;
            } else if (scrollY < finaleTop * 0.6) {
                const p = (scrollY - hubTop * 0.65) / (hubTop * 0.65);
                const zoomFactor = Math.min(1.0, Math.max(0.0, p));
                netScale = 1.0 + (zoomFactor * 2.6);
                netZ = zoomFactor * 1.6;
            } else {
                const p = (scrollY - finaleTop * 0.6) / (finaleTop * 0.35);
                netScale = Math.max(0.0, 3.6 * (1.0 - p));
                netZ = 1.6 + p * 2.0;
            }
        }

        latticeSphereGroup.scale.setScalar(Math.max(0.0001, netScale));
        latticeSphereGroup.position.set(0, 0, netZ);
        latticeSphereGroup.visible = netScale > 0.01;

        if (latticeSphereGroup.visible) {
            geodesicWireframe.rotation.y += delta * 0.22;
            geodesicWireframe.rotation.x += delta * 0.10;
            vertexNodes.rotation.y += delta * 0.22;
            vertexNodes.rotation.x += delta * 0.10;
            netParticleRing.rotation.y += delta * 0.15;
            cyanCore.scale.setScalar(Math.sin(elapsedTime * 3.5) * 0.12 + 0.92);

            const tempVec = new THREE.Vector3();
            const camDir = new THREE.Vector3();
            camera.getWorldDirection(camDir);

            const settleProgress = Math.min(1.0, Math.max(0.0, (netScale - 1.1) / 2.2));
            const isMobile = window.innerWidth <= 768;
            const pinCardW = isMobile ? 140 : 200;

            interactiveNodeMeshes.forEach((nodeObj) => {
                nodeObj.orb.getWorldPosition(tempVec);
                
                if (netScale >= 0.6) {
                    tempVec.project(camera);
                    const projX = (tempVec.x * 0.5 + 0.5) * window.innerWidth;
                    const projY = (-(tempVec.y * 0.5) + 0.5) * window.innerHeight;

                    const settledTargetX = (nodeObj.data.settledX || 0.5) * window.innerWidth;
                    const settledTargetY = (nodeObj.data.settledY || 0.5) * window.innerHeight;

                    const finalX = projX * (1.0 - settleProgress) + settledTargetX * settleProgress;
                    const finalY = projY * (1.0 - settleProgress) + settledTargetY * settleProgress;

                    // Responsive clamp to viewport
                    const clampedX = Math.max(isMobile ? 10 : 30, Math.min(window.innerWidth - pinCardW - 10, finalX));
                    const clampedY = Math.max(isMobile ? 80 : 60, Math.min(window.innerHeight - 80, finalY));

                    nodeObj.pinEl.style.left = `${clampedX}px`;
                    nodeObj.pinEl.style.top = `${clampedY}px`;
                    nodeObj.pinEl.classList.add('visible');
                } else {
                    nodeObj.pinEl.classList.remove('visible');
                }
            });
        } else {
            interactivePins.forEach(pin => pin.classList.remove('visible'));
        }

        // Mobile Horizontal Scroll-Tethered Carousel Logic
        const mobileCarousel = document.getElementById('mobile-orbit-carousel');
        const mobileThumb = document.getElementById('mobile-scroll-thumb');
        const mobileStatus = document.getElementById('mobile-scroll-status');

        if (mobileCarousel && window.innerWidth <= 860 && orbitHub) {
            const orbitRect = orbitHub.getBoundingClientRect();
            const totalScroll = orbitHub.offsetHeight - window.innerHeight;
            if (totalScroll > 0) {
                const scrollProgress = Math.min(1.0, Math.max(0.0, -orbitRect.top / totalScroll));
                
                // Exactly center each active card in the middle of the viewport and background sphere
                const cardStep = 220 + 16; // card width (220px) + gap (16px)
                const totalDistance = 4 * cardStep; // 4 steps between 5 cards
                const currentTranslate = scrollProgress * totalDistance;
                mobileCarousel.style.transform = `translateX(-${currentTranslate}px)`;

                // Slide up entrance animation
                const wrap = mobileCarousel.closest('.mobile-orbit-carousel-wrap');
                if (wrap) {
                    const enterProgress = Math.min(1.0, Math.max(0.0, (-orbitRect.top + 150) / 250));
                    const slideUpY = (1.0 - enterProgress) * 35;
                    wrap.style.transform = `translateY(${slideUpY}px)`;
                    wrap.style.opacity = `${0.4 + enterProgress * 0.6}`;
                }

                if (mobileThumb) {
                    mobileThumb.style.width = `${Math.max(18, scrollProgress * 100)}%`;
                }
                if (mobileStatus) {
                    const sectorIndex = Math.min(5, Math.floor(scrollProgress * 4.98) + 1);
                    mobileStatus.textContent = `SECTOR ${sectorIndex} OF 5 // SCROLL TO CYCLE`;

                    // Mark active card for center elevation
                    const cards = mobileCarousel.querySelectorAll('.mobile-hub-card');
                    cards.forEach((card, idx) => {
                        card.classList.toggle('active', idx === (sectorIndex - 1));
                    });
                }
            }
        }

        // Stage 3: 3D Volumetric Electric Plasma Lightning Aura Vortex (Climax Finale)
        // Inspired by Pinterest Electric Plasma Aura Supernova
        let auraScale = 0.0;
        let auraZ = -10.0;

        if (scrollY > finaleTop * 0.45) {
            const p = (scrollY - finaleTop * 0.45) / (finaleTop * 0.5);
            auraScale = Math.min(1.25, Math.max(0.0, p * 1.25));
            auraZ = (1.0 - Math.min(1.0, p)) * -10.0;
        }

        electricAuraGroup.scale.setScalar(Math.max(0.0001, auraScale));
        electricAuraGroup.position.set(0, 0, auraZ);
        electricAuraGroup.visible = auraScale > 0.01;

        if (electricAuraGroup.visible) {
            // Core pulsation
            auraCore.scale.setScalar(0.9 + Math.sin(elapsedTime * 8.0) * 0.15);
            auraInnerGlow.scale.setScalar(1.15 + Math.sin(elapsedTime * 5.0) * 0.25);

            // Plasma Shockwave Rings Rotation & Expansion
            auraRing1.rotation.z += delta * 0.45;
            auraRing2.rotation.z -= delta * 0.35;
            auraRing1.scale.setScalar(1.0 + Math.sin(elapsedTime * 3.0) * 0.08);
            auraRing2.scale.setScalar(1.0 + Math.cos(elapsedTime * 2.5) * 0.1);

            // Procedural Jagged Lightning Discharges Updates
            lightningLines.forEach((item, idx) => {
                const positions = item.mesh.geometry.attributes.position.array;
                const base = item.basePoints;
                const timeFactor = elapsedTime * item.speed * 4.0;
                
                for (let j = 0; j < base.length; j++) {
                    const frac = j / (base.length - 1);
                    const jitterX = frac > 0 && frac < 1 ? Math.sin(timeFactor + j * 1.5 + idx) * 0.22 : 0;
                    const jitterY = frac > 0 && frac < 1 ? Math.cos(timeFactor * 1.2 + j + idx) * 0.22 : 0;
                    const jitterZ = frac > 0 && frac < 1 ? Math.sin(timeFactor * 0.8 + j * 2.0) * 0.22 : 0;

                    positions[j * 3] = base[j].x + jitterX;
                    positions[j * 3 + 1] = base[j].y + jitterY;
                    positions[j * 3 + 2] = base[j].z + jitterZ;
                }
                item.mesh.geometry.attributes.position.needsUpdate = true;
                item.mesh.rotation.z += delta * 0.2 * (idx % 2 === 0 ? 1 : -1);
            });

            // Electric Swirling Embers Simulation
            const emberPosArr = emberParticles.geometry.attributes.position.array;
            for (let i = 0; i < emberCount; i++) {
                emberAngles[i].angle += delta * emberAngles[i].speed;
                const curR = emberAngles[i].rad + Math.sin(elapsedTime * 2.5 + i) * 0.25;
                emberPosArr[i * 3] = Math.cos(emberAngles[i].angle) * curR;
                emberPosArr[i * 3 + 1] += emberAngles[i].vy * delta;
                if (emberPosArr[i * 3 + 1] > 2.8) emberPosArr[i * 3 + 1] = -2.8;
                if (emberPosArr[i * 3 + 1] < -2.8) emberPosArr[i * 3 + 1] = 2.8;
                emberPosArr[i * 3 + 2] = Math.sin(emberAngles[i].angle) * curR;
            }
            emberParticles.geometry.attributes.position.needsUpdate = true;
            emberParticles.rotation.y += delta * 0.18;
        }

        // Shockwave pulse progression
        if (state.pulseActive) {
            state.pulseProgress += delta * 1.5;
            uniforms.uPulseProgress.value = state.pulseProgress;
            if (state.pulseProgress >= 1.0) {
                state.pulseActive = false;
                state.pulseProgress = 0.0;
                uniforms.uPulseProgress.value = 0.0;
            }
        }

        // Inner Core Glow Pulse
        const pulseFactor = Math.sin(elapsedTime * 3.0) * 0.15 + 0.85;
        innerCore.scale.set(pulseFactor, pulseFactor, pulseFactor);

        // Particle System Slow Drift
        if (state.particles) {
            particleSystem.rotation.y = elapsedTime * 0.05;
            particleSystem.rotation.x = elapsedTime * 0.02;
        }

        // Mouse Parallax Camera Drift
        camera.position.x += (mouseX - camera.position.x * 0.05) * 0.02;
        camera.position.y += (-mouseY - camera.position.y * 0.05) * 0.02;

        // Render Real 3D Cosmic Infinity Stones in Navbar
        stoneInstances.forEach(item => {
            item.mesh.rotation.x += item.speedX;
            item.mesh.rotation.y += item.speedY;
            item.core.scale.setScalar(0.85 + Math.sin(elapsedTime * 4.0) * 0.25);
            item.renderer.render(item.scene, item.camera);
        });

        controls.update();
        composer.render();

        // FPS Calculation & Telemetry Stats Update
        frameCount++;
        const now = performance.now();
        if (now - lastFpsTime >= 1000) {
            const currentFps = Math.round((frameCount * 1000) / (now - lastFpsTime));
            fpsVal.innerHTML = `${currentFps} <small>FPS</small>`;
            frameCount = 0;
            lastFpsTime = now;

            document.getElementById('val-energy').innerHTML = `${(98.2 + Math.random() * 0.8).toFixed(1)} <small>PFLOPS</small>`;
            document.getElementById('val-temp').innerHTML = `${(4.1 + Math.random() * 0.2).toFixed(1)} <small>KELVIN</small>`;
        }
    }

    // ----------------------------------------------------------------------
    // 8. INTERACTIVE FUTURISTIC ROBO ASSISTANT & BOTTOM NAVBAR DOCK
    // ----------------------------------------------------------------------
    const roboMsgText = document.getElementById('robo-message-text');
    const roboChatForm = document.getElementById('robo-chat-form');
    const roboInput = document.getElementById('robo-input');
    const promptChips = document.querySelectorAll('.prompt-chip');

    const roboResponses = [
        "Transmission encoded! Our engineering team has received your query and will establish hyper-link shortly.",
        "Query acknowledged! Nexus Quantum WebGL engines are ready to construct your next spatial computing masterpiece.",
        "Calculating optimal trajectory... 100% quantum efficiency achieved. Thank you for connecting with Nexus!",
        "Sub-space frequency locked! We specialize in custom 3D web applications, real-time shaders, and spatial interfaces.",
        "Affirmative! Your message has been logged into the quantum ledger. Return to home whenever you are ready!"
    ];

    function triggerRoboResponse(userText) {
        if (!roboMsgText) return;
        triggerSoundPulse();
        roboMsgText.innerHTML = `<span style="color: var(--primary-cyan); font-family: var(--font-mono); font-size: 0.85rem;">[TRANSMITTING]</span> "${userText}"`;
        
        setTimeout(() => {
            triggerSoundPulse();
            const randomReply = roboResponses[Math.floor(Math.random() * roboResponses.length)];
            roboMsgText.innerHTML = `<strong>NEXUS-BOT:</strong> "${randomReply}"`;
            logConsole("SENTINEL", `AI Companion responded to transmission: "${userText}"`, "success");
        }, 600);
    }

    if (roboChatForm && roboInput) {
        roboChatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const val = roboInput.value.trim();
            if (val) {
                triggerRoboResponse(val);
                roboInput.value = '';
            }
        });
    }

    promptChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const prompt = chip.getAttribute('data-prompt');
            if (prompt) triggerRoboResponse(prompt);
        });
    });

    // Return to Home Button
    const btnReturnHome = document.getElementById('btn-return-home');
    if (btnReturnHome) {
        btnReturnHome.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            triggerSoundPulse();
            logConsole("CORE", "Re-centering camera on 3D Cosmic Core...", "info");
        });
    }

    // Return to Orbit Button
    const btnReturnOrbit = document.getElementById('btn-return-orbit');
    if (btnReturnOrbit) {
        btnReturnOrbit.addEventListener('click', () => {
            const orbitEl = document.getElementById('orbit-hub');
            if (orbitEl) {
                orbitEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                triggerSoundPulse();
            }
        });
    }

    // ----------------------------------------------------------------------
    // 9. DYNAMIC AUTO-HIDE TOP MENU NAVBAR ON SCROLLING
    // ----------------------------------------------------------------------
    const topNavbar = document.querySelector('.navbar');
    let lastScrollY = window.scrollY;
    let navHideTimer = null;

    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;
        if (!topNavbar) return;

        // If at the very top (Hero), always show navbar
        if (currentScrollY <= 40) {
            topNavbar.classList.remove('nav-hidden');
            lastScrollY = currentScrollY;
            return;
        }

        // When scrolling down / moving through sections -> auto-hide navbar
        if (currentScrollY > lastScrollY + 5) {
            topNavbar.classList.add('nav-hidden');
        } else if (currentScrollY < lastScrollY - 15) {
            // When scrolling up noticeably, bring navbar back into view
            topNavbar.classList.remove('nav-hidden');
        }

        // Debounced hide while actively scrolling
        if (currentScrollY > 60) {
            if (navHideTimer !== null) clearTimeout(navHideTimer);
            navHideTimer = setTimeout(() => {
                // If user stops scrolling for 400ms and is near top, keep visible, else preserve state
                if (window.scrollY <= 40) {
                    topNavbar.classList.remove('nav-hidden');
                }
            }, 300);
        }

        lastScrollY = currentScrollY;
    }, { passive: true });

    // Window Resize Handler
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        energyCube.position.x = 0;
        latticeSphereGroup.position.x = 0;
        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
});
