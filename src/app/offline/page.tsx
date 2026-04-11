import { WifiOff } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function OfflinePage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 py-12">
      <Card className="max-w-md border-border/80 text-center shadow-lg">
        <CardHeader className="items-center space-y-4 pb-2">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-muted/50"
            aria-hidden
          >
            <WifiOff className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <CardTitle>You are offline</CardTitle>
          <CardDescription className="text-pretty leading-relaxed">
            Trading Card Studio keeps your cards in this browser. Reconnect to load
            the latest app shell, or continue from cache where available.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-center pb-8 pt-2">
          <Link href="/" className={cn(buttonVariants({ size: "lg" }))}>
            Try again
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
