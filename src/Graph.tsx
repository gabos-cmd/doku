import { useEffect, useMemo, useRef, useState } from 'react'
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force'
import { docLinks, type FolderColor, type State } from './store'

export const FOLDER_HEX: Record<FolderColor, string> = {
  blue: '#6e9bff',
  yellow: '#f2c03a',
  lavender: '#a79bd9',
  green: '#6fc28f',
  pink: '#f08fae',
  orange: '#f39a5e',
  grey: '#b9b9c2',
}

type Kind = 'space' | 'folder' | 'doc'

interface GNode extends SimulationNodeDatum {
  id: string
  kind: Kind
  label: string
  color: string
  r: number
  href: string
}

interface GLink extends SimulationLinkDatum<GNode> {
  kind: 'tree' | 'ref'
}

const nodeId = (k: Kind, id: string) => `${k}:${id}`

function build(state: State, showStructure: boolean) {
  const nodes: GNode[] = []
  const links: GLink[] = []
  const degree = new Map<string, number>()
  const bump = (id: string) => degree.set(id, (degree.get(id) ?? 0) + 1)

  const refs = docLinks(state.docs)
  for (const [a, b] of refs) {
    bump(a)
    bump(b)
  }

  if (showStructure) {
    for (const s of state.spaces)
      nodes.push({ id: nodeId('space', s.id), kind: 'space', label: s.name, color: '#1c1c20', r: 9, href: `#/space/${s.id}` })
    for (const f of state.folders) {
      nodes.push({
        id: nodeId('folder', f.id),
        kind: 'folder',
        label: f.name,
        color: FOLDER_HEX[f.color],
        r: 7,
        href: `#/folder/${f.id}`,
      })
      if (state.spaces.some((s) => s.id === f.spaceId))
        links.push({ source: nodeId('space', f.spaceId), target: nodeId('folder', f.id), kind: 'tree' })
    }
  }

  for (const d of state.docs) {
    nodes.push({
      id: nodeId('doc', d.id),
      kind: 'doc',
      label: d.title || 'Untitled',
      color: '#a3a3ab',
      r: 3.5 + Math.min(4, (degree.get(d.id) ?? 0) * 0.9),
      href: `#/doc/${d.id}`,
    })
    if (showStructure && state.folders.some((f) => f.id === d.folderId))
      links.push({ source: nodeId('folder', d.folderId), target: nodeId('doc', d.id), kind: 'tree' })
  }

  for (const [a, b] of refs) links.push({ source: nodeId('doc', a), target: nodeId('doc', b), kind: 'ref' })

  return { nodes, links, refCount: refs.length }
}

