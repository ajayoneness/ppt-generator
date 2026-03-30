# ⚡ AI PPT Generator

> Generate a complete **15-slide professional project presentation** in seconds — powered by **Groq AI (Llama 4 Scout)**, **pptxgenjs**, and **Puppeteer** for automatic YouTube screenshot capture.

Live at → **[pptx.codeaj.com](https://pptx.codeaj.com)**

---

## ✨ Features

| Feature | Details |
|---|---|
| 🤖 AI Content | Groq Llama 4 Scout generates all 15 slides of content specific to your project |
| 📊 15 Slides | Title, Abstract, Introduction, Literature Survey, Proposed System, Requirements, Architecture, Modules, Tech & Models, Screenshots, Testing, Results, Conclusion, References, Thank You |
| 📽 Auto Screenshots | Provide a YouTube demo video URL → 4 frames captured automatically from random timestamps |
| 🎨 8 Color Themes | Tech Blue, Purple AI, Green Nature, Orange Culinary, Red Enterprise, Teal Health, Gold Education, Dark Minimal — or **Auto-detect** based on project keywords |
| 📊 Live Progress Bar | Real-time SSE progress stream per job — watch slides build live |
| 🗂 Multi-Job Dashboard | Queue multiple PPTs simultaneously, each with independent progress tracking |
| ⬇ Manual Download | Files stay on server until you click Download (auto-cleaned after 1 hour) |
| 🔑 API Config | Swap the Groq API key from the Settings page — saved in browser localStorage |
| 🔒 Login | Protected by hardcoded admin credentials |

---

## 🖥 Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express |
| AI / LLM | [Groq API](https://console.groq.com) — `meta-llama/llama-4-scout-17b-16e-instruct` |
| Slides | [pptxgenjs](https://gitbrent.github.io/PptxGenJS/) |
| Screenshots | Puppeteer (headless Chrome) |
| Video Download | yt-dlp |
| Image Processing | Sharp |
| Icons | react-icons (rendered server-side via React + Sharp) |
| Frontend | Vanilla JS SPA (no framework) |
| Process Manager | PM2 |
| Reverse Proxy | Nginx |
| SSL | Let's Encrypt (Certbot) |

---

## 🚀 Quick Start (Local)

### Prerequisites
- Node.js 18+
- `yt-dlp` installed (`pip install yt-dlp` or [download binary](https://github.com/yt-dlp/yt-dlp/releases))
- `ffmpeg` installed

### Run locally

```bash
# Clone
git clone https://github.com/ajayoneness/ppt-generator.git
cd ppt-generator

# Install dependencies
npm install

# Start server
npm start
```

Open **http://localhost:3000**

**Login:**
- Email: `admin@codeaj.com`
- Password: `@J@y2263`

---

## 📋 How to Use

1. **Log in** with the admin credentials
2. Click **+ New Presentation**
3. Fill in:
   - **Project Title** *(required)*
   - **Project Description** *(required — more detail = better slides)*
   - **Technologies Used** *(optional)*
   - **Demo Video URL** *(optional — YouTube link; 4 screenshots auto-captured)*
4. Pick a **color theme** or leave on Auto
5. Click **⚡ Generate PPT** — the card appears immediately with a live progress bar
6. When the bar hits 100% and turns green → click **⬇ Download PPTX**

---

## 🎨 Color Themes

| Key | Name | Best for |
|---|---|---|
| `tech-blue` | Tech Blue | Software, Web, Cloud, IoT |
| `purple-ai` | Purple AI | AI, ML, Deep Learning, NLP |
| `green-nature` | Green Nature | Agriculture, Environment, Eco |
| `orange-food` | Orange Culinary | Food, Recipe, Nutrition |
| `red-enterprise` | Red Enterprise | Business, Finance, ERP |
| `teal-health` | Teal Health | Medical, Healthcare, Biotech |
| `gold-education` | Gold Education | E-Learning, Academic, EdTech |
| `dark-minimal` | Dark Minimal | Any modern project |

---

## ⚙️ Settings

Navigate to **⚙️ Settings** in the app to:

- **Change Groq API Key** — enter your own key, test the connection, save to localStorage
- Key is sent as `X-Groq-Api-Key` header; falls back to built-in default if blank

---

## 🌐 VPS Deployment

### Requirements
- Ubuntu 20.04 / 22.04 / 24.04
- DNS `A` record: `pptx.codeaj.com` → your server's public IP
- Root or sudo access

### Deploy in one command

```bash
# Upload script to server
scp deploy.sh root@YOUR_SERVER_IP:/root/

# SSH in and run
ssh root@YOUR_SERVER_IP
chmod +x deploy.sh
sudo bash deploy.sh
```

The script automatically:

1. Updates system packages
2. Installs Node.js 20 LTS
3. Installs PM2 (process manager)
4. Installs yt-dlp (latest)
5. Installs ffmpeg + all Puppeteer/Chromium system dependencies
6. Clones the GitHub repo (or pulls latest if already cloned)
7. Runs `npm install`
8. Starts the app with PM2 (auto-restart on crash/reboot)
9. Configures Nginx as reverse proxy (with correct SSE buffering settings)
10. Optionally installs Let's Encrypt SSL certificate

### Manual SSL (if skipped during deploy)

```bash
sudo certbot --nginx -d pptx.codeaj.com
```

### Update deployed app

```bash
cd /var/www/ppt-generator
git pull origin main
npm install --omit=dev
pm2 restart ppt-generator
```

Or just re-run the deploy script — it handles re-deploy automatically.

---

## 📁 Project Structure

```
ppt-generator/
├── server.js              # Express server — job management, SSE, API routes
├── groqClient.js          # Groq API integration (Llama 4 Scout)
├── pptGenerator.js        # pptxgenjs slide builder (15 slides)
├── screenshotExtractor.js # Puppeteer-based YouTube screenshot capture
├── colorThemes.js         # 8 color themes + auto-detect logic
├── ecosystem.config.js    # PM2 config (generated by deploy.sh)
├── deploy.sh              # One-command VPS deployment script
├── public/
│   └── index.html         # Full SPA frontend (login + dashboard + settings)
└── output/                # Temp PPTX files (auto-cleaned after 1 hour)
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/themes` | List all available color themes |
| `POST` | `/generate` | Start a new PPT generation job → returns `{ jobId }` |
| `GET` | `/progress/:jobId` | SSE stream of real-time progress events |
| `GET` | `/download/:jobId` | Download the completed `.pptx` file |
| `GET` | `/jobs` | List all active jobs (metadata only) |
| `DELETE` | `/jobs/:jobId` | Delete a job and its file |
| `POST` | `/test-api-key` | Test a Groq API key validity |

### Example: generate via curl

```bash
curl -X POST https://pptx.codeaj.com/generate \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Smart Traffic Management Using IoT",
    "description": "A real-time traffic monitoring system using IoT sensors and ML predictions to optimize signal timing and reduce congestion.",
    "technologies": "Python, Raspberry Pi, MQTT, TensorFlow, Flask",
    "demoVideo": "https://youtube.com/watch?v=XXXXX",
    "colorTheme": "tech-blue"
  }'
# Response: { "jobId": "a1b2c3d4e5f6g7h8", "themeKey": "tech-blue" }
```

---

## 🛠 PM2 Commands

```bash
pm2 status                    # View all running processes
pm2 logs ppt-generator        # Live logs
pm2 restart ppt-generator     # Restart app
pm2 stop ppt-generator        # Stop app
pm2 monit                     # Real-time CPU/memory monitor
```

---

## 🐛 Troubleshooting

| Problem | Fix |
|---|---|
| Puppeteer fails on VPS | Re-run `deploy.sh` — it installs all Chromium dependencies |
| `yt-dlp` not found | Run `sudo wget -O /usr/local/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp && sudo chmod +x /usr/local/bin/yt-dlp` |
| Screenshots not captured | VPS network may block YouTube CDN; PPT still generates with placeholder boxes |
| SSE progress not updating | Check Nginx config has `proxy_buffering off` in the `/progress/` block |
| Port 3000 already in use | `pm2 delete ppt-generator && pm2 start ecosystem.config.js` |
| SSL cert fails | Ensure `pptx.codeaj.com` DNS A record points to this server's IP first |

---

## 📄 License

MIT © [CodeAj](https://codeaj.com)

---

<p align="center">Built with ⚡ by <a href="https://codeaj.com">CodeAj</a> · Powered by Groq AI</p>
