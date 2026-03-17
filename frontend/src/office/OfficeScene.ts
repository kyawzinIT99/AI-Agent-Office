import Phaser from 'phaser'
import { speak, stopSpeech } from './voice'

const W = 820
const H = 540

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  wallTop:    0x0d1424,
  wallBrick:  0x111827,
  floor:      0x141e2e,
  floorTile:  0x1a2540,
  floorLine:  0x1e2d4a,
  deskSurf:   0x1e3a5f,
  deskEdge:   0x2563a8,
  chair:      0x1e293b,
  chairPad:   0x2d3748,
  monitor:    0x080f1a,
  serverUnit: 0x0a1628,
  plant1:     0x14532d,
  plant2:     0x166534,
  coffee:     0x78350f,
  sofa:       0x3730a3,
  sofaPad:    0x4338ca,
  meeting:    0x132030,
  window:     0x0ea5e9,
  sky:        0x0c1a2e,
  cloud:      0x1e3a5f,
  carpet:     0x0f1e30,
  wboard:     0xecfdf5,
  skirting:   0x080f1a,
}

// ─── Character skin tones ──────────────────────────────────────────────────────
const SKIN = [0xfde68a, 0xf5cba7, 0xd4a574]
const HAIR = [0x1c1917, 0x44403c, 0xb45309]

// ─── Agent definitions ────────────────────────────────────────────────────────
const AGENTS_DEF = [
  { id: 'dev', name: 'Alex',   role: 'Developer',     color: 0x3b82f6, desk: { x: 160, y: 230 }, skin: SKIN[0], hair: HAIR[0] },
  { id: 'qa',  name: 'Sam',    role: 'QA Engineer',   color: 0xf59e0b, desk: { x: 400, y: 230 }, skin: SKIN[1], hair: HAIR[1] },
  { id: 'pm',  name: 'Jordan', role: 'Product Mgr',   color: 0xa855f7, desk: { x: 640, y: 230 }, skin: SKIN[2], hair: HAIR[2] },
]

const MEETING_SEATS = [
  { x: 305, y: 358 }, { x: 400, y: 342 }, { x: 495, y: 358 },
]

// Waypoints agents wander to
const SPOTS = [
  { x: 90,  y: 400, name: 'coffee'    },
  { x: 740, y: 395, name: 'window'    },
  { x: 310, y: 115, name: 'whiteboard'},
  { x: 550, y: 405, name: 'sofa'      },
  { x: 400, y: 430, name: 'hallway'   },
  { x: 220, y: 405, name: 'printer'   },
]

const CHAT: Record<string, { work: string[]; idle: string[]; meet: string[] }> = {
  dev: {
    work: ['git push origin main', 'PR #42 merged ✓', 'Debugging auth...', 'npm run build', 'Code review done!', 'Tests passing ✅', 'Refactoring API...', 'Fixing that CSS bug'],
    idle: ['☕ Need coffee...', '🎧 Focus mode', 'Checking Reddit...', 'Slack DMs 😅', 'Quick stretch!'],
    meet: ['Shipped 3 PRs ✓', 'No blockers!', 'API is stable 🚀', 'Will review today'],
  },
  qa: {
    work: ['Test suite: 94%', '🐛 Found a bug!', 'E2E tests pass ✓', 'Writing test plan', 'Coverage up! 📈', 'Regression clear', 'Selenium done'],
    idle: ['☕ Tea time~', '📋 Planning tests', 'Slack catchup', 'Taking a walk!', '🔍 Deep thinking'],
    meet: ['2 bugs logged', 'QA risk: LOW ✓', '847 tests pass', 'Coverage: 91%'],
  },
  pm: {
    work: ['Updating Jira ✓', 'Sprint @ 74%', 'Roadmap sync', 'OKRs on track!', 'Stakeholder deck', 'Prioritizing...', 'Ship Friday! 🚢'],
    idle: ['📅 Checking cal', 'Writing notes', '☕ Coffee run!', 'Slack catchup', '📊 Dashboard'],
    meet: ['On track 🎯', 'Confidence: 8/10', 'Ship Friday ✓', 'Blockers: none!'],
  },
}

// ─── Humanoid Character ────────────────────────────────────────────────────────
class Character {
  scene: Phaser.Scene
  def: typeof AGENTS_DEF[0]

  // Body parts
  root:     Phaser.GameObjects.Container  // world position
  shadow:   Phaser.GameObjects.Ellipse
  nameTag:  Phaser.GameObjects.Text

  legL:  Phaser.GameObjects.Rectangle
  legR:  Phaser.GameObjects.Rectangle
  shoe:  Phaser.GameObjects.Rectangle
  shoeR: Phaser.GameObjects.Rectangle
  body:  Phaser.GameObjects.Rectangle
  collar:Phaser.GameObjects.Rectangle
  armL:  Phaser.GameObjects.Rectangle
  armR:  Phaser.GameObjects.Rectangle
  handL: Phaser.GameObjects.Circle
  handR: Phaser.GameObjects.Circle
  neck:  Phaser.GameObjects.Rectangle
  head:  Phaser.GameObjects.Circle
  hairTop: Phaser.GameObjects.Rectangle
  eyeL:  Phaser.GameObjects.Circle
  eyeR:  Phaser.GameObjects.Circle
  mouth: Phaser.GameObjects.Arc
  blush: Phaser.GameObjects.Circle

  // Accessories
  glasses?: Phaser.GameObjects.Rectangle
  badge?:   Phaser.GameObjects.Rectangle
  laptop?:  Phaser.GameObjects.Rectangle

