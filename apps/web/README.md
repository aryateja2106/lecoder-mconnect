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

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_DEMO_MODE` | Set to `true` to enable demo mode with mock WebSocket data | Yes (for demo) |
| `NEXT_PUBLIC_APP_URL` | Application URL for absolute URLs and metadata | Optional |

## Deploy on Vercel

### Quick Deploy (Demo Mode)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_DEMO_MODE` = `true`
3. Deploy

The app will automatically run in demo mode with pre-recorded terminal sessions.

### Vercel CLI Deploy

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy with demo mode
cd apps/web
vercel --env NEXT_PUBLIC_DEMO_MODE=true
```

### Verify Deployment

After deployment, check the health endpoint:

```bash
curl https://your-domain.vercel.app/api/health
# Should return: {"status":"ok","version":"0.1.7","mode":"demo",...}
```

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
