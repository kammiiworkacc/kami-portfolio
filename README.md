# Kami — portfolio + admin

Your portfolio website, plus an admin page where you can change everything without writing code.

- **The site:** every page reads its words, numbers, projects and images from one file, `content.json`.
- **The admin:** open `/admin/` on your site. Change things in simple forms, watch the live preview, then tap **Save & publish**. The admin saves `content.json` (and any new images) to your GitHub repo, and Vercel puts the new version live about a minute later.

---

## 1. Make a GitHub token (one time, about 2 minutes)

The token is the key that lets the admin save to your repo. You make it on GitHub, then paste it into the admin.

1. Go to **github.com** and sign in.
2. Tap your **profile picture** (top right) → **Settings**.
3. In the left menu, scroll all the way down → **Developer settings**.
4. **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
5. Fill it in:
   - **Token name:** `Portfolio admin`
   - **Expiration:** pick the longest option you're happy with (for example 1 year). When it runs out, just make a new one.
   - **Resource owner:** your account (`kammiiworkacc`).
   - **Repository access:** choose **Only select repositories**, then pick **kami-portfolio**.
   - **Permissions** → **Repository permissions** → find **Contents** → set it to **Read and write**. (GitHub adds "Metadata: Read-only" by itself. That's normal.)
6. Tap **Generate token** at the bottom, then **copy** the token. It starts with `github_pat_`. GitHub only shows it once.
7. Open your site's admin (`https://YOUR-SITE/admin/`), type your passcode, then go to **Settings → Connect GitHub**. (Or just tap **Save & publish** and it will ask.) Paste the token and tap **Connect**.

The token is saved **only in that browser** (on your phone or PC). It is never put on the website or in the repo. On a computer other people use, tap **Settings → Sign out** when you're done.

**Never send your token to anyone.** If you think someone saw it, delete it on GitHub (same page as step 4) and make a new one.

---

## 2. Put the site on Vercel (one time)

Your repo is already set up for Vercel, so nothing needs changing.

1. Go to **vercel.com** → **Sign Up** (or Log In) → **Continue with GitHub**.
2. Tap **Add New…** → **Project**.
3. Find **kami-portfolio** in the list and tap **Import**.
   (If you don't see it, tap **Adjust GitHub App Permissions** and allow Vercel to see that repo.)
4. Don't change any settings. Tap **Deploy**.
5. After about a minute you get your address, for example `https://kami-portfolio.vercel.app`. That's the link for your bio.

From now on, every **Save & publish** in the admin makes Vercel update the site by itself, usually in under a minute.

Optional: in the admin's **Settings**, paste your site address into "Live site address". Then the "Published" message gets an **Open site** link.

---

## 3. How to edit

1. Open `https://YOUR-SITE/admin/`.
2. Type your passcode. (The first time on a device, you create one. It gets saved to your repo on your next publish, so your other devices use the same one.)
3. Pick a section at the top: **Profile, Projects, Home page, About, Skills, Contact, Link previews, Settings.**
4. Change anything. The preview updates as you type: on a PC it's on the right; on your phone tap **Preview**.
5. **Projects:** tap one to open it. Use **↑ ↓** to reorder, **✕** to delete, and **+ Add project** for a new one. **Upload image** adds a cover; it's shrunk automatically so the site stays fast.
6. Tap **Save & publish**. When you see **"Published ✓ live in ~1 min"**, you're done.

To change the big picture behind your name, go to **Profile → Hero background** and tap **Replace image** (wide pictures look best).

Your edits are kept on the device until you publish, so closing the page won't lose them. **Settings → Discard unsaved changes** throws them away.

About the passcode: it only hides the editor from visitors. The real protection is the GitHub token. Without it, nobody can save anything to your site.

---

## For the curious: what's in here

```
index.html            home page shell
work/index.html       all projects
work/project.html     one template for every project page (/work/<slug>/)
about/ skills/ contact/   the other pages
404.html              not-found page
content.json          ALL the words, numbers, projects and image paths
render.js             builds each page from content.json in the browser
main.js               smooth scrolling, text reveals, count-up, page transitions, contact form
intro.js              the KAMI slice intro (home page, once per visit; off for reduced motion)
boot.js, styles.css   early setup and the design
img/ images/          images (images/hero.jpg + hero.webp = the hero background; the admin uploads new ones to images/)
fonts/                Inter fonts
admin/                the editor (noindex: search engines skip it)
vercel.json           sends /work/<anything>/ to the project template
```

- There's no build step. Vercel serves the files as they are.
- The contact form sends through FormSubmit to the "Form sends to" email in **Contact**. A new address needs one click on the "Activate" email FormSubmit sends the first time.
- Shared-link previews (WhatsApp, Discord and so on) use the default title, description and `og.jpg` built into each page file.
