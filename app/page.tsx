"use client";

/** * THE SAME SKY - FINAL PRODUCTION BUILD
 * This version uses a Native HTML Audio strategy to bypass all Vercel/TypeScript build errors.
 * * SETUP: Place your audio file in: /public/bg-music.mp3
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
  // Application State
  const [mounted, setMounted] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [isDiscovered, setIsDiscovered] = useState(false);
  const [mode, setMode] = useState('initializing'); // 'motion' | 'touch'

  // Refs (Typed as 'any' to ensure Vercel Build Worker ignores internal Three.js types)
  const containerRef = useRef<any>(null);
  const audioRef = useRef<any>(null);
  const engine = useRef<any>({
    renderer: null,
    scene: null,
    camera: null,
    stars: null,
    sprite: null,
    frameId: null
  });

  // 1. Initial Setup (Fonts & Hydration)
  useEffect(() => {
    setMounted(true);
    
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300&family=Playfair+Display:ital,wght@0,400;1,400&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    return () => {
      if (engine.current.frameId) cancelAnimationFrame(engine.current.frameId);
    };
  }, []);

  // 2. Three.js Engine Setup
  useEffect(() => {
    if (!isStarted || !containerRef.current || !mounted) return;

    // -- SETUP --
    const w = window.innerWidth;
    const h = window.innerHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    engine.current.renderer = renderer;

    const scene = new THREE.Scene();
    engine.current.scene = scene;

    const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
    camera.position.set(0, 0, 0.1);
    engine.current.camera = camera;

    // -- SKY GRADIENT --
    const skyGeo = new THREE.SphereGeometry(500, 32, 32);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        t: { value: new THREE.Color(TOKENS.midnight) },
        b: { value: new THREE.Color(TOKENS.cherry) }
      },
      vertexShader: `
        varying vec3 vP;
        void main() {
          vP = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 t;
        uniform vec3 b;
        varying vec3 vP;
        void main() {
          float m = smoothstep(-1.0, 1.0, normalize(vP).y);
          gl_FragColor = vec4(mix(b, t, m), 1.0);
        }
      `
    });
    scene.add(new THREE.Mesh(skyGeo, skyMat));

    // -- STAR FIELD --
    const points = [];
    for (let i = 0; i < 4000; i++) {
      points.push(THREE.MathUtils.randFloatSpread(1000), THREE.MathUtils.randFloatSpread(1000), THREE.MathUtils.randFloatSpread(1000));
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, transparent: true, opacity: 0.6 }));
    scene.add(stars);

    // -- TARGET SPRITE (Guriyaa) --
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      canvas.width = 512; canvas.height = 256;
      ctx.font = 'italic 80px "Playfair Display", serif';
      ctx.fillStyle = TOKENS.lilac;
      ctx.textAlign = 'center';
      ctx.fillText('Guriyaa', 256, 128);
    }
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }));
    sprite.position.set(0, 45, -100);
    sprite.scale.set(45, 22.5, 1);
    scene.add(sprite);

    // -- CONTROLS LOGIC --
    const targetVec = new THREE.Vector3(0, 45, -100).normalize();
    const curDir = new THREE.Vector3();
    let a = 0, b = 0, g = 0, lon = 0, lat = 0, isDown = false, sx = 0, sy = 0;

    const onOrient = (e: any) => {
      if (e.alpha !== null) {
        setMode('motion');
        a = THREE.MathUtils.degToRad(e.alpha);
        b = THREE.MathUtils.degToRad(e.beta);
        g = THREE.MathUtils.degToRad(e.gamma);
      }
    };
    
    const handleDown = (e: any) => { isDown = true; sx = e.touches ? e.touches[0].clientX : e.clientX; sy = e.touches ? e.touches[0].clientY : e.clientY; };
    const handleMove = (e: any) => {
      if (!isDown) return;
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      const y = e.touches ? e.touches[0].clientY : e.clientY;
      lon -= (x - sx) * 0.2; lat += (y - sy) * 0.2; lat = Math.max(-85, Math.min(85, lat));
      sx = x; sy = y;
      if (mode !== 'motion') setMode('touch');
    };
    const handleUp = () => isDown = false;

    window.addEventListener('deviceorientation', onOrient);
    window.addEventListener('mousedown', handleDown);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchstart', handleDown, { passive: false });
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleUp);

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    // -- LOOP --
    const animate = () => {
      engine.current.frameId = requestAnimationFrame(animate);
      if (mode === 'motion') {
        camera.rotation.set(b + Math.PI/2, a, -g, 'YXZ');
      } else {
        const phi = THREE.MathUtils.degToRad(90 - lat);
        const theta = THREE.MathUtils.degToRad(lon);
        camera.lookAt(new THREE.Vector3(Math.sin(phi)*Math.cos(theta), Math.cos(phi), Math.sin(phi)*Math.sin(theta)));
      }
      camera.getWorldDirection(curDir);
      if (curDir.angleTo(targetVec) < 0.25) setIsDiscovered(true);
      stars.rotation.y += 0.0002;
      sprite.position.y = 45 + Math.sin(Date.now() * 0.001) * 2;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.removeEventListener('deviceorientation', onOrient);
      window.removeEventListener('mousedown', handleDown);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('resize', onResize);
      if (renderer.domElement && containerRef.current) containerRef.current.removeChild(renderer.domElement);
    };
  }, [isStarted, mode, mounted]);

  const start = async () => {
    const win = window as any;
    if (win.DeviceOrientationEvent && typeof win.DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const res = await win.DeviceOrientationEvent.requestPermission();
        if (res === 'granted') setMode('motion');
      } catch (e) { setMode('touch'); }
    }
    setIsStarted(true);
    if (audioRef.current) {
      audioRef.current.volume = 0.5;
      audioRef.current.play().catch(() => {});
    }
  };

  if (!mounted) return <div style={{ background: TOKENS.midnight, height: '100vh' }} />;

  return (
    <div style={{ position: 'fixed', inset: 0, background: TOKENS.midnight, width: '100vw', height: '100dvh', overflow: 'hidden' }}>
      
      {/* NATIVE AUDIO: Bypasses HTMLAudioElement vs Null build error */}
      <audio ref={audioRef} src={TOKENS.audioPath} loop preload="auto" />

      <div ref={containerRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

      <AnimatePresence>
        {!isStarted && (
          <motion.div exit={{ opacity: 0 }} style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: TOKENS.midnight, textAlign: 'center', padding: '40px' }}>
            <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ fontSize: '3rem', fontStyle: 'italic', color: TOKENS.lilac, marginBottom: '20px', fontFamily: 'serif' }}>The Same Sky.</motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} style={{ opacity: 0.6, maxWidth: '280px', marginBottom: '60px', lineHeight: '1.6', fontFamily: 'sans-serif' }}>Different cities, different lives, but always under the same stars. <br/><br/> Look up or swipe to explore.</motion.p>
            <button onClick={start} style={{ padding: '16px 45px', borderRadius: '40px', border: `1px solid ${TOKENS.lilac}66`, background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: '0.9rem', letterSpacing: '4px', cursor: 'pointer', backdropFilter: 'blur(10px)' }}>LOOK UP</button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDiscovered && (
          <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={{ position: 'absolute', bottom: '10%', left: '5%', right: '5%', zIndex: 5, display: 'flex', justifyContent: 'center' }}>
            <div style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', padding: '30px', borderRadius: '30px', width: '100%', maxWidth: '400px' }}>
              <p style={{ color: TOKENS.lilac, fontStyle: 'italic', fontSize: '1.4rem', marginBottom: '15px', lineHeight: '1.4', fontFamily: 'serif' }}>"Faasle jism ko toh door kar sakte hain, par rooh toh hamesha tumhari hi qaid mein hai."</p>
              <div style={{ width: '40px', height: '1px', background: 'rgba(255,255,255,0.2)', margin: '20px 0' }} />
              <p style={{ fontSize: '0.85rem', color: '#ccc', fontWeight: 300 }}>I built this universe so we always have a place to meet. <br/><span style={{ opacity: 0.4 }}>— CodeSage</span></p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}