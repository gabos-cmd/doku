import { useCallback, useEffect, useRef, useState } from 'react'

/* ---------- the pixel office: 4 agents, a wall board, and a task board below ---------- */

const W = 320
const H = 160
const SEAT_Y = 104 // feet of a seated agent (hidden behind the desk)
const AISLE_Y = 70 // the walkway between the desks and the wall
const BOARD_Y = 50 // where agents stand in front of the wall board
const SPEED = 44 // px per second
const DWELL = 0.6 // seconds spent pinning a card on the board

type Role = 'Researcher' | 'Writer' | 'Designer' | 'Reviewer'
type Status = 'todo' | 'doing' | 'done'
type Phase = 'idle' | 'fetch' | 'back' | 'work' | 'file' | 'home'
type Facing = 'down' | 'up' | 'left' | 'right'

interface AgentDef {
  id: string
  name: string
  role: Role
  shirt: string
  shirtDark: string
  hair: string
  skin: string
  deskX: number
  slotX: number
  kw: RegExp
}

export const AGENTS: AgentDef[] = [
  { id: 'ada', name: 'Ada', role: 'Researcher', shirt: '#3b7bf6', shirtDark: '#2b62cf', hair: '#3a2a20', skin: '#f1c7a0', deskX: 44, slotX: 138, kw: /research|find|compare|analy|investigat|look up|survey|data|source/i },
  { id: 'milo', name: 'Milo', role: 'Writer', shirt: '#f08a3c', shirtDark: '#cf6f25', hair: '#d9a441', skin: '#e2a97f', deskX: 122, slotX: 153, kw: /writ|draft|copy|email|blog|post|summar|outline|article|note/i },
  { id: 'juno', name: 'Juno', role: 'Designer', shirt: '#d65fa0', shirtDark: '#b54783', hair: '#2b2b33', skin: '#c98b63', deskX: 198, slotX: 167, kw: /design|logo|icon|layout|mock|colou?r|illustrat|sketch|\bui\b|font|poster/i },
  { id: 'otto', name: 'Otto', role: 'Reviewer', shirt: '#2f9e5b', shirtDark: '#227a45', hair: '#8a8a93', skin: '#f3d2b3', deskX: 276, slotX: 182, kw: /review|check|proof|test|audit|verify|\bqa\b|approve|edit/i },
]
const agentById = (id: string | null) => AGENTS.find((a) => a.id === id)

export interface OTask {
  id: string
  title: string
  status: Status
  agentId: string | null // who claimed it; kept on done tasks as "done by"
  progress: number // 0..1
  workMs: number
  createdAt: number
  doneAt?: number
}

interface Rt {
  x: number
  y: number
  phase: Phase
  path: { x: number; y: number }[]
  taskId: string | null
  facing: Facing
  step: number // distance walked, drives the leg frames
  dwell: number
  flash: number // seconds left on the "done" check bubble
  progress: number
  idleSince: number
}

const KEY = 'dok:office:v1'
const uid = () => Math.random().toString(36).slice(2, 10)

const SAMPLES = [
  'Research note-taking apps',
  'Draft the welcome email',
  'Design an empty-state illustration',
  'Review the onboarding copy',
  'Compare three calendar APIs',
  'Write release notes for v0.2',
  'Sketch a new folder icon',
  'Proofread the landing page',
  'Find sources on spaced repetition',
  'Outline a blog post about linking notes',
  'Mock up the settings screen',
  'Check links in the help docs',
]

const workMsFor = (title: string) => 5000 + Math.random() * 4000 + Math.min(title.length * 40, 2000)
const newTask = (title: string, now = Date.now()): OTask => ({
  id: uid(), title, status: 'todo', agentId: null, progress: 0, workMs: workMsFor(title), createdAt: now,
})

