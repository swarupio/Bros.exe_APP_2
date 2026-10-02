import { AppShell } from "@/components/app-shell";
import { SettingsScreen } from "@/components/screens/settings-screen";

export default function Settings() {
  return <AppShell active="settings"><SettingsScreen/></AppShell>;
}
