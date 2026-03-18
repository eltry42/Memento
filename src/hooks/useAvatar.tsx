"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { AvatarState } from "@/types/avatar";

interface AvatarVideoSources {
  webm: string;
  mp4: string;
}

export type ChromakeyMode = "black" | "green";

export interface AvatarOption {
  id: string;
  label: string;
  poster: string;
  chromakey: ChromakeyMode;
  /** URL to 3D model (.glb) if using 3D avatar */
  modelUrl?: string;
  /** Maps each avatar state to a video. If a state is missing, falls back to "idle". */
  videos: Partial<Record<AvatarState, AvatarVideoSources>> & {
    idle: AvatarVideoSources;
  };
}

export const AVATARS: AvatarOption[] = [
  {
    id: "auntie-v1",
    label: "Auntie Mimi",
    poster: "/models/AuntieM.glb",
    chromakey: "black",
    modelUrl: "/models/AuntieM.glb",
    videos: {
      idle: {
        webm: "",
        mp4: "",
      },
    },
  },
  {
    id: "auntie-v2",
    label: "Auntie Mimi V2",
    poster: "/models/AuntieM1.glb",
    chromakey: "black",
    modelUrl: "/models/AuntieM1.glb",
    videos: {
      idle: {
        webm: "",
        mp4: "",
      },
    },
  },
];

const STORAGE_KEY = "memento-avatar";

interface AvatarContextValue {
  avatar: AvatarOption;
  setAvatar: (id: string) => void;
}

const AvatarContext = createContext<AvatarContextValue>({
  avatar: AVATARS[0],
  setAvatar: () => {},
});

export function AvatarProvider({ children }: { children: ReactNode }) {
  const [avatar, setAvatarState] = useState<AvatarOption>(AVATARS[0]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const found = AVATARS.find((a) => a.id === saved);
      if (found) setAvatarState(found);
    }
  }, []);

  const setAvatar = (id: string) => {
    const found = AVATARS.find((a) => a.id === id);
    if (found) {
      setAvatarState(found);
      localStorage.setItem(STORAGE_KEY, id);
    }
  };

  return (
    <AvatarContext.Provider value={{ avatar, setAvatar }}>
      {children}
    </AvatarContext.Provider>
  );
}

export function useAvatar() {
  return useContext(AvatarContext);
}

/** Resolve the video sources for a given avatar state, falling back to idle. */
export function getVideoForState(
  avatar: AvatarOption,
  state: AvatarState
): AvatarVideoSources {
  return avatar.videos[state] ?? avatar.videos.idle;
}
