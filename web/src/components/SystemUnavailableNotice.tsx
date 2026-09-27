import { AlertTriangle } from "lucide-react";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";

export function SystemUnavailableNotice({
  failures,
  hasAnyPayload,
  onRetry,
}: {
  failures: string[];
  hasAnyPayload: boolean;
  onRetry: () => void;
}) {
  if (failures.length === 0) return null;

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="text-sm font-medium">
              {hasAnyPayload
                ? "Some System APIs did not load."
                : "System details did not load."}
            </p>
            <p className="text-sm text-muted-foreground">
              {hasAnyPayload
                ? "Only payloads that returned are shown. Missing sections are omitted on purpose — this page will not invent host or gateway numbers."
                : "The page title is not a status report. Reads returned unauthorized or timed out. This page will not invent host stats or gateway state."}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {failures.map((name) => (
                <Badge key={name} tone="outline" className="text-xs">
                  {name}
                </Badge>
              ))}
            </div>
            <div>
              <Button size="sm" ghost onClick={onRetry}>
                Retry
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