  bubble:    Phaser.GameObjects.Container
  bubbleBg:  Phaser.GameObjects.Rectangle
  bubbleTxt: Phaser.GameObjects.Text
  bubbleTail:Phaser.GameObjects.Triangle

  // State
  pos = { x: 0, y: 0 }
  walkPhase = Math.random() * Math.PI * 2
  moving = false
  state: 'sit' | 'stand' | 'walk' | 'meeting' = 'sit'
  dir: 'left' | 'right' = 'right'
  private _walkTween?: Phaser.Tweens.Tween
  private _bubTimer?: Phaser.Time.TimerEvent
  private _idleTick = 0

  constructor(scene: Phaser.Scene, def: typeof AGENTS_DEF[0]) {
    this.scene = scene
    this.def = def

    this.shadow = scene.add.ellipse(def.desk.x, def.desk.y + 22, 26, 7, 0x000000, 0.4)

    this.root = scene.add.container(def.desk.x, def.desk.y)
    this._buildBody()

    const hex = '#' + def.color.toString(16).padStart(6, '0')
    this.nameTag = scene.add.text(def.desk.x, def.desk.y + 32, def.name, {
      fontSize: '11px', color: hex, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
      shadow: { offsetX: 0, offsetY: 1, color: '#000', blur: 4, fill: true },
    }).setOrigin(0.5)

    // Speech bubble
    this.bubbleBg  = scene.add.rectangle(0, -62, 118, 28, 0x0c1a2e, 0.96).setStrokeStyle(1.5, def.color, 0.95)
    this.bubbleTxt = scene.add.text(0, -62, '', { fontSize: '9px', color: '#f1f5f9', align: 'center' }).setOrigin(0.5)
    this.bubbleTail = scene.add.triangle(0, -47, -5, 0, 5, 0, 0, 8, def.color, 0.95)
    this.bubble = scene.add.container(def.desk.x, def.desk.y, [this.bubbleBg, this.bubbleTxt, this.bubbleTail])
    this.bubble.setVisible(false)

    this.pos = { x: def.desk.x, y: def.desk.y }
    this._syncExtras()
  }

  private _buildBody() {
    const c = this.def.color
    const d = this._darken(c, 35)
    const s = this.def.skin
    const h = this.def.hair

    // Shoes
    this.shoe  = this.scene.add.rectangle(-5, 24, 8, 5, 0x1c1917).setDepth(1)
    this.shoeR = this.scene.add.rectangle( 5, 24, 8, 5, 0x1c1917).setDepth(1)
    // Legs
    this.legL = this.scene.add.rectangle(-5, 14, 7, 18, d)
    this.legR = this.scene.add.rectangle( 5, 14, 7, 18, d)
    // Body / shirt
    this.body = this.scene.add.rectangle(0, -2, 22, 22, c)
    // Collar
    this.collar = this.scene.add.triangle(0, -11, -5, 0, 5, 0, 0, 8, s)
    // Arms
    this.armL = this.scene.add.rectangle(-14, 0, 6, 16, d)
    this.armR = this.scene.add.rectangle( 14, 0, 6, 16, d)
    this.handL = this.scene.add.circle(-14, 9, 3.5, s)
    this.handR = this.scene.add.circle( 14, 9, 3.5, s)
    // Neck
    this.neck = this.scene.add.rectangle(0, -14, 6, 6, s)
    // Head
    this.head = this.scene.add.circle(0, -24, 12, s)
    // Hair
    this.hairTop = this.scene.add.rectangle(0, -32, 24, 8, h)
    // Eyes
    this.eyeL = this.scene.add.circle(-4, -25, 2.5, 0x111827)
    this.eyeR = this.scene.add.circle( 4, -25, 2.5, 0x111827)
    // Mouth
    this.mouth = this.scene.add.arc(0, -19, 3.5, 15, 165, false, 0x7c3aed, 0.7)
    // Blush
    this.blush = this.scene.add.circle(-9, -21, 3, 0xfda4af, 0.25)

    const parts = [
      this.shoe, this.shoeR, this.legL, this.legR,
      this.body, this.collar, this.armL, this.armR,
      this.handL, this.handR, this.neck, this.head,
      this.hairTop, this.eyeL, this.eyeR, this.mouth, this.blush,
    ]

    // Accessories per agent
    if (this.def.id === 'dev') {
      // Glasses
      const g1 = this.scene.add.rectangle(-4, -25, 7, 5, 0x1e293b).setStrokeStyle(1, 0x64748b)
      const g2 = this.scene.add.rectangle( 4, -25, 7, 5, 0x1e293b).setStrokeStyle(1, 0x64748b)
      const gb = this.scene.add.rectangle(0, -25, 3, 2, 0x64748b)
      parts.push(g1, g2, gb)
    }
    if (this.def.id === 'qa') {
      // Clipboard
      const clip = this.scene.add.rectangle(18, 2, 10, 13, 0xf8fafc, 0.9).setStrokeStyle(1, 0xcbd5e1)
      const line1 = this.scene.add.rectangle(18, -1, 7, 1.5, 0x94a3b8, 0.6)
      const line2 = this.scene.add.rectangle(18,  2, 7, 1.5, 0x94a3b8, 0.6)
      const line3 = this.scene.add.rectangle(18,  5, 5, 1.5, 0x94a3b8, 0.6)
      parts.push(clip, line1, line2, line3)
    }
    if (this.def.id === 'pm') {
      // Badge/lanyard
      const lanyard = this.scene.add.rectangle(0, -5, 2, 8, 0xa855f7, 0.6)
      const badge   = this.scene.add.rectangle(0, 1, 8, 6, 0xf1f5f9).setStrokeStyle(1, 0x94a3b8)
      parts.push(lanyard, badge)
    }

    this.root.add(parts)
  }