function seed(): OTask[] {
  const now = Date.now()
  return [
    { ...newTask('Review last week’s notes', now - 600_000), status: 'done', agentId: 'otto', progress: 1, doneAt: now - 300_000 },
    newTask('Research note-taking apps', now - 2000),
    newTask('Draft the welcome email', now - 1000),
  ]
}

/** Parse saved tasks and drop any half-finished walk: claims are released, work in progress resumes at the desk. */
function load(): OTask[] {
  let raw: unknown
  try {
    raw = JSON.parse(localStorage.getItem(KEY) ?? 'null')
  } catch {
    raw = null
  }
  if (!Array.isArray(raw)) return seed()
  const busy = new Set<string>()
  return raw
    .filter((t) => t && typeof t.id === 'string' && typeof t.title === 'string')
    .map((t): OTask => {
      const status: Status = t.status === 'doing' || t.status === 'done' ? t.status : 'todo'
      const base: OTask = {
        id: t.id,
        title: t.title,
        status,
        agentId: agentById(t.agentId) ? t.agentId : null,
        progress: typeof t.progress === 'number' ? Math.min(1, Math.max(0, t.progress)) : 0,
        workMs: typeof t.workMs === 'number' && t.workMs > 0 ? t.workMs : workMsFor(t.title),
        createdAt: typeof t.createdAt === 'number' ? t.createdAt : Date.now(),
        doneAt: typeof t.doneAt === 'number' ? t.doneAt : undefined,
      }
      if (status === 'todo') return { ...base, agentId: null, progress: 0 }
      if (status === 'doing') {
        if (!base.agentId || busy.has(base.agentId)) return { ...base, status: 'todo', agentId: null, progress: 0 }
        busy.add(base.agentId)
      }
      return base
    })
}

function initRts(tasks: OTask[]): Record<string, Rt> {
  const rts: Record<string, Rt> = {}
  for (const a of AGENTS) {
    const doing = tasks.find((t) => t.status === 'doing' && t.agentId === a.id)
    rts[a.id] = {
      x: a.deskX, y: SEAT_Y, path: [], facing: 'down', step: 0, dwell: 0, flash: 0, idleSince: 0,
      phase: doing ? 'work' : 'idle',
      taskId: doing?.id ?? null,
      progress: doing?.progress ?? 0,
    }
  }
  return rts
}

const toBoard = (a: AgentDef, rt: Rt) => [
  { x: rt.x, y: AISLE_Y },
  { x: a.slotX, y: AISLE_Y },
  { x: a.slotX, y: BOARD_Y },
]
const toDesk = (a: AgentDef, rt: Rt) =>
  Math.abs(rt.x - a.deskX) < 0.5
    ? [{ x: a.deskX, y: SEAT_Y }]
    : [{ x: rt.x, y: AISLE_Y }, { x: a.deskX, y: AISLE_Y }, { x: a.deskX, y: SEAT_Y }]

const LIGHT = { idle: '#38c172', walk: '#f5a524', work: '#3b7bf6' }
const lightOf = (p: Phase) => (p === 'idle' ? LIGHT.idle : p === 'work' ? LIGHT.work : LIGHT.walk)
const STATUS_TEXT: Record<Phase, string> = {
  idle: 'Available',
  fetch: 'Picking up a task',
  back: 'Heading to desk',
  work: 'Working',
  file: 'Moving card to Done',
  home: 'Back to desk',
}

/* ---------- drawing ---------- */

type Ctx = CanvasRenderingContext2D
const r = (c: Ctx, x: number, y: number, w: number, h: number, color: string) => {
  c.fillStyle = color
  c.fillRect(Math.round(x), Math.round(y), w, h)
}
const glow = (c: Ctx, x: number, y: number, rad: number, color: string, a: number) => {
  c.globalAlpha = a
  c.fillStyle = color
  c.beginPath()
  c.arc(x, y, rad, 0, Math.PI * 2)
  c.fill()
  c.globalAlpha = 1
}

