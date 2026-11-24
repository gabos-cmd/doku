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

/** A column on the Tasks board. To-dos join it with a `#tag` (the slugified name) on their line. */
export interface Section {
  id: string
  name: string
  color: FolderColor
}

export interface State {
  spaces: Space[]
  folders: Folder[]
  docs: Doc[]
  sections?: Section[]
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
    id: uid(), folderId, title, body: normalizeDates(body), createdAt: now - ago, updatedAt: now - ago,
  })
  const docs: Doc[] = [
    d('f-math', 'Derivatives — chain rule', 'If y = f(g(x)), then dy/dx = f\'(g(x)) · g\'(x).\n\nBuilds on [[Limits recap]]. Practice: differentiate sin(x²).', 2 * 3_600_000),
    d('f-math', 'Limits recap', 'A limit describes the value a function approaches as the input approaches some value.', DAY + 3_600_000),
    d('f-math', 'Integration by parts', '∫u dv = uv − ∫v du\n\nThe reverse of the product rule — see [[Derivatives — chain rule]].', 3 * DAY),
    d('f-math', 'Exam prep checklist', 'Chapters 3–6. Past papers 2023, 2024.\n\n- [x] Past paper 2023\n- [ ] Past paper 2024 @tomorrow #study\n- [ ] Review [[Integration by parts]] #study\n- [ ] Review [[Vectors intro]]', 12 * DAY),
    d('f-math', 'Vectors intro', 'Magnitude, direction, dot product.', 40 * DAY),
    d('f-history', 'The Industrial Revolution', 'Began in Britain around 1760.', 5 * 3_600_000),
    d('f-history', 'Cold War timeline', '1947 — Truman Doctrine\n1961 — Berlin Wall', 6 * DAY),
    d('f-bio', 'Cell structure', 'Nucleus, mitochondria, ribosomes.', 2 * DAY),
    d('f-spanish', 'Irregular verbs', 'ser, ir, tener, hacer…', 30 * 60_000),
    d('f-design', 'Typography notes', 'Pair a serif display face with a neutral sans for UI.', DAY),
    d('f-code', 'Git cheatsheet', 'git switch -c feature\ngit rebase main', 9 * DAY),
    d('f-journal', 'Sunday', 'Long walk, good coffee.', 2 * DAY),
    d('f-ideas', 'Dok roadmap', '- [x] To-do blocks\n- [ ] Images\n- [ ] Nested folders #someday\n\nType inspiration: [[Typography notes]].', 60 * 60_000),
    d('f-journal', 'This week', '- [ ] Call grandma\n- [ ] Library books due @today #errands\n- [x] Buy running shoes #errands', 4 * 3_600_000),
  ]
  const sections: Section[] = [
    { id: 'sec-study', name: 'Study', color: 'blue' },
    { id: 'sec-errands', name: 'Errands', color: 'orange' },
    { id: 'sec-someday', name: 'Someday', color: 'lavender' },
  ]
  return { spaces, folders, docs, sections }
}

/** Accepts anything parsed from JSON and returns a valid State, or null. */
export function sanitize(raw: unknown): State | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<State>
  if (!Array.isArray(r.spaces) || !Array.isArray(r.folders) || !Array.isArray(r.docs)) return null
  const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d)
  const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : Date.now())
  const colors: FolderColor[] = ['blue', 'yellow', 'lavender', 'green', 'pink', 'grey', 'orange']
  const spaces = r.spaces.filter((s) => s && typeof s.id === 'string').map((s) => ({ id: s.id, name: str(s.name, 'Space') }))
  const folders = r.folders
    .filter((f) => f && typeof f.id === 'string')
    .map((f) => ({
      id: f.id,
      spaceId: str(f.spaceId),
      name: str(f.name, 'Folder'),
      color: colors.includes(f.color) ? f.color : 'grey',
      favorite: !!f.favorite,
      createdAt: num(f.createdAt),
    }))
  const docs = r.docs
    .filter((d) => d && typeof d.id === 'string')
    .map((d) => ({
      id: d.id,
      folderId: str(d.folderId),
      title: str(d.title),
      body: str(d.body),
      createdAt: num(d.createdAt),
      updatedAt: num(d.updatedAt),
    }))
  const sections = (Array.isArray(r.sections) ? r.sections : [])
    .filter((x) => x && typeof x.id === 'string')
    .map((x) => ({ id: x.id, name: str(x.name, 'Section'), color: colors.includes(x.color) ? x.color : 'grey' }))
  return { spaces, folders, docs, sections }
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return sanitize(JSON.parse(raw)) ?? seed()
  } catch {
    /* ignore */
  }
  return seed()
}

