# FastAPI 프레임워크에서 앱 객체를 만드는 클래스를 가져옴
from fastapi import FastAPI
# 브라우저의 CORS 보안 정책을 제어하는 미들웨어를 가져옴
from fastapi.middleware.cors import CORSMiddleware

# FastAPI 앱 인스턴스 생성 — title은 자동 생성되는 API 문서(/docs)에 표시됨
app = FastAPI(title="Hands-Free Gym Tracker API")

# 앱에 CORS 미들웨어를 등록 — 브라우저가 다른 주소의 서버에 요청할 수 있도록 허용 규칙을 설정
app.add_middleware(
    # 사용할 미들웨어 클래스 지정
    CORSMiddleware,
    # 요청을 허용할 프론트엔드 주소 목록 (Vite 개발 서버 기본 포트)
    allow_origins=["http://localhost:5173"],  # Vite dev server
    # 쿠키·인증 헤더 등 자격증명 포함 요청 허용
    allow_credentials=True,
    # 모든 HTTP 메서드(GET, POST, PUT, DELETE 등) 허용
    allow_methods=["*"],
    # 모든 HTTP 헤더 허용
    allow_headers=["*"],
)

# 라우터는 각 태스크 구현 후 순차적으로 등록
# from routers import log, routine
# app.include_router(log.router, prefix="/api")
# app.include_router(routine.router, prefix="/api")

# GET /health 엔드포인트 등록 — 서버가 정상 동작 중인지 확인하는 헬스체크용 API
@app.get("/health")
# async def: 비동기 함수 선언 — I/O 대기 중 다른 요청을 처리할 수 있어 FastAPI에서 권장
async def health_check():
    # JSON 응답 반환 — Python dict를 FastAPI가 자동으로 JSON으로 변환
    return {"status": "ok"}