function drawRoom(c: Ctx, t: number, tasks: OTask[]) {
  // wall + baseboard
  r(c, 0, 0, W, 46, '#efece6')
  r(c, 0, 0, W, 2, '#e6e2da')
  r(c, 0, 44, W, 3, '#d8d1c4')
  // floor: soft checker
  for (let y = 47; y < H; y += 8)
    for (let x = 0; x < W; x += 8) r(c, x, y, 8, 8, ((x + y) / 8) % 2 ? '#e8e3d9' : '#e3ddd1')

  // windows with drifting clouds
  for (const wx of [10, 254]) {
    r(c, wx, 7, 54, 30, '#cfc6b6')
    r(c, wx + 2, 9, 50, 26, '#cfe5f5')
    c.save()
    c.beginPath()
    c.rect(wx + 2, 9, 50, 26)
    c.clip()
    for (let i = 0; i < 3; i++) {
      const cx = wx + 2 + ((t * (3 + i) + i * 37 + wx) % 74) - 12
      const cy = 13 + i * 7
      r(c, cx, cy, 10, 3, '#ffffff')
      r(c, cx + 2, cy - 2, 5, 2, '#ffffff')
    }
    c.restore()
    r(c, wx + 26, 9, 2, 26, '#cfc6b6')
    r(c, wx + 2, 21, 50, 2, '#cfc6b6')
    r(c, wx - 2, 37, 58, 3, '#d9d1c2')
  }

  // the wall board, mirroring the columns below
  r(c, 117, 3, 87, 40, '#b9ad97')
  r(c, 119, 5, 83, 35, '#fbfaf7')
  const cols: [Status, string][] = [['todo', '#a3a3ab'], ['doing', '#3b7bf6'], ['done', '#2f9e5b']]
  cols.forEach(([s, color], i) => {
    const x = 122 + i * 27
    r(c, x, 7, 24, 2, color)
    const list = tasks.filter((k) => k.status === s)
    list.slice(0, 4).forEach((k, j) => {
      const y = 12 + j * 7
      const a = agentById(k.agentId)
      r(c, x, y, 24, 5, s === 'done' ? '#dcefe3' : '#ece8e0')
      if (a) r(c, x, y, 2, 5, a.shirt)
      r(c, x + 4, y + 1, 12, 1, '#c4bfb5')
      if (s === 'doing' && a) r(c, x + 4, y + 3, Math.max(1, Math.round(18 * k.progress)), 1, a.shirt)
    })
    if (list.length > 4) for (let d = 0; d < 3; d++) r(c, x + 9 + d * 3, 37, 1, 1, '#a3a3ab')
  })
  r(c, 145, 6, 1, 33, '#ebe7df')
  r(c, 172, 6, 1, 33, '#ebe7df')
  r(c, 130, 40, 60, 2, '#a99d86')
  r(c, 140, 39, 5, 1, '#3b7bf6')
  r(c, 148, 39, 5, 1, '#c0504d')

  // clock with the real time
  const ccx = 233, ccy = 19
  for (let y = -7; y <= 7; y++)
    for (let x = -7; x <= 7; x++) {
      const d = x * x + y * y
      if (d <= 49) r(c, ccx + x, ccy + y, 1, 1, d > 34 ? '#55555f' : '#ffffff')
    }
  const now = new Date()
  const hand = (ang: number, len: number, color: string) => {
    for (let s = 0; s <= len; s += 0.5) r(c, ccx + Math.round(Math.sin(ang) * s), ccy - Math.round(Math.cos(ang) * s), 1, 1, color)
  }
  hand(((now.getHours() % 12) + now.getMinutes() / 60) * (Math.PI / 6), 3, '#222')
  hand(now.getMinutes() * (Math.PI / 30), 5, '#55555f')

  // plants against the wall
  for (const px of [99, 211]) {
    r(c, px - 4, 47, 9, 8, '#c97b4f')
    r(c, px - 5, 47, 11, 2, '#b06a40')
    r(c, px - 1, 37, 2, 10, '#3f8a4e')
    r(c, px - 5, 39, 4, 3, '#4fa25e')
    r(c, px + 2, 36, 4, 3, '#4fa25e')
    r(c, px - 3, 33, 3, 3, '#5bb56b')
    r(c, px + 1, 31, 3, 4, '#5bb56b')
  }
}