export const demoState = seed

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

  const updateSpace = useCallback((id: string, patch: Partial<Space>) => {
    setState((s) => ({ ...s, spaces: s.spaces.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
  }, [])

  const deleteSpace = useCallback((id: string) => {
    setState((s) => {
      const gone = new Set(s.folders.filter((f) => f.spaceId === id).map((f) => f.id))
      return {
        spaces: s.spaces.filter((x) => x.id !== id),
        folders: s.folders.filter((f) => !gone.has(f.id)),
        docs: s.docs.filter((d) => !gone.has(d.folderId)),
      }
    })
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

  const addDoc = useCallback((folderId: string, title = '', body = '') => {
    const now = Date.now()
    const doc: Doc = { id: uid(), folderId, title, body, createdAt: now, updatedAt: now }
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

  /** After a doc's title changes from `from` to `to`, rewrite every [[from]] reference so links keep working. */
  const relink = useCallback((docId: string, from: string, to: string) => {
    const a = from.trim()
    const b = to.trim()
    if (!a || !b || a === b) return
    setState((s) => {
      // another note still owns the old title → those links are not ours to move
      if (s.docs.some((d) => d.id !== docId && d.title.trim().toLowerCase() === a.toLowerCase())) return s
      const re = new RegExp(`\\[\\[\\s*${escapeRe(a)}\\s*\\]\\]`, 'gi')
      let changed = false
      const docs = s.docs.map((d) => {
        const body = d.body.replace(re, `[[${b}]]`)
        if (body === d.body) return d
        changed = true
        return { ...d, body }
      })
      return changed ? { ...s, docs } : s
    })
  }, [])

  /** Flip the checkbox on line `line` of a doc's body. */
  const toggleTask = useCallback((docId: string, line: number) => {
    setState((s) => ({
      ...s,
      docs: s.docs.map((d) => {
        if (d.id !== docId) return d
        const lines = d.body.split('\n')
        const m = TASK_RE.exec(lines[line] ?? '')
        if (!m) return d
        lines[line] = m[1] + (m[2] === ' ' ? 'x' : ' ') + m[3]
        return { ...d, body: lines.join('\n'), updatedAt: Date.now() }
      }),
    }))
  }, [])

  /** Append a new open to-do to the end of a doc's body. */
  const addTask = useCallback((docId: string, text: string) => {
    const t = text.trim()
    if (!t) return
    setState((s) => ({
      ...s,
      docs: s.docs.map((d) => {
        if (d.id !== docId) return d
        const body = d.body.replace(/\s+$/, '')
        const lastIsTask = TASK_RE.test(body.split('\n').pop() ?? '')
        const sep = !body ? '' : lastIsTask ? '\n' : '\n\n'
        return { ...d, body: `${body}${sep}- [ ] ${normalizeDates(t)}`, updatedAt: Date.now() }
      }),
    }))
  }, [])

  /** Rewrite a to-do's text (keeps its checkbox); empty text deletes the line. */
  const editTask = useCallback((docId: string, line: number, text: string) => {
    setState((s) => ({
      ...s,
      docs: s.docs.map((d) => {
        if (d.id !== docId) return d
        const lines = d.body.split('\n')
        const m = TASK_RE.exec(lines[line] ?? '')
        if (!m) return d
        const t = normalizeDates(text.trim())
        if (t) lines[line] = `${m[1]}${m[2]}] ${t}`
        else lines.splice(line, 1)
        const body = lines.join('\n')
        return body === d.body ? d : { ...d, body, updatedAt: Date.now() }
      }),
    }))
  }, [])

  /** Put a to-do in a section (or back in Inbox with null) by rewriting its #tag. */
  const setTaskSection = useCallback((docId: string, line: number, tag: string | null) => {
    setState((s) => ({
      ...s,
      docs: s.docs.map((d) => {
        if (d.id !== docId) return d
        const lines = d.body.split('\n')
        const m = TASK_RE.exec(lines[line] ?? '')
        if (!m) return d
        const text = stripTag(m[3].slice(1))
        lines[line] = `${m[1]}${m[2]}] ${text}${tag ? ` #${tag}` : ''}`
        const body = lines.join('\n')
        return body === d.body ? d : { ...d, body, updatedAt: Date.now() }
      }),
    }))
  }, [])

  const addSection = useCallback((name: string, color: FolderColor) => {
    const section: Section = { id: uid(), name: name.trim(), color }
    setState((s) => ({ ...s, sections: [...(s.sections ?? []), section] }))
    return section
  }, [])

  /** Rename (and re-tag every to-do in it), recolor, or reorder a section. */
  const updateSection = useCallback((id: string, patch: Partial<Section>) => {
    setState((s) => {
      const list = s.sections ?? []
      const old = list.find((x) => x.id === id)
      if (!old) return s
      const next = { ...old, ...patch }
      const from = slugify(old.name)
      const to = slugify(next.name)
      const docs = from && to && from !== to ? retag(s.docs, from, to) : s.docs
      return { ...s, docs, sections: list.map((x) => (x.id === id ? next : x)) }
    })
  }, [])

  const moveSection = useCallback((id: string, dir: -1 | 1) => {
    setState((s) => {
      const list = [...(s.sections ?? [])]
      const i = list.findIndex((x) => x.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= list.length) return s
      ;[list[i], list[j]] = [list[j], list[i]]
      return { ...s, sections: list }
    })
  }, [])

  /** Remove a section; its to-dos lose the tag and land back in Inbox. */
  const deleteSection = useCallback((id: string) => {
    setState((s) => {
      const sec = (s.sections ?? []).find((x) => x.id === id)
      if (!sec) return s
      return { ...s, docs: retag(s.docs, slugify(sec.name), null), sections: (s.sections ?? []).filter((x) => x.id !== id) }
    })
  }, [])

  /** Remove every checked to-do line from a doc. */
  const clearDone = useCallback((docId: string) => {
    setState((s) => ({
      ...s,
      docs: s.docs.map((d) => {
        if (d.id !== docId) return d
        const body = d.body
          .split('\n')
          .filter((l) => !(TASK_RE.exec(l)?.[2] ?? ' ').trim())
          .join('\n')
        return body === d.body ? d : { ...d, body, updatedAt: Date.now() }
      }),
    }))
  }, [])

  const replaceAll = useCallback((next: State) => setState(next), [])

  return {
    state,
    addSpace,
    updateSpace,
    deleteSpace,
    addFolder,
    updateFolder,
    deleteFolder,
    addDoc,
    updateDoc,
    relink,
    deleteDoc,
    toggleTask,
    addTask,
    clearDone,
    editTask,
    setTaskSection,
    addSection,
    updateSection,
    moveSection,
    deleteSection,
    replaceAll,
  }
}

export type Store = ReturnType<typeof useStore>

const escapeRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

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

/* ---------- to-dos: `- [ ] task` lines inside a doc ---------- */

/** groups: 1 = prefix up to the box's inner char, 2 = ' ' or 'x', 3 = '] ' + text */
export const TASK_RE = /^(\s*[-*+]\s+\[)([ xX])(\]\s.*|\])$/

export interface Task {
  docId: string
  line: number
  /** raw text, as written (including any @date) */
  raw: string
  /** text with the @date taken out */
  text: string
  done: boolean
  /** YYYY-MM-DD */
  due?: string
  /** section tag (slug), without the # */
  section?: string
}

export function parseTasks(doc: Doc): Task[] {
  const out: Task[] = []
  doc.body.split('\n').forEach((l, i) => {
    const m = TASK_RE.exec(l)
    if (!m) return
    const raw = m[3].slice(1).trim()
    const dm = DUE_RE.exec(raw)
    const tm = TAG_RE.exec(raw)
    let text = raw
    if (dm) text = text.replace(dm[0], dm[1])
    if (tm) text = text.replace(TAG_RE, '$1')
    text = text.replace(/\s{2,}/g, ' ').trim()
    out.push({ docId: doc.id, line: i, raw, text, done: m[2] !== ' ', due: dm?.[2], section: tm?.[2].toLowerCase() })
  })
  return out
}

export function taskStats(doc: Doc) {
  const t = parseTasks(doc)
  return { total: t.length, done: t.filter((x) => x.done).length }
}

/* ---------- due dates: `@2026-12-05`, typed as @today / @tomorrow / @fri ---------- */

const DUE_RE = /(^|\s)@(\d{4}-\d{2}-\d{2})(?=\s|$)/

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const todayIso = () => iso(new Date())

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const FULL_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/** Turn @today, @tomorrow/@tmr, @mon…@sun (next one) and @nextweek into @YYYY-MM-DD. */
export function normalizeDates(text: string): string {
  return text.replace(/(^|\s)@([a-z]+)(?=\s|$)/gi, (all, pre: string, word: string) => {
    const w = word.toLowerCase()
    const d = new Date()
    d.setHours(12, 0, 0, 0)
    if (w === 'today' || w === 'tod') {
      /* today */
    } else if (w === 'tomorrow' || w === 'tmr' || w === 'tom') d.setDate(d.getDate() + 1)
    else if (w === 'nextweek') d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7))
    else {
      const i = WEEKDAYS.findIndex((x, k) => w === x || w === FULL_DAYS[k])
      if (i < 0) return all
      d.setDate(d.getDate() + ((i - d.getDay() + 7) % 7 || 7))
    }
    return `${pre}@${iso(d)}`
  })
}

/** Days from today to `due` (negative = overdue). */
export function daysUntil(due: string): number {
  const [y, m, d] = due.split('-').map(Number)
  const a = new Date(y, m - 1, d).getTime()
  const t = new Date()
  t.setHours(0, 0, 0, 0)
  return Math.round((a - t.getTime()) / DAY)
}

export function dueLabel(due: string): string {
  const n = daysUntil(due)
  if (n === 0) return 'Today'
  if (n === 1) return 'Tomorrow'
  if (n === -1) return 'Yesterday'
  const [y, m, d] = due.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  if (n > 1 && n < 7) return date.toLocaleDateString(undefined, { weekday: 'long' })
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(y !== new Date().getFullYear() ? { year: 'numeric' } : {}) })
}

/* ---------- sections: `#tag` on a to-do line ---------- */

const TAG_RE = /(^|\s)#([a-z0-9][\w-]*)(?=\s|$)/i

export const slugify = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')

/** Task text with its first #tag removed. */
function stripTag(text: string) {
  return text.replace(TAG_RE, '$1').replace(/\s{2,}/g, ' ').trim()
}

/** Swap section tag `from` for `to` (or drop it) on every to-do line. */
function retag(docs: Doc[], from: string, to: string | null): Doc[] {
  return docs.map((d) => {
    let changed = false
    const lines = d.body.split('\n').map((l) => {
      const m = TASK_RE.exec(l)
      if (!m) return l
      const t = TAG_RE.exec(m[3])
      if (!t || t[2].toLowerCase() !== from) return l
      changed = true
      const rest = stripTag(m[3].slice(1))
      return `${m[1]}${m[2]}] ${rest}${to ? ` #${to}` : ''}`
    })
    return changed ? { ...d, body: lines.join('\n'), updatedAt: Date.now() } : d
  })
}
