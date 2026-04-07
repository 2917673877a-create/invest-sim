This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Deploy to Cloudflare Pages (Static Export)

This project is configured for **static export**. Running `npm run build` will generate the site into the `out/` directory.

### Option A: Connect GitHub repo (recommended)

- Push this project to a GitHub repository
- In Cloudflare Dashboard → Pages → **Create a project** → connect your repo
- Set build settings:
  - **Framework preset**: None
  - **Build command**: `npm ci && npm run build`
  - **Build output directory**: `out`

### Option B: Deploy from your computer (CLI)

1) Login once:

```bash
npx wrangler login
```

2) Build and deploy:

```bash
npm run pages:deploy
```

Cloudflare will print the deployed URL in the output.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Notes

- If `npm run dev` shows port 3000 is busy, it will automatically use 3001/3002 (check terminal output).
