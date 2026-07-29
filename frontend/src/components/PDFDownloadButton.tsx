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
    let yPos = 20;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;
    const contentWidth = doc.internal.pageSize.width - 2 * margin;

    const addLine = (height: number = 10) => {
      yPos += height;
      if (yPos > pageHeight - 20) {
        doc.addPage();
        yPos = margin;
      }
    };

    // Header
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("klaUS-aicalc-roi — Análisis TCO", margin, yPos);
    addLine(15);

    // Fecha
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha: ${new Date().toLocaleDateString("es-ES")}`, margin, yPos);
    addLine(10);

    // Resumen ejecutivo
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("📋 RESUMEN EJECUTIVO", margin, yPos);
    addLine(8);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const summaryLines = doc.splitTextToSize(result.input_summary, contentWidth);
    doc.text(summaryLines, margin, yPos);
    yPos += summaryLines.length * 5;
    addLine(5);

    // Configuración
    doc.setFont("helvetica", "bold");
    doc.text("Configuración del análisis:", margin, yPos);
    addLine(6);

    doc.setFont("helvetica", "normal");
    const configLines = [
      `Caso de uso: ${useCase.name}`,
      `Modelos analizados: ${models.length}`,
      `Horizonte: ${horizonMonths} meses`,
      `Tokens entrada/mes: ${useCase.monthly_input_tokens.toLocaleString()}`,
      `Tokens salida/mes: ${useCase.monthly_output_tokens.toLocaleString()}`,
      `Usuarios concurrentes: ${useCase.concurrent_users}`,
      `Usuarios totales: ${useCase.total_users}`,
      `Precisión: ${useCase.precision}`,
      `Ventana de contexto: ${useCase.context_window_tokens.toLocaleString()} tokens`,
    ];

    configLines.forEach((line) => {
      doc.text(line, margin + 5, yPos);
      addLine(5);
    });

    addLine(5);

    // Recomendación
    if (result.recommendation) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("🎯 RECOMENDACIÓN ÓPTIMA", margin, yPos);
      addLine(8);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const rec = result.recommendation;
      const model = models.find((m) => m.id === rec.strategy.model_id);
      const recommendation_text = `
Modelo: ${rec.strategy.model_id}
Tipo: ${rec.strategy.deployment_type}
${rec.strategy.hardware_id ? `Hardware: ${rec.strategy.hardware_id}` : ""}
Coste total (${horizonMonths}m): $${rec.strategy.total_cost_usd.toLocaleString("en-US", { maximumFractionDigits: 2 })}
Coste mensual promedio: $${rec.strategy.monthly_cost_avg_usd.toLocaleString("en-US", { maximumFractionDigits: 2 })}
${rec.strategy.estimated_latency_ms ? `Latencia estimada: ${rec.strategy.estimated_latency_ms.toFixed(0)}ms` : ""}
${rec.strategy.capex_usd > 0 ? `CAPEX: $${rec.strategy.capex_usd.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : ""}
${rec.strategy.opex_total_usd > 0 ? `OPEX (${horizonMonths}m): $${rec.strategy.opex_total_usd.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : ""}
${rec.strategy.api_cost_total_usd > 0 ? `Coste API: $${rec.strategy.api_cost_total_usd.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : ""}
      `.trim();

      const recLines = doc.splitTextToSize(recommendation_text, contentWidth);
      doc.text(recLines, margin, yPos);
      yPos += recLines.length * 4;
      addLine(8);
    }

    // Estrategias
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`📊 TODAS LAS ESTRATEGIAS (${result.strategies.length})`, margin, yPos);
    addLine(8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    // Tabla
    const tableData = result.strategies.map((s) => [
      s.model_id,
      s.hardware_id || "—",
      s.deployment_type,
      `$${s.total_cost_usd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
      s.estimated_latency_ms ? `${s.estimated_latency_ms.toFixed(0)}ms` : "—",
      result.pareto_optimal_ids.includes(s.model_id + (s.hardware_id ? "/" + s.hardware_id : ""))
        ? "✓ Pareto"
        : "—",
    ]);

    doc.autoTable({
      head: [["Modelo", "Hardware", "Tipo", "Coste total", "Latencia", "Óptimo"]],
      body: tableData,
      startY: yPos,
      margin: margin,
      theme: "grid",
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [240, 240, 240],
      },
    });

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
      📄 Descargar análisis en PDF
    </button>
  );
}
