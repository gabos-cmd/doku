import { useCallback, useEffect, useState } from 'react'

export type FolderColor = 'blue' | 'yellow' | 'lavender' | 'green' | 'pink' | 'grey' | 'orange'

export interface Space {
  id: string
  name: string
}

export interface Folder {
  id: string
  spaceId: string
  name: string
  color: FolderColor
  favorite: boolean
  createdAt: number
}

export interface Doc {
  id: string
  folderId: string
  title: string
  body: string
  createdAt: number
  updatedAt: number
}

export interface State {
  spaces: Space[]
  folders: Folder[]
  docs: Doc[]
}

const KEY = 'dok:v1'

export const uid = () => Math.random().toString(36).slice(2, 10)

const DAY = 86_400_000

function seed(): State {
  const now = Date.now()
  const spaces: Space[] = [
    { id: 's-school', name: 'School' },
    { id: 's-learning', name: 'Learning' },
    { id: 's-personal', name: 'Personal' },
  ]
  const folders: Folder[] = [
    { id: 'f-math', spaceId: 's-school', name: 'Mathematics', color: 'blue', favorite: true, createdAt: now },
    { id: 'f-history', spaceId: 's-school', name: 'History', color: 'yellow', favorite: false, createdAt: now },
    { id: 'f-bio', spaceId: 's-school', name: 'Biology', color: 'green', favorite: false, createdAt: now },
    { id: 'f-spanish', spaceId: 's-school', name: 'Spanish', color: 'lavender', favorite: false, createdAt: now },
    { id: 'f-design', spaceId: 's-learning', name: 'Design', color: 'pink', favorite: true, createdAt: now },
    { id: 'f-code', spaceId: 's-learning', name: 'Programming', color: 'grey', favorite: false, createdAt: now },
    { id: 'f-journal', spaceId: 's-personal', name: 'Journal', color: 'orange', favorite: false, createdAt: now },
    { id: 'f-ideas', spaceId: 's-personal', name: 'Ideas', color: 'grey', favorite: false, createdAt: now },
  ]
  const d = (folderId: string, title: string, body: string, ago: number): Doc => ({
    id: uid(), folderId, title, body, createdAt: now - ago, updatedAt: now - ago,
  })
  const docs: Doc[] = [
    d('f-math', 'Derivatives — chain rule', 'If y = f(g(x)), then dy/dx = f\'(g(x)) · g\'(x).\n\nBuilds on [[Limits recap]]. Practice: differentiate sin(x²).', 2 * 3_600_000),
    d('f-math', 'Limits recap', 'A limit describes the value a function approaches as the input approaches some value.', DAY + 3_600_000),
    d('f-math', 'Integration by parts', '∫u dv = uv − ∫v du\n\nThe reverse of the product rule — see [[Derivatives — chain rule]].', 3 * DAY),
    d('f-math', 'Exam prep checklist', 'Chapters 3–6. Past papers 2023, 2024.\n\nReview [[Integration by parts]] and [[Vectors intro]].', 12 * DAY),
    d('f-math', 'Vectors intro', 'Magnitude, direction, dot product.', 40 * DAY),
    d('f-history', 'The Industrial Revolution', 'Began in Britain around 1760.', 5 * 3_600_000),
    d('f-history', 'Cold War timeline', '1947 — Truman Doctrine\n1961 — Berlin Wall', 6 * DAY),
    d('f-bio', 'Cell structure', 'Nucleus, mitochondria, ribosomes.', 2 * DAY),
    d('f-spanish', 'Irregular verbs', 'ser, ir, tener, hacer…', 30 * 60_000),
    d('f-design', 'Typography notes', 'Pair a serif display face with a neutral sans for UI.', DAY),
    d('f-code', 'Git cheatsheet', 'git switch -c feature\ngit rebase main', 9 * DAY),
    d('f-journal', 'Sunday', 'Long walk, good coffee.', 2 * DAY),
    d('f-ideas', 'Dok roadmap', 'To-do blocks, images, nested folders.\n\nType inspiration: [[Typography notes]].', 60 * 60_000),
  ]
  return { spaces, folders, docs }
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as State
  } catch {
    /* ignore */
  }
  return seed()
}

