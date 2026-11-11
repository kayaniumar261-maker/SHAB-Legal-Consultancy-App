export type SalesPdfMonth = { month: string; amounts: number[]; transactions: {
  date: string; reference: string; type: string; eligible: number | null; commission: number; advance: number; status: string;
}[] };
type SalesPdfReport = { from: string; to: string; generated: string; months: SalesPdfMonth[] };

export function downloadSalesPdf(report: SalesPdfReport, filename: string) {
  const pages: Uint8Array[] = [];
  const canvas = document.createElement('canvas');
  canvas.width = 1240; canvas.height = 1754;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('PDF rendering is unavailable.');
  const c = ctx;
  const navy = '#17384b', gold = '#af8544', border = '#d6dfe5';
  const number = new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const labels = ['Opening payable', 'Excess brought forward', 'Base salary', 'Commission earned',
    'Advances received', 'Commission already paid', 'Closing payable', 'Excess carried forward'];
  let y = 0;
  const box = (x: number, top: number, width: number, height: number, fill: string) => {
    c.fillStyle = fill; c.fillRect(x, top, width, height);
    c.strokeStyle = border; c.lineWidth = 1; c.strokeRect(x, top, width, height);
  };
  const text = (value: string, x: number, top: number, size = 21, color = navy, bold = false, right = false) => {
    c.font = (bold ? 'bold ' : '') + size + 'px Arial'; c.fillStyle = color; c.textAlign = right ? 'right' : 'left';
    c.fillText(value, x, top); c.textAlign = 'left';
  };
  const wrap = (value: string, width: number, size = 20) => {
    c.font = size + 'px Arial';
    const lines: string[] = []; let current = '';
    for (const char of value) {
      if (c.measureText(current + char).width > width) { lines.push(current); current = ''; }
      current += char;
    }
    lines.push(current); return lines;
  };
  const monthName = (m: string) => new Intl.DateTimeFormat('en-GB', {month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(m + '-01T00:00:00Z'));
  const begin = () => {
    c.fillStyle = '#fff'; c.fillRect(0, 0, 1240, 1754);
    c.fillStyle = navy; c.fillRect(0, 0, 1240, 155);
    c.fillStyle = gold; c.fillRect(60, 155, 1120, 5);
    text('SALES & COMMISSION', 60, 65, 32, '#fff', true);
    text('Umar Kayani | Private statement', 60, 111, 23, '#e0e8ed');
    text('ALL AMOUNTS IN AED', 1180, 111, 18, '#e0e8ed', false, true);
    box(60, 184, 1120, 62, '#f2f5f7');
    text(monthName(report.from) + '  to  ' + monthName(report.to), 80, 224, 22, navy, true);
    text('Generated ' + report.generated, 1160, 224, 19, navy, false, true);
    y = 280;
  };
  const finish = () => {
    c.strokeStyle = border; c.beginPath(); c.moveTo(60, 1675); c.lineTo(1180, 1675); c.stroke();
    text('CONFIDENTIAL | Personal salary and commission ledger', 60, 1712, 17, '#64748b');
    text('Page ' + (pages.length + 1), 1180, 1712, 18, '#64748b', false, true);
    const encoded = atob(canvas.toDataURL('image/jpeg', .96).split(',')[1]);
    pages.push(Uint8Array.from(encoded, ch => ch.charCodeAt(0)));
  };
  const columns = [60, 195, 485, 645, 815, 985, 1180];
  const tableHead = () => {
    box(60, y, 1120, 46, navy);
    ['Date', 'Reference / activity', 'Eligible', 'Commission', 'Advance', 'Status'].forEach((label, i) =>
      text(label, columns[i] + 12, y + 30, 18, '#fff', true));
    y += 46;
  };
  begin();
  report.months.forEach((month, index) => {
    if (index > 0) { finish(); begin(); }
    text(monthName(month.month).toUpperCase(), 60, y + 30, 27, navy, true); y += 55;
    const cards = [['GROSS EARNINGS', month.amounts[2] + month.amounts[3]], ['ADVANCES RECEIVED', month.amounts[4]], ['CLOSING PAYABLE', month.amounts[6]]] as const;
    cards.forEach(([label, amount], i) => {
      box(60 + i * 380, y, 360, 105, i === 2 ? '#edf5f0' : '#f2f5f7');
      text(label, 80 + i * 380, y + 32, 17, '#526575', true);
      text(number.format(amount), 80 + i * 380, y + 77, 30, navy, true);
    });
    y += 130;
    text('MONTH-END RECONCILIATION', 60, y + 22, 19, navy, true); y += 40;
    labels.forEach((label, i) => {
      box(60, y, 1120, 37, i >= 6 ? '#edf5f0' : i % 2 ? '#f5f7f9' : '#fff');
      text(label, 78, y + 26, 19, navy, i >= 6);
      text(number.format(month.amounts[i]), 1160, y + 26, 20, navy, i >= 6, true); y += 37;
    });
    y += 35; text('DATED TRANSACTION DETAIL', 60, y + 22, 19, navy, true); y += 40; tableHead();
    const entries = [...month.transactions].sort((a, b) => a.date.localeCompare(b.date));
    if (!entries.length) { box(60, y, 1120, 55, '#f5f7f9'); text('No transactions recorded.', 78, y + 34, 20); y += 55; }
    entries.forEach((row, rowIndex) => {
      const reference = wrap(row.reference, 262);
      const typeLines = wrap(row.type, 262, 17);
      const height = Math.max(68, 20 + reference.length * 25 + typeLines.length * 22);
      if (y + height > 1615) {
        finish(); begin();
        text(monthName(month.month) + ' | Transactions continued', 60, y + 24, 24, navy, true);
        y += 45; tableHead();
      }
      box(60, y, 1120, height, rowIndex % 2 ? '#f5f7f9' : '#fff');
      for (const x of columns.slice(1, -1)) { c.strokeStyle = border; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + height); c.stroke(); }
      text(row.date, 72, y + 30, 18);
      reference.forEach((line, i) => text(line, 207, y + 27 + i * 25, 20));
      typeLines.forEach((line, i) => text(line, 207, y + 27 + reference.length * 25 + i * 22, 17, '#64748b'));
      text(row.eligible === null ? '-' : number.format(row.eligible), 630, y + 30, 18, navy, false, true);
      text(row.commission ? number.format(row.commission) : '-', 800, y + 30, 18, navy, false, true);
      text(row.advance ? number.format(row.advance) : '-', 970, y + 30, 18, navy, false, true);
      text(row.status, 997, y + 30, 18, row.status === 'Unpaid' ? '#8a520b' : '#246047');
      y += height;
    });
    if (y + 65 < 1630) { y += 25; text('Closing payable and excess deductions carry into the next month separately.', 60, y + 20, 18, '#64748b'); }
  });
  finish();
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let position = 0;
  const offsets: number[] = [0];
  const append = (value: string | Uint8Array) => { const bytes = typeof value === 'string' ? encoder.encode(value) : value; chunks.push(bytes); position += bytes.length; };
  const object = (id: number, body: string) => { offsets[id] = position; append(id + ' 0 obj\n' + body + '\nendobj\n'); };
  append('%PDF-1.4\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, '<< /Type /Pages /Count ' + pages.length + ' /Kids [' + pages.map((_, i) => (3 + i * 3) + ' 0 R').join(' ') + '] >>');
  pages.forEach((bytes, i) => {
    const id = 3 + i * 3;
    object(id, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Img ' + (id + 1) + ' 0 R >> >> /Contents ' + (id + 2) + ' 0 R >>');
    offsets[id + 1] = position;
    append((id + 1) + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width 1240 /Height 1754 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + bytes.length + ' >>\nstream\n');
    append(bytes); append('\nendstream\nendobj\n');
    const content = 'q 595.28 0 0 841.89 0 0 cm /Img Do Q';
    object(id + 2, '<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream');
  });
  const xref = position;
  append('xref\n0 ' + offsets.length + '\n0000000000 65535 f \n');
  for (const offset of offsets.slice(1)) append(String(offset).padStart(10, '0') + ' 00000 n \n');
  append('trailer\n<< /Size ' + offsets.length + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF');
  const bytes = new Uint8Array(position); let cursor = 0;
  for (const chunk of chunks) { bytes.set(chunk, cursor); cursor += chunk.length; }
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
