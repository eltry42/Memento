"use client";

import React, { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const charToVisemeMap: Record<string, string> = {
  a: "viseme_aa", e: "viseme_E", i: "viseme_I", o: "viseme_O", u: "viseme_U", y: "viseme_I",
  p: "viseme_PP", b: "viseme_PP", m: "viseme_PP",
  f: "viseme_FF", v: "viseme_FF",
  t: "viseme_DD", d: "viseme_DD",
  k: "viseme_kk", g: "viseme_kk", q: "viseme_kk",
  s: "viseme_SS", z: "viseme_SS", c: "viseme_SS", x: "viseme_SS",
  r: "viseme_RR", n: "viseme_nn", l: "viseme_nn",
  h: "viseme_CH", w: "viseme_O",
  default: "viseme_sil",
};

// NEW: Define how "strong" each viseme should be. 
// Lower values = smaller mouth opening, hiding more teeth.
const visemeIntensityMap: Record<string, number> = {
  viseme_aa: 0.6, // 'Ah' - keep it restrained
  viseme_E:  0.5,
  viseme_I:  0.4,
  viseme_O:  0.7, // 'Oh' needs to be rounder
  viseme_U:  0.6,
  viseme_PP: 0.4, // Closed lips for B, P, M
  viseme_FF: 0.4, // Lip biting for F, V
  viseme_DD: 0.3, // Slight part for T, D
  viseme_kk: 0.4,
  viseme_SS: 0.3, // Clenched teeth for S, Z
  viseme_RR: 0.4,
  viseme_nn: 0.3,
  viseme_CH: 0.5,
  viseme_sil: 0.0, // Silence is completely closed
};

export default function Avatar({ modelUrl, currentViseme }: any) {
  const { scene, nodes } = useGLTF(modelUrl) as any;
  const group = useRef<THREE.Group>(null);
  const currentVisemeRef = useRef<string | null>(null);

  useEffect(() => {
    currentVisemeRef.current = currentViseme;
  }, [currentViseme]);

  useFrame((state) => {
    const head = nodes.Wolf3D_Head;
    const teeth = nodes.Wolf3D_Teeth;
    const neck = nodes.Neck;
    const leftArm = nodes.LeftArm;
    const rightArm = nodes.RightArm;
    const time = state.clock.elapsedTime;

    // Body Sway
    if (neck) {
      neck.rotation.x = 0.23 + Math.sin(time * 0.5) * 0.05;
      neck.rotation.y = Math.cos(time * 0.4) * 0.08;
    }
    if (leftArm && rightArm) {
      leftArm.rotation.x = 1.2;
      rightArm.rotation.x = 1.2;
      leftArm.rotation.z = Math.sin(time * 0.8) * 0.02;
      rightArm.rotation.z = -Math.sin(time * 0.8) * 0.02;
    }

    if (!head?.morphTargetInfluences || !head?.morphTargetDictionary) return;

    // 1. Smooth Decay (Closing the mouth)
    // We increased the decay speed slightly (0.15) so it doesn't "hang" open too long
    Object.values(charToVisemeMap).forEach((visemeName) => {
      const idx = head.morphTargetDictionary[visemeName];
      if (idx !== undefined) {
        head.morphTargetInfluences[idx] = THREE.MathUtils.lerp(
          head.morphTargetInfluences[idx],
          0,
          0.15 
        );
      }
    });

    // 2. Apply Active Viseme with Custom Intensity
    const visemeChar = currentVisemeRef.current;
    if (visemeChar) {
      const letter = visemeChar.toLowerCase();
      const targetName = charToVisemeMap[letter] ?? charToVisemeMap.default;
      const idx = head.morphTargetDictionary[targetName];
      
      if (idx !== undefined) {
        // Look up our custom intensity, fallback to 0.4 if not found
        const targetIntensity = visemeIntensityMap[targetName] ?? 0.4;
        
        head.morphTargetInfluences[idx] = THREE.MathUtils.lerp(
          head.morphTargetInfluences[idx],
          targetIntensity, 
          0.6 // How fast the mouth jumps to the shape
        );
      }
    }

    // 3. Teeth Synchronization (The "Toothy" Fix)
    // Instead of copying the exact array (which forces the jaw wide), 
    // we dampen the teeth movement by 50% so they stay tucked inside the lips.
    if (teeth?.morphTargetInfluences) {
      for (let i = 0; i < head.morphTargetInfluences.length; i++) {
         teeth.morphTargetInfluences[i] = head.morphTargetInfluences[i] * 0.5;
      }
    }

    // 4. Blinking
    const bL = head.morphTargetDictionary["eyeBlinkLeft"];
    const bR = head.morphTargetDictionary["eyeBlinkRight"];
    if (bL !== undefined && bR !== undefined) {
      const isBlinking = Math.sin(time * 1.5) > 0.98;
      head.morphTargetInfluences[bL] = THREE.MathUtils.lerp(
        head.morphTargetInfluences[bL],
        isBlinking ? 1 : 0,
        0.5
      );
      head.morphTargetInfluences[bR] = head.morphTargetInfluences[bL];
    }
  });

  return (
    <primitive object={scene} ref={group} scale={1.8} position={[0, -2.8, 0]} />
  );
}