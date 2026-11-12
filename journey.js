import * as THREE from './vendor/three.module.min.js';

// Continuous flight: 3D vehicle and camera, cinematic launch plate and atmospheric textures.
const canvas = document.querySelector('#flight-scene');
const clamp = THREE.MathUtils.clamp;
const mix = THREE.MathUtils.lerp;
const smooth = (a, b, n) => { const t = clamp((n - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
} catch (error) {
  console.warn('Candidate C: WebGL unavailable; retaining the existing static illustration.', error.message);
}

if (renderer && canvas) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .92;
  let flightLoop = null, contextLost = false;
  const loader = new THREE.TextureLoader();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#07101b');
  scene.fog = new THREE.FogExp2('#17232f', .0014);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 14000);
  const hemispheric = new THREE.HemisphereLight('#b8d5f3', '#3b291b', .72);
  scene.add(hemispheric);
  const sun = new THREE.DirectionalLight('#ffe6c9', 2.1);
  sun.position.set(-300, 650, 500);
  scene.add(sun);
  const rim = new THREE.DirectionalLight('#8db9f2', 1.05);
  rim.position.set(200, 100, -220);
  scene.add(rim);

  // A local procedural lighting environment makes metal respond to view angle.
  const environmentCanvas = document.createElement('canvas');
  environmentCanvas.width = 512; environmentCanvas.height = 256;
  const ec = environmentCanvas.getContext('2d');
  const eg = ec.createLinearGradient(0, 0, 0, 256);
  eg.addColorStop(0, '#8eabc8'); eg.addColorStop(.45, '#c5ccd2');
  eg.addColorStop(.53, '#394652'); eg.addColorStop(1, '#101925');
  ec.fillStyle = eg; ec.fillRect(0, 0, 512, 256);
  const light = ec.createRadialGradient(110, 85, 1, 110, 85, 125);
  light.addColorStop(0, '#fff9e9'); light.addColorStop(1, '#b3c0cc00');
  ec.fillStyle = light; ec.fillRect(0, 0, 512, 256);
  const envTexture = new THREE.CanvasTexture(environmentCanvas);
  envTexture.mapping = THREE.EquirectangularReflectionMapping;
  envTexture.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromEquirectangular(envTexture);
  scene.environment = environment.texture;
  envTexture.dispose(); pmrem.dispose();

  let seed = 1709;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const vector = (x, y, z) => new THREE.Vector3(x, y, z);
  const paint = new THREE.MeshStandardMaterial({ color: '#d8d8d1', roughness: .64, metalness: .15, envMapIntensity: .38 });
  const dark = new THREE.MeshStandardMaterial({ color: '#11171d', roughness: .48, metalness: .35 });
  const silver = new THREE.MeshStandardMaterial({ color: '#b8c1c6', roughness: .24, metalness: .82, envMapIntensity: .85 });
  const steel = new THREE.MeshStandardMaterial({ color: '#414c55', roughness: .52, metalness: .72 });
  const brass = new THREE.MeshStandardMaterial({ color: '#8c6650', roughness: .42, metalness: .75 });
  const paintCanvas=document.createElement('canvas');paintCanvas.width=128;paintCanvas.height=512;
  const paintContext=paintCanvas.getContext('2d');const paintPixels=paintContext.createImageData(128,512);
  for(let i=0;i<paintPixels.data.length;i+=4){const tone=217+random()*28;paintPixels.data[i]=tone;paintPixels.data[i+1]=tone;paintPixels.data[i+2]=tone-3;paintPixels.data[i+3]=255;}
  paintContext.putImageData(paintPixels,0,0);
  paintContext.strokeStyle='rgba(48,46,42,.08)';paintContext.lineWidth=1;
  for(let n=0;n<50;n++){const x=random()*128,y=random()*512;paintContext.beginPath();paintContext.moveTo(x,y);paintContext.lineTo(x,y+10+random()*65);paintContext.stroke();}
  paint.map=new THREE.CanvasTexture(paintCanvas);paint.map.colorSpace=THREE.SRGBColorSpace;
  const rocket = new THREE.Group();
  scene.add(rocket);
  function mesh(geometry, material, parent, x = 0, y = 0, z = 0) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z); parent.add(object); return object;
  }
  function cylinder(top, bottom, height, y, material = paint, segments = 48, parent = rocket) {
    return mesh(new THREE.CylinderGeometry(top, bottom, height, segments), material, parent, 0, y, 0);
  }
  function beam(parent, from, to, radius, material) {
    const delta = to.clone().sub(from);
    const object = mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 6), material, parent);
    object.position.copy(from).add(to).multiplyScalar(.5);
    object.quaternion.setFromUnitVectors(vector(0, 1, 0), delta.normalize());
    return object;
  }

  // Saturn-era staging, stringers, interstages, engine bells and four real fins.
  cylinder(1.64, 1.64, 11.6, 7.4);
  cylinder(1.66, 1.66, 1.25, 13.8, dark);
  cylinder(1.61, 1.61, 7.2, 18);
  cylinder(1.63, 1.63, .72, 22.0, silver);
  cylinder(1.05, 1.61, 2.6, 23.65);
  cylinder(1.05, 1.05, 4.65, 27.25);
  cylinder(1.07, 1.07, .7, 29.85, dark);
  cylinder(.77, 1.04, 1.15, 30.76, silver);
  cylinder(.77, .77, 1.4, 32.03, silver);
  cylinder(.10, .77, 1.48, 33.47, paint);
  cylinder(.085, .085, 2.35, 35.35, steel, 12);
  cylinder(0, .13, .68, 36.86, paint, 16);
  for (let n = 0; n < 4; n++) {
    const angle = n * Math.PI / 2 + Math.PI / 4;
    const strip = mesh(new THREE.CylinderGeometry(1.652, 1.652, 3.0, 12, 1, true, angle, .39), dark, rocket, 0, 11.1, 0);
    strip.material.side = THREE.DoubleSide;
    mesh(new THREE.CylinderGeometry(1.616, 1.616, 2.5, 12, 1, true, angle, .48), dark, rocket, 0, 20.2, 0);
    const shape = new THREE.Shape();
    shape.moveTo(1.48, 0); shape.lineTo(3.38, .0); shape.lineTo(2.45, 2.4); shape.lineTo(1.48, 4.7); shape.closePath();
    const fin = mesh(new THREE.ExtrudeGeometry(shape, { depth: .10, bevelEnabled: true, bevelSize: .03, bevelThickness: .02, bevelSegments: 1, steps: 1 }), silver, rocket, 0, 1.45, 0);
    fin.rotation.y = angle;
  }
  const rings = new THREE.InstancedMesh(new THREE.TorusGeometry(1.648, .027, 4, 48), silver, 24);
  const transform = new THREE.Object3D();
  for (let n = 0; n < 24; n++) {
    transform.position.set(0, 2.0 + n * .44, 0); transform.rotation.set(Math.PI / 2, 0, 0); transform.scale.setScalar(1);
    transform.updateMatrix(); rings.setMatrixAt(n, transform.matrix);
  }
  rocket.add(rings);
  const stringers = new THREE.InstancedMesh(new THREE.CylinderGeometry(.016, .016, 9.8, 4), silver, 40);
  for (let n = 0; n < 40; n++) {
    const a = n / 40 * Math.PI * 2;
    transform.position.set(Math.sin(a) * 1.647, 7.2, Math.cos(a) * 1.647); transform.rotation.set(0, 0, 0);
    transform.updateMatrix(); stringers.setMatrixAt(n, transform.matrix);
  }
  rocket.add(stringers);
  for (const [x, z] of [[0, 0], [-.88, -.88], [.88, -.88], [-.88, .88], [.88, .88]]) {
    const points = [[.27, 1.4], [.29, 1.12], [.36, .82], [.53, .32], [.65, 0]].map(([r, y]) => new THREE.Vector2(r, y));
    const bell = mesh(new THREE.LatheGeometry(points, 24), steel, rocket, x, .2, z);
    bell.material.side = THREE.DoubleSide;
    mesh(new THREE.CylinderGeometry(.54, .54, .09, 24), brass, rocket, x, .22, z);
    cylinder(.30, .3, .65, 1.45, steel, 16).position.set(x, 1.45, z);
  }
  for (let n = 0; n < 4; n++) {
    const a = n * Math.PI / 2;
    beam(rocket, vector(Math.cos(a) * .68, 32.9, Math.sin(a) * .68), vector(Math.cos(a) * .16, 35, Math.sin(a) * .16), .035, steel);
  }

  const flame = new THREE.Mesh(new THREE.CylinderGeometry(.82, 2.7, 19, 36, 10, true), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { time: { value: 0 }, power: { value: .0 } },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform float time; uniform float power; varying vec2 vUv;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){float h=1.-vUv.y; float n=hash(floor(vec2(vUv.x*31.,h*35.-time*24.)));
        float filaments=.78+.22*sin(vUv.x*32.+sin(h*9.-time*6.)*.7);
        float strength=pow(max(0.,1.-h),1.7)*(.65+.35*n)*filaments*power;
        vec3 col=mix(vec3(.52,.72,1.),vec3(1.,.35,.055),smoothstep(.02,.3,h));
        col=mix(vec3(1.,.96,.74),col,smoothstep(0.,.17,h));
        gl_FragColor=vec4(col*2.8,strength*.78);}`,
  }));
  flame.position.y = -9.3; rocket.add(flame);
  const engineLight = new THREE.PointLight('#ffb45f', 0, 65, 1.3);
  engineLight.position.set(0, 0, 0); rocket.add(engineLight);

  // The launch photo is anchored to the launch origin in the 3D camera's projection.
  // It is behind the solid model, so the rocket retains its silhouette and changing light.
  const launchMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true, toneMapped: false,
    uniforms: { photo: { value: null }, anchor: { value: new THREE.Vector2() }, scale: { value: new THREE.Vector2() }, opacity: { value: 0 } },
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,1.,1.);}`,
    fragmentShader: `uniform sampler2D photo;uniform vec2 anchor;uniform vec2 scale;uniform float opacity;varying vec2 vUv;
      void main(){vec2 uv=(vUv-anchor)/scale+vec2(.768,.10);
        if(uv.x<0.||uv.x>1.||uv.y<0.||uv.y>1.)discard;
        vec4 texel=texture2D(photo,uv);
        float mask=smoothstep(0.,.075,uv.y)*(1.-smoothstep(.40,.72,uv.y));
        gl_FragColor=vec4(texel.rgb,mask*opacity);
        #include <colorspace_fragment>
      }`
  });
  const launchPlate = new THREE.Mesh(new THREE.PlaneGeometry(2,2),launchMaterial);
  launchPlate.frustumCulled=false;launchPlate.renderOrder=-100;scene.add(launchPlate);
  let plateReady=false;
  loader.load('assets/launch-ground.webp',texture=>{texture.colorSpace=THREE.SRGBColorSpace;launchMaterial.uniforms.photo.value=texture;plateReady=true;flightLoop?.requestDraw();});
  const launchAnchor=new THREE.Vector3();

  // Sparse, textured steam layers give depth while keeping the early flight inexpensive.
  const vaporTexture=loader.load('assets/launch-vapor.webp',()=>flightLoop?.requestDraw());
  vaporTexture.colorSpace=THREE.SRGBColorSpace;
  const steam=[];
  for(let n=0;n<8;n++){
    const material=new THREE.SpriteMaterial({map:vaporTexture,color:'#d6c7b5',opacity:.16,depthWrite:false,toneMapped:false});
    const sprite=new THREE.Sprite(material);scene.add(sprite);steam.push(sprite);
  }
  const cloudLayer=new THREE.Group();scene.add(cloudLayer);
  const cloudMaterials=[];
  for(let n=0;n<12;n++){
    const material=new THREE.SpriteMaterial({map:vaporTexture,color:'#aebbc9',opacity:.12,depthWrite:false,toneMapped:false});
    cloudMaterials.push(material);
    const sprite=new THREE.Sprite(material);
    sprite.position.set((random()-.5)*350,140+random()*220,(random()-.5)*280);
    const scale=100+random()*90;sprite.scale.set(scale,scale*.34,1);cloudLayer.add(sprite);
  }

  // Real equirectangular geography is mapped to a sphere, lit by the same sun as the vehicle.
  const earthMaterial=new THREE.MeshStandardMaterial({color:'#bfcbd4',roughness:.93,metalness:0,envMapIntensity:.02});
  const earth=mesh(new THREE.SphereGeometry(470,64,48),earthMaterial,scene,0,-474,0);
  earth.rotation.y=1.5;
  loader.load('assets/earth-map.webp',texture=>{texture.colorSpace=THREE.SRGBColorSpace;earthMaterial.map=texture;earthMaterial.needsUpdate=true;flightLoop?.requestDraw();});
  const earthCloudMaterial=new THREE.MeshStandardMaterial({color:'#d5dee4',roughness:1,transparent:true,opacity:.52,depthWrite:false,envMapIntensity:.02});
  const earthClouds=mesh(new THREE.SphereGeometry(471.2,48,32),earthCloudMaterial,scene,0,-474,0);
  earthClouds.rotation.y=1.5;
  loader.load('assets/earth-clouds.webp',texture=>{earthCloudMaterial.alphaMap=texture;earthCloudMaterial.needsUpdate=true;flightLoop?.requestDraw();});
  function atmosphere(radius, color, opacity) {
    const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
      uniforms: { color: { value: new THREE.Color(color) }, opacity: { value: opacity } },
      vertexShader: `varying vec3 vN;varying vec3 vV;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `uniform vec3 color;uniform float opacity;varying vec3 vN;varying vec3 vV;void main(){float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),3.5);gl_FragColor=vec4(color,f*opacity);
        #include <colorspace_fragment>
      }` });
    return new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), material);
  }
  const earthAir = atmosphere(474.5, '#76b8df', .26); earthAir.position.copy(earth.position); scene.add(earthAir);
  const moonPosition = vector(1070, 1510, -1020);
  const moonMaterial = new THREE.MeshStandardMaterial({ color: '#d7d5cd', roughness: .96, metalness: 0, envMapIntensity: .03 });
  const moon = mesh(new THREE.SphereGeometry(130, 64, 48), moonMaterial, scene);
  moon.position.copy(moonPosition); moon.rotation.y = -.45;
  loader.load('assets/moon-map.webp', texture => { texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); moonMaterial.map = texture; moonMaterial.bumpMap = texture; moonMaterial.bumpScale = .36; moonMaterial.needsUpdate = true; flightLoop?.requestDraw(); });

  const starPositions = new Float32Array(1250 * 3);
  for (let n = 0; n < 1250; n++) {
    const az = random() * Math.PI * 2, y = random() * 2 - 1, r = Math.sqrt(1 - y * y), radius = 6000 + random() * 1000;
    starPositions.set([Math.cos(az) * r * radius, y * radius + 800, Math.sin(az) * r * radius], n * 3);
  }
  const starGeometry = new THREE.BufferGeometry(); starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMaterial = new THREE.PointsMaterial({ color: '#cdd9ed', size: 4.2, sizeAttenuation: true, transparent: true, opacity: .6, depthWrite: false });
  scene.add(new THREE.Points(starGeometry, starMaterial));

  const flightPath = new THREE.CatmullRomCurve3([vector(0, 2.3, 0), vector(0, 35, 0), vector(3, 110, -8), vector(32, 390, -55), vector(170, 770, -230), vector(465, 1110, -510), vector(850, 1360, -805)], false, 'centripetal');
  const up = vector(0, 1, 0), rocketCenter = new THREE.Vector3(), focus = new THREE.Vector3(), position = new THREE.Vector3(), tangent = new THREE.Vector3();
  const initialBackground = new THREE.Color('#070d17'), spaceBackground = new THREE.Color('#02050b');
  let width = 1, height = 1, mobile = false;
  function draw(p, time) {
    if (contextLost) return;
    const flight = smooth(.02, 1, p);
    flightPath.getPoint(flight, position); flightPath.getTangent(flight, tangent);
    rocket.position.copy(position);
    rocket.quaternion.setFromUnitVectors(up, tangent.normalize());
    rocketCenter.copy(up).multiplyScalar(18).applyQuaternion(rocket.quaternion).add(position);
    const orbit = smooth(.18, .50, p), approach = smooth(.63, 1, p);
    focus.copy(rocketCenter).lerp(moonPosition, approach * .74);
    const viewDistance = mix(mobile ? 181 : 145, mobile ? 237 : 195, orbit) + approach * (mobile ? 1000 : 530);
    const azimuth = mix(.43, .16, orbit) - approach * .66;
    const elevation = mix(-.06, 1.60, orbit) * (1 - approach) + approach * .18;
    const horizontal = viewDistance / Math.sqrt(1 + elevation * elevation);
    camera.position.set(focus.x + Math.sin(azimuth) * horizontal, focus.y + horizontal * elevation, focus.z + Math.cos(azimuth) * horizontal);
    camera.lookAt(focus);
    camera.setViewOffset(width, height, -width * mix(mobile ? .225 : .245, mobile ? .10 : .23, approach), -height * mix(mobile ? .205 : .17, mobile ? .17 : .04, approach), width, height);
    scene.background.copy(initialBackground).lerp(spaceBackground, smooth(.12, .42, p));
    scene.fog.density = .0014 * (1 - smooth(.11, .41, p));
    camera.updateMatrixWorld();
    launchAnchor.set(0,2.3,0).project(camera);
    launchMaterial.uniforms.anchor.value.set(launchAnchor.x*.5+.5,launchAnchor.y*.5+.5);
    launchMaterial.uniforms.scale.value.set(mobile?2.1:1.10,mobile?.86:.95);
    launchMaterial.uniforms.opacity.value=plateReady?1-smooth(.13,.30,p):0;
    launchPlate.visible=p<.30;
    earth.visible=earthAir.visible=earthClouds.visible=p>.16;
    cloudLayer.visible=p>.08&&p<.46;
    if(cloudLayer.visible){const opacity=smooth(.08,.19,p)*(1-smooth(.29,.46,p))*.15;for(const material of cloudMaterials)material.opacity=opacity;}
    starMaterial.opacity = .22 + smooth(.10, .55, p) * .65;
    const throttle = smooth(.005, .07, p) * (1 - smooth(.86, 1, p) * .89);
    flame.material.uniforms.time.value = time;
    flame.material.uniforms.power.value = throttle;
    flame.scale.y = .65 + throttle * .35;
    engineLight.intensity = throttle * 90;
    for(let n=0;n<steam.length;n++){
      const sprite=steam[n];sprite.visible=p<.28;
      if(!sprite.visible)continue;
      const t=(n/steam.length+time*.025)%1,angle=n*2.399;
      sprite.position.set(Math.cos(angle)*(2+t*17),1+t*3,Math.sin(angle)*(2+t*17));
      const size=22+t*26;sprite.scale.set(size,size*.34,1);
      sprite.material.opacity=(.10+throttle*.16)*(1-t*.6)*(1-smooth(.12,.28,p));
    }
    renderer.render(scene, camera);
  }
  function resize(nextWidth, nextHeight) {
    width = Math.max(1, nextWidth); height = Math.max(1, nextHeight); mobile = width <= 720;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.35 : 1.65));
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.fov = mobile ? 40 : 38;
  }
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); contextLost = true; flightLoop?.setEnabled(false);
    document.body.classList.remove('scene-ready');
    document.querySelector('.journey')?.classList.remove('scene-ready');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    contextLost = false; flightLoop?.setEnabled(true); flightLoop?.requestDraw();
  });
  canvas.dataset.renderer = `three-r${THREE.REVISION}-cinematic`;
  flightLoop = window.createFlightLoop({ canvas, resize, draw });
}
