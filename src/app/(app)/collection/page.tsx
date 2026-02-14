import { Library } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function CollectionPage() {
  return (
    <div className="flex items-center justify-center p-6 md:p-10">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center">
          <Library className="size-12 text-muted-foreground" />
          <CardTitle className="text-2xl">Your Collection</CardTitle>
          <CardDescription>
            Track and manage your vinyl record collection with market values and
            detailed pressing information.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
