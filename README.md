# GPTest (POC)

AI-assisted grading with rubrics, Firebase auth/data, and teacher review of submissions.

## For collaborators — run locally

### Prerequisites

- **Node.js** 20+ (or current LTS)
- **Git**
- Access to the **same Firebase project** as the team (see `firebase-applet-config.json`) **or** your own Firebase app + Firestore rules (ask the repo owner)

### 1. Clone the repo

```bash
git clone <YOUR_REPO_URL>
cd GPTest-POC
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment variables

Copy the example env file and add your OpenAI API key (needed for automatic grading):

```bash
cp .env.example .env
```

Edit `.env` and set:

```bash
OPENAI_API_KEY=sk-...your-key...
```

`.env` is gitignored; never commit real keys.

### 4. Firebase (important)

The app uses a **named** Firestore database (see `firestoreDatabaseId` in `firebase-applet-config.json`). Firestore **security rules** must be deployed to **that** database, not only `(default)`.

- **Console:** Firebase → Firestore → choose the database with that ID from the dropdown → **Rules** → paste/deploy `firestore.rules`.
- **CLI:** From this repo, with Firebase CLI logged in: `firebase deploy --only firestore:rules` (see `firebase.json` for the target database).

**Google sign-in:** In Firebase → Authentication → Settings → **Authorized domains**, add `localhost` (and your deployment domain if you host the app).

### 5. Start the dev server

```bash
npm run dev
```

Open **http://localhost:3000** (Express serves the app and `/api/grade`). Do not run `vite` alone for full features—grading needs the API on the same origin.

### 6. Lint (optional)

```bash
npm run lint
```

---

## For the repo owner — push to GitHub

If this folder is not a Git repo yet:

```bash
cd /path/to/GPTest-POC
git init
git add .
git commit -m "Initial GPTest POC"
```

Create an empty repository on GitHub (no README/license if you already have them locally), then:

```bash
git remote add origin https://github.com/<YOUR_USER>/<YOUR_REPO>.git
git branch -M main
git push -u origin main
```

If the repo already exists and you only need to push updates:

```bash
git status
git add .
git commit -m "Describe your changes"
git push
```

**Do not commit** `.env` or other secrets (they are in `.gitignore`).

---

## Original AI Studio link (optional)

View in AI Studio: https://ai.studio/apps/9667486d-fba1-4a51-ab55-63a8264bd412