function drawAgent(c: Ctx, a: AgentDef, rt: Rt, t: number) {
  const x = Math.round(rt.x)
  const y = Math.round(rt.y)
  const walking = rt.path.length > 0
  const seated = !walking && rt.y >= SEAT_Y - 0.5
  const frame = walking ? Math.floor(rt.step / 4) % 2 : -1
  const pants = '#3d3d48'

  if (!seated) r(c, x - 4, y - 1, 9, 2, 'rgba(0,0,0,0.12)')
  // legs
  const lUp = frame === 0 ? 1 : 0
  const rUp = frame === 1 ? 1 : 0
  r(c, x - 3, y - 5, 2, 5 - lUp, pants)
  r(c, x + 1, y - 5, 2, 5 - rUp, pants)
  r(c, x - 3, y - 1 - lUp, 2, 1, '#26262c')
  r(c, x + 1, y - 1 - rUp, 2, 1, '#26262c')
  // torso + arms
  r(c, x - 4, y - 12, 8, 7, a.shirt)
  r(c, x + 3, y - 12, 1, 7, a.shirtDark)
  const typing = rt.phase === 'work' && seated
  const swing = walking ? (frame === 0 ? 1 : -1) : 0
  if (typing) {
    const tap = Math.floor(t * 8) % 2
    r(c, x - 5, y - 11, 1, 4, a.shirt)
    r(c, x + 4, y - 11, 1, 4, a.shirt)
    r(c, x - 4, y - 6 - tap, 1, 1, a.skin)
    r(c, x + 3, y - 7 + tap, 1, 1, a.skin)
  } else {
    r(c, x - 5, y - 11 + swing, 1, 5, a.shirt)
    r(c, x + 4, y - 11 - swing, 1, 5, a.shirt)
    r(c, x - 5, y - 6 + swing, 1, 1, a.skin)
    r(c, x + 4, y - 6 - swing, 1, 1, a.skin)
  }
  // head
  r(c, x - 3, y - 19, 7, 7, a.skin)
  const back = rt.facing === 'up'
  if (back) {
    r(c, x - 3, y - 20, 7, 6, a.hair)
  } else {
    r(c, x - 3, y - 20, 7, 2, a.hair)
    r(c, x - 3, y - 18, 1, 2, a.hair)
    r(c, x + 3, y - 18, 1, 2, a.hair)
    const ex = rt.facing === 'left' ? -1 : rt.facing === 'right' ? 1 : 0
    const blink = (t + x * 0.37) % 4 < 0.12
    if (!blink) {
      r(c, x - 2 + ex, y - 16, 1, 1, '#222')
      r(c, x + 1 + ex, y - 16, 1, 1, '#222')
    }
    r(c, x - 2 + ex, y - 14, 1, 1, 'rgba(220,90,90,0.35)')
    r(c, x + 1 + ex, y - 14, 1, 1, 'rgba(220,90,90,0.35)')
  }
  // per-agent hair details
  if (a.id === 'ada') {
    r(c, x - 4, y - 19, 1, 6, a.hair)
    r(c, x + 4, y - 19, 1, 6, a.hair)
  } else if (a.id === 'milo') {
    r(c, x - 1, y - 21, 3, 1, a.hair)
  } else if (a.id === 'juno') {
    r(c, x - 2, y - 22, 4, 2, a.hair)
  } else if (a.id === 'otto' && !back) {
    r(c, x - 3, y - 16, 3, 1, '#2b2b33')
    r(c, x + 1, y - 16, 3, 1, '#2b2b33')
  }
  // antenna with a status tip — they're agents, after all
  const light = lightOf(rt.phase)
  r(c, x + 2, y - 23, 1, 3, '#7a7a85')
  const on = rt.phase !== 'work' || Math.floor(t * 3) % 2 === 0
  if (on) glow(c, x + 2.5, y - 23.5, 2.5, light, 0.3)
  r(c, x + 2, y - 24, 1, 1, light)
}

