<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/f22833a0-2e57-4808-88ad-ae8d5e769df0

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploying to Render (render.com)

This application is ready for 1-click deployment on Render with both Frontend & Backend served in a single web service.

### Option 1: Render Blueprint (Easiest)
1. Go to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** and select **Blueprint**.
3. Connect your repository: `chmounikaxyz-ui/BORDER_SURVEILLANCE`.
4. Render will automatically read [`render.yaml`](render.yaml) and configure the service.
5. Click **Apply**.

### Option 2: Manual Web Service Setup
1. In Render Dashboard, click **New +** → **Web Service**.
2. Select **Build and deploy from a Git repository** and pick your repo.
3. Configure settings:
   - **Name**: `border-surveillance` (or your choice)
   - **Language / Runtime**: `Python 3`
   - **Branch**: `main`
   - **Build Command**:
     ```bash
     pip install --upgrade pip && pip install --no-cache-dir -r requirements.txt
     ```
   - **Start Command**:
     ```bash
     python -m uvicorn backend.main:app --host 0.0.0.0 --port $PORT
     ```
   - **Plan**: `Free`
4. Expand **Advanced**:
   - **Health Check Path**: `/health`
   - **Environment Variables**:
     - `PYTHON_VERSION`: `3.11.9`
     - `YOLO_CONFIG_DIR`: `/tmp/Ultralytics`
5. Click **Create Web Service**.
