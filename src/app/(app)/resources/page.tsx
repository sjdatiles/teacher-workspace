import { FolderOpen } from "lucide-react";
import type { Metadata } from "next";
import { ModuleEmptyPage } from "@/components/layout/ModuleEmptyPage";

export const metadata: Metadata = { title: "Resources" };

export default function ResourcesPage() {
  return (
    <ModuleEmptyPage
      title="Resources"
      description="Save and organize useful online teaching links."
      icon={FolderOpen}
      emptyTitle="No resources saved"
      emptyDescription="Links to websites, Google Drive files and online references will be saved here."
    />
  );
}