function drawChair(c: Ctx, a: AgentDef) {
  const cx = a.deskX
  r(c, cx - 6, 87, 12, 13, '#4a4a55')
  r(c, cx - 6, 87, 12, 1, '#5d5d6a')
}

function drawDesk(c: Ctx, a: AgentDef, rt: Rt, t: number) {
  const cx = a.deskX
  // desk
  r(c, cx - 24, 100, 48, 4, '#c9a77c')
  r(c, cx - 24, 100, 48, 1, '#d9ba90')
  r(c, cx - 23, 104, 46, 15, '#b08b5e')
  r(c, cx + 6, 107, 14, 6, '#a27e53')
  r(c, cx + 12, 109, 2, 1, '#e2cba6')
  r(c, cx - 23, 119, 3, 6, '#8f6f48')
  r(c, cx + 20, 119, 3, 6, '#8f6f48')
  r(c, cx - 21, 125, 44, 2, 'rgba(0,0,0,0.07)')
  // laptop (we see the back of the lid)
  const working = rt.phase === 'work'
  r(c, cx + 7, 91, 12, 9, '#c9ccd3')
  r(c, cx + 7, 91, 12, 1, '#dadde3')
  r(c, cx + 6, 99, 14, 1, '#a7abb3')
  r(c, cx + 12, 94, 2, 2, working && Math.floor(t * 2) % 2 ? '#ffffff' : '#e3e5ea')
  // role item
  const ix = cx - 14
  if (a.role === 'Researcher') {
    r(c, ix - 2, 97, 9, 3, '#c0504d')
    r(c, ix - 1, 94, 8, 3, '#4f7fc0')
    r(c, ix - 2, 91, 7, 3, '#e0b04a')
    r(c, ix - 2, 98, 9, 1, '#f3ede2')
  } else if (a.role === 'Writer') {
    r(c, ix - 3, 98, 9, 2, '#ffffff')
    r(c, ix - 2, 97, 9, 1, '#f6f4ef')
    r(c, ix - 1, 96, 7, 1, '#f2c14e')
    r(c, ix + 6, 96, 1, 1, '#333')
  } else if (a.role === 'Designer') {
    r(c, ix - 3, 98, 10, 2, '#2b2b33')
    r(c, ix - 2, 97, 2, 1, '#ef5b5b')
    r(c, ix + 1, 97, 2, 1, '#f5c344')
    r(c, ix + 4, 97, 2, 1, '#3b7bf6')
  } else {
    r(c, ix - 2, 95, 5, 5, '#ffffff')
    r(c, ix + 3, 96, 2, 3, '#ffffff')
    r(c, ix - 1, 95, 3, 1, '#6b4a2b')
    r(c, ix - 2, 95, 5, 5, 'rgba(0,0,0,0.04)')
  }
  // status lamp
  const light = lightOf(rt.phase)
  const on = rt.phase !== 'work' || Math.floor(t * 3) % 2 === 0
  r(c, cx - 21, 99, 5, 1, '#55555f')
  r(c, cx - 19, 93, 1, 6, '#6d6d78')
  if (on) glow(c, cx - 18.5, 91.5, 4.5, light, 0.28)
  r(c, cx - 20, 90, 3, 3, on ? light : '#9a9aa3')
}

