"use client";

import { useBackground, BACKGROUNDS } from "@/hooks/useBackground";
import { useAvatar, AVATARS } from "@/hooks/useAvatar";
import { useLanguage, LANGUAGES } from "@/hooks/useLanguage";
import { useMode, Mode } from "@/hooks/useMode";

export default function SettingsPage() {
  const { background, setBackground } = useBackground();
  const { avatar, setAvatar } = useAvatar();
  const { language, setLanguage, t } = useLanguage();
  const { mode, setMode } = useMode();

  return (
    <div className="h-[100dvh] overflow-y-auto bg-cream-50 pt-24 px-5 pb-10">
      <div className="max-w-md mx-auto space-y-5">
        {/* Mode toggle */}
        <div className="glass-heavy rounded-2xl p-6">
          <h2 className="text-lg font-bold text-navy mb-4">{t("settings.mode") ?? "Mode"}</h2>
          <div className="flex gap-2">
            {(["elderly", "caretaker"] as Mode[]).map((m) => {
              const isActive = mode === m;
              const label = m === "elderly"
                ? (t("settings.elderlyMode") ?? "Elderly")
                : (t("settings.caretakerMode") ?? "Caretaker");
              return (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                    isActive
                      ? "bg-teal text-white shadow-sm"
                      : "bg-white/40 text-navy/50 border border-navy/10"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Language picker */}
        <div className="glass-heavy rounded-2xl p-6">
          <h2 className="text-lg font-bold text-navy mb-4">{t("settings.language")}</h2>
          <div className="flex gap-2">
            {LANGUAGES.map((lang) => {
              const isActive = lang.id === language;
              return (
                <button
                  key={lang.id}
                  onClick={() => setLanguage(lang.id)}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                    isActive
                      ? "bg-teal text-white shadow-sm"
                      : "bg-white/40 text-navy/50 border border-navy/10"
                  }`}
                >
                  {lang.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Background picker */}
        <div className="glass-heavy rounded-2xl p-6">
          <h2 className="text-lg font-bold text-navy mb-4">{t("settings.background")}</h2>
          <div className="grid grid-cols-2 gap-3">
            {BACKGROUNDS.map((bg) => {
              const isActive = bg.id === background.id;
              return (
                <button
                  key={bg.id}
                  onClick={() => setBackground(bg.id)}
                  className="relative rounded-xl overflow-hidden transition-transform active:scale-95"
                  style={{
                    outline: isActive ? "3px solid var(--color-teal)" : "3px solid transparent",
                    outlineOffset: -1,
                  }}
                >
                  <picture>
                    <source srcSet={bg.webp} type="image/webp" />
                    <img
                      src={bg.png}
                      alt={bg.label}
                      className="w-full aspect-[9/16] object-cover"
                    />
                  </picture>
                  <div className="absolute inset-x-0 bottom-0 px-2 py-2 bg-gradient-to-t from-black/50 to-transparent">
                    <span className="text-white text-xs font-semibold">{bg.label}</span>
                  </div>
                  {isActive && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-teal flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Avatar picker */}
        <div className="glass-heavy rounded-2xl p-6">
          <h2 className="text-lg font-bold text-navy mb-4">{t("settings.avatar")}</h2>
          <div className="grid grid-cols-2 gap-3">
            {AVATARS.map((av) => {
              const isActive = av.id === avatar.id;
              return (
                <button
                  key={av.id}
                  onClick={() => setAvatar(av.id)}
                  className={`relative rounded-xl overflow-hidden transition-all active:scale-95 p-4 flex flex-col items-center gap-2 ${
                    isActive
                      ? "bg-teal/10 ring-3 ring-teal"
                      : "bg-white/40 ring-1 ring-navy/10"
                  }`}
                >
                  <span className="text-4xl">👵</span>
                  <span className={`text-sm font-bold ${isActive ? "text-teal" : "text-navy/60"}`}>
                    {av.label}
                  </span>
                  {isActive && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-teal flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-navy/40 font-medium mt-3 text-center">
            More avatars will be added soon!
          </p>
        </div>

        {/* Other settings placeholder */}
        <div className="glass-heavy rounded-2xl p-6">
          <h2 className="text-lg font-bold text-navy mb-3">{t("settings.settings")}</h2>
          <p className="text-navy/60 text-base leading-relaxed">
            {t("settings.placeholder")}
          </p>
        </div>
      </div>
    </div>
  );
}
