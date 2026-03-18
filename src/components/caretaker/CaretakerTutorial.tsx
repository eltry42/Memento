"use client";

import { useState, useCallback } from "react";

const TUTORIAL_DONE_KEY = "memento-caretaker-tutorial-done";

const STEPS = [
  {
    icon: "👋",
    title: "Welcome, Caretaker",
    description:
      "Memento helps you look after your loved one remotely. They chat with Auntie Mimi — a friendly AI companion — while you monitor their wellbeing from here.",
  },
  {
    icon: "📊",
    title: "Dashboard",
    description:
      "Your home base. See at a glance how your loved one is doing — their mood, medication adherence, upcoming events, and any alerts that need your attention.",
  },
  {
    icon: "💊",
    title: "Reminders",
    description:
      "Set up medication schedules and general reminders. Your loved one will be reminded automatically. You can track whether medications have been taken.",
  },
  {
    icon: "📅",
    title: "Schedule",
    description:
      "Manage doctor appointments, family visits, and daily routines. Events show up in your loved one's view so they always know what's coming up.",
  },
  {
    icon: "⚙️",
    title: "Settings",
    description:
      "Switch back to Elderly mode anytime to see what your loved one sees. You can also change the language, background, and avatar.",
  },
  {
    icon: "✅",
    title: "You're all set!",
    description:
      "Start by adding your loved one's medications and upcoming appointments. The dashboard will update as they interact with Auntie Mimi.",
  },
];

export function useCaretakerTutorial() {
  const [show, setShow] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(TUTORIAL_DONE_KEY) !== "true";
  });

  const dismiss = useCallback(() => {
    localStorage.setItem(TUTORIAL_DONE_KEY, "true");
    setShow(false);
  }, []);

  return { showTutorial: show, dismissTutorial: dismiss };
}

interface CaretakerTutorialProps {
  onDone: () => void;
}

export default function CaretakerTutorial({ onDone }: CaretakerTutorialProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onDone();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleSkip = () => {
    onDone();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 pt-6 pb-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step
                  ? "w-6 bg-teal-500"
                  : i < step
                    ? "w-1.5 bg-teal-300"
                    : "w-1.5 bg-gray-200"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-8 pt-6 pb-4 text-center">
          <span className="text-5xl block mb-4">{current.icon}</span>
          <h2 className="text-xl font-bold text-gray-900 mb-3">
            {current.title}
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            {current.description}
          </p>
        </div>

        {/* Actions */}
        <div className="px-8 pb-8 pt-4 flex gap-3">
          {!isLast && (
            <button
              onClick={handleSkip}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-400 active:scale-95 transition-all"
            >
              Skip
            </button>
          )}
          <button
            onClick={handleNext}
            className={`flex-1 py-3 rounded-xl text-sm font-bold text-white bg-teal-500 active:scale-95 transition-all shadow-md ${
              isLast ? "" : ""
            }`}
          >
            {isLast ? "Get Started" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
