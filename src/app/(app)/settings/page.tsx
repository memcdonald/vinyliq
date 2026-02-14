import { Settings } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="flex items-center justify-center p-6 md:p-10">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center">
          <Settings className="size-12 text-muted-foreground" />
          <CardTitle className="text-2xl">Settings</CardTitle>
          <CardDescription>
            Manage your account preferences, connected services, and
            notification settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
