"use client";

import clsx from "clsx";
import {
  ExternalLink,
  Folder as FolderIcon,
  FolderPlus,
  Link2,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { NoticeBar } from "@/components/ui/Notice";
import { formatDate } from "@/lib/time";
import { useRunAction } from "@/lib/use-action";
import { deleteFolder, deleteResource, setFavorite } from "./actions";
import { typeMeta } from "./constants";
import { FolderForm } from "./FolderForm";
import { hostLabel } from "./rules";
import { ResourceForm } from "./ResourceForm";
import type { Folder, Resource, SubjectOption } from "./types";

export type FolderTile = Folder & { href: string; active: boolean };

type Dialog =
  | { kind: "resource"; resource?: Resource }
  | { kind: "deleteResource"; resource: Resource }
  | { kind: "folder"; folder?: { id: string; name: string } }
  | { kind: "deleteFolder"; folder: Folder }
  | null;

export function ResourceLibrary({
  rows,
  folders,
  allHref,
  allActive,
  noFolder,
  subjects,
  subjectNames,
  selectedFolder,
  tagHref,
  hasAny,
  filtered,
  filters,
}: {
  rows: Resource[];
  folders: FolderTile[];
  allHref: string;
  allActive: boolean;
  noFolder: { count: number; href: string; active: boolean };
  subjects: SubjectOption[];
  subjectNames: Record<string, string>;
  selectedFolder: Folder | null;
  tagHref: Record<string, string>;
  hasAny: boolean;
  filtered: boolean;
  /** The search/filter form, rendered above the list. */
  filters: ReactNode;
}) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const { run, pending, notice, clear, show } = useRunAction();
  const close = () => setDialog(null);
  const folderName = (id: string | null) => folders.find((f) => f.id === id)?.name;
  const plainFolders: Folder[] = folders.map(({ id, name, count }) => ({ id, name, count }));

  return (
    <>
      <Card className="mb-4 p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-ink flex items-center gap-2 text-base font-bold">
            <FolderIcon className="text-brand-600 size-5" aria-hidden /> Folders
          </h2>
          <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: "folder" })}>
            <FolderPlus className="size-4" aria-hidden /> New folder
          </Button>
        </div>
        <nav aria-label="Folders" className="flex flex-wrap gap-2">
          <FolderChip href={allHref} active={allActive} name="All resources" />
          {folders.map((f) => (
            <FolderChip key={f.id} href={f.href} active={f.active} name={f.name} count={f.count} />
          ))}
          {noFolder.count > 0 && (
            <FolderChip
              href={noFolder.href}
              active={noFolder.active}
              name="No folder"
              count={noFolder.count}
            />
          )}
        </nav>
        {selectedFolder && (
          <div className="border-line mt-3 flex flex-wrap items-center gap-2 border-t pt-3 text-sm">
            <span className="text-ink-soft">Folder “{selectedFolder.name}”:</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDialog({ kind: "folder", folder: selectedFolder })}
            >
              <Pencil className="size-4" aria-hidden /> Rename
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDialog({ kind: "deleteFolder", folder: selectedFolder })}
            >
              <Trash2 className="size-4" aria-hidden /> Delete folder
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-ink text-base font-bold">My resources</h2>
          <Button size="sm" onClick={() => setDialog({ kind: "resource" })}>
            <Plus className="size-4" aria-hidden /> Add resource
          </Button>
        </div>
        {filters}
        <NoticeBar notice={notice} onClose={clear} />

        {rows.length === 0 ? (
          <EmptyState
            icon={<Link2 className="size-8" aria-hidden />}
            title={hasAny && filtered ? "No resources match these filters" : "No resources saved"}
            description={
              hasAny && filtered
                ? "Try clearing a filter or searching for something else."
                : "Save links to websites, Google Drive files and online references. Files are not uploaded — only links."
            }
            action={
              !hasAny ? (
                <Button onClick={() => setDialog({ kind: "resource" })}>
                  <Plus className="size-4" aria-hidden /> Add resource
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-line divide-y">
            {rows.map((r) => {
              const tm = typeMeta(r.type);
              const subject = r.subjectId ? subjectNames[r.subjectId] : null;
              return (
                <li key={r.id} className="flex items-start gap-3 py-3.5">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => setFavorite(r.id, !r.isFavorite))}
                    aria-pressed={r.isFavorite}
                    aria-label={
                      r.isFavorite
                        ? `Remove “${r.title}” from favorites`
                        : `Add “${r.title}” to favorites`
                    }
                    className={clsx(
                      "mt-0.5 shrink-0 rounded-full",
                      r.isFavorite ? "text-warning-500" : "text-ink-faint hover:text-warning-500",
                    )}
                  >
                    <Star className={clsx("size-5", r.isFavorite && "fill-current")} aria-hidden />
                  </button>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-ink font-bold break-words">{r.title}</p>
                    <p className="text-ink-faint text-xs break-all">{hostLabel(r.url)}</p>
                    {r.description && (
                      <p className="text-ink-soft line-clamp-2 text-sm">{r.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={tm.tone}>{tm.label}</Badge>
                      {folderName(r.categoryId) && (
                        <Badge tone="neutral">{folderName(r.categoryId)}</Badge>
                      )}
                      {subject && <Badge tone="brand">{subject}</Badge>}
                      {r.tags.map((t) => (
                        <Link
                          key={t}
                          href={tagHref[t] ?? "#"}
                          className="text-brand-700 text-xs font-semibold hover:underline"
                        >
                          #{t}
                        </Link>
                      ))}
                      <span className="text-ink-faint text-xs">
                        Added {formatDate(r.createdAt.slice(0, 10))}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open ${r.title} in a new tab`}
                      className="bg-brand-500 hover:bg-brand-600 rounded-control inline-flex h-9 items-center gap-1.5 px-3 text-sm font-bold text-white"
                    >
                      <ExternalLink className="size-4" aria-hidden /> Open
                    </a>
                    <div className="flex">
                      <IconButton
                        label={`Edit ${r.title}`}
                        onClick={() => setDialog({ kind: "resource", resource: r })}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </IconButton>
                      <IconButton
                        label={`Delete ${r.title}`}
                        onClick={() => setDialog({ kind: "deleteResource", resource: r })}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </IconButton>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {dialog?.kind === "resource" && (
        <Modal open onClose={close} title={dialog.resource ? "Edit resource" : "Add resource"}>
          <ResourceForm
            resource={dialog.resource}
            folders={plainFolders}
            subjects={subjects}
            defaultFolderId={selectedFolder?.id}
            onDone={(m) => {
              close();
              show(m);
            }}
            onCancel={close}
          />
        </Modal>
      )}
      {dialog?.kind === "folder" && (
        <Modal open onClose={close} title={dialog.folder ? "Rename folder" : "New folder"}>
          <FolderForm
            folder={dialog.folder}
            onDone={(m) => {
              close();
              show(m);
            }}
            onCancel={close}
          />
        </Modal>
      )}
      {dialog?.kind === "deleteResource" && (
        <ConfirmModal
          title="Delete this resource?"
          confirmLabel="Delete resource"
          pending={pending}
          onClose={close}
          onConfirm={() => run(() => deleteResource(dialog.resource.id), close)}
        >
          <p>
            “{dialog.resource.title}” will be removed from your library. The website itself is not
            affected.
          </p>
        </ConfirmModal>
      )}
      {dialog?.kind === "deleteFolder" && (
        <ConfirmModal
          title="Delete this folder?"
          confirmLabel="Delete folder"
          pending={pending}
          onClose={close}
          onConfirm={() => run(() => deleteFolder(dialog.folder.id), close)}
        >
          <p>
            The folder “{dialog.folder.name}” will be removed. Its {dialog.folder.count}{" "}
            {dialog.folder.count === 1 ? "link is" : "links are"} kept and will show as “No folder”.
          </p>
        </ConfirmModal>
      )}
    </>
  );
}

function FolderChip({
  href,
  active,
  name,
  count,
}: {
  href: string;
  active: boolean;
  name: string;
  count?: number;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "rounded-control inline-flex min-h-9 items-center gap-2 border px-3 py-1.5 text-sm font-semibold",
        active
          ? "border-brand-400 bg-brand-100 text-brand-700"
          : "border-line bg-surface text-ink-soft hover:bg-brand-50",
      )}
    >
      {name}
      {count !== undefined && <span className="text-ink-faint text-xs font-bold">{count}</span>}
    </Link>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="text-ink-soft hover:bg-brand-100 hover:text-brand-700 grid size-9 shrink-0 place-items-center rounded-lg"
    >
      {children}
    </button>
  );
}
