# Deploy Guide: Render + Neon

## Архитектур (Deploy)

```
┌──────────────┐     ┌──────────────┐     ┌──────────┐
│   Render     │     │   Render     │     │   Neon   │
│  Static Site │────▶│  Web Service │────▶│PostgreSQL│
│  (Frontend)  │     │  (Backend)   │     │  (Free)  │
│              │     │              │     │          │
│  React SPA   │     │ Unified API  │     │  mbank   │
│  Vite build  │     │ Express+TS   │     │          │
└──────────────┘     └──────────────┘     └──────────┘
     CDN               Free tier           Free tier
     Free               750hrs/mo          0.5GB storage
```

## Алхам 1: Neon PostgreSQL (Free)

1. https://neon.tech руу орж бүртгүүлэх
2. "New Project" → "m-bank" нэртэй project үүсгэх
3. Region: US East (эсвэл ойрхон)
4. Connection string хуулж авах:
   ```
   postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/mbank?sslmode=require
   ```

## Алхам 2: GitHub Repository

```bash
cd m-bank
git add -A
git commit -m "feat: m-bank invoice exchange system"
git remote add origin https://github.com/YOUR_USERNAME/m-bank.git
git push -u origin main
```

## Алхам 3: Render Backend Deploy

1. https://render.com руу орж GitHub-аар нэвтрэх
2. "New" → "Web Service"
3. GitHub repo-оо сонгох (m-bank)
4. Тохиргоо:
   - **Name**: m-bank-api
   - **Region**: Oregon
   - **Runtime**: Node
   - **Build Command**:
     ```
     npm install && npx tsc --project packages/shared-types/tsconfig.json && npx tsc --project packages/shared-utils/tsconfig.json && npx tsc --project packages/shared-middleware/tsconfig.json && npx tsc --project services/unified-server/tsconfig.json
     ```
   - **Start Command**:
     ```
     node services/unified-server/dist/index.js
     ```
   - **Plan**: Free

5. Environment Variables:
   | Key | Value |
   |-----|-------|
   | NODE_ENV | production |
   | DATABASE_URL | (Neon connection string) |
   | JWT_SECRET | (random string, 32+ chars) |
   | FRONTEND_URL | https://m-bank-frontend.onrender.com |

6. "Create Web Service" дарах

## Алхам 4: Render Frontend Deploy

1. "New" → "Static Site"
2. GitHub repo сонгох (m-bank)
3. Тохиргоо:
   - **Name**: m-bank-frontend
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Publish Directory**: `frontend/dist`

4. Environment Variables:
   | Key | Value |
   |-----|-------|
   | VITE_API_URL | https://m-bank-api.onrender.com |

5. Redirect/Rewrite Rules:
   - Source: `/*` → Destination: `/index.html` (Rewrite)
   - (SPA routing-д шаардлагатай)

6. "Create Static Site" дарах

## Алхам 5: Frontend Vite Config засах

`frontend/vite.config.ts` дээр proxy-г production-д хасах:

```typescript
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
```

Frontend `api/client.ts` дээр baseURL зөв тохируулах:
```typescript
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});
```

## Шалгах

1. Backend: `https://m-bank-api.onrender.com/health`
   ```json
   {"status":"ok","service":"m-bank-unified"}
   ```

2. Frontend: `https://m-bank-frontend.onrender.com`
   - Login хуудас харагдана
   - `maker_a` / `password123` нэвтрэх

## Анхаарах зүйлс

- **Free tier sleep**: 15 минут идэвхгүй бол service унтана. Эхний хүсэлтэд ~30 секунд хүлээнэ.
- **Neon free tier**: 0.5GB storage, 190 compute hours/сар
- **Render free tier**: 750 hours/сар, custom domain дэмжинэ
- **Mock Finacle**: Unified server дотор in-memory ажиллана (restart хийхэд balance reset болно)

## Өөр сонголтууд

### Vercel (Frontend only)
```bash
cd frontend
npx vercel --prod
```
Environment: `VITE_API_URL=https://m-bank-api.onrender.com`

### Railway (All-in-one)
```bash
# Railway CLI
npm i -g @railway/cli
railway login
railway init
railway up
```
Railway нь PostgreSQL, Redis суулгаж, Docker Compose шууд дэмжинэ.