function drawBubbles(c: Ctx, a: AgentDef, rt: Rt, t: number) {
  const x = Math.round(rt.x)
  const y = Math.round(rt.y)
  const bubble = (bx: number, by: number, w: number) => {
    r(c, bx + 1, by, w - 2, 7, '#ffffff')
    r(c, bx, by + 1, w, 5, '#ffffff')
    r(c, bx + 1, by + 7, 2, 1, '#ffffff')
  }
  if (rt.phase === 'work' && rt.y >= SEAT_Y - 0.5) {
    bubble(x + 5, y - 33, 11)
    for (let i = 0; i < 3; i++) r(c, x + 7 + i * 3, y - 30, 1, 1, Math.floor(t * 3) % 3 === i ? '#3b7bf6' : '#c6c6cd')
  } else if (rt.flash > 0) {
    bubble(x + 5, y - 33, 9)
    r(c, x + 7, y - 30, 1, 1, '#2f9e5b')
    r(c, x + 8, y - 29, 1, 1, '#2f9e5b')
    r(c, x + 9, y - 30, 1, 1, '#2f9e5b')
    r(c, x + 10, y - 31, 1, 1, '#2f9e5b')
    r(c, x + 11, y - 32, 1, 1, '#2f9e5b')
  }
}

/* ---------- view ---------- */

type Snap = Record<string, Phase>
const snap = (rts: Record<string, Rt>): Snap => Object.fromEntries(AGENTS.map((a) => [a.id, rts[a.id].phase]))

