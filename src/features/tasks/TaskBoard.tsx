"use client";

import { useClearNewParam } from "@/lib/use-auto-open";
import clsx from "clsx";
import { CheckCircle2, Circle, ClipboardList, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { NoticeBar } from "@/components/ui/Notice";
import { formatDate } from "@/lib/time";
import { useRunAction } from "@/lib/use-action";
import { deleteTask, setTaskStatus } from "./actions";
import { TASK_STATUSES, categoryLabel, priorityMeta, statusMeta, type TaskView } from "./constants";
import { dueLabel, isOverdue } from "./rules";
import { TaskForm } from "./TaskForm";
import type { Task } from "./types";

type Dialog = { kind: "form"; task?: Task } | { kind: "delete"; task: Task } | null;

export function TaskBoard({
  view,
  tasks,
  today,
  hasAny,
  filtered,
  autoOpen = false,
}: {
  view: TaskView;
  tasks: Task[];
  today: string;
  /** The teacher has at least one task (even if filters hide all of them). */
  hasAny: boolean;
  filtered: boolean;
  /** Open the add form straight away (Home quick action). */
  autoOpen?: boolean;
}) {
  const [dialog, setDialog] = useState<Dialog>(autoOpen ? { kind: "form" } : null);
  useClearNewParam(autoOpen);
  const { run, pending, notice, clear, show } = useRunAction();
  const close = () => setDialog(null);

  const moveTo = (t: Task, status: string) => run(() => setTaskStatus(t.id, status));

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-soft text-sm">
          Teaching, administrative, school and personal responsibilities. Tasks are separate from
          teaching sessions and never count toward your teaching reports.
        </p>
        <Button size="sm" onClick={() => setDialog({ kind: "form" })}>
          <Plus className="size-4" aria-hidden /> Add task
        </Button>
      </div>
      <NoticeBar notice={notice} onClose={clear} />

      {tasks.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-8" aria-hidden />}
          title={hasAny && filtered ? "No tasks match these filters" : "No tasks yet"}
          description={
            hasAny && filtered
              ? "Try clearing a filter or searching for something else."
              : "Add your first task. Give it a category, a priority and an optional due date."
          }
          action={
            !hasAny ? (
              <Button onClick={() => setDialog({ kind: "form" })}>
                <Plus className="size-4" aria-hidden /> Add task
              </Button>
            ) : undefined
          }
        />
      ) : view === "list" ? (
        <ul className="divide-line divide-y">
          {tasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              today={today}
              disabled={pending}
              onMove={moveTo}
              onEdit={() => setDialog({ kind: "form", task: t })}
              onDelete={() => setDialog({ kind: "delete", task: t })}
            />
          ))}
        </ul>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {TASK_STATUSES.map((s) => {
            const column = tasks.filter((t) => t.status === s.value);
            return (
              <section key={s.value} aria-label={s.label} className="bg-canvas/60 rounded-xl p-2.5">
                <h3 className="mb-2 flex items-center justify-between px-1 text-sm font-bold">
                  <span>{s.label}</span>
                  <Badge tone={s.tone}>{column.length}</Badge>
                </h3>
                {column.length === 0 ? (
                  <p className="text-ink-faint px-1 py-3 text-xs">Nothing here</p>
                ) : (
                  <ul className="space-y-2">
                    {column.map((t) => (
                      <li
                        key={t.id}
                        className="rounded-control border-line bg-surface space-y-2 border p-3 shadow-sm"
                      >
                        <p
                          className={clsx(
                            "text-ink text-sm font-bold",
                            t.status === "completed" && "text-ink-soft line-through",
                          )}
                        >
                          {t.title}
                        </p>
                        <TaskMeta task={t} today={today} hideStatus />
                        <div className="flex items-center gap-1.5">
                          <select
                            aria-label={`Move “${t.title}” to`}
                            value={t.status}
                            disabled={pending}
                            onChange={(e) => moveTo(t, e.target.value)}
                            className="rounded-control border-line bg-surface focus:border-brand-400 h-9 min-w-0 flex-1 border px-2 text-xs"
                          >
                            {TASK_STATUSES.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          <IconButton
                            label={`Edit ${t.title}`}
                            onClick={() => setDialog({ kind: "form", task: t })}
                          >
                            <Pencil className="size-4" aria-hidden />
                          </IconButton>
                          <IconButton
                            label={`Delete ${t.title}`}
                            onClick={() => setDialog({ kind: "delete", task: t })}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </IconButton>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {dialog?.kind === "form" && (
        <Modal open onClose={close} title={dialog.task ? "Edit task" : "Add task"}>
          <TaskForm
            task={dialog.task}
            onDone={(m) => {
              close();
              show(m);
            }}
            onCancel={close}
          />
        </Modal>
      )}
      {dialog?.kind === "delete" && (
        <ConfirmModal
          title="Delete this task?"
          confirmLabel="Delete task"
          pending={pending}
          onClose={close}
          onConfirm={() => run(() => deleteTask(dialog.task.id), close)}
        >
          <p>“{dialog.task.title}” will be removed. This cannot be undone.</p>
        </ConfirmModal>
      )}
    </Card>
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

function TaskMeta({
  task,
  today,
  hideStatus,
}: {
  task: Task;
  today: string;
  hideStatus?: boolean;
}) {
  const overdue = isOverdue(task, today);
  const pr = priorityMeta(task.priority);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge tone={pr.tone}>{pr.label}</Badge>
      <Badge tone="neutral">{categoryLabel(task.category)}</Badge>
      {!hideStatus && (
        <Badge tone={statusMeta(task.status).tone}>{statusMeta(task.status).label}</Badge>
      )}
      {task.status !== "completed" && (
        <span
          className={clsx("text-xs font-semibold", overdue ? "text-danger-500" : "text-ink-soft")}
        >
          {dueLabel(task.dueDate, today, formatDate)}
        </span>
      )}
      {task.status === "completed" && task.completedAt && (
        <span className="text-ink-faint text-xs">
          Completed {formatDate(task.completedAt.slice(0, 10))}
        </span>
      )}
    </div>
  );
}

function TaskRow({
  task,
  today,
  disabled,
  onMove,
  onEdit,
  onDelete,
}: {
  task: Task;
  today: string;
  disabled: boolean;
  onMove: (t: Task, status: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const done = task.status === "completed";
  return (
    <li className="flex items-start gap-3 py-3.5">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onMove(task, done ? "todo" : "completed")}
        aria-label={done ? `Reopen “${task.title}”` : `Mark “${task.title}” completed`}
        className={clsx(
          "mt-0.5 shrink-0 rounded-full",
          done ? "text-success-500" : "text-ink-faint hover:text-brand-600",
        )}
      >
        {done ? (
          <CheckCircle2 className="size-6" aria-hidden />
        ) : (
          <Circle className="size-6" aria-hidden />
        )}
      </button>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className={clsx("text-ink font-bold", done && "text-ink-soft line-through")}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-ink-soft line-clamp-2 text-sm">{task.description}</p>
        )}
        <TaskMeta task={task} today={today} />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <select
          aria-label={`Status of “${task.title}”`}
          value={task.status}
          disabled={disabled}
          onChange={(e) => onMove(task, e.target.value)}
          className="rounded-control border-line bg-surface focus:border-brand-400 hidden h-9 border px-2 text-xs sm:block"
        >
          {TASK_STATUSES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <IconButton label={`Edit ${task.title}`} onClick={onEdit}>
          <Pencil className="size-4" aria-hidden />
        </IconButton>
        <IconButton label={`Delete ${task.title}`} onClick={onDelete}>
          <Trash2 className="size-4" aria-hidden />
        </IconButton>
      </div>
    </li>
  );
}
