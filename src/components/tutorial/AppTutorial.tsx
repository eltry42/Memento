"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LANGUAGES, Language, useLanguage } from "@/hooks/useLanguage";
import { useMode } from "@/hooks/useMode";

type TutorialStep = {
  icon: string;
  title: string;
  description: string;
};

type TutorialCopy = {
  buttonLabel: string;
  languageTitle: string;
  languageDescription: string;
  skip: string;
  next: string;
  done: string;
};

const STORAGE_KEYS = {
  elderly: "memento-elderly-tutorial-done",
  caretaker: "memento-caretaker-tutorial-done",
} as const;

const COPY: Record<Language, TutorialCopy> = {
  en: {
    buttonLabel: "Tutorial",
    languageTitle: "Choose Tutorial Language",
    languageDescription:
      "Pick the language you want for this walkthrough. The app language will switch too.",
    skip: "Skip",
    next: "Next",
    done: "Done",
  },
  zh: {
    buttonLabel: "教程",
    languageTitle: "选择教程语言",
    languageDescription: "请选择本次教程使用的语言。应用语言也会一起切换。",
    skip: "跳过",
    next: "下一步",
    done: "完成",
  },
  ta: {
    buttonLabel: "வழிகாட்டி",
    languageTitle: "வழிகாட்டி மொழியைத் தேர்வு செய்யவும்",
    languageDescription:
      "இந்த வழிகாட்டிக்கான மொழியைத் தேர்வு செய்யுங்கள். பயன்பாட்டின் மொழியும் அதேபோல் மாறும்.",
    skip: "தவிர்",
    next: "அடுத்து",
    done: "முடிந்தது",
  },
  ms: {
    buttonLabel: "Tutorial",
    languageTitle: "Pilih Bahasa Tutorial",
    languageDescription:
      "Pilih bahasa untuk panduan ini. Bahasa aplikasi juga akan ditukar.",
    skip: "Langkau",
    next: "Seterusnya",
    done: "Selesai",
  },
};