export function useStore() {
  const [state, setState] = useState<State>(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* ignore */
    }
  }, [state])

  const addSpace = useCallback((name: string) => {
    const space = { id: uid(), name }
    setState((s) => ({ ...s, spaces: [...s.spaces, space] }))
    return space
  }, [])

  const addFolder = useCallback((spaceId: string, name: string, color: FolderColor) => {
    const folder: Folder = { id: uid(), spaceId, name, color, favorite: false, createdAt: Date.now() }
    setState((s) => ({ ...s, folders: [...s.folders, folder] }))
    return folder
  }, [])

  const updateFolder = useCallback((id: string, patch: Partial<Folder>) => {
    setState((s) => ({ ...s, folders: s.folders.map((f) => (f.id === id ? { ...f, ...patch } : f)) }))
  }, [])

  const deleteFolder = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      folders: s.folders.filter((f) => f.id !== id),
      docs: s.docs.filter((d) => d.folderId !== id),
    }))
  }, [])

  const addDoc = useCallback((folderId: string) => {
    const now = Date.now()
    const doc: Doc = { id: uid(), folderId, title: '', body: '', createdAt: now, updatedAt: now }
    setState((s) => ({ ...s, docs: [doc, ...s.docs] }))
    return doc
  }, [])

  const updateDoc = useCallback((id: string, patch: Partial<Doc>) => {
    setState((s) => ({
      ...s,
      docs: s.docs.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: Date.now() } : d)),
    }))
  }, [])

  const deleteDoc = useCallback((id: string) => {
    setState((s) => ({ ...s, docs: s.docs.filter((d) => d.id !== id) }))
  }, [])

  return { state, addSpace, addFolder, updateFolder, deleteFolder, addDoc, updateDoc, deleteDoc }
}

export type Store = ReturnType<typeof useStore>

/* ---------- date helpers ---------- */

export function groupByDate(docs: Doc[]): { label: string; docs: Doc[] }[] {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const t = startOfToday.getTime()
  const groups = new Map<string, Doc[]>()
  const sorted = [...docs].sort((a, b) => b.updatedAt - a.updatedAt)
  for (const doc of sorted) {
    let label: string
    if (doc.updatedAt >= t) label = 'Today'
    else if (doc.updatedAt >= t - DAY) label = 'Yesterday'
    else if (doc.updatedAt >= t - 7 * DAY) label = 'Previous 7 days'
    else if (doc.updatedAt >= t - 30 * DAY) label = 'Previous 30 days'
    else
      label = new Date(doc.updatedAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(doc)
  }
  return [...groups].map(([label, docs]) => ({ label, docs }))
}

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < DAY) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/* ---------- [[wiki links]] ---------- */

const LINK_RE = /\[\[([^\[\]\n]+?)\]\]/g

/** Titles referenced with [[Title]] in a body. */
export function linkTitles(body: string): string[] {
  return [...body.matchAll(LINK_RE)].map((m) => m[1].trim()).filter(Boolean)
}

/** Resolve every [[link]] to a doc id: returns [fromId, toId] pairs (deduped, no self-links). */
export function docLinks(docs: Doc[]): [string, string][] {
  const byTitle = new Map<string, string>()
  for (const d of docs) if (d.title.trim()) byTitle.set(d.title.trim().toLowerCase(), d.id)
  const seen = new Set<string>()
  const out: [string, string][] = []
  for (const d of docs) {
    for (const t of linkTitles(d.body)) {
      const to = byTitle.get(t.toLowerCase())
      if (!to || to === d.id) continue
      const key = d.id + '>' + to
      if (seen.has(key)) continue
      seen.add(key)
      out.push([d.id, to])
    }
  }
  return out
}
