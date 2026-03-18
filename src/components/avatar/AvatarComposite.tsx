"use client";

import { ReactNode, Suspense } from "react";
import { AvatarState } from "@/types/avatar";
import { useBackground } from "@/hooks/useBackground";
import { useAvatar } from "@/hooks/useAvatar";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import Avatar from "@/components/Avatar";
import { ACTIVE_MODELS } from "@/lib/constants";


interface AvatarCompositeProps {
  state: AvatarState;
  children?: ReactNode;
  currentViseme?: string | null;
}

export default function AvatarComposite({
  state,
  children,
  currentViseme
}: AvatarCompositeProps) {
  const { background } = useBackground();
  const { avatar } = useAvatar();

  // Use the selected avatar's model URL, fall back to default
  const modelUrl = avatar.modelUrl || ACTIVE_MODELS.AUNTIE_V1;

  const isSpeaking = state === "speaking" || state === "greeting";

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden">
      {/* Layer 0: Background */}
      <picture className="absolute inset-0">
        <source srcSet={background.webp} type="image/webp" />
        <img
          src={background.png}
          alt=""
          className="h-full w-full object-cover"
          role="presentation"
        />
      </picture>

      <div className="vignette absolute inset-0 z-10 pointer-events-none" />

      {/* Layer 1: 3D Stage */}
      <div className="absolute inset-0 z-20">
        <Canvas
          key={modelUrl} // Correctly uses the variable now
          camera={{ position: [0, 1.8, 1.8], fov: 30 }} 
          shadows
          gl={{ alpha: true, antialias: true }} 
        >
          {/* Lights stay outside Suspense so the scene is 'ready' */}
          <ambientLight intensity={1.5} /> 
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={2} />
          <pointLight position={[-10, -10, -10]} intensity={1} />

          <Suspense fallback={null}>
            <Avatar
              modelUrl={modelUrl}
              currentViseme={currentViseme}
              isSpeaking={isSpeaking}
            />
            {/* Environment provides realistic reflections on the skin/eyes */}
            <Environment preset="city" /> 
          </Suspense>

          <OrbitControls
            enableZoom={false}
            enablePan={false}
            // Lock rotation to only horizontal (left/right) so she stays upright
            minPolarAngle={Math.PI / 2.2}
            maxPolarAngle={Math.PI / 2.2}
          />
        </Canvas>
      </div>

      {/* Layer 2: UI */}
      <div className="absolute inset-0 z-30 pointer-events-none">
        <div className="pointer-events-auto h-full">{children}</div>
      </div>
    </div>
  );
}