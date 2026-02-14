import { Heart } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function WantlistPage() {
  return (
    <div className="flex items-center justify-center p-6 md:p-10">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center">
          <Heart className="size-12 text-muted-foreground" />
          <CardTitle className="text-2xl">Your Wantlist</CardTitle>
          <CardDescription>
            Keep track of records you want to add to your collection and get
            notified about price changes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
