from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

app = FastAPI()

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

# 挂载前端静态页面
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
