import { useMemo, useRef, useState, useCallback } from 'react';
import type { Message } from '../types';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useT } from '../i18n';
import styles from './ExportButton.module.css';

interface Props {
  messages: Message[];
}

/**
 * 导出 PDF 按钮 —— 把当前会话里所有 AI 回答（含查到的论文重点段落与
 * 「## 参考文献」表）渲染成一篇隐藏的 A4 文档，用 html2pdf.js
 * （html2canvas + jsPDF）直接下载为 .pdf，无需后端参与。
 *
 * 为什么用 html2pdf 而不是 window.print()：print() 只能唤起系统打印
 * 对话框让用户再手动「另存为 PDF」；html2pdf 点一下就落盘，交互更直接。
 * 中文渲染走 canvas 光栅化，天然支持，不用往 PDF 里嵌字体。
 */
export default function ExportButton({ messages }: Props) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const docRef = useRef<HTMLDivElement>(null);

  /** 所有非空 AI 回答 = 检索到的论文重点段落（含参考文献表） */
  const passages = useMemo(
    () => messages.filter(m => m.role === 'assistant' && m.content.trim().length > 0),
    [messages]
  );

  const handleExport = useCallback(async () => {
    if (busy || passages.length === 0) return;
    const el = docRef.current;
    if (!el) return;

    setBusy(true);
    try {
      // 动态 import：html2pdf 只在真正点击导出时才进网络/内存
      const html2pdf = (await import('html2pdf.js')).default;
      const date = new Date();
      const stamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      await html2pdf()
        .set({
          margin: [12, 12, 14, 12],
          filename: `论文重点段落_${stamp}.pdf`,
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] },
        } as any)
        .from(el)
        .save();
    } catch (e) {
      console.error('[export-pdf] failed:', e);
      alert(t('export.failed'));
    } finally {
      setBusy(false);
    }
  }, [busy, passages.length, t]);

  const disabled = passages.length === 0 || busy;

  return (
    <>
      <button
        className={styles.btn}
        onClick={handleExport}
        disabled={disabled}
        title={passages.length === 0 ? t('export.empty') : t('export.hint')}
        aria-label={t('export.hint')}
      >
        <svg viewBox="0 0 24 24" fill="none" width="13" height="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3v12" />
          <polyline points="7 10 12 15 17 10" />
          <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
        <span className={styles.label}>{busy ? t('export.busy') : t('export.pdf')}</span>
      </button>

      {/* 离屏渲染的导出文档：始终挂载（有内容时），html2canvas 直接对它截图 */}
      {passages.length > 0 && (
        <div className={styles.hiddenStage} aria-hidden="true">
          <div ref={docRef} className={styles.doc}>
            <header className={styles.docHeader}>
              <h1 className={styles.docTitle}>论文调研 · 重点段落汇总</h1>
              <p className={styles.docMeta}>
                导出时间：{new Date().toLocaleString('zh-CN')} · 共 {passages.length} 条回答
              </p>
            </header>
            {passages.map((m, i) => (
              <section key={m.id} className={styles.section}>
                <p className={styles.sectionNo}>回答 {i + 1} / {passages.length}</p>
                <Markdown remarkPlugins={[remarkGfm]}>{m.content}</Markdown>
              </section>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
