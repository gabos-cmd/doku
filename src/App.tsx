import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FolderArt, Logo, COLORS } from './FolderArt'
import { GraphView } from './Graph'
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
  | { view: 'space'; id: string }
  | { view: 'folder'; id: string }
  | { view: 'doc'; id: string }

function parse(hash: string): Route {
  const [, view, id] = hash.replace(/^#/, '').split('/')
  if (view === 'graph') return { view: 'graph' }
  if (view === 'tasks') return { view: 'tasks' }
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

        <div className="content">
          {route.view === 'graph' && <GraphView state={store.state} />}
          {route.view === 'tasks' && <TasksView store={store} />}
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

/** Clickable checklist under the editor, so to-dos can be ticked without touching the markdown. */
function DocTasks({ store, doc }: { store: Store; doc: Doc }) {
  const tasks = parseTasks(doc)
  if (!tasks.length) return null
  const done = tasks.filter((t) => t.done).length
  return (
    <section className="doc-tasks">
      <div className="doc-tasks-head">
        <h4>
          To-dos <span>{done}/{tasks.length}</span>
        </h4>
        {done > 0 && (
          <button className="link-btn" onClick={() => store.clearDone(doc.id)}>
            Clear completed
          </button>
        )}
      </div>
      <Progress done={done} total={tasks.length} />
      <ul className="task-list">
        {tasks.map((t) => (
          <li key={t.line} className={t.done ? 'done' : ''}>
            <Checkbox done={t.done} onToggle={() => store.toggleTask(doc.id, t.line)} label={t.text || 'Empty to-do'} />
            <span className="task-text">{t.text ? <TaskText text={t.text} docs={store.state.docs} /> : <i>Empty to-do</i>}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

type TaskFilter = 'open' | 'done' | 'all'

function TasksView({ store }: { store: Store }) {
  const { docs, folders } = store.state
  const [filter, setFilter] = useState<TaskFilter>('open')
  const [draft, setDraft] = useState('')
  // ticked while on "Open" → keep showing until the filter changes, so rows don't jump out from under the cursor
  const [lingering, setLingering] = useState<Set<string>>(new Set())
  useEffect(() => setLingering(new Set()), [filter])

  const withTasks = useMemo(
    () =>
      docs
        .map((d) => ({ doc: d, tasks: parseTasks(d) }))
        .filter((x) => x.tasks.length)
        .sort((a, b) => b.doc.updatedAt - a.doc.updatedAt),
    [docs],
  )
  const total = withTasks.reduce((n, x) => n + x.tasks.length, 0)
  const done = withTasks.reduce((n, x) => n + x.tasks.filter((t) => t.done).length, 0)

  // where quick-add goes: remembered choice, else the most recently edited doc with to-dos, else any doc
  const [targetId, setTargetId] = useState<string>(() => localStorage.getItem('dok:taskTarget') ?? '')
  const target = docs.find((d) => d.id === targetId) ?? withTasks[0]?.doc ?? docs[0]
  const chooseTarget = (id: string) => {
    setTargetId(id)
    try {
      localStorage.setItem('dok:taskTarget', id)
    } catch {
      /* ignore */
    }
  }

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    if (!target || !draft.trim()) return
    store.addTask(target.id, draft)
    setDraft('')
    if (filter === 'done') setFilter('open')
  }

  const key = (docId: string, line: number) => docId + ':' + line
  const toggle = (docId: string, line: number, wasDone: boolean) => {
    if (filter === 'open' && !wasDone) setLingering((s) => new Set(s).add(key(docId, line)))
    store.toggleTask(docId, line)
  }

  const groups = withTasks
    .map((x) => ({
      ...x,
      shown: x.tasks.filter((t) =>
        filter === 'all' ? true : filter === 'done' ? t.done : !t.done || lingering.has(key(t.docId, t.line)),
      ),
    }))
    .filter((x) => x.shown.length)

  const folderOf = (id: string) => folders.find((f) => f.id === id)

  return (
    <div className="page narrow">
      <div className="page-head tasks-head">
        <div>
          <h1>Tasks</h1>
          <p className="subhead">
            {total ? `${total - done} open · ${done} done` : 'To-dos from every note, in one place'}
          </p>
        </div>
      </div>
      {total > 0 && <Progress done={done} total={total} />}

      {docs.length > 0 && (
        <form className="quick-add" onSubmit={add}>
          <span className="checkbox ghost" aria-hidden />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a to-do…"
            aria-label="New to-do"
          />
          <label className="move-select" title="Add to note">
            {Icon.doc}
            <select value={target?.id} onChange={(e) => chooseTarget(e.target.value)} aria-label="Add to note">
              {withTasks.length > 0 && (
                <optgroup label="Notes with to-dos">
                  {withTasks.map(({ doc }) => (
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
          <button className="btn" disabled={!draft.trim()}>
            Add
          </button>
        </form>
      )}

      <div className="segmented" role="tablist">
        {(['open', 'done', 'all'] as const).map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
            {f === 'open' ? `Open ${total - done}` : f === 'done' ? `Done ${done}` : `All ${total}`}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <div className="empty">
          {total === 0 ? (
            <p>
              No to-dos yet. Add one above, or type <code>- [ ]</code> in any note.
            </p>
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
                {filter !== 'open' && d > 0 && (
                  <button className="link-btn" onClick={() => store.clearDone(doc.id)}>
                    Clear completed
                  </button>
                )}
              </div>
              <ul className="task-list">
                {shown.map((t) => (
                  <li key={t.line} className={t.done ? 'done' : ''}>
                    <Checkbox done={t.done} onToggle={() => toggle(doc.id, t.line, t.done)} label={t.text || 'Empty to-do'} />
                    <span className="task-text">{t.text ? <TaskText text={t.text} docs={docs} /> : <i>Empty to-do</i>}</span>
                  </li>
                ))}
              </ul>
            </section>
          )
        })
      )}
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
