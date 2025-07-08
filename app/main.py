from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import summary

print("✅ summary 모듈 import됨")  # ✅ 요거 있어야 summary.py가 로딩됨

app = FastAPI()

# ✅ CORS 설정 추가
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 개발 중 전체 허용. 운영 시엔 도메인 제한 권장
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(summary.router)

