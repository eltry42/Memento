"use client";

import React, { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const charToVisemeMap: Record<string, string> = {
  a: "viseme_aa",
  e: "viseme_E",
  i: "viseme_I",
  o: "viseme_O",
  u: "viseme_U",
  y: "viseme_I",
  p: "viseme_PP",
  b: "viseme_PP",
  m: "viseme_PP",
  f: "viseme_FF",
  v: "viseme_FF",
  t: "viseme_DD",
  d: "viseme_DD",
  k: "viseme_kk",
  g: "viseme_kk",
  s: "viseme_SS",
  z: "viseme_SS",
  c: "viseme_SS",
  r: "viseme_RR",
  n: "viseme_nn",
  l: "viseme_nn",
  h: "viseme_CH",
  w: "viseme_O",
  default: "viseme_sil",
};

export default function Avatar({ modelUrl, currentViseme, isSpeaking }: any) {
  const { scene, nodes } = useGLTF(modelUrl) as any;
  const group = useRef<THREE.Group>(null);

  // ✅ FIX: Use a ref so useFrame always sees the latest value
  const currentVisemeRef = useRef<string | null>(null);

  useEffect(() => {
    currentVisemeRef.current = currentViseme;
  }, [currentViseme]);

  useEffect(() => {
    if (nodes.Wolf3D_Head) {
      const dict = nodes.Wolf3D_Head.morphTargetDictionary;
      if (dict) {
        console.log("ALL morph targets:", Object.keys(dict));
      } else {
        console.error("morphTargetDictionary is NULL");
      }
    } else {
      console.error(
        "Wolf3D_Head node not found. Available nodes:",
        Object.keys(nodes),
      );
    }
  }, [nodes]);

  useEffect(() => {
    if (nodes.Wolf3D_Head && nodes.Wolf3D_Head.morphTargetDictionary) {
      console.log(
        "Morph targets:",
        Object.keys(nodes.Wolf3D_Head.morphTargetDictionary),
      );
    } else {
      console.error("CRITICAL: This 3D model has NO mouth shapes exported!");
    }
  }, [nodes]);

  useFrame((state) => {
    if (currentVisemeRef.current)
      console.log("useFrame sees:", currentVisemeRef.current);

    const head = nodes.Wolf3D_Head;
    const teeth = nodes.Wolf3D_Teeth;
    const neck = nodes.Neck;
    const leftArm = nodes.LeftArm;
    const rightArm = nodes.RightArm;
    const time = state.clock.elapsedTime;

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

    // Read from ref, not prop
    const visemeChar = currentVisemeRef.current;

    if (visemeChar) {
      console.log("useFrame sees viseme:", visemeChar);
      const letter = visemeChar.toLowerCase();
      const targetName = charToVisemeMap[letter] ?? charToVisemeMap.default;
      const idx = head.morphTargetDictionary[targetName];
      console.log("target shape:", targetName, "idx:", idx);
    }

    // Decay all viseme shapes toward 0
    Object.values(charToVisemeMap).forEach((visemeName) => {
      const idx = head.morphTargetDictionary[visemeName];
      if (idx !== undefined) {
        head.morphTargetInfluences[idx] = THREE.MathUtils.lerp(
          head.morphTargetInfluences[idx],
          0,
          0.05, // ✅ Slower decay so mouth has time to open visibly
        );
      }
    });

    // Apply active viseme
    if (visemeChar) {
      const letter = visemeChar.toLowerCase();
      const targetName = charToVisemeMap[letter] ?? charToVisemeMap.default;
      const idx = head.morphTargetDictionary[targetName];
      if (idx !== undefined) {
        head.morphTargetInfluences[idx] = THREE.MathUtils.lerp(
          head.morphTargetInfluences[idx],
          0.8, // ✅ Slightly under 1.0 looks more natural
          0.6,
        );
      }
    }

    // Sync teeth
    if (teeth?.morphTargetInfluences) {
      teeth.morphTargetInfluences = [...head.morphTargetInfluences];
    }

    // Blinking
    const bL = head.morphTargetDictionary["eyeBlinkLeft"];
    const bR = head.morphTargetDictionary["eyeBlinkRight"];
    if (bL !== undefined && bR !== undefined) {
      const isBlinking = Math.sin(time * 1.5) > 0.98;
      head.morphTargetInfluences[bL] = THREE.MathUtils.lerp(
        head.morphTargetInfluences[bL],
        isBlinking ? 1 : 0,
        0.5,
      );
      head.morphTargetInfluences[bR] = head.morphTargetInfluences[bL];
    }
  });

  return (
    <primitive object={scene} ref={group} scale={1.8} position={[0, -2.8, 0]} />
  );
}
