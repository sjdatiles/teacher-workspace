import { buildCsv } from "@/features/reports/rules";
import { getAcademicContext } from "@/services/academic";
import { getReport, parseReportRequest } from "@/services/reports";
import { requireTeacher } from "@/services/teacher";

export const dynamic = "force-dynamic";

/** CSV of exactly what the Reports page shows for the same URL settings. */
export async function GET(request: Request) {
  const teacher = await requireTeacher(); // redirects to /login when signed out
  const { selectedYear, activeTerm, today } = await getAcademicContext();
  if (!selectedYear) return new Response("Create an academic year first.", { status: 404 });

  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const req = await parseReportRequest(sp, selectedYear.id, activeTerm?.termNumber ?? null);
  if (req.rangeError) return new Response(req.rangeError, { status: 400 });
  const report = await getReport(req);

  const csv = buildCsv(
    [
      ["Teaching accomplishment report (completed sessions only)", ""],
      ["Teacher", teacher.fullName || teacher.email],
      ["Academic year", selectedYear.name],
      ["Period", report.periodLabel],
      ["Subject", report.subjectLabel],
      ["Section", report.sectionLabel],
      ["Generated on", today],
    ],
    report.details,
  );
  const safeName = selectedYear.name.replace(/[^A-Za-z0-9._-]+/g, "-");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="teaching-report-${safeName}-${req.period}.csv"`,
      "cache-control": "no-store",
    },
  });
}