export function OfficeView() {
  const [tasks, setTasks] = useState<OTask[]>(load)
  const tasksRef = useRef(tasks)
  const commit = useCallback((fn: (ts: OTask[]) => OTask[]) => {
    const next = fn(tasksRef.current)
    tasksRef.current = next
    setTasks(next)
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(tasks))
    } catch {
      /* ignore */
    }
  }, [tasks])

  const rtsRef = useRef<Record<string, Rt>>(null as never)
  if (!rtsRef.current) rtsRef.current = initRts(tasks)
  const [phases, setPhases] = useState<Snap>(() => snap(rtsRef.current))
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const ctx = canvasRef.current!.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    const rts = rtsRef.current
    let raf = 0
    let last = performance.now()
    let sinceCommit = 0

    const patch = (id: string, p: Partial<OTask>) => commit((ts) => ts.map((k) => (k.id === id ? { ...k, ...p } : k)))

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const t = now / 1000
      let changed = false

      // hand unclaimed cards to free agents, oldest card first; a matching role wins
      const free = AGENTS.filter((a) => rts[a.id].phase === 'idle').sort((p, q) => rts[p.id].idleSince - rts[q.id].idleSince)
      for (const task of tasksRef.current.filter((k) => k.status === 'todo' && !k.agentId).sort((p, q) => p.createdAt - q.createdAt)) {
        if (!free.length) break
        const i = Math.max(0, free.findIndex((a) => a.kw.test(task.title)))
        const a = free.splice(i, 1)[0]
        const rt = rts[a.id]
        rt.phase = 'fetch'
        rt.taskId = task.id
        rt.progress = 0
        rt.path = toBoard(a, rt)
        patch(task.id, { agentId: a.id })
        changed = true
      }

      for (const a of AGENTS) {
        const rt = rts[a.id]
        rt.flash = Math.max(0, rt.flash - dt)
        if (rt.phase === 'idle') continue
        if (rt.phase === 'work') {
          const task = tasksRef.current.find((k) => k.id === rt.taskId)
          if (!task) {
            rt.phase = 'idle'
            changed = true
            continue
          }
          rt.progress = Math.min(1, rt.progress + (dt * 1000) / task.workMs)
          if (rt.progress >= 1) {
            patch(task.id, { progress: 1 })
            rt.phase = 'file'
            rt.path = toBoard(a, rt)
            changed = true
          }
          continue
        }
        // walking phases
        if (rt.path.length) {
          const target = rt.path[0]
          const dx = target.x - rt.x
          const dy = target.y - rt.y
          const dist = Math.hypot(dx, dy)
          const stepLen = SPEED * dt
          if (dist > 0.01) rt.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
          if (dist <= stepLen) {
            rt.x = target.x
            rt.y = target.y
            rt.step += dist
            rt.path.shift()
            if (!rt.path.length && (rt.phase === 'fetch' || rt.phase === 'file')) {
              rt.dwell = DWELL
              rt.facing = 'up'
            }
          } else {
            rt.x += (dx / dist) * stepLen
            rt.y += (dy / dist) * stepLen
            rt.step += stepLen
          }
          continue
        }
        if (rt.dwell > 0) {
          rt.dwell -= dt
          continue
        }
        // arrived
        changed = true
        if (rt.phase === 'fetch') {
          if (rt.taskId) patch(rt.taskId, { status: 'doing' })
          rt.phase = 'back'
          rt.path = toDesk(a, rt)
        } else if (rt.phase === 'back') {
          rt.phase = 'work'
          rt.facing = 'down'
        } else if (rt.phase === 'file') {
          if (rt.taskId) patch(rt.taskId, { status: 'done', progress: 1, doneAt: Date.now() })
          rt.taskId = null
          rt.flash = 1.4
          rt.phase = 'home'
          rt.path = toDesk(a, rt)
        } else if (rt.phase === 'home') {
          rt.phase = 'idle'
          rt.facing = 'down'
          rt.idleSince = now
        }
      }

      // push work progress to the cards a few times a second
      sinceCommit += dt
      if (sinceCommit > 0.25) {
        sinceCommit = 0
        const working = AGENTS.map((a) => rts[a.id]).filter((rt) => rt.phase === 'work' && rt.taskId)
        if (working.length)
          commit((ts) =>
            ts.map((k) => {
              const rt = working.find((w) => w.taskId === k.id)
              return rt && k.status === 'doing' ? { ...k, progress: rt.progress } : k
            }),
          )
      }
      if (changed) setPhases(snap(rts))

      // draw
      drawRoom(ctx, t, tasksRef.current)
      for (const a of AGENTS) drawChair(ctx, a)
      for (const a of [...AGENTS].sort((p, q) => rts[p.id].y - rts[q.id].y)) drawAgent(ctx, a, rts[a.id], t)
      for (const a of AGENTS) drawDesk(ctx, a, rts[a.id], t)
      for (const a of AGENTS) drawBubbles(ctx, a, rts[a.id], t)

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [commit])

  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const add = (e?: React.FormEvent) => {
    e?.preventDefault()
    let title = text.trim()
    if (!title) {
      const used = new Set(tasksRef.current.map((k) => k.title))
      const pool = SAMPLES.filter((s) => !used.has(s))
      title = (pool.length ? pool : SAMPLES)[Math.floor(Math.random() * (pool.length || SAMPLES.length))]
    }
    commit((ts) => [...ts, newTask(title)])
    setText('')
    inputRef.current?.focus()
  }

  const remove = (id: string) => {
    const task = tasksRef.current.find((k) => k.id === id)
    const a = task && task.status !== 'done' ? agentById(task.agentId) : undefined
    if (a) {
      const rt = rtsRef.current[a.id]
      rt.taskId = null
      rt.dwell = 0
      if (rt.phase === 'work') rt.phase = 'idle'
      else if (rt.phase !== 'idle') {
        rt.phase = 'home'
        rt.path = toDesk(a, rt)
      }
      setPhases(snap(rtsRef.current))
    }
    commit((ts) => ts.filter((k) => k.id !== id))
  }
  const clearDone = () => commit((ts) => ts.filter((k) => k.status !== 'done'))

  const columns: { status: Status; name: string; color: string }[] = [
    { status: 'todo', name: 'To do', color: '#a3a3ab' },
    { status: 'doing', name: 'Doing', color: '#3b7bf6' },
    { status: 'done', name: 'Done', color: '#2f9e5b' },
  ]
  const doneCount = tasks.filter((k) => k.status === 'done').length

  return (
    <div className="page wide office-page">
      <div className="page-head tasks-head">
        <div className="page-head-text">
          <h1>Office</h1>
          <p className="subhead">Add a task and one of the agents picks it up, takes it to the board, and gets it done.</p>
        </div>
      </div>

      <div className="office-stage">
        <canvas ref={canvasRef} width={W} height={H} aria-label="Pixel-art office with four agents at their desks" role="img" />
        {AGENTS.map((a) => {
          const phase = phases[a.id]
          const task = tasks.find((k) => k.id === rtsRef.current[a.id].taskId)
          return (
            <div key={a.id} className="nameplate" style={{ left: `${(a.deskX / W) * 100}%` }}>
              <i className={`np-light ${phase === 'work' ? 'blink' : ''}`} style={{ '--light': lightOf(phase) } as React.CSSProperties} />
              <div className="np-text">
                <div className="np-name">
                  <b>{a.name}</b>
                  <span>{a.role}</span>
                </div>
                <div className="np-status" title={task?.title}>
                  {STATUS_TEXT[phase]}
                  {phase === 'work' && task ? ` · ${Math.round(task.progress * 100)}%` : ''}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <form className="quick-add office-add" onSubmit={add}>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe a task, or leave empty for a random one"
          aria-label="New task"
        />
        <button className="btn" type="submit">
          Add task
        </button>
      </form>

      <div className="board office-board">
        {columns.map((col) => {
          const list = tasks
            .filter((k) => k.status === col.status)
            .sort((p, q) => (col.status === 'done' ? (q.doneAt ?? 0) - (p.doneAt ?? 0) : p.createdAt - q.createdAt))
          return (
            <section key={col.status} className="board-col" aria-label={col.name}>
              <div className="board-col-head">
                <span className="col-dot" style={{ background: col.color }} />
                <h2>{col.name}</h2>
                <span className="col-count">{list.length}</span>
                {col.status === 'done' && doneCount > 0 && (
                  <button className="col-clear" onClick={clearDone}>
                    Clear
                  </button>
                )}
              </div>
              <div className="board-cards">
                {list.length === 0 && (
                  <p className="col-empty">{col.status === 'todo' ? 'Nothing waiting' : col.status === 'doing' ? 'Nobody busy' : 'Nothing finished yet'}</p>
                )}
                {list.map((k) => (
                  <OfficeCard key={k.id} task={k} phase={k.agentId ? phases[k.agentId] : undefined} onDelete={() => remove(k.id)} />
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function OfficeCard({ task, phase, onDelete }: { task: OTask; phase?: Phase; onDelete: () => void }) {
  const a = agentById(task.agentId)
  const pct = Math.round(task.progress * 100)
  let note = 'Waiting for an agent'
  if (a && task.status === 'todo') note = `${a.name} is picking it up`
  if (a && task.status === 'doing') note = phase === 'back' ? `${a.name} · heading to desk` : `${a.name} · ${pct}%`
  if (a && task.status === 'done') note = `Done by ${a.name}`
  return (
    <article className={`tcard ocard ${task.status}`}>
      <div className="tcard-head">
        <h3>{task.title}</h3>
        <button className="ocard-del" onClick={onDelete} aria-label="Delete task" title="Delete">
          ×
        </button>
      </div>
      {task.status === 'doing' && (
        <div className="oprog" aria-hidden>
          <i style={{ width: `${pct}%`, background: a?.shirt }} />
        </div>
      )}
      <div className="ocard-foot">
        <span className="tcard-avatar" style={{ background: a ? a.shirt : '#d4d4da' }}>
          {a ? a.name[0] : '?'}
        </span>
        <span className="ocard-note">
          {note}
          {a && <em>{a.role}</em>}
        </span>
      </div>
    </article>
  )
}
