import { Compass } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function DiscoverPage() {
  return (
    <div className="flex items-center justify-center p-6 md:p-10">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center">
          <Compass className="size-12 text-muted-foreground" />
          <CardTitle className="text-2xl">Discover</CardTitle>
          <CardDescription>
            Explore new music and get personalized recommendations based on your
            collection and listening habits.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
