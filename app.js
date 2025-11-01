// Advanced vintage birthday page behaviors
// Uses Three.js for foil normal/specular simulation and GSAP for animations
// Make sure portrait-placeholder.jpg and ambient-loop.mp3 exist in the same folder or replace paths

document.addEventListener('DOMContentLoaded', () => {


/* Utility */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

/* DOM */
const canvas = $('#foilCanvas');
const medallion = $('#medallion');
const portraitImg = $('#portraitImg');
const openEnvelope = $('#openEnvelope');
const envelope = $('#envelope');
const ambient = $('#ambientAudio');
const audioToggle = $('#audioToggle');
const timelineEl = $('#timeline');
const messagesGrid = $('#messagesGrid');
const portraitLarge = $('#portraitLarge img');
const viewCollage = $('#viewCollage');
const downloadCard = $('#downloadCard');

/* Basic assets fallback generation if images missing */
function ensurePlaceholderImage(selector){
  const el = $(selector);
  if(!el) return;
  el.onerror = () => {
    el.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='1200'>
        <rect width='100%' height='100%' fill='#efe6dc'/>
        <g fill='#b28a41' font-family='Playfair Display,serif' font-size='72' text-anchor='middle'>
          <text x='50%' y='45%'>Portrait</text>
          <text x='50%' y='58%' font-size='36'>Mum</text>
        </g>
      </svg>`
    );
  };
}
ensurePlaceholderImage('#portraitImg');
ensurePlaceholderImage('#portraitLarge img');

/* Three.js foil shader simulation */
let renderer, scene, camera, hearts, foilTexture;
function initThree(){
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const heroRect = canvas.parentElement.getBoundingClientRect();
  renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
  renderer.setPixelRatio(dpr);
  renderer.setSize(heroRect.width, heroRect.height);
  renderer.setClearColor(0x000000, 0);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, heroRect.width / heroRect.height, 0.1, 1000); // Corrected heroRect.height
  camera.position.set(0,0,60);

  // Simple normal-like bump from canvas pattern
  const textureLoader = new THREE.TextureLoader();
  foilTexture = textureLoader.load('data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='512' height='512'>
       <defs><radialGradient id='g' cx='50%' cy='40%'><stop offset='0%' stop-color='#fff'/><stop offset='100%' stop-color='#c9b08a'/></radialGradient></defs>
       <rect width='100%' height='100%' fill='url(#g)'/>
     </svg>`
  ));

  // Create a single heart geometry to be reused
  const heartShape = new THREE.Shape();
  const x = -12.5, y = -20;
  heartShape.moveTo(x + 12.5, y + 12.5);
  heartShape.bezierCurveTo(x + 12.5, y + 12.5, x + 10, y, x, y);
  heartShape.bezierCurveTo(x - 15, y, x - 15, y + 22.5, x - 15, y + 22.5);
  heartShape.bezierCurveTo(x - 15, y + 35, x + 2.5, y + 47.5, x + 12.5, y + 55);
  heartShape.bezierCurveTo(x + 22.5, y + 47.5, x + 40, y + 35, x + 40, y + 22.5);
  heartShape.bezierCurveTo(x + 40, y + 22.5, x + 40, y, x + 27.5, y);
  heartShape.bezierCurveTo(x + 25, y, x + 12.5, y + 12.5, x + 12.5, y + 12.5);
  const extrudeSettings = { depth: 6, bevelEnabled: true, bevelSegments: 4, steps: 2, bevelSize: 2, bevelThickness: 2 };
  const geometry = new THREE.ExtrudeGeometry(heartShape, extrudeSettings);

  // Create a bunch of hearts
  hearts = [];
  const heartCount = 20;
  const themeColors = [0xfff1dd, 0xf7d4d6, 0xd6c3a0, 0xb28a41, 0xeadfcf];

  for (let i = 0; i < heartCount; i++) {
    const material = new THREE.MeshStandardMaterial({
      metalness: 0.8,
      roughness: 0.3,
      envMapIntensity: 1.2,
      color: new THREE.Color(themeColors[i % themeColors.length]),
      map: foilTexture,
    });

    const heartMesh = new THREE.Mesh(geometry, material);
    heartMesh.position.set(
      (Math.random() - 0.5) * 100,
      (Math.random() - 0.5) * 80,
      (Math.random() - 0.5) * 40
    );
    const scale = Math.random() * 0.4 + 0.2; // Made hearts much smaller
    heartMesh.scale.set(scale, scale, scale);
    heartMesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    heartMesh.userData.rotationSpeed = { x: (Math.random() - 0.5) * 0.005, y: (Math.random() - 0.5) * 0.005 };
    scene.add(heartMesh);
    hearts.push(heartMesh);
  }

  // Lighting
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(40, 50, 30);
  scene.add(dir);

  // subtle movement driven by pointer
  const state = {mx:0,my:0};
  window.addEventListener('pointermove', e => {
    const nx = (e.clientX / window.innerWidth) - 0.5;
    const ny = (e.clientY / window.innerHeight) - 0.5;
    state.mx = nx;
    state.my = ny;
  });

  // simple render loop
  function animate(){
    requestAnimationFrame(animate);
    hearts.forEach((heart, i) => {
      heart.rotation.x += heart.userData.rotationSpeed.x;
      heart.rotation.y += heart.userData.rotationSpeed.y;
      // Gently move based on mouse
      heart.rotation.y = THREE.MathUtils.lerp(heart.rotation.y, heart.rotation.y + state.mx * 0.2, 0.02);

      // Simple separation behavior to prevent clumping
      for (let j = i + 1; j < hearts.length; j++) {
        const otherHeart = hearts[j];
        const distance = heart.position.distanceTo(otherHeart.position);
        const minDistance = 15; // Minimum distance between hearts

        if (distance < minDistance) {
          const direction = new THREE.Vector3().subVectors(heart.position, otherHeart.position).normalize();
          const moveAmount = (minDistance - distance) * 0.02; // How much to move them apart
          heart.position.add(direction.clone().multiplyScalar(moveAmount));
          otherHeart.position.sub(direction.clone().multiplyScalar(moveAmount));
        }
      }
    });
    renderer.render(scene, camera);
  }
  animate();
}
initThree();
initCursorFollower(); // Initialize the new cursor effect

/* GSAP intro animations */
gsap.registerPlugin(ScrollTrigger);
gsap.from('.portrait-medallion', {y: -20, opacity:0, duration:1.1, ease:"power3.out"});
gsap.from('.headline', {y: 6, opacity:0, duration:1.2, delay:0.12, ease:"power2.out"});
gsap.from('.subline', {y: 8, opacity:0, duration:1.2, delay:0.18, ease:"power2.out"});
gsap.from('.hero-actions .btn', {y: 10, opacity:0, duration:1, stagger:0.08, delay:0.26});

/* Letterpress micro animation */ // Corrected 'box-shadow' to 'boxShadow'
gsap.from('#letterpress',{y:12,opacity:0,duration:1.2,delay:0.6,ease:"power3.out",boxShadow:"0 0 0 rgba(0,0,0,0)"});

/* Timeline and messages sample data */
const sampleTimeline = [
  {year:"1985", title:"Birth", img:"data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='800' height='500'><rect width='100%' height='100%' fill='#f6eee3'/><text x='50%' y='50%' font-size='34' text-anchor='middle' fill='#b28a41' font-family='Playfair Display,serif'>Baby</text></svg>`) , caption:"The beginning of everything"},
  {year:"1998", title:"Graduation", img:"data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='800' height='500'><rect width='100%' height='100%' fill='#f9f3ee'/><text x='50%' y='50%' font-size='34' text-anchor='middle' fill='#7f5b3a' font-family='Playfair Display,serif'>Caps Off</text></svg>`), caption:"Caps, smiles and proud hearts"},
  {year:"2010", title:"Family Trip", img:"data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='800' height='500'><rect width='100%' height='100%' fill='#f2eee7'/><text x='50%' y='50%' font-size='34' text-anchor='middle' fill='#8a5f36' font-family='Playfair Display,serif'>Roadtrip</text></svg>`), caption:"Miles and memories"}
];
const sampleMessages = [
  "You taught me kindness by example",
  "Your laugh is our sun",
  "Thank you for every meal and every bedtime story",
  "To the best mum, with all my love"
];

/* Populate timeline and messages DOM */
function populateContent(){
  timelineEl.innerHTML = '';
  sampleTimeline.forEach(it => {
    const img = document.createElement('img');
    img.src = it.img;
    img.alt = `${it.title} - ${it.caption}`;
    timelineEl.appendChild(img);
  });

  messagesGrid.innerHTML = '';
  sampleMessages.forEach(m=>{
    const t = document.createElement('div');
    t.className = 'message-tile';
    t.innerHTML = `<p>${escapeHtml(m)}</p>`;
    messagesGrid.appendChild(t);
  });
}
populateContent();

openEnvelope.addEventListener('click', () => {
  $('#reveal').scrollIntoView({behavior:'smooth', block:'center'});
});

envelope.addEventListener('click', openReveal);
envelope.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' ') openReveal(); });

/* Confetti burst that looks like torn paper bits */
function burstConfetti(x, y){
  const num = Math.min(80, (window.innerWidth/10)|0); // Reduced count for performance
  const originX = x || window.innerWidth / 2;
  const originY = y || window.innerHeight / 2;
  const colors = ['#f7d4d6','#f2e2d9','#e9d9c9','#d6c3a0','#b28a41'];

  for(let i=0;i<num;i++){
    const el = document.createElement('div');
    const isCircle = Math.random() > 0.7;
    const size = (Math.random() * 8) + 5;
    el.style.width = `${size}px`;
    el.style.height = isCircle ? `${size}px` : `${size * 1.4}px`;
    el.style.position='fixed';
    el.style.left = `${originX}px`;
    el.style.top = `${originY}px`;
    el.style.background = colors[Math.floor(Math.random()*colors.length)];
    el.style.transform = `rotate(${Math.random()*360}deg)`;
    el.style.borderRadius = isCircle ? '50%' : '2px';
    el.style.zIndex = 140;
    el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
    document.body.appendChild(el);

    const endX = (Math.random() - 0.5) * 400; // Horizontal spread
    const endY = window.innerHeight - originY + 50; // Fall down to bottom of screen
    const flutterX = (Math.random() - 0.5) * 80; // Side-to-side flutter

    gsap.to(el,{
      duration: 2.5 + Math.random()*2,
      x: endX,
      y: endY,
      rotationZ: (Math.random()*720)-360,
      rotationX: (Math.random()*720)-360,
      opacity:0,
      ease:"power1.out",
      onComplete: ()=> el.remove()
    });
  }
}

/* Interactive heart cursor follower */
function initCursorFollower() {
  const cursorEl = document.createElement('div');
  cursorEl.style.cssText = 'position:fixed;width:24px;height:24px;top:0;left:0;pointer-events:none;z-index:200;transform:translate(-50%,-50%);';
  cursorEl.innerHTML = `<svg viewBox="0 0 24 24" fill="#b28a41" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.2));"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;
  document.body.appendChild(cursorEl);

  const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const mouse = { x: pos.x, y: pos.y };
  const speed = 0.2; // Increased speed for more responsive tracking

  const xSet = gsap.quickSetter(cursorEl, "x", "px");
  const ySet = gsap.quickSetter(cursorEl, "y", "px");

  window.addEventListener('pointermove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  // Add a subtle "breathing" animation when idle
  let idleTimeout = null;
  const idleAnim = gsap.to(cursorEl, { scale: 1.15, duration: 1, repeat: -1, yoyo: true, ease: 'power1.inOut', paused: true });
  window.addEventListener('pointermove', () => {
    idleAnim.pause().progress(0);
    gsap.to(cursorEl, { scale: 1, duration: 0.3 });
    clearTimeout(idleTimeout);
    idleTimeout = setTimeout(() => idleAnim.play(), 300);
  });

  gsap.ticker.add(() => {
    const dt = 1.0 - Math.pow(1.0 - speed, gsap.ticker.deltaRatio());
    pos.x += (mouse.x - pos.x) * dt;
    pos.y += (mouse.y - pos.y) * dt;
    xSet(pos.x);
    ySet(pos.y);
  });

  document.addEventListener('click', e => {
    burstConfetti(e.clientX, e.clientY);
    gsap.fromTo(cursorEl, 
      { scale: 1, opacity: 1 }, 
      { scale: 2.5, opacity: 0, duration: 0.4, ease: 'power2.out', onComplete: () => gsap.set(cursorEl, { scale: 1, opacity: 1 }) }
    );
  });
  // Change cursor on hover
  const cursorSVG = cursorEl.querySelector('svg');
  const interactiveEls = $$('button, [role="button"], .message-tile, .envelope');
  const creamColor = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
  const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();

  interactiveEls.forEach(el => {
    el.addEventListener('pointerenter', () => {
      gsap.to(cursorSVG, { fill: creamColor, duration: 0.3 });
      gsap.to(cursorEl, { scale: 1.4, duration: 0.3 });
    });
    el.addEventListener('pointerleave', () => {
      gsap.to(cursorSVG, { fill: accentColor, duration: 0.3 });
      gsap.to(cursorEl, { scale: 1, duration: 0.3 });
    });
  });
}


/* Foil canvas resizes with viewport */
function onResize(){
  const heroRect = canvas.parentElement.getBoundingClientRect();
  if(renderer && camera){
    camera.aspect = heroRect.width / heroRect.height;
    camera.updateProjectionMatrix();
    renderer.setSize(heroRect.width, heroRect.height);
  }
}
window.addEventListener('resize', onResize);
onResize();

/* Audio control */
audioToggle.addEventListener('click', ()=>{
  if (ambient.paused) {
    ambient.play().then(() => {
      audioToggle.classList.add('active');
      audioToggle.setAttribute('title', 'Mute ambient audio');
    }).catch(() => {
      // Playback was prevented, so ensure UI is in the paused state.
      audioToggle.classList.remove('active');
    });
  } else {
    ambient.pause();
    audioToggle.classList.remove('active');
    audioToggle.setAttribute('title', 'Play ambient audio');
  }
});
audioToggle.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' ') audioToggle.click(); });

/* View collage scroll */
viewCollage.addEventListener('click', ()=> {
  timelineEl.scrollIntoView({behavior:'smooth', block:'center'});
});

/* Download printable card generates a simple PDF-like page in new tab */
downloadCard.addEventListener('click', ()=>{
  const html = `
    <html><head><meta charset="utf-8"><title>Printable Card</title>
    <style>
      @page { size: A4; margin:20mm; }
      body{font-family: 'Playfair Display', serif; background:#fff; color:#2f2420; margin:0; padding:32px}
      .card{border:6px solid #efe6dc;padding:36px;border-radius:8px;max-width:720px;margin:0 auto;text-align:center}
      h1{margin:0 0 8px;font-size:40px}
      p{margin:0 0 12px;color:#6f5b4d}
      footer{margin-top:18px;color:#9a8f87;font-size:12px}
    </style></head><body><div class="card"><h1>Happy Birthday Mum</h1><p>For all the quiet ways you held our days together</p><footer>Made with love</footer></div></body></html>
  `;
  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
});

/* small helper */
function escapeHtml(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* Accessibility: respect prefers-reduced-motion */
const mediaReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
if(mediaReduced.matches){
  gsap.globalTimeline.timeScale(0); // pause decorative gsap motion while keeping essential UI
}

/* Performance tip fallbacks */
setTimeout(()=> {
  // if Three renderer didn't initialize properly, hide canvas and leave graceful fallback
  if(!renderer || !renderer.getContext()) {
    canvas.style.display = 'none';
  }
},1200);

/* Small interaction polish: portrait tilt on pointer move */
(function portraitTilt(){
  const wrap = portraitLarge.closest('.portrait-large');
  if(!wrap) return;
  wrap.addEventListener('pointermove', e=>{
    const r = wrap.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;
    gsap.to(portraitLarge, {rotationY: nx * 8, rotationX: -ny * 6, transformOrigin:'center', ease:'power2.out', duration:0.7});
  });
  wrap.addEventListener('pointerleave', ()=>{
    gsap.to(portraitLarge, {rotationX:0,rotationY:0,duration:0.6,ease:'power2.out'});
  });
})();

/* Scroll-triggered animations for sections */
(function scrollAnimations(){
  // Tribute section
  gsap.from('#tribute .left, #tribute .right > *', {
    scrollTrigger: { trigger: '#tribute', start: 'top 80%' },
    opacity: 0, y: 30, stagger: 0.1, duration: 0.9, ease: 'power2.out'
  });

  // Parallax for large portrait
  gsap.to('#portraitLarge', {
    yPercent: -8,
    ease: 'none',
    scrollTrigger: {
      trigger: '#tribute',
      start: 'top bottom',
      end: 'bottom top',
      scrub: true
    }
  });

  // Parallax for large portrait
  gsap.to('#portraitLarge', {
    yPercent: -8,
    ease: 'none',
    scrollTrigger: {
      trigger: '#tribute',
      start: 'top bottom',
      end: 'bottom top',
      scrub: true
    }
  });

})();


/* focus outlines for keyboard users */
document.addEventListener('keydown', e=>{
  if(e.key === 'Tab') document.documentElement.classList.add('show-focus');
});
document.addEventListener('mousedown', ()=> document.documentElement.classList.remove('show-focus'));

});
