"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";

export type Language = "en" | "zh" | "ta" | "ms";

export interface LanguageOption {
  id: Language;
  label: string;       // native name
  shortLabel: string;  // for pill button
}

export const LANGUAGES: LanguageOption[] = [
  { id: "en", label: "English", shortLabel: "EN" },
  { id: "zh", label: "中文", shortLabel: "中文" },
  { id: "ta", label: "தமிழ்", shortLabel: "தமி" },
  { id: "ms", label: "Bahasa Melayu", shortLabel: "BM" },
];

const STORAGE_KEY = "memento-language";

// ─── Translation keys ────────────────────────────────────
// Only UI chrome strings. Conversational AI text is handled server-side.
export const translations: Record<Language, Record<string, string>> = {
  en: {
    // Nav
    "nav.home": "Home",
    "nav.wellness": "Wellness",
    "nav.reminders": "Reminders",
    "nav.schedule": "Schedule",
    "nav.settings": "Settings",

    // Home
    "home.chatLog": "Chat Log",
    "home.listening": "Listening...",
    "mic.startTalking": "Start talking",
    "mic.connecting": "Connecting...",
    "mic.unmute": "Unmute microphone",
    "mic.mute": "Mute microphone",

    // Onboarding
    "onboarding.slide1.title": "Tap to talk",
    "onboarding.slide1.body": "Press the microphone button and speak naturally. I'm here to chat, help you remember things, and keep you company.",
    "onboarding.slide2.title": "Reminders & schedules",
    "onboarding.slide2.body": "Tell me about your appointments or medications. I'll remind you so you never forget.",
    "onboarding.slide3.title": "Always here for you",
    "onboarding.slide3.body": "I listen, I remember, and I care. Think of me as your friendly companion, always ready when you need me.",
    "onboarding.welcome.tagline": "Your Friendly Companion",
    "onboarding.welcome.chooseLanguage": "Choose your language",
    "onboarding.welcome.continue": "Continue",
    "onboarding.personalize.title": "Make it yours",
    "onboarding.personalize.background": "Choose a background",
    "onboarding.personalize.avatar": "Choose a companion",
    "onboarding.skip": "Skip",
    "onboarding.next": "Next",
    "onboarding.getStarted": "Get started",

    // Schedule
    "schedule.month": "Month",
    "schedule.week": "Week",
    "schedule.day": "Day",
    "schedule.today": "Today",
    "schedule.todaySchedule": "Today's schedule",
    "schedule.noEvents": "No events this day",
    "schedule.addOne": "+ Add one",
    "schedule.nothingScheduled": "Nothing scheduled",
    "schedule.newEvent": "New Event",
    "schedule.title": "Title",
    "schedule.date": "Date",
    "schedule.time": "Time",
    "schedule.type": "Type",
    "schedule.notes": "Notes",
    "schedule.notesOptional": "(optional)",
    "schedule.save": "Save Event",
    "schedule.titlePlaceholder": "e.g. Doctor appointment",
    "schedule.notesPlaceholder": "Any extra details...",
    "schedule.type.routine": "Routine",
    "schedule.type.activity": "Activity",
    "schedule.type.medical": "Medical",
    "schedule.type.family": "Family",

    // Settings
    "settings.background": "Background",
    "settings.avatar": "Avatar",
    "settings.language": "Language",
    "settings.settings": "Settings",
    "settings.placeholder": "Configure voice, caregiver contacts, and notification preferences. Coming soon.",
    "settings.mode": "Mode",
    "settings.elderlyMode": "Elderly",
    "settings.caretakerMode": "Caretaker",

    // Nav (extra)
    "nav.dashboard": "Dashboard",

    // Dashboard
    "dashboard.title": "Dashboard",
    "dashboard.mood": "Today's Mood",
    "dashboard.medication": "Medication",
    "dashboard.appointments": "Today's Events",
    "dashboard.lastChat": "Last Chat",
    "dashboard.alerts": "Alerts",
    "dashboard.todaySchedule": "Today's Schedule",
    "dashboard.viewAll": "View All",
    "dashboard.addMedication": "Manage Medications",
    "dashboard.addAppointment": "Manage Schedule",

    // Schedule (extra)
    "schedule.editEvent": "Edit Event",

    // Reminders
    "reminders.title": "Reminders",
    "reminders.medications": "Medications",
    "reminders.general": "General",
    "reminders.add": "New Reminder",
    "reminders.edit": "Edit Reminder",
    "reminders.save": "Save",
    "reminders.type": "Type",
    "reminders.name": "Name",
    "reminders.time": "Time",
    "reminders.dosage": "Dosage",
    "reminders.frequency": "Frequency",

    // Wellness
    "wellness.moodTitle": "How are you feeling today?",
    "wellness.activities": "Activities",
    "wellness.keepItUp": "Keep it up!",
    "wellness.mood.great": "Great",
    "wellness.mood.good": "Good",
    "wellness.mood.okay": "Okay",
    "wellness.mood.low": "Low",
    "wellness.mood.sad": "Sad",

    // Weekdays & Months
    "day.sun": "Sun", "day.mon": "Mon", "day.tue": "Tue", "day.wed": "Wed",
    "day.thu": "Thu", "day.fri": "Fri", "day.sat": "Sat",
    "month.0": "January", "month.1": "February", "month.2": "March",
    "month.3": "April", "month.4": "May", "month.5": "June",
    "month.6": "July", "month.7": "August", "month.8": "September",
    "month.9": "October", "month.10": "November", "month.11": "December",
  },

  zh: {
    "nav.home": "首页",
    "nav.wellness": "健康",
    "nav.reminders": "提醒",
    "nav.schedule": "日程",
    "nav.settings": "设置",

    "home.chatLog": "聊天记录",
    "home.listening": "聆听中...",
    "mic.startTalking": "点击说话",
    "mic.connecting": "连接中...",
    "mic.unmute": "取消静音",
    "mic.mute": "静音",

    "onboarding.slide1.title": "点击说话",
    "onboarding.slide1.body": "按下麦克风按钮，自然地说话。我在这里陪你聊天，帮你记住事情，陪伴你。",
    "onboarding.slide2.title": "提醒与日程",
    "onboarding.slide2.body": "告诉我你的预约或用药时间。我会提醒你，让你不再忘记。",
    "onboarding.slide3.title": "时刻守护你",
    "onboarding.slide3.body": "我倾听，我记住，我关心。把我当作你的好朋友，随时在你身边。",
    "onboarding.welcome.tagline": "你的贴心伙伴",
    "onboarding.welcome.chooseLanguage": "选择语言",
    "onboarding.welcome.continue": "继续",
    "onboarding.personalize.title": "个性化设置",
    "onboarding.personalize.background": "选择背景",
    "onboarding.personalize.avatar": "选择伙伴",
    "onboarding.skip": "跳过",
    "onboarding.next": "下一步",
    "onboarding.getStarted": "开始使用",

    "schedule.month": "月",
    "schedule.week": "周",
    "schedule.day": "日",
    "schedule.today": "今天",
    "schedule.todaySchedule": "今天的日程",
    "schedule.noEvents": "今天没有事项",
    "schedule.addOne": "+ 添加",
    "schedule.nothingScheduled": "暂无安排",
    "schedule.newEvent": "新事项",
    "schedule.title": "标题",
    "schedule.date": "日期",
    "schedule.time": "时间",
    "schedule.type": "类型",
    "schedule.notes": "备注",
    "schedule.notesOptional": "（选填）",
    "schedule.save": "保存",
    "schedule.titlePlaceholder": "例：看医生",
    "schedule.notesPlaceholder": "其他详情...",
    "schedule.type.routine": "日常",
    "schedule.type.activity": "活动",
    "schedule.type.medical": "医疗",
    "schedule.type.family": "家庭",

    "settings.background": "背景",
    "settings.avatar": "形象",
    "settings.language": "语言",
    "settings.settings": "设置",
    "settings.placeholder": "配置语音、看护人联系方式和通知偏好。即将推出。",
    "settings.mode": "模式",
    "settings.elderlyMode": "长辈",
    "settings.caretakerMode": "看护人",

    "nav.dashboard": "仪表盘",

    "dashboard.title": "仪表盘",
    "dashboard.mood": "今日心情",
    "dashboard.medication": "用药",
    "dashboard.appointments": "今日事项",
    "dashboard.lastChat": "上次聊天",
    "dashboard.alerts": "提醒通知",
    "dashboard.todaySchedule": "今日日程",
    "dashboard.viewAll": "查看全部",
    "dashboard.addMedication": "管理用药",
    "dashboard.addAppointment": "管理日程",

    "schedule.editEvent": "编辑事项",

    "reminders.title": "提醒",
    "reminders.medications": "用药提醒",
    "reminders.general": "一般提醒",
    "reminders.add": "新增提醒",
    "reminders.edit": "编辑提醒",
    "reminders.save": "保存",
    "reminders.type": "类型",
    "reminders.name": "名称",
    "reminders.time": "时间",
    "reminders.dosage": "剂量",
    "reminders.frequency": "频率",

    "wellness.moodTitle": "你今天感觉怎么样？",
    "wellness.activities": "活动",
    "wellness.keepItUp": "继续加油！",
    "wellness.mood.great": "很好",
    "wellness.mood.good": "好",
    "wellness.mood.okay": "还行",
    "wellness.mood.low": "不太好",
    "wellness.mood.sad": "难过",

    "day.sun": "日", "day.mon": "一", "day.tue": "二", "day.wed": "三",
    "day.thu": "四", "day.fri": "五", "day.sat": "六",
    "month.0": "一月", "month.1": "二月", "month.2": "三月",
    "month.3": "四月", "month.4": "五月", "month.5": "六月",
    "month.6": "七月", "month.7": "八月", "month.8": "九月",
    "month.9": "十月", "month.10": "十一月", "month.11": "十二月",
  },

  ta: {
    "nav.home": "முகப்பு",
    "nav.wellness": "நலம்",
    "nav.reminders": "நினைவூட்டல்",
    "nav.schedule": "அட்டவணை",
    "nav.settings": "அமைப்புகள்",

    "home.chatLog": "உரையாடல்",
    "home.listening": "கேட்கிறேன்...",
    "mic.startTalking": "பேச தட்டவும்",
    "mic.connecting": "இணைக்கிறது...",
    "mic.unmute": "ஒலி திற",
    "mic.mute": "ஒலி நிறுத்து",

    "onboarding.slide1.title": "பேச தட்டவும்",
    "onboarding.slide1.body": "மைக்ரோஃபோன் பொத்தானை அழுத்தி இயல்பாகப் பேசுங்கள். உங்களுடன் பேச, நினைவில் கொள்ள, உங்களுக்கு துணையாக இருக்க நான் இங்கே இருக்கிறேன்.",
    "onboarding.slide2.title": "நினைவூட்டல் & அட்டவணை",
    "onboarding.slide2.body": "உங்கள் சந்திப்புகள் அல்லது மருந்துகளைப் பற்றி சொல்லுங்கள். நீங்கள் மறக்காமல் இருக்க நான் நினைவூட்டுவேன்.",
    "onboarding.slide3.title": "எப்போதும் உங்களுக்காக",
    "onboarding.slide3.body": "நான் கேட்கிறேன், நினைவில் கொள்கிறேன், அக்கறை கொள்கிறேன். உங்கள் நட்பான தோழனாக என்னை நினையுங்கள்.",
    "onboarding.welcome.tagline": "உங்கள் நட்பான தோழன்",
    "onboarding.welcome.chooseLanguage": "மொழியைத் தேர்வுசெய்",
    "onboarding.welcome.continue": "தொடர்",
    "onboarding.personalize.title": "உங்களுக்கேற்ப அமை",
    "onboarding.personalize.background": "பின்னணி தேர்வு",
    "onboarding.personalize.avatar": "தோழனைத் தேர்வு",
    "onboarding.skip": "தவிர்",
    "onboarding.next": "அடுத்து",
    "onboarding.getStarted": "தொடங்கு",

    "schedule.month": "மாதம்",
    "schedule.week": "வாரம்",
    "schedule.day": "நாள்",
    "schedule.today": "இன்று",
    "schedule.todaySchedule": "இன்றைய அட்டவணை",
    "schedule.noEvents": "இன்று நிகழ்வுகள் இல்லை",
    "schedule.addOne": "+ சேர்",
    "schedule.nothingScheduled": "எதுவும் திட்டமிடவில்லை",
    "schedule.newEvent": "புதிய நிகழ்வு",
    "schedule.title": "தலைப்பு",
    "schedule.date": "தேதி",
    "schedule.time": "நேரம்",
    "schedule.type": "வகை",
    "schedule.notes": "குறிப்புகள்",
    "schedule.notesOptional": "(விருப்பம்)",
    "schedule.save": "சேமி",
    "schedule.titlePlaceholder": "எ.கா. மருத்துவர் சந்திப்பு",
    "schedule.notesPlaceholder": "கூடுதல் விவரங்கள்...",
    "schedule.type.routine": "வழக்கம்",
    "schedule.type.activity": "செயல்பாடு",
    "schedule.type.medical": "மருத்துவம்",
    "schedule.type.family": "குடும்பம்",

    "settings.background": "பின்னணி",
    "settings.avatar": "அவதார்",
    "settings.language": "மொழி",
    "settings.settings": "அமைப்புகள்",
    "settings.placeholder": "குரல், பராமரிப்பாளர் தொடர்புகள் மற்றும் அறிவிப்பு விருப்பங்களை அமைக்கவும். விரைவில் வரும்.",
    "settings.mode": "முறை",
    "settings.elderlyMode": "முதியோர்",
    "settings.caretakerMode": "பராமரிப்பாளர்",

    "nav.dashboard": "டாஷ்போர்டு",

    "dashboard.title": "டாஷ்போர்டு",
    "dashboard.mood": "இன்றைய மனநிலை",
    "dashboard.medication": "மருந்து",
    "dashboard.appointments": "இன்றைய நிகழ்வுகள்",
    "dashboard.lastChat": "கடைசி உரையாடல்",
    "dashboard.alerts": "எச்சரிக்கைகள்",
    "dashboard.todaySchedule": "இன்றைய அட்டவணை",
    "dashboard.viewAll": "அனைத்தையும் காண்",
    "dashboard.addMedication": "மருந்துகளை நிர்வகி",
    "dashboard.addAppointment": "அட்டவணையை நிர்வகி",

    "schedule.editEvent": "நிகழ்வைத் திருத்து",

    "reminders.title": "நினைவூட்டல்",
    "reminders.medications": "மருந்துகள்",
    "reminders.general": "பொது",
    "reminders.add": "புதிய நினைவூட்டல்",
    "reminders.edit": "நினைவூட்டலைத் திருத்து",
    "reminders.save": "சேமி",
    "reminders.type": "வகை",
    "reminders.name": "பெயர்",
    "reminders.time": "நேரம்",
    "reminders.dosage": "அளவு",
    "reminders.frequency": "அலைவரிசை",

    "wellness.moodTitle": "இன்று எப்படி உணர்கிறீர்கள்?",
    "wellness.activities": "செயல்பாடுகள்",
    "wellness.keepItUp": "தொடருங்கள்!",
    "wellness.mood.great": "மிகச்சிறப்பு",
    "wellness.mood.good": "நல்லது",
    "wellness.mood.okay": "பரவாயில்லை",
    "wellness.mood.low": "சரியில்லை",
    "wellness.mood.sad": "வருத்தம்",

    "day.sun": "ஞா", "day.mon": "தி", "day.tue": "செ", "day.wed": "பு",
    "day.thu": "வி", "day.fri": "வெ", "day.sat": "ச",
    "month.0": "ஜனவரி", "month.1": "பிப்ரவரி", "month.2": "மார்ச்",
    "month.3": "ஏப்ரல்", "month.4": "மே", "month.5": "ஜூன்",
    "month.6": "ஜூலை", "month.7": "ஆகஸ்ட்", "month.8": "செப்டம்பர்",
    "month.9": "அக்டோபர்", "month.10": "நவம்பர்", "month.11": "டிசம்பர்",
  },

  ms: {
    "nav.home": "Laman Utama",
    "nav.wellness": "Kesejahteraan",
    "nav.reminders": "Peringatan",
    "nav.schedule": "Jadual",
    "nav.settings": "Tetapan",

    "home.chatLog": "Log Sembang",
    "home.listening": "Sedang mendengar...",
    "mic.startTalking": "Mula bercakap",
    "mic.connecting": "Sedang menyambung...",
    "mic.unmute": "Buka mikrofon",
    "mic.mute": "Bisukan mikrofon",

    "onboarding.welcome.tagline": "Teman Mesra Anda",
    "onboarding.welcome.chooseLanguage": "Pilih bahasa",
    "onboarding.welcome.continue": "Teruskan",
    "onboarding.skip": "Langkau",
    "onboarding.next": "Seterusnya",
    "onboarding.getStarted": "Mula",

    "settings.language": "Bahasa",
  },

};

// ─── Context ─────────────────────────────────────────────
interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: "en",
  setLanguage: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
    if (saved && translations[saved]) {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  }, []);

  const t = useCallback(
    (key: string): string => {
      return translations[language][key] ?? translations.en[key] ?? key;
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
