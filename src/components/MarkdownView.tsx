/**
 * src/components/MarkdownView.tsx — rendered markdown (or raw source).
 * Resolves relative images and .md links against the open document's folder.
 */
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'
import { rawUrl } from '../../shared/api'
import { dirName, joinPath } from '../lib/paths'
import type { Selection } from '../lib/ui'

export interface MarkdownViewProps {
  content: string
  raw: boolean
  /** Watched-file selection, needed to resolve relative assets/links; null for dropped files. */
  selection: Selection | null
  onNavigate: (root: string, path: string) => void
}

export function MarkdownView({ content, raw, selection, onNavigate }: MarkdownViewProps) {
  const resolveAsset = (src: string | undefined): string => {
    if (!src) return ''
    if (/^(https?:|data:|blob:|\/)/.test(src)) return src
    if (selection?.kind === 'ws') {
      return rawUrl(selection.root, joinPath(dirName(selection.path), src))
    }
    return src
  }

  const components: Components = {
    img: ({ src, alt }) => (
      <img
        src={resolveAsset(typeof src === 'string' ? src : undefined)}
        alt={alt ?? ''}
        loading="lazy"
        className="max-w-full rounded-lg border"
      />
    ),
    a: ({ href, children }) => {
      const isMdLink =
        href && !/^(https?:|mailto:|#)/.test(href) && /\.(md|markdown)(#.*)?$/i.test(href)
      if (isMdLink && selection?.kind === 'ws') {
        const target = joinPath(dirName(selection.path), href.split('#')[0])
        const sel = selection
        return (
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              onNavigate(sel.root, target)
            }}
          >
            {children}
          </a>
        )
      }
      return (
        <a href={href} target="_blank" rel="noreferrer">
          {children}
        </a>
      )
    },
    table: ({ children }) => (
      <div className="overflow-x-auto">
        <table>{children}</table>
      </div>
    ),
  }

  if (raw) {
    return (
      <pre className="whitespace-pre-wrap break-words p-8 font-mono text-sm leading-relaxed">
        {content}
      </pre>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <article className="prose prose-neutral max-w-none dark:prose-invert prose-pre:rounded-lg prose-pre:bg-[#0d1117]">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={components}>
          {content}
        </ReactMarkdown>
      </article>
    </div>
  )
}