const STEPS: Record<Language, Record<"elderly" | "caretaker", TutorialStep[]>> = {
  en: {
    elderly: [
      {
        icon: "👋",
        title: "Welcome to Memento",
        description:
          "Memento is your daily companion. You can talk to Auntie Mimi, check your plans, and get gentle reminders throughout the day.",
      },
      {
        icon: "🎙️",
        title: "Talk To Auntie Mimi",
        description:
          "You can speak to Auntie Mimi in any language. She can automatically detect what you say and reply in the right language for you.",
      },
      {
        icon: "🎤",
        title: "Push To Talk",
        description:
          "Tap the microphone to start talking. Tap it again if you want to stop early, or just pause and Memento will finish listening automatically.",
      },
      {
        icon: "💬",
        title: "Home Screen",
        description:
          "The home screen is where you chat with Auntie Mimi. You can also switch languages and open your chat log from the controls at the bottom.",
      },
      {
        icon: "🧠",
        title: "Wellness",
        description:
          "Use Wellness activities to check in on your mood and do simple exercises like memory games and story time.",
      },
      {
        icon: "⏰",
        title: "Reminders and Schedule",
        description:
          "Check your reminders and daily schedule anytime so you know what is coming up and what to do next.",
      },
      {
        icon: "⚙️",
        title: "Settings and Help",
        description:
          "Settings lets you change your language, background, and companion. This Tutorial button stays on the bottom left of every page if you want a refresher.",
      },
    ],
    caretaker: [
      {
        icon: "👋",
        title: "Welcome, Caretaker",
        description:
          "Memento helps you look after your loved one remotely. You can review their day, manage reminders, and understand how they are doing.",
      },
      {
        icon: "📊",
        title: "Dashboard",
        description:
          "The dashboard is your home base. It shows mood, medication adherence, upcoming events, alerts, and recent conversations in one place.",
      },
      {
        icon: "💊",
        title: "Reminders",
        description:
          "Set medication schedules and general reminders here. These reminders appear in your loved one's experience automatically.",
      },
      {
        icon: "📅",
        title: "Schedule",
        description:
          "Keep doctor visits, family plans, and routines organized so your loved one can stay oriented through the day.",
      },
      {
        icon: "⚙️",
        title: "Settings and Mode Switch",
        description:
          "Use Settings to switch between Caretaker and Elderly mode, and to review the same language and personalization options used in the main experience.",
      },
      {
        icon: "🧭",
        title: "Tutorial Anytime",
        description:
          "The Tutorial button stays near the bottom left on every page, so you can reopen this walkthrough whenever you need it.",
      },
    ],
  },
  zh: {
    elderly: [
      {
        icon: "👋",
        title: "欢迎使用 Memento",
        description:
          "Memento 是你每天的贴心伙伴。你可以和 Auntie Mimi 聊天、查看安排，并在一天中收到温和提醒。",
      },
      {
        icon: "🎙️",
        title: "和 Auntie Mimi 聊天",
        description:
          "你可以用任何语言和 Auntie Mimi 说话。她会自动识别你说的语言，并用合适的语言回应你。",
      },
      {
        icon: "🎤",
        title: "按住说话",
        description:
          "点一下麦克风开始说话。如果想提前结束，再点一次即可；如果你停下来，Memento 也会自动结束聆听。",
      },
      {
        icon: "💬",
        title: "首页",
        description:
          "首页是你和 Auntie Mimi 聊天的地方。你也可以在底部控制区切换语言和打开聊天记录。",
      },
      {
        icon: "🧠",
        title: "健康",
        description:
          "在健康页面可以记录心情，并进行简单活动，例如记忆游戏和故事时间。",
      },
      {
        icon: "⏰",
        title: "提醒和日程",
        description:
          "你可以随时查看提醒和每日安排，知道接下来要做什么。",
      },
      {
        icon: "⚙️",
        title: "设置和帮助",
        description:
          "你可以在设置里更换语言、背景和伙伴。每一页左下角都会保留这个教程按钮，方便随时重看。",
      },
    ],
    caretaker: [
      {
        icon: "👋",
        title: "欢迎，看护人",
        description:
          "Memento 帮助你远程照顾家人。你可以查看他们的一天、管理提醒，并了解他们目前的状态。",
      },
      {
        icon: "📊",
        title: "仪表盘",
        description:
          "仪表盘是你的总览页面。这里会显示心情、用药情况、即将到来的事项、提醒通知和最近对话。",
      },
      {
        icon: "💊",
        title: "提醒",
        description:
          "你可以在这里设置药物提醒和一般提醒，这些内容会自动出现在家人的使用界面中。",
      },
      {
        icon: "📅",
        title: "日程",
        description:
          "把看医生、家庭活动和日常安排整理好，帮助家人在一天中保持方向感。",
      },
      {
        icon: "⚙️",
        title: "设置与模式切换",
        description:
          "你可以在设置中切换看护人模式和长辈模式，也可以查看语言和个性化设置。",
      },
      {
        icon: "🧭",
        title: "随时打开教程",
        description:
          "每一页左下附近都会保留教程按钮，方便你随时重新打开这份引导。",
      },
    ],
  },
  ta: {
    elderly: [
      {
        icon: "👋",
        title: "Memento-க்கு வரவேற்கிறோம்",
        description:
          "Memento உங்கள் தினசரி தோழன். Auntie Mimi உடன் பேசலாம், உங்கள் அட்டவணையைப் பார்க்கலாம், மற்றும் மென்மையான நினைவூட்டல்களைப் பெறலாம்.",
      },
      {
        icon: "🎙️",
        title: "Auntie Mimi உடன் பேசுங்கள்",
        description:
          "நீங்கள் Auntie Mimi உடன் எந்த மொழியிலும் பேசலாம். நீங்கள் பேசும் மொழியை அவர் தானாகக் கண்டறிந்து அதே மொழியில் பதிலளிப்பார்.",
      },
      {
        icon: "🎤",
        title: "பேச தட்டவும்",
        description:
          "மைக்ரோஃபோனைத் தட்டி பேசத் தொடங்குங்கள். முன்பே நிறுத்த வேண்டுமெனில் மீண்டும் தட்டுங்கள்; இல்லையெனில் நீங்கள் நிறுத்தியதும் Memento தானாக கேட்பதை முடிக்கும்.",
      },
      {
        icon: "💬",
        title: "முகப்பு திரை",
        description:
          "முகப்பு திரையில்தான் நீங்கள் Auntie Mimi உடன் உரையாடுவீர்கள். கீழே உள்ள கட்டுப்பாடுகளில் மொழியை மாற்றவும் உரையாடல் பதிவைப் பார்க்கவும் முடியும்.",
      },
      {
        icon: "🧠",
        title: "நலம்",
        description:
          "நலம் பகுதியில் மனநிலையை பதிவு செய்யவும், நினைவாட்டம் மற்றும் கதை நேரம் போன்ற எளிய செயல்பாடுகளைச் செய்யவும் முடியும்.",
      },
      {
        icon: "⏰",
        title: "நினைவூட்டல்கள் மற்றும் அட்டவணை",
        description:
          "எப்போது வேண்டுமானாலும் உங்கள் நினைவூட்டல்களையும் தினசரி அட்டவணையையும் பார்த்து அடுத்தது என்ன என்பதை அறியலாம்.",
      },
      {
        icon: "⚙️",
        title: "அமைப்புகள் மற்றும் உதவி",
        description:
          "அமைப்புகளில் மொழி, பின்னணி, தோழனை மாற்றலாம். இந்த வழிகாட்டி பொத்தான் ஒவ்வொரு பக்கத்திலும் இடது கீழ்புறத்தில் இருக்கும்.",
      },
    ],
    caretaker: [
      {
        icon: "👋",
        title: "வரவேற்பு, பராமரிப்பாளர்",
        description:
          "Memento மூலம் உங்கள் அன்புக்குரியவரை தூரத்திலிருந்தே கவனிக்கலாம். அவர்களின் நாளை பார்வையிடவும், நினைவூட்டல்களை நிர்வகிக்கவும், அவர்களின் நிலையைப் புரிந்துகொள்ளவும் முடியும்.",
      },
      {
        icon: "📊",
        title: "டாஷ்போர்டு",
        description:
          "இது உங்கள் மைய திரை. மனநிலை, மருந்து பின்பற்றல், வரவிருக்கும் நிகழ்வுகள், எச்சரிக்கைகள், மற்றும் சமீபத்திய உரையாடல்கள் இங்கே காணப்படும்.",
      },
      {
        icon: "💊",
        title: "நினைவூட்டல்கள்",
        description:
          "இங்கே மருந்து அட்டவணைகளையும் பொதுவான நினைவூட்டல்களையும் அமைக்கலாம். அவை உங்கள் அன்புக்குரியவரின் பயன்பாட்டில் தானாகத் தோன்றும்.",
      },
      {
        icon: "📅",
        title: "அட்டவணை",
        description:
          "மருத்துவர் சந்திப்பு, குடும்ப திட்டம், மற்றும் தினசரி வழக்கங்களை ஒழுங்குபடுத்தி அவர்களுக்கு நாளை புரிந்துகொள்ள உதவுங்கள்.",
      },
      {
        icon: "⚙️",
        title: "அமைப்புகள் மற்றும் முறை மாற்றம்",
        description:
          "அமைப்புகளில் பராமரிப்பாளர் மற்றும் முதியோர் முறைகளுக்கு இடையே மாறலாம்; மொழி மற்றும் தனிப்பயனாக்கத்தையும் பார்வையிடலாம்.",
      },
      {
        icon: "🧭",
        title: "எப்போதும் வழிகாட்டி",
        description:
          "ஒவ்வொரு பக்கத்திலும் இடது கீழ்புறம் அருகே வழிகாட்டி பொத்தான் இருக்கும்; தேவையானபோது மீண்டும் திறக்கலாம்.",
      },
    ],
  },
  ms: {
    elderly: [
      {
        icon: "👋",
        title: "Selamat Datang ke Memento",
        description:
          "Memento ialah teman harian anda. Anda boleh berbual dengan Auntie Mimi, menyemak rancangan anda, dan menerima peringatan lembut sepanjang hari.",
      },
      {
        icon: "🎙️",
        title: "Bercakap Dengan Auntie Mimi",
        description:
          "Anda boleh bercakap dengan Auntie Mimi dalam apa-apa bahasa. Dia boleh mengesan bahasa anda secara automatik dan membalas dalam bahasa yang sesuai.",
      },
      {
        icon: "🎤",
        title: "Tekan Untuk Bercakap",
        description:
          "Ketuk mikrofon untuk mula bercakap. Ketuk sekali lagi jika anda mahu berhenti awal, atau berhenti seketika dan Memento akan tamat mendengar secara automatik.",
      },
      {
        icon: "💬",
        title: "Skrin Utama",
        description:
          "Skrin utama ialah tempat anda berbual dengan Auntie Mimi. Anda juga boleh menukar bahasa dan membuka log sembang dari kawalan di bawah.",
      },
      {
        icon: "🧠",
        title: "Kesejahteraan",
        description:
          "Gunakan aktiviti Kesejahteraan untuk semak mood anda dan buat aktiviti mudah seperti permainan memori dan masa bercerita.",
      },
      {
        icon: "⏰",
        title: "Peringatan dan Jadual",
        description:
          "Semak peringatan dan jadual harian anda pada bila-bila masa supaya anda tahu apa yang akan datang dan apa yang perlu dibuat seterusnya.",
      },
      {
        icon: "⚙️",
        title: "Tetapan dan Bantuan",
        description:
          "Tetapan membolehkan anda menukar bahasa, latar belakang, dan teman anda. Butang Tutorial ini akan kekal di bahagian kiri bawah setiap halaman.",
      },
    ],
    caretaker: [
      {
        icon: "👋",
        title: "Selamat Datang, Penjaga",
        description:
          "Memento membantu anda menjaga insan tersayang dari jauh. Anda boleh meneliti hari mereka, mengurus peringatan, dan memahami keadaan mereka.",
      },
      {
        icon: "📊",
        title: "Papan Pemuka",
        description:
          "Ini ialah pusat utama anda. Ia memaparkan mood, pematuhan ubat, acara akan datang, amaran, dan perbualan terbaru di satu tempat.",
      },
      {
        icon: "💊",
        title: "Peringatan",
        description:
          "Tetapkan jadual ubat dan peringatan umum di sini. Peringatan ini akan muncul secara automatik dalam pengalaman insan tersayang anda.",
      },
      {
        icon: "📅",
        title: "Jadual",
        description:
          "Susun temu janji doktor, rancangan keluarga, dan rutin harian supaya insan tersayang anda kekal berorientasi sepanjang hari.",
      },
      {
        icon: "⚙️",
        title: "Tetapan dan Tukar Mod",
        description:
          "Gunakan Tetapan untuk bertukar antara mod Penjaga dan Warga Emas, serta melihat pilihan bahasa dan pemperibadian.",
      },
      {
        icon: "🧭",
        title: "Tutorial Bila-Bila Masa",
        description:
          "Butang Tutorial akan kekal berhampiran kiri bawah pada setiap halaman supaya anda boleh membuka semula panduan ini bila perlu.",
      },
    ],
  },
};