  private _darken(color: number, amount: number): number {
    const c = Phaser.Display.Color.IntegerToColor(color)
    c.darken(amount)
    return c.color
  }

  private _syncExtras() {
    this.shadow.setPosition(this.pos.x, this.pos.y + 22)
    this.nameTag.setPosition(this.pos.x, this.pos.y + 32)
    this.bubble.setPosition(this.pos.x, this.pos.y)
  }

  // ── Update called every frame ────────────────────────────────────────────────
  update(time: number, delta: number) {
    if (this.moving) {
      this.walkPhase += delta / 160
      const p = this.walkPhase * Math.PI * 2
      // Legs alternate
      this.legL.y  = 14 + Math.sin(p) * 4
      this.legR.y  = 14 + Math.sin(p + Math.PI) * 4
      this.shoe.y  = 24 + Math.sin(p) * 4
      this.shoeR.y = 24 + Math.sin(p + Math.PI) * 4
      // Arms swing opposite
      this.armL.x  = -14 + Math.sin(p + Math.PI) * 2
      this.armR.x  =  14 + Math.sin(p) * 2
      this.handL.x = -14 + Math.sin(p + Math.PI) * 2
      this.handR.x =  14 + Math.sin(p) * 2
      // Bob
      this.root.y = this.pos.y + Math.abs(Math.sin(p * 2)) * -1.5
    } else if (this.state === 'sit') {
      // Typing at desk
      const t = time / 300
      this.armL.y = 2 + Math.sin(t * 3) * 1.5
      this.armR.y = 2 + Math.sin(t * 3 + 0.7) * 1.5
      this.handL.y = 9 + Math.sin(t * 3) * 1.5
      this.handR.y = 9 + Math.sin(t * 3 + 0.7) * 1.5
      // Breathing
      this.root.y = this.pos.y + Math.sin(time / 1800) * 0.8
    } else if (this.state === 'stand') {
      // Idle sway
      this.root.y = this.pos.y + Math.sin(time / 1400) * 1.0
    }
    this._syncExtras()
  }

  // ── Walking ──────────────────────────────────────────────────────────────────
  walkTo(dest: { x: number; y: number }, onDone?: () => void) {
    this.state = 'walk'
    this.moving = true
    this.dir = dest.x < this.pos.x ? 'left' : 'right'
    this.root.setScale(this.dir === 'left' ? -1 : 1, 1)

    this._walkTween?.stop()
    const dist = Phaser.Math.Distance.Between(this.pos.x, this.pos.y, dest.x, dest.y)
    const dur  = Math.max((dist / 95) * 1000, 250)

    this._walkTween = this.scene.tweens.add({
      targets: this.pos,
      x: dest.x, y: dest.y,
      duration: dur, ease: 'Linear',
      onUpdate: () => {
        this.root.x = this.pos.x
        this.shadow.x = this.pos.x
      },
      onComplete: () => {
        this.pos.x = dest.x
        this.pos.y = dest.y
        this.root.setPosition(dest.x, dest.y)
        this.root.setScale(1, 1)
        this.moving = false
        this._resetLimbs()
        onDone?.()
      },
    })
  }

  private _resetLimbs() {
    this.legL.y = 14; this.legR.y = 14
    this.shoe.y = 24; this.shoeR.y = 24
    this.armL.x = -14; this.armR.x = 14
    this.armL.y = 0;  this.armR.y = 0
    this.handL.x = -14; this.handR.x = 14
    this.handL.y = 9;  this.handR.y = 9
  }

  // ── Speech bubble ─────────────────────────────────────────────────────────────
  say(text: string, duration = 2800) {
    this.bubbleTxt.setText(text)
    this.bubble.setVisible(true).setAlpha(1)
    this._bubTimer?.remove()
    this._bubTimer = this.scene.time.delayedCall(duration, () => {
      this.scene.tweens.add({
        targets: this.bubble, alpha: 0, duration: 400,
        onComplete: () => { this.bubble.setVisible(false); this.bubble.setAlpha(1) },
      })
    })
  }

  mute() {
    this.bubble.setVisible(false)
    this._bubTimer?.remove()
  }
}

// ─── Main Scene ────────────────────────────────────────────────────────────────
export class OfficeScene extends Phaser.Scene {
  private agents: Character[] = []
  private runCallback?: () => void
  private _voiceEnabled = true

  // Animated objects
  private clouds: Phaser.GameObjects.Rectangle[] = []
  private serverLEDs: Phaser.GameObjects.Circle[] = []
  private monScreens: Phaser.GameObjects.Rectangle[] = []
  private steamPuffs: Phaser.GameObjects.Circle[] = []
  private clockHand!: Phaser.GameObjects.Line
  private clockMinHand!: Phaser.GameObjects.Line
  private clockCx = 0; clockCy = 0

  private statusBar!: Phaser.GameObjects.Text
  private timeText!: Phaser.GameObjects.Text
  private agentTags: Record<string, Phaser.GameObjects.Text> = {}

  private isRunning = false

  constructor() { super({ key: 'OfficeScene' }) }
  setRunCallback(cb: () => void) { this.runCallback = cb }
  setVoiceEnabled(on: boolean) { this._voiceEnabled = on; if (!on) stopSpeech() }
  triggerStandup() { this._runStandup() }
  private async _say(text: string, agent: 'dev' | 'qa' | 'pm' | 'narrator' = 'narrator') {
    if (this._voiceEnabled) await speak(text, agent)
  }

