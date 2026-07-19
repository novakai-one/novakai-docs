/**
 * src/components/TopBar.tsx — main-pane header: file identity + actions.
 * Dumb component: props in, events out.
 */
import {
  Copy,
  ExternalLink,
  Eye,
  FileCode,
  FolderKanban,
  History,
  KanbanSquare,
  ListTodo,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Star,
  Sun,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { View } from '../lib/ui'

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
      <div className="flex items-center rounded-md border p-0.5">
        <Button
          variant={p.view === 'docs' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 px-2"
          onClick={() => p.onViewChange('docs')}
        >
          Docs
        </Button>
        <Button
          variant={p.view === 'tasks' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 gap-1 px-2"
          onClick={() => p.onViewChange('tasks')}
        >
          <ListTodo className="h-3.5 w-3.5" />
          Tasks
        </Button>
        <Button
          variant={p.view === 'board' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 gap-1 px-2"
          title="HQ board over data/tasks.jsonl"
          onClick={() => p.onViewChange('board')}
        >
          <KanbanSquare className="h-3.5 w-3.5" />
          Board
        </Button>
        <Button
          variant={p.view === 'timeline' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 gap-1 px-2"
          title="HQ timeline over data/timeline.jsonl"
          onClick={() => p.onViewChange('timeline')}
        >
          <History className="h-3.5 w-3.5" />
          Timeline
        </Button>
        <Button
          variant={p.view === 'projects' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 gap-1 px-2"
          title="HQ projects over data/projects.jsonl"
          onClick={() => p.onViewChange('projects')}
        >
          <FolderKanban className="h-3.5 w-3.5" />
          Projects
        </Button>
      </div>
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
