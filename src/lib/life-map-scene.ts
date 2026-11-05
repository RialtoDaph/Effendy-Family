// The Life Map's 3D scene: particle clusters, connecting streams, floating labels.
// Browser only; three.js is loaded on demand so no other screen pays for it.

import type * as Three from "three";
import type { MapGraph, MapNode } from "./life-map";

export type LifeMapScene = {
  setGraph: (graph: MapGraph) => void;
  setSelected: (id: string | null) => void;
  setSpin: (on: boolean) => void;
  fit: () => void;
  /** Re-reads the theme's colours. */
  repaint: () => void;
  dispose: () => void;
};

const WIDE = 700;
const clampZoom = (r: number) => Math.max(90, Math.min(640, r));

export async function createLifeMapScene(host: HTMLElement, labels: HTMLElement, onSelect: (id: string | null) => void): Promise<LifeMapScene> {
  const THREE = await import("three");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rect = host.getBoundingClientRect();

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(rect.width, rect.height);
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.style.cssText = "position:absolute;inset:0;touch-action:none;outline:none";
  host.insertBefore(canvas, host.firstChild);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, Math.max(1, rect.width) / Math.max(1, rect.height), 1, 3000);
  const sphere = new THREE.SphereGeometry(1, 28, 18);
  const ray = new THREE.Raycaster();
  const v2 = new THREE.Vector2();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const look = new THREE.Vector3();

  // A phone is narrow, so it stands further back to keep all four areas in view.
  const fitZoom = () => clampZoom(250 * Math.max(1, 0.8 / camera.aspect));
  const orbit = { th: 0.7, ph: 1.15, r: fitZoom() };
  let zoom = orbit.r;
  let lastTouch = 0;
  let spin = !reduced;
  let selected: string | null = null;
  let hover: string | null = null;
  let graph: MapGraph | null = null;
  let focusHub: string | null | undefined;

  let byId: Record<string, MapNode> = {};
  let meshes: Record<string, Three.Mesh> = {};
  let glows: Record<string, Three.Mesh> = {};
  let tags: Record<string, HTMLDivElement & { show?: boolean; x?: number; y?: number }> = {};
  let ring: Three.Mesh | null = null;
  let lines: Three.LineSegments | null = null;
  let linePos = new Float32Array(0);
  let lineBase = 0.35;
  let streams: Three.Points | null = null;
  let streamPos = new Float32Array(0);
  let streamPhase = new Float32Array(0);
  let streamJitter = new Float32Array(0);
  const STREAM = 54;

  function clear() {
    for (const o of [...scene.children]) {
      o.traverse((c) => {
        const m = c as Three.Mesh;
        if (m.geometry && m.geometry !== sphere) m.geometry.dispose();
        (m.material as Three.Material | undefined)?.dispose?.();
      });
      scene.remove(o);
    }
  }

  function build() {
    if (!graph) return;
    clear();
    const css = getComputedStyle(document.documentElement);
    const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    const bg = new THREE.Color(token("--bg", "#ffffff"));
    const dark = bg.r * 0.2126 + bg.g * 0.7152 + bg.b * 0.0722 < 0.4;
    const blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
    const colors: Record<string, string> = {
      acc: token("--acc", "#3355FF"),
      ok: token("--ok", "#0E9F5B"),
      warn: token("--warn", "#E0A100"),
      bad: token("--bad", "#E5383B"),
      neu: token("--mut2", "#8E94A0"),
    };
    const { nodes, edges } = graph;
    byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    meshes = {};
    glows = {};
    focusHub = undefined;

    for (const n of nodes) {
      const col = new THREE.Color(colors[n.st] ?? colors.neu);
      // The mesh is the invisible tap target; the particles are what you see.
      const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 1, visible: false });
      const mesh = new THREE.Mesh(sphere, mat);
      mesh.scale.setScalar(n.r);
      mesh.position.set(...n.pos);
      mesh.userData.id = n.id;
      scene.add(mesh);
      meshes[n.id] = mesh;

      const count = n.kind === "core" ? 1200 : n.kind === "hub" ? 560 : 150;
      const pa = new Float32Array(count * 3);
      for (let q = 0; q < count; q++) {
        const u = Math.random() * 2 - 1;
        const th = Math.random() * Math.PI * 2;
        const rr = n.kind === "core" ? 1.25 + (Math.random() - 0.5) * 0.35 : Math.pow(Math.random(), 1.5) * 1.5;
        const sq = Math.sqrt(1 - u * u);
        pa.set([Math.cos(th) * sq * rr, u * rr, Math.sin(th) * sq * rr], q * 3);
      }
      const pg = new THREE.BufferGeometry();
      pg.setAttribute("position", new THREE.BufferAttribute(pa, 3));
      const pts = new THREE.Points(
        pg,
        new THREE.PointsMaterial({
          color: col,
          size: n.kind === "core" ? 0.055 : n.kind === "hub" ? 0.085 : 0.18,
          sizeAttenuation: true,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
          blending,
        }),
      );
      mesh.add(pts);
      mesh.userData.pts = pts;

      const glow = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: dark ? 0.07 : 0.06, blending, depthWrite: false }));
      glow.scale.setScalar(n.r * (n.kind === "core" ? 2.6 : 2));
      glow.position.copy(mesh.position);
      scene.add(glow);
      glows[n.id] = glow;
    }

    ring = new THREE.Mesh(new THREE.TorusGeometry(10.5, 0.45, 10, 80), new THREE.MeshBasicMaterial({ color: new THREE.Color(colors.acc) }));
    scene.add(ring);

    linePos = new Float32Array(edges.length * 6);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
    lineBase = dark ? 0.12 : 0.35;
    lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: new THREE.Color(dark ? colors.acc : token("--line2", "#CDD1D8")), transparent: true, opacity: lineBase }));
    lines.frustumCulled = false;
    scene.add(lines);

    streamPhase = Float32Array.from({ length: edges.length * STREAM }, () => Math.random());
    streamJitter = Float32Array.from({ length: edges.length * STREAM * 3 }, () => (Math.random() - 0.5) * 1.6);
    streamPos = new Float32Array(edges.length * STREAM * 3);
    const streamCol = new Float32Array(edges.length * STREAM * 3);
    edges.forEach(([, b], i) => {
      const c = new THREE.Color(colors[byId[b]?.st] ?? colors.acc);
      for (let q = 0; q < STREAM; q++) streamCol.set([c.r, c.g, c.b], (i * STREAM + q) * 3);
    });
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(streamPos, 3));
    sg.setAttribute("color", new THREE.BufferAttribute(streamCol, 3));
    streams = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.42, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, blending }));
    streams.frustumCulled = false;
    scene.add(streams);

    labels.replaceChildren();
    tags = {};
    for (const n of nodes) {
      const d = document.createElement("div");
      d.style.cssText = "position:absolute;left:0;top:0;opacity:0;white-space:nowrap;pointer-events:none;transition:opacity .2s;color:var(--ink);will-change:transform";
      if (n.kind === "core") {
        d.style.textAlign = "center";
        const num = document.createElement("div");
        num.style.cssText = "font-family:var(--font-serif);font-size:40px;line-height:1";
        num.textContent = n.val === null || n.val === undefined ? "—" : String(n.val);
        const cap = document.createElement("div");
        cap.style.cssText = "font-family:var(--font-mono);font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--mut2);margin-top:2px";
        cap.textContent = n.label;
        d.append(num, cap);
      } else if (n.kind === "hub") {
        d.style.cssText += ";font-size:12.5px;font-weight:800;padding:4px 10px;border-radius:999px;background:var(--card);border:1px solid var(--line);box-shadow:0 2px 10px rgba(0,0,0,.08)";
        d.textContent = n.val === null || n.val === undefined ? n.label : `${n.label}  ${n.val}`;
      } else {
        d.style.cssText += ";font-size:11.5px;font-weight:700;text-shadow:0 0 6px var(--bg),0 0 3px var(--bg),0 0 2px var(--bg)";
        d.textContent = n.label;
      }
      labels.appendChild(d);
      tags[n.id] = d;
    }
  }

  function hit(e: PointerEvent) {
    const r = canvas.getBoundingClientRect();
    v2.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(v2, camera);
    const first = ray.intersectObjects(Object.values(meshes), false)[0];
    return first ? (first.object.userData.id as string) : null;
  }

  const pointers = new Map<number, { x: number; y: number }>();
  let moved = 0;
  let pinch: number | null = null;

  const onDown = (e: PointerEvent) => {
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {}
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = 0;
    lastTouch = performance.now();
    canvas.style.cursor = "grabbing";
  };
  const onMove = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId);
    if (!p) {
      if (e.pointerType === "mouse") hover = hit(e);
      return;
    }
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      orbit.th -= dx * 0.006;
      orbit.ph = Math.max(0.3, Math.min(2.85, orbit.ph - dy * 0.006));
      moved += Math.abs(dx) + Math.abs(dy);
    } else {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) zoom = clampZoom((zoom * pinch) / d);
      pinch = d;
      moved += 20;
    }
    lastTouch = performance.now();
  };
  const onUp = (e: PointerEvent) => {
    const had = pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    canvas.style.cursor = "";
    if (had && moved < 6 && e.type === "pointerup") onSelect(hit(e));
  };
  const onLeave = () => {
    hover = null;
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    zoom = clampZoom(zoom * (1 + e.deltaY * 0.0012));
    lastTouch = performance.now();
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("wheel", onWheel, { passive: false });

  const resize = new ResizeObserver(() => {
    const r = host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
    renderer.setSize(r.width, r.height);
  });
  resize.observe(host);

  function frame(t: number) {
    if (!graph || !lines || !ring) return;
    const { nodes, edges } = graph;
    const now = performance.now();
    const sel = selected ? byId[selected] : undefined;
    const ease = reduced ? 1 : 0.08;

    if (spin && now - lastTouch > 3500 && !sel) orbit.th += 0.0016;

    const hub = sel && sel.kind !== "core" ? byId[`h-${sel.hub}`] : undefined;
    if (hub) {
      const want = Math.atan2(hub.pos[2], hub.pos[0]);
      const d = Math.atan2(Math.sin(want - orbit.th), Math.cos(want - orbit.th));
      orbit.th += d * (reduced ? 1 : 0.06);
      orbit.ph += (1.25 - orbit.ph) * (reduced ? 1 : 0.06);
    }
    const items = hub ? nodes.filter((n) => n.hub === hub.hub && n.kind !== "hub").length : 0;
    orbit.r += ((sel ? 130 + items * 8 : zoom) - orbit.r) * ease;

    // Keep the chosen node clear of the panel: beside it when wide, above it on a phone.
    const wide = canvas.clientWidth > WIDE;
    if (sel) {
      tmp.copy(meshes[sel.id].position);
      if (wide) tmp.add(tmp2.set(Math.sin(orbit.th), 0, -Math.cos(orbit.th)).multiplyScalar(-orbit.r * 0.22));
      else tmp.y -= orbit.r * 0.12;
    } else tmp.set(0, 0, 0);
    look.lerp(tmp, ease);

    camera.position.set(
      look.x + orbit.r * Math.sin(orbit.ph) * Math.cos(orbit.th),
      look.y + orbit.r * Math.cos(orbit.ph),
      look.z + orbit.r * Math.sin(orbit.ph) * Math.sin(orbit.th),
    );
    camera.lookAt(look);

    const tt = reduced ? 0 : t / 1000;
    const inFocus = (n: MapNode) => !hub || n.id === sel?.id || n.id === hub.id || (n.hub === hub.hub && n.kind !== "hub");
    if (focusHub !== (hub?.id ?? null)) {
      focusHub = hub?.id ?? null;
      for (const n of nodes) {
        const on = inFocus(n);
        const pts = meshes[n.id].userData.pts as Three.Points;
        (pts.material as Three.PointsMaterial).opacity = on ? 0.9 : 0.08;
        glows[n.id].visible = on;
      }
      (lines.material as Three.LineBasicMaterial).opacity = hub ? 0.25 : lineBase;
    }

    for (const n of nodes) {
      const me = meshes[n.id];
      if (n.kind !== "core" && n.kind !== "hub") me.position.set(n.pos[0], n.pos[1] + Math.sin(tt * 0.8 + n.ph) * 1.2, n.pos[2]);
      glows[n.id].position.copy(me.position);
      const pulse = n.st === "bad" ? 1 + Math.sin(tt * 3 + n.ph) * 0.12 : 1;
      me.scale.setScalar(n.r * pulse * (hover === n.id || selected === n.id ? 1.35 : 1));
      (me.userData.pts as Three.Points).rotation.y = tt * 0.2 + n.ph;
    }

    ring.visible = !hub;
    ring.lookAt(camera.position);
    ring.rotation.z = tt * 0.4;

    edges.forEach(([a, b], i) => {
      const A = meshes[a].position;
      const B = meshes[b].position;
      linePos.set([A.x, A.y, A.z, B.x, B.y, B.z], i * 6);
      const show = !hub || (inFocus(byId[a]) && inFocus(byId[b]));
      for (let q = 0; q < STREAM; q++) {
        const o = (i * STREAM + q) * 3;
        if (!show) {
          streamPos[o] = streamPos[o + 1] = streamPos[o + 2] = 1e5;
          continue;
        }
        const p = (streamPhase[i * STREAM + q] + tt * 0.08) % 1;
        const w = Math.sin(p * Math.PI);
        streamPos[o] = A.x + (B.x - A.x) * p + streamJitter[o] * w;
        streamPos[o + 1] = A.y + (B.y - A.y) * p + streamJitter[o + 1] * w;
        streamPos[o + 2] = A.z + (B.z - A.z) * p + streamJitter[o + 2] * w;
      }
    });
    lines.geometry.attributes.position.needsUpdate = true;
    if (streams) streams.geometry.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const close = !sel && orbit.r < 150;
    for (const n of nodes) {
      const d = tags[n.id];
      const p = tmp.copy(meshes[n.id].position).project(camera);
      if (p.z > 1) {
        d.show = false;
        continue;
      }
      d.x = ((p.x + 1) / 2) * w;
      d.y = ((1 - p.y) / 2) * h + (n.kind === "core" ? 0 : (n.r * 380) / orbit.r + 12);
      d.style.transform = `translate(${d.x.toFixed(1)}px,${d.y.toFixed(1)}px) translate(-50%,-50%)`;
      d.show = hub ? inFocus(n) : n.kind === "core" || n.kind === "hub" || hover === n.id || close;
    }

    // Biggest labels first; anything that would overlap one already placed stays hidden.
    const placed: { l: number; r: number; t: number; b: number }[] = [];
    const rank = (n: MapNode) => (n.id === selected ? 3 : n.kind === "core" ? 2 : n.kind === "hub" ? 1 : 0);
    for (const n of [...nodes].sort((a, b) => rank(b) - rank(a) || b.r - a.r)) {
      const d = tags[n.id];
      if (!d.show) {
        d.style.opacity = "0";
        continue;
      }
      const R = { l: d.x! - d.offsetWidth / 2, r: d.x! + d.offsetWidth / 2, t: d.y! - d.offsetHeight / 2, b: d.y! + d.offsetHeight / 2 };
      if (n.id !== selected && placed.some((q) => R.l < q.r && R.r > q.l && R.t < q.b && R.b > q.t)) {
        d.style.opacity = "0";
        continue;
      }
      placed.push(R);
      d.style.opacity = "1";
    }
  }

  renderer.setAnimationLoop(frame);

  return {
    setGraph(next) {
      graph = next;
      build();
    },
    setSelected(id) {
      selected = id;
    },
    setSpin(on) {
      spin = on;
    },
    fit() {
      zoom = fitZoom();
      orbit.ph = 1.15;
    },
    repaint: build,
    dispose() {
      renderer.setAnimationLoop(null);
      resize.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("wheel", onWheel);
      clear();
      sphere.dispose();
      renderer.dispose();
      canvas.remove();
      labels.replaceChildren();
    },
  };
}