function TutorialOverlay({
  steps,
  copy,
  language,
  onLanguageChange,
  onDone,
}: {
  steps: TutorialStep[];
  copy: TutorialCopy;
  language: Language;
  onLanguageChange: (language: Language) => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const isLanguageStep = step === 0;
  const current = isLanguageStep ? null : steps[step - 1];
  const isLast = step === steps.length;

  useEffect(() => {
    setStep(0);
  }, [steps]);

  const handleNext = () => {
    if (isLast) {
      onDone();
      return;
    }
    setStep((value) => value + 1);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex justify-center gap-1.5 pb-2 pt-6">
          {Array.from({ length: steps.length + 1 }).map((_, index) => (
            <div
              key={index}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === step
                  ? "w-6 bg-teal-500"
                  : index < step
                    ? "w-1.5 bg-teal-300"
                    : "w-1.5 bg-gray-200"
              }`}
            />
          ))}
        </div>

        <div className="px-8 pb-4 pt-6 text-center">
          {isLanguageStep ? (
            <>
              <span className="mb-4 block text-5xl">🌐</span>
              <h2 className="mb-3 text-xl font-bold text-gray-900">
                {copy.languageTitle}
              </h2>
              <p className="text-sm leading-relaxed text-gray-600">
                {copy.languageDescription}
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {LANGUAGES.map((option) => {
                  const isActive = option.id === language;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => onLanguageChange(option.id)}
                      className={`rounded-2xl border px-4 py-3 text-sm font-bold transition-all active:scale-95 ${
                        isActive
                          ? "border-teal-500 bg-teal-50 text-teal-700"
                          : "border-gray-200 bg-white text-gray-700"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <span className="mb-4 block text-5xl">{current?.icon}</span>
              <h2 className="mb-3 text-xl font-bold text-gray-900">
                {current?.title}
              </h2>
              <p className="text-sm leading-relaxed text-gray-600">
                {current?.description}
              </p>
            </>
          )}
        </div>

        <div className="flex gap-3 px-8 pb-8 pt-4">
          {!isLast && (
            <button
              onClick={onDone}
              className="flex-1 rounded-xl py-3 text-sm font-semibold text-gray-400 transition-all active:scale-95"
            >
              {copy.skip}
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex-1 rounded-xl bg-teal-500 py-3 text-sm font-bold text-white shadow-md transition-all active:scale-95"
          >
            {isLast ? copy.done : copy.next}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AppTutorial() {
  const { mode } = useMode();
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const storageKey = STORAGE_KEYS[mode];
  const copy = COPY[language];
  const steps = useMemo(() => STEPS[language][mode], [language, mode]);

  useEffect(() => {
    const hasCompleted = localStorage.getItem(storageKey) === "true";
    setIsOpen(!hasCompleted);
  }, [storageKey]);

  const handleDone = useCallback(() => {
    localStorage.setItem(storageKey, "true");
    setIsOpen(false);
  }, [storageKey]);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
  }, []);

  return (
    <>
      {isOpen ? (
        <TutorialOverlay
          steps={steps}
          copy={copy}
          language={language}
          onLanguageChange={setLanguage}
          onDone={handleDone}
        />
      ) : null}

      <div className="pointer-events-none fixed bottom-9 left-4 z-[90] safe-bottom">
        <button
          type="button"
          onClick={handleOpen}
          className="pointer-events-auto rounded-full border border-white/50 bg-white/80 px-4 py-3 text-sm font-bold text-navy shadow-lg backdrop-blur-sm transition-all active:scale-95"
        >
          {copy.buttonLabel}
        </button>
      </div>
    </>
  );
}
