# app/main.py

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import os
import sys

# 경로 설정
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# ✅ Firebase 클라이언트 불러오기
from app.database.firebase import db

# 라우터 임포트
from app.routers import summary

app = FastAPI()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(summary.router)

# 정적 파일 등록
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# 템플릿 설정
templates = Jinja2Templates(directory="app/templates")

# ✅ initialize_firebase_admin 호출 ❌ 제거됨

# 페이지 라우팅
@app.get("/", response_class=HTMLResponse)
async def read_index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/register", response_class=HTMLResponse)
async def read_register(request: Request):
    return templates.TemplateResponse("register.html", {"request": request})

@app.get("/main", response_class=HTMLResponse)
async def read_main(request: Request):
    return templates.TemplateResponse("main.html", {"request": request})
