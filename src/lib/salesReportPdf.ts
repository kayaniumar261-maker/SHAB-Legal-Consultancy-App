// Render Unicode text with browser fonts and package A4 pages in a downloadable PDF.
export function downloadSalesPdf(title: string, lines: string[], filename: string) {
  const pages: Uint8Array[] = [];
  const canvas = document.createElement('canvas');
  canvas.width = 1240; canvas.height = 1754;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('PDF rendering is unavailable.');
  let y = 0;
  const begin = () => {
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#18384c'; ctx.font = 'bold 30px Arial';
    ctx.fillText(title, 72, 80);
    ctx.font = '20px Arial'; ctx.fillStyle = '#334155';
    ctx.fillText('Umar Kayani · Private sales and commission · AED', 72, 118);
    y = 170;
  };
  const finish = () => {
    ctx.font = '18px Arial'; ctx.fillText('Private report · Page ' + (pages.length + 1), 72, 1698);
    const encoded = atob(canvas.toDataURL('image/jpeg', .95).split(',')[1]);
    pages.push(Uint8Array.from(encoded, c => c.charCodeAt(0)));
  };
  begin();
  for (const line of lines) {
    const wrapped: string[] = [];
    let current = '';
    for (const char of line) {
      if (ctx.measureText(current + char).width > 1090) { wrapped.push(current); current = ''; }
      current += char;
    }
    wrapped.push(current);
    for (const part of wrapped) {
      if (y > 1630) { finish(); begin(); }
      ctx.font = '22px Arial'; ctx.fillStyle = '#172b3a';
      ctx.fillText(part, 72, y); y += 32;
    }
  }
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
