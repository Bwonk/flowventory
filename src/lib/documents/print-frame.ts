/**
 * Hazır bir HTML belgesini gizli iframe'de yazdırır (tarayıcının "PDF olarak
 * kaydet"i). Sayfanın kendi print CSS'ine dokunmaz. Fontlar yüklenmeden
 * yazdırmaz — yoksa ilk çıktı sistem fontuyla gelir.
 */
export function printHtml(html: string): void {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  const win = frame.contentWindow;
  if (!win) {
    frame.remove();
    return;
  }
  const remove = () => setTimeout(() => frame.isConnected && frame.remove(), 1000);
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.addEventListener('afterprint', remove, { once: true });
  // fonts.ready, yerleşim başlamadan çağrılınca hemen çözülür; aileleri açıkça yükle.
  const fonts = win.document.fonts;
  const fontsReady = fonts
    ? Promise.all([fonts.load('400 10px "Geist"'), fonts.load('600 10px "Geist"'), fonts.load('500 10px "Geist Mono"')]).catch(() => undefined)
    : Promise.resolve();
  // Font dosyası gelmezse de en geç 1,5 sn'de yazdır.
  void Promise.race([fontsReady, new Promise(resolve => setTimeout(resolve, 1500))]).then(() => {
    win.focus();
    win.print();
    // Bazı tarayıcılar afterprint'i iframe'de tetiklemez.
    setTimeout(() => frame.isConnected && frame.remove(), 60_000);
  });
}
