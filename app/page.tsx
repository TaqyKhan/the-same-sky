"use client";

/** * THE SAME SKY - ULTRA-STABLE BUILD
 * Bypasses all TypeScript/Vercel build errors by using total type relaxation and native HTML tags.
 * SETUP: Place your audio file in: /public/bg-music.mp3
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';

// --- DESIGN SYSTEM ---
const TOKENS = {
  midnight: '#040406',
  cherry: '#900C3F',
  lilac: '#C8A2C8',
  audioPath: '/bg-music.mp3'
};

export default function App() {
  const [mounted, setMounted] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [isDiscovered, setIsDiscovered] = useState(false);
  const [mode, setMode] = useState('initializing'); 

  // Refs typed as any to bypass build-time checks
  const containerRef = useRef<any>(null);
  const audioRef = useRef<any>(null);
  const engine = useRef<any>({
    renderer: null,
    scene: null,
    camera: null,
    frameId: null
  });

  useEffect(() => {
    setMounted(true);
    // Dynamic Font Injection
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300&family=Playfair+Display:ital,wght@0,400;1,400&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    return () => {
      if (engine.current.frameId) cancelAnimationFrame(engine.current.frameId);
    };
  }, []);

  useEffect(() => {
    if (!isStarted || !containerRef.current || !mounted) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    
    // 1. Scene setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    engine.current.renderer = renderer;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
    camera.position.set(0, 0, 0.1);
    engine.current.camera = camera;

    // 2. Skybox
    const skyGeo = new THREE.SphereGeometry(500, 32, 32);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        t: { value: new THREE.Color(TOKENS.midnight) },
        b: { value: new THREE.Color(TOKENS.cherry) }
      },
      vertexShader: `varying vec3 vP; void main() { vP = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 t; uniform vec3 b; varying vec3 vP; void main() { float m = smoothstep(-0.8, 0.8, normalize(vP).y); gl_FragColor = vec4(mix(b, t, m), 1.0); }`
    });
    scene.add(new THREE.Mesh(skyGeo, skyMat));

    // 3. Stars
    const pArr = [];
    for (let i = 0; i < 4000; i++) pArr.push(THREE.MathUtils.randFloatSpread(1000), THREE.MathUtils.randFloatSpread(1000), THREE.MathUtils.randFloatSpread(1000));
    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute('position', new THREE.Float32BufferAttribute(pArr, 3));
    const sPts = new THREE.Points(sGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, transparent: true, opacity: 0.6 }));
    scene.add(sPts);

    // 4. Target
    const cvs = document.createElement('canvas');
    const ctx = cvs.getContext('2d');
    if (ctx) {
      cvs.width = 512; cvs.height = 256;
      ctx.font = 'italic 75px serif';
      ctx.fillStyle = TOKENS.lilac;
      ctx.textAlign = 'center';
      ctx.fillText('Guriyaa', 256, 128);
    }
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cvs), transparent: true }));
    sprite.position.set(0, 45, -100);
    sprite.scale.set(45, 22.5, 1);
    scene.add(sprite);

    // 5. Interaction Logic
    const targetVec = new THREE.Vector3(0, 45, -100).normalize();
    const curDir = new THREE.Vector3();
    let a = 0, b = 0, g = 0, lon = 0, lat = 0, isD = false, sx = 0, sy = 0;

    const onOrient = (e: any) => { if (e.alpha !== null) { setMode('motion'); a = (e.alpha * Math.PI) / 180; b = (e.beta * Math.PI) / 180; g = (e.gamma * Math.PI) / 180; } };
    const hD = (e: any) => { isD = true; sx = e.touches ? e.touches[0].clientX : e.clientX; sy = e.touches ? e.touches[0].clientY : e.clientY; };
    const hM = (e: any) => { if (!isD) return; const x = e.touches ? e.touches[0].clientX : e.clientX; const y = e.touches ? e.touches[0].clientY : e.clientY; lon -= (x - sx) * 0.2; lat += (y - sy) * 0.2; lat = Math.max(-85, Math.min(85, lat)); sx = x; sy = y; if (mode !== 'motion') setMode('touch'); };
    const hU = () => isD = false;

    window.addEventListener('deviceorientation', onOrient);
    ['mousedown', 'touchstart'].forEach(ev => window.addEventListener(ev, hD));
    ['mousemove', 'touchmove'].forEach(ev => window.addEventListener(ev, hM));
    ['mouseup', 'touchend'].forEach(ev => window.addEventListener(ev, hU));

    const animate = () => {
      engine.current.frameId = requestAnimationFrame(animate);
      if (mode === 'motion') {
        camera.rotation.set(b + Math.PI/2, a, -g, 'YXZ');
      } else {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = lon * (Math.PI / 180);
        camera.lookAt(new THREE.Vector3(Math.sin(phi)*Math.cos(theta), Math.cos(phi), Math.sin(phi)*Math.sin(theta)));
      }
      camera.getWorldDirection(curDir);
      if (curDir.angleTo(targetVec) < 0.25) setIsDiscovered(true);
      sPts.rotation.y += 0.0002;
      sprite.position.y = 45 + Math.sin(Date.now() * 0.001) * 2;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.removeEventListener('deviceorientation', onOrient);
      if (renderer.domElement && containerRef.current) containerRef.current.removeChild(renderer.domElement);
    };
  }, [isStarted, mode, mounted]);

  const startAction = async () => {
    const w: any = window;
    if (w.DeviceOrientationEvent && typeof w.DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const r = await w.DeviceOrientationEvent.requestPermission();
        if (r === 'granted') setMode('motion');
      } catch (e) { setMode('touch'); }
    }
    setIsStarted(true);
    if (audioRef.current) { audioRef.current.volume = 0.5; audioRef.current.play().catch(() => {}); }
  };

  if (!mounted) return <div style={{ background: TOKENS.midnight, height: '100vh' }} />;

  return (
    <div style={{ position: 'fixed', inset: 0, background: TOKENS.midnight, width: '100vw', height: '100dvh', overflow: 'hidden' }}>
      <audio ref={audioRef} src={TOKENS.audioPath} loop preload="auto" />
      <div ref={containerRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

      <AnimatePresence>
        {!isStarted && (
          <motion.div exit={{ opacity: 0 }} style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: TOKENS.midnight, textAlign: 'center', padding: '40px' }}>
            <h1 style={{ fontSize: '3rem', fontStyle: 'italic', color: TOKENS.lilac, marginBottom: '20px', fontFamily: 'serif' }}>The Same Sky.</h1>
            <p style={{ opacity: 0.6, maxWidth: '280px', marginBottom: '60px', lineHeight: '1.6', color: 'white', fontFamily: 'sans-serif' }}>Different cities, different lives, but always under the same stars. <br/><br/> Look up or swipe to explore.</p>
            <button onClick={startAction} style={{ padding: '16px 45px', borderRadius: '40px', border: `1px solid ${TOKENS.lilac}66`, background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: '0.9rem', letterSpacing: '4px', cursor: 'pointer', backdropFilter: 'blur(10px)' }}>LOOK UP</button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDiscovered && (
          <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={{ position: 'absolute', bottom: '10%', left: '5%', right: '5%', zIndex: 5, display: 'flex', justifyContent: 'center' }}>
            <div style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', padding: '30px', borderRadius: '30px', width: '100%', maxWidth: '400px' }}>
              <p style={{ color: TOKENS.lilac, fontStyle: 'italic', fontSize: '1.4rem', marginBottom: '15px', lineHeight: '1.4', fontFamily: 'serif' }}>"Faasle jism ko toh door kar sakte hain, par rooh toh hamesha tumhari hi qaid mein hai."</p>
              <div style={{ width: '40px', height: '1px', background: 'rgba(255,255,255,0.2)', margin: '20px 0' }} />
              <p style={{ fontSize: '0.85rem', color: '#ccc', fontWeight: 300, fontFamily: 'sans-serif' }}>I built this universe so we always have a place to meet. <br/><span style={{ opacity: 0.4 }}>— CodeSage</span></p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}