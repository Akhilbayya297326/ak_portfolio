# Akhil's portfolio

A dark developer portfolio for Bayya Akhil, built with HTML, CSS, and JavaScript. The main page brings together the introduction, skills, filterable projects, certificates, and contact details, with project case studies, image lightboxes, and a downloadable résumé.

The site is fully static. There is no backend, database, API key, environment variable, or runtime dependency to configure. Contact actions use the links shown on the site.

Interactions include project category filters, certificate and project image viewing, and copying the contact email address. Navigation and dialogs support the keyboard, and animations respect the visitor's reduced-motion preference.

## Run locally

Install Node.js 20 or later, then run from this directory:

```sh
npm run dev
```

Open `http://127.0.0.1:4173`. To use another port:

```sh
npm run dev -- --port 3000
```

No `npm install` step is needed because the project has no dependencies.

## Build and preview

```sh
npm run build
npm run preview
```

The build validates the required source files and creates a fresh `dist/` containing only the website and its assets. Preview serves that output at `http://127.0.0.1:4173`.

## Deploy on Vercel

1. Push this repository to GitHub.
2. In Vercel, add a new project and import `Akhilbayya297326/ak_portfolio`.
3. Keep the root directory at the repository root. The included `vercel.json` sets the build command to `npm run build`, the output directory to `dist`, and the framework preset to Other.
4. Deploy. No environment variables are required.

Vercel will create a new deployment when changes are pushed to the connected branch. The source is also compatible with any static host that serves the contents of `dist/`.

## Edit content

- `index.html`: all portfolio sections and main page content.
- `projects.html` and `certifications.html`: compatibility redirects to their sections on the main page.
- `styles.css`: dark palette, layout, typography, and responsive styling.
- `app.js`: project case study content, filters, lightboxes, navigation, and other browser interactions.
- `images/`: profile, project, and certificate images.
- `assets/Bayya_Akhil_Resume.pdf`: downloadable résumé.
- `favicon.svg`: site icon.
- `social-preview.png`: social sharing image; `social-preview.svg` is its editable source.

After editing, run `npm run build` and check the result with `npm run preview` before pushing.

Run `npm test` for the nine interaction checks covering project filters, case studies, keyboard navigation, photo previews, clipboard fallback, reduced motion, and reading progress. The portfolio has also been checked in the browser at phone, tablet, and desktop widths.

After choosing your public domain, set the social image metadata in `index.html` to the full URL of `social-preview.png` on that domain for the most reliable shared-link previews.
