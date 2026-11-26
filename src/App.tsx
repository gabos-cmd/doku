import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FolderArt, Logo, COLORS } from './FolderArt'
import { GraphView } from './Graph'
import { OfficeView } from './Office'
import {
  demoState,
  docLinks,
  groupByDate,
  linkTitles,
  relativeTime,
  parseTasks,
  sanitize,
  taskStats,
  TASK_RE,
  daysUntil,
  dueLabel,
  normalizeDates,
  slugify,
  type Section,
  type Task,
  useStore,
  type Doc,
  type Folder,
  type FolderColor,
  type Store,
} from './store'

/* ---------- tiny hash router ---------- */

type Route =
  | { view: 'home' }
  | { view: 'graph' }
  | { view: 'tasks' }
  | { view: 'office' }
  | { view: 'space'; id: string }
  | { view: 'folder'; id: string }
  | { view: 'doc'; id: string }

function parse(hash: string): Route {
  const [, view, id] = hash.replace(/^#/, '').split('/')
  if (view === 'graph') return { view: 'graph' }
  if (view === 'tasks') return { view: 'tasks' }
  if (view === 'office') return { view: 'office' }
  if ((view === 'space' || view === 'folder' || view === 'doc') && id) return { view, id }
  return { view: 'home' }
}

function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.hash))
  useEffect(() => {
    const on = () => setRoute(parse(location.hash))
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

const go = (path: string) => (location.hash = path)

/* ---------- icons ---------- */

const Icon = {
  folder: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.6l2 2.2h7.4A2.5 2.5 0 0 1 21 9.7v7.8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" />
    </svg>
  ),
  home: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
      <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />
    </svg>
  ),
  graph: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <circle cx="6" cy="7" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
      <circle cx="12" cy="17" r="2.6" />
      <path d="M8 8.2 10.6 15M16.6 7.8 13.4 15M8.2 6.8l7.6-.6" />
    </svg>
  ),
  office: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="11" width="17" height="4" rx="1.2" />
      <path d="M6 15v4.5M18 15v4.5" />
      <rect x="9" y="5" width="6" height="6" rx="1.5" />
      <path d="M12 5V3" />
    </svg>
  ),
  check: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="4.5" />
      <path d="m8.5 12.2 2.4 2.4 4.6-5" />
    </svg>
  ),
  plus: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  chevron: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  ),
  doc: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" strokeLinecap="round" />
    </svg>
  ),
  star: (filled: boolean) => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
      <path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />
    </svg>
  ),
  trash: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13" />
    </svg>
  ),
  menu: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  ),
  search: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  ),
  copy: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
      <rect x="8" y="8" width="12" height="12" rx="2.5" />
      <path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8" />
    </svg>
  ),
  settings: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </svg>
  ),
}

/* ---------- app ---------- */

export default function App() {
  const store = useStore()
  const route = useRoute()
  const [navOpen, setNavOpen] = useState(false)
  const [creating, setCreating] = useState<null | { spaceId?: string }>(null)
  const [searching, setSearching] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => setNavOpen(false), [route])

  // ⌘K / Ctrl+K opens search from anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearching((s) => !s)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Leaving a doc that was never written in throws it away, so "New document" can't litter "Untitled" rows.
  const lastDocId = useRef<string | null>(null)
  const { deleteDoc } = store
  const docsRef = useRef(store.state.docs)
  docsRef.current = store.state.docs
  useEffect(() => {
    const prev = lastDocId.current
    lastDocId.current = route.view === 'doc' ? route.id : null
    if (!prev || prev === lastDocId.current) return
    const d = docsRef.current.find((x) => x.id === prev)
    if (d && !d.title.trim() && !d.body.trim()) deleteDoc(d.id)
  }, [route, deleteDoc])

  const { folders, docs, spaces } = store.state
  const folder = route.view === 'folder' ? folders.find((f) => f.id === route.id) : undefined
  const doc = route.view === 'doc' ? docs.find((d) => d.id === route.id) : undefined
  const docFolder = doc ? folders.find((f) => f.id === doc.folderId) : undefined
  const space =
    route.view === 'space'
      ? spaces.find((s) => s.id === route.id)
      : spaces.find((s) => s.id === (folder ?? docFolder)?.spaceId)

  return (
    <div className={`app ${navOpen ? 'nav-open' : ''}`}>
      <Sidebar
        store={store}
        route={route}
        activeSpaceId={space?.id}
        onSearch={() => setSearching(true)}
        onSettings={() => setSettingsOpen(true)}
      />
      <div className="scrim" onClick={() => setNavOpen(false)} />

      <main className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setNavOpen(true)} aria-label="Open sidebar">
            {Icon.menu}
          </button>
          <nav className="crumbs">
            <a href="#/">Home</a>
            {space && (
              <>
                <span>/</span>
                <a href={`#/space/${space.id}`}>{space.name}</a>
              </>
            )}
            {(folder ?? docFolder) && (
              <>
                <span>/</span>
                <a href={`#/folder/${(folder ?? docFolder)!.id}`}>{(folder ?? docFolder)!.name}</a>
              </>
            )}
            {route.view === 'tasks' && (
              <>
                <span>/</span>
                <b>Tasks</b>
              </>
            )}
            {route.view === 'office' && (
              <>
                <span>/</span>
                <b>Office</b>
              </>
            )}
            {doc && (
              <>
                <span>/</span>
                <b>{doc.title || 'Untitled'}</b>
              </>
            )}
          </nav>
          <button className="search-trigger" onClick={() => setSearching(true)} aria-label="Search">
            {Icon.search}
            <span>Search</span>
            <kbd>⌘K</kbd>
          </button>
        </header>

        <div className="content" key={'id' in route ? `${route.view}/${route.id}` : route.view}>
          {route.view === 'graph' && <GraphView state={store.state} />}
          {route.view === 'tasks' && <TasksView store={store} />}
          {route.view === 'office' && <OfficeView />}
          {route.view === 'home' && <Home store={store} onNewFolder={(spaceId) => setCreating({ spaceId })} />}
          {route.view === 'space' &&
            (space ? (
              <SpaceView store={store} spaceId={space.id} onNewFolder={() => setCreating({ spaceId: space.id })} />
            ) : (
              <Empty />
            ))}
          {route.view === 'folder' && (folder ? <FolderView store={store} folder={folder} /> : <Empty />)}
          {route.view === 'doc' && (doc ? <DocView key={doc.id} store={store} docId={doc.id} /> : <Empty />)}
        </div>
      </main>

      {creating && (
        <NewFolderDialog
          store={store}
          defaultSpaceId={creating.spaceId ?? spaces[0]?.id}
          onClose={() => setCreating(null)}
        />
      )}
      {searching && <SearchPalette store={store} onClose={() => setSearching(false)} />}
      {settingsOpen && <SettingsDialog store={store} onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}

function Empty() {
  return (
    <div className="empty">
      <p>That page doesn’t exist anymore.</p>
      <a href="#/">Back home</a>
    </div>
  )
}

/* ---------- sidebar ---------- */