export function GraphView({ state }: { state: State }) {
  const [showStructure, setShowStructure] = useState(true)
  const graph = useMemo(() => build(state, showStructure), [state, showStructure])
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hoverLabel, setHoverLabel] = useState<string | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const wrap = wrapRef.current!
    const ctx = canvas.getContext('2d')!
    const { nodes, links } = graph

    // camera
    const cam = { x: 0, y: 0, k: 1 }
    let W = 0
    let H = 0
    let hover: GNode | null = null
    let drag: { node: GNode | null; sx: number; sy: number; cx: number; cy: number; moved: boolean } | null = null
    let neighbors = new Set<string>()
    let raf = 0

    const sim: Simulation<GNode, GLink> = forceSimulation(nodes)
      .force(
        'link',
        forceLink<GNode, GLink>(links)
          .id((d) => d.id)
          .distance((l) => (l.kind === 'ref' ? 60 : (l.source as GNode).kind === 'space' ? 90 : 42))
          .strength((l) => (l.kind === 'ref' ? 0.5 : 0.8)),
      )
      .force('charge', forceManyBody<GNode>().strength((d) => (d.kind === 'space' ? -420 : d.kind === 'folder' ? -220 : -70)))
      .force('collide', forceCollide<GNode>((d) => d.r + 6))
      .force('center', forceCenter(0, 0))
      .force('x', forceX(0).strength(0.04))
      .force('y', forceY(0).strength(0.04))
      .alphaDecay(0.03)
      .on('tick', () => schedule())

    const resize = () => {
      const rect = wrap.getBoundingClientRect()
      W = rect.width
      H = rect.height
      const dpr = window.devicePixelRatio || 1
      canvas.width = W * dpr
      canvas.height = H * dpr
      canvas.style.width = W + 'px'
      canvas.style.height = H + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      schedule()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    resize()

    const toWorld = (sx: number, sy: number) => ({ x: (sx - W / 2 - cam.x) / cam.k, y: (sy - H / 2 - cam.y) / cam.k })

    const pick = (sx: number, sy: number): GNode | null => {
      const p = toWorld(sx, sy)
      let best: GNode | null = null
      let bestD = Infinity
      for (const n of nodes) {
        const d = Math.hypot((n.x ?? 0) - p.x, (n.y ?? 0) - p.y)
        if (d < n.r + 6 / cam.k && d < bestD) {
          best = n
          bestD = d
        }
      }
      return best
    }

    const setHover = (n: GNode | null) => {
      if (n === hover) return
      hover = n
      neighbors = new Set()
      if (n) {
        neighbors.add(n.id)
        for (const l of links) {
          const s = (l.source as GNode).id
          const t = (l.target as GNode).id
          if (s === n.id) neighbors.add(t)
          if (t === n.id) neighbors.add(s)
        }
      }
      canvas.style.cursor = n ? 'pointer' : drag ? 'grabbing' : 'grab'
      setHoverLabel(n ? n.label : null)
      schedule()
    }

    function schedule() {
      if (!raf) raf = requestAnimationFrame(draw)
    }

    function draw() {
      raf = 0
      ctx.clearRect(0, 0, W, H)
      ctx.save()
      ctx.translate(W / 2 + cam.x, H / 2 + cam.y)
      ctx.scale(cam.k, cam.k)

      const dim = (id: string) => hover && !neighbors.has(id)

      // links
      for (const l of links) {
        const s = l.source as GNode
        const t = l.target as GNode
        const active = hover && neighbors.has(s.id) && neighbors.has(t.id) && (s === hover || t === hover)
        ctx.beginPath()
        ctx.moveTo(s.x!, s.y!)
        ctx.lineTo(t.x!, t.y!)
        ctx.lineWidth = (l.kind === 'ref' ? 1.4 : 1) / Math.sqrt(cam.k)
        ctx.strokeStyle = active
          ? 'rgba(59,123,246,0.75)'
          : hover
            ? 'rgba(0,0,0,0.04)'
            : l.kind === 'ref'
              ? 'rgba(17,17,19,0.28)'
              : 'rgba(17,17,19,0.09)'
        if (l.kind === 'tree' && !active) ctx.setLineDash([3 / cam.k, 3 / cam.k])
        ctx.stroke()
        ctx.setLineDash([])
      }

      // nodes
      for (const n of nodes) {
        const faded = dim(n.id)
        ctx.globalAlpha = faded ? 0.18 : 1
        ctx.beginPath()
        ctx.arc(n.x!, n.y!, n.r, 0, Math.PI * 2)
        ctx.fillStyle = n === hover ? '#3b7bf6' : n.color
        ctx.fill()
        if (n.kind === 'folder') {
          ctx.lineWidth = 2
          ctx.strokeStyle = '#fff'
          ctx.stroke()
        }
      }

      // labels
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      for (const n of nodes) {
        const show = hover ? neighbors.has(n.id) : n.kind !== 'doc' || cam.k > 1.15
        if (!show) continue
        ctx.globalAlpha = n.kind === 'doc' && !hover ? Math.min(1, (cam.k - 1.15) * 4) : 1
        const size = (n.kind === 'space' ? 13 : n.kind === 'folder' ? 12 : 11) / Math.sqrt(cam.k)
        ctx.font = `${n.kind === 'doc' ? 400 : 500} ${size}px Inter, sans-serif`
        ctx.lineWidth = 3 / cam.k
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'
        ctx.strokeText(n.label, n.x!, n.y! + n.r + 4 / cam.k)
        ctx.fillStyle = n === hover ? '#111113' : n.kind === 'doc' ? '#55555c' : '#111113'
        ctx.fillText(n.label, n.x!, n.y! + n.r + 4 / cam.k)
      }
      ctx.globalAlpha = 1
      ctx.restore()
    }

    const local = (e: PointerEvent | WheelEvent) => {
      const r = canvas.getBoundingClientRect()
      return { sx: e.clientX - r.left, sy: e.clientY - r.top }
    }

    const onDown = (e: PointerEvent) => {
      const { sx, sy } = local(e)
      const node = pick(sx, sy)
      drag = { node, sx, sy, cx: cam.x, cy: cam.y, moved: false }
      canvas.setPointerCapture(e.pointerId)
      if (node) {
        node.fx = node.x
        node.fy = node.y
        sim.alphaTarget(0.25).restart()
      } else canvas.style.cursor = 'grabbing'
    }

    const onMove = (e: PointerEvent) => {
      const { sx, sy } = local(e)
      if (!drag) return setHover(pick(sx, sy))
      if (Math.hypot(sx - drag.sx, sy - drag.sy) > 3) drag.moved = true
      if (drag.node) {
        const p = toWorld(sx, sy)
        drag.node.fx = p.x
        drag.node.fy = p.y
      } else {
        cam.x = drag.cx + (sx - drag.sx)
        cam.y = drag.cy + (sy - drag.sy)
        schedule()
      }
    }

    const onUp = () => {
      if (!drag) return
      const { node, moved } = drag
      if (node) {
        node.fx = null
        node.fy = null
        sim.alphaTarget(0)
        if (!moved) location.hash = node.href
      }
      drag = null
      canvas.style.cursor = hover ? 'pointer' : 'grab'
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const { sx, sy } = local(e)
      const before = toWorld(sx, sy)
      const k = Math.min(4, Math.max(0.25, cam.k * Math.exp(-e.deltaY * 0.0015)))
      cam.k = k
      cam.x = sx - W / 2 - before.x * k
      cam.y = sy - H / 2 - before.y * k
      schedule()
    }

    const onLeave = () => !drag && setHover(null)

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.style.cursor = 'grab'

    return () => {
      sim.stop()
      ro.disconnect()
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [graph])

  return (
    <div className="graph-page">
      <div className="graph-head">
        <div>
          <h1>Graph</h1>
          <p className="subhead">
            {state.docs.length} documents · {graph.refCount} {graph.refCount === 1 ? 'link' : 'links'}
          </p>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={showStructure} onChange={(e) => setShowStructure(e.target.checked)} />
          <span className="toggle-track" />
          <span>Show folders</span>
        </label>
      </div>
      <div className="graph-canvas" ref={wrapRef}>
        <canvas ref={canvasRef} />
        <div className="graph-hint">
          {hoverLabel ? (
            <b>{hoverLabel}</b>
          ) : (
            <>
              Link notes by typing <code>[[Note title]]</code> · scroll to zoom · drag to move
            </>
          )}
        </div>
      </div>
    </div>
  )
}
