"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMode } from "@/hooks/useMode";
import HomeScreen from "@/components/home/HomeScreen";

export default function HomePage() {
  const { mode } = useMode();
  const router = useRouter();

  useEffect(() => {
    if (mode === "caretaker") {
      router.replace("/dashboard");
    }
  }, [mode, router]);

  if (mode === "caretaker") return null;

  return <HomeScreen />;
}