  // ── create ────────────────────────────────────────────────────────────────────
  create() {
    this._drawRoom()
    this._drawFurniture()
    this._buildAgents()
    this._buildHUD()
    this._buildAmbient()
    this._startIdleLoop()
  }

  // ── Room ──────────────────────────────────────────────────────────────────────
  private _drawRoom() {
    const g = this.add.graphics()

    // Sky behind windows
    g.fillStyle(0x0c1a2e)
    g.fillRect(0, 0, W, 98)

    // Wall
    g.fillStyle(C.wallBrick)
    g.fillRect(0, 0, W, 95)

    // Subtle brick pattern
    g.lineStyle(1, 0x0f1d30, 0.5)
    for (let y = 0; y < 95; y += 14) {
      const offset = (Math.floor(y / 14) % 2) * 30
      for (let x = -offset; x < W; x += 60) g.lineBetween(x, y, x + 58, y)
      for (let x = -offset; x < W; x += 60) g.lineBetween(x + 29, y, x + 29, y + 13)
    }

    // Floor tiles
    g.fillStyle(C.floor)
    g.fillRect(0, 95, W, H - 95)
    g.lineStyle(1, C.floorLine, 0.45)
    for (let x = 0; x <= W; x += 44) g.lineBetween(x, 95, x, H - 38)
    for (let y = 95; y <= H - 38; y += 44) g.lineBetween(0, y, W, y)

    // Carpet runner under desks
    g.fillStyle(C.carpet, 0.5)
    g.fillRoundedRect(60, 170, 700, 80, 4)

    // Carpet under meeting
    g.fillStyle(C.carpet, 0.4)
    g.fillEllipse(400, 355, 280, 100)

    // Skirting board
    g.fillStyle(C.skirting)
    g.fillRect(0, H - 38, W, 38)
    g.lineStyle(1, 0x1e3a5f, 0.4)
    g.lineBetween(0, H - 38, W, H - 38)

    // Wall accent stripe
    g.lineStyle(3, 0x1e3a5f, 0.6)
    g.lineBetween(0, 94, W, 94)

    // Windows
    this._drawWindows(g)
    // Wall clock
    this._drawClock(g, W - 100, 50)
  }

  private _drawWindows(g: Phaser.GameObjects.Graphics) {
    const wins = [75, 210, 360, 510, 660]
    wins.forEach(x => {
      // Sky
      g.fillStyle(0x0c1a2e)
      g.fillRect(x - 35, 4, 70, 82)
      // Pane shine
      g.fillStyle(0x0ea5e9, 0.07)
      g.fillRect(x - 33, 6, 32, 78)
      g.fillRect(x + 1, 6, 32, 78)
      // Frame
      g.lineStyle(2, 0x1e3a5f, 0.8)
      g.strokeRect(x - 35, 4, 70, 82)
      g.lineBetween(x - 1, 4, x - 1, 86)
      g.lineBetween(x - 35, 46, x + 35, 46)
      // Sill
      g.fillStyle(0x0a1628)
      g.fillRect(x - 37, 86, 74, 5)
    })
    // Moving clouds (drawn as rectangles, animated later)
    const cloudPositions = [90, 250, 500, 680]
    cloudPositions.forEach(cx => {
      const cloud = this.add.rectangle(cx, 28, 38, 10, C.cloud, 0.6).setDepth(0)
      this.clouds.push(cloud)
    })
  }

