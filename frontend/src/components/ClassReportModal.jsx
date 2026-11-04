import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Printer, FileSpreadsheet, FileDown,
  Users, Award, BookOpen, Percent, Loader2, AlertCircle
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import API from '../api/axios';
import { useToast } from '../context/ToastContext';

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Client-side helper to format "Surname, First Name" if not already present on student object
const formatSurnameFirst = (student) => {
  if (student?.formattedName) return student.formattedName;
  const raw = String(student?.name || '').trim().replace(/\s+/g, ' ');
  if (!raw) return 'Unnamed Student';
  if (raw.includes(',')) return raw;
  const parts = raw.split(' ');
  if (parts.length === 1) return parts[0];
  const surname = parts.pop();
  return `${surname}, ${parts.join(' ')}`;
};

const ClassReportModal = ({ isOpen, onClose, classId }) => {
  const toast = useToast();
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState('surname'); // 'surname' | 'score'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' | 'desc'
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && classId) {
      loadReport();
    }
  }, [isOpen, classId, sortBy, sortOrder]);

  const loadReport = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await API.get(`/reports/class/${classId}?sortBy=${sortBy}&order=${sortOrder}`);
      setReportData(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load report data.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder(field === 'score' ? 'desc' : 'asc');
    }
  };

  const currentSortLabel =
    sortBy === 'score'
      ? `Sorted by Score (${sortOrder === 'desc' ? 'Highest to Lowest' : 'Lowest to Highest'})`
      : `Sorted by Surname (${sortOrder === 'asc' ? 'A to Z' : 'Z to A'})`;

  // 1. Export Formatted Excel Workbook (.xls)
  const handleExportExcel = () => {
    if (!reportData) return;
    const { summary, students, lessons } = reportData;
    const generatedDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const totalCols = Math.max(5, 5 + lessons.length);

    const topicHeadersHtml = lessons
      .map(
        (l) =>
          `<th style="background-color:#1e293b;color:#ffffff;font-weight:bold;padding:8px 10px;border:1px solid #334155;text-align:center;">Topic ${l.order}<br/><span style="font-size:9pt;font-weight:normal;color:#cbd5e1;">${escapeHtml(
            l.title
          )}</span></th>`
      )
      .join('');

    const studentRowsHtml = students
      .map((s, idx) => {
        const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        const lessonCells = s.lessons
          .map((l) => {
            if (!l.hasQuiz) {
              return `<td style="background-color:${rowBg};color:#94a3b8;padding:7px 10px;border:1px solid #cbd5e1;text-align:center;">N/A</td>`;
            }
            if (l.attempts === 0) {
              return `<td style="background-color:${rowBg};color:#94a3b8;padding:7px 10px;border:1px solid #cbd5e1;text-align:center;">—</td>`;
            }
            const passed = l.passed || l.highestScore >= 75;
            const cellBg = passed ? '#dcfce7' : '#fee2e2';
            const cellColor = passed ? '#166534' : '#991b1b';
            const val = l.scoreDisplay || (l.totalQuestions ? `${l.rawScore}/${l.totalQuestions}` : `${l.highestScore}%`);
            return `<td style="background-color:${cellBg};color:${cellColor};font-weight:bold;padding:7px 10px;border:1px solid #cbd5e1;text-align:center;">${val}</td>`;
          })
          .join('');

        const avgPassed = s.averageScore >= 75;
        const avgColor = avgPassed ? '#15803d' : s.totalRawScore > 0 ? '#b91c1c' : '#64748b';
        const totalDisplay = s.totalScoreDisplay || (s.totalPossibleScore > 0 ? `${s.totalRawScore}/${s.totalPossibleScore}` : `${s.totalRawScore}`);

        return `
          <tr>
            <td style="background-color:${rowBg};color:#475569;padding:7px 10px;border:1px solid #cbd5e1;text-align:center;font-weight:bold;">${
              idx + 1
            }</td>
            <td style="background-color:${rowBg};color:#0f172a;padding:7px 12px;border:1px solid #cbd5e1;font-weight:bold;">${escapeHtml(
              formatSurnameFirst(s)
            )}</td>
            <td style="background-color:${rowBg};color:#475569;padding:7px 12px;border:1px solid #cbd5e1;">${escapeHtml(
              s.email
            )}</td>
            ${lessonCells}
            <td style="background-color:${rowBg};color:#334155;padding:7px 10px;border:1px solid #cbd5e1;text-align:center;">${
              s.completedLessonsCount
            } / ${s.totalLessons}</td>
            <td style="background-color:${rowBg};color:${avgColor};padding:7px 10px;border:1px solid #cbd5e1;text-align:center;font-weight:bold;">${
              totalDisplay
            }</td>
          </tr>
        `;
      })
      .join('');

    const excelHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:x="urn:schemas-microsoft-com:office:excel"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>${escapeHtml(summary.subjectCode || 'Class Report')}</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
      </head>
      <body style="font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#0f172a;">
        <table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;">
          <!-- Title Banner -->
          <tr>
            <td colspan="${totalCols}" style="background-color:#1e3a8a;color:#ffffff;font-size:15pt;font-weight:bold;padding:14px 16px;text-align:left;">
              OFFICIAL CLASS PERFORMANCE &amp; GRADE REPORT
            </td>
          </tr>
          <tr>
            <td colspan="${totalCols}" style="background-color:#eff6ff;color:#1e40af;font-size:11pt;font-weight:bold;padding:8px 16px;border-bottom:2px solid #bfdbfe;">
              ${escapeHtml(summary.subjectCode)} — ${escapeHtml(summary.className)} (${escapeHtml(currentSortLabel)})
            </td>
          </tr>
          <tr><td colspan="${totalCols}" style="height:10px;"></td></tr>

          <!-- Course Metadata & Summary Metrics -->
          <tr>
            <td style="background-color:#f1f5f9;font-weight:bold;padding:6px 10px;border:1px solid #cbd5e1;">Subject Code</td>
            <td style="padding:6px 10px;border:1px solid #cbd5e1;font-weight:bold;">${escapeHtml(summary.subjectCode)}</td>
            <td style="background-color:#f1f5f9;font-weight:bold;padding:6px 10px;border:1px solid #cbd5e1;">Instructor</td>
            <td style="padding:6px 10px;border:1px solid #cbd5e1;">${escapeHtml(summary.instructor)}</td>
            <td style="background-color:#f1f5f9;font-weight:bold;padding:6px 10px;border:1px solid #cbd5e1;">Enrolled Students</td>
            <td style="padding:6px 10px;border:1px solid #cbd5e1;font-weight:bold;text-align:center;">${summary.totalStudents}</td>
          </tr>
          <tr>
            <td style="background-color:#f1f5f9;font-weight:bold;padding:6px 10px;border:1px solid #cbd5e1;">Course Title</td>
            <td style="padding:6px 10px;border:1px solid #cbd5e1;">${escapeHtml(summary.className)}</td>
            <td style="background-color:#f1f5f9;font-weight:bold;padding:6px 10px;border:1px solid #cbd5e1;">Semester / AY</td>
            <td style="padding:6px 10px;border:1px solid #cbd5e1;">${escapeHtml(summary.term)} • AY ${escapeHtml(summary.year)}</td>
            <td style="background-color:#f1f5f9;font-weight:bold;padding:6px 10px;border:1px solid #cbd5e1;">Class Average Score</td>
            <td style="padding:6px 10px;border:1px solid #cbd5e1;font-weight:bold;text-align:center;color:#15803d;">${summary.classAverageScore}%</td>
          </tr>
          <tr>
            <td style="background-color:#f1f5f9;font-weight:bold;padding:6px 10px;border:1px solid #cbd5e1;">Class Code</td>
            <td style="padding:6px 10px;border:1px solid #cbd5e1;font-family:Consolas,monospace;font-weight:bold;">${escapeHtml(summary.classCode)}</td>
            <td style="background-color:#f1f5f9;font-weight:bold;padding:6px 10px;border:1px solid #cbd5e1;">Date &amp; Sort Order</td>
            <td style="padding:6px 10px;border:1px solid #cbd5e1;">${escapeHtml(generatedDate)} • ${escapeHtml(currentSortLabel)}</td>
            <td style="background-color:#f1f5f9;font-weight:bold;padding:6px 10px;border:1px solid #cbd5e1;">Passing Rate (&ge;75%)</td>
            <td style="padding:6px 10px;border:1px solid #cbd5e1;font-weight:bold;text-align:center;color:#1d4ed8;">${summary.passingRate}%</td>
          </tr>
          <tr><td colspan="${totalCols}" style="height:14px;"></td></tr>

          <!-- Student Gradebook Table Header -->
          <tr>
            <th style="background-color:#1e293b;color:#ffffff;font-weight:bold;padding:8px 10px;border:1px solid #334155;text-align:center;width:45px;">#</th>
            <th style="background-color:#1e293b;color:#ffffff;font-weight:bold;padding:8px 12px;border:1px solid #334155;text-align:left;width:220px;">Student Name (Surname, First)</th>
            <th style="background-color:#1e293b;color:#ffffff;font-weight:bold;padding:8px 12px;border:1px solid #334155;text-align:left;width:230px;">Email Address</th>
            ${topicHeadersHtml}
            <th style="background-color:#1e293b;color:#ffffff;font-weight:bold;padding:8px 10px;border:1px solid #334155;text-align:center;width:110px;">Topics Passed</th>
            <th style="background-color:#1e293b;color:#ffffff;font-weight:bold;padding:8px 10px;border:1px solid #334155;text-align:center;width:110px;">Total Score</th>
          </tr>

          <!-- Student Rows -->
          ${studentRowsHtml}

          <!-- Summary Footer Row -->
          <tr>
            <td colspan="${3 + lessons.length + 1}" style="background-color:#f1f5f9;font-weight:bold;padding:8px 12px;border:1px solid #cbd5e1;text-align:right;">
              Overall Passing Rate (&ge;75%):
            </td>
            <td style="background-color:#e2e8f0;font-weight:bold;padding:8px 10px;border:1px solid #cbd5e1;text-align:center;color:#1e40af;">
              ${summary.passingRate}%
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', excelHtml], {
      type: 'application/vnd.ms-excel;charset=utf-8;',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const sortSuffix = sortBy === 'score' ? 'By_Score' : 'By_Surname';
    link.setAttribute('download', `${summary.subjectCode}_Class_Summary_${sortSuffix}_${summary.year}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    toast.success(
      `Exported ${summary.subjectCode}_Class_Summary_${sortSuffix}_${summary.year}.xls (${currentSortLabel})`,
      'Spreadsheet Downloaded'
    );
  };

  // 2. Direct Downloadable PDF File (.pdf)
  const handleDownloadPDF = () => {
    if (!reportData) return;
    const { summary, students, lessons } = reportData;
    const doc = new jsPDF({
      orientation: lessons.length > 5 ? 'landscape' : 'portrait',
      unit: 'pt',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 36;
    const generatedDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    // Top Header Banner
    doc.setFillColor(30, 58, 138); // #1e3a8a
    doc.rect(0, 0, pageWidth, 74, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`OFFICIAL ACADEMIC CLASS PERFORMANCE & GRADE REPORT • ${currentSortLabel.toUpperCase()}`, margin, 26);

    doc.setFontSize(16);
    doc.text(`${summary.subjectCode} — ${summary.className}`, margin, 48);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(
      `Instructor: ${summary.instructor}   |   Term: ${summary.term} (AY ${summary.year})   |   Class Code: ${summary.classCode}   |   Generated: ${generatedDate}`,
      margin,
      64
    );

    // Summary KPI Cards Row
    const cardTop = 90;
    const cardHeight = 48;
    const gap = 10;
    const cardWidth = (pageWidth - margin * 2 - gap * 3) / 4;

    const kpis = [
      { label: 'ENROLLED STUDENTS', value: String(summary.totalStudents) },
      { label: 'PUBLISHED TOPICS', value: String(summary.totalLessons) },
      { label: 'CLASS AVERAGE', value: `${summary.classAverageScore}%` },
      { label: 'PASSING RATE (>=75%)', value: `${summary.passingRate}%` },
    ];

    kpis.forEach((kpi, i) => {
      const x = margin + i * (cardWidth + gap);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(x, cardTop, cardWidth, cardHeight, 6, 6, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(kpi.label, x + 10, cardTop + 17);

      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text(kpi.value, x + 10, cardTop + 37);
    });

    // Student Gradebook Table
    const headRow = [
      '#',
      'Student Name (Surname, First)',
      'Email Address',
      ...lessons.map((l) => `T${l.order}`),
      'Passed',
      'Total Score',
    ];

    const bodyRows = students.map((s, idx) => [
      idx + 1,
      formatSurnameFirst(s),
      s.email,
      ...s.lessons.map((l) =>
        !l.hasQuiz
          ? 'N/A'
          : l.attempts > 0
            ? (l.scoreDisplay || (l.totalQuestions ? `${l.rawScore}/${l.totalQuestions}` : `${l.highestScore}%`))
            : '—'
      ),
      `${s.completedLessonsCount}/${s.totalLessons}`,
      s.totalScoreDisplay || (s.totalPossibleScore > 0 ? `${s.totalRawScore}/${s.totalPossibleScore}` : `${s.totalRawScore}`),
    ]);

    autoTable(doc, {
      startY: cardTop + cardHeight + 18,
      margin: { left: margin, right: margin },
      head: [headRow],
      body: bodyRows,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: 8.5,
        fontStyle: 'bold',
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [30, 41, 59],
        cellPadding: 5,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 24 },
        1: { halign: 'left', fontStyle: 'bold' },
        2: { halign: 'left' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index >= 3) {
          data.cell.styles.halign = 'center';
        }
      },
    });

    // Footer & Signature Line
    const finalY = (doc.lastAutoTable?.finalY || 260) + 36;
    const pageHeight = doc.internal.pageSize.getHeight();
    const sigY = finalY + 40 < pageHeight - 30 ? finalY : pageHeight - 50;

    doc.setDrawColor(148, 163, 184);
    doc.line(pageWidth - margin - 160, sigY, pageWidth - margin, sigY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Instructor Signature', pageWidth - margin - 80, sigY + 13, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated via EduLMS on ${generatedDate} (${currentSortLabel})`, margin, sigY + 13);

    const sortSuffix = sortBy === 'score' ? 'By_Score' : 'By_Surname';
    doc.save(`${summary.subjectCode}_Class_Summary_${sortSuffix}_${summary.year}.pdf`);
    toast.success(
      `Downloaded ${summary.subjectCode}_Class_Summary_${sortSuffix}_${summary.year}.pdf (${currentSortLabel})`,
      'PDF Report Downloaded'
    );
  };

  // 3. Dedicated Clean Print Option (prints only the official summary report)
  const handlePrintReport = () => {
    if (!reportData) return;
    const { summary, students, lessons } = reportData;
    const generatedDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const topicHeadersHtml = lessons
      .map(
        (l) =>
          `<th style="padding:8px 6px;border:1px solid #cbd5e1;text-align:center;background:#1e293b;color:#fff;font-size:10px;">T${l.order}</th>`
      )
      .join('');

    const studentRowsHtml =
      students.length === 0
        ? `<tr><td colspan="${5 + lessons.length}" style="padding:20px;text-align:center;color:#64748b;border:1px solid #cbd5e1;">No students enrolled in this class.</td></tr>`
        : students
            .map((s, idx) => {
              const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
              const topicCells = s.lessons
                .map((l) => {
                  const val = !l.hasQuiz
                    ? 'N/A'
                    : l.attempts > 0
                      ? (l.scoreDisplay || (l.totalQuestions ? `${l.rawScore}/${l.totalQuestions}` : `${l.highestScore}%`))
                      : '—';
                  const passed = l.passed || l.highestScore >= 75;
                  const color =
                    !l.hasQuiz || l.attempts === 0
                      ? '#94a3b8'
                      : passed
                        ? '#15803d'
                        : '#b91c1c';
                  return `<td style="padding:7px 6px;border:1px solid #cbd5e1;text-align:center;font-weight:600;color:${color};">${val}</td>`;
                })
                .join('');

              const scoreColor = s.averageScore >= 75 ? '#15803d' : s.totalRawScore > 0 ? '#b91c1c' : '#64748b';
              const totalDisplay = s.totalScoreDisplay || (s.totalPossibleScore > 0 ? `${s.totalRawScore}/${s.totalPossibleScore}` : `${s.totalRawScore}`);
              return `
                <tr style="background:${rowBg};">
                  <td style="padding:7px 8px;border:1px solid #cbd5e1;text-align:center;font-weight:600;color:#64748b;">${idx + 1}</td>
                  <td style="padding:7px 10px;border:1px solid #cbd5e1;font-weight:700;color:#0f172a;">${escapeHtml(formatSurnameFirst(s))}</td>
                  <td style="padding:7px 10px;border:1px solid #cbd5e1;color:#475569;">${escapeHtml(s.email)}</td>
                  ${topicCells}
                  <td style="padding:7px 8px;border:1px solid #cbd5e1;text-align:center;font-weight:600;">${s.completedLessonsCount}/${s.totalLessons}</td>
                  <td style="padding:7px 8px;border:1px solid #cbd5e1;text-align:center;font-weight:800;color:${scoreColor};">${totalDisplay}</td>
                </tr>
              `;
            })
            .join('');

    const printHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(summary.subjectCode)} — Class Summary Report</title>
          <style>
            @page { size: ${lessons.length > 5 ? 'landscape' : 'portrait'}; margin: 14mm; }
            body { font-family: Inter, Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; font-size: 11px; }
            .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; }
            .badge { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #1d4ed8; }
            .title { font-size: 20px; font-weight: 800; margin: 4px 0 2px; }
            .meta { text-align: right; font-size: 11px; color: #475569; line-height: 1.5; }
            .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
            .kpi { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; background: #f8fafc; }
            .kpi-label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #64748b; }
            .kpi-val { font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 3px; }
            .section-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
            .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #475569; }
            .sort-pill { font-size: 10px; font-weight: 700; color: #1e3a8a; background: #eff6ff; border: 1px solid #bfdbfe; padding: 3px 8px; border-radius: 6px; }
            table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
            .footer { margin-top: 36px; padding-top: 12px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; align-items: flex-end; font-size: 10px; color: #64748b; }
            .sig { border-top: 1px solid #475569; width: 180px; text-align: center; padding-top: 4px; font-weight: 700; color: #334155; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="badge">Official Academic Class Summary Record</div>
              <div class="title">${escapeHtml(summary.subjectCode)} — ${escapeHtml(summary.className)}</div>
              <div style="font-size:11px;color:#475569;">Instructor: <strong>${escapeHtml(summary.instructor)}</strong></div>
            </div>
            <div class="meta">
              <div>Semester: <strong>${escapeHtml(summary.term)} • AY ${escapeHtml(summary.year)}</strong></div>
              <div>Class Code: <strong>${escapeHtml(summary.classCode)}</strong></div>
              <div>Date Printed: <strong>${escapeHtml(generatedDate)}</strong></div>
            </div>
          </div>

          <div class="kpis">
            <div class="kpi">
              <div class="kpi-label">Enrolled Students</div>
              <div class="kpi-val">${summary.totalStudents}</div>
            </div>
            <div class="kpi">
              <div class="kpi-label">Published Topics</div>
              <div class="kpi-val">${summary.totalLessons}</div>
            </div>
            <div class="kpi">
              <div class="kpi-label">Class Average</div>
              <div class="kpi-val">${summary.classAverageScore}%</div>
            </div>
            <div class="kpi">
              <div class="kpi-label">Passing Rate (&ge;75%)</div>
              <div class="kpi-val">${summary.passingRate}%</div>
            </div>
          </div>

          <div class="section-bar">
            <div class="section-title">Student Grade Breakdown (${students.length} Students)</div>
            <div class="sort-pill">${escapeHtml(currentSortLabel)}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="padding:8px;border:1px solid #cbd5e1;background:#1e293b;color:#fff;width:28px;">#</th>
                <th style="padding:8px 10px;border:1px solid #cbd5e1;background:#1e293b;color:#fff;text-align:left;">Student Name (Surname, First Name)</th>
                <th style="padding:8px 10px;border:1px solid #cbd5e1;background:#1e293b;color:#fff;text-align:left;">Email Address</th>
                ${topicHeadersHtml}
                <th style="padding:8px;border:1px solid #cbd5e1;background:#1e293b;color:#fff;">Passed</th>
                <th style="padding:8px;border:1px solid #cbd5e1;background:#1e293b;color:#fff;">Total Score</th>
              </tr>
            </thead>
            <tbody>
              ${studentRowsHtml}
            </tbody>
          </table>

          <div class="footer">
            <div>Generated on ${escapeHtml(generatedDate)} via EduLMS • ${escapeHtml(currentSortLabel)}</div>
            <div class="sig">Instructor Signature</div>
          </div>
        </body>
      </html>
    `;

    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
    if (frameDoc) {
      frameDoc.open();
      frameDoc.write(printHtml);
      frameDoc.close();
      setTimeout(() => {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
        setTimeout(() => {
          if (document.body.contains(printFrame)) {
            document.body.removeChild(printFrame);
          }
        }, 2000);
      }, 250);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-6 bg-slate-900/60 backdrop-blur-xs print:p-0 print:bg-white print:static">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:w-full"
        >
          {/* Modal Toolbar (Hidden in Print) */}
          <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 print:hidden">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2.5 rounded-xl text-white">
                <Award size={19} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Class Performance &amp; Grade Report
                </h3>
                <p className="text-xs text-slate-500">
                  Download as formatted Excel or PDF, or print an official hard copy
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleExportExcel}
                disabled={!reportData || reportData.students?.length === 0}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                <FileSpreadsheet size={15} />
                <span>Download Excel (.xls)</span>
              </button>

              <button
                onClick={handleDownloadPDF}
                disabled={!reportData}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                <FileDown size={15} />
                <span>Download PDF (.pdf)</span>
              </button>

              <button
                onClick={handlePrintReport}
                disabled={!reportData}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <Printer size={15} />
                <span>Print</span>
              </button>

              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors ml-1"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Printable Report Content */}
          <div className="p-6 md:p-8 overflow-y-auto flex-1 space-y-6 print:p-0">
            {loading ? (
              <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-3">
                <Loader2 className="animate-spin text-blue-600" size={32} />
                <span className="text-xs font-semibold">Compiling class performance records...</span>
              </div>
            ) : error ? (
              <div className="p-4 bg-red-50 text-red-600 rounded-xl text-xs font-semibold flex items-center gap-2 border border-red-200">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            ) : reportData ? (
              <>
                {/* Official Report Header */}
                <div className="border-b-2 border-slate-900 pb-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-widest text-blue-700">
                        Official Academic Class Record
                      </span>
                      <h2 className="text-2xl font-extrabold text-slate-900 mt-0.5">
                        {reportData.summary.subjectCode} — {reportData.summary.className}
                      </h2>
                    </div>
                    <div className="text-left md:text-right text-xs text-slate-600 space-y-0.5">
                      <div>Semester: <strong>{reportData.summary.term} • AY {reportData.summary.year}</strong></div>
                      <div>Enrollment Code: <strong className="font-mono text-slate-900">{reportData.summary.classCode}</strong></div>
                      <div>Instructor: <strong>{reportData.summary.instructor}</strong></div>
                    </div>
                  </div>
                </div>

                {/* 1. Summary Metrics */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Performance Overview
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="flex items-center gap-2 text-blue-600 mb-1">
                        <Users size={15} />
                        <span className="text-xs font-semibold text-slate-500">Enrolled Students</span>
                      </div>
                      <p className="text-2xl font-extrabold text-slate-900">{reportData.summary.totalStudents}</p>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="flex items-center gap-2 text-indigo-600 mb-1">
                        <BookOpen size={15} />
                        <span className="text-xs font-semibold text-slate-500">Published Topics</span>
                      </div>
                      <p className="text-2xl font-extrabold text-slate-900">{reportData.summary.totalLessons}</p>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="flex items-center gap-2 text-emerald-600 mb-1">
                        <Percent size={15} />
                        <span className="text-xs font-semibold text-slate-500">Class Average</span>
                      </div>
                      <p className="text-2xl font-extrabold text-slate-900">{reportData.summary.classAverageScore}%</p>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="flex items-center gap-2 text-purple-600 mb-1">
                        <Award size={15} />
                        <span className="text-xs font-semibold text-slate-500">Passing Rate (&ge;75%)</span>
                      </div>
                      <p className="text-2xl font-extrabold text-slate-900">{reportData.summary.passingRate}%</p>
                    </div>
                  </div>
                </div>

                {/* 2. Student Gradebook Table */}
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Student Grade Breakdown ({reportData.students.length} Students)
                      </h4>
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                        {currentSortLabel}
                      </span>
                    </div>

                    {/* Sorting Controls (Hidden in Print) */}
                    <div className="flex items-center gap-2 print:hidden">
                      <span className="text-xs text-slate-400 font-medium">Sort by:</span>
                      <button
                        onClick={() => toggleSort('surname')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                          sortBy === 'surname'
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        By Surname {sortBy === 'surname' && (sortOrder === 'asc' ? '(A–Z) ↑' : '(Z–A) ↓')}
                      </button>
                      <button
                        onClick={() => toggleSort('score')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                          sortBy === 'score'
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        By Score {sortBy === 'score' && (sortOrder === 'desc' ? '(High–Low) ↓' : '(Low–High) ↑')}
                      </button>
                    </div>
                  </div>

                  {reportData.students.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs">
                      No students are currently enrolled in this class. Share Class Code{' '}
                      <strong>{reportData.summary.classCode}</strong> with your students to begin tracking grades.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-800 text-white font-bold">
                              <th className="py-3 px-3 text-center w-10">#</th>
                              <th className="py-3 px-4">Student Name (Surname, First Name)</th>
                              <th className="py-3 px-4">Email Address</th>
                              {reportData.lessons.map((lesson) => (
                                <th
                                  key={lesson._id}
                                  className="py-3 px-3 text-center"
                                  title={`Topic ${lesson.order}: ${lesson.title}`}
                                >
                                  T{lesson.order}
                                </th>
                              ))}
                              <th className="py-3 px-3 text-center">Passed</th>
                              <th className="py-3 px-4 text-center">Total Score</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {reportData.students.map((student, idx) => (
                              <tr key={student.studentId} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                                <td className="py-3 px-3 text-center font-semibold text-slate-400">
                                  {idx + 1}
                                </td>
                                <td className="py-3 px-4 font-bold text-slate-900">
                                  {formatSurnameFirst(student)}
                                </td>
                                <td className="py-3 px-4 text-slate-500">
                                  {student.email}
                                </td>
                                {student.lessons.map((l, lIdx) => (
                                  <td key={lIdx} className="py-3 px-3 text-center">
                                    {l.hasQuiz ? (
                                      <span
                                        className={`inline-block px-2 py-0.5 rounded-md font-bold text-[11px] ${
                                          (l.passed || l.highestScore >= 75)
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                            : l.attempts > 0
                                              ? 'bg-red-50 text-red-700 border border-red-200'
                                              : 'bg-slate-100 text-slate-400'
                                        }`}
                                      >
                                        {l.attempts > 0 ? (l.scoreDisplay || (l.totalQuestions ? `${l.rawScore}/${l.totalQuestions}` : `${l.highestScore}%`)) : '—'}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300">N/A</span>
                                    )}
                                  </td>
                                ))}
                                <td className="py-3 px-3 text-center font-semibold text-slate-600">
                                  {student.completedLessonsCount}/{student.totalLessons}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span
                                    className={`font-extrabold text-xs ${
                                      student.averageScore >= 75
                                        ? 'text-emerald-700'
                                        : student.totalRawScore > 0
                                          ? 'text-red-600'
                                          : 'text-slate-400'
                                    }`}
                                  >
                                    {student.totalScoreDisplay || (student.totalPossibleScore > 0 ? `${student.totalRawScore}/${student.totalPossibleScore}` : `${student.totalRawScore}`)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* Signoff Footer */}
                <div className="pt-8 mt-8 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
                  <span>Generated on {new Date().toLocaleDateString()} via EduLMS</span>
                  <div className="border-t border-slate-400 pt-1 w-48 text-center text-slate-700 font-semibold">
                    Instructor Signature
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ClassReportModal;
