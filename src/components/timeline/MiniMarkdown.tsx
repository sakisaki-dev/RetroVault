import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Tiny, safe markdown renderer for editorial copy (no HTML injection).
 * Supports: paragraphs (single newlines kept as line breaks), "- " / "* " bullets,
 * "1. " numbered lists, "#"–"####" headings, pipe tables, **bold**, *italic*.
 */

const renderInline = (text: string, keyPrefix = ''): ReactNode[] => {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) {
      out.push(<strong key={`${keyPrefix}b${i++}`} className="font-semibold text-foreground">{tok.slice(2, -2)}</strong>);
    } else {
      out.push(<em key={`${keyPrefix}i${i++}`}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
};

const splitRow = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

interface MiniMarkdownProps {
  source: string;
  className?: string;
}

const MiniMarkdown = ({ source, className }: MiniMarkdownProps) => {
  const blocks = source
    .replace(/\r\n/g, '\n')
    .replace(/^(#{1,4}\s.*)$/gm, '\n$1\n') // headings always stand alone
    .split(/\n{2,}/);

  return (
    <div className={cn('space-y-3 text-sm leading-relaxed text-muted-foreground', className)}>
      {blocks.map((block, bi) => {
        const lines = block.split('\n').filter((l) => l.trim() !== '');
        if (!lines.length) return null;

        // Table
        if (lines.length >= 2 && lines.every((l) => l.trim().startsWith('|'))) {
          const header = splitRow(lines[0]);
          const body = lines.slice(1).filter((l) => !/^\s*\|?\s*:?-{2,}/.test(l)).map(splitRow);
          return (
            <div key={bi} className="overflow-x-auto rounded-lg border border-border/40">
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-secondary/40">
                  <tr>
                    {header.map((h, i) => (
                      <th key={i} scope="col" className="px-3 py-2 text-left font-semibold text-foreground whitespace-nowrap">
                        {renderInline(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {body.map((row, ri) => (
                    <tr key={ri} className="border-t border-border/30">
                      {row.map((c, ci) => (
                        <td key={ci} className={cn('px-3 py-2 align-top', ci === 0 && 'font-medium text-foreground whitespace-nowrap')}>
                          {renderInline(c)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        // Heading
        const h = lines[0].match(/^(#{1,4})\s+(.*)$/);
        if (h && lines.length === 1) {
          return (
            <h4 key={bi} className="font-display text-base font-bold uppercase tracking-wide text-foreground pt-1">
              {renderInline(h[2])}
            </h4>
          );
        }

        // Lists
        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
          return (
            <ul key={bi} className="space-y-1.5 pl-1">
              {lines.map((l, li) => (
                <li key={li} className="flex gap-2">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/70" />
                  <span>{renderInline(l.replace(/^\s*[-*]\s+/, ''), `${bi}-${li}`)}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (lines.every((l) => /^\s*\d+\.\s+/.test(l))) {
          return (
            <ol key={bi} className="list-decimal space-y-1 pl-5 marker:text-muted-foreground/70">
              {lines.map((l, li) => (
                <li key={li}>{renderInline(l.replace(/^\s*\d+\.\s+/, ''), `${bi}-${li}`)}</li>
              ))}
            </ol>
          );
        }

        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {renderInline(l, `${bi}-${li}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
};

export default MiniMarkdown;