  private _drawClock(g: Phaser.GameObjects.Graphics, cx: number, cy: number) {
    this.clockCx = cx; this.clockCy = cy
    g.fillStyle(0x0a1628)
    g.fillCircle(cx, cy, 22)
    g.lineStyle(2, 0x1e3a5f)
    g.strokeCircle(cx, cy, 22)
    g.lineStyle(1, 0x1e3a5f, 0.4)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2
      g.lineBetween(cx + Math.cos(a) * 17, cy + Math.sin(a) * 17, cx + Math.cos(a) * 20, cy + Math.sin(a) * 20)
    }
    this.clockHand = this.add.line(cx, cy, 0, 0, 0, -14, 0xe2e8f0).setLineWidth(2).setOrigin(0, 0)
    this.clockMinHand = this.add.line(cx, cy, 0, 0, 0, -10, 0x94a3b8).setLineWidth(1.5).setOrigin(0, 0)
  }

  // ── Furniture ─────────────────────────────────────────────────────────────────
  private _drawFurniture() {
    AGENTS_DEF.forEach(a => this._drawDesk(a.desk.x, a.desk.y, a.color))
    this._drawMeetingTable()
    this._drawCoffeeStation()
    this._drawServerRack()
    this._drawWhiteboard()
    this._drawSofa()
    this._drawPrinter()
    ;[30, 795].forEach(x => this._drawPlant(x, 90))
    ;[30, 795].forEach(x => this._drawPlant(x, H - 65))
  }

  private _drawDesk(x: number, y: number, color: number) {
    const g = this.add.graphics()
    // Desk shadow
    g.fillStyle(0x000000, 0.3)
    g.fillRoundedRect(x - 63, y + 12, 126, 55, 4)
    // Desk body
    g.fillStyle(C.deskSurf)
    g.fillRoundedRect(x - 65, y - 8, 130, 55, 5)
    // Desk edge highlight
    g.fillStyle(C.deskEdge)
    g.fillRoundedRect(x - 65, y - 8, 130, 4, { tl: 5, tr: 5, bl: 0, br: 0 })
    // Legs
    g.fillStyle(0x0f1e30)
    g.fillRect(x - 58, y + 44, 8, 22)
    g.fillRect(x + 50, y + 44, 8, 22)
    // Monitor arm
    g.fillStyle(0x0a1628)
    g.fillRect(x - 1, y - 18, 3, 14)
    g.fillRect(x - 14, y - 20, 28, 3)
    // Monitor bezel
    g.fillStyle(0x080f1a)
    g.fillRoundedRect(x - 32, y - 62, 64, 46, 5)
    g.lineStyle(1.5, color, 0.5)
    g.strokeRoundedRect(x - 32, y - 62, 64, 46, 5)
    // Screen (live animated)
    const screen = this.add.rectangle(x, y - 40, 56, 38, 0x071324)
    this.monScreens.push(screen)
    // Keyboard
    g.fillStyle(0x1e2d3d)
    g.fillRoundedRect(x - 30, y + 18, 60, 14, 3)
    // Key grid
    g.fillStyle(0x2a3f5a, 0.7)
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 9; col++)
        g.fillRoundedRect(x - 28 + col * 7, y + 20 + row * 4, 5.5, 3, 1)
    // Mouse
    g.fillStyle(0x1e2d3d)
    g.fillEllipse(x + 40, y + 24, 10, 14)
    g.lineStyle(1, 0x2a3f5a)
    g.lineBetween(x + 40, y + 17, x + 40, y + 22)
    // Coffee mug
    g.fillStyle(color, 0.7)
    g.fillRect(x - 46, y + 14, 10, 13)
    g.fillStyle(0x0a1628)
    g.fillRect(x - 46, y + 14, 10, 2)
    // Papers
    g.fillStyle(0xf8fafc, 0.07)
    g.fillRoundedRect(x + 24, y + 14, 26, 18, 1)
    for (let i = 0; i < 3; i++) g.fillRect(x + 26, y + 17 + i * 5, 20, 2)
    // Chair
    g.fillStyle(C.chair)
    g.fillRoundedRect(x - 18, y + 60, 36, 20, 3)
    g.fillStyle(C.chairPad)
    g.fillRoundedRect(x - 16, y + 62, 32, 16, 2)
    g.fillStyle(C.chair)
    g.fillRect(x - 2, y + 78, 4, 12)
    g.fillEllipse(x, y + 90, 32, 8)
    g.fillStyle(C.chair)
    g.fillRect(x - 18, y + 42, 4, 22)
    g.fillRect(x + 14, y + 42, 4, 22)
  }

  private _drawMeetingTable() {
    const g = this.add.graphics()
    g.fillStyle(0x000000, 0.35)
    g.fillEllipse(401, 352, 216, 80)
    g.fillStyle(C.meeting)
    g.fillEllipse(400, 348, 210, 75)
    g.lineStyle(2, 0x1e3a5f, 0.7)
    g.strokeEllipse(400, 348, 210, 75)
    // Sheen
    g.fillStyle(0xffffff, 0.025)
    g.fillEllipse(388, 335, 110, 28)
    // Laptop
    g.fillStyle(0x1e293b)
    g.fillRoundedRect(373, 328, 42, 26, 2)
    g.fillStyle(0x3b82f6, 0.15)
    g.fillRect(376, 331, 36, 20)
    // Chairs around table
    const cseats = [
      { x: 288, y: 348 }, { x: 512, y: 348 },
      { x: 335, y: 316 }, { x: 465, y: 316 },
      { x: 335, y: 380 }, { x: 465, y: 380 },
    ]
    cseats.forEach(({ x, y }) => {
      g.fillStyle(C.chair)
      g.fillEllipse(x, y, 30, 18)
      g.fillStyle(C.chairPad)
      g.fillEllipse(x, y, 26, 14)
    })
    this.add.text(400, 325, '📋', { fontSize: '13px' }).setOrigin(0.5)
  }

  private _drawCoffeeStation() {
    const g = this.add.graphics()
    // Counter
    g.fillStyle(0x1a2d42)
    g.fillRoundedRect(50, 355, 85, 50, 5)
    g.fillStyle(0x243b6e)
    g.fillRect(50, 355, 85, 4)
    // Machine
    g.fillStyle(0x0a1628)
    g.fillRoundedRect(58, 336, 35, 26, 4)
    g.fillStyle(0xf59e0b, 0.15)
    g.fillRect(62, 340, 26, 16)
    // Button
    g.fillStyle(0xf59e0b)
    g.fillCircle(73, 358, 4)
    // Cup
    g.fillStyle(0xfef3c7, 0.9)
    g.fillRect(99, 357, 14, 16)
    g.fillStyle(0x78350f, 0.5)
    g.fillRect(99, 357, 14, 4)
    // Handle
    g.lineStyle(2, 0xfef3c7, 0.6)
    g.strokeCircle(115, 365, 5)
    // Steam (animated circles stored)
    for (let i = 0; i < 3; i++) {
      const puff = this.add.circle(103 + i * 5, 353 - i * 6, 2 + i, 0xffffff, 0.08)
      this.steamPuffs.push(puff)
    }
    this.add.text(80, 328, '☕', { fontSize: '13px' }).setOrigin(0.5)
    this.add.text(90, 408, 'Coffee', { fontSize: '8px', color: '#334155' }).setOrigin(0.5)
  }

  private _drawServerRack() {
    const g = this.add.graphics()
    g.fillStyle(0x050e1a)
    g.fillRoundedRect(755, 105, 55, 175, 4)
    g.lineStyle(1.5, 0x1e3a5f, 0.6)
    g.strokeRoundedRect(755, 105, 55, 175, 4)
    // Rack units
    for (let i = 0; i < 9; i++) {
      g.fillStyle(i % 4 === 0 ? 0x1e3a5f : 0x0a1628)
      g.fillRoundedRect(759, 110 + i * 18, 47, 15, 2)
      // LED dot
      const led = this.add.circle(799, 117 + i * 18, 2.5, i % 3 === 0 ? 0x22c55e : 0x3b82f6)
      this.serverLEDs.push(led)
    }
    this.add.text(782, 97, '🖥', { fontSize: '12px' }).setOrigin(0.5)
  }

  private _drawWhiteboard() {
    const g = this.add.graphics()
    // Frame
    g.fillStyle(0x0a1628)
    g.fillRoundedRect(218, 94, 208, 98, 3)
    // Surface
    g.fillStyle(C.wboard, 0.9)
    g.fillRoundedRect(222, 97, 200, 90, 2)
    // Drawn content
    g.lineStyle(2, 0x3b82f6, 0.55)
    // Sprint chart
    g.lineBetween(235, 122, 255, 145)
    g.lineBetween(255, 145, 275, 128)
    g.lineBetween(275, 128, 300, 155)
    g.lineBetween(300, 155, 320, 135)
    // Axis lines
    g.lineStyle(1.5, 0x334155, 0.4)
    g.lineBetween(232, 115, 232, 170)
    g.lineBetween(232, 170, 328, 170)
    // Post-it notes
    g.fillStyle(0xfef08a, 0.8)
    g.fillRect(336, 102, 28, 24)
    g.fillStyle(0xfca5a5, 0.8)
    g.fillRect(370, 102, 28, 24)
    g.fillStyle(0x86efac, 0.8)
    g.fillRect(353, 130, 28, 24)
    // Pin dots
    g.fillStyle(0xef4444)
    g.fillCircle(350, 103, 2)
    g.fillCircle(384, 103, 2)
    g.fillCircle(367, 131, 2)
    // Label
    this.add.text(322, 93, 'Sprint Board', { fontSize: '8px', color: '#475569' }).setOrigin(0.5)
  }

  private _drawSofa() {
    const g = this.add.graphics()
    const x = 560, y = 395
    g.fillStyle(C.sofa)
    g.fillRoundedRect(x - 60, y - 12, 120, 36, 7)
    g.fillStyle(0x2e27a0)
    g.fillRoundedRect(x - 60, y - 22, 14, 46, 5)
    g.fillRoundedRect(x + 46, y - 22, 14, 46, 5)
    g.fillRoundedRect(x - 46, y - 24, 92, 14, 4)
    g.fillStyle(C.sofaPad)
    g.fillRoundedRect(x - 44, y - 9, 40, 26, 4)
    g.fillRoundedRect(x + 4, y - 9, 40, 26, 4)
    this.add.text(x, y + 27, 'Lounge', { fontSize: '8px', color: '#4338ca' }).setOrigin(0.5)
  }

  private _drawPrinter() {
    const g = this.add.graphics()
    const x = 218, y = 395
    g.fillStyle(0x0a1628)
    g.fillRoundedRect(x - 28, y - 15, 56, 36, 4)
    g.fillStyle(0x1e293b)
    g.fillRoundedRect(x - 25, y - 12, 50, 20, 3)
    g.fillStyle(0x3b82f6, 0.6)
    g.fillRect(x - 8, y - 5, 16, 4)
    g.fillStyle(0xf8fafc, 0.6)
    g.fillRect(x - 20, y + 8, 40, 4)
    this.add.text(x, y + 27, 'Printer', { fontSize: '8px', color: '#475569' }).setOrigin(0.5)
  }

  private _drawPlant(x: number, y: number) {
    const g = this.add.graphics()
    g.fillStyle(0x1a1512)
    g.fillRect(x - 10, y + 8, 20, 16)
    g.fillStyle(C.plant1)
    g.fillCircle(x, y, 13)
    g.fillStyle(C.plant2)
    g.fillCircle(x - 10, y - 7, 9)
    g.fillCircle(x + 10, y - 7, 9)
    g.fillStyle(0x15803d)
    g.fillCircle(x - 4, y - 15, 7)
    g.fillCircle(x + 4, y - 15, 7)
    // Highlight dot
    g.fillStyle(0xbbf7d0, 0.3)
    g.fillCircle(x + 5, y - 5, 3)
  }

  // ── Agents ────────────────────────────────────────────────────────────────────
  private _buildAgents() {
    AGENTS_DEF.forEach(def => {
      this.agents.push(new Character(this, def))
    })
  }

  // ── HUD ───────────────────────────────────────────────────────────────────────
  private _buildHUD() {
    const g = this.add.graphics()
    g.fillStyle(0x050d1a, 0.96)
    g.fillRect(0, H - 40, W, 40)
    g.lineStyle(1, 0x1e3a5f)
    g.lineBetween(0, H - 40, W, H - 40)

    this.statusBar = this.add.text(12, H - 20, '🏢  Office open — agents on duty', {
      fontSize: '11px', color: '#64748b',
    }).setOrigin(0, 0.5)

    this.timeText = this.add.text(W - 180, H - 20, '', {
      fontSize: '11px', color: '#334155', fontStyle: 'bold',
    }).setOrigin(0, 0.5)

    // Run Now button is rendered outside the canvas in the React UI

    // Agent status tags (under wall)
    AGENTS_DEF.forEach(def => {
      const agentHex = '#' + def.color.toString(16).padStart(6, '0')
      const tag = this.add.text(def.desk.x, 97, `● ${def.name}`, {
        fontSize: '10px', color: agentHex, fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 3,
        shadow: { offsetX: 0, offsetY: 1, color: '#000', blur: 4, fill: true },
      }).setOrigin(0.5)
      this.agentTags[def.id] = tag
    })
  }

  private _setTag(id: string, status: string, active = false) {
    const def = AGENTS_DEF.find(d => d.id === id)!
    const t = this.agentTags[id]
    t.setText(`● ${def.name} — ${status}`)
    const agentCol = '#' + def.color.toString(16).padStart(6, '0')
    t.setColor(active ? agentCol : '#475569')
    t.setAlpha(active ? 1 : 0.6)
  }

  // ── Ambient animations ────────────────────────────────────────────────────────
  private _buildAmbient() {
    // Clock tick
    this.time.addEvent({ delay: 1000, loop: true, callback: this._tickClock, callbackScope: this })
    // Server LED blink
    this.time.addEvent({ delay: 800, loop: true, callback: this._blinkLEDs, callbackScope: this })
    // Monitor content cycle
    this.time.addEvent({ delay: 3000, loop: true, callback: this._cycleScreens, callbackScope: this })
    // Cloud drift
    this.time.addEvent({ delay: 80, loop: true, callback: this._driftClouds, callbackScope: this })
    // Steam puff
    this.time.addEvent({ delay: 600, loop: true, callback: this._puffSteam, callbackScope: this })
    // Wall clock text
    this.time.addEvent({ delay: 1000, loop: true, callback: this._updateClock, callbackScope: this })
  }

  private _tickClock() {
    const now = new Date()
    const sec = now.getSeconds()
    const min = now.getMinutes()
    const hr  = now.getHours() % 12

    const secAngle = (sec / 60) * Math.PI * 2 - Math.PI / 2
    const minAngle = (min / 60) * Math.PI * 2 - Math.PI / 2
    const hrAngle  = ((hr + min / 60) / 12) * Math.PI * 2 - Math.PI / 2

    const cx = this.clockCx, cy = this.clockCy
    this.clockHand.setTo(0, 0, Math.cos(hrAngle) * 14, Math.sin(hrAngle) * 14)
    this.clockMinHand.setTo(0, 0, Math.cos(minAngle) * 10, Math.sin(minAngle) * 10)
  }

  private _blinkLEDs() {
    this.serverLEDs.forEach((led, i) => {
      if (Math.random() > 0.7) {
        const on = Math.random() > 0.3
        led.setFillStyle(i % 3 === 0 ? (on ? 0x22c55e : 0x166534) : (on ? 0x3b82f6 : 0x1d4ed8))
      }
    })
  }

  private _cycleScreens() {
    const screenColors = [0x0d2137, 0x071a2e, 0x0a2744, 0x031020]
    this.monScreens.forEach(s => {
      this.tweens.add({
        targets: s,
        fillColor: screenColors[Math.floor(Math.random() * screenColors.length)],
        duration: 500,
      })
    })
  }

  private _driftClouds() {
    // Windows at x: 75, 210, 360, 510, 660 — clouds should stay within window bounds
    const winBounds = [
      [40, 110], [175, 245], [325, 395], [475, 545], [625, 695]
    ]
    this.clouds.forEach((cloud, i) => {
      cloud.x += 0.12
      const [lo, hi] = winBounds[i % winBounds.length]
      if (cloud.x > hi) cloud.x = lo
    })
  }

  private _puffSteam() {
    this.steamPuffs.forEach((p, i) => {
      p.y -= 0.4
      p.setAlpha(p.alpha - 0.004)
      if (p.alpha <= 0) {
        p.y = 353 - i * 6
        p.setAlpha(0.08)
      }
    })
  }

  private _updateClock() {
    const now = new Date()
    this.timeText.setText(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
  }

  // ── Idle loop ─────────────────────────────────────────────────────────────────
  private _startIdleLoop() {
    // Random chat bubbles at desks
    this.time.addEvent({
      delay: 3200, loop: true, callback: () => {
        if (this.isRunning) return
        this.agents.forEach(a => {
          if (!a.moving && a.state === 'sit' && Math.random() > 0.5) {
            const msgs = CHAT[a.def.id].work
            a.say(msgs[Math.floor(Math.random() * msgs.length)], 2400)
            this._setTag(a.def.id, 'working', true)
          }
        })
      },
    })

    // Wander: each agent independently gets up and goes somewhere
    this.time.addEvent({
      delay: 5500, loop: true, callback: () => {
        if (this.isRunning) return
        const agent = this.agents[Math.floor(Math.random() * this.agents.length)]
        if (agent.moving) return

        const spot = SPOTS[Math.floor(Math.random() * SPOTS.length)]
        const dest = { x: spot.x + (Math.random() - 0.5) * 16, y: spot.y }
        const idle = CHAT[agent.def.id].idle

        this._setTag(agent.def.id, spot.name, true)
        agent.state = 'stand'
        agent.mute()

        agent.walkTo(dest, () => {
          agent.state = 'stand'
          agent.say(idle[Math.floor(Math.random() * idle.length)], 2600)

          this.time.delayedCall(3000 + Math.random() * 1500, () => {
            if (this.isRunning) return
            this._setTag(agent.def.id, 'returning')
            agent.mute()
            agent.walkTo({ ...agent.def.desk }, () => {
              agent.state = 'sit'
              this._setTag(agent.def.id, 'working', true)
              agent.say(CHAT[agent.def.id].work[0], 1800)
            })
          })
        })
      },
    })

    // Agents occasionally talk to each other
    this.time.addEvent({
      delay: 18000, loop: true, callback: () => {
        if (this.isRunning) return
        const a = this.agents[0]
        const b = this.agents[1]
        if (a.moving || b.moving) return
        // Dev walks to QA's desk
        a.walkTo({ x: b.def.desk.x - 45, y: b.def.desk.y + 20 }, () => {
          a.say('Hey, can you review this?', 2200)
          b.say('Sure! Give me a sec...', 2200)
          this.time.delayedCall(2800, () => {
            a.walkTo({ ...a.def.desk }, () => { a.state = 'sit' })
          })
        })
      },
    })
  }

  // ── Standup sequence ──────────────────────────────────────────────────────────
  private async _runStandup() {
    if (this.isRunning) return
    this.isRunning = true
    this.statusBar.setText('🚀  Standup starting...')

    await this._say('Alright everyone, time for standup!', 'narrator')
    await this._walkToMeeting()
    await this._meeting()
    await this._walkToDesks()
    await this._say('Agents are now processing your data. Reports incoming!', 'narrator')
    await this._working()

    this.statusBar.setText('✅  Reports ready — check the Dashboard!')
    await this._say('All done! Check the dashboard for your full report.', 'narrator')
    this.time.delayedCall(600, () => {
      this.isRunning = false
      this.statusBar.setText('🏢  Office open — agents on duty')
      AGENTS_DEF.forEach(d => this._setTag(d.id, 'idle'))
    })
  }

  private _walkToMeeting(): Promise<void> {
    this.statusBar.setText('📋  Heading to standup...')
    AGENTS_DEF.forEach(d => this._setTag(d.id, 'standup', true))
    return new Promise(resolve => {
      let done = 0
      this.agents.forEach((agent, i) => {
        agent.mute()
        agent.state = 'stand'
        agent.walkTo(MEETING_SEATS[i], () => {
          agent.state = 'meeting'
          if (++done === this.agents.length) this.time.delayedCall(300, resolve)
        })
      })
    })
  }

  private async _meeting(): Promise<void> {
    this.statusBar.setText('📋  Daily standup in progress...')

    const lines: { idx: number; bubble: string; spoken: string }[] = [
      { idx: 0, bubble: '✅ Shipped 3 PRs',         spoken: 'I shipped 3 pull requests yesterday and fixed the auth bug.' },
      { idx: 1, bubble: '🐛 2 bugs found',           spoken: 'Found 2 bugs in the checkout flow. Logging them now.' },
      { idx: 2, bubble: '🎯 Sprint 74% done',        spoken: 'Sprint is 74% complete. On track to deliver Friday.' },
      { idx: 0, bubble: 'No blockers today!',        spoken: 'No blockers on my end. Starting the API refactor.' },
      { idx: 1, bubble: 'Test coverage: 91% ✓',      spoken: 'Test coverage is at 91%. End to end tests all passing.' },
      { idx: 2, bubble: '🚀 Confidence: 8/10',       spoken: 'Delivery confidence is 8 out of 10. We ship Friday.' },
    ]

    const ids: Array<'dev' | 'qa' | 'pm'> = ['dev', 'qa', 'pm']
    for (const line of lines) {
      this.agents.forEach(a => a.mute())
      this.agents[line.idx].say(line.bubble, 3500)
      // Speaker nod
      this.tweens.add({
        targets: this.agents[line.idx].root,
        y: MEETING_SEATS[line.idx].y - 3,
        duration: 100, yoyo: true,
      })
      await this._say(line.spoken, ids[line.idx])
    }
    this.agents.forEach(a => a.mute())
    await this._delay(300)
  }

  private _walkToDesks(): Promise<void> {
    this.statusBar.setText('💻  Back to work...')
    return new Promise(resolve => {
      let done = 0
      this.agents.forEach(agent => {
        agent.mute()
        agent.walkTo({ ...agent.def.desk }, () => {
          agent.state = 'sit'
          this._setTag(agent.def.id, 'generating report', true)
          agent.say('🤖 AI thinking...', 9000)
          if (++done === this.agents.length) this.time.delayedCall(200, resolve)
        })
      })
    })
  }

  private _working(): Promise<void> {
    this.statusBar.setText('🤖  AI processing GitHub + Jira data...')
    this.runCallback?.()
    return new Promise(resolve => {
      let tick = 0
      const ev = this.time.addEvent({
        delay: 1100, repeat: 9, callback: () => {
          this.agents.forEach(agent => {
            const msgs = CHAT[agent.def.id].work
            agent.say(msgs[tick % msgs.length], 900)
            // Monitor flash
            this.monScreens.forEach(s => {
              this.tweens.add({ targets: s, fillColor: 0x1d4ed8, duration: 180, yoyo: true })
            })
          })
          if (++tick >= 10) {
            ev.remove()
            this.agents.forEach(a => {
              a.mute()
              a.say('📄 Report done!', 2000)
              this._setTag(a.def.id, 'done ✓', true)
            })
            this.time.delayedCall(2200, resolve)
          }
        },
      })
    })
  }

  private _delay(ms: number): Promise<void> {
    return new Promise(r => this.time.delayedCall(ms, r))
  }

  // ── update ────────────────────────────────────────────────────────────────────
  update(time: number, delta: number) {
    this.agents.forEach(a => a.update(time, delta))
  }
}
