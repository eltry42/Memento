import GlobalReminderPopup from "@/components/navigation/GlobalReminderPopup";
import TopNavBar from "@/components/navigation/TopNavBar";
import AvatarStateMachineProvider from "@/components/avatar/AvatarStateMachine";
import { BackgroundProvider } from "@/hooks/useBackground";
import { AvatarProvider } from "@/hooks/useAvatar";
import { LanguageProvider } from "@/hooks/useLanguage";
import { ModeProvider } from "@/hooks/useMode";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ModeProvider>
      <LanguageProvider>
        <BackgroundProvider>
          <AvatarProvider>
            <AvatarStateMachineProvider>
              <TopNavBar />
              <GlobalReminderPopup />
              {children}
            </AvatarStateMachineProvider>
          </AvatarProvider>
        </BackgroundProvider>
      </LanguageProvider>
    </ModeProvider>
  );
}
