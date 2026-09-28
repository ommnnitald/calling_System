# 🍃 MongoDB in StreamCall — Layman's Complete Guide

Welcome! This guide explains **how MongoDB works in this calling system**, **what data is saved**, and **what the actual code looks like** in simple, plain English without confusing jargon.

---

## 1. What is MongoDB in Plain English?

Think of MongoDB like a **smart digital filing cabinet**:

| Real-World Filing Cabinet | MongoDB Equivalent | In This App |
| :--- | :--- | :--- |
| **The whole cabinet** | **Database** | `streamcall` |
| **A drawer / folder** | **Collection** | `users`, `callrecords`, `recordings` |
| **A sheet of paper inside** | **Document** | One user's profile, or one meeting call's details |
| **The written items on paper** | **Fields / Values** | `name: "Prakhar"`, `durationSeconds: 120` |

Unlike old-school SQL databases that force everything into rigid Excel-like tables with rows and columns, MongoDB stores data in **JSON documents** (key-value pairs) — exactly how JavaScript and modern web apps work!

---

## 2. Where is MongoDB Running?

- **Database URL**: `mongodb://127.0.0.1:27017/streamcall`
- **Port**: `27017` (default MongoDB port)
- **Database Name**: `streamcall`
- **Node.js Bridge**: We use an industry-standard library called **Mongoose** (`mongoose`) that connects our Node/Express backend to MongoDB.

```text
[ React Web / Android App ]
            │
      HTTP & WebSockets
            ▼
   [ Node.js Backend ]
            │
        Mongoose
            ▼
     [ MongoDB Server ] ──▶ Saves to disk on your PC
```

---

## 3. What Data Is Actually Stored?

StreamCall stores 3 types of information across 3 collections:

### 📁 Collection 1: `users`
Stores user accounts for authentication and profiles.

```json
{
  "_id": "66ea...b01",
  "name": "Prakhar",
  "email": "prakhar@example.com",
  "password": "$2a$10$e8K7b... (Securely Hashed Password)",
  "avatarColor": "from-emerald-500 to-teal-500",
  "createdAt": "2026-09-21T10:00:00.000Z",
  "updatedAt": "2026-09-21T10:00:00.000Z"
}
```
* **Security note**: Passwords are never saved as plain text. They are automatically scrambled with `bcryptjs` hashing before touching MongoDB.

---

### 📁 Collection 2: `callrecords`
Stores meeting analytics and call history whenever users start and finish calls.

```json
{
  "_id": "66ea...b02",
  "roomId": "team-standup",
  "hostName": "Prakhar",
  "status": "completed",
  "startedAt": "2026-09-22T04:10:00.000Z",
  "endedAt": "2026-09-22T04:25:00.000Z",
  "durationSeconds": 900,
  "maxConcurrentPeers": 3,
  "participants": [
    {
      "displayName": "Prakhar (Host)",
      "joinedAt": "2026-09-22T04:10:00.000Z",
      "leftAt": "2026-09-22T04:25:00.000Z"
    },
    {
      "displayName": "Alex (Phone)",
      "joinedAt": "2026-09-22T04:12:00.000Z",
      "leftAt": "2026-09-22T04:24:00.000Z"
    }
  ]
}
```
* Shows who joined, when they entered and left, total call duration, and peak participants.

---

### 📁 Collection 3: `recordings`
Stores metadata for recorded meeting videos (the actual `.webm` video files are saved in the `server/recordings/` folder on disk).

```json
{
  "_id": "66ea...b03",
  "roomId": "team-standup",
  "hostName": "Prakhar",
  "fileName": "recording-team-standup-1727001000.webm",
  "fileSize": 1428500,
  "durationSeconds": 900,
  "mimeType": "video/webm",
  "createdAt": "2026-09-22T04:25:00.000Z"
}
```

---

## 4. How Does the Code Work? (With Real Code Examples)

All database code lives in the `server/src/` folder:
- **Connection manager**: `server/src/db.ts`
- **Data Blueprints (Models)**: `server/src/models/`

### Step A: Defining the Blueprint (Schema)
Before saving anything, we tell MongoDB what fields are allowed.

Here is the simplified code from `server/src/models/User.ts`:

```typescript
import mongoose, { Schema } from 'mongoose';

// 1. Blueprint: What a User looks like
const UserSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatarColor: { type: String, default: 'from-emerald-500 to-teal-500' }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt dates!
});

// 2. Export the model so we can use it in our app
export const User = mongoose.model('User', UserSchema);
```

---

### Step B: Connecting to MongoDB
In `server/src/db.ts`:

```typescript
import mongoose from 'mongoose';

export async function connectDatabase() {
  const uri = 'mongodb://127.0.0.1:27017/streamcall';
  
  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB!');
  } catch (error) {
    console.warn('MongoDB not reachable, using local fallback store.');
  }
}
```
* **Smart Fallback**: If MongoDB is ever stopped or not installed on someone's machine, the app automatically falls back to `streamcall-store.json` on disk, and seamlessly syncs to MongoDB as soon as it reconnects.

---

### Step C: How Data is Saved & Queried

#### 1. Creating a New User (Signup):
```typescript
// When someone signs up:
const newUser = await User.create({
  name: 'Prakhar',
  email: 'prakhar@example.com',
  password: 'mySecretPassword123'
});
// MongoDB automatically generates a unique "_id" and saves it!
```

#### 2. Finding an Existing User (Login):
```typescript
// When someone logs in, look them up by email:
const user = await User.findOne({ email: 'prakhar@example.com' }).select('+password');

// Check if password matches:
const isCorrect = await user.comparePassword('mySecretPassword123');
```

#### 3. Tracking Calls in Real-Time:
When participants join or leave a WebRTC room:
```typescript
// Add a call record:
await CallRecord.create({
  roomId: 'daily-sync',
  hostName: 'Prakhar',
  status: 'active',
  startedAt: new Date()
});

// When call ends, update the status and duration:
await CallRecord.updateOne(
  { roomId: 'daily-sync', status: 'active' },
  { status: 'completed', endedAt: new Date(), durationSeconds: 300 }
);
```

---

## 5. How to View Your Data (Hands-On)

### Method 1: Using the Interactive GUI (MongoDB Compass)
1. Download or open **MongoDB Compass** (free official visual tool).
2. In the connection box, paste:
   ```text
   mongodb://127.0.0.1:27017
   ```
3. Click **Connect**.
4. You will see the database named `streamcall`.
5. Click on `users`, `callrecords`, or `recordings` to click through, edit, or delete any record visually!

---

### Method 2: Via Terminal Command (`mongosh`)
If you have MongoDB shell installed, run:
```bash
mongosh mongodb://127.0.0.1:27017/streamcall
```
Then run:
```javascript
// Show all users:
db.users.find().pretty()

// Show all call records:
db.callrecords.find().pretty()

// Count total calls made:
db.callrecords.countDocuments()
```

---

## Summary Cheat Sheet

| Question | Answer |
| :--- | :--- |
| **What is MongoDB?** | A document database that stores records as easy-to-read JSON objects instead of rigid tables. |
| **Where is our database?** | `mongodb://127.0.0.1:27017/streamcall` |
| **What do we store?** | User logins (`users`), call history (`callrecords`), and saved video info (`recordings`). |
| **What does Mongoose do?** | It acts as the translator in Node.js to validate data, enforce schemas, and talk to MongoDB. |
| **What if MongoDB is down?** | The app automatically uses an emergency JSON file on disk and syncs everything to MongoDB once it's back up. |
