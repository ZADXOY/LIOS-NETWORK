# Last Island of Survival — Survivor Chat

A real-time chat app for Last Island of Survival players with:
- 7 themed game channels (General, Trading, PvP, Guild Recruitment, Help, Base Building, Off-Topic)
- Legion system with leader-only task assigner, member management, notice board
- Legion approval flow (admin must approve new legions)
- 24-hour cooldown after leaving a legion
- Email + password authentication with admin verification
- Admin control panel for verifying users and approving legions
- Legion raid planning chat (private to legion members)
- Recruitment button (posts to Guild Recruitment channel)
- Custom legion logos (upload or preset emojis)

## Quick Start

### Prerequisites
- Node.js 20+ or Bun
- A Caddy gateway (or any reverse proxy that supports query-based port forwarding)

### Install
```bash
bun install
cd mini-services/chat-service && bun install
```

### Database
The app uses SQLite via Prisma. The DB file lives at `db/custom.db`.

```bash
bun run db:push
```

### Run
1. Start the Next.js dev server:
   ```bash
   bun run dev
   ```
2. Start the chat-service mini-service (in another terminal):
   ```bash
   cd mini-services/chat-service
   bun run dev
   ```
   Or use the launcher script:
   ```bash
   bash scripts/start-chat-service.sh
   ```

3. Open `http://localhost:81/` (through the Caddy gateway) or `http://localhost:3000/` directly.

### Admin Account
The admin email is `zadxoy@gmail.com`. The first time someone signs up with this email, they automatically become the verified admin. To reset the admin password:

```bash
bun -e "
const { scryptSync, randomBytes } = require('crypto');
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const salt = randomBytes(16).toString('hex');
const hash = scryptSync('NEW_PASSWORD', salt, 64).toString('hex');
db.user.update({
  where: { email: 'zadxoy@gmail.com' },
  data: { passwordHash: salt + ':' + hash, sessionToken: null }
}).then(() => { console.log('Done'); process.exit(0); });
"
```

## Architecture

```
Next.js (port 3000)  ←→  Caddy gateway (port 81)  ←→  socket.io chat-service (port 3003)
       ↓
   Prisma + SQLite (db/custom.db)
```

- **Frontend**: Next.js 16 + TypeScript + Tailwind CSS 4 + shadcn/ui
- **Backend**: socket.io 4.8 (mini-service on port 3003) for real-time chat + Next.js API routes for auth/uploads
- **Database**: Prisma ORM with SQLite
- **Auth**: Custom email+password with scrypt hashing and session tokens (no NextAuth)

## File Structure

```
mini-services/chat-service/
  ├ package.json          (socket.io dep)
  └ index.ts              (port 3003, game channels + legion logic)

src/app/
  ├ layout.tsx            (dark theme + metadata + favicon)
  ├ globals.css           (survival island palette, animations, scrollbar)
  ├ page.tsx              (main chat UI: auth gate + 3-pane layout + admin panel)
  └ api/
      ├ auth/
      │   ├ login/route.ts
      │   ├ signup/route.ts
      │   ├ verify-token/route.ts
      │   └ update-cooldown/route.ts
      ├ admin/
      │   ├ pending-users/route.ts
      │   └ verify-user/route.ts
      └ legion-upload/route.ts   (POST handler for legion logo uploads)

src/components/
  ├ auth-gate.tsx         (email + password login/signup)
  ├ admin-panel.tsx       (verify users + approve legions)
  ├ legion-panel.tsx      (Chat/Tasks/Members/Raids tabs)
  ├ legion-onboarding.tsx (Create vs Join flow + logo picker)
  ├ assign-task-dialog.tsx
  └ ui/                   (shadcn/ui components)

src/lib/
  ├ auth.ts               (scrypt hashing, session tokens, cooldown logic)
  ├ chat-types.ts         (shared TS types)
  └ db.ts                 (Prisma client)

prisma/
  └ schema.prisma         (User model with email, passwordHash, verified, isAdmin, legionLeftAt, inGameLegionId)

public/
  ├ app-logo.webp         (your uploaded app logo)
  └ uploads/legions/      (uploaded legion logos)

scripts/
  └ start-chat-service.sh (daemon launcher for the chat service)
```

## Key Features

### Authentication
- Email + password signup (password hashed with scrypt + random salt)
- New accounts require admin verification before they can log in
- The admin email (`zadxoy@gmail.com`) is auto-verified + gets admin privileges
- Session tokens stored in localStorage, validated via `/api/auth/verify-token`

### Legion System
- **Create**: Founder becomes leader. Requires in-game Legion ID. Legion is created as `pending` status.
- **Admin Approval**: Admin sees pending legions in the Admin Panel with leader email + in-game ID. Approve → legion goes live. Reject → legion is deleted.
- **Join**: Browse approved legions, one-click join. 24-hour cooldown if you recently left a legion.
- **Leader Powers**: Assign tasks, kick members, post/edit notice, disband legion, post recruitment messages.
- **Member Powers**: See own tasks, mark them in-progress/done/failed, see other members, leave the legion.

### Raid Planning
- Moved from the public channels into legions. Each legion has a private Raid Planning chat tab.
- Only legion members can see and participate.

### Recruitment
- Leader clicks "Recruit" in the legion panel, writes a reason/pitch.
- A formatted recruitment message is posted to the public Guild Recruitment channel.
- The message includes legion name, tag, logo, the leader's pitch, in-game ID, and contact info.

### Legion Logos
- Pick from 18 preset emoji crests, OR
- Upload a custom image (PNG/JPEG/WebP/GIF/SVG, max 2MB) via `/api/legion-upload`.
- Logos render in the sidebar, legion panel header, and join list.

## Lint
```bash
bun run lint
```

## License
Private project.
