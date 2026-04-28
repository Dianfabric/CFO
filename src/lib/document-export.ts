'use client'

// html2canvas, jspdf는 브라우저 전용 → SSR 충돌 방지를 위해 함수 내부에서 동적 import

async function loadHtml2canvas() {
  const mod = await import('html2canvas')
  return mod.default as typeof import('html2canvas').default
}

async function loadJsPDF() {
  const mod = await import('jspdf')
  // jspdf ESM export 호환
  return (mod.jsPDF ?? mod.default) as typeof import('jspdf').jsPDF
}

/**
 * #document-print-area 를 캔버스로 렌더
 *
 * Tailwind v4 는 oklch() 색상 함수를 사용하는데 html2canvas v1.4 가 이를
 * 파싱하지 못해 에러가 발생한다. <style>/<link> 패치는 Next.js 환경에서
 * 신뢰할 수 없으므로, Tailwind CSS 가 전혀 없는 순수 iframe 에 문서 HTML
 * 만 넣고 캡처하는 방식을 사용한다.
 * (DocumentLayout / 표 컴포넌트는 100 % 인라인 스타일이라 외부 CSS 없어도 동일하게 렌더링됨)
 */
export async function renderCanvas(elementId = 'document-print-area'): Promise<HTMLCanvasElement> {
  const html2canvas = await loadHtml2canvas()
  const el = document.getElementById(elementId)
  if (!el) throw new Error('요소를 찾을 수 없습니다: ' + elementId)

  const elWidth  = el.offsetWidth
  const elHeight = Math.max(el.scrollHeight + 60, 1200)

  /* ── Tailwind CSS 없는 순수 iframe 생성 ── */
  const iframe = document.createElement('iframe')
  Object.assign(iframe.style, {
    position:   'fixed',
    top:        '0px',
    left:       `-${elWidth + 200}px`,   // 화면 밖
    width:      `${elWidth}px`,
    height:     `${elHeight}px`,
    border:     'none',
    visibility: 'hidden',
  })
  document.body.appendChild(iframe)

  try {
    const idoc = iframe.contentDocument!
    idoc.open()
    idoc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <base href="${location.origin}">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; background: #fff; }
    img  { max-width: none !important; }
    table { border-collapse: collapse; }
  </style>
</head>
<body>${el.outerHTML}</body>
</html>`)
    idoc.close()

    /* ── 이미지 로드 완료 대기 ── */
    await Promise.all(
      Array.from(idoc.querySelectorAll<HTMLImageElement>('img')).map(img =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>(r => { img.onload = () => r(); img.onerror = () => r() })
      )
    )
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))

    const target =
      idoc.getElementById(elementId) ??
      (idoc.body.firstElementChild as HTMLElement)

    return await html2canvas(target, {
      scale:           2,
      useCORS:         true,
      allowTaint:      true,
      backgroundColor: '#ffffff',
      logging:         false,
      imageTimeout:    15000,
    })
  } finally {
    document.body.removeChild(iframe)
  }
}

export async function downloadPDF(filename: string, elementId = 'document-print-area') {
  const JsPDF = await loadJsPDF()
  const canvas = await renderCanvas(elementId)
  const img = canvas.toDataURL('image/jpeg', 0.98)
  const pdf = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const imgW = pageW
  const imgH = (canvas.height * imgW) / canvas.width

  if (imgH <= pageH) {
    pdf.addImage(img, 'JPEG', 0, 0, imgW, imgH)
  } else {
    let position = 0
    let heightLeft = imgH
    pdf.addImage(img, 'JPEG', 0, position, imgW, imgH)
    heightLeft -= pageH
    while (heightLeft > 0) {
      position = heightLeft - imgH
      pdf.addPage()
      pdf.addImage(img, 'JPEG', 0, position, imgW, imgH)
      heightLeft -= pageH
    }
  }
  pdf.save(`${filename}.pdf`)
}

export async function downloadJPG(filename: string, elementId = 'document-print-area') {
  const canvas = await renderCanvas(elementId)
  const url = canvas.toDataURL('image/jpeg', 0.95)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.jpg`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

export async function getCanvasBlob(
  elementId = 'document-print-area',
  mime = 'image/jpeg',
  quality = 0.95,
): Promise<Blob> {
  const canvas = await renderCanvas(elementId)
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), mime, quality)
  })
}

/** PDF를 Blob으로 반환 (다운로드 없이 Drive 업로드 등에 사용) */
export async function getPDFBlob(elementId = 'document-print-area'): Promise<Blob> {
  const JsPDF = await loadJsPDF()
  const canvas = await renderCanvas(elementId)
  const img = canvas.toDataURL('image/jpeg', 0.98)
  const pdf = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const imgW = pageW
  const imgH = (canvas.height * imgW) / canvas.width

  if (imgH <= pageH) {
    pdf.addImage(img, 'JPEG', 0, 0, imgW, imgH)
  } else {
    let position = 0
    let heightLeft = imgH
    pdf.addImage(img, 'JPEG', 0, position, imgW, imgH)
    heightLeft -= pageH
    while (heightLeft > 0) {
      position = heightLeft - imgH
      pdf.addPage()
      pdf.addImage(img, 'JPEG', 0, position, imgW, imgH)
      heightLeft -= pageH
    }
  }
  // jsPDF output('blob') returns Blob
  return pdf.output('blob') as unknown as Blob
}