function Sidebar({
  store,
  route,
  activeSpaceId,
  onSearch,
  onSettings,
}: {
  store: Store
  route: Route
  activeSpaceId?: string
  onSearch: () => void
  onSettings: () => void
}) {
  const { spaces, folders } = store.state
  const [favOpen, setFavOpen] = useState(true)
  const [addingSpace, setAddingSpace] = useState(false)
  const [spaceName, setSpaceName] = useState('')
  const favorites = folders.filter((f) => f.favorite)
  const openTasks = useMemo(
    () => store.state.docs.reduce((n, d) => n + parseTasks(d).filter((t) => !t.done).length, 0),
    [store.state.docs],
  )

  const submitSpace = () => {
    const name = spaceName.trim()
    if (name) {
      const s = store.addSpace(name)
      go(`#/space/${s.id}`)
    }
    setSpaceName('')
    setAddingSpace(false)
  }

  return (
    <aside className="sidebar">
      <a className="brand" href="#/" aria-label="Doku home">
        <span className="brand-mark">
          <Logo size={22} />
        </span>
        <span className="brand-word">Doku</span>
      </a>

      <nav className="nav">
        <a className={`nav-item ${route.view === 'home' ? 'active' : ''}`} href="#/">
          {Icon.home}
          <span>Home</span>
        </a>
        <button className="nav-item" onClick={onSearch}>
          {Icon.search}
          <span>Search</span>
          <em>⌘K</em>
        </button>
        <a className={`nav-item ${route.view === 'graph' ? 'active' : ''}`} href="#/graph">
          {Icon.graph}
          <span>Graph</span>
        </a>
        <a className={`nav-item ${route.view === 'tasks' ? 'active' : ''}`} href="#/tasks">
          {Icon.check}
          <span>Tasks</span>
          {openTasks > 0 && <em>{openTasks}</em>}
        </a>
        <a className={`nav-item ${route.view === 'office' ? 'active' : ''}`} href="#/office">
          {Icon.office}
          <span>Office</span>
        </a>

        <div className="nav-heading">
          <span>Spaces</span>
          <button className="icon-btn sm" onClick={() => setAddingSpace(true)} aria-label="New space">
            {Icon.plus}
          </button>
        </div>
        {spaces.map((s) => (
          <a key={s.id} className={`nav-item ${activeSpaceId === s.id ? 'active' : ''}`} href={`#/space/${s.id}`}>
            {Icon.folder}
            <span>{s.name}</span>
            <em>{folders.filter((f) => f.spaceId === s.id).length}</em>
          </a>
        ))}
        {addingSpace && (
          <input
            className="nav-input"
            autoFocus
            placeholder="Space name"
            value={spaceName}
            onChange={(e) => setSpaceName(e.target.value)}
            onBlur={submitSpace}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitSpace()
              if (e.key === 'Escape') {
                setSpaceName('')
                setAddingSpace(false)
              }
            }}
          />
        )}

        <button className="nav-heading toggle" onClick={() => setFavOpen((o) => !o)}>
          <span>Favorites</span>
          <i className={favOpen ? '' : 'closed'}>{Icon.chevron}</i>
        </button>
        {favOpen &&
          (favorites.length ? (
            favorites.map((f) => (
              <a
                key={f.id}
                className={`nav-item ${route.view === 'folder' && route.id === f.id ? 'active' : ''}`}
                href={`#/folder/${f.id}`}
              >
                <span className={`dot dot-${f.color}`} />
                <span>{f.name}</span>
              </a>
            ))
          ) : (
            <p className="nav-hint">Star a folder to pin it here.</p>
          ))}
      </nav>

      <div className="profile">
        <div className="avatar">D</div>
        <div className="profile-text">
          <b>My profile</b>
          <span>Saved on this device</span>
        </div>
        <button className="icon-btn sm" aria-label="Settings" title="Settings & data" onClick={onSettings}>
          {Icon.settings}
        </button>
      </div>
    </aside>
  )
}

/* ---------- folder grid ---------- */

function FolderGrid({ store, list, onNew }: { store: Store; list: Folder[]; onNew?: () => void }) {
  const { docs } = store.state
  return (
    <div className="grid">
      {list.map((f) => {
        const fdocs = docs.filter((d) => d.folderId === f.id)
        const last = Math.max(0, ...fdocs.map((d) => d.updatedAt))
        return (
          <a key={f.id} className="folder-card" href={`#/folder/${f.id}`}>
            <FolderArt color={f.color} count={fdocs.length} label={last ? `Updated ${relativeTime(last)}` : 'Empty'} />
            <div className="folder-meta">
              <h3>{f.name}</h3>
              <p>
                {fdocs.length} {fdocs.length === 1 ? 'document' : 'documents'}
              </p>
            </div>
          </a>
        )
      })}
      {onNew && (
        <button className="folder-card new" onClick={onNew}>
          <div className="new-art">{Icon.plus}</div>
          <div className="folder-meta">
            <h3>New folder</h3>
            <p>Add a subject</p>
          </div>
        </button>
      )}
    </div>
  )
}

function count(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function Home({ store, onNewFolder }: { store: Store; onNewFolder: (spaceId: string) => void }) {
  const { spaces, folders, docs } = store.state
  const newFolder = () => onNewFolder(spaces[0]?.id)
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Home</h1>
          <p className="subhead">
            {count(folders.length, 'folder')} · {count(docs.length, 'document')}
          </p>
        </div>
        <button className="btn" onClick={newFolder}>
          {Icon.plus} New folder
        </button>
      </div>
      <RecentDocs store={store} />
      <FolderGrid store={store} list={folders} onNew={newFolder} />
    </div>
  )
}

function RecentDocs({ store }: { store: Store }) {
  const { docs, folders } = store.state
  const recent = useMemo(() => [...docs].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4), [docs])
  if (!recent.length) return null
  return (
    <section className="recent">
      <h4>Recently edited</h4>
      <div className="recent-row">
        {recent.map((d) => {
          const f = folders.find((x) => x.id === d.folderId)
          return (
            <a key={d.id} className="recent-card" href={`#/doc/${d.id}`}>
              <span className="recent-folder">
                {f && <span className={`dot dot-${f.color}`} />}
                {f?.name ?? 'No folder'}
              </span>
              <b>{d.title || 'Untitled'}</b>
              <span className="recent-snippet">{d.body.split('\n').find((l) => l.trim()) || 'No content yet'}</span>
              <time>{relativeTime(d.updatedAt)}</time>
            </a>
          )
        })}
      </div>
    </section>
  )
}

function SpaceView({ store, spaceId, onNewFolder }: { store: Store; spaceId: string; onNewFolder: () => void }) {
  const space = store.state.spaces.find((s) => s.id === spaceId)!
  const list = store.state.folders.filter((f) => f.spaceId === spaceId)
  const docCount = store.state.docs.filter((d) => list.some((f) => f.id === d.folderId)).length
  const remove = () => {
    const what = list.length ? ` and its ${count(list.length, 'folder')} (${count(docCount, 'document')})` : ''
    if (confirm(`Delete the “${space.name}” space${what}? This can’t be undone.`)) {
      store.deleteSpace(space.id)
      go('#/')
    }
  }
  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-text">
          <input
            className="h1-input"
            value={space.name}
            onChange={(e) => store.updateSpace(space.id, { name: e.target.value })}
            onBlur={(e) => !e.target.value.trim() && store.updateSpace(space.id, { name: 'Untitled space' })}
            aria-label="Space name"
          />
          <p className="subhead">
            {count(list.length, 'folder')} · {count(docCount, 'document')}
          </p>
        </div>
        <div className="head-actions">
          <button className="icon-btn" onClick={remove} aria-label="Delete space" title="Delete space">
            {Icon.trash}
          </button>
          <button className="btn" onClick={onNewFolder}>
            {Icon.plus} New folder
          </button>
        </div>
      </div>
      <FolderGrid store={store} list={list} onNew={onNewFolder} />
    </div>
  )
}

/* ---------- folder: list of documents grouped by date ---------- */

