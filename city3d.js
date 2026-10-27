/* =====================================================================
   506 Logistics — Ciudad 3D animada para el hero
   Requiere three.js r128 (UMD) cargado antes:
   <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
   Uso: <div class="hero-3d" data-city3d></div> dentro del hero.
   ===================================================================== */
(function () {
  'use strict';

  var host = document.querySelector('[data-city3d]');
  if (!host || !window.THREE) return;

  // ¿Soporta WebGL? Si no, se queda el fondo SVG de respaldo.
  try {
    var test = document.createElement('canvas');
    if (!(test.getContext('webgl') || test.getContext('experimental-webgl'))) return;
  } catch (e) { return; }

  var THREE = window.THREE;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isSmall = window.innerWidth < 760;

  // ---------- Paleta 506 ----------
  var C = {
    bg: 0x0a0e3a,
    ground: 0x070a2c,
    street: 0x161e66,
    bldA: new THREE.Color(0x111862),
    bldB: new THREE.Color(0x2a38b0),
    signal: 0xf2e94e,
    white: 0xe9ecff,
    window: 0xffe58a
  };

  // ---------- Escena ----------
  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmall ? 1.25 : 1.6));
  renderer.setClearColor(C.bg, 1);
  host.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(C.bg, 0.0058);

  var camera = new THREE.PerspectiveCamera(36, 1, 1, 800);

  scene.add(new THREE.HemisphereLight(0x6f7dff, 0x05071f, 0.75));
  var sun = new THREE.DirectionalLight(0xffffff, 0.7);
  sun.position.set(-70, 110, 30);
  var rim = new THREE.DirectionalLight(0x8f9cff, 0.35);
  rim.position.set(80, 40, -60);
  scene.add(rim);
  scene.add(sun);

  // ---------- Cuadrícula de la ciudad ----------
  var N = 14;            // manzanas por lado
  var P = 12;            // distancia entre calles
  var ST = 3;            // ancho de calle
  var HALF = (N * P) / 2;
  function nodePos(i, j) { return new THREE.Vector3(-HALF + i * P, 0, -HALF + j * P); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randi(a, b) { return Math.floor(rand(a, b + 1)); }

  // Suelo
  var ground = new THREE.Mesh(
    new THREE.PlaneGeometry(N * P + 80, N * P + 80),
    new THREE.MeshLambertMaterial({ color: C.ground })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Calles (franjas apenas más claras)
  var streetMat = new THREE.MeshBasicMaterial({ color: C.street });
  var streetGeoH = new THREE.PlaneGeometry(N * P + ST, ST);
  for (var k = 0; k <= N; k++) {
    var h = new THREE.Mesh(streetGeoH, streetMat);
    h.rotation.x = -Math.PI / 2; h.position.set(0, 0.02, -HALF + k * P); scene.add(h);
    var v = new THREE.Mesh(streetGeoH, streetMat);
    v.rotation.x = -Math.PI / 2; v.rotation.z = Math.PI / 2; v.position.set(-HALF + k * P, 0.02, 0); scene.add(v);
  }

  // ---------- Edificios (un solo InstancedMesh) ----------
  var HUB = { i: 7, j: 7 };     // bodega 506 (esquina de manzana central)
  var lots = [];
  for (var bi = 0; bi < N; bi++) {
    for (var bj = 0; bj < N; bj++) {
      var cx = -HALF + bi * P + P / 2, cz = -HALF + bj * P + P / 2;
      var inner = P - ST - 1.2;                 // espacio útil de la manzana
      var dist = Math.hypot(cx, cz) / HALF;     // 0 centro → 1.4 esquina
      var parts = Math.random() < 0.5 ? 2 : (Math.random() < 0.6 ? 3 : 4);
      var cols = parts >= 3 ? 2 : (Math.random() < 0.5 ? 2 : 1);
      var rows = Math.ceil(parts / cols);
      var w = inner / cols, d = inner / rows;
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        if (r * cols + c >= parts) continue;
        var tall = Math.max(0.15, 1.15 - dist * 0.75);
        var hgt = rand(2, 5) + Math.pow(Math.random(), 2.2) * 22 * tall;
        lots.push({
          x: cx - inner / 2 + w * (c + 0.5), z: cz - inner / 2 + d * (r + 0.5),
          w: w - rand(0.6, 1.4), d: d - rand(0.6, 1.4), h: hgt
        });
      }
    }
  }
  var bGeo = new THREE.BoxGeometry(1, 1, 1);
  bGeo.translate(0, 0.5, 0);
  var bMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  var buildings = new THREE.InstancedMesh(bGeo, bMat, lots.length);
  var m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3();
  var col = new THREE.Color();
  lots.forEach(function (L, idx) {
    m4.compose(p3.set(L.x, 0, L.z), q, s3.set(L.w, L.h, L.d));
    buildings.setMatrixAt(idx, m4);
    col.copy(C.bldA).lerp(C.bldB, Math.min(1, L.h / 30) * 0.7 + Math.random() * 0.25);
    buildings.setColorAt(idx, col);
  });
  scene.add(buildings);

  // Ventanas encendidas (puntos sobre las fachadas)
  var winCount = isSmall ? 900 : 1800, winPos = new Float32Array(winCount * 3);
  for (var wi = 0; wi < winCount; wi++) {
    var L = lots[randi(0, lots.length - 1)];
    var side = randi(0, 3), y = rand(1.2, Math.max(1.4, L.h - 0.8));
    var px = L.x, pz = L.z;
    if (side === 0) { px += L.w / 2 + 0.05; pz += rand(-L.d / 2, L.d / 2) * 0.85; }
    if (side === 1) { px -= L.w / 2 + 0.05; pz += rand(-L.d / 2, L.d / 2) * 0.85; }
    if (side === 2) { pz += L.d / 2 + 0.05; px += rand(-L.w / 2, L.w / 2) * 0.85; }
    if (side === 3) { pz -= L.d / 2 + 0.05; px += rand(-L.w / 2, L.w / 2) * 0.85; }
    winPos.set([px, y, pz], wi * 3);
  }
  var winGeo = new THREE.BufferGeometry();
  winGeo.setAttribute('position', new THREE.BufferAttribute(winPos, 3));
  scene.add(new THREE.Points(winGeo, new THREE.PointsMaterial({
    color: C.window, size: 0.45, transparent: true, opacity: 0.55, depthWrite: false
  })));

  // ---------- Bodega 506 (hub) con faro ----------
  var hubPos = nodePos(HUB.i, HUB.j);
  var hub = new THREE.Mesh(new THREE.BoxGeometry(5.5, 3, 5.5), new THREE.MeshLambertMaterial({ color: 0x2438d6, emissive: 0x0b1260 }));
  hub.position.set(hubPos.x + P / 2, 1.5, hubPos.z + P / 2);
  scene.add(hub);
  var beamMat = new THREE.MeshBasicMaterial({ color: C.signal, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending });
  var beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 1.4, 60, 16, 1, true), beamMat);
  beam.position.set(hub.position.x, 31.5, hub.position.z);
  scene.add(beam);

  // ---------- Tráfico ambiente ----------
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  function inside(i, j) { return i >= 0 && j >= 0 && i <= N && j <= N; }
  function makeCar() {
    var i = randi(0, N), j = randi(0, N), d = DIRS[randi(0, 3)];
    if (!inside(i + d[0], j + d[1])) d = [-d[0], -d[1]];
    return { i: i, j: j, d: d, t: Math.random(), speed: rand(0.18, 0.42) };
  }
  function nextDir(car) {
    var options = DIRS.filter(function (dd) {
      return inside(car.i + dd[0], car.j + dd[1]) && !(dd[0] === -car.d[0] && dd[1] === -car.d[1]);
    });
    if (!options.length) return [-car.d[0], -car.d[1]];
    // Preferir seguir derecho
    var straight = options.filter(function (dd) { return dd[0] === car.d[0] && dd[1] === car.d[1]; });
    if (straight.length && Math.random() < 0.6) return straight[0];
    return options[randi(0, options.length - 1)];
  }
  var carCount = isSmall ? 34 : 70;
  var cars = [];
  for (var ci = 0; ci < carCount; ci++) cars.push(makeCar());
  var carGeo = new THREE.BoxGeometry(2.2, 1.1, 1.2); carGeo.translate(0, 0.55, 0);
  var carMesh = new THREE.InstancedMesh(carGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), carCount);
  cars.forEach(function (c, idx) {
    carMesh.setColorAt(idx, new THREE.Color(Math.random() < 0.22 ? C.signal : 0x9aa6ff));
  });
  scene.add(carMesh);
  var yAxis = new THREE.Vector3(0, 1, 0);

  function placeCar(c, idx) {
    var a = nodePos(c.i, c.j), b = nodePos(c.i + c.d[0], c.j + c.d[1]);
    var pos = a.lerp(b, c.t);
    // carril derecho
    pos.x += -c.d[1] * 0.75; pos.z += c.d[0] * 0.75;
    q.setFromAxisAngle(yAxis, Math.atan2(-c.d[1], c.d[0]));
    m4.compose(pos, q, s3.set(1, 1, 1));
    carMesh.setMatrixAt(idx, m4);
  }

  // ---------- Entregas: van 506 + ruta que se dibuja + pin de destino ----------
  var deliveries = [];
  var routeMat = new THREE.MeshBasicMaterial({ color: C.signal, transparent: true, opacity: 1, depthWrite: false });
  var ghostMat = new THREE.MeshBasicMaterial({ color: C.signal, transparent: true, opacity: 0.22, depthWrite: false });
  var vanGeo = new THREE.BoxGeometry(3.4, 2, 1.8); vanGeo.translate(0, 0.65, 0);
  var vanMat = new THREE.MeshBasicMaterial({ color: C.signal });
  var pinGeo = new THREE.ConeGeometry(0.9, 2.4, 16); pinGeo.rotateX(Math.PI); pinGeo.translate(0, 1.2, 0);
  var pinHead = new THREE.SphereGeometry(1.05, 16, 12);
  var ringGeo = new THREE.RingGeometry(1.4, 1.75, 40); ringGeo.rotateX(-Math.PI / 2);

  function manhattanPath(from, to) {
    var nodes = [{ i: from.i, j: from.j }], i = from.i, j = from.j;
    while (i !== to.i || j !== to.j) {
      var moveI = i !== to.i && (j === to.j || Math.random() < 0.5);
      if (moveI) i += Math.sign(to.i - i); else j += Math.sign(to.j - j);
      nodes.push({ i: i, j: j });
    }
    return nodes.map(function (n) { return nodePos(n.i, n.j); });
  }

  // Cinta plana a lo largo del recorrido (las líneas WebGL siempre miden 1px)
  function ribbon(points, width) {
    var verts = [];
    for (var k = 0; k < points.length - 1; k++) {
      var a = points[k], b = points[k + 1];
      var dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1;
      var nx = -dz / len * width / 2, nz = dx / len * width / 2, y = 0.08;
      verts.push(a.x + nx, y, a.z + nz, b.x + nx, y, b.z + nz, b.x - nx, y, b.z - nz,
                 a.x + nx, y, a.z + nz, b.x - nx, y, b.z - nz, a.x - nx, y, a.z - nz);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    return g;
  }

  function samplePath(nodes, step) {
    var pts = [nodes[0].clone()];
    for (var k = 0; k < nodes.length - 1; k++) {
      var a = nodes[k], b = nodes[k + 1], len = a.distanceTo(b), n = Math.max(1, Math.round(len / step));
      for (var s = 1; s <= n; s++) pts.push(a.clone().lerp(b, s / n));
    }
    return pts;
  }

  function newDelivery(slot) {
    var from = slot.at || { i: HUB.i, j: HUB.j };
    var to;
    do { to = { i: randi(1, N - 1), j: randi(1, N - 1) }; }
    while (Math.abs(to.i - from.i) + Math.abs(to.j - from.j) < 4);
    var nodes = manhattanPath(from, to);
    var pts = samplePath(nodes, 1);
    var geo = ribbon(pts, 1.7);
    var trail = new THREE.Mesh(geo, routeMat.clone());
    var ghost = new THREE.Mesh(geo, ghostMat.clone());
    trail.geometry.setDrawRange(0, 0);
    var end = pts[pts.length - 1];
    var pin = new THREE.Group();
    pin.add(new THREE.Mesh(pinGeo, vanMat));
    var head = new THREE.Mesh(pinHead, vanMat); head.position.y = 3.2; pin.add(head);
    pin.position.set(end.x, 0, end.z);
    var ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: C.signal, transparent: true, opacity: 0, depthWrite: false }));
    ring.position.set(end.x, 0.1, end.z);
    scene.add(ghost, trail, pin, ring);
    // La ruta se recorre a velocidad constante
    slot.ghost = ghost; slot.trail = trail; slot.pin = pin; slot.ring = ring;
    slot.pts = pts; slot.p = 0; slot.state = 'drive';
    slot.speed = rand(7, 10);          // unidades por segundo
    slot.pause = 0; slot.to = to;
  }

  function clearDelivery(slot) {
    scene.remove(slot.ghost, slot.trail, slot.pin, slot.ring);
    slot.trail.geometry.dispose();                 // la ruta es única de esta entrega
    slot.trail.material.dispose(); slot.ghost.material.dispose(); slot.ring.material.dispose();
  }

  var deliveryCount = isSmall ? 3 : 5;
  for (var di = 0; di < deliveryCount; di++) {
    var van = new THREE.Mesh(vanGeo, vanMat);
    scene.add(van);
    var slot = { van: van, at: null };
    newDelivery(slot);
    slot.p = Math.random() * slot.pts.length * 0.6;   // arrancan en distintos puntos
    deliveries.push(slot);
  }

  function updateDelivery(slot, dt, time) {
    var pts = slot.pts, last = pts.length - 1;
    slot.pin.children[1].position.y = 3.2 + Math.sin(time * 3 + slot.speed) * 0.25;
    if (slot.state === 'drive') {
      slot.p = Math.min(last, slot.p + slot.speed * dt);
      var k = Math.floor(slot.p), f = slot.p - k;
      var a = pts[k], b = pts[Math.min(last, k + 1)];
      if (!a || !b) { slot.state = 'deliver'; return; }
      slot.van.position.set(a.x + (b.x - a.x) * f, 0, a.z + (b.z - a.z) * f);
      if (b.x !== a.x || b.z !== a.z) slot.van.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x);
      slot.trail.geometry.setDrawRange(0, Math.floor(slot.p) * 6);
      if (slot.p >= last) { slot.state = 'deliver'; slot.pause = 0; }
    } else if (slot.state === 'deliver') {
      // Entregado: pulso del anillo y desvanecimiento de la ruta
      slot.pause += dt;
      var t = Math.min(1, slot.pause / 1.6);
      slot.ring.scale.setScalar(1 + t * 4);
      slot.ring.material.opacity = 0.9 * (1 - t);
      slot.trail.material.opacity = 1 - t;
      slot.ghost.material.opacity = 0.22 * (1 - t);
      slot.pin.scale.setScalar(1 - t * 0.9);
      if (t >= 1) {
        clearDelivery(slot);
        slot.at = Math.random() < 0.45 ? null : slot.to;   // vuelve a la bodega o sigue
        newDelivery(slot);
      }
    }
  }

  // ---------- Cámara, tamaño y ciclo ----------
  var angle = -0.55;
  function frameCamera(time) {
    var r = isSmall ? 150 : 138;
    var hgt = isSmall ? 110 : 88;
    camera.position.set(Math.cos(angle) * r, hgt + Math.sin(time * 0.15) * 2, Math.sin(angle) * r);
    camera.lookAt(0, 0, 0);
  }

  function resize() {
    var w = host.clientWidth || window.innerWidth, hgt = host.clientHeight || 700;
    isSmall = w < 760;
    renderer.setSize(w, hgt, false);
    camera.aspect = w / hgt;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  var running = true, visible = true, last = performance.now(), time = 0;
  function tick(now) {
    if (!running) return;
    try { step(now); } catch (err) { if (window.console) console.warn('[city3d]', err); }
    requestAnimationFrame(tick);
  }
  function step(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
    angle += dt * 0.025;
    frameCamera(time);

    cars.forEach(function (c, idx) {
      c.t += c.speed * dt * 0.55;
      if (c.t >= 1) { c.i += c.d[0]; c.j += c.d[1]; c.t -= 1; c.d = nextDir(c); }
      placeCar(c, idx);
    });
    carMesh.instanceMatrix.needsUpdate = true;
    deliveries.forEach(function (sl) { updateDelivery(sl, dt, time); });
    beamMat.opacity = 0.14 + Math.sin(time * 2) * 0.05;

    renderer.render(scene, camera);
  }

  function start() {
    if (running || reduceMotion) return;
    running = true; last = performance.now(); requestAnimationFrame(tick);
  }
  function stop() { running = false; }

  // Primer cuadro
  cars.forEach(placeCar); carMesh.instanceMatrix.needsUpdate = true;
  deliveries.forEach(function (sl) { updateDelivery(sl, 0.016, 0); });
  frameCamera(0);
  renderer.render(scene, camera);
  host.closest('.hero') && host.closest('.hero').classList.add('has-3d');

  if (reduceMotion) { running = false; return; }   // movimiento reducido: imagen fija

  requestAnimationFrame(tick);

  // Pausar cuando el hero no está a la vista o la pestaña está oculta
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible && !document.hidden) start(); else stop();
    }, { threshold: 0.01 }).observe(host);
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else if (visible) start();
  });
})();
