/**
 * src/components/TopBar.tsx — main-pane header: file identity + actions.
 * Dumb component: props in, events out.
 */
import {
  Copy,
  ExternalLink,
  Eye,
  FileCode,
  FileText,
  FolderKanban,
  Gavel,
  Goal,
  Inbox,
  KanbanSquare,
  Lightbulb,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Rocket,
  ScrollText,
  Star,
  Sun,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { View } from '../lib/ui'
import { RECORD_VIEWS } from '../lib/ui'

/** Nav metadata for the eight read-only record-store views. */
const RECORD_NAV: Record<(typeof RECORD_VIEWS)[number], { label: string; icon: LucideIcon; store: string }> = {
  decisions: { label: 'Decisions', icon: Gavel, store: 'decisions.jsonl' },
  requests: { label: 'Requests', icon: Inbox, store: 'requests.jsonl' },
  missions: { label: 'Missions', icon: Rocket, store: 'missions.jsonl' },
  board: { label: 'Tasks', icon: KanbanSquare, store: 'tasks.jsonl' },
  'captains-log': { label: 'Log', icon: ScrollText, store: 'captains-log.jsonl' },
  learnings: { label: 'Learnings', icon: Lightbulb, store: 'learnings.jsonl' },
  okrs: { label: 'OKRs', icon: Goal, store: 'okrs.jsonl' },
  projects: { label: 'Projects', icon: FolderKanban, store: 'projects.jsonl' },
}

export interface TopBarProps {
  title: string
  subtitle: string
  /** A real (watched) file is open — enables file actions. */
  isFile: boolean
  view: View
  onViewChange: (view: View) => void
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  raw: boolean
  onToggleRaw: () => void
  refreshing: boolean
  onRefresh: () => void
  dark: boolean
  onToggleDark: () => void
  isFavorite: boolean
  onToggleFavorite: () => void
  onReveal: () => void
  onCopyPath: () => void
}

export function TopBar(p: TopBarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-1 border-b px-3">
      <Button variant="ghost" size="icon" title={p.sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'} onClick={p.onToggleSidebar}>
        {p.sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </Button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{p.title}</div>
        {p.subtitle && <div className="truncate text-xs text-muted-foreground">{p.subtitle}</div>}
      </div>
      <nav className="flex min-w-0 max-w-[54%] items-center gap-0.5 overflow-x-auto rounded-md border p-0.5">
        <Button
          variant={p.view === 'docs' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 shrink-0 gap-1 px-2"
          onClick={() => p.onViewChange('docs')}
        >
          <FileText className="h-3.5 w-3.5" />
          Docs
        </Button>
        <span className="mx-0.5 h-4 w-px shrink-0 bg-border" aria-hidden />
        {RECORD_VIEWS.map((v) => {
          const nav = RECORD_NAV[v]
          const Icon = nav.icon
          return (
            <Button
              key={v}
              variant={p.view === v ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 shrink-0 gap-1 px-2"
              title={`Read-only view over ${nav.store}`}
              onClick={() => p.onViewChange(v)}
            >
              <Icon className="h-3.5 w-3.5" />
              {nav.label}
            </Button>
          )
        })}
      </nav>
      {p.isFile && (
        <>
          <Button
            variant="ghost"
            size="icon"
            title={p.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            onClick={p.onToggleFavorite}
          >
            <Star className={cn('h-4 w-4', p.isFavorite && 'fill-amber-400 text-amber-400')} />
          </Button>
          <Button variant="ghost" size="icon" title="Copy full path" onClick={p.onCopyPath}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Reveal in file manager" onClick={p.onReveal}>
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title={p.raw ? 'Show rendered' : 'Show raw markdown'} onClick={p.onToggleRaw}>
            {p.raw ? <Eye className="h-4 w-4" /> : <FileCode className="h-4 w-4" />}
          </Button>
        </>
      )}
      <Button variant="ghost" size="icon" title="Refresh" onClick={p.onRefresh}>
        <RefreshCw className={cn('h-4 w-4', p.refreshing && 'animate-spin')} />
      </Button>
      <Button variant="ghost" size="icon" title="Toggle dark mode" onClick={p.onToggleDark}>
        {p.dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
    </header>
  )
}
