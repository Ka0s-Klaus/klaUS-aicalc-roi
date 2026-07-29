"use client";

import { jsPDF } from "jspdf";
import { AnalysisResult, ModelSpec, UseCase } from "@/types/tco";

interface PDFDownloadButtonProps {
  result: AnalysisResult;
  models: ModelSpec[];
  useCase: UseCase;
  horizonMonths: number;
}

export function PDFDownloadButton({
  result,
  models,
  useCase,
  horizonMonths,
}: PDFDownloadButtonProps) {
  const generatePDF = () => {
    const doc = new jsPDF();
    let yPos = 15;
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const margin = 12;
    const contentWidth = pageWidth - 2 * margin;

    const ensurePage = (neededHeight: number = 10) => {
      if (yPos + neededHeight > pageHeight - 10) {
        doc.addPage();
        yPos = margin;
      }
    };

    const addSpacing = (height: number = 8) => {
      yPos += height;
    };

    // Header con fondo
    doc.setFillColor(31, 41, 55);
    doc.rect(0, 0, pageWidth, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("klaUS-aicalc-roi", margin, 15);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Analisis TCO de Infraestructura IA", margin, 22);

    yPos = 35;
    doc.setTextColor(0, 0, 0);

    // Fecha
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha: ${new Date().toLocaleDateString("es-ES")}`, margin, yPos);
    addSpacing(12);

    // Seccion: Resumen Ejecutivo
    ensurePage(25);
    doc.setFillColor(59, 130, 246);
    doc.rect(margin, yPos, contentWidth, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("RESUMEN EJECUTIVO", margin + 3, yPos + 5);
    addSpacing(10);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const summaryLines = doc.splitTextToSize(result.input_summary, contentWidth - 4);
    doc.text(summaryLines, margin + 2, yPos);
    yPos += summaryLines.length * 4 + 3;
    addSpacing(5);

    // Seccion: Configuracion
    ensurePage(55);
    doc.setFillColor(59, 130, 246);
    doc.rect(margin, yPos, contentWidth, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("CONFIGURACION DEL ANALISIS", margin + 3, yPos + 5);
    addSpacing(9);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");

    const configGrid = [
      [`Caso de uso: ${useCase.name}`, `Modelos: ${models.length}`],
      [`Horizonte: ${horizonMonths} meses`, `Precision: ${useCase.precision}`],
      [
        `Entrada/mes: ${(useCase.monthly_input_tokens / 1_000_000_000).toFixed(1)}B tokens`,
        `Salida/mes: ${(useCase.monthly_output_tokens / 1_000_000_000).toFixed(1)}B tokens`,
      ],
      [`Usuarios concurrentes: ${useCase.concurrent_users}`, `Usuarios totales: ${useCase.total_users}`],
      [`Contexto: ${useCase.context_window_tokens.toLocaleString()} tokens`, ""],
    ];

    configGrid.forEach((row) => {
      doc.text(row[0], margin + 3, yPos);
      if (row[1]) doc.text(row[1], margin + contentWidth / 2 + 2, yPos);
      addSpacing(5);
    });
    addSpacing(3);

    // Seccion: Recomendacion
    if (result.recommendation) {
      ensurePage(35);
      doc.setFillColor(34, 197, 94);
      doc.rect(margin, yPos, contentWidth, 7, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("RECOMENDACION OPTIMA", margin + 3, yPos + 5);
      addSpacing(10);

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");

      const rec = result.recommendation;
      const recData = [
        `Modelo: ${rec.strategy.model_id}`,
        `Tipo: ${rec.strategy.deployment_type === "cloud_api" ? "API en Nube" : "Local"}`,
        ...(rec.strategy.hardware_id ? [`Hardware: ${rec.strategy.hardware_id}`] : []),
      ];

      recData.forEach((line) => {
        doc.text(line, margin + 3, yPos);
        addSpacing(4.5);
      });

      // Costes destacados
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      const costData = [
        [
          "Coste total",
          `$${Number(rec.strategy.total_cost_usd).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
        ],
        [
          "Coste mensual",
          `$${Number(rec.strategy.monthly_cost_avg_usd).toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
        ],
      ];

      if (Number(rec.strategy.capex_usd) > 0) {
        costData.push([
          "CAPEX",
          `$${Number(rec.strategy.capex_usd).toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
        ]);
      }

      if (Number(rec.strategy.opex_total_usd) > 0) {
        costData.push([
          `OPEX (${horizonMonths}m)`,
          `$${Number(rec.strategy.opex_total_usd).toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
        ]);
      }

      if (rec.strategy.estimated_latency_ms) {
        costData.push(["Latencia estimada", `${rec.strategy.estimated_latency_ms.toFixed(0)}ms`]);
      }

      costData.forEach(([label, value]) => {
        doc.text(label + ":", margin + 3, yPos);
        doc.text(value, margin + contentWidth / 2 + 2, yPos);
        addSpacing(4);
      });

      addSpacing(2);
    }

    // Seccion: Todas las Estrategias (Tabla)
    ensurePage(30);
    doc.setFillColor(59, 130, 246);
    doc.rect(margin, yPos, contentWidth, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`TODAS LAS ESTRATEGIAS (${result.strategies.length})`, margin + 3, yPos + 5);
    addSpacing(10);

    // Tabla de estrategias
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");

    const colWidths = [22, 22, 12, 18, 18, 25, 20, 12];
    const headers = ["Modelo", "Hardware", "Tipo", "CAPEX", "OPEX", "Total", "Latencia", "Optimo"];
    const rowHeight = 6;

    // Encabezado tabla
    doc.setFillColor(219, 234, 254);
    doc.setTextColor(0, 0, 0);
    let cellX = margin;
    let cellY = yPos;

    headers.forEach((header, idx) => {
      doc.rect(cellX, cellY, colWidths[idx], rowHeight, "S");
      doc.setFont("helvetica", "bold");
      doc.text(header, cellX + 1.5, cellY + 4);
      cellX += colWidths[idx];
    });

    addSpacing(6.5);

    // Filas de estrategias
    doc.setFont("helvetica", "normal");
    let rowIdx = 0;
    result.strategies.forEach((s) => {
      ensurePage(8);

      const isPareto = result.pareto_optimal_ids.includes(
        s.model_id + (s.hardware_id ? "/" + s.hardware_id : "")
      );

      // Fila alternada
      if (rowIdx % 2 === 0) {
        doc.setFillColor(245, 245, 245);
      } else {
        doc.setFillColor(255, 255, 255);
      }

      cellX = margin;
      cellY = yPos;
      headers.forEach((_, idx) => {
        doc.rect(cellX, cellY, colWidths[idx], rowHeight, "F");
        doc.setDrawColor(220, 220, 220);
        doc.rect(cellX, cellY, colWidths[idx], rowHeight);
        cellX += colWidths[idx];
      });

      // Texto de fila
      doc.setTextColor(0, 0, 0);
      const row = [
        s.model_id.substring(0, 15),
        (s.hardware_id || "—").substring(0, 15),
        s.deployment_type === "cloud_api" ? "API" : "Local",
        Number(s.capex_usd) > 0 ? `$${Number(s.capex_usd).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—",
        Number(s.opex_total_usd) > 0 ? `$${Number(s.opex_total_usd).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—",
        `$${Number(s.total_cost_usd).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
        s.estimated_latency_ms ? `${s.estimated_latency_ms.toFixed(0)}ms` : "—",
        isPareto ? "SI" : "—",
      ];

      cellX = margin;
      row.forEach((cell, idx) => {
        doc.text(String(cell), cellX + 1.5, cellY + 4.2);
        cellX += colWidths[idx];
      });

      addSpacing(6.5);
      rowIdx++;
    });

    // Pie de pagina
    doc.setFontSize(7);
    doc.setTextColor(128, 128, 128);
    doc.setFont("helvetica", "normal");
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.text(
        `Generado el ${new Date().toLocaleString("es-ES")} | Pagina ${i} de ${totalPages}`,
        margin,
        pageHeight - 5
      );
    }

    // Guardamos el PDF
    doc.save(
      `klaUS-aicalc-roi_${useCase.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`
    );
  };

  return (
    <button
      onClick={generatePDF}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white transition-colors
        bg-emerald-600 hover:bg-emerald-700"
    >
      Descargar analisis en PDF
    </button>
  );
}
