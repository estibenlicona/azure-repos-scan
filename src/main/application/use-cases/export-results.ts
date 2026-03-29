/** Use case: export search results to Excel. */

import ExcelJS from "exceljs";
import type { CodeSearchHit } from "../../domain/models";
import { getDotNetLabel } from "../../domain/models";

export class ExportResultsUseCase {
  async execute(
    hits: readonly CodeSearchHit[],
    outputPath: string,
  ): Promise<string> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Resultados .NET");

    // Headers
    const headers = ["Repositorio", "Proyecto", "Versión .NET", "Branch"];
    const headerRow = sheet.addRow(headers);

    const azureBlue = "FF0078D4";
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: azureBlue },
      };
      cell.alignment = { horizontal: "center" };
    });

    // Data rows
    for (const hit of hits) {
      sheet.addRow([
        hit.repositoryName,
        hit.projectName,
        getDotNetLabel(hit.dotnetVersion),
        hit.branch,
      ]);
    }

    // Auto-fit column widths
    for (const column of sheet.columns) {
      let maxLength = 0;
      column.eachCell?.({ includeEmpty: true }, (cell) => {
        const length = String(cell.value ?? "").length;
        if (length > maxLength) {
          maxLength = length;
        }
      });
      column.width = Math.min(maxLength + 4, 60);
    }

    await workbook.xlsx.writeFile(outputPath);
    return outputPath;
  }
}
