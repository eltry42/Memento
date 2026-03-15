import TopNavBar from "@/components/navigation/TopNavBar";
import AvatarStateMachineProvider from "@/components/avatar/AvatarStateMachine";
import { BackgroundProvider } from "@/hooks/useBackground";
import { AvatarProvider } from "@/hooks/useAvatar";
import { LanguageProvider } from "@/hooks/useLanguage";
import ReminderPopup from "@/components/reminder/ReminderPopup";
import { ModeProvider } from "@/hooks/useMode";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LanguageProvider>
      <ModeProvider>
        <BackgroundProvider>
          <AvatarProvider>
            <AvatarStateMachineProvider>
              <TopNavBar />
              <ReminderPopup />
              {children}
            </AvatarStateMachineProvider>
          </AvatarProvider>
        </BackgroundProvider>
      </ModeProvider>
    </LanguageProvider>
  );
}
