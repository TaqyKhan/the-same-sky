"use client";
// @ts-nocheck

/* eslint-disable */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';

// --- CONFIG & DESIGN TOKENS ---
const COLORS = {
  midnight: '#040406',
  cherry: '#900C3F',
  lilac: '#C8A2C8',
};

// Local audio fallback (Place this file in your Next.js 'public' folder)
const AUDIO_URL = '/bg-music.mp3';

export default function App() {
  const [mounted, setMounted] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [isDiscovered, setIsDiscovered] = useState(false);
  const [controlMode, setControlMode] = useState('detecting'); // 'motion', 'touch', or 'detecting'
  
  // Explicitly typing as <any> to prevent Next.js build worker from failing on null assignments
  const containerRef = useRef<any>(null);
  const audioRef = useRef<any>(null);
  const sceneRef = useRef<any>({
    renderer: null,
    scene: null,
    camera: null,
    frameId: null
  });

  // 1. Initial Setup: Hydration Guard and Fonts
  useEffect(() => {
    setMounted(true);
    
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300&family=Playfair+Display:ital,wght@0,400;1,400&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    return () => {
      if (sceneRef.current.frameId) {
        cancelAnimationFrame(sceneRef.current.frameId);
      }
    };
  }, []);

  // 2. Pure Three.js Engine
  useEffect(() => {
    if (!isStarted || !containerRef.current || !mounted) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // -- RENDERER --
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    sceneRef.current.renderer = renderer;

    // -- SCENE --
    const scene = new THREE.Scene();
    sceneRef.current.scene = scene;

    // -- CAMERA --
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 0, 0.1);
    sceneRef.current.camera = camera;

    // -- SKYBOX --
    const geometry = new THREE.SphereGeometry(500, 32, 32);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        colorTop: { value: new THREE.Color(COLORS.midnight) },
        colorBottom: { value: new THREE.Color(COLORS.cherry) }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 colorTop;
        uniform vec3 colorBottom;
        varying vec3 vWorldPosition;
        void main() {
          vec3 direction = normalize(vWorldPosition);
          float mixFactor = (direction.y + 1.0) * 0.5;
          gl_FragColor = vec4(mix(colorBottom, colorTop, mixFactor), 1.0);
        }
      `
    });
    scene.add(new THREE.Mesh(geometry, skyMat));

    // -- STARS --
    const starCoords = [];
    for (let i = 0; i < 3500; i++) {
      starCoords.push(THREE.MathUtils.randFloatSpread(1000), THREE.MathUtils.randFloatSpread(1000), THREE.MathUtils.randFloatSpread(1000));
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starCoords, 3));
    const starPoints = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.8, transparent: true, opacity: 0.7 }));
    scene.add(starPoints);

    // -- CONSTELLATION SPRITE --
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      canvas.width = 512;
      canvas.height = 256;
      ctx.font = 'italic 80px "Playfair Display", serif'; 
      ctx.fillStyle = COLORS.lilac;
      ctx.textAlign = 'center';
      ctx.fillText('Guriyaa', 256, 128);
    }
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }));
    sprite.position.set(0, 45, -100);
    sprite.scale.set(45, 22.5, 1);
    scene.add(sprite);

    // -- HYBRID INPUTS --
    const targetVec = new THREE.Vector3(0, 45, -100).normalize();
    const currentDir = new THREE.Vector3();
    let alpha = 0, beta = 0, gamma = 0;
    let isDragging = false;
    let lon = 0, lat = 0;
    let startX = 0, startY = 0;

    const onOrient = (e: any) => {
      if (e.alpha !== null) {
        setControlMode('motion');
        alpha = e.alpha ? THREE.MathUtils.degToRad(e.alpha) : 0;
        beta = e.beta ? THREE.MathUtils.degToRad(e.beta) : 0;
        gamma = e.gamma ? THREE.MathUtils.degToRad(e.gamma) : 0;
      }
    };

    const onDown = (e: any) => {
      isDragging = true;
      startX = e.touches ? e.touches[0].clientX : e.clientX;
      startY = e.touches ? e.touches[0].clientY : e.clientY;
    };

    const onMove = (e: any) => {
      if (!isDragging) return;
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      const y = e.touches ? e.touches[0].clientY : e.clientY;
      lon -= (x - startX) * 0.25;
      lat += (y - startY) * 0.25;
      lat = Math.max(-85, Math.min(85, lat));
      startX = x;
      startY = y;
      if (controlMode !== 'motion') setControlMode('touch');
    };

    const onUp = () => { isDragging = false; };

    window.addEventListener('deviceorientation', onOrient);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    const animate = () => {
      sceneRef.current.frameId = requestAnimationFrame(animate);
      
      if (controlMode === 'motion') {
        camera.rotation.set(beta + Math.PI/2, alpha, -gamma, 'YXZ');
      } else {
        const phi = THREE.MathUtils.degToRad(90 - lat);
        const theta = THREE.MathUtils.degToRad(lon);
        const lookAtTarget = new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta),
          Math.cos(phi),
          Math.sin(phi) * Math.sin(theta)
        );
        camera.lookAt(lookAtTarget);
      }

      camera.getWorldDirection(currentDir);
      if (currentDir.angleTo(targetVec) < 0.26) setIsDiscovered(true);

      starPoints.rotation.y += 0.0003;
      sprite.position.y = 45 + Math.sin(Date.now() * 0.0015) * 1.5;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.removeEventListener('deviceorientation', onOrient);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchstart', onDown);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      window.removeEventListener('resize', onResize);
      if (renderer.domElement && containerRef.current) containerRef.current.removeChild(renderer.domElement);
    };
  }, [isStarted, controlMode, mounted]);

  const handleStart = async () => {
    const DeviceOrientationEventAny = (window as any).DeviceOrientationEvent;
    
    const isSecure = typeof window !== 'undefined' && (window.location.protocol === 'https:' || window.location.hostname === 'localhost');
    
    if (!isSecure) {
      setControlMode('touch');
    }

    if (DeviceOrientationEventAny && typeof DeviceOrientationEventAny.requestPermission === 'function') {
      try {
        const res = await DeviceOrientationEventAny.requestPermission();
        if (res === 'granted') setControlMode('motion');
      } catch (e) {
        setControlMode('touch');
      }
    }
    
    setIsStarted(true);
    
    // Play audio safely using the ref attached to the HTML element
    if (audioRef.current) {
      audioRef.current.volume = 0.4;
      audioRef.current.play().catch(() => console.log("Audio waiting for stronger interaction."));
    }
  };

  if (!mounted) return <div style={{ background: COLORS.midnight, height: '100vh' }} />;

  return (
    <div style={{ position: 'fixed', inset: 0, background: COLORS.midnight, width: '100vw', height: '100dvh', overflow: 'hidden' }}>
      
      {/* HTML Native Audio element handles loading and types automatically */}
      <audio ref={audioRef} src={AUDIO_URL} loop preload="auto" />

      <div ref={containerRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

      {isStarted && (
        <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 5, color: 'rgba(255,255,255,0.3)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', pointerEvents: 'none' }}>
          Mode: {controlMode}
        </div>
      )}

      <AnimatePresence>
        {!isStarted && (
          <motion.div exit={{ opacity: 0 }} style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: COLORS.midnight, textAlign: 'center', padding: '30px' }}>
            <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ fontSize: '3rem', fontStyle: 'italic', color: COLORS.lilac, marginBottom: '20px', fontFamily: "'Playfair Display', serif" }}>The Same Sky.</motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} style={{ opacity: 0.7, maxWidth: '280px', marginBottom: '60px', lineHeight: '1.6', fontFamily: "'Inter', sans-serif" }}>Different cities, different lives, but always under the same stars. <br/><br/> Look up or swipe to explore.</motion.p>
            
            {typeof window !== 'undefined' && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && (
              <p style={{ color: '#ff4b4b', fontSize: '11px', marginBottom: '20px', maxWidth: '200px', opacity: 0.8 }}>
                ⚠️ Non-HTTPS connection detected. Motion sensors will be disabled.
              </p>
            )}

            <button onClick={handleStart} style={{ padding: '16px 45px', borderRadius: '40px', border: '1px solid rgba(200,162,200,0.5)', background: 'rgba(255,255,255,0.04)', color: 'white', fontSize: '0.9rem', letterSpacing: '4px', cursor: 'pointer', backdropFilter: 'blur(10px)', fontFamily: "'Inter', sans-serif" }}>LOOK UP</button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDiscovered && (
          <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={{ position: 'absolute', bottom: '8%', left: '5%', right: '5%', zIndex: 5, display: 'flex', justifyContent: 'center' }}>
            <div style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(25px)', border: '1px solid rgba(255,255,255,0.1)', padding: '32px', borderRadius: '32px', width: '100%', maxWidth: '420px', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}>
              <p style={{ color: COLORS.lilac, fontStyle: 'italic', fontSize: '1.5rem', marginBottom: '18px', lineHeight: '1.4', fontFamily: "'Playfair Display', serif" }}>"Faasle jism ko toh door kar sakte hain, par rooh toh hamesha tumhari hi qaid mein hai."</p>
              <div style={{ width: '50px', height: '1px', background: 'rgba(255,255,255,0.2)', margin: '22px 0' }} />
              <p style={{ fontSize: '0.9rem', color: '#ddd', fontWeight: 300, fontFamily: "'Inter', sans-serif" }}>I built this universe so we always have a place to meet. <br/><span style={{ opacity: 0.5, fontSize: '0.8rem' }}>— CodeSage</span></p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}