function FolderView({ store, folder }: { store: Store; folder: Folder }) {
  const docs = store.state.docs.filter((d) => d.folderId === folder.id)
  const groups = useMemo(() => groupByDate(docs), [docs])

  const newDoc = () => {
    const d = store.addDoc(folder.id)
    go(`#/doc/${d.id}`)
  }

  const remove = () => {
    if (confirm(`Delete “${folder.name}”${docs.length ? ` and its ${count(docs.length, 'document')}` : ''}? This can’t be undone.`)) {
      store.deleteFolder(folder.id)
      go(`#/space/${folder.spaceId}`)
    }
  }

  return (
    <div className="page narrow">
      <div className="folder-head">
        <FolderArt color={folder.color} count={docs.length} size="sm" />
        <div className="folder-head-text">
          <input
            className="title-input"
            value={folder.name}
            onChange={(e) => store.updateFolder(folder.id, { name: e.target.value })}
            onBlur={(e) => !e.target.value.trim() && store.updateFolder(folder.id, { name: 'Untitled folder' })}
            aria-label="Folder name"
          />
          <p>
            {docs.length} {docs.length === 1 ? 'document' : 'documents'}
          </p>
        </div>
        <div className="folder-actions">
          <button
            className={`icon-btn ${folder.favorite ? 'starred' : ''}`}
            onClick={() => store.updateFolder(folder.id, { favorite: !folder.favorite })}
            aria-label="Favorite"
            title={folder.favorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            {Icon.star(folder.favorite)}
          </button>
          <button className="icon-btn" onClick={remove} aria-label="Delete folder" title="Delete folder">
            {Icon.trash}
          </button>
          <button className="btn" onClick={newDoc}>
            {Icon.plus} New document
          </button>
        </div>
      </div>

      <div className="swatches inline">
        {COLORS.map((c) => (
          <button
            key={c}
            className={`swatch dot-${c} ${folder.color === c ? 'on' : ''}`}
            onClick={() => store.updateFolder(folder.id, { color: c })}
            aria-label={c}
          />
        ))}
      </div>

      {groups.length === 0 ? (
        <div className="empty">
          <p>No documents yet.</p>
          <button className="btn" onClick={newDoc}>
            {Icon.plus} Write the first one
          </button>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.label} className="doc-group">
            <h4>{g.label}</h4>
            <ul>
              {g.docs.map((d) => (
                <li key={d.id}>
                  <a href={`#/doc/${d.id}`} className="doc-row">
                    <span className="doc-icon">{Icon.doc}</span>
                    <span className="doc-text">
                      <b>{d.title || 'Untitled'}</b>
                      <span>{d.body.split('\n').find((l) => l.trim()) || 'No content yet'}</span>
                    </span>
                    <TaskBadge doc={d} />
                    <time>{relativeTime(d.updatedAt)}</time>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}

/* ---------- document editor ---------- */

function DocView({ store, docId }: { store: Store; docId: string }) {
  const { docs, folders, spaces } = store.state
  const doc = docs.find((d) => d.id === docId)!
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const titleAtFocus = useRef(doc.title)
  const [suggest, setSuggest] = useState<null | { start: number; query: string; top: number; left: number }>(null)
  const [pick, setPick] = useState(0)

  useEffect(() => {
    if (!doc.title) titleRef.current?.focus()
    // only on open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId])

  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [doc.body])

  // titles the [[ autocomplete can offer
  const matches = useMemo(() => {
    if (!suggest) return []
    const q = suggest.query.trim().toLowerCase()
    const titles = docs.filter((d) => d.id !== docId && d.title.trim()).map((d) => d.title.trim())
    const uniq = [...new Set(titles)]
    const hits = uniq
      .filter((t) => t.toLowerCase().includes(q))
      .sort((x, y) => Number(!x.toLowerCase().startsWith(q)) - Number(!y.toLowerCase().startsWith(q)))
      .slice(0, 6)
    return hits
  }, [suggest, docs, docId])

  const checkSuggest = (el: HTMLTextAreaElement) => {
    const caret = el.selectionStart
    const before = el.value.slice(0, caret)
    const m = /\[\[([^[\]\n]{0,60})$/.exec(before)
    if (!m || el.selectionEnd !== caret) return setSuggest(null)
    const pos = caretCoords(el, caret - m[1].length - 2)
    setSuggest({ start: caret - m[1].length, query: m[1], ...pos })
    setPick(0)
  }

  const accept = (title: string) => {
    const el = bodyRef.current
    if (!el || !suggest) return
    const caret = el.selectionStart
    const after = el.value.slice(caret)
    const closes = after.startsWith(']]')
    const body = el.value.slice(0, suggest.start) + title + ']]' + (closes ? after.slice(2) : after)
    store.updateDoc(doc.id, { body })
    setSuggest(null)
    const at = suggest.start + title.length + 2
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(at, at)
    })
  }

  /** Replace text[from, to) and put the caret at `caret`. */
  const splice = (from: number, to: number, insert: string, caret: number) => {
    const el = bodyRef.current
    if (!el) return
    store.updateDoc(doc.id, { body: el.value.slice(0, from) + insert + el.value.slice(to) })
    requestAnimationFrame(() => el.setSelectionRange(caret, caret))
  }

  /** Bounds of the line the caret is on. */
  const currentLine = () => {
    const el = bodyRef.current!
    const start = el.value.lastIndexOf('\n', el.selectionStart - 1) + 1
    const nl = el.value.indexOf('\n', el.selectionStart)
    const end = nl < 0 ? el.value.length : nl
    return { start, end, text: el.value.slice(start, end) }
  }

  /** Turn the caret's line into a to-do, or tick/untick it if it already is one. */
  const toggleLineTask = () => {
    const el = bodyRef.current
    if (!el) return
    const { start, end, text } = currentLine()
    const m = TASK_RE.exec(text)
    const offset = el.selectionStart - start
    if (m) {
      const next = m[1] + (m[2] === ' ' ? 'x' : ' ') + m[3]
      splice(start, end, next, start + offset)
    } else {
      const bullet = /^(\s*)[-*+]\s+/.exec(text)
      const indent = /^\s*/.exec(text)![0]
      const rest = bullet ? text.slice(bullet[0].length) : text.slice(indent.length)
      const next = `${indent}- [ ] ${rest}`
      splice(start, end, next, start + offset + (next.length - text.length))
    }
    el.focus()
  }

  const onBodyKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      toggleLineTask()
      return
    }
    // keep lists going: Enter on a to-do / bullet starts the next one, Enter on an empty one ends the list
    if (e.key === 'Enter' && !e.shiftKey && !(suggest && matches.length) && el.selectionStart === el.selectionEnd) {
      const { start, end, text } = currentLine()
      const task = /^(\s*)([-*+])\s+\[[ xX]\]\s?(.*)$/.exec(text)
      const bullet = task ? null : /^(\s*)([-*+])\s(.*)$/.exec(text)
      const m = task ?? bullet
      if (m && el.selectionStart > start + m[0].length - m[3].length - 1) {
        e.preventDefault()
        if (!m[3].trim()) {
          splice(start, end, '', start) // empty item → leave the list
        } else {
          const prefix = `${m[1]}${m[2]} ${task ? '[ ] ' : ''}`
          const at = el.selectionStart
          splice(at, at, '\n' + prefix, at + 1 + prefix.length)
        }
        return
      }
    }
    if (!suggest || !matches.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setPick((p) => (p + 1) % matches.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setPick((p) => (p - 1 + matches.length) % matches.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      accept(matches[pick])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setSuggest(null)
    }
  }

  const remove = () => {
    if (confirm('Delete this document? This can’t be undone.')) {
      store.deleteDoc(doc.id)
      go(`#/folder/${doc.folderId}`)
    }
  }

  const duplicate = () => {
    const d = store.addDoc(doc.folderId, doc.title ? `${doc.title} (copy)` : '', doc.body)
    go(`#/doc/${d.id}`)
  }

  const commitTitle = () => {
    store.relink(doc.id, titleAtFocus.current, doc.title)
    titleAtFocus.current = doc.title
  }

  const words = doc.body.trim() ? doc.body.trim().split(/\s+/).length : 0

  return (
    <article className="page doc-page">
      <div className="doc-meta">
        <span>
          Edited {relativeTime(doc.updatedAt)} · {count(words, 'word')}
        </span>
        <div className="doc-actions">
          <label className="move-select" title="Move to folder">
            {Icon.folder}
            <select value={doc.folderId} onChange={(e) => store.updateDoc(doc.id, { folderId: e.target.value })} aria-label="Move to folder">
              {spaces.map((sp) => (
                <optgroup key={sp.id} label={sp.name}>
                  {folders
                    .filter((f) => f.spaceId === sp.id)
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <button
            className="icon-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (document.activeElement !== bodyRef.current) {
                // not editing: start a fresh to-do at the end
                const el = bodyRef.current
                if (!el) return
                const body = doc.body.replace(/\s+$/, '')
                const sep = !body ? '' : TASK_RE.test(body.split('\n').pop() ?? '') ? '\n' : '\n\n'
                const next = `${body}${sep}- [ ] `
                store.updateDoc(doc.id, { body: next })
                requestAnimationFrame(() => {
                  el.focus()
                  el.setSelectionRange(next.length, next.length)
                })
              } else toggleLineTask()
            }}
            aria-label="To-do"
            title="To-do (⌘↵)"
          >
            {Icon.check}
          </button>
          <button className="icon-btn" onClick={duplicate} aria-label="Duplicate document" title="Duplicate">
            {Icon.copy}
          </button>
          <button className="icon-btn" onClick={remove} aria-label="Delete document" title="Delete document">
            {Icon.trash}
          </button>
        </div>
      </div>
      <input
        className="doc-title"
        placeholder="Untitled"
        value={doc.title}
        ref={titleRef}
        onFocus={() => (titleAtFocus.current = doc.title)}
        onBlur={commitTitle}
        onChange={(e) => store.updateDoc(doc.id, { title: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            bodyRef.current?.focus()
          }
        }}
      />
      <div className="doc-body-wrap">
        <textarea
          ref={bodyRef}
          className="doc-body"
          placeholder="Start writing… type [[ to link a note, - [ ] for a to-do"
          value={doc.body}
          onChange={(e) => {
            store.updateDoc(doc.id, { body: e.target.value })
            checkSuggest(e.target)
          }}
          onKeyDown={onBodyKey}
          onClick={(e) => checkSuggest(e.currentTarget)}
          onKeyUp={(e) => ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) && checkSuggest(e.currentTarget)}
          onBlur={() => setTimeout(() => setSuggest(null), 120)}
        />
        {suggest && (
          <div className="suggest" style={{ top: suggest.top, left: suggest.left }}>
            {matches.length ? (
              matches.map((t, i) => (
                <button
                  key={t}
                  className={i === pick ? 'on' : ''}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    accept(t)
                  }}
                  onMouseEnter={() => setPick(i)}
                >
                  {Icon.doc}
                  {t}
                </button>
              ))
            ) : (
              <p>{suggest.query.trim() ? `No note called “${suggest.query.trim()}” yet — close with ]] to create a link` : 'No other notes yet'}</p>
            )}
          </div>
        )}
      </div>
      <DocTasks store={store} doc={doc} />
      <Connections store={store} docId={doc.id} />
    </article>
  )
}

/** Pixel position (relative to the textarea) just below character `index`, via a mirror element. */
function caretCoords(el: HTMLTextAreaElement, index: number) {
  const cs = getComputedStyle(el)
  const div = document.createElement('div')
  for (const p of ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'padding', 'border', 'boxSizing', 'wordSpacing', 'tabSize'] as const)
    div.style[p] = cs[p]
  div.style.position = 'absolute'
  div.style.visibility = 'hidden'
  div.style.whiteSpace = 'pre-wrap'
  div.style.overflowWrap = 'break-word'
  div.style.width = el.clientWidth + 'px'
  div.textContent = el.value.slice(0, index)
  const mark = document.createElement('span')
  mark.textContent = '​'
  div.appendChild(mark)
  document.body.appendChild(div)
  const top = mark.offsetTop + parseFloat(cs.lineHeight || '24')
  const left = Math.min(mark.offsetLeft, el.clientWidth - 260)
  document.body.removeChild(div)
  return { top, left: Math.max(0, left) }
}

function Connections({ store, docId }: { store: Store; docId: string }) {
  const { docs } = store.state
  const doc = docs.find((d) => d.id === docId)!
  const pairs = useMemo(() => docLinks(docs), [docs])
  const byId = (id: string) => docs.find((d) => d.id === id)!
  const outgoing = pairs.filter(([a]) => a === docId).map(([, b]) => byId(b))
  const backlinks = pairs.filter(([, b]) => b === docId).map(([a]) => byId(a))
  const resolved = new Set(outgoing.map((d) => d.title.trim().toLowerCase()))
  const missing = [...new Set(linkTitles(doc.body))].filter((t) => !resolved.has(t.toLowerCase()))

  const create = (title: string) => {
    const d = store.addDoc(doc.folderId, title)
    go(`#/doc/${d.id}`)
  }

  if (!outgoing.length && !backlinks.length && !missing.length) return null
  return (
    <section className="connections">
      {(outgoing.length > 0 || missing.length > 0) && (
        <div>
          <h4>Links to</h4>
          <div className="chips">
            {outgoing.map((d) => (
              <a key={d.id} className="link-chip" href={`#/doc/${d.id}`}>
                {Icon.doc}
                {d.title}
              </a>
            ))}
            {missing.map((t) => (
              <button key={t} className="link-chip missing" onClick={() => create(t)} title="Create this note">
                {Icon.plus}
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
      {backlinks.length > 0 && (
        <div>
          <h4>Linked from</h4>
          <div className="chips">
            {backlinks.map((d) => (
              <a key={d.id} className="link-chip" href={`#/doc/${d.id}`}>
                {Icon.doc}
                {d.title || 'Untitled'}
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

/* ---------- to-dos ---------- */

/** "2/5" pill for docs that hold to-dos. */
function TaskBadge({ doc }: { doc: Doc }) {
  const { total, done } = taskStats(doc)
  if (!total) return null
  return (
    <span className={`task-badge ${done === total ? 'all' : ''}`} title={`${done} of ${total} to-dos done`}>
      {Icon.check}
      {done}/{total}
    </span>
  )
}

function Progress({ done, total }: { done: number; total: number }) {
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
      <i style={{ width: total ? `${(done / total) * 100}%` : 0 }} />
    </div>
  )
}

/** Task text with [[links]] rendered as links. */
function TaskText({ text, docs }: { text: string; docs: Doc[] }) {
  const parts = text.split(/(\[\[[^[\]\n]+?\]\])/g)
  return (
    <>
      {parts.map((p, i) => {
        const m = /^\[\[(.+)\]\]$/.exec(p)
        if (!m) return p
        const t = m[1].trim()
        const target = docs.find((d) => d.title.trim().toLowerCase() === t.toLowerCase())
        return target ? (
          <a key={i} className="task-link" href={`#/doc/${target.id}`} onClick={(e) => e.stopPropagation()}>
            {t}
          </a>
        ) : (
          <span key={i} className="task-link missing">
            {t}
          </span>
        )
      })}
    </>
  )
}

function Checkbox({ done, onToggle, label }: { done: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      className={`checkbox ${done ? 'on' : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onToggle}
    >
      <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3.5 8.4 2.9 2.9 6-6.3" />
      </svg>
    </button>
  )
}

const CalendarIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.5" y="5" width="17" height="15.5" rx="3.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
)

function DueChip({ due, done }: { due: string; done?: boolean }) {
  const n = daysUntil(due)
  const tone = done ? '' : n < 0 ? 'overdue' : n === 0 ? 'today' : n === 1 ? 'soon' : ''
  return (
    <span className={`due ${tone}`} title={due}>
      {CalendarIcon}
      {dueLabel(due)}
    </span>
  )
}

/** Short-lived toast with an Undo button. */
function useUndo() {
  const [toast, setToast] = useState<null | { id: number; msg: string; undo: () => void }>(null)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(t)
  }, [toast])
  const show = useCallback((msg: string, undo: () => void) => setToast({ id: Date.now(), msg, undo }), [])
  // portalled: an animated (transformed) ancestor would otherwise pin the fixed toast to the page, not the window
  const el = toast && createPortal(
    <div className="toast" role="status" key={toast.id}>
      <span>{toast.msg}</span>
      <button
        onClick={() => {
          toast.undo()
          setToast(null)
        }}
      >
        Undo
      </button>
    </div>,
    document.body,
  )
  return [el, show] as const
}

/** Runs a change to one doc, offering to put its body back afterwards. */
function useDocUndo(store: Store) {
  const [toast, show] = useUndo()
  const run = (docId: string, msg: string, change: () => void) => {
    const before = store.state.docs.find((d) => d.id === docId)?.body
    change()
    if (before !== undefined) show(msg, () => store.updateDoc(docId, { body: before }))
  }
  return [toast, run] as const
}

/** One to-do: tick it, click the text to edit (Enter saves, Esc cancels, empty deletes), × removes it. */
function TaskRow({
  task,
  docs,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: Task
  docs: Doc[]
  onToggle: () => void
  onEdit: (text: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(task.raw)
  const cancelled = useRef(false)

  const start = () => {
    cancelled.current = false
    setVal(task.raw)
    setEditing(true)
  }
  const commit = () => {
    setEditing(false)
    if (cancelled.current) return
    const v = val.trim()
    if (!v) onDelete()
    else if (v !== task.raw) onEdit(v)
  }

  return (
    <li className={`${task.done ? 'done' : ''} ${editing ? 'editing' : ''}`}>
      <Checkbox done={task.done} onToggle={onToggle} label={task.text || 'Empty to-do'} />
      {editing ? (
        <input
          className="task-edit"
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              e.stopPropagation()
              cancelled.current = true
              e.currentTarget.blur()
            }
          }}
          aria-label="Edit to-do"
        />
      ) : (
        <span className="task-text" onClick={start} title="Click to edit">
          {task.text ? <TaskText text={task.text} docs={docs} /> : <i>Empty to-do</i>}
          {task.due && <DueChip due={task.due} done={task.done} />}
        </span>
      )}
      <button className="task-del" onMouseDown={(e) => e.preventDefault()} onClick={onDelete} aria-label="Delete to-do" title="Delete">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </li>
  )
}

/** Input that adds a to-do on Enter and previews the due date it picked up. */
function TaskInput({
  onAdd,
  placeholder,
  inputRef,
  children,
  className = '',
}: {
  onAdd: (text: string) => void
  placeholder: string
  inputRef?: React.RefObject<HTMLInputElement>
  children?: React.ReactNode
  className?: string
}) {
  const [draft, setDraft] = useState('')
  const preview = useMemo(() => /@(\d{4}-\d{2}-\d{2})(?=\s|$)/.exec(normalizeDates(draft))?.[1], [draft])
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) return
    onAdd(draft)
    setDraft('')
  }
  return (
    <form className={`task-input ${className}`} onSubmit={submit}>
      <span className="checkbox ghost" aria-hidden />
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && (setDraft(''), e.currentTarget.blur())}
        placeholder={placeholder}
        aria-label="New to-do"
      />
      {preview && <DueChip due={preview} />}
      {children}
    </form>
  )
}

/** Clickable checklist under the editor, so to-dos can be ticked, edited and added without touching the markdown. */
function DocTasks({ store, doc }: { store: Store; doc: Doc }) {
  const [toast, withUndo] = useDocUndo(store)
  const tasks = parseTasks(doc)
  if (!tasks.length) return toast
  const done = tasks.filter((t) => t.done).length
  return (
    <section className="doc-tasks">
      <div className="doc-tasks-head">
        <h4>
          To-dos <span>{done}/{tasks.length}</span>
        </h4>
        {done > 0 && (
          <button className="link-btn" onClick={() => withUndo(doc.id, `Cleared ${count(done, 'to-do')}`, () => store.clearDone(doc.id))}>
            Clear completed
          </button>
        )}
      </div>
      <Progress done={done} total={tasks.length} />
      <ul className="task-list">
        {tasks.map((t) => (
          <TaskRow
            key={t.line}
            task={t}
            docs={store.state.docs}
            onToggle={() => store.toggleTask(doc.id, t.line)}
            onEdit={(text) => store.editTask(doc.id, t.line, text)}
            onDelete={() => withUndo(doc.id, 'To-do deleted', () => store.editTask(doc.id, t.line, ''))}
          />
        ))}
      </ul>
      <TaskInput className="inline" placeholder="Add a to-do…" onAdd={(text) => store.addTask(doc.id, text)} />
      {toast}
    </section>
  )
}

/* ---------- tasks board: one column per section, a card per to-do ---------- */

const BoardIcon = {
  trash: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 6.5h15M9.5 6.5V4h5v2.5M6.5 6.5l1 13.5h9l1-13.5" />
    </svg>
  ),
  pencil: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15.5 4.5 19.5 8.5 8.5 19.5H4.5v-4z" />
      <path d="m13 7 4 4" />
    </svg>
  ),
  arrow: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 12h15M13.5 6l6 6-6 6" />
    </svg>
  ),
  left: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m14.5 6-6 6 6 6" />
    </svg>
  ),
  right: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9.5 6 6 6-6 6" />
    </svg>
  ),
  x: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  ),
}

/** Rebuild a to-do's raw text from edited words, keeping its date and section unless the edit brings its own. */
function composeTask(text: string, t: Task) {
  let out = text.trim()
  if (!out) return ''
  if (t.due && !/(^|\s)@\S/.test(out)) out += ` @${t.due}`
  if (t.section && !/(^|\s)#\S/.test(out)) out += ` #${t.section}`
  return out
}

type Column = { key: string; tag: string | null; name: string; color: FolderColor; section?: Section }

function TaskCard({
  task,
  store,
  onToggle,
  onDelete,
}: {
  task: Task
  store: Store
  onToggle: () => void
  onDelete: () => void
}) {
  const { docs, folders } = store.state
  const doc = docs.find((d) => d.id === task.docId)!
  const folder = folders.find((f) => f.id === doc.folderId)
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(task.text)
  const cancelled = useRef(false)
  const [dragging, setDragging] = useState(false)

  const start = () => {
    cancelled.current = false
    setVal(task.text)
    setEditing(true)
  }
  const commit = () => {
    setEditing(false)
    if (cancelled.current) return
    if (!val.trim()) return onDelete()
    if (val.trim() !== task.text) store.editTask(task.docId, task.line, composeTask(val, task))
  }

  const n = task.due ? daysUntil(task.due) : null
  const tone = task.done || n === null ? '' : n < 0 ? 'overdue' : n === 0 ? 'today' : n === 1 ? 'soon' : ''

  return (
    <article
      className={`tcard ${task.done ? 'done' : ''} ${dragging ? 'dragging' : ''}`}
      draggable={!editing}
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-dok-task', JSON.stringify({ docId: task.docId, line: task.line }))
        e.dataTransfer.effectAllowed = 'move'
        setDragging(true)
      }}
      onDragEnd={() => setDragging(false)}
    >
      <header className="tcard-head">
        {editing ? (
          <textarea
            className="tcard-edit"
            autoFocus
            rows={2}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                e.currentTarget.blur()
              }
              if (e.key === 'Escape') {
                e.stopPropagation()
                cancelled.current = true
                e.currentTarget.blur()
              }
            }}
            aria-label="Edit to-do"
          />
        ) : (
          <h3 onDoubleClick={start}>{task.text ? <TaskText text={task.text} docs={docs} /> : <i>Empty to-do</i>}</h3>
        )}
        <div className="tcard-pills">
          {task.due && <span className={`pill due-pill ${tone}`}>{dueLabel(task.due)}</span>}
          <button
            className={`pill status ${task.done ? 'is-done' : 'is-open'}`}
            onClick={onToggle}
            role="checkbox"
            aria-checked={task.done}
            title={task.done ? 'Mark as open' : 'Mark as done'}
          >
            {task.done ? 'Done' : 'Open'}
          </button>
        </div>
      </header>

      <dl className="tcard-stats">
        <div>
          <dt>due</dt>
          <dd className={tone}>{task.due ? dueLabel(task.due) : '—'}</dd>
        </div>
        <div>
          <dt>folder</dt>
          <dd>{folder?.name ?? '—'}</dd>
        </div>
        <div>
          <dt>section</dt>
          <dd>
            <select
              className="tcard-move"
              value={task.section ?? ''}
              onChange={(e) => store.setTaskSection(task.docId, task.line, e.target.value || null)}
              aria-label="Move to section"
            >
              <option value="">Inbox</option>
              {(store.state.sections ?? []).map((s) => (
                <option key={s.id} value={slugify(s.name)}>
                  {s.name}
                </option>
              ))}
              {task.section && !(store.state.sections ?? []).some((s) => slugify(s.name) === task.section) && (
                <option value={task.section}>{task.section.replace(/-/g, ' ')}</option>
              )}
            </select>
          </dd>
        </div>
      </dl>

      <footer className="tcard-foot">
        <div className="tcard-from">
          <span className="tcard-label">from note</span>
          <div className="tcard-note">
            <span className={`tcard-avatar dot-${folder?.color ?? 'grey'}`}>{(doc.title.trim()[0] ?? '·').toUpperCase()}</span>
            <div>
              <b>{doc.title || 'Untitled'}</b>
              <a href={`#/doc/${doc.id}`}>Open note</a>
            </div>
          </div>
        </div>
        <div className="tcard-actions">
          <button className="tcard-btn danger" onClick={onDelete} aria-label="Delete to-do" title="Delete">
            {BoardIcon.trash}
          </button>
          <button className="tcard-btn" onClick={start} aria-label="Edit to-do" title="Edit">
            {BoardIcon.pencil}
          </button>
          <a className="tcard-btn" href={`#/doc/${doc.id}`} aria-label="Open note" title="Open note">
            {BoardIcon.arrow}
          </a>
        </div>
      </footer>
    </article>
  )
}

function BoardColumn({
  col,
  tasks,
  store,
  first,
  last,
  onAdd,
  onToggle,
  onDelete,
}: {
  col: Column
  tasks: Task[]
  store: Store
  first: boolean
  last: boolean
  onAdd: (text: string, tag: string | null) => void
  onToggle: (t: Task) => void
  onDelete: (t: Task) => void
}) {
  const [over, setOver] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(col.name)
  const sec = col.section
  const open = tasks.filter((t) => !t.done).length

  const commitName = () => {
    setRenaming(false)
    const n = name.trim()
    if (!sec || !n || n === sec.name) return setName(col.name)
    const taken = (store.state.sections ?? []).some((x) => x.id !== sec.id && slugify(x.name) === slugify(n))
    if (taken || !slugify(n)) return setName(col.name)
    store.updateSection(sec.id, { name: n })
  }

  const remove = () => {
    if (!sec) return
    if (tasks.length && !confirm(`Delete “${sec.name}”? Its ${count(tasks.length, 'to-do')} move back to Inbox.`)) return
    store.deleteSection(sec.id)
  }

  const cycleColor = () => {
    if (!sec) return
    store.updateSection(sec.id, { color: COLORS[(COLORS.indexOf(sec.color) + 1) % COLORS.length] })
  }

  return (
    <section
      className={`board-col ${over ? 'over' : ''}`}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('application/x-dok-task')) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setOver(true)
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOver(false)}
      onDrop={(e) => {
        setOver(false)
        const raw = e.dataTransfer.getData('application/x-dok-task')
        if (!raw) return
        e.preventDefault()
        const { docId, line } = JSON.parse(raw) as { docId: string; line: number }
        store.setTaskSection(docId, line, col.tag)
      }}
    >
      <div className="board-col-head">
        <button className={`col-dot dot-${col.color}`} onClick={cycleColor} disabled={!sec} aria-label="Change color" title={sec ? 'Change color' : undefined} />
        {renaming ? (
          <input
            className="col-name-input"
            autoFocus
            value={name}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') {
                setName(col.name)
                setRenaming(false)
              }
            }}
          />
        ) : (
          <h2 onDoubleClick={() => sec && setRenaming(true)} title={sec ? 'Double-click to rename' : undefined}>
            {col.name}
          </h2>
        )}
        <span className="col-count">{open}</span>
        {sec && (
          <div className="col-tools">
            <button onClick={() => store.moveSection(sec.id, -1)} disabled={first} aria-label="Move left" title="Move left">
              {BoardIcon.left}
            </button>
            <button onClick={() => store.moveSection(sec.id, 1)} disabled={last} aria-label="Move right" title="Move right">
              {BoardIcon.right}
            </button>
            <button onClick={() => setRenaming(true)} aria-label="Rename section" title="Rename">
              {BoardIcon.pencil}
            </button>
            <button onClick={remove} aria-label="Delete section" title="Delete section">
              {BoardIcon.x}
            </button>
          </div>
        )}
      </div>
      {col.tag && <p className="col-tag">#{col.tag}</p>}

      <div className="board-cards">
        {tasks.map((t) => (
          <TaskCard key={t.docId + ':' + t.line} task={t} store={store} onToggle={() => onToggle(t)} onDelete={() => onDelete(t)} />
        ))}
        {!tasks.length && <p className="col-empty">{col.tag ? 'Drop a to-do here' : 'Nothing here'}</p>}
      </div>

      <TaskInput className="col-add" placeholder={`Add to ${col.name}…`} onAdd={(text) => onAdd(text, col.tag)} />
    </section>
  )
}

function NewSectionColumn({ store }: { store: Store }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const sections = store.state.sections ?? []
  const submit = () => {
    const n = name.trim()
    setAdding(false)
    setName('')
    if (!n || !slugify(n) || sections.some((x) => slugify(x.name) === slugify(n))) return
    store.addSection(n, COLORS[sections.length % COLORS.length])
  }
  return (
    <div className="board-col new-col">
      {adding ? (
        <input
          className="col-name-input"
          autoFocus
          placeholder="Section name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={submit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              setName('')
              setAdding(false)
            }
          }}
        />
      ) : (
        <button onClick={() => setAdding(true)}>
          {Icon.plus}
          New section
        </button>
      )}
    </div>
  )
}

function Board({
  store,
  tasks,
  onAdd,
  onToggle,
  onDelete,
}: {
  store: Store
  tasks: Task[]
  onAdd: (text: string, tag: string | null) => void
  onToggle: (t: Task) => void
  onDelete: (t: Task) => void
}) {
  const sections = store.state.sections ?? []
  const known = new Set(sections.map((s) => slugify(s.name)))
  // tags typed in notes that have no section yet still get a column
  const orphanTags = [...new Set(tasks.map((t) => t.section).filter((t): t is string => !!t && !known.has(t)))]
  const columns: Column[] = [
    { key: 'inbox', tag: null, name: 'Inbox', color: 'grey' },
    ...sections.map((s) => ({ key: s.id, tag: slugify(s.name), name: s.name, color: s.color, section: s })),
    ...orphanTags.map((t) => ({ key: 'tag:' + t, tag: t, name: t.replace(/-/g, ' '), color: 'grey' as FolderColor })),
  ]
  const inColumn = (c: Column) => tasks.filter((t) => (c.tag ? t.section === c.tag : !t.section))

  return (
    <div className="board">
      {columns.map((c, i) => (
        <BoardColumn
          key={c.key}
          col={c}
          tasks={inColumn(c)}
          store={store}
          first={i <= 1}
          last={!c.section || i === sections.length}
          onAdd={onAdd}
          onToggle={onToggle}
          onDelete={onDelete}
        />
      ))}
      <NewSectionColumn store={store} />
    </div>
  )
}

type TaskFilter = 'today' | 'open' | 'done' | 'all'

function TasksView({ store }: { store: Store }) {
  const { docs, folders } = store.state
  const [filter, setFilterState] = useState<TaskFilter>(() => {
    const f = localStorage.getItem('dok:taskFilter')
    return f === 'today' || f === 'done' || f === 'all' ? f : 'open'
  })
  const setFilter = (f: TaskFilter) => {
    setFilterState(f)
    try {
      localStorage.setItem('dok:taskFilter', f)
    } catch {
      /* ignore */
    }
  }
  const [toast, withUndo] = useDocUndo(store)
  const addRef = useRef<HTMLInputElement>(null)
  const [view, setViewState] = useState<'board' | 'list'>(() => (localStorage.getItem('dok:taskView') === 'list' ? 'list' : 'board'))
  const setView = (v: 'board' | 'list') => {
    setViewState(v)
    try {
      localStorage.setItem('dok:taskView', v)
    } catch {
      /* ignore */
    }
  }

  // ticked while on Open/Today → keep showing until the filter changes, so rows don't jump out from under the cursor
  const [lingering, setLingering] = useState<Set<string>>(new Set())
  useEffect(() => setLingering(new Set()), [filter])

  // N focuses the add box
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.metaKey || e.ctrlKey || e.altKey || el.closest('input, textarea, select, [contenteditable]')) return
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault()
        addRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // stable order (newest note first) so ticking a to-do doesn't make its note jump to the top
  const withTasks = useMemo(
    () =>
      docs
        .map((d) => ({ doc: d, tasks: parseTasks(d) }))
        .filter((x) => x.tasks.length)
        .sort((a, b) => b.doc.createdAt - a.doc.createdAt),
    [docs],
  )
  const all = withTasks.flatMap((x) => x.tasks)
  const total = all.length
  const done = all.filter((t) => t.done).length
  const isToday = (t: Task) => !t.done && !!t.due && daysUntil(t.due) <= 0
  const todayCount = all.filter(isToday).length

  // where quick-add goes: remembered choice, else the most recently edited doc with to-dos, else any doc
  const [targetId, setTargetId] = useState<string>(() => localStorage.getItem('dok:taskTarget') ?? '')
  const recentWithTasks = useMemo(() => [...withTasks].sort((a, b) => b.doc.updatedAt - a.doc.updatedAt), [withTasks])
  const target = docs.find((d) => d.id === targetId) ?? recentWithTasks[0]?.doc ?? docs[0]
  const chooseTarget = (id: string) => {
    setTargetId(id)
    try {
      localStorage.setItem('dok:taskTarget', id)
    } catch {
      /* ignore */
    }
  }

  const add = (text: string, tag?: string | null) => {
    if (!target) return
    // on Today, an undated to-do would vanish on add, so date it today
    let t = filter === 'today' && !/@\S/.test(text) ? `${text} @today` : text
    if (tag && !/(^|\s)#\S/.test(t)) t += ` #${tag}`
    store.addTask(target.id, t)
    if (filter === 'done') setFilter('open')
  }

  const key = (t: Task) => t.docId + ':' + t.line
  const toggle = (t: Task) => {
    if ((filter === 'open' || filter === 'today') && !t.done) setLingering((s) => new Set(s).add(key(t)))
    store.toggleTask(t.docId, t.line)
  }

  const visible = (t: Task) =>
    lingering.has(key(t)) ||
    (filter === 'all' ? true : filter === 'done' ? t.done : filter === 'today' ? isToday(t) : !t.done)

  const groups = withTasks.map((x) => ({ ...x, shown: x.tasks.filter(visible) })).filter((x) => x.shown.length)
  const deleteTask = (t: Task) => {
    setLingering(new Set())
    withUndo(t.docId, 'To-do deleted', () => store.editTask(t.docId, t.line, ''))
  }

  const folderOf = (id: string) => folders.find((f) => f.id === id)

  const tabs: { id: TaskFilter; label: string; n: number }[] = [
    { id: 'today', label: 'Today', n: todayCount },
    { id: 'open', label: 'Open', n: total - done },
    { id: 'done', label: 'Done', n: done },
    { id: 'all', label: 'All', n: total },
  ]

  return (
    <div className={`page tasks-page ${view === 'list' ? 'narrow' : 'wide'}`}>
      <div className="page-head tasks-head">
        <div>
          <h1>Tasks</h1>
          <p className="subhead">
            {total
              ? `${total - done} open · ${done} done${todayCount ? ` · ${todayCount} due today` : ''}`
              : 'To-dos from every note, in one place'}
          </p>
        </div>
      </div>
      {total > 0 && <Progress done={done} total={total} />}

      {docs.length > 0 && (
        <TaskInput
          className="quick-add"
          inputRef={addRef}
          onAdd={add}
          placeholder={filter === 'today' ? 'Add a to-do for today…' : 'Add a to-do…  try @tomorrow or @fri'}
        >
          <kbd className="quick-kbd">N</kbd>
          <label className="move-select" title="Add to note">
            {Icon.doc}
            <select value={target?.id} onChange={(e) => chooseTarget(e.target.value)} aria-label="Add to note">
              {recentWithTasks.length > 0 && (
                <optgroup label="Notes with to-dos">
                  {recentWithTasks.map(({ doc }) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.title || 'Untitled'}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Other notes">
                {docs
                  .filter((d) => !withTasks.some((x) => x.doc.id === d.id))
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title || 'Untitled'}
                    </option>
                  ))}
              </optgroup>
            </select>
          </label>
          <button className="btn">Add</button>
        </TaskInput>
      )}

      <div className="tasks-toolbar">
        <div className="segmented" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={filter === t.id} className={filter === t.id ? 'on' : ''} onClick={() => setFilter(t.id)}>
              {t.label}
              <span className={t.id === 'today' && t.n ? 'hot' : ''}>{t.n}</span>
            </button>
          ))}
        </div>
        <div className="segmented view-toggle" aria-label="Layout">
          {(['board', 'list'] as const).map((v) => (
            <button key={v} className={view === v ? 'on' : ''} aria-pressed={view === v} onClick={() => setView(v)}>
              {v === 'board' ? 'Board' : 'List'}
            </button>
          ))}
        </div>
      </div>

      {view === 'board' && docs.length > 0 ? (
        <Board store={store} tasks={all.filter(visible)} onAdd={add} onToggle={toggle} onDelete={deleteTask} />
      ) : groups.length === 0 ? (
        <div className="empty">
          {total === 0 ? (
            <p>
              No to-dos yet. Add one above, or type <code>- [ ]</code> in any note.
            </p>
          ) : filter === 'today' ? (
            <p>Nothing due today. Add <code>@today</code> to a to-do to plan it here.</p>
          ) : filter === 'open' ? (
            <p>All done. Nice.</p>
          ) : (
            <p>Nothing checked off yet.</p>
          )}
        </div>
      ) : (
        groups.map(({ doc, tasks, shown }) => {
          const f = folderOf(doc.folderId)
          const d = tasks.filter((t) => t.done).length
          return (
            <section key={doc.id} className="task-group">
              <div className="task-group-head">
                <a href={`#/doc/${doc.id}`}>
                  {f && <span className={`dot dot-${f.color}`} />}
                  <b>{doc.title || 'Untitled'}</b>
                  {f && <span className="task-group-folder">{f.name}</span>}
                </a>
                <span className="task-count">
                  {d}/{tasks.length}
                </span>
                {d > 0 && (
                  <button
                    className="link-btn"
                    onClick={() => withUndo(doc.id, `Cleared ${count(d, 'to-do')}`, () => store.clearDone(doc.id))}
                  >
                    Clear completed
                  </button>
                )}
              </div>
              <ul className="task-list">
                {shown.map((t) => (
                  <TaskRow
                    key={t.line}
                    task={t}
                    docs={docs}
                    onToggle={() => toggle(t)}
                    onEdit={(text) => store.editTask(doc.id, t.line, text)}
                    onDelete={() => deleteTask(t)}
                  />
                ))}
              </ul>
            </section>
          )
        })
      )}
      {toast}
    </div>
  )
}

/* ---------- new folder dialog ---------- */

function NewFolderDialog({
  store,
  defaultSpaceId,
  onClose,
}: {
  store: Store
  defaultSpaceId?: string
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState<FolderColor>('blue')
  const [spaceId, setSpaceId] = useState(defaultSpaceId ?? '')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const target = store.state.spaces.some((x) => x.id === spaceId) ? spaceId : store.addSpace('My space').id
    const f = store.addFolder(target, name.trim(), color)
    onClose()
    go(`#/folder/${f.id}`)
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="dialog" onSubmit={submit}>
        <div className="dialog-art">
          <FolderArt color={color} count={0} label={name || 'New folder'} />
        </div>
        <label>
          <span>Name</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chemistry" />
        </label>
        <label>
          <span>Space</span>
          <select value={spaceId} onChange={(e) => setSpaceId(e.target.value)}>
            {store.state.spaces.length === 0 && <option value="">My space (new)</option>}
            {store.state.spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span>Color</span>
          <div className="swatches">
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                className={`swatch dot-${c} ${color === c ? 'on' : ''}`}
                onClick={() => setColor(c)}
                aria-label={c}
              />
            ))}
          </div>
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={!name.trim()}>
            Create folder
          </button>
        </div>
      </form>
    </div>
  )
}

