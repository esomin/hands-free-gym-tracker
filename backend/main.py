from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Hands-Free Gym Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터는 구현 후 순차적으로 등록
# from routers import log, routine
# app.include_router(log.router, prefix="/api")
# app.include_router(routine.router, prefix="/api")

@app.get("/health")
async def health_check():
    return {"status": "ok"}
