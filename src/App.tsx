import { useEffect, useMemo, useRef, useState } from 'react'
import { FolderArt, Logo, COLORS } from './FolderArt'
import { GraphView } from './Graph'
import { docLinks, groupByDate, linkTitles, relativeTime, useStore, type Folder, type FolderColor, type Store } from './store'

/* ---------- tiny hash router ---------- */

type Route =
  | { view: 'home' }
  | { view: 'graph' }
  | { view: 'space'; id: string }
  | { view: 'folder'; id: string }
  | { view: 'doc'; id: string }

function parse(hash: string): Route {
  const [, view, id] = hash.replace(/^#/, '').split('/')
  if (view === 'graph') return { view: 'graph' }
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

  useEffect(() => setNavOpen(false), [route])

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
      <Sidebar store={store} route={route} activeSpaceId={space?.id} />
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
            {doc && (
              <>
                <span>/</span>
                <b>{doc.title || 'Untitled'}</b>
              </>
            )}
          </nav>
        </header>

        <div className="content">
          {route.view === 'graph' && <GraphView state={store.state} />}
          {route.view === 'home' && <Home store={store} onNewFolder={(spaceId) => setCreating({ spaceId })} />}
          {route.view === 'space' &&
            (space ? (
              <SpaceView store={store} spaceId={space.id} onNewFolder={() => setCreating({ spaceId: space.id })} />
            ) : (
              <Empty />
            ))}
          {route.view === 'folder' && (folder ? <FolderView store={store} folder={folder} /> : <Empty />)}
          {route.view === 'doc' && (doc ? <DocView store={store} docId={doc.id} /> : <Empty />)}
        </div>
      </main>

      {creating && (
        <NewFolderDialog
          store={store}
          defaultSpaceId={creating.spaceId ?? spaces[0]?.id}
          onClose={() => setCreating(null)}
        />
      )}
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

function Sidebar({ store, route, activeSpaceId }: { store: Store; route: Route; activeSpaceId?: string }) {
  const { spaces, folders } = store.state
  const [favOpen, setFavOpen] = useState(true)
  const [addingSpace, setAddingSpace] = useState(false)
  const [spaceName, setSpaceName] = useState('')
  const favorites = folders.filter((f) => f.favorite)

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
        <a className={`nav-item ${route.view === 'graph' ? 'active' : ''}`} href="#/graph">
          {Icon.graph}
          <span>Graph</span>
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
          <span>Personal</span>
        </div>
        <button className="icon-btn sm" aria-label="Settings">
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
      <FolderGrid store={store} list={folders} onNew={newFolder} />
    </div>
  )
}

function SpaceView({ store, spaceId, onNewFolder }: { store: Store; spaceId: string; onNewFolder: () => void }) {
  const space = store.state.spaces.find((s) => s.id === spaceId)!
  const list = store.state.folders.filter((f) => f.spaceId === spaceId)
  const docCount = store.state.docs.filter((d) => list.some((f) => f.id === d.folderId)).length
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{space.name}</h1>
          <p className="subhead">
            {count(list.length, 'folder')} · {count(docCount, 'document')}
          </p>
        </div>
        <button className="btn" onClick={onNewFolder}>
          {Icon.plus} New folder
        </button>
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
    if (confirm(`Delete “${folder.name}” and its ${docs.length} documents?`)) {
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
  const doc = store.state.docs.find((d) => d.id === docId)!
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)

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

  const remove = () => {
    if (confirm('Delete this document?')) {
      store.deleteDoc(doc.id)
      go(`#/folder/${doc.folderId}`)
    }
  }

  return (
    <article className="page doc-page">
      <div className="doc-meta">
        <span>Edited {relativeTime(doc.updatedAt)}</span>
        <button className="icon-btn" onClick={remove} aria-label="Delete document" title="Delete document">
          {Icon.trash}
        </button>
      </div>
      <input
        className="doc-title"
        placeholder="Untitled"
        value={doc.title}
        ref={titleRef}
        onChange={(e) => store.updateDoc(doc.id, { title: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            bodyRef.current?.focus()
          }
        }}
      />
      <textarea
        ref={bodyRef}
        className="doc-body"
        placeholder="Start writing… link other notes with [[Note title]]"
        value={doc.body}
        onChange={(e) => store.updateDoc(doc.id, { body: e.target.value })}
      />
      <Connections store={store} docId={doc.id} />
    </article>
  )
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
    const d = store.addDoc(doc.folderId)
    store.updateDoc(d.id, { title })
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
    if (!name.trim() || !spaceId) return
    const f = store.addFolder(spaceId, name.trim(), color)
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
