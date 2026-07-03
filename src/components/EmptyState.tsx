"use client";

import { Search, SwordsIcon } from "lucide-react";

type Props = {
  title: string;
  description?: string;
  icon?: "search" | "swords";
};

export function EmptyState({ title, description, icon = "search" }: Props) {
  const Icon = icon === "swords" ? SwordsIcon : Search;
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
      <div className="rounded-full bg-muted p-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium">{title}</p>
        {description && (
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
