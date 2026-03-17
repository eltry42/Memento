"use client";

import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

export default function Avatar({ modelUrl, analyser, isSpeaking }: any) {
  const { scene, nodes } = useGLTF(modelUrl) as any;
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    // 1. Map nodes using the names from your console log
    const head = nodes.Wolf3D_Head;
    const teeth = nodes.Wolf3D_Teeth;
    const neck = nodes.Neck;
    const leftArm = nodes.LeftArm;
    const rightArm = nodes.RightArm;

    const time = state.clock.elapsedTime;

    // --- SIMPLE POSTURE & SWAY ---
    if (neck) {
      const sway = Math.sin(time * 0.5) * 0.05;
      neck.rotation.x = 0.23 + sway; // Using your working 0.23 tilt
      neck.rotation.y = Math.cos(time * 0.4) * 0.08;
    }

    if (leftArm && rightArm) {
      // 1.2 pulls them down to her sides based on your last test
      leftArm.rotation.x = 1.2;
      rightArm.rotation.x = 1.2;

      const armSway = Math.sin(time * 0.8) * 0.02;
      leftArm.rotation.z = armSway;
      rightArm.rotation.z = -armSway;
    }

    // --- SIMPLIFIED MOUTH LOGIC ---
    if (!head || !head.morphTargetInfluences) return;
    const mouthIndex = head.morphTargetDictionary["mouthOpen"];

    // --- SNAPPY GATE LIPSINK ---
    if (isSpeaking && analyser && mouthIndex !== undefined) {
      // TODO: blinking and headnodding

      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);

      // 1. GET PEAK VOLUME
      let peak = 0;
      for (let i = 4; i < 20; i++) {
        if (dataArray[i] > peak) peak = dataArray[i];
      }

      // 2. THE NOISE GATE
      // If the volume is below 35 (out of 255), we force it to 0.
      // This ensures the mouth CLOSES fully during tiny pauses.
      const threshold = 35;
      let mouthTarget = 0;

      if (peak > threshold) {
        // Map the remaining range (35-255) to (0-1)
        mouthTarget = Math.min((peak - threshold) / 150, 1.0);
      }

      // 3. ASYMMETRIC SNAP
      // If the mouth is closing (target < current), we move MUCH faster.
      const currentVal = head.morphTargetInfluences[mouthIndex];
      const isClosing = mouthTarget < currentVal;
      const lerpFactor = isClosing ? 0.75 : 0.5; // 0.75 makes it "snap" shut

      const finalInfluence = THREE.MathUtils.lerp(
        currentVal,
        mouthTarget,
        lerpFactor,
      );

      // 4. SYNC EVERYTHING
      head.morphTargetInfluences[mouthIndex] = finalInfluence;
      if (teeth && teeth.morphTargetDictionary?.["mouthOpen"] !== undefined) {
        teeth.morphTargetInfluences[teeth.morphTargetDictionary["mouthOpen"]] =
          finalInfluence;
      }
    } else if (mouthIndex !== undefined) {
      // 5. HARD RESET when audio stops
      head.morphTargetInfluences[mouthIndex] = THREE.MathUtils.lerp(
        head.morphTargetInfluences[mouthIndex],
        0,
        0.4,
      );
      if (teeth)
        teeth.morphTargetInfluences[teeth.morphTargetDictionary["mouthOpen"]] =
          head.morphTargetInfluences[mouthIndex];
    }
  });

  return (
    <primitive object={scene} ref={group} scale={1.8} position={[0, -2.8, 0]} />
  );
}