/* ---------- search palette (⌘K) ---------- */

type Hit =
  | { kind: 'doc'; doc: Doc; folder?: Folder; snippet: string }
  | { kind: 'folder'; folder: Folder }
  | { kind: 'space'; id: string; name: string }
  | { kind: 'create'; title: string }

function SearchPalette({ store, onClose }: { store: Store; onClose: () => void }) {
  const { docs, folders, spaces } = store.state
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const hits = useMemo<Hit[]>(() => {
    const query = q.trim().toLowerCase()
    const folderOf = (id: string) => folders.find((f) => f.id === id)
    if (!query) {
      return [...docs]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 8)
        .map((d) => ({ kind: 'doc', doc: d, folder: folderOf(d.folderId), snippet: firstLine(d.body) }))
    }
    const out: Hit[] = []
    for (const s of spaces) if (s.name.toLowerCase().includes(query)) out.push({ kind: 'space', id: s.id, name: s.name })
    for (const f of folders) if (f.name.toLowerCase().includes(query)) out.push({ kind: 'folder', folder: f })
    const scored: { d: Doc; score: number; snippet: string }[] = []
    for (const d of docs) {
      const t = d.title.toLowerCase()
      const bi = d.body.toLowerCase().indexOf(query)
      const score = t === query ? 4 : t.startsWith(query) ? 3 : t.includes(query) ? 2 : bi >= 0 ? 1 : 0
      if (!score) continue
      scored.push({ d, score, snippet: bi >= 0 ? excerpt(d.body, bi, query.length) : firstLine(d.body) })
    }
    scored.sort((a, b) => b.score - a.score || b.d.updatedAt - a.d.updatedAt)
    for (const { d, snippet } of scored.slice(0, 20)) out.push({ kind: 'doc', doc: d, folder: folderOf(d.folderId), snippet })
    if (folders.length && !docs.some((d) => d.title.trim().toLowerCase() === query)) out.push({ kind: 'create', title: q.trim() })
    return out
  }, [q, docs, folders, spaces])

  useEffect(() => setSel(0), [q])
  useEffect(() => {
    listRef.current?.querySelector('.on')?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  const open = useCallback(
    (h: Hit) => {
      onClose()
      if (h.kind === 'doc') go(`#/doc/${h.doc.id}`)
      else if (h.kind === 'folder') go(`#/folder/${h.folder.id}`)
      else if (h.kind === 'space') go(`#/space/${h.id}`)
      else {
        const target = location.hash.startsWith('#/folder/') ? location.hash.split('/')[2] : undefined
        const folderId = folders.some((f) => f.id === target) ? target! : folders[0].id
        const d = store.addDoc(folderId, h.title)
        go(`#/doc/${d.id}`)
      }
    },
    [onClose, folders, store],
  )

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSel((s) => Math.min(hits.length - 1, s + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSel((s) => Math.max(0, s - 1))
    } else if (e.key === 'Enter' && hits[sel]) {
      e.preventDefault()
      open(hits[sel])
    } else if (e.key === 'Escape') onClose()
  }

  return (
    <div className="dialog-backdrop top" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-label="Search">
        <div className="palette-input">
          {Icon.search}
          <input autoFocus placeholder="Search notes, folders, spaces…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} />
          <kbd>esc</kbd>
        </div>
        <div className="palette-list" ref={listRef}>
          {!q.trim() && hits.length > 0 && <h5>Recent</h5>}
          {hits.length === 0 && <p className="palette-empty">{q.trim() ? 'Nothing matches.' : 'No notes yet.'}</p>}
          {hits.map((h, i) => (
            <button
              key={h.kind + (h.kind === 'doc' ? h.doc.id : h.kind === 'folder' ? h.folder.id : h.kind === 'space' ? h.id : 'new')}
              className={`palette-row ${i === sel ? 'on' : ''}`}
              onMouseMove={() => setSel(i)}
              onClick={() => open(h)}
            >
              {h.kind === 'doc' && (
                <>
                  <span className="doc-icon">{Icon.doc}</span>
                  <span className="doc-text">
                    <b>{h.doc.title || 'Untitled'}</b>
                    <span>{h.snippet || 'No content yet'}</span>
                  </span>
                  {h.folder && (
                    <span className="palette-tag">
                      <span className={`dot dot-${h.folder.color}`} />
                      {h.folder.name}
                    </span>
                  )}
                </>
              )}
              {h.kind === 'folder' && (
                <>
                  <span className="doc-icon">
                    <span className={`dot dot-${h.folder.color}`} />
                  </span>
                  <span className="doc-text">
                    <b>{h.folder.name}</b>
                    <span>Folder</span>
                  </span>
                </>
              )}
              {h.kind === 'space' && (
                <>
                  <span className="doc-icon">{Icon.folder}</span>
                  <span className="doc-text">
                    <b>{h.name}</b>
                    <span>Space</span>
                  </span>
                </>
              )}
              {h.kind === 'create' && (
                <>
                  <span className="doc-icon">{Icon.plus}</span>
                  <span className="doc-text">
                    <b>Create “{h.title}”</b>
                    <span>New note</span>
                  </span>
                </>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function firstLine(body: string) {
  return body.split('\n').find((l) => l.trim()) ?? ''
}

function excerpt(body: string, at: number, len: number) {
  const start = Math.max(0, at - 30)
  const s = body.slice(start, at + len + 60).replace(/\s+/g, ' ')
  return (start > 0 ? '…' : '') + s
}

/* ---------- settings & data ---------- */

function SettingsDialog({ store, onClose }: { store: Store; onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const { spaces, folders, docs } = store.state

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(store.state, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `doku-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    setMsg('Backup downloaded.')
  }

  const importJson = async (file: File) => {
    try {
      const next = sanitize(JSON.parse(await file.text()))
      if (!next) throw new Error('bad')
      if (!confirm(`Replace everything with this backup (${count(next.docs.length, 'document')})?`)) return
      store.replaceAll(next)
      setMsg(`Imported ${count(next.folders.length, 'folder')} and ${count(next.docs.length, 'document')}.`)
      go('#/')
    } catch {
      setMsg('That file isn’t a Doku backup.')
    }
  }

  const resetDemo = () => {
    if (!confirm('Replace everything with the demo notes? Your current notes will be lost.')) return
    store.replaceAll(demoState())
    setMsg('Demo notes restored.')
    go('#/')
  }

  const eraseAll = () => {
    if (!confirm('Delete every space, folder and document? This can’t be undone.')) return
    store.replaceAll({ spaces: [{ id: 's-' + Date.now().toString(36), name: 'My space' }], folders: [], docs: [] })
    setMsg('Everything erased.')
    go('#/')
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog settings" role="dialog" aria-label="Settings">
        <h2>Settings & data</h2>
        <p className="settings-sub">
          Notes are stored in this browser only: {count(spaces.length, 'space')}, {count(folders.length, 'folder')},{' '}
          {count(docs.length, 'document')}.
        </p>
        <div className="settings-list">
          <button onClick={exportJson}>
            <b>Export backup</b>
            <span>Download everything as a JSON file</span>
          </button>
          <button onClick={() => fileRef.current?.click()}>
            <b>Import backup</b>
            <span>Restore from a Doku JSON file</span>
          </button>
          <button onClick={resetDemo}>
            <b>Restore demo notes</b>
            <span>Start over with the sample content</span>
          </button>
          <button className="danger" onClick={eraseAll}>
            <b>Erase everything</b>
            <span>Delete all spaces, folders and documents</span>
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) importJson(f)
            e.target.value = ''
          }}
        />
        {msg && <p className="settings-msg">{msg}</p>}
        <div className="dialog-actions">
          <button className="btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